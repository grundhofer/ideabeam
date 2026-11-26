// „Eigener Schlüssel“ with real browsers (PLAN.md, stage 4b): the moderation enters a key of its own for an AI
// provider, and „Ordnen“ then asks that provider straight from the moderation's browser. No test here reaches a
// provider: each one's address is answered by the test (`page.route`), with the answers of the stand-in that puts
// notes together that begin with the same word (packages/arrange/src/fake.ts), in the shape that provider answers
// in. The key of these tests is no provider's.
//
// The acceptance test of the stage is here: with a key set, a whole run with „Anwenden“ and „Rückgängig“ sends the
// key in no request to the app's own origin and in no frame of a wall's socket, and stores nothing about it. It
// reads every request and every frame itself.
//
// The providers are not measured yet, so nobody is offered them (PLAN.md 7.2, no. 20): the tests switch them on
// for their tab, as the owner does to try his own key (src/lib/key-switch.ts).
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type Request as Asked,
  type Route,
} from "@playwright/test";
import { fakeAsk, PROVIDERS, type ModelRequest } from "@ideabeam/arrange";
import { enter, offerOwnKey, openMore, openOwnKey, takeOwnKey, writeNote } from "./app";
import { collectCut, sidewaysScroll, viewFaults } from "./sebaro-checks";

test.use({ reducedMotion: "reduce", colorScheme: "light", viewport: { width: 1440, height: 1000 } });

/** A key of the tests: no provider's, and a string that is recognised wherever it turns up. */
const KEY = "ideabeam-test-key-7f3a9c1e5b2d8a4f6c0e";
const ARRANGE = /\/api\/walls\/[0-9a-f]{64}\/arrange$/;

type Name = "Mistral" | "OpenAI" | "Anthropic";
const URLS: Record<Name, string> = {
  Mistral: "https://api.eu.mistral.ai/v1/chat/completions",
  OpenAI: "https://api.openai.com/v1/chat/completions",
  Anthropic: "https://api.anthropic.com/v1/messages",
};
/** Every address of a provider, whatever its path. */
const PROVIDER = /^https:\/\/(api\.eu\.mistral\.ai|api\.openai\.com|api\.anthropic\.com)\//;

/** Eight notes that begin with two words, five and three: the stand-in makes the groups „Termine“ and „Werkzeuge“
 *  of them (as in arrange.spec.ts). */
const EIGHT = [
  "Termine ohne Ergebnis",
  "Werkzeuge, die niemand erklärt hat",
  "Termine, die eine Mail sein könnten",
  "Werkzeuge wechseln jedes halbe Jahr",
  "Termine zur selben Zeit in zwei Teams",
  "Termine ohne Protokoll",
  "Termine am Freitagnachmittag",
  "Werkzeuge: der Build dauert zu lange",
];

const sentence = (page: Page) => page.locator(".app-state__sentence");
const guide = (page: Page) => page.locator(".app-state__note");
const said = (page: Page) => page.locator("main p.sb-visually-hidden[role=status]");
const problem = (page: Page) => page.locator(".app-surface__problem");
const zone = (page: Page) => page.locator(".sb-bottom-block");
const primary = (page: Page) => page.locator(".sb-primary-action");
const button = (page: Page, name: string) => zone(page).getByRole("button", { name, exact: true });
const undo = (page: Page) => page.getByRole("button", { name: "Ordnen rückgängig machen", exact: true });
const hints = (page: Page) => zone(page).locator(".sb-action-hint");
const more = (page: Page) => page.locator("[data-sb-web-app-head] [aria-haspopup=menu]");

// ───────────────────────── the providers of the test ─────────────────────────

/** What a browser needs on an answer from another origin to let the page read it. */
const READABLE = { "access-control-allow-origin": "*", "content-type": "application/json" };

type Body = Record<string, unknown>;
/** The question in a provider's request, as the package's request, and the step of a run it belongs to. */
function questionOf(provider: Name, body: Body): { request: ModelRequest; step: "themes" | "assign" } {
  const messages = body.messages as Array<{ content: string }>;
  const [system, user, schema] =
    provider === "Anthropic"
      ? [
          String(body.system),
          messages[0]?.content ?? "",
          (body.output_config as { format: { schema: Body } }).format.schema,
        ]
      : [
          messages[0]?.content ?? "",
          messages[1]?.content ?? "",
          (body.response_format as { json_schema: { schema: Body } }).json_schema.schema,
        ];
  return {
    request: { system, user, schema, maxTokens: 0 },
    step: "themes" in (schema.properties as object) ? "themes" : "assign",
  };
}
/** What a provider's model answers to a request: the stand-in's answer, in that provider's shape. */
async function answerOf(provider: Name, body: Body): Promise<Body> {
  const { request, step } = questionOf(provider, body);
  const { content } = await fakeAsk(request, step);
  if (provider === "Anthropic") {
    return {
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: body.model,
      content: [{ type: "text", text: content }],
      stop_reason: "end_turn",
      stop_details: null,
      usage: { input_tokens: 100, output_tokens: 20 },
    };
  }
  return {
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  };
}

type Call = { url: string; method: string; headers: Record<string, string>; body: Body };
/** Puts the test in a provider's place. Every call is recorded; `instead` may answer one itself (true: it did),
 *  else the stand-in answers as a model would. Returns the calls made so far. */
async function serve(page: Page, provider: Name, instead?: (route: Route, call: Call, n: number) => Promise<boolean>) {
  const calls: Call[] = [];
  await page.route(URLS[provider], async (route) => {
    const request = route.request();
    const call = {
      url: request.url(),
      method: request.method(),
      headers: await request.allHeaders(),
      body: request.postDataJSON() as Body,
    };
    calls.push(call);
    if (instead !== undefined && (await instead(route, call, calls.length))) return;
    await route.fulfill({ status: 200, headers: READABLE, json: await answerOf(provider, call.body) });
  });
  return calls;
}
/** An error answer as a provider sends it, readable by the page. */
const refuse = (route: Route, status: number, json: unknown) => route.fulfill({ status, headers: READABLE, json });

// ───────────────────────── the wall of the test ─────────────────────────

/** On an open wall with the eight notes, as its moderation, in a tab that offers the providers. */
async function onEight(page: Page, view: "surface" | "list" = "surface") {
  const wall = await enter(page, { hidden: false, notes: EIGHT, view });
  await offerOwnKey(page);
  return wall;
}

/** Every frame the wall's socket of a page received, as it came; the heartbeat's answer left out. To be called
 *  before the page goes to the wall. */
function received(page: Page): string[] {
  const frames: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framereceived", (frame) => {
      const text = String(frame.payload);
      if (text !== "pong") frames.push(text);
    });
  });
  return frames;
}
/** Every frame any socket of a page sends, as it goes out; the heartbeat left out. */
function sent(page: Page): string[] {
  const frames: string[] = [];
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => {
      if (frame.payload !== "ping") frames.push(String(frame.payload));
    }),
  );
  return frames;
}
const typesOf = (frames: string[]) => frames.map((frame) => (JSON.parse(frame) as { type: string }).type);

