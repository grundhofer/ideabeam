// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DurableObject } from "cloudflare:workers";
import {
  bookArrange,
  budgetResetsAt,
  DAILY_NEURONS,
  DAILY_WALLS,
  reserveArrange,
  utcDay,
  type ArrangeDay,
  type ArrangeGrant,
  type ArrangeReservation,
  type ArrangeWindow,
} from "@ideabeam/shared";

// Why this exists rather than Cloudflare's Rate Limiting binding.
//
// That binding is documented as "permissive, eventually consistent, and
// intentionally designed to not be used as an accurate accounting system": each
// counter is cached on the machine that served the request and reconciled in
// the background, with a separate limit per Cloudflare location. On a
// high-traffic Worker that sheds load well. On a low-traffic one like this it
// does nothing measurable — RetroBeam saw 50 creation requests from one address
// in a few seconds all admitted in production, because no single machine ever
// accumulated a count. A brake that silently does nothing is worse than none,
// because it invites the belief that the endpoint is protected.
//
// A Durable Object counts exactly: one instance, single-threaded, so every
// check sees every previous one.
//
// The buckets live in MEMORY on purpose, and they are the one thing in the
// codebase for which that is correct. Rate-limit state is inherently ephemeral: the
// object is only evicted when it has been idle, which is precisely when there
// is nothing to limit, and the worst case is that one burst window is forgiven.
// Persisting it would spend the free tier's 100k-rows-per-day write budget on
// exactly the traffic we are trying not to pay for.
interface Bucket {
  tokens: number;
  at: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Whole seconds until at least one token is available. */
  retryAfter: number;
}

// The day's budget (packages/shared/src/domain/budget.ts) is the one thing here that IS stored: a count per UTC
// day, one row. It must outlive the object's eviction, or a quiet hour would hand the whole day out again. It is no
// personal data: a number and a day. From FokusBeam's `spendDaily`, which is RetroBeam's `leaseDaily` cut down to
// one unit at a time: a wall is made or it is not.
export interface DailyBudget {
  /** Whether the one unit was granted. */
  granted: boolean;
  /** How many are left after this answer. */
  left: number;
  /** When the budget is whole again: the next 00:00 UTC. */
  resetsAt: number;
}

/** The key of the day's walls in the budget table. */
export const WALL_BUDGET_KEY = "walls";

/** How many walls the product makes on one UTC day: the deployment's number (`DAILY_WALLS` in wrangler.jsonc), and
 *  the plan's where that is missing or no number, so a broken setting never means „no limit“. */
export function dailyWalls(env: Env): number {
  const set = Number(env.DAILY_WALLS);
  return Number.isInteger(set) && set > 0 ? set : DAILY_WALLS;
}

// The budget of the AI (packages/shared/src/domain/budget.ts) is stored too, for the same reason. It runs over 24
// hours, as Cloudflare's allowance does, not over a UTC day: the neurons spent or reserved in the last 24 hours, in
// slots of ten minutes, and the moments each wall was arranged at in that time, in ONE row, written once when a run
// is let through and once when it is paid for. The rules decide; this object reads the row, asks them and writes
// it. A wall stands in it under a key the Worker makes from its address (src/arrange.ts), never under the address
// itself: that is the capability of everybody on the wall, and has no place in a counter.
//
// The row is still called `day`: the build before this one counted per UTC day and stored that count under the
// name. A row it left is read as it is and carried over by the rules, so a deploy hands no budget out twice; the
// first write after it stores the count in the shape of now.

/** What the Worker hears when it asks for a run: the grant without the counter's own value. */
export type ArrangeAnswer =
  { granted: true; reservation: ArrangeReservation; runsLeft: number } | Extract<ArrangeGrant, { granted: false }>;

/** How many neurons the product spends in any 24 hours: the deployment's number (`DAILY_NEURONS` in wrangler.jsonc),
 *  and the plan's where that is missing or no number. Zero is a number: it turns arranging by the AI off. */
export function dailyNeurons(env: Pick<Env, "DAILY_NEURONS">): number {
  const text = typeof env.DAILY_NEURONS === "string" ? env.DAILY_NEURONS.trim() : "";
  const set = Number(text);
  return text !== "" && Number.isInteger(set) && set >= 0 ? set : DAILY_NEURONS;
}

