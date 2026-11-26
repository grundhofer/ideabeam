// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// `seq`, the number of a wall's last stored change (PLAN.md 3.4): it grows by one with every command that changed
// something, so a browser can tell the order of what it hears and whether something is missing. The wall keeps it
// without a counter of its own (wall-room.ts, currentSeq()): these tests hold that the number is right wherever it
// is read from, and cost.test.ts that it costs no row.

import { evictAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateHexId, type ServerEvent } from "@ideabeam/shared";
import { answer, ask, createWall, join, resync, settle, stubOf, type TestSocket } from "./helpers.js";

const FRAME = { x: 0, y: 0, w: 600, h: 400 };

/** The numbers of the stored changes a socket has heard of, in the order they came. */
const heard = (socket: TestSocket) =>
  socket.events.flatMap((event: ServerEvent) =>
    "seq" in event && event.type !== "sync" && event.type !== "ack" ? [event.seq] : [],
  );

/** A note of this socket's person; the number its change got. */
async function write(socket: TestSocket, noteId = generateHexId()): Promise<{ noteId: string; seq: number }> {
  const said = await answer(socket, { type: "note.create", noteId, text: "A note", x: 0, y: 0 });
  if (said.type !== "ack") throw new Error(`refused: ${said.code}`);
  return { noteId, seq: said.seq };
}

/** Takes the number off every socket, as if none had ever carried it. */
function forgetOnSockets(wallId: string): Promise<void> {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    for (const ws of state.getWebSockets()) {
      const attachment = { ...(ws.deserializeAttachment() as { seq?: number }) };
      delete attachment.seq;
      ws.serializeAttachment(attachment);
    }
  });
}

