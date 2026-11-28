// The methods of stage M6 (PLAN-METHODEN.md 5, „Paket B“) end to end, each person in a browser of their own, against
// the Worker behind the build: „Kriterienbewertung“, „Nutzen und Aufwand“, „Gegenposition prüfen“,
// „Entscheidungsprotokoll mit Zustimmungsrunde“, „Annahmen prüfen“ and „Ziele mit messbaren Ergebnissen“, each through
// all its steps with two browsers, each with its export. The score and the consent round are read from the browsers'
// own WebSocket text, frame for frame: no score and no answer of anybody else reaches a browser before counting. The
// score is given with the keyboard alone. The frames on the server: apps/worker/test/methods-m6.test.ts; the rules:
// packages/shared/test/m6.test.ts.
import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Download, type Page } from "@playwright/test";
import { join, know, makeWall, note, openMore, writeNote } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light", viewport: { width: 1440, height: 900 } });

const WALL_SOCKET = /\/api\/walls\/[0-9a-f]{64}\/ws$/;

/** Every frame the wall's socket of a page received, as it came; the heartbeat left out. Before the page goes on. */
function received(page: Page) {
  const frames: string[] = [];
  page.on("websocket", (socket) => {
    if (!WALL_SOCKET.test(socket.url())) return;
    socket.on("framereceived", (frame) => {
      const text = String(frame.payload);
      if (text !== "pong") frames.push(text);
    });
  });
  return frames;
}

type Person = { name: string; page: Page; frames: string[] };

/** Anna, the moderation, on a new wall of the method, in the page the test was given. */
async function moderation(page: Page, question: string, methodId: string, language?: "de" | "en"): Promise<Person> {
  const frames = received(page);
  const wall = await makeWall(page, question, {
    agenda: { items: [{ methodId, ...(language === undefined ? {} : { language }) }] },
  });
  await know(page, [{ id: wall.wallId, question, as: "Anna", adminToken: wall.adminToken }]);
  await page.goto(`/w/${wall.wallId}`);
  await page.locator(".app-state__sentence").waitFor();
  return { name: "Anna", page, frames };
}

/** Another person in a browser of their own, joined at the door under a name. */
async function another(browser: Browser, address: string, name: string): Promise<Person> {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const frames = received(page);
  await page.goto(address);
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-state__sentence").waitFor();
  return { name, page, frames };
}

const stepLine = (page: Page) => page.locator(".app-state__step");
const sentence = (page: Page) => page.locator(".app-state__sentence");
const hint = (page: Page) => page.getByTestId("hint");

/** „Weiter: <step>“, and „Aufdecken“ where it asks first. */
async function forward(page: Page, name: string, reveals = false) {
  await page.getByRole("button", { name: `Weiter: ${name}`, exact: true }).click();
  if (reveals) await page.locator("#app-dlg-reveal").getByRole("button", { name: "Aufdecken", exact: true }).click();
  await expect(stepLine(page)).toContainText(`: ${name} ·`);
}

/** The wall as Markdown, saved from „Mehr“. */
async function saved(page: Page): Promise<string> {
  const { row } = await openMore(page);
  const [download] = await Promise.all([page.waitForEvent("download"), row("Als Markdown sichern").click()]);
  return readFile(await (download as Download).path(), "utf8");
}

/** Presses Tab until the focus stands on the element with this id; throws when it never does. */
async function tabTo(page: Page, id: string) {
  for (let presses = 0; presses < 80; presses++) {
    if ((await page.evaluate(() => document.activeElement?.id ?? "")) === id) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`the focus never reached #${id}`);
}

/** Presses Tab until the focus stands on a key with this name; throws when it never does. */
async function tabToKey(page: Page, name: string) {
  for (let presses = 0; presses < 80; presses++) {
    const now = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    if (now === name) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`the focus never reached „${name}“`);
}

