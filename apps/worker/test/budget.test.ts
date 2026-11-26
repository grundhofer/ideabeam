// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// The day's budget of walls (PLAN.md 3.6): a wall that is made takes one, and when the day's are spent no new one is
// made until 00:00 UTC, while every wall that exists goes on. Every test here sets the day's count itself: the
// counter is one object for the whole file.

import { env, evictAllDurableObjects, runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { budgetResetsAt, budgetSpentSchema, DAILY_WALLS, utcDay } from "@ideabeam/shared";
import { dailyWalls, WALL_BUDGET_KEY } from "../src/rate-limiter.js";
import { limiterStub } from "../src/wall-stub.js";
import { ask, createWall, freshIp, join, postWall, resync } from "./helpers.js";

const DAY = 24 * 60 * 60 * 1000;
/** The number the tests run with (vitest.config.ts). */
const LIMIT = dailyWalls(env);

/** Sets how many of the day's walls are taken, as of `day`. */
function setUsed(used: number, day = utcDay(Date.now())): Promise<void> {
  return runInDurableObject(limiterStub(env), (_instance, state) => {
    state.storage.sql.exec(
      `INSERT INTO daily_budgets (key, utc_day, used) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET utc_day = excluded.utc_day, used = excluded.used`,
      WALL_BUDGET_KEY,
      day,
      used,
    );
  });
}

/** What the counter has stored for a key: the day and the count. */
function stored(key = WALL_BUDGET_KEY): Promise<{ day: number; used: number } | null> {
  return runInDurableObject(limiterStub(env), (_instance, state) => {
    const row = state.storage.sql.exec("SELECT utc_day, used FROM daily_budgets WHERE key = ?", key).toArray()[0];
    return row === undefined ? null : { day: Number(row.utc_day), used: Number(row.used) };
  });
}

describe("the counter of a day's budget", () => {
  it("hands out as many as the day has, refuses the next and says when the day turns", async () => {
    const limiter = limiterStub(env);
    const key = `k-${crypto.randomUUID()}`;
    const noon = Date.UTC(2026, 10, 22, 12);
    const answers = [];
    for (let i = 0; i < 4; i++) answers.push(await limiter.spendDaily(key, 3, noon + i));
    expect(answers.map((answer) => [answer.granted, answer.left])).toEqual([
      [true, 2],
      [true, 1],
      [true, 0],
      [false, 0],
    ]);
    for (const answer of answers) expect(answer.resetsAt).toBe(Date.UTC(2026, 10, 23));
    expect(await stored(key)).toEqual({ day: utcDay(noon), used: 3 });
  });

  it("writes nothing once the day is spent: asking again and again leaves the count where it was", async () => {
    const limiter = limiterStub(env);
    const key = `k-${crypto.randomUUID()}`;
    const noon = Date.UTC(2026, 10, 22, 12);
    await limiter.spendDaily(key, 1, noon);
    for (let i = 0; i < 5; i++) expect((await limiter.spendDaily(key, 1, noon)).granted).toBe(false);
    expect(await stored(key)).toEqual({ day: utcDay(noon), used: 1 });
  });

  it("starts again with the next UTC day", async () => {
    const limiter = limiterStub(env);
    const key = `k-${crypto.randomUUID()}`;
    const evening = Date.UTC(2026, 10, 22, 23, 59, 59);
    await limiter.spendDaily(key, 2, evening);
    await limiter.spendDaily(key, 2, evening);
    expect(await limiter.spendDaily(key, 2, evening)).toEqual({ granted: false, left: 0, resetsAt: evening + 1000 });
    // a second later the day has turned
    expect(await limiter.spendDaily(key, 2, evening + 1000)).toMatchObject({ granted: true, left: 1 });
    expect(await stored(key)).toEqual({ day: utcDay(evening) + 1, used: 1 });
  });

  it("counts each key by itself, in one stored row each", async () => {
    const limiter = limiterStub(env);
    const [mine, theirs] = [`a-${crypto.randomUUID()}`, `b-${crypto.randomUUID()}`];
    await limiter.spendDaily(mine, 1);
    expect((await limiter.spendDaily(mine, 1)).granted).toBe(false);
    expect((await limiter.spendDaily(theirs, 1)).granted).toBe(true);
    const rows = await runInDurableObject(limiterStub(env), (_instance, state) =>
      state.storage.sql.exec("SELECT key FROM daily_budgets WHERE key IN (?, ?)", mine, theirs).toArray(),
    );
    expect(rows).toHaveLength(2);
  });

  it("survives the counter being evicted: a quiet hour does not hand the day out again", async () => {
    const key = `k-${crypto.randomUUID()}`;
    const noon = Date.UTC(2026, 10, 22, 12);
    await limiterStub(env).spendDaily(key, 2, noon);
    await limiterStub(env).spendDaily(key, 2, noon);
    await evictAllDurableObjects();
    expect((await limiterStub(env).spendDaily(key, 2, noon)).granted).toBe(false);
  });

  it("takes the deployment's number, and the plan's where the setting is missing or no number", () => {
    const withSetting = (value: unknown) => dailyWalls({ ...env, DAILY_WALLS: value } as Env);
    expect(withSetting("80")).toBe(80);
    expect(withSetting("25")).toBe(25);
    for (const broken of [undefined, "", "viele", "0", "-5", "2.5"]) {
      expect(withSetting(broken), String(broken)).toBe(DAILY_WALLS);
    }
  });
});

describe("a wall that is made", () => {
  it("takes one of the day's walls, exactly one", async () => {
    await setUsed(10);
    await createWall();
    expect(await stored()).toEqual({ day: utcDay(Date.now()), used: 11 });
  });

  it("a request that makes no wall takes none: a body that is no question, an address that asks too often", async () => {
    await setUsed(10);
    expect((await postWall({ question: "   " })).status).toBe(400);
    const ip = freshIp();
    for (let i = 0; i < 10; i++) expect((await postWall({ question: `Question ${i}` }, ip)).status).toBe(200);
    expect((await stored())?.used).toBe(20);
    const refused = await postWall({ question: "One more" }, ip);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "RATE_LIMITED" });
    expect((await stored())?.used).toBe(20);
  });
});

