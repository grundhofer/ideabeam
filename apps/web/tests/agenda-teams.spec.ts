// An agenda with teams before a method of its own fields (stages M4, M6 and M7, PLAN-METHODEN.md 5) end to end, each
// person in a browser of their own, against the Worker behind the build: „1-2-4-Alle“, then „Annahmen prüfen“. Four
// browsers: Anna moderates, Ben, Cem and Dora join at the door. The pairs form and become one four; a note written in a
// team lies in the team's area and reaches nobody outside it until the presenting shows everything. Then „Annahmen
// prüfen“ starts on the same wall: its five fields below everything that lies there, hidden writing again, its rating
// over its own assumptions alone, its tests in teams of its own, an action agreed; the export has a section each. What
// is asserted is what a person sees. The frames on the server: apps/worker/test/agenda.test.ts (the fields of a later
// method), apps/worker/test/teams.test.ts.
import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Download, type Locator, type Page } from "@playwright/test";
import { frame, frameOf, know, makeWall, note, openMore, placeOf, writeNote, type Frame } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light", viewport: { width: 1440, height: 900 } });

const QUESTION = "Wie bringen wir den Ersatzteil-Lieferdienst an den Start?";
const AGENDA = { items: [{ methodId: "eins-zwei-vier" }, { methodId: "annahmen", language: "de" }] };
const FIELDS = ["Kundschaft", "Problem", "Lösung", "Geld", "Umsetzung"];

type Person = { name: string; page: Page };

/** The note each person writes alone in „1-2-4-Alle“, and the assumption each writes in „Annahmen prüfen“: no name in
 *  either, so the export can be read for names. */
const IDEA: Record<string, string> = {
  Anna: "Idee Ahorn",
  Ben: "Idee Birke",
  Cem: "Idee Zypresse",
  Dora: "Idee Douglasie",
};
const ASSUMPTION: Record<string, string> = {
  Anna: "Annahme Ahorn",
  Ben: "Annahme Birke",
  Cem: "Annahme Zypresse",
  Dora: "Annahme Douglasie",
};

/** Another person in a browser of their own, joined at the door under a name, on the surface. */
async function another(browser: Browser, address: string, name: string): Promise<Person> {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(address);
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-surface__ground").waitFor();
  return { name, page };
}

const teamLine = (page: Page) => page.locator(".app-state__team");
const position = (page: Page) => page.getByTestId("position");
const notes = (page: Page) => page.locator(".app-note[data-note]");
const ownArea = (page: Page) => page.locator(".app-area[data-own]");

/** „Weiter: <name>“, and „Aufdecken“ where it asks first. */
async function forward(page: Page, name: string, reveals = false) {
  await page.getByRole("button", { name: `Weiter: ${name}`, exact: true }).click();
  if (reveals) await page.locator("#app-dlg-reveal").getByRole("button", { name: "Aufdecken", exact: true }).click();
}

/** The names of a person's team mates, as the state line says them: „Du bist in Team 2 mit Cem und Dora. …“ */
async function mates(page: Page): Promise<string[]> {
  const line = (await teamLine(page).textContent()) ?? "";
  const found = /^Du bist in Team \d mit ([^.]+)\./.exec(line);
  if (found === null) throw new Error(`no team in „${line}“`);
  return (found[1] as string).split(/, | und /);
}

/** Whether a note lies wholly inside a box of the surface, in world units. */
async function inside(target: Locator, box: Frame) {
  const at = await placeOf(target);
  const size = await target.evaluate((el: HTMLElement) => ({
    w: Math.round(parseFloat(el.style.inlineSize || "0") * 16) || el.offsetWidth,
    h: Math.round(parseFloat(el.style.blockSize || "0") * 16) || el.offsetHeight,
  }));
  return at.x >= box.x && at.y >= box.y && at.x + size.w <= box.x + box.w && at.y + size.h <= box.y + box.h;
}

const overlap = (a: Frame, b: Frame) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The wall as Markdown, saved from „Mehr“. */
async function saved(page: Page): Promise<string> {
  // the page stands at its top: a scroll that arrives after the menu opened closes it again
  await page.evaluate(() => window.scrollTo(0, 0));
  const { row } = await openMore(page);
  const [download] = await Promise.all([page.waitForEvent("download"), row("Als Markdown sichern").click()]);
  return readFile(await (download as Download).path(), "utf8");
}

