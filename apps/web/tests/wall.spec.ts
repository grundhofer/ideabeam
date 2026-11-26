// A wall with more than one person on it, each in a browser of their own, against the Worker behind the build: one
// makes a wall, another joins by its link, both see each other; a reload is the same person; a socket that drops
// heals; the moderation deletes the wall and everyone is told; the moderation link moves the moderation to another
// browser; and no page asks any other origin for anything.
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  enter,
  know,
  KNOWN,
  LONG_QUESTION,
  makeWall,
  openMore,
  ownAddress,
  QUESTION,
  stored,
  storedTokens,
} from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const main = (page: Page) => page.getByRole("main");
const heading = (page: Page) => page.locator("[data-sb-view] h1");
/** The people on the wall, each row as it reads: name, role, whether they are here. */
const people = (page: Page) => main(page).locator('ul[aria-labelledby="app-h-people"] > li');
/** The state sentence at the top of the wall. */
const sentence = (page: Page) => page.locator(".app-state__sentence");
/** The wall's head: its question, the link to copy and „Mehr“. */
const head = (page: Page) => page.locator("[data-sb-web-app-head]");
/** A row of the head's „Mehr“ menu, where the moderation's tools stand. It is in the page while the menu is shut:
 *  whether somebody has it is counted, not seen. */
const row = (page: Page, name: string) =>
  page.locator("#app-more").getByRole("menuitem", { name, exact: true, includeHidden: true });
/** Opens „Mehr“ and presses one of its rows. */
const pick = async (page: Page, name: string) => (await openMore(page)).row(name).click();
const submit = (page: Page) => page.locator('#app-form button[type="submit"]').click();

/** Another person, in a browser of their own, at the wall's address. */
async function another(browser: Browser, address: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(address);
  return page;
}

/** At the wall's door: its question is the heading, and the one thing asked is a name. */
async function joinAs(page: Page, name: string) {
  await expect(page.locator('#app-form[aria-label="Beitreten"]')).toBeVisible();
  await page.fill("#app-f-as", name);
  await submit(page);
}

/** Makes a wall through the app, as a person does: „Neue Wand“, the question, „Wand anlegen“, then the name at the
 *  wall's door. Returns the wall's id. */
async function makeAndJoin(page: Page, name = "Anna") {
  await page.goto("/");
  await ownAddress(page);
  await page.locator('a.sb-primary-action[href="/neu"]').click();
  await page.fill("#app-f-question", QUESTION);
  await submit(page);
  await joinAs(page, name);
  await expect(people(page)).toHaveCount(1);
  return new URL(page.url()).pathname.slice("/w/".length);
}

/** Every address a browser asks while the test runs: requests of its pages, and their sockets. */
function record(context: BrowserContext) {
  const asked: string[] = [];
  /** every frame a socket of the browser sent */
  const frames: string[] = [];
  context.on("request", (request) => asked.push(request.url()));
  context.on("page", (page) =>
    page.on("websocket", (socket) => {
      asked.push(socket.url());
      socket.on("framesent", (frame) => frames.push(String(frame.payload)));
    }),
  );
  return { asked, frames };
}