describe("when the day's walls are spent", () => {
  it("no wall is made: the answer says so and when it goes on, in a code of its own", async () => {
    await setUsed(LIMIT);
    const refused = await postWall({ question: "What should we build next?" });
    expect(refused.status).toBe(429);
    const body: unknown = await refused.json();
    expect(body).toEqual({ error: "BUDGET_SPENT", resetsAt: budgetResetsAt(Date.now()) });
    expect(budgetSpentSchema.safeParse(body).success).toBe(true);
    const wait = Number(refused.headers.get("retry-after"));
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(DAY / 1000);
    expect(refused.headers.get("x-robots-tag")).toBe("noindex");
    // asking again spends nothing, and stores nothing
    expect((await stored())?.used).toBe(LIMIT);
  });

  it("the last wall of the day is made, the next one is not", async () => {
    await setUsed(LIMIT - 1);
    expect((await postWall({ question: "The last one" })).status).toBe(200);
    expect((await stored())?.used).toBe(LIMIT);
    expect((await postWall({ question: "One too many" })).status).toBe(429);
  });

  it("every wall that exists goes on: people come in, write and move notes", async () => {
    await setUsed(0);
    const { wallId, adminToken } = await createWall();
    await setUsed(LIMIT);
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    const noteId = "1".repeat(32);
    expect(await ask(ben.socket, { type: "note.create", noteId, text: "Fewer meetings", x: 0, y: 0 })).toBe("ack");
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId, x: 40, y: 40, groupId: null }] })).toBe(
      "ack",
    );
    expect((await resync(anna.socket)).notes).toMatchObject([{ id: noteId, x: 40, y: 40 }]);
    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(200);
  });

  it("the next UTC day makes walls again", async () => {
    await setUsed(LIMIT);
    expect((await postWall({ question: "Today" })).status).toBe(429);
    // the count is yesterday's now
    await setUsed(LIMIT, utcDay(Date.now()) - 1);
    expect((await postWall({ question: "Tomorrow" })).status).toBe(200);
    expect(await stored()).toEqual({ day: utcDay(Date.now()), used: 1 });
  });
});
