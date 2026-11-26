import { expect, test } from "vitest";
import { LANGUAGES } from "./i18n";

/** Every key of a string table as a path: "list.title". */
function keys(node: unknown, at = ""): string[] {
  if (node === null || typeof node !== "object") return [at];
  return Object.entries(node).flatMap(([key, value]) => keys(value, at ? `${at}.${key}` : key));
}

test("every language has the same keys", () => {
  for (const { words } of Object.values(LANGUAGES)) expect(keys(words)).toEqual(keys(LANGUAGES.de.words));
});
