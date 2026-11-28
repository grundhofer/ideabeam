// The methods of stage M5 (PLAN-METHODEN.md 5, „Paket A“) end to end, each person in a browser of their own, against
// the Worker behind the build: „Stille Ideenrunde mit Rangfolge“, „Scheitern vorwegdenken“, „Rückblick nach Ziel und
// Daten“ and „Was? Na und? Was nun?“, each through all its steps with two browsers, each with its export. Revealing by
// turn is read from the browsers' own WebSocket text, frame for frame: no note reaches a browser before its turn. The
// ranking is done with the keyboard alone. The frames on the server: apps/worker/test/methods-m5.test.ts; the rules:
// packages/shared/test/m5.test.ts.
import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Download, type Page } from "@playwright/test";
import { know, makeWall, note, openMore, writeNote } from "./app";

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
async function moderation(page: Page, question: string, methodId: string): Promise<Person> {
  const frames = received(page);
  const wall = await makeWall(page, question, { agenda: { items: [{ methodId }] } });
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
/** The texts of the notes on the surface, without what the app adds beside a text (one's own mark, the place). */
const noteTexts = (page: Page) =>
  page
    .locator(".app-note[data-note] .app-note__text")
    .evaluateAll((texts) => texts.map((text) => (text.firstChild?.textContent ?? "").trim()));

/** „Weiter: <step>“, and „Aufdecken“ where it asks first. */
async function forward(page: Page, name: string, reveals = false) {
  await page.getByRole("button", { name: `Weiter: ${name}`, exact: true }).click();
  if (reveals) await page.locator("#app-dlg-reveal").getByRole("button", { name: "Aufdecken", exact: true }).click();
}

/** The wall as Markdown, saved from „Mehr“. */
async function saved(page: Page): Promise<string> {
  const { row } = await openMore(page);
  const [download] = await Promise.all([page.waitForEvent("download"), row("Als Markdown sichern").click()]);
  return readFile(await (download as Download).path(), "utf8");
}

/** Presses keys until the focus stands on a key whose name `name` matches; throws when it never does. */
async function focusKey(page: Page, name: RegExp, back = false) {
  for (let presses = 0; presses < 60; presses++) {
    const now = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim() ?? "",
    );
    if (name.test(now)) return;
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
  }
  throw new Error(`the focus never reached ${name}`);
}

