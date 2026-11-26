import { expect, test } from "vitest";
import { readSetting, writeSetting } from "./appearance";

test("a setting stands on <html> and in the storage, where theme-init.js reads it", () => {
  writeSetting("tone", "warm");
  expect(document.documentElement.getAttribute("data-sb-tone")).toBe("warm");
  expect(localStorage.getItem("sb-tone")).toBe("warm");
  expect(readSetting("tone")).toBe("warm");
  writeSetting("tone", null);
  expect(document.documentElement.hasAttribute("data-sb-tone")).toBe(false);
  expect(localStorage.getItem("sb-tone")).toBeNull();
});
