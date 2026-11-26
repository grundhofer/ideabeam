// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  ARRANGE_SLOT_MS,
  arrangeEstimate,
  bookArrange,
  budgetResetsAt,
  DAILY_NEURONS,
  DAILY_WALLS,
  reserveArrange,
  utcDay,
  WALL_DAILY_ROWS,
  WALL_DAILY_RUNS,
  wallBrake,
  type ArrangeDay,
  type ArrangeWindow,
  type DayMark,
} from "../src/index.js";

describe("the day's budget of walls", () => {
  it("is 80 walls where a deployment names no number", () => {
    expect(DAILY_WALLS).toBe(80);
  });

  it("counts days in UTC: a day begins at 00:00 and ends a millisecond before the next", () => {
    const midnight = Date.UTC(2026, 10, 22);
    expect(utcDay(midnight)).toBe(utcDay(midnight + 1));
    expect(utcDay(midnight + 24 * 60 * 60 * 1000 - 1)).toBe(utcDay(midnight));
    expect(utcDay(midnight + 24 * 60 * 60 * 1000)).toBe(utcDay(midnight) + 1);
    expect(utcDay(midnight - 1)).toBe(utcDay(midnight) - 1);
    expect(utcDay(0)).toBe(0);
  });

  it("is whole again at the next 00:00 UTC, also when asked at midnight itself", () => {
    const next = Date.UTC(2026, 10, 23);
    expect(budgetResetsAt(Date.UTC(2026, 10, 22, 12))).toBe(next);
    expect(budgetResetsAt(Date.UTC(2026, 10, 22, 23, 59, 59, 999))).toBe(next);
    expect(budgetResetsAt(Date.UTC(2026, 10, 22))).toBe(next);
    expect(budgetResetsAt(next)).toBe(Date.UTC(2026, 10, 24));
  });
});

describe("the brake of one wall", () => {
  const NOON = Date.UTC(2026, 10, 22, 12);
  const TODAY = utcDay(NOON);
  const MIDNIGHT = Date.UTC(2026, 10, 23);
  /** A wall that stood at number 40 when today's first change came. */
  const mark: DayMark = { day: TODAY, seq: 40 };

  it("is 1,500 rows a day", () => {
    expect(WALL_DAILY_ROWS).toBe(1500);
  });

  it("the first change of a day marks the day: the wall's number then is what the day's rows are counted from", () => {
    expect(wallBrake(null, 0, NOON)).toEqual({ allowed: true, mark: { day: TODAY, seq: 0 }, fresh: true });
    // a wall from another day, far on in its numbers
    expect(wallBrake({ day: TODAY - 3, seq: 12 }, 977, NOON)).toEqual({
      allowed: true,
      mark: { day: TODAY, seq: 977 },
      fresh: true,
    });
  });

  it("later changes of the day leave the mark as it is: counting writes nothing", () => {
    expect(wallBrake(mark, 41, NOON)).toEqual({ allowed: true, mark, fresh: false });
    expect(wallBrake(mark, 40 + WALL_DAILY_ROWS - 1, NOON)).toEqual({ allowed: true, mark, fresh: false });
  });

  it("refuses once the day's rows are written, and says when the day turns", () => {
    expect(wallBrake(mark, 40 + WALL_DAILY_ROWS, NOON)).toEqual({ allowed: false, resetsAt: MIDNIGHT });
    expect(wallBrake(mark, 40 + WALL_DAILY_ROWS + 7, MIDNIGHT - 1)).toEqual({ allowed: false, resetsAt: MIDNIGHT });
  });

  it("takes a lowered number: twenty changes, and the twenty-first is refused", () => {
    let seq = 40;
    let taken = 0;
    while (wallBrake(mark, seq, NOON, 20).allowed) {
      seq += 1;
      taken += 1;
    }
    expect(taken).toBe(20);
    expect(wallBrake(mark, seq, NOON, 20)).toEqual({ allowed: false, resetsAt: MIDNIGHT });
  });

  it("lifts at 00:00 UTC: the next day begins with the number the wall stands at", () => {
    const spent = 40 + WALL_DAILY_ROWS;
    expect(wallBrake(mark, spent, MIDNIGHT - 1).allowed).toBe(false);
    expect(wallBrake(mark, spent, MIDNIGHT)).toEqual({
      allowed: true,
      mark: { day: TODAY + 1, seq: spent },
      fresh: true,
    });
  });
});