test("ACCEPTANCE: „Stille Ideenrunde mit Rangfolge“ with two browsers; no frame carries a note before its turn; ranking with the keyboard alone; the export", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const anna = await moderation(page, "Was soll das Team als Nächstes angehen?", "ideenrunde");
  const ben = await another(browser, page.url(), "Ben");
  await expect(page.getByTestId("method")).toContainText("Stille Ideenrunde mit Rangfolge: Alle sammeln still");
  await expect(stepLine(page)).toHaveText("Schritt 1 von 5: Still sammeln · danach Reihum aufdecken");
  await expect(hint(ben.page)).toHaveText(
    "Schreibt still und jede und jeder für sich Ideen zur Frage auf, eine je Zettel.",
  );
  const ideas: Record<string, string[]> = {
    Anna: ["Anna: Onboarding verkürzen", "Anna: Doku aufräumen"],
    Ben: ["Ben: Tests stabilisieren", "Ben: Release automatisieren"],
  };
  for (const person of [anna, ben]) for (const text of ideas[person.name] ?? []) await writeNote(person.page, text);

  // into revealing by turn: no question first, nothing is revealed by it
  await forward(page, "Reihum aufdecken");
  for (const person of [anna, ben]) {
    await expect(sentence(person.page)).toHaveText("Reihum aufgedeckt: 0 von 4 Zetteln.");
    await expect(person.page.locator(".app-note[data-note]")).toHaveCount(2);
  }
  await expect(page.locator(".sb-primary-action")).toHaveText("Nächster Zettel");
  await expect(page.locator(".sb-action-hint")).toHaveText("Noch 4 Zettel verdeckt.");
  // Ben has nothing to press and no „Neuer Zettel“
  await expect(ben.page.locator(".sb-primary-action")).toHaveCount(0);
  await expect(ben.page.getByRole("button", { name: "Neuer Zettel" })).toHaveCount(0);

  /** Frame for frame: a note of the other person reached a browser exactly when it is on its surface. */
  const nothingEarly = async () => {
    for (const [person, other] of [
      [anna, ben],
      [ben, anna],
    ] as const) {
      const shown = await noteTexts(person.page);
      const text = person.frames.join("\n");
      for (const idea of ideas[other.name] ?? []) {
        expect(text.includes(idea), `${person.name} and ${idea}`).toBe(shown.includes(idea));
      }
    }
  };
  await nothingEarly();
  const annaOnBen = async () => (await noteTexts(ben.page)).filter((text) => text.startsWith("Anna")).length;
  for (let shown = 1; shown <= 4; shown++) {
    await page.getByRole("button", { name: "Nächster Zettel", exact: true }).click();
    for (const person of [anna, ben]) {
      await expect(sentence(person.page)).toHaveText(`Reihum aufgedeckt: ${shown} von 4 Zetteln.`);
    }
    // each holds their own two and the other's shown so far: one more note in one of the two browsers
    await expect.poll(async () => (await noteTexts(page)).length + (await noteTexts(ben.page)).length).toBe(4 + shown);
    await nothingEarly();
    // interleaved by writer: after two turns, one of each
    if (shown === 2) expect(await annaOnBen()).toBe(1);
  }
  // every note shown: „Weiter“, without asking
  await expect(page.locator(".sb-action-hint")).toHaveText("Alle Zettel sind aufgedeckt.");
  await forward(page, "Klären, ohne zu bewerten");
  await expect(stepLine(ben.page)).toHaveText(
    "Schritt 3 von 5: Klären, ohne zu bewerten · danach Die wichtigsten ranken",
  );
  await forward(page, "Die wichtigsten ranken");

  // Ben ranks with the keyboard alone: chooses two, moves the second up, casts
  await ben.page.locator(".app-rank").waitFor();
  await expect(ben.page.locator("#app-h-rank")).toHaveText("Deine Rangfolge: die ersten 4");
  await ben.page.locator("[data-sb-web-app-head] [aria-haspopup=menu]").focus();
  await focusKey(ben.page, /^Wählen: Anna: Doku aufräumen$/);
  await ben.page.keyboard.press("Enter");
  await focusKey(ben.page, /^Wählen: Ben: Tests stabilisieren$/);
  await ben.page.keyboard.press("Enter");
  await expect(ben.page.locator(".app-ballot__left")).toHaveText("Noch 2 Plätze frei");
  await focusKey(ben.page, /^Nach oben: Ben: Tests stabilisieren, Platz 2$/, true);
  await ben.page.keyboard.press("Enter");
  // the focus went with the row
  await expect(ben.page.locator(":focus")).toHaveAttribute(
    "aria-label",
    "Nach oben: Ben: Tests stabilisieren, Platz 1",
  );
  await expect(ben.page.locator('ol[aria-labelledby="app-h-rank-chosen"] .sb-list-row__title')).toHaveText([
    "Ben: Tests stabilisieren",
    "Anna: Doku aufräumen",
  ]);
  await focusKey(ben.page, /^Abgeben$/);
  await ben.page.keyboard.press("Enter");
  await expect(sentence(ben.page)).toHaveText("Abgegeben. 1 von 2 haben abgegeben.");
  // no frame of Anna's carries Ben's ranking
  expect(anna.frames.join("\n")).not.toContain('"order"');

  // Anna ranks one idea and counts
  await page.getByRole("button", { name: "Wählen: Anna: Onboarding verkürzen", exact: true }).click();
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(page)).toHaveText("Abgegeben. 2 von 2 haben abgegeben.");
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  for (const person of [anna, ben]) {
    await expect(person.page.locator(".app-results__row")).toHaveCount(4);
    await expect(person.page.locator(".app-results")).toContainText("Gezählt nach Borda");
  }
  // Borda over four places: Ben's first 4, his second 3, Anna's one 4
  await expect(page.locator(".app-results__row").nth(2)).toContainText("Anna: Doku aufräumen");
  await forward(page, "Ergebnis ansehen");
  await expect(stepLine(ben.page)).toHaveText("Schritt 5 von 5: Ergebnis ansehen · der letzte Schritt");

  const text = await saved(ben.page);
  expect(text).toContain("**Stille Ideenrunde mit Rangfolge:** Alle sammeln still");
  expect(text).toContain("## Ergebnis der Wahl");
  expect(text).toContain("Gezählt nach Borda: Jede Person ordnet ihre ersten 4");
  expect(text).toContain("Verdeckt abgegeben, zugleich ausgezählt: 2 Stimmzettel.");
  for (const idea of [...(ideas.Anna ?? []), ...(ideas.Ben ?? [])]) expect(text).toContain(`- ${idea}`);
  expect(text).not.toMatch(/Anna(?!:)|Ben(?!:)/);
});

