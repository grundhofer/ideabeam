// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a wall costs. The free plan's limit that binds is rows written a day, for the whole account (PLAN.md 3.6),
// so a wall is played here against the real object in workerd and every row it writes is counted, by kind of
// action. After RetroBeam's cost.test.ts and FokusBeam's.
//
// Two walls are played, both with 8 people and 60 notes, through the whole flow: the moderation sets a clock,
// everybody writes hidden, the clock is paused, resumed and extended, the moderation reveals, groups are made by
// hand, the AI arranges the wall twice (the first arrangement is applied and taken back, the second applied), and
// notes are moved. The AI is the test's: what is counted is what the Worker's route and the wall write around it.
// They differ in how much is moved:
//
//  - the typical wall: about 200 movements. It has to stay at or under the plan's 400 rows written.
//  - the heavily dragged wall: 150 frames a person, the assumption of PLAN.md 3.6, which makes a good thousand
//    movements. It is counted and printed; nothing bounds it but the wall's brake (the owner's decision 11,
//    PLAN.md 7.2), under which it has to stay.
//
// The session's 45 minutes pass in seconds, so the test refills each socket's frame budget as the minutes would
// have.

import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  generateHexId,
  generateSessionKey,
  parseServerEvent,
  WALL_DAILY_ROWS,
  type ServerEvent,
} from "@ideabeam/shared";
import { dailyWalls, WALL_BUDGET_KEY } from "../src/rate-limiter.js";
import { limiterStub, newWall } from "../src/wall-stub.js";
import { applyOf, arrangeRoute, proposed, scriptedAi, wellBehaved } from "./arrange-helpers.js";
import { connect, resync, type Sync, type TestSocket } from "./helpers.js";

const PEOPLE = ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn", "Gül", "Hana"];
/** Notes on the wall at the end. A few more are written and deleted again. */
const NOTES = 60;
/** Written while the notes are hidden, and written after they were revealed. */
const NOTES_HIDDEN = 56;
const NOTES_OPEN = 8;
/** Deleted while hidden, and deleted after revealing. */
const DELETED_HIDDEN = 2;
const DELETED_OPEN = 2;
/** Texts changed while hidden, and after revealing. */
const TEXTS_HIDDEN = 32;
const TEXTS_OPEN = 8;
const GROUPS = 6;
/** How often the AI arranges the wall, and how many groups each arrangement makes. The first arrangement is taken
 *  back, the second stays. */
const RUNS = 2;
const ARRANGED = 4;
/** People who lose the line once and come back as the same person. */
const RECONNECTS = 4;
/** Every so many movements, one carries a whole selection instead of one note. */
const SELECTION_EVERY = 10;
const SELECTION_SIZE = 6;

/** The typical wall: how many movements it sees, hidden and revealed together. */
const MOVEMENTS_TYPICAL = 200;
/** The heavily dragged wall: frames a person, as PLAN.md 3.6 assumes. */
const FRAMES_HEAVY = 150;

/** The plan's target for a typical wall: rows written (PLAN.md 3.6). */
const ROWS_TARGET = 400;

type Kind =
  | "wall made"
  | "join"
  | "join again"
  | "admin.clock.start"
  | "admin.clock.pause"
  | "admin.clock.resume"
  | "admin.clock.extend"
  | "note.create, hidden"
  | "note.update, hidden"
  | "notes.move, hidden"
  | "note.delete, hidden"
  | "admin.step.go (reveal)"
  | "note.create"
  | "note.update"
  | "note.delete"
  | "group.create"
  | "group.update"
  | "group.delete"
  | "arrange (the route)"
  | "admin.arrange.apply"
  | "admin.arrange.undo"
  | "notes.move, one note"
  | "notes.move, a selection";

const MOVES: Kind[] = ["notes.move, hidden", "notes.move, one note", "notes.move, a selection"];

interface Count {
  frames: number;
  written: number;
  read: number;
}

interface Cost {
  kinds: Map<Kind, Count>;
  total: Count;
  /** Frames that moved notes, and the rows they wrote. */
  movements: number;
  moves: number;
  /** Notes and groups on the wall at the end. */
  notes: number;
  groups: number;
  /** The most frames one person sent, and the fewest. */
  framesPerPerson: [most: number, fewest: number];
  /** The number of the wall's last stored change at the end: what the wall's brake counts. */
  seq: number;
}

type Sink = (read: number, written: number) => void;

/** Wraps an object's SqlStorage so that every row it reads or writes is counted (the way RetroBeam's cost test does
 *  it: `readonly` is a compile-time notion). An object that is counted already, the limiter of the wall played
 *  before, counts for the new wall from now on. */
function counted(instance: unknown, onRows: Sink): void {
  const holder = instance as { sql: SqlStorage; sink?: Sink };
  const wrapped = holder.sink !== undefined;
  holder.sink = onRows;
  if (wrapped) return;
  const target = holder.sql;
  holder.sql = {
    exec: (query: string, ...bindings: unknown[]) => {
      const cursor = target.exec(query, ...bindings);
      const rows = cursor.toArray();
      holder.sink?.(cursor.rowsRead, cursor.rowsWritten);
      return {
        toArray: () => rows,
        one: () => {
          if (rows.length !== 1) throw new Error(`one() of ${rows.length} rows`);
          return rows[0];
        },
        [Symbol.iterator]: () => rows[Symbol.iterator](),
      } as unknown as ReturnType<SqlStorage["exec"]>;
    },
  } as unknown as SqlStorage;
}

const isCounted = (instance: unknown) => (instance as { sink?: Sink }).sink !== undefined;

/** How much a wall is moved: a number of movements, or as many as fill everybody's frames. */
type Moved = { movements: number } | { framesPerPerson: number };