/** Another person in a browser of their own, on the wall under a name; their socket's frames are recorded. */
async function another(browser: Browser, address: string, name: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const frames = received(page);
  await page.goto(address);
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-surface__ground, .app-list").waitFor();
  return { page, frames };
}

/** Where every note lies on a page's surface, by its id: the places the app wrote. */
const placesOf = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>(".app-note[data-note]")].map((el) => [
        el.dataset.note ?? "",
        `${el.style.left} ${el.style.top}`,
      ]),
    ),
  );
const groupsOf = (page: Page) => page.locator(".app-group[data-group]");
/** What the browser has stored: every entry of both storages, and its cookies. */
const storedIn = (page: Page) =>
  page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }));

/** Presses Tab until the element has the focus (at most 60 presses). */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${String(target)}`);
}

// ───────────────────────── who is offered a key ─────────────────────────

test("no provider is measured yet: nobody is offered „Eigener KI-Schlüssel“ unless the tab was told to", async ({
  page,
  browser,
}) => {
  // the list the app is built with: the moment a provider's model is measured, this test has to change with it
  expect(PROVIDERS.map((provider) => provider.measured)).toEqual([false, false, false]);
  await enter(page, { hidden: false, notes: EIGHT });
  // the moderation's „Mehr“ without the switch: the moderation link, the choices of appearance, what deletes
  let menu = await openMore(page);
  await expect(menu.row("Moderationslink kopieren")).toBeVisible();
  await expect(menu.menu.getByRole("menuitem", { name: /Schlüssel/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // and the wall says nothing about a key
  await expect(hints(page).first()).toContainText("Cloudflares KI-Dienst Workers AI");
  await expect(page.getByText(/Schlüssel/)).toHaveCount(0);

  // the switch: a part of the address's fragment. It is taken out of the address at once
  await page.evaluate(() => {
    location.hash = "eigener-schluessel";
  });
  await expect(page).toHaveURL(/\/w\/[0-9a-f]{64}$/);
  menu = await openMore(page);
  await expect(menu.row("Eigener KI-Schlüssel …")).toBeVisible();
  // it stands with the moderation's own entries, before the choices of appearance
  await expect(menu.menu.getByRole("menuitem").nth(0)).toHaveText("Moderationslink kopieren");
  await expect(menu.menu.getByRole("menuitem").nth(1)).toHaveText("Eigener KI-Schlüssel …");
  await page.keyboard.press("Escape");
  // it is stored nowhere: not in the browser's storages, and not in the address the tab now shows
  const stored = await storedIn(page);
  expect(JSON.stringify(stored)).not.toMatch(/schluessel|unlocked/i);

  // somebody who does not moderate never has the entry, with the switch or without
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cem = await context.newPage();
  await cem.goto(`${page.url()}#eigener-schluessel`);
  await cem.fill("#app-f-as", "Cem");
  await cem.locator('#app-form button[type="submit"]').click();
  await cem.locator(".app-surface__ground, .app-list").waitFor();
  await expect(cem).toHaveURL(/\/w\/[0-9a-f]{64}$/);
  const cems = await openMore(cem);
  await expect(cems.menu.getByRole("menuitem", { name: /Schlüssel/ })).toHaveCount(0);
  await context.close();

  // a reload forgets the switch: the entry is gone again
  await page.reload();
  await expect(page.locator(".app-note[data-note]")).toHaveCount(8);
  menu = await openMore(page);
  await expect(menu.menu.getByRole("menuitem", { name: /Schlüssel/ })).toHaveCount(0);
  // opened with the switch in its address, a wall offers the entry from its first moment, and the address the tab
  // shows is the wall's own again
  await page.keyboard.press("Escape");
  const wall = page.url();
  await page.goto("/");
  await page.goto(`${wall}#eigener-schluessel`);
  await expect(page.locator(".app-note[data-note]")).toHaveCount(8);
  expect(page.url()).toBe(wall);
  menu = await openMore(page);
  await expect(menu.row("Eigener KI-Schlüssel …")).toBeVisible();
});

// ───────────────────────── the dialog ─────────────────────────