test("ACCEPTANCE: „Scheitern vorwegdenken“ with two browsers: the plan with no writing, reasons in private, one turn, the rest on, the plan adjusted with who and by when; the export", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const anna = await moderation(page, "Plan: Umzug in die neue Cloud bis März", "scheitern");
  const ben = await another(browser, page.url(), "Ben");
  await expect(stepLine(page)).toHaveText("Schritt 1 von 5: Plan vorstellen · danach Gründe aufschreiben");
  // the plan is presented: nobody writes, and Ben has nothing to press
  await expect(ben.page.getByRole("button", { name: "Neuer Zettel" })).toHaveCount(0);
  await expect(ben.page.locator(".sb-primary-action")).toHaveCount(0);
  await expect(ben.page.locator(".app-state__note").first()).toHaveText(
    "Hör zu, was vorgestellt wird. Geschrieben wird im nächsten Schritt.",
  );
  await forward(page, "Gründe aufschreiben");
  await expect(hint(ben.page)).toHaveText(
    "Stellt euch vor: Ein Jahr später ist der Plan gescheitert. Schreibt jede und jeder für sich auf, warum.",
  );
  await writeNote(page, "Niemand kennt die alten Skripte");
  await writeNote(ben.page, "Die Kosten steigen im ersten Monat");
  await writeNote(ben.page, "Das Team ist im März im Urlaub");
  await forward(page, "Reihum aufdecken");
  await page.getByRole("button", { name: "Nächster Zettel", exact: true }).click();
  await expect(sentence(ben.page)).toHaveText("Reihum aufgedeckt: 1 von 3 Zetteln.");
  // on before every note is shown: the rest is revealed, after a question
  await forward(page, "Zu Risiken bündeln", true);
  for (const person of [anna, ben]) await expect(person.page.locator(".app-note[data-note]")).toHaveCount(3);
  await forward(page, "Plan anpassen");

  // the plan is adjusted: Ben adds a change, Anna agrees on it with who and by when
  await ben.page.locator(".app-actions").waitFor();
  await ben.page.getByLabel("Neue Aktion").fill("Skripte vorher dokumentieren");
  await ben.page.getByRole("button", { name: "Aktion hinzufügen", exact: true }).click();
  const row = page.locator(".app-actions__row").filter({ hasText: "Skripte vorher dokumentieren" });
  await expect(row).toBeVisible();
  await row.getByLabel("Wer").fill("Dora");
  await row.getByLabel("Bis wann").fill("15. Januar");
  await row.getByRole("button", { name: "Festlegen", exact: true }).click();
  await expect(ben.page.locator("[data-action]").filter({ hasText: "Skripte vorher dokumentieren" })).toContainText(
    "Festgelegt · Wer: Dora · Bis wann: 15. Januar",
  );
  await expect(page.locator(".app-actions .app-ballot__left")).toHaveText("1 von 1 festgelegt.");
  // the last step keeps the result
  await expect(ben.page.locator(".sb-primary-action")).toHaveText("Als Markdown sichern");

  const text = await saved(ben.page);
  expect(text).toContain("## Gründe aufschreiben");
  for (const reason of ["Niemand kennt die alten Skripte", "Die Kosten steigen im ersten Monat"]) {
    expect(text).toContain(`- ${reason}`);
  }
  expect(text).toContain(
    "## Festgelegte Aktionen\n\n- [ ] Skripte vorher dokumentieren — Wer: Dora, bis: 15\\. Januar\n",
  );
  for (const name of ["Anna", "Ben"]) expect(text).not.toContain(name);
});

