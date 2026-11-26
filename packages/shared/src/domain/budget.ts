// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// The day's budget of walls (PLAN.md 3.6). The free plan's allowance is the account's, shared with RetroBeam and
// FokusBeam, and it ends at a hard edge: past it everything fails until 00:00 UTC. So the product stops making
// walls before that edge: a wall that is made takes one of the day's, and when they are spent no new one is made
// until the day turns. Walls that exist go on.

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many walls the whole product makes on one UTC day where a deployment names no number of its own. */
export const DAILY_WALLS = 80;

/** The UTC day a moment falls on, counted from 1970-01-01. Cloudflare's allowances turn with it. */
export function utcDay(now: number): number {
  return Math.floor(now / DAY_MS);
}

/** When the day's budget is whole again: the next 00:00 UTC after `now`. */
export function budgetResetsAt(now: number): number {
  return (utcDay(now) + 1) * DAY_MS;
}

// The brake of one wall (the owner's decision 11, PLAN.md 7.2). A movement is stored as one row, so a wall that is
// dragged a lot writes a lot: the cost test counts some 1,200 rows for the wall PLAN.md 3.6 assumes. That stays so;
// what is bounded is the worst case: a wall writes only so many rows on one UTC day, then it refuses further
// changes until the day turns. Joining, leaving, revealing, the clock and deleting the wall are never refused.
//
// Counting costs no row per command. Every change the wall stores takes the next number (`seq`, protocol.ts) and
// writes at least one row, so the changes of a day are the wall's number now less the number the day began with.
// That number is remembered once a day (`DayMark`, one row), with the day's first change.
//
// It is a count of changes, not of rows to the last one: a delete writes two rows and counts once, revealing writes
// one and counts twice, and what is no change of the wall's content is not counted at all (somebody new on the
// wall: two rows; the mark itself; the day the wall deletes itself moving on). A bound for the worst case, which
// is what it is for. The one change that could break the bound is counted by its rows: an arrangement, which
// writes a row for every group it makes or takes away, takes that many numbers (domain/arrange.ts, `numbersOf`).

/** How many rows one wall writes on one UTC day, counted as stored changes. A long session with eight people moving
 *  notes all the time stays below it (apps/worker/test/cost.test.ts); twenty-five walls at the brake are 37,500
 *  rows, a good third of the account's 100,000 a day. */
export const WALL_DAILY_ROWS = 1500;

/** What a wall remembers about its day: which UTC day it is, and the wall's number when the day's first change
 *  came. */
export interface DayMark {
  day: number;
  seq: number;
}

export type WallBrake =
  /** The change is taken. `fresh` says that the mark is new and has to be stored: the first change of a day. */
  | { allowed: true; mark: DayMark; fresh: boolean }
  /** The day's rows are written: nothing more is taken until `resetsAt`, the next 00:00 UTC. */
  | { allowed: false; resetsAt: number };

/** Whether a wall takes one more change. `mark` is what it remembers (null: nothing yet), `seq` the number of its
 *  last stored change, `now` the worker's clock. */
export function wallBrake(mark: DayMark | null, seq: number, now: number, limit = WALL_DAILY_ROWS): WallBrake {
  const day = utcDay(now);
  if (mark === null || mark.day !== day) return { allowed: true, mark: { day, seq }, fresh: true };
  if (seq - mark.seq >= limit) return { allowed: false, resetsAt: budgetResetsAt(now) };
  return { allowed: true, mark, fresh: false };
}

// The budget of the AI (PLAN.md 4.2). Cloudflare counts what its AI works in neurons and gives an account 10,000 of
// them free, shared by every product in it; past that a call fails on the free plan and costs money on the paid
// one. That allowance is a window of 24 hours, not a calendar day: measured, the calls went through again 24 hours
// after the neurons that had filled the window were spent, and not at 00:00 UTC (docs/messung-4a.md, section 9). So
// the product counts the same way. It spends no more than a budget of its own in any 24 hours, and asks before every
// run whether what was spent or reserved in the last 24 hours leaves room for it: the count is the only brake there
// is against costs.
//
// A run is paid for in two steps. Before it, an estimate is reserved; when the budget does not hold the estimate,
// the AI is not called. After it, the estimate is replaced by what the run really cost. And one wall arranges only
// so many times in any 24 hours, so that a single wall cannot empty the budget for all the others.
//
// The whole count is one stored value, `ArrangeWindow`, written once per step: two rows written a run. The neurons
// stand in it in slots of ten minutes, so the value stays small however many runs there are: 145 slots at most. A
// slot counts until its END is 24 hours old. What was spent at a slot's start is so counted up to ten minutes longer
// than Cloudflare counts it and never shorter: the product never takes for free again what Cloudflare still counts.
// A wall's runs stand in it with the moment of each. Whatever is older than 24 hours is dropped with every write.