test("the dialog says what each provider does with the notes and that the key stays in this tab; a key is entered, never shown again, and removed", async ({
  page,
}) => {
  await onEight(page);
  const dialog = await openOwnKey(page);
  await expect(dialog.locator(".sb-dialog__title")).toHaveText("Eigener KI-Schlüssel");
  await expect(dialog.locator(".sb-dialog__text")).toHaveText(
    "Mit einem eigenen Schlüssel fragt „Ordnen“ deinen KI-Anbieter direkt aus diesem Browser, nicht Cloudflare. Der Schlüssel bleibt in diesem Tab: Nach dem Neuladen ist er weg, und den Server von IdeaBeam erreicht er nie. Was das Ordnen kostet, berechnet der Anbieter deinem Konto dort.",
  );
  // the providers, each with what it does with the notes, what a wall costs, and that it is not measured yet
  await expect(dialog.getByRole("radio")).toHaveCount(3);
  await expect(dialog.locator(".app-choice .sb-radio")).toHaveText(["Mistral", "OpenAI", "Anthropic"]);
  await expect(dialog.locator(".app-choice__note")).toHaveText([
    "Zettel: laut Mistral in Rechenzentren in der EU und der EFTA, dort bis zu 30 Tage gespeichert, Training je nach Einstellung deines Kontos dort. Kosten: nach Preisliste rund 0,35 US-Cent für eine Wand mit 250 Zetteln. Wie gut Mistral ordnet, ist noch nicht gemessen.",
    "Zettel: ohne zugesagten Ort, dort bis zu 30 Tage gespeichert (auffällige Inhalte länger), laut OpenAI nicht zum Training genutzt. Kosten: nach Preisliste rund 0,23 US-Cent für eine Wand mit 250 Zetteln. Wie gut OpenAI ordnet, ist noch nicht gemessen.",
    "Zettel: ohne zugesagten Ort, dort bis zu 30 Tage gespeichert (auffällige Inhalte länger), laut Anthropic nicht zum Training genutzt. Kosten: nach Preisliste rund 12 US-Cent für eine Wand mit 250 Zetteln. Wie gut Anthropic ordnet, ist noch nicht gemessen.",
  ]);
  // a screen reader hears every provider's line with its row; on the screen the chosen provider's line shows,
  // under the rows, which so keep their places
  const mistral = dialog.getByRole("radio", { name: "Mistral", exact: true });
  await expect(mistral).toHaveAccessibleDescription(/^Zettel: laut Mistral in Rechenzentren in der EU/);
  await expect(dialog.getByRole("radio", { name: "Anthropic", exact: true })).toHaveAccessibleDescription(
    /^Zettel: ohne zugesagten Ort, .* laut Anthropic nicht zum Training genutzt\. .* rund 12/,
  );
  await expect(dialog.locator(".app-choice__note:visible")).toHaveText([/^Zettel: laut Mistral /]);
  // it opens on the first provider, with the focus on the choice
  await expect(mistral).toBeChecked();
  await expect(mistral).toBeFocused();
  // the field: a password field that no browser fills in and nothing echoes
  const field = dialog.getByLabel("Schlüssel", { exact: true });
  await expect(field).toHaveAttribute("type", "password");
  await expect(field).toHaveAttribute("autocomplete", "off");
  await expect(field).toHaveValue("");
  // the way to the provider's page follows the choice, and leaves the app in a tab of its own
  const link = dialog.getByRole("link");
  await expect(link).toHaveText("Schlüssel bei Mistral anlegen");
  await expect(link).toHaveAttribute("href", "https://docs.mistral.ai/admin/identity-access/api-keys");
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("radio", { name: "OpenAI", exact: true })).toBeChecked();
  await expect(dialog.locator(".app-choice__note:visible")).toHaveText([/^Zettel: ohne zugesagten Ort, .* OpenAI /]);
  await expect(link).toHaveText("Schlüssel bei OpenAI anlegen");
  await expect(link).toHaveAttribute("href", "https://platform.openai.com/api-keys");
  await page.keyboard.press("ArrowDown");
  await expect(link).toHaveAttribute("href", "https://platform.claude.com/settings/keys");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noreferrer");
  // the two actions, and under „Übernehmen“ where the key goes
  await expect(dialog.locator(".sb-dialog__actions button")).toHaveText(["Abbrechen", "Übernehmen"]);
  await expect(dialog.locator(".sb-dialog__actions .sb-action-hint")).toHaveText("Bleibt in diesem Tab.");
  await expect(dialog.getByRole("button", { name: "Schlüssel entfernen" })).toHaveCount(0);

  // „Übernehmen“ without a key: the dialog stays, and the field says what is missing
  await dialog.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".sb-field__error")).toHaveText("Schlüssel fehlt.");
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  // a key that was not copied whole: Enter in the field means „Übernehmen“, and the field says what is wrong
  await field.fill("zwei teile");
  await expect(dialog.locator(".sb-field__error")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".sb-field__error")).toHaveText(
    "Im Schlüssel stehen Leerzeichen oder Zeichen, die in keinem Schlüssel vorkommen. Kopier ihn noch mal.",
  );
  // put away with Escape: nothing is taken, and the focus is back on „Mehr“
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(more(page)).toBeFocused();
  await expect(hints(page).first()).toContainText("Cloudflares KI-Dienst Workers AI");

  // a key for Mistral, with spaces around it from copying: Enter in the field takes it
  const again = await openOwnKey(page);
  await again.getByLabel("Schlüssel", { exact: true }).fill(`  ${KEY} `);
  await page.keyboard.press("Enter");
  await expect(again).toBeHidden();
  await expect(more(page)).toBeFocused();
  await expect(said(page)).toHaveText("Schlüssel übernommen. „Ordnen“ fragt jetzt Mistral.");
  // the wall says quietly who „Ordnen“ asks now and how to go back, and the line under „Ordnen“ names the provider
  await expect(guide(page).last()).toHaveText(
    "„Ordnen“ fragt Mistral, mit deinem Schlüssel. Entfernst du ihn unter „Mehr“, ordnet wieder Cloudflare. Wie gut Mistral ordnet, ist noch nicht gemessen.",
  );
  await expect(hints(page)).toHaveText([
    "„Ordnen“ schickt die Frage und die Texte der Zettel, ohne Namen, mit deinem Schlüssel direkt aus diesem Browser an Mistral: laut Mistral in Rechenzentren in der EU und der EFTA, dort bis zu 30 Tage gespeichert, Training je nach Einstellung deines Kontos dort. Mehr unter Datenschutz.",
    "Ein neuer Zettel geht an den Server von IdeaBeam in der EU. Alle auf der Wand sehen ihn.",
  ]);
  await expect(hints(page).first().getByRole("link", { name: "Datenschutz" })).toHaveAttribute(
    "href",
    "/datenschutz#eigener-ki-schluessel",
  );
  // the key is nowhere in the page: not in a field, not in the markup, not in the address, not in a storage
  expect(await page.content()).not.toContain(KEY);
  expect(
    await page.evaluate(() => [...document.querySelectorAll("input")].map((input) => input.value).join()),
  ).not.toContain(KEY);
  expect(page.url()).not.toContain(KEY);
  expect(JSON.stringify(await storedIn(page))).not.toContain(KEY);

  // opened again: the dialog says for whom a key is set, on that provider, with an empty field, and offers to
  // remove it
  const set = await openOwnKey(page);
  await expect(set.locator(".app-key__set")).toHaveText(
    "Für Mistral ist ein Schlüssel eingetragen.Schlüssel entfernen",
  );
  await expect(set.getByRole("radio", { name: "Mistral", exact: true })).toBeChecked();
  await expect(set.getByLabel("Schlüssel", { exact: true })).toHaveValue("");
  await expect(set.locator(".sb-field__help")).toHaveText("Ein neuer Schlüssel ersetzt den eingetragenen.");
  expect(await page.content()).not.toContain(KEY);
  // another provider's key takes its place
  await set.getByRole("radio", { name: "Anthropic", exact: true }).check();
  await set.getByLabel("Schlüssel", { exact: true }).fill(KEY);
  await set.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(said(page)).toHaveText("Schlüssel übernommen. „Ordnen“ fragt jetzt Anthropic.");
  await expect(hints(page).first()).toContainText(
    "direkt aus diesem Browser an Anthropic: ohne zugesagten Ort, dort bis zu 30 Tage gespeichert (auffällige Inhalte länger), laut Anthropic nicht zum Training genutzt.",
  );

  // „Schlüssel entfernen“: at once, and „Ordnen“ asks Cloudflare again
  const last = await openOwnKey(page);
  await expect(last.locator(".app-key__set")).toContainText("Für Anthropic ist ein Schlüssel eingetragen.");
  await last.getByRole("button", { name: "Schlüssel entfernen", exact: true }).click();
  await expect(last).toBeHidden();
  await expect(more(page)).toBeFocused();
  await expect(said(page)).toHaveText("Schlüssel entfernt. „Ordnen“ fragt wieder Cloudflare.");
  await expect(hints(page).first()).toContainText("Cloudflares KI-Dienst Workers AI");
  await expect(page.getByText(/mit deinem Schlüssel/)).toHaveCount(0);
});

test("a reload forgets the key: „Ordnen“ asks Cloudflare again, and nothing of the key was kept", async ({ page }) => {
  await onEight(page);
  await takeOwnKey(page, "OpenAI", KEY);
  await expect(hints(page).first()).toContainText("an OpenAI:");
  await page.reload();
  await expect(page.locator(".app-note[data-note]")).toHaveCount(8);
  await expect(hints(page).first()).toContainText("Cloudflares KI-Dienst Workers AI");
  await expect(page.getByText(/mit deinem Schlüssel/)).toHaveCount(0);
  expect(JSON.stringify(await storedIn(page))).not.toContain(KEY);
});

