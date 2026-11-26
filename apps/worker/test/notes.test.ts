// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Notes on a wall: writing, changing, deleting and moving them. What a command may do is decided by the shared rules
// (packages/shared/test/rules.test.ts tests them one by one); here the whole way is tested, through a socket into
// the object's storage and out to everybody on the wall.

import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { COORD_LIMIT, generateHexId, MAX_MOVES, MAX_NOTES, NOTE_TEXT_MAX, type ServerEvent } from "@ideabeam/shared";
import { answer, ask, connect, createWall, join, resync, settle, stubOf, type TestSocket } from "./helpers.js";

const ofType = (events: ServerEvent[], type: ServerEvent["type"]) => events.filter((event) => event.type === type);

/** A wall with its admin Anna and two members, Ben and Cem. */
async function wall() {
  const { wallId, adminToken } = await createWall();
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  const cem = await join(wallId, "Cem");
  return { wallId, anna, ben, cem };
}

/** A note of this socket's person, on the wall. */
async function write(socket: TestSocket, text = "Fewer meetings", x = 0, y = 0): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(socket, { type: "note.create", noteId, text, x, y })).toBe("ack");
  return noteId;
}

/** Notes put into the storage directly, as many as a test needs without sending a frame for each. */
function seed(wallId: string, count: number, authorId: string): Promise<string[]> {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = i.toString(16).padStart(32, "0");
      ids.push(id);
      state.storage.sql.exec(
        "INSERT INTO notes (id, author_id, text, x0, y0, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
        id,
        authorId,
        `Note ${i}`,
        i,
        i,
        1_795_300_000_000 + i,
        1_795_300_000_000 + i,
      );
    }
    return ids;
  });
}

/** What the wall has stored about where notes lie: the rows of the layout table. */
function layout(wallId: string): Promise<Array<{ k: string; v: unknown }>> {
  return runInDurableObject(stubOf(wallId), (_instance, state) =>
    state.storage.sql
      .exec("SELECT k, v FROM layout")
      .toArray()
      .map((row) => ({ k: String(row.k), v: JSON.parse(String(row.v)) as unknown })),
  );
}