describe("the number of a stored change", () => {
  it("starts at 0, and every command that changes something gets the next one, whoever sends it", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const ben = await join(wallId, "Ben");
    expect(anna.sync.seq).toBe(0);
    expect(ben.sync.seq).toBe(0);

    const groupId = generateHexId();
    const { noteId } = await write(anna.socket);
    const commands: Array<[TestSocket, Record<string, unknown>]> = [
      [ben.socket, { type: "note.create", noteId: generateHexId(), text: "Ben's", x: 0, y: 0 }],
      [anna.socket, { type: "note.update", noteId, text: "Anna's, changed" }],
      [ben.socket, { type: "group.create", groupId, title: "Group", ...FRAME }],
      [anna.socket, { type: "notes.move", moves: [{ noteId, x: 10, y: 10, groupId }] }],
      [ben.socket, { type: "group.update", groupId, title: "Renamed" }],
      [anna.socket, { type: "group.delete", groupId }],
      [anna.socket, { type: "note.delete", noteId }],
    ];
    for (const [index, [socket, command]] of commands.entries()) {
      // the ack carries the number the change got
      expect(await answer(socket, command), String(command.type)).toMatchObject({ type: "ack", seq: index + 2 });
    }
    await settle();
    // both heard every change, in order, without a hole
    expect(heard(anna.socket)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(heard(ben.socket)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect((await resync(ben.socket)).seq).toBe(8);
  });

  it("a command that changes nothing, a refused one and people coming and going take no number", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const { noteId } = await write(anna.socket);
    const ben = await join(wallId, "Ben");
    expect(ben.sync.seq).toBe(1);

    expect(await answer(anna.socket, { type: "note.update", noteId, text: "A note" })).toMatchObject({ seq: 1 });
    expect(await ask(ben.socket, { type: "note.update", noteId, text: "Not mine" })).toBe("NOT_AUTHOR");
    expect(await ask(ben.socket, { type: "note.update", noteId, text: "" })).toBe("INVALID");
    ben.socket.ws.close(1000, "bye");
    await anna.socket.waitFor((event) => event.type === "presence.leave");
    await join(wallId, "Cem");

    expect((await write(anna.socket)).seq).toBe(2);
  });

  it("goes on where it was after everybody left, also when the last change was a delete", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const first = await write(anna.socket);
    const second = await write(anna.socket);
    expect(await answer(anna.socket, { type: "note.delete", noteId: second.noteId })).toMatchObject({ seq: 3 });
    anna.socket.ws.close(1000, "bye");
    await settle();

    // nobody is on the wall: the number is read from what is stored, and the deleted note's row is gone
    const back = await join(wallId, "Anna", { sessionKey: anna.sessionKey });
    expect(back.sync.seq).toBe(3);
    expect(back.sync.notes).toMatchObject([{ id: first.noteId }]);
    expect((await write(back.socket)).seq).toBe(4);

    // the same with a group, which leaves no row behind either
    const groupId = generateHexId();
    expect(await answer(back.socket, { type: "group.create", groupId, title: "", ...FRAME })).toMatchObject({ seq: 5 });
    expect(await answer(back.socket, { type: "group.delete", groupId })).toMatchObject({ seq: 6 });
    back.socket.ws.close(1000, "bye");
    await settle();
    expect((await join(wallId, "Ben")).sync.seq).toBe(6);
  });

  it("survives the object being evicted, on the sockets that stay open", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const ben = await join(wallId, "Ben");
    await write(anna.socket);
    await write(ben.socket);

    await evictAllDurableObjects();

    expect((await write(ben.socket)).seq).toBe(3);
    expect(await anna.socket.waitFor((event) => event.type === "note.created" && event.seq === 3)).toBeTruthy();
    expect((await join(wallId, "Cem")).sync.seq).toBe(3);
  });

  it("is the same from the storage as from the sockets: a wall whose sockets carry none goes on correctly", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const ben = await join(wallId, "Ben");
    const { noteId } = await write(anna.socket);
    await write(ben.socket);
    expect(
      await answer(anna.socket, { type: "notes.move", moves: [{ noteId, x: 9, y: 9, groupId: null }] }),
    ).toMatchObject({
      seq: 3,
    });
    expect(await answer(anna.socket, { type: "note.delete", noteId })).toMatchObject({ seq: 4 });

    await forgetOnSockets(wallId);
    expect((await resync(ben.socket)).seq).toBe(4);
    await forgetOnSockets(wallId);
    expect((await write(ben.socket)).seq).toBe(5);
    // the change put the number back on every socket
    await runInDurableObject(stubOf(wallId), (_instance, state) => {
      const carried = state.getWebSockets().map((ws) => (ws.deserializeAttachment() as { seq?: number }).seq);
      expect(carried).toEqual([5, 5]);
    });
  });

  it("is put right by a snapshot where a socket's number ever fell behind what is stored", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    await write(anna.socket);
    await write(anna.socket);
    await write(anna.socket);
    // the socket's copy is made stale; the storage has 3
    await runInDurableObject(stubOf(wallId), (_instance, state) => {
      for (const ws of state.getWebSockets()) {
        ws.serializeAttachment({ ...(ws.deserializeAttachment() as object), seq: 1 });
      }
    });
    expect((await resync(anna.socket)).seq).toBe(3);
    expect((await write(anna.socket)).seq).toBe(4);
  });

  it("has no row of its own: the wall's meta holds no counter that moves with every change, every stored row carries its number", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const { noteId } = await write(anna.socket);
    const groupId = generateHexId();
    expect(await ask(anna.socket, { type: "group.create", groupId, title: "", ...FRAME })).toBe("ack");
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId, x: 1, y: 1, groupId }] })).toBe("ack");
    expect(await ask(anna.socket, { type: "note.update", noteId, text: "Changed" })).toBe("ack");

    const stored = await runInDurableObject(stubOf(wallId), (_instance, state) => {
      const sql = state.storage.sql;
      const one = (query: string) =>
        sql
          .exec(query)
          .toArray()
          .map((row) => Object.values(row)[0]);
      return {
        meta: one("SELECT key FROM meta ORDER BY key"),
        notes: one("SELECT seq FROM notes"),
        groups: one("SELECT seq FROM groups"),
        layout: one("SELECT seq FROM layout"),
      };
    });
    // `day` is the brake's mark, written with the day's first change and not again that day; `flow` holds the
    // phase and the clock, and is written when they change (brake.test.ts, hidden.test.ts)
    expect(stored.meta).toEqual([
      "adminToken",
      "createdAt",
      "day",
      "flow",
      "id",
      "question",
      "retentionAt",
      "schemaVersion",
    ]);
    // the note was written last by the change of its text (4), the group when it was made (2), the layout by the
    // movement (3)
    expect(stored).toMatchObject({ notes: [4], groups: [2], layout: [3] });
  });
});