describe("the budget of the AI", () => {
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  /** 12:00 UTC: a slot begins here. */
  const noon = Date.UTC(2026, 10, 22, 12);
  const LIMITS = { neurons: DAILY_NEURONS, runs: WALL_DAILY_RUNS };
  const [wall, other] = ["1f".repeat(8), "2e".repeat(8)];
  /** The number of the slot a moment falls in. */
  const slot = (at: number) => Math.floor(at / ARRANGE_SLOT_MS);
  /** A counter that holds these neurons, each amount in the slot of its moment, and no runs. */
  const spent = (...amounts: Array<[at: number, neurons: number]>): ArrangeWindow => ({
    slots: amounts.map(([at, neurons]) => [slot(at), neurons]),
    runs: {},
  });
  /** The counter after a run that was let through. */
  const granted = (state: ArrangeWindow | ArrangeDay | null, key: string, estimate: number, now: number) => {
    const grant = reserveArrange(state, key, estimate, LIMITS, now);
    if (!grant.granted) throw new Error(`refused: ${grant.why}`);
    return grant;
  };

  it("is 8,000 neurons and six runs a wall in 24 hours where a deployment names no number, counted in slots of ten minutes", () => {
    expect(DAILY_NEURONS).toBe(8000);
    expect(WALL_DAILY_RUNS).toBe(6);
    expect(ARRANGE_SLOT_MS).toBe(10 * MINUTE);
  });

  it("takes a run to cost 20 neurons and one for every note, before it has run", () => {
    expect(arrangeEstimate(30)).toBe(50);
    expect(arrangeEstimate(250)).toBe(270);
    expect(arrangeEstimate(500)).toBe(520);
  });

  it("lets a run through while the budget holds its estimate, and reserves it in the slot of the moment", () => {
    const at = noon + 7 * MINUTE;
    expect(reserveArrange(null, wall, 80, LIMITS, at)).toEqual({
      granted: true,
      state: { slots: [[slot(noon), 80]], runs: { [wall]: [at] } },
      reservation: { at, wall, neurons: 80 },
      runsLeft: 5,
    });
    // a second run in the same ten minutes adds to the slot; one ten minutes later begins the next
    const first = granted(null, wall, 80, at);
    expect(granted(first.state, other, 30.5, at + 2 * MINUTE).state).toEqual({
      slots: [[slot(noon), 110.5]],
      runs: { [wall]: [at], [other]: [at + 2 * MINUTE] },
    });
    expect(granted(first.state, other, 30, at + 10 * MINUTE).state.slots).toEqual([
      [slot(noon), 80],
      [slot(noon) + 1, 30],
    ]);
  });

  it("with a budget of zero lets no run through, however small, and says 24 hours from now", () => {
    expect(reserveArrange(null, wall, arrangeEstimate(6), { neurons: 0, runs: 6 }, noon)).toEqual({
      granted: false,
      why: "budget",
      resetsAt: noon + DAY,
    });
    // a budget smaller than the run's estimate never holds it either, also once everything has aged out
    const some = spent([noon - HOUR, 40]);
    expect(reserveArrange(some, wall, 51, { neurons: 50, runs: 6 }, noon)).toEqual({
      granted: false,
      why: "budget",
      resetsAt: noon + DAY,
    });
  });

  it("refuses the run the budget does not hold any more; the run that fills it to the last neuron is let through", () => {
    const state = spent([noon - 3 * HOUR, 7950]);
    expect(reserveArrange(state, wall, 51, LIMITS, noon)).toMatchObject({ granted: false, why: "budget" });
    expect(granted(state, wall, 50, noon).state.slots).toEqual([
      [slot(noon - 3 * HOUR), 7950],
      [slot(noon), 50],
    ]);
    // many slots of fractions add up without drifting past the edge
    const fractions = spent(
      ...Array.from({ length: 79 }, (_, n): [number, number] => [noon - ((n + 1) * HOUR) / 4, 100.1]),
    );
    expect(granted(fractions, wall, 92.1, noon).runsLeft).toBe(5);
    expect(reserveArrange(fractions, wall, 92.11, LIMITS, noon)).toMatchObject({ granted: false, why: "budget" });
  });

  it("counts over 24 hours, not over a calendar day: what was spent before midnight still counts after it", () => {
    const evening = Date.UTC(2026, 10, 22, 23, 55);
    const midnight = Date.UTC(2026, 10, 23);
    const state = spent([evening, 7990]);
    for (const now of [midnight, midnight + HOUR, midnight + 12 * HOUR, evening + DAY]) {
      expect(reserveArrange(state, wall, 30, LIMITS, now), new Date(now).toISOString()).toMatchObject({
        granted: false,
        why: "budget",
      });
    }
  });

  it("a slot counts until its end is 24 hours old: never shorter than Cloudflare counts what was spent in it", () => {
    // spent in the slot from 12:00 to 12:10, at whatever moment of it
    const state = spent([noon + 3 * MINUTE, 8000]);
    const ends = noon + 10 * MINUTE + DAY;
    expect(reserveArrange(state, wall, 30, LIMITS, noon + DAY)).toMatchObject({ granted: false });
    expect(reserveArrange(state, wall, 30, LIMITS, ends - 1)).toEqual({
      granted: false,
      why: "budget",
      resetsAt: ends,
    });
    // and from that moment on it is gone: the run is let through, and what is stored has dropped the old slot
    expect(granted(state, wall, 30, ends).state).toEqual({ slots: [[slot(ends), 30]], runs: { [wall]: [ends] } });
  });

  it("says when the run fits again: when enough of the oldest slots have aged out to hold this run's estimate", () => {
    const now = noon + 7 * HOUR;
    const state = spent([noon - 2 * HOUR, 3000], [noon + 2 * HOUR, 4000], [noon + 6 * HOUR + 20 * MINUTE, 900]);
    // 7,900 are spent. A run of 270 fits once the oldest slot is gone: 24 hours after that slot's end
    expect(reserveArrange(state, wall, 270, LIMITS, now)).toEqual({
      granted: false,
      why: "budget",
      resetsAt: noon - 2 * HOUR + 10 * MINUTE + DAY,
    });
    // a run of 4,200 has to wait for the second slot as well: 4,900 would still be too many
    expect(reserveArrange(state, wall, 4200, LIMITS, now)).toEqual({
      granted: false,
      why: "budget",
      resetsAt: noon + 2 * HOUR + 10 * MINUTE + DAY,
    });
    // and one of 7,500 for the last
    expect(reserveArrange(state, wall, 7500, LIMITS, now)).toEqual({
      granted: false,
      why: "budget",
      resetsAt: noon + 6 * HOUR + 30 * MINUTE + DAY,
    });
    // at the moment it names, the run is let through
    expect(granted(state, wall, 270, noon - 2 * HOUR + 10 * MINUTE + DAY).runsLeft).toBe(5);
  });

  it("drops what is older than 24 hours with every write, the slots and the runs, and nothing when it refuses", () => {
    const old: ArrangeWindow = {
      slots: [
        [slot(noon - 30 * HOUR), 5000],
        [slot(noon - 23 * HOUR), 200],
      ],
      runs: { [wall]: [noon - 30 * HOUR, noon - 23 * HOUR], [other]: [noon - 25 * HOUR] },
    };
    const grant = granted(old, wall, 80, noon);
    expect(grant.state).toEqual({
      slots: [
        [slot(noon - 23 * HOUR), 200],
        [slot(noon), 80],
      ],
      runs: { [wall]: [noon - 23 * HOUR, noon] },
    });
    // the booking writes too, and drops what has aged out by then
    expect(bookArrange(grant.state, grant.reservation, 61, true, noon + 2 * HOUR)).toEqual({
      slots: [[slot(noon), 61]],
      runs: { [wall]: [noon] },
    });
    // a refusal stores nothing: the grant has no state
    expect(reserveArrange(old, wall, 9000, LIMITS, noon)).not.toHaveProperty("state");
  });

  it("lets a wall arrange six times in any 24 hours and refuses the seventh; another wall is not held up by it", () => {
    let state: ArrangeWindow | null = null;
    const times = [0, 1, 5, 9, 14, 20].map((hour) => noon + hour * HOUR);
    for (const [run, at] of times.entries()) {
      const grant = granted(state, wall, 30, at);
      expect(grant.runsLeft).toBe(WALL_DAILY_RUNS - run - 1);
      state = grant.state;
    }
    expect(state?.runs).toEqual({ [wall]: times });
    // the seventh has to wait until the oldest of the six is 24 hours old, also past midnight
    const later = noon + 23 * HOUR;
    expect(reserveArrange(state, wall, 30, LIMITS, later)).toEqual({
      granted: false,
      why: "runs",
      resetsAt: noon + DAY,
    });
    expect(reserveArrange(state, wall, 30, LIMITS, noon + DAY - 1)).toMatchObject({ granted: false, why: "runs" });
    expect(reserveArrange(state, other, 30, LIMITS, later)).toMatchObject({ granted: true, runsLeft: 5 });
    // then it has one run again, and the next one waits for the run of 13:00
    const again = granted(state, wall, 30, noon + DAY);
    expect(again.runsLeft).toBe(0);
    expect(again.state.runs).toEqual({ [wall]: [...times.slice(1), noon + DAY] });
    expect(reserveArrange(again.state, wall, 30, LIMITS, noon + DAY + 1)).toEqual({
      granted: false,
      why: "runs",
      resetsAt: noon + HOUR + DAY,
    });
  });

  it("books what a run really cost in place of what was reserved for it, in the slot it was reserved in: more, or less", () => {
    const before = spent([noon - HOUR, 100]);
    const grant = granted(before, wall, 80, noon + 9 * MINUTE);
    // the run ended in the next slot: its cost still stands where its estimate stood
    const ended = noon + 11 * MINUTE;
    expect(bookArrange(grant.state, grant.reservation, 61.37, true, ended)).toEqual({
      slots: [
        [slot(noon - HOUR), 100],
        [slot(noon), 61.37],
      ],
      runs: { [wall]: [noon + 9 * MINUTE] },
    });
    expect(bookArrange(grant.state, grant.reservation, 240, true, ended).slots[1]).toEqual([slot(noon), 240]);
    // another run's neurons in the same slot stay as they are
    const second = granted(grant.state, other, 30, noon + 9 * MINUTE);
    expect(bookArrange(second.state, grant.reservation, 61, true, ended).slots[1]).toEqual([slot(noon), 91]);
    // sums of fractions stay what they are, to a hundredth: 0.1 and 0.2 are 0.3
    const fractions: ArrangeWindow = { slots: [[slot(noon), 80.1]], runs: { [wall]: [noon + 9 * MINUTE] } };
    expect(bookArrange(fractions, grant.reservation, 0.2, true, ended).slots).toEqual([[slot(noon), 0.3]]);
  });

  it("a run that gave no proposal gives the wall its run back; what it burned stays spent", () => {
    const first = granted(null, wall, 80, noon);
    expect(bookArrange(first.state, first.reservation, 12.5, false, noon + MINUTE)).toEqual({
      slots: [[slot(noon), 12.5]],
      runs: {},
    });
    // a run that burned nothing leaves nothing behind
    expect(bookArrange(first.state, first.reservation, 0, false, noon + MINUTE)).toEqual({ slots: [], runs: {} });
    // a wall that had a run already keeps that one, and only that one
    const kept = bookArrange(first.state, first.reservation, 80, true, noon + MINUTE);
    const second = granted(kept, wall, 80, noon + HOUR);
    expect(bookArrange(second.state, second.reservation, 0, false, noon + HOUR + MINUTE)).toEqual({
      slots: [[slot(noon), 80]],
      runs: { [wall]: [noon] },
    });
  });

  it("a run whose slot has aged out before it is booked is paid in the slot of the booking, in full", () => {
    const grant = granted(null, wall, 80, noon);
    const late = noon + DAY + HOUR;
    expect(bookArrange(grant.state, grant.reservation, 61, true, late)).toEqual({
      slots: [[slot(late), 61]],
      runs: {},
    });
  });

  describe("a count of the build before, per UTC day", () => {
    const today = utcDay(noon);
    const midnight = Date.UTC(2026, 10, 23);

    it("is carried over, not read as nothing spent: today's neurons count as spent now, and today's runs as run now", () => {
      const before: ArrangeDay = { day: today, neurons: 7990, runs: { [wall]: 6, [other]: 2 } };
      const now = noon + 3 * MINUTE;
      // the neurons: the budget is as spent as it was, and fits again 24 hours after the slot of now ends
      expect(reserveArrange(before, other, 30, LIMITS, now)).toEqual({
        granted: false,
        why: "budget",
        resetsAt: noon + 10 * MINUTE + DAY,
      });
      // the runs: a wall that had its six still has had them, for 24 hours from now
      expect(reserveArrange({ ...before, neurons: 100 }, wall, 30, LIMITS, now)).toEqual({
        granted: false,
        why: "runs",
        resetsAt: now + DAY,
      });
      // the first write stores the count in the shape of now
      expect(granted({ ...before, neurons: 100 }, other, 30, now).state).toEqual({
        slots: [[slot(noon), 130]],
        runs: { [wall]: Array.from({ length: 6 }, () => now), [other]: [now, now, now] },
      });
    });

    it("of yesterday counts as spent at yesterday's last moment: until the midnight that follows", () => {
      const before: ArrangeDay = { day: today, neurons: 8000, runs: { [wall]: 6 } };
      for (const now of [midnight, midnight + 12 * HOUR, midnight + DAY - 2]) {
        expect(reserveArrange(before, other, 30, LIMITS, now)).toEqual({
          granted: false,
          why: "budget",
          resetsAt: midnight + DAY,
        });
        expect(reserveArrange({ ...before, neurons: 0 }, wall, 30, LIMITS, now)).toEqual({
          granted: false,
          why: "runs",
          resetsAt: midnight - 1 + DAY,
        });
      }
      // from the midnight after, nothing of it is left
      expect(granted(before, wall, 30, midnight + DAY).state).toEqual({
        slots: [[slot(midnight + DAY), 30]],
        runs: { [wall]: [midnight + DAY] },
      });
    });

    it("that is older counts as nothing, and a booking takes it as well as a reservation does", () => {
      const before: ArrangeDay = { day: today - 2, neurons: 8000, runs: { [wall]: 6 } };
      expect(granted(before, wall, 30, noon).runsLeft).toBe(5);
      // a run that was let through by the build before, and is booked by this one: its day is carried, its cost
      // is spent now
      const running: ArrangeDay = { day: today, neurons: 80, runs: { [wall]: 1 } };
      expect(bookArrange(running, { at: noon - DAY - HOUR, wall, neurons: 80 }, 61, true, noon)).toEqual({
        slots: [[slot(noon), 141]],
        runs: { [wall]: [noon] },
      });
    });
  });
});
