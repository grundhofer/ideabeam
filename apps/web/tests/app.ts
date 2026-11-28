// What the end-to-end tests share: walls that exist on the Worker behind the built app, and a browser that knows
// walls, as one that was on them before.
import { randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";

const product = JSON.parse(readFileSync(new URL("../sebaro.product.json", import.meta.url), "utf8")) as { id: string };
const STORE = `${product.id}-walls`;
/** The browser's choice of how a wall is looked at (src/lib/wall-view.ts). */
const VIEW = `${product.id}-view`;
/** The host the tests run against: playwright.config.ts names it, in this one place. */
const host = () => new URL(test.info().project.use.baseURL ?? "").host;

const hex = (bytes: number) => randomBytes(bytes).toString("hex");

export const QUESTION = "Was hält uns bei der Arbeit auf?";
/** A question of the full length a wall takes: 140 characters. */
export const LONG_QUESTION =
  "Welche Ideen haben wir für das Sommerfest im Juli, wer kümmert sich um Essen, Musik und Programm, und was machen wir, wenn es regnen sollte?";

export type Known = {
  id: string;
  question: string;
  as?: string;
  adminToken?: string;
  sessionKey?: string;
  visited?: string;
};

/** Two walls a browser knows: one it was on, one it made and has not joined yet. They need not exist on the Worker:
 *  the list of walls is the browser's own. */
export const KNOWN: Known[] = [
  { id: "a".repeat(64), question: QUESTION, as: "Anna", visited: "2026-10-12T08:00:00.000Z" },
  { id: "b".repeat(64), question: LONG_QUESTION, visited: "2026-10-08T15:30:00.000Z" },
];

/** Puts walls into the storage of the page that is open, the first one visited last. The app reads them when it
 *  loads: reload or go on to another address after it. */
export async function know(page: Page, walls: Known[] = KNOWN) {
  const state = {
    displayName: walls.find((wall) => wall.as !== undefined)?.as ?? "",
    walls: walls.map((wall) => {
      const known: Record<string, string | undefined> = {
        sessionKey: hex(16),
        visited: "2026-10-10T08:00:00.000Z",
        ...wall,
      };
      // the tokens stand beside the walls, by wall
      delete known.adminToken;
      return known;
    }),
    adminTokens: Object.fromEntries(
      walls.flatMap((wall) => (wall.adminToken === undefined ? [] : [[wall.id, wall.adminToken]])),
    ),
  };
  const stored = JSON.stringify({ state, version: 1 });
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORE, stored] as const);
}

type Stored = { walls?: Array<{ question: string }>; adminTokens?: Record<string, string> };
const storedState = (page: Page) =>
  page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").state ?? {}) as Stored, STORE);

/** The walls the app has stored, by question. */
export const stored = async (page: Page) => ((await storedState(page)).walls ?? []).map((wall) => wall.question);

/** The admin tokens the app has stored, by wall. */
export const storedTokens = async (page: Page) => (await storedState(page)).adminTokens ?? {};

