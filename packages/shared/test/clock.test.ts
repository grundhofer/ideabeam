// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// After FokusBeam's tests of its time box (stack-shift a784eed, packages/shared/test/shift.test.ts).

import { describe, expect, it } from "vitest";
import {
  clearClock,
  CLOCK_EXTEND_MINUTES,
  CLOCK_MAX_MINUTES,
  CLOCK_MIN_MINUTES,
  clockLeftMs,
  clockState,
  decideClock,
  extendClock,
  minutesLeft,
  NO_CLOCK,
  pauseClock,
  resumeClock,
  startClock,
  stoppedClock,
  type Actor,
  type Clock,
  type ClockCommand,
} from "../src/index.js";
import { OPEN, WRITING } from "./steps.js";

const MIN = 60_000;
const T0 = 1_795_300_000_000;
const OP = "0".repeat(32);

/** A control that has to fit. */
function must(clock: Clock | null): Clock {
  if (clock === null) throw new Error("the control did not fit");
  return clock;
}
/** Ten minutes, started at T0. */
const started = () => must(startClock(NO_CLOCK, 10, T0));
/** The clock in a few words at a minute after T0: what it does and the minutes the sentence says. */
const at = (clock: Clock, minute: number) =>
  `${clockState(clock, T0 + minute * MIN)}, ${minutesLeft(clock, T0 + minute * MIN)} min`;

describe("the clock of the writing", () => {
  it("is none until the moderation sets one", () => {
    expect(NO_CLOCK).toEqual({ rev: 0, endsAt: null, leftMs: null });
    expect(clockState(NO_CLOCK, T0)).toBe("none");
    expect(clockLeftMs(NO_CLOCK, T0)).toBeNull();
    expect(minutesLeft(NO_CLOCK, T0)).toBeNull();
  });

  it("stores when the time ends, and runs down without anybody doing anything", () => {
    const clock = started();
    expect(clock).toEqual({ rev: 1, endsAt: T0 + 10 * MIN, leftMs: null });
    expect(at(clock, 0)).toBe("running, 10 min");
    // whole minutes, counted up: the last minute reads 1 until it is over
    expect(at(clock, 0.01)).toBe("running, 10 min");
    expect(at(clock, 1)).toBe("running, 9 min");
    expect(at(clock, 9)).toBe("running, 1 min");
    expect(at(clock, 9.99)).toBe("running, 1 min");
    expect(at(clock, 10)).toBe("over, 0 min");
    // nothing happens when the time is up: the same clock, a day later
    expect(at(clock, 24 * 60)).toBe("over, 0 min");
    expect(clockLeftMs(clock, T0 + 24 * 60 * MIN)).toBe(0);
  });

  it(`is set to ${CLOCK_MIN_MINUTES} to ${CLOCK_MAX_MINUTES} whole minutes`, () => {
    expect(startClock(NO_CLOCK, CLOCK_MIN_MINUTES, T0)).toMatchObject({ endsAt: T0 + MIN });
    expect(startClock(NO_CLOCK, CLOCK_MAX_MINUTES, T0)).toMatchObject({ endsAt: T0 + 60 * MIN });
    for (const minutes of [0, CLOCK_MAX_MINUTES + 1, 2.5, -1, Number.NaN]) {
      expect(startClock(NO_CLOCK, minutes, T0), String(minutes)).toBeNull();
    }
  });

  it("can be set anew over a clock that runs, is paused or ran out", () => {
    const paused = must(pauseClock(started(), T0 + MIN));
    for (const clock of [started(), paused]) {
      const again = must(startClock(clock, 3, T0 + 20 * MIN));
      expect(again).toEqual({ rev: clock.rev + 1, endsAt: T0 + 23 * MIN, leftMs: null });
    }
  });
});

describe("pausing", () => {
  it("keeps what is left, however long the pause lasts", () => {
    const paused = must(pauseClock(started(), T0 + 4 * MIN));
    expect(paused).toEqual({ rev: 2, endsAt: null, leftMs: 6 * MIN });
    expect(at(paused, 4)).toBe("paused, 6 min");
    expect(at(paused, 90)).toBe("paused, 6 min");
  });

  it("ends with what was left: the time ends that much after the pause is over", () => {
    const paused = must(pauseClock(started(), T0 + 4 * MIN));
    const resumed = must(resumeClock(paused, T0 + 30 * MIN));
    expect(resumed).toEqual({ rev: 3, endsAt: T0 + 36 * MIN, leftMs: null });
    expect(at(resumed, 30)).toBe("running, 6 min");
    expect(at(resumed, 36)).toBe("over, 0 min");
  });

  it("fits a running clock only, and resuming a paused one only", () => {
    expect(pauseClock(NO_CLOCK, T0)).toBeNull();
    expect(pauseClock(must(pauseClock(started(), T0 + MIN)), T0 + 2 * MIN)).toBeNull();
    // the time is up: nothing is left to keep
    expect(pauseClock(started(), T0 + 10 * MIN)).toBeNull();
    expect(resumeClock(NO_CLOCK, T0)).toBeNull();
    expect(resumeClock(started(), T0 + MIN)).toBeNull();
  });
});