/** How many neurons the product spends in any 24 hours where a deployment names no number of its own. The name, and
 *  that of the deployment's variable, are from the time the budget was counted per UTC day. */
export const DAILY_NEURONS = 8000;

/** How many times one wall is arranged by the AI in any 24 hours. */
export const WALL_DAILY_RUNS = 6;

/** How long a slot is that the neurons are counted in. */
export const ARRANGE_SLOT_MS = 10 * 60 * 1000;

/** What a run is taken to cost before it has run: 20 neurons and one for every note. Measured were 9 to 16 neurons
 *  for 8 to 15 notes, 19 for 30, 126 to 179 for 250 (the higher ones with slow calls asked a second time) and 252
 *  for 500 (docs/messung-4a.md): the estimate lies above all of them. */
export function arrangeEstimate(notes: number): number {
  return 20 + notes;
}

/** What the counter has stored: the neurons spent or reserved in the last 24 hours, and when each wall was arranged
 *  in that time. A wall stands in it under a key that does not give its address away. */
export interface ArrangeWindow {
  /** The slots that hold neurons, oldest first: a slot's number (its start, counted in slots since 1970-01-01) and
   *  the neurons spent or reserved in it. */
  slots: Array<[slot: number, neurons: number]>;
  /** The moments of each wall's counted runs, oldest first. */
  runs: Record<string, number[]>;
}

/** What the build before this one stored, when the budget was counted per UTC day: the day, its neurons, and how
 *  many runs each wall had had. It is only read: a counter that still holds it is carried over (`carried`). */
export interface ArrangeDay {
  day: number;
  neurons: number;
  runs: Record<string, number>;
}

/** A run that was let through: when, for which wall, and what was reserved for it. The booking afterwards names
 *  it. */
export interface ArrangeReservation {
  at: number;
  wall: string;
  neurons: number;
}

export type ArrangeGrant =
  /** The run may start. `state` is what the counter stores now; `runsLeft` how many runs the wall has after it. */
  | { granted: true; state: ArrangeWindow; reservation: ArrangeReservation; runsLeft: number }
  /** No run: the budget does not hold it (`budget`), or the wall has had its runs (`runs`). Nothing is stored.
   *  `resetsAt` is the moment the run would fit again if nothing else is spent until then. For the budget: when
   *  enough of the oldest slots have aged out to hold the run's estimate; a budget that can never hold it (zero, or
   *  smaller than the estimate) says 24 hours from now. For the wall's runs: 24 hours after the oldest one that
   *  stands in the way. */
  | { granted: false; why: "budget" | "runs"; resetsAt: number };

/** Neurons as the counter keeps them: to a hundredth, so that sums of fractions do not drift. */
const rounded = (neurons: number) => Math.round(neurons * 100) / 100;

const slotOf = (at: number) => Math.floor(at / ARRANGE_SLOT_MS);

/** The moment a slot stops counting: 24 hours after its end. */
const slotEnds = (slot: number) => (slot + 1) * ARRANGE_SLOT_MS + DAY_MS;

/** The count of the build before this one, as the window has it. That build knew the UTC day a neuron was spent on
 *  and not the hour, so all of a day is taken to be spent at the latest moment it can have been: at that day's end,
 *  or now while the day still runs. Later than it was, never earlier: what is carried over ages out no sooner than
 *  Cloudflare lets it go. Read as nothing spent, a deploy would hand the whole budget out a second time. */