// Making walls is limited per client address, ten a minute, and outside Cloudflare nothing sets cf-connecting-ip:
// every page of the suite would draw from one bucket and the suite would throttle itself. So a page that makes
// walls says an address of its own; the limit itself stays in force (apps/worker/test/http.test.ts tests it).
export async function ownAddress(page: Page) {
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}` });
}

/** A wall on the Worker, made from the page that is open. It starts as the Worker starts a wall: with hidden writing,
 *  where nobody reads anybody else's notes and there are no groups until the moderation reveals. A test about an
 *  open wall says so: `hidden: false`. */
export async function makeWall(
  page: Page,
  question = QUESTION,
  options: { hidden?: boolean; agenda?: unknown } = {},
): Promise<{ wallId: string; adminToken: string }> {
  // the request is the page's own: a page that is nowhere yet goes to the app first
  if (!page.url().startsWith("http")) await page.goto("/");
  await ownAddress(page);
  return page.evaluate(
    async ({ question, hidden, agenda }) => {
      const response = await fetch("/api/walls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          ...(hidden === undefined ? {} : { hidden }),
          ...(agenda === undefined ? {} : { agenda }),
        }),
      });
      if (!response.ok) throw new Error(`the wall was not made: ${response.status}`);
      return (await response.json()) as { wallId: string; adminToken: string };
    },
    { question, hidden: options.hidden, agenda: options.agenda },
  );
}

/** A frame on the surface: its top left corner and its size, in world units. */
export type Frame = { x: number; y: number; w: number; h: number };

/** Somebody on the wall who is no browser. */
export type Guest = {
  leave(): Promise<void>;
  /** Writes a note at a place of the surface; resolves with the note's id once the wall has taken it. */
  write(text: string, x?: number, y?: number): Promise<string>;
  /** Makes a group with a frame; resolves with the group's id once the wall has taken it. */
  group(title: string, frame: Frame): Promise<string>;
  /** Moves notes, each to a place and into a group or none, in one command. */
  move(moves: Array<{ noteId: string; x: number; y: number; groupId: string | null }>): Promise<void>;
  /** The moderation's: sets the writing's clock to so many minutes and lets it run. */
  startClock(minutes: number): Promise<void>;
  /** The moderation's: moves the wall from one step to another. */
  go(from: number, to: number): Promise<void>;
  /** A ballot for a step that votes (stage M2). */
  cast(step: number, ballot: Record<string, unknown>): Promise<void>;
  /** The moderation's: counts the vote of the step the wall is in. */
  count(step: number): Promise<void>;
  /** The moderation's „Nächster Zettel“ in a step that reveals by turn (stage M5), made for `shown` shown notes. */
  turn(step: number, shown: number): Promise<void>;
  /** The moderation's: agrees on an action with who and by when (stage M5), or (null) no longer; records a decision
   *  or a measurable result with their fields (stage M6). */
  agree(
    noteId: string,
    action: { who: string; due: string; why?: string; open?: string; target?: string; goal?: string } | null,
  ): Promise<void>;
};

/** Somebody on the wall who is no browser: a socket of the test itself; with the wall's admin token, its
 *  moderation. Resolves once the wall has let them on, with the way to write a note and to leave again. */
export function join(wallId: string, name: string, adminToken?: string): Promise<Guest> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${host()}/api/walls/${wallId}/ws`);
    const fail = setTimeout(() => reject(new Error(`${name} did not get on the wall`)), 5000);
    const left = new Promise<void>((done) => ws.addEventListener("close", () => done()));
    // the commands the wall has not answered yet, by their operation
    const asked = new Map<string, { done(): void; refuse(why: Error): void }>();
    /** Sends a command and resolves once the wall has taken it. */
    const ask = (command: Record<string, unknown>) =>
      new Promise<void>((done, refuse) => {
        const opId = hex(16);
        asked.set(opId, { done, refuse });
        ws.send(JSON.stringify({ ...command, opId }));
      });
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "join", name, sessionKey: hex(16), adminToken })));
    // the revision of the wall's clock: a control names the one it is made for
    let rev = 0;
    ws.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data)) as {
        type: string;
        opId?: string;
        code?: string;
        clock?: { rev: number };
      };
      if (frame.clock !== undefined) rev = frame.clock.rev;
      if (frame.type === "ack" || frame.type === "reject") {
        const answer = asked.get(frame.opId ?? "");
        asked.delete(frame.opId ?? "");
        if (frame.type === "ack") answer?.done();
        else answer?.refuse(new Error(`${name}: the wall refused, ${frame.code}`));
      }
      if (frame.type !== "sync") return;
      clearTimeout(fail);
      resolve({
        leave: () => {
          ws.close();
          return left;
        },
        write: async (text, x = 0, y = 0) => {
          const noteId = hex(16);
          await ask({ type: "note.create", noteId, text, x, y });
          return noteId;
        },
        group: async (title, frame) => {
          const groupId = hex(16);
          await ask({ type: "group.create", groupId, title, ...frame });
          return groupId;
        },
        move: (moves) => ask({ type: "notes.move", moves }),
        startClock: (minutes) => ask({ type: "admin.clock.start", rev, minutes }),
        go: (from, to) => ask({ type: "admin.step.go", from, to }),
        cast: (step, ballot) => ask({ type: "ballot.cast", step, ballot }),
        count: (step) => ask({ type: "admin.step.count", step }),
        turn: (step, shown) => ask({ type: "admin.turn.next", step, shown }),
        agree: (noteId, action) => ask({ type: "note.action", noteId, action }),
      });
    });
    ws.addEventListener("error", () => reject(new Error(`${name}: the socket failed`)));
  });
}

