// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// The clock of the writing (the owner's decision 13, PLAN.md 7.2): the moderation sets a time, pauses it, gives five
// minutes more. The arithmetic is the shared rules' (packages/shared/test/clock.test.ts); here the whole way is
// tested, and that the clock is data: nothing in the object waits for the time to be up. After FokusBeam's tests of
// its time box (stack-shift 5961161, apps/worker/test/shift.test.ts), which needs an alarm for its phases; this
// clock needs none.

import { evictAllDurableObjects, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { clockState, minutesLeft, type Clock, type ServerEvent } from "@ideabeam/shared";
import { answer, ask, createHiddenWall, createWall, join, resync, settle, stubOf } from "./helpers.js";

const MIN = 60_000;

type ClockChanged = Extract<ServerEvent, { type: "clock.changed" }>;

/** A wall in hidden writing with its admin Anna and a member, Ben. */
async function wall() {
  const { wallId, adminToken } = await createHiddenWall();
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  return { wallId, anna, ben };
}

/** What the wall has stored about its time: the clock in its row, and the object's one alarm. */
function stored(wallId: string): Promise<{ clock: Clock; retentionAt: number; alarm: number | null }> {
  return runInDurableObject(stubOf(wallId), async (_instance, state) => {
    const meta = (key: string) =>
      String(state.storage.sql.exec("SELECT value FROM meta WHERE key = ?", key).one().value);
    return {
      clock: (JSON.parse(meta("flow")) as { clock: Clock }).clock,
      retentionAt: Number(meta("retentionAt")),
      alarm: await state.storage.getAlarm(),
    };
  });
}

/** Moves the stored clock: as if this many milliseconds had passed since it was set. */
function timePasses(wallId: string, ms: number): Promise<void> {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    const row = state.storage.sql.exec("SELECT value FROM meta WHERE key = 'flow'").one();
    const flow = JSON.parse(String(row.value)) as { clock: Clock };
    if (flow.clock.endsAt !== null) flow.clock.endsAt -= ms;
    state.storage.sql.exec("UPDATE meta SET value = ? WHERE key = 'flow'", JSON.stringify(flow));
  });
}