async function playTheWall(moved: Moved): Promise<Cost> {
  const kinds = new Map<Kind, Count>();
  let current: Count = { frames: 0, written: 0, read: 0 };
  const during = (kind: Kind): Count => {
    current = kinds.get(kind) ?? { frames: 0, written: 0, read: 0 };
    kinds.set(kind, current);
    return current;
  };
  const onRows = (read: number, written: number) => {
    current.read += read;
    current.written += written;
  };

  // The wall is made the way the route makes it: one of the day's walls is taken (a row in the limiter), then the
  // object writes its tables, what it knows about itself, and its alarm. Both objects are counted from before. The
  // wall starts with hidden writing, as the route makes it when nothing else is asked.
  during("wall made").frames += 1;
  await runInDurableObject(limiterStub(env), (instance) => counted(instance, onRows));
  expect((await limiterStub(env).spendDaily(WALL_BUDGET_KEY, dailyWalls(env))).granted).toBe(true);
  expect(await runInDurableObject(limiterStub(env), isCounted), "the limiter was replaced on the way").toBe(true);
  const { wallId, stub } = newWall(env);
  const adminToken = "c".repeat(32);
  await runInDurableObject(stub, async (instance, state) => {
    counted(instance, onRows);
    const setAlarm = state.storage.setAlarm.bind(state.storage);
    state.storage.setAlarm = (...args: Parameters<typeof setAlarm>) => {
      current.written += 1; // an alarm that is set is a row written
      return setAlarm(...args);
    };
    await instance.initialize({ wallId, question: "What slows us down?", adminToken, hidden: true });
  });

  /** The session's minutes pass: every socket may send again as if it had waited. */
  const minutesPass = () =>
    runInDurableObject(stub, (_instance, state) => {
      for (const ws of state.getWebSockets()) {
        const attachment = { ...(ws.deserializeAttachment() as { budget?: unknown }) };
        delete attachment.budget;
        ws.serializeAttachment(attachment);
      }
    });

  interface Person {
    name: string;
    sessionKey: string;
    socket: TestSocket;
    you: string;
    frames: number;
    notes: string[];
  }

  /** A person's socket, joined. Every frame it sends is counted for the kind of action that is going on. */
  async function enter(kind: Kind, person: Pick<Person, "name" | "sessionKey">, token?: string) {
    during(kind);
    const socket = await connect(wallId);
    socket.send({
      type: "join",
      name: person.name,
      sessionKey: person.sessionKey,
      ...(token === undefined ? {} : { adminToken: token }),
    });
    current.frames += 1;
    const sync = (await socket.waitFor((event) => event.type === "sync")) as Sync;
    return { socket, you: sync.you.participantId };
  }

  /** One command, sent and answered before the next: so its rows are counted for its kind, and for nothing else.
   *  The answer is taken off the socket the moment it arrives: a thousand commands have no time to wait for a poll.
   *  `opId` is the operation's id where the script needs to know it: an arrangement is taken back under it. */
  async function does(
    person: Person,
    kind: Kind,
    command: Record<string, unknown>,
    opId = generateHexId(),
  ): Promise<void> {
    during(kind);
    const answered = new Promise<ServerEvent>((resolve, reject) => {
      const { ws } = person.socket;
      const onMessage = (message: MessageEvent) => {
        const event = parseServerEvent(message.data);
        if (event === null || (event.type !== "ack" && event.type !== "reject") || event.opId !== opId) return;
        ws.removeEventListener("message", onMessage);
        resolve(event);
      };
      ws.addEventListener("message", onMessage);
      ws.addEventListener("close", () => reject(new Error(`${kind}: the socket closed before the answer came`)));
    });
    person.socket.send({ ...command, opId });
    person.frames += 1;
    current.frames += 1;
    const said = await answered;
    // every command of the script is taken: none is refused, by the rules or by the wall's brake
    expect(said.type, `${kind}: ${JSON.stringify(said)}`).toBe("ack");
  }

  // Everybody comes in.
  const people: Person[] = [];
  for (const name of PEOPLE) {
    const sessionKey = generateSessionKey();
    const joined = await enter("join", { name, sessionKey }, name === "Anna" ? adminToken : undefined);
    people.push({ name, sessionKey, ...joined, frames: 1, notes: [] });
  }
  const moderation = people[0] as Person;
  const each = async (turn: (person: Person, index: number) => Promise<void>) => {
    for (const [index, person] of people.entries()) await turn(person, index);
    await minutesPass();
  };

  // A place for the next thing, a new one every time: no movement goes to where its note already lies.
  let step = 0;
  const place = () => {
    step += 1;
    return { x: (step * 37) % 4000, y: (step * 91) % 3000 };
  };
  const write = (person: Person, kind: Kind, n: number) => {
    const noteId = generateHexId();
    person.notes.push(noteId);
    return does(person, kind, {
      type: "note.create",
      noteId,
      text: `${person.name} thinks that point ${n + 1} is what slows the team down most.`,
      ...place(),
    });
  };
  const reword = (person: Person, kind: Kind, n: number) =>
    does(person, kind, {
      type: "note.update",
      noteId: person.notes[n],
      text: `${person.name} thinks that point ${n + 1} slows the team down, on second thought.`,
    });

  // The writing, hidden: the moderation sets ten minutes, everybody writes their notes, corrects some of them and
  // puts one of their own somewhere else. The clock is paused for a question, goes on, and gets five minutes more.
  let clock = 0;
  const control = (type: string, more: object = {}) => {
    const command = { type, rev: clock, ...more };
    clock += 1;
    return does(moderation, type as Kind, command);
  };
  await control("admin.clock.start", { minutes: 10 });
  let movements = 0;
  for (let n = 0; n < NOTES_HIDDEN / PEOPLE.length; n++) {
    await each((person) => write(person, "note.create, hidden", n));
    if (n === 3) await control("admin.clock.pause");
  }
  await control("admin.clock.resume");
  for (let n = 0; n < TEXTS_HIDDEN / PEOPLE.length; n++) {
    await each((person) => reword(person, "note.update, hidden", n));
  }
  await each((person) => {
    movements += 1;
    return does(person, "notes.move, hidden", {
      type: "notes.move",
      moves: [{ noteId: person.notes[0], ...place(), groupId: null }],
    });
  });
  await control("admin.clock.extend");
  // A few notes turn out to be doubles of one's own and go.
  for (const person of people.slice(0, DELETED_HIDDEN)) {
    await does(person, "note.delete, hidden", { type: "note.delete", noteId: person.notes.pop() });
  }

  // Revealing: everybody gets the notes of everybody else.
  await does(moderation, "admin.step.go (reveal)", { type: "admin.step.go", from: 0, to: 1 });
  await minutesPass();

  // Half of the people lose the line once and come back.
  for (const person of people.slice(0, RECONNECTS)) {
    person.socket.ws.close(1000, "line lost");
    Object.assign(person, await enter("join again", person));
    person.frames += 1;
  }
  await minutesPass();

  // Reading brings a few late notes and corrections, and doubles of somebody else's go.
  for (const person of people.slice(0, NOTES_OPEN)) await write(person, "note.create", NOTES_HIDDEN / PEOPLE.length);
  for (const person of people.slice(0, TEXTS_OPEN)) await reword(person, "note.update", 5);
  for (const person of people.slice(-DELETED_OPEN)) {
    await does(person, "note.delete", { type: "note.delete", noteId: person.notes.pop() });
  }
  await minutesPass();

  // A few groups: made, named, put where they belong; one is given up again.
  const groups: string[] = [];
  for (const person of people.slice(0, GROUPS)) {
    const groupId = generateHexId();
    groups.push(groupId);
    await does(person, "group.create", { type: "group.create", groupId, title: "", ...place(), w: 900, h: 700 });
    await does(person, "group.update", { type: "group.update", groupId, title: `Theme of ${person.name}` });
    await does(person, "group.update", { type: "group.update", groupId, ...place(), w: 1200 });
  }
  await does(people[GROUPS] as Person, "group.delete", { type: "group.delete", groupId: groups.pop() });
  await minutesPass();

  // „Ordnen“, twice: the moderation asks the Worker for a proposal and applies it with the product's layout; the
  // first arrangement does not convince and is taken back, the second stays. A run is a request to the Worker's
  // route, which reads the wall once and writes the counter of the AI's budget twice; applying and taking back are
  // frames of the moderation. To lay a proposal out, a browser has the wall in hand: the test asks for a snapshot,
  // and what that reads is counted for nothing.
  const snapshot = async () => {
    const counting = current;
    current = { frames: 0, written: 0, read: 0 };
    moderation.socket.send({ type: "resync" });
    const sync = (await moderation.socket.waitForNext((event) => event.type === "sync")) as Sync;
    current = counting;
    return sync;
  };
  const ai = scriptedAi(wellBehaved(["Meetings", "Tools", "People", "Planning"].slice(0, ARRANGED)));
  for (let run = 1; run <= RUNS; run++) {
    during("arrange (the route)").frames += 1;
    const { proposal } = await proposed(await arrangeRoute(wallId, adminToken, { ai }));
    expect(proposal.groups).toHaveLength(ARRANGED);
    const command = applyOf(proposal, await snapshot());
    await does(moderation, "admin.arrange.apply", command, command.opId);
    if (run < RUNS) {
      await does(moderation, "admin.arrange.undo", { type: "admin.arrange.undo", runId: command.opId });
    }
    await minutesPass();
  }

  // Moving, for the rest of the session: one note at a time, into a group, out of it, somewhere else; and now and
  // then a whole selection at once. Everybody moves anybody's notes.
  const allNotes = people.flatMap((person) => person.notes);
  const target = (n: number) => groups[n % (groups.length + 2)] ?? null; // some movements lead out of every group
  const goesOn = (person: Person) =>
    "movements" in moved ? movements < moved.movements : person.frames < moved.framesPerPerson;
  while (people.some(goesOn)) {
    for (let burst = 0; burst < 15; burst++) {
      for (const person of people) {
        if (!goesOn(person)) continue;
        movements += 1;
        const selection = movements % SELECTION_EVERY === 0;
        const moves = Array.from({ length: selection ? SELECTION_SIZE : 1 }, (_, i) => ({
          noteId: allNotes[(movements * 7 + i) % allNotes.length],
          ...place(),
          groupId: target(movements + i),
        }));
        await does(person, selection ? "notes.move, a selection" : "notes.move, one note", {
          type: "notes.move",
          moves,
        });
      }
    }
    await minutesPass();
  }

  // What the wall holds at the end, asked through a socket like any browser asks. The question is the test's, not
  // the wall's: what it reads is counted for nothing.
  current = { frames: 0, written: 0, read: 0 };
  moderation.socket.send({ type: "resync" });
  const end = (await moderation.socket.waitForNext((event) => event.type === "sync")) as Sync;
  expect(end).toMatchObject({ step: 1, reach: 1, hidden: 0 });

  // the counters are worth nothing if the object was replaced on the way
  expect(await runInDurableObject(stub, isCounted), "the wall's object was replaced on the way").toBe(true);

  const total: Count = { frames: 0, written: 0, read: 0 };
  for (const count of kinds.values()) {
    total.frames += count.frames;
    total.written += count.written;
    total.read += count.read;
  }
  const frames = people.map((person) => person.frames);
  return {
    kinds,
    total,
    movements,
    moves: MOVES.reduce((rows, kind) => rows + (kinds.get(kind)?.written ?? 0), 0),
    notes: end.notes.length,
    groups: end.groups.length,
    framesPerPerson: [Math.max(...frames), Math.min(...frames)],
    seq: end.seq,
  };
}

