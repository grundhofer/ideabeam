// clock.ts: how the clock of the writing reads (the owner's decision 13, PLAN.md 7.2). What is left is a sentence in
// whole minutes at the wall's top, sebaro's calm time box: no bar, no colour, no seconds, no sound. The same words,
// shorter, are the tab's title, for whoever writes in another tab. When the time is up the wall says so, and nothing
// locks: the moderation still reveals by hand.
//
// The clock is data: the moment of the worker's clock it ends at, or what is left while it is paused
// (packages/shared, domain/clock.ts). The browser counts: it reads its own clock, takes off the distance it measured
// to the worker's when a frame last carried the worker's time (`skew`, store/wall.ts), and works out the rest with
// the shared rules. So a browser whose clock is wrong shows the same minute as everybody else. Written after the
// pattern of FokusBeam's time box (stack-shift a08fce4, apps/web/src/lib/shift.ts and store/room.ts): the minutes
// in the state and in the tab's title, counted by the browser from the end and its distance to the worker's clock.
import { useEffect } from "react";
import { clockLeftMs, clockState, MINUTE_MS, minutesLeft, type Clock } from "@ideabeam/shared";

/** What the wall says about the clock, or null: there is none. Running or paused, the minutes left, counted up to
 *  the next whole one; then that the time is up. */
export type ClockLine = { is: "left" | "paused"; minutes: number } | { is: "over" } | null;

/** The clock at a moment of the worker's clock. */
export function clockLine(clock: Clock, now: number): ClockLine {
  const state = clockState(clock, now);
  if (state === "none") return null;
  if (state === "over") return { is: "over" };
  return { is: state === "paused" ? "paused" : "left", minutes: minutesLeft(clock, now) ?? 0 };
}

/** The worker's clock as a browser reckons it: its own, less the distance it measured. */
export function workerTime(browserNow: number, skew: number): number {
  return browserNow - skew;
}

/** How long until the sentence reads otherwise by itself, in milliseconds: the minute turns, or the time is up.
 *  null: nothing changes until somebody controls the clock (there is none, it is paused, the time is up). */
export function nextTurn(clock: Clock, now: number): number | null {
  if (clockState(clock, now) !== "running") return null;
  const left = clockLeftMs(clock, now) ?? 0;
  // the minutes are counted up: „noch 3 Minuten“ stands until exactly two are left
  return left % MINUTE_MS || MINUTE_MS;
}

// A timer fires a little early as often as late: looked at this much after the turn, the minute has turned.
const AFTER_TURN_MS = 50;

/** Has `look` called whenever the clock's sentence reads otherwise by itself: at every turn of a minute while the
 *  clock runs, and when the tab comes back to the front (a browser slows the timers of a tab nobody looks at). The
 *  one timer of the wall's view; it counts nothing itself: every look reads the clock anew. */
export function useClockTurns(clock: Clock, skew: number, look: () => void): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const wait = nextTurn(clock, workerTime(Date.now(), skew));
      if (wait === null) return;
      timer = setTimeout(() => {
        look();
        arm();
      }, wait + AFTER_TURN_MS);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      look();
      arm();
    };
    arm();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [clock, skew, look]);
}
