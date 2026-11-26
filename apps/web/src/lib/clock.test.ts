import { expect, test } from "vitest";
import { NO_CLOCK, type Clock } from "@ideabeam/shared";
import i18n from "../i18n";
import { clockLine, nextTurn, workerTime, type ClockLine } from "./clock";
import { unit } from "./format";

const MINUTE = 60_000;
// a moment of the worker's clock
const NOW = 1_795_300_000_000;
const running = (leftMs: number): Clock => ({ rev: 1, endsAt: NOW + leftMs, leftMs: null });
const paused = (leftMs: number): Clock => ({ rev: 2, endsAt: null, leftMs });

/** The clock's sentence at the wall's top, as the wall writes it. */
const sentence = (line: ClockLine, lng: "de" | "en" = "de") =>
  line === null
    ? ""
    : line.is === "over"
      ? i18n.t("wall.clock.over", { lng })
      : i18n.t(`wall.clock.${line.is}`, { count: line.minutes, lng });
/** The tab's title while a clock is set. */
const tab = (line: Exclude<ClockLine, null>, lng: "de" | "en" = "de") =>
  line.is === "left"
    ? i18n.t("wall.clock.tab.left", {
        left: unit(lng, line.minutes, i18n.t("wall.clock.min", { lng })),
        question: "Was hält uns auf?",
        lng,
      })
    : i18n.t(`wall.clock.tab.${line.is}`, { question: "Was hält uns auf?", lng });

test("without a clock the wall says nothing about time", () => {
  expect(clockLine(NO_CLOCK, NOW)).toBeNull();
  expect(sentence(clockLine(NO_CLOCK, NOW))).toBe("");
});

test("a running clock reads in whole minutes, counted up: the last minute says „noch 1 Minute“ until it is over", () => {
  expect(clockLine(running(5 * MINUTE), NOW)).toEqual({ is: "left", minutes: 5 });
  // a second later it is still five minutes, and so until exactly four are left
  expect(clockLine(running(5 * MINUTE), NOW + 1000)).toEqual({ is: "left", minutes: 5 });
  expect(clockLine(running(5 * MINUTE), NOW + MINUTE - 1)).toEqual({ is: "left", minutes: 5 });
  expect(clockLine(running(5 * MINUTE), NOW + MINUTE)).toEqual({ is: "left", minutes: 4 });
  expect(clockLine(running(5 * MINUTE), NOW + 5 * MINUTE - 1)).toEqual({ is: "left", minutes: 1 });
  expect(sentence({ is: "left", minutes: 5 })).toBe("Noch 5 Minuten zum Schreiben.");
  expect(sentence({ is: "left", minutes: 1 })).toBe("Noch 1 Minute zum Schreiben.");
  expect(sentence({ is: "left", minutes: 5 }, "en")).toBe("5 minutes left to write.");
  expect(sentence({ is: "left", minutes: 1 }, "en")).toBe("1 minute left to write.");
});

test("a paused clock stands still and says so; a clock that ran out says that the time is up", () => {
  expect(clockLine(paused(3 * MINUTE + 1), NOW)).toEqual({ is: "paused", minutes: 4 });
  expect(clockLine(paused(3 * MINUTE + 1), NOW + 10 * MINUTE)).toEqual({ is: "paused", minutes: 4 });
  expect(sentence({ is: "paused", minutes: 4 })).toBe("Die Uhr ist angehalten: noch 4 Minuten zum Schreiben.");
  expect(sentence({ is: "paused", minutes: 1 }, "en")).toBe("The clock is paused: 1 minute left to write.");

  expect(clockLine(running(5 * MINUTE), NOW + 5 * MINUTE)).toEqual({ is: "over" });
  expect(clockLine(running(5 * MINUTE), NOW + 60 * MINUTE)).toEqual({ is: "over" });
  expect(sentence({ is: "over" })).toBe("Die Zeit ist um.");
  expect(sentence({ is: "over" }, "en")).toBe("The time is up.");
});

test("the tab's title names the time first, so it stays readable in a narrow tab", () => {
  expect(tab({ is: "left", minutes: 12 })).toBe("Noch 12 Min. · Was hält uns auf?");
  expect(tab({ is: "paused", minutes: 12 })).toBe("Angehalten · Was hält uns auf?");
  expect(tab({ is: "over" })).toBe("Zeit um · Was hält uns auf?");
  expect(tab({ is: "left", minutes: 1 }, "en")).toBe("1 min left · Was hält uns auf?");
  expect(tab({ is: "over" }, "en")).toBe("Time is up · Was hält uns auf?");
});

test("a browser whose clock is wrong reckons the worker's time from the distance it measured", () => {
  // this browser's clock runs 37 minutes ahead: a frame brought the worker's time, and the distance is kept
  const browserNow = NOW + 37 * MINUTE;
  const skew = browserNow - NOW;
  expect(workerTime(browserNow, skew)).toBe(NOW);
  // 90 seconds later, by either clock
  const later = workerTime(browserNow + 90_000, skew);
  expect(clockLine(running(5 * MINUTE), later)).toEqual({ is: "left", minutes: 4 });
  // the browser's own clock, taken as it is, would say that the time ran out half an hour ago
  expect(clockLine(running(5 * MINUTE), browserNow + 90_000)).toEqual({ is: "over" });
  // a clock that runs behind by two hours reads the same minute too
  expect(clockLine(running(5 * MINUTE), workerTime(NOW - 120 * MINUTE + 90_000, -120 * MINUTE))).toEqual({
    is: "left",
    minutes: 4,
  });
});

test("the browser looks again when the minute turns, and no more once nothing changes by itself", () => {
  // five minutes exactly: the sentence stands a whole minute
  expect(nextTurn(running(5 * MINUTE), NOW)).toBe(MINUTE);
  // 4:20 left: twenty seconds until it reads four minutes
  expect(nextTurn(running(5 * MINUTE), NOW + 40_000)).toBe(20_000);
  // the last half minute ends with the time
  expect(nextTurn(running(5 * MINUTE), NOW + 5 * MINUTE - 30_000)).toBe(30_000);
  expect(nextTurn(running(5 * MINUTE), NOW + 5 * MINUTE)).toBeNull();
  expect(nextTurn(paused(3 * MINUTE), NOW)).toBeNull();
  expect(nextTurn(NO_CLOCK, NOW)).toBeNull();
});
