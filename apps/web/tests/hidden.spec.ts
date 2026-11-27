// Hidden writing, revealing and the clock of the writing, each person in a browser of their own, against the Worker
// behind the build: the acceptance of stage 3 (PLAN.md, section 6). What a browser gets while the notes are hidden is
// read from the frames of its WebSocket themselves, not only from its screen: no text of somebody else's note, no id
// of one, nothing that tells who wrote. A reconnect in the middle of the writing reveals nothing and loses nothing.
// And the clock reads the same minute in every browser, also in one whose own clock is wrong.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { enter, note, QUESTION, writeNote } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const WALL_SOCKET = /\/api\/walls\/[0-9a-f]{64}\/ws$/;
/** The state sentence at the top of the wall. */
const sentence = (page: Page) => page.locator(".app-state__sentence");
/** The clock's sentence under it: empty without a clock. */
const clock = (page: Page) => page.locator(".app-state__clock");
/** What to do now: the sentences under the state. */
const guide = (page: Page) => page.locator(".app-state__note");
/** The others' notes while the wall is hidden: one line with their number. */
const hiddenLine = (page: Page) => page.locator(".app-hidden");
/** The moderation's controls of the clock. */
const controls = (page: Page) => page.getByRole("group", { name: "Uhr", exact: true });
const primary = (page: Page) => page.locator(".sb-primary-action");
/** What a screen reader was told last about the person's own doing and about revealing. */
const said = (page: Page) => page.locator("main p.sb-visually-hidden[role=status]");

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

type Frame = { type: string; [key: string]: unknown };
const parsed = (frames: string[]) => frames.map((frame) => JSON.parse(frame) as Frame);
const typesOf = (frames: string[]) => [...new Set(parsed(frames).map((frame) => frame.type))].sort();

/** Another person in a browser of their own, on the wall under a name; their socket's frames are recorded from the
 *  first one on. */
async function another(browser: Browser, address: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const frames = received(page);
  await page.goto(address);
  await joinAs(page, name);
  return { page, frames };
}

async function joinAs(page: Page, name: string) {
  await expect(page.locator('#app-form[aria-label="Beitreten"]')).toBeVisible();
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-surface__ground, .app-list").waitFor();
}

/** The ids of the notes a page shows on its surface. */
const noteIds = (page: Page) =>
  page.locator(".app-note[data-note]").evaluateAll((notes) => notes.map((one) => (one as HTMLElement).dataset.note!));

// Every text Anna writes carries this word, and nothing else on the wall does: it must be in no frame Ben gets.
const SECRET = "Annageheim";