test("one makes a wall, another joins by its link: both see each other", async ({ page, browser }) => {
  await page.goto("/");
  await ownAddress(page);
  await page.locator('a.sb-primary-action[href="/neu"]').click();
  await page.fill("#app-f-question", QUESTION);
  await submit(page);
  // the wall is made and the app stands at its door: the question is the heading, the name is asked here
  await expect(heading(page)).toHaveText(QUESTION);
  await joinAs(page, "Anna");
  await expect(people(page)).toHaveText(["AAnna (du)Moderationda"]);
  // a wall made through the form starts with hidden writing: its state says so
  await expect(sentence(page)).toHaveText("Verdecktes Schreiben: noch keine Zettel. 1 Person ist da.");

  const ben = await another(browser, page.url());
  // the door says which wall it is before it asks for a name
  await expect(heading(ben)).toHaveText(QUESTION);
  await joinAs(ben, "Ben");
  await expect(people(ben)).toHaveText(["AAnnaModerationda", "BBen (du)da"]);
  await expect(people(page)).toHaveText(["AAnna (du)Moderationda", "BBenda"]);
  await expect(sentence(page)).toHaveText("Verdecktes Schreiben: noch keine Zettel. 2 Personen sind da.");
  // each is told what to do now: the moderation that everyone writes and that revealing is theirs, everybody else
  // to write, and that nobody reads along
  await expect(page.locator(".app-state__note")).toHaveText([
    "Du moderierst: Jetzt schreiben alle ihre Ideen auf Zettel, du auch. Niemand liest mit, bis du aufdeckst.",
  ]);
  await expect(ben.locator(".app-state__note")).toHaveText([
    "Schreib deine Ideen auf Zettel. Niemand liest mit, bis die Moderation aufdeckt.",
  ]);
  // only the moderation can delete the wall or hand the moderation on
  await expect(row(page, "Wand löschen")).toHaveCount(1);
  await expect(row(page, "Moderationslink kopieren")).toHaveCount(1);
  await expect(row(ben, "Wand löschen")).toHaveCount(0);
  await expect(row(ben, "Moderationslink kopieren")).toHaveCount(0);

  // Ben goes: Anna sees it, and the wall still knows him
  await ben.context().close();
  await expect(people(page)).toHaveText(["AAnna (du)Moderationda", "BBennicht da"]);
  await expect(sentence(page)).toHaveText("Verdecktes Schreiben: noch keine Zettel. 1 Person ist da.");
});

test("a name that somebody on the wall has gets a sentence that says what to do", async ({ page, browser }) => {
  await enter(page);
  const second = await another(browser, page.url());
  await joinAs(second, "  anna ");
  await expect(second.locator("#app-f-as-error")).toHaveText(
    "Diesen Namen hat schon jemand auf der Wand. Nimm einen anderen, etwa mit dem Anfang deines Nachnamens.",
  );
  await expect(second.locator("#app-f-as")).toBeFocused();
  await expect(people(second)).toHaveCount(0);
  // another name gets on
  await joinAs(second, "Anna B.");
  await expect(people(second)).toHaveCount(2);
  await expect(people(page)).toHaveCount(2);
  await second.context().close();
});

test("a reload is the same person, not a second one", async ({ page, browser }) => {
  await enter(page);
  const ben = await another(browser, page.url());
  await joinAs(ben, "Ben");
  await expect(people(page)).toHaveCount(2);

  await ben.reload();
  // no door this time: the browser knows the wall and goes back on under its name
  await expect(people(ben)).toHaveText(["AAnnaModerationda", "BBen (du)da"]);
  await expect(people(page)).toHaveText(["AAnna (du)Moderationda", "BBenda"]);
  expect(await stored(ben)).toEqual([QUESTION]);
  await ben.context().close();
});

test("a socket that drops heals by itself", async ({ page, browser }) => {
  await enter(page);
  const context = await browser.newContext();
  const ben = await context.newPage();
  // the test stands between Ben's browser and the Worker, so it can cut the line
  const lines: Array<{ close(): void }> = [];
  await ben.routeWebSocket(/\/api\/walls\/.*\/ws$/, (ws) => {
    const server = ws.connectToServer();
    lines.push({
      close: () => {
        void server.close();
        void ws.close();
      },
    });
  });
  await ben.goto(page.url());
  await joinAs(ben, "Ben");
  await expect(sentence(ben)).toHaveText("Verdecktes Schreiben: noch keine Zettel. 2 Personen sind da.");
  await expect(people(page)).toHaveText(["AAnna (du)Moderationda", "BBenda"]);
  expect(lines).toHaveLength(1);

  lines[0]?.close();
  // Ben's browser connects again and is the same person; Anna never sees a second Ben
  await expect.poll(() => lines.length).toBe(2);
  await expect(sentence(ben)).toHaveText("Verdecktes Schreiben: noch keine Zettel. 2 Personen sind da.");
  await expect(people(ben)).toHaveText(["AAnnaModerationda", "BBen (du)da"]);
  await expect(people(page)).toHaveText(["AAnna (du)Moderationda", "BBenda"]);
  await context.close();
});

