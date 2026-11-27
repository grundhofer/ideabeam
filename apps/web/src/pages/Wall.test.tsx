// The views at a wall's address in jsdom: the door, and the wall as the moderation and as everybody else see it: its
// state with what to do now, its people, its notes and groups, as a surface and as a list. The Worker's answers are the test's; two real browsers on one
// wall are tests/wall.spec.ts and tests/surface.spec.ts, where the surface also has a size.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from "vitest";
import {
  agendaFor,
  NO_CLOCK,
  PROTOCOL_VERSION,
  type ClientCommand,
  type Group,
  type Note,
  type Participant,
  type ServerEvent,
} from "@ideabeam/shared";
import i18n from "../i18n";
import { useToast } from "../store/toast";
import { useWall } from "../store/wall";
import { useWalls } from "../store/walls";
import { renderApp } from "../test-app";
import { fakeSockets, nextSocket } from "../test-socket";
import { OPEN_SYNC, REVEALED_SYNC, WRITING_SYNC } from "../test-steps";

const WALL = "ab".repeat(32);
const TOKEN = "cd".repeat(16);
const QUESTION = "Was hält uns auf?";
const ME = "1".repeat(32);
const BEN = "2".repeat(32);

const sync = (participants: Participant[], notes: Note[] = [], groups: Group[] = []): ServerEvent => ({
  type: "sync",
  protocolVersion: PROTOCOL_VERSION,
  serverNow: 1_795_300_000_000,
  wall: { id: WALL, question: QUESTION, createdAt: 1_795_300_000_000 },
  participants,
  you: { participantId: ME },
  seq: notes.length,
  // a wall whose notes are there for everyone: a „Freie Wand“
  ...OPEN_SYNC,
  hidden: 0,
  clock: NO_CLOCK,
  notes,
  groups,
  arrangeRun: null,
  votes: [],
  ballot: null,
  voted: 0,
  results: [],
  teams: null,
  manual: [],
});

/** A note on the wall, the n-th one made. */
const note = (n: number, text: string, authorId = ME): Note => ({
  id: n.toString(16).padStart(32, "0"),
  mine: authorId === ME,
  text,
  x: n * 256,
  y: 0,
  groupId: null,
  createdAt: 1_795_300_000_000 + n,
  updatedAt: 1_795_300_000_000 + n,
});

/** A group on the wall, the n-th one made: a frame of a new group's size, the n-th in a row. */
const group = (n: number, title: string): Group => ({
  id: (0xa0 + n).toString(16).padStart(32, "0"),
  title,
  titleSource: "person",
  locked: true,
  x: (n - 1) * 560,
  y: 0,
  w: 528,
  h: 280,
  ord: n,
});
/** A note that lies in a group: at the m-th place of its frame's first row. */
const inGroup = (one: Note, of: Group, m = 0): Note => ({
  ...one,
  x: of.x + 16 + m * 256,
  y: of.y + 40,
  groupId: of.id,
});

/** The wall exists: the Worker answers the request for it. */
const found = () =>
  vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ wall: { id: WALL, question: QUESTION, createdAt: 1_795_300_000_000 } })),
      ),
    );

const copied = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());

/** the view that stands at the address */
const view = () => document.querySelector<HTMLElement>("[data-sb-view]")!;
/** the wall's own head: its question, the link to copy and „Mehr“ */
const head = () => within(document.querySelector<HTMLElement>("[data-sb-web-app-head]")!);
/** the state of the wall at its top: the sentence, what to do now, and while nobody else has come the link */
const stateOf = () => within(screen.getByRole("region", { name: "Stand der Wand" }));
/** what to do now: the sentences under the state sentence */
const guides = () => [...document.querySelectorAll(".app-state__note")].map((line) => line.textContent);
/** the notes on the surface, as a screen reader gets them */
const notesShown = () =>
  within(screen.getByRole("listbox", { name: "Zettel auf der Fläche" }))
    .queryAllByRole("option")
    .map((option) => option.textContent);
/** the texts of the notes under a heading of the list: the rows of the list that heading names */
const rowsUnder = (heading: string) =>
  [...screen.getByRole("list", { name: heading }).querySelectorAll(".app-list__text")].map((text) => text.textContent);
/** a row of the head's „Mehr“ menu; the menu is closed, its rows are in the page all the same */
const inMore = (name: string) => screen.queryByRole("menuitem", { name, hidden: true });

beforeEach(() => {
  fakeSockets();
  // jsdom has no clipboard
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: copied } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  copied.mockClear();
});

/** Opens the wall's address, joins at its door as Anna and returns the socket. */
async function join() {
  renderApp(`/w/${WALL}`);
  fireEvent.change(await screen.findByLabelText("Dein Name"), { target: { value: " Anna " } });
  fireEvent.click(screen.getByRole("button", { name: "Beitreten" }));
  return nextSocket();
}

test("the door: the wall's question is the heading, and the one thing asked is a name", async () => {
  // the Worker takes its time: the view says what it waits for
  let answer: (response: Response) => void = () => undefined;
  vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)));
  useWalls.setState({ displayName: "Anna" });
  renderApp(`/w/${WALL}`);
  expect((await screen.findByText("Wand wird geöffnet …")).getAttribute("role")).toBe("status");
  expect(view().getAttribute("data-sb-view-type")).toBe("state-loading");
  answer(new Response(JSON.stringify({ wall: { id: WALL, question: QUESTION, createdAt: 1_795_300_000_000 } })));
  expect(await screen.findByRole("heading", { level: 1, name: QUESTION })).toBeTruthy();
  expect(view().getAttribute("data-sb-view-type")).toBe("form");
  await waitFor(() => expect(document.title).toMatch(QUESTION));
  // the name typed last is offered again
  const name = screen.getByLabelText<HTMLInputElement>("Dein Name");
  expect(name.value).toBe("Anna");

  fireEvent.change(name, { target: { value: "  " } });
  fireEvent.click(screen.getByRole("button", { name: "Beitreten" }));
  expect(screen.getByText("Dein Name fehlt.")).toBeTruthy();
  expect(document.activeElement).toBe(name);
});

test("a wall that is not there, and one that could not be asked for, are two sentences", async () => {
  const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));
  useWalls.getState().remember({ id: WALL, question: QUESTION, as: "Anna" });
  renderApp(`/w/${WALL}`);
  expect(await screen.findByRole("heading", { level: 1, name: "Unbekannte Wand" })).toBeTruthy();
  // the browser drops a wall that is gone
  expect(useWalls.getState().walls).toEqual([]);

  fetched.mockRejectedValue(new TypeError("offline"));
  renderApp(`/w/${"ef".repeat(32)}`);
  expect(await screen.findByText("Die Wand ließ sich nicht öffnen. Prüf die Verbindung.")).toBeTruthy();
  // „Noch mal versuchen“ asks again
  fetched.mockResolvedValue(new Response("{}", { status: 404 }));
  fireEvent.click(screen.getByRole("button", { name: "Noch mal versuchen" }));
  await waitFor(() => expect(screen.getAllByRole("heading", { level: 1, name: "Unbekannte Wand" })).toHaveLength(2));
});

test("on the wall: the question, and the people with their role and whether they are here", async () => {
  found();
  const socket = await join();
  expect(socket.sent).toMatchObject([{ type: "join", name: "Anna" }]);
  socket.tell(
    sync([
      { id: BEN, name: "Ben", role: "admin", online: false },
      { id: ME, name: "Anna", role: "member", online: true },
    ]),
  );
  const people = await screen.findByRole("list", { name: /^Auf der Wand/ });
  // the view at the address is another one now, under the same question: its heading has the focus
  expect(view().getAttribute("data-sb-view")).toBe("wand");
  expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: QUESTION }));
  expect(
    within(people)
      .getAllByRole("listitem")
      .map((row) => row.textContent),
  ).toEqual(["BBenModerationnicht da", "AAnna (du)da"]);
  // the state of the wall stands at its top, and is said when it changes
  expect(screen.getByText("Noch keine Zettel. 1 Person ist da.").getAttribute("role")).toBe("status");
  // under it, what to do now: somebody who does not moderate writes
  expect(guides()).toEqual(["Schreib deine Ideen auf Zettel."]);
  // somebody who does not moderate gets the link in the wall's head, no moderation link, and cannot delete the wall
  expect(head().getByRole("button", { name: "Link kopieren" })).toBeTruthy();
  expect(inMore("Moderationslink kopieren")).toBeNull();
  expect(inMore("Wand löschen")).toBeNull();
  // somebody else has been here: nothing asks to send the link around
  expect(stateOf().queryByRole("button", { name: "Link kopieren" })).toBeNull();
  // the wall's primary action is everyone's, with the line that says where a note goes
  expect(screen.getByRole("button", { name: "Neuer Zettel" }).className).toBe("sb-primary-action");
  expect(screen.getByText("Geht an den Server von IdeaBeam in der EU. Alle auf der Wand sehen es.")).toBeTruthy();
  expect(view().hasAttribute("data-sb-primary-expected")).toBe(false);
});