describe("the clock of the writing", () => {
  it("is none on a new wall", async () => {
    const { anna } = await wall();
    expect(anna.sync.clock).toEqual({ rev: 0, endsAt: null, leftMs: null });
  });

  it("is set by the moderation: everyone hears when the time ends, with the worker's clock to count from", async () => {
    const { anna, ben } = await wall();
    const said = await answer(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 10 });
    expect(said).toMatchObject({ type: "ack", seq: 1 });
    for (const person of [anna, ben]) {
      const heard = (await person.socket.waitFor((event) => event.type === "clock.changed")) as ClockChanged;
      expect(heard).toMatchObject({ seq: 1, clock: { rev: 1, leftMs: null } });
      // ten minutes from the worker's clock, to the millisecond
      expect(heard.clock.endsAt).toBe(heard.serverNow + 10 * MIN);
      expect(Math.abs(heard.serverNow - Date.now())).toBeLessThan(5000);
      expect(minutesLeft(heard.clock, heard.serverNow)).toBe(10);
    }
    // a snapshot carries the same clock, and its own reading of the worker's clock
    const sync = await resync(ben.socket);
    expect(sync.clock).toEqual((await stored(sync.wall.id)).clock);
    expect(clockState(sync.clock, sync.serverNow)).toBe("running");
    expect(minutesLeft(sync.clock, sync.serverNow)).toBe(10);
  });

  it("is paused, resumed, given five minutes more and cleared, each control one stored change", async () => {
    const { wallId, anna, ben } = await wall();
    const heard = async (seq: number) =>
      (await ben.socket.waitFor((event) => event.type === "clock.changed" && event.seq === seq)) as ClockChanged;

    expect(await answer(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toMatchObject({ seq: 1 });
    const started = await heard(1);

    expect(await answer(anna.socket, { type: "admin.clock.pause", rev: 1 })).toMatchObject({ type: "ack", seq: 2 });
    const paused = await heard(2);
    expect(paused.clock).toMatchObject({ rev: 2, endsAt: null });
    // what was left when it was paused, and it stands still
    expect(paused.clock.leftMs).toBe((started.clock.endsAt ?? 0) - paused.serverNow);
    expect(minutesLeft(paused.clock, paused.serverNow + 30 * MIN)).toBe(10);

    expect(await answer(anna.socket, { type: "admin.clock.extend", rev: 2 })).toMatchObject({ type: "ack", seq: 3 });
    const extended = await heard(3);
    expect(extended.clock).toEqual({ rev: 3, endsAt: null, leftMs: (paused.clock.leftMs ?? 0) + 5 * MIN });

    expect(await answer(anna.socket, { type: "admin.clock.resume", rev: 3 })).toMatchObject({ type: "ack", seq: 4 });
    const resumed = await heard(4);
    expect(resumed.clock).toEqual({ rev: 4, endsAt: resumed.serverNow + (extended.clock.leftMs ?? 0), leftMs: null });
    expect(minutesLeft(resumed.clock, resumed.serverNow)).toBe(15);

    expect(await answer(anna.socket, { type: "admin.clock.clear", rev: 4 })).toMatchObject({ type: "ack", seq: 5 });
    expect((await heard(5)).clock).toEqual({ rev: 5, endsAt: null, leftMs: null });
    expect((await stored(wallId)).clock).toEqual({ rev: 5, endsAt: null, leftMs: null });
    expect((await resync(ben.socket)).seq).toBe(5);
  });

  it("a control names the revision it was made for: sent twice it acts once", async () => {
    const { wallId, anna, ben } = await wall();
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toBe("ack");
    const before = (await stored(wallId)).clock;
    // five minutes more, and the same frame again as after a lost answer
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: 1 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: 1 })).toBe("STALE");
    const after = (await stored(wallId)).clock;
    expect(after).toEqual({ rev: 2, endsAt: (before.endsAt ?? 0) + 5 * MIN, leftMs: null });
    // a control made for a clock that has moved on meanwhile is not taken either
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: 1 })).toBe("STALE");
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 3 })).toBe("STALE");
    await settle();
    expect(ben.socket.events.filter((event) => event.type === "clock.changed")).toHaveLength(2);
    expect((await stored(wallId)).clock).toEqual(after);
  });

  it("is the moderation's, and takes only what fits: 1 to 60 minutes, a pause of a running clock", async () => {
    const { wallId, anna, ben } = await wall();
    expect(await ask(ben.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toBe("NOT_ADMIN");
    for (const minutes of [0, 61, 2.5]) {
      expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes }), String(minutes)).toBe("INVALID");
    }
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: 0 })).toBe("INVALID");
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: 0 })).toBe("INVALID");
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 60 })).toBe("ack");
    // sixty minutes are the most: five more do not fit yet
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: 1 })).toBe("INVALID");
    expect(await ask(ben.socket, { type: "admin.clock.pause", rev: 1 })).toBe("NOT_ADMIN");
    expect((await stored(wallId)).clock).toMatchObject({ rev: 1 });
    expect((await resync(ben.socket)).seq).toBe(1);
  });

  it("nothing happens when the time is up: no alarm is set for it, no row is written, the moderation still reveals", async () => {
    const { wallId, anna, ben } = await wall();
    const before = await stored(wallId);
    expect(before.alarm).toBe(before.retentionAt);
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 1 })).toBe("ack");
    // the object's one alarm is still the day the wall deletes itself
    expect((await stored(wallId)).alarm).toBe(before.retentionAt);

    // two minutes later: the time is up
    await timePasses(wallId, 2 * MIN);
    const up = await stored(wallId);
    await settle();
    const frames = ben.socket.events.length;
    // the alarm that is there is the wall's last day; woken early it says nothing and changes nothing
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);
    await settle();
    expect(ben.socket.events).toHaveLength(frames);
    expect(await stored(wallId)).toEqual(up);

    // every browser works out by itself that the time is up, from the clock it has
    const sync = await resync(ben.socket);
    expect(sync).toMatchObject({ phase: "writing", seq: 1, clock: up.clock });
    expect(clockState(sync.clock, sync.serverNow)).toBe("over");
    expect(minutesLeft(sync.clock, sync.serverNow)).toBe(0);
    // hidden stays hidden until the moderation reveals; five minutes more count from now
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: 1 })).toBe("INVALID");
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: 1 })).toBe("ack");
    const extended = (await ben.socket.waitFor(
      (event) => event.type === "clock.changed" && event.seq === 2,
    )) as ClockChanged;
    expect(extended.clock.endsAt).toBe(extended.serverNow + 5 * MIN);
    expect((await stored(wallId)).alarm).toBe(before.retentionAt);
  });

  it("ends with the writing: revealing stops it, and a revealed wall takes no control", async () => {
    const { wallId, anna, ben } = await wall();
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toBe("ack");
    expect(await answer(anna.socket, { type: "admin.phase.set", phase: "open" })).toMatchObject({
      type: "ack",
      seq: 3,
    });
    expect((await stored(wallId)).clock).toEqual({ rev: 1, endsAt: null, leftMs: null });
    expect((await resync(ben.socket)).clock).toEqual({ rev: 1, endsAt: null, leftMs: null });
    for (const command of [
      { type: "admin.clock.start", rev: 1, minutes: 10 },
      { type: "admin.clock.extend", rev: 1 },
      { type: "admin.clock.clear", rev: 1 },
    ]) {
      expect(await ask(anna.socket, command), command.type).toBe("PHASE");
    }
    // a wall made without hidden writing never had one
    const open = await createWall();
    const admin = await join(open.wallId, "Anna", { adminToken: open.adminToken });
    expect(await ask(admin.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toBe("PHASE");
  });

  it("survives everybody leaving and the object being evicted: the next snapshot has it, and the number it took", async () => {
    const { wallId, anna, ben } = await wall();
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 20 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: 1 })).toBe("ack");
    const clock = (await stored(wallId)).clock;
    anna.socket.ws.close(1000, "bye");
    ben.socket.ws.close(1000, "bye");
    await settle();
    await evictAllDurableObjects();

    // nobody is on the wall: the number is read from what is stored, and the clock's row carries it
    const back = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(back.sync).toMatchObject({ seq: 2, clock });
    expect(clock).toMatchObject({ rev: 2, endsAt: null });
  });
});
