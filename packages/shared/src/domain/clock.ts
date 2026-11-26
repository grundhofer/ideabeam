// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CLOCK_MAX_MINUTES,
  CLOCK_MIN_MINUTES,
  type Clock,
  type ClockCommand,
  type Phase,
  type RejectCode,
} from "../protocol.js";
import type { Actor } from "./rules.js";

// The clock of the writing (the owner's decision 13, PLAN.md 7.2): the moderation sets a time, everybody sees how
// much is left, as a sentence in whole minutes; it can be paused, and given five minutes more.
//
// The clock is data: the moment it ends, or what is left while it is paused (protocol.ts, `clockSchema`). What is
// left at a moment is worked out from that and a clock, by the worker and by every browser with the function below.
// Nothing here reads a clock or stores anything: `now` comes from the caller, on the worker's clock (a browser
// passes its own time less the distance it measured when a frame brought `serverNow`). So nothing has to happen at
// the moment the time is up: no timer, no alarm, no row written. The moderation still reveals by hand.
//
// After FokusBeam's time box (stack-shift a784eed, packages/shared/src/domain/shift.ts): ends as data, controls
// that name the revision they were made for. A shift there is a sequence of phases; here it is one stretch of time.

export const MINUTE_MS = 60_000;

/** „5 Minuten mehr“. */
export const CLOCK_EXTEND_MINUTES = 5;

/** A wall nobody has set a clock on. */
export const NO_CLOCK: Clock = { rev: 0, endsAt: null, leftMs: null };

/** What a clock is doing at a moment. `over`: it ran out and nobody has done anything about it since. */
export type ClockState = "none" | "running" | "paused" | "over";

/** How much is left at a moment, in milliseconds: never below 0, standing still while paused; null without a
 *  clock. */
export function clockLeftMs(clock: Clock, now: number): number | null {
  if (clock.leftMs !== null) return clock.leftMs;
  if (clock.endsAt !== null) return Math.max(0, clock.endsAt - now);
  return null;
}

export function clockState(clock: Clock, now: number): ClockState {
  if (clock.leftMs !== null) return "paused";
  if (clock.endsAt === null) return "none";
  return clock.endsAt > now ? "running" : "over";
}

/** What is left as the sentence says it: whole minutes, counted up to the next one, so the last minute reads
 *  „noch 1 Minute“ until it is over, and 0 says that the time is up. null without a clock. */
export function minutesLeft(clock: Clock, now: number): number | null {
  const left = clockLeftMs(clock, now);
  return left === null ? null : Math.ceil(left / MINUTE_MS);
}

// ───────────────────────── controls ─────────────────────────
// Each returns the clock after the control, with the next revision, or null: the control does not fit what the
// clock is doing.

const controlled = (clock: Clock, change: Pick<Clock, "endsAt" | "leftMs">): Clock => ({
  rev: clock.rev + 1,
  ...change,
});

/** Sets the time and lets it run, whatever the clock was doing before. */
export function startClock(clock: Clock, minutes: number, now: number): Clock | null {
  if (!Number.isInteger(minutes) || minutes < CLOCK_MIN_MINUTES || minutes > CLOCK_MAX_MINUTES) return null;
  return controlled(clock, { endsAt: now + minutes * MINUTE_MS, leftMs: null });
}

/** Stops a running clock: what is left stays as it is. A clock that ran out has nothing left to keep. */
export function pauseClock(clock: Clock, now: number): Clock | null {
  if (clock.endsAt === null || clockState(clock, now) !== "running") return null;
  return controlled(clock, { endsAt: null, leftMs: clock.endsAt - now });
}

/** Lets a paused clock run again, with what was left. */
export function resumeClock(clock: Clock, now: number): Clock | null {
  if (clock.leftMs === null) return null;
  return controlled(clock, { endsAt: now + clock.leftMs, leftMs: null });
}

/** Five minutes more: on what is left of a running clock, on what a paused one keeps, and from now on when the time
 *  is up. Never to more than the longest time a clock can be set to. */
export function extendClock(clock: Clock, now: number): Clock | null {
  const before = clockLeftMs(clock, now);
  if (before === null) return null;
  const left = before + CLOCK_EXTEND_MINUTES * MINUTE_MS;
  if (left > CLOCK_MAX_MINUTES * MINUTE_MS) return null;
  return controlled(
    clock,
    clock.leftMs !== null ? { endsAt: null, leftMs: left } : { endsAt: now + left, leftMs: null },
  );
}

/** No clock any more. */
export function clearClock(clock: Clock): Clock | null {
  if (clock.endsAt === null && clock.leftMs === null) return null;
  return controlled(clock, { endsAt: null, leftMs: null });
}

/** The clock once the wall is revealed: the writing is over, and with it its time. No control did this, so the
 *  revision stays. The worker stores this and every browser works it out, from the same function. */
export function stoppedClock(clock: Clock): Clock {
  return { rev: clock.rev, endsAt: null, leftMs: null };
}

export type ClockDecision =
  /** Nothing is stored, the sender is told why. */
  | { kind: "refused"; code: RejectCode }
  /** What to store and to tell everyone. */
  | { kind: "changed"; clock: Clock };

/** What a control of the moderation makes of the clock. The clock is the moderation's, and the writing's: once the
 *  wall is revealed there is none (`PHASE`). A control made for another revision than the clock's is not taken
 *  (`STALE`): it arrived a second time, or somebody else's control came first. One that does not fit what the clock
 *  is doing is no command (`INVALID`). */
export function decideClock(
  clock: Clock,
  command: ClockCommand,
  by: Pick<Actor, "role">,
  phase: Phase,
  now: number,
): ClockDecision {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (phase !== "writing") return { kind: "refused", code: "PHASE" };
  if (command.rev !== clock.rev) return { kind: "refused", code: "STALE" };
  const next = control(clock, command, now);
  return next === null ? { kind: "refused", code: "INVALID" } : { kind: "changed", clock: next };
}

function control(clock: Clock, command: ClockCommand, now: number): Clock | null {
  switch (command.type) {
    case "admin.clock.start":
      return startClock(clock, command.minutes, now);
    case "admin.clock.pause":
      return pauseClock(clock, now);
    case "admin.clock.resume":
      return resumeClock(clock, now);
    case "admin.clock.extend":
      return extendClock(clock, now);
    case "admin.clock.clear":
      return clearClock(clock);
  }
}