test("what to do now is said under the state, a sentence per role, and it changes with the wall", async () => {
  found();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  // the moderation, alone on an empty wall: bring the team in. The link stands right there
  socket.tell(sync([{ id: ME, name: "Anna", role: "admin", online: true }]));
  await screen.findByText("Noch keine Zettel. 1 Person ist da.");
  expect(guides()).toEqual([
    "Du moderierst: Schick den Link an dein Team, dann schreibt ihr alle eure Ideen auf Zettel.",
  ]);
  expect(stateOf().getByRole("button", { name: "Link kopieren" })).toBeTruthy();
  // The moderation's zone is the zone of arranging from the moment the notes are revealed, also on an empty wall:
  // it keeps its height when the first note arrives. What to do now still says to write
  expect(screen.getByRole("button", { name: "Ordnen" }).className).toBe("sb-primary-action");
  expect(screen.getByRole("button", { name: "Neuer Zettel" }).className).toBe("sb-secondary-action");

  // somebody comes: now everyone writes, and the link has done its work
  socket.tell({ type: "presence.join", participant: { id: BEN, name: "Ben", role: "member", online: true } });
  await screen.findByText("Noch keine Zettel. 2 Personen sind da.");
  expect(guides()[0]).toBe("Du moderierst: Jetzt schreiben alle ihre Ideen auf Zettel, du auch.");
  expect(stateOf().queryByRole("button", { name: "Link kopieren" })).toBeNull();

  // a note lies on the wall: write on, and sort (the second change in a moment waits for the moment to end)
  socket.tell({ type: "note.created", seq: 1, note: note(1, "Weniger Termine", BEN) });
  await screen.findByText("1 Zettel. 2 Personen sind da.", undefined, { timeout: 3000 });
  expect(guides()).toEqual([
    "Du moderierst: Alle schreiben weiter. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  ]);
  // the state sentence is the one live region here: the sentences under it are read, not announced
  expect(document.querySelectorAll(".app-state [role=status]")).toHaveLength(1);
});

test("everybody else is told to write; alone on a wall, to pass the link on", async () => {
  found();
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  await screen.findByText("Noch keine Zettel. 1 Person ist da.");
  expect(guides()).toEqual(["Schreib deine Ideen auf Zettel, und schick den Link weiter, wenn noch jemand fehlt."]);
  expect(stateOf().getByRole("button", { name: "Link kopieren" })).toBeTruthy();

  socket.tell(
    sync(
      [
        { id: BEN, name: "Ben", role: "admin", online: true },
        { id: ME, name: "Anna", role: "member", online: true },
      ],
      [note(1, "Weniger Termine", BEN), note(2, "Mehr Pausen")],
    ),
  );
  await screen.findByText("2 Zettel. 2 Personen sind da.");
  expect(guides()).toEqual([
    "Schreib weitere Ideen auf Zettel. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  ]);
});

test("the state sentence knows groups, and what to do now goes on with them: sort, name, done", async () => {
  found();
  const socket = await join();
  const [tools, open] = [group(1, "Werkzeuge"), group(2, "")];
  const people: Participant[] = [
    { id: BEN, name: "Ben", role: "admin", online: true },
    { id: ME, name: "Anna", role: "member", online: true },
  ];
  // groups stand, a note lies in none of them, and a group has no name yet
  socket.tell(
    sync(
      people,
      [
        inGroup(note(1, "Der Build dauert zu lange", BEN), tools),
        inGroup(note(2, "Mehr Pausen"), open),
        note(3, "Fokus"),
      ],
      [tools, open],
    ),
  );
  await screen.findByText("3 Zettel, 2 davon in 2 Gruppen. 2 Personen sind da.");
  expect(guides()).toEqual(["Schieb zusammen, was zusammengehört, und gib jeder Gruppe einen Namen."]);
  // every note lies in a group now, and the second group gets its name: sorted
  socket.tell({
    type: "notes.moved",
    seq: 4,
    moves: [{ noteId: note(3, "").id, x: open.x + 272, y: 40, groupId: open.id }],
  });
  socket.tell({ type: "group.updated", seq: 5, group: { ...open, title: "Pausen" } });
  await screen.findByText("3 Zettel in 2 Gruppen. 2 Personen sind da.", undefined, { timeout: 3000 });
  expect(guides()).toEqual(["Jeder Zettel liegt in einer benannten Gruppe. Schreib weiter, wenn noch etwas fehlt."]);
  // a group goes: its notes stay, without a group, and the sentence says how many still lie in one
  socket.tell({ type: "group.deleted", seq: 6, groupId: open.id });
  await screen.findByText("3 Zettel, 1 davon in 1 Gruppe. 2 Personen sind da.", undefined, { timeout: 3000 });
  // groups without notes are said as what they are
  socket.tell(sync(people, [note(1, "Fokus")], [tools, open]));
  await screen.findByText("1 Zettel und 2 leere Gruppen. 2 Personen sind da.", undefined, { timeout: 3000 });
  socket.tell(sync(people, [], [tools]));
  await screen.findByText("Noch keine Zettel, 1 leere Gruppe. 2 Personen sind da.", undefined, { timeout: 3000 });
});

test("a burst of notes is not said note by note: the first change shows at once, the rest together", async () => {
  found();
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  const sentence = await screen.findByText("Noch keine Zettel. 1 Person ist da.");
  const said: string[] = [];
  const observer = new MutationObserver(() => said.push(sentence.textContent ?? ""));
  observer.observe(sentence, { childList: true, characterData: true, subtree: true });
  // one note, and a moment later five more, one by one
  socket.tell({ type: "note.created", seq: 1, note: note(1, "Zettel 1", BEN) });
  await screen.findByText("1 Zettel. 1 Person ist da.");
  for (let n = 2; n <= 6; n++) {
    socket.tell({ type: "note.created", seq: n, note: note(n, `Zettel ${n}`, BEN) });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  // the notes are there at once
  await waitFor(() => expect(notesShown()).toHaveLength(6));
  await screen.findByText("6 Zettel. 1 Person ist da.", undefined, { timeout: 3000 });
  observer.disconnect();
  // (the number and its noun stand together: a no-break space)
  expect(said).toEqual(["1\u00a0Zettel. 1 Person ist da.", "6\u00a0Zettel. 1 Person ist da."]);
});

test("the notes are a list a screen reader can walk: each says its text, nobody's name, and one's own says so", async () => {
  found();
  const socket = await join();
  socket.tell(
    sync(
      [
        { id: BEN, name: "Ben", role: "admin", online: false },
        { id: ME, name: "Anna", role: "member", online: true },
      ],
      [note(1, "Weniger Termine", BEN), note(2, "Mehr Pausen")],
    ),
  );
  await waitFor(() => expect(notesShown()).toEqual(["Weniger Termine", "Mehr Pausen Deiner"]));
  const surface = screen.getByRole("listbox", { name: "Zettel auf der Fläche" });
  // Nobody sees who wrote a note, and a screen reader does not hear it: Ben is on the wall and wrote the first
  // note, and his name stands nowhere on the surface. One's own note carries a word that says so, for the eye too
  expect(surface.textContent).not.toMatch(/Ben|Anna|von /);
  expect(within(surface).getByRole("option", { name: "Weniger Termine" }).querySelector(".app-note__own")).toBeNull();
  const own = within(surface).getByRole("option", { name: "Mehr Pausen Deiner" }).querySelector(".app-note__own");
  expect(own?.textContent).toBe("Deiner");
  expect(own?.classList.contains("sb-visually-hidden")).toBe(false);
  // the keys are named once, in the surface's description
  expect(document.getElementById(surface.getAttribute("aria-describedby")!)?.textContent).toMatch(
    /^Tasten: Die Pfeiltasten gehen zum nächsten Zettel\./,
  );
  // an arrow key makes a note the current one: the focus stays on the surface, which names the note
  surface.focus();
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  const current = within(surface).getByRole("option", { selected: true });
  expect(surface.getAttribute("aria-activedescendant")).toBe(current.id);
  expect(document.activeElement).toBe(surface);
  // its tools stand outside the surface: the text is its author's, and so is its end unless one moderates
  const tools = within(screen.getByRole("group", { name: "Werkzeuge der Fläche" }));
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  expect(within(surface).getByRole("option", { selected: true }).textContent).toBe("Mehr Pausen Deiner");
  expect(tools.getByRole("button", { name: "Bearbeiten" })).toBeTruthy();
  expect(tools.getByRole("button", { name: "Löschen" })).toBeTruthy();
  fireEvent.keyDown(surface, { key: "ArrowLeft" });
  expect(within(surface).getByRole("option", { selected: true }).textContent).toBe("Weniger Termine");
  expect(tools.queryByRole("button", { name: "Bearbeiten" })).toBeNull();
  expect(tools.queryByRole("button", { name: "Löschen" })).toBeNull();
});

test("„Neuer Zettel“ opens a field; Enter sends the note, which shows at once; a reject takes it back and says why", async () => {
  found();
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  fireEvent.click(await screen.findByRole("button", { name: "Neuer Zettel" }));
  const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Text des Zettels" });
  expect(document.activeElement).toBe(field);
  expect(field.maxLength).toBe(300);
  // near the limit the field counts
  expect(screen.queryByText(/von 300 Zeichen$/)).toBeNull();
  fireEvent.change(field, { target: { value: "x".repeat(251) } });
  expect(screen.getByText("251 von 300 Zeichen")).toBeTruthy();
  expect(field.getAttribute("aria-describedby")).toBe("app-note-length");
  fireEvent.change(field, { target: { value: "  Weniger Termine " } });
  fireEvent.keyDown(field, { key: "Enter" });

  // one frame, with the text trimmed and a place in whole units
  const sent = socket.sent.at(-1)!;
  expect(sent).toMatchObject({ type: "note.create", text: "Weniger Termine" });
  expect(sent.type === "note.create" && Number.isInteger(sent.x) && Number.isInteger(sent.y)).toBe(true);
  expect(socket.sent.filter((frame) => frame.type === "note.create")).toHaveLength(1);
  expect(notesShown()).toEqual(["Weniger Termine Deiner"]);
  expect(screen.queryByRole("textbox", { name: "Text des Zettels" })).toBeNull();
  // the surface has the focus, with the new note as the current one
  const surface = screen.getByRole("listbox", { name: "Zettel auf der Fläche" });
  expect(document.activeElement).toBe(surface);
  expect(within(surface).getByRole("option", { selected: true }).textContent).toBe("Weniger Termine Deiner");

  // the wall says no: the note is gone, and a sentence says why until it is put away
  socket.tell({ type: "reject", opId: sent.type === "note.create" ? sent.opId : "", code: "LIMIT" });
  await waitFor(() => expect(notesShown()).toEqual([]));
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe(
    "Die Wand ist voll: Mehr als 500\u00a0Zettel passen nicht darauf. Lösch einen, dann ist wieder Platz.",
  );
  fireEvent.click(within(alert).getByRole("button", { name: "Hinweis schließen" }));
  expect(screen.getByRole("alert").textContent).toBe("");
});

test("a field left with Escape, or left empty, makes no note; a note's text is changed by its author alone", async () => {
  found();
  const socket = await join();
  socket.tell(
    sync(
      [
        { id: BEN, name: "Ben", role: "member", online: true },
        { id: ME, name: "Anna", role: "member", online: true },
      ],
      [note(1, "Weniger Termine", BEN), note(2, "Mehr Pausen")],
    ),
  );
  const primary = await screen.findByRole("button", { name: "Neuer Zettel" });
  const frames = () => socket.sent.filter((frame) => frame.type !== "join");
  primary.focus();
  fireEvent.click(primary);
  fireEvent.change(screen.getByRole("textbox", { name: "Text des Zettels" }), { target: { value: "Doch nicht" } });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Text des Zettels" }), { key: "Escape" });
  expect(screen.queryByRole("textbox", { name: "Text des Zettels" })).toBeNull();
  // the focus is back where it came from
  expect(document.activeElement).toBe(primary);
  fireEvent.click(primary);
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Text des Zettels" }), { key: "Enter" });
  expect(frames()).toEqual([]);
  expect(notesShown()).toHaveLength(2);

  // Enter on one's own note opens it with its text; saving it sends the new text
  const surface = screen.getByRole("listbox", { name: "Zettel auf der Fläche" });
  surface.focus();
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  expect(within(surface).getByRole("option", { selected: true }).textContent).toBe("Mehr Pausen Deiner");
  fireEvent.keyDown(surface, { key: "Enter" });
  const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Text des Zettels" });
  expect(field.value).toBe("Mehr Pausen");
  fireEvent.change(field, { target: { value: "Mehr Pausen am Nachmittag" } });
  fireEvent.click(screen.getByRole("button", { name: "Sichern" }));
  expect(frames()).toMatchObject([{ type: "note.update", noteId: note(2, "").id, text: "Mehr Pausen am Nachmittag" }]);
  expect(notesShown()).toEqual(["Weniger Termine", "Mehr Pausen am Nachmittag Deiner"]);

  // somebody else's note: Enter says whose its text is, and sends nothing; so does Entf
  fireEvent.keyDown(surface, { key: "ArrowLeft" });
  fireEvent.keyDown(surface, { key: "Enter" });
  expect(screen.queryByRole("textbox", { name: "Text des Zettels" })).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe("Den Text eines Zettels ändert nur, wer ihn geschrieben hat.");
  fireEvent.keyDown(surface, { key: "Delete" });
  expect(screen.getByRole("alert").textContent).toBe(
    "Einen Zettel löscht nur, wer ihn geschrieben hat, oder die Moderation.",
  );
  expect(frames()).toHaveLength(1);
});

test("the move mode of the keys: 32 units a step, and one frame when it ends", async () => {
  found();
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }], [note(1, "Weniger Termine", BEN)]));
  await waitFor(() => expect(notesShown()).toHaveLength(1));
  const surface = screen.getByRole("listbox", { name: "Zettel auf der Fläche" });
  const moves = () => socket.sent.filter((frame) => frame.type === "notes.move");
  surface.focus();
  fireEvent.keyDown(surface, { key: "ArrowDown" });
  fireEvent.keyDown(surface, { key: "m" });
  expect(document.getElementById("app-surface-keys")?.textContent).toBe(
    "Bewegen: Die Pfeiltasten bewegen den Zettel. Eingabe legt ihn ab, Esc bricht ab.",
  );
  for (const key of ["ArrowRight", "ArrowRight", "ArrowUp"]) fireEvent.keyDown(surface, { key });
  // nothing has gone out while the note moves
  expect(moves()).toEqual([]);
  fireEvent.keyDown(surface, { key: "Enter" });
  expect(moves()).toMatchObject([{ moves: [{ noteId: note(1, "").id, x: 256 + 64, y: -32, groupId: null }] }]);
  // the result is said, once
  expect(screen.getByText("Zettel abgelegt.").getAttribute("role")).toBe("status");

  // Escape puts the note back and tells the wall nothing; so does a move that ends where it began
  fireEvent.keyDown(surface, { key: "m" });
  fireEvent.keyDown(surface, { key: "ArrowLeft" });
  fireEvent.keyDown(surface, { key: "Escape" });
  expect(screen.getByText("Bewegen abgebrochen. Der Zettel liegt wieder, wo er war.")).toBeTruthy();
  fireEvent.keyDown(surface, { key: "m" });
  fireEvent.keyDown(surface, { key: "ArrowLeft" });
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  fireEvent.keyDown(surface, { key: "m" });
  expect(moves()).toHaveLength(1);
});

test("the moderation copies the wall's link and the moderation link: only the second carries the token", async () => {
  found();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  expect(socket.sent).toMatchObject([{ type: "join", name: "Anna", adminToken: TOKEN }]);
  socket.tell(sync([{ id: ME, name: "Anna", role: "admin", online: true }]));

  await screen.findByRole("list", { name: /^Auf der Wand/ });
  fireEvent.click(head().getByRole("button", { name: "Link kopieren" }));
  await waitFor(() => expect(copied).toHaveBeenLastCalledWith(`${location.origin}/w/${WALL}`));
  // the key says so in itself
  expect(await head().findByRole("button", { name: "Kopiert" })).toBeTruthy();
  // nobody else has come yet: what to do now says how others come in, with the same link right under it
  expect(stateOf().getByText(/^Du moderierst: Schick den Link an dein Team/)).toBeTruthy();
  fireEvent.click(stateOf().getByRole("button", { name: "Link kopieren" }));
  await waitFor(() => expect(copied).toHaveBeenCalledTimes(2));
  expect(copied).toHaveBeenLastCalledWith(`${location.origin}/w/${WALL}`);

  // what belongs to the moderation stands in the head's „Mehr“: the moderation link, and last what deletes
  fireEvent.click(inMore("Moderationslink kopieren")!);
  await waitFor(() => expect(copied).toHaveBeenLastCalledWith(`${location.origin}/w/${WALL}#admin=${TOKEN}`));
  // no key stays to say „Kopiert“: a toast does, and says what the link is good for
  expect(await screen.findByText(/^Moderationslink kopiert\. Wer ihn hat, moderiert diese Wand/)).toBeTruthy();
  expect(inMore("Wand löschen")).toBeTruthy();
});

test("a clipboard that refuses is said in the key", async () => {
  found();
  copied.mockRejectedValueOnce(new Error("not allowed"));
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  await screen.findByRole("list", { name: /^Auf der Wand/ });
  fireEvent.click(head().getByRole("button", { name: "Link kopieren" }));
  expect(await head().findByRole("button", { name: "Kopieren ging nicht" })).toBeTruthy();
});

test("a name that somebody on the wall has: the sentence stands at the field until another name is typed", async () => {
  found();
  const socket = await join();
  socket.tell({ type: "error", code: "NAME_TAKEN" });
  const name = screen.getByLabelText<HTMLInputElement>("Dein Name");
  expect(await screen.findByText(/^Diesen Namen hat schon jemand auf der Wand\./)).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(name));
  fireEvent.change(name, { target: { value: "Anna B." } });
  expect(screen.queryByText(/^Diesen Namen hat schon jemand auf der Wand\./)).toBeNull();
});

test("a wall that is full says so before the action, which offers to try again", async () => {
  found();
  const socket = await join();
  socket.tell({ type: "error", code: "WALL_FULL" });
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Die Wand ist voll. Versuch es später noch mal.",
  );
  expect(screen.getByRole("button", { name: "Noch mal versuchen" })).toBeTruthy();
});

