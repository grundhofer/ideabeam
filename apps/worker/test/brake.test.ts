// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// The brake of one wall (the owner's decision 11, PLAN.md 7.2): a wall writes only so many rows on one UTC day, then
// it refuses further changes until the day turns. The rule is the shared rules' (packages/shared/test/budget.test.ts,
// `wallBrake`); here the whole way is tested, with a lowered number: the real one is 1,500 (cost.test.ts plays a
// wall that stays below it).

import { runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { budgetResetsAt, generateHexId, utcDay, WALL_DAILY_ROWS, type DayMark } from "@ideabeam/shared";
import {
  answer,
  ask,
  createHiddenWall,
  createWall,
  join,
  resync,
  setDailyRows,
  settle,
  stubOf,
  type TestSocket,
} from "./helpers.js";

/** The lowered number of these tests. */
const ROWS = 12;

/** A wall that may write ROWS rows today, with its admin Anna and a member, Ben. */
async function wall(make = createWall) {
  const { wallId, adminToken } = await make();
  await setDailyRows(wallId, ROWS);
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  return { wallId, adminToken, anna, ben };
}

const create = (noteId = generateHexId()) => ({ type: "note.create", noteId, text: "A note", x: 0, y: 0 });

/** Writes notes until the wall has stored `changes` changes today. */
async function spend(socket: TestSocket, changes: number): Promise<string[]> {
  const notes: string[] = [];
  for (let n = 0; n < changes; n++) {
    const noteId = generateHexId();
    notes.push(noteId);
    expect(await ask(socket, create(noteId)), `change ${n + 1}`).toBe("ack");
  }
  return notes;
}

/** What the wall remembers about its day: the row the brake counts from. */
function dayMark(wallId: string): Promise<DayMark | null> {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    const row = state.storage.sql.exec("SELECT value FROM meta WHERE key = 'day'").toArray()[0];
    return row === undefined ? null : (JSON.parse(String(row.value)) as DayMark);
  });
}