/** The moderation records a decision or a result: fills its fields by label and presses the key. */
async function record(page: Page, text: string, fields: Record<string, string>, key: string) {
  const row = page.locator(".app-actions__row").filter({ hasText: text });
  for (const [label, value] of Object.entries(fields)) {
    const field = row.getByLabel(new RegExp(`^${label}( \\(optional\\))?$`));
    if ((await field.evaluate((element) => element.tagName)) === "SELECT") await field.selectOption({ label: value });
    else await field.fill(value);
  }
  await row.getByRole("button", { name: key, exact: true }).click();
}

/** Adds a note through the panel of a step that records. */
async function addRecord(page: Page, label: string, key: string, text: string) {
  await page.getByLabel(label).fill(text);
  await page.getByRole("button", { name: key, exact: true }).click();
  await expect(page.locator("[data-action]").filter({ hasText: text })).toHaveCount(1);
}

test("ACCEPTANCE: „Kriterienbewertung“ with two browsers: criteria in private, agreed, options, scored with the keyboard alone, no score in a frame before counting, the means as a table, the judgement recorded; the export", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const anna = await moderation(page, "Welchen Anbieter nehmen wir?", "kriterien");
  const ben = await another(browser, page.url(), "Ben");
  await expect(page.getByTestId("method")).toContainText("Kriterienbewertung: Ihr legt erst Kriterien fest");
  await expect(stepLine(ben.page)).toHaveText("Schritt 1 von 6: Kriterien vorschlagen · danach Kriterien festlegen");
  await expect(hint(ben.page)).toContainText("über die Optionen sprecht ihr noch nicht");
  await writeNote(page, "Geringe Kosten");
  await writeNote(ben.page, "Schneller Start");
  await forward(page, "Kriterien festlegen", true);
  await expect(note(ben.page, "Geringe Kosten")).toHaveCount(1);
  await writeNote(ben.page, "Guter Support");
  await forward(page, "Optionen vorstellen");
  await writeNote(page, "Anbieter A");
  await writeNote(ben.page, "Anbieter B");
  await expect(note(page, "Anbieter B")).toHaveCount(1);
  await forward(page, "Jede Option je Kriterium bewerten");

  // Ben scores with the keyboard alone: Tab to each field, a digit chooses
  await ben.page.locator(".app-score").waitFor();
  await expect(ben.page.locator("#app-h-score")).toHaveText("Deine Bewertung: jede Option nach 3 Kriterien");
  await expect(ben.page.locator(".app-ballot__left")).toHaveText("0 von 2 Optionen bewertet.");
  await expect(ben.page.getByLabel("Geringe Kosten")).toHaveCount(2);
  const anchor = ben.page.locator("[data-sb-web-app-head] [aria-haspopup=menu]");
  await anchor.focus();
  const digits = [
    ["1-1", "5"],
    ["1-2", "4"],
    ["1-3", "4"],
    ["2-1", "1"],
    ["2-2", "2"],
    ["2-3", "3"],
  ];
  for (const [cell, digit] of digits) {
    await tabTo(ben.page, `app-f-score-${cell}`);
    await ben.page.keyboard.press(digit as string);
    await expect(ben.page.locator(`#app-f-score-${cell}`)).toHaveValue(digit as string);
  }
  await expect(ben.page.locator(".app-ballot__left")).toHaveText("2 von 2 Optionen bewertet.");
  await tabToKey(ben.page, "Abgeben");
  await ben.page.keyboard.press("Enter");
  await expect(sentence(ben.page)).toHaveText("Abgegeben. 1 von 2 haben abgegeben.");
  await expect(sentence(page)).toHaveText("Noch nicht abgegeben. 1 von 2 haben abgegeben.");
  // no frame of the moderation's carries Ben's scores
  expect(anna.frames.join("\n")).not.toContain('"scores"');

  // Anna scores with the mouse, half an option first: that cannot be sent
  const rows = page.locator(".app-score__row");
  await rows.nth(0).getByLabel("Geringe Kosten").selectOption("3");
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(page.locator(".app-score .app-surface__problem")).toContainText(
    "Bewerte bei „Anbieter A“ alle Kriterien oder keins",
  );
  await rows.nth(0).getByLabel("Schneller Start").selectOption("2");
  await rows.nth(0).getByLabel("Guter Support").selectOption("4");
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(page)).toHaveText("Abgegeben. 2 von 2 haben abgegeben.");
  // Ben's frames carry his own ballot as stored, and nothing of Anna's
  expect(ben.frames.join("\n")).not.toContain("[3,2,4]");
  expect(ben.frames.join("\n").match(/"scores"/g)).toHaveLength(1);
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  for (const person of [anna, ben]) {
    const table = person.page.locator(".app-score__table");
    await expect(table.locator("thead th")).toHaveText([
      "Platz",
      "Option",
      "Geringe Kosten",
      "Schneller Start",
      "Guter Support",
      "Gesamt",
      "Bewertet von",
    ]);
    // Anbieter A: (5+3)/2, (4+2)/2, (4+4)/2; Anbieter B scored by Ben alone
    await expect(table.locator("tbody tr").nth(0)).toHaveText(
      ["1.", "Anbieter A", "4", "3", "4", "3,67", "2"].join(""),
    );
    await expect(table.locator("tbody tr").nth(1)).toHaveText(["2.", "Anbieter B", "1", "2", "3", "2", "1"].join(""));
  }
  await forward(page, "Unterschiede besprechen");
  await expect(ben.page.locator(".app-score__table")).toBeVisible();
  await forward(page, "Gesamturteil festhalten");
  await addRecord(ben.page, "Neue Entscheidung", "Entscheidung hinzufügen", "Wir nehmen Anbieter A");
  await expect(page.locator(".app-actions__row")).toHaveCount(1);
  await record(page, "Wir nehmen Anbieter A", { Begründung: "Bester Gesamtwert" }, "Festhalten");
  await expect(ben.page.locator("[data-action]")).toContainText(
    "Festgehalten · Entschieden von der Moderation · Begründung: Bester Gesamtwert",
  );

  const text = await saved(ben.page);
  expect(text).toContain("**Kriterienbewertung:** Ihr legt erst Kriterien fest");
  expect(text).toContain(
    "| Platz | Option | Geringe Kosten | Schneller Start | Guter Support | Gesamt | Bewertet von |",
  );
  expect(text).toContain("| 1 | Anbieter A | 4 | 3 | 4 | 3,67 | 2 |");
  expect(text).toContain(
    "## Entscheidungen\n\n- Wir nehmen Anbieter A\n  - Entschieden von: der Moderation\n  - Begründung: Bester Gesamtwert",
  );
  expect(text).toContain("## Kriterien vorschlagen\n\n- Geringe Kosten\n- Schneller Start");
  expect(text).not.toMatch(/\bAnna\b|\bBen\b/);
});