test("while the notes are hidden nothing of A's notes is in B's WebSocket frames: no text, no id, no writer; revealing brings them", async ({
  page,
  browser,
}) => {
  const annaFrames = received(page);
  await enter(page);
  const address = page.url();
  // Anna writes before anybody else is on the wall: Ben's snapshot must not hold it
  await writeNote(page, `${SECRET} eins: zu viele Termine`);
  const ben = await another(browser, address, "Ben");
  await expect(sentence(ben.page)).toHaveText("Verdecktes Schreiben: 1 Zettel. 2 Personen sind da.");

  // Anna writes on, changes a text, moves a note and deletes one: every one a change of the wall Ben must not read
  await writeNote(page, `${SECRET} zwei: der Build dauert zu lange`);
  await page.keyboard.press("Enter");
  await page.keyboard.type(", jeden Tag");
  await page.keyboard.press("Enter");
  await expect(note(page, `${SECRET} zwei: der Build dauert zu lange, jeden Tag`)).toHaveCount(1);
  await page.keyboard.press("m");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await writeNote(page, `${SECRET} drei: wird gleich gelöscht`);
  const annaIds = await noteIds(page);
  expect(annaIds).toHaveLength(3);
  await page.keyboard.press("Delete");
  await page.locator('#app-dlg-note button[value="confirm"]').click();
  await expect(page.locator(".app-note[data-note]")).toHaveCount(2);
  // Ben writes too: his note is his alone
  await writeNote(ben.page, "Bens Zettel: mehr Pausen");

  // the screens: each sees their own notes, and of the others' a number
  await expect(hiddenLine(ben.page)).toHaveText("2 Zettel der anderen liegen verdeckt auf der Wand.");
  await expect(hiddenLine(page)).toHaveText("1 Zettel der anderen liegt verdeckt auf der Wand.");
  await expect(sentence(ben.page)).toHaveText("Verdecktes Schreiben: 3 Zettel. 2 Personen sind da.");
  await expect(ben.page.locator(".app-note[data-note]")).toHaveText(["Bens Zettel: mehr Pausen Deiner"]);
  expect(await ben.page.content()).not.toContain(SECRET);
  expect(await page.content()).not.toContain("Bens Zettel");
  // what to do now says so: nobody reads along; revealing is the moderation's, and so is its primary action
  await expect(guide(ben.page)).toHaveText([
    "Schreib deine Ideen auf Zettel. Niemand liest mit, bis die Moderation aufdeckt.",
  ]);
  await expect(guide(page)).toHaveText([
    "Du moderierst: Alle schreiben für sich, niemand liest mit. Wenn alle fertig sind, zeigt „Aufdecken“ allen jeden Zettel.",
  ]);
  await expect(primary(ben.page)).toHaveText("Neuer Zettel");
  await expect(primary(page)).toHaveText("Weiter: Aufdecken");
  await expect(ben.page.getByRole("button", { name: "Aufdecken" })).toHaveCount(0);
  // groups come with the open wall
  await expect(page.getByRole("button", { name: "Neue Gruppe" })).toHaveCount(0);
  await expect(ben.page.getByRole("button", { name: "Neue Gruppe" })).toHaveCount(0);

  // somebody who comes late gets the same: a number
  const cem = await another(browser, address, "Cem");
  await expect(hiddenLine(cem.page)).toHaveText("3 Zettel der anderen liegen verdeckt auf der Wand.");

  // ── the frames themselves, as Ben's and Cem's sockets received them ──
  const annaId = (
    parsed(ben.frames).find((frame) => frame.type === "sync") as unknown as {
      participants: Array<{ id: string; name: string }>;
    }
  ).participants.find((person) => person.name === "Anna")!.id;
  for (const frames of [ben.frames, cem.frames]) {
    // the record is no empty one: the snapshot is in it
    expect(typesOf(frames)).toContain("sync");
    for (const frame of frames) {
      // no text of a note of Anna's, in no frame
      expect(frame).not.toContain(SECRET);
      // no id of a note of hers, the deleted one included
      for (const id of annaIds) expect(frame).not.toContain(id);
      // nobody's note says who wrote it
      expect(frame).not.toContain("authorId");
    }
    // who is on the wall is told (the people); who wrote is not: Anna's id is in the frames about people alone
    for (const frame of parsed(frames)) {
      const people = ["sync", "presence.join", "presence.leave", "roster.updated"].includes(frame.type);
      if (!people) expect(JSON.stringify(frame)).not.toContain(annaId);
      if (frame.type === "sync") expect(JSON.stringify(frame.notes)).not.toContain(annaId);
    }
  }
  // what stands in for a change Ben may not read: its number and how many notes are hidden, nothing else
  const occupancy = parsed(ben.frames).filter((frame) => frame.type === "wall.occupancy");
  // (Anna's second note, its new text, its move, her third note and its end)
  expect(occupancy).toHaveLength(5);
  for (const frame of occupancy) expect(Object.keys(frame).sort()).toEqual(["hidden", "seq", "type"]);
  expect(occupancy.map((frame) => frame.hidden)).toEqual([2, 2, 2, 3, 2]);
  // the snapshots: a number in place of the others' notes
  expect(parsed(ben.frames).find((frame) => frame.type === "sync")).toMatchObject({
    step: 0,
    reach: 0,
    hidden: 1,
    notes: [],
  });
  expect(parsed(cem.frames).find((frame) => frame.type === "sync")).toMatchObject({
    step: 0,
    reach: 0,
    hidden: 3,
    notes: [],
  });
  // the notes Ben did get are his own
  const benNotes = parsed(ben.frames).filter((frame) => frame.type === "note.created");
  expect(benNotes).toMatchObject([{ note: { mine: true, text: "Bens Zettel: mehr Pausen" } }]);
  expect(typesOf(ben.frames)).toEqual(["ack", "note.created", "presence.join", "sync", "wall.occupancy"]);
  // and Anna, who moderates, reads nobody else's note either
  for (const frame of annaFrames) expect(frame).not.toContain("Bens Zettel");
  expect(parsed(annaFrames).filter((frame) => frame.type === "wall.occupancy")).toHaveLength(1);

  // ── revealing: the moderation's, after a question that says it cannot be taken back ──
  const before = ben.frames.length;
  await primary(page).click();
  const dialog = page.locator("#app-dlg-reveal");
  await expect(dialog).toContainText("Zettel aufdecken?");
  await expect(dialog).toContainText(
    "Auf der Wand liegen 3 Zettel. Nach dem Aufdecken sehen alle jeden Zettel, auch jeden, der noch dazukommt. Das lässt sich nicht rückgängig machen.",
  );
  // not yet: the question can be put away
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(hiddenLine(ben.page)).toHaveCount(1);
  expect(ben.frames.length).toBe(before);
  await primary(page).click();
  await dialog.getByRole("button", { name: "Aufdecken" }).click();

  // every note is there for everyone, and one sentence says so, for all of them
  for (const one of [page, ben.page, cem.page]) {
    await expect(one.locator(".app-note[data-note]")).toHaveCount(3);
    await expect(said(one)).toHaveText("Aufgedeckt: 3 Zettel sind jetzt für alle zu sehen.");
    await expect(sentence(one)).toHaveText("3 Zettel. 3 Personen sind da.");
    await expect(hiddenLine(one)).toHaveCount(0);
    // the wall is an open wall now: groups; „Neuer Zettel“ is the primary action of everybody but the moderation,
    // whose next step is „Ordnen“, with „Neuer Zettel“ beside it
    await expect(one.getByRole("button", { name: "Neue Gruppe" })).toBeVisible();
    await expect(primary(one)).toHaveText(one === page ? "Ordnen" : "Neuer Zettel");
    await expect(one.getByRole("button", { name: "Neuer Zettel", exact: true })).toBeVisible();
    await expect(one.getByRole("button", { name: "Aufdecken" })).toHaveCount(0);
  }
  await expect(note(ben.page, `${SECRET} eins: zu viele Termine`)).toHaveCount(1);
  await expect(note(ben.page, `${SECRET} zwei: der Build dauert zu lange, jeden Tag`)).toHaveCount(1);
  // nobody's name stands on a note, and only one's own says „Deiner“
  await expect(ben.page.locator(".app-note__own")).toHaveCount(1);
  await expect(controls(page)).toHaveCount(0);
  await expect(guide(page)).toHaveText([
    "Du moderierst: Alle schreiben weiter. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  ]);
  // the frames of revealing: the notes Ben did not have, none of them his, still without their writer; then the step
  const after = ben.frames.slice(before);
  expect(typesOf(after)).toEqual(["notes.revealed", "step.changed"]);
  const [revealed] = parsed(after) as unknown as [{ notes: Array<{ mine: boolean; text: string }> }];
  expect(revealed.notes.map((one) => one.mine)).toEqual([false, false]);
  expect(revealed.notes.every((one) => one.text.startsWith(SECRET))).toBe(true);
  for (const frame of after) expect(frame).not.toContain("authorId");
  // from now on a note is everyone's at once
  await writeNote(page, "Nach dem Aufdecken geschrieben");
  await expect(note(ben.page, "Nach dem Aufdecken geschrieben")).toHaveCount(1);
  await ben.page.context().close();
  await cem.page.context().close();
});

test("a reconnect in the middle of the writing reveals nothing and loses nothing", async ({ page, browser }) => {
  await enter(page);
  const context = await browser.newContext();
  const ben = await context.newPage();
  // The test stands between Ben's browser and the Worker: it reads every frame the Worker sends him, connection by
  // connection, and can cut the line and keep it dead.
  const connections: string[][] = [];
  const cut: Array<() => void> = [];
  let dead = false;
  await ben.routeWebSocket(WALL_SOCKET, (ws) => {
    // a try on the dead line never ends: the socket of the page stays connecting, as on a network that is gone
    if (dead) return new Promise<void>(() => undefined);
    const frames: string[] = [];
    connections.push(frames);
    const server = ws.connectToServer();
    ws.onMessage((frame) => server.send(frame));
    server.onMessage((frame) => {
      if (String(frame) !== "pong") frames.push(String(frame));
      ws.send(frame);
    });
    cut.push(() => {
      void server.close();
      void ws.close();
    });
  });
  await ben.goto(page.url());
  await joinAs(ben, "Ben");
  await writeNote(ben, "Bens erster Zettel");
  await writeNote(page, `${SECRET} eins`);
  await expect(hiddenLine(ben)).toHaveText("1 Zettel der anderen liegt verdeckt auf der Wand.");
  expect(connections).toHaveLength(1);

  // the line drops and stays dead: both write on meanwhile
  dead = true;
  for (const line of cut.splice(0)) line();
  await expect(sentence(ben)).toHaveText("Verbindung getrennt. Wird neu verbunden …");
  await writeNote(ben, "Bens zweiter Zettel, ohne Verbindung geschrieben");
  await writeNote(page, `${SECRET} zwei`);
  await writeNote(page, `${SECRET} drei`);
  await expect(hiddenLine(page)).toHaveText("1 Zettel der anderen liegt verdeckt auf der Wand.");

  // the line is back: Ben's browser joins again as the same person and gets the wall as it stands
  dead = false;
  await expect(sentence(ben)).toHaveText("Verdecktes Schreiben: 5 Zettel. 2 Personen sind da.", { timeout: 20_000 });
  // nothing is lost: both of Ben's notes are on the wall, the one written without a line too, and Anna's count them
  await expect(ben.locator(".app-note[data-note]")).toHaveText([
    "Bens erster Zettel Deiner",
    "Bens zweiter Zettel, ohne Verbindung geschrieben Deiner",
  ]);
  await expect(hiddenLine(page)).toHaveText("2 Zettel der anderen liegen verdeckt auf der Wand.");
  // nothing is revealed: of Anna's three notes Ben has a number, on his screen and in every frame of both connections
  await expect(hiddenLine(ben)).toHaveText("3 Zettel der anderen liegen verdeckt auf der Wand.");
  expect(await ben.content()).not.toContain(SECRET);
  expect(connections).toHaveLength(2);
  const annaIds = await noteIds(page);
  expect(annaIds).toHaveLength(3);
  for (const frames of connections) {
    for (const frame of frames) {
      expect(frame).not.toContain(SECRET);
      expect(frame).not.toContain("authorId");
      for (const id of annaIds) expect(frame).not.toContain(id);
    }
  }
  // the snapshot of the second connection: Ben's own note, and a number for Anna's
  const [again] = parsed(connections[1]!).filter((frame) => frame.type === "sync") as unknown as [
    { step: number; hidden: number; notes: Array<{ mine: boolean; text: string }> },
  ];
  expect(again).toMatchObject({ step: 0, reach: 0, hidden: 3 });
  expect(again.notes.every((one) => one.mine && one.text.startsWith("Bens"))).toBe(true);

  // a reload in the middle of the writing is a fresh join: the same person, the same notes, nothing more
  await ben.reload();
  await expect(ben.locator(".app-note[data-note]")).toHaveCount(2);
  await expect(hiddenLine(ben)).toHaveText("3 Zettel der anderen liegen verdeckt auf der Wand.");
  expect(await ben.content()).not.toContain(SECRET);
  expect(connections).toHaveLength(3);
  for (const frame of connections[2]!) expect(frame).not.toContain(SECRET);
  await context.close();
});

test("the clock: every browser shows the same minute, also one whose clock is wrong; pause and five minutes more reach everyone", async ({
  page,
  browser,
}) => {
  await enter(page);
  const address = page.url();
  /** Somebody whose device's clock is off by so many minutes. */
  const withClock = async (name: string, offMinutes: number) => {
    const context = await browser.newContext();
    await context.addInitScript((off) => {
      const real = Date.now.bind(Date);
      Date.now = () => real() + off;
    }, offMinutes * 60_000);
    const person = await context.newPage();
    await person.goto(address);
    await joinAs(person, name);
    return person;
  };
  // Ben's clock runs 37 minutes ahead, Cem's two hours behind
  const ben = await withClock("Ben", 37);
  const cem = await withClock("Cem", -120);
  const off = async (person: Page) => Math.round(((await person.evaluate(() => Date.now())) - Date.now()) / 60_000);
  expect(await off(ben)).toBe(37);
  expect(await off(cem)).toBe(-120);
  const everyone = [page, ben, cem];

  // no clock yet: no sentence, the question in the tab; only the moderation has the controls
  for (const one of everyone) await expect(clock(one)).toHaveText("");
  await expect(controls(page)).toBeVisible();
  await expect(controls(ben)).toHaveCount(0);
  await expect(controls(cem)).toHaveCount(0);

  // the moderation sets five minutes: everybody reads the same minute, in the wall's state and in the tab's title
  await expect(controls(page).getByLabel("Zeit zum Schreiben")).toHaveValue("5");
  await controls(page).getByRole("button", { name: "Uhr starten" }).click();
  for (const one of everyone) {
    await expect(clock(one)).toHaveText("Noch 5 Minuten zum Schreiben.");
    await expect(one).toHaveTitle(`Noch 5 Min. · ${QUESTION} · IdeaBeam`);
  }
  // a sentence in whole minutes: no bar, no seconds
  await expect(ben.locator("progress, meter, [role=progressbar], [role=timer]")).toHaveCount(0);
  expect(await ben.locator(".app-state").innerText()).not.toMatch(/\d:\d\d|Sekunde/);

  // paused: the time stands for everyone
  await controls(page).getByRole("button", { name: "Uhr anhalten" }).click();
  for (const one of everyone) {
    await expect(clock(one)).toHaveText("Die Uhr ist angehalten: noch 5 Minuten zum Schreiben.");
    await expect(one).toHaveTitle(`Angehalten · ${QUESTION} · IdeaBeam`);
  }
  // five minutes more reach everyone
  await controls(page).getByRole("button", { name: "5 Minuten mehr" }).click();
  for (const one of everyone)
    await expect(clock(one)).toHaveText("Die Uhr ist angehalten: noch 10 Minuten zum Schreiben.");
  // and on it runs
  await controls(page).getByRole("button", { name: "Uhr fortsetzen" }).click();
  for (const one of everyone) await expect(clock(one)).toHaveText("Noch 10 Minuten zum Schreiben.");

  // a browser that comes back gets the clock with the wall, and reckons the same minute from its wrong clock
  await ben.reload();
  await expect(clock(ben)).toHaveText("Noch 10 Minuten zum Schreiben.");
  await expect(ben).toHaveTitle(`Noch 10 Min. · ${QUESTION} · IdeaBeam`);

  // no clock any more: the sentence goes, the tab says the question again
  await controls(page).getByRole("button", { name: "Uhr ausschalten" }).click();
  for (const one of everyone) {
    await expect(clock(one)).toHaveText("");
    await expect(one).toHaveTitle(`${QUESTION} · IdeaBeam`);
  }
  await expect(controls(page).getByRole("button", { name: "Uhr starten" })).toBeVisible();
  await ben.context().close();
  await cem.context().close();
});