describe("five minutes more", () => {
  it("is five", () => {
    expect(CLOCK_EXTEND_MINUTES).toBe(5);
  });

  it("moves the end of a running clock", () => {
    const more = must(extendClock(started(), T0 + 4 * MIN));
    expect(more).toEqual({ rev: 2, endsAt: T0 + 15 * MIN, leftMs: null });
    expect(at(more, 4)).toBe("running, 11 min");
  });

  it("adds to what a paused clock keeps, and leaves it paused", () => {
    const more = must(extendClock(must(pauseClock(started(), T0 + 4 * MIN)), T0 + 50 * MIN));
    expect(more).toEqual({ rev: 3, endsAt: null, leftMs: 11 * MIN });
  });

  it("counts from now when the time is up", () => {
    const more = must(extendClock(started(), T0 + 25 * MIN));
    expect(more).toEqual({ rev: 2, endsAt: T0 + 30 * MIN, leftMs: null });
    expect(at(more, 25)).toBe("running, 5 min");
  });

  it(`never leaves more than ${CLOCK_MAX_MINUTES} minutes, and needs a clock`, () => {
    const long = must(startClock(NO_CLOCK, CLOCK_MAX_MINUTES, T0));
    expect(extendClock(long, T0)).toBeNull();
    expect(extendClock(long, T0 + 5 * MIN - 1)).toBeNull();
    expect(extendClock(long, T0 + 5 * MIN)).toMatchObject({ endsAt: T0 + 65 * MIN });
    expect(extendClock(NO_CLOCK, T0)).toBeNull();
  });
});

describe("clearing and revealing", () => {
  it("clearing takes the clock away, and needs one", () => {
    expect(clearClock(started())).toEqual({ rev: 2, endsAt: null, leftMs: null });
    expect(clearClock(must(pauseClock(started(), T0 + MIN)))).toEqual({ rev: 3, endsAt: null, leftMs: null });
    expect(clearClock(NO_CLOCK)).toBeNull();
    expect(clearClock(must(clearClock(started())))).toBeNull();
  });

  it("revealing stops the clock without a control: the revision stays", () => {
    expect(stoppedClock(started())).toEqual({ rev: 1, endsAt: null, leftMs: null });
    expect(stoppedClock(NO_CLOCK)).toEqual(NO_CLOCK);
  });
});

describe("a control of the clock", () => {
  const anna: Actor = { id: "a".repeat(32), role: "admin" };
  const ben: Actor = { id: "b".repeat(32), role: "member" };
  const REFUSED = (code: string) => ({ kind: "refused", code });
  const start = (rev: number): ClockCommand => ({ type: "admin.clock.start", opId: OP, rev, minutes: 10 });
  const control = (type: Exclude<ClockCommand["type"], "admin.clock.start">, rev: number): ClockCommand => ({
    type,
    opId: OP,
    rev,
  });

  it("is the moderation's", () => {
    expect(decideClock(NO_CLOCK, start(0), anna, WRITING, T0)).toEqual({ kind: "changed", clock: started() });
    expect(decideClock(NO_CLOCK, start(0), ben, WRITING, T0)).toEqual(REFUSED("NOT_ADMIN"));
    expect(decideClock(started(), control("admin.clock.pause", 1), ben, WRITING, T0)).toEqual(REFUSED("NOT_ADMIN"));
  });

  it("is the writing's: a revealed wall has no clock to control", () => {
    expect(decideClock(NO_CLOCK, start(0), anna, OPEN, T0)).toEqual(REFUSED("PHASE"));
    expect(decideClock(started(), control("admin.clock.extend", 1), anna, OPEN, T0)).toEqual(REFUSED("PHASE"));
  });

  it("names the revision it was made for, so it never acts twice", () => {
    const pause = control("admin.clock.pause", 1);
    const first = decideClock(started(), pause, anna, WRITING, T0 + MIN);
    expect(first).toEqual({ kind: "changed", clock: { rev: 2, endsAt: null, leftMs: 9 * MIN } });
    // the same frame again, after a reconnect: the clock has moved on
    const clock = first.kind === "changed" ? first.clock : NO_CLOCK;
    expect(decideClock(clock, pause, anna, WRITING, T0 + 2 * MIN)).toEqual(REFUSED("STALE"));
    // five minutes more, sent twice, are five minutes
    const more = control("admin.clock.extend", 1);
    const extended = decideClock(started(), more, anna, WRITING, T0);
    expect(extended).toMatchObject({ clock: { rev: 2, endsAt: T0 + 15 * MIN } });
    expect(decideClock(extended.kind === "changed" ? extended.clock : NO_CLOCK, more, anna, WRITING, T0)).toEqual(
      REFUSED("STALE"),
    );
    // and a control made for a revision the clock has not reached is none either
    expect(decideClock(started(), control("admin.clock.pause", 5), anna, WRITING, T0)).toEqual(REFUSED("STALE"));
  });

  it("is refused where it does not fit what the clock is doing", () => {
    expect(decideClock(NO_CLOCK, control("admin.clock.pause", 0), anna, WRITING, T0)).toEqual(REFUSED("INVALID"));
    expect(decideClock(NO_CLOCK, control("admin.clock.clear", 0), anna, WRITING, T0)).toEqual(REFUSED("INVALID"));
    expect(decideClock(started(), control("admin.clock.resume", 1), anna, WRITING, T0)).toEqual(REFUSED("INVALID"));
  });

  it("every control makes the next revision", () => {
    let clock = NO_CLOCK;
    const commands: ClockCommand[] = [
      start(0),
      control("admin.clock.pause", 1),
      control("admin.clock.resume", 2),
      control("admin.clock.extend", 3),
      control("admin.clock.clear", 4),
    ];
    for (const [index, command] of commands.entries()) {
      const decision = decideClock(clock, command, anna, WRITING, T0 + index * MIN);
      if (decision.kind !== "changed") throw new Error(`${command.type}: ${decision.code}`);
      clock = decision.clock;
      expect(clock.rev).toBe(index + 1);
    }
    expect(clock).toEqual({ rev: 5, endsAt: null, leftMs: null });
  });
});