test("ACCEPTANCE: „Nutzen und Aufwand“ with two browsers: options, value and low effort scored, the table, the judgement; the export", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  await moderation(page, "Was machen wir zuerst?", "nutzen-aufwand");
  const ben = await another(browser, page.url(), "Ben");
  await expect(stepLine(ben.page)).toHaveText(
    "Schritt 1 von 4: Optionen vorstellen · danach Nutzen und Aufwand bewerten",
  );
  await writeNote(page, "Suche verbessern");
  await writeNote(ben.page, "Login vereinfachen");
  await expect(note(page, "Login vereinfachen")).toHaveCount(1);
  await forward(page, "Nutzen und Aufwand bewerten");
  for (const [person, scores] of [
    [page, ["5", "2", "3", "4"]],
    [ben.page, ["4", "2", "2", "5"]],
  ] as const) {
    await person.locator(".app-score").waitFor();
    const fields = person.locator(".app-score select");
    await expect(fields).toHaveCount(4);
    for (const [at, value] of scores.entries()) await fields.nth(at).selectOption(value);
    await person.getByRole("button", { name: "Abgeben", exact: true }).click();
  }
  await expect(sentence(page)).toHaveText("Abgegeben. 2 von 2 haben abgegeben.");
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  await expect(ben.page.locator(".app-score__table thead th")).toHaveText([
    "Platz",
    "Option",
    "Nutzen",
    "Geringer Aufwand",
    "Gesamt",
    "Bewertet von",
  ]);
  await forward(page, "Ergebnis besprechen");
  await forward(page, "Gesamturteil festhalten");
  await addRecord(page, "Neue Entscheidung", "Entscheidung hinzufügen", "Erst die Suche");
  await record(page, "Erst die Suche", { Prüftermin: "in vier Wochen" }, "Festhalten");
  await expect(ben.page.locator("[data-action]")).toContainText("Prüftermin: in vier Wochen");
  const text = await saved(ben.page);
  expect(text).toContain("| Platz | Option | Nutzen | Geringer Aufwand | Gesamt | Bewertet von |");
  expect(text).toContain("- Erst die Suche\n  - Entschieden von: der Moderation\n  - Prüftermin: in vier Wochen");
  expect(text).not.toMatch(/\bAnna\b|\bBen\b/);
});

