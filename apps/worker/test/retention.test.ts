// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { env, runDurableObjectAlarm, runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { WALL_ID_PATTERN } from "@ideabeam/shared";
import { RETENTION_MS } from "../src/wall-room.js";
import { newWall, wallStub } from "../src/wall-stub.js";
import { answer, ask, createWall, FREE, join, resync, settle } from "./helpers.js";

const DAY = 24 * 60 * 60 * 1000;

function stubOf(wallId: string) {
  const stub = wallStub(env, wallId);
  if (stub === null) throw new Error("the namespace did not take its own id");
  return stub;
}

/** What the wall has stored about its own end: the deadline and the alarm. */
function deadline(wallId: string): Promise<{ retentionAt: number; alarm: number | null }> {
  return runInDurableObject(stubOf(wallId), async (_instance, state) => {
    const row = state.storage.sql.exec("SELECT value FROM meta WHERE key = 'retentionAt'").toArray()[0];
    return { retentionAt: Number(row?.value), alarm: await state.storage.getAlarm() };
  });
}

function setDeadline(wallId: string, retentionAt: number): Promise<void> {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    state.storage.sql.exec("UPDATE meta SET value = ? WHERE key = 'retentionAt'", String(retentionAt));
  });
}

/** The tables the wall made, by name: none once it is gone. */
function tables(wallId: string): Promise<string[]> {
  return runInDurableObject(stubOf(wallId), (_instance, state) =>
    state.storage.sql
      .exec(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('meta', 'participants', 'notes', 'groups', 'layout') ORDER BY name`,
      )
      .toArray()
      .map((row) => String(row.name)),
  );
}

const ALL_TABLES = ["groups", "layout", "meta", "notes", "participants"];

describe("the day a wall deletes itself", () => {
  it("is thirty days after it was made, and the alarm is set for it", async () => {
    const { wallId } = await createWall();
    const { retentionAt, alarm } = await deadline(wallId);
    expect(RETENTION_MS).toBe(30 * DAY);
    expect(Math.abs(retentionAt - (Date.now() + RETENTION_MS))).toBeLessThan(5000);
    expect(alarm).toBe(retentionAt);
  });

  it("moves when somebody joins, but at most once a day", async () => {
    const { wallId } = await createWall();
    // A wall that was last used a good two days ago.
    await setDeadline(wallId, Date.now() + RETENTION_MS - 2 * DAY - 60_000);
    await join(wallId, "Anna");
    const moved = await deadline(wallId);
    expect(Math.abs(moved.retentionAt - (Date.now() + RETENTION_MS))).toBeLessThan(5000);
    expect(moved.alarm).toBe(moved.retentionAt);

    // The next join the same day writes nothing: the deadline stands as it is.
    await join(wallId, "Ben");
    expect(await deadline(wallId)).toEqual(moved);
  });

  it("an alarm that fires early changes nothing and is set again", async () => {
    const { wallId } = await createWall();
    const before = await deadline(wallId);
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);
    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(200);
    expect(await deadline(wallId)).toEqual(before);
  });

  it("deletes the wall when the day has come: everyone is told, nothing is left", async () => {
    const { wallId, adminToken } = await createWall();
    const anna = await join(wallId, "Anna", { adminToken });
    expect(await ask(anna.socket, { type: "note.create", noteId: "1".repeat(32), text: "A note", x: 0, y: 0 })).toBe(
      "ack",
    );
    expect(await tables(wallId)).toEqual(ALL_TABLES);

    await setDeadline(wallId, Date.now() - 1000);
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);

    await anna.socket.waitFor((event) => event.type === "wall.deleted");
    await settle();
    expect(anna.socket.closed()).toBe(true);
    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(404);
    expect(await tables(wallId)).toEqual([]);
    expect(await runInDurableObject(stubOf(wallId), (_instance, state) => state.storage.getAlarm())).toBeNull();
  });
});

describe("a wall its admin deletes", () => {
  it("leaves nothing in the storage: no table, no alarm", async () => {
    const { wallId, adminToken } = await createWall();
    const anna = await join(wallId, "Anna", { adminToken });
    anna.socket.send({ type: "admin.wall.delete", opId: "0123456789abcdef".repeat(2) });
    await anna.socket.waitFor((event) => event.type === "wall.deleted");

    expect(await tables(wallId)).toEqual([]);
    expect(await runInDurableObject(stubOf(wallId), (_instance, state) => state.storage.getAlarm())).toBeNull();
  });
});

describe("a wall that an older build made", () => {
  /** Makes the wall what stage 1 left behind: its two tables, schema 1, no table for notes, groups or the layout,
   *  and nothing about a phase. */
  function asStageOne(wallId: string): Promise<void> {
    return runInDurableObject(stubOf(wallId), (_instance, state) => {
      state.storage.sql.exec("DROP TABLE notes; DROP TABLE groups; DROP TABLE layout;");
      state.storage.sql.exec("UPDATE meta SET value = '1' WHERE key = 'schemaVersion'");
      state.storage.sql.exec("DELETE FROM meta WHERE key IN ('flow', 'day', 'agenda')");
    });
  }

  /** Makes the wall what stage 2 left behind: schema 2, every table, nothing about a phase, a clock or a day. */
  function asStageTwo(wallId: string): Promise<void> {
    return runInDurableObject(stubOf(wallId), (_instance, state) => {
      state.storage.sql.exec("UPDATE meta SET value = '2' WHERE key = 'schemaVersion'");
      state.storage.sql.exec("DELETE FROM meta WHERE key IN ('flow', 'day', 'agenda')");
    });
  }

  const metaKeys = (wallId: string) =>
    runInDurableObject(stubOf(wallId), (_instance, state) =>
      state.storage.sql
        .exec("SELECT key FROM meta ORDER BY key")
        .toArray()
        .map((row) => String(row.key)),
    );

  const schemaVersion = (wallId: string) =>
    runInDurableObject(stubOf(wallId), (_instance, state) =>
      String(state.storage.sql.exec("SELECT value FROM meta WHERE key = 'schemaVersion'").one().value),
    );

  it("gets its new tables where a visit begins, and takes notes from then on", async () => {
    const { wallId } = await createWall("An old wall");
    await asStageOne(wallId);
    expect(await tables(wallId)).toEqual(["meta", "participants"]);

    // the page that asks a newcomer for their name is the first to reach it
    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(200);
    expect(await tables(wallId)).toEqual(ALL_TABLES);
    expect(await schemaVersion(wallId)).toBe("4");

    const anna = await join(wallId, "Anna");
    expect(anna.sync).toMatchObject({ seq: 0, ...FREE, hidden: 0, notes: [], groups: [] });
    expect(await ask(anna.socket, { type: "note.create", noteId: "1".repeat(32), text: "A note", x: 0, y: 0 })).toBe(
      "ack",
    );
    expect((await resync(anna.socket)).notes).toHaveLength(1);
  });

  it("gets them from a socket that opens, or from the alarm, whichever reaches it first", async () => {
    const viaSocket = await createWall("An old wall");
    await asStageOne(viaSocket.wallId);
    expect((await join(viaSocket.wallId, "Anna")).sync.notes).toEqual([]);
    expect(await tables(viaSocket.wallId)).toEqual(ALL_TABLES);

    const viaAlarm = await createWall("Another old wall");
    await asStageOne(viaAlarm.wallId);
    expect(await runDurableObjectAlarm(stubOf(viaAlarm.wallId))).toBe(true);
    expect(await tables(viaAlarm.wallId)).toEqual(ALL_TABLES);
  });

  it("is migrated once: a wall of this build is left as it is", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    expect(await ask(anna.socket, { type: "note.create", noteId: "1".repeat(32), text: "A note", x: 0, y: 0 })).toBe(
      "ack",
    );
    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(200);
    expect((await resync(anna.socket)).notes).toHaveLength(1);
    expect(await schemaVersion(wallId)).toBe("4");
  });

  it("of stage 2 keeps working and becomes a revealed wall: its notes stay visible to everyone, without a name", async () => {
    const { wallId, adminToken } = await createWall("A wall of stage 2");
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    const [annas, bens, groupId] = ["1".repeat(32), "2".repeat(32), "3".repeat(32)];
    expect(await ask(anna.socket, { type: "note.create", noteId: annas, text: "Anna's", x: 0, y: 0 })).toBe("ack");
    expect(await ask(ben.socket, { type: "note.create", noteId: bens, text: "Ben's", x: 0, y: 0 })).toBe("ack");
    expect(await ask(ben.socket, { type: "group.create", groupId, title: "Kept", x: 0, y: 0, w: 600, h: 400 })).toBe(
      "ack",
    );
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId: bens, x: 9, y: 9, groupId }] })).toBe("ack");
    // a deploy closes every socket; the wall is left as stage 2 stored it
    anna.socket.ws.close(1000, "deploy");
    ben.socket.ws.close(1000, "deploy");
    await settle();
    await asStageTwo(wallId);
    expect(await metaKeys(wallId)).toEqual([
      "adminToken",
      "createdAt",
      "id",
      "question",
      "retentionAt",
      "schemaVersion",
    ]);

    const back = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(await schemaVersion(wallId)).toBe("4");
    expect(back.sync).toMatchObject({
      seq: 4,
      ...FREE,
      hidden: 0,
      clock: { rev: 0, endsAt: null, leftMs: null },
      notes: [
        { id: annas, mine: false, text: "Anna's", groupId: null },
        { id: bens, mine: true, text: "Ben's", x: 9, y: 9, groupId },
      ],
      groups: [{ id: groupId, title: "Kept" }],
    });
    // it goes on counting where it stood, and takes changes as before
    expect(await answer(back.socket, { type: "note.update", noteId: bens, text: "Ben's, later" })).toMatchObject({
      type: "ack",
      seq: 5,
    });
    expect(await ask(back.socket, { type: "group.update", groupId, title: "Still kept" })).toBe("ack");
    // revealed means revealed: it is a „Freie Wand“ at its one step, a move to it finds its work done, and no clock
    // is set on such a wall
    const admin = await join(wallId, "Anna", { sessionKey: anna.sessionKey });
    expect(await answer(admin.socket, { type: "admin.step.go", from: 0, to: 0 })).toMatchObject({
      type: "ack",
      seq: 6,
    });
    expect(await ask(admin.socket, { type: "admin.clock.start", rev: 0, minutes: 5 })).toBe("PHASE");
  });
});

describe("a wall that does not exist", () => {
  it("stores nothing when it is asked about: no table, no alarm", async () => {
    // An id the namespace made, for a wall nobody initialized: what an old link to a deleted wall reaches.
    const { wallId, stub } = newWall(env);
    expect(wallId).toMatch(WALL_ID_PATTERN);
    expect(await stub.info()).toBeNull();
    const upgrade = await SELF.fetch(`https://example.com/api/walls/${wallId}/ws`, {
      headers: { Upgrade: "websocket" },
    });
    expect(upgrade.status).toBe(404);
    expect(await tables(wallId)).toEqual([]);
    expect(await runInDurableObject(stub, (_instance, state) => state.storage.getAlarm())).toBeNull();
  });
});
