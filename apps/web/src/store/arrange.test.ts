// „Ordnen“ as it goes in the moderation's browser, with the wall's real store and socket against a WebSocket of the
// test, and the Worker's answers to the request as the test's: asked, a proposal as a preview, applied or discarded;
// every way it ends without a proposal; and a wall that refuses the arrangement because it changed meanwhile.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  NO_CLOCK,
  PROTOCOL_VERSION,
  shown,
  type ClientCommand,
  type Note,
  type Participant,
  type Proposal,
  type ServerEvent,
} from "@ideabeam/shared";
import { rejectKey } from "../lib/rejected";
import { fakeSockets, nextSocket, type FakeWebSocket } from "../test-socket";
import { ARRANGE_WAIT_MS, useArrange } from "./arrange";
import { useWall } from "./wall";
import { useWalls } from "./walls";
import { OPEN_SYNC } from "../test-steps";

const WALL = "ab".repeat(32);
const TOKEN = "cd".repeat(16);
const ME = "1".repeat(32);
const ANNA: Participant = { id: ME, name: "Anna", role: "admin", online: true };

const id = (n: number) => n.toString(16).padStart(32, "0");
const note = (n: number, text: string): Note => ({
  id: id(n),
  mine: false,
  text,
  x: n * 300,
  y: 1000,
  groupId: null,
  createdAt: n,
  updatedAt: n,
});
const NOTES = [
  note(1, "Termine kürzen"),
  note(2, "Termine ohne Ergebnis"),
  note(3, "Termine bündeln"),
  note(4, "Werkzeuge vereinheitlichen"),
  note(5, "Werkzeuge erklären"),
  note(6, "Werkzeuge abschaffen"),
];
const PROPOSAL: Proposal = {
  groups: [
    { title: "Termine", noteIds: [id(1), id(2), id(3)] },
    { title: "Werkzeuge", noteIds: [id(4), id(5), id(6)] },
  ],
  loose: [],
};
const ANSWER = {
  proposal: PROPOSAL,
  cost: { neurons: 12.5, calls: 3, inputTokens: 900, outputTokens: 120 },
  partial: false,
  runsLeft: 5,
  model: "stand-in",
};

const sync = (notes: Note[] = NOTES, seq = notes.length): ServerEvent => ({
  type: "sync",
  protocolVersion: PROTOCOL_VERSION,
  serverNow: 1_795_300_000_000,
  wall: { id: WALL, question: "Was hält uns auf?", createdAt: 1_795_300_000_000 },
  participants: [ANNA],
  you: { participantId: ME },
  seq,
  ...OPEN_SYNC,
  hidden: 0,
  clock: NO_CLOCK,
  notes,
  groups: [],
  arrangeRun: null,
});

/** What the Worker answers to „Ordnen“: set by each test, asked for by the app's request. */
let arrange: (init: RequestInit | undefined) => Promise<Response> = () => Promise.reject(new TypeError("offline"));
/** Every request for a proposal the app made. */
let asked: RequestInit[] = [];
const answers = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
/** An answer that never comes by itself: the request ends when the app ends the waiting. */
const never = (init: RequestInit | undefined) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