test("the dialog in English, and the line under “Group notes”", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("sb-lang", "en"));
  await onEight(page);
  await more(page).click();
  await page.locator("#app-more").getByRole("menuitem", { name: "Own AI key …", exact: true }).click();
  const dialog = page.locator("#app-dlg-key");
  await expect(dialog.locator(".sb-dialog__text")).toHaveText(
    "With a key of your own, “Group notes” asks your AI provider straight from this browser, not Cloudflare. The key stays in this tab: after a reload it is gone, and it never reaches the server of IdeaBeam. What grouping costs is billed by the provider to your account there.",
  );
  await expect(dialog.locator(".app-choice__note")).toHaveText([
    "Notes: in data centers in the EU and EFTA, according to Mistral, stored there for up to 30 days, training depends on your account’s setting there. Cost: by the price list about 0.35 US cents for a wall of 250 notes. How well Mistral groups notes has not been measured yet.",
    "Notes: no place promised, stored there for up to 30 days (flagged content longer), not used for training, according to OpenAI. Cost: by the price list about 0.23 US cents for a wall of 250 notes. How well OpenAI groups notes has not been measured yet.",
    "Notes: no place promised, stored there for up to 30 days (flagged content longer), not used for training, according to Anthropic. Cost: by the price list about 12 US cents for a wall of 250 notes. How well Anthropic groups notes has not been measured yet.",
  ]);
  await dialog.getByRole("radio", { name: "OpenAI", exact: true }).check();
  await dialog.getByLabel("Key", { exact: true }).fill(KEY);
  await dialog.getByRole("button", { name: "Use key", exact: true }).click();
  await expect(said(page)).toHaveText("Key taken. “Group notes” now asks OpenAI.");
  await expect(hints(page).first()).toHaveText(
    "“Group notes” sends the question and the texts of the notes, without names, with your key straight from this browser to OpenAI: no place promised, stored there for up to 30 days (flagged content longer), not used for training, according to OpenAI. More under Privacy.",
  );
  await expect(guide(page).last()).toHaveText(
    "“Group notes” asks OpenAI, with your key. Remove it under “More”, and Cloudflare groups again. How well OpenAI groups notes has not been measured yet.",
  );
  // the request names the language the app shows: the themes' titles are asked for in English
  const calls = await serve(page, "OpenAI");
  await button(page, "Group notes").click();
  await expect(sentence(page)).toHaveText("The AI’s proposal: 2 groups. Only you see it.");
  expect((calls[0]?.body.messages as Array<{ content: string }>)[0]?.content).toContain("Always answer in English");
});

// ───────────────────────── a run with each provider ─────────────────────────

