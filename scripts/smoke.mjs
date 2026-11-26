// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// smoke.mjs: the smoke test of a deployment (PLAN.md, stage 5: „Rauchtest auf der Produktionsadresse mit zwei
// Browsern“). Two people, each in a browser of their own, go once through what the product is for, through its
// interface, as a person does:
//
//   1. Anna makes a wall through the start page („Neue Wand“, the question, „Wand anlegen“) and joins it.
//   2. Ben opens the wall's link (the address of Anna's tab, which holds no token) and joins with his name.
//   3. Both write notes while the writing is hidden. Neither page shows the other's text.
//   4. Anna reveals. Both pages show every note.
//   5. With --ordnen only: Anna presses „Ordnen“ and „Anwenden“, and Ben sees the groups. Without the flag nobody
//      presses „Ordnen“: on a deployment it spends neurons of the day's budget (some 30 for this wall).
//   6. Anna saves the wall as Markdown („Als Markdown sichern“ under „Mehr“), and the file holds the question and
//      every note, and neither name.
//   7. Anna deletes the wall („Wand löschen“). Both pages say so, and the wall's address answers 404.
//
//   node scripts/smoke.mjs https://ideabeam.de [--ordnen] [--headed]
//   node scripts/smoke.mjs --selftest            # against `vite preview` of the last build, on this machine
//   node scripts/smoke.mjs http://127.0.0.1:4173  # against a preview that is already running
//
// The two browsers are Chromium and Firefox where Playwright's Firefox is installed
// (`pnpm --filter @ideabeam/web exec playwright install firefox`); otherwise two contexts of one Chromium, and the
// script says so in its first line and its last.
//
// What it costs on a deployment: one of the day's walls (DAILY_WALLS in apps/worker/wrangler.jsonc), some 35 rows
// written (making the wall, two people, four notes, revealing, deleting; apps/worker/test/cost.test.ts counts the
// same steps), a few dozen requests; with --ordnen eight notes and one run of the AI. The wall is deleted at the end,
// also when a step failed: through the interface, or, where that failed, through a socket of Anna's page with her
// moderation token, which stays inside that page. The script prints no token and no moderation link. Only when the
// wall could not be deleted does it print the wall's id, which is the capability of everybody on it: it deletes
// itself 30 days after the last join.
//
// --selftest starts `pnpm --filter @ideabeam/web preview` (the build in apps/web/dist, port 4173, strict) as a child,
// runs against it and stops that child by its own PID. Build first (`pnpm build`). A port that is taken is refused,
// never freed: wait and try again. Locally the Worker asks the stand-in for the AI (apps/worker/.dev.vars), so
// --ordnen spends nothing there.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const SELFTEST = args.includes("--selftest");
const ARRANGE = args.includes("--ordnen");
const HEADED = args.includes("--headed");
const given = args.find((arg) => !arg.startsWith("--"));
const LOCAL_PREVIEW = "http://127.0.0.1:4173";

if ((!SELFTEST && !given) || (given && !/^https?:\/\//.test(given)) || (SELFTEST && given)) {
  console.error("usage: node scripts/smoke.mjs <https://address> [--ordnen] [--headed]  |  --selftest [--ordnen]");
  process.exit(2);
}
const origin = new URL(SELFTEST ? LOCAL_PREVIEW : given).origin;
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(origin).hostname);
if (!local && new URL(origin).protocol !== "https:") {
  console.error("A deployment is reached over https.");
  process.exit(2);
}

// Playwright is the web app's: the same version the end-to-end tests run
const web = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { chromium, firefox } = web("@playwright/test");

