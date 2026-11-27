// „Ordnen“ with the moderation's own key, as it goes in the moderation's browser: the wall's real store and socket
// against a WebSocket of the test, the real run (lib/key-run.ts), and a `fetch` of the test that stands in for the
// provider and records every request this browser makes. What is held here: the provider is asked and the app's own
// server is not; the notes come from the wall as this browser shows it; the proposal is a preview as any other and
// goes to the wall as the moderation's own (`source: "key"`); and the key is in no frame of the socket.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fakeAsk, type ModelRequest } from "@ideabeam/arrange";
import {
  NO_CLOCK,
  PROTOCOL_VERSION,
  type ClientCommand,
  type Group,
  type Note,
  type Participant,
  type ServerEvent,
} from "@ideabeam/shared";
// (loaded here already: the store's own import of it then resolves at once, also under the test's clock)
import "../lib/key-run";
import { rejectKey } from "../lib/rejected";
import { fakeSockets, nextSocket, type FakeWebSocket } from "../test-socket";
import { ARRANGE_WAIT_MS, useArrange } from "./arrange";
import { useOwnKey, type OwnKey } from "./key";
import { useWall } from "./wall";
import { useWalls } from "./walls";
import { OPEN_SYNC } from "../test-steps";

const WALL = "ab".repeat(32);
const TOKEN = "cd".repeat(16);
const ME = "1".repeat(32);
const ANNA: Participant = { id: ME, name: "Anna", role: "admin", online: true };
// A key of the test: no provider's, and recognisable wherever it turned up.
const KEY = "key-of-the-test-0123456789";
const OWN: OwnKey = { provider: "mistral", key: KEY };
const MISTRAL = "https://api.eu.mistral.ai/v1/chat/completions";

const id = (n: number) => n.toString(16).padStart(32, "0");
const note = (n: number, text: string, more: Partial<Note> = {}): Note => ({
  id: id(n),
  mine: false,
  text,
  x: n * 300,
  y: 1000,
  groupId: null,
  createdAt: n,
  updatedAt: n,
  ...more,
});
const NOTES = [
  note(1, "Termine kürzen"),
  note(2, "Termine ohne Ergebnis"),
  note(3, "Termine bündeln"),
  note(4, "Werkzeuge vereinheitlichen"),
  note(5, "Werkzeuge erklären"),
  note(6, "Werkzeuge abschaffen"),
];
const PROPOSAL = {
  groups: [
    { title: "Termine", noteIds: [id(1), id(2), id(3)] },
    { title: "Werkzeuge", noteIds: [id(4), id(5), id(6)] },
  ],
  loose: [],
};

const sync = (notes: Note[] = NOTES, groups: Group[] = []): ServerEvent => ({
  type: "sync",
  protocolVersion: PROTOCOL_VERSION,
  serverNow: 1_795_300_000_000,
  wall: { id: WALL, question: "Was hält uns auf?", createdAt: 1_795_300_000_000 },
  participants: [ANNA],
  you: { participantId: ME },
  seq: notes.length,
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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** What the provider's model answers: the package's stand-in, in the shape of a chat completion. */
async function completion(init: RequestInit | undefined) {
  const body = JSON.parse(String(init?.body)) as {
    messages: Array<{ content: string }>;
    response_format: { json_schema: { schema: Record<string, unknown> } };
  };
  const { schema } = body.response_format.json_schema;
  const request: ModelRequest = {
    system: body.messages[0]?.content ?? "",
    user: body.messages[1]?.content ?? "",
    schema,
    maxTokens: 0,
  };
  const { content } = await fakeAsk(request, "themes" in (schema.properties as object) ? "themes" : "assign");
  return json(200, { choices: [{ message: { content }, finish_reason: "stop" }], usage: {} });
}
/** An answer that never comes by itself: the call ends when the app ends it. */
const never = (init: RequestInit | undefined) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

/** What the provider answers: set by each test. */
let provider: (init: RequestInit | undefined) => Promise<Response> = completion;
/** Every request this browser made, to whomever. */
let requests: Array<{ url: string; init: RequestInit }> = [];

beforeEach(() => {
  fakeSockets();
  requests = [];
  provider = completion;
  vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
    requests.push({ url: String(url), init: init ?? {} });
    // the app's own server is not asked in these tests: an answer from it would show as a failure
    return String(url) === MISTRAL ? provider(init) : Promise.resolve(json(500, { error: "NOT_EXPECTED" }));
  });
});
afterEach(() => {
  useWall.getState().leave();
  useArrange.getState().reset();
  useOwnKey.setState(useOwnKey.getInitialState());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** On the wall as its moderation, with six notes on it. */
async function onWall(notes = NOTES, groups: Group[] = []) {
  useWalls.getState().keepToken(WALL, TOKEN);
  useWall.getState().enter(WALL, "Anna");
  const socket = await nextSocket();
  socket.tell(sync(notes, groups));
  return socket;
}
const ask = (own = OWN) => useArrange.getState().askWithKey(WALL, own, "de");
const state = () => useArrange.getState().arranging;
/** The commands the app sent that change the wall's content. */
const sent = (socket: FakeWebSocket) => socket.sent.filter((frame) => frame.type !== "join");
type Apply = Extract<ClientCommand, { type: "admin.arrange.apply" }>;

test("with a key the provider is asked from this browser, and the app's own server is not asked at all", async () => {
  const socket = await onWall();
  ask();
  // asked: the app waits, and knows whom it asked
  expect(state()).toMatchObject({ is: "running", notes: 6, provider: "mistral" });
  await vi.waitFor(() => expect(state().is).toBe("preview"));
  // two calls, both to the provider: the themes, and the six notes
  expect(requests.map(({ url }) => url)).toEqual([MISTRAL, MISTRAL]);
  for (const { init } of requests) {
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    // neither the admin token nor the wall's id goes to the provider
    expect(JSON.stringify(init)).not.toContain(TOKEN);
    expect(JSON.stringify(init)).not.toContain(WALL);
  }
  // what the provider reads: the wall's question and the texts of the notes, no name and no id
  const first = String(requests[0]?.init.body);
  expect(first).toContain("Was hält uns auf?");
  for (const { text } of NOTES) expect(first).toContain(text);
  expect(first).not.toContain("Anna");
  for (const { id: noteId } of NOTES) expect(first).not.toContain(noteId);
  // the proposal stands as a preview, as the moderation's own
  expect(state()).toMatchObject({ is: "preview", proposal: PROPOSAL, partial: false, source: "key" });
  // nothing went to the wall, and the wall's runs at the Worker are not touched: none is known, none was used
  expect(sent(socket)).toEqual([]);
  expect(useArrange.getState().runsLeft).toBeNull();
  // nothing is stored in the browser
  expect({ ...localStorage }).not.toHaveProperty("arrange");
  expect(JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })).not.toContain(KEY);
});