/** A group as a test lays it out: its title (empty: none yet) and the notes in it. */
export type GroupSeed = { title: string; notes: string[] };

// a frame of the tests: as wide as two notes with their room, and 32 units to the next one
const FRAME = { w: 528, pitch: 560, head: 40, row: 168 };

/** Somebody who was on the wall and has left again: the wall knows them, they are not here. With `notes`, they
 *  wrote these before they left: in rows of three, from the middle of the surface on. With `groups`, they made
 *  these too, frames side by side from the world's origin on with their notes in two columns, and the `notes`
 *  lie in rows of three under the frames, without a group. */
export async function visit(wallId: string, name: string, notes: string[] = [], groups: GroupSeed[] = []) {
  const guest = await join(wallId, name);
  const moves: Array<{ noteId: string; x: number; y: number; groupId: string }> = [];
  let deepest = 0;
  for (const [g, group] of groups.entries()) {
    const frame = {
      x: g * FRAME.pitch,
      y: 0,
      w: FRAME.w,
      h: Math.max(280, FRAME.head + Math.ceil(group.notes.length / 2) * FRAME.row),
    };
    const groupId = await guest.group(group.title, frame);
    for (const [n, text] of group.notes.entries()) {
      const at = { x: frame.x + 16 + (n % 2) * 256, y: FRAME.head + Math.floor(n / 2) * FRAME.row };
      moves.push({ noteId: await guest.write(text, at.x, at.y), ...at, groupId });
    }
    deepest = Math.max(deepest, frame.h);
  }
  // a note is made without a group: one command says which group each of them lies in
  if (moves.length > 0) await guest.move(moves);
  const [left, top] = groups.length > 0 ? [0, deepest + 48] : [-376, -180];
  for (const [n, text] of notes.entries()) await guest.write(text, left + (n % 3) * 256, top + Math.floor(n / 3) * 200);
  await guest.leave();
}

/** Notes as a brainstorming leaves them: short ones, a long one, one of the full length. */
export const NOTES = [
  "Weniger Termine",
  "Entscheidungen aufschreiben",
  "Zwei Ticket-Systeme nebeneinander: eins davon abschalten",
  "Jeden Montag eine halbe Stunde planen, statt jeden Tag eine Viertelstunde, und die Ergebnisse aufschreiben",
  "Fokuszeit am Vormittag",
  "Wir sollten die Abstimmung zwischen den Teams verbessern, indem wir einmal pro Woche ein kurzes gemeinsames Treffen machen, bei dem jedes Team sagt, woran es arbeitet und wo es hängt. Das spart am Ende mehr Zeit, als es kostet, und alle wissen, was die anderen brauchen und liefern können.",
];

/** Groups as a brainstorming leaves them half-way: two with a name, one still without; with NOTES under them
 *  some notes lie in no group. */
export const GROUPS: GroupSeed[] = [
  {
    title: "Abstimmung",
    notes: ["Unklar, wer entscheidet", "Zu viele Termine ohne Ergebnis", "Wer ist wofür zuständig?"],
  },
  { title: "Werkzeuge", notes: ["Der Build dauert zu lange", "Dokumentation dort, wo der Code liegt"] },
  { title: "", notes: ["Mehr Pausen"] },
];

/** Sets how this browser looks at walls, as its choice: the surface or the list; null takes the choice away, so
 *  the width decides. The app reads it when a wall opens. */
export async function lookAt(page: Page, view: "surface" | "list" | null) {
  await page.evaluate(
    ([key, value]) => (value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value)),
    [VIEW, view] as const,
  );
}

/** Makes a wall and goes onto it as its moderation: the browser holds the admin token and has been on the wall
 *  under the name. With `others`, they were on the wall before and have left; with `notes` and `groups`, the first
 *  of them wrote and made these (`visit`). The wall opens as its surface, at every width, unless `view` says the
 *  list, or null: as the product decides by the window's width. The wall starts with hidden writing, as the product
 *  makes it, unless `hidden: false` asks for an open one: only an open wall has groups, and only on an open wall
 *  does this browser get the others' notes. Returns the wall. */