test("ACCEPTANCE: „Rückblick nach Ziel und Daten“ with two browsers through all nine steps: hidden actions, a vote over them alone, an action agreed; the export", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const anna = await moderation(page, "Rückblick Sprint 12", "rueckblick");
  const ben = await another(browser, page.url(), "Ben");
  await expect(page.getByTestId("method")).toContainText("Rückblick nach Ziel und Daten: Ihr stellt Ziel");
  await writeNote(page, "Ziel: Suche ausliefern");
  await forward(page, "Was ist passiert? Fakten, Zahlen, Zeitleiste");
  await expect(hint(ben.page)).toContainText("Schreibt Fakten und Zahlen auf");
  await writeNote(ben.page, "3 von 5 Stories fertig");
  // revealing goal and facts asks first
  await forward(page, "Aufdecken", true);
  for (const person of [anna, ben]) await expect(person.page.locator(".app-note[data-note]")).toHaveCount(2);
  await forward(page, "Warum die Abweichung? Gründe in Kleingruppen");
  await expect(ben.page.locator(".app-state__team")).toContainText("Du bist in Team 1 mit Anna.");
  await writeNote(ben.page, "Grund: Umfang unklar");
  await forward(page, "Gründe vorstellen und bündeln", true);
  await forward(page, "Aktionen vorschlagen");
  const before = ben.frames.length;
  await writeNote(page, "Akzeptanzkriterien vorher schreiben");
  await writeNote(ben.page, "Reviews zu zweit");
  // the actions are hidden: Ben's browser never got Anna's
  await expect(ben.page.locator(".app-note[data-note]")).toHaveCount(4);
  expect(ben.frames.slice(before).join("\n")).not.toContain("Akzeptanzkriterien");
  await forward(page, "Aktionen aufdecken", true);
  await expect(ben.page.locator(".app-note[data-note]")).toHaveCount(5);
  await forward(page, "Aktionen wählen");
  // the vote offers the two actions, and nothing else
  for (const person of [anna, ben]) await expect(person.page.locator(".app-ballot__row")).toHaveCount(2);
  await ben.page.getByRole("button", { name: "Einen Punkt mehr: Reviews zu zweit" }).click();
  await ben.page.getByRole("button", { name: "Einen Punkt mehr: Reviews zu zweit" }).click();
  await ben.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(page)).toHaveText("Noch nicht abgegeben. 1 von 2 haben abgegeben.");
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  await expect(ben.page.locator(".app-results__row").first()).toContainText("Reviews zu zweit");
  await forward(page, "Bis zu drei Aktionen festlegen");

  // the actions in the order of the vote; Anna agrees on the first with the keyboard
  await expect(page.locator(".app-actions__row .sb-list-row__title")).toHaveText([
    "Reviews zu zweit",
    "Akzeptanzkriterien vorher schreiben",
  ]);
  const first = page.locator(".app-actions__row").first();
  await first.getByLabel("Wer").fill("Ben und Cem");
  await first.getByLabel("Bis wann").fill("nächster Sprint");
  await first.getByLabel("Bis wann").press("Enter");
  await expect(ben.page.locator("[data-action]").first()).toContainText(
    "Festgelegt · Wer: Ben und Cem · Bis wann: nächster Sprint",
  );
  // the vote's result stands beside the actions
  await expect(ben.page.locator(".app-results--side")).toContainText("Reviews zu zweit");

  const text = await saved(ben.page);
  expect(text).toContain("## Was sollte passieren? Das Ziel aufschreiben\n\n- Ziel: Suche ausliefern");
  expect(text).toContain("## Was ist passiert? Fakten, Zahlen, Zeitleiste\n\n- 3 von 5 Stories fertig");
  expect(text).toContain("## Warum die Abweichung? Gründe in Kleingruppen\n\n- Grund: Umfang unklar");
  expect(text).toContain("## Aktionen vorschlagen\n\n- Akzeptanzkriterien vorher schreiben");
  expect(text).toContain("## Festgelegte Aktionen\n\n- [ ] Reviews zu zweit — Wer: Ben und Cem, bis: nächster Sprint");
  expect(text).toContain("Gezählt nach Punkten");
  expect(text).toContain("In Teams gearbeitet: Warum die Abweichung? Gründe in Kleingruppen: 1 Team.");
});