test("„Anwenden“ sends the arrangement as the moderation's own; no frame of the socket carries the key", async () => {
  const socket = await onWall();
  ask();
  await vi.waitFor(() => expect(state().is).toBe("preview"));
  useArrange.getState().apply();
  const [command] = sent(socket) as Apply[];
  expect(sent(socket)).toHaveLength(1);
  expect(command).toMatchObject({ type: "admin.arrange.apply", source: "key" });
  expect(command!.groups.map((group) => [group.title, group.noteIds])).toEqual([
    ["Termine", [id(1), id(2), id(3)]],
    ["Werkzeuge", [id(4), id(5), id(6)]],
  ]);
  expect(state()).toMatchObject({ is: "applying", source: "key" });
  // every frame this browser sent, the join among them: none holds the key
  expect(JSON.stringify(socket.sent)).not.toContain(KEY);
  // the wall's word: the run is the wall's, and everybody's
  socket.tell({
    type: "arrange.applied",
    seq: 10,
    runId: command!.opId,
    source: "key",
    groups: command!.groups.map((group, n) => ({
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
    moves: command!.moves,
    removed: [],
  });
  expect(state()).toEqual({ is: "idle" });
  expect(useWall.getState().state.arrangeRun).toBe(command!.opId);
});

test("the notes are the wall's as this browser shows it: in the order they were made, none of a locked group", async () => {
  const locked: Group = {
    id: id(90),
    title: "Von Hand",
    titleSource: "person",
    locked: true,
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    ord: 1,
  };
  // the wall lists the notes in another order than they were made in, and two of them lie in a group made by hand
  const notes = [
    note(7, "Pausen sind zu kurz"),
    ...[...NOTES].reverse(),
    note(8, "Termine am Montag", { groupId: locked.id }),
    note(9, "Geheimes in der Gruppe von Hand", { groupId: locked.id }),
  ];
  await onWall(notes, [locked]);
  ask();
  await vi.waitFor(() => expect(state().is).toBe("preview"));
  const first = JSON.parse(String(requests[0]?.init.body)) as { messages: Array<{ content: string }> };
  const listed = (first.messages[1]?.content ?? "").split("\n").filter((line) => /^\d+\. /.test(line));
  expect(listed).toEqual([
    "1. Termine kürzen",
    "2. Termine ohne Ergebnis",
    "3. Termine bündeln",
    "4. Werkzeuge vereinheitlichen",
    "5. Werkzeuge erklären",
    "6. Werkzeuge abschaffen",
    "7. Pausen sind zu kurz",
  ]);
  // nothing of the locked group's notes went out in any call
  for (const { init } of requests) expect(String(init.body)).not.toMatch(/Geheimes|Termine am Montag/);
});

test("fewer than six notes: said as the Worker says it, and nobody is asked", async () => {
  await onWall(NOTES.slice(0, 5));
  ask();
  expect(state()).toEqual({ is: "idle" });
  expect(requests).toEqual([]);
  const { rejected } = useWall.getState();
  expect(rejected).toEqual({ code: "NOTHING_TO_ARRANGE", command: "arrange", min: 6 });
  expect(rejectKey(rejected!)).toBe("arrangeNothing");
});

test("every way it ends without a proposal is said with the provider's name, and the wall's runs stay as known", async () => {
  await onWall();
  // the wall is known to have five runs left at the Worker: a run with the key changes nothing about that
  useArrange.setState({ runsLeft: 5 });
  const refusal = { choices: [{ message: { content: null, refusal: "No." }, finish_reason: "stop" }] };
  for (const [answer, code, key, calls] of [
    [() => Promise.resolve(json(401, { detail: "Invalid API Key" })), "KEY_REFUSED", "keyRefused", 1],
    [() => Promise.resolve(json(402, {})), "NO_CREDIT", "keyNoCredit", 1],
    [() => Promise.resolve(json(429, {})), "RATE_LIMITED", "keyRateLimited", 2],
    [() => Promise.resolve(json(400, {})), "REJECTED", "keyRejected", 1],
    [() => Promise.resolve(json(200, refusal)), "DECLINED", "keyDeclined", 2],
    [() => Promise.reject(new TypeError("Failed to fetch")), "UNREACHABLE", "keyUnreachable", 2],
    [() => Promise.resolve(json(200, { choices: [] })), "UNUSABLE", "keyUnusable", 2],
  ] as const) {
    requests = [];
    provider = answer;
    ask();
    await vi.waitFor(() => expect(state()).toEqual({ is: "idle" }));
    const { rejected } = useWall.getState();
    expect(rejected, code).toEqual({ code, command: "arrange.key", provider: "mistral" });
    expect(rejectKey(rejected!)).toBe(key);
    expect(requests, code).toHaveLength(calls);
    expect(JSON.stringify(rejected)).not.toContain(KEY);
    // the next try puts the last reason away, as every new change does
    provider = never;
    ask();
    expect(useWall.getState().rejected).toBeNull();
    useArrange.getState().cancel();
    expect(useArrange.getState().runsLeft).toBe(5);
  }
  // Anthropic's sentence of a refused key is its own
  expect(rejectKey({ code: "KEY_REFUSED", command: "arrange.key", provider: "anthropic" })).toBe("keyRefusedBrowser");
});

test("„Abbrechen“ ends the calls themselves, without a sentence; „Ordnen“ can be asked again", async () => {
  const socket = await onWall();
  provider = never;
  ask();
  await vi.waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0]?.init.signal?.aborted).toBe(false);
  useArrange.getState().cancel();
  expect(state()).toEqual({ is: "idle" });
  // the call that was out is ended, and no further one is made
  expect(requests[0]?.init.signal?.aborted).toBe(true);
  await new Promise((moment) => setTimeout(moment, 20));
  expect(requests).toHaveLength(1);
  expect(useWall.getState().rejected).toBeNull();
  expect(sent(socket)).toEqual([]);
  provider = completion;
  ask();
  await vi.waitFor(() => expect(state().is).toBe("preview"));
});

test("after 120 seconds the calls are ended and the app says that the provider was not done", async () => {
  await onWall();
  vi.useFakeTimers();
  provider = never;
  ask();
  await vi.advanceTimersByTimeAsync(ARRANGE_WAIT_MS - 1);
  expect(state().is).toBe("running");
  await vi.advanceTimersByTimeAsync(1);
  expect(state()).toEqual({ is: "idle" });
  const { rejected } = useWall.getState();
  expect(rejected).toEqual({ code: "TIMEOUT", command: "arrange.key", provider: "mistral" });
  expect(rejectKey(rejected!)).toBe("keyTimeout");
  // every call that was made is ended
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(({ init }) => init.signal?.aborted)).toBe(true);
});

test("a second „Ordnen“ while one is out, or while a proposal stands, asks nobody", async () => {
  await onWall();
  provider = never;
  ask();
  ask();
  await vi.waitFor(() => expect(requests).toHaveLength(1));
  useArrange.getState().cancel();
  provider = completion;
  requests = [];
  ask();
  await vi.waitFor(() => expect(state().is).toBe("preview"));
  const calls = requests.length;
  ask();
  await new Promise((moment) => setTimeout(moment, 10));
  expect(requests).toHaveLength(calls);
});

test("leaving the wall ends the calls, and nothing of the run stays", async () => {
  await onWall();
  provider = never;
  ask();
  await vi.waitFor(() => expect(requests).toHaveLength(1));
  useWall.getState().leave();
  expect(state()).toEqual({ is: "idle" });
  expect(requests[0]?.init.signal?.aborted).toBe(true);
});