function table(title: string, cost: Cost): string {
  const row = (kind: string, count: Count) =>
    `${kind.padEnd(26)}${String(count.frames).padStart(7)}${String(count.written).padStart(9)}${String(count.read).padStart(9)}`;
  const withoutMoves = cost.total.written - cost.moves;
  return [
    `${title}: ${PEOPLE.length} people, ${cost.notes} notes, ${cost.movements} movements`,
    `${"".padEnd(26)}${"frames".padStart(7)}${"written".padStart(9)}${"read".padStart(9)}`,
    ...[...cost.kinds].map(([kind, count]) => row(kind, count)),
    row("all of it", cost.total),
    `rows written: ${cost.total.written}, of them ${cost.moves} for its movements and ${withoutMoves} for everything else`,
    `the plan's target for a typical wall is ${ROWS_TARGET} rows: beside everything else that is room for ${ROWS_TARGET - withoutMoves} movements`,
    `the wall's brake is ${WALL_DAILY_ROWS} rows a day, counted as stored changes: this wall stored ${cost.seq}`,
  ].join("\n");
}

describe("what a wall costs", { timeout: 120_000 }, () => {
  // each played once, looked at by the tests below
  let playedTypical: Promise<Cost> | undefined;
  let playedHeavy: Promise<Cost> | undefined;
  const typical = () => (playedTypical ??= playTheWall({ movements: MOVEMENTS_TYPICAL }));
  const heavy = () => (playedHeavy ??= playTheWall({ framesPerPerson: FRAMES_HEAVY }));

  const of = (cost: Cost, kind: Kind) => cost.kinds.get(kind) ?? { frames: 0, written: 0, read: 0 };
  /** The frames that were commands: everything but making the wall, coming in, and asking the Worker for a
   *  proposal. */
  const commands = (cost: Cost) =>
    cost.total.frames -
    of(cost, "wall made").frames -
    of(cost, "join").frames -
    of(cost, "join again").frames -
    of(cost, "arrange (the route)").frames;

  it(`the typical wall, with about ${MOVEMENTS_TYPICAL} movements, stays at or under ${ROWS_TARGET} rows written`, async () => {
    const cost = await typical();
    // eslint-disable-next-line no-console -- the one test whose job is to say what it measured
    console.log(table("the typical wall", cost));
    expect(cost.notes).toBe(NOTES);
    // the groups made by hand, and the ones the arrangement that stayed made
    expect(cost.groups).toBe(GROUPS - 1 + ARRANGED);
    expect(cost.movements).toBe(MOVEMENTS_TYPICAL);
    expect(cost.total.written).toBeLessThanOrEqual(ROWS_TARGET);
  });

  it(`the heavily dragged wall, with ${FRAMES_HEAVY} frames a person, is counted and stays under the wall's brake`, async () => {
    const cost = await heavy();
    // eslint-disable-next-line no-console -- the one test whose job is to say what it measured
    console.log(table("the heavily dragged wall", cost));
    expect(cost.notes).toBe(NOTES);
    expect(cost.groups).toBe(GROUPS - 1 + ARRANGED);
    expect(cost.framesPerPerson).toEqual([FRAMES_HEAVY, FRAMES_HEAVY]);
    // all frames, the request that made the wall, and the requests that asked for a proposal
    expect(cost.total.frames - 1 - RUNS).toBe(PEOPLE.length * FRAMES_HEAVY);
    // PLAN.md 3.6 measured 1,061 movements for this wall in stage 2; the flow of stage 3 takes a few of its frames
    expect(cost.movements).toBeGreaterThan(1000);
    // No command of it was refused (does() holds that), and the brake is not near: what it counts is the number of
    // the wall's last stored change.
    expect(cost.seq).toBeLessThan(WALL_DAILY_ROWS);
    // every command a number, revealing two, and each of the three arrangements as many as the rows it wrote
    expect(cost.seq).toBe(commands(cost) + 1 + (2 * RUNS - 1) * (ARRANGED + 1));
  });

  it("every command writes the rows the model says, and none of them pays for a counter", async () => {
    for (const cost of [await typical(), await heavy()]) {
      const perFrame = (kind: Kind) => of(cost, kind).written / of(cost, kind).frames;

      // One row for a note written, for a text changed, for a group made or changed; one row for a movement, whether
      // it moves one note or a selection; two for a delete (the row that goes, and the layout row). Hidden or
      // revealed, a command writes the same: hiding is decided where the frames are built, and costs no row.
      for (const kind of ["note.update, hidden", "notes.move, hidden", "note.create", "note.update"] as const) {
        expect(perFrame(kind), kind).toBe(1);
      }
      for (const kind of ["notes.move, one note", "notes.move, a selection", "group.create", "group.update"] as const) {
        expect(perFrame(kind), kind).toBe(1);
      }
      for (const kind of ["note.delete, hidden", "note.delete", "group.delete"] as const) {
        expect(perFrame(kind), kind).toBe(2);
      }
      // The first change of the wall's day writes the day's mark for the brake, once: one row beside its own.
      expect(of(cost, "note.create, hidden").written).toBe(of(cost, "note.create, hidden").frames + 1);
      // Every control of the clock is one row, and so is revealing: the step and the clock stand in one row.
      for (const kind of [
        "admin.clock.start",
        "admin.clock.pause",
        "admin.clock.resume",
        "admin.clock.extend",
        "admin.step.go (reveal)",
      ] as const) {
        expect(of(cost, kind), kind).toMatchObject({ frames: 1, written: 1 });
      }
      // Somebody new is a row and its key's index; somebody who comes back is nothing.
      expect(perFrame("join")).toBe(2);
      expect(of(cost, "join again").written).toBe(0);
      // Making the wall: the day's budget (1), five tables (11), what the wall knows about itself (8: its agenda
      // among it, since stage M1 of the methods), the alarm (1).
      expect(of(cost, "wall made").written).toBe(21);

      // „Ordnen“. A run writes two rows, both the counter's: the estimate that is reserved, and what the run cost
      // in its place. The wall is read for it and writes nothing.
      expect(of(cost, "arrange (the route)")).toMatchObject({ frames: RUNS, written: 2 * RUNS });
      // Applying writes a row for each group it makes and two more however many notes it moves: the layout row,
      // and what the wall remembers of the run. Taking it back writes a row for each group that goes, the layout
      // row, and the row of what was remembered, which goes too.
      expect(of(cost, "admin.arrange.apply")).toMatchObject({ frames: RUNS, written: RUNS * (ARRANGED + 2) });
      expect(of(cost, "admin.arrange.undo")).toMatchObject({ frames: RUNS - 1, written: (RUNS - 1) * (ARRANGED + 2) });

      // Every command of this wall changed something and took one number; revealing took two, for its two frames;
      // an arrangement, applied or taken back, took as many as the rows it wrote, so that the wall's brake counts
      // it by what it costs. Nothing on top: the number of a change travels in the row the change writes
      // (wall-room.ts, currentSeq()).
      const arrangements = 2 * RUNS - 1;
      expect(cost.seq).toBe(commands(cost) + 1 + arrangements * (ARRANGED + 1));
      const deletes = DELETED_HIDDEN + DELETED_OPEN + 1;
      // what arranging writes beyond one row a command: the counter's rows, and the groups and the second layout row
      const arranging = 2 * RUNS + arrangements * (ARRANGED + 1);
      expect(cost.total.written).toBe(21 + 2 * PEOPLE.length + 1 + commands(cost) + deletes + arranging);
    }
  });

  it("everything but the movements is the same for both walls, and leaves the typical wall room for 200 of them", async () => {
    const [light, dragged] = [await typical(), await heavy()];
    const withoutMoves = light.total.written - light.moves;
    expect(dragged.total.written - dragged.moves).toBe(withoutMoves);
    expect(withoutMoves + 200, `without its movements a wall writes ${withoutMoves} rows`).toBeLessThanOrEqual(
      ROWS_TARGET,
    );
  });

  it("reads no more than a join's snapshot and a look per command explain", async () => {
    // Measured 2026-11-22: see the tables this file prints. The bounds are loose: a canary for a change that makes
    // a command read the whole wall, not a benchmark. While the notes are hidden a change is told to the others as
    // a count, and that count is carried on their sockets: telling it reads no row.
    expect((await heavy()).total.read).toBeLessThanOrEqual(25_000);
    expect((await typical()).total.read).toBeLessThanOrEqual(10_000);
  });
});