test("ACCEPTANCE: „Gegenposition prüfen“ with two browsers and two guests: the proposal, doubts in private, two teams with their roles, presented, brought together; the export by team and role", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const anna = await moderation(page, "Ziehen wir ins neue Büro?", "gegenposition");
  const ben = await another(browser, page.url(), "Ben");
  const wallId = new URL(page.url()).pathname.split("/").at(-1) as string;
  const cem = await join(wallId, "Cem");
  const dora = await join(wallId, "Dora");
  await expect(stepLine(ben.page)).toHaveText(
    "Schritt 1 von 5: Vorschlag vorstellen · danach Eigene Bedenken notieren",
  );
  // nobody writes while the proposal is presented
  await expect(ben.page.getByRole("button", { name: "Neuer Zettel" })).toHaveCount(0);
  await forward(page, "Eigene Bedenken notieren");
  await writeNote(page, "Bedenken: der Weg ist weiter");
  await writeNote(ben.page, "Bedenken: zu wenig Räume");
  await cem.write("Bedenken: die Miete");
  await dora.write("Bedenken: der Umzug im Sommer");
  await forward(page, "Rollen: Schwächen suchen, Annahmen aufschreiben");
  // two teams of two, each told its role and what it does
  for (const person of [anna, ben]) {
    await expect(person.page.getByTestId("team")).toContainText(/^Du bist in Team [12] mit /);
    await expect(person.page.getByTestId("role")).toHaveText(
      /^Eure Rolle: (Gegenposition\. Sucht die Schwächen des Vorschlags|Annahmen\. Schreibt die Annahmen auf)/,
    );
  }
  // the moderation sees both teams' areas with their roles
  await expect(page.getByText("Team 1 · Gegenposition", { exact: false })).not.toHaveCount(0);
  await expect(page.getByText("Team 2 · Annahmen", { exact: false })).not.toHaveCount(0);
  const benTeam = Number((await ben.page.getByTestId("team").textContent())?.match(/Team (\d)/)?.[1]);
  await writeNote(ben.page, "Aus der zweiten Kleingruppe");
  await forward(page, "Gegenposition vorstellen", true);
  await expect(note(page, "Aus der zweiten Kleingruppe")).toHaveCount(1);
  await expect(note(ben.page, "Bedenken: die Miete")).toHaveCount(1);
  await forward(page, "Zusammenführen: Was hält, was ändern wir?");
  await addRecord(page, "Neue Entscheidung", "Entscheidung hinzufügen", "Wir ziehen um, erst im Herbst");
  await record(page, "Wir ziehen um, erst im Herbst", { Begründung: "Der Sommer ist zu voll" }, "Festhalten");
  await expect(ben.page.locator("[data-action]")).toContainText("Begründung: Der Sommer ist zu voll");
  const text = await saved(ben.page);
  const role = benTeam === 1 ? "Gegenposition" : "Annahmen";
  expect(text).toContain(
    `## Rollen: Schwächen suchen, Annahmen aufschreiben · Team ${benTeam}: ${role}\n\n- Aus der zweiten Kleingruppe`,
  );
  expect(text).toContain("## Eigene Bedenken notieren\n\n");
  expect(text).toContain("- Wir ziehen um, erst im Herbst\n  - Entschieden von: der Moderation");
  expect(text).not.toMatch(/\bAnna\b|\bBen\b|\bCem\b|\bDora\b/);
  await cem.leave();
  await dora.leave();
});

