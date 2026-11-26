// „Meine Angaben löschen“ with each person in a browser of their own, against the Worker behind the build: the wall
// forgets the person and this device the wall; the person's notes stay, without a name (the owner's decision K,
// PLAN.md 7.3); the moderation is told that it moderates afterwards only with the moderation link, and can copy it in
// the dialog. Adapted from FokusBeam's test of the same command (tests/checkout.spec.ts, docs/HERKUNFT.md).
import { expect, test, type Browser, type Page } from "@playwright/test";
import { enter, note, openMore, QUESTION, stored, storedTokens, writeNote } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const main = (page: Page) => page.getByRole("main");
const heading = (page: Page) => page.locator("[data-sb-view] h1");
/** The people on the wall, each row as it reads. */
const people = (page: Page) => main(page).locator('ul[aria-labelledby="app-h-people"] > li');
/** „Meine Angaben löschen“, a row of the wall's „Mehr“. (Writing a note leaves the page where it stands: the menu,
 *  which shuts on every scroll of the page, opens right after it.) */
const erase = async (page: Page) => (await openMore(page)).row("Meine Angaben löschen").click();
const dialogOf = (page: Page) => page.locator("#app-dlg-erase");

/** Another person, in a browser of their own, at the wall's address, on the wall under a name. */
async function another(browser: Browser, address: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(address);
  await joinAs(page, name);
  return page;
}

async function joinAs(page: Page, name: string) {
  await expect(page.locator('#app-form[aria-label="Beitreten"]')).toBeVisible();
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await expect(heading(page)).toHaveText(QUESTION);
}

test("the wall forgets the person and this device the wall; the person's notes stay, without a name", async ({
  page,
  browser,
}) => {
  await enter(page, { hidden: false });
  const ben = await another(browser, page.url(), "Ben");
  await writeNote(ben, "Fokuszeit am Vormittag");
  await expect(note(ben, "Fokuszeit am Vormittag")).toContainText("Deiner");
  await expect(people(page)).toHaveCount(2);

  await erase(ben);
  const dialog = dialogOf(ben);
  await expect(dialog).toContainText("Dein Name wird von der Wand entfernt");
  await expect(dialog).toContainText("Dein Zettel bleibt auf der Wand, ohne deinen Namen");
  await expect(dialog).not.toContainText("Du moderierst");
  await expect(dialog.getByRole("button", { name: "Moderationslink kopieren" })).toHaveCount(0);
  // not yet: the question can be taken back
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(people(page)).toHaveCount(2);
  await erase(ben);
  await dialog.getByRole("button", { name: "Löschen", exact: true }).click();

  await expect(heading(ben)).toHaveText("Angaben gelöscht");
  await expect(people(page)).toHaveCount(1);
  // the note stays for everyone
  await expect(note(page, "Fokuszeit am Vormittag")).toHaveCount(1);
  expect(await stored(ben)).toEqual([]);

  // the link still leads on: as a new person, and the name is free again; the note is nobody's now
  await ben.reload();
  await joinAs(ben, "Ben");
  await expect(people(page)).toHaveCount(2);
  await expect(note(ben, "Fokuszeit am Vormittag")).toHaveCount(1);
  await expect(note(ben, "Fokuszeit am Vormittag")).not.toContainText("Deiner");
});

test("the moderation is told it moderates afterwards only with the moderation link, and can copy it first", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const wall = await enter(page, { hidden: false });
  await writeNote(page, "Weniger Termine");
  await writeNote(page, "Entscheidungen aufschreiben");

  await erase(page);
  const dialog = dialogOf(page);
  await expect(dialog).toContainText("Deine 2 Zettel bleiben auf der Wand, ohne deinen Namen");
  await expect(dialog).toContainText(
    "Du moderierst: Danach moderierst du diese Wand nur noch mit dem Moderationslink.",
  );
  await dialog.getByRole("button", { name: "Moderationslink kopieren" }).click();
  await expect(dialog.getByRole("button", { name: "Kopiert" })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toBe(`${new URL(page.url()).origin}/w/${wall.wallId}#admin=${wall.adminToken}`);
  await dialog.getByRole("button", { name: "Löschen", exact: true }).click();

  await expect(heading(page)).toHaveText("Angaben gelöscht");
  expect(await stored(page)).toEqual([]);
  expect(await storedTokens(page)).toEqual({});

  // the copied link moderates again, as a new person (from another page: the same address with only another `#`
  // would not load the page again)
  await page.goto("/");
  await page.goto(link);
  await joinAs(page, "Anna");
  await expect(people(page)).toHaveCount(1);
  await expect(people(page).first()).toContainText("Moderation");
  await expect(note(page, "Weniger Termine")).not.toContainText("Deiner");
});