for (const provider of ["Mistral", "OpenAI", "Anthropic"] as const) {
  test(`with a key for ${provider}, „Ordnen“ asks ${provider} from this browser and not the app's server; preview, „Anwenden“ and „Rückgängig“ go as ever, and the others get the arrangement as the moderation's own`, async ({
    page,
    browser,
  }) => {
    const calls = await serve(page, provider);
    const toOwnServer: string[] = [];
    page.on("request", (request) => {
      if (ARRANGE.test(request.url())) toOwnServer.push(request.url());
    });
    const { adminToken, wallId } = await onEight(page);
    const cem = await another(browser, page.url(), "Cem");
    await expect(cem.page.locator(".app-note[data-note]")).toHaveCount(8);
    await expect(sentence(page)).toHaveText("8 Zettel. 2 Personen sind da.");
    await takeOwnKey(page, provider, KEY);
    const before = await placesOf(page);
    const cemFrames = cem.frames.length;

    // ── „Ordnen“: the provider is asked, twice: for the themes, and for the eight notes ──
    await button(page, "Ordnen").click();
    await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
    expect(calls).toHaveLength(2);
    expect(toOwnServer).toEqual([]);
    for (const call of calls) {
      expect(call.url).toBe(URLS[provider]);
      expect(call.method).toBe("POST");
      // the key, in the one header the provider reads it from
      expect(call.headers.authorization).toBe(`Bearer ${KEY}`);
      expect(call.headers["content-type"]).toBe("application/json");
      // the wall's address is the right to join it: no call says where it came from beyond the app's origin
      expect(call.headers).not.toHaveProperty("referer");
      expect(call.headers).not.toHaveProperty("cookie");
      expect(new URL(call.headers.origin ?? "").pathname).toBe("/");
      // nothing of the wall's two secrets, and no name, goes to the provider
      const whole = JSON.stringify(call);
      expect(whole).not.toContain(adminToken);
      expect(whole).not.toContain(wallId);
      expect(whole).not.toMatch(/Anna|Ben|Cem/);
      // the key is in that header and nowhere else of the call
      expect(JSON.stringify({ ...call, headers: { ...call.headers, authorization: "" } })).not.toContain(KEY);
    }
    const [themes, assign] = calls;
    // what the provider reads: the wall's question and the notes' texts
    expect(JSON.stringify(themes?.body)).toContain("Was hält uns bei der Arbeit auf?");
    for (const text of EIGHT) expect(JSON.stringify(themes?.body)).toContain(text.replaceAll('"', '\\"'));
    expect(JSON.stringify(assign?.body)).toContain("Assign every note");
    if (provider === "Anthropic") {
      // Anthropic's own client: the header its API demands of a page, its version, and the beta of the fallback
      expect(themes?.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
      expect(themes?.headers["anthropic-version"]).toBe("2026-10-21");
      expect(themes?.headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
      expect(themes?.body).toMatchObject({
        model: "claude-opus-5-5",
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema" } },
      });
      // the schema without the bounds the API refuses, and no sampling
      expect(JSON.stringify(themes?.body)).not.toMatch(/minItems|maxItems|temperature|"seed"/);
      expect(typeof themes?.body.system).toBe("string");
      // Every header the client sets itself, by name: what Anthropic learns beside the request. About the device it
      // says the browser's name and version, which the browser's own headers say too, and nothing else
      const set = Object.keys(themes?.headers ?? {}).filter((name) =>
        /^(authorization|content-type|x-|anthropic)/.test(name),
      );
      expect(set.sort()).toEqual([
        "anthropic-beta",
        "anthropic-dangerous-direct-browser-access",
        "anthropic-version",
        "authorization",
        "content-type",
        "x-stainless-arch",
        "x-stainless-lang",
        "x-stainless-os",
        "x-stainless-package-version",
        "x-stainless-retry-count",
        "x-stainless-runtime",
        "x-stainless-runtime-version",
        "x-stainless-timeout",
      ]);
      expect(themes?.headers).toMatchObject({
        "x-stainless-arch": "unknown",
        "x-stainless-os": "Unknown",
        "x-stainless-lang": "js",
        "x-stainless-retry-count": "0",
        "x-stainless-timeout": "60",
      });
      expect(themes?.headers["x-stainless-runtime"]).toMatch(/^browser:/);
    } else {
      // only the two headers the provider's preflight is known to allow, beside what a browser adds itself
      const own = Object.keys(themes?.headers ?? {}).filter((name) =>
        /^(authorization|content-type|x-|anthropic)/.test(name),
      );
      expect(own.sort()).toEqual(["authorization", "content-type"]);
      expect(themes?.body).toMatchObject({
        model: provider === "Mistral" ? "mistral-small-2603" : "gpt-6-luna",
        temperature: 0,
        reasoning_effort: "none",
        response_format: { type: "json_schema", json_schema: { name: "answer", strict: true } },
      });
      expect(JSON.stringify(themes?.body)).toContain('"minItems":2,"maxItems":2');
      expect(themes?.body).toHaveProperty(provider === "Mistral" ? "max_tokens" : "max_completion_tokens");
    }

    // ── the preview is the moderation's own, as with Cloudflare ──
    await expect(groupsOf(page)).toHaveText(["Termine", "Werkzeuge"]);
    await expect(primary(page)).toHaveText("Anwenden");
    await expect(button(page, "Verwerfen")).toBeVisible();
    expect(cem.frames.slice(cemFrames)).toEqual([]);
    await expect(groupsOf(cem.page)).toHaveCount(0);
    // the wall's runs at the Worker are not this run's: no line counts them
    await expect(page.getByText(/in 24 Stunden/)).toHaveCount(0);

    // ── „Anwenden“: the arrangement is everybody's, and the wall is told that the moderation's key made it ──
    await button(page, "Anwenden").click();
    await expect(groupsOf(cem.page)).toHaveCount(2);
    const applied = cem.frames.slice(cemFrames);
    expect(typesOf(applied)).toEqual(["arrange.applied"]);
    expect(JSON.parse(applied[0] ?? "{}")).toMatchObject({ type: "arrange.applied", source: "key" });
    for (const one of [page, cem.page]) {
      await expect(sentence(one)).toHaveText("8 Zettel in 2 Gruppen. 2 Personen sind da.");
      await expect(said(one)).toHaveText("Geordnet: 2 Gruppen.");
    }
    // nothing of the key reached Cem's browser
    expect(cem.frames.join("\n")).not.toContain(KEY);

    // ── „Rückgängig“: at once, and every note lies exactly where it lay ──
    await undo(page).click();
    await expect(groupsOf(cem.page)).toHaveCount(0);
    await expect(groupsOf(page)).toHaveCount(0);
    expect(await placesOf(page)).toEqual(before);
    expect(await placesOf(cem.page)).toEqual(before);
    expect(typesOf(cem.frames.slice(cemFrames))).toEqual(["arrange.applied", "arrange.undone"]);
    // the whole of it asked the provider twice and the app's own server not once
    expect(calls).toHaveLength(2);
    expect(toOwnServer).toEqual([]);
    await cem.page.context().close();
  });
}

// ───────────────────────── the acceptance test of the stage ─────────────────────────

test("ACCEPTANCE: with a key set, a whole run with „Anwenden“ and „Rückgängig“ sends the key in no request to the app's origin and in no frame of a socket, and stores nothing about it", async ({
  page,
  browser,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "").origin;
  // every request the page makes, to whomever, with every header and its whole body
  const requests: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const pending: Array<Promise<void>> = [];
  const record = (request: Asked) => {
    pending.push(
      request.allHeaders().then(
        (headers) => void requests.push({ url: request.url(), headers, body: request.postData() ?? "" }),
        () => undefined,
      ),
    );
  };
  page.on("request", record);
  // every frame of every socket, in both directions
  const out = sent(page);
  const back = received(page);
  await serve(page, "Mistral");
  await onEight(page);
  const cem = await another(browser, page.url(), "Cem");
  await expect(sentence(page)).toHaveText("8 Zettel. 2 Personen sind da.");
  const storedBefore = await storedIn(page);

  // ── the key is entered, and a whole run follows: „Ordnen“, „Anwenden“, „Rückgängig“ ──
  await takeOwnKey(page, "Mistral", KEY);
  const withKey = await storedIn(page);
  await button(page, "Ordnen").click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  const withPreview = await storedIn(page);
  await button(page, "Anwenden").click();
  await expect(groupsOf(cem.page)).toHaveCount(2);
  await expect(sentence(page)).toHaveText("8 Zettel in 2 Gruppen. 2 Personen sind da.");
  const afterApply = await storedIn(page);
  await undo(page).click();
  await expect(groupsOf(cem.page)).toHaveCount(0);
  // the wall goes on after it: a note is written, with the key still set
  await writeNote(page, "Pausen gemeinsam machen");
  await expect(cem.page.locator(".app-note[data-note]")).toHaveCount(9);
  const afterUndo = await storedIn(page);
  await Promise.all(pending);

  // ── the test did see what it claims to have read ──
  const own = requests.filter((request) => new URL(request.url).origin === origin);
  const toProvider = requests.filter((request) => PROVIDER.test(request.url));
  expect(own.length).toBeGreaterThan(10);
  expect(own.some((request) => /\/assets\/key-run-[\w-]+\.js$/.test(request.url))).toBe(true);
  expect(toProvider).toHaveLength(2);
  expect(typesOf(out)).toEqual(
    expect.arrayContaining(["join", "admin.arrange.apply", "admin.arrange.undo", "note.create"]),
  );
  expect(typesOf(back)).toEqual(expect.arrayContaining(["sync", "arrange.applied", "arrange.undone"]));
  // the key did go out: to the provider, in its header, and that is the only place of any request it is in
  for (const request of toProvider) {
    expect(request.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(request.url + request.body).not.toContain(KEY);
  }
  expect(requests.filter((request) => JSON.stringify(request).includes(KEY))).toEqual(toProvider);

  // ── no request to the app's own origin carries the key: not in its address, a header or its body ──
  for (const request of own) {
    expect(request.url, request.url).not.toContain(KEY);
    expect(JSON.stringify(request.headers), request.url).not.toContain(KEY);
    expect(request.body, request.url).not.toContain(KEY);
  }
  // and the app's own server was not asked to arrange at all
  expect(own.filter((request) => ARRANGE.test(request.url))).toEqual([]);
  // nobody but the app's origin and the provider was asked for anything
  expect(requests.filter((request) => new URL(request.url).origin !== origin && !PROVIDER.test(request.url))).toEqual(
    [],
  );

  // ── no frame of a socket carries the key, sent or received, here or in Cem's browser ──
  for (const frame of [...out, ...back, ...cem.frames]) expect(frame).not.toContain(KEY);
  // the frame that applied the arrangement says who made it, and that is all it says about the key
  const apply = JSON.parse(out.find((frame) => frame.includes('"admin.arrange.apply"')) ?? "{}") as Body;
  expect(apply.source).toBe("key");
  expect(JSON.stringify(apply)).not.toMatch(/mistral|bearer|authorization/i);

  // ── nothing about the key is stored: every storage holds the entries it held before, and none names the key or
  //    its provider ──
  for (const stored of [withKey, withPreview, afterApply, afterUndo]) {
    expect(Object.keys(stored.local).sort()).toEqual(Object.keys(storedBefore.local).sort());
    expect(stored.session).toEqual(storedBefore.session);
    expect(stored.cookies).toBe(storedBefore.cookies);
    expect(JSON.stringify(stored)).not.toContain(KEY);
    expect(JSON.stringify(stored)).not.toMatch(/mistral|eigener-schluessel|"own"|unlocked/i);
  }
  // nor is it in the address, in the page's markup or in a field
  expect(page.url()).not.toContain(KEY);
  expect(await page.content()).not.toContain(KEY);
  await cem.page.context().close();
});

// ───────────────────────── a run without a proposal ─────────────────────────

test("no proposal: a refused key, an account without credit, a rate limit, a provider that cannot be reached, an answer nothing can be made of, a request the provider does not take; each says what now, and the wall stays usable", async ({
  page,
}) => {
  let answer: "refused" | "credit" | "limited" | "cut" | "unreadable" | "unusable" | "rejected" | "real" = "refused";
  const calls = await serve(page, "OpenAI", async (route) => {
    if (answer === "refused") {
      // OpenAI's own words quote a part of the key: nothing of them may reach a sentence
      const message = `Incorrect API key provided: ${KEY.slice(-12)}*********. You can find your API key at https://platform.openai.com/account/api-keys.`;
      await refuse(route, 401, {
        error: { message, type: "invalid_request_error", param: null, code: "invalid_api_key" },
      });
    } else if (answer === "credit") {
      await refuse(route, 429, {
        error: { message: "…", type: "insufficient_quota", code: "credit_balance_exhausted" },
      });
    } else if (answer === "limited") {
      await refuse(route, 429, {
        error: { message: "Rate limit reached", type: "rate_limit_error", code: "rate_limit_exceeded" },
      });
    } else if (answer === "cut") await route.abort("connectionreset");
    // An error answer that the browser does not let the page read, as Scaleway's are (docs/ki-anbieter-4b.md): the
    // page sees a failed request and nothing of the 401. (Playwright adds the header that lets a page read an
    // answer where a test's answer has none, so this one allows another origin than the app's.)
    else if (answer === "unreadable") {
      const headers = { "access-control-allow-origin": "https://example.org", "content-type": "application/json" };
      await route.fulfill({ status: 401, headers, json: { error: { code: "invalid_api_key" } } });
    } else if (answer === "unusable") {
      await route.fulfill({
        status: 200,
        headers: READABLE,
        json: { choices: [{ message: { content: "Sure! Here you go." }, finish_reason: "stop" }] },
      });
    } else if (answer === "rejected") await refuse(route, 404, { error: { message: "…", code: "model_not_found" } });
    else return false;
    return true;
  });
  await onEight(page);
  await takeOwnKey(page, "OpenAI", KEY);
  const before = await placesOf(page);
  const ask = async () => {
    calls.length = 0;
    await button(page, "Ordnen").click();
  };

  // the key is refused: one call, no second try, and a sentence without a word of the provider's
  await ask();
  await expect(problem(page)).toHaveText(
    "OpenAI hat den Schlüssel abgelehnt. Trag ihn unter „Mehr“ neu ein: Vielleicht ist er unvollständig kopiert, abgelaufen oder für diesen Dienst nicht freigegeben.",
  );
  await expect(problem(page)).toHaveAttribute("role", "alert");
  expect(calls).toHaveLength(1);
  expect(await page.content()).not.toContain(KEY.slice(-12));
  expect(await page.content()).not.toContain("Incorrect API key");
  // the wall is as it was, and usable: a note is written, and the sentence goes with the new change
  await expect(primary(page)).toHaveText("Ordnen");
  await expect(primary(page)).not.toHaveAttribute("aria-busy", "true");
  await writeNote(page, "Pausen gemeinsam machen");
  await expect(problem(page)).toHaveText("");

  // no credit, or a limit of what the account may spend: told from a rate limit by OpenAI's code
  answer = "credit";
  await ask();
  await expect(problem(page)).toHaveText(
    "OpenAI hat nicht gerechnet: Das Konto hat kein Guthaben mehr, oder ein Ausgabenlimit ist erreicht. Lade dort Guthaben auf oder heb das Limit an. Von Hand ordnen geht immer.",
  );
  expect(calls).toHaveLength(1);

  // the provider limits the rate: the call is tried once more, then the sentence says to wait
  answer = "limited";
  await ask();
  await expect(problem(page)).toHaveText(
    "OpenAI nimmt gerade keine weiteren Anfragen an: zu viele in kurzer Zeit, oder der Dienst ist überlastet. Warte einen Moment und versuch es noch mal.",
  );
  expect(calls).toHaveLength(2);
  // the sentence can be put away by hand
  await problem(page).getByRole("button", { name: "Hinweis schließen" }).click();
  await expect(problem(page)).toHaveText("");

  // no answer at all; and an error answer the browser does not let the page read: the same from here
  for (const unreachable of ["cut", "unreadable"] as const) {
    answer = unreachable;
    await ask();
    await expect(problem(page)).toHaveText(
      "OpenAI war nicht zu erreichen, oder der Browser durfte die Antwort nicht lesen. Prüf die Verbindung und versuch es noch mal.",
    );
    expect(calls).toHaveLength(2);
  }

  // an answer that is no JSON
  answer = "unusable";
  await ask();
  await expect(problem(page)).toHaveText(
    "OpenAI hat keine brauchbare Antwort gegeben. Versuch es noch mal, oder ordnet von Hand.",
  );

  // the provider does not take the request itself: a model it does not know
  answer = "rejected";
  await ask();
  await expect(problem(page)).toHaveText(
    "OpenAI hat die Anfrage zurückgewiesen, nicht den Schlüssel. Das kann am Modell liegen, an der Form der Anfrage oder an einer Grenze deines Kontos dort. Ordnet von Hand, oder entferne den Schlüssel unter „Mehr“: Dann ordnet wieder Cloudflare.",
  );
  expect(calls).toHaveLength(1);

  // none of it moved a note; and once the provider answers, the same press gives a proposal
  const after = await placesOf(page);
  for (const [id, place] of Object.entries(before)) expect(after[id]).toEqual(place);
  answer = "real";
  await ask();
  // (nine notes by now, one of them about breaks: three groups)
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 3 Gruppen. Nur du siehst ihn.");
  await expect(problem(page)).toHaveText("");
});

test("Anthropic refuses to answer: a refusal comes as an answer with status 200, and is none; a refused key at Anthropic names the accounts that may not ask from a browser", async ({
  page,
}) => {
  let answer: "refusal" | "key" = "refusal";
  const calls = await serve(page, "Anthropic", async (route, call) => {
    if (answer === "key") {
      const error = { type: "authentication_error", message: "CORS requests are not allowed for this Organization" };
      await refuse(route, 401, { type: "error", error, request_id: "req_test" });
      return true;
    }
    // the classifier declined: status 200, how the message ended says it, and a part of an answer may be there
    await route.fulfill({
      status: 200,
      headers: READABLE,
      json: {
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: call.body.model,
        content: [{ type: "text", text: '{"themes":[{"title":"Termine","description":"…"},{"title":"Werk' }],
        stop_reason: "refusal",
        stop_details: { type: "refusal", category: "general_harms", explanation: "This request was declined." },
        usage: { input_tokens: 100, output_tokens: 12 },
      },
    });
    return true;
  });
  await onEight(page);
  await takeOwnKey(page, "Anthropic", KEY);
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Anthropic hat keine Antwort gegeben: Das Modell hat die Anfrage abgelehnt, aus Gründen des Anbieters. Ordnet von Hand, oder entferne den Schlüssel unter „Mehr“: Dann ordnet wieder Cloudflare.",
  );
  // the same question is asked once more, as after every answer that is none; nothing of the half answer shows
  expect(calls).toHaveLength(2);
  await expect(groupsOf(page)).toHaveCount(0);
  await expect(page.getByText("This request was declined.")).toHaveCount(0);
  await expect(primary(page)).toHaveText("Ordnen");

  answer = "key";
  calls.length = 0;
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Anthropic hat den Schlüssel abgelehnt. Trag ihn unter „Mehr“ neu ein: Vielleicht ist er unvollständig kopiert, abgelaufen oder für diesen Dienst nicht freigegeben. Konten mit „Zero Data Retention“ lässt Anthropic aus einem Browser nicht fragen.",
  );
  expect(calls).toHaveLength(1);
  await expect(page.getByText(/CORS requests/)).toHaveCount(0);
});

test("fewer than six notes: said at once, and the provider is not asked", async ({ page }) => {
  const calls = await serve(page, "Mistral");
  await enter(page, { hidden: false, notes: EIGHT.slice(0, 3) });
  await offerOwnKey(page);
  await takeOwnKey(page, "Mistral", KEY);
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Zum Ordnen sind es zu wenige Zettel: Die KI braucht mindestens 6, die in keiner von Hand angelegten oder umbenannten Gruppe liegen.",
  );
  expect(calls).toEqual([]);
  await expect(primary(page)).toHaveText("Ordnen");
});

