// Hidden voting (stage M2, PLAN-METHODEN.md 5), each person in a browser of their own, against the Worker behind the
// build. The acceptance: before counting no frame a second browser receives carries anybody else's ballot or a
// tally, read from that browser's WebSocket itself; a ballot sent twice stays one; voting works with the keyboard
// alone; the result reaches everybody at once as a ranked list with numbers.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { enterVote, VOTE_STEP } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const WALL_SOCKET = /\/api\/walls\/[0-9a-f]{64}\/ws$/;

/** Every frame the wall's socket of a page received and sent, as it came; the heartbeat left out. To be called
 *  before the page goes to the wall. */
function frames(page: Page) {
  const received: string[] = [];
  const sent: string[] = [];
  page.on("websocket", (socket) => {
    if (!WALL_SOCKET.test(socket.url())) return;
    socket.on("framereceived", (frame) => {
      const text = String(frame.payload);
      if (text !== "pong") received.push(text);
    });
    socket.on("framesent", (frame) => {
      const text = String(frame.payload);
      if (text !== "ping") sent.push(text);
    });
  });
  return { received, sent };
}

type Frame = { type: string; [key: string]: unknown };
const parsed = (texts: string[]) => texts.map((text) => JSON.parse(text) as Frame);

/** Another person in a browser of their own, joined under a name; their socket's frames are recorded from the
 *  first one on. */
async function another(browser: Browser, address: string, name: string) {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const recorded = frames(page);
  await page.goto(address);
  await expect(page.locator('#app-form[aria-label="Beitreten"]')).toBeVisible();
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-ballot").waitFor();
  return { page, ...recorded };
}

/** Presses Tab until the focus stands on the control with this accessible name; fails after 40 presses. */
async function tabTo(page: Page, name: string) {
  for (let presses = 0; presses < 40; presses++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return active?.getAttribute("aria-label") ?? active?.textContent?.trim() ?? "";
    });
    if (focused === name) return;
  }
  throw new Error(`the focus never reached „${name}“`);
}

const sentence = (page: Page) => page.locator(".app-state__sentence");

