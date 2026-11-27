// The live wall with its real socket (lib/socket.ts and partysocket) against a WebSocket of the test: what goes out
// is what a wall would get, and the test speaks as the wall. Who is on the wall first, then the notes: changes that
// show before the wall has answered, rejects, a wall out of step, the rate limit, and a line that is gone.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NO_CLOCK, PROTOCOL_VERSION, shown, type Participant, type ServerEvent } from "@ideabeam/shared";
import { FakeWebSocket, fakeSockets, nextSocket } from "../test-socket";
import { useWall } from "./wall";
import { useWalls } from "./walls";
import { OPEN_SYNC, WRITING_SYNC } from "../test-steps";

const WALL = "ab".repeat(32);
const TOKEN = "cd".repeat(16);
const ME = "1".repeat(32);

const person = (id: string, name: string, role: Participant["role"] = "member"): Participant => ({
  id,
  name,
  role,
  online: true,
});
const sync = (participants: Participant[], protocolVersion = PROTOCOL_VERSION): ServerEvent => ({
  type: "sync",
  protocolVersion,
  serverNow: 1_795_300_000_000,
  wall: { id: WALL, question: "Was hält uns auf?", createdAt: 1_795_300_000_000 },
  participants,
  you: { participantId: ME },
  seq: 0,
  // a wall whose notes are there for everyone: a „Freie Wand“
  ...OPEN_SYNC,
  hidden: 0,
  clock: NO_CLOCK,
  notes: [],
  groups: [],
  arrangeRun: null,
});

/** Joins the wall and returns the socket once it is connected: the join has gone out. */
function enter(as = "Anna") {
  useWall.getState().enter(WALL, as);
  return nextSocket();
}