describe("the brake of one wall", () => {
  it("is not lowered anywhere but in these tests: a wall writes 1,500 rows a day", async () => {
    const { wallId } = await createWall();
    expect(WALL_DAILY_ROWS).toBe(1500);
    expect(await runInDurableObject(stubOf(wallId), (instance) => Reflect.get(instance, "dailyRows"))).toBe(1500);
  });

  it("refuses further changes once the wall has written its day's rows, and says when the day turns", async () => {
    const { anna, ben } = await wall();
    await spend(ben.socket, ROWS);

    const before = Date.now();
    const refused = await answer(ben.socket, create());
    expect(refused).toMatchObject({ type: "reject", code: "DAY_SPENT" });
    // the moment it lifts: the next 00:00 UTC
    const resetsAt = refused.type === "reject" ? refused.resetsAt : undefined;
    expect([budgetResetsAt(before), budgetResetsAt(Date.now())]).toContain(resetsAt);
    expect((resetsAt ?? 0) % (24 * 60 * 60 * 1000)).toBe(0);
    expect(resetsAt).toBeGreaterThan(before);

    // whoever asks, whatever the change: nothing more is stored, and nobody is told anything
    const groupId = generateHexId();
    const [first] = (await resync(anna.socket)).notes;
    for (const [socket, command] of [
      [anna.socket, create()],
      [anna.socket, { type: "group.create", groupId, title: "", x: 0, y: 0, w: 600, h: 400 }],
      [anna.socket, { type: "notes.move", moves: [{ noteId: first?.id, x: 9, y: 9, groupId: null }] }],
      [ben.socket, { type: "note.update", noteId: first?.id, text: "Changed" }],
      [ben.socket, { type: "note.delete", noteId: first?.id }],
    ] as Array<[TestSocket, Record<string, unknown>]>) {
      expect(await ask(socket, command), String(command.type)).toBe("DAY_SPENT");
    }
    await settle();
    const after = await resync(anna.socket);
    expect(after).toMatchObject({ seq: ROWS, groups: [] });
    expect(after.notes).toHaveLength(ROWS);
    expect(after.notes[0]).toMatchObject({ text: "A note", x: 0, y: 0 });
  });

  it("still answers what changes nothing, and still says what is wrong with a command for its own reason", async () => {
    const { anna, ben } = await wall();
    const notes = await spend(ben.socket, ROWS);
    // the same frame again, as after a lost answer: its work is done, the wall says so
    expect(await answer(ben.socket, create(notes[0]))).toMatchObject({ type: "ack", seq: ROWS });
    expect(await ask(ben.socket, { type: "note.update", noteId: notes[0], text: "A note" })).toBe("ack");
    // not allowed is not allowed, brake or not: the answer is about the command
    expect(await ask(anna.socket, { type: "note.update", noteId: notes[0], text: "Not mine" })).toBe("NOT_AUTHOR");
    expect(await ask(ben.socket, { type: "note.update", noteId: generateHexId(), text: "Nothing there" })).toBe(
      "NOT_FOUND",
    );
  });

  it("never refuses joining, the clock, revealing, erasing one's details, leaving or deleting the wall", async () => {
    const { wallId, anna, ben } = await wall(createHiddenWall);
    await spend(ben.socket, ROWS);
    expect(await ask(ben.socket, create())).toBe("DAY_SPENT");

    // somebody comes, and gets the wall
    const cem = await join(wallId, "Cem");
    expect(cem.sync).toMatchObject({ phase: "writing", seq: ROWS, hidden: ROWS });
    // the moderation's clock
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: 1 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.resume", rev: 2 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: 3 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.clear", rev: 4 })).toBe("ack");
    // revealing: everybody gets what was written
    expect(await answer(anna.socket, { type: "admin.phase.set", phase: "open" })).toMatchObject({ type: "ack" });
    expect((await resync(cem.socket)).notes).toHaveLength(ROWS);
    // the wall is still braked for what it holds
    expect(await ask(cem.socket, create())).toBe("DAY_SPENT");
    // erasing one's details, and leaving
    expect(await ask(ben.socket, { type: "me.erase" })).toBe("ack");
    await anna.socket.waitFor((event) => event.type === "participant.removed");
    cem.socket.send({ type: "leave" });
    await anna.socket.waitFor((event) => event.type === "presence.leave");
    // deleting the wall
    expect(await ask(anna.socket, { type: "admin.wall.delete" })).toBe("ack");
    await anna.socket.waitFor((event) => event.type === "wall.deleted");
    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(404);
  });

  it("counts without a row per command: the day's mark is written with the first change and not again that day", async () => {
    const { wallId, ben } = await wall();
    expect(await dayMark(wallId)).toBeNull();
    // what changes nothing begins no day
    expect(await ask(ben.socket, { type: "note.delete", noteId: generateHexId() })).toBe("ack");
    expect(await dayMark(wallId)).toBeNull();

    await spend(ben.socket, 1);
    const mark = await dayMark(wallId);
    expect(mark).toEqual({ day: utcDay(Date.now()), seq: 0 });
    await spend(ben.socket, 5);
    expect(await dayMark(wallId)).toEqual(mark);
    // the rows of the wall's meta did not grow either: one mark, no counter
    const keys = await runInDurableObject(stubOf(wallId), (_instance, state) =>
      state.storage.sql
        .exec("SELECT key FROM meta ORDER BY key")
        .toArray()
        .map((row) => String(row.key)),
    );
    expect(keys).toEqual(["adminToken", "createdAt", "day", "flow", "id", "question", "retentionAt", "schemaVersion"]);
  });

  it("counts every stored change of the day, whoever made it and whatever it was: the clock and revealing too", async () => {
    const { anna, ben } = await wall(createHiddenWall);
    await spend(ben.socket, 4);
    // four controls of the clock and the revealing, which takes two numbers: ten of the day's twelve are gone
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: 1 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.resume", rev: 2 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: 3 })).toBe("ack");
    expect(await answer(anna.socket, { type: "admin.phase.set", phase: "open" })).toMatchObject({ seq: 10 });
    await spend(anna.socket, 2);
    expect(await ask(ben.socket, create())).toBe("DAY_SPENT");
  });

  it("lifts when the day turns: a wall braked yesterday takes changes again, and counts today from where it stands", async () => {
    const { wallId, ben } = await wall();
    await spend(ben.socket, ROWS);
    expect(await ask(ben.socket, create())).toBe("DAY_SPENT");
    const today = utcDay(Date.now());
    expect(await dayMark(wallId)).toEqual({ day: today, seq: 0 });

    // the same wall a day later: what it remembers is yesterday's
    await runInDurableObject(stubOf(wallId), (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE meta SET value = ? WHERE key = 'day'",
        JSON.stringify({ day: today - 1, seq: 0 } satisfies DayMark),
      );
    });
    expect(await answer(ben.socket, create())).toMatchObject({ type: "ack", seq: ROWS + 1 });
    expect(await dayMark(wallId)).toEqual({ day: today, seq: ROWS });
    // and today has its own rows: eleven more, then the brake again
    await spend(ben.socket, ROWS - 1);
    expect(await ask(ben.socket, create())).toBe("DAY_SPENT");
  });

  it("is each wall's own: another wall writes on", async () => {
    const braked = await wall();
    await spend(braked.ben.socket, ROWS);
    expect(await ask(braked.ben.socket, create())).toBe("DAY_SPENT");
    const other = await wall();
    expect(await ask(other.ben.socket, create())).toBe("ack");
  });
});