test("ACCEPTANCE: „Entscheidungsprotokoll mit Zustimmungsrunde“ with two browsers: the proposal, reactions in private, the consent round with no answer in a frame before counting, objections to everybody at once, the decision recorded; the export", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const anna = await moderation(page, "Welchen Anbieter nehmen wir?", "entscheidung");
  const ben = await another(browser, page.url(), "Ben");
  await expect(page.getByTestId("method")).toContainText("Entscheidungsprotokoll mit Zustimmungsrunde: Die Moderation");
  await expect(ben.page.getByRole("button", { name: "Neuer Zettel" })).toHaveCount(0);
  await forward(page, "Vorschlag vorstellen");
  await writeNote(ben.page, "Anbieter B für ein Jahr");
  await expect(note(page, "Anbieter B für ein Jahr")).toHaveCount(1);
  await forward(page, "Verständnisfragen");
  await forward(page, "Reaktionen aufschreiben");
  await writeNote(ben.page, "Reaktion: der Preis ist hoch");
  await forward(page, "Zustimmungsrunde: Sicher genug, um es auszuprobieren?");
  for (const person of [anna, ben]) {
    await expect(person.page.locator(".app-consent")).toContainText("Anbieter B für ein Jahr");
  }
  // the reactions stay hidden from Anna
  expect(anna.frames.join("\n")).not.toContain("der Preis ist hoch");

  // Ben objects, with the keyboard: the arrow keys move the choice
  await ben.page.getByRole("radio", { name: "Zustimmung", exact: true }).focus();
  await ben.page.keyboard.press("ArrowRight");
  await ben.page.keyboard.press("ArrowRight");
  await expect(ben.page.getByRole("radio", { name: "Einwand", exact: true })).toBeChecked();
  // an objection without its reason is not sent
  await ben.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(ben.page.locator(".app-consent .app-surface__problem")).toContainText(
    "Ein Einwand braucht eine Begründung",
  );
  await ben.page.getByLabel("Begründung des Einwands").fill("Ein Jahr Bindung ist zu lang");
  await ben.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(ben.page)).toHaveText("Abgegeben. 1 von 2 haben abgegeben.");
  await page.getByRole("radio", { name: "Kann damit leben", exact: true }).check();
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(page)).toHaveText("Abgegeben. 2 von 2 haben abgegeben.");
  // no frame carries the other's answer or reason before counting
  expect(anna.frames.join("\n")).not.toContain("Ein Jahr Bindung");
  expect(anna.frames.join("\n")).not.toContain('"answer":"object"');
  expect(ben.frames.join("\n")).not.toContain('"answer":"live"');
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  for (const person of [anna, ben]) {
    const result = person.page.locator(".app-results");
    await expect(result).toContainText("Ergebnis der Zustimmungsrunde");
    await expect(result.locator(".app-results__row").nth(1)).toHaveText("Kann damit leben1");
    await expect(result.locator(".app-results__row").nth(2)).toHaveText("Einwand1");
    await expect(result).toContainText("Ein Jahr Bindung ist zu lang");
  }
  await forward(page, "Einwände einarbeiten", true);
  await expect(note(page, "Reaktion: der Preis ist hoch")).toHaveCount(1);
  await forward(page, "Entscheidung festhalten, Prüftermin setzen");
  await addRecord(ben.page, "Neue Entscheidung", "Entscheidung hinzufügen", "Anbieter B für sechs Monate");
  await record(
    page,
    "Anbieter B für sechs Monate",
    { Begründung: "Kürzere Bindung", "Offene Einwände": "Preis für das zweite Halbjahr", Prüftermin: "1. Juni" },
    "Festhalten",
  );
  await expect(ben.page.locator("[data-action]")).toContainText(
    "Festgehalten · Entschieden von der Moderation · Begründung: Kürzere Bindung · Offene Einwände: Preis für das zweite Halbjahr · Prüftermin: 1. Juni",
  );
  const text = await saved(ben.page);
  expect(text).toContain("## Zustimmungsrunde\n\n_Verdeckt abgegeben, zugleich ausgezählt: 2 Antworten._");
  expect(text).toContain(
    "- Zustimmung: 0\n- Kann damit leben: 1\n- Einwand: 1\n- Einwände:\n  - Ein Jahr Bindung ist zu lang",
  );
  expect(text).toContain(
    "- Anbieter B für sechs Monate\n  - Entschieden von: der Moderation\n  - Begründung: Kürzere Bindung\n  - Offene Einwände: Preis für das zweite Halbjahr\n  - Prüftermin: 1\\. Juni",
  );
  expect(text).not.toMatch(/\bAnna\b|\bBen\b/);
});