// A vote (stage M2 of the methods, PLAN-METHODEN.md 5): „Still sammeln“ with 8 people goes from its grouping into its
// vote, everybody casts a ballot, one person changes theirs and one sends the same ballot twice, and the moderation
// counts. Counted are the rows the vote adds to the method: the step move into it, the ballots (the first of them
// makes the table of ballots) and the counting. The acceptance of M2: at most 15 rows.
describe("what a vote costs", { timeout: 60_000 }, () => {
  /** The acceptance of M2: rows written a vote with 8 people. */
  const VOTE_ROWS = 15;

  it(`a vote with ${PEOPLE.length} people writes at most ${VOTE_ROWS} rows`, async () => {
    const { wallId, stub } = newWall(env);
    const adminToken = "d".repeat(32);
    await runInDurableObject(stub, (instance) =>
      instance.initialize({ wallId, question: "What slows us down?", adminToken, hidden: true }),
    );
    const sockets: TestSocket[] = [];
    for (const name of PEOPLE) {
      const socket = await connect(wallId);
      socket.send({
        type: "join",
        name,
        sessionKey: generateSessionKey(),
        ...(name === "Anna" ? { adminToken } : {}),
      });
      await socket.waitFor((event) => event.type === "sync");
      sockets.push(socket);
    }
    const said = async (socket: TestSocket, command: Record<string, unknown>) => {
      const opId = generateHexId();
      socket.send({ ...command, opId });
      const answer = await socket.waitFor(
        (event) => (event.type === "ack" || event.type === "reject") && event.opId === opId,
      );
      expect(answer.type, JSON.stringify(answer)).toBe("ack");
    };
    const moderation = sockets[0] as TestSocket;
    // twelve notes, revealed, grouped: no group yet, so the options are the notes and the budget three points
    const notes: string[] = [];
    for (let n = 0; n < 12; n++) {
      const noteId = generateHexId();
      notes.push(noteId);
      await said(sockets[n % sockets.length] as TestSocket, {
        type: "note.create",
        noteId,
        text: `Point ${n + 1}`,
        x: n * 10,
        y: 0,
      });
    }
    await said(moderation, { type: "admin.step.go", from: 0, to: 1 });
    await said(moderation, { type: "admin.step.go", from: 1, to: 2 });

    // from here on every row is counted
    const rows = { step: 0, ballots: 0, count: 0 };
    let into: keyof typeof rows = "step";
    await runInDurableObject(stub, (instance) =>
      counted(instance, (_read, written) => {
        rows[into] += written;
      }),
    );
    await said(moderation, { type: "admin.step.go", from: 2, to: 3 });
    into = "ballots";
    for (const [n, socket] of sockets.entries()) {
      await said(socket, { type: "ballot.cast", step: 3, ballot: { kind: "dots", points: { [notes[n]!]: 3 } } });
    }
    // one person changes their mind, one sends the same ballot again
    await said(sockets[1] as TestSocket, {
      type: "ballot.cast",
      step: 3,
      ballot: { kind: "dots", points: { [notes[0]!]: 2, [notes[5]!]: 1 } },
    });
    await said(sockets[2] as TestSocket, {
      type: "ballot.cast",
      step: 3,
      ballot: { kind: "dots", points: { [notes[2]!]: 3 } },
    });
    into = "count";
    await said(moderation, { type: "admin.step.count", step: 3 });
    expect(await runInDurableObject(stub, isCounted), "the wall's object was replaced on the way").toBe(true);

    const total = rows.step + rows.ballots + rows.count;
    // eslint-disable-next-line no-console -- the one test whose job is to say what it measured
    console.log(
      [
        `a vote with ${PEOPLE.length} people (9 ballots sent, 1 of them the same again):`,
        `  into the step ${rows.step}, ballots ${rows.ballots}, counting ${rows.count}: ${total} rows written`,
      ].join("\n"),
    );
    // the step move is one row, as every step move; the result and the flow are two
    expect(rows.step).toBe(1);
    expect(rows.count).toBe(2);
    // a row a ballot, the changed one written over, the same one again nothing; and the table, once: two rows, as
    // every table the wall makes
    expect(rows.ballots).toBe(PEOPLE.length + 1 + 2);
    expect(total).toBeLessThanOrEqual(VOTE_ROWS);
  });
});

