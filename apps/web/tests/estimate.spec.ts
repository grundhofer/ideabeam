// Estimating in rounds (stage M3, PLAN-METHODEN.md 5): „Schätzen – Diskutieren – Schätzen“ from its first estimate
// to its result, each person in a browser of their own, against the Worker behind the build. The acceptance: the
// second round shows only the summary of the first, and no frame the other browser receives carries anybody else's
// estimate of a round before it is counted, read from that browser's WebSocket itself; estimating works with the
// keyboard alone.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { enterEstimate, ESTIMATE_AGENDA, ESTIMATE_QUESTION, know, makeWall } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const WALL_SOCKET = /\/api\/walls\/[0-9a-f]{64}\/ws$/;

/** Every frame the wall's socket of a page received, as it came; the heartbeat left out. To be called before the
 *  page goes to the wall. */
function frames(page: Page) {
  const received: string[] = [];
  page.on("websocket", (socket) => {
    if (!WALL_SOCKET.test(socket.url())) return;
    socket.on("framereceived", (frame) => {
      const text = String(frame.payload);
      if (text !== "pong") received.push(text);
    });
  });
  return received;
}

/** Every number the frames carry, but the numbers of changes, times and places: what a frame could give away of
 *  an estimate. */
function numbersIn(raw: readonly string[]): Set<number> {
  const found = new Set<number>();
  const skip = new Set(["seq", "createdAt", "updatedAt", "serverNow", "x", "y", "w", "h", "rev", "endsAt", "at"]);
  const walk = (value: unknown, key: string) => {
    if (typeof value === "number" && !skip.has(key)) found.add(value);
    else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
    else if (typeof value === "object" && value !== null) {
      for (const [inner, item] of Object.entries(value)) walk(item, inner);
    }
  };
  for (const text of raw) walk(JSON.parse(text), "");
  return found;
}

/** Another person in a browser of their own, joined under a name; their socket's frames are recorded from the
 *  first one on. */
async function another(browser: Browser, address: string, name: string) {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const received = frames(page);
  await page.goto(address);
  await expect(page.locator('#app-form[aria-label="Beitreten"]')).toBeVisible();
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-estimate").waitFor();
  return { page, received };
}

const sentence = (page: Page) => page.locator(".app-state__sentence");
const rows = (page: Page, region: string) => page.getByRole("region", { name: region }).locator(".app-estimate__row");

