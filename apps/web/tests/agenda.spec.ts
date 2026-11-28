// Stage M7 (PLAN-METHODEN.md 5) end to end, each person in a browser of their own, against the Worker behind the
// build: an agenda of three methods built on `/neu` with the keyboard alone, then run through with two browsers, the
// ideas of the first method scored in the second; the moderation changes the methods not reached yet under „Mehr“ →
// „Ablauf“, and the methods begun stand there without keys. The frames on the server: apps/worker/test/agenda.test.ts;
// the rules: packages/shared/test/agenda.test.ts.
import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Download, type Page } from "@playwright/test";
import { AGENDA_THREE, know, makeWall, note, openMore, ownAddress, QUESTION, writeNote } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light", viewport: { width: 1440, height: 900 } });

type Person = { name: string; page: Page };

/** Another person in a browser of their own, joined at the door under a name. */
async function another(browser: Browser, address: string, name: string): Promise<Person> {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(address);
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-state__sentence").waitFor();
  return { name, page };
}

const position = (page: Page) => page.getByTestId("position");

/** „Weiter: <name>“, and „Aufdecken“ where it asks first; then the state names the step. */
async function forward(page: Page, name: string, reveals = false) {
  await page.getByRole("button", { name: `Weiter: ${name}`, exact: true }).click();
  if (reveals) await page.locator("#app-dlg-reveal").getByRole("button", { name: "Aufdecken", exact: true }).click();
}

/** Presses a key until the focused element passes the test; throws when it never does. */
async function focusBy(page: Page, found: () => boolean, key = "Tab") {
  for (let presses = 0; presses < 120; presses++) {
    if (await page.evaluate(found)) return;
    await page.keyboard.press(key);
  }
  throw new Error("the focus never got there");
}
const onKey = (name: string) =>
  `(() => { const el = document.activeElement; if (el === null || el.tagName !== "BUTTON") return false; const label = el.getAttribute("aria-label"); return label !== null ? label === ${JSON.stringify(name)} : (el.textContent ?? "").replace(/\\s+/g, " ").trim() === ${JSON.stringify(name)}; })()`;
/** Presses Tab (or Shift+Tab) until the focus stands on a key with this name. */
async function tabToKey(page: Page, name: string, back = false) {
  for (let presses = 0; presses < 120; presses++) {
    if (await page.evaluate(onKey(name))) return;
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
  }
  throw new Error(`the focus never reached „${name}“`);
}

/** The wall as Markdown, saved from „Mehr“. */
async function saved(page: Page): Promise<string> {
  const { row } = await openMore(page);
  const [download] = await Promise.all([page.waitForEvent("download"), row("Als Markdown sichern").click()]);
  return readFile(await (download as Download).path(), "utf8");
}