export async function enter(
  page: Page,
  options: {
    question?: string;
    as?: string;
    others?: string[];
    notes?: string[];
    groups?: GroupSeed[];
    view?: "surface" | "list" | null;
    hidden?: boolean;
  } = {},
) {
  const { question = QUESTION, as = "Anna", others = [], notes = [], groups = [], view = "surface", hidden } = options;
  const wall = await makeWall(page, question, { hidden });
  const filled = notes.length > 0 || groups.length > 0;
  for (const [n, other] of (filled && others.length === 0 ? ["Ben"] : others).entries())
    await visit(wall.wallId, other, n === 0 ? notes : [], n === 0 ? groups : []);
  await know(page, [{ id: wall.wallId, question, as, adminToken: wall.adminToken }]);
  await lookAt(page, view);
  await page.goto(`/w/${wall.wallId}`);
  // the wall stands once its surface or its list does, with every note the wall holds; while the notes are hidden
  // this browser gets none of the others'
  await page.locator(".app-surface__ground, .app-list").waitFor();
  const count = notes.length + groups.reduce((sum, group) => sum + group.notes.length, 0);
  await expect(page.locator(".app-note, .app-list__row")).toHaveCount(hidden === false ? count : 0);
  return wall;
}

/** The surface of the wall: its one tab stop, the list box of the notes. */
export const ground = (page: Page) => page.getByRole("listbox", { name: "Zettel auf der Fläche" });

/** A note on the surface, by its text. */
export const note = (page: Page, text: string) => page.locator(".app-note[data-note]").filter({ hasText: text });

/** Where a note lies on the surface, in world units (its place is written in rem: 16 units each). */
export const placeOf = (target: Locator) =>
  target.evaluate((el: HTMLElement) => ({
    x: Math.round(parseFloat(el.style.left) * 16),
    y: Math.round(parseFloat(el.style.top) * 16),
  }));

/** A group's frame on the surface, by its title. */
export const frame = (page: Page, title: string) => page.locator(".app-group[data-group]").filter({ hasText: title });

/** Where a frame lies on the surface and how large it is, in world units. */
export const frameOf = (target: Locator) =>
  target.evaluate((el: HTMLElement) => ({
    x: Math.round(parseFloat(el.style.left) * 16),
    y: Math.round(parseFloat(el.style.top) * 16),
    w: Math.round(parseFloat(el.style.inlineSize) * 16),
    h: Math.round(parseFloat(el.style.blockSize) * 16),
  }));

/** A note's row in the list, by its text. */
export const row = (page: Page, text: string) => page.locator(".app-list__row").filter({ hasText: text });

/** Writes a note through the wall's primary action, as a person does. */
export async function writeNote(page: Page, text: string) {
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await page.getByRole("textbox", { name: "Text des Zettels" }).fill(text);
  await page.keyboard.press("Enter");
  await expect(note(page, text)).toHaveCount(1);
}

/** The wall's „Mehr“ menu in its head, opened. Its rows are menu items: `row(name)` is one of them. */
export async function openMore(page: Page) {
  await page.locator("[data-sb-web-app-head] [aria-haspopup=menu]").click();
  const menu = page.locator("#app-more");
  await menu.waitFor();
  return { menu, row: (name: string) => menu.getByRole("menuitem", { name, exact: true }) };
}

/** The switch that offers the providers of „Eigener Schlüssel“ whose model is not measured yet (src/lib/key-switch.ts),
 *  set for the page that is on a wall: the part of the address's fragment a person would add by hand. The app reads
 *  it and takes it out of the address at once. */
export async function offerOwnKey(page: Page) {
  await page.evaluate(() => {
    location.hash = "eigener-schluessel";
  });
  await expect(page).toHaveURL(/\/w\/[0-9a-f]{64}$/);
}