describe("writing a note", () => {
  it("is everyone's: the note is its sender's, lies where it was put, and all on the wall see it", async () => {
    const { anna, ben, cem } = await wall();
    const noteId = generateHexId();
    const said = await answer(ben.socket, { type: "note.create", noteId, text: "  Fewer meetings ", x: 120, y: -40 });
    expect(said).toMatchObject({ type: "ack", seq: 1 });

    const note = {
      id: noteId,
      text: "Fewer meetings",
      x: 120,
      y: -40,
      groupId: null,
      createdAt: expect.any(Number) as number,
      updatedAt: expect.any(Number) as number,
    };
    // each hears whether the note is their own, and nobody whose it is
    for (const person of [anna, ben, cem]) {
      expect(await person.socket.waitFor((event) => event.type === "note.created")).toEqual({
        type: "note.created",
        seq: 1,
        note: { ...note, mine: person === ben },
      });
    }
    const stored = (await resync(cem.socket)).notes[0];
    expect(stored).toEqual({ ...note, mine: false });
    expect((await resync(ben.socket)).notes[0]).toEqual({ ...note, mine: true });
    expect(Math.abs((stored?.createdAt ?? 0) - Date.now())).toBeLessThan(5000);
    expect(stored?.updatedAt).toBe(stored?.createdAt);
  });

  it("names nobody: no frame about a note carries the id of who wrote it, to its writer or to anyone else", async () => {
    const { anna, ben, cem } = await wall();
    const noteId = await write(ben.socket, "Fewer meetings");
    expect(await ask(ben.socket, { type: "note.update", noteId, text: "Shorter meetings" })).toBe("ack");
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId, x: 5, y: 5, groupId: null }] })).toBe("ack");
    for (const person of [anna, ben, cem]) {
      await resync(person.socket);
      const frames = person.socket.raw.filter((frame) => frame.includes(noteId));
      expect(frames.length).toBeGreaterThanOrEqual(4); // written, changed, moved, and the snapshot
      for (const frame of frames) {
        expect(frame).not.toContain("authorId");
        // Ben's id is in a snapshot once per place he stands in the list of people, and nowhere beside it
        const withoutPeople = JSON.stringify({ ...(JSON.parse(frame) as object), participants: [], you: null });
        expect(withoutPeople).not.toContain(ben.you);
      }
    }
  });

  it("reaches its sender before the ack does", async () => {
    const { ben } = await wall();
    await write(ben.socket);
    const types = ben.socket.events.map((event) => event.type);
    expect(types.indexOf("note.created")).toBeGreaterThan(-1);
    expect(types.indexOf("note.created")).toBeLessThan(types.indexOf("ack"));
  });

  it("sent again it is no second note: an ack, nothing told, nothing stored", async () => {
    const { anna, ben } = await wall();
    const create = { type: "note.create", noteId: generateHexId(), text: "Fewer meetings", x: 0, y: 0 };
    expect(await answer(ben.socket, create)).toMatchObject({ type: "ack", seq: 1 });
    // the same frame again, as after a lost answer; and once more after the note has changed
    expect(await answer(ben.socket, create)).toMatchObject({ type: "ack", seq: 1 });
    expect(await ask(ben.socket, { type: "note.update", noteId: create.noteId, text: "Shorter meetings" })).toBe("ack");
    expect(await answer(ben.socket, create)).toMatchObject({ type: "ack", seq: 2 });
    await settle();
    expect(ofType(anna.socket.events, "note.created")).toHaveLength(1);
    expect((await resync(anna.socket)).notes).toMatchObject([{ id: create.noteId, text: "Shorter meetings" }]);
  });

  it("is refused under the id of somebody else's note", async () => {
    const { ben, cem } = await wall();
    const noteId = await write(ben.socket, "Ben's");
    expect(await ask(cem.socket, { type: "note.create", noteId, text: "Cem's", x: 0, y: 0 })).toBe("CONFLICT");
    expect((await resync(cem.socket)).notes).toMatchObject([{ mine: false, text: "Ben's" }]);
    expect((await resync(ben.socket)).notes).toMatchObject([{ mine: true, text: "Ben's" }]);
  });

  it("is refused under its operation's id when it is no command: a text too long or empty, a place off the surface", async () => {
    const { anna, ben } = await wall();
    const create = { type: "note.create", noteId: generateHexId(), text: "Fewer meetings", x: 0, y: 0 };
    for (const wrong of [
      { text: "x".repeat(NOTE_TEXT_MAX + 1) },
      { text: "   " },
      { x: COORD_LIMIT + 1 },
      { y: 0.5 },
      { noteId: "note-1" },
    ]) {
      const opId = generateHexId();
      ben.socket.send({ ...create, ...wrong, opId });
      expect(await ben.socket.waitFor((event) => event.type === "reject" && event.opId === opId)).toEqual({
        type: "reject",
        opId,
        code: "INVALID",
      });
    }
    expect(await ask(ben.socket, { ...create, text: "x".repeat(NOTE_TEXT_MAX), x: -COORD_LIMIT, y: COORD_LIMIT })).toBe(
      "ack",
    );
    await settle();
    expect(ofType(anna.socket.events, "note.created")).toHaveLength(1);
  });

  it(`stops at ${MAX_NOTES} notes`, async () => {
    const { wallId, ben } = await wall();
    await seed(wallId, MAX_NOTES - 1, ben.you);
    const last = generateHexId();
    expect(await ask(ben.socket, { type: "note.create", noteId: last, text: "The last one", x: 0, y: 0 })).toBe("ack");
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "One more", x: 0, y: 0 })).toBe(
      "LIMIT",
    );
    // the note that is there is still answered, and a place is free again when one goes
    expect(await ask(ben.socket, { type: "note.create", noteId: last, text: "The last one", x: 0, y: 0 })).toBe("ack");
    expect(await ask(ben.socket, { type: "note.delete", noteId: last })).toBe("ack");
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "One more", x: 0, y: 0 })).toBe(
      "ack",
    );
    expect((await resync(ben.socket)).notes).toHaveLength(MAX_NOTES);
  });
});

