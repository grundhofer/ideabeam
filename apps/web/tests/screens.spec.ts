// Every view and every overlay state, once in light at 390 px and once in dark at 1440 px, and one form in English
// at real 200 % text: the screen asked for (heading, view, open overlays), axe, no sideways scroll, no cut text or
// control value, no console or CSP error, and the copy's check of a view: its type, action levels and colours
// (tests/sebaro-checks.ts). A page that is no wall has the site's head and one column; a wall has a head of its
// own. A wall that a screen shows exists on the Worker behind the build. A new view gets its line here.
//
// The surface of a wall cuts what lies outside its view, on purpose, and the check of cut text cannot tell that
// from a fault: a screen with notes shows all of them, as a wall does when it opens („Alles zeigen“).
//
// A wall is looked at as its surface or as its list (src/lib/wall-view.ts). The screens of the surface are checked
// as the surface at both widths, the screens of the list as the list at both: each says which. What a phone shows
// without a choice, the list, is a screen of its own, checked at 390 px alone.
//
// A wall starts with hidden writing (PLAN.md 2.1). Its screens stand after those of the open wall: the wall while
// the notes are hidden, for the moderation and for everybody else, the question before revealing, the clock of the
// writing running, paused and up with its controls, and the sentence of a wall whose day is spent.
//
// „Ordnen“ (PLAN.md 4.3) has its screens last among the wall's: the moderation waits for the AI, the proposal as a
// preview on the surface and in the list, the wall after „Anwenden“ with „Rückgängig“ beside „Ordnen“, and the
// question before an arrangement is taken back once the wall has changed. Before arranging, with the line that says
// where it is computed, is `wand-zettel`. The Worker behind the build asks its stand-in, which puts notes together
// that begin with the same word. The AI's spent budget is no screen here: an answer put in the route's place with a
// failing status writes to the console, so it has its own look in tests/arrange.spec.ts.
//
// „Eigener Schlüssel“ (PLAN.md 4.5) follows: „Mehr“ with its entry, the dialog empty and with a key set, the wall
// with a key set as its surface and as its list, and the wall while the moderation's provider is asked. The
// providers are offered to the tab by the switch of src/lib/key-switch.ts; none is ever reached. A run with a key
// that ends in a sentence has its own look in tests/own-key.spec.ts, for the same reason as the spent budget.
import { expect, test, type Page } from "@playwright/test";
import {
  enter,
  enterEstimate,
  enterTeams,
  enterVote,
  ESTIMATE_QUESTION,
  GROUPS,
  join,
  know,
  LONG_QUESTION,
  lookAt,
  makeWall,
  NOTES,
  offerOwnKey,
  openOwnKey,
  QUESTION,
  takeOwnKey,
  TEAM_QUESTION,
  visit,
  writeNote,
} from "./app";
import { checkScreens, type Screen } from "./sebaro-checks";

// overlays fade in (200 ms, also under reduced motion): check them once every animation has ended
const settle = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));

type Step = (page: Page) => Promise<unknown>;
const then =
  (...steps: Step[]) =>
  async (page: Page) => {
    for (const step of steps) await step(page);
    await settle(page);
  };
/** A browser that knows two walls, then the steps of the screen. */
const used = (...steps: Step[]) =>
  then(
    (page) => know(page),
    (page) => page.reload(),
    (page) => page.waitForLoadState("networkidle"),
    ...steps,
  );

// people of the test who stay on a wall while its screen is checked
const staying: Array<{ leave(): Promise<void> }> = [];
test.afterEach(async () => {
  await Promise.all(staying.splice(0).map((person) => person.leave()));
});
/** How many people a wall holds at once: MAX_ONLINE of the protocol. */
const FULL = 30;

/** At the door of a wall that exists: the app asks for a name. An Anna was on the wall and has left; with `here`,
 *  so many others are on it. */
const atTheDoor = (options: { question?: string; here?: number } = {}, ...steps: Step[]) =>
  then(
    async (page) => {
      const { wallId } = await makeWall(page, options.question);
      await visit(wallId, "Anna");
      for (let n = 1; n <= (options.here ?? 0); n++) staying.push(await join(wallId, `Person ${n}`));
      await page.goto(`/w/${wallId}`);
      await page.locator("#app-f-as").waitFor();
    },
    ...steps,
  );
// The screens of a wall whose notes everyone sees: an open wall, one made without hidden writing. The screens of the
// hidden writing, of revealing and of the clock follow them, each on a wall as the product makes it.
/** On an open wall, as its moderation; Ben was there and has left. */
const onTheWall = (...steps: Step[]) => then((page) => enter(page, { hidden: false, others: ["Ben"] }), ...steps);
/** On an open wall with notes on its surface, as its moderation; Ben wrote them and has left. */
const onNotes = (...steps: Step[]) => then((page) => enter(page, { hidden: false, notes: NOTES }), ...steps);
/** On a wall, having written one note oneself: it is the current one, and the keyboard is on the surface. */
const withOwnNote = (...steps: Step[]) =>
  onTheWall(
    (page) => writeNote(page, "Jeden Montag eine halbe Stunde planen, statt jeden Tag eine Viertelstunde"),
    ...steps,
  );

/** On a wall with groups, two with a name and one still without, and notes in them and beside them, as its
 *  moderation; Ben made them and has left. As its surface, or as its list. */
const onGroups = (view: "surface" | "list", ...steps: Step[]) =>
  then((page) => enter(page, { hidden: false, groups: GROUPS, notes: NOTES.slice(0, 3), view }), ...steps);
/** A press on a note of the surface, by its text; with Shift it takes the note into the selection. */
const pressNote =
  (text: string, shift = false) =>
  (page: Page) =>
    page
      .locator(".app-note[data-note]")
      .filter({ hasText: text })
      .click({ modifiers: shift ? ["Shift"] : [] });
/** A press on the head of a group's frame on the surface: the group is the current one. */
const pressGroup = (title: string) => (page: Page) =>
  page.locator(".app-group[data-group]").filter({ hasText: title }).locator(".app-group__head").click();

/** Presses a button. It is brought into view first, and that scroll is over before the press: a menu closes when the
 *  page scrolls under it, and Playwright's own scroll right before its press counts as one. */
const press = (name: string) => async (page: Page) => {
  const button = page.getByRole("button", { name, exact: true }).first();
  await button.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((seen) => requestAnimationFrame(() => requestAnimationFrame(seen))));
  await button.click();
};
const item = (name: string) => (page: Page) => page.getByRole("menuitem", { name, exact: true }).click();
/** The heading of the start: what the product is. */
const CLAIM = "Alle schreiben Zettel, eine KI ordnet sie.";
const submit = (page: Page) => page.locator('#app-form button[type="submit"]').click();
const view = (name: string) => `[data-sb-view="${name}"]`;
/** The state sentence at the top of a wall. */
const sentence = (page: Page) => page.locator(".app-state__sentence");
/** The clock's sentence under the state sentence: empty without a clock. */
const clock = (page: Page) => page.locator(".app-state__clock");
/** What to do now: the sentences under the state. */
const guide = (page: Page) => page.locator(".app-state__note");
/** The others' notes while the wall is hidden: one line with their number. */
const hiddenLine = (page: Page) => page.locator(".app-hidden");
/** The moderation's controls of the clock. */
const clockControls = (page: Page) => page.getByRole("group", { name: "Uhr", exact: true });

/** On a wall as the product makes it, with hidden writing, as its moderation: Ben wrote three notes and has left,
 *  and the moderation wrote one. As its surface, or as its list. */
const onHidden = (view: "surface" | "list", ...steps: Step[]) =>
  then(
    (page) => enter(page, { notes: NOTES.slice(0, 3), view }),
    async (page) => {
      await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
      await page.getByRole("textbox", { name: "Text des Zettels" }).fill("Fokuszeit am Vormittag");
      await page.keyboard.press("Enter");
      await expect(page.locator(".app-note[data-note], .app-list__row")).toHaveCount(1);
    },
    (page) => expect(sentence(page)).toHaveText("Verdecktes Schreiben: 4 Zettel. 1 Person ist da."),
    ...steps,
  );
/** On a hidden wall as somebody who does not moderate, as its surface at every width. The moderation is here: a
 *  socket of the test, which wrote two notes; `asModeration` are its further steps. */