test("ACCEPTANCE: „Annahmen prüfen“ with two browsers: five fields from the start, an assumption moved into one in private, revealed, rated on two axes, a test agreed; the export", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const anna = await moderation(page, "Ein Lieferdienst für Ersatzteile", "annahmen", "de");
  const ben = await another(browser, page.url(), "Ben");
  // the fields, as groups of the list
  await ben.page.getByRole("radio", { name: "Liste", exact: true }).check();
  for (const field of ["Kundschaft", "Problem", "Lösung", "Geld", "Umsetzung"]) {
    await expect(ben.page.getByRole("heading", { name: new RegExp(`^${field} `) })).toHaveCount(1);
  }
  await ben.page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await ben.page.getByRole("textbox", { name: "Text des Zettels" }).fill("Werkstätten bestellen online");
  await ben.page.keyboard.press("Enter");
  await expect(ben.page.locator(".app-list__row").filter({ hasText: "Werkstätten bestellen online" })).toHaveCount(1);
  await ben.page.getByRole("button", { name: /^Mehr zu „Werkstätten bestellen online“/ }).click();
  await ben.page.getByRole("menuitem", { name: "Verschieben nach …", exact: true }).click();
  await ben.page.locator("#app-dlg-move").getByRole("radio", { name: "Kundschaft", exact: true }).check();
  await ben.page.locator("#app-dlg-move").getByRole("button", { name: "Verschieben", exact: true }).click();
  await expect(
    ben.page
      .locator('section[aria-labelledby^="app-list-h-"]')
      .filter({ has: ben.page.getByRole("heading", { name: /^Kundschaft / }) }),
  ).toContainText("Werkstätten bestellen online");
  await writeNote(page, "Sie zahlen in 30 Tagen");
  expect(anna.frames.join("\n")).not.toContain("Werkstätten bestellen online");
  await forward(page, "Aufdecken und bündeln", true);
  await expect(note(page, "Werkstätten bestellen online")).toHaveCount(1);
  await ben.page.getByRole("radio", { name: "Fläche", exact: true }).check();
  await forward(page, "Jede Annahme bewerten");
  for (const person of [anna, ben]) {
    await person.page.locator(".app-score").waitFor();
    await expect(person.page.getByLabel("Schaden, wenn falsch")).toHaveCount(2);
  }
  const fields = ben.page.locator(".app-score select");
  for (const [at, value] of ["5", "4", "2", "1"].entries()) await fields.nth(at).selectOption(value);
  await ben.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(page)).toHaveText("Noch nicht abgegeben. 1 von 2 haben abgegeben.");
  expect(anna.frames.join("\n")).not.toContain('"scores"');
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  await expect(page.locator(".app-score__table tbody tr").nth(0)).toContainText("Werkstätten bestellen online");
  await forward(page, "Die riskantesten besprechen");
  await forward(page, "Je Annahme einen Test entwerfen");
  await writeNote(ben.page, "Test: zehn Werkstätten anrufen");
  await forward(page, "Tests vorstellen und festlegen", true);
  await record(page, "Test: zehn Werkstätten anrufen", { Wer: "Ben", "Bis wann": "Freitag" }, "Festlegen");
  await expect(ben.page.locator("[data-action]")).toContainText("Festgelegt · Wer: Ben · Bis wann: Freitag");
  // the page stands a little scrolled: Playwright would scroll the head into view for the click, and the scroll
  // that arrives after the menu opened closes it again (sebaro's menu closes when the page scrolls)
  await ben.page.evaluate(() => window.scrollTo(0, 0));
  const text = await saved(ben.page);
  expect(text).toContain("## Kundschaft\n\n- Werkstätten bestellen online");
  expect(text).toContain("| Platz | Option | Schaden, wenn falsch | Wie wenig wir wissen | Gesamt | Bewertet von |");
  expect(text).toContain("## Festgelegte Aktionen\n\n- [ ] Test: zehn Werkstätten anrufen — Wer: Ben, bis: Freitag");
  expect(text).not.toMatch(/\bAnna\b/);
});