// ───────────────────────── while the provider is asked ─────────────────────────

test("while the provider is asked the wall says whom; „Abbrechen“ really ends the calls, and no further one is made", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  let hold = true;
  const held = new Promise<void>((resolve) => (release = resolve));
  const calls = await serve(page, "Mistral", async (route) => {
    if (!hold) return false;
    await held;
    await route.fulfill({ status: 200, headers: READABLE, json: {} }).catch(() => undefined);
    return true;
  });
  // the calls the browser itself ended before an answer came
  const ended: string[] = [];
  page.on("requestfailed", (request) => {
    if (PROVIDER.test(request.url())) ended.push(request.failure()?.errorText ?? "");
  });
  await onEight(page);
  await takeOwnKey(page, "Mistral", KEY);
  await button(page, "Ordnen").click();
  // the primary action shows its own progress; „Abbrechen“ beside it says what it ends, and what it does not undo
  await expect(primary(page)).toHaveText("Ordnen läuft …");
  await expect(primary(page)).toHaveAttribute("aria-busy", "true");
  await expect(hints(page)).toHaveText([
    "„Abbrechen“ beendet die Anfragen an Mistral. Was bis dahin gerechnet ist, kann Mistral deinem Konto trotzdem berechnen.",
  ]);
  // after a second: who arranges, as large as the state, and the seconds. No promise of how long: nothing is measured
  await expect(page.locator(".app-state__clock")).toHaveText("Mistral ordnet 8 Zettel, mit deinem Schlüssel.");
  await expect(said(page)).toHaveText("Mistral ordnet 8 Zettel, mit deinem Schlüssel.");
  await expect(guide(page).first()).toHaveText(/^Bisher \d+\sSekunden?\.$/);
  await expect(page.getByText(/halben Minute/)).toHaveCount(0);
  expect(calls).toHaveLength(1);
  expect(ended).toEqual([]);

  await button(page, "Abbrechen").click();
  await expect(primary(page)).toHaveText("Ordnen");
  await expect(said(page)).toHaveText("Abgebrochen: Die Anfragen an Mistral sind beendet.");
  await expect(page.locator(".app-state__clock")).toHaveCount(0);
  await expect(problem(page)).toHaveText("");
  // the focus stayed on the key that was pressed, which is „Neuer Zettel“ again
  await expect(button(page, "Neuer Zettel")).toBeFocused();
  // the call that was out was ended by the browser, not answered
  await expect.poll(() => ended).toEqual(["net::ERR_ABORTED"]);
  // an answer that still comes shows nothing, and no second attempt or call beside it goes out
  release();
  await page.waitForTimeout(300);
  expect(calls).toHaveLength(1);
  await expect(groupsOf(page)).toHaveCount(0);
  // „Ordnen“ can be asked again, and then gives a proposal
  hold = false;
  await button(page, "Ordnen").click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  expect(calls).toHaveLength(3);
});