test("ACCEPTANCE: four browsers through an agenda of 1-2-4-Alle and „Annahmen prüfen“: team notes stay in the team's area until the presenting, the fields come below, the assumptions are written hidden, rated, tested in new teams and agreed; the export has both", async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  const wall = await makeWall(page, QUESTION, { agenda: AGENDA });
  await know(page, [{ id: wall.wallId, question: QUESTION, as: "Anna", adminToken: wall.adminToken }]);
  await page.goto(`/w/${wall.wallId}`);
  await page.locator(".app-surface__ground").waitFor();
  const anna: Person = { name: "Anna", page };
  const people = [anna];
  for (const name of ["Ben", "Cem", "Dora"]) people.push(await another(browser, page.url(), name));
  const byName = (name: string) => people.find((person) => person.name === name) as Person;

  // 1. „1-2-4-Alle“: alone, nobody reads anybody else
  await expect(position(page)).toHaveText(
    "Methode 1 von 2 · 1-2-4-Alle · Schritt 1 von 4: Allein nachdenken und notieren · danach Zu zweit austauschen",
  );
  for (const person of people) await writeNote(person.page, IDEA[person.name] as string);
  for (const person of people) await expect(notes(person.page)).toHaveCount(1);

  // the pairs: each reads its partner's note, inside the pair's own area, and nobody else's
  await forward(page, "Zu zweit austauschen");
  for (const person of people) await expect(teamLine(person.page)).toBeVisible();
  const partner = new Map<string, string>();
  for (const person of people) {
    const found = await mates(person.page);
    expect(found).toHaveLength(1);
    partner.set(person.name, found[0] as string);
  }
  for (const person of people) {
    const other = partner.get(person.name) as string;
    expect(partner.get(other)).toBe(person.name);
    await expect(notes(person.page)).toHaveCount(2);
    await expect(note(person.page, IDEA[other] as string)).toHaveCount(1);
    await expect(ownArea(person.page)).toHaveCount(1);
    const area = await frameOf(ownArea(person.page));
    for (const text of [IDEA[person.name] as string, IDEA[other] as string])
      expect(await inside(note(person.page, text), area), `${person.name}: „${text}“ outside the pair's area`).toBe(
        true,
      );
  }
  // a note written in the pair lies in the pair's area, and only the partner gets it
  const ben = byName("Ben");
  const benPartner = byName(partner.get("Ben") as string);
  await writeNote(ben.page, "Zu zweit: Birke");
  await expect(note(benPartner.page, "Zu zweit: Birke")).toHaveCount(1);
  for (const person of [ben, benPartner])
    expect(await inside(note(person.page, "Zu zweit: Birke"), await frameOf(ownArea(person.page)))).toBe(true);
  for (const person of people.filter((person) => person !== ben && person !== benPartner)) {
    await expect(notes(person.page)).toHaveCount(2);
    await expect(note(person.page, "Zu zweit: Birke")).toHaveCount(0);
  }

  // the fours: the pairs merge, everybody reads all five notes, all inside the one area
  await forward(page, "Zu viert: das Wichtigste herausarbeiten");
  for (const person of people) {
    await expect(teamLine(person.page)).toContainText("Du bist in Team 1 mit ");
    await expect(notes(person.page)).toHaveCount(5);
    expect(await mates(person.page)).toHaveLength(3);
    await expect(ownArea(person.page)).toHaveCount(1);
    const area = await frameOf(ownArea(person.page));
    for (const text of [...Object.values(IDEA), "Zu zweit: Birke"])
      expect(await inside(note(person.page, text), area), `${person.name}: „${text}“ outside the four's area`).toBe(
        true,
      );
  }

  // the presenting: no team any more, everything for everybody
  await forward(page, "Jede Vierergruppe stellt eine Kernidee vor");
  await page.getByRole("button", { name: "Aufdecken", exact: true }).click();
  for (const person of people) {
    await expect(position(person.page)).toHaveText(
      "Methode 1 von 2 · 1-2-4-Alle · Schritt 4 von 4: Jede Vierergruppe stellt eine Kernidee vor · danach Methode 2: Annahmen prüfen",
    );
    await expect(teamLine(person.page)).toHaveCount(0);
    await expect(notes(person.page)).toHaveCount(5);
  }

  // 2. „Annahmen prüfen“: its five fields for everybody, below every note of the first method
  await forward(page, "Methode 2: Annahmen prüfen");
  for (const person of people) {
    await expect(position(person.page)).toHaveText(
      "Methode 2 von 2 · Annahmen prüfen · Schritt 1 von 6: Annahmen je Feld sammeln · danach Aufdecken und bündeln",
    );
    for (const field of FIELDS) await expect(frame(person.page, field)).toHaveCount(1);
    await expect(notes(person.page)).toHaveCount(5);
  }
  const lowest = Math.max(
    ...(await Promise.all(
      [...Object.values(IDEA), "Zu zweit: Birke"].map(async (text) => (await placeOf(note(page, text))).y),
    )),
  );
  const fieldBoxes = await Promise.all(FIELDS.map((field) => frameOf(frame(page, field))));
  for (const box of fieldBoxes) expect(box.y).toBeGreaterThan(lowest);
  // hidden writing again: each reads their own assumption and the first method's notes, nobody else's assumption
  for (const person of people) await writeNote(person.page, ASSUMPTION[person.name] as string);
  for (const person of people) {
    await expect(notes(person.page)).toHaveCount(6);
    for (const other of people.filter((other) => other !== person))
      await expect(note(person.page, ASSUMPTION[other.name] as string)).toHaveCount(0);
  }
  await forward(page, "Aufdecken und bündeln", true);
  for (const person of people) await expect(notes(person.page)).toHaveCount(9);

  // the rating offers this method's assumptions alone, two axes each; nobody's score is shown before counting
  await forward(page, "Jede Annahme bewerten");
  for (const [n, person] of people.entries()) {
    const score = person.page.locator(".app-score");
    await score.waitFor();
    await expect(person.page.getByLabel("Schaden, wenn falsch")).toHaveCount(4);
    await expect(person.page.getByLabel("Wie wenig wir wissen")).toHaveCount(4);
    await expect(score).not.toContainText("Idee ");
    const fields = person.page.locator(".app-score select");
    await expect(fields).toHaveCount(8);
    for (let at = 0; at < 8; at++) await fields.nth(at).selectOption(String(((at + n) % 5) + 1));
    await person.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  }
  await expect(page.locator(".app-state__sentence")).toHaveText("Abgegeben. 4 von 4 haben abgegeben.");
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  for (const person of people) {
    const rows = person.page.locator(".app-score__table tbody tr");
    await expect(rows).toHaveCount(4);
    for (const text of Object.values(ASSUMPTION)) await expect(rows.filter({ hasText: text })).toHaveCount(1);
  }
  await forward(page, "Die riskantesten besprechen");

  // the tests, in teams of this method: each member's area lies beside the fields, and a test written there stays in it
  await forward(page, "Je Annahme einen Test entwerfen");
  for (const person of people) {
    await expect(teamLine(person.page)).toBeVisible();
    await expect(ownArea(person.page)).toHaveCount(1);
    const area = await frameOf(ownArea(person.page));
    for (const box of fieldBoxes) expect(overlap(area, box), `${person.name}'s area covers a field`).toBe(false);
  }
  const benMates = await mates(ben.page);
  await writeNote(ben.page, "Test: zehn Werkstätten anrufen");
  expect(await inside(note(ben.page, "Test: zehn Werkstätten anrufen"), await frameOf(ownArea(ben.page)))).toBe(true);
  for (const person of people.filter((person) => person !== ben)) {
    await expect(note(person.page, "Test: zehn Werkstätten anrufen")).toHaveCount(
      benMates.includes(person.name) ? 1 : 0,
    );
  }

  // presented and agreed by the moderation, with who and by when
  await forward(page, "Tests vorstellen und festlegen", true);
  await expect(teamLine(page)).toHaveCount(0);
  // the step shows the tests as actions, to everybody
  for (const person of people)
    await expect(
      person.page.locator("[data-action]").filter({ hasText: "Test: zehn Werkstätten anrufen" }),
    ).toHaveCount(1);
  const row = page.locator(".app-actions__row").filter({ hasText: "Test: zehn Werkstätten anrufen" });
  await row.getByLabel(/^Wer( \(optional\))?$/).fill("Vertrieb");
  await row.getByLabel(/^Bis wann( \(optional\))?$/).fill("Freitag");
  await row.getByRole("button", { name: "Festlegen", exact: true }).click();
  await expect(byName("Dora").page.locator("[data-action]")).toContainText(
    "Festgelegt · Wer: Vertrieb · Bis wann: Freitag",
  );
  await expect(position(page)).toContainText("Schritt 6 von 6: Tests vorstellen und festlegen · der letzte Schritt");

  // the export: a section each, the first method's notes and teams in the first, the assumptions, the rating and the
  // action in the second; no name
  const text = await saved(ben.page);
  const first = text.indexOf("## 1. 1-2-4-Alle");
  const second = text.indexOf("## 2. Annahmen prüfen");
  expect(first).toBeGreaterThan(-1);
  expect(second).toBeGreaterThan(first);
  const one = text.slice(first, second);
  const two = text.slice(second);
  expect(one).toContain(
    "In Teams gearbeitet: Zu zweit austauschen: 2 Teams; Zu viert: das Wichtigste herausarbeiten: 1 Team.",
  );
  for (const idea of [...Object.values(IDEA), "Zu zweit: Birke"]) expect(one).toContain(idea);
  for (const assumption of Object.values(ASSUMPTION)) {
    expect(two).toContain(assumption);
    expect(one).not.toContain(assumption);
  }
  expect(two).toContain("| Platz | Option | Schaden, wenn falsch | Wie wenig wir wissen | Gesamt | Bewertet von |");
  expect(two).toContain("- [ ] Test: zehn Werkstätten anrufen — Wer: Vertrieb, bis: Freitag");
  expect(text).not.toMatch(/\bAnna\b|\bBen\b|\bCem\b|\bDora\b/);
  for (const person of people.slice(1)) await person.page.context().close();
});