// Estimating in rounds (stage M3 of the methods, PLAN-METHODEN.md 5): „Schätzen – Diskutieren – Schätzen“ with 8
// people from its first estimate to its result. Everybody estimates and writes a reason, one person changes their
// estimate and one sends the same one twice; the moderation counts, reveals the reasons, goes on to the discussion
// and to the second round, everybody estimates again, the moderation counts and shows the result. Counted are the
// rows of the method itself, after everybody has joined. The lead's bound for M3: about 30 rows for the two rounds;
// the reasons are notes and cost what notes cost, so they are counted apart.
describe("what estimating in two rounds costs", { timeout: 60_000 }, () => {
  /** The two rounds with 8 people, without the reasons: ballots, counting and the step moves. */
  const ROUNDS_ROWS = 30;

  it(`two rounds with ${PEOPLE.length} people write at most ${ROUNDS_ROWS} rows, and a row a reason`, async () => {
    const { wallId, stub } = newWall(env);
    const adminToken = "e".repeat(32);
    await runInDurableObject(stub, (instance) =>
      instance.initialize({
        wallId,
        question: "How many days does the move take?",
        adminToken,
        hidden: true,
        agenda: { items: [{ methodId: "schaetzen", unit: "days" }] },
      }),
    );
    const sockets: TestSocket[] = [];
    for (const name of PEOPLE) {
      const socket = await connect(wallId);
      socket.send({
        type: "join",
        name,
        sessionKey: generateSessionKey(),
        ...(name === "Anna" ? { adminToken } : {}),
      });
      await socket.waitFor((event) => event.type === "sync");
      sockets.push(socket);
    }
    const said = async (socket: TestSocket, command: Record<string, unknown>) => {
      const opId = generateHexId();
      socket.send({ ...command, opId });
      const answer = await socket.waitFor(
        (event) => (event.type === "ack" || event.type === "reject") && event.opId === opId,
      );
      expect(answer.type, JSON.stringify(answer)).toBe("ack");
    };
    const moderation = sockets[0] as TestSocket;
    const estimate = (step: number, value: number) => ({
      type: "ballot.cast",
      step,
      ballot: { kind: "estimate", value },
    });

    // from here on every row is counted
    const rows = { ballots: 0, reasons: 0, count: 0, steps: 0 };
    let into: keyof typeof rows = "ballots";
    await runInDurableObject(stub, (instance) =>
      counted(instance, (_read, written) => {
        rows[into] += written;
      }),
    );
    for (const [n, socket] of sockets.entries()) {
      into = "ballots";
      await said(socket, estimate(0, 20 + n * 5));
      into = "reasons";
      await said(socket, { type: "note.create", noteId: generateHexId(), text: `Reason ${n + 1}`, x: n * 260, y: 0 });
    }
    into = "ballots";
    // one person changes their mind, one sends the same estimate again
    await said(sockets[1] as TestSocket, estimate(0, 31));
    await said(sockets[2] as TestSocket, estimate(0, 30));
    into = "count";
    await said(moderation, { type: "admin.step.count", step: 0 });
    into = "steps";
    await said(moderation, { type: "admin.step.go", from: 0, to: 1 });
    await said(moderation, { type: "admin.step.go", from: 1, to: 2 });
    await said(moderation, { type: "admin.step.go", from: 2, to: 3 });
    into = "ballots";
    for (const [n, socket] of sockets.entries()) await said(socket, estimate(3, 30 + n));
    into = "count";
    await said(moderation, { type: "admin.step.count", step: 3 });
    into = "steps";
    await said(moderation, { type: "admin.step.go", from: 3, to: 4 });
    expect(await runInDurableObject(stub, isCounted), "the wall's object was replaced on the way").toBe(true);

    const total = rows.ballots + rows.count + rows.steps;
    // eslint-disable-next-line no-console -- the one test whose job is to say what it measured
    console.log(
      [
        `two rounds of estimates with ${PEOPLE.length} people (17 estimates sent, 1 of them the same again):`,
        `  estimates ${rows.ballots}, counting ${rows.count}, step moves ${rows.steps}: ${total} rows written;`,
        `  and ${rows.reasons} rows for ${PEOPLE.length} reasons: ${total + rows.reasons} in all`,
      ].join("\n"),
    );
    // a row an estimate, the changed one written over, the same one again nothing; the table once, two rows; and the
    // mark of the wall's day for its brake, which the first change of the wall writes (here the first estimate)
    expect(rows.ballots).toBe(2 * PEOPLE.length + 1 + 2 + 1);
    // each counting the result and the flow; each step move one row
    expect(rows.count).toBe(4);
    expect(rows.steps).toBe(4);
    expect(rows.reasons).toBe(PEOPLE.length);
    expect(total).toBeLessThanOrEqual(ROUNDS_ROWS);
  });
});

