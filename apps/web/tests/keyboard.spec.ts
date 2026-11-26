// The main flows by keyboard alone: make a wall with the form's error first and join it at its door, delete the wall
// through the dialog, join at the door with a name that is taken, „Hell oder Dunkel“ and the language in the „Mehr“
// menu, and the command palette.
import { test, expect, type Locator, type Page } from "@playwright/test";
import { enter, ownAddress, QUESTION } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

/** Presses Tab until the element has the focus (at most 60 presses). */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${String(target)}`);
}

const main = (page: Page) => page.getByRole("main");
const heading = (page: Page) => page.locator("[data-sb-view] h1");
const more = (page: Page) => page.locator("[data-sb-web-app-head] [aria-haspopup=menu]");
const row = (page: Page, name: string) => page.getByRole("menuitemradio", { name, exact: true });
/** „Hell oder Dunkel“ in the site's head. */
const themeButton = (page: Page) => page.locator(".sb-site-header .sb-theme-button");
/** The state sentence at the top of a wall. */
const sentence = (page: Page) => page.locator(".app-state__sentence");

/** Presses the arrow down until the menu's row has the focus (at most 20 presses). */
async function downTo(page: Page, target: Locator) {
  for (let i = 0; i < 20; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("ArrowDown");
  }
  throw new Error(`the arrow never reached ${String(target)}`);
}

test("make a wall by keyboard, with the error first, and join it at its door", async ({ page }) => {
  await page.goto("/");
  await ownAddress(page);
  await tabTo(page, page.locator('a.sb-primary-action[href="/neu"]'));
  await page.keyboard.press("Enter");
  await expect(heading(page)).toHaveText("Neue Wand");
  await expect(heading(page)).toBeFocused();
  // the primary action stays enabled; its press names what is missing and focuses the field
  await tabTo(page, page.locator('#app-form button[type="submit"]'));
  await page.keyboard.press("Enter");
  await expect(page.locator("#app-f-question")).toBeFocused();
  await expect(page.locator("#app-f-question-error")).toHaveText("Frage fehlt.");
  await page.keyboard.type(QUESTION);
  await page.keyboard.press("Enter");
  // the wall is made, and the app stands at its door: the question is the heading, and the heading has the focus
  await expect(page.locator('#app-form[aria-label="Beitreten"]')).toBeVisible();
  await expect(heading(page)).toHaveText(QUESTION);
  await expect(heading(page)).toBeFocused();
  await tabTo(page, page.locator("#app-f-as"));
  await page.keyboard.type("Anna");
  await page.keyboard.press("Enter");
  // on the wall: another view under the same question, and its heading has the focus
  await expect(main(page)).toContainText("Anna (du)");
  await expect(main(page)).toContainText("Moderation");
  await expect(page.locator("[data-sb-view]")).toHaveAttribute("data-sb-view", "wand");
  await expect(heading(page)).toHaveText(QUESTION);
  await expect(heading(page)).toBeFocused();
  // the keys of the wall are reached in their order: in its head the wall's link, then „Mehr“ with the
  // moderation's tools; in the content, while nobody else has come, the link once more, under what to do now
  await tabTo(page, page.locator("[data-sb-web-app-head]").getByRole("button", { name: "Link kopieren" }));
  await page.keyboard.press("Tab");
  await expect(more(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Moderationslink kopieren", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "Wand löschen", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more(page)).toBeFocused();
  await tabTo(page, main(page).getByRole("button", { name: "Link kopieren" }));
});

test("delete the wall through the dialog: Escape returns the focus, „Löschen“ deletes", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  // „Wand löschen“ is the last row of the wall's „Mehr“
  await tabTo(page, more(page));
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "Wand löschen", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.locator("#app-dlg-delete");
  await expect(dialog.locator('button[value="cancel"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(more(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(dialog.locator('button[value="confirm"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(heading(page)).toHaveText("Wand gelöscht");
  await expect(heading(page)).toBeFocused();
  await expect(main(page)).toContainText("Diese Wand wurde gelöscht.");
});

test("join at the door by keyboard: a name that is taken, then another", async ({ page, browser }) => {
  await page.goto("/");
  const { wallId } = await enter(page);
  const context = await browser.newContext();
  const ben = await context.newPage();
  await ben.goto(`/w/${wallId}`);
  await expect(heading(ben)).toHaveText(QUESTION);
  await tabTo(ben, ben.locator("#app-f-as"));
  await ben.keyboard.type("Anna");
  await ben.keyboard.press("Enter");
  await expect(ben.locator("#app-f-as-error")).toContainText("Diesen Namen hat schon jemand auf der Wand.");
  await expect(ben.locator("#app-f-as")).toBeFocused();
  await ben.keyboard.press("ControlOrMeta+a");
  await ben.keyboard.type("Ben");
  await ben.keyboard.press("Enter");
  await expect(main(ben)).toContainText("Ben (du)");
  await expect(heading(ben)).toBeFocused();
  await context.close();
});

test("the site's head: „Hell oder Dunkel“ switches, says so and is stored; the language swaps without a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await tabTo(page, themeButton(page));
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".sb-site-header [role=status]")).toHaveText("Dunkel ist an.");
  expect(await page.evaluate(() => localStorage.getItem("sb-theme"))).toBe("dark");
  // the label never changes, and the focus stays on the button
  await expect(themeButton(page)).toHaveText("Hell oder Dunkel");
  await expect(themeButton(page)).toBeFocused();
  // a second press is the system's mode again: the stored choice goes
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
  await expect(page.locator(".sb-site-header [role=status]")).toHaveText("Hell ist an.");
  expect(await page.evaluate(() => localStorage.getItem("sb-theme"))).toBeNull();
  // the language is one stop, the arrow keys move the choice: every word, no reload, kept after one
  await tabTo(page, page.getByRole("radio", { name: "Deutsch" }));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(heading(page)).toHaveText("Everyone writes notes, an AI groups them.");
  await expect(themeButton(page)).toHaveText("Light or dark");
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  await page.reload();
  await expect(heading(page)).toHaveText("Everyone writes notes, an AI groups them.");
});

test("a wall's „Mehr“: „Hell oder Dunkel“ switches, says so and is stored; the language swaps without a reload", async ({
  page,
}) => {
  await page.goto("/");
  await enter(page);
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await tabTo(page, more(page));
  await page.keyboard.press("Enter");
  // the wall's own rows come first, then the three groups of choices
  await expect(page.getByRole("menuitem", { name: "Moderationslink kopieren", exact: true })).toBeFocused();
  await expect(row(page, "Wie das System")).toHaveAttribute("aria-checked", "true");
  await downTo(page, row(page, "Dunkel"));
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // (the head has two status lines: the copy key's own, and the one of „Mehr“)
  await expect(page.locator("[data-sb-web-app-head] p[role=status]")).toHaveText("Dunkel ist an.");
  expect(await page.evaluate(() => localStorage.getItem("sb-theme"))).toBe("dark");
  // the choice closes the menu and the focus is back on its button
  await expect(page.locator("#app-more")).toBeHidden();
  await expect(more(page)).toBeFocused();
  // „Wie das System“ takes the stored choice away
  await page.keyboard.press("Enter");
  await expect(row(page, "Dunkel")).toHaveAttribute("aria-checked", "true");
  await downTo(page, row(page, "Wie das System"));
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
  expect(await page.evaluate(() => localStorage.getItem("sb-theme"))).toBeNull();
  // the language: every word, no reload, kept after one
  await page.keyboard.press("Enter");
  await expect(row(page, "English")).toHaveAttribute("lang", "en");
  await downTo(page, row(page, "English"));
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // (a wall starts with hidden writing, and its state says so)
  await expect(sentence(page)).toHaveText("Hidden writing: no notes yet. 1 person is here.");
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  await page.reload();
  await expect(sentence(page)).toHaveText("Hidden writing: no notes yet. 1 person is here.");
});

test("the command palette opens with ⌘K or Strg+K, finds by typing and gives the focus back", async ({ page }) => {
  await page.goto("/");
  await themeButton(page).focus();
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.locator("#app-commands");
  await expect(palette.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(themeButton(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("warm");
  await expect(palette.getByRole("option")).toHaveText(["Farbton Warm"]);
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-sb-tone", "warm");
  // a setting shows its state by the check alone
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette.getByRole("option", { name: "Farbton Warm" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.type("einst");
  await page.keyboard.press("Enter");
  await expect(heading(page)).toHaveText("Einstellungen");
  await expect(heading(page)).toBeFocused();
});