test("the wall is deleted while this browser is on it: the view says so", async () => {
  found();
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  await screen.findByRole("list", { name: /^Auf der Wand/ });
  socket.tell({ type: "wall.deleted" });
  const heading = await screen.findByRole("heading", { level: 1, name: "Wand gelöscht" });
  expect(document.activeElement).toBe(heading);
  expect(screen.getByText("Diese Wand wurde gelöscht. Was darauf stand, ist entfernt.")).toBeTruthy();
});

test("„Meine Angaben löschen“ is everyone's; the wall's word on it ends the visit, and the browser forgets the wall", async () => {
  found();
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  await screen.findByRole("list", { name: /^Auf der Wand/ });
  expect(inMore("Meine Angaben löschen")).toBeTruthy();
  expect(useWalls.getState().walls.map((wall) => wall.id)).toEqual([WALL]);

  // the dialog asks first (tests/erase.spec.ts); here the wall's word on it arrives
  socket.tell({ type: "erased" });
  const heading = await screen.findByRole("heading", { level: 1, name: "Angaben gelöscht" });
  expect(document.activeElement).toBe(heading);
  expect(screen.getByText(/Was du geschrieben hast, bleibt auf der Wand, ohne deinen Namen\.$/)).toBeTruthy();
  expect(useWalls.getState().walls).toEqual([]);
});

test("somebody the wall forgot leaves the people; their notes stay", async () => {
  found();
  const socket = await join();
  socket.tell(
    sync(
      [
        { id: ME, name: "Anna", role: "member", online: true },
        { id: BEN, name: "Ben", role: "member", online: true },
      ],
      [note(1, "Fokuszeit", BEN)],
    ),
  );
  const people = await screen.findByRole("list", { name: /^Auf der Wand/ });
  expect(within(people).getAllByRole("listitem")).toHaveLength(2);
  socket.tell({ type: "participant.removed", participantId: BEN });
  await waitFor(() => expect(within(people).getAllByRole("listitem")).toHaveLength(1));
  expect(notesShown()).toHaveLength(1);
});

test("a connection that drops is said in the state sentence; the wall stays", async () => {
  found();
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  await screen.findByText("Noch keine Zettel. 1 Person ist da.");
  socket.drop();
  expect(await screen.findByText("Verbindung getrennt. Wird neu verbunden …")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1, name: QUESTION })).toBeTruthy();
});

test("a group is on the surface as a frame the keys reach: G goes to it, M moves it with its notes in two frames", async () => {
  found();
  const socket = await join();
  const tools = group(1, "Werkzeuge");
  socket.tell(
    sync(
      [{ id: ME, name: "Anna", role: "member", online: true }],
      [
        inGroup(note(1, "Der Build dauert zu lange", BEN), tools),
        inGroup(note(2, "Zwei Systeme"), tools, 1),
        note(3, "Fokus"),
      ],
      [tools, group(2, "")],
    ),
  );
  await waitFor(() => expect(notesShown()).toHaveLength(5));
  // a screen reader gets the groups first, each with how many notes lie in it, then the notes with their group
  expect(notesShown().slice(0, 2)).toEqual(["Werkzeuge", "Ohne Titel"]);
  const surface = screen.getByRole("listbox", { name: "Zettel auf der Fläche" });
  expect(within(surface).getByRole("option", { name: "Gruppe „Werkzeuge“, 2\u00a0Zettel" })).toBeTruthy();
  expect(within(surface).getByRole("option", { name: "Gruppe „Ohne Titel“, 0\u00a0Zettel" })).toBeTruthy();
  expect(notesShown().slice(2)).toEqual([
    "Der Build dauert zu lange in „Werkzeuge“",
    "Zwei Systeme Deiner in „Werkzeuge“",
    "Fokus Deiner",
  ]);
  expect(surface.getAttribute("aria-multiselectable")).toBe("true");

  // G: the first group is the current thing, with its tools; no note is selected
  surface.focus();
  fireEvent.keyDown(surface, { key: "g" });
  expect(surface.getAttribute("aria-activedescendant")).toBe(`app-group-${tools.id}`);
  expect(within(surface).queryByRole("option", { selected: true })).toBeNull();
  const row = within(screen.getByRole("group", { name: "Werkzeuge der Fläche" }));
  expect(row.getByRole("button", { name: "Umbenennen" })).toBeTruthy();
  expect(row.getByRole("button", { name: "Gruppe löschen" })).toBeTruthy();

  // M, two steps, Enter: the frame's new place in one frame, its two notes in another, the same distance
  const frames = () => socket.sent.filter((frame) => frame.type !== "join");
  fireEvent.keyDown(surface, { key: "m" });
  expect(document.getElementById("app-surface-keys")?.textContent).toMatch(
    /^Bewegen: Die Pfeiltasten bewegen die Gruppe/,
  );
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  fireEvent.keyDown(surface, { key: "ArrowDown" });
  expect(frames()).toEqual([]);
  fireEvent.keyDown(surface, { key: "Enter" });
  expect(frames()).toMatchObject([
    { type: "group.update", groupId: tools.id, x: 32, y: 32 },
    {
      type: "notes.move",
      moves: [
        { noteId: note(1, "").id, x: 16 + 32, y: 40 + 32, groupId: tools.id },
        { noteId: note(2, "").id, x: 272 + 32, y: 40 + 32, groupId: tools.id },
      ],
    },
  ]);
  expect(frames()[0]).not.toHaveProperty("w");
  expect(screen.getByText("Gruppe abgelegt.").getAttribute("role")).toBe("status");
});

test("several notes are selected with the space bar and with Shift; the move mode carries them in one frame", async () => {
  found();
  const socket = await join();
  socket.tell(
    sync(
      [
        { id: BEN, name: "Ben", role: "admin", online: false },
        { id: ME, name: "Anna", role: "member", online: true },
      ],
      [note(1, "Weniger Termine", BEN), note(2, "Mehr Pausen"), note(3, "Fokus")],
    ),
  );
  await waitFor(() => expect(notesShown()).toHaveLength(3));
  const surface = screen.getByRole("listbox", { name: "Zettel auf der Fläche" });
  const chosen = () =>
    within(surface)
      .getAllByRole("option", { selected: true })
      .map((option) => option.textContent);
  surface.focus();
  // the space bar picks the current note; the arrow keys go on and leave it picked; Shift takes the next one in
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  fireEvent.keyDown(surface, { key: " " });
  expect(screen.getByText("1 Zettel ausgewählt").getAttribute("role")).toBe("status");
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  expect(chosen()).toEqual(["Weniger Termine"]);
  fireEvent.keyDown(surface, { key: "ArrowRight", shiftKey: true });
  expect(chosen()).toEqual(["Weniger Termine", "Mehr Pausen Deiner", "Fokus Deiner"]);
  // the space bar takes the current one out again
  fireEvent.keyDown(surface, { key: " " });
  expect(chosen()).toEqual(["Weniger Termine", "Mehr Pausen Deiner"]);
  // the count stands with the selection's tools, and the tools of one note are gone
  const row = within(screen.getByRole("group", { name: "Werkzeuge der Fläche" }));
  expect(row.getByText("2 Zettel ausgewählt")).toBeTruthy();
  expect(row.getByRole("button", { name: "Auswahl aufheben" })).toBeTruthy();
  expect(row.queryByRole("button", { name: "Bearbeiten" })).toBeNull();

  // the move mode carries both: one frame, both notes the same distance
  fireEvent.keyDown(surface, { key: "m" });
  expect(document.getElementById("app-surface-keys")?.textContent).toBe(
    "Bewegen: Die Pfeiltasten bewegen die 2\u00a0Zettel. Eingabe legt sie ab, Esc bricht ab.",
  );
  fireEvent.keyDown(surface, { key: "ArrowDown" });
  fireEvent.keyDown(surface, { key: "Enter" });
  expect(socket.sent.filter((frame) => frame.type === "notes.move")).toMatchObject([
    {
      moves: [
        { noteId: note(1, "").id, x: 256, y: 32, groupId: null },
        { noteId: note(2, "").id, x: 512, y: 32, groupId: null },
      ],
    },
  ]);
  expect(screen.getByText("2 Zettel abgelegt.").getAttribute("role")).toBe("status");
  // Escape puts the selection away; the note the keys are on is the one selected again
  fireEvent.keyDown(surface, { key: "Escape" });
  expect(screen.getByText("Auswahl aufgehoben.")).toBeTruthy();
  expect(chosen()).toEqual(["Fokus Deiner"]);
});

test("the list shows the same wall as headings and rows, and the choice of it is the browser's", async () => {
  found();
  const socket = await join();
  const tools = group(1, "Werkzeuge");
  socket.tell(
    sync(
      [
        { id: BEN, name: "Ben", role: "admin", online: false },
        { id: ME, name: "Anna", role: "member", online: true },
      ],
      [inGroup(note(1, "Der Build dauert zu lange", BEN), tools), note(2, "Mehr Pausen")],
      [tools, group(2, "")],
    ),
  );
  await waitFor(() => expect(notesShown()).toHaveLength(4));
  expect(view().getAttribute("data-sb-view-type")).toBe("tool");
  expect(screen.getByRole<HTMLInputElement>("radio", { name: "Fläche" }).checked).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "Liste" }));
  expect(localStorage.getItem("ideabeam-view")).toBe("list");
  expect(screen.queryByRole("listbox", { name: "Zettel auf der Fläche" })).toBeNull();
  expect(view().getAttribute("data-sb-view-type")).toBe("list");

  // the groups as headings with their counts, an empty one saying so, the notes without a group under their own
  const list = within(screen.getByRole("region", { name: "Liste" }));
  expect(list.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
    "Werkzeuge 1",
    "Ohne Titel 0",
    "Ohne Gruppe 1",
  ]);
  expect(rowsUnder("Werkzeuge 1")).toEqual(["Der Build dauert zu lange"]);
  expect(list.getByText("Noch keine Zettel in dieser Gruppe.")).toBeTruthy();
  expect(rowsUnder("Ohne Gruppe 1")).toEqual(["Mehr Pausen"]);
  // nobody's name stands in the list, and a screen reader hears none; one's own note says that it is one's own
  expect(screen.getByRole("region", { name: "Liste" }).textContent).not.toMatch(/Ben|Anna|von /);
  expect([...document.querySelectorAll(".app-list__own")].map((own) => own.closest("li")?.textContent)).toEqual([
    expect.stringMatching(/^Mehr PausenDeiner/),
  ]);

  // „Neuer Zettel“ opens a field under the notes without a group; the note it makes lies outside every frame
  fireEvent.click(screen.getByRole("button", { name: "Neuer Zettel" }));
  const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Text des Zettels" });
  expect(document.activeElement).toBe(field);
  fireEvent.change(field, { target: { value: " Fokuszeit " } });
  fireEvent.keyDown(field, { key: "Enter" });
  const made = socket.sent.at(-1)!;
  expect(made).toMatchObject({ type: "note.create", text: "Fokuszeit" });
  if (made.type !== "note.create") throw new Error("no note was made");
  // (its middle lies in neither frame: both are 528 wide and 280 high, at 0 and at 560)
  const middle = { x: made.x + 120, y: made.y + 52 };
  expect(middle.y >= 280 || middle.y < 0 || middle.x < 0 || middle.x >= 1088).toBe(true);
  expect(rowsUnder("Ohne Gruppe 2")).toEqual(["Mehr Pausen", "Fokuszeit"]);
  expect(document.querySelectorAll(".app-list__own")).toHaveLength(2);

  // a row's menu: the text is its writer's (the menu is closed; its rows are in the page all the same)
  fireEvent.click(screen.getAllByRole("menuitem", { name: "Bearbeiten", hidden: true })[0]!);
  const editor = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Text des Zettels" });
  expect(editor.value).toBe("Mehr Pausen");
  fireEvent.change(editor, { target: { value: "Mehr Pausen am Nachmittag" } });
  fireEvent.click(screen.getByRole("button", { name: "Sichern" }));
  expect(socket.sent.at(-1)).toMatchObject({
    type: "note.update",
    noteId: note(2, "").id,
    text: "Mehr Pausen am Nachmittag",
  });
  // somebody else's note has no „Bearbeiten“: two rows are one's own
  expect(screen.getAllByRole("menuitem", { name: "Bearbeiten", hidden: true })).toHaveLength(2);

  // „Neue Gruppe“ opens a field for the title; the group it makes gets a frame that covers nothing
  fireEvent.click(screen.getByRole("button", { name: "Neue Gruppe" }));
  const title = screen.getByRole<HTMLInputElement>("textbox", { name: /^Titel der Gruppe/ });
  expect(document.activeElement).toBe(title);
  expect(title.maxLength).toBe(60);
  fireEvent.change(title, { target: { value: "Fokus" } });
  fireEvent.submit(title.closest("form")!);
  const framed = socket.sent.at(-1)!;
  expect(framed).toMatchObject({ type: "group.create", title: "Fokus", w: 528, h: 280 });
  if (framed.type !== "group.create") throw new Error("no group was made");
  expect(framed.x >= 1088 || framed.y >= 280).toBe(true);
  expect(list.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
    "Werkzeuge 1",
    "Ohne Titel 0",
    "Fokus 0",
    "Ohne Gruppe 2",
  ]);
});