// Pairs and small groups (stage M4 of the methods, PLAN-METHODEN.md 5): „1-2-4-Alle“ with 8 people from the clock of
// its first step to its presenting. The moderation starts the clock; everybody writes a note alone; the time runs out
// and the alarm moves the wall into the pairs, which it forms (the teams' row beside the flow); everybody writes a
// note in the pair; the moderation swaps two people; the time runs out and the alarm merges the pairs into fours;
// everybody writes a note; the time runs out and the alarm moves the wall into the presenting. Counted are the rows of
// the method after everybody has joined, the alarms that are set among them (a set alarm is a row written). The
// acceptance of M4: at most 60 rows.
describe("what 1-2-4-Alle costs", { timeout: 60_000 }, () => {
  /** The acceptance of M4: rows written by one run of 1-2-4-Alle with 8 people. */
  const RUN_ROWS = 60;

  it(`one run with ${PEOPLE.length} people writes at most ${RUN_ROWS} rows`, async () => {
    const { wallId, stub } = newWall(env);
    const adminToken = "f".repeat(32);
    await runInDurableObject(stub, (instance) =>
      instance.initialize({
        wallId,
        question: "How do we onboard faster?",
        adminToken,
        hidden: true,
        agenda: { items: [{ methodId: "eins-zwei-vier" }] },
      }),
    );
    const sockets: TestSocket[] = [];
    for (const name of PEOPLE) {
      const socket = await connect(wallId);
      socket.send({
        type: "join",
        name,
        sessionKey: generateSessionKey(),
        ...(name === "Anna" ? { adminToken } : {}),
      });
      await socket.waitFor((event) => event.type === "sync");
      sockets.push(socket);
    }
    const said = async (socket: TestSocket, command: Record<string, unknown>) => {
      const opId = generateHexId();
      socket.send({ ...command, opId });
      const answer = await socket.waitFor(
        (event) => (event.type === "ack" || event.type === "reject") && event.opId === opId,
      );
      expect(answer.type, JSON.stringify(answer)).toBe("ack");
    };
    const moderation = sockets[0] as TestSocket;
    /** The time of the step runs out: its clock ends in the past, and the alarm rings. */
    const timeIsUp = async (step: number) => {
      await runInDurableObject(stub, (instance) => {
        // read and written past the counting: the test's own doing, not the wall's
        const sql = (instance as unknown as { sql: SqlStorage }).sql;
        const flow = JSON.parse(String(sql.exec("SELECT value FROM meta WHERE key = 'flow'").one().value)) as {
          clock: { endsAt: number | null };
        };
        flow.clock.endsAt = Date.now() - 1000;
        const was = into;
        into = "test";
        sql.exec("UPDATE meta SET value = ? WHERE key = 'flow'", JSON.stringify(flow));
        into = was;
      });
      expect(await runDurableObjectAlarm(stub)).toBe(true);
      await moderation.waitFor((event) => event.type === "step.changed" && event.step === step);
    };
    const notes = async (stage: string) => {
      for (const [n, socket] of sockets.entries()) {
        await said(socket, {
          type: "note.create",
          noteId: generateHexId(),
          text: `${stage} ${n}`,
          x: n * 260,
          y: 1300,
        });
      }
    };

    // from here on every row is counted
    const rows = { clock: 0, notes: 0, steps: 0, swap: 0, test: 0 };
    let into: keyof typeof rows = "clock";
    await runInDurableObject(stub, (instance, state) => {
      counted(instance, (_read, written) => {
        rows[into] += written;
      });
      const setAlarm = state.storage.setAlarm.bind(state.storage);
      state.storage.setAlarm = (...args: Parameters<typeof setAlarm>) => {
        rows[into] += 1; // an alarm that is set is a row written
        return setAlarm(...args);
      };
    });
    await said(moderation, { type: "admin.clock.start", rev: 0, minutes: 1 });
    into = "notes";
    await notes("alone");
    into = "steps";
    await timeIsUp(1);
    into = "notes";
    await notes("pair");
    into = "swap";
    const sync = (await (async () => {
      moderation.send({ type: "resync" });
      return moderation.waitForNext((event) => event.type === "sync");
    })()) as Sync;
    const teams = sync.teams?.members as string[][];
    const [a, b] = [teams[0]?.[0] as string, teams[1]?.[0] as string];
    await said(moderation, {
      type: "admin.teams.set",
      rev: sync.teams?.rev,
      teams: teams.map((team) => team.map((id) => (id === a ? b : id === b ? a : id))),
    });
    into = "steps";
    await timeIsUp(2);
    into = "notes";
    await notes("four");
    into = "steps";
    await timeIsUp(3);
    expect(await runInDurableObject(stub, isCounted), "the wall's object was replaced on the way").toBe(true);

    const total = rows.clock + rows.notes + rows.steps + rows.swap;
    // eslint-disable-next-line no-console -- the one test whose job is to say what it measured
    console.log(
      [
        `1-2-4-Alle with ${PEOPLE.length} people (${3 * PEOPLE.length} notes, 1 swap, 3 steps by the alarm):`,
        `  clock ${rows.clock}, notes ${rows.notes}, steps ${rows.steps}, swap ${rows.swap}: ${total} rows written`,
      ].join("\n"),
    );
    // the clock and its alarm; a row a note and the mark of the wall's day once; into the pairs and into the fours
    // the flow, the teams, the alarm and the layout row (the notes moved into their writers' teams' areas: into the
    // pairs those written alone, into the fours those of the person who was swapped and the test's notes written
    // outside their area); into the presenting the flow and the alarm back on the wall's last day
    expect(rows.clock).toBe(2);
    expect(rows.notes).toBe(3 * PEOPLE.length + 1);
    expect(rows.steps).toBe(4 + 4 + 2);
    expect(rows.swap).toBe(1);
    expect(total).toBeLessThanOrEqual(RUN_ROWS);
  });
});

/** A wall of the method with everybody on it, the rows counted from here on, by what the run does (the methods of
 *  stages M5 and M6). */
async function run(methodId: string) {
  const { wallId, stub } = newWall(env);
  const adminToken = "a".repeat(32);
  await runInDurableObject(stub, (instance) =>
    instance.initialize({
      wallId,
      question: "What do we learn from it?",
      adminToken,
      hidden: true,
      agenda: { items: [{ methodId: methodId as "ideenrunde" }] },
    }),
  );
  const sockets: TestSocket[] = [];
  for (const name of PEOPLE) {
    const socket = await connect(wallId);
    socket.send({
      type: "join",
      name,
      sessionKey: generateSessionKey(),
      ...(name === "Anna" ? { adminToken } : {}),
    });
    await socket.waitFor((event) => event.type === "sync");
    sockets.push(socket);
  }
  const moderation = sockets[0] as TestSocket;
  const rows: Record<string, number> = {};
  let into = "steps";
  await runInDurableObject(stub, (instance, state) => {
    counted(instance, (_read, written) => {
      rows[into] = (rows[into] ?? 0) + written;
    });
    const setAlarm = state.storage.setAlarm.bind(state.storage);
    state.storage.setAlarm = (...args: Parameters<typeof setAlarm>) => {
      rows[into] = (rows[into] ?? 0) + 1; // an alarm that is set is a row written
      return setAlarm(...args);
    };
  });
  const said = async (socket: TestSocket, kind: string, command: Record<string, unknown>) => {
    into = kind;
    const opId = generateHexId();
    socket.send({ ...command, opId });
    const answer = await socket.waitFor(
      (event) => (event.type === "ack" || event.type === "reject") && event.opId === opId,
    );
    expect(answer.type, JSON.stringify(answer)).toBe("ack");
  };
  let step = 0;
  const next = () => said(moderation, "steps", { type: "admin.step.go", from: step, to: (step += 1) });
  /** A note of each of the first `count` people, in turn, as long as `notes` says; the note ids. */
  const notes = async (stage: string, count: number) => {
    const ids: string[] = [];
    for (let n = 0; n < count; n++) {
      const noteId = generateHexId();
      ids.push(noteId);
      await said(sockets[n % sockets.length] as TestSocket, "notes", {
        type: "note.create",
        noteId,
        text: `${stage} ${n}`,
        x: (n % 8) * 260,
        y: 1300,
      });
    }
    return ids;
  };
  const total = () => Object.values(rows).reduce((sum, value) => sum + value, 0);
  const done = async (line: string) => {
    expect(await runInDurableObject(stub, isCounted), "the wall's object was replaced on the way").toBe(true);
    const parts = Object.entries(rows).map(([kind, value]) => `${kind} ${value}`);
    // eslint-disable-next-line no-console -- the one test whose job is to say what it measured
    console.log(`${line}:\n  ${parts.join(", ")}: ${total()} rows written`);
    return total();
  };
  return { moderation, sockets, said, next, notes, rows, done };
}

