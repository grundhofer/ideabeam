// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// „Meine Angaben löschen“ (`me.erase`): the wall forgets a person, and their notes stay without a name (the owner's
// decision K, PLAN.md 7.3). Adapted from FokusBeam's tests of the same command (apps/worker/test/checkout.test.ts,
// docs/HERKUNFT.md).

import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateHexId } from "@ideabeam/shared";
import { ask, connect, createWall, join, resync, settle, stubOf, type TestSocket } from "./helpers.js";

/** A wall with its admin Anna and a member, Ben. */
async function wall() {
  const { wallId, adminToken } = await createWall();
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  return { wallId, adminToken, anna, ben };
}

async function write(socket: TestSocket, text: string): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(socket, { type: "note.create", noteId, text, x: 0, y: 0 })).toBe("ack");
  return noteId;
}

/** What the wall has stored, read past the protocol: the rows themselves. */
function stored(wallId: string) {
  return runInDurableObject(stubOf(wallId), (_instance, state) => ({
    participants: state.storage.sql.exec("SELECT id, name, session_key FROM participants ORDER BY joined_at").toArray(),
    notes: state.storage.sql.exec("SELECT author_id, text FROM notes ORDER BY created_at, id").toArray(),
  }));
}

describe("„Meine Angaben löschen“", () => {
  it("removes the person from the wall's storage, keeps their notes, and tells the others", async () => {
    const { wallId, anna, ben } = await wall();
    await write(anna.socket, "Weniger Termine");
    await write(ben.socket, "Fokuszeit am Vormittag");

    expect(await ask(ben.socket, { type: "me.erase" })).toBe("ack");
    expect(await anna.socket.waitFor((event) => event.type === "participant.removed")).toEqual({
      type: "participant.removed",
      participantId: ben.you,
    });
    await ben.socket.waitFor((event) => event.type === "erased");
    await settle();
    expect(ben.socket.closed()).toBe(true);
    // the socket that closed was nobody's any more: no „Ben ist gegangen“ after „Ben ist weg“
    expect(anna.socket.events.some((event) => event.type === "presence.leave")).toBe(false);

    const after = await resync(anna.socket);
    expect(after.participants.map((person) => person.name)).toEqual(["Anna"]);
    // the note stays, and is nobody's: Anna's own is hers, Ben's is not
    expect(after.notes.map((note) => note.text)).toEqual(["Weniger Termine", "Fokuszeit am Vormittag"]);
    expect(after.notes.map((note) => note.mine)).toEqual([true, false]);
    expect(after.participants.some((person) => person.id === ben.you)).toBe(false);
    const rows = await stored(wallId);
    expect(rows.participants.map((row) => row.name)).toEqual(["Anna"]);
    expect(rows.participants.some((row) => row.session_key === ben.sessionKey)).toBe(false);
    expect(rows.notes.map((row) => row.text)).toEqual(["Weniger Termine", "Fokuszeit am Vormittag"]);
  });

  it("leaves notes nobody changes again, which the moderation can still delete", async () => {
    const { wallId, anna, ben } = await wall();
    const noteId = await write(ben.socket, "Fokuszeit am Vormittag");
    await ask(ben.socket, { type: "me.erase" });
    await anna.socket.waitFor((event) => event.type === "participant.removed");

    // back under the old name and the old session key, Ben is a new person: the note is no longer theirs
    const back = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(back.you).not.toBe(ben.you);
    expect(back.sync.notes).toMatchObject([{ id: noteId, mine: false }]);
    expect(await ask(back.socket, { type: "note.update", noteId, text: "Mein Zettel?" })).toBe("NOT_AUTHOR");
    expect(await ask(back.socket, { type: "note.delete", noteId })).toBe("NOT_AUTHOR");
    expect(await ask(anna.socket, { type: "note.delete", noteId })).toBe("ack");
  });

  it("reaches every tab of the person, so none of them joins again by itself", async () => {
    const { wallId, ben } = await wall();
    const tab = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(tab.you).toBe(ben.you);
    expect(await ask(ben.socket, { type: "me.erase" })).toBe("ack");
    await tab.socket.waitFor((event) => event.type === "erased");
    await ben.socket.waitFor((event) => event.type === "erased");
    await settle();
    expect(tab.socket.closed()).toBe(true);
    expect(ben.socket.closed()).toBe(true);
  });

  it("frees the name: whoever comes back with the old session key is a new person", async () => {
    const { wallId, anna, ben } = await wall();
    await ask(ben.socket, { type: "me.erase" });
    await anna.socket.waitFor((event) => event.type === "participant.removed");
    const back = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(back.you).not.toBe(ben.you);
    expect(back.sync.participants.map((person) => person.name)).toEqual(["Anna", "Ben"]);
  });

  it("is an admin's too: the token still opens the wall, and whoever holds it moderates again", async () => {
    const { wallId, adminToken, anna, ben } = await wall();
    expect(await ask(anna.socket, { type: "me.erase" })).toBe("ack");
    await ben.socket.waitFor((event) => event.type === "participant.removed");
    expect((await resync(ben.socket)).participants).toMatchObject([{ name: "Ben", role: "member" }]);
    const again = await join(wallId, "Anna", { adminToken });
    expect(again.you).not.toBe(anna.you);
    expect(again.sync.participants).toMatchObject([
      { name: "Ben", role: "member" },
      { name: "Anna", role: "admin" },
    ]);
  });

  it("is nothing before a join", async () => {
    const { wallId } = await wall();
    const stranger = await connect(wallId);
    stranger.send({ type: "me.erase", opId: generateHexId() });
    expect(await stranger.waitFor((event) => event.type === "error")).toEqual({ type: "error", code: "NOT_JOINED" });
  });
});