test("ACCEPTANCE: before counting no frame of the other browser carries a foreign ballot or a tally; a ballot sent twice stays one; then the result reaches both at once", async ({
  page,
  browser,
}) => {
  const anna = frames(page);
  const wall = await enterVote(page, { admin: true });
  const ben = await another(browser, page.url(), "Cem");
  await expect(sentence(page)).toHaveText("Noch nicht abgegeben. 0 von 2 haben abgegeben.");

  // Anna, the moderation, votes: both points on the group
  await page.getByRole("button", { name: "Einen Punkt mehr: Abstimmung" }).click();
  await page.getByRole("button", { name: "Einen Punkt mehr: Abstimmung" }).click();
  await expect(page.locator(".app-ballot__left")).toHaveText("Alle Punkte verteilt.");
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(page)).toHaveText("Abgegeben. 1 von 2 haben abgegeben.");
  await expect(sentence(ben.page)).toHaveText("Noch nicht abgegeben. 1 von 2 haben abgegeben.");
  // sent a second time, unchanged: still one ballot, and the other browser hears nothing of it
  const heard = ben.received.length;
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect.poll(() => parsed(anna.sent).filter((frame) => frame.type === "ballot.cast").length).toBe(2);
  await page.waitForTimeout(300);
  expect(ben.received.length).toBe(heard);
  await expect(sentence(page)).toHaveText("Abgegeben. 1 von 2 haben abgegeben.");

  // Cem votes too: one point on a note
  await ben.page.getByRole("button", { name: "Einen Punkt mehr: Fokuszeit am Vormittag" }).click();
  await ben.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(ben.page)).toHaveText("Abgegeben. 2 von 2 haben abgegeben.");
  await expect(sentence(page)).toHaveText("Abgegeben. 2 von 2 haben abgegeben.");

  // Every frame Cem's browser got so far: no tally, and no ballot but Cem's own
  const annasBallot = JSON.stringify({ [wall.groupId]: 2 });
  for (const frame of parsed(ben.received)) {
    expect(frame.type).not.toBe("results.published");
    if (frame.type === "sync") expect(frame.results).toEqual([]);
    if ("ballot" in frame && frame.ballot !== null) {
      expect(frame.type).toBe("ballot.stored");
      expect(JSON.stringify(frame.ballot)).not.toContain(wall.groupId);
    }
    if ("result" in frame || "rows" in frame) throw new Error(`a tally in ${frame.type}`);
  }
  expect(ben.received.some((text) => text.includes(annasBallot))).toBe(false);
  // and what Cem saw counts: one number
  expect(parsed(ben.received).filter((frame) => frame.type === "votes.count")).toEqual([
    expect.objectContaining({ step: VOTE_STEP, voted: 1 }),
  ]);

  // the moderation counts: both browsers show the same ranked list, with places and points
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  for (const shown of [page, ben.page]) {
    const results = shown.getByRole("region", { name: "Ergebnis der Wahl" });
    const rows = results.locator(".app-results__row");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toHaveText(/^1\.Abstimmung.*2\u00a0Punkte$/);
    await expect(rows.nth(1)).toHaveText(/^2\.Fokuszeit am Vormittag1\u00a0Punkt$/);
    // the two options without points share place 3; the order between them is not part of the result
    expect((await rows.nth(2).innerText()) + (await rows.nth(3).innerText())).toMatch(
      /^3\.\s*(Mehr Pausen|Ein Board für alles)\s*0\u00a0Punkte\s*3\.\s*(Mehr Pausen|Ein Board für alles)\s*0\u00a0Punkte$/,
    );
    expect(new Set([await rows.nth(2).innerText(), await rows.nth(3).innerText()]).size).toBe(2);
    await expect(sentence(shown)).toHaveText("Ausgezählt: 2\u00a0Stimmzettel.");
    await expect(shown.locator(".app-results .app-ballot__note").first()).toHaveText(
      "Gezählt nach Punkten: 2\u00a0Punkte je Person.",
    );
  }
  expect(parsed(ben.received).filter((frame) => frame.type === "results.published")).toHaveLength(1);
  // the moderation goes on; the result stands beside the surface in the next step
  await page.getByRole("button", { name: "Weiter: Ergebnis besprechen" }).click();
  await expect(ben.page.locator(".app-results--side .app-results__row").first()).toContainText("Abstimmung");
  await ben.page.context().close();
});

test("voting works with the keyboard alone: Tab to − and +, Space or Enter, Tab to „Abgeben“", async ({ page }) => {
  await enterVote(page);
  await page.locator("[data-sb-view] h1").focus();
  await tabTo(page, "Einen Punkt mehr: Abstimmung");
  await page.keyboard.press("Space");
  await expect(page.locator(".app-ballot__left")).toHaveText("Noch 1\u00a0Punkt");
  await tabTo(page, "Einen Punkt mehr: Mehr Pausen");
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-ballot__left")).toHaveText("Alle Punkte verteilt.");
  // the budget is spent: „+“ stays in the tab order and says it cannot act
  const spent = page.getByRole("button", { name: "Einen Punkt mehr: Fokuszeit am Vormittag" });
  await expect(spent).toHaveAttribute("aria-disabled", "true");
  await spent.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-ballot__left")).toHaveText("Alle Punkte verteilt.");
  // one point back, and on another note
  await page.getByRole("button", { name: "Einen Punkt weniger: Mehr Pausen" }).focus();
  await page.keyboard.press("Enter");
  await spent.focus();
  await page.keyboard.press("Enter");
  await tabTo(page, "Abgeben");
  await page.keyboard.press("Enter");
  await expect(sentence(page)).toHaveText("Abgegeben. 1 von 1 haben abgegeben.");
  await expect(page.locator(".app-ballot__value")).toHaveText(["1", "1", "0", "0"]);
});