// The methods of stage M5 (PLAN-METHODEN.md 5, „Paket A“), each with 8 people from its first step to its last.
// Counted are the rows of the method after everybody has joined, the alarms that are set among them included (a set
// alarm is a row written; these methods start no clock of their own). The lead's bound for M5: about 60 rows each
// for 8 people. Notes cost a row each, so each line says how many it writes; a wall with more notes costs a row more
// for each, and a step that reveals by turn a row more for each note it shows.
describe("what the methods of stage M5 cost", { timeout: 60_000 }, () => {
  /** The lead's bound for M5: rows written by one run of a method with 8 people. */
  const METHOD_ROWS = 60;

  it(`„Stille Ideenrunde mit Rangfolge“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const { moderation, sockets, said, next, notes, rows, done } = await run("ideenrunde");
    const ideas = await notes("idea", 2 * PEOPLE.length);
    await next(); // reveal by turn
    for (let shown = 0; shown < ideas.length; shown++) {
      await said(moderation, "turns", { type: "admin.turn.next", step: 1, shown });
    }
    await next(); // clarify
    await next(); // rank
    for (const [n, socket] of sockets.entries()) {
      const order = [0, 1, 2, 3, 4].map((k) => ideas[(n + k) % ideas.length] as string);
      await said(socket, "ballots", { type: "ballot.cast", step: 3, ballot: { kind: "rank", order } });
    }
    await said(moderation, "count", { type: "admin.step.count", step: 3 });
    await next(); // result
    const total = await done(`„Stille Ideenrunde“ with ${PEOPLE.length} people (16 ideas, 16 turns, 8 rankings)`);
    // a row a note and the mark of the wall's day; a row a turn; four step moves; a row a ranking and the table;
    // counting the result and the flow
    expect(rows.notes).toBe(2 * PEOPLE.length + 1);
    expect(rows.turns).toBe(2 * PEOPLE.length);
    expect(rows.steps).toBe(4);
    expect(rows.ballots).toBe(PEOPLE.length + 2);
    expect(rows.count).toBe(2);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });

  it(`„Scheitern vorwegdenken“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const { moderation, said, next, notes, rows, done } = await run("scheitern");
    await next(); // write the reasons
    const reasons = await notes("reason", 2 * PEOPLE.length);
    await next(); // reveal by turn
    for (let shown = 0; shown < reasons.length; shown++) {
      await said(moderation, "turns", { type: "admin.turn.next", step: 2, shown });
    }
    await next(); // group into risks
    const groups: string[] = [];
    for (let n = 0; n < 3; n++) {
      const groupId = generateHexId();
      groups.push(groupId);
      await said(moderation, "risks", {
        type: "group.create",
        groupId,
        title: `Risk ${n + 1}`,
        x: n * 600,
        y: 0,
        w: 528,
        h: 400,
      });
    }
    await said(moderation, "risks", {
      type: "notes.move",
      moves: reasons.map((noteId, n) => ({ noteId, x: (n % 3) * 600 + 16, y: 40, groupId: groups[n % 3] })),
    });
    await next(); // adjust the plan
    const changes = await notes("change", 3);
    for (const noteId of changes) {
      await said(moderation, "actions", { type: "note.action", noteId, action: { who: "Anna", due: "Friday" } });
    }
    const total = await done(
      `„Scheitern vorwegdenken“ with ${PEOPLE.length} people (16 reasons, 16 turns, 3 risks, 3 changes agreed)`,
    );
    expect(rows.notes).toBe(2 * PEOPLE.length + 3 + 1);
    expect(rows.turns).toBe(2 * PEOPLE.length);
    expect(rows.steps).toBe(4);
    expect(rows.actions).toBe(3);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });

  it(`„Rückblick nach Ziel und Daten“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const { moderation, sockets, said, next, notes, rows, done } = await run("rueckblick");
    await notes("goal", 4);
    await next(); // data
    await notes("data", PEOPLE.length);
    await next(); // reveal
    await next(); // reasons, in small groups
    await notes("reason", 4);
    await next(); // present and bundle
    await next(); // propose actions
    const actions = await notes("action", PEOPLE.length);
    await next(); // reveal the actions
    await next(); // vote on them
    for (const [n, socket] of sockets.entries()) {
      await said(socket, "ballots", {
        type: "ballot.cast",
        step: 7,
        ballot: { kind: "dots", points: { [actions[n % 3] as string]: 2 } },
      });
    }
    await said(moderation, "count", { type: "admin.step.count", step: 7 });
    await next(); // agree on up to three
    for (const noteId of actions.slice(0, 3)) {
      await said(moderation, "actions", { type: "note.action", noteId, action: { who: "Ben", due: "next sprint" } });
    }
    const total = await done(
      `„Rückblick nach Ziel und Daten“ with ${PEOPLE.length} people (24 notes, 8 ballots, 3 actions agreed)`,
    );
    expect(rows.notes).toBe(4 + PEOPLE.length + 4 + PEOPLE.length + 1);
    // eight step moves, into the small groups the teams beside the flow (the notes there are seen by everybody
    // already, so none moves into an area and the layout row is not written)
    expect(rows.steps).toBe(8 + 1);
    expect(rows.ballots).toBe(PEOPLE.length + 2);
    expect(rows.count).toBe(2);
    expect(rows.actions).toBe(3);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });

  it(`„Was? Na und? Was nun?“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const { next, notes, rows, done } = await run("was-na-und");
    for (const round of ["what", "soWhat", "nowWhat"]) {
      await notes(`${round} alone`, PEOPLE.length);
      await next(); // into the small groups
      await notes(`${round} group`, 2);
      await next(); // the small groups present
      if (round !== "nowWhat") await next(); // the next round
    }
    const total = await done(
      `„Was? Na und? Was nun?“ with ${PEOPLE.length} people (3 rounds of 8 notes alone and 2 a round in the groups)`,
    );
    expect(rows.notes).toBe(3 * (PEOPLE.length + 2) + 1);
    // eight step moves; into each round's small groups the teams and the layout row beside the flow
    expect(rows.steps).toBe(8 + 3 * 2);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });
});

