// „Ordnen“ with real browsers, against the Worker behind the build (PLAN.md, stage 4a): the moderation asks for a
// proposal, sees it as a preview that nobody else gets, applies it or lets it go, and takes it back. The Worker asks
// its stand-in here, never Cloudflare's AI: it puts the notes together that begin with the same word
// (packages/arrange/src/fake.ts), so a test knows which groups come. What another browser gets is read from the
// frames of its WebSocket themselves, not only from its screen. The answers the stand-in never gives (a budget that
// is spent, an AI that fails, a line that is cut) are put in the route's place.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContextOptions, type Locator, type Page } from "@playwright/test";
import { enter, ground, know, lookAt, QUESTION, writeNote } from "./app";
import { collectCut, sidewaysScroll, viewFaults } from "./sebaro-checks";

test.use({ reducedMotion: "reduce", colorScheme: "light", viewport: { width: 1440, height: 1000 } });

const WALL_SOCKET = /\/api\/walls\/[0-9a-f]{64}\/ws$/;
const ARRANGE = /\/api\/walls\/[0-9a-f]{64}\/arrange$/;

/** Eight notes that begin with two words, five and three: the stand-in makes the groups „Termine“ and „Werkzeuge“ of
 *  them, the larger one first (among groups of the same size the order would hang on which note the wall lists
 *  first, and notes made in the same millisecond stand in the order of their ids). */
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
/** How many notes each of the two groups holds. */
const SIZES: Record<string, number> = { Termine: 5, Werkzeuge: 3 };

/** The state sentence at the top of the wall. */
const sentence = (page: Page) => page.locator(".app-state__sentence");
/** What to do now, and what stands with it: the sentences under the state. */
const guide = (page: Page) => page.locator(".app-state__note");
/** What a screen reader was told last about what happened on the wall. */
const said = (page: Page) => page.locator("main p.sb-visually-hidden[role=status]");
/** The sentence of a change that was not taken, or of „Ordnen“ that gave no proposal. */
const problem = (page: Page) => page.locator(".app-surface__problem");
/** The wall's action zone. */
const zone = (page: Page) => page.locator(".sb-bottom-block");
const primary = (page: Page) => page.locator(".sb-primary-action");
const button = (page: Page, name: string) => zone(page).getByRole("button", { name, exact: true });
/** „Rückgängig“ in the zone: its name for a screen reader says what it takes back. */
const undo = (page: Page) => page.getByRole("button", { name: "Ordnen rückgängig machen", exact: true });
/** The headings of the list with their counts: „Termine 5“. */
const headings = (page: Page) => page.locator(".app-list h2.sb-list-header");
const world = (page: Page) => page.locator(".app-surface__ground > .app-surface__world");
/** The view as the world's transform says it. */
const viewOf = (page: Page) => world(page).evaluate((el) => (el as HTMLElement).style.transform);

type Layout = {
  /** every note by its id: where it lies, and the group a screen reader hears with it */
  notes: Record<string, { x: number; y: number; where: string }>;
  /** every frame, by its title: where it lies and how large it is */
  groups: Array<{ title: string; x: number; y: number; w: number; h: number }>;
};
/** Where everything lies on a page's surface, in world units: the places the app wrote, not a moment of a motion. */
const layoutOf = (page: Page): Promise<Layout> =>
  page.evaluate(() => {
    const units = (rem: string) => Math.round(parseFloat(rem) * 16);
    const notes = Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>(".app-note[data-note]")].map((el) => [
        el.dataset.note ?? "",
        {
          x: units(el.style.left),
          y: units(el.style.top),
          where: el.querySelector(".sb-visually-hidden")?.textContent?.trim() ?? "",
        },
      ]),
    );
    const groups = [...document.querySelectorAll<HTMLElement>(".app-group[data-group]")]
      .map((el) => ({
        title: el.textContent ?? "",
        x: units(el.style.left),
        y: units(el.style.top),
        w: units(el.style.inlineSize),
        h: units(el.style.blockSize),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    return { notes, groups };
  });

/** Every frame the wall's socket of a page received, as it came; the heartbeat's answer left out. To be called
 *  before the page goes to the wall. */
function received(page: Page): string[] {
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
/** Every frame the wall's socket of a page sends from now on, parsed. */
function sent(page: Page) {
  const frames: Array<{ type: string; [key: string]: unknown }> = [];
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => {
      if (frame.payload !== "ping") frames.push(JSON.parse(String(frame.payload)));
    }),
  );
  return frames;
}
const typesOf = (frames: string[]) => frames.map((frame) => (JSON.parse(frame) as { type: string }).type);

/** Another person in a browser of their own, on the wall under a name; their socket's frames are recorded from the
 *  first one on. `options`: how that browser is set up (its motion setting); `before`: what it stores before the
 *  app loads. */
async function another(
  browser: Browser,
  address: string,
  name: string,
  options: BrowserContextOptions = {},
  before?: (page: Page) => Promise<unknown>,
) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  const frames = received(page);
  if (before !== undefined) {
    await page.goto("/");
    await before(page);
  }
  await page.goto(address);
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-surface__ground, .app-list").waitFor();
  return { page, frames };
}