beforeEach(() => {
  fakeSockets();
  // the store asks whether the wall is still there when its socket drops
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 503 }));
});
afterEach(() => {
  useWall.getState().leave();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** After a drop: the socket of the next connection, which partysocket opens after a pause of its own. The test's
 *  clock runs until it is there (`vi.useFakeTimers()` first). */
async function reconnected() {
  const before = FakeWebSocket.all.length;
  for (let step = 0; step < 80 && FakeWebSocket.all.length === before; step++) await vi.advanceTimersByTimeAsync(250);
  expect(FakeWebSocket.all.length).toBeGreaterThan(before);
  const socket = FakeWebSocket.all.at(-1)!;
  socket.open();
  return socket;
}

test("the join goes first; the first sync puts this browser on the wall and makes it known", async () => {
  const socket = await enter();
  expect(useWall.getState()).toMatchObject({ wallId: WALL, status: "online", refusal: null });
  // the address of the socket names the wall and nothing else
  expect(new URL(socket.url).pathname).toBe(`/api/walls/${WALL}/ws`);
  expect(new URL(socket.url).search).toBe("");
  const [join] = socket.sent;
  expect(join).toMatchObject({ type: "join", name: "Anna" });
  expect(join).not.toHaveProperty("adminToken");

  socket.tell(sync([person(ME, "Anna")]));
  expect(useWall.getState().state.wall?.question).toBe("Was hält uns auf?");
  expect(useWall.getState().outdated).toBe(false);
  expect(useWalls.getState().walls[0]).toMatchObject({ id: WALL, question: "Was hält uns auf?", as: "Anna" });

  // coming back is the same person: the stored key
  useWall.getState().leave();
  const again = await enter();
  expect(again.sent[0]).toEqual(join);
});

test("a browser that holds the wall's admin token joins with it, in the frame and never in the address", async () => {
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await enter();
  expect(socket.sent).toMatchObject([{ type: "join", name: "Anna", adminToken: TOKEN }]);
  expect(socket.url).not.toContain(TOKEN);
});

test("a token that arrives while on the wall goes out in a second join at once", async () => {
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  expect(socket.sent).toHaveLength(1);

  useWalls.getState().keepToken(WALL, TOKEN);
  expect(socket.sent).toHaveLength(2);
  expect(socket.sent[1]).toEqual({ ...socket.sent[0], adminToken: TOKEN });
  // the wall's answer: the same person, now moderating
  socket.tell(sync([person(ME, "Anna", "admin")]));
  expect(useWall.getState().state.participants).toEqual([person(ME, "Anna", "admin")]);
  // the token of another wall is no reason to join again
  useWalls.getState().keepToken("ef".repeat(32), TOKEN);
  expect(socket.sent).toHaveLength(2);
});

test("a name that is taken, and a wall that is full, end the try: no socket keeps knocking", async () => {
  for (const code of ["NAME_TAKEN", "WALL_FULL"] as const) {
    const socket = await enter();
    socket.tell({ type: "error", code });
    expect(useWall.getState()).toMatchObject({ status: "idle", refusal: code });
    expect(socket.readyState).toBe(3);
    expect(useWalls.getState().walls).toEqual([]);
  }
});

test("the others come, change and go", async () => {
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna", "admin")]));
  const ben = person("2".repeat(32), "Ben");
  socket.tell({ type: "presence.join", participant: ben });
  socket.tell({ type: "roster.updated", participant: { ...ben, role: "admin" } });
  socket.tell({ type: "presence.leave", participantId: ben.id });
  expect(useWall.getState().state.participants).toEqual([
    person(ME, "Anna", "admin"),
    { ...ben, role: "admin", online: false },
  ]);
});

test("the moderation deletes the wall: it says so, stops its socket and is dropped with its token", async () => {
  useWalls.getState().keepToken(WALL, TOKEN);
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna", "admin")]));
  useWall.getState().deleteWall();
  expect(socket.sent[1]).toMatchObject({ type: "admin.wall.delete" });

  socket.tell({ type: "wall.deleted" });
  expect(useWall.getState().state.deleted).toBe(true);
  expect(socket.readyState).toBe(3);
  expect(useWalls.getState().walls).toEqual([]);
  expect(useWalls.getState().adminTokens).toEqual({});
  // the socket's own end is no drop: nothing reconnects, and nobody asks for a wall that is known to be gone
  await new Promise((resolve) => setTimeout(resolve));
  expect(useWall.getState().status).toBe("idle");
  expect(fetch).not.toHaveBeenCalled();
});

test("a socket that drops asks once whether the wall is still there: gone is gone, anything else waits", async () => {
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  socket.drop();
  expect(useWall.getState().status).toBe("offline");
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/walls/${WALL}`));
  expect(useWall.getState().state.deleted).toBe(false);
  // the wall as it stood stays on screen while the socket tries again
  expect(useWall.getState().state.wall?.question).toBe("Was hält uns auf?");
  useWall.getState().leave();

  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 404 }));
  const second = await enter();
  second.tell(sync([person(ME, "Anna")]));
  second.drop();
  await vi.waitFor(() => expect(useWall.getState().state.deleted).toBe(true));
  expect(useWalls.getState().walls).toEqual([]);
});

test("a Worker that speaks another version of the protocol asks for a reload", async () => {
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")], PROTOCOL_VERSION + 1));
  expect(useWall.getState().outdated).toBe(true);
});

// ───────────────────────── notes: optimistic commands ─────────────────────────

const NOTE = "a".repeat(32);
const OP = "b".repeat(32);
const create = (opId = OP, noteId = NOTE) =>
  ({ type: "note.create", opId, noteId, text: "Weniger Termine", x: 10, y: 20 }) as const;
const texts = () => shown(useWall.getState().state).notes.map((note) => note.text);

test("a change shows at once and goes to the wall; the wall's event and its ack make it the wall's own", async () => {
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  useWall.getState().send(create());
  // shown before the wall has said a word, as this person's note
  expect(shown(useWall.getState().state).notes).toMatchObject([{ id: NOTE, mine: true, text: "Weniger Termine" }]);
  expect(useWall.getState().state.notes).toEqual([]);
  expect(socket.sent.at(-1)).toEqual(create());

  socket.tell({
    type: "note.created",
    seq: 1,
    note: { id: NOTE, mine: true, text: "Weniger Termine", x: 10, y: 20, groupId: null, createdAt: 5, updatedAt: 5 },
  });
  socket.tell({ type: "ack", opId: OP, seq: 1 });
  expect(useWall.getState().state.pending).toEqual([]);
  expect(texts()).toEqual(["Weniger Termine"]);
  expect(useWall.getState().rejected).toBeNull();
});

test("a reject takes the change back and keeps why; the next change puts the reason away", async () => {
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  useWall.getState().send(create());
  expect(texts()).toEqual(["Weniger Termine"]);
  socket.tell({ type: "reject", opId: OP, code: "LIMIT" });
  expect(texts()).toEqual([]);
  expect(useWall.getState().rejected).toEqual({ code: "LIMIT", command: "note.create" });

  useWall.getState().send(create("c".repeat(32), "d".repeat(32)));
  expect(useWall.getState().rejected).toBeNull();
  // a reject of something that is no change to the wall's content names no command
  socket.tell({ type: "reject", opId: "e".repeat(32), code: "NOT_ADMIN" });
  expect(useWall.getState().rejected).toEqual({ code: "NOT_ADMIN", command: null });
  useWall.getState().dismissRejected();
  expect(useWall.getState().rejected).toBeNull();
});

test("an event out of step asks for the wall again, once; the sync that answers ends the gap", async () => {
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  const note = { id: NOTE, mine: true, text: "x", x: 0, y: 0, groupId: null, createdAt: 5, updatedAt: 5 };
  // number 3 after number 0: two changes never arrived
  socket.tell({ type: "note.created", seq: 3, note });
  expect(useWall.getState().state.gap).toBe(true);
  expect(socket.sent.filter((frame) => frame.type === "resync")).toHaveLength(1);
  // more events while the answer is on its way do not ask again
  socket.tell({ type: "note.updated", seq: 4, noteId: NOTE, text: "y", updatedAt: 6 });
  expect(socket.sent.filter((frame) => frame.type === "resync")).toHaveLength(1);

  socket.tell({ ...sync([person(ME, "Anna")]), seq: 4, notes: [{ ...note, text: "y" }] } as ServerEvent);
  expect(useWall.getState().state.gap).toBe(false);
  // in step again: the next event is the next number, and nobody asks
  socket.tell({ type: "note.updated", seq: 5, noteId: NOTE, text: "z", updatedAt: 7 });
  expect(socket.sent.filter((frame) => frame.type === "resync")).toHaveLength(1);
  // out of step a second time: asked a second time
  socket.tell({ type: "note.updated", seq: 9, noteId: NOTE, text: "w", updatedAt: 8 });
  expect(socket.sent.filter((frame) => frame.type === "resync")).toHaveLength(2);
});

test("a frame dropped for the rate limit: the oldest change on its way is taken back and never sent again", async () => {
  vi.useFakeTimers();
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  useWall.getState().send(create());
  useWall.getState().send(create("c".repeat(32), "d".repeat(32)));
  socket.tell({ type: "error", code: "RATE_LIMIT" });
  expect(useWall.getState().rejected).toEqual({ code: "RATE_LIMIT", command: "note.create" });
  expect(useWall.getState().state.pending.map(({ command }) => command.opId)).toEqual(["c".repeat(32)]);
  // the line drops: the next connection sends what is still on its way, not what was taken back
  socket.drop();
  const next = await reconnected();
  expect(next.sent.map((frame) => ("opId" in frame ? frame.opId : frame.type))).toEqual(["join", "c".repeat(32)]);
  // with nothing on its way, the rate limit has nothing to take back
  next.tell(sync([person(ME, "Anna")]));
  next.tell({ type: "ack", opId: "c".repeat(32), seq: 1 });
  useWall.getState().dismissRejected();
  next.tell({ type: "error", code: "RATE_LIMIT" });
  expect(useWall.getState().rejected).toBeNull();
});

test("a rate limit while the wall is being asked again was the question's: it is asked again later", async () => {
  vi.useFakeTimers();
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  useWall.getState().send(create());
  const note = { id: "f".repeat(32), mine: true, text: "x", x: 0, y: 0, groupId: null, createdAt: 5, updatedAt: 5 };
  socket.tell({ type: "note.created", seq: 7, note });
  expect(socket.sent.filter((frame) => frame.type === "resync")).toHaveLength(1);
  socket.tell({ type: "error", code: "RATE_LIMIT" });
  // the change on its way is not blamed
  expect(useWall.getState().rejected).toBeNull();
  expect(useWall.getState().state.pending).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(7000);
  expect(socket.sent.filter((frame) => frame.type === "resync")).toHaveLength(2);
});

test("a change made offline waits and goes out with the next connection; unanswered, it goes out again", async () => {
  vi.useFakeTimers();
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  socket.drop();
  useWall.getState().send(create());
  // shown at once, also without a line
  expect(texts()).toEqual(["Weniger Termine"]);
  const second = await reconnected();
  expect(second.sent).toMatchObject([{ type: "join" }, create()]);
  // the second line dies before the wall has answered: the third one sends the change once more
  second.drop();
  const third = await reconnected();
  expect(third.sent).toMatchObject([{ type: "join" }, create()]);
  third.tell(sync([person(ME, "Anna")]));
  third.tell({ type: "ack", opId: OP, seq: 1 });
  third.drop();
  const fourth = await reconnected();
  expect(fourth.sent).toMatchObject([{ type: "join" }]);
  expect(fourth.sent).toHaveLength(1);
});

test("too many changes waiting for a line: the oldest never goes out, and is taken back with its reason", async () => {
  vi.useFakeTimers();
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  socket.drop();
  const id = (n: number) => n.toString(16).padStart(32, "0");
  // twenty wait at most (lib/socket.ts)
  for (let n = 1; n <= 21; n++) useWall.getState().send(create(id(n), id(100 + n)));
  expect(useWall.getState().rejected).toEqual({ code: "LOST", command: "note.create" });
  expect(useWall.getState().state.pending.map(({ command }) => command.opId)).toEqual(
    Array.from({ length: 20 }, (_, n) => id(n + 2)),
  );
  const next = await reconnected();
  expect(next.sent).toHaveLength(21);
  expect(next.sent[1]).toMatchObject({ opId: id(2) });
});

// ───────────────────────── the flow: hidden writing, revealing, the clock, the brake ─────────────────────────

const SERVER_NOW = 1_795_300_000_000;
const MINUTE = 60_000;
/** A wall whose notes are hidden: this browser's own notes, and how many the others have written. */
const hiddenSync = (participants: Participant[], more: Partial<Extract<ServerEvent, { type: "sync" }>> = {}) =>
  ({ ...sync(participants), ...WRITING_SYNC, hidden: 3, ...more }) as ServerEvent;
const flow = (socket: FakeWebSocket) => socket.sent.filter((frame) => frame.type.startsWith("admin."));

test("the distance to the worker's clock is kept from every frame that carries its time, and the browser counts from it", async () => {
  vi.useFakeTimers();
  const socket = await enter();
  // this browser's clock runs 37 minutes ahead of the worker's
  vi.setSystemTime(SERVER_NOW + 37 * MINUTE);
  socket.tell(hiddenSync([person(ME, "Anna", "admin")]));
  expect(useWall.getState()).toMatchObject({ skew: 37 * MINUTE, now: SERVER_NOW });

  // a clock is started: the frame brings the worker's time again, and the clock ends by the worker's clock
  vi.setSystemTime(SERVER_NOW + 37 * MINUTE + 2000);
  const clock = { rev: 1, endsAt: SERVER_NOW + 2000 + 5 * MINUTE, leftMs: null };
  socket.tell({ type: "clock.changed", seq: 1, clock, serverNow: SERVER_NOW + 2000 });
  expect(useWall.getState()).toMatchObject({ skew: 37 * MINUTE, now: SERVER_NOW + 2000, state: { clock } });
  // ninety seconds later the browser looks at its own clock and reckons the worker's
  vi.setSystemTime(SERVER_NOW + 37 * MINUTE + 92_000);
  useWall.getState().look();
  expect(useWall.getState().now).toBe(SERVER_NOW + 92_000);
  // the wrong clock is put right meanwhile: the next frame measures the distance anew
  vi.setSystemTime(SERVER_NOW + 100_000);
  socket.tell({
    type: "clock.changed",
    seq: 2,
    clock: { rev: 2, endsAt: null, leftMs: 3 * MINUTE },
    serverNow: SERVER_NOW + 100_000,
  });
  expect(useWall.getState()).toMatchObject({ skew: 0, now: SERVER_NOW + 100_000 });
});

test("revealing goes to the wall and shows when the wall says so: the others' notes, then the step", async () => {
  const socket = await enter();
  const mine = { id: NOTE, mine: true, text: "Meiner", x: 0, y: 0, groupId: null, createdAt: 5, updatedAt: 5 };
  socket.tell(hiddenSync([person(ME, "Anna", "admin")], { notes: [mine], seq: 4 }));
  expect(useWall.getState().state).toMatchObject({ step: 0, hidden: 3 });

  useWall.getState().goStep(1);
  expect(flow(socket)).toMatchObject([{ type: "admin.step.go", from: 0, to: 1 }]);
  // nothing shows before the wall has said so
  expect(useWall.getState().state.step).toBe(0);
  const theirs = { ...mine, id: "f".repeat(32), mine: false, text: "Von Ben", createdAt: 6, updatedAt: 6 };
  socket.tell({ type: "notes.revealed", seq: 5, notes: [theirs] });
  socket.tell({ type: "step.changed", seq: 6, step: 1, reach: 1 });
  const opId = "opId" in flow(socket)[0]! ? (flow(socket)[0] as { opId: string }).opId : "";
  socket.tell({ type: "ack", opId, seq: 6 });
  expect(useWall.getState().state).toMatchObject({ step: 1, reach: 1, hidden: 0, gap: false });
  expect(texts()).toEqual(["Meiner", "Von Ben"]);
  expect(useWall.getState().rejected).toBeNull();
});

test("a control of the clock names the revision of the clock it was made for", async () => {
  const socket = await enter();
  socket.tell(hiddenSync([person(ME, "Anna", "admin")]));
  useWall.getState().setClock({ type: "start", minutes: 5 });
  expect(flow(socket)).toMatchObject([{ type: "admin.clock.start", rev: 0, minutes: 5 }]);
  // nothing shows before the wall has said so
  expect(useWall.getState().state.clock).toEqual(NO_CLOCK);
  const clock = { rev: 1, endsAt: SERVER_NOW + 5 * MINUTE, leftMs: null };
  socket.tell({ type: "clock.changed", seq: 1, clock, serverNow: SERVER_NOW });
  for (const type of ["pause", "resume", "extend", "clear"] as const) useWall.getState().setClock({ type });
  expect(flow(socket).slice(1)).toMatchObject([
    { type: "admin.clock.pause", rev: 1 },
    { type: "admin.clock.resume", rev: 1 },
    { type: "admin.clock.extend", rev: 1 },
    { type: "admin.clock.clear", rev: 1 },
  ]);
  for (const frame of flow(socket)) expect(frame).not.toHaveProperty("step");
});

test("a control the wall got twice is answered STALE: the clock this browser has is right, and nothing is said", async () => {
  vi.useFakeTimers();
  const socket = await enter();
  const clock = { rev: 1, endsAt: SERVER_NOW + 5 * MINUTE, leftMs: null };
  socket.tell(hiddenSync([person(ME, "Anna", "admin")], { clock }));
  useWall.getState().setClock({ type: "pause" });
  const [pause] = flow(socket) as Array<{ opId: string }>;
  // the line drops before the answer: the next connection sends the control again
  socket.drop();
  const next = await reconnected();
  expect(flow(next)).toEqual([pause]);
  // the wall had taken the first one: its snapshot holds the paused clock, and the second is stale
  const paused = { rev: 2, endsAt: null, leftMs: 4 * MINUTE };
  next.tell(hiddenSync([person(ME, "Anna", "admin")], { clock: paused, seq: 1 }));
  next.tell({ type: "reject", opId: pause!.opId, code: "STALE" });
  expect(useWall.getState().rejected).toBeNull();
  expect(useWall.getState().state.clock).toEqual(paused);

  // a control that went out once and is stale was overtaken by somebody else's: that is said
  useWall.getState().setClock({ type: "resume" });
  const resume = flow(next).at(-1) as { opId: string };
  next.tell({ type: "reject", opId: resume.opId, code: "STALE" });
  expect(useWall.getState().rejected).toEqual({ code: "STALE", command: "admin.clock.resume" });
  // answered, it is never sent again
  next.drop();
  const third = await reconnected();
  expect(flow(third)).toEqual([]);
});

test("a wall whose day is spent takes the change back and says when it goes on", async () => {
  const socket = await enter();
  socket.tell(sync([person(ME, "Anna")]));
  useWall.getState().send(create());
  expect(texts()).toEqual(["Weniger Termine"]);
  const resetsAt = SERVER_NOW + 3 * 60 * MINUTE;
  socket.tell({ type: "reject", opId: OP, code: "DAY_SPENT", resetsAt });
  expect(texts()).toEqual([]);
  expect(useWall.getState().rejected).toEqual({ code: "DAY_SPENT", command: "note.create", resetsAt });
});

test("a step of the flow dropped for the rate limit is said and never sent again", async () => {
  vi.useFakeTimers();
  const socket = await enter();
  socket.tell(hiddenSync([person(ME, "Anna", "admin")]));
  useWall.getState().goStep(1);
  socket.tell({ type: "error", code: "RATE_LIMIT" });
  expect(useWall.getState().rejected).toEqual({ code: "RATE_LIMIT", command: "admin.step.go" });
  // a reveal that went out by itself on a later connection would surprise everyone
  socket.drop();
  const next = await reconnected();
  expect(flow(next)).toEqual([]);
});
