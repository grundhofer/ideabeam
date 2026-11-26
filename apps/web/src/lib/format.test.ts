import { expect, test } from "vitest";
import * as fmt from "./format";

test("numbers and dates follow the language; U+00A0 stands between a number and its unit", () => {
  expect(fmt.num("de", 10000)).toBe("10.000");
  expect(fmt.num("en", 10000)).toBe("10,000");
  expect(fmt.unit("de", 90, "Min.")).toBe("90\u00a0Min.");
  expect(fmt.date("de", "2026-10-10")).toBe("10.10.2026");
  expect(fmt.date("en", "2026-10-10")).toBe("2026-10-10");
});

test("a time of day is this device's clock in 24 hours, in every language", () => {
  const one = new Date(2026, 10, 23, 1, 0).getTime();
  const evening = new Date(2026, 10, 23, 19, 5).getTime();
  expect(fmt.clock("de", one)).toBe("01:00");
  expect(fmt.clock("en", one)).toBe("01:00");
  expect(fmt.clock("de", evening)).toBe("19:05");
  expect(fmt.clock("en", evening)).toBe("19:05");
  // midnight is 00:00, never 24:00
  expect(fmt.clock("en", new Date(2026, 10, 23, 0, 0).getTime())).toBe("00:00");
});

test("a time lies on a later day when this device's calendar has turned by then, however near it is", () => {
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
  // the same day: in ten minutes, tonight, and now itself
  expect(fmt.laterDay(at(23, 14, 10), at(23, 14))).toBe(false);
  expect(fmt.laterDay(at(23, 23, 59), at(23, 0))).toBe(false);
  expect(fmt.laterDay(at(23, 14), at(23, 14))).toBe(false);
  // the next day: nearly 24 hours on, and two minutes on across midnight
  expect(fmt.laterDay(at(24, 13, 50), at(23, 14))).toBe(true);
  expect(fmt.laterDay(at(24, 0, 1), at(23, 23, 59))).toBe(true);
  expect(fmt.laterDay(at(24, 0, 0), at(23, 23, 59))).toBe(true);
  // a time that is past is no later day, whatever day it was
  expect(fmt.laterDay(at(22, 14), at(23, 14))).toBe(false);
});