const asMember = (asModeration: (anna: Awaited<ReturnType<typeof join>>) => Promise<unknown>, ...steps: Step[]) =>
  then(
    async (page) => {
      const { wallId, adminToken } = await makeWall(page);
      const anna = await join(wallId, "Anna", adminToken);
      staying.push(anna);
      await anna.write("Zu viele Termine ohne Ergebnis");
      await anna.write("Unklar, wer entscheidet", 256, 0);
      await asModeration(anna);
      await lookAt(page, "surface");
      await page.goto(`/w/${wallId}`);
    },
    (page) => page.fill("#app-f-as", "Ben"),
    submit,
    (page) => expect(sentence(page)).toHaveText("Verdecktes Schreiben: 2 Zettel. 2 Personen sind da."),
    ...steps,
  );
/** Stands between the page and the Worker and puts the end of every clock into the past: a clock that is started
 *  has run out at once. A test cannot wait out the shortest clock, which is a minute. */
const clocksRunOut = (page: Page) =>
  page.routeWebSocket(WALL_SOCKET, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((frame) => server.send(frame));
    server.onMessage((frame) => ws.send(String(frame).replace(/"endsAt":\d+/, '"endsAt":1')));
  });
/** The next 00:00 UTC, when a wall whose day is spent takes changes again, and how this machine's clock writes it. */
function dayTurns() {
  const resetsAt = (Math.floor(Date.now() / 86_400_000) + 1) * 86_400_000;
  const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(resetsAt),
  );
  return { resetsAt, time };
}

/** Writes a note in the list through the wall's action, as a person does. */
const writeInList = async (page: Page, text: string) => {
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await page.getByRole("textbox", { name: "Text des Zettels" }).fill(text);
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-list__row").filter({ hasText: text })).toHaveCount(1);
};

/** The address of a wall that was never made: what the Worker says about it is the test's. */
const SOME_WALL = `/w/${"c".repeat(64)}`;
const WALL_REQUEST = /\/api\/walls\/[0-9a-f]{64}$/;
const WALL_SOCKET = /\/api\/walls\/[0-9a-f]{64}\/ws$/;
const ARRANGE_REQUEST = /\/api\/walls\/[0-9a-f]{64}\/arrange$/;

/** Eight notes that begin with two words, five and three: the Worker's stand-in makes the groups „Termine“ and
 *  „Werkzeuge“ of them, the larger one first. */
const TO_ARRANGE = [
  "Termine ohne Ergebnis",
  "Werkzeuge, die niemand erklärt hat",
  "Termine, die eine Mail sein könnten",
  "Werkzeuge wechseln jedes halbe Jahr",
  "Termine zur selben Zeit in zwei Teams und ohne dass jemand vorher sagt, worum es gehen soll",
  "Termine ohne Protokoll",
  "Termine am Freitagnachmittag",
  "Werkzeuge: der Build dauert zu lange",
];
/** On an open wall with those notes, as its moderation; Ben wrote them and has left. As its surface, or as its list. */
/** A key of the tests for „Eigener Schlüssel“: no provider's. */
const KEY_OF_THE_TEST = "ideabeam-test-key-7f3a9c1e5b2d8a4f6c0e";
const toArrange = (view: "surface" | "list", ...steps: Step[]) =>
  then((page) => enter(page, { hidden: false, notes: TO_ARRANGE, view }), ...steps);
/** The proposal has come and stands as a preview. */
const proposed: Step = async (page) => {
  await press("Ordnen")(page);
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
};
/** The proposal is applied: the wall is arranged, and nothing has changed since. */
const arranged: Step = async (page) => {
  await proposed(page);
  await press("Anwenden")(page);
  await expect(sentence(page)).toHaveText("8 Zettel in 2 Gruppen. 1 Person ist da.");
};