test("the whole of it in the list and by keyboard alone: the dialog, the key, arrange, apply, take back", async ({
  page,
}) => {
  await serve(page, "Mistral");
  await onEight(page, "list");
  // „Mehr“ by keyboard, the entry, the dialog: the focus starts on the choice
  await tabTo(page, more(page));
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Eigener KI-Schlüssel …", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.locator("#app-dlg-key");
  await expect(dialog.getByRole("radio", { name: "Mistral", exact: true })).toBeFocused();
  // Tab goes on to the field, the link, and the two actions, and stays in the dialog
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Schlüssel", { exact: true })).toBeFocused();
  await page.keyboard.type(KEY);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Abbrechen", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Übernehmen", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(more(page)).toBeFocused();

  await tabTo(page, button(page, "Ordnen"));
  await page.keyboard.press("Enter");
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  await expect(page.locator(".app-list h2.sb-list-header")).toHaveText(["Termine 5", "Werkzeuge 3"]);
  await expect(button(page, "Anwenden")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(sentence(page)).toHaveText("8 Zettel in 2 Gruppen. 1 Person ist da.");
  await expect(page.locator(".app-list")).toBeFocused();
  await tabTo(page, undo(page));
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-list h2.sb-list-header")).toHaveText(["Zettel 8"]);

  // the key is removed by keyboard too: the dialog now opens on the provider it is set for
  await tabTo(page, more(page));
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("radio", { name: "Mistral", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Schlüssel entfernen", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(more(page)).toBeFocused();
  await expect(said(page)).toHaveText("Schlüssel entfernt. „Ordnen“ fragt wieder Cloudflare.");
});

// ───────────────────────── Cloudflare and the key side by side ─────────────────────────

test("the wall's runs at the Worker are counted for Cloudflare alone: with a key the line is gone, without it it is back", async ({
  page,
}) => {
  const calls = await serve(page, "Mistral");
  const toOwnServer: string[] = [];
  page.on("request", (request) => {
    if (ARRANGE.test(request.url())) toOwnServer.push(request.url());
  });
  await onEight(page);
  // a run with Cloudflare (the Worker's stand-in): the wall has five left
  await button(page, "Ordnen").click();
  await expect(guide(page).last()).toHaveText("Diese Wand lässt sich in 24 Stunden 6-mal ordnen, jetzt noch 5-mal.");
  await button(page, "Verwerfen").click();
  expect(toOwnServer).toHaveLength(1);
  // with a key: the line of the runs is gone, the line of the key stands in its place
  await takeOwnKey(page, "Mistral", KEY);
  await expect(page.getByText(/in 24 Stunden/)).toHaveCount(0);
  await expect(guide(page).last()).toContainText("„Ordnen“ fragt Mistral, mit deinem Schlüssel.");
  await button(page, "Ordnen").click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  await expect(page.getByText(/in 24 Stunden/)).toHaveCount(0);
  await button(page, "Verwerfen").click();
  expect(calls).toHaveLength(2);
  expect(toOwnServer).toHaveLength(1);
  // without the key again: the wall still has the five runs it had, and the next one asks the Worker
  const dialog = await openOwnKey(page);
  await dialog.getByRole("button", { name: "Schlüssel entfernen", exact: true }).click();
  await expect(guide(page).last()).toHaveText("Diese Wand lässt sich in 24 Stunden 6-mal ordnen, jetzt noch 5-mal.");
  await button(page, "Ordnen").click();
  await expect(guide(page).last()).toHaveText("Diese Wand lässt sich in 24 Stunden 6-mal ordnen, jetzt noch 4-mal.");
  expect(toOwnServer).toHaveLength(2);
  expect(calls).toHaveLength(2);
});

// ───────────────────────── what is loaded when ─────────────────────────

test("the part of the app that asks a provider is loaded when a run with a key starts, and Anthropic's client only for Anthropic", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (/^\/assets\/.*\.js$/.test(pathname)) scripts.push(pathname);
  });
  const asking = () => scripts.filter((file) => /\/key-/.test(file)).map((file) => file.replace(/-[\w-]{8}\.js$/, ""));
  await serve(page, "Mistral");
  await serve(page, "Anthropic");
  await onEight(page);
  // the wall, the dialog, the key: nothing of it loads the part that asks
  await takeOwnKey(page, "Mistral", KEY);
  expect(asking()).toEqual([]);
  // a run with Cloudflare does not load it either
  await openOwnKey(page).then((dialog) => dialog.getByRole("button", { name: "Schlüssel entfernen" }).click());
  await button(page, "Ordnen").click();
  await button(page, "Verwerfen").click();
  expect(asking()).toEqual([]);
  // a run with Mistral loads the run, and not Anthropic's client
  await takeOwnKey(page, "Mistral", KEY);
  await button(page, "Ordnen").click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  expect(asking()).toEqual(["/assets/key-run"]);
  await button(page, "Verwerfen").click();
  // a run with Anthropic loads its client
  await takeOwnKey(page, "Anthropic", KEY);
  await button(page, "Ordnen").click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  expect(asking()).toEqual(["/assets/key-run", "/assets/key-anthropic"]);
});

