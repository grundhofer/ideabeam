import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

/** The gate of a release (scripts/release-check.ts), run on an operator file with these lines, beside legal texts
 *  with these sources. */
function gate(lines: string, texts: Record<string, string> = {}) {
  const folder = mkdtempSync(join(tmpdir(), "release-check-"));
  const file = join(folder, "operator.ts");
  writeFileSync(file, lines);
  for (const [name, source] of Object.entries(texts)) writeFileSync(join(folder, name), source);
  return spawnSync(process.execPath, ["scripts/release-check.ts", file], { encoding: "utf8" });
}

const FILLED = `
export const OPERATOR: Operator = {
  name: "Erika Muster",
  careOf: "",
  street: "Hauptstraße 1",
  city: "54321 Ort",
  email: "erika@muster.example",
};
export const NOTICE_REVIEWED = "2026-12-01";
export const REPO_URL = "https://example.org/erika/fokusbeam";
`;

test("a release is refused while a legal fact is a placeholder, and the gate names each one", () => {
  expect(gate(FILLED).status).toBe(0);

  const refused = gate(
    FILLED.replace('"Hauptstraße 1"', '"[Straße und Hausnummer]"').replace('"2026-12-01"', '"[Datum der Durchsicht]"'),
  );
  expect(refused.status).toBe(1);
  expect(refused.stderr).toContain("2 placeholders left");
  expect(refused.stderr).toContain("street: [Straße und Hausnummer]");
  expect(refused.stderr).toContain("NOTICE_REVIEWED: [Datum der Durchsicht]");
});

test("a placeholder written into a legal text itself is refused too, in any of the texts", () => {
  const filled = `<p>Durchgesehen am <PlaceholderField value={NOTICE_REVIEWED} />.</p>`;
  expect(gate(FILLED, { "accessibility.de.tsx": filled }).status).toBe(0);

  const refused = gate(FILLED, {
    "accessibility.de.tsx": `<p>Abgerufen am <PlaceholderField value="[Datum des Abrufs]" />.</p>`,
    "accessibility.en.tsx": `<p>Retrieved on <PlaceholderField value={"[date retrieved]"} />.</p>`,
  });
  expect(refused.status).toBe(1);
  expect(refused.stderr).toContain("2 placeholders left");
  expect(refused.stderr).toContain("accessibility.de.tsx: [Datum des Abrufs]");
  expect(refused.stderr).toContain("accessibility.en.tsx: [date retrieved]");
});

test("the product's own operator file is filled for the launch: the gate passes", () => {
  // released 2026-11-26 (PLAN.md 7.2, nos. 29 to 31): the texts, the zone's settings, the public repository
  const now = spawnSync(process.execPath, ["scripts/release-check.ts"], { encoding: "utf8" });
  expect(now.stderr).toBe("");
  expect(now.status).toBe(0);
});