function carried(before: ArrangeDay, now: number): ArrangeWindow {
  const at = Math.min(now, (before.day + 1) * DAY_MS - 1);
  return {
    slots: [[slotOf(at), before.neurons]],
    runs: Object.fromEntries(
      Object.entries(before.runs).map(([wall, runs]) => [wall, Array.from({ length: runs }, () => at)]),
    ),
  };
}

/** The counter's value as of now: what is stored, without the slots and the runs that are older than 24 hours. */
function current(stored: ArrangeWindow | ArrangeDay | null, now: number): ArrangeWindow {
  if (stored === null) return { slots: [], runs: {} };
  const { slots, runs } = "day" in stored ? carried(stored, now) : stored;
  return {
    slots: slots.filter(([slot, neurons]) => slotEnds(slot) > now && neurons > 0),
    runs: Object.fromEntries(
      Object.entries(runs)
        .map(([wall, times]): [string, number[]] => [wall, times.filter((at) => at + DAY_MS > now)])
        .filter(([, times]) => times.length > 0),
    ),
  };
}

/** The slots with so many neurons more, or fewer, in one of them: still oldest first, and without a slot that
 *  holds nothing. */
function withNeurons(slots: ArrangeWindow["slots"], slot: number, neurons: number): ArrangeWindow["slots"] {
  const had = slots.find(([number]) => number === slot)?.[1] ?? 0;
  const has = rounded(Math.max(0, had + neurons));
  const others = slots.filter(([number]) => number !== slot);
  return (has > 0 ? [...others, [slot, has] as [number, number]] : others).sort((a, b) => a[0] - b[0]);
}

/** Whether a run may start: what was spent or reserved in the last 24 hours has to leave room for its estimate, and
 *  the wall must have a run left in that time. A budget of zero holds no run at all. */
export function reserveArrange(
  stored: ArrangeWindow | ArrangeDay | null,
  wall: string,
  estimate: number,
  limits: { neurons: number; runs: number },
  now: number,
): ArrangeGrant {
  const { slots, runs } = current(stored, now);
  const spent = slots.reduce((sum, [, neurons]) => sum + neurons, 0);
  if (rounded(spent + estimate) > limits.neurons) {
    // the slots age out oldest first: the run fits once so many of them are gone that the rest leaves room for it
    let left = spent;
    for (const [slot, neurons] of slots) {
      left -= neurons;
      if (rounded(left + estimate) <= limits.neurons)
        return { granted: false, why: "budget", resetsAt: slotEnds(slot) };
    }
    return { granted: false, why: "budget", resetsAt: now + DAY_MS };
  }
  const had = runs[wall] ?? [];
  if (had.length >= limits.runs) {
    // one run fewer than the limit has to be left: the wall waits for the run that many places from the newest
    const inTheWay = had[had.length - limits.runs];
    return { granted: false, why: "runs", resetsAt: (inTheWay ?? now) + DAY_MS };
  }
  return {
    granted: true,
    state: { slots: withNeurons(slots, slotOf(now), estimate), runs: { ...runs, [wall]: [...had, now] } },
    reservation: { at: now, wall, neurons: estimate },
    runsLeft: limits.runs - had.length - 1,
  };
}

/** The counter after a run: what the run really cost stands in place of what was reserved for it, in the slot it
 *  was reserved in. Where that slot no longer stands in the counter (it has aged out, which takes a run of 24
 *  hours), nothing is left to correct, and the real cost is spent now, in full. A run that gave no proposal
 *  (`counted` false) gives the wall its run back; the neurons it burned stay spent. */
export function bookArrange(
  stored: ArrangeWindow | ArrangeDay | null,
  reservation: ArrangeReservation,
  actual: number,
  counted: boolean,
  now: number,
): ArrangeWindow {
  const { slots, runs } = current(stored, now);
  const slot = slotOf(reservation.at);
  const reserved = slots.some(([number]) => number === slot);
  if (!counted) {
    const times = [...(runs[reservation.wall] ?? [])];
    const run = times.indexOf(reservation.at);
    if (run !== -1) times.splice(run, 1);
    if (times.length > 0) runs[reservation.wall] = times;
    else delete runs[reservation.wall];
  }
  return {
    slots: reserved ? withNeurons(slots, slot, actual - reservation.neurons) : withNeurons(slots, slotOf(now), actual),
    runs,
  };
}