test("ACCEPTANCE: an agenda of three methods, built with the keyboard alone, runs through with two browsers; the first method's ideas are scored in the second; the export has a section each", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await ownAddress(page);
  await page.goto("/neu");
  await page.locator("#app-f-question").focus();
  await page.keyboard.type(QUESTION);
  // the second method: „Weitere Methode anhängen“ puts the focus into the choice, whose arrows choose
  await tabToKey(page, "Weitere Methode anhängen");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Methode 2 von 2" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Still sammeln, bündeln, verdeckt wählen" })).toBeFocused();
  for (let n = 0; n < 4; n++) await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Nutzen und Aufwand" })).toBeChecked();
  // the third
  await tabToKey(page, "Weitere Methode anhängen");
  await page.keyboard.press("Space");
  for (let n = 0; n < 12; n++) await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Scheitern vorwegdenken" })).toBeChecked();
  // the second's prompt, reached backwards
  await focusBy(
    page,
    () =>
      document.activeElement?.id.startsWith("app-agenda-prompt-") === true &&
      (document.activeElement as HTMLInputElement).labels?.[0]?.textContent?.includes("Methode 2") === true,
    "Shift+Tab",
  );
  await page.keyboard.type("Was packen wir zuerst an?");
  // moved down and up again: the focus goes with the item, to the same key
  await tabToKey(page, "Nach unten: 2. Nutzen und Aufwand");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Nach unten: 3. Nutzen und Aufwand" })).toBeFocused();
  await tabToKey(page, "Nach oben: 3. Nutzen und Aufwand", true);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Nach oben: 2. Nutzen und Aufwand" })).toBeFocused();
  await expect(page.locator(".app-agenda__name")).toHaveText([
    "1. Still sammeln, bündeln, verdeckt wählen",
    "2. Nutzen und Aufwand",
    "3. Scheitern vorwegdenken",
  ]);
  await tabToKey(page, "Wand anlegen");
  await page.keyboard.press("Enter");
  await page.locator("#app-f-as").waitFor();
  await page.fill("#app-f-as", "Anna");
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-state__sentence").waitFor();
  const ben = await another(browser, page.url(), "Ben");

  // 1. „Still sammeln“
  await expect(position(ben.page)).toHaveText(
    "Methode 1 von 3 · Still sammeln, bündeln, verdeckt wählen · Schritt 1 von 5: Ideen schreiben · danach Aufdecken",
  );
  await writeNote(page, "Zu viele Termine");
  await writeNote(ben.page, "Der Build ist langsam");
  await forward(page, "Aufdecken", true);
  await expect(note(page, "Der Build ist langsam")).toHaveCount(1);
  await forward(page, "Bündeln");
  await forward(page, "Wählen");
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  await forward(page, "Ergebnis besprechen");
  // the method's last step names the next method
  await expect(position(page)).toContainText(
    "Schritt 5 von 5: Ergebnis besprechen · danach Methode 2: Nutzen und Aufwand",
  );

  // 2. „Nutzen und Aufwand“, with its own prompt; its name and short description stand when it starts
  await forward(page, "Methode 2: Nutzen und Aufwand");
  await expect(position(ben.page)).toHaveText(
    "Methode 2 von 3 · Nutzen und Aufwand · Schritt 1 von 4: Optionen vorstellen · danach Nutzen und Aufwand bewerten",
  );
  await expect(ben.page.getByTestId("prompt")).toHaveText("Frage dieser Methode: Was packen wir zuerst an?");
  await expect(ben.page.getByTestId("method")).toHaveText(
    "Nutzen und Aufwand: Ihr sammelt Optionen und bewertet jede verdeckt nach Nutzen und Aufwand; heraus kommt eine Rangfolge mit beiden Werten.",
  );
  await writeNote(page, "Build-Server tauschen");
  await forward(page, "Nutzen und Aufwand bewerten");
  // the two ideas of the first method and the option of this one: three options, two criteria each
  for (const person of [page, ben.page]) {
    await person.locator(".app-score").waitFor();
    const fields = person.locator(".app-score select");
    await expect(fields).toHaveCount(6);
    for (let at = 0; at < 6; at++) await fields.nth(at).selectOption(String((at % 5) + 1));
    await person.getByRole("button", { name: "Abgeben", exact: true }).click();
  }
  await expect(page.locator(".app-state__sentence")).toHaveText("Abgegeben. 2 von 2 haben abgegeben.");
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  await expect(ben.page.locator(".app-score__table tbody tr")).toHaveCount(3);
  await forward(page, "Ergebnis besprechen");
  await forward(page, "Gesamturteil festhalten");

  // 3. „Scheitern vorwegdenken“: hidden again, the first method's notes stay shown
  await forward(page, "Methode 3: Scheitern vorwegdenken");
  await expect(position(ben.page)).toContainText("Methode 3 von 3 · Scheitern vorwegdenken · Schritt 1 von 5");
  await expect(ben.page.getByTestId("prompt")).toHaveCount(0);
  await forward(page, "Gründe aufschreiben");
  await writeNote(ben.page, "Niemand fühlt sich zuständig");
  await expect(note(ben.page, "Der Build ist langsam")).toHaveCount(1);
  await expect(note(page, "Niemand fühlt sich zuständig")).toHaveCount(0);
  await forward(page, "Reihum aufdecken");
  await page.getByRole("button", { name: "Nächster Zettel", exact: true }).click();
  await expect(note(page, "Niemand fühlt sich zuständig")).toHaveCount(1);
  await forward(page, "Zu Risiken bündeln");
  await forward(page, "Plan anpassen");
  await expect(position(page)).toContainText("Schritt 5 von 5: Plan anpassen · der letzte Schritt");

  const text = await saved(ben.page);
  expect(text).toContain("## 1. Still sammeln, bündeln, verdeckt wählen");
  expect(text).toContain("## 2. Nutzen und Aufwand");
  expect(text).toContain("**Frage:** Was packen wir zuerst an?");
  expect(text).toContain("## 3. Scheitern vorwegdenken");
  expect(text.indexOf("Niemand fühlt sich zuständig")).toBeGreaterThan(text.indexOf("## 3."));
  expect(text).not.toMatch(/\bAnna\b|\bBen\b/);
});

test("ACCEPTANCE: the moderation changes the methods not reached yet under „Ablauf“; the methods begun stand without keys; everybody sees the new agenda", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  const wall = await makeWall(page, QUESTION, { agenda: AGENDA_THREE });
  await know(page, [{ id: wall.wallId, question: QUESTION, as: "Anna", adminToken: wall.adminToken }]);
  await page.goto(`/w/${wall.wallId}`);
  await page.locator(".app-state__sentence").waitFor();
  const ben = await another(browser, page.url(), "Ben");
  // in the first method: the second and third may change
  let { row } = await openMore(page);
  await row("Ablauf").click();
  const dialog = page.locator("#app-dlg-agenda");
  await expect(dialog.getByText("Begonnen: lässt sich nicht mehr ändern.")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Entfernen: 3. Scheitern vorwegdenken" }).click();
  await dialog.getByRole("button", { name: "Weitere Methode anhängen" }).click();
  await dialog.getByRole("radio", { name: "Ziele mit messbaren Ergebnissen" }).check();
  await dialog.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(position(ben.page)).toContainText("Methode 1 von 3");
  await expect(position(ben.page)).toContainText("Schritt 1 von 5");
  // into the second method: the first two are begun now
  await forward(page, "Aufdecken", true);
  await forward(page, "Bündeln");
  await forward(page, "Wählen");
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  await forward(page, "Ergebnis besprechen");
  await forward(page, "Methode 2: Nutzen und Aufwand");
  ({ row } = await openMore(page));
  await row("Ablauf").click();
  await expect(dialog.getByText(/^Begonnen/)).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: /^Entfernen: [12]\./ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Entfernen: 3. Ziele mit messbaren Ergebnissen" })).toBeVisible();
  await dialog.getByRole("button", { name: "Entfernen: 3. Ziele mit messbaren Ergebnissen" }).click();
  await dialog.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(position(ben.page)).toHaveText(
    "Methode 2 von 2 · Nutzen und Aufwand · Schritt 1 von 4: Optionen vorstellen · danach Nutzen und Aufwand bewerten",
  );
  await expect(position(page)).toContainText("Methode 2 von 2");
});