test("ACCEPTANCE: „Ziele mit messbaren Ergebnissen“ with two browsers: goals in private, up to three chosen, results in small groups, recorded with goal, target, owner and review date; the export nested", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await moderation(page, "Unsere Ziele fürs erste Quartal", "ziele");
  const ben = await another(browser, page.url(), "Ben");
  await expect(stepLine(ben.page)).toHaveText(
    "Schritt 1 von 7: Zeitraum und Richtung vorstellen · danach Ziele entwerfen",
  );
  await forward(page, "Ziele entwerfen");
  await writeNote(page, "Schnellerer Support");
  await writeNote(ben.page, "Ruhigere Releases");
  await forward(page, "Aufdecken und bündeln", true);
  await forward(page, "Bis zu drei Ziele wählen");
  await ben.page.getByRole("button", { name: "Wählen: Schnellerer Support", exact: true }).click();
  await ben.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await page.getByRole("button", { name: "Wählen: Schnellerer Support", exact: true }).click();
  await page.getByRole("button", { name: "Wählen: Ruhigere Releases", exact: true }).click();
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(page)).toHaveText("Abgegeben. 2 von 2 haben abgegeben.");
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  await forward(page, "Je Ziel messbare Ergebnisse formulieren");
  await writeNote(ben.page, "Antwort innerhalb eines Tages");
  await forward(page, "Vorstellen", true);
  await forward(page, "Festlegen, mit Verantwortlichen und Prüftermin");
  await expect(page.locator(".app-actions__row")).toHaveCount(1);
  await record(
    page,
    "Antwort innerhalb eines Tages",
    { Ziel: "Schnellerer Support", Zielwert: "von 3 auf 1 Tag", Verantwortlich: "Ben", Prüftermin: "Ende März" },
    "Festlegen",
  );
  await expect(ben.page.locator("[data-action]")).toContainText(
    "Festgelegt · Ziel: Schnellerer Support · Zielwert: von 3 auf 1 Tag · Verantwortlich: Ben · Prüftermin: Ende März",
  );
  const text = await saved(ben.page);
  expect(text).toContain(
    "## Ziele und messbare Ergebnisse\n\n- Ziel: Schnellerer Support\n  - [ ] Antwort innerhalb eines Tages — Zielwert: von 3 auf 1 Tag, Verantwortlich: Ben, Prüftermin: Ende März",
  );
  expect(text).toContain("Gezählt nach Zustimmung: bis zu 2 Stimmen je Person");
  expect(text).not.toMatch(/\bAnna\b/);
});
