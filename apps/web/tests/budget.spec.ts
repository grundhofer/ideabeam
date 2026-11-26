// The day's budget of walls, as the app says it: no wall is made once the day's walls are taken, in a sentence that
// names the time it goes on, and the action stays. The Worker's side (the count, the day's turn) is tested in
// apps/worker/test; here the Worker's answer is put in its place, because a test cannot spend a real day's budget.
import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const heading = (page: Page) => page.locator("[data-sb-view] h1");
const QUESTION = "Was hält uns bei der Arbeit auf?";

/** The next 00:00 UTC, and how this machine's clock writes it. */
function dayTurns() {
  const resetsAt = (Math.floor(Date.now() / 86_400_000) + 1) * 86_400_000;
  const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(resetsAt),
  );
  return { resetsAt, time };
}

test("„Wand anlegen“ on a day whose walls are taken says when it goes on and keeps the question; then it makes the wall", async ({
  page,
}) => {
  const { resetsAt, time } = dayTurns();
  let spent = true;
  await page.route("**/api/walls", async (route) => {
    if (spent && route.request().method() === "POST") {
      await route.fulfill({ status: 429, json: { error: "BUDGET_SPENT", resetsAt }, headers: { "retry-after": "60" } });
    } else await route.continue();
  });
  await page.goto("/neu");
  await page.fill("#app-f-question", QUESTION);
  await page.locator('#app-form button[type="submit"]').click();

  const message = page.locator("#app-form .sb-form-grid__message");
  await expect(message).toHaveText(
    new RegExp(`^Heute sind alle Wände vergeben\\. Ab ${time}\\sUhr geht es weiter\\. Deine Frage ist noch da\\.$`),
  );
  await expect(page.locator("#app-f-question")).toHaveValue(QUESTION);
  await expect(page.locator('#app-form button[type="submit"]')).toHaveText("Noch mal versuchen");
  await expect(heading(page)).toHaveText("Neue Wand");

  // the day has turned: the same press makes the wall and leads to its door
  spent = false;
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": "10.77.0.1" });
  await page.locator('#app-form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f]{64}$/);
  await expect(heading(page)).toHaveText(QUESTION);
});
