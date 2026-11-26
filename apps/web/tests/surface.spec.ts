// The surface of a wall, against the Worker behind the build: notes are written, changed, moved and deleted, and
// every browser on the wall sees it live; by keyboard alone; a drag tells the wall once; the view pans and zooms
// without a word to the wall; a change the wall refuses is taken back with its reason; a line that drops heals.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { enter, ground, note, NOTES, placeOf, QUESTION, writeNote } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const WALL_SOCKET = /\/api\/walls\/[0-9a-f]{64}\/ws$/;
/** The state sentence at the top of the wall. */
const sentence = (page: Page) => page.locator(".app-state__sentence");
/** What to do now, under the state sentence. */
const guide = (page: Page) => page.locator(".app-state__note").first();
/** The field a note is written in. */
const field = (page: Page) => page.getByRole("textbox", { name: "Text des Zettels" });
const tool = (page: Page, name: string) =>
  page.locator(".app-surface__tools").getByRole("button", { name, exact: true });
const world = (page: Page) => page.locator(".app-surface__ground > .app-surface__world");
/** The view as the world's transform says it: where the world's origin lies in the frame, and its zoom. */
const viewOf = (page: Page) =>
  world(page).evaluate((el) => {
    const { a, e, f } = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: e, y: f, zoom: a };
  });
/** The note the surface holds as its current one. */
const current = (page: Page) => page.locator('.app-note[aria-selected="true"]');

/** Another person, in a browser of their own, on the wall under a name. */
async function another(browser: Browser, address: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(address);
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await ground(page).waitFor();
  return page;
}

/** Every frame the page's wall socket sends from now on, parsed. */
function sent(page: Page) {
  const frames: Array<{ type: string; [key: string]: unknown }> = [];
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => {
      if (frame.payload !== "ping") frames.push(JSON.parse(String(frame.payload)));
    }),
  );
  return frames;
}

/** Drags from the middle of a note by a distance, in several steps as a hand does. */
async function drag(page: Page, text: string, dx: number, dy: number) {
  const box = (await note(page, text).boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) await page.mouse.move(from.x + (dx * step) / 8, from.y + (dy * step) / 8);
  await page.mouse.up();
}