const screens: Screen[] = [
  // the start as a first visit reads it, and as a browser that knows two walls does: with the way back onto one
  { name: "start-leer", path: "/", heading: CLAIM, view: view("start"), overlay: null },
  { name: "start", path: "/", heading: CLAIM, view: view("start"), overlay: null, prepare: used() },
  {
    // the start in English, and at 200 %: the head, the long sentences, the picture of a wall, an answer
    name: "start-englisch",
    largeText: true,
    path: "/",
    heading: "Everyone writes notes, an AI groups them.",
    view: view("start"),
    overlay: null,
    prepare: then(
      (page) => page.evaluate(() => localStorage.setItem("sb-lang", "en")),
      (page) => page.reload(),
      (page) => page.locator("details.sb-faq__item").first().locator("summary").click(),
    ),
  },
  {
    name: "befehle",
    path: "/",
    heading: CLAIM,
    overlay: "app-commands",
    prepare: used((page) => page.keyboard.press("ControlOrMeta+k")),
  },
  {
    name: "waende-leer",
    path: "/waende",
    heading: "Meine Wände",
    view: '[data-sb-view-type="state-empty"]',
    overlay: null,
  },
  {
    name: "waende",
    path: "/waende",
    heading: "Meine Wände",
    view: '[data-sb-view-type="list"]',
    overlay: null,
    prepare: used(),
  },
  {
    // the menu of a row: the wall leaves the list of this device, after a question
    name: "waende-menue",
    path: "/waende",
    heading: "Meine Wände",
    overlay: "app-wall-1",
    prepare: used(press(`Mehr zu „${QUESTION}“`)),
  },
  {
    name: "waende-entfernen",
    path: "/waende",
    heading: "Meine Wände",
    overlay: "app-dlg-wall",
    prepare: used(press(`Mehr zu „${QUESTION}“`), item("Aus der Liste entfernen")),
  },
  {
    // the question, and the choice of the method: „Still sammeln“ is chosen, every method with its short description
    name: "neu",
    path: "/neu",
    heading: "Neue Wand",
    view: view("neu"),
    overlay: null,
    prepare: then((page) =>
      expect(page.getByRole("radio", { name: "Still sammeln, bündeln, verdeckt wählen" })).toBeChecked(),
    ),
  },
  {
    // „Freie Wand“ chosen: the wall will show every note at once; its „Mehr dazu“ open
    name: "neu-offen",
    path: "/neu",
    heading: "Neue Wand",
    view: view("neu"),
    overlay: null,
    prepare: then(
      (page) => page.fill("#app-f-question", QUESTION),
      (page) => page.getByRole("radio", { name: "Freie Wand" }).check(),
      (page) => page.locator('[data-method="free"] .app-method__more').click(),
      (page) => expect(page.getByRole("radio", { name: "Freie Wand" })).toBeChecked(),
      (page) => expect(page.locator('[data-method="free"] .app-method__about')).toBeVisible(),
    ),
  },
  {
    // „Schätzen – Diskutieren – Schätzen“ chosen: the unit of its number under the choice (stage M3)
    name: "neu-schaetzen",
    path: "/neu",
    heading: "Neue Wand",
    view: view("neu"),
    overlay: null,
    prepare: then(
      (page) => page.fill("#app-f-question", ESTIMATE_QUESTION),
      (page) => page.getByRole("radio", { name: "Schätzen – Diskutieren – Schätzen" }).check(),
      (page) => page.fill("#app-f-unit", "Tage"),
      (page) => expect(page.locator("#app-f-unit")).toBeVisible(),
    ),
  },
  {
    name: "neu-fehler",
    path: "/neu",
    heading: "Neue Wand",
    view: view("neu"),
    overlay: null,
    prepare: then(
      (page) => page.fill("#app-f-question", "x".repeat(141)),
      submit,
      (page) => expect(page.locator("#app-f-question-error")).toBeVisible(),
    ),
  },
  {
    // the Worker answers, but with no wall: the reason stands before the action, which offers to try again
    name: "neu-gescheitert",
    path: "/neu",
    heading: "Neue Wand",
    view: view("neu"),
    overlay: null,
    prepare: then(
      (page) => page.route("**/api/walls", (route) => route.fulfill({ json: {} })),
      (page) => page.fill("#app-f-question", LONG_QUESTION),
      submit,
      (page) => expect(page.locator("#app-form [role=alert]")).toContainText("Die Wand ließ sich nicht anlegen."),
      (page) => expect(page.locator('#app-form button[type="submit"]')).toHaveText("Noch mal versuchen"),
    ),
  },
  {
    name: "neu-ungesichert",
    path: "/neu",
    heading: "Neue Wand",
    overlay: "app-dlg-unsaved",
    prepare: then(
      (page) => page.fill("#app-f-question", QUESTION),
      (page) => page.locator("#app-form").getByRole("button", { name: "Abbrechen" }).click(),
    ),
  },
  {
    name: "beitreten",
    path: "/",
    heading: QUESTION,
    view: view("beitreten"),
    overlay: null,
    prepare: atTheDoor(),
  },
  {
    // the wall knows an Anna already: the sentence at the field says what to do
    name: "beitreten-vergeben",
    path: "/",
    heading: QUESTION,
    view: view("beitreten"),
    overlay: null,
    prepare: atTheDoor(
      {},
      (page) => page.fill("#app-f-as", "anna"),
      submit,
      (page) => expect(page.locator("#app-f-as-error")).toBeVisible(),
    ),
  },
  {
    // as many people are on the wall as it holds: the sentence stands before the action, which offers to try again
    name: "beitreten-voll",
    path: "/",
    heading: QUESTION,
    view: view("beitreten"),
    overlay: null,
    prepare: atTheDoor(
      { here: FULL },
      (page) => page.fill("#app-f-as", "Ben"),
      submit,
      (page) =>
        expect(page.locator("#app-form [role=alert]")).toHaveText("Die Wand ist voll. Versuch es später noch mal."),
      (page) => expect(page.locator('#app-form button[type="submit"]')).toHaveText("Noch mal versuchen"),
    ),
  },
  {
    // English, and the one screen at 200 %: a form under a question of the full length, with its field, help and
    // data-path line
    name: "beitreten-englisch",
    largeText: true,
    path: "/",
    heading: LONG_QUESTION,
    view: view("beitreten"),
    overlay: null,
    prepare: then(
      (page) => page.evaluate(() => localStorage.setItem("sb-lang", "en")),
      atTheDoor({ question: LONG_QUESTION }, (page) => page.fill("#app-f-as", "Benjamin")),
      (page) => expect(page.locator('#app-form button[type="submit"]')).toHaveText("Join"),
    ),
  },
  {
    // the Worker has not answered yet: the view says what it waits for
    name: "wand-oeffnet",
    path: "/",
    heading: "Wand",
    view: '[data-sb-view-type="state-loading"]',
    overlay: null,
    prepare: then(
      (page) => page.route(WALL_REQUEST, () => undefined),
      (page) => page.goto(SOME_WALL),
      (page) => page.getByText("Wand wird geöffnet …").waitFor(),
    ),
  },
  {
    // an empty wall, with somebody else known to it: what to do now is to write; the surface says how it fills
    name: "wand",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onTheWall(
      (page) => expect(sentence(page)).toHaveText("Noch keine Zettel. 1 Person ist da."),
      (page) =>
        expect(page.locator(".app-state__note")).toHaveText([
          "Du moderierst: Jetzt schreiben alle ihre Ideen auf Zettel, du auch.",
        ]),
      // the moderation's zone is the zone of arranging once the notes are revealed, also on an empty wall: „Ordnen“
      // with „Neuer Zettel“ beside it, and it keeps its height when the first note arrives
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Ordnen"),
      (page) => expect(page.getByRole("button", { name: "Neuer Zettel", exact: true })).toBeVisible(),
      (page) => expect(page.locator(".app-surface__empty")).toBeVisible(),
    ),
  },
  {
    // nobody else has come yet: what to do now is to send the link around, and the link stands right there
    name: "wand-allein",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      (page) => enter(page, { hidden: false }),
      (page) => expect(sentence(page)).toHaveText("Noch keine Zettel. 1 Person ist da."),
      (page) =>
        expect(page.locator(".app-state__note").first()).toHaveText(
          "Du moderierst: Schick den Link an dein Team, dann schreibt ihr alle eure Ideen auf Zettel.",
        ),
      (page) => expect(page.locator(".app-state").getByRole("button", { name: "Link kopieren" })).toBeVisible(),
    ),
  },
  {
    // a wall with notes, short ones and one of nearly the full length: all in view, as a wall opens. Also at 200 %,
    // where a note is twice as large on the screen and the world is drawn smaller for it
    name: "wand-zettel",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onNotes(
      (page) => expect(sentence(page)).toHaveText("6 Zettel. 1 Person ist da."),
      // enough notes for the AI: what to do now leads to „Ordnen“, the moderation's primary action, and the line
      // under it says where it is computed, before anything is sent
      (page) =>
        expect(page.locator(".app-state__note").first()).toHaveText(
          "Du moderierst: Wenn alle fertig sind, schlägt „Ordnen“ Gruppen mit Überschriften vor. Von Hand geht es genauso: Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
        ),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Ordnen"),
      (page) =>
        expect(page.locator(".sb-action-hint").first()).toHaveText(
          "„Ordnen“ schickt die Frage und die Texte der Zettel, ohne Namen, an Cloudflares KI-Dienst Workers AI: laut Cloudflare ohne Speicherung und ohne Training, aber nicht sicher in der EU. Mehr unter Datenschutz.",
        ),
    ),
  },
  {
    // a wall with groups: frames without fill with their titles, one still without a name, notes in them and beside
    // them; the state says how many notes lie in how many groups, and what to do now is to sort and to name. Also
    // at 200 %
    name: "wand-gruppen",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onGroups(
      "surface",
      (page) => expect(sentence(page)).toHaveText("9 Zettel, 6 davon in 3 Gruppen. 1 Person ist da."),
      (page) =>
        expect(page.locator(".app-state__note").first()).toHaveText(
          "Du moderierst: Schiebt zusammen, was zusammengehört, und gebt jeder Gruppe einen Namen.",
        ),
      (page) => expect(page.locator(".app-group[data-group]")).toHaveText(["Abstimmung", "Werkzeuge", "Ohne Titel"]),
      (page) => expect(page.getByRole("radio", { name: "Fläche", exact: true })).toBeChecked(),
    ),
  },
  {
    // a group is the current thing: the mark stands around its frame with the handle that changes its size, and its
    // tools stand in the row above the ground
    name: "wand-gruppe-aktuell",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onGroups(
      "surface",
      pressGroup("Werkzeuge"),
      (page) => expect(page.locator(".app-surface__handle")).toBeVisible(),
      (page) => expect(page.locator(".app-surface__tools").getByRole("button", { name: "Umbenennen" })).toBeVisible(),
      (page) =>
        expect(page.locator(".app-surface__tools").getByRole("button", { name: "Gruppe löschen" })).toBeVisible(),
    ),
  },
  {
    // a group's title being written: the field stands in the place of the title, „Abbrechen“ and „Sichern“ in the
    // row of tools. A small wall: the view goes to life size for the field, and everything still fits it
    name: "wand-gruppe-benennen",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      (page) => enter(page, { hidden: false, groups: [{ title: "Abstimmung", notes: ["Unklar, wer entscheidet"] }] }),
      pressGroup("Abstimmung"),
      (page) => page.keyboard.press("Enter"),
      (page) => expect(page.getByRole("textbox", { name: "Titel der Gruppe" })).toBeFocused(),
      (page) => page.keyboard.type(" im Team"),
      (page) => expect(page.getByRole("button", { name: "Sichern", exact: true })).toBeVisible(),
    ),
  },
  {
    // several notes are selected: each carries the frame and the check of a picked note, and the count stands with
    // the selection's tools
    name: "wand-auswahl",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onGroups(
      "surface",
      pressNote("Weniger Termine"),
      pressNote("Entscheidungen aufschreiben", true),
      (page) => expect(page.locator(".app-surface__count")).toHaveText("2 Zettel ausgewählt"),
      (page) => expect(page.locator(".app-note[data-picked]")).toHaveCount(2),
      (page) =>
        expect(page.locator(".app-surface__tools").getByRole("button", { name: "Auswahl aufheben" })).toBeVisible(),
    ),
  },
  {
    // „Verschieben nach …“: the wall's groups and „Keine Gruppe“ as a choice, the way to move without dragging
    name: "wand-verschieben",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-move",
    prepare: onGroups("surface", pressNote("Weniger Termine"), press("Verschieben nach …"), (page) =>
      expect(page.locator("#app-dlg-move").getByRole("radio")).toHaveCount(4),
    ),
  },
  {
    // the question before a group is deleted: the frame goes, and it says what becomes of its notes
    name: "wand-gruppe-loeschen",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-group",
    prepare: onGroups("surface", pressGroup("Abstimmung"), press("Gruppe löschen"), (page) =>
      expect(page.locator("#app-dlg-group")).toContainText("Die 3 Zettel darin bleiben auf der Wand, ohne Gruppe."),
    ),
  },
  {
    // the same wall as a list: the groups as headings with their counts and menus, the notes as rows, the notes
    // without a group under their own heading. Also at 200 %
    name: "wand-liste",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: onGroups(
      "list",
      (page) =>
        expect(page.locator(".app-list h2.sb-list-header")).toHaveText([
          "Abstimmung 3",
          "Werkzeuge 2",
          "Ohne Titel 1",
          "Ohne Gruppe 3",
        ]),
      (page) => expect(page.locator(".app-list__row")).toHaveCount(9),
      (page) => expect(page.getByRole("radio", { name: "Liste", exact: true })).toBeChecked(),
    ),
  },
  {
    // the list of an empty wall says how it fills
    name: "wand-liste-leer",
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: then(
      (page) => enter(page, { hidden: false, others: ["Ben"], view: "list" }),
      (page) =>
        expect(page.locator(".app-list__none")).toHaveText(
          "Noch keine Zettel. „Neuer Zettel“ schreibt den ersten, und alle auf der Wand sehen ihn sofort.",
        ),
    ),
  },
  {
    // a note being written in the list: the field with its label in a row under the notes without a group, with
    // „Abbrechen“ and „Sichern“
    name: "wand-liste-schreiben",
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: onGroups(
      "list",
      press("Neuer Zettel"),
      (page) => expect(page.getByRole("textbox", { name: "Text des Zettels" })).toBeFocused(),
      (page) => page.keyboard.type("Jeden Montag eine halbe Stunde planen"),
      (page) => expect(page.getByRole("button", { name: "Sichern", exact: true })).toBeVisible(),
    ),
  },
  {
    // a group's title being written in the list: the field in the place of the heading
    name: "wand-liste-gruppe-benennen",
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: onGroups(
      "list",
      press("Mehr zu „Ohne Titel“"),
      item("Umbenennen"),
      (page) => expect(page.getByRole("textbox", { name: /^Titel der Gruppe/ })).toBeFocused(),
      (page) => page.keyboard.type("Pausen"),
    ),
  },
  {
    // the menu of a row of the list: what the surface has as a note's tools. The first row's, whichever note that
    // is: two notes made in the same millisecond stand in the order of their ids
    name: "wand-liste-menue",
    path: "/",
    heading: QUESTION,
    overlay: "app-row-1",
    prepare: onGroups("list", async (page) => {
      const more = page
        .locator(".app-list__row")
        .first()
        .getByRole("button", { name: /^Mehr zu „/ });
      await more.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise((seen) => requestAnimationFrame(() => requestAnimationFrame(seen))));
      await more.click();
    }),
  },
  {
    // „Verschieben nach …“ from a row of the list
    name: "wand-liste-verschieben",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-move",
    prepare: onGroups("list", press("Mehr zu „Weniger Termine“"), item("Verschieben nach …"), (page) =>
      expect(page.locator("#app-dlg-move").getByRole("radio", { name: "Keine Gruppe" })).toBeChecked(),
    ),
  },
  {
    // a note just written: it is the current one, its tools stand in the row above the ground, and the keyboard
    // is on the surface. From 1024 px „Tasten“ shows the line that names the surface's keys
    name: "wand-zettel-aktuell",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: withOwnNote(
      (page) => expect(page.locator(".app-surface__mark")).toBeVisible(),
      (page) => expect(page.locator(".app-surface__tools").getByRole("button", { name: "Bearbeiten" })).toBeVisible(),
      async (page) => {
        const keys = page.locator(".app-surface__tools").getByRole("button", { name: "Tasten" });
        if ((page.viewportSize()?.width ?? 0) < 1024) return expect(keys).toBeHidden();
        await keys.click();
        await expect(page.locator("#app-surface-keys")).toBeInViewport({ ratio: 0.99 });
      },
    ),
  },
  {
    // a note being edited: the field stands in the note's place, „Abbrechen“ and „Sichern“ in the row of tools
    name: "wand-zettel-schreiben",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: withOwnNote(
      (page) => page.keyboard.press("Enter"),
      (page) => expect(page.getByRole("textbox", { name: "Text des Zettels" })).toBeFocused(),
      (page) => page.keyboard.type(", und die Ergebnisse aufschreiben"),
      (page) => expect(page.getByRole("button", { name: "Sichern", exact: true })).toBeVisible(),
    ),
  },
  {
    // a new note near the limit of its text: the field counts
    name: "wand-zettel-grenze",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onTheWall(
      press("Neuer Zettel"),
      (page) => page.getByRole("textbox", { name: "Text des Zettels" }).fill(NOTES[5]!),
      (page) => expect(page.locator("#app-note-length")).toHaveText(`${NOTES[5]!.length} von 300 Zeichen`),
    ),
  },
  {
    // the question before a note is deleted: what is lost
    name: "wand-zettel-loeschen",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-note",
    prepare: withOwnNote(press("Löschen")),
  },
  {
    // the wall refuses a change: the note is taken back, and a sentence says why, next to where it was made
    name: "wand-abgelehnt",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      (page) =>
        page.routeWebSocket(WALL_SOCKET, (ws) => {
          const server = ws.connectToServer();
          server.onMessage((frame) => ws.send(frame));
          ws.onMessage((frame) => {
            // (the heartbeat is no JSON)
            const text = String(frame);
            const command = (text.startsWith("{") ? JSON.parse(text) : {}) as { type?: string; opId?: string };
            if (command.type === "note.create")
              ws.send(JSON.stringify({ type: "reject", opId: command.opId, code: "LIMIT" }));
            else server.send(frame);
          });
        }),
      (page) => enter(page, { hidden: false, others: ["Ben"] }),
      press("Neuer Zettel"),
      (page) => page.getByRole("textbox", { name: "Text des Zettels" }).fill("Mehr Pausen"),
      (page) => page.keyboard.press("Enter"),
      (page) =>
        expect(page.locator(".app-surface__problem")).toHaveText(
          "Die Wand ist voll: Mehr als 500 Zettel passen nicht darauf. Lösch einen, dann ist wieder Platz.",
        ),
      (page) => expect(page.locator(".app-note")).toHaveCount(0),
    ),
  },
  // the wall's „Mehr“: the moderation link, the choices of appearance and, last, what deletes
  { name: "wand-mehr", path: "/", heading: QUESTION, overlay: "app-more", prepare: onTheWall(press("Mehr")) },
  {
    // as somebody who does not moderate, on a wall whose question has the full length; its moderation is here
    name: "wand-teilnehmer",
    path: "/",
    heading: LONG_QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      async (page) => {
        const { wallId, adminToken } = await makeWall(page, LONG_QUESTION, { hidden: false });
        staying.push(await join(wallId, "Anna-Katharina Müller-Lüdenscheidt", adminToken));
        await page.goto(`/w/${wallId}`);
      },
      (page) => page.fill("#app-f-as", "Ben"),
      submit,
      (page) => expect(sentence(page)).toHaveText("Noch keine Zettel. 2 Personen sind da."),
      (page) => expect(page.locator(".app-state__note")).toHaveText(["Schreib deine Ideen auf Zettel."]),
    ),
  },
  {
    name: "wand-loeschen",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-delete",
    prepare: onTheWall(press("Mehr"), item("Wand löschen")),
  },
  {
    // the line is cut and stays dead: the state sentence says so, and the wall stays as it stood
    name: "wand-getrennt",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(async (page) => {
      let dead = false;
      const cut: Array<() => void> = [];
      await page.routeWebSocket(WALL_SOCKET, (ws) => {
        // a try on the dead line never ends: the socket of the page stays connecting, as on a network that is gone
        if (dead) return new Promise<void>(() => undefined);
        const server = ws.connectToServer();
        cut.push(() => {
          void server.close();
          void ws.close();
        });
      });
      await enter(page, { hidden: false, others: ["Ben"] });
      dead = true;
      for (const line of cut) line();
      await expect(sentence(page)).toHaveText("Verbindung getrennt. Wird neu verbunden …");
    }),
  },
  {
    // the Worker speaks a newer protocol than this script: the state sentence asks for a reload
    name: "wand-veraltet",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      (page) =>
        page.routeWebSocket(WALL_SOCKET, (ws) => {
          const server = ws.connectToServer();
          ws.onMessage((frame) => server.send(frame));
          server.onMessage((frame) => ws.send(String(frame).replace(/"protocolVersion":\d+/, '"protocolVersion":999')));
        }),
      (page) => enter(page, { hidden: false, others: ["Ben"] }),
      (page) => expect(sentence(page)).toHaveText("Es gibt eine neue Version. Lade die Seite neu."),
    ),
  },
  {
    name: "wand-geloescht",
    path: "/",
    heading: "Wand gelöscht",
    view: '[data-sb-view-type="state-error"]',
    overlay: null,
    prepare: onTheWall(
      press("Mehr"),
      item("Wand löschen"),
      (page) => page.locator('#app-dlg-delete button[value="confirm"]').click(),
      (page) => page.getByText("Diese Wand wurde gelöscht.").waitFor(),
    ),
  },
  {
    // an address of another shape than a wall's: the app says so without asking the Worker
    name: "wand-unbekannt",
    path: "/w/keine-wand",
    heading: "Unbekannte Wand",
    view: view("wand"),
    overlay: null,
  },
  {
    // the Worker answers, but not with a wall: the view says so and offers to try again
    name: "wand-nicht-geoeffnet",
    path: "/",
    heading: "Wand",
    view: '[data-sb-view-type="state-error"]',
    overlay: null,
    prepare: then(
      (page) => page.route(WALL_REQUEST, (route) => route.fulfill({ json: {} })),
      (page) => page.goto(SOME_WALL),
      (page) => page.getByText("Die Wand ließ sich nicht öffnen.").waitFor(),
    ),
  },
  {
    // A wall right after it was made, as its moderation, alone: the notes are hidden, the state says so, what to do
    // now is to send the link around, and the clock's controls stand beside the state. The surface says how it fills
    name: "wand-verdeckt-leer",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      (page) => enter(page),
      (page) => expect(sentence(page)).toHaveText("Verdecktes Schreiben: noch keine Zettel. 1 Person ist da."),
      (page) =>
        expect(guide(page)).toHaveText([
          "Du moderierst: Schick den Link an dein Team. Alle schreiben für sich, und niemand liest mit, bis du aufdeckst.",
        ]),
      (page) => expect(page.locator(".app-state").getByRole("button", { name: "Link kopieren" })).toBeVisible(),
      (page) => expect(clockControls(page).getByRole("button", { name: "Uhr starten" })).toBeVisible(),
      (page) =>
        expect(page.locator(".app-surface__empty")).toHaveText(
          "„Neuer Zettel“ legt einen Zettel auf die Fläche. Die anderen sehen ihn erst nach dem Aufdecken.",
        ),
      (page) => expect(hiddenLine(page)).toHaveText("Von den anderen liegt noch kein Zettel auf der Wand."),
    ),
  },
  {
    // the wall while the notes are hidden, as its moderation: one's own note on the surface, of the others' a number
    // in one line; „Aufdecken“ is the primary action, „Neuer Zettel“ the second one beside it; no „Neue Gruppe“.
    // Also at 200 %
    name: "wand-verdeckt",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onHidden(
      "surface",
      (page) => expect(hiddenLine(page)).toHaveText("3 Zettel der anderen liegen verdeckt auf der Wand."),
      (page) => expect(page.locator(".app-note[data-note]")).toHaveText(["Fokuszeit am Vormittag Deiner"]),
      (page) =>
        expect(guide(page)).toHaveText([
          "Du moderierst: Alle schreiben für sich, niemand liest mit. Wenn alle fertig sind, zeigt „Aufdecken“ allen jeden Zettel.",
        ]),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Weiter: Aufdecken"),
      (page) => expect(page.getByRole("button", { name: "Neuer Zettel", exact: true })).toBeVisible(),
      (page) => expect(page.getByRole("button", { name: "Neue Gruppe" })).toHaveCount(0),
      (page) =>
        expect(page.locator(".sb-action-hint")).toHaveText(
          "Geht an den Server von IdeaBeam in der EU. Die anderen sehen es erst nach dem Aufdecken.",
        ),
    ),
  },
  {
    // the same wall as a list: one's own notes under their own heading, the others' as the same line. Also at 200 %
    name: "wand-verdeckt-liste",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: onHidden(
      "list",
      (page) => expect(hiddenLine(page)).toHaveText("3 Zettel der anderen liegen verdeckt auf der Wand."),
      (page) => expect(page.locator(".app-list h2.sb-list-header")).toHaveText(["Deine Zettel 1"]),
    ),
  },
  {
    // the wall while the notes are hidden, as somebody who does not moderate: „Neuer Zettel“ stays the primary
    // action, what to do now says that nobody reads along, and there are no controls of the clock
    name: "wand-verdeckt-teilnehmer",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: asMember(
      () => Promise.resolve(),
      (page) => expect(hiddenLine(page)).toHaveText("2 Zettel der anderen liegen verdeckt auf der Wand."),
      (page) =>
        expect(guide(page)).toHaveText([
          "Schreib deine Ideen auf Zettel. Niemand liest mit, bis die Moderation aufdeckt.",
        ]),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Neuer Zettel"),
      (page) => expect(page.getByRole("button", { name: "Aufdecken" })).toHaveCount(0),
      (page) => expect(clockControls(page)).toHaveCount(0),
    ),
  },
  {
    // the question before revealing: it says how many notes lie there, that everyone will see every one, and that
    // it cannot be taken back
    name: "wand-aufdecken",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-reveal",
    prepare: onHidden("surface", press("Weiter: Aufdecken"), (page) =>
      expect(page.locator("#app-dlg-reveal")).toContainText(
        "Auf der Wand liegen 4 Zettel. Nach dem Aufdecken sehen alle jeden Zettel, auch jeden, der noch dazukommt. Das lässt sich nicht rückgängig machen.",
      ),
    ),
  },
  {
    // the clock runs: the time left as a sentence in whole minutes, as large as the state; beside the state the
    // moderation's controls: pause, five minutes more, no clock. Also at 200 %
    name: "wand-uhr",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onHidden(
      "surface",
      (page) => clockControls(page).getByLabel("Zeit zum Schreiben").selectOption("10"),
      press("Uhr starten"),
      (page) => expect(clock(page)).toHaveText("Noch 10 Minuten zum Schreiben."),
      (page) =>
        expect(clockControls(page).getByRole("button")).toHaveText([
          "Uhr anhalten",
          "5 Minuten mehr",
          "Uhr ausschalten",
        ]),
      (page) => expect(page).toHaveTitle(`Noch 10 Min. · ${QUESTION} · IdeaBeam`),
    ),
  },
  {
    // the clock is paused: the sentence says so, and the control lets it run on
    name: "wand-uhr-angehalten",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onHidden(
      "surface",
      press("Uhr starten"),
      press("Uhr anhalten"),
      (page) => expect(clock(page)).toHaveText("Die Uhr ist angehalten: noch 5 Minuten zum Schreiben."),
      (page) => expect(clockControls(page).getByRole("button", { name: "Uhr fortsetzen" })).toBeVisible(),
    ),
  },
  {
    // the time is up: the wall says so and nothing locks; the moderation still decides, and five minutes more is
    // the clock's one outlined action
    name: "wand-uhr-um",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      clocksRunOut,
      onHidden(
        "surface",
        press("Uhr starten"),
        (page) => expect(clock(page)).toHaveText("Die Zeit ist um."),
        (page) =>
          expect(guide(page)).toHaveText([
            "Du moderierst: Nichts ist gesperrt, alle können weiterschreiben. Deck auf, wenn alle fertig sind, oder gib fünf Minuten mehr.",
          ]),
        (page) => expect(clockControls(page).getByRole("button")).toHaveText(["5 Minuten mehr", "Uhr ausschalten"]),
        (page) => expect(page).toHaveTitle(`Zeit um · ${QUESTION} · IdeaBeam`),
        (page) => expect(page.locator(".sb-primary-action")).toHaveText("Weiter: Aufdecken"),
      ),
    ),
  },
  {
    // the clock as everybody else reads it: the sentence, and no controls
    name: "wand-uhr-teilnehmer",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: asMember(
      (anna) => anna.startClock(10),
      (page) => expect(clock(page)).toHaveText("Noch 10 Minuten zum Schreiben."),
      (page) => expect(clockControls(page)).toHaveCount(0),
    ),
  },
  {
    // the time is up, as everybody else reads it: writing goes on until the moderation reveals
    name: "wand-uhr-um-teilnehmer",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      clocksRunOut,
      asMember(
        (anna) => anna.startClock(1),
        (page) => expect(clock(page)).toHaveText("Die Zeit ist um."),
        (page) => expect(guide(page)).toHaveText(["Du kannst weiterschreiben, bis die Moderation aufdeckt."]),
        (page) => expect(page.getByRole("button", { name: "Neuer Zettel", exact: true })).toBeEnabled(),
      ),
    ),
  },
  {
    // the wall has written its day's changes: the change is taken back, and a sentence says what happened and from
    // what time of this device it goes on
    name: "wand-tagesgrenze",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      (page) =>
        page.routeWebSocket(WALL_SOCKET, (ws) => {
          const server = ws.connectToServer();
          server.onMessage((frame) => ws.send(frame));
          ws.onMessage((frame) => {
            // (the heartbeat is no JSON)
            const text = String(frame);
            const command = (text.startsWith("{") ? JSON.parse(text) : {}) as { type?: string; opId?: string };
            if (command.type === "note.create") {
              const { resetsAt } = dayTurns();
              ws.send(JSON.stringify({ type: "reject", opId: command.opId, code: "DAY_SPENT", resetsAt }));
            } else server.send(frame);
          });
        }),
      (page) => enter(page, { hidden: false, others: ["Ben"] }),
      press("Neuer Zettel"),
      (page) => page.getByRole("textbox", { name: "Text des Zettels" }).fill("Mehr Pausen"),
      (page) => page.keyboard.press("Enter"),
      (page) =>
        expect(page.locator(".app-surface__problem")).toHaveText(
          new RegExp(
            `^Die Wand hat heute so viel gespeichert, wie eine Wand an einem Tag darf: Deine Änderung wurde nicht übernommen\\. Ab ${dayTurns().time}\\sUhr geht es weiter\\.$`,
          ),
        ),
      (page) => expect(page.locator(".app-note")).toHaveCount(0),
    ),
  },
  {
    // „Auswählen“ is on: the way to select several notes with a finger. Two notes are picked by a press each
    name: "wand-auswaehlen",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: onNotes(
      press("Auswählen"),
      pressNote("Weniger Termine"),
      pressNote("Entscheidungen aufschreiben"),
      (page) => expect(page.locator(".app-surface__count")).toHaveText("2 Zettel ausgewählt"),
      (page) => expect(page.locator(".app-note[data-picked]")).toHaveCount(2),
    ),
  },
  {
    // the question before „Meine Angaben löschen“, as somebody who does not moderate and has written a note: the
    // note stays, without a name
    name: "wand-angaben-loeschen",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-erase",
    prepare: asMember(
      () => Promise.resolve(),
      (page) => writeNote(page, "Fokuszeit am Vormittag"),
      press("Mehr"),
      item("Meine Angaben löschen"),
      (page) =>
        expect(page.locator("#app-dlg-erase")).toContainText("Dein Zettel bleibt auf der Wand, ohne deinen Namen"),
      (page) => expect(page.locator("#app-dlg-erase")).not.toContainText("Du moderierst"),
    ),
  },
  {
    // the same question for the moderation: afterwards it moderates only with the moderation link, which the dialog
    // offers to copy
    name: "wand-angaben-loeschen-moderation",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-erase",
    prepare: onTheWall(
      (page) => writeNote(page, "Weniger Termine"),
      (page) => writeNote(page, "Entscheidungen aufschreiben"),
      // Two notes at life size no longer fit a phone's surface under the moderation's zone, which carries the line
      // of where „Ordnen“ is computed since stage 4a: the screen shows all of them, as a wall does when it opens
      press("Alles zeigen"),
      press("Mehr"),
      item("Meine Angaben löschen"),
      (page) =>
        expect(page.locator("#app-dlg-erase")).toContainText(
          "Du moderierst: Danach moderierst du diese Wand nur noch mit dem Moderationslink.",
        ),
      (page) =>
        expect(page.locator("#app-dlg-erase").getByRole("button", { name: "Moderationslink kopieren" })).toBeVisible(),
    ),
  },
  {
    // the wall has forgotten the person, and this device the wall
    name: "wand-angaben-geloescht",
    path: "/",
    heading: "Angaben gelöscht",
    view: '[data-sb-view-type="state-error"]',
    overlay: null,
    prepare: asMember(
      () => Promise.resolve(),
      press("Mehr"),
      item("Meine Angaben löschen"),
      (page) => page.locator('#app-dlg-erase button[value="confirm"]').click(),
      (page) => page.getByText("Dein Name ist von der Wand entfernt").waitFor(),
    ),
  },
  {
    // and so for the moderation: the wall stays, and so do its notes
    name: "wand-angaben-geloescht-moderation",
    path: "/",
    heading: "Angaben gelöscht",
    view: '[data-sb-view-type="state-error"]',
    overlay: null,
    prepare: onTheWall(
      (page) => writeNote(page, "Weniger Termine"),
      press("Mehr"),
      item("Meine Angaben löschen"),
      (page) => page.locator('#app-dlg-erase button[value="confirm"]').click(),
      (page) => page.getByText("Was du geschrieben hast, bleibt auf der Wand, ohne deinen Namen.").waitFor(),
    ),
  },
  {
    // „Ordnen“ was pressed and the AI has not answered: the primary action shows its own progress, „Abbrechen“ stands
    // beside it with the line that says the run counts all the same, and the state says what happens and for how
    // long by now. The answer is held back here
    name: "wand-ordnen-laeuft",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      (page) => page.route(ARRANGE_REQUEST, () => undefined),
      toArrange(
        "surface",
        press("Ordnen"),
        (page) => expect(page.locator(".sb-primary-action")).toHaveText("Ordnen läuft …"),
        (page) => expect(page.locator(".sb-primary-action")).toHaveAttribute("aria-busy", "true"),
        (page) =>
          expect(page.locator(".app-state__clock")).toHaveText(
            "Die KI ordnet 8 Zettel. Das dauert meist unter einer halben Minute.",
          ),
        (page) => expect(guide(page)).toHaveText([/^Bisher \d+\sSekunden?\.$/]),
        (page) => expect(page.getByRole("button", { name: "Abbrechen", exact: true })).toBeVisible(),
        (page) =>
          expect(page.locator(".sb-action-hint")).toHaveText([
            "„Abbrechen“ beendet nur das Warten. Der Versuch zählt trotzdem: Eine Wand lässt sich 6-mal in 24 Stunden ordnen.",
          ]),
        (page) => expect(page.getByRole("button", { name: "Neuer Zettel", exact: true })).toHaveCount(0),
      ),
    ),
  },
  {
    // the proposal as a preview on the surface, in the moderation's browser alone: the proposed frames with their
    // titles and every note in its place, all in view; the state says that it is a proposal and who sees it;
    // „Anwenden“ is the primary action, „Verwerfen“ beside it. Also at 200 %
    name: "wand-ordnen-vorschau",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: toArrange(
      "surface",
      proposed,
      (page) => expect(page.locator(".app-group[data-group]")).toHaveText(["Termine", "Werkzeuge"]),
      (page) =>
        expect(guide(page)).toHaveText([
          "„Anwenden“ ordnet die Wand für alle so, „Verwerfen“ lässt sie, wie sie war. Solange der Vorschlag steht, änderst du nichts an der Wand; die anderen arbeiten weiter.",
          "Diese Wand lässt sich in 24 Stunden 6-mal ordnen, jetzt noch 5-mal.",
        ]),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Anwenden"),
      (page) => expect(page.getByRole("button", { name: "Verwerfen", exact: true })).toBeVisible(),
      (page) =>
        expect(page.locator(".sb-action-hint")).toHaveText([
          "„Anwenden“ speichert die Anordnung auf dem Server von IdeaBeam in der EU. Alle auf der Wand sehen sie.",
        ]),
      (page) => expect(page.getByRole("button", { name: "Neue Gruppe" })).toHaveCount(0),
    ),
  },
  {
    // the same proposal in the list: its groups as headings, the notes under them, and no menu at a row or a heading
    // while it stands. Also at 200 %
    name: "wand-ordnen-vorschau-liste",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: toArrange(
      "list",
      proposed,
      (page) => expect(page.locator(".app-list h2.sb-list-header")).toHaveText(["Termine 5", "Werkzeuge 3"]),
      (page) => expect(page.locator(".app-list button[aria-haspopup]")).toHaveCount(0),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Anwenden"),
    ),
  },
  {
    // applied, and nothing has changed since: „Ordnen“ is the primary action again, „Neuer Zettel“ beside it, and
    // „Rückgängig“ as the quiet third (on a phone its icon alone); what to do now says so. The wall is the result
    // now: „Als Markdown sichern“ stands under what to do now, with its line. Also at 200 %
    name: "wand-ordnen-angewendet",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: toArrange(
      "surface",
      arranged,
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Ordnen"),
      (page) => expect(page.getByRole("button", { name: "Ordnen rückgängig machen", exact: true })).toBeVisible(),
      (page) =>
        expect(guide(page)).toHaveText([
          "Du moderierst: Die KI hat geordnet. Passt es nicht, nimmt „Rückgängig“ es sofort zurück. Sonst schiebt um und benennt um, was nicht trifft.",
          "Diese Wand lässt sich in 24 Stunden 6-mal ordnen, jetzt noch 5-mal.",
        ]),
      (page) => expect(page.locator(".app-group[data-group]")).toHaveText(["Termine", "Werkzeuge"]),
      (page) => expect(page.locator(".app-state").getByRole("button", { name: "Als Markdown sichern" })).toBeVisible(),
    ),
  },
  {
    // the arranged wall in the list, with „Rückgängig“ in the zone
    name: "wand-ordnen-angewendet-liste",
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: toArrange(
      "list",
      arranged,
      (page) => expect(page.locator(".app-list h2.sb-list-header")).toHaveText(["Termine 5", "Werkzeuge 3"]),
      (page) => expect(page.getByRole("button", { name: "Ordnen rückgängig machen", exact: true })).toBeVisible(),
    ),
  },
  {
    // the wall has changed since the run: „Rückgängig“ stands in „Mehr“, with what deletes, and asks first. The
    // question says what is lost and that it cannot be taken back
    name: "wand-ordnen-rueckgaengig",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-undo",
    prepare: toArrange(
      "list",
      arranged,
      (page) => writeInList(page, "Pausen gemeinsam machen"),
      (page) => expect(page.getByRole("button", { name: "Ordnen rückgängig machen", exact: true })).toHaveCount(0),
      press("Mehr"),
      item("Ordnen rückgängig machen"),
      (page) =>
        expect(page.locator("#app-dlg-undo")).toContainText(
          "Die Zettel liegen danach wieder dort, wo sie vor dem Ordnen lagen, und die Gruppen der KI verschwinden. Umbenannte Gruppen bleiben, mit ihren Zetteln. Was seitdem verschoben wurde, geht verloren. Das lässt sich nicht rückgängig machen.",
        ),
    ),
  },
  {
    // „Mehr“ once the wall has changed since the run: „Ordnen rückgängig machen“ first among what deletes
    name: "wand-ordnen-mehr",
    path: "/",
    heading: QUESTION,
    overlay: "app-more",
    prepare: toArrange(
      "list",
      arranged,
      (page) => writeInList(page, "Pausen gemeinsam machen"),
      press("Mehr"),
      (page) => expect(page.getByRole("menuitem", { name: "Ordnen rückgängig machen", exact: true })).toBeVisible(),
    ),
  },
  {
    // „Mehr“ in a tab that offers the moderation's own key (src/lib/key-switch.ts): the entry stands with the
    // moderation's own, before the choices of appearance
    name: "wand-schluessel-mehr",
    path: "/",
    heading: QUESTION,
    overlay: "app-more",
    prepare: toArrange("surface", offerOwnKey, press("Mehr"), (page) =>
      expect(page.getByRole("menuitem", { name: "Eigener KI-Schlüssel …", exact: true })).toBeVisible(),
    ),
  },
  {
    // the dialog „Eigener KI-Schlüssel“: what a key of one's own does and where it stays, the providers with what
    // each does with the notes and what a wall costs there, the field, the way to the provider's page. Also at 200 %
    name: "wand-schluessel",
    largeText: true,
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-key",
    prepare: toArrange("surface", offerOwnKey, openOwnKey, (page) =>
      expect(page.locator("#app-dlg-key .app-choice__note")).toHaveCount(3),
    ),
  },
  {
    // the same dialog with a key set and the field's complaint about one that was not copied whole: for whom a key
    // is set, „Schlüssel entfernen“ beside it, and the sentence at the field
    name: "wand-schluessel-eingetragen",
    path: "/",
    heading: QUESTION,
    overlay: "app-dlg-key",
    prepare: toArrange(
      "list",
      offerOwnKey,
      (page) => takeOwnKey(page, "Anthropic", KEY_OF_THE_TEST),
      openOwnKey,
      (page) => page.locator("#app-dlg-key").getByLabel("Schlüssel", { exact: true }).fill("zwei teile"),
      (page) => page.keyboard.press("Enter"),
      (page) =>
        expect(page.locator("#app-dlg-key .sb-field__error")).toHaveText(
          "Im Schlüssel stehen Leerzeichen oder Zeichen, die in keinem Schlüssel vorkommen. Kopier ihn noch mal.",
        ),
      (page) =>
        expect(page.locator("#app-dlg-key .app-key__set")).toContainText(
          "Für Anthropic ist ein Schlüssel eingetragen.",
        ),
    ),
  },
  {
    // a key is set: the line under „Ordnen“ names the provider and what it does with the notes, and a quiet line at
    // the wall's top says who „Ordnen“ asks now, how to go back, and that the provider is not measured. Also at 200 %
    name: "wand-schluessel-an",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: toArrange(
      "surface",
      offerOwnKey,
      (page) => takeOwnKey(page, "Mistral", KEY_OF_THE_TEST),
      (page) =>
        expect(guide(page).last()).toHaveText(
          "„Ordnen“ fragt Mistral, mit deinem Schlüssel. Entfernst du ihn unter „Mehr“, ordnet wieder Cloudflare. Wie gut Mistral ordnet, ist noch nicht gemessen.",
        ),
      (page) =>
        expect(page.locator(".sb-action-hint").first()).toContainText(
          "mit deinem Schlüssel direkt aus diesem Browser an Mistral: laut Mistral in Rechenzentren in der EU und der EFTA",
        ),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Ordnen"),
      // (the lines took a part of the surface's height: every note is brought into view again)
      press("Alles zeigen"),
    ),
  },
  {
    // the same wall as a list, with a key for the provider whose line is the longest
    name: "wand-schluessel-an-liste",
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: toArrange(
      "list",
      offerOwnKey,
      (page) => takeOwnKey(page, "Anthropic", KEY_OF_THE_TEST),
      (page) => expect(guide(page).last()).toContainText("„Ordnen“ fragt Anthropic, mit deinem Schlüssel."),
    ),
  },
  {
    // „Ordnen“ with a key was pressed and the provider has not answered: the state names the provider, and
    // „Abbrechen“ says that it ends the calls and what it does not undo. The provider's answer is held back here;
    // nothing of this test reaches a provider
    name: "wand-schluessel-laeuft",
    path: "/",
    heading: QUESTION,
    view: view("wand"),
    overlay: null,
    prepare: then(
      (page) => page.route("https://api.eu.mistral.ai/**", () => undefined),
      toArrange(
        "surface",
        offerOwnKey,
        (page) => takeOwnKey(page, "Mistral", KEY_OF_THE_TEST),
        press("Ordnen"),
        (page) => expect(page.locator(".sb-primary-action")).toHaveText("Ordnen läuft …"),
        (page) =>
          expect(page.locator(".app-state__clock")).toHaveText("Mistral ordnet 8 Zettel, mit deinem Schlüssel."),
        (page) =>
          expect(page.locator(".sb-action-hint")).toHaveText([
            "„Abbrechen“ beendet die Anfragen an Mistral. Was bis dahin gerechnet ist, kann Mistral deinem Konto trotzdem berechnen.",
          ]),
      ),
    ),
  },
  {
    // a step that votes (stage M2): the ballot in the place of the surface, the options with − and +, two points
    // given of two, „Abgeben“ as the primary action. Also at 200 %
    name: "wand-wahl",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="form"]',
    overlay: null,
    prepare: then(
      (page) => enterVote(page),
      (page) => page.getByRole("button", { name: "Einen Punkt mehr: Abstimmung" }).click(),
      (page) => page.getByRole("button", { name: "Einen Punkt mehr: Fokuszeit am Vormittag" }).click(),
      (page) => expect(page.locator(".app-ballot__left")).toHaveText("Alle Punkte verteilt."),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Abgeben"),
    ),
  },
  {
    // the vote counted: the result as a ranked list with places and points, no bars; keeping it is the primary
    // action. Also at 200 %
    name: "wand-ergebnis",
    largeText: true,
    path: "/",
    heading: QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="result"]',
    overlay: null,
    prepare: then(
      (page) => enterVote(page, { counted: true }),
      (page) => expect(page.locator(".app-results__row").first()).toContainText("Abstimmung"),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Als Markdown sichern"),
    ),
  },
  {
    // the first estimate (stage M3): the number field with its unit and the reason under it in the place of the
    // surface, a number typed; „Abgeben“ as the primary action. Also at 200 %
    name: "wand-schaetzung",
    largeText: true,
    path: "/",
    heading: ESTIMATE_QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="form"]',
    overlay: null,
    prepare: then(
      (page) => enterEstimate(page),
      (page) => page.fill("#app-f-estimate", "40"),
      (page) => page.fill("#app-f-reason", "Wie beim letzten Umzug, nur mit mehr Kisten"),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Abgeben"),
    ),
  },
  {
    // the second estimate for the moderation: the first round's summary above the field, no reason; „Auszählen“
    // as the primary action, „Abgeben“ beside it. Also at 200 %
    name: "wand-schaetzung-runde-2",
    largeText: true,
    path: "/",
    heading: ESTIMATE_QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="form"]',
    overlay: null,
    prepare: then(
      (page) => enterEstimate(page, { round: 2, admin: true }),
      (page) => expect(page.getByRole("region", { name: "Runde 1" }).locator(".app-estimate__row")).toHaveCount(3),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Auszählen"),
    ),
  },
  {
    // the second estimate counted: both rounds as rows of words and numbers, with how the median moved, no chart;
    // keeping it is the primary action. Also at 200 %
    name: "wand-schaetzung-ergebnis",
    largeText: true,
    path: "/",
    heading: ESTIMATE_QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="result"]',
    overlay: null,
    prepare: then(
      (page) => enterEstimate(page, { round: 2, counted: true }),
      (page) =>
        expect(page.getByRole("region", { name: "Ergebnis der Schätzung" }).locator(".app-estimate__row")).toHaveCount(
          7,
        ),
      (page) => expect(page.locator(".sb-primary-action")).toHaveText("Als Markdown sichern"),
    ),
  },
  {
    // a step of pairs (stage M4, „1-2-4-Alle“): the team and the partner at the top with the breakout room, the
    // step's clock with its moving on, the team's area on the surface with the partner's note. Also at 200 %
    name: "wand-team",
    largeText: true,
    path: "/",
    heading: TEAM_QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="tool"]',
    overlay: null,
    prepare: then(
      (page) => enterTeams(page),
      (page) => writeNote(page, "Zu zweit: ein Pate reicht"),
      press("Alles zeigen"),
      (page) => expect(page.locator(".app-area[data-own]")).toHaveCount(1),
      (page) => expect(page.locator(".app-state__sentence")).toHaveText("Euer Team: 2 Zettel. Ihr seid 2 im Team."),
      (page) => expect(page.locator(".app-state__clock")).toContainText("Dann geht es von selbst weiter."),
    ),
  },
  {
    // the same step as a list: the notes under the team's heading
    name: "wand-team-liste",
    path: "/",
    heading: TEAM_QUESTION,
    view: '[data-sb-view="wand"][data-sb-view-type="list"]',
    overlay: null,
    prepare: then(
      (page) => enterTeams(page, { view: "list" }),
      (page) => writeInList(page, "Zu zweit: ein Pate reicht"),
      (page) => expect(page.locator(".app-list .sb-list-header").first()).toContainText("· dein Team"),
    ),
  },
  {
    // the moderation's map of the teams under „Mehr“ → „Teams“, a swap begun: names by team, „Tauschen“ keys. Also
    // at 200 %
    name: "wand-teams",
    largeText: true,
    path: "/",
    heading: TEAM_QUESTION,
    view: '[data-sb-view="wand"]',
    overlay: "app-dlg-teams",
    prepare: then(
      (page) => enterTeams(page, { admin: true }),
      press("Alles zeigen"),
      press("Mehr"),
      item("Teams"),
      (page) => page.getByRole("button", { name: "Tauschen: Anna" }).click(),
      (page) => expect(page.locator(".app-state__sentence")).toHaveText("Euer Team: 1 Zettel. Ihr seid 2 im Team."),
      (page) => expect(page.locator("#app-dlg-teams")).toContainText("Mit wem tauscht Anna?"),
    ),
  },
  {
    name: "einstellungen",
    path: "/einstellungen",
    heading: "Einstellungen",
    view: view("einstellungen"),
    overlay: null,
  },
  { name: "lizenzen", path: "/lizenzen", heading: "Lizenzen", view: view("lizenzen"), overlay: null },
  { name: "impressum", path: "/impressum", heading: "Impressum", view: view("imprint"), overlay: null },
  { name: "datenschutz", path: "/datenschutz", heading: "Datenschutz", view: view("privacy"), overlay: null },
  {
    name: "barrierefreiheit",
    path: "/barrierefreiheit",
    heading: "Barrierefreiheit",
    view: view("accessibility"),
    overlay: null,
  },
  { name: "unbekannt", path: "/gibt-es-nicht", heading: "Unbekannte Adresse", view: view("unbekannt"), overlay: null },
];