test("ACCEPTANCE: two browsers through the whole method; before counting no frame carries the other's estimate, and the second round shows only the first round's summary", async ({
  page,
  browser,
}) => {
  const anna = frames(page);
  const wall = await makeWall(page, ESTIMATE_QUESTION, { agenda: ESTIMATE_AGENDA });
  await know(page, [{ id: wall.wallId, question: ESTIMATE_QUESTION, as: "Anna", adminToken: wall.adminToken }]);
  await page.goto(`/w/${wall.wallId}`);
  await page.locator(".app-estimate").waitFor();
  const cem = await another(browser, page.url(), "Cem");
  await expect(page.locator("#app-f-estimate").locator("..").locator(".sb-field__suffix")).toHaveText("Tage");

  // round 1: Anna (the moderation) and Cem estimate, each with a reason
  await page.fill("#app-f-estimate", "10");
  await page.fill("#app-f-reason", "Wie beim Umzug 2024");
  await page.locator("#app-f-estimate").press("Enter");
  await expect(sentence(page)).toHaveText("Geschätzt. 1 von 2 haben geschätzt.");
  await expect(sentence(cem.page)).toHaveText("Noch nicht geschätzt. 1 von 2 haben geschätzt.");
  // Anna's reason is hidden from Cem until the next step
  await expect(cem.page.getByText("Wie beim Umzug 2024")).toHaveCount(0);
  await cem.page.fill("#app-f-estimate", "23");
  await cem.page.fill("#app-f-reason", "Mehr Kisten als damals");
  await cem.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(sentence(page)).toHaveText("Geschätzt. 2 von 2 haben geschätzt.");
  await expect(cem.page.locator(".app-ballot__left")).toHaveText("Abgegeben: 23 Tage. Ändern geht bis zum Auszählen.");
  // before counting, no frame of either browser carries the other's estimate
  expect(numbersIn(cem.received).has(10)).toBe(false);
  expect(numbersIn(anna).has(23)).toBe(false);

  // counted: both see the same summary, never a single estimate beyond its range
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  for (const shown of [page, cem.page]) {
    await expect(rows(shown, "Ergebnis der Schätzung")).toHaveText([
      "Median16,5 Tage",
      "Mittlere Hälfte13,25 bis 19,75 Tage",
      "Spanne10 bis 23 Tage",
    ]);
    await expect(sentence(shown)).toHaveText("Ausgezählt: 2 Schätzungen.");
  }

  // the feedback reveals the reasons, without names; it asks first, as every revealing does
  await page.getByRole("button", { name: /^Weiter: Rückmeldung/ }).click();
  await page.locator("#app-dlg-reveal").getByRole("button", { name: "Aufdecken" }).click();
  await expect(cem.page.getByText("Wie beim Umzug 2024").first()).toBeVisible();
  await expect(page.getByText("Mehr Kisten als damals").first()).toBeVisible();
  // the first round's summary stands beside the reasons
  await expect(rows(cem.page, "Ergebnis der Schätzung")).toHaveCount(3);
  await page.getByRole("button", { name: "Weiter: Abweichungen besprechen" }).click();
  await expect(cem.page.locator(".app-state__note").first()).toHaveText(
    "Besprecht, warum die Schätzungen auseinanderliegen: Wer etwas weiß, das die anderen nicht wissen, sagt es. Danach schätzen alle neu.",
  );
  await page.getByRole("button", { name: "Weiter: Neu schätzen" }).click();

  // round 2: the first round's summary above the field, no reason, no single estimate
  const before = cem.received.length;
  await cem.page.locator(".app-estimate #app-f-estimate").waitFor();
  await expect(rows(cem.page, "Runde 1")).toHaveText([
    "Median16,5 Tage",
    "Mittlere Hälfte13,25 bis 19,75 Tage",
    "Spanne10 bis 23 Tage",
  ]);
  await expect(cem.page.locator("#app-f-reason")).toHaveCount(0);
  await page.fill("#app-f-estimate", "17,5");
  await page.locator("#app-f-estimate").press("Enter");
  await expect(sentence(cem.page)).toHaveText("Noch nicht geschätzt. 1 von 2 haben geschätzt.");
  await cem.page.fill("#app-f-estimate", "19");
  await cem.page.locator("#app-f-estimate").press("Enter");
  await expect(sentence(page)).toHaveText("Geschätzt. 2 von 2 haben geschätzt.");
  // ACCEPTANCE: nothing Cem got since the second round began carries Anna's estimate, and what Cem got of the
  // first round is its summary alone
  expect(numbersIn(cem.received.slice(before)).has(17.5)).toBe(false);
  expect(numbersIn(cem.received).has(17.5)).toBe(false);
  for (const text of cem.received) {
    const frame = JSON.parse(text) as { type: string; ballot?: { value?: number } | null };
    if (frame.ballot !== undefined && frame.ballot !== null) expect([23, 19]).toContain(frame.ballot.value);
  }

  // counted: both rounds, and how the median moved
  await page.getByRole("button", { name: "Auszählen", exact: true }).click();
  await expect(rows(cem.page, "Ergebnis der Schätzung")).toHaveText([
    "Median16,5 Tage",
    "Mittlere Hälfte13,25 bis 19,75 Tage",
    "Spanne10 bis 23 Tage",
    "Median18,25 Tage",
    "Mittlere Hälfte17,88 bis 18,63 Tage",
    "Spanne17,5 bis 19 Tage",
    "Gegenüber Runde 1Median von 16,5 auf 18,25 Tage, mittlere Hälfte von 6,5 auf 0,75 Tage breit",
  ]);
  await page.getByRole("button", { name: "Weiter: Ergebnis ansehen" }).click();
  await expect(cem.page.locator(".app-state__note").first()).toHaveText(
    "Beide Runden stehen bei der Methode: Median, mittlere Hälfte und Spanne, keine einzelne Schätzung.",
  );
  await expect(cem.page.locator(".app-results--side .app-estimate__row")).toHaveCount(7);
  await cem.page.context().close();
});

test("estimating works with the keyboard alone: Tab to the number, Enter casts it; Tab to the reason and to „Abgeben“", async ({
  page,
}) => {
  await enterEstimate(page);
  await page.locator("[data-sb-view] h1").focus();
  const tabToId = async (id: string) => {
    for (let presses = 0; presses < 40; presses++) {
      await page.keyboard.press("Tab");
      if ((await page.evaluate(() => document.activeElement?.id)) === id) return;
    }
    throw new Error(`the focus never reached #${id}`);
  };
  await tabToId("app-f-estimate");
  await page.keyboard.type("42");
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-ballot__left")).toHaveText("Abgegeben: 42 Tage. Ändern geht bis zum Auszählen.");
  // Ben estimated before he left: two estimates, of two people the wall knows to be here or to have estimated
  await expect(sentence(page)).toHaveText("Geschätzt. 2 von 2 haben geschätzt.");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("app-f-reason");
  await page.keyboard.type("Drei Zimmer, zwei Leute");
  for (let presses = 0; presses < 40; presses++) {
    await page.keyboard.press("Tab");
    const word = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim());
    if (word === "Abgeben") break;
  }
  await page.keyboard.press("Enter");
  // the reason is the person's note now: the field shows it as stored
  await expect(page.locator("#app-f-reason")).toHaveValue("Drei Zimmer, zwei Leute");
  await expect(page.locator(".app-ballot__left")).toHaveText("Abgegeben: 42 Tage. Ändern geht bis zum Auszählen.");
});