test("two browsers see each other's notes live: a note appears, changes, moves and disappears", async ({
  page,
  browser,
}) => {
  await enter(page, { hidden: false });
  await expect(sentence(page)).toHaveText("Noch keine Zettel. 1 Person ist da.");
  const ben = await another(browser, page.url(), "Ben");
  await expect(sentence(page)).toHaveText("Noch keine Zettel. 2 Personen sind da.");

  // Anna writes: Ben sees the note without doing anything
  await writeNote(page, "Weniger Termine");
  await expect(note(ben, "Weniger Termine")).toHaveCount(1);
  // Nobody sees who wrote a note, and a screen reader does not hear it: Ben's surface names no Anna. To Anna her
  // own note says that it is hers, with a word the eye sees too; to Ben it says nothing
  await expect(note(ben, "Weniger Termine")).toHaveText("Weniger Termine");
  await expect(ground(ben)).not.toContainText("Anna");
  await expect(note(ben, "Weniger Termine").locator(".app-note__own")).toHaveCount(0);
  await expect(note(page, "Weniger Termine")).toHaveText("Weniger Termine Deiner");
  await expect(note(page, "Weniger Termine").locator(".app-note__own")).toBeVisible();
  await expect(ground(page).getByRole("option", { name: "Weniger Termine Deiner", exact: true })).toHaveCount(1);
  await expect(ground(ben).getByRole("option", { name: "Weniger Termine", exact: true })).toHaveCount(1);
  await expect(sentence(ben)).toHaveText("1 Zettel. 2 Personen sind da.");
  // Ben writes: Anna sees it, and the two notes do not cover each other
  await writeNote(ben, "Mehr Pausen");
  await expect(note(page, "Mehr Pausen")).toHaveCount(1);
  await expect(sentence(page)).toHaveText("2 Zettel. 2 Personen sind da.");
  const [first, second] = [await placeOf(note(page, "Weniger Termine")), await placeOf(note(page, "Mehr Pausen"))];
  expect(Math.abs(first.x - second.x) >= 240 || Math.abs(first.y - second.y) >= 104).toBe(true);
  // both browsers hold the notes at the same places
  expect(await placeOf(note(ben, "Weniger Termine"))).toEqual(first);
  expect(await placeOf(note(ben, "Mehr Pausen"))).toEqual(second);

  // Anna changes her note's text: a double click opens it, Enter saves
  await note(page, "Weniger Termine").dblclick();
  await expect(field(page)).toHaveValue("Weniger Termine");
  await field(page).fill("Weniger Termine ohne Ergebnis");
  await page.keyboard.press("Enter");
  await expect(note(ben, "Weniger Termine ohne Ergebnis")).toHaveCount(1);
  await expect(ben.locator(".app-note")).toHaveCount(2);

  // Ben moves Anna's note: anyone may move any note. Anna sees it at its new place
  await drag(ben, "Weniger Termine ohne Ergebnis", -160, 120);
  const moved = await placeOf(note(ben, "Weniger Termine ohne Ergebnis"));
  expect(moved).toEqual({ x: first.x - 160, y: first.y + 120 });
  await expect.poll(() => placeOf(note(page, "Weniger Termine ohne Ergebnis"))).toEqual(moved);
  // but its text and its end are not Ben's: no tool for either
  await expect(tool(ben, "Bearbeiten")).toHaveCount(0);
  await expect(tool(ben, "Löschen")).toHaveCount(0);

  // Anna moderates: she takes Ben's note off the wall, after the question
  await note(page, "Mehr Pausen").click();
  await expect(tool(page, "Bearbeiten")).toHaveCount(0);
  await tool(page, "Löschen").click();
  const dialog = page.locator("#app-dlg-note");
  await expect(dialog).toContainText("„Mehr Pausen“ wird für alle gelöscht. Das lässt sich nicht rückgängig machen.");
  await dialog.locator('button[value="confirm"]').click();
  await expect(note(ben, "Mehr Pausen")).toHaveCount(0);
  await expect(note(page, "Mehr Pausen")).toHaveCount(0);
  await expect(sentence(ben)).toHaveText("1 Zettel. 2 Personen sind da.");
  // a reload brings the wall as it stands: the wall has stored it, not the browsers
  await ben.reload();
  await expect(ben.locator(".app-note")).toHaveText(["Weniger Termine ohne Ergebnis"]);
  expect(await placeOf(note(ben, "Weniger Termine ohne Ergebnis"))).toEqual(moved);
  await ben.context().close();
});