test("a browser that chose the list opens every wall as its list; a narrow window does so without a choice", async () => {
  found();
  localStorage.setItem("ideabeam-view", "list");
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }], [note(1, "Weniger Termine")]));
  expect(await screen.findByRole("region", { name: "Liste" })).toBeTruthy();
  expect(screen.queryByRole("listbox", { name: "Zettel auf der Fläche" })).toBeNull();
  // on a wall without groups the notes stand under one plain heading
  expect(rowsUnder("Zettel 1")).toEqual(["Weniger Termine"]);
  expect(screen.getByRole("list", { name: "Zettel 1" }).querySelector(".app-list__own")?.textContent).toBe("Deiner");
  // an empty list says how it fills
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  expect(
    await screen.findByText(
      "Noch keine Zettel. „Neuer Zettel“ schreibt den ersten, und alle auf der Wand sehen ihn sofort.",
    ),
  ).toBeTruthy();
});

// ───────────────────────── hidden writing, revealing, the clock, the brake ─────────────────────────

const SERVER_NOW = 1_795_300_000_000;
const MINUTE = 60_000;
type Sync = Extract<ServerEvent, { type: "sync" }>;
/** A wall whose notes are hidden: this browser's own notes, and how many the others have written. */
const hiddenSync = (participants: Participant[], notes: Note[], hidden: number, more: Partial<Sync> = {}) =>
  ({ ...sync(participants, notes), ...WRITING_SYNC, hidden, seq: notes.length + hidden, ...more }) as ServerEvent;
const ANNA_AND_BEN = (role: Participant["role"]): Participant[] => [
  { id: ME, name: "Anna", role, online: true },
  { id: BEN, name: "Ben", role: role === "admin" ? "member" : "admin", online: true },
];
/** the others' notes while the wall is hidden: one line, on the surface and in the list */
const hiddenLine = () => document.querySelector(".app-hidden")?.textContent;
/** the frames of the moderation's flow that went out */
const flow = (socket: Awaited<ReturnType<typeof join>>) =>
  socket.sent.filter((frame) => frame.type.startsWith("admin."));

