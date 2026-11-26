// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Groups on a wall: frames made by hand, with a title or without one. Everyone on the wall makes, renames, moves,
// resizes and deletes them (stage 2). The rules are tested one by one in packages/shared/test/rules.test.ts; here
// the whole way, through a socket into the storage and out to everybody.

import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  generateHexId,
  GROUP_MAX_SIZE,
  GROUP_MIN_SIZE,
  GROUP_TITLE_MAX,
  MAX_GROUPS,
  type ServerEvent,
} from "@ideabeam/shared";
import { answer, ask, createWall, join, resync, settle, stubOf, type TestSocket } from "./helpers.js";

const ofType = (events: ServerEvent[], type: ServerEvent["type"]) => events.filter((event) => event.type === type);

/** A wall with its admin Anna and a member, Ben. */
async function wall() {
  const { wallId, adminToken } = await createWall();
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  return { wallId, anna, ben };
}

const FRAME = { x: 100, y: 200, w: 600, h: 400 };

/** A group on the wall, made through this socket. */
async function frame(socket: TestSocket, title = "Meetings", at = FRAME): Promise<string> {
  const groupId = generateHexId();
  expect(await ask(socket, { type: "group.create", groupId, title, ...at })).toBe("ack");
  return groupId;
}

describe("making a group", () => {
  it("is everyone's: made by hand, its title is a person's and the group is locked; all on the wall see it", async () => {
    const { anna, ben } = await wall();
    const groupId = generateHexId();
    expect(await answer(ben.socket, { type: "group.create", groupId, title: " Meetings ", ...FRAME })).toMatchObject({
      type: "ack",
      seq: 1,
    });
    const group = { id: groupId, title: "Meetings", titleSource: "person", locked: true, ...FRAME, ord: 1 };
    for (const person of [anna, ben]) {
      expect(await person.socket.waitFor((event) => event.type === "group.created")).toEqual({
        type: "group.created",
        seq: 1,
        group,
      });
    }
    expect((await resync(anna.socket)).groups).toEqual([group]);
  });

  it("needs no title yet, and the groups stay in the order they were made", async () => {
    const { anna, ben } = await wall();
    const first = await frame(ben.socket, "");
    const second = await frame(anna.socket, "Later");
    const third = await frame(ben.socket, "Last");
    expect((await resync(anna.socket)).groups.map((group) => [group.id, group.title, group.ord])).toEqual([
      [first, "", 1],
      [second, "Later", 2],
      [third, "Last", 3],
    ]);
  });

  it("sent again it is no second group: an ack, nothing told, whoever sends it", async () => {
    const { anna, ben } = await wall();
    const create = { type: "group.create", groupId: generateHexId(), title: "Meetings", ...FRAME };
    expect(await ask(ben.socket, create)).toBe("ack");
    expect(await answer(ben.socket, create)).toMatchObject({ type: "ack", seq: 1 });
    expect(await answer(anna.socket, { ...create, title: "Mine", x: 0 })).toMatchObject({ type: "ack", seq: 1 });
    await settle();
    expect(ofType(anna.socket.events, "group.created")).toHaveLength(1);
    expect((await resync(anna.socket)).groups).toMatchObject([{ title: "Meetings", x: 100 }]);
  });

  it("is refused when it is no command: a title too long, a frame too small or too large", async () => {
    const { ben } = await wall();
    const create = { type: "group.create", groupId: generateHexId(), title: "Meetings", ...FRAME };
    for (const wrong of [
      { title: "x".repeat(GROUP_TITLE_MAX + 1) },
      { w: GROUP_MIN_SIZE - 1 },
      { h: GROUP_MAX_SIZE + 1 },
      { x: 0.5 },
      { title: undefined },
    ]) {
      expect(await ask(ben.socket, { ...create, ...wrong }), JSON.stringify(wrong)).toBe("INVALID");
    }
    expect(
      await ask(ben.socket, { ...create, title: "x".repeat(GROUP_TITLE_MAX), w: GROUP_MIN_SIZE, h: GROUP_MAX_SIZE }),
    ).toBe("ack");
    expect((await resync(ben.socket)).groups).toHaveLength(1);
  });

  it(`stops at ${MAX_GROUPS} groups`, async () => {
    const { wallId, ben } = await wall();
    await runInDurableObject(stubOf(wallId), (_instance, state) => {
      for (let i = 1; i < MAX_GROUPS; i++) {
        state.storage.sql.exec(
          `INSERT INTO groups (id, title, title_source, locked, x, y, w, h, ord, seq)
           VALUES (?, ?, 'person', 1, 0, 0, 300, 300, ?, 0)`,
          i.toString(16).padStart(32, "0"),
          `Group ${i}`,
          i,
        );
      }
    });
    const last = await frame(ben.socket, "The last one");
    expect(await ask(ben.socket, { type: "group.create", groupId: generateHexId(), title: "One more", ...FRAME })).toBe(
      "LIMIT",
    );
    const groups = (await resync(ben.socket)).groups;
    expect(groups).toHaveLength(MAX_GROUPS);
    expect(groups.at(-1)).toMatchObject({ id: last, ord: MAX_GROUPS });
    // a place is free again when one goes
    expect(await ask(ben.socket, { type: "group.delete", groupId: last })).toBe("ack");
    expect(await ask(ben.socket, { type: "group.create", groupId: generateHexId(), title: "One more", ...FRAME })).toBe(
      "ack",
    );
  });
});