beforeEach(() => {
  fakeSockets();
  asked = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
    if (!String(url).endsWith("/arrange")) return Promise.resolve(new Response("{}", { status: 503 }));
    asked.push(init ?? {});
    return arrange(init);
  });
});
afterEach(() => {
  useWall.getState().leave();
  useArrange.getState().reset();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** On the wall as its moderation, with six notes on it. */
async function onWall(notes = NOTES) {
  useWalls.getState().keepToken(WALL, TOKEN);
  useWall.getState().enter(WALL, "Anna");
  const socket = await nextSocket();
  socket.tell(sync(notes));
  return socket;
}
const ask = () => useArrange.getState().ask(WALL, TOKEN, "de");
const state = () => useArrange.getState().arranging;
/** The commands the app sent that change the wall's content. */
const sent = (socket: FakeWebSocket) => socket.sent.filter((frame) => frame.type !== "join");
type Apply = Extract<ClientCommand, { type: "admin.arrange.apply" }>;
/** The proposal has come and stands as a preview. */
async function previewing() {
  arrange = answers(200, ANSWER);
  ask();
  await vi.waitFor(() => expect(state().is).toBe("preview"));
}
/** The wall's word on an arrangement it took, as every browser on it gets it. */
function appliedEvent(command: Apply, seq: number): ServerEvent {
  return {
    type: "arrange.applied",
    seq,
    runId: command.opId,
    source: "service",
    groups: command.groups.map((group, n) => ({
      id: group.groupId,
      title: group.title,
      titleSource: "ki",
      locked: false,
      x: group.x,
      y: group.y,
      w: group.w,
      h: group.h,
      ord: n + 1,
    })),
    moves: command.moves,
    removed: [],
  };
}

test("„Ordnen“ asks the Worker with the token and the language; the proposal stands as a preview and nothing is sent", async () => {
  const socket = await onWall();
  arrange = answers(200, ANSWER);
  ask();
  // asked: the app waits, and knows how many notes the AI has to arrange
  expect(state()).toMatchObject({ is: "running", notes: 6 });
  await vi.waitFor(() => expect(state().is).toBe("preview"));
  expect(asked).toHaveLength(1);
  expect(new Headers(asked[0]?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
  expect(JSON.parse(String(asked[0]?.body))).toEqual({ language: "de" });
  // the proposal as it came, an id minted for each of its groups, and how many runs the wall has left today
  const now = state();
  expect(now).toMatchObject({ is: "preview", proposal: PROPOSAL, partial: false });
  if (now.is !== "preview") throw new Error("no preview");
  expect(now.groupIds).toHaveLength(2);
  expect(new Set(now.groupIds).size).toBe(2);
  for (const groupId of now.groupIds) expect(groupId).toMatch(/^[0-9a-f]{32}$/);
  expect(useArrange.getState().runsLeft).toBe(5);
  // nothing went to the wall, and the wall as this browser knows it is untouched: the preview is laid over it
  expect(sent(socket)).toEqual([]);
  expect(shown(useWall.getState().state).notes).toEqual(NOTES);
  expect(useWall.getState().state.pending).toEqual([]);
  // nothing is stored in the browser either
  expect(Object.keys(localStorage).join()).not.toMatch(/arrange|proposal/i);
  expect(sessionStorage).toHaveLength(0);
});

test("„Verwerfen“ lets the proposal go: nothing was sent, the wall is as it was", async () => {
  const socket = await onWall();
  await previewing();
  useArrange.getState().discard();
  expect(state()).toEqual({ is: "idle" });
  expect(sent(socket)).toEqual([]);
  expect(shown(useWall.getState().state).notes).toEqual(NOTES);
  // what the answer said about the wall's runs stays known: the run has counted
  expect(useArrange.getState().runsLeft).toBe(5);
});

test("„Anwenden“ sends the whole arrangement in one command; the wall's event ends it and names the run", async () => {
  const socket = await onWall();
  await previewing();
  useArrange.getState().apply();
  const [command] = sent(socket) as Apply[];
  expect(sent(socket)).toHaveLength(1);
  expect(command).toMatchObject({ type: "admin.arrange.apply", source: "service" });
  expect(command!.groups.map((group) => [group.title, group.noteIds])).toEqual([
    ["Termine", [id(1), id(2), id(3)]],
    ["Werkzeuge", [id(4), id(5), id(6)]],
  ]);
  expect(command!.moves.map((move) => move.noteId).sort()).toEqual(NOTES.map((one) => one.id));
  // on its way: this browser shows it at once
  expect(state()).toMatchObject({ is: "applying", opId: command!.opId, again: false });
  expect(shown(useWall.getState().state).groups.map((group) => group.title)).toEqual(["Termine", "Werkzeuge"]);

  // the wall's event, then its answer: two groups and two rows more, so four numbers on
  socket.tell(appliedEvent(command!, 6 + 4));
  expect(state()).toEqual({ is: "idle" });
  socket.tell({ type: "ack", opId: command!.opId, seq: 10 });
  const wall = useWall.getState();
  expect(wall.state.arrangeRun).toBe(command!.opId);
  expect(wall.state.gap).toBe(false);
  // the run and where the wall stood right after it: while it still stands there, taking it back loses nothing
  expect(wall.arranged).toEqual({ runId: command!.opId, seq: 10 });
  expect(wall.rejected).toBeNull();
});

test("every way it ends without a proposal is said where the wall says a change that was not taken", async () => {
  await onWall();
  const resetsAt = 1_795_392_000_000;
  // with the time it goes on, the answer keeps this device's clock: the sentence says „morgen“ from it
  const heard = { resetsAt, at: expect.any(Number) };
  for (const [status, body, key, extra] of [
    [409, { error: "NOTHING_TO_ARRANGE", notes: 3, min: 6 }, "arrangeNothing", { min: 6 }],
    [429, { error: "AI_BUDGET_SPENT", resetsAt }, "arrangeBudget", heard],
    // Cloudflare's own refusal names no time: another sentence
    [429, { error: "AI_BUDGET_SPENT" }, "arrangeBudgetNoTime", {}],
    [429, { error: "WALL_RUNS_SPENT", resetsAt }, "arrangeRuns", heard],
    [502, { error: "AI_FAILED" }, "arrangeFailed", {}],
    [503, { error: "AI_UNAVAILABLE" }, "arrangeUnavailable", {}],
    [409, { error: "PHASE" }, "phaseArrange", {}],
    [401, { error: "NOT_ADMIN" }, "notAdmin", {}],
    [404, { error: "WALL_NOT_FOUND" }, "arrangeUnknown", {}],
    [400, { error: "INVALID_REQUEST" }, "arrangeUnknown", {}],
    [413, { error: "PAYLOAD_TOO_LARGE" }, "arrangeUnknown", {}],
    [500, "no json", "arrangeUnknown", {}],
  ] as const) {
    arrange = answers(status, body);
    ask();
    await vi.waitFor(() => expect(state()).toEqual({ is: "idle" }));
    const { rejected } = useWall.getState();
    expect(rejected).toMatchObject({ command: "arrange", ...extra });
    if (typeof body === "string" || !("resetsAt" in body)) expect(rejected).not.toHaveProperty("resetsAt");
    expect(rejectKey(rejected!)).toBe(key);
    // the next try puts the last reason away, as every new change does
    arrange = never;
    ask();
    expect(useWall.getState().rejected).toBeNull();
    useArrange.getState().cancel();
  }
  // no answer at all
  arrange = () => Promise.reject(new TypeError("offline"));
  ask();
  await vi.waitFor(() => expect(state()).toEqual({ is: "idle" }));
  expect(rejectKey(useWall.getState().rejected!)).toBe("arrangeNetwork");
  // none of them leaves a number of runs behind that may be wrong by now
  expect(useArrange.getState().runsLeft).toBeNull();
});

test("after 120 seconds the app gives up waiting and says so", async () => {
  await onWall();
  vi.useFakeTimers();
  arrange = never;
  ask();
  await vi.advanceTimersByTimeAsync(ARRANGE_WAIT_MS - 1);
  expect(state().is).toBe("running");
  expect(asked[0]?.signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(asked[0]?.signal?.aborted).toBe(true);
  expect(state()).toEqual({ is: "idle" });
  expect(rejectKey(useWall.getState().rejected!)).toBe("arrangeTimeout");
  expect(ARRANGE_WAIT_MS).toBe(120_000);
});

test("„Abbrechen“ ends the waiting without a sentence; an answer that comes after it shows nothing", async () => {
  const socket = await onWall();
  let answer: (response: Response) => void = () => undefined;
  arrange = () => new Promise<Response>((resolve) => (answer = resolve));
  ask();
  expect(state().is).toBe("running");
  useArrange.getState().cancel();
  expect(state()).toEqual({ is: "idle" });
  expect(asked[0]?.signal?.aborted).toBe(true);
  expect(useWall.getState().rejected).toBeNull();
  // the Worker finished the run all the same: its proposal is nobody's any more
  answer(new Response(JSON.stringify(ANSWER), { status: 200 }));
  await new Promise((moment) => setTimeout(moment, 10));
  expect(state()).toEqual({ is: "idle" });
  expect(useArrange.getState().runsLeft).toBeNull();
  expect(sent(socket)).toEqual([]);
  // and „Ordnen“ can be asked again
  arrange = answers(200, ANSWER);
  ask();
  await vi.waitFor(() => expect(state().is).toBe("preview"));
});

test("a second „Ordnen“ while one is out, or while a proposal stands, asks nothing", async () => {
  await onWall();
  arrange = never;
  ask();
  ask();
  expect(asked).toHaveLength(1);
  useArrange.getState().cancel();
  await previewing();
  ask();
  expect(asked).toHaveLength(2);
  expect(state().is).toBe("preview");
});

test("a note of the proposal is deleted before „Anwenden“: the command is laid out from the wall as it stands", async () => {
  const socket = await onWall();
  await previewing();
  socket.tell({ type: "note.deleted", seq: 7, noteId: id(4) });
  useArrange.getState().apply();
  const [command] = sent(socket) as Apply[];
  expect(command!.moves.map((move) => move.noteId)).not.toContain(id(4));
  expect(command!.groups.map((group) => group.noteIds)).toEqual([
    [id(1), id(2), id(3)],
    [id(5), id(6)],
  ]);
});

test("the wall refuses the arrangement because it changed: laid out again and sent once more, under new names", async () => {
  const socket = await onWall();
  await previewing();
  useArrange.getState().apply();
  const [first] = sent(socket) as Apply[];
  // somebody deleted a note in the moment between: the wall has told so, and refuses the command that names it
  socket.tell({ type: "note.deleted", seq: 7, noteId: id(4) });
  socket.tell({ type: "reject", opId: first!.opId, code: "NOT_FOUND" });
  const [, second] = sent(socket) as Apply[];
  expect(sent(socket)).toHaveLength(2);
  expect(second!.opId).not.toBe(first!.opId);
  // new ids for the groups too: the wall may have refused one of them as taken
  expect(second!.groups.map((group) => group.groupId)).not.toEqual(first!.groups.map((group) => group.groupId));
  expect(second!.moves.map((move) => move.noteId)).not.toContain(id(4));
  expect(state()).toMatchObject({ is: "applying", opId: second!.opId, again: true });
  // nothing is said about the first refusal: the second try is on its way
  expect(useWall.getState().rejected).toBeNull();
  expect(useWall.getState().state.pending.map((pending) => pending.command.opId)).toEqual([second!.opId]);

  // the wall takes the second one
  socket.tell(appliedEvent(second!, 7 + 4));
  socket.tell({ type: "ack", opId: second!.opId, seq: 11 });
  expect(state()).toEqual({ is: "idle" });
  expect(useWall.getState().state.arrangeRun).toBe(second!.opId);
});

test("refused a second time: the wall says so, and the proposal still stands to be applied again or discarded", async () => {
  const socket = await onWall();
  await previewing();
  const before = state();
  useArrange.getState().apply();
  const [first] = sent(socket) as Apply[];
  socket.tell({ type: "reject", opId: first!.opId, code: "CONFLICT" });
  const [, second] = sent(socket) as Apply[];
  socket.tell({ type: "reject", opId: second!.opId, code: "CONFLICT" });
  // no third try
  expect(sent(socket)).toHaveLength(2);
  const { rejected } = useWall.getState();
  expect(rejected).toEqual({ code: "CONFLICT", command: "admin.arrange.apply" });
  expect(rejectKey(rejected!)).toBe("applyChanged");
  // the preview is back, with the same proposal: nothing of it is on the wall
  expect(state()).toMatchObject({ is: "preview", proposal: PROPOSAL });
  expect(before.is === "preview" && state().is === "preview").toBe(true);
  expect(useWall.getState().state.pending).toEqual([]);
  expect(shown(useWall.getState().state).groups).toEqual([]);
  // „Anwenden“ once more is a new first try
  useArrange.getState().apply();
  expect(state()).toMatchObject({ is: "applying", again: false });
  expect(sent(socket)).toHaveLength(3);
});

test("a refusal that laying out again cannot help is not tried twice: the wall's day is spent", async () => {
  const socket = await onWall();
  await previewing();
  useArrange.getState().apply();
  const [first] = sent(socket) as Apply[];
  socket.tell({ type: "reject", opId: first!.opId, code: "DAY_SPENT", resetsAt: 1_795_392_000_000 });
  expect(sent(socket)).toHaveLength(1);
  expect(state().is).toBe("preview");
  expect(rejectKey(useWall.getState().rejected!)).toBe("daySpent");
});

test("every note of the proposal is gone when it arrives, or when it is applied: said, and no preview stands", async () => {
  const socket = await onWall();
  // the AI worked on notes that were all deleted meanwhile
  let answer: (response: Response) => void = () => undefined;
  arrange = () => new Promise<Response>((resolve) => (answer = resolve));
  ask();
  NOTES.forEach((one, n) => socket.tell({ type: "note.deleted", seq: 7 + n, noteId: one.id }));
  answer(new Response(JSON.stringify(ANSWER), { status: 200 }));
  await vi.waitFor(() => expect(useWall.getState().rejected).not.toBeNull());
  expect(state()).toEqual({ is: "idle" });
  expect(rejectKey(useWall.getState().rejected!)).toBe("arrangeNothingLeft");
  // the run has counted, and the answer said how many are left
  expect(useArrange.getState().runsLeft).toBe(5);
  expect(sent(socket)).toEqual([]);
});

test("leaving the wall ends everything: the waiting, and a proposal that stood", async () => {
  await onWall();
  arrange = never;
  ask();
  useWall.getState().leave();
  expect(state()).toEqual({ is: "idle" });
  expect(asked[0]?.signal?.aborted).toBe(true);

  await onWall();
  await previewing();
  useWall.getState().leave();
  expect(state()).toEqual({ is: "idle" });
  expect(useArrange.getState().runsLeft).toBeNull();
});