/** Presses Tab until the element has the focus (at most 60 presses). */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${String(target)}`);
}

/** Two moments at which a budget that is spent may go on, both within 24 hours as the AI's budget runs: 23:59 today
 *  and 00:01 tomorrow, by this machine's calendar. The sentence names the time, and says „morgen“ for the second. */
function goesOn() {
  const now = new Date();
  const at = (days: number, hours: number, minutes: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hours, minutes).getTime();
  return { today: at(0, 23, 59), tomorrow: at(1, 0, 1) };
}

/** On an open wall with the eight notes, as its moderation; Ben wrote them and has left: the wall knows that name,
 *  so whoever comes beside the moderation in these tests is called otherwise. */
const onEight = (page: Page, view: "surface" | "list" = "surface") =>
  enter(page, { hidden: false, notes: EIGHT, view });

test("the moderation arranges: the preview is its own, nothing of it reaches anybody until „Anwenden“; „Rückgängig“ restores every place", async ({
  page,
  browser,
}) => {
  const asked: Array<{ body: string | null; authorization: string | undefined }> = [];
  page.on("request", (request) => {
    if (ARRANGE.test(request.url())) {
      asked.push({ body: request.postData(), authorization: request.headers().authorization });
    }
  });
  const annaSent = sent(page);
  const { adminToken } = await onEight(page);
  const cem = await another(browser, page.url(), "Cem");
  await expect(cem.page.locator(".app-note[data-note]")).toHaveCount(8);
  await expect(sentence(page)).toHaveText("8 Zettel. 2 Personen sind da.");

  // before: both browsers show the same wall, without a group; the moderation alone has „Ordnen“
  const before = await layoutOf(page);
  expect(await layoutOf(cem.page)).toEqual(before);
  expect(before.groups).toEqual([]);
  await expect(primary(page)).toHaveText("Ordnen");
  await expect(primary(cem.page)).toHaveText("Neuer Zettel");
  await expect(cem.page.getByRole("button", { name: "Ordnen" })).toHaveCount(0);
  const cemView = await viewOf(cem.page);
  const cemFrames = cem.frames.length;
  const annaFrames = annaSent.length;

  // ── „Ordnen“: the proposal is a preview on the moderation's wall ──
  await button(page, "Ordnen").click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  // the request: the token in its header, the language the app shows as its body, and no note's text
  expect(asked).toEqual([{ body: '{"language":"de"}', authorization: `Bearer ${adminToken}` }]);
  const preview = await layoutOf(page);
  expect(preview.groups.map((group) => group.title)).toEqual(["Termine", "Werkzeuge"]);
  for (const [id, note] of Object.entries(preview.notes)) {
    expect([note.x, note.y], id).not.toEqual([before.notes[id]?.x, before.notes[id]?.y]);
    expect(note.where).toMatch(/^in „(Termine|Werkzeuge)“$/);
  }
  // every note of a group lies inside its frame, under the room for its title
  for (const group of preview.groups) {
    const members = Object.values(preview.notes).filter((note) => note.where === `in „${group.title}“`);
    expect(members).toHaveLength(SIZES[group.title] ?? 0);
    for (const note of members) {
      expect(note.x).toBeGreaterThanOrEqual(group.x);
      expect(note.y).toBeGreaterThanOrEqual(group.y + 40);
      expect(note.x + 240).toBeLessThanOrEqual(group.x + group.w);
      expect(note.y).toBeLessThan(group.y + group.h);
    }
  }
  // the whole proposal is in view, and the zone holds „Anwenden“ and „Verwerfen“
  for (const frame of await page.locator(".app-group[data-group]").all()) {
    await expect(frame).toBeInViewport({ ratio: 0.99 });
  }
  await expect(primary(page)).toHaveText("Anwenden");
  await expect(button(page, "Verwerfen")).toBeVisible();
  // after a run: how many more this wall has today
  await expect(guide(page).last()).toHaveText("Diese Wand lässt sich in 24 Stunden 6-mal ordnen, jetzt noch 5-mal.");
  // the moderation's own changing of the wall rests while the proposal stands
  await expect(button(page, "Neuer Zettel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Neue Gruppe" })).toHaveCount(0);
  await page.locator(".app-note[data-note]").first().dblclick();
  await expect(page.getByRole("textbox", { name: "Text des Zettels" })).toHaveCount(0);

  // nothing of it has left the moderation's browser: no command went out, and Cem's socket got no frame at all
  expect(annaSent.slice(annaFrames)).toEqual([]);
  expect(cem.frames.slice(cemFrames)).toEqual([]);
  expect(await layoutOf(cem.page)).toEqual(before);
  await expect(cem.page.locator(".app-group")).toHaveCount(0);
  await expect(sentence(cem.page)).toHaveText("8 Zettel. 2 Personen sind da.");
  // and nothing of it is stored in the moderation's browser
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })),
  ).not.toContain("Werkzeuge");

  // ── „Anwenden“: one command, and the arrangement is everybody's ──
  await button(page, "Anwenden").click();
  await expect(cem.page.locator(".app-group[data-group]")).toHaveCount(2);
  const applied = annaSent.slice(annaFrames);
  expect(applied.map((frame) => frame.type)).toEqual(["admin.arrange.apply"]);
  expect(applied[0]).toMatchObject({ source: "service" });
  expect(typesOf(cem.frames.slice(cemFrames))).toEqual(["arrange.applied"]);
  // on the moderation's device nothing moved a second time: the wall is what the preview showed
  expect(await layoutOf(page)).toEqual(preview);
  // and Cem has the same wall; his view was not moved
  expect(await layoutOf(cem.page)).toEqual(preview);
  expect(await viewOf(cem.page)).toBe(cemView);
  for (const one of [page, cem.page]) {
    await expect(sentence(one)).toHaveText("8 Zettel in 2 Gruppen. 2 Personen sind da.");
    await expect(said(one)).toHaveText("Geordnet: 2 Gruppen.");
  }
  // Cem still has no „Ordnen“ and no „Rückgängig“, in the zone or in „Mehr“
  await expect(primary(cem.page)).toHaveText("Neuer Zettel");
  await expect(undo(cem.page)).toHaveCount(0);
  await cem.page.locator("[data-sb-web-app-head] [aria-haspopup=menu]").click();
  await expect(cem.page.getByRole("menuitem", { name: "Ordnen rückgängig machen" })).toHaveCount(0);
  await cem.page.keyboard.press("Escape");

  // ── „Rückgängig“: beside „Ordnen“, at once, and every note lies exactly where it lay ──
  await expect(primary(page)).toHaveText("Ordnen");
  await expect(guide(page).first()).toHaveText(
    "Du moderierst: Die KI hat geordnet. Passt es nicht, nimmt „Rückgängig“ es sofort zurück. Sonst schiebt um und benennt um, was nicht trifft.",
  );
  await undo(page).click();
  await expect(cem.page.locator(".app-group[data-group]")).toHaveCount(0);
  await expect(page.locator(".app-group[data-group]")).toHaveCount(0);
  expect(await layoutOf(page)).toEqual(before);
  expect(await layoutOf(cem.page)).toEqual(before);
  expect(typesOf(cem.frames.slice(cemFrames))).toEqual(["arrange.applied", "arrange.undone"]);
  for (const one of [page, cem.page]) {
    await expect(sentence(one)).toHaveText("8 Zettel. 2 Personen sind da.");
    await expect(said(one)).toHaveText("Das Ordnen wurde zurückgenommen.");
  }
  await expect(undo(page)).toHaveCount(0);
  // no dialog asked: nothing had changed since the run
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await cem.page.context().close();
});

test("„Verwerfen“ leaves every note where it lay: nothing was sent, and the view is back where it looked", async ({
  page,
  browser,
}) => {
  const annaSent = sent(page);
  await onEight(page);
  const cem = await another(browser, page.url(), "Cem");
  await expect(cem.page.locator(".app-note[data-note]")).toHaveCount(8);
  await expect(sentence(page)).toHaveText("8 Zettel. 2 Personen sind da.");
  const before = await layoutOf(page);
  const view = await viewOf(page);
  const [annaFrames, cemFrames] = [annaSent.length, cem.frames.length];

  await button(page, "Ordnen").click();
  await expect(page.locator(".app-group[data-group]")).toHaveCount(2);
  expect(await layoutOf(page)).not.toEqual(before);
  // the view went to the proposal
  expect(await viewOf(page)).not.toBe(view);
  // while it stands, somebody else's changes arrive underneath: Cem writes a note, and it lies where he put it
  await writeNote(cem.page, "Pausen gemeinsam machen");
  await expect(page.locator(".app-note[data-note]")).toHaveCount(9);
  await expect(page.locator(".app-group[data-group]")).toHaveCount(2);
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  const withCems = await layoutOf(cem.page);

  await button(page, "Verwerfen").click();
  await expect(page.locator(".app-group[data-group]")).toHaveCount(0);
  await expect(said(page)).toHaveText("Vorschlag verworfen. Die Wand ist, wie sie war.");
  // every note lies where the wall has it: the eight where they lay, Cem's where he put it
  const after = await layoutOf(page);
  expect(after).toEqual(withCems);
  for (const [id, place] of Object.entries(before.notes)) expect(after.notes[id]).toEqual(place);
  expect(await viewOf(page)).toBe(view);
  // the moderation sent nothing; Cem's socket got nothing but the word on his own note
  expect(annaSent.slice(annaFrames)).toEqual([]);
  expect(typesOf(cem.frames.slice(cemFrames)).sort()).toEqual(["ack", "note.created"]);
  // the wall is the moderation's to change again, and „Ordnen“ stands there for another run
  await expect(primary(page)).toHaveText("Ordnen");
  await expect(button(page, "Neuer Zettel")).toBeVisible();
  await expect(sentence(page)).toHaveText("9 Zettel. 2 Personen sind da.");
  await cem.page.context().close();
});

/** Counts the transitions that begin on a page's notes from now on, and how long after its start the last of them
 *  ends (its delay and its duration). */
const watchGlide = (page: Page) =>
  page.evaluate(() => {
    const seen = { runs: 0, longest: 0 };
    (window as unknown as { glide: typeof seen }).glide = seen;
    document.addEventListener(
      "transitionrun",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.matches(".app-note")) return;
        seen.runs += 1;
        for (const animation of target.getAnimations()) {
          seen.longest = Math.max(seen.longest, Number(animation.effect?.getComputedTiming().endTime ?? 0));
        }
      },
      true,
    );
  });
const glideOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { glide: { runs: number; longest: number } }).glide);
/** Whether a transition still runs on one of a page's notes. */
const gliding = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".app-note")].some((note) =>
      note.getAnimations().some((animation) => animation.playState === "running"),
    ),
  );

test("the notes glide to their places, all there within 600 ms; under reduced motion, the system's or the app's, they jump", async ({
  browser,
}) => {
  // the moderation in a browser that allows motion
  const moderation = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  const page = await moderation.newPage();
  await onEight(page);
  const address = page.url();
  const moving = await another(browser, address, "Cem", { reducedMotion: "no-preference" });
  const still = await another(browser, address, "Dora", { reducedMotion: "reduce" });
  // the app's own setting „Bewegung immer reduzieren“, in a browser whose system allows motion
  const quiet = await another(browser, address, "Emil", { reducedMotion: "no-preference" }, (one) =>
    one.evaluate(() => localStorage.setItem("sb-motion", "reduce")),
  );
  expect(await quiet.page.evaluate(() => document.documentElement.dataset.sbMotion)).toBe("reduce");
  for (const one of [moving, still, quiet]) await expect(one.page.locator(".app-note[data-note]")).toHaveCount(8);
  const before = await layoutOf(moving.page);
  for (const one of [page, moving.page, still.page, quiet.page]) await watchGlide(one);

  // the preview glides on the moderation's wall; nobody else's notes move
  await button(page, "Ordnen").click();
  await expect(page.locator(".app-group[data-group]")).toHaveCount(2);
  await expect.poll(() => glideOf(page).then((glide) => glide.runs)).toBeGreaterThan(0);
  const previewGlide = await glideOf(page);
  expect(previewGlide.longest).toBeGreaterThan(0);
  expect(previewGlide.longest).toBeLessThanOrEqual(600);
  await expect.poll(() => gliding(page), { timeout: 2000 }).toBe(false);
  expect((await glideOf(moving.page)).runs).toBe(0);

  // „Anwenden“: on the moderation's device nothing moves a second time
  await button(page, "Anwenden").click();
  for (const one of [moving, still, quiet]) await expect(one.page.locator(".app-group[data-group]")).toHaveCount(2);
  const arranged = await layoutOf(page);
  expect((await glideOf(page)).runs).toBe(previewGlide.runs);

  // a browser that allows motion: every note that changed its place glides, staggered, the last one there in 600 ms
  await expect.poll(() => glideOf(moving.page).then((glide) => glide.runs)).toBeGreaterThan(0);
  const glide = await glideOf(moving.page);
  expect(glide.longest).toBeGreaterThan(300);
  expect(glide.longest).toBeLessThanOrEqual(600);
  expect(await layoutOf(moving.page)).toEqual(arranged);
  await expect.poll(() => gliding(moving.page), { timeout: 2000 }).toBe(false);
  // the mark of the motion is gone again, and no note keeps a delay
  await expect(world(moving.page)).not.toHaveAttribute("data-gliding", /.*/);

  // reduced motion, by the system and by the app's own setting: the notes are there, and no transition ever began
  for (const one of [still, quiet]) {
    expect(await layoutOf(one.page)).toEqual(arranged);
    expect(await gliding(one.page)).toBe(false);
    expect((await glideOf(one.page)).runs).toBe(0);
  }

  // taking it back moves the same way: with motion where it is allowed, as a jump where it is not
  const runs = glide.runs;
  await page.getByRole("button", { name: "Ordnen rückgängig machen", exact: true }).click();
  for (const one of [moving, still, quiet]) await expect(one.page.locator(".app-group[data-group]")).toHaveCount(0);
  await expect.poll(() => glideOf(moving.page).then((now) => now.runs)).toBeGreaterThan(runs);
  expect((await glideOf(moving.page)).longest).toBeLessThanOrEqual(600);
  for (const one of [moving, still, quiet]) expect(await layoutOf(one.page)).toEqual(before);
  for (const one of [still, quiet]) expect((await glideOf(one.page)).runs).toBe(0);
  for (const one of [moderation, moving.page.context(), still.page.context(), quiet.page.context()]) await one.close();
});

test("a participant never has „Ordnen“; while the notes are hidden the moderation has none either", async ({
  page,
  browser,
}) => {
  // a wall as the product makes it: with hidden writing
  await enter(page, { notes: EIGHT });
  const cem = await another(browser, page.url(), "Cem");
  await expect(primary(page)).toHaveText("Aufdecken");
  for (const one of [page, cem.page]) {
    await expect(one.getByRole("button", { name: "Ordnen" })).toHaveCount(0);
    await expect(one.locator(".sb-action-hint")).toHaveText([
      "Geht an den Server von IdeaBeam in der EU. Die anderen sehen es erst nach dem Aufdecken.",
    ]);
  }
  // the route itself refuses while the notes are hidden, whatever a browser shows
  const refused = await page.evaluate(async () => {
    const stored = JSON.parse(localStorage.getItem("ideabeam-walls") ?? "{}") as {
      state: { adminTokens: Record<string, string> };
    };
    const [[wallId, token] = ["", ""]] = Object.entries(stored.state.adminTokens);
    const response = await fetch(`/api/walls/${wallId}/arrange`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ language: "de" }),
    });
    return { status: response.status, body: (await response.json()) as unknown };
  });
  expect(refused).toEqual({ status: 409, body: { error: "PHASE" } });

  // revealed: the moderation's primary action is „Ordnen“, with where it is computed under it; Cem's stays as it was
  await primary(page).click();
  await page.locator("#app-dlg-reveal").getByRole("button", { name: "Aufdecken" }).click();
  await expect(sentence(page)).toHaveText("8 Zettel. 2 Personen sind da.");
  await expect(primary(page)).toHaveText("Ordnen");
  await expect(button(page, "Neuer Zettel")).toBeVisible();
  await expect(zone(page).locator(".sb-action-hint")).toHaveText([
    "„Ordnen“ schickt die Frage und die Texte der Zettel, ohne Namen, an Cloudflares KI-Dienst Workers AI: laut Cloudflare ohne Speicherung und ohne Training, aber nicht sicher in der EU. Mehr unter Datenschutz.",
    "Ein neuer Zettel geht an den Server von IdeaBeam in der EU. Alle auf der Wand sehen ihn.",
  ]);
  await expect(guide(page)).toHaveText([
    "Du moderierst: Wenn alle fertig sind, schlägt „Ordnen“ Gruppen mit Überschriften vor. Von Hand geht es genauso: Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  ]);
  await expect(sentence(cem.page)).toHaveText("8 Zettel. 2 Personen sind da.");
  await expect(primary(cem.page)).toHaveText("Neuer Zettel");
  await expect(cem.page.getByRole("button", { name: "Ordnen" })).toHaveCount(0);
  await expect(cem.page.locator(".sb-action-hint")).toHaveText([
    "Geht an den Server von IdeaBeam in der EU. Alle auf der Wand sehen es.",
  ]);
  await expect(guide(cem.page)).toHaveText([
    "Schreib weitere Ideen auf Zettel. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  ]);
  // the same in the list
  await page.getByRole("radio", { name: "Liste", exact: true }).check();
  await expect(primary(page)).toHaveText("Ordnen");
  await cem.page.getByRole("radio", { name: "Liste", exact: true }).check();
  await expect(cem.page.getByRole("button", { name: "Ordnen" })).toHaveCount(0);
  await cem.page.context().close();
});

test("the line under „Ordnen“ leads to the privacy notice's section on it, and the page shows that section", async ({
  page,
}) => {
  await onEight(page);
  await zone(page).getByRole("link", { name: "Datenschutz" }).click();
  await expect(page).toHaveURL(/\/datenschutz#ordnen$/);
  const section = page.locator("#ordnen");
  await expect(section).toHaveText("3.4 Das Ordnen mit KI");
  // the section stands at the window's top, not somewhere on a page that opened at its start
  await expect(section).toBeInViewport();
  expect(await section.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(200);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  // the view's heading has the focus, as after every navigation
  await expect(page.locator("[data-sb-view] h1")).toBeFocused();

  // the same address loaded afresh: the page is fetched in parts, and the section still comes into view
  await page.goto("/datenschutz#ordnen");
  await expect(page.locator("#ordnen")).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  // in English the section has the same name in the address
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("sb-lang", "en"));
  await page.goto("/datenschutz#ordnen");
  await expect(page.locator("#ordnen")).toHaveText("3.4 Grouping with AI");
  await expect(page.locator("#ordnen")).toBeInViewport();
  // an address without a part still opens at the page's top
  await page.goto("/datenschutz");
  await expect(page.locator("#ordnen")).toHaveCount(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("the request names the language the app shows; in English the action is „Group notes“", async ({ page }) => {
  const bodies: Array<string | null> = [];
  page.on("request", (request) => {
    if (ARRANGE.test(request.url())) bodies.push(request.postData());
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("sb-lang", "en"));
  await onEight(page);
  await expect(primary(page)).toHaveText("Group notes");
  await expect(zone(page).locator(".sb-action-hint").first()).toHaveText(
    "“Group notes” sends the question and the texts of the notes, without names, to Cloudflare’s AI service Workers AI: according to Cloudflare without storing them or training on them, but not certainly in the EU. More under Privacy.",
  );
  await button(page, "Group notes").click();
  await expect(sentence(page)).toHaveText("The AI’s proposal: 2 groups. Only you see it.");
  expect(bodies).toEqual(['{"language":"en"}']);
  await expect(primary(page)).toHaveText("Apply");
  await button(page, "Apply").click();
  await expect(sentence(page)).toHaveText("8 notes in 2 groups. 1 person is here.");
  await expect(page.getByRole("button", { name: "Undo grouping", exact: true })).toHaveText("Undo");
});

test("fewer than six notes: the Worker says so without asking the AI, and the sentence names how many it takes", async ({
  page,
}) => {
  await enter(page, { hidden: false, notes: EIGHT.slice(0, 3) });
  await expect(sentence(page)).toHaveText("3 Zettel. 1 Person ist da.");
  // „Ordnen“ stands in the moderation's zone from the moment the notes are revealed; what to do now does not lead
  // to it while too few notes lie there
  await expect(guide(page)).toHaveText([
    "Du moderierst: Alle schreiben weiter. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  ]);
  const answer = page.waitForResponse(ARRANGE);
  await button(page, "Ordnen").click();
  const response = await answer;
  // the real route's answer
  expect(response.status()).toBe(409);
  expect(await response.json()).toEqual({ error: "NOTHING_TO_ARRANGE", notes: 3, min: 6 });
  await expect(problem(page)).toHaveText(
    "Zum Ordnen sind es zu wenige Zettel: Die KI braucht mindestens 6, die in keiner von Hand angelegten oder umbenannten Gruppe liegen.",
  );
  await expect(problem(page)).toHaveAttribute("role", "alert");
  // the wall is as it was, and the action is ready again
  await expect(primary(page)).toHaveText("Ordnen");
  await expect(primary(page)).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".app-group")).toHaveCount(0);
  // a new note puts the sentence away; three more, and the same press gives a proposal
  for (const text of EIGHT.slice(3, 6)) await writeNote(page, text);
  await expect(problem(page)).toHaveText("");
  await expect(sentence(page)).toHaveText("6 Zettel. 1 Person ist da.");
  await button(page, "Ordnen").click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
});

test("no proposal: a spent budget, Cloudflare's own refusal, a wall that had its runs, an AI that fails and a line that is cut each say what now; the wall stays usable", async ({
  page,
}) => {
  const { today, tomorrow } = goesOn();
  let answer: "budget" | "cloudflare" | "runs" | "failed" | "cut" | "large" | "real" = "budget";
  await page.route(ARRANGE, async (route) => {
    if (answer === "budget") await route.fulfill({ status: 429, json: { error: "AI_BUDGET_SPENT", resetsAt: today } });
    else if (answer === "cloudflare") await route.fulfill({ status: 429, json: { error: "AI_BUDGET_SPENT" } });
    else if (answer === "runs") {
      await route.fulfill({ status: 429, json: { error: "WALL_RUNS_SPENT", resetsAt: tomorrow } });
    } else if (answer === "failed") await route.fulfill({ status: 502, json: { error: "AI_FAILED" } });
    else if (answer === "large") await route.fulfill({ status: 413, json: { error: "PAYLOAD_TOO_LARGE" } });
    else if (answer === "cut") await route.abort("connectionreset");
    else await route.continue();
  });
  await onEight(page);
  const before = await layoutOf(page);

  // the AI's budget of 24 hours is spent, for every wall: when it goes on, by this device's clock, and what always
  // works. It speaks of no day: the budget is no day's
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Das Kontingent der KI ist aufgebraucht, für alle Wände. Ab 23:59 Uhr geht es weiter. Von Hand ordnen geht immer.",
  );
  // it names no way this build does not have
  await expect(problem(page)).not.toContainText(/Schlüssel|Browser|heute/);
  // the wall stays usable: a note is written, and the sentence goes with the new change
  await expect(primary(page)).toHaveText("Ordnen");
  await writeNote(page, "Pausen gemeinsam machen");
  await expect(problem(page)).toHaveText("");
  await expect(sentence(page)).toHaveText("9 Zettel. 1 Person ist da.");

  // Cloudflare refused, whose allowance all products of the account share: the answer names no time, and the
  // sentence says that the app does not know it
  answer = "cloudflare";
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Das Kontingent der KI bei Cloudflare ist aufgebraucht, für alle Wände. Wann es weitergeht, kann die App nicht sagen: spätestens in 24 Stunden. Von Hand ordnen geht immer.",
  );
  await expect(problem(page)).not.toContainText(/\d\d:\d\d|Uhr/);

  // the wall had its runs of 24 hours; it has one again on the next day, and the sentence says „morgen“
  answer = "runs";
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Diese Wand hat die KI in 24 Stunden 6-mal ordnen lassen, öfter geht es nicht. Morgen ab 00:01 Uhr geht es wieder. Von Hand ordnen geht immer.",
  );
  // the sentence can be put away by hand too
  await problem(page).getByRole("button", { name: "Hinweis schließen" }).click();
  await expect(problem(page)).toHaveText("");

  answer = "failed";
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Die KI hat keine brauchbare Antwort gegeben. Versuch es noch mal, oder ordnet von Hand.",
  );
  // by hand works: a group is made, and the sentence goes
  await page.getByRole("button", { name: "Neue Gruppe", exact: true }).click();
  await page.getByRole("textbox", { name: "Titel der Gruppe" }).fill("Von Hand");
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-group[data-group]")).toHaveText(["Von Hand"]);
  await expect(problem(page)).toHaveText("");

  answer = "cut";
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Die Anfrage kam nicht beim Server an. Prüf die Verbindung und versuch es noch mal.",
  );
  answer = "large";
  await button(page, "Ordnen").click();
  await expect(problem(page)).toHaveText(
    "Das Ordnen hat nicht geklappt: Der Server hat unerwartet geantwortet. Versuch es noch mal, oder ordnet von Hand.",
  );

  // none of it moved a note; and once the route answers again, the same press gives a proposal
  const after = await layoutOf(page);
  for (const [id, place] of Object.entries(before.notes)) expect(after.notes[id]).toEqual(place);
  answer = "real";
  await button(page, "Ordnen").click();
  // (nine notes lie outside the group made by hand by now, one of them about breaks: three groups)
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 3 Gruppen. Nur du siehst ihn.");
  await expect(problem(page)).toHaveText("");
});

test("while the AI is asked the action shows its own progress, a sentence says what happens, and „Abbrechen“ ends the waiting", async ({
  page,
  browser,
}) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(ARRANGE, async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  await onEight(page);
  const cem = await another(browser, page.url(), "Cem");
  await expect(sentence(page)).toHaveText("8 Zettel. 2 Personen sind da.");
  await button(page, "Ordnen").click();
  // the primary action stays in its place and says what runs; „Abbrechen“ beside it, and what it means
  await expect(primary(page)).toHaveText("Ordnen läuft …");
  await expect(primary(page)).toHaveAttribute("aria-busy", "true");
  await expect(button(page, "Abbrechen")).toBeVisible();
  await expect(zone(page).locator(".sb-action-hint")).toHaveText([
    "„Abbrechen“ beendet nur das Warten. Der Versuch zählt trotzdem: Eine Wand lässt sich 6-mal in 24 Stunden ordnen.",
  ]);
  // after a second: what happens, as large as the state, and the seconds; no steps the app cannot know
  await expect(page.locator(".app-state__clock")).toHaveText(
    "Die KI ordnet 8 Zettel. Das dauert meist unter einer halben Minute.",
  );
  await expect(guide(page)).toHaveText([/^Bisher \d+\sSekunden?\.$/]);
  await expect(said(page)).toHaveText("Die KI ordnet 8 Zettel. Das dauert meist unter einer halben Minute.");
  await expect(page.getByText(/Themen finden|Zettel zuordnen/)).toHaveCount(0);
  // the wall stays usable for everybody else: Cem writes, and the moderation sees it arrive
  await writeNote(cem.page, "Pausen gemeinsam machen");
  await expect(page.locator(".app-note[data-note]")).toHaveCount(9);
  // the moderation's own changing rests
  await expect(button(page, "Neuer Zettel")).toHaveCount(0);

  await button(page, "Abbrechen").click();
  await expect(primary(page)).toHaveText("Ordnen");
  await expect(said(page)).toHaveText("Warten abgebrochen.");
  await expect(page.locator(".app-state__clock")).toHaveCount(0);
  await expect(problem(page)).toHaveText("");
  // the focus stayed on the key that was pressed, which is „Neuer Zettel“ again
  await expect(button(page, "Neuer Zettel")).toBeFocused();
  // an answer that still comes shows nothing
  release();
  await expect(page.locator(".app-group")).toHaveCount(0);
  await expect(primary(page)).toHaveText("Ordnen");
  await cem.page.context().close();
});

test("„Rückgängig“ after the wall has changed stands in „Mehr“ and asks first, saying what is lost", async ({
  page,
  browser,
}) => {
  await onEight(page);
  const cem = await another(browser, page.url(), "Cem");
  await expect(sentence(page)).toHaveText("8 Zettel. 2 Personen sind da.");
  const before = await layoutOf(page);
  await button(page, "Ordnen").click();
  await button(page, "Anwenden").click();
  await expect(undo(page)).toBeVisible();
  await expect(cem.page.locator(".app-group[data-group]")).toHaveCount(2);

  // Cem writes a note and renames a group: the wall has changed since the run
  await writeNote(cem.page, "Pausen gemeinsam machen");
  // (an arrangement moves nobody's view: he looks at all of it before he takes hold of a frame)
  await cem.page.getByRole("button", { name: "Alles zeigen", exact: true }).click();
  await cem.page.locator(".app-group[data-group]").filter({ hasText: "Termine" }).locator(".app-group__head").click();
  await cem.page.keyboard.press("Enter");
  await cem.page.getByRole("textbox", { name: "Titel der Gruppe" }).fill("Besprechungen");
  await cem.page.keyboard.press("Enter");
  await expect(page.locator(".app-group[data-group]").filter({ hasText: "Besprechungen" })).toHaveCount(1);
  const changed = await layoutOf(cem.page);
  const cems = changed.notes;
  const [cemsNote] = Object.keys(cems).filter((id) => !(id in before.notes));
  // the group Cem renamed is his from then on, with the five notes in it
  const renamed = changed.groups.filter((group) => group.title === "Besprechungen");
  const inIt = Object.keys(cems).filter((id) => cems[id]?.where === "in „Besprechungen“");
  expect(renamed).toHaveLength(1);
  expect(inIt).toHaveLength(5);

  // „Rückgängig“ has left the zone: taking the run back would lose what was done since
  await expect(undo(page)).toHaveCount(0);
  await expect(guide(page).first()).toHaveText(
    "Du moderierst: Die KI hat geordnet. Schiebt um und benennt um, was nicht trifft. Zurücknehmen lässt sich das Ordnen noch unter „Mehr“.",
  );
  const more = page.locator("[data-sb-web-app-head] [aria-haspopup=menu]");
  await more.click();
  const item = page.getByRole("menuitem", { name: "Ordnen rückgängig machen", exact: true });
  await expect(item).toBeVisible();
  await item.click();
  const dialog = page.locator("#app-dlg-undo");
  await expect(dialog).toContainText("Ordnen rückgängig machen?");
  await expect(dialog).toContainText(
    "Die Zettel liegen danach wieder dort, wo sie vor dem Ordnen lagen, und die Gruppen der KI verschwinden. Umbenannte Gruppen bleiben, mit ihren Zetteln. Was seitdem verschoben wurde, geht verloren. Das lässt sich nicht rückgängig machen.",
  );
  // it opens on „Abbrechen“; put away, nothing has happened, and the focus is back on „Mehr“
  await expect(dialog.getByRole("button", { name: "Abbrechen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(more).toBeFocused();
  await expect(page.locator(".app-group[data-group]")).toHaveCount(2);

  // confirmed: the run's other group is gone, and its notes lie where they lay before the run. The renamed group
  // stays as it stood, with its notes in it: it is a person's. The note written since stays where it lies
  await more.click();
  await item.click();
  await dialog.getByRole("button", { name: "Rückgängig machen" }).click();
  for (const one of [page, cem.page]) {
    await expect(one.locator(".app-group[data-group]")).toHaveText(["Besprechungen"]);
    const after = await layoutOf(one);
    expect(after.groups).toEqual(renamed);
    for (const [id, place] of Object.entries(before.notes)) {
      expect(after.notes[id], id).toEqual(inIt.includes(id) ? cems[id] : place);
    }
    expect(after.notes[cemsNote ?? ""]).toEqual({ ...cems[cemsNote ?? ""], where: "" });
    await expect(sentence(one)).toHaveText("9 Zettel, 5 davon in 1 Gruppe. 2 Personen sind da.");
    await expect(said(one)).toHaveText("Das Ordnen wurde zurückgenommen.");
  }
  await expect(more).toBeFocused();
  // nothing is left to take back
  await more.click();
  await expect(item).toHaveCount(0);
  await cem.page.context().close();
});

test("a group of the AI's that somebody renames is theirs from then on: the next „Ordnen“ leaves it and its notes, and taking that run back leaves it too", async ({
  page,
}) => {
  await onEight(page);
  await button(page, "Ordnen").click();
  await button(page, "Anwenden").click();
  await expect(sentence(page)).toHaveText("8 Zettel in 2 Gruppen. 1 Person ist da.");
  // „Werkzeuge“ gets a name of the team's own, and two more notes are written
  await page.locator(".app-group[data-group]").filter({ hasText: "Werkzeuge" }).locator(".app-group__head").click();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Titel der Gruppe" }).fill("Technik");
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-group[data-group]").filter({ hasText: "Technik" })).toHaveCount(1);
  for (const text of ["Pausen gemeinsam machen", "Pausen sind zu kurz"]) await writeNote(page, text);
  await expect(sentence(page)).toHaveText("10 Zettel, 8 davon in 2 Gruppen. 1 Person ist da.");
  const before = await layoutOf(page);
  const renamed = before.groups.find((group) => group.title === "Technik");
  const inIt = Object.entries(before.notes).filter(([, note]) => note.where === "in „Technik“");
  expect(inIt).toHaveLength(3);

  // „Ordnen“ again: the Worker hands the AI the seven other notes, and none of the renamed group's
  const answered = page.waitForResponse(ARRANGE);
  await button(page, "Ordnen").click();
  const { proposal } = (await (await answered).json()) as {
    proposal: { groups: Array<{ title: string; noteIds: string[] }>; loose: string[] };
  };
  const named = [...proposal.groups.flatMap((group) => group.noteIds), ...proposal.loose];
  expect(named).toHaveLength(7);
  for (const [id] of inIt) expect(named).not.toContain(id);
  expect(proposal.groups.map((group) => group.title)).toEqual(["Termine", "Pausen"]);

  // the preview: the frame of the first run that is still the AI's goes for the new ones; the renamed group stands
  // where it stood, with its notes, and nothing of the proposal lies on it
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  const preview = await layoutOf(page);
  expect(preview.groups.map((group) => group.title)).toEqual(["Pausen", "Technik", "Termine"]);
  expect(preview.groups.find((group) => group.title === "Technik")).toEqual(renamed);
  for (const [id, note] of inIt) expect(preview.notes[id]).toEqual(note);
  for (const group of preview.groups.filter((one) => one.title !== "Technik")) {
    expect(group.y).toBeGreaterThanOrEqual((renamed?.y ?? 0) + (renamed?.h ?? 0));
  }

  // applied: the same wall for good
  await button(page, "Anwenden").click();
  await expect(sentence(page)).toHaveText("10 Zettel in 3 Gruppen. 1 Person ist da.");
  expect(await layoutOf(page)).toEqual(preview);

  // taking the second run back leaves the renamed group too: the wall is what that run found
  await undo(page).click();
  await expect(sentence(page)).toHaveText("10 Zettel, 8 davon in 2 Gruppen. 1 Person ist da.");
  expect(await layoutOf(page)).toEqual(before);
  await expect(page.locator(".app-group[data-group]").filter({ hasText: "Technik" })).toHaveCount(1);
});

test("the whole of it in the list and by keyboard alone: arrange, discard, arrange, apply, take back", async ({
  page,
}) => {
  await onEight(page, "list");
  await expect(headings(page)).toHaveText(["Zettel 8"]);
  await expect(page.locator(".app-list__row button[aria-haspopup]")).toHaveCount(8);

  // „Ordnen“ by keyboard; the stand-in answers at once
  await tabTo(page, button(page, "Ordnen"));
  await page.keyboard.press("Enter");
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  // the list shows the proposal as its groups; while it stands no row and no heading has a menu
  await expect(headings(page)).toHaveText(["Termine 5", "Werkzeuge 3"]);
  await expect(page.locator(".app-list button[aria-haspopup]")).toHaveCount(0);
  // the focus is where the next step is: the key that was „Ordnen“ is „Anwenden“ now
  await expect(button(page, "Anwenden")).toBeFocused();

  // „Verwerfen“ is the key before it: the list is as it was, and the focus stays on that key, „Neuer Zettel“ again
  await page.keyboard.press("Shift+Tab");
  await expect(button(page, "Verwerfen")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(headings(page)).toHaveText(["Zettel 8"]);
  await expect(button(page, "Neuer Zettel")).toBeFocused();
  await expect(page.locator(".app-list__row button[aria-haspopup]")).toHaveCount(8);

  // once more, and „Anwenden“: the groups are the wall's, and the focus goes to the wall, which the action changed
  await page.keyboard.press("Tab");
  await expect(button(page, "Ordnen")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(button(page, "Anwenden")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(sentence(page)).toHaveText("8 Zettel in 2 Gruppen. 1 Person ist da.");
  await expect(headings(page)).toHaveText(["Termine 5", "Werkzeuge 3"]);
  await expect(page.locator(".app-list")).toBeFocused();
  // the list is a list again: every row and every heading has its menu
  await expect(page.locator(".app-list__row button[aria-haspopup]")).toHaveCount(8);
  await expect(page.locator(".app-list__head button[aria-haspopup]")).toHaveCount(2);

  // „Rückgängig“ by keyboard: at once, and the focus goes to the wall again, not to nowhere
  await tabTo(page, undo(page));
  await page.keyboard.press("Enter");
  await expect(headings(page)).toHaveText(["Zettel 8"]);
  await expect(page.locator(".app-list")).toBeFocused();
  await expect(undo(page)).toHaveCount(0);
});

test("on the surface by keyboard: the keys go from note to note of the proposal and change nothing; „Anwenden“ gives the surface the focus", async ({
  page,
}) => {
  const frames = sent(page);
  await onEight(page);
  const before = frames.length;
  await tabTo(page, button(page, "Ordnen"));
  await page.keyboard.press("Enter");
  await expect(button(page, "Anwenden")).toBeFocused();
  // back to the surface: the arrow keys walk the proposal, G goes to its groups; nothing edits, moves or deletes
  await tabTo(page, ground(page));
  await page.keyboard.press("ArrowRight");
  await expect(ground(page)).toHaveAttribute("aria-activedescendant", /^app-note-/);
  await page.keyboard.press("g");
  await expect(ground(page)).toHaveAttribute("aria-activedescendant", /^app-group-/);
  for (const key of ["Enter", "Delete", "m", "n", "v", "Space"]) await page.keyboard.press(key);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".app-surface__note-tools button")).toHaveCount(0);
  // the view still zooms and shows everything
  await page.keyboard.press("0");
  expect(frames.slice(before)).toEqual([]);

  await tabTo(page, button(page, "Anwenden"));
  await page.keyboard.press("Enter");
  await expect(sentence(page)).toHaveText("8 Zettel in 2 Gruppen. 1 Person ist da.");
  await expect(ground(page)).toBeFocused();
  // the surface is the moderation's to change again
  await page.keyboard.press("n");
  await expect(page.getByRole("textbox", { name: "Text des Zettels" })).toBeFocused();
});

test("a second moderation device gets the arrangement as everybody does, and can take it back", async ({
  page,
  browser,
}) => {
  const wall = await onEight(page);
  // the moderation link opened on another device: the same wall, moderated there too
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const second = await context.newPage();
  await second.goto("/");
  await know(second, [
    { id: page.url().split("/w/")[1] ?? "", question: QUESTION, as: "Dora", adminToken: wall.adminToken },
  ]);
  await lookAt(second, "surface");
  await second.goto(page.url());
  await expect(second.locator(".app-note[data-note]")).toHaveCount(8);
  await expect(primary(second)).toHaveText("Ordnen");

  await button(page, "Ordnen").click();
  await expect(page.locator(".app-group[data-group]")).toHaveCount(2);
  // the preview is the one browser's: the other moderation sees the wall as it is
  await expect(second.locator(".app-group")).toHaveCount(0);
  await button(page, "Anwenden").click();
  await expect(second.locator(".app-group[data-group]")).toHaveCount(2);
  // it saw the run arrive and nothing has changed since: „Rückgängig“ acts at once there too
  await undo(second).click();
  for (const one of [page, second]) await expect(one.locator(".app-group[data-group]")).toHaveCount(0);
  await expect(second.locator("dialog[open]")).toHaveCount(0);
  await context.close();
});

test("a moderation that comes later did not see the run arrive: there „Rückgängig“ asks first", async ({
  page,
  browser,
}) => {
  const wall = await onEight(page);
  await button(page, "Ordnen").click();
  await button(page, "Anwenden").click();
  await expect(undo(page)).toBeVisible();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const late = await context.newPage();
  await late.goto("/");
  await know(late, [
    { id: page.url().split("/w/")[1] ?? "", question: QUESTION, as: "Dora", adminToken: wall.adminToken },
  ]);
  await lookAt(late, "surface");
  await late.goto(page.url());
  await expect(late.locator(".app-group[data-group]")).toHaveCount(2);
  await expect(undo(late)).toHaveCount(0);
  await late.locator("[data-sb-web-app-head] [aria-haspopup=menu]").click();
  await late.getByRole("menuitem", { name: "Ordnen rückgängig machen", exact: true }).click();
  await expect(late.locator("#app-dlg-undo")).toBeVisible();
  await late.locator("#app-dlg-undo").getByRole("button", { name: "Rückgängig machen" }).click();
  for (const one of [page, late]) await expect(one.locator(".app-group[data-group]")).toHaveCount(0);
  await context.close();
});

test("a group made by hand is left alone: its notes stay in it, and the proposal lies under it", async ({ page }) => {
  // a wall with a group made by hand that holds two notes, and the eight notes beside it
  await enter(page, {
    hidden: false,
    notes: EIGHT,
    groups: [{ title: "Von Hand", notes: ["Termine am Montag", "Werkzeuge für alle"] }],
  });
  await expect(sentence(page)).toHaveText("10 Zettel, 2 davon in 1 Gruppe. 1 Person ist da.");
  const before = await layoutOf(page);
  const [hand] = before.groups;
  await button(page, "Ordnen").click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  const preview = await layoutOf(page);
  expect(preview.groups.map((group) => group.title)).toEqual(["Termine", "Von Hand", "Werkzeuge"]);
  // the frame made by hand and the notes in it lie where they lay, also the two that begin with the groups' words
  expect(preview.groups.find((group) => group.title === "Von Hand")).toEqual(hand);
  for (const [id, note] of Object.entries(before.notes)) {
    if (note.where === "in „Von Hand“") expect(preview.notes[id]).toEqual(note);
  }
  // everything the proposal places lies under it
  for (const group of preview.groups.filter((one) => one.title !== "Von Hand")) {
    expect(group.y).toBeGreaterThanOrEqual((hand?.y ?? 0) + (hand?.h ?? 0));
  }
  await button(page, "Anwenden").click();
  await expect(sentence(page)).toHaveText("10 Zettel in 3 Gruppen. 1 Person ist da.");
  expect(await layoutOf(page)).toEqual(preview);
  // taking it back: the hand-made group is as it was all along
  await undo(page).click();
  await expect(page.locator(".app-group[data-group]")).toHaveCount(1);
  expect(await layoutOf(page)).toEqual(before);
});

// The states of „Ordnen“ that screens.spec.ts cannot hold: an answer of the route that is put in its place with a
// failing status writes to the console, on purpose. Their own look, in light at 390 px and in dark at 1440 px: axe,
// no sideways scroll, no cut text, and the copy's check of a view. Both sentences of a budget that is spent: the
// product's own, which names when it goes on (here: on the next day), and Cloudflare's refusal, which cannot.
for (const [scheme, width, view] of [
  ["light", 390, "list"],
  ["dark", 1440, "surface"],
] as const) {
  for (const [who, sentence] of [
    [
      "the product's count",
      "Das Kontingent der KI ist aufgebraucht, für alle Wände. Morgen ab 00:01 Uhr geht es weiter. Von Hand ordnen geht immer.",
    ],
    [
      "Cloudflare",
      "Das Kontingent der KI bei Cloudflare ist aufgebraucht, für alle Wände. Wann es weitergeht, kann die App nicht sagen: spätestens in 24 Stunden. Von Hand ordnen geht immer.",
    ],
  ] as const) {
    test(`the AI's budget is spent by ${who}, ${scheme} ${width}px: axe, no sideways scroll, no cut text, one primary action`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: width < 640 ? 844 : 900 },
        colorScheme: scheme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const refused =
        who === "Cloudflare" ? { error: "AI_BUDGET_SPENT" } : { error: "AI_BUDGET_SPENT", resetsAt: goesOn().tomorrow };
      await page.route(ARRANGE, (route) => route.fulfill({ status: 429, json: refused }));
      await onEight(page, view);
      await button(page, "Ordnen").click();
      await expect(problem(page)).toHaveText(sentence);
      // The sentence took a part of the surface's height. The surface cuts what lies outside its view, on purpose,
      // and the check of cut text cannot tell that from a fault: every note is brought into view again
      if (view === "surface") await page.getByRole("button", { name: "Alles zeigen", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector(".app-surface__frame[data-moving]"));
      await page.evaluate(() => document.fonts.ready.then(() => true));
      expect(await page.evaluate(sidewaysScroll)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(collectCut)).toEqual([]);
      expect(await viewFaults(page, "src/sebaro/checks/sb-colour-count.js")).toEqual([]);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations.map((violation) => violation.id)).toEqual([]);
      await expect(page.locator(".sb-primary-action")).toHaveCount(1);
      const shot = `wand-ordnen-budget-${who === "Cloudflare" ? "cloudflare-" : ""}${scheme}-${width}.png`;
      await page.screenshot({ path: path.join(test.info().project.outputDir, "screens", shot) });
      await context.close();
    });
  }
}