describe("changing a group", () => {
  it("is everyone's: a new title, a new place, a new size, each without touching the rest", async () => {
    const { anna, ben } = await wall();
    const groupId = await frame(anna.socket);
    const group = { id: groupId, title: "Meetings", titleSource: "person", locked: true, ...FRAME, ord: 1 };

    expect(await ask(ben.socket, { type: "group.update", groupId, title: "Fewer meetings" })).toBe("ack");
    expect(await anna.socket.waitFor((event) => event.type === "group.updated")).toEqual({
      type: "group.updated",
      seq: 2,
      group: { ...group, title: "Fewer meetings" },
    });
    expect(await ask(ben.socket, { type: "group.update", groupId, x: -50, y: 75 })).toBe("ack");
    expect(await ask(anna.socket, { type: "group.update", groupId, w: 900, h: GROUP_MIN_SIZE })).toBe("ack");
    expect((await resync(ben.socket)).groups).toEqual([
      { ...group, title: "Fewer meetings", x: -50, y: 75, w: 900, h: GROUP_MIN_SIZE },
    ]);
  });

  it("may take the title away again", async () => {
    const { ben } = await wall();
    const groupId = await frame(ben.socket);
    expect(await ask(ben.socket, { type: "group.update", groupId, title: "  " })).toBe("ack");
    expect((await resync(ben.socket)).groups).toMatchObject([{ title: "", titleSource: "person" }]);
  });

  it("leaves the notes of the group where they lie", async () => {
    const { ben } = await wall();
    const groupId = await frame(ben.socket);
    const noteId = generateHexId();
    expect(await ask(ben.socket, { type: "note.create", noteId, text: "Fewer meetings", x: 0, y: 0 })).toBe("ack");
    expect(await ask(ben.socket, { type: "notes.move", moves: [{ noteId, x: 120, y: 240, groupId }] })).toBe("ack");
    expect(await ask(ben.socket, { type: "group.update", groupId, x: 500, y: 500 })).toBe("ack");
    expect((await resync(ben.socket)).notes).toMatchObject([{ x: 120, y: 240, groupId }]);
  });

  it("to what it is changes nothing: an ack, nothing told", async () => {
    const { anna, ben } = await wall();
    const groupId = await frame(ben.socket);
    expect(await answer(ben.socket, { type: "group.update", groupId, title: "Meetings", ...FRAME })).toMatchObject({
      type: "ack",
      seq: 1,
    });
    await settle();
    expect(ofType(anna.socket.events, "group.updated")).toEqual([]);
  });

  it("is refused for a group that is not on the wall, and when it names nothing or something impossible", async () => {
    const { ben } = await wall();
    expect(await ask(ben.socket, { type: "group.update", groupId: generateHexId(), title: "Nothing there" })).toBe(
      "NOT_FOUND",
    );
    const groupId = await frame(ben.socket);
    expect(await ask(ben.socket, { type: "group.update", groupId })).toBe("INVALID");
    expect(await ask(ben.socket, { type: "group.update", groupId, w: GROUP_MIN_SIZE - 1 })).toBe("INVALID");
    expect(await ask(ben.socket, { type: "group.update", groupId, title: "x".repeat(GROUP_TITLE_MAX + 1) })).toBe(
      "INVALID",
    );
    expect((await resync(ben.socket)).groups).toMatchObject([{ title: "Meetings", ...FRAME }]);
  });
});