// ───────────────────────── whom a page may call ─────────────────────────

test("the built app lets a page call the three providers and nobody else: its Content-Security-Policy names them", async ({
  page,
}) => {
  // Nothing of this test leaves the machine: every address of another origin is answered here, whatever the page's
  // policy lets through. What arrives here got past the policy.
  const arrived: string[] = [];
  await page.route(/^https:\/\//, async (route) => {
    arrived.push(new URL(route.request().url()).origin);
    await route.fulfill({ status: 200, headers: READABLE, json: {} });
  });
  await page.goto("/");
  await page.evaluate(() => {
    const refused: string[] = [];
    (window as unknown as { refused: string[] }).refused = refused;
    document.addEventListener("securitypolicyviolation", (event) => {
      refused.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  const call = (address: string) =>
    page.evaluate(
      (url) =>
        fetch(url, { method: "POST", body: "{}" }).then(
          (response) => response.status,
          () => "refused",
        ),
      address,
    );
  // the three addresses the moderation's browser calls with its own key
  for (const provider of PROVIDERS) expect(await call(provider.url), provider.id).toBe(200);
  // nobody else: not Mistral's address outside the EU, not OpenAI's other endpoint, not a provider that is not built
  const others = [
    "https://api.mistral.ai/v1/chat/completions",
    "https://eu.api.openai.com/v1/chat/completions",
    "https://generativelanguage.googleapis.com/v1beta/models",
    "https://example.org/",
  ];
  for (const other of others) expect(await call(other), other).toBe("refused");
  expect(arrived.sort()).toEqual(PROVIDERS.map((provider) => provider.origin).sort());
  const refused = await page.evaluate(() => (window as unknown as { refused: string[] }).refused);
  // each of them was refused twice: by the policy the host sends as a header, and by the same one in the page
  expect(refused).toEqual(others.flatMap((other) => [`connect-src ${other}`, `connect-src ${other}`]));
});

// ───────────────────────── how the new states look ─────────────────────────

// The states of a run with a key that end in a sentence: an answer put in a provider's place with a failing status
// writes to the console, on purpose, so they cannot stand in screens.spec.ts (docs/sebaro-luecken.md, B19). Their own
// look, in light at 390 px as the list and in dark at 1440 px as the surface: axe, no sideways scroll, no cut text,
// and the copy's check of a view. The longest sentence, Anthropic's refused key, and the one of a provider that
// cannot be reached.
for (const [scheme, width, view] of [
  ["light", 390, "list"],
  ["dark", 1440, "surface"],
] as const) {
  for (const [state, provider, text] of [
    [
      "abgelehnt",
      "Anthropic",
      "Anthropic hat den Schlüssel abgelehnt. Trag ihn unter „Mehr“ neu ein: Vielleicht ist er unvollständig kopiert, abgelaufen oder für diesen Dienst nicht freigegeben. Konten mit „Zero Data Retention“ lässt Anthropic aus einem Browser nicht fragen.",
    ],
    [
      "unerreichbar",
      "Mistral",
      "Mistral war nicht zu erreichen, oder der Browser durfte die Antwort nicht lesen. Prüf die Verbindung und versuch es noch mal.",
    ],
  ] as const) {
    test(`a run with a key that ends in a sentence (${state}), ${scheme} ${width}px: axe, no sideways scroll, no cut text, one primary action`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: width < 640 ? 844 : 900 },
        colorScheme: scheme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await serve(page, provider, async (route) => {
        if (state === "abgelehnt") {
          await refuse(route, 401, {
            type: "error",
            error: { type: "authentication_error", message: "invalid x-api-key" },
          });
        } else await route.abort("connectionreset");
        return true;
      });
      await onEight(page, view);
      await takeOwnKey(page, provider, KEY);
      await button(page, "Ordnen").click();
      await expect(problem(page)).toHaveText(text);
      // (the sentence took a part of the surface's height: every note is brought into view again, as in
      // arrange.spec.ts)
      if (view === "surface") await page.getByRole("button", { name: "Alles zeigen", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector(".app-surface__frame[data-moving]"));
      await page.evaluate(() => document.fonts.ready.then(() => true));
      expect(await page.evaluate(sidewaysScroll)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(collectCut)).toEqual([]);
      expect(await viewFaults(page, "src/sebaro/checks/sb-colour-count.js")).toEqual([]);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations.map((violation) => violation.id)).toEqual([]);
      await expect(page.locator(".sb-primary-action")).toHaveCount(1);
      const shot = `wand-schluessel-${state}-${scheme}-${width}.png`;
      await page.screenshot({ path: path.join(test.info().project.outputDir, "screens", shot) });
      await context.close();
    });
  }
}