// The methods of stage M6 (PLAN-METHODEN.md 5, „Paket B“), each with 8 people from its first step to its last, counted
// as those of stage M5 are. The lead's bound: about 60 rows each for 8 people. A note, a ballot, a step move, a group,
// a movement and a record of the moderation cost a row each; each line says how many of them it plays.
describe("what the methods of stage M6 cost", { timeout: 60_000 }, () => {
  /** The lead's bound for M6: rows written by one run of a method with 8 people. */
  const METHOD_ROWS = 60;

  /** Everybody scores the options of step `step` on `width` criteria, and the moderation counts. */
  async function scoreAll(
    { sockets, said, moderation }: Awaited<ReturnType<typeof run>>,
    step: number,
    options: string[],
    width: number,
  ) {
    for (const [n, socket] of sockets.entries()) {
      const scores = Object.fromEntries(
        options.map((id, at) => [id, Array.from({ length: width }, () => 1 + ((n + at) % 5))]),
      );
      await said(socket, "ballots", { type: "ballot.cast", step, ballot: { kind: "score", scores } });
    }
    await said(moderation, "count", { type: "admin.step.count", step });
  }

  it(`„Kriterienbewertung“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const played = await run("kriterien");
    const { moderation, said, next, notes, rows, done } = played;
    await notes("criterion", PEOPLE.length);
    await next(); // agree on the criteria
    await next(); // the options
    const options = await notes("option", 4);
    await next(); // score
    await scoreAll(played, 3, options, 5);
    await next(); // discuss
    await next(); // the overall judgement
    const [judgement] = await notes("judgement", 1);
    await said(moderation, "records", {
      type: "note.action",
      noteId: judgement,
      action: { who: "", due: "", why: "The best total" },
    });
    const total = await done(
      `„Kriterienbewertung“ with ${PEOPLE.length} people (8 criteria, 4 options, 8 scores, 1 decision recorded)`,
    );
    expect(rows.notes).toBe(PEOPLE.length + 4 + 1 + 1);
    expect(rows.steps).toBe(5);
    expect(rows.ballots).toBe(PEOPLE.length + 2);
    expect(rows.count).toBe(2);
    expect(rows.records).toBe(1);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });

  it(`„Nutzen und Aufwand“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const played = await run("nutzen-aufwand");
    const { moderation, said, next, notes, rows, done } = played;
    const options = await notes("option", 6);
    await next(); // score
    await scoreAll(played, 1, options, 2);
    await next(); // discuss
    await next(); // the overall judgement
    const [judgement] = await notes("judgement", 1);
    await said(moderation, "records", { type: "note.action", noteId: judgement, action: { who: "", due: "" } });
    const total = await done(`„Nutzen und Aufwand“ with ${PEOPLE.length} people (6 options, 8 scores, 1 decision)`);
    expect(rows.notes).toBe(6 + 1 + 1);
    expect(rows.steps).toBe(3);
    expect(rows.ballots).toBe(PEOPLE.length + 2);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });

  it(`„Gegenposition prüfen“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const { moderation, said, next, notes, rows, done } = await run("gegenposition");
    await next(); // the doubts
    await notes("doubt", PEOPLE.length);
    await next(); // the two teams with their roles
    await notes("role", 6);
    await next(); // present
    await next(); // bring together
    const decisions = await notes("decision", 3);
    for (const noteId of decisions) {
      await said(moderation, "records", { type: "note.action", noteId, action: { who: "", due: "", why: "Holds" } });
    }
    const total = await done(
      `„Gegenposition prüfen“ with ${PEOPLE.length} people (8 doubts, 6 notes in the teams, 3 decisions recorded)`,
    );
    expect(rows.notes).toBe(PEOPLE.length + 6 + 3 + 1);
    // four step moves; into the teams the teams and the layout row (the doubts move into the areas) beside the flow
    expect(rows.steps).toBe(4 + 2);
    expect(rows.records).toBe(3);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });

  it(`„Entscheidungsprotokoll mit Zustimmungsrunde“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const { moderation, sockets, said, next, notes, rows, done } = await run("entscheidung");
    await next(); // the proposal
    await notes("proposal", 1);
    await next(); // questions
    await next(); // reactions
    await notes("reaction", PEOPLE.length);
    await next(); // the consent round
    for (const [n, socket] of sockets.entries()) {
      const ballot =
        n === 1
          ? { kind: "consent", answer: "object", reason: "Too expensive" }
          : { kind: "consent", answer: n % 2 === 0 ? "agree" : "live" };
      await said(socket, "ballots", { type: "ballot.cast", step: 4, ballot });
    }
    await said(moderation, "count", { type: "admin.step.count", step: 4 });
    await next(); // work in the objections
    await next(); // record the decision
    const [decision] = await notes("decision", 1);
    await said(moderation, "records", {
      type: "note.action",
      noteId: decision,
      action: { who: "", due: "1 June", why: "Safe enough", open: "The price" },
    });
    const total = await done(
      `„Entscheidungsprotokoll“ with ${PEOPLE.length} people (1 proposal, 8 reactions, 8 answers, 1 decision recorded)`,
    );
    expect(rows.notes).toBe(1 + PEOPLE.length + 1 + 1);
    expect(rows.steps).toBe(6);
    expect(rows.ballots).toBe(PEOPLE.length + 2);
    expect(rows.count).toBe(2);
    expect(rows.records).toBe(1);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });

  it(`„Annahmen prüfen“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows, the five fields made with the wall included`, async () => {
    const played = await run("annahmen");
    const { moderation, sockets, said, next, rows, done } = played;
    const fields = (await resync(moderation)).groups.map((group) => group.id);
    // two assumptions a person, each put into a field with one movement of the person's own notes
    const assumptions: string[] = [];
    for (const [n, socket] of sockets.entries()) {
      const own: string[] = [];
      for (const k of [0, 1]) {
        const noteId = generateHexId();
        own.push(noteId);
        await said(socket, "notes", { type: "note.create", noteId, text: `assumption ${n} ${k}`, x: 0, y: 3000 });
      }
      await said(socket, "fields", {
        type: "notes.move",
        moves: own.map((noteId, k) => ({ noteId, x: 16 + k * 260, y: 40, groupId: fields[(n + k) % fields.length] })),
      });
      assumptions.push(...own);
    }
    await next(); // reveal and bundle
    await next(); // rate
    await scoreAll(played, 2, assumptions, 2);
    await next(); // discuss the riskiest
    await next(); // tests in small groups
    const tests: string[] = [];
    for (let n = 0; n < 3; n++) {
      const noteId = generateHexId();
      tests.push(noteId);
      await said(sockets[n * 3] as TestSocket, "notes", {
        type: "note.create",
        noteId,
        text: `test ${n}`,
        x: 16,
        y: 1300,
      });
    }
    await next(); // present and agree on the tests
    for (const noteId of tests) {
      await said(moderation, "records", { type: "note.action", noteId, action: { who: "Ben", due: "Friday" } });
    }
    const counted = await done(
      `„Annahmen prüfen“ with ${PEOPLE.length} people (16 assumptions, 8 movements into the fields, 8 scores, 3 tests agreed)`,
    );
    // the five fields are written when the wall is made, before the count above begins: one row each
    const total = counted + fields.length;
    // eslint-disable-next-line no-console -- the one test whose job is to say what it measured
    console.log(`  and ${fields.length} rows for the fields when the wall is made: ${total} rows written`);
    expect(fields).toHaveLength(5);
    expect(rows.notes).toBe(2 * PEOPLE.length + 3 + 1);
    expect(rows.fields).toBe(PEOPLE.length);
    // five step moves; into the small groups the teams beside the flow (the assumptions are seen by everybody, none
    // moves into an area)
    expect(rows.steps).toBe(5 + 1);
    expect(rows.records).toBe(3);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });

  it(`„Ziele mit messbaren Ergebnissen“ with ${PEOPLE.length} people writes at most ${METHOD_ROWS} rows`, async () => {
    const { moderation, sockets, said, next, notes, rows, done } = await run("ziele");
    await next(); // the goals
    const goals = await notes("goal", PEOPLE.length);
    await next(); // reveal and bundle into three
    const groups: string[] = [];
    for (let n = 0; n < 3; n++) {
      const groupId = generateHexId();
      groups.push(groupId);
      await said(moderation, "bundles", {
        type: "group.create",
        groupId,
        title: `Goal ${n + 1}`,
        x: n * 600,
        y: 0,
        w: 528,
        h: 400,
      });
    }
    await said(moderation, "bundles", {
      type: "notes.move",
      moves: goals.map((noteId, n) => ({ noteId, x: (n % 3) * 600 + 16, y: 40, groupId: groups[n % 3] })),
    });
    await next(); // pick up to three
    for (const [n, socket] of sockets.entries()) {
      await said(socket, "ballots", {
        type: "ballot.cast",
        step: 3,
        ballot: { kind: "approval", chosen: [groups[n % 3] as string, groups[(n + 1) % 3] as string] },
      });
    }
    await said(moderation, "count", { type: "admin.step.count", step: 3 });
    await next(); // results in small groups
    const results = await notes("result", 6);
    await next(); // present
    await next(); // agree
    for (const [n, noteId] of results.entries()) {
      await said(moderation, "records", {
        type: "note.action",
        noteId,
        action: { who: "Cem", due: "March", target: "from 3 to 1", goal: groups[n % 3] },
      });
    }
    const total = await done(
      `„Ziele mit messbaren Ergebnissen“ with ${PEOPLE.length} people (8 goals, 3 bundles, 8 ballots, 6 results recorded)`,
    );
    expect(rows.notes).toBe(PEOPLE.length + 6 + 1);
    expect(rows.bundles).toBe(3 + 1);
    // six step moves; into the small groups the teams beside the flow
    expect(rows.steps).toBe(6 + 1);
    expect(rows.ballots).toBe(PEOPLE.length + 2);
    expect(rows.records).toBe(6);
    expect(total).toBeLessThanOrEqual(METHOD_ROWS);
  });
});