describe("changing a note's text", () => {
  it("is its author's: everyone sees the new text, and when it was written", async () => {
    const { anna, ben } = await wall();
    const noteId = await write(ben.socket);
    const before = (await resync(anna.socket)).notes[0];
    expect(await ask(ben.socket, { type: "note.update", noteId, text: " Shorter meetings " })).toBe("ack");
    expect(await anna.socket.waitFor((event) => event.type === "note.updated")).toEqual({
      type: "note.updated",
      seq: 2,
      noteId,
      text: "Shorter meetings",
      updatedAt: expect.any(Number) as number,
    });
    const after = (await resync(anna.socket)).notes[0];
    expect(after).toMatchObject({ id: noteId, text: "Shorter meetings", createdAt: before?.createdAt });
    expect(after?.updatedAt).toBeGreaterThanOrEqual(before?.updatedAt ?? Infinity);
  });

  it("is nobody else's: not another member's, not the admin's", async () => {
    const { anna, ben, cem } = await wall();
    const noteId = await write(ben.socket);
    expect(await ask(cem.socket, { type: "note.update", noteId, text: "Cem was here" })).toBe("NOT_AUTHOR");
    expect(await ask(anna.socket, { type: "note.update", noteId, text: "Anna was here" })).toBe("NOT_AUTHOR");
    expect((await resync(anna.socket)).notes).toMatchObject([{ text: "Fewer meetings" }]);
    await settle();
    expect(ofType(ben.socket.events, "note.updated")).toEqual([]);
  });

  it("keeps the note where it lies, also after it was moved into a group", async () => {
    const { ben } = await wall();
    const noteId = await write(ben.socket, "Fewer meetings", 10, 10);
    const groupId = generateHexId();
    expect(await ask(ben.socket, { type: "group.create", groupId, title: "", x: 0, y: 0, w: 600, h: 400 })).toBe("ack");
    expect(await ask(ben.socket, { type: "notes.move", moves: [{ noteId, x: 50, y: 60, groupId }] })).toBe("ack");
    expect(await ask(ben.socket, { type: "note.update", noteId, text: "Shorter meetings" })).toBe("ack");
    expect((await resync(ben.socket)).notes).toMatchObject([{ text: "Shorter meetings", x: 50, y: 60, groupId }]);
  });

  it("to the text it has changes nothing: an ack, nothing told", async () => {
    const { anna, ben } = await wall();
    const noteId = await write(ben.socket);
    expect(await answer(ben.socket, { type: "note.update", noteId, text: "Fewer meetings" })).toMatchObject({
      type: "ack",
      seq: 1,
    });
    await settle();
    expect(ofType(anna.socket.events, "note.updated")).toEqual([]);
  });

  it("is refused for a note that is not on the wall, and for a text that is none", async () => {
    const { ben } = await wall();
    expect(await ask(ben.socket, { type: "note.update", noteId: generateHexId(), text: "Nothing there" })).toBe(
      "NOT_FOUND",
    );
    const noteId = await write(ben.socket);
    expect(await ask(ben.socket, { type: "note.update", noteId, text: "" })).toBe("INVALID");
    expect(await ask(ben.socket, { type: "note.update", noteId, text: "x".repeat(NOTE_TEXT_MAX + 1) })).toBe("INVALID");
  });
});

describe("deleting a note", () => {
  it("is its author's: the note is gone for everyone", async () => {
    const { anna, ben } = await wall();
    const noteId = await write(ben.socket);
    expect(await ask(ben.socket, { type: "note.delete", noteId })).toBe("ack");
    expect(await anna.socket.waitFor((event) => event.type === "note.deleted")).toEqual({
      type: "note.deleted",
      seq: 2,
      noteId,
    });
    expect((await resync(anna.socket)).notes).toEqual([]);
  });

  it("is an admin's too, and no other member's", async () => {
    const { anna, ben, cem } = await wall();
    const noteId = await write(ben.socket);
    expect(await ask(cem.socket, { type: "note.delete", noteId })).toBe("NOT_AUTHOR");
    expect((await resync(cem.socket)).notes).toHaveLength(1);
    expect(await ask(anna.socket, { type: "note.delete", noteId })).toBe("ack");
    expect((await resync(cem.socket)).notes).toEqual([]);
  });

  it("takes the note's place out of the layout, and leaves the other notes theirs", async () => {
    const { wallId, ben } = await wall();
    const [gone, kept] = [await write(ben.socket), await write(ben.socket)];
    expect(
      await ask(ben.socket, {
        type: "notes.move",
        moves: [
          { noteId: gone, x: 10, y: 10, groupId: null },
          { noteId: kept, x: 20, y: 20, groupId: null },
        ],
      }),
    ).toBe("ack");
    expect(await ask(ben.socket, { type: "note.delete", noteId: gone })).toBe("ack");
    expect(await layout(wallId)).toEqual([{ k: "pos", v: { [kept]: [20, 20, null] } }]);
  });

  it("sent again it changes nothing: an ack, nothing told", async () => {
    const { anna, ben, cem } = await wall();
    const noteId = await write(ben.socket);
    expect(await ask(ben.socket, { type: "note.delete", noteId })).toBe("ack");
    expect(await answer(ben.socket, { type: "note.delete", noteId })).toMatchObject({ type: "ack", seq: 2 });
    // gone is gone, whoever asks
    expect(await ask(cem.socket, { type: "note.delete", noteId })).toBe("ack");
    await settle();
    expect(ofType(anna.socket.events, "note.deleted")).toHaveLength(1);
  });
});