/** The dialog „Eigener KI-Schlüssel“, opened from the wall's „Mehr“. */
export async function openOwnKey(page: Page) {
  const { row } = await openMore(page);
  await row("Eigener KI-Schlüssel …").click();
  const dialog = page.locator("#app-dlg-key");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Enters a key for a provider, as the moderation does: the dialog, the provider's row, the field, „Übernehmen“. */
export async function takeOwnKey(page: Page, provider: string, key: string) {
  const dialog = await openOwnKey(page);
  await dialog.getByRole("radio", { name: provider, exact: true }).check();
  await dialog.getByLabel("Schlüssel", { exact: true }).fill(key);
  await dialog.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** „Still sammeln“ in its vote (stage M2): write 0, reveal 1, group 2, vote 3, discuss 4. */
export const VOTE_STEP = 3;
/** The texts of the notes of a wall in its vote: the first two lie in the group „Abstimmung“. */
export const VOTE_NOTES = [
  "Weniger Termine",
  "Entscheidungen aufschreiben",
  "Fokuszeit am Vormittag",
  "Mehr Pausen",
  "Ein Board für alles",
];

/** A wall of „Still sammeln“ that has reached its vote, made by a moderation that is no browser (Ben): five notes,
 *  the first two in the group „Abstimmung“, so the options are that group and the three other notes, and the budget
 *  is two points. With `counted`, Ben gives the group two points and counts. Ben leaves; the page goes onto the wall
 *  as Anna, with the wall's admin token where `admin` says so. Returns the wall, the group and the notes. */
export async function enterVote(page: Page, options: { counted?: boolean; admin?: boolean; question?: string } = {}) {
  const { counted = false, admin = false, question = QUESTION } = options;
  const wall = await makeWall(page, question);
  const ben = await join(wall.wallId, "Ben", wall.adminToken);
  const notes: string[] = [];
  for (const [n, text] of VOTE_NOTES.entries()) notes.push(await ben.write(text, n * 256, 400));
  await ben.go(0, 1);
  await ben.go(1, 2);
  const groupId = await ben.group("Abstimmung", { x: 0, y: 0, w: 528, h: 280 });
  await ben.move(notes.slice(0, 2).map((noteId, n) => ({ noteId, x: 16 + n * 256, y: 40, groupId })));
  await ben.go(2, VOTE_STEP);
  if (counted) {
    await ben.cast(VOTE_STEP, { kind: "dots", points: { [groupId]: 2 } });
    await ben.count(VOTE_STEP);
  }
  await ben.leave();
  await know(page, [{ id: wall.wallId, question, as: "Anna", ...(admin ? { adminToken: wall.adminToken } : {}) }]);
  await page.goto(`/w/${wall.wallId}`);
  await page
    .locator(counted ? ".app-results" : ".app-ballot")
    .first()
    .waitFor();
  return { ...wall, groupId, notes };
}

/** „Schätzen – Diskutieren – Schätzen“ (stage M3): first estimate 0, feedback 1, discuss 2, estimate again 3,
 *  result 4. Its unit on these walls is „Tage“. */
export const ESTIMATE_STEPS = { first: 0, feedback: 1, discuss: 2, again: 3, result: 4 } as const;
export const ESTIMATE_QUESTION = "Wie viele Tage braucht der Umzug?";
export const ESTIMATE_AGENDA = { items: [{ methodId: "schaetzen", unit: "Tage" }] };

/** A wall of „Schätzen“ made by a moderation that is no browser (Ben). `round` 1: in its first estimate, where Ben
 *  estimates 30 with the reason „Wie beim letzten Umzug“; `counted`: Ben counts it. `round` 2: Ben has counted the
 *  first round, revealed the reasons, discussed and gone on to the second estimate; `counted`: Ben estimates 34
 *  there and counts. Ben leaves; the page goes onto the wall as Anna, with the admin token where `admin` says so. */
export async function enterEstimate(page: Page, options: { round?: 1 | 2; counted?: boolean; admin?: boolean } = {}) {
  const { round = 1, counted = false, admin = false } = options;
  const wall = await makeWall(page, ESTIMATE_QUESTION, { agenda: ESTIMATE_AGENDA });
  const ben = await join(wall.wallId, "Ben", wall.adminToken);
  const { first, feedback, discuss, again } = ESTIMATE_STEPS;
  await ben.cast(first, { kind: "estimate", value: 30 });
  await ben.write("Wie beim letzten Umzug", 0, 0);
  if (round === 2 || counted) await ben.count(first);
  if (round === 2) {
    await ben.go(first, feedback);
    await ben.go(feedback, discuss);
    await ben.go(discuss, again);
    if (counted) {
      await ben.cast(again, { kind: "estimate", value: 34 });
      await ben.count(again);
    }
  }
  await ben.leave();
  await know(page, [
    { id: wall.wallId, question: ESTIMATE_QUESTION, as: "Anna", ...(admin ? { adminToken: wall.adminToken } : {}) },
  ]);
  await page.goto(`/w/${wall.wallId}`);
  await page
    .locator(counted ? ".app-results" : ".app-estimate")
    .first()
    .waitFor();
  return wall;
}

/** „1-2-4-Alle“ (stage M4): alone 0, pairs 1, fours 2, presenting 3. */
export const TEAM_STEPS = { alone: 0, pairs: 1, fours: 2, present: 3 } as const;
export const TEAM_QUESTION = "Wie arbeiten wir neue Leute schneller ein?";

/** A wall of „1-2-4-Alle“ in its pairs: the page is on it as Anna (with the admin token where `admin` says so) and
 *  three guests who are no browser, Ben (who moderates too), Cem and Dora, each writes a note alone; then Ben moves the
 *  wall into the pairs, which the app forms from the four who are there. The guests stay on the wall. With `fours`,
 *  Ben moves on into the fours as well. */
export async function enterTeams(
  page: Page,
  options: { admin?: boolean; view?: "surface" | "list"; fours?: boolean } = {},
) {
  const { admin = false, view = "surface", fours = false } = options;
  const wall = await makeWall(page, TEAM_QUESTION, { agenda: { items: [{ methodId: "eins-zwei-vier" }] } });
  await know(page, [
    { id: wall.wallId, question: TEAM_QUESTION, as: "Anna", ...(admin ? { adminToken: wall.adminToken } : {}) },
  ]);
  await lookAt(page, view);
  await page.goto(`/w/${wall.wallId}`);
  await page.locator(".app-surface__ground, .app-list").waitFor();
  const ben = await join(wall.wallId, "Ben", wall.adminToken);
  const cem = await join(wall.wallId, "Cem");
  const dora = await join(wall.wallId, "Dora");
  await ben.write("Ein Pate für die erste Woche", 0, 0);
  await cem.write("Zugänge am ersten Tag bereit", 260, 0);
  await dora.write("Ein Glossar der Abkürzungen", 520, 0);
  await ben.go(TEAM_STEPS.alone, TEAM_STEPS.pairs);
  if (fours) await ben.go(TEAM_STEPS.pairs, TEAM_STEPS.fours);
  await expect(page.locator(".app-state__team")).toContainText(/^Du bist in Team \d mit /);
  return { ...wall, guests: [ben, cem, dora] };
}

/** „Stille Ideenrunde mit Rangfolge“ (stage M5): collect 0, reveal by turn 1, clarify 2, rank 3, result 4. */
export const ROUND_STEPS = { collect: 0, reveal: 1, clarify: 2, rank: 3, result: 4 } as const;
export const ROUND_QUESTION = "Was soll das Team als Nächstes angehen?";
export const ROUND_IDEAS = [
  "Onboarding verkürzen",
  "Tests stabilisieren",
  "Release-Notizen automatisieren",
  "Doku aufräumen",
];

/** A wall of „Stille Ideenrunde“ made by a moderation that is no browser (Ben), who writes the four ideas and moves on
 *  into revealing by turn, where `shown` of them are shown (two by default); with `rank`, Ben shows them all, clarifies
 *  and moves into the ranking. Ben leaves; the page goes onto the wall as Anna, with the admin token where `admin`
 *  says so. */
export async function enterRound(page: Page, options: { admin?: boolean; shown?: number; rank?: boolean } = {}) {
  const { admin = false, shown = 2, rank = false } = options;
  const wall = await makeWall(page, ROUND_QUESTION, { agenda: { items: [{ methodId: "ideenrunde" }] } });
  const ben = await join(wall.wallId, "Ben", wall.adminToken);
  for (const [n, text] of ROUND_IDEAS.entries()) await ben.write(text, n * 256, 0);
  await ben.go(ROUND_STEPS.collect, ROUND_STEPS.reveal);
  const turns = rank ? ROUND_IDEAS.length : shown;
  for (let n = 0; n < turns; n++) await ben.turn(ROUND_STEPS.reveal, n);
  if (rank) {
    await ben.go(ROUND_STEPS.reveal, ROUND_STEPS.clarify);
    await ben.go(ROUND_STEPS.clarify, ROUND_STEPS.rank);
  }
  await ben.leave();
  await know(page, [
    { id: wall.wallId, question: ROUND_QUESTION, as: "Anna", ...(admin ? { adminToken: wall.adminToken } : {}) },
  ]);
  // the surface also on a phone, where the app would show the list
  await lookAt(page, "surface");
  await page.goto(`/w/${wall.wallId}`);
  await page
    .locator(rank ? ".app-rank" : ".app-state__sentence")
    .first()
    .waitFor();
  return wall;
}

/** „Scheitern vorwegdenken“ (stage M5): the plan 0, reasons 1, reveal by turn 2, risks 3, adjust the plan 4. */
export const FAILURE_STEPS = { plan: 0, reasons: 1, reveal: 2, risks: 3, adjust: 4 } as const;
export const FAILURE_QUESTION = "Plan: Umzug in die neue Cloud bis März";

/** A wall of „Scheitern vorwegdenken“ in its last step, made by a moderation that is no browser (Ben): two reasons,
 *  revealed, and two changes to the plan, the first agreed on with who and by when. Ben leaves; the page goes onto the
 *  wall as Anna, with the admin token where `admin` says so. */
export async function enterAdjust(page: Page, options: { admin?: boolean } = {}) {
  const { admin = false } = options;
  const wall = await makeWall(page, FAILURE_QUESTION, { agenda: { items: [{ methodId: "scheitern" }] } });
  const ben = await join(wall.wallId, "Ben", wall.adminToken);
  await ben.go(FAILURE_STEPS.plan, FAILURE_STEPS.reasons);
  await ben.write("Niemand kennt die alten Skripte", 0, 0);
  await ben.write("Die Kosten steigen im ersten Monat", 256, 0);
  await ben.go(FAILURE_STEPS.reasons, FAILURE_STEPS.reveal);
  await ben.go(FAILURE_STEPS.reveal, FAILURE_STEPS.risks);
  await ben.go(FAILURE_STEPS.risks, FAILURE_STEPS.adjust);
  const first = await ben.write("Skripte vorher dokumentieren", 0, 400);
  await ben.write("Budget für den ersten Monat freigeben", 256, 400);
  await ben.agree(first, { who: "Dora", due: "15. Januar" });
  await ben.leave();
  await know(page, [
    { id: wall.wallId, question: FAILURE_QUESTION, as: "Anna", ...(admin ? { adminToken: wall.adminToken } : {}) },
  ]);
  await page.goto(`/w/${wall.wallId}`);
  await page.locator(".app-actions").waitFor();
  return wall;
}

/** „Kriterienbewertung“ (stage M6): criteria 0, agree 1, options 2, score 3, discuss 4, decide 5. */
export const CRITERIA_STEPS = { criteria: 0, agree: 1, options: 2, score: 3, discuss: 4, decide: 5 } as const;
export const CRITERIA_QUESTION = "Welchen Anbieter nehmen wir?";

/** A wall of „Kriterienbewertung“ in its score, made by a moderation that is no browser (Ben): three criteria, the
 *  last of them long, and two options. With `counted`, Ben scores and counts. Ben leaves; the page goes onto the
 *  wall as Anna, with the admin token where `admin` says so. */
export async function enterScore(page: Page, options: { admin?: boolean; counted?: boolean } = {}) {
  const { admin = false, counted = false } = options;
  const wall = await makeWall(page, CRITERIA_QUESTION, { agenda: { items: [{ methodId: "kriterien" }] } });
  const ben = await join(wall.wallId, "Ben", wall.adminToken);
  const { criteria, agree, options: optionsStep, score } = CRITERIA_STEPS;
  await ben.write("Geringe Kosten");
  await ben.write("Schneller Start");
  await ben.write("Guter Support auch am Wochenende und in den Ferien");
  await ben.go(criteria, agree);
  await ben.go(agree, optionsStep);
  const a = await ben.write("Anbieter A", 0, 400);
  const b = await ben.write("Anbieter B mit dem längeren Namen", 256, 400);
  await ben.go(optionsStep, score);
  if (counted) {
    await ben.cast(score, { kind: "score", scores: { [a]: [5, 4, 3], [b]: [2, 3, 4] } });
    await ben.count(score);
  }
  await ben.leave();
  await know(page, [
    { id: wall.wallId, question: CRITERIA_QUESTION, as: "Anna", ...(admin ? { adminToken: wall.adminToken } : {}) },
  ]);
  await page.goto(`/w/${wall.wallId}`);
  await page
    .locator(counted ? ".app-score__table" : ".app-score")
    .first()
    .waitFor();
  return wall;
}

/** „Entscheidungsprotokoll mit Zustimmungsrunde“ (stage M6): frame 0, proposal 1, questions 2, reactions 3, consent
 *  4, objections 5, record 6. */
export const CONSENT_STEPS = {
  frame: 0,
  proposal: 1,
  questions: 2,
  reactions: 3,
  consent: 4,
  objections: 5,
  record: 6,
} as const;
export const CONSENT_QUESTION = "Welchen Anbieter nehmen wir?";

/** A wall of „Entscheidungsprotokoll“ made by a moderation that is no browser (Ben): the proposal, and the consent
 *  round open. With `counted`, Ben objects with a reason and counts. With `record`, Ben goes on to the last step and
 *  writes two decisions, the first recorded with reasons, open objections and a review date. Ben leaves; the page goes
 *  onto the wall as Anna, with the admin token where `admin` says so. */
export async function enterConsent(page: Page, options: { admin?: boolean; counted?: boolean; record?: boolean } = {}) {
  const { admin = false, counted = false, record = false } = options;
  const wall = await makeWall(page, CONSENT_QUESTION, { agenda: { items: [{ methodId: "entscheidung" }] } });
  const ben = await join(wall.wallId, "Ben", wall.adminToken);
  const steps = CONSENT_STEPS;
  await ben.go(steps.frame, steps.proposal);
  await ben.write("Anbieter B für ein Jahr, mit einer Kündigungsfrist von drei Monaten");
  await ben.go(steps.proposal, steps.questions);
  await ben.go(steps.questions, steps.reactions);
  await ben.go(steps.reactions, steps.consent);
  if (counted || record) {
    await ben.cast(steps.consent, { kind: "consent", answer: "object", reason: "Ein Jahr Bindung ist zu lang" });
    await ben.count(steps.consent);
  }
  if (record) {
    await ben.go(steps.consent, steps.objections);
    await ben.go(steps.objections, steps.record);
    const first = await ben.write("Anbieter B für sechs Monate", 0, 400);
    await ben.write("Im Juni neu entscheiden", 256, 400);
    await ben.agree(first, { who: "", due: "1. Juni", why: "Kürzere Bindung", open: "Preis im zweiten Halbjahr" });
  }
  await ben.leave();
  await know(page, [
    { id: wall.wallId, question: CONSENT_QUESTION, as: "Anna", ...(admin ? { adminToken: wall.adminToken } : {}) },
  ]);
  await page.goto(`/w/${wall.wallId}`);
  await page
    .locator(record ? ".app-actions" : counted ? ".app-results" : ".app-consent")
    .first()
    .waitFor();
  return wall;
}

/** „Ziele mit messbaren Ergebnissen“ (stage M6) in its last step, made by a moderation that is no browser (Ben): two
 *  goals, both chosen, and two results, the first recorded with its goal, target, owner and review date. Ben leaves;
 *  the page goes onto the wall as Anna, with the admin token where `admin` says so. */
export const GOALS_QUESTION = "Unsere Ziele fürs erste Quartal";
export async function enterGoals(page: Page, options: { admin?: boolean } = {}) {
  const { admin = false } = options;
  const wall = await makeWall(page, GOALS_QUESTION, { agenda: { items: [{ methodId: "ziele" }] } });
  const ben = await join(wall.wallId, "Ben", wall.adminToken);
  await ben.go(0, 1);
  const faster = await ben.write("Schnellerer Support");
  const calmer = await ben.write("Ruhigere Releases", 256, 0);
  await ben.go(1, 2);
  await ben.go(2, 3);
  await ben.cast(3, { kind: "approval", chosen: [faster, calmer] });
  await ben.count(3);
  await ben.go(3, 4);
  const first = await ben.write("Antwort innerhalb eines Tages", 16, 1300);
  await ben.write("Weniger Rückfragen je Ticket", 272, 1300);
  await ben.go(4, 5);
  await ben.go(5, 6);
  await ben.agree(first, { who: "Ben", due: "Ende März", target: "von 3 auf 1 Tag", goal: faster });
  await ben.leave();
  await know(page, [
    { id: wall.wallId, question: GOALS_QUESTION, as: "Anna", ...(admin ? { adminToken: wall.adminToken } : {}) },
  ]);
  await page.goto(`/w/${wall.wallId}`);
  await page.locator(".app-actions").waitFor();
  return wall;
}