const QUESTION = "Rauchtest: Was bremst uns?";
// the names must stand in no note and not in the question: the file may hold neither
const ANNA = "Smokeanna";
const BEN = "Smokeben";
const ANNA_NOTES = ["Termine: zu viele Besprechungen am Morgen", "Werkzeuge: der Build dauert zu lange"];
const BEN_NOTES = ["Termine: Absprachen kommen zu spät", "Werkzeuge: das Testsystem ist oft belegt"];
// „Ordnen“ needs more notes than that; the stand-in groups by the first word, the AI by meaning
const MORE_ANNA = ["Termine: kein fester Tag für die Planung", "Werkzeuge: die Suche im Wiki findet nichts"];
const MORE_BEN = ["Termine: der Kalender ist immer voll", "Werkzeuge: Zugänge dauern Wochen"];
const annaNotes = ARRANGE ? [...ANNA_NOTES, ...MORE_ANNA] : ANNA_NOTES;
const benNotes = ARRANGE ? [...BEN_NOTES, ...MORE_BEN] : BEN_NOTES;

const TIMEOUT = 20_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let step = 0;
const say = (line) => console.log(`${++step}. ${line}`);

/** Waits until `check` holds, or fails with `what` after `ms`. */
async function until(what, check, ms = TIMEOUT) {
  const end = Date.now() + ms;
  for (;;) {
    if (await check()) return;
    if (Date.now() > end) throw new Error(`not seen within ${ms / 1000} s: ${what}`);
    await sleep(200);
  }
}

// ── the local preview, for --selftest ──
let server = null;
async function startPreview() {
  if (!existsSync(fileURLToPath(new URL("../apps/web/dist/client/index.html", import.meta.url))))
    throw new Error("no build in apps/web/dist: run `pnpm build` first");
  const taken = await fetch(LOCAL_PREVIEW).then(
    () => true,
    () => false,
  );
  if (taken) throw new Error("port 4173 is taken by another server: wait and try again (never stop it from here)");
  server = spawn("pnpm", ["--filter", "@ideabeam/web", "preview"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: ["ignore", "ignore", "inherit"],
    // its own process group, so that stopping it stops vite and workerd under pnpm, and nothing else
    detached: true,
  });
  const exited = new Promise((resolve) => server.once("exit", () => resolve(true)));
  await until(
    "vite preview answering on port 4173",
    async () => {
      if (await Promise.race([exited, sleep(0).then(() => false)])) throw new Error("vite preview ended at its start");
      return fetch(LOCAL_PREVIEW).then(
        (answer) => answer.ok,
        () => false,
      );
    },
    60_000,
  );
}
function stopPreview() {
  if (!server || server.exitCode !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM"); // the group this script started, by its PID
  } catch {
    // already gone
  }
}

// ── the browsers ──
async function browsers() {
  const first = await chromium.launch({ headless: !HEADED });
  let second = null;
  if (existsSync(firefox.executablePath())) second = await firefox.launch({ headless: !HEADED });
  const kinds = second
    ? "Chromium and Firefox"
    : "two contexts of one Chromium (Playwright's Firefox is not installed)";
  return { first, second: second ?? first, kinds, all: second ? [first, second] : [first] };
}

async function person(browser) {
  const context = await browser.newContext({ locale: "de-DE", acceptDownloads: true, reducedMotion: "reduce" });
  context.setDefaultTimeout(TIMEOUT);
  const page = await context.newPage();
  // a page's own errors are a failure of the smoke test; their text is the app's, never a token
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, errors };
}

const heading = (page) => page.locator("[data-sb-view] h1");
const notesOn = (page) => page.locator(".app-note[data-note]");
const noteText = (page, text) => notesOn(page).filter({ hasText: text });
const zone = (page) => page.locator(".sb-bottom-block");

async function joinAs(page, name) {
  await page.locator('#app-form[aria-label="Beitreten"]').waitFor();
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-surface__ground, .app-list").waitFor();
}

async function writeNote(page, text) {
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await page.getByRole("textbox", { name: "Text des Zettels" }).fill(text);
  await page.keyboard.press("Enter");
  await noteText(page, text).waitFor();
}

async function more(page, row) {
  await page.locator("[data-sb-web-app-head] [aria-haspopup=menu]").click();
  const menu = page.locator("#app-more");
  await menu.waitFor();
  return menu.getByRole("menuitem", { name: row, exact: true });
}