export class RateLimiter extends DurableObject<Env> {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS daily_budgets (
        key TEXT PRIMARY KEY,
        utc_day INTEGER NOT NULL,
        used INTEGER NOT NULL
      ) WITHOUT ROWID
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS arrange_budget (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID
    `);
  }

  /** What the counter of the AI's budget has stored, or null: no run yet. A row of the build before this one holds
   *  the count of a UTC day. */
  private arrangeCount(): ArrangeWindow | ArrangeDay | null {
    const row = this.sql.exec("SELECT value FROM arrange_budget WHERE key = 'day'").toArray()[0];
    return row === undefined ? null : (JSON.parse(String(row.value)) as ArrangeWindow | ArrangeDay);
  }

  private writeArrangeCount(count: ArrangeWindow): void {
    this.sql.exec(
      `INSERT INTO arrange_budget (key, value) VALUES ('day', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      JSON.stringify(count),
    );
  }

  /**
   * Asks for a run of the AI: what was spent or reserved in the last 24 hours has to leave room for its estimate,
   * and the wall must have a run left in that time. A run that is let through is stored before the answer leaves,
   * so two requests that ask at once cannot both take the last of the budget: one row written. A run that is
   * refused writes nothing.
   *
   * @param wall the wall's key in the counter (src/arrange.ts), not its address
   * @param estimate what the run is taken to cost, in neurons
   * @param limits how many neurons 24 hours have, and how many runs of one wall
   * @param now the clock: tests pass it, callers do not
   */
  async reserveArrange(
    wall: string,
    estimate: number,
    limits: { neurons: number; runs: number },
    now = Date.now(),
  ): Promise<ArrangeAnswer> {
    const grant = reserveArrange(this.arrangeCount(), wall, estimate, limits, now);
    if (!grant.granted) return grant;
    this.writeArrangeCount(grant.state);
    return { granted: true, reservation: grant.reservation, runsLeft: grant.runsLeft };
  }

  /**
   * Pays for a run that was let through: what it really cost stands in place of its estimate. One row written.
   *
   * @param actual the neurons the run used
   * @param counted whether the run gave a proposal; one that gave none gives the wall its run back
   * @param now the clock: tests pass it, callers do not
   */
  async bookArrange(
    reservation: ArrangeReservation,
    actual: number,
    counted: boolean,
    now = Date.now(),
  ): Promise<void> {
    this.writeArrangeCount(bookArrange(this.arrangeCount(), reservation, actual, counted, now));
  }

  /** What is used of `key`'s budget today; a count from another day is none. */
  private usedToday(key: string, now: number): number {
    const row = this.sql.exec("SELECT utc_day, used FROM daily_budgets WHERE key = ?", key).toArray()[0];
    return row !== undefined && Number(row.utc_day) === utcDay(now) ? Number(row.used) : 0;
  }

  /**
   * Takes one unit of `key`'s budget for today, if one is left. The count is stored before the answer leaves, so
   * two requests that ask at once cannot both get the last one. Once the budget is spent, asking writes nothing: at
   * the edge, the attempts to protect the allowance must not spend it.
   *
   * @param limit how many units a UTC day has
   * @param now the clock: tests pass it, callers do not
   */
  async spendDaily(key: string, limit: number, now = Date.now()): Promise<DailyBudget> {
    const used = this.usedToday(key, now);
    const resetsAt = budgetResetsAt(now);
    if (used >= limit) return { granted: false, left: 0, resetsAt };
    this.sql.exec(
      `INSERT INTO daily_budgets (key, utc_day, used) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET utc_day = excluded.utc_day, used = excluded.used`,
      key,
      utcDay(now),
      used + 1,
    );
    return { granted: true, left: limit - used - 1, resetsAt };
  }

  /**
   * Take one token from `key`'s bucket.
   *
   * @param capacity burst size — how many are allowed back to back
   * @param refillPerSec sustained rate once the burst is spent
   * @param now the clock: tests pass it, callers do not
   */
  async take(key: string, capacity: number, refillPerSec: number, now = Date.now()): Promise<RateLimitDecision> {
    this.sweep(now, capacity, refillPerSec);

    const previous = this.buckets.get(key) ?? { tokens: capacity, at: now };
    const tokens = Math.min(capacity, previous.tokens + ((now - previous.at) / 1000) * refillPerSec);
    if (tokens < 1) {
      // Remember the refill clock even on refusal, or a caller that keeps
      // hammering would never accrue anything.
      this.buckets.set(key, { tokens, at: now });
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((1 - tokens) / refillPerSec)),
      };
    }
    this.buckets.set(key, { tokens: tokens - 1, at: now });
    return { allowed: true, retryAfter: 0 };
  }

  /** Drop buckets that have refilled completely — they are indistinguishable
   *  from a caller that has never been seen, and keeping them would let the map
   *  grow with every distinct address. */
  private sweep(now: number, capacity: number, refillPerSec: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    const fullAfterMs = (capacity / refillPerSec) * 1000;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.at > fullAfterMs) this.buckets.delete(key);
    }
  }
}