test("a note is made, edited, moved and deleted by keyboard alone", async ({ page }) => {
  await enter(page);
  const frames = sent(page);
  await page.reload();
  await ground(page).waitFor();
  const primary = page.getByRole("button", { name: "Neuer Zettel", exact: true });
  // made: the primary action opens a field for writing, Enter saves
  for (let i = 0; i < 40 && !(await primary.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(primary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(field(page)).toBeFocused();
  await page.keyboard.type("Fokuszeit");
  await page.keyboard.press("Enter");
  // the surface has the focus now, with the new note as its current one
  await expect(ground(page)).toBeFocused();
  await expect(current(page)).toHaveText("Fokuszeit Deiner");
  await expect(ground(page)).toHaveAttribute("aria-activedescendant", (await current(page).getAttribute("id"))!);

  // a second note, with N from the surface; Escape leaves a field without a note
  await page.keyboard.press("n");
  await expect(field(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(field(page)).toHaveCount(0);
  await expect(ground(page)).toBeFocused();
  await page.keyboard.press("n");
  await page.keyboard.type("Mehr Pausen");
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-note")).toHaveCount(2);
  await expect(current(page)).toHaveText("Mehr Pausen Deiner");

  // the arrow keys go from note to note. The second note landed beside the first or under it, as the window has
  // room: the key that leads back is the one that points there
  const [one, two] = [await placeOf(note(page, "Fokuszeit")), await placeOf(note(page, "Mehr Pausen"))];
  const [back, forth] = two.x > one.x ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  await page.keyboard.press(back);
  await expect(current(page)).toHaveText("Fokuszeit Deiner");
  // nothing lies further that way: the place stays
  await page.keyboard.press(back);
  await expect(current(page)).toHaveText("Fokuszeit Deiner");
  await page.keyboard.press(forth);
  await expect(current(page)).toHaveText("Mehr Pausen Deiner");
  // the keys are named once, in the surface's description; „Tasten“ in the tools shows them to the eye
  await expect(ground(page)).toHaveAccessibleDescription(/^Tasten: Die Pfeiltasten gehen zum nächsten Zettel\./);
  await expect(page.locator("#app-surface-keys")).not.toBeInViewport();
  await page.keyboard.press("Shift+Tab");
  await expect(tool(page, "Alles zeigen")).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+Tab");
  await expect(tool(page, "Tasten")).toBeFocused();
  await expect(tool(page, "Tasten")).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(tool(page, "Tasten")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#app-surface-keys")).toBeInViewport();
  // back on the surface, the note that was the current one still is, and still in view under the line
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await expect(ground(page)).toBeFocused();
  await expect(current(page)).toHaveText("Mehr Pausen Deiner");
  await expect(current(page)).toBeInViewport({ ratio: 0.99 });

  // edited: Enter opens the current note, Enter saves
  await page.keyboard.press("Enter");
  await expect(field(page)).toHaveValue("Mehr Pausen");
  await page.keyboard.type(" am Nachmittag");
  await page.keyboard.press("Enter");
  await expect(current(page)).toHaveText("Mehr Pausen am Nachmittag Deiner");
  await expect(ground(page)).toBeFocused();

  // moved: M starts the move mode, the arrow keys step by 32 units, Enter ends it. One frame tells the wall
  const before = await placeOf(current(page));
  const movesBefore = frames.filter((frame) => frame.type === "notes.move").length;
  await page.keyboard.press("m");
  await expect(page.locator("#app-surface-keys")).toHaveText(
    "Bewegen: Die Pfeiltasten bewegen den Zettel. Eingabe legt ihn ab, Esc bricht ab.",
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => placeOf(current(page))).toEqual({ x: before.x + 64, y: before.y + 32 });
  // nothing has gone out yet
  expect(frames.filter((frame) => frame.type === "notes.move")).toHaveLength(movesBefore);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Zettel abgelegt." })).toHaveCount(1);
  await expect.poll(() => frames.filter((frame) => frame.type === "notes.move").length).toBe(movesBefore + 1);
  expect(frames.filter((frame) => frame.type === "notes.move").at(-1)).toMatchObject({
    moves: [{ x: before.x + 64, y: before.y + 32, groupId: null }],
  });
  // Escape takes a move back, and tells the wall nothing
  await page.keyboard.press("m");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect.poll(() => placeOf(current(page))).toEqual({ x: before.x + 64, y: before.y + 32 });
  expect(frames.filter((frame) => frame.type === "notes.move")).toHaveLength(movesBefore + 1);

  // deleted: Entf asks, the dialog opens on „Abbrechen“, Tab and Enter confirm
  await page.keyboard.press("Delete");
  const dialog = page.locator("#app-dlg-note");
  await expect(dialog.locator('button[value="cancel"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator(".app-note")).toHaveCount(2);
  await expect(ground(page)).toBeFocused();
  await page.keyboard.press("Delete");
  await page.keyboard.press("Tab");
  await expect(dialog.locator('button[value="confirm"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-note")).toHaveText(["Fokuszeit Deiner"]);
  await expect(ground(page)).toBeFocused();
  // the wall has it all: a reload shows the one note that is left, where it was written
  await page.reload();
  await expect(page.locator(".app-note")).toHaveText(["Fokuszeit Deiner"]);
});

test("a drag tells the wall once, when it ends; panning and zooming tell it nothing", async ({ page }) => {
  await enter(page, { hidden: false, notes: ["Weniger Termine", "Mehr Pausen"] });
  const frames = sent(page);
  await page.reload();
  await expect(page.locator(".app-note")).toHaveCount(2);
  const joined = () => frames.filter((frame) => frame.type !== "join");
  const before = await placeOf(note(page, "Weniger Termine"));

  await drag(page, "Weniger Termine", 80, -48);
  await expect.poll(() => placeOf(note(page, "Weniger Termine"))).toEqual({ x: before.x + 80, y: before.y - 48 });
  await expect.poll(() => joined().length).toBe(1);
  expect(joined()[0]).toMatchObject({ type: "notes.move", moves: [{ x: before.x + 80, y: before.y - 48 }] });
  // the note that was pressed is the current one
  await expect(current(page)).toHaveText("Weniger Termine");

  // the ground is dragged: the view moves, no note does
  const start = await viewOf(page);
  const box = (await ground(page).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height - 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height - 60, { steps: 5 });
  await page.mouse.up();
  const panned = await viewOf(page);
  expect(panned).toEqual({ x: start.x + 100, y: start.y - 40, zoom: start.zoom });
  // the wheel pans; with Strg it zooms around the pointer, which stays over the same point of the world
  await page.mouse.wheel(30, 50);
  await expect.poll(() => viewOf(page)).toEqual({ x: panned.x - 30, y: panned.y - 50, zoom: 1 });
  const pointer = { x: box.x + 120, y: box.y + box.height - 60 };
  const under = async () => {
    const view = await viewOf(page);
    return { x: (pointer.x - box.x - view.x) / view.zoom, y: (pointer.y - box.y - view.y) / view.zoom };
  };
  const worldPoint = await under();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect.poll(async () => (await viewOf(page)).zoom).toBeGreaterThan(1.5);
  const still = await under();
  expect(Math.abs(still.x - worldPoint.x)).toBeLessThan(2);
  expect(Math.abs(still.y - worldPoint.y)).toBeLessThan(2);
  // the keys: minus, plus, and 0 for „Alles zeigen“, which brings both notes back into view, as large as they fit
  // and never larger than life
  await ground(page).focus();
  const zoomed = (await viewOf(page)).zoom;
  await page.keyboard.press("-");
  await expect.poll(async () => (await viewOf(page)).zoom).toBeCloseTo(zoomed / 1.25, 3);
  await page.keyboard.press("+");
  await expect.poll(async () => (await viewOf(page)).zoom).toBeCloseTo(zoomed, 3);
  await page.keyboard.press("0");
  await expect(note(page, "Weniger Termine")).toBeInViewport({ ratio: 0.99 });
  await expect(note(page, "Mehr Pausen")).toBeInViewport({ ratio: 0.99 });
  const fitted = (await viewOf(page)).zoom;
  expect(fitted).toBeLessThanOrEqual(1);
  expect(fitted).toBeGreaterThan(0.5);
  // the controls do the same, and keep their size outside the zoomed world
  await tool(page, "Verkleinern").click();
  await tool(page, "Verkleinern").click();
  await expect.poll(async () => (await viewOf(page)).zoom).toBeCloseTo(fitted / 1.25 / 1.25, 3);
  await tool(page, "Vergrößern").click();
  await expect.poll(async () => (await viewOf(page)).zoom).toBeCloseTo(fitted / 1.25, 3);
  for (const name of ["Verkleinern", "Vergrößern", "Alles zeigen"]) {
    const size = (await tool(page, name).boundingBox())!;
    expect(size.height).toBeGreaterThanOrEqual(48);
    expect(size.width).toBeGreaterThanOrEqual(48);
  }
  await tool(page, "Alles zeigen").click();
  await expect.poll(async () => (await viewOf(page)).zoom).toBeGreaterThanOrEqual(fitted);
  await expect(note(page, "Weniger Termine")).toBeInViewport({ ratio: 0.99 });
  await expect(note(page, "Mehr Pausen")).toBeInViewport({ ratio: 0.99 });
  // all of that was the browser's own: the wall heard of the one drag, nothing else
  expect(joined()).toHaveLength(1);
});

test("a change the wall refuses is taken back, and a sentence says why", async ({ page }) => {
  // the test stands between the page and the wall: the next note is refused as on a wall that is full
  let refuse = false;
  await page.routeWebSocket(WALL_SOCKET, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((frame) => ws.send(frame));
    ws.onMessage((frame) => {
      // (the heartbeat is no JSON)
      const command = (String(frame).startsWith("{") ? JSON.parse(String(frame)) : {}) as {
        type?: string;
        opId?: string;
      };
      if (refuse && command.type === "note.create") {
        // a moment later, as an answer from far away
        setTimeout(() => ws.send(JSON.stringify({ type: "reject", opId: command.opId, code: "LIMIT" })), 300);
      } else {
        server.send(frame);
      }
    });
  });
  await enter(page, { hidden: false });
  await writeNote(page, "Weniger Termine");
  refuse = true;
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await field(page).fill("Mehr Pausen");
  await page.keyboard.press("Enter");
  // shown at once, taken back when the wall says no
  await expect(note(page, "Mehr Pausen")).toHaveCount(1);
  const problem = page.locator(".app-surface__problem");
  await expect(problem).toHaveText(
    "Die Wand ist voll: Mehr als 500 Zettel passen nicht darauf. Lösch einen, dann ist wieder Platz.",
  );
  await expect(problem).toHaveAttribute("role", "alert");
  await expect(note(page, "Mehr Pausen")).toHaveCount(0);
  await expect(page.locator(".app-note")).toHaveCount(1);
  await expect(sentence(page)).toHaveText("1 Zettel. 1 Person ist da.");
  // the sentence goes with its key, or with the next change
  await problem.getByRole("button", { name: "Hinweis schließen" }).click();
  await expect(problem).toBeEmpty();
});

test("somebody else's note: its text and its end are its author's, and the surface says so", async ({
  page,
  browser,
}) => {
  await enter(page, { hidden: false });
  await writeNote(page, "Weniger Termine");
  const ben = await another(browser, page.url(), "Ben");
  await expect(guide(ben)).toHaveText(
    "Schreib weitere Ideen auf Zettel. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  );
  await note(ben, "Weniger Termine").dblclick();
  await expect(field(ben)).toHaveCount(0);
  const problem = ben.locator(".app-surface__problem");
  await expect(problem).toHaveText("Den Text eines Zettels ändert nur, wer ihn geschrieben hat.");
  await ben.keyboard.press("Delete");
  await expect(problem).toHaveText("Einen Zettel löscht nur, wer ihn geschrieben hat, oder die Moderation.");
  await expect(ben.locator("#app-dlg-note")).toBeHidden();
  // the next change of his own puts the sentence away
  await writeNote(ben, "Mehr Pausen");
  await expect(problem).toBeEmpty();
  await ben.context().close();
});

test("a line that drops heals: what was written meanwhile arrives on both sides", async ({ page, browser }) => {
  await enter(page, { hidden: false });
  const context = await browser.newContext();
  const ben = await context.newPage();
  const lines: Array<() => void> = [];
  let dead = false;
  await ben.routeWebSocket(WALL_SOCKET, (ws) => {
    // a try on the dead line never ends, as on a network that is gone
    if (dead) return new Promise<void>(() => undefined);
    const server = ws.connectToServer();
    lines.push(() => {
      void server.close();
      void ws.close();
    });
  });
  await ben.goto(page.url());
  await ben.fill("#app-f-as", "Ben");
  await ben.locator('#app-form button[type="submit"]').click();
  await ground(ben).waitFor();
  await writeNote(page, "Weniger Termine");
  await expect(note(ben, "Weniger Termine")).toHaveCount(1);

  dead = true;
  for (const cut of lines.splice(0)) cut();
  await expect(sentence(ben)).toHaveText("Verbindung getrennt. Wird neu verbunden …");
  // Anna writes while Ben is away; Ben writes too, into the dead line: his note shows at once
  await writeNote(page, "Mehr Pausen");
  await writeNote(ben, "Fokuszeit");
  await expect(note(page, "Fokuszeit")).toHaveCount(0);

  dead = false;
  // the line is back: Ben gets the wall as it stands, and his own note goes out
  await expect(sentence(ben)).toHaveText("3 Zettel. 2 Personen sind da.", { timeout: 20_000 });
  await expect(ben.locator(".app-note")).toHaveCount(3);
  await expect(note(ben, "Mehr Pausen")).toHaveCount(1);
  await expect(note(page, "Fokuszeit")).toHaveCount(1);
  await expect(sentence(page)).toHaveText("3 Zettel. 2 Personen sind da.");
  await context.close();
});

test("a wall with notes opens with all of them in view; a new note lands on a free place in view", async ({ page }) => {
  await enter(page, { hidden: false, notes: NOTES });
  for (const text of NOTES) await expect(note(page, text.slice(0, 24))).toBeInViewport({ ratio: 0.99 });
  await expect(page.locator(".app-state__sentence")).toHaveText("6 Zettel. 1 Person ist da.");
  // the wall's question stays the page's one heading
  await expect(page.locator("h1:visible")).toHaveText([QUESTION]);
  await writeNote(page, "Ein neuer Zettel");
  await expect(note(page, "Ein neuer Zettel")).toBeInViewport({ ratio: 0.99 });
  // it covers none of the others
  const boxes = await page
    .locator(".app-note[data-note]")
    .evaluateAll((notes) =>
      notes
        .map((el) => el.getBoundingClientRect())
        .map(({ left, top, right, bottom }) => ({ left, top, right, bottom })),
    );
  for (const [n, a] of boxes.entries())
    for (const b of boxes.slice(n + 1))
      expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBe(false);
});

test("many people on a wall: their list scrolls in its column, and the surface keeps the window's height", async ({
  page,
}) => {
  const names = Array.from({ length: 14 }, (_, n) => `Person ${n + 1}`);
  await enter(page, { others: names });
  const people = page.locator(".app-wall__people");
  await expect(people.locator("li")).toHaveCount(15);
  // the list is longer than its column, and the column is as tall as the surface beside it
  expect(await people.evaluate((el) => el.scrollHeight > el.clientHeight + 100)).toBe(true);
  const [column, surface] = [(await people.boundingBox())!, (await page.locator(".app-surface").boundingBox())!];
  expect(Math.abs(column.height - surface.height)).toBeLessThanOrEqual(1);
  // so the page is no taller than a wall with one person on it: the action stands above the footer, in the window
  const viewport = page.viewportSize()!;
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height + 120);
  await expect(page.getByRole("button", { name: "Neuer Zettel", exact: true })).toBeInViewport({ ratio: 1 });
});

test("two fingers pan and zoom the surface; a note keeps its size in the world", async ({ page }) => {
  await enter(page, { hidden: false, notes: ["Weniger Termine"] });
  const box = (await ground(page).boundingBox())!;
  const middle = { x: box.x + box.width / 2, y: box.y + box.height - 40 };
  const finger = (id: number, type: string, x: number, y: number) =>
    ground(page).dispatchEvent(type, {
      pointerId: id,
      pointerType: "touch",
      isPrimary: id === 1,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
    });
  const start = await viewOf(page);
  await finger(1, "pointerdown", middle.x - 50, middle.y);
  await finger(2, "pointerdown", middle.x + 50, middle.y);
  // the fingers move apart to twice the distance
  await finger(1, "pointermove", middle.x - 100, middle.y);
  await finger(2, "pointermove", middle.x + 100, middle.y);
  await expect.poll(async () => (await viewOf(page)).zoom).toBeCloseTo(start.zoom * 2, 3);
  // and then both to the right: the view follows them
  const spread = await viewOf(page);
  await finger(1, "pointermove", middle.x - 60, middle.y);
  await finger(2, "pointermove", middle.x + 140, middle.y);
  await finger(1, "pointerup", middle.x - 60, middle.y);
  await finger(2, "pointerup", middle.x + 140, middle.y);
  const end = await viewOf(page);
  expect(end.zoom).toBeCloseTo(spread.zoom, 3);
  expect(end.x - spread.x).toBeCloseTo(40, 0);
});

test("the keyboard reaches the wall's actions and writes a note without the page moving under the wall's head", async ({
  page,
}) => {
  await enter(page);
  const scrolled = () => page.evaluate(() => window.scrollY);
  // the wall fills the window and its footer lies right under it: the page can scroll by the footer's height
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThan(40);
  // The Tab key goes from the people to the actions in the zone at the window's bottom edge. They are in view
  // wherever the page stands: the page stays where it is
  await page.locator(".app-people__head").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Neuer Zettel", exact: true })).toBeFocused();
  expect(await scrolled()).toBe(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Aufdecken", exact: true })).toBeFocused();
  expect(await scrolled()).toBe(0);
  // „Neuer Zettel“ opens the field in the surface's own view: the page does not move for it, nor while it is written
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toBeInViewport({ ratio: 1 });
  expect(await scrolled()).toBe(0);
  await page.keyboard.type("Weniger Termine");
  expect(await scrolled()).toBe(0);
  await page.keyboard.press("Enter");
  await expect(note(page, "Weniger Termine")).toHaveCount(1);
  expect(await scrolled()).toBe(0);
  await expect(page.locator("[data-sb-web-app-head]")).toBeInViewport({ ratio: 1 });
  // a press with the pointer leaves the page where it is too
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await expect(field(page)).toBeFocused();
  expect(await scrolled()).toBe(0);
});

test("in a window too short for the wall the page moves to show the field, and goes back when the writing ends", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 520 });
  await enter(page, { hidden: false });
  const scrolled = () => page.evaluate(() => window.scrollY);
  expect(await scrolled()).toBe(0);
  // head, state, the surface at its least height and the zone do not fit the window: the place of a new note lies
  // under the zone, which stays at the window's bottom edge
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await expect(field(page)).toBeFocused();
  // the page has moved as far as the field needs: it stands in the window, above the zone
  const moved = await scrolled();
  expect(moved).toBeGreaterThan(0);
  const [box, zone] = [(await field(page).boundingBox())!, (await page.locator(".sb-bottom-block").boundingBox())!];
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(zone.y + 1);
  // Enter saves, and the page is back where it stood: the wall's head is in view again
  await page.keyboard.type("Weniger Termine");
  await page.keyboard.press("Enter");
  await expect(note(page, "Weniger Termine")).toHaveCount(1);
  expect(await scrolled()).toBe(0);
  await expect(page.locator("[data-sb-web-app-head]")).toBeInViewport({ ratio: 1 });
  // Escape leaves the field, and the page goes back as well
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await expect(field(page)).toBeFocused();
  expect(await scrolled()).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(field(page)).toHaveCount(0);
  expect(await scrolled()).toBe(0);
  // Two notes in a row, the second begun with the pointer while the first field is open: that press saves the
  // first where the page stands, without moving it under the pointer; when the second ends, the page is back where
  // it stood before both
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await page.keyboard.type("Mehr Pausen");
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await expect(note(page, "Mehr Pausen")).toHaveCount(1);
  await expect(field(page)).toBeFocused();
  expect(await scrolled()).toBeGreaterThan(0);
  await page.keyboard.type("Fokuszeit");
  await page.keyboard.press("Enter");
  await expect(note(page, "Fokuszeit")).toHaveCount(1);
  expect(await scrolled()).toBe(0);
});