test("ACCEPTANCE: „Was? Na und? Was nun?“ with two browsers through three rounds: each round written alone and hidden, then in the kept small group, then for everybody; the export by round", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const anna = await moderation(page, "Was lernen wir aus dem Ausfall am Montag?", "was-na-und");
  const ben = await another(browser, page.url(), "Ben");
  await expect(page.getByTestId("attribution")).toContainText("Liberating Structures Fieldbook, 2026");
  const rounds = [
    {
      alone: "Was ist passiert? Allein notieren",
      group: "Was ist passiert? In der Kleingruppe",
      present: "Was ist passiert? Kleingruppen stellen vor",
    },
    {
      alone: "Was bedeutet das? Allein notieren",
      group: "Was bedeutet das? In der Kleingruppe",
      present: "Was bedeutet das? Kleingruppen stellen vor",
    },
    {
      alone: "Was tun wir jetzt? Allein notieren",
      group: "Was tun wir jetzt? In der Kleingruppe",
      present: "Was tun wir jetzt? Kleingruppen stellen vor",
    },
  ];
  let seen = 0;
  for (const [n, round] of rounds.entries()) {
    if (n > 0) await forward(page, round.alone);
    await expect(stepLine(ben.page)).toContainText(round.alone);
    const mark = ben.frames.length;
    await writeNote(page, `Anna, Runde ${n + 1}`);
    await writeNote(ben.page, `Ben, Runde ${n + 1}`);
    // alone and hidden: what was presented before stays, Anna's new note is not in Ben's browser
    await expect(ben.page.locator(".app-note[data-note]")).toHaveCount(seen + 1);
    expect(ben.frames.slice(mark).join("\n")).not.toContain(`Anna, Runde ${n + 1}`);
    await expect(sentence(ben.page)).toContainText("Verdecktes Schreiben");
    // into the small group: no question, the group's notes go to the group
    await forward(page, round.group);
    await expect(ben.page.locator(".app-state__team")).toContainText("Du bist in Team 1 mit Anna.");
    await expect(ben.page.locator(".app-note[data-note]")).toHaveCount(seen + 2);
    await forward(page, round.present, true);
    seen += 2;
    for (const person of [anna, ben]) await expect(person.page.locator(".app-note[data-note]")).toHaveCount(seen);
  }
  await expect(stepLine(page)).toHaveText(
    "Schritt 9 von 9: Was tun wir jetzt? Kleingruppen stellen vor · der letzte Schritt",
  );
  await expect(note(ben.page, "Anna, Runde 3")).toHaveCount(1);

  const text = await saved(page);
  for (const [n, round] of rounds.entries()) {
    expect(text).toContain(`## ${round.alone}\n\n`);
    expect(text).toContain(`- Anna, Runde ${n + 1}`);
  }
  expect(text).toContain("Liberating Structures Fieldbook, 2026");
  expect(text).not.toMatch(/\bCem\b/);
});