test("while the notes are hidden a person sees their own, learns how many the others wrote, and reads that nobody reads along", async () => {
  found();
  const socket = await join();
  socket.tell(hiddenSync(ANNA_AND_BEN("member"), [note(1, "Mehr Pausen")], 3));
  // the state names the step and counts every note, one's own and the others'
  expect((await screen.findByText("Verdecktes Schreiben: 4 Zettel. 2 Personen sind da.")).getAttribute("role")).toBe(
    "status",
  );
  expect(guides()).toEqual(["Schreib deine Ideen auf Zettel. Niemand liest mit, bis die Moderation aufdeckt."]);
  // on the surface: one's own note, and of the others' a number, with the glyph of what is hidden. No text, no
  // placeholder per note
  expect(notesShown()).toEqual(["Mehr Pausen Deiner"]);
  expect(hiddenLine()).toBe("3\u00a0Zettel der anderen liegen verdeckt auf der Wand.");
  expect(document.querySelector(".app-hidden use")?.getAttribute("href")).toBe("#eye-off");
  expect(document.querySelectorAll(".app-hidden")).toHaveLength(1);
  // groups come after revealing: „Neue Gruppe“ is not offered
  expect(screen.queryByRole("button", { name: "Neue Gruppe" })).toBeNull();
  // everybody else's primary action stays „Neuer Zettel“; revealing and the clock are the moderation's
  expect(screen.getByRole("button", { name: "Neuer Zettel" }).className).toBe("sb-primary-action");
  expect(screen.queryByRole("button", { name: "Weiter: Aufdecken" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Uhr" })).toBeNull();
  // the line under the action says who sees a note now
  expect(
    screen.getByText("Geht an den Server von IdeaBeam in der EU. Die anderen sehen es erst nach dem Aufdecken."),
  ).toBeTruthy();
  expect(screen.queryByText(/Alle auf der Wand sehen es\.$/)).toBeNull();

  // somebody else writes: this browser hears a number, and the line says it
  socket.tell({ type: "wall.occupancy", seq: 5, hidden: 4 });
  await waitFor(() => expect(hiddenLine()).toBe("4\u00a0Zettel der anderen liegen verdeckt auf der Wand."));
  await screen.findByText("Verdecktes Schreiben: 5 Zettel. 2 Personen sind da.", undefined, { timeout: 3000 });

  // the list: one's own notes under their own heading, and the same line
  fireEvent.click(screen.getByRole("radio", { name: "Liste" }));
  expect(rowsUnder("Deine Zettel 1")).toEqual(["Mehr Pausen"]);
  expect(hiddenLine()).toBe("4\u00a0Zettel der anderen liegen verdeckt auf der Wand.");
});

test("an empty hidden wall says how it fills, and that the others see a note only once it is revealed", async () => {
  found();
  const socket = await join();
  socket.tell(hiddenSync(ANNA_AND_BEN("member"), [], 0));
  await screen.findByText("Verdecktes Schreiben: noch keine Zettel. 2 Personen sind da.");
  expect(hiddenLine()).toBe("Von den anderen liegt noch kein Zettel auf der Wand.");
  expect(
    screen.getByText("„Neuer Zettel“ legt einen Zettel auf die Fläche. Die anderen sehen ihn erst nach dem Aufdecken."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Liste" }));
  expect(
    screen.getByText(
      "Noch keine Zettel von dir. „Neuer Zettel“ schreibt den ersten; die anderen sehen ihn erst nach dem Aufdecken.",
    ),
  ).toBeTruthy();
});

test("the moderation of a hidden wall: „Weiter: Aufdecken“ is the primary action, „Neuer Zettel“ the second; revealing is said once", async () => {
  found();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  socket.tell(hiddenSync(ANNA_AND_BEN("admin"), [note(1, "Mehr Pausen")], 3));
  await screen.findByText("Verdecktes Schreiben: 4 Zettel. 2 Personen sind da.");
  // what to do now says whose step revealing is; arranging is no topic while the notes are hidden
  expect(guides()).toEqual([
    "Du moderierst: Alle schreiben für sich, niemand liest mit. Wenn alle fertig sind, zeigt „Aufdecken“ allen jeden Zettel.",
  ]);
  expect(screen.getByRole("button", { name: "Weiter: Aufdecken" }).className).toBe("sb-primary-action");
  expect(screen.getByRole("button", { name: "Neuer Zettel" }).className).toBe("sb-secondary-action");
  expect(document.querySelectorAll(".sb-primary-action")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Ordnen" })).toBeNull();
  // „Neuer Zettel“ still writes
  fireEvent.click(screen.getByRole("button", { name: "Neuer Zettel" }));
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Text des Zettels" }), { key: "Escape" });

  // the question before revealing is a dialog (tests/hidden.spec.ts); here its answer goes out, and the wall's
  // word comes back: the others' notes, then the step
  act(() => useWall.getState().goStep(1));
  expect(flow(socket)).toMatchObject([{ type: "admin.step.go", from: 0, to: 1 }]);
  socket.tell({
    type: "notes.revealed",
    seq: 5,
    notes: [note(2, "Weniger Termine", BEN), note(3, "Fokuszeit", BEN), note(4, "Der Build dauert zu lange", BEN)],
  });
  socket.tell({ type: "step.changed", seq: 6, step: 1, reach: 1 });
  await waitFor(() => expect(notesShown()).toHaveLength(4));
  // one sentence for all of them, said and not shown; it says no note's text
  const said = screen.getByText("Aufgedeckt: 4 Zettel sind jetzt für alle zu sehen.");
  expect(said.getAttribute("role")).toBe("status");
  expect(said.classList.contains("sb-visually-hidden")).toBe(true);
  // the wall is as an open wall is: its state and groups. The moderation's next step is another one now: „Ordnen“
  // is its primary action, „Neuer Zettel“ stays the second one beside it
  await screen.findByText("4 Zettel. 2 Personen sind da.", undefined, { timeout: 3000 });
  expect(guides()).toEqual([
    "Du moderierst: Alle schreiben weiter. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  ]);
  expect(hiddenLine()).toBeUndefined();
  expect(screen.getByRole("button", { name: "Neue Gruppe" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ordnen" }).className).toBe("sb-primary-action");
  expect(screen.getByRole("button", { name: "Neuer Zettel" }).className).toBe("sb-secondary-action");
  expect(document.querySelectorAll(".sb-primary-action")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Weiter: Aufdecken" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Uhr" })).toBeNull();
  expect(
    screen.getByText("Ein neuer Zettel geht an den Server von IdeaBeam in der EU. Alle auf der Wand sehen ihn."),
  ).toBeTruthy();
});

test("the state names the step, what comes after it and the method with its short description", async () => {
  found();
  const socket = await join();
  socket.tell(hiddenSync(ANNA_AND_BEN("member"), [], 2));
  const state = await screen.findByRole("region", { name: "Stand der Wand" });
  expect(within(state).getByText("Schritt 1 von 5: Ideen schreiben · danach Aufdecken")).toBeTruthy();
  // never the method's name alone (PLAN-METHODEN.md 2)
  expect(screen.getByTestId("method").textContent).toBe(
    "Still sammeln, bündeln, verdeckt wählen: Alle schreiben Ideen verdeckt, die Ideen werden gebündelt, dann wählt jede Person verdeckt; heraus kommt eine Rangfolge.",
  );
  // the wall moves on: said once, and the state follows
  socket.tell({ type: "notes.revealed", seq: 3, notes: [] });
  socket.tell({ type: "step.changed", seq: 4, step: 1, reach: 1 });
  await screen.findByText("Schritt 2 von 5: Aufdecken · danach Bündeln");
  socket.tell({ type: "step.changed", seq: 5, step: 4, reach: 4 });
  await screen.findByText("Schritt 5 von 5: Ergebnis besprechen · der letzte Schritt");
  expect(screen.getByText("Schritt 5 von 5: Ergebnis besprechen.").classList.contains("sb-visually-hidden")).toBe(true);
  // what to do now is the step's: talking the result through
  expect(guides()).toEqual(["Besprecht die Gruppen gemeinsam: Was fällt auf, was fehlt, was folgt daraus?"]);
  // moving between the steps is the moderation's
  expect(inMore("Zurück: Bündeln")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Weiter/ })).toBeNull();
});

test("a „Freie Wand“ counts no steps, and names its method with its short description", async () => {
  found();
  const socket = await join();
  socket.tell(sync(ANNA_AND_BEN("member")));
  await screen.findByTestId("method");
  expect(screen.getByTestId("method").textContent).toBe(
    "Freie Wand: Alle schreiben Zettel, die sofort für alle sichtbar sind, und ordnen sie gemeinsam, ohne festen Ablauf.",
  );
  expect(document.querySelector(".app-state__step")).toBeNull();
  expect(screen.queryByText(/ · danach /)).toBeNull();
});

test("the moderation moves on with „Weiter“ and back with „Zurück“ under „Mehr“; neither asks where nothing is revealed", async () => {
  found();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  socket.tell({ ...(sync(ANNA_AND_BEN("admin")) as Sync), ...REVEALED_SYNC, seq: 0 });
  await screen.findByText("Schritt 2 von 5: Aufdecken · danach Bündeln");
  // the step arranges: „Ordnen“ is the zone's primary action, the way on stands in the state, as a text action
  expect(screen.getByRole("button", { name: "Ordnen" }).className).toBe("sb-primary-action");
  const onward = screen.getByRole("button", { name: "Weiter: Bündeln" });
  expect(onward.className).toBe("sb-text-action");
  fireEvent.click(onward);
  expect(flow(socket)).toMatchObject([{ type: "admin.step.go", from: 1, to: 2 }]);
  expect(document.querySelector("#app-dlg-reveal[open]")).toBeNull();
  // back, from „Mehr“
  expect(inMore("Zurück: Ideen schreiben")).toBeTruthy();
  fireEvent.click(inMore("Zurück: Ideen schreiben")!);
  expect(flow(socket).at(-1)).toMatchObject({ type: "admin.step.go", from: 1, to: 0 });
  // in the writing step again, after revealing: the notes stay seen, „Weiter: Aufdecken“ is the primary action and
  // asks nothing, since nothing is hidden any more
  socket.tell({ type: "step.changed", seq: 1, step: 0, reach: 1 });
  const next = await screen.findByRole("button", { name: "Weiter: Aufdecken" });
  expect(next.className).toBe("sb-primary-action");
  expect(hiddenLine()).toBeUndefined();
  fireEvent.click(next);
  expect(flow(socket).at(-1)).toMatchObject({ type: "admin.step.go", from: 0, to: 1 });
  expect(document.querySelector("#app-dlg-reveal[open]")).toBeNull();
});

test("the clock: the moderation sets it, everybody reads the minutes at the wall's top and in the tab's title", async () => {
  found();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  socket.tell(hiddenSync(ANNA_AND_BEN("admin"), [], 2));
  const controls = within(await screen.findByRole("group", { name: "Uhr" }));
  // no clock yet: no sentence, the wall's question in the tab, and a time to choose with „Uhr starten“
  expect(document.querySelector(".app-state__clock")?.textContent).toBe("");
  expect(document.title).toBe(`${QUESTION} · IdeaBeam`);
  const length = controls.getByLabelText<HTMLSelectElement>("Zeit zum Schreiben");
  expect(length.value).toBe("5");
  // every minute from 1 to 60 can be chosen, the usual ones first
  expect([...length.options].map((option) => Number(option.value)).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 60 }, (_, n) => n + 1),
  );
  expect([...length.options].slice(0, 6).map((option) => option.textContent)).toEqual([
    "3\u00a0Minuten",
    "5\u00a0Minuten",
    "10\u00a0Minuten",
    "15\u00a0Minuten",
    "20\u00a0Minuten",
    "30\u00a0Minuten",
  ]);
  fireEvent.change(length, { target: { value: "10" } });
  fireEvent.click(controls.getByRole("button", { name: "Uhr starten" }));
  expect(flow(socket)).toMatchObject([{ type: "admin.clock.start", rev: 0, minutes: 10 }]);
  // nothing shows before the wall has said so
  expect(document.querySelector(".app-state__clock")?.textContent).toBe("");

  // the wall says so: the time left as a sentence, as large as the state and a live region of its own
  socket.tell({
    type: "clock.changed",
    seq: 3,
    clock: { rev: 1, endsAt: SERVER_NOW + 10 * MINUTE, leftMs: null },
    serverNow: SERVER_NOW,
  });
  const time = await screen.findByText("Noch 10 Minuten zum Schreiben.");
  expect(time.getAttribute("role")).toBe("status");
  expect(time.className).toBe("app-state__clock");
  await waitFor(() => expect(document.title).toBe(`Noch 10\u00a0Min. · ${QUESTION} · IdeaBeam`));
  // no bar, no seconds
  expect(document.querySelector("progress, meter, [role=progressbar], [role=timer]")).toBeNull();
  expect(screen.getByRole("region", { name: "Stand der Wand" }).textContent).not.toMatch(/\d:\d\d|Sekunde/);
  // a running clock: pause, five minutes more, no clock any more
  expect(controls.getAllByRole("button").map((button) => button.textContent)).toEqual([
    "Uhr anhalten",
    "5\u00a0Minuten mehr",
    "Uhr ausschalten",
  ]);
  expect(controls.queryByLabelText("Zeit zum Schreiben")).toBeNull();
  for (const name of ["Uhr anhalten", "5\u00a0Minuten mehr", "Uhr ausschalten"])
    fireEvent.click(controls.getByRole("button", { name }));
  expect(flow(socket).slice(1)).toMatchObject([
    { type: "admin.clock.pause", rev: 1 },
    { type: "admin.clock.extend", rev: 1 },
    { type: "admin.clock.clear", rev: 1 },
  ]);

  // paused: the time stands, and the sentence says so
  socket.tell({
    type: "clock.changed",
    seq: 4,
    clock: { rev: 2, endsAt: null, leftMs: 7 * MINUTE + 30_000 },
    serverNow: SERVER_NOW + 150_000,
  });
  await screen.findByText("Die Uhr ist angehalten: noch 8 Minuten zum Schreiben.");
  await waitFor(() => expect(document.title).toBe(`Angehalten · ${QUESTION} · IdeaBeam`));
  expect(controls.getByRole("button", { name: "Uhr fortsetzen" })).toBeTruthy();
  fireEvent.click(controls.getByRole("button", { name: "Uhr fortsetzen" }));
  expect(flow(socket).at(-1)).toMatchObject({ type: "admin.clock.resume", rev: 2 });

  // the time is up: the wall says so, nothing locks, and the moderation still decides
  socket.tell({
    type: "clock.changed",
    seq: 5,
    clock: { rev: 3, endsAt: SERVER_NOW + 200_000, leftMs: null },
    serverNow: SERVER_NOW + 200_000,
  });
  await screen.findByText("Die Zeit ist um.");
  await waitFor(() => expect(document.title).toBe(`Zeit um · ${QUESTION} · IdeaBeam`));
  expect(guides()).toEqual([
    "Du moderierst: Nichts ist gesperrt, alle können weiterschreiben. Deck auf, wenn alle fertig sind, oder gib fünf Minuten mehr.",
  ]);
  expect(controls.getAllByRole("button").map((button) => button.textContent)).toEqual([
    "5\u00a0Minuten mehr",
    "Uhr ausschalten",
  ]);
  expect(screen.getByRole("button", { name: "Weiter: Aufdecken" }).className).toBe("sb-primary-action");
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Neuer Zettel" }).disabled).toBe(false);
});

test("the browser counts: the sentence reads the next minute when the minute turns, by the worker's clock", async () => {
  found();
  const socket = await join();
  // this browser's clock runs 37 minutes ahead of the worker's
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(SERVER_NOW + 37 * MINUTE);
  socket.tell(
    hiddenSync(ANNA_AND_BEN("member"), [], 2, {
      serverNow: SERVER_NOW,
      clock: { rev: 1, endsAt: SERVER_NOW + 2 * MINUTE + 20_000, leftMs: null },
    }),
  );
  // somebody who does not moderate reads the time, and has no controls
  await screen.findByText("Noch 3 Minuten zum Schreiben.");
  expect(screen.queryByRole("group", { name: "Uhr" })).toBeNull();
  // twenty seconds on, two minutes are left
  await act(() => vi.advanceTimersByTimeAsync(20_100));
  expect(screen.getByText("Noch 2 Minuten zum Schreiben.")).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(MINUTE));
  expect(screen.getByText("Noch 1 Minute zum Schreiben.")).toBeTruthy();
  // the time runs out: said, and what to do now says that writing goes on
  await act(() => vi.advanceTimersByTimeAsync(MINUTE));
  expect(screen.getByText("Die Zeit ist um.")).toBeTruthy();
  expect(guides()).toEqual(["Du kannst weiterschreiben, bis die Moderation aufdeckt."]);
  expect(document.title).toBe(`Zeit um · ${QUESTION} · IdeaBeam`);
});

test("the wall's day is spent: the change is taken back, and a sentence says from what time it goes on", async () => {
  found();
  const socket = await join();
  socket.tell(sync([{ id: ME, name: "Anna", role: "member", online: true }]));
  fireEvent.click(await screen.findByRole("button", { name: "Neuer Zettel" }));
  const field = screen.getByRole("textbox", { name: "Text des Zettels" });
  fireEvent.change(field, { target: { value: "Weniger Termine" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(notesShown()).toEqual(["Weniger Termine Deiner"]);
  const sent = socket.sent.at(-1)!;
  // 01:00 on this machine's clock, whatever its time zone
  const resetsAt = new Date(2026, 10, 23, 1, 0).getTime();
  socket.tell({ type: "reject", opId: sent.type === "note.create" ? sent.opId : "", code: "DAY_SPENT", resetsAt });
  await waitFor(() => expect(notesShown()).toEqual([]));
  expect(screen.getByRole("alert").textContent).toBe(
    "Die Wand hat heute so viel gespeichert, wie eine Wand an einem Tag darf: Deine Änderung wurde nicht übernommen. Ab 01:00\u00a0Uhr geht es weiter.",
  );
});

test("a control of the clock that was overtaken is said where changes are refused", async () => {
  found();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  socket.tell(
    hiddenSync(ANNA_AND_BEN("admin"), [], 0, { clock: { rev: 1, endsAt: SERVER_NOW + 5 * MINUTE, leftMs: null } }),
  );
  const controls = within(await screen.findByRole("group", { name: "Uhr" }));
  fireEvent.click(controls.getByRole("button", { name: "Uhr ausschalten" }));
  const sent = flow(socket).at(-1) as { opId: string };
  socket.tell({ type: "reject", opId: sent.opId, code: "STALE" });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Die Uhr wurde im selben Moment schon anders gestellt: Dein Schritt wurde nicht übernommen. Sie zeigt, was jetzt gilt.",
    ),
  );
});

// ───────────────────────── „Ordnen“: the AI's proposal, its preview, applying, taking back ─────────────────────────

/** Six notes of Ben's: three begin with „Termine“, three with „Werkzeuge“. */
const SIX = [
  note(1, "Termine kürzen", BEN),
  note(2, "Termine ohne Ergebnis", BEN),
  note(3, "Termine bündeln", BEN),
  note(4, "Werkzeuge vereinheitlichen", BEN),
  note(5, "Werkzeuge erklären", BEN),
  note(6, "Werkzeuge abschaffen", BEN),
];
const PROPOSED = {
  proposal: {
    groups: [
      { title: "Termine", noteIds: [SIX[0]!.id, SIX[1]!.id, SIX[2]!.id] },
      { title: "Werkzeuge", noteIds: [SIX[3]!.id, SIX[4]!.id, SIX[5]!.id] },
    ],
    loose: [],
  },
  cost: { neurons: 12.5, calls: 3, inputTokens: 900, outputTokens: 120 },
  partial: false,
  runsLeft: 5,
  model: "stand-in",
};
type Apply = Extract<ClientCommand, { type: "admin.arrange.apply" }>;

/** The wall exists, and the Worker answers „Ordnen“ as the test says: with `answer`, or when the test lets it. */
function arranging(answer: () => Promise<Response>) {
  const asked: RequestInit[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
    if (String(url).endsWith("/arrange")) {
      asked.push(init ?? {});
      return answer();
    }
    return Promise.resolve(
      new Response(JSON.stringify({ wall: { id: WALL, question: QUESTION, createdAt: 1_795_300_000_000 } })),
    );
  });
  return asked;
}
const answered = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
/** On an open wall with six notes, as its moderation (or not), with Ben beside. */
async function onSix(role: Participant["role"] = "admin") {
  if (role === "admin") useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  socket.tell(sync(ANNA_AND_BEN(role), SIX));
  await screen.findByText("6 Zettel. 2 Personen sind da.");
  return socket;
}
/** The wall's word on an arrangement it took: the groups it made and where the notes went. */
const appliedEvent = (command: Apply, seq: number): ServerEvent => ({
  type: "arrange.applied",
  seq,
  runId: command.opId,
  source: "service",
  groups: command.groups.map((made, n) => ({
    id: made.groupId,
    title: made.title,
    titleSource: "ki",
    locked: false,
    x: made.x,
    y: made.y,
    w: made.w,
    h: made.h,
    ord: n + 1,
  })),
  moves: command.moves,
  removed: [],
});
/** the groups on the surface, as a screen reader gets them */
const groupsShown = () =>
  [...document.querySelectorAll(".app-group[data-group]")].map((frame) => frame.getAttribute("aria-label"));
/** what a screen reader was told last about what happened on the wall */
const saidLast = () => document.querySelector("main p.sb-visually-hidden[role=status]")?.textContent;
/** the lines under the wall's action */
const hints = () => [...document.querySelectorAll(".sb-action-hint")].map((line) => line.textContent);

test("„Ordnen“ is the moderation's primary action once notes are revealed; where it is computed stands under it", async () => {
  arranging(answered(200, PROPOSED));
  await onSix();
  expect(screen.getByRole("button", { name: "Ordnen" }).className).toBe("sb-primary-action");
  expect(screen.getByRole("button", { name: "Neuer Zettel" }).className).toBe("sb-secondary-action");
  expect(document.querySelectorAll(".sb-primary-action")).toHaveLength(1);
  // before anything is sent: what goes where, what Cloudflare says about it, and what is not certain
  expect(hints()).toEqual([
    "„Ordnen“ schickt die Frage und die Texte der Zettel, ohne Namen, an Cloudflares KI-Dienst Workers AI: laut Cloudflare ohne Speicherung und ohne Training, aber nicht sicher in der EU. Mehr unter Datenschutz.",
    "Ein neuer Zettel geht an den Server von IdeaBeam in der EU. Alle auf der Wand sehen ihn.",
  ]);
  // the way to the section of the privacy notice that says it at length
  const link = within(document.querySelector<HTMLElement>(".sb-bottom-block")!).getByRole("link", {
    name: "Datenschutz",
  });
  expect(link.getAttribute("href")).toBe("/datenschutz#ordnen");
  // what to do now leads there, and names doing it by hand as the equal way
  expect(guides()).toEqual([
    "Du moderierst: Wenn alle fertig sind, schlägt „Ordnen“ Gruppen mit Überschriften vor. Von Hand geht es genauso: Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  ]);
  // in the list too: the zone is the wall's, not the surface's
  fireEvent.click(screen.getByRole("radio", { name: "Liste" }));
  expect(screen.getByRole("button", { name: "Ordnen" }).className).toBe("sb-primary-action");
});

test("the same sentences in English, with the action's English name", async () => {
  arranging(answered(200, PROPOSED));
  await i18n.changeLanguage("en");
  useWalls.getState().keepToken(WALL, TOKEN);
  renderApp(`/w/${WALL}`);
  fireEvent.change(await screen.findByLabelText("Your name"), { target: { value: "Anna" } });
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  const socket = await nextSocket();
  socket.tell(sync(ANNA_AND_BEN("admin"), SIX));
  expect((await screen.findByRole("button", { name: "Group notes" })).className).toBe("sb-primary-action");
  expect(hints()[0]).toBe(
    "“Group notes” sends the question and the texts of the notes, without names, to Cloudflare’s AI service Workers AI: according to Cloudflare without storing them or training on them, but not certainly in the EU. More under Privacy.",
  );
});

test("somebody who does not moderate never has „Ordnen“; the arrangement arrives, glides and is said once", async () => {
  arranging(answered(200, PROPOSED));
  const socket = await onSix("member");
  expect(screen.queryByRole("button", { name: "Ordnen" })).toBeNull();
  expect(screen.getByRole("button", { name: "Neuer Zettel" }).className).toBe("sb-primary-action");
  expect(hints()).toEqual(["Geht an den Server von IdeaBeam in der EU. Alle auf der Wand sehen es."]);
  const world = document.querySelector<HTMLElement>(".app-surface__world")!;
  expect(world.hasAttribute("data-gliding")).toBe(false);

  // the moderation applies an arrangement: the groups and the notes' new places arrive in one frame
  const [termine, werkzeuge] = ["f1".repeat(16), "f2".repeat(16)];
  const command: Apply = {
    type: "admin.arrange.apply",
    opId: "99".repeat(16),
    source: "service",
    groups: [
      { groupId: termine, title: "Termine", x: 0, y: 0, w: 528, h: 400, noteIds: SIX.slice(0, 3).map((one) => one.id) },
      {
        groupId: werkzeuge,
        title: "Werkzeuge",
        x: 560,
        y: 0,
        w: 528,
        h: 400,
        noteIds: SIX.slice(3).map((one) => one.id),
      },
    ],
    moves: SIX.map((one, n) => ({
      noteId: one.id,
      x: (n < 3 ? 0 : 560) + 16,
      y: 40 + (n % 3) * 110,
      groupId: n < 3 ? termine : werkzeuge,
    })),
  };
  socket.tell(appliedEvent(command, 6 + 4));
  await waitFor(() =>
    expect(groupsShown()).toEqual(["Gruppe „Termine“, 3\u00a0Zettel", "Gruppe „Werkzeuge“, 3\u00a0Zettel"]),
  );
  // said once, for the whole arrangement
  expect(saidLast()).toBe("Geordnet: 2\u00a0Gruppen.");
  // the world is marked for the time of the motion, and the notes set out one after the other, the last one
  // 300 ms after the first: with the 300 ms each glides, all are there within 600 ms
  expect(world.hasAttribute("data-gliding")).toBe(true);
  expect(world.style.getPropertyValue("--app-glide")).toBe("300ms");
  const delays = [...document.querySelectorAll<HTMLElement>(".app-note[data-note]")].map((card) =>
    card.style.getPropertyValue("--app-glide-delay"),
  );
  expect(delays).toEqual(["0ms", "60ms", "120ms", "180ms", "240ms", "300ms"]);
  // once every note is there the mark goes
  await waitFor(() => expect(world.hasAttribute("data-gliding")).toBe(false), { timeout: 2000 });
  expect(document.querySelector<HTMLElement>(".app-note[data-note]")!.style.getPropertyValue("--app-glide-delay")).toBe(
    "",
  );
  // still no „Ordnen“, no „Rückgängig“, here or in „Mehr“
  expect(screen.queryByRole("button", { name: "Ordnen rückgängig machen" })).toBeNull();
  expect(inMore("Ordnen rückgängig machen")).toBeNull();

  // the moderation takes it back: said once too
  socket.tell({
    type: "arrange.undone",
    seq: 14,
    runId: command.opId,
    moves: SIX.map((one) => ({ noteId: one.id, x: one.x, y: one.y, groupId: null })),
    removed: [termine, werkzeuge],
    restored: [],
  });
  await waitFor(() => expect(groupsShown()).toEqual([]));
  expect(saidLast()).toBe("Das Ordnen wurde zurückgenommen.");
});

test("while the AI is asked: the action shows its own progress, a sentence and the seconds, and „Abbrechen“", async () => {
  let answer: (response: Response) => void = () => undefined;
  const asked = arranging(() => new Promise<Response>((resolve) => (answer = resolve)));
  const socket = await onSix();
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  // the request: the token in its header, the language the app shows as its body, and no note's text
  expect(asked).toHaveLength(1);
  expect(new Headers(asked[0]?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
  expect(JSON.parse(String(asked[0]?.body))).toEqual({ language: "de" });
  // the primary action stays in its place and says what runs
  const running = screen.getByRole("button", { name: "Ordnen läuft …" });
  expect(running.className).toBe("sb-primary-action");
  expect(running.getAttribute("aria-busy")).toBe("true");
  expect(running.getAttribute("data-sb-progress")).toBe("indeterminate");
  // a second press asks nothing
  fireEvent.click(running);
  expect(asked).toHaveLength(1);
  // „Abbrechen“ beside it, with the line that says that the run counts all the same
  expect(screen.getByRole("button", { name: "Abbrechen" }).className).toBe("sb-secondary-action");
  expect(hints()).toEqual([
    "„Abbrechen“ beendet nur das Warten. Der Versuch zählt trotzdem: Eine Wand lässt sich 6-mal in 24\u00a0Stunden ordnen.",
  ]);
  // the moderation's own changing of the wall rests
  expect(screen.queryByRole("button", { name: "Neuer Zettel" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Neue Gruppe" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Auswählen" })).toBeNull();
  // after a second: what happens, as large as the state, and for how long by now; no invented steps
  const line = () => document.querySelector(".app-state__clock")?.textContent?.replace(/\s/g, " ");
  expect(line()).toBeUndefined();
  await waitFor(() => expect(line()).toBe("Die KI ordnet 6 Zettel. Das dauert meist unter einer halben Minute."), {
    timeout: 3000,
  });
  expect(guides()).toEqual(["Bisher 1\u00a0Sekunde."]);
  await waitFor(() => expect(guides()).toEqual(["Bisher 2\u00a0Sekunden."]), { timeout: 3000 });
  // said once to a screen reader, in the region that says what happened on the wall; the seconds are not announced
  expect(saidLast()).toBe("Die KI ordnet 6\u00a0Zettel. Das dauert meist unter einer halben Minute.");
  expect(document.querySelectorAll(".app-state [role=status]")).toHaveLength(1);

  // „Abbrechen“: the waiting ends, the wall is as it was, and an answer that still comes shows nothing
  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
  expect(screen.getByRole("button", { name: "Ordnen" }).className).toBe("sb-primary-action");
  expect(saidLast()).toBe("Warten abgebrochen.");
  expect(asked[0]?.signal?.aborted).toBe(true);
  await act(async () => {
    answer(new Response(JSON.stringify(PROPOSED), { status: 200 }));
    await new Promise((moment) => setTimeout(moment, 20));
  });
  expect(groupsShown()).toEqual([]);
  expect(screen.queryByRole("alert")?.textContent).toBe("");
  expect(socket.sent.filter((frame) => frame.type !== "join")).toEqual([]);
});

test("the proposal is a preview in this browser alone: the state says so, the wall rests, „Verwerfen“ puts it back", async () => {
  arranging(answered(200, { ...PROPOSED, partial: true }));
  const socket = await onSix();
  const before = SIX.map((one) => [one.x, one.y]);
  const places = () =>
    [...document.querySelectorAll<HTMLElement>(".app-note[data-note]")].map((card) => [
      Math.round(parseFloat(card.style.left) * 16),
      Math.round(parseFloat(card.style.top) * 16),
    ]);
  expect(places()).toEqual(before);
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));

  // the state: that it is a proposal, its numbers, and who sees it; said when it comes
  const state = await screen.findByText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  expect(state.getAttribute("role")).toBe("status");
  // a part of the notes got no answer: said with the state
  expect(guides()).toEqual([
    "Ein Teil der Zettel bekam keine Antwort der KI und liegt ohne Gruppe.",
    "„Anwenden“ ordnet die Wand für alle so, „Verwerfen“ lässt sie, wie sie war. Solange der Vorschlag steht, änderst du nichts an der Wand; die anderen arbeiten weiter.",
    "Diese Wand lässt sich in 24\u00a0Stunden 6-mal ordnen, jetzt noch 5-mal.",
  ]);
  // on the surface: the proposed frames with their titles, and every note at its proposed place
  expect(groupsShown()).toEqual(["Gruppe „Termine“, 3\u00a0Zettel", "Gruppe „Werkzeuge“, 3\u00a0Zettel"]);
  for (const [n, place] of places().entries()) expect(place).not.toEqual(before[n]);
  expect(document.querySelector(".app-surface__world")?.hasAttribute("data-gliding")).toBe(true);
  // the zone: „Anwenden“ and „Verwerfen“, and where applying sends it
  expect(screen.getByRole("button", { name: "Anwenden" }).className).toBe("sb-primary-action");
  expect(screen.getByRole("button", { name: "Verwerfen" }).className).toBe("sb-secondary-action");
  expect(document.querySelectorAll(".sb-primary-action")).toHaveLength(1);
  expect(hints()).toEqual([
    "„Anwenden“ speichert die Anordnung auf dem Server von IdeaBeam in der EU. Alle auf der Wand sehen sie.",
  ]);
  // nothing has gone to the wall, and nothing is stored in the browser
  expect(socket.sent.filter((frame) => frame.type !== "join")).toEqual([]);
  expect(JSON.stringify({ ...localStorage })).not.toContain("Termine");
  expect(sessionStorage).toHaveLength(0);

  // the moderation's own changing of the wall rests: the keys go from note to note and change nothing
  expect(screen.queryByRole("button", { name: "Neuer Zettel" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Neue Gruppe" })).toBeNull();
  const ground = screen.getByRole("listbox", { name: "Zettel auf der Fläche" });
  fireEvent.keyDown(ground, { key: "ArrowRight" });
  expect(ground.getAttribute("aria-activedescendant")).toMatch(/^app-note-/);
  expect(screen.queryByRole("button", { name: "Bearbeiten" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Löschen" })).toBeNull();
  for (const key of ["Enter", "Delete", "m", "n", " ", "v"]) fireEvent.keyDown(ground, { key });
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(socket.sent.filter((frame) => frame.type !== "join")).toEqual([]);
  // the view still zooms, and the wall can still be looked at as its list
  expect(screen.getByRole("button", { name: "Alles zeigen" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Liste" })).toBeTruthy();

  // what the others do arrives underneath: a note of the proposal is deleted and drops out, a new one stays where
  // its writer put it and is no part of the proposal
  socket.tell({ type: "note.deleted", seq: 7, noteId: SIX[5]!.id });
  socket.tell({ type: "note.created", seq: 8, note: { ...note(7, "Neu dazugekommen", BEN), x: -900, y: -900 } });
  await waitFor(() =>
    expect(groupsShown()).toEqual(["Gruppe „Termine“, 3\u00a0Zettel", "Gruppe „Werkzeuge“, 2\u00a0Zettel"]),
  );
  expect(places().at(-1)).toEqual([-900, -900]);

  // „Verwerfen“: every note lies where the wall has it, no frame stays, nothing was sent
  fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
  expect(groupsShown()).toEqual([]);
  expect(places()).toEqual([...before.slice(0, 5), [-900, -900]]);
  expect(saidLast()).toBe("Vorschlag verworfen. Die Wand ist, wie sie war.");
  expect(screen.getByRole("button", { name: "Ordnen" }).className).toBe("sb-primary-action");
  expect(screen.getByRole("button", { name: "Neuer Zettel" })).toBeTruthy();
  expect(socket.sent.filter((frame) => frame.type !== "join")).toEqual([]);
  // the run has counted: how many more the wall has now stays said, quietly
  expect(guides().at(-1)).toBe("Diese Wand lässt sich in 24\u00a0Stunden 6-mal ordnen, jetzt noch 5-mal.");
});

test("after a run the quiet line says how many runs 24 hours allow, and how many are left now: one, or none", async () => {
  // the wall's last run but one
  arranging(answered(200, { ...PROPOSED, runsLeft: 1 }));
  await onSix();
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  await screen.findByText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  expect(guides().at(-1)).toBe("Diese Wand lässt sich in 24\u00a0Stunden 6-mal ordnen, jetzt noch 1-mal.");
  fireEvent.click(screen.getByRole("button", { name: "Verwerfen" }));
  // the last one: no „heute“, the count is no day's, and it fills again by itself
  arranging(answered(200, { ...PROPOSED, runsLeft: 0 }));
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  await screen.findByText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  expect(guides().at(-1)).toBe(
    "Diese Wand lässt sich in 24\u00a0Stunden 6-mal ordnen: Das war vorerst das letzte Mal.",
  );
  // the same in English
  expect(i18n.t("arrange.runsLeft", { count: 1, runs: 6, lng: "en" })).toBe(
    "This wall can be grouped 6 times in 24\u00a0hours, 1 more time now.",
  );
  expect(i18n.t("arrange.runsLeft", { count: 5, runs: 6, lng: "en" })).toBe(
    "This wall can be grouped 6 times in 24\u00a0hours, 5 more times now.",
  );
  expect(i18n.t("arrange.runsNone", { runs: 6, lng: "en" })).toBe(
    "This wall can be grouped 6 times in 24\u00a0hours: that was the last time for now.",
  );
});

test("the list shows the same proposal as its groups, and has no menus while it stands", async () => {
  arranging(
    answered(200, {
      ...PROPOSED,
      proposal: {
        ...PROPOSED.proposal,
        loose: [SIX[5]!.id],
        groups: [PROPOSED.proposal.groups[0]!, { title: "Werkzeuge", noteIds: [SIX[3]!.id, SIX[4]!.id] }],
      },
    }),
  );
  const socket = await onSix();
  fireEvent.click(screen.getByRole("radio", { name: "Liste" }));
  expect(rowsUnder("Zettel 6")).toHaveLength(6);
  expect(document.querySelectorAll(".app-list__row button[aria-haspopup]")).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  // a note without a group in the proposal: the state counts it
  await screen.findByText("Vorschlag der KI: 2 Gruppen, 1 Zettel ohne Gruppe. Nur du siehst ihn.");
  expect(rowsUnder("Termine 3")).toEqual(["Termine kürzen", "Termine ohne Ergebnis", "Termine bündeln"]);
  expect(rowsUnder("Werkzeuge 2")).toEqual(["Werkzeuge vereinheitlichen", "Werkzeuge erklären"]);
  expect(rowsUnder("Ohne Gruppe 1")).toEqual(["Werkzeuge abschaffen"]);
  // nothing to change it with: no menu at a row, none at a heading
  expect(document.querySelectorAll(".app-list button[aria-haspopup]")).toHaveLength(0);
  // „Anwenden“ from the list sends the arrangement
  fireEvent.click(screen.getByRole("button", { name: "Anwenden" }));
  const command = socket.sent.at(-1) as Apply;
  expect(command.type).toBe("admin.arrange.apply");
  expect(command.groups.map((made) => made.title)).toEqual(["Termine", "Werkzeuge"]);
  socket.tell(appliedEvent(command, 6 + 4));
  socket.tell({ type: "ack", opId: command.opId, seq: 10 });
  await screen.findByText("6 Zettel, 5 davon in 2 Gruppen. 2 Personen sind da.", undefined, { timeout: 3000 });
  // the menus are back, at the rows and at the new headings
  expect(document.querySelectorAll(".app-list__row button[aria-haspopup]")).toHaveLength(6);
  expect(document.querySelectorAll(".app-list__head button[aria-haspopup]")).toHaveLength(2);
});

test("„Anwenden“ sends one command and shows nothing twice; „Rückgängig“ stands beside „Ordnen“ and acts at once", async () => {
  arranging(answered(200, PROPOSED));
  const socket = await onSix();
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  await screen.findByText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  const places = () =>
    [...document.querySelectorAll<HTMLElement>(".app-note[data-note]")].map((card) => [
      card.style.left,
      card.style.top,
    ]);
  const previewed = places();
  fireEvent.click(screen.getByRole("button", { name: "Anwenden" }));
  const sent = socket.sent.filter((frame) => frame.type !== "join");
  expect(sent).toHaveLength(1);
  const command = sent[0] as Apply;
  expect(command).toMatchObject({ type: "admin.arrange.apply", source: "service" });
  // on this device nothing moves: what was sent is what the preview showed
  expect(places()).toEqual(previewed);
  socket.tell(appliedEvent(command, 6 + 4));
  socket.tell({ type: "ack", opId: command.opId, seq: 10 });
  await screen.findByText("6 Zettel in 2 Gruppen. 2 Personen sind da.", undefined, { timeout: 3000 });
  expect(places()).toEqual(previewed);
  expect(saidLast()).toBe("Geordnet: 2\u00a0Gruppen.");
  // the zone: „Ordnen“ again, „Neuer Zettel“, and „Rückgängig“ as a quiet third; one primary action
  expect(screen.getByRole("button", { name: "Ordnen" }).className).toBe("sb-primary-action");
  const undo = screen.getByRole("button", { name: "Ordnen rückgängig machen" });
  // a text action with its icon before its word; on a phone the icon alone (app-tool), the word stays to be heard
  expect(undo.className).toBe("sb-text-action app-tool");
  expect(undo.textContent).toBe("Rückgängig");
  expect(undo.querySelector("use")?.getAttribute("href")).toBe("#undo");
  expect(document.querySelectorAll(".sb-bottom-block .sb-secondary-action")).toHaveLength(1);
  // while it stands there, „Mehr“ does not offer it too
  expect(inMore("Ordnen rückgängig machen")).toBeNull();
  expect(guides()).toEqual([
    "Du moderierst: Die KI hat geordnet. Passt es nicht, nimmt „Rückgängig“ es sofort zurück. Sonst schiebt um und benennt um, was nicht trifft.",
    "Diese Wand lässt sich in 24\u00a0Stunden 6-mal ordnen, jetzt noch 5-mal.",
  ]);

  // it acts at once: the command names the run, and nothing shows before the wall has said what went where
  fireEvent.click(undo);
  const back = socket.sent.at(-1);
  expect(back).toMatchObject({ type: "admin.arrange.undo", runId: command.opId });
  expect(groupsShown()).toHaveLength(2);
  socket.tell({
    type: "arrange.undone",
    seq: 14,
    runId: command.opId,
    moves: SIX.map((one) => ({ noteId: one.id, x: one.x, y: one.y, groupId: null })),
    removed: command.groups.map((made) => made.groupId),
    restored: [],
  });
  socket.tell({ type: "ack", opId: back?.type === "admin.arrange.undo" ? back.opId : "", seq: 14 });
  await waitFor(() => expect(groupsShown()).toEqual([]));
  expect(places()).toEqual(SIX.map((one) => [`${one.x / 16}rem`, `${one.y / 16}rem`]));
  expect(saidLast()).toBe("Das Ordnen wurde zurückgenommen.");
  expect(screen.queryByRole("button", { name: "Ordnen rückgängig machen" })).toBeNull();
});

test("once the wall has changed since the run, „Rückgängig“ leaves the zone: it stands in „Mehr“ and asks first", async () => {
  arranging(answered(200, PROPOSED));
  const socket = await onSix();
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  await screen.findByText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  fireEvent.click(screen.getByRole("button", { name: "Anwenden" }));
  const command = socket.sent.at(-1) as Apply;
  socket.tell(appliedEvent(command, 10));
  socket.tell({ type: "ack", opId: command.opId, seq: 10 });
  expect(await screen.findByRole("button", { name: "Ordnen rückgängig machen" })).toBeTruthy();

  // somebody writes a note: the wall's number moves on, and taking the run back would lose what was done since
  socket.tell({ type: "note.created", seq: 11, note: note(7, "Neu dazugekommen", BEN) });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Ordnen rückgängig machen" })).toBeNull());
  const row = inMore("Ordnen rückgängig machen");
  expect(row).not.toBeNull();
  // with what deletes: last, in the danger colour
  expect(row?.className).toContain("danger");
  expect(guides()[0]).toBe(
    "Du moderierst: Die KI hat geordnet. Schiebt um und benennt um, was nicht trifft. Zurücknehmen lässt sich das Ordnen noch unter „Mehr“.",
  );
  // the question itself is a dialog (tests/arrange.spec.ts); here: nothing has gone out without it
  expect(socket.sent.some((frame) => frame.type === "admin.arrange.undo")).toBe(false);
});

test("a browser that joins after the run cannot tell what has changed since: „Rückgängig“ asks first there too", async () => {
  arranging(answered(200, PROPOSED));
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  const made = group(1, "Termine");
  socket.tell({
    ...(sync(
      ANNA_AND_BEN("admin"),
      SIX.map((one, n) => (n < 3 ? inGroup(one, made, n) : one)),
      [{ ...made, titleSource: "ki", locked: false }],
    ) as Extract<ServerEvent, { type: "sync" }>),
    arrangeRun: "99".repeat(16),
  });
  await screen.findByText("6 Zettel, 3 davon in 1 Gruppe. 2 Personen sind da.");
  expect(screen.queryByRole("button", { name: "Ordnen rückgängig machen" })).toBeNull();
  expect(inMore("Ordnen rückgängig machen")).not.toBeNull();
  // somebody who does not moderate has it nowhere
  socket.tell({
    ...(sync(ANNA_AND_BEN("member"), SIX) as Extract<ServerEvent, { type: "sync" }>),
    arrangeRun: "99".repeat(16),
  });
  await waitFor(() => expect(inMore("Ordnen rückgängig machen")).toBeNull());
});

test("no proposal: the sentence stands where the wall says what was not taken, and the wall stays usable", async () => {
  // 14:00 on this machine's clock, whatever its time zone. The AI's budget runs over 24 hours: it goes on at any
  // time of day, today or tomorrow
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 10, 23, 14, 0));
  const today = new Date(2026, 10, 23, 14, 10).getTime();
  const tomorrow = new Date(2026, 10, 24, 13, 50).getTime();
  let next = answered(429, { error: "AI_BUDGET_SPENT", resetsAt: tomorrow });
  arranging(() => next());
  const socket = await onSix();
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  // a time on the next day says so
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Das Kontingent der KI ist aufgebraucht, für alle Wände. Morgen ab 13:50\u00a0Uhr geht es weiter. Von Hand ordnen geht immer.",
    ),
  );
  // the wall is as it was, and everything on it still works: „Ordnen“ itself, a new note, a new group
  expect(screen.getByRole("button", { name: "Ordnen" }).getAttribute("aria-busy")).toBeNull();
  expect(groupsShown()).toEqual([]);
  expect(screen.getByRole("button", { name: "Neue Gruppe" })).toBeTruthy();
  // the sentence can be put away
  fireEvent.click(screen.getByRole("button", { name: "Hinweis schließen" }));
  expect(screen.getByRole("alert").textContent).toBe("");

  for (const [answer, sentence] of [
    // a time later on the same day stands alone
    [
      answered(429, { error: "AI_BUDGET_SPENT", resetsAt: today }),
      "Das Kontingent der KI ist aufgebraucht, für alle Wände. Ab 14:10\u00a0Uhr geht es weiter. Von Hand ordnen geht immer.",
    ],
    // Cloudflare itself refused, and the answer names no time: the sentence says that nobody here knows it
    [
      answered(429, { error: "AI_BUDGET_SPENT" }),
      "Das Kontingent der KI bei Cloudflare ist aufgebraucht, für alle Wände. Wann es weitergeht, kann die App nicht sagen: spätestens in 24\u00a0Stunden. Von Hand ordnen geht immer.",
    ],
    [
      answered(429, { error: "WALL_RUNS_SPENT", resetsAt: today }),
      "Diese Wand hat die KI in 24\u00a0Stunden 6-mal ordnen lassen, öfter geht es nicht. Ab 14:10\u00a0Uhr geht es wieder. Von Hand ordnen geht immer.",
    ],
    [
      answered(429, { error: "WALL_RUNS_SPENT", resetsAt: tomorrow }),
      "Diese Wand hat die KI in 24\u00a0Stunden 6-mal ordnen lassen, öfter geht es nicht. Morgen ab 13:50\u00a0Uhr geht es wieder. Von Hand ordnen geht immer.",
    ],
    [
      answered(409, { error: "NOTHING_TO_ARRANGE", notes: 3, min: 6 }),
      "Zum Ordnen sind es zu wenige Zettel: Die KI braucht mindestens 6, die in keiner von Hand angelegten oder umbenannten Gruppe liegen.",
    ],
    [
      answered(502, { error: "AI_FAILED" }),
      "Die KI hat keine brauchbare Antwort gegeben. Versuch es noch mal, oder ordnet von Hand.",
    ],
    [answered(503, { error: "AI_UNAVAILABLE" }), "Auf diesem Server ist keine KI angeschlossen. Ordnet von Hand."],
    [
      () => Promise.reject(new TypeError("offline")),
      "Die Anfrage kam nicht beim Server an. Prüf die Verbindung und versuch es noch mal.",
    ],
    [
      answered(413, { error: "PAYLOAD_TOO_LARGE" }),
      "Das Ordnen hat nicht geklappt: Der Server hat unerwartet geantwortet. Versuch es noch mal, oder ordnet von Hand.",
    ],
  ] as const) {
    next = answer;
    fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(sentence));
  }
  // a new change of one's own puts the sentence away, as it does every reason
  fireEvent.click(screen.getByRole("button", { name: "Neuer Zettel" }));
  const field = screen.getByRole("textbox", { name: "Text des Zettels" });
  fireEvent.change(field, { target: { value: "Mehr Pausen" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(screen.getByRole("alert").textContent).toBe("");
  expect(socket.sent.at(-1)?.type).toBe("note.create");
});

test("taking back a run that is no longer the wall's last one has its own sentence", async () => {
  arranging(answered(200, PROPOSED));
  const socket = await onSix();
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  await screen.findByText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  fireEvent.click(screen.getByRole("button", { name: "Anwenden" }));
  const command = socket.sent.at(-1) as Apply;
  socket.tell(appliedEvent(command, 10));
  socket.tell({ type: "ack", opId: command.opId, seq: 10 });
  fireEvent.click(await screen.findByRole("button", { name: "Ordnen rückgängig machen" }));
  const back = socket.sent.at(-1) as Extract<ClientCommand, { type: "admin.arrange.undo" }>;
  socket.tell({ type: "reject", opId: back.opId, code: "STALE" });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Inzwischen wurde neu geordnet: Zurücknehmen lässt sich nur das letzte Ordnen. Die Wand zeigt, was jetzt gilt.",
    ),
  );
});

/** The wall exists, „Ordnen“ answers with the proposal, and the export answers as the test says. */
function exporting(answer: () => Promise<Response>) {
  const asked: Array<{ url: string; init: RequestInit }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
    if (String(url).includes("/export")) {
      asked.push({ url: String(url), init: init ?? {} });
      return answer();
    }
    if (String(url).endsWith("/arrange")) return answered(200, PROPOSED)();
    return Promise.resolve(
      new Response(JSON.stringify({ wall: { id: WALL, question: QUESTION, createdAt: 1_795_300_000_000 } })),
    );
  });
  return asked;
}
const MARKDOWN = "# Was hält uns auf?\n\n## Termine\n\n- Termine kürzen\n";
const exported = () =>
  Promise.resolve(
    new Response(MARKDOWN, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": 'attachment; filename="Was-haelt-uns-auf-2026-11-25.md"',
      },
    }),
  );
/** The browser's download: the file the page made, and the name it gave it. */
function downloads() {
  const files: Array<{ name: string; blob: Blob }> = [];
  const blobs = new Map<string, Blob>();
  // jsdom has no object addresses: the test's own, put back after the test
  const before = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:test/${blobs.size}`;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  onTestFinished(() => {
    URL.createObjectURL = before.create;
    URL.revokeObjectURL = before.revoke;
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    files.push({ name: this.download, blob: blobs.get(this.getAttribute("href") ?? "")! });
  });
  return files;
}

test("after arranging the wall is the result: „Als Markdown sichern“ under what to do now, a file made in the tab", async () => {
  const asked = exporting(exported);
  const files = downloads();
  const socket = await onSix();
  // before the run: no key for it at the wall's top, only the row in „Mehr“
  expect(stateOf().queryByRole("button", { name: "Als Markdown sichern" })).toBeNull();
  expect(inMore("Als Markdown sichern")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ordnen" }));
  await screen.findByText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  // a proposal is no result yet
  expect(stateOf().queryByRole("button", { name: "Als Markdown sichern" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Anwenden" }));
  const command = socket.sent.at(-1) as Apply;
  socket.tell(appliedEvent(command, 10));
  socket.tell({ type: "ack", opId: command.opId, seq: 10 });

  const save = await stateOf().findByRole("button", { name: "Als Markdown sichern" });
  // an outlined action of the state, with its line; the zone keeps one primary action, „Ordnen“
  expect(save.className).toBe("sb-secondary-action");
  expect(stateOf().getByText("Ohne Namen. Die Datei bleibt auf diesem Gerät.")).toBeTruthy();
  expect(document.querySelectorAll(".sb-primary-action")).toHaveLength(1);
  fireEvent.click(save);
  await waitFor(() => expect(files).toHaveLength(1));
  // asked with this browser's session key, in a header; the address names the language and nothing else
  const sessionKey = useWalls.getState().walls.find((wall) => wall.id === WALL)?.sessionKey;
  expect(asked).toHaveLength(1);
  expect(asked[0]?.url).toBe(`/api/walls/${WALL}/export?lang=de`);
  expect(new Headers(asked[0]?.init.headers).get("authorization")).toBe(`Session ${sessionKey}`);
  expect(files[0]?.name).toBe("Was-haelt-uns-auf-2026-11-25.md");
  expect(await files[0]?.blob.text()).toBe(MARKDOWN);
  expect(saidLast()).toBe("Gesichert als „Was-haelt-uns-auf-2026-11-25.md“.");
});

test("„Als Markdown sichern“ and „QR-Code zeigen“ are everybody's, in „Mehr“; a failure is said in a toast", async () => {
  exporting(() => Promise.resolve(new Response("{}", { status: 503 })));
  const files = downloads();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  socket.tell(sync(ANNA_AND_BEN("member"), [note(1, "Mehr Pausen")]));
  await screen.findByText("1 Zettel. 2 Personen sind da.");
  fireEvent.click(inMore("Als Markdown sichern")!);
  // the toast's sentence, read from the store: the toast writes it two frames later, and in the run of this whole
  // file jsdom's frames did not get there (alone, the test saw it on the page)
  await waitFor(() =>
    expect(useToast.getState().message?.text).toBe(
      "Die Wand ließ sich nicht als Datei holen. Prüf die Verbindung und versuch es noch mal.",
    ),
  );
  expect(files).toHaveLength(0);

  // the wall's link as a QR code: a dialog, which jsdom cannot open (tests/export.spec.ts opens it)
  expect(inMore("QR-Code zeigen")).not.toBeNull();
});

// A step that votes (stage M2): the ballot stands in the place of the surface, „Abgeben“ sends it whole, and the
// state says the person's standing and how many have voted; the moderation counts, and the result is a ranked list.
const VOTE_SYNC = { ...REVEALED_SYNC, step: 3, reach: 3 };
const voteRound = (options: string[], counted = false) => ({
  step: 3,
  options: options.map((id) => ({ id, kind: "note" as const })),
  omitted: 0,
  limit: 2,
  counted,
});

test("a vote: points with − and +, what is left, „Abgeben“ sends the ballot; the state says who has voted, never what", async () => {
  found();
  const socket = await join();
  const notes = [note(1, "Weniger Termine", BEN), note(2, "Fokuszeit", BEN), note(3, "Mehr Pausen")];
  socket.tell({
    ...(sync(ANNA_AND_BEN("member"), notes) as Sync),
    ...VOTE_SYNC,
    votes: [voteRound(notes.map((one) => one.id))],
    voted: 1,
  });
  await screen.findByRole("heading", { name: "Deine Stimme: 2\u00a0Punkte zu verteilen" });
  expect(stateOf().getByText("Noch nicht abgegeben. 1 von 2 haben abgegeben.")).toBeTruthy();
  expect(document.querySelector(".app-surface, .app-list")).toBeNull();
  expect(screen.queryByRole("radio", { name: "Fläche" })).toBeNull();
  // an empty ballot is no vote: it says so and sends nothing
  fireEvent.click(screen.getByRole("button", { name: "Abgeben" }));
  expect(await screen.findByText("Verteil mindestens einen Punkt, dann drück „Abgeben“.")).toBeTruthy();
  expect(socket.sent.filter((frame) => frame.type === "ballot.cast")).toEqual([]);
  // two points on one note: the budget is spent, „+“ says it cannot act, and stays where it is
  const more = screen.getByRole("button", { name: "Einen Punkt mehr: Weniger Termine" });
  const left = () => document.querySelector(".app-ballot__left")?.textContent;
  expect(left()).toBe("Noch 2\u00a0Punkte");
  fireEvent.click(more);
  expect(left()).toBe("Noch 1\u00a0Punkt");
  fireEvent.click(more);
  expect(left()).toBe("Alle Punkte verteilt.");
  expect(screen.getByRole("button", { name: "Einen Punkt mehr: Fokuszeit" }).getAttribute("aria-disabled")).toBe(
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Einen Punkt mehr: Fokuszeit" }));
  fireEvent.click(screen.getByRole("button", { name: "Einen Punkt weniger: Weniger Termine" }));
  fireEvent.click(screen.getByRole("button", { name: "Einen Punkt mehr: Mehr Pausen" }));
  fireEvent.click(screen.getByRole("button", { name: "Abgeben" }));
  expect(socket.sent.filter((frame) => frame.type === "ballot.cast")).toEqual([
    expect.objectContaining({
      type: "ballot.cast",
      step: 3,
      ballot: { kind: "dots", points: { [notes[0]!.id]: 1, [notes[2]!.id]: 1 } },
    }),
  ]);
  // the wall stored it: the state says so
  socket.tell({
    type: "ballot.stored",
    seq: 4,
    step: 3,
    ballot: { kind: "dots", points: { [notes[0]!.id]: 1, [notes[2]!.id]: 1 } },
    voted: 2,
  });
  await screen.findByText("Abgegeben. 2 von 2 haben abgegeben.");
  expect(guides()).toContain(
    "Deine Punkte sind abgegeben. Ändern geht, bis die Moderation auszählt, und niemand sieht sie.",
  );
  // counted: the result as a ranked list, with places and points, for everybody at once
  socket.tell({
    type: "results.published",
    seq: 5,
    result: {
      step: 3,
      kind: "dots",
      limit: 2,
      voters: 2,
      rows: [
        { id: notes[0]!.id, kind: "note", label: "Weniger Termine", points: 3, by: 2, rank: 1 },
        { id: notes[2]!.id, kind: "note", label: "Mehr Pausen", points: 1, by: 1, rank: 2 },
        { id: notes[1]!.id, kind: "note", label: "Fokuszeit", points: 0, by: 0, rank: 3 },
      ],
    },
  });
  const results = await screen.findByRole("region", { name: "Ergebnis der Wahl" });
  expect([...results.querySelectorAll("li")].map((row) => row.textContent)).toEqual([
    "1.Weniger Termine3\u00a0Punkte",
    "2.Mehr Pausen1\u00a0Punkt",
    "3.Fokuszeit0\u00a0Punkte",
  ]);
  expect(document.querySelector(".app-state__sentence")?.textContent).toBe("Ausgezählt: 2\u00a0Stimmzettel.");
  expect(screen.getByRole("button", { name: "Als Markdown sichern" }).className).toBe("sb-primary-action");
});

test("the moderation's vote: „Auszählen“ is the primary action with „Abgeben“ beside it, then „Weiter“", async () => {
  found();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  const notes = [note(1, "Weniger Termine", BEN)];
  socket.tell({
    ...(sync(ANNA_AND_BEN("admin"), notes) as Sync),
    ...VOTE_SYNC,
    votes: [voteRound([notes[0]!.id])],
  });
  const count = await screen.findByRole("button", { name: "Auszählen" });
  expect(count.className).toBe("sb-primary-action");
  expect(screen.getByRole("button", { name: "Abgeben" }).className).toBe("sb-secondary-action");
  expect(document.querySelectorAll(".sb-primary-action")).toHaveLength(1);
  fireEvent.click(count);
  expect(flow(socket).at(-1)).toMatchObject({ type: "admin.step.count", step: 3 });
  socket.tell({
    type: "results.published",
    seq: 2,
    result: { step: 3, kind: "dots", limit: 2, voters: 0, rows: [] },
  });
  const next = await screen.findByRole("button", { name: "Weiter: Ergebnis besprechen" });
  expect(next.className).toBe("sb-primary-action");
  fireEvent.click(next);
  expect(flow(socket).at(-1)).toMatchObject({ type: "admin.step.go", from: 3, to: 4 });
});

// A step that estimates (stage M3): the number field with its unit in the place of the surface, the reason under it
// in the first round, „Abgeben“ and Enter send both; the second round shows the first round's summary and no reason;
// counted, the summary as rows of words and numbers.
const ESTIMATE_AGENDA = agendaFor({ hidden: true, agenda: { items: [{ methodId: "schaetzen", unit: "Tage" }] } });
const estimateRound = (step: number, counted = false) => ({ step, options: [], omitted: 0, limit: 1, counted });
const ROUND_ONE = {
  step: 0,
  kind: "estimate" as const,
  unit: "Tage",
  voters: 2,
  summary: { n: 2, median: 30, q1: 25, q3: 35, min: 20, max: 40 },
};

test("the first estimate: the number with its unit, a reason beside it; Enter sends the number and the reason as a note", async () => {
  found();
  const socket = await join();
  socket.tell({
    ...(sync(ANNA_AND_BEN("member")) as Sync),
    agenda: ESTIMATE_AGENDA,
    step: 0,
    reach: 0,
    votes: [estimateRound(0)],
  });
  await screen.findByRole("heading", { name: "Deine Schätzung" });
  expect(stateOf().getByText("Noch nicht geschätzt. 0 von 2 haben geschätzt.")).toBeTruthy();
  expect(guides()).toContain(
    "Schätz für dich und drück „Abgeben“. Niemand sieht deine Zahl, nur Median und Spanne, wenn die Moderation auszählt.",
  );
  expect(document.querySelector(".app-surface, .app-list")).toBeNull();
  const field = screen.getByLabelText<HTMLInputElement>("Deine Zahl");
  expect(field.closest(".sb-field__control")?.querySelector(".sb-field__suffix")?.textContent).toBe("Tage");
  // no number: it says so and sends nothing
  fireEvent.click(screen.getByRole("button", { name: "Abgeben" }));
  expect(await screen.findByText("Gib eine Zahl ein, dann drück „Abgeben“.")).toBeTruthy();
  fireEvent.change(field, { target: { value: "vierzig" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(await screen.findByText("Das ist keine Zahl. Schreib nur Ziffern, etwa 40 oder 2,5.")).toBeTruthy();
  expect(socket.sent.filter((frame) => frame.type === "ballot.cast")).toEqual([]);
  fireEvent.change(field, { target: { value: "2,5" } });
  fireEvent.change(screen.getByLabelText(/Kurze Begründung/), { target: { value: " Wie beim letzten Umzug " } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(socket.sent.filter((frame) => frame.type === "ballot.cast")).toEqual([
    expect.objectContaining({ step: 0, ballot: { kind: "estimate", value: 2.5 } }),
  ]);
  expect(socket.sent.filter((frame) => frame.type === "note.create")).toEqual([
    expect.objectContaining({ text: "Wie beim letzten Umzug" }),
  ]);
  socket.tell({ type: "ballot.stored", seq: 1, step: 0, ballot: { kind: "estimate", value: 2.5 }, voted: 1 });
  await screen.findByText("Abgegeben: 2,5 Tage. Ändern geht bis zum Auszählen.");
  expect(stateOf().getByText("Geschätzt. 1 von 2 haben geschätzt.")).toBeTruthy();
  expect(field.value).toBe("2,5");
});

test("the second round shows the first round's summary, no reason; counted, both rounds as rows", async () => {
  found();
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await join();
  socket.tell({
    ...(sync(ANNA_AND_BEN("admin")) as Sync),
    agenda: ESTIMATE_AGENDA,
    step: 3,
    reach: 3,
    votes: [estimateRound(0, true), estimateRound(3)],
    results: [ROUND_ONE],
  });
  await screen.findByRole("heading", { name: "Deine Schätzung" });
  const before = screen.getByRole("region", { name: "Runde 1" });
  expect([...before.querySelectorAll(".app-estimate__row")].map((row) => row.textContent)).toEqual([
    "Median30 Tage",
    "Mittlere Hälfte25 bis 35 Tage",
    "Spanne20 bis 40 Tage",
  ]);
  expect(screen.queryByLabelText(/Kurze Begründung/)).toBeNull();
  expect(screen.getByRole("button", { name: "Auszählen" }).className).toBe("sb-primary-action");
  socket.tell({
    type: "results.published",
    seq: 1,
    result: {
      step: 3,
      kind: "estimate",
      unit: "Tage",
      voters: 2,
      summary: { n: 2, median: 32, q1: 31, q3: 33, min: 30, max: 34 },
    },
  });
  const results = await screen.findByRole("region", { name: "Ergebnis der Schätzung" });
  expect([...results.querySelectorAll(".app-estimate__row")].map((row) => row.textContent)).toEqual([
    "Median30 Tage",
    "Mittlere Hälfte25 bis 35 Tage",
    "Spanne20 bis 40 Tage",
    "Median32 Tage",
    "Mittlere Hälfte31 bis 33 Tage",
    "Spanne30 bis 34 Tage",
    "Gegenüber Runde 1Median von 30 auf 32 Tage, mittlere Hälfte von 10 auf 2 Tage breit",
  ]);
  expect(document.querySelector(".app-state__sentence")?.textContent).toBe("Ausgezählt: 2 Schätzungen.");
  expect(screen.getByRole("button", { name: "Weiter: Ergebnis ansehen" }).className).toBe("sb-primary-action");
});