describe("deleting a group", () => {
  it("is everyone's: the group is gone, and its notes stay where they lie, without a group", async () => {
    const { anna, ben } = await wall();
    const [gone, kept] = [await frame(anna.socket, "Goes"), await frame(anna.socket, "Stays")];
    const [inGone, inKept, free] = [generateHexId(), generateHexId(), generateHexId()];
    for (const noteId of [inGone, inKept, free]) {
      expect(await ask(ben.socket, { type: "note.create", noteId, text: "A note", x: 0, y: 0 })).toBe("ack");
    }
    expect(
      await ask(ben.socket, {
        type: "notes.move",
        moves: [
          { noteId: inGone, x: 11, y: 12, groupId: gone },
          { noteId: inKept, x: 21, y: 22, groupId: kept },
        ],
      }),
    ).toBe("ack");

    expect(await ask(ben.socket, { type: "group.delete", groupId: gone })).toBe("ack");
    expect(await anna.socket.waitFor((event) => event.type === "group.deleted")).toEqual({
      type: "group.deleted",
      seq: 7,
      groupId: gone,
    });
    const after = await resync(anna.socket);
    expect(after.groups).toMatchObject([{ id: kept }]);
    expect(after.notes).toMatchObject([
      { id: inGone, x: 11, y: 12, groupId: null },
      { id: inKept, x: 21, y: 22, groupId: kept },
      { id: free, x: 0, y: 0, groupId: null },
    ]);
    // one event tells it: the notes are not moved one by one
    await settle();
    expect(ofType(anna.socket.events, "notes.moved")).toHaveLength(1);
  });

  it("sent again it changes nothing: an ack, nothing told", async () => {
    const { anna, ben } = await wall();
    const groupId = await frame(ben.socket);
    expect(await ask(ben.socket, { type: "group.delete", groupId })).toBe("ack");
    expect(await answer(anna.socket, { type: "group.delete", groupId })).toMatchObject({ type: "ack", seq: 2 });
    await settle();
    expect(ofType(ben.socket.events, "group.deleted")).toHaveLength(1);
  });

  it("a group made again under the id of a deleted one starts empty", async () => {
    const { ben } = await wall();
    const groupId = await frame(ben.socket);
    const noteId = generateHexId();
    expect(await ask(ben.socket, { type: "note.create", noteId, text: "A note", x: 0, y: 0 })).toBe("ack");
    expect(await ask(ben.socket, { type: "notes.move", moves: [{ noteId, x: 5, y: 5, groupId }] })).toBe("ack");
    expect(await ask(ben.socket, { type: "group.delete", groupId })).toBe("ack");
    expect(await ask(ben.socket, { type: "group.create", groupId, title: "Again", ...FRAME })).toBe("ack");
    const after = await resync(ben.socket);
    expect(after.groups).toMatchObject([{ id: groupId, title: "Again" }]);
    expect(after.notes).toMatchObject([{ id: noteId, groupId: null }]);
  });
});