describe("moving notes", () => {
  it("is everyone's, with anybody's note: all on the wall see where it went", async () => {
    const { anna, ben, cem } = await wall();
    const noteId = await write(ben.socket, "Fewer meetings", 5, 5);
    expect(await ask(cem.socket, { type: "notes.move", moves: [{ noteId, x: 300, y: -200, groupId: null }] })).toBe(
      "ack",
    );
    for (const person of [anna, ben, cem]) {
      expect(await person.socket.waitFor((event) => event.type === "notes.moved")).toEqual({
        type: "notes.moved",
        seq: 2,
        moves: [{ noteId, x: 300, y: -200, groupId: null }],
      });
    }
    expect((await resync(anna.socket)).notes).toMatchObject([{ id: noteId, x: 300, y: -200, groupId: null }]);
  });

  it("puts a note into a group and takes it out again", async () => {
    const { anna, ben } = await wall();
    const noteId = await write(ben.socket);
    const groupId = generateHexId();
    expect(
      await ask(anna.socket, { type: "group.create", groupId, title: "Meetings", x: 0, y: 0, w: 600, h: 400 }),
    ).toBe("ack");
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId, x: 16, y: 48, groupId }] })).toBe("ack");
    expect((await resync(ben.socket)).notes).toMatchObject([{ x: 16, y: 48, groupId }]);
    expect(await ask(ben.socket, { type: "notes.move", moves: [{ noteId, x: 900, y: 48, groupId: null }] })).toBe(
      "ack",
    );
    expect((await resync(ben.socket)).notes).toMatchObject([{ x: 900, y: 48, groupId: null }]);
  });

  it("moves a selection in one frame: one event for all of it, one stored row", async () => {
    const { wallId, anna, ben } = await wall();
    const notes = [await write(ben.socket), await write(anna.socket), await write(ben.socket)];
    const moves = notes.map((noteId, i) => ({ noteId, x: 100 * i, y: 50, groupId: null }));
    expect(await ask(anna.socket, { type: "notes.move", moves })).toBe("ack");
    expect(await ben.socket.waitFor((event) => event.type === "notes.moved")).toMatchObject({ seq: 4, moves });
    await settle();
    expect(ofType(ben.socket.events, "notes.moved")).toHaveLength(1);
    expect(await layout(wallId)).toEqual([
      { k: "pos", v: Object.fromEntries(notes.map((noteId, i) => [noteId, [100 * i, 50, null]])) },
    ]);
  });

  it(`moves every note of a full wall in one frame: ${MAX_MOVES} notes, one event, one stored row`, async () => {
    const { wallId, anna, ben } = await wall();
    const notes = await seed(wallId, MAX_NOTES, ben.you);
    const groupId = generateHexId();
    expect(await ask(anna.socket, { type: "group.create", groupId, title: "All", x: 0, y: 0, w: 9000, h: 9000 })).toBe(
      "ack",
    );
    const moves = notes.map((noteId, i) => ({ noteId, x: (i % 25) * 260, y: Math.floor(i / 25) * 400, groupId }));
    expect(await ask(anna.socket, { type: "notes.move", moves })).toBe("ack");
    const moved = await ben.socket.waitFor((event) => event.type === "notes.moved");
    expect(moved.type === "notes.moved" && moved.moves).toHaveLength(MAX_MOVES);
    const stored = await layout(wallId);
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0]?.v as object)).toHaveLength(MAX_MOVES);
    const after = (await resync(ben.socket)).notes;
    expect(after).toHaveLength(MAX_NOTES);
    expect(after.every((note) => note.groupId === groupId)).toBe(true);
    expect(after[26]).toMatchObject({ id: notes[26], x: 260, y: 400 });
    // one note more than a wall holds is no movement
    const tooMany = [...moves, { noteId: generateHexId(), x: 0, y: 0, groupId: null }];
    expect(await ask(anna.socket, { type: "notes.move", moves: tooMany })).toBe("INVALID");
  });

  it("to where the notes lie changes nothing: an ack, nothing told", async () => {
    const { anna, ben } = await wall();
    const noteId = await write(ben.socket, "Fewer meetings", 5, 5);
    // where it was made, and then where it was moved to
    expect(
      await answer(ben.socket, { type: "notes.move", moves: [{ noteId, x: 5, y: 5, groupId: null }] }),
    ).toMatchObject({
      type: "ack",
      seq: 1,
    });
    const move = { type: "notes.move", moves: [{ noteId, x: 70, y: 80, groupId: null }] };
    expect(await answer(ben.socket, move)).toMatchObject({ type: "ack", seq: 2 });
    expect(await answer(ben.socket, move)).toMatchObject({ type: "ack", seq: 2 });
    await settle();
    expect(ofType(anna.socket.events, "notes.moved")).toHaveLength(1);
  });

  it("leaves out a note that is gone, and tells only of the notes that went somewhere", async () => {
    const { anna, ben } = await wall();
    const [here, there, gone] = [await write(ben.socket), await write(ben.socket, "Stays", 7, 7), generateHexId()];
    expect(
      await ask(anna.socket, {
        type: "notes.move",
        moves: [
          { noteId: here, x: 10, y: 10, groupId: null },
          { noteId: there, x: 7, y: 7, groupId: null },
          { noteId: gone, x: 30, y: 30, groupId: null },
        ],
      }),
    ).toBe("ack");
    expect(await ben.socket.waitFor((event) => event.type === "notes.moved")).toMatchObject({
      moves: [{ noteId: here, x: 10, y: 10, groupId: null }],
    });
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId: gone, x: 1, y: 1, groupId: null }] })).toBe(
      "ack",
    );
    expect((await resync(ben.socket)).notes).toHaveLength(2);
  });

  it("into a group that is gone puts the note at its place, in no group", async () => {
    const { ben } = await wall();
    const noteId = await write(ben.socket);
    expect(
      await ask(ben.socket, { type: "notes.move", moves: [{ noteId, x: 40, y: 40, groupId: generateHexId() }] }),
    ).toBe("ack");
    expect((await resync(ben.socket)).notes).toMatchObject([{ x: 40, y: 40, groupId: null }]);
  });

  it("is refused when it names a note twice, or no note, or a place off the surface", async () => {
    const { ben } = await wall();
    const noteId = await write(ben.socket);
    const at = { noteId, x: 1, y: 1, groupId: null };
    expect(await ask(ben.socket, { type: "notes.move", moves: [at, { ...at, x: 2 }] })).toBe("INVALID");
    expect(await ask(ben.socket, { type: "notes.move", moves: [] })).toBe("INVALID");
    expect(await ask(ben.socket, { type: "notes.move", moves: [{ ...at, x: -COORD_LIMIT - 1 }] })).toBe("INVALID");
    expect((await resync(ben.socket)).notes).toMatchObject([{ x: 0, y: 0 }]);
  });
});

describe("a command about notes", () => {
  it("is nobody's who has not joined, valid or not", async () => {
    const { wallId } = await createWall();
    const socket = await connect(wallId);
    socket.send({ type: "note.create", opId: generateHexId(), noteId: generateHexId(), text: "Hello", x: 0, y: 0 });
    expect(await socket.waitFor((event) => event.type === "error")).toEqual({ type: "error", code: "NOT_JOINED" });
    socket.send({ type: "note.create", opId: generateHexId(), noteId: generateHexId(), text: "", x: 0, y: 0 });
    expect(await socket.waitForNext((event) => event.type === "error")).toEqual({ type: "error", code: "NOT_JOINED" });
  });
});