test("the moderation deletes the wall: everyone is told, and the address leads nowhere", async ({ page, browser }) => {
  const wall = await enter(page);
  const address = page.url();
  const ben = await another(browser, address);
  await joinAs(ben, "Ben");
  await expect(people(page)).toHaveCount(2);

  await pick(page, "Wand löschen");
  const dialog = page.locator("#app-dlg-delete");
  await expect(dialog).toContainText(`„${QUESTION}“ wird für alle gelöscht`);
  await dialog.locator('button[value="confirm"]').click();
  await expect(heading(page)).toHaveText("Wand gelöscht");
  await expect(heading(ben)).toHaveText("Wand gelöscht");
  // the browsers have dropped the wall from the ones they know, and the moderation its token
  expect(await stored(page)).toEqual([]);
  expect(await stored(ben)).toEqual([]);
  expect(await storedTokens(page)).not.toHaveProperty(wall.wallId);

  // whoever opens the address now finds no wall
  const late = await another(browser, address);
  await expect(heading(late)).toHaveText("Unbekannte Wand");
  await ben.context().close();
  await late.context().close();
});

test("the link to the wall is copied by its key, which says so in itself", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await enter(page);
  // the key in the wall's head; while nobody else has come, the wall says at its top to send the link around, and
  // offers the same link right there
  const linkKey = head(page).getByRole("button", { name: "Link kopieren", exact: true });
  await expect(page.locator(".app-state")).toContainText("Du moderierst: Schick den Link an dein Team");
  await expect(main(page).getByRole("button", { name: "Link kopieren", exact: true })).toBeVisible();
  await linkKey.click();
  await expect(head(page).getByRole("button", { name: "Kopiert", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  // after two seconds the key is itself again; no toast was shown
  await expect(linkKey).toBeVisible({ timeout: 4000 });
  await expect(page.locator("#app-toast")).toBeHidden();
});

test("the moderation link moves the moderation to another browser: the token is stored, leaves the address at once and is in no request's address", async ({
  page,
  context,
  browser,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const wallId = await makeAndJoin(page, "Anna");
  const origin = new URL(page.url()).origin;

  // the moderation copies its link: the wall's address, and behind `#` the token this browser keeps
  await pick(page, "Moderationslink kopieren");
  // no key stays to say „Kopiert“: a toast does, and says what the link is good for
  await expect(page.locator("#app-toast")).toContainText("Moderationslink kopiert. Wer ihn hat, moderiert diese Wand");
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const token = (await storedTokens(page))[wallId] ?? "";
  expect(token).toMatch(/^[0-9a-f]{32}$/);
  expect(link).toBe(`${origin}/w/${wallId}#admin=${token}`);

  // another device opens the link
  const other = await browser.newContext();
  const seen = record(other);
  const mia = await other.newPage();
  await mia.goto(link);
  // the token is out of the address bar as soon as the page stands, and in this browser's storage
  expect(await mia.evaluate(() => location.href)).toBe(`${origin}/w/${wallId}`);
  await expect(mia).toHaveURL(`${origin}/w/${wallId}`);
  expect(await storedTokens(mia)).toEqual({ [wallId]: token });

  await joinAs(mia, "Mia");
  // Mia moderates: both see it, and she can do what the moderation can
  await expect(people(mia)).toHaveText(["AAnnaModerationda", "MMia (du)Moderationda"]);
  await expect(people(page)).toHaveText(["AAnna (du)Moderationda", "MMiaModerationda"]);
  await expect(row(mia, "Wand löschen")).toHaveCount(1);
  await expect(row(mia, "Moderationslink kopieren")).toHaveCount(1);
  // a reload keeps the right: the token is stored, not the address
  await mia.reload();
  await expect(people(mia)).toHaveText(["AAnnaModerationda", "MMia (du)Moderationda"]);
  await expect(mia).toHaveURL(`${origin}/w/${wallId}`);

  // the token went out in the join alone: in a frame of the socket, never in an address
  expect(seen.asked.length).toBeGreaterThan(5);
  expect(seen.asked.filter((address) => address.includes(token))).toEqual([]);
  const carried = seen.frames.filter((frame) => frame.includes(token));
  expect(carried.length).toBeGreaterThan(0);
  for (const frame of carried) expect(JSON.parse(frame)).toMatchObject({ type: "join", adminToken: token });
  await other.close();
});

test("the moderation link pasted over the wall's own address makes a member the moderation, without a reload", async ({
  page,
  browser,
}) => {
  const wall = await enter(page);
  const address = page.url();
  const ben = await another(browser, address);
  await joinAs(ben, "Ben");
  await expect(people(ben)).toHaveText(["AAnnaModerationda", "BBen (du)da"]);
  await ben.evaluate(() => ((window as unknown as { marker: number }).marker = 1));

  // only the fragment changes: the browser loads nothing
  await ben.goto(`${address}#admin=${wall.adminToken}`);
  await expect(people(ben)).toHaveText(["AAnnaModerationda", "BBen (du)Moderationda"]);
  await expect(people(page)).toHaveText(["AAnna (du)Moderationda", "BBenModerationda"]);
  await expect(row(ben, "Wand löschen")).toHaveCount(1);
  await expect(ben).toHaveURL(address);
  expect(await ben.evaluate(() => location.hash)).toBe("");
  expect(await ben.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  expect(await storedTokens(ben)).toEqual({ [wall.wallId]: wall.adminToken });
  await ben.context().close();
});

test("a link with a token that is not the wall's joins like everybody else, and leaves the address all the same", async ({
  page,
  browser,
}) => {
  await enter(page);
  const address = page.url();
  const wrong = randomBytes(16).toString("hex");
  const ben = await another(browser, `${address}#admin=${wrong}`);
  expect(await ben.evaluate(() => location.href)).toBe(address);
  await joinAs(ben, "Ben");
  await expect(people(ben)).toHaveText(["AAnnaModerationda", "BBen (du)da"]);
  await expect(row(ben, "Wand löschen")).toHaveCount(0);
  await expect(row(ben, "Moderationslink kopieren")).toHaveCount(0);

  // a token cut short when it was pasted is taken out too, and stored nowhere
  const late = await another(browser, `${address}#admin=${wrong.slice(0, 20)}`);
  expect(await late.evaluate(() => location.href)).toBe(address);
  expect(await storedTokens(late)).toEqual({});
  await ben.context().close();
  await late.context().close();
});

test("no request goes to another origin while a wall is made, joined by a second browser and deleted", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const seen = [record(first), record(second)];
  const anna = await first.newPage();
  const ben = await second.newPage();

  // made: the start, the form, the wall's door, the wall
  await makeAndJoin(anna, "Anna");
  const address = anna.url();
  // joined by a second browser, which also looks around: the places of the frame, the licences, a legal page
  await ben.goto(address);
  await joinAs(ben, "Ben");
  await expect(people(anna)).toHaveCount(2);
  for (const path of ["/", "/waende", "/einstellungen", "/lizenzen", "/datenschutz", "/barrierefreiheit"]) {
    await ben.goto(path);
    await ben.waitForLoadState("networkidle");
  }
  await ben.goto(address);
  await expect(people(ben)).toHaveCount(2);
  // deleted
  await pick(anna, "Wand löschen");
  await anna.locator('#app-dlg-delete button[value="confirm"]').click();
  await expect(heading(anna)).toHaveText("Wand gelöscht");
  await expect(heading(ben)).toHaveText("Wand gelöscht");
  await anna.waitForLoadState("networkidle");
  await ben.waitForLoadState("networkidle");

  const own = new URL(address).host;
  const foreign = (to: string) => new URL(to).host !== own;
  const asked = seen.flatMap(({ asked }) => asked);
  // the record is no empty one: the pages, the Worker and the wall's socket are in it
  expect(asked).toContain(address);
  expect(asked.some((to) => new URL(to).pathname === "/api/walls")).toBe(true);
  expect(asked.filter((to) => to.startsWith("ws://") && to.endsWith("/ws")).length).toBeGreaterThanOrEqual(2);
  expect(asked.length).toBeGreaterThan(20);
  expect(asked.filter(foreign)).toEqual([]);
  await first.close();
  await second.close();

  // and the record is not blind: an address of another origin, asked by a browser recorded the same way, stands in
  // it (the same machine under its other name; whether anything answers there does not matter)
  const third = await browser.newContext();
  const probe = record(third);
  await (await third.newPage()).goto(`http://localhost:${new URL(address).port}/`).catch(() => undefined);
  expect(probe.asked.filter(foreign)).not.toEqual([]);
  await third.close();
});

test("a wall nobody is on shows its door to whoever has the address, also made elsewhere", async ({ page }) => {
  // made by a request of the page, as another browser's would be: this one holds no token and knows no name
  const { wallId } = await makeWall(page);
  await page.goto(`/w/${wallId}`);
  await expect(heading(page)).toHaveText(QUESTION);
  await joinAs(page, "Ben");
  await expect(people(page)).toHaveText(["BBen (du)da"]);
  await expect(row(page, "Wand löschen")).toHaveCount(0);
});

test("a wall leaves the list of this device after a question; a wall this device moderates says what else goes", async ({
  page,
}) => {
  await page.goto("/");
  const [first, ...rest] = KNOWN;
  await know(page, [{ ...first!, adminToken: "0".repeat(32) }, ...rest]);
  await page.goto("/waende");
  const rows = main(page).locator("ul.sb-list > li");
  await expect(rows).toHaveCount(2);
  const dialog = page.locator("#app-dlg-wall");
  const ask = async (question: string) => {
    await page.getByRole("button", { name: `Mehr zu „${question}“`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Aus der Liste entfernen", exact: true }).click();
  };

  await ask(LONG_QUESTION);
  await expect(dialog).toContainText("verschwindet aus der Liste dieses Geräts.");
  await expect(dialog).not.toContainText("moderiert die Wand nicht mehr");
  // not yet: the question can be taken back
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(rows).toHaveCount(2);

  await ask(LONG_QUESTION);
  await dialog.getByRole("button", { name: "Entfernen" }).click();
  await expect(rows).toHaveCount(1);
  expect(await stored(page)).toEqual([QUESTION]);

  // the wall this device moderates: the token goes with it
  await ask(QUESTION);
  await expect(dialog).toContainText("und es moderiert die Wand nicht mehr");
  await dialog.getByRole("button", { name: "Entfernen" }).click();
  await expect(heading(page)).toHaveText("Meine Wände");
  await expect(main(page)).toContainText("Noch keine Wände");
  expect(await stored(page)).toEqual([]);
  expect(await storedTokens(page)).toEqual({});
});

test("a row of the list still opens its wall: the row's menu stands above the row's link, not in its way", async ({
  page,
}) => {
  const wall = await enter(page);
  await page.goto("/waende");
  const first = main(page).locator("ul.sb-list > li").first();
  // a press on the row beside its menu, where only the link's face is
  await first.click({ position: { x: 24, y: 24 } });
  await expect(page).toHaveURL(new RegExp(`/w/${wall.wallId}$`));
  await expect(heading(page)).toHaveText(QUESTION);
});
