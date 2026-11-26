// Nothing the user typed is lost without a question: every way out of the form with a question typed asks first (a
// link, Back, closing or reloading); the language keeps what was typed.
import { test, expect, type Page } from "@playwright/test";
import { QUESTION, stored } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const heading = (page: Page) => page.locator("[data-sb-view] h1");
// a link out of the form: the footer's
const imprint = (page: Page) => page.locator('.sb-site-footer a[href="/impressum"]');
const unsaved = (page: Page) => page.locator("#app-dlg-unsaved");

/** The form with a question typed, the wall not made. */
async function dirtyForm(page: Page) {
  await expect(heading(page)).toHaveText("Neue Wand");
  await page.fill("#app-f-question", QUESTION);
}

/** The question is open, the form and what was typed still stand, the address is the form's. */
async function heldBack(page: Page) {
  await expect(unsaved(page)).toHaveJSProperty("open", true);
  await expect(page.locator("#app-f-question")).toHaveValue(QUESTION);
  expect(new URL(page.url()).pathname).toBe("/neu");
}

test("a link asks first: „Abbrechen“ stays, „Verwerfen“ goes on and makes no wall", async ({ page }) => {
  await page.goto("/neu");
  await dirtyForm(page);
  await imprint(page).click();
  await heldBack(page);
  await expect(unsaved(page).locator(".sb-dialog__actions button")).toHaveText(["Abbrechen", "Verwerfen"]);
  await unsaved(page).locator('button[value="cancel"]').click();
  await expect(unsaved(page)).toHaveJSProperty("open", false);
  await expect(page.locator("#app-f-question")).toHaveValue(QUESTION);
  await imprint(page).click();
  await unsaved(page).locator('button[value="discard"]').click();
  await expect(heading(page)).toHaveText("Impressum");
  expect(await stored(page)).toEqual([]);
});

test("Back asks first; „Verwerfen“ then goes where Back went", async ({ page }) => {
  await page.goto("/");
  await page.locator('a.sb-primary-action[href="/neu"]').click();
  await dirtyForm(page);
  await page.goBack();
  await heldBack(page);
  await unsaved(page).locator('button[value="discard"]').click();
  await expect(heading(page)).toHaveText("Alle schreiben Zettel, eine KI ordnet sie.");
});

test("a form with nothing typed lets go without a question, also with spaces alone", async ({ page }) => {
  await page.goto("/neu");
  await expect(heading(page)).toHaveText("Neue Wand");
  await page.fill("#app-f-question", "   ");
  await imprint(page).click();
  await expect(heading(page)).toHaveText("Impressum");
});

test("the language keeps what was typed and the question", async ({ page }) => {
  await page.goto("/neu");
  await dirtyForm(page);
  // by the command palette (the site's head offers the language too)
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("English");
  await page.keyboard.press("Enter");
  await expect(heading(page)).toHaveText("New wall");
  await expect(page.locator("#app-f-question")).toHaveValue(QUESTION);
  await page.locator("#app-form").getByRole("button", { name: "Cancel" }).click();
  await expect(unsaved(page).locator("h2")).toHaveText("Discard the question?");
});

test("closing or reloading with a question typed gets the browser's question, without it none", async ({ page }) => {
  await page.goto("/neu");
  const asked: string[] = [];
  page.on("dialog", (d) => {
    asked.push(d.type());
    void d.dismiss();
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(asked).toEqual([]);
  await dirtyForm(page);
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => asked).toEqual(["beforeunload"]);
});