checkScreens(screens, { viewCheck: "src/sebaro/checks/sb-colour-count.js" });

// What a phone shows of a wall when the browser has made no choice: the list, not the surface, on which twenty notes
// fitted into the window are too small to read. Checked at 390 px alone: a wide window opens the surface.
checkScreens(
  [
    {
      name: "wand-liste-handy",
      path: "/",
      heading: QUESTION,
      view: '[data-sb-view="wand"][data-sb-view-type="list"]',
      overlay: null,
      prepare: then(
        (page) => enter(page, { hidden: false, groups: GROUPS, notes: NOTES.slice(0, 3), view: null }),
        (page) => expect(page.locator(".app-list")).toBeVisible(),
        (page) => expect(page.locator(".app-surface")).toHaveCount(0),
        (page) => expect(page.getByRole("radio", { name: "Liste", exact: true })).toBeChecked(),
      ),
    },
  ],
  { only: "narrow", viewCheck: "src/sebaro/checks/sb-colour-count.js" },
);

// The wall's link as a QR code (sebaro: a dialog that shows): the code large, dark on light in both modes, the link as
// text under it, „Link kopieren“ and „Schließen“; never the moderation link. In light at 390 px with every check; in
// dark at 1440 px without the copy's check of a view: core rule 7 asks for the code in the light theme's colours in
// dark mode too, and that check resolves every colour in the view's own mode, so in dark it reads the code's white
// and ink as colours without a role (docs/sebaro-luecken.md, B24). tests/export.spec.ts runs axe on the dialog at both
// widths in both modes.
const qrScreen: Screen = {
  name: "wand-qr",
  path: "/",
  heading: QUESTION,
  overlay: "app-dlg-qr",
  prepare: onTheWall(press("Mehr"), item("QR-Code zeigen"), (page) =>
    expect(page.locator("#app-dlg-qr").getByTestId("qr-code")).toBeVisible(),
  ),
};
checkScreens([qrScreen], { only: "narrow", viewCheck: "src/sebaro/checks/sb-colour-count.js" });
checkScreens([qrScreen], { only: "wide" });