test("the prompts and the providers' clients are in files that load only for a run with the moderation's own key; the stand-in is in none", () => {
  // @ideabeam/arrange brings the prompts, the run and the stand-in the Worker asks. Until stage 4b the app took the
  // layout of a proposal alone, and no file of it held a prompt. With „Eigener Schlüssel“ the moderation's browser
  // asks a provider itself, with the same prompts: they are in the app's files now, but in a part that is fetched
  // when such a run starts (src/lib/key-run.ts), and Anthropic's client in a part of its own (key-anthropic.ts).
  // Nobody who opens the app, a wall, or arranges with Cloudflare loads either.
  const dist = new URL("../dist/client/", import.meta.url).pathname;
  const files = path.join(dist, "assets");
  const scripts = readdirSync(files).filter((file) => file.endsWith(".js"));
  expect(scripts.length).toBeGreaterThan(3);
  const code = new Map(scripts.map((file) => [file, readFileSync(path.join(files, file), "utf8")]));
  const holding = (part: string) => scripts.filter((file) => code.get(file)?.includes(part));

  // the Worker's stand-in and the names of Cloudflare's models: still in no file of the app
  for (const part of ["Notes that begin with", "@cf/"]) expect(holding(part), part).toEqual([]);

  // every part of a prompt is in one file, the same one: the run with a key
  const prompts = ["sticky notes", "Assign every note", "Which themes do these notes fall into"];
  const [run, ...others] = [...new Set(prompts.flatMap(holding))];
  expect(others).toEqual([]);
  expect(run).toMatch(/^key-run-[\w-]+\.js$/);
  for (const part of prompts) expect(holding(part), part).toEqual([run]);
  // Anthropic's client is in another file, alone: the header only it sends, and the name of its API's version
  const [client, ...more] = holding("anthropic-dangerous-direct-browser-access");
  expect(more).toEqual([]);
  expect(client).toMatch(/^key-anthropic-[\w-]+\.js$/);
  expect(holding("anthropic-version")).toEqual([client]);

  // What a file loads with itself: the files it names in a plain `import … from` or `export … from`. A file it asks
  // for with `import(…)` is fetched only when that line runs.
  const names = (file: string, how: RegExp) => [...(code.get(file) ?? "").matchAll(how)].map(([, name]) => name ?? "");
  // (the build writes a file's name between any of the three kinds of quotes)
  const withItself = (file: string) => names(file, /\b(?:import|export)\b[^"'`()]*?["'`]\.\/([\w.-]+\.js)["'`]/g);
  const onDemand = (file: string) => names(file, /\bimport\(\s*["'`]\.\/([\w.-]+\.js)["'`]\s*\)/g);
  // the files the start names: the entry and what it loads with itself
  const page = readFileSync(path.join(dist, "index.html"), "utf8");
  const start = [...page.matchAll(/(?:src|href)="\/assets\/([\w.-]+\.js)"/g)].map(([, name]) => name ?? "");
  expect(start.length).toBeGreaterThan(1);

  // Everything the app can come to load without a run with a key: from the start on, through every file a file
  // loads with itself and every file it asks for on demand (a view, a part of a view), but never through the run.
  const reached = new Set<string>();
  const next = [...start];
  for (let file = next.pop(); file !== undefined; file = next.pop()) {
    if (reached.has(file) || file === run) continue;
    reached.add(file);
    next.push(...withItself(file), ...onDemand(file));
  }
  // (the reading itself: that is the start, the views and their parts, most of the app's files)
  expect(reached.size).toBeGreaterThan(10);
  for (const file of start) expect([...reached]).toContain(file);
  // none of them loads the run with itself: it is asked for on demand alone, by the wall
  for (const file of reached) expect(withItself(file), `${file} loads the prompts with itself`).not.toContain(run);
  expect([...reached].filter((file) => onDemand(file).includes(run ?? ""))).toHaveLength(1);
  // and Anthropic's client is behind the run: nothing else leads to it, and the run asks for it on demand alone
  expect([...reached]).not.toContain(client);
  expect(onDemand(run ?? "")).toContain(client);
  expect(withItself(run ?? "")).not.toContain(client);
});

test("a wall of the Worker's own making has no proposal stored anywhere: a reload forgets a preview", async ({
  page,
}) => {
  await onEight(page);
  await button(page, "Ordnen").click();
  await expect(page.locator(".app-group[data-group]")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".app-note[data-note]")).toHaveCount(8);
  await expect(page.locator(".app-group")).toHaveCount(0);
  await expect(primary(page)).toHaveText("Ordnen");
  // the run has counted all the same: the wall has five left today
  const left = await page.evaluate(async () => {
    const stored = JSON.parse(localStorage.getItem("ideabeam-walls") ?? "{}") as {
      state: { adminTokens: Record<string, string> };
    };
    const [[wallId, token] = ["", ""]] = Object.entries(stored.state.adminTokens);
    const response = await fetch(`/api/walls/${wallId}/arrange`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ language: "de" }),
    });
    return ((await response.json()) as { runsLeft: number }).runsLeft;
  });
  expect(left).toBe(4);
});