/** The deletion through a socket of the moderation's page, with the token the app stored there: the token never
 *  leaves the page. Resolves with whether the wall acknowledged it. */
async function deleteFromPage(page, wallId) {
  return page.evaluate(async (wallId) => {
    const store = Object.keys(localStorage).find((key) => key.endsWith("-walls"));
    const token = store ? JSON.parse(localStorage.getItem(store) ?? "{}").state?.adminTokens?.[wallId] : undefined;
    if (typeof token !== "string") return false;
    const hex = () =>
      [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    return new Promise((resolve) => {
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/walls/${wallId}/ws`,
      );
      const opId = hex();
      const done = (ok) => {
        clearTimeout(timer);
        ws.close();
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), 10_000);
      ws.addEventListener("open", () =>
        ws.send(JSON.stringify({ type: "join", name: "Rauchtest", sessionKey: hex(), adminToken: token })),
      );
      ws.addEventListener("message", (event) => {
        if (event.data === "pong") return;
        const frame = JSON.parse(String(event.data));
        if (frame.type === "sync") ws.send(JSON.stringify({ type: "admin.wall.delete", opId }));
        else if ((frame.type === "ack" || frame.type === "reject") && frame.opId === opId) done(frame.type === "ack");
      });
      ws.addEventListener("error", () => done(false));
    });
  }, wallId);
}

const wallStatus = async (wallId) => (await fetch(`${origin}/api/walls/${wallId}`)).status;

// ── the run ──
let failed = null;
let kinds = "";
let wallId = null;
let deleted = false;
let opened = null;
try {
  if (SELFTEST) await startPreview();
  opened = await browsers();
  kinds = opened.kinds;
  console.log(
    `Smoke test of ${local ? `a local address (${origin})` : "a deployment"}, in ${kinds}` +
      `${ARRANGE ? ", with „Ordnen“" : ", without „Ordnen“"}.`,
  );
  if (!local)
    console.log(
      "It spends one of the day's walls and some 35 rows written" + (ARRANGE ? ", and one run of the AI." : "."),
    );
  const anna = await person(opened.first);
  const ben = await person(opened.second);

  // 1. Anna makes the wall through the start page and joins it
  await anna.page.goto(`${origin}/`);
  await anna.page.locator('a.sb-primary-action[href="/neu"]').click();
  await anna.page.fill("#app-f-question", QUESTION);
  await anna.page.locator('#app-form button[type="submit"]').click();
  await anna.page.waitForURL(/\/w\/[0-9a-f]{64}$/);
  wallId = new URL(anna.page.url()).pathname.slice("/w/".length);
  await joinAs(anna.page, ANNA);
  say("Anna made a wall through the start page and joined it.");

  // 2. Ben opens the wall's link: the address of Anna's tab, which holds no token
  const link = `${origin}/w/${wallId}`;
  await ben.page.goto(link);
  await joinAs(ben.page, BEN);
  await until("both pages say that two people are there", async () =>
    (await anna.page.locator(".app-state__sentence").textContent())?.includes("2 Personen"),
  );
  say("Ben joined by the wall's link; both pages show two people.");

  // 3. hidden writing: each writes, neither reads the other
  for (const text of annaNotes) await writeNote(anna.page, text);
  for (const text of benNotes) await writeNote(ben.page, text);
  await until("Anna's page counts Ben's notes as hidden", async () =>
    // the number and „Zettel“ stand with a no-break space between them
    new RegExp(`^${benNotes.length}\\sZettel`).test((await anna.page.locator(".app-hidden").textContent()) ?? ""),
  );
  const annaSees = await anna.page.content();
  const benSees = await ben.page.content();
  for (const text of benNotes) if (annaSees.includes(text)) throw new Error("Anna's page shows a note of Ben's");
  for (const text of annaNotes) if (benSees.includes(text)) throw new Error("Ben's page shows a note of Anna's");
  if ((await notesOn(anna.page).count()) !== annaNotes.length || (await notesOn(ben.page).count()) !== benNotes.length)
    throw new Error("a page shows more notes than its own while the writing is hidden");
  say(`Both wrote hidden (${annaNotes.length} and ${benNotes.length} notes); neither page shows the other's text.`);

  // 4. Anna reveals
  await zone(anna.page).getByRole("button", { name: "Aufdecken", exact: true }).click();
  await anna.page.locator("#app-dlg-reveal").getByRole("button", { name: "Aufdecken" }).click();
  const all = [...annaNotes, ...benNotes];
  for (const one of [anna.page, ben.page])
    await until("every note on both pages after revealing", async () => (await notesOn(one).count()) === all.length);
  for (const one of [anna.page, ben.page]) for (const text of all) await noteText(one, text).waitFor();
  say(`Anna revealed; both pages show all ${all.length} notes.`);

  // 5. „Ordnen“, on the flag only: it spends neurons
  if (ARRANGE) {
    await zone(anna.page).getByRole("button", { name: "Ordnen", exact: true }).click();
    await zone(anna.page).getByRole("button", { name: "Anwenden", exact: true }).waitFor({ timeout: 120_000 });
    const proposed = await anna.page.locator(".app-group[data-group]").count();
    await zone(anna.page).getByRole("button", { name: "Anwenden", exact: true }).click();
    await until(
      "Ben's page shows the applied groups",
      async () => (await ben.page.locator(".app-group[data-group]").count()) === proposed && proposed > 0,
    );
    say(`„Ordnen“ proposed ${proposed} groups; after „Anwenden“ Ben's page shows them.`);
  }

  // 6. the Markdown file
  const [download] = await Promise.all([
    anna.page.waitForEvent("download"),
    (await more(anna.page, "Als Markdown sichern")).click(),
  ]);
  const markdown = await readFile(await download.path(), "utf8");
  if (!markdown.includes(QUESTION)) throw new Error("the Markdown file does not hold the question");
  for (const text of all) if (!markdown.includes(text)) throw new Error("the Markdown file misses a note");
  if (markdown.includes(ANNA) || markdown.includes(BEN)) throw new Error("the Markdown file names a person");
  say(`Anna saved the wall as Markdown (${markdown.length} characters): the question and every note, no name.`);

  // 7. Anna deletes the wall
  await (await more(anna.page, "Wand löschen")).click();
  await anna.page.locator('#app-dlg-delete button[value="confirm"]').click();
  for (const one of [anna.page, ben.page])
    await until("both pages say „Wand gelöscht“", async () => (await heading(one).textContent()) === "Wand gelöscht");
  await until("the wall's address answers 404", async () => (await wallStatus(wallId)) === 404, 10_000);
  deleted = true;
  say("Anna deleted the wall; both pages say so, and its address answers 404.");

  for (const [name, who] of [
    ["Anna", anna],
    ["Ben", ben],
  ])
    if (who.errors.length) throw new Error(`${name}'s page had ${who.errors.length} error(s): ${who.errors[0]}`);
} catch (error) {
  failed = error instanceof Error ? error.message.split("\n")[0] : String(error);
}

// nothing of the smoke test stays stored, whatever happened above
if (wallId && !deleted) {
  try {
    const page = opened?.first.contexts()[0]?.pages()[0];
    const acked = page ? await deleteFromPage(page, wallId) : false;
    if (acked) await until("the wall's address answers 404", async () => (await wallStatus(wallId)) === 404, 10_000);
    deleted = acked;
  } catch {
    deleted = false;
  }
  console.log(
    deleted
      ? "The wall was deleted through a socket of Anna's page."
      : `The wall is NOT deleted: its id is ${wallId}. It deletes itself 30 days after the last join.`,
  );
}
for (const browser of opened?.all ?? []) await browser.close().catch(() => {});
stopPreview();

if (failed) {
  console.error(`SMOKE TEST FAILED at step ${step + 1}: ${failed}`);
  process.exitCode = 1;
} else console.log(`Smoke test passed, in ${kinds}.`);
