// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Hidden writing and revealing (PLAN.md 2.1, 3.4). While a wall is in `writing`, a person gets their own notes and
// of everybody else's a number; the moderation reveals, once and for good. Who may see and do what is decided by
// the shared rules (packages/shared/test/rules.test.ts, visibility.test.ts); here the whole way is tested, and at
// the level of frames: what a socket really received, text for text, not what a browser would make of it.
//
// The last part holds the claim the browser's reducer rests on: for every person, the frames of a connection build
// the same wall as a fresh snapshot. After RetroBeam's symmetry test (retrobeam 3401467,
// apps/worker/test/symmetry.test.ts); there the numbers of the frames have holes and are left out of the comparison,
// here they have none and are compared.

import { evictAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { applyServerEvent, generateHexId, initialWallState, type ServerEvent, type WallState } from "@ideabeam/shared";
import {
  answer,
  ask,
  createHiddenWall,
  createWall,
  join,
  resync,
  settle,
  stubOf,
  type Sync,
  type TestSocket,
} from "./helpers.js";

type Person = Awaited<ReturnType<typeof join>>;

const ofType = <T extends ServerEvent["type"]>(events: ServerEvent[], type: T) =>
  events.filter((event): event is Extract<ServerEvent, { type: T }> => event.type === type);

/** A wall in hidden writing with its admin Anna and two members, Ben and Cem. */
async function wall() {
  const { wallId, adminToken } = await createHiddenWall();
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  const cem = await join(wallId, "Cem");
  return { wallId, adminToken, anna, ben, cem };
}

/** A note of this socket's person. */
async function write(socket: TestSocket, text: string, x = 0, y = 0): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(socket, { type: "note.create", noteId, text, x, y })).toBe("ack");
  return noteId;
}

const reveal = (socket: TestSocket) => answer(socket, { type: "admin.phase.set", phase: "open" });

/** Every socket may send again as if minutes had passed: a test asks for more snapshots than a person would. */
function refill(wallId: string): Promise<void> {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    for (const ws of state.getWebSockets()) {
      const attachment = { ...(ws.deserializeAttachment() as { budget?: unknown }) };
      delete attachment.budget;
      ws.serializeAttachment(attachment);
    }
  });
}

/** What a frame holds beside the people on the wall: their ids stand in a snapshot's list of people and in the
 *  frames about coming and going, and must stand nowhere else. */
function withoutPeople(frame: string): string {
  // the heartbeat's answer is no JSON, and says nothing
  if (!frame.startsWith("{")) return frame;
  const parsed: unknown = JSON.parse(frame);
  if (parsed === null || typeof parsed !== "object") return frame;
  const type = (parsed as { type?: string }).type ?? "";
  if (["presence.join", "presence.leave", "roster.updated", "participant.removed"].includes(type)) return "{}";
  return JSON.stringify({ ...parsed, participants: [], you: null });
}

/** Holds that none of the frames a socket received says anything about somebody else's hidden notes. `secrets` is
 *  what must not be in any of them: texts, note ids, places. `people` are the ids of the others: they may stand
 *  where people are listed, and nowhere near a note. */
function expectNoLeak(socket: TestSocket, secrets: string[], people: string[], label: string): void {
  expect(socket.raw.length, label).toBeGreaterThan(0);
  for (const frame of socket.raw) {
    for (const secret of secrets) expect(frame, `${label}: a frame holds "${secret}"`).not.toContain(secret);
    expect(frame, label).not.toContain("authorId");
    const content = withoutPeople(frame);
    for (const person of people) expect(content, `${label}: a frame about notes names a person`).not.toContain(person);
  }
}

describe("while the notes are hidden", () => {
  it("a note reaches its writer, and everybody else a number: no text, no id, no place, no writer", async () => {
    const { anna, ben, cem } = await wall();
    expect(ben.sync).toMatchObject({ phase: "writing", hidden: 0, notes: [] });

    const noteId = generateHexId();
    const text = "Anna's secret thought";
    const said = await answer(anna.socket, { type: "note.create", noteId, text, x: 31337, y: -27182 });
    expect(said).toMatchObject({ type: "ack", seq: 1 });

    expect(await anna.socket.waitFor((event) => event.type === "note.created")).toMatchObject({
      seq: 1,
      note: { id: noteId, mine: true, text, x: 31337, y: -27182 },
    });
    for (const other of [ben, cem]) {
      // the same number, and the count: that is the whole frame
      expect(await other.socket.waitFor((event) => event.type === "wall.occupancy")).toEqual({
        type: "wall.occupancy",
        seq: 1,
        hidden: 1,
      });
      expect(other.socket.raw.at(-1)).toBe('{"type":"wall.occupancy","seq":1,"hidden":1}');
    }
    await settle();
    expect(ofType(ben.socket.events, "note.created")).toEqual([]);
    expect(ofType(anna.socket.events, "wall.occupancy")).toEqual([]);

    // a snapshot says the same as the stream: Anna has her note, the others a number
    expect(await resync(anna.socket)).toMatchObject({ seq: 1, hidden: 0, notes: [{ id: noteId, mine: true, text }] });
    expect(await resync(ben.socket)).toMatchObject({ seq: 1, hidden: 1, notes: [] });
    expectNoLeak(ben.socket, [text, noteId, '"x":31337', '"y":-27182'], [anna.you], "Ben");
    expectNoLeak(cem.socket, [text, noteId, '"x":31337', '"y":-27182'], [anna.you], "Cem");
    // the check can fail: Anna's own frames hold all of it
    expect(anna.socket.raw.some((frame) => frame.includes(text) && frame.includes('"x":31337'))).toBe(true);
  });

  it("the count is each person's own: the notes of all the others, never one's own", async () => {
    const { anna, ben, cem } = await wall();
    await write(anna.socket, "Anna 1");
    await write(anna.socket, "Anna 2");
    await write(ben.socket, "Ben 1");
    await settle();
    expect(ofType(anna.socket.events, "wall.occupancy").map((event) => event.hidden)).toEqual([1]);
    expect(ofType(ben.socket.events, "wall.occupancy").map((event) => event.hidden)).toEqual([1, 2]);
    expect(ofType(cem.socket.events, "wall.occupancy").map((event) => event.hidden)).toEqual([1, 2, 3]);
    expect((await resync(anna.socket)).hidden).toBe(1);
    expect((await resync(ben.socket)).hidden).toBe(2);
    expect((await resync(cem.socket)).hidden).toBe(3);
  });

  it("a text changed, a note moved and a note deleted reach the others as numbers too: the count says what is left", async () => {
    const { anna, ben } = await wall();
    const noteId = await write(anna.socket, "First wording");
    const other = await write(anna.socket, "A second note");
    expect(await ask(anna.socket, { type: "note.update", noteId, text: "Second wording" })).toBe("ack");
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId, x: 4242, y: 2424, groupId: null }] })).toBe(
      "ack",
    );
    expect(await answer(anna.socket, { type: "note.delete", noteId })).toMatchObject({ type: "ack", seq: 5 });
    await settle();

    // Anna heard what she did
    const told = (event: ServerEvent) => "seq" in event && event.type !== "ack" && event.type !== "sync";
    expect(anna.socket.events.flatMap((event) => (told(event) ? [event.type] : []))).toEqual([
      "note.created",
      "note.created",
      "note.updated",
      "notes.moved",
      "note.deleted",
    ]);
    // Ben heard five numbers without a hole, and the count
    expect(ofType(ben.socket.events, "wall.occupancy")).toEqual([
      { type: "wall.occupancy", seq: 1, hidden: 1 },
      { type: "wall.occupancy", seq: 2, hidden: 2 },
      { type: "wall.occupancy", seq: 3, hidden: 2 },
      { type: "wall.occupancy", seq: 4, hidden: 2 },
      { type: "wall.occupancy", seq: 5, hidden: 1 },
    ]);
    expect(await resync(ben.socket)).toMatchObject({ seq: 5, hidden: 1, notes: [] });
    expect(await resync(anna.socket)).toMatchObject({ seq: 5, hidden: 0, notes: [{ id: other }] });
    expectNoLeak(
      ben.socket,
      ["First wording", "Second wording", "A second note", noteId, other, '"x":4242', '"y":2424'],
      [anna.you],
      "Ben",
    );
  });

  it("nobody touches a note of somebody else, the moderation included: to a command it is not on the wall", async () => {
    const { anna, ben, cem } = await wall();
    const noteId = await write(ben.socket, "Ben's own", 7, 7);
    for (const other of [cem, anna]) {
      // the answers a note that does not exist would get: none of them says that this one is there
      const ghost = generateHexId();
      for (const id of [noteId, ghost]) {
        expect(await ask(other.socket, { type: "note.update", noteId: id, text: "Mine now" })).toBe("NOT_FOUND");
        expect(await ask(other.socket, { type: "note.delete", noteId: id })).toBe("ack");
        expect(
          await ask(other.socket, { type: "notes.move", moves: [{ noteId: id, x: 1, y: 1, groupId: null }] }),
        ).toBe("ack");
      }
    }
    await settle();
    // nothing happened: one stored change, the note as Ben wrote it
    expect(await resync(ben.socket)).toMatchObject({
      seq: 1,
      notes: [{ id: noteId, mine: true, text: "Ben's own", x: 7, y: 7 }],
    });
    expect(ofType(ben.socket.events, "wall.occupancy")).toEqual([]);
  });

  it("a movement takes the sender's own notes and leaves out the others'", async () => {
    const { anna, ben } = await wall();
    const annas = await write(anna.socket, "Anna's");
    const bens = await write(ben.socket, "Ben's");
    const moves = [
      { noteId: annas, x: 50, y: 60, groupId: null },
      { noteId: bens, x: 70, y: 80, groupId: null },
    ];
    expect(await ask(ben.socket, { type: "notes.move", moves })).toBe("ack");
    expect(await ben.socket.waitFor((event) => event.type === "notes.moved")).toMatchObject({
      moves: [{ noteId: bens, x: 70, y: 80, groupId: null }],
    });
    expect((await resync(anna.socket)).notes).toMatchObject([{ id: annas, x: 0, y: 0 }]);
  });

  it("has no groups yet: a command about one is refused, and the answer says that it is the phase", async () => {
    const { anna, ben } = await wall();
    const groupId = generateHexId();
    for (const person of [anna, ben]) {
      expect(await ask(person.socket, { type: "group.create", groupId, title: "", x: 0, y: 0, w: 600, h: 400 })).toBe(
        "PHASE",
      );
      expect(await ask(person.socket, { type: "group.update", groupId, title: "Later" })).toBe("PHASE");
      expect(await ask(person.socket, { type: "group.delete", groupId })).toBe("PHASE");
    }
    expect(await resync(ben.socket)).toMatchObject({ seq: 0, groups: [] });
  });

  it("a newcomer and a second tab get the person's own notes and the count, nothing of the others", async () => {
    const { wallId, anna, ben } = await wall();
    await write(anna.socket, "Anna's secret thought");
    const bens = await write(ben.socket, "Ben's own");

    const dora = await join(wallId, "Dora");
    expect(dora.sync).toMatchObject({ phase: "writing", seq: 2, hidden: 2, notes: [] });
    const tab = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(tab.sync).toMatchObject({ seq: 2, hidden: 1, notes: [{ id: bens, mine: true }] });

    // what Ben writes in one tab reaches his other tab as the note, and Dora as a number
    const more = await write(ben.socket, "Ben's second");
    expect(await tab.socket.waitFor((event) => event.type === "note.created")).toMatchObject({
      seq: 3,
      note: { id: more, mine: true },
    });
    expect(await dora.socket.waitFor((event) => event.type === "wall.occupancy")).toEqual({
      type: "wall.occupancy",
      seq: 3,
      hidden: 3,
    });
    expectNoLeak(dora.socket, ["secret", "Ben's"], [anna.you, ben.you], "Dora");
    expectNoLeak(tab.socket, ["secret"], [anna.you], "Ben's second tab");
  });

  it("a person who has the wall forget them leaves notes that stay hidden, and are nobody's", async () => {
    const { wallId, anna, ben } = await wall();
    const noteId = await write(ben.socket, "Ben's, soon nobody's");
    expect(await ask(ben.socket, { type: "me.erase" })).toBe("ack");
    await anna.socket.waitFor((event) => event.type === "participant.removed");

    // back as a new person: the note is not theirs any more, so they do not get it either
    const back = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(back.sync).toMatchObject({ hidden: 1, notes: [] });
    expect(await ask(back.socket, { type: "note.update", noteId, text: "Mine again?" })).toBe("NOT_FOUND");
    expect((await resync(anna.socket)).hidden).toBe(1);

    // revealed, it is there for everyone and theirs for no one
    expect((await reveal(anna.socket)).type).toBe("ack");
    for (const person of [anna, back]) {
      expect((await resync(person.socket)).notes).toMatchObject([{ id: noteId, mine: false }]);
    }
    expect(await ask(back.socket, { type: "note.delete", noteId })).toBe("NOT_AUTHOR");
    expect(await ask(anna.socket, { type: "note.delete", noteId })).toBe("ack");
  });
});

describe("revealing", () => {
  it("is the moderation's alone", async () => {
    const { anna, ben } = await wall();
    await write(anna.socket, "Anna's secret thought");
    expect(await ask(ben.socket, { type: "admin.phase.set", phase: "open" })).toBe("NOT_ADMIN");
    await settle();
    expect(await resync(ben.socket)).toMatchObject({ phase: "writing", hidden: 1, notes: [] });
  });

  it("brings every browser the notes it did not have, and then the phase: two frames, two numbers", async () => {
    const { anna, ben, cem } = await wall();
    const a1 = await write(anna.socket, "Anna 1", 10, 10);
    const b1 = await write(ben.socket, "Ben 1", 20, 20);
    const a2 = await write(anna.socket, "Anna 2", 30, 30);
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId: a1, x: 11, y: 12, groupId: null }] })).toBe(
      "ack",
    );

    expect(await reveal(anna.socket)).toMatchObject({ type: "ack", seq: 6 });
    const got = async (person: Person) => {
      const revealed = await person.socket.waitFor((event) => event.type === "notes.revealed");
      const changed = await person.socket.waitFor((event) => event.type === "phase.changed");
      expect(changed).toEqual({ type: "phase.changed", seq: 6, phase: "open" });
      // the notes come first, the phase after them
      expect(person.socket.events.indexOf(revealed)).toBeLessThan(person.socket.events.indexOf(changed));
      return revealed;
    };
    // each gets what they did not have, in the order the notes were made, at the place they lie now, as nobody's
    expect(await got(anna)).toMatchObject({ seq: 5, notes: [{ id: b1, mine: false, text: "Ben 1", x: 20, y: 20 }] });
    expect(await got(ben)).toMatchObject({
      seq: 5,
      notes: [
        { id: a1, mine: false, text: "Anna 1", x: 11, y: 12 },
        { id: a2, mine: false, text: "Anna 2", x: 30, y: 30 },
      ],
    });
    expect(await got(cem)).toMatchObject({ seq: 5, notes: [{ id: a1 }, { id: b1 }, { id: a2 }] });

    // the snapshot holds the same for each, and says for each which notes are their own
    for (const [person, mine] of [
      [anna, [true, false, true]],
      [ben, [false, true, false]],
      [cem, [false, false, false]],
    ] as const) {
      const sync = await resync(person.socket);
      expect(sync).toMatchObject({ phase: "open", hidden: 0, seq: 6 });
      expect(sync.notes.map((note) => note.id)).toEqual([a1, b1, a2]);
      expect(sync.notes.map((note) => note.mine)).toEqual(mine);
    }
    // revealed is not named: no frame says whose a note is, also now
    for (const person of [anna, ben, cem]) {
      const others = [anna, ben, cem].filter((other) => other !== person).map((other) => other.you);
      expectNoLeak(person.socket, [], others, person.sync.participants.at(-1)?.name ?? "");
    }
  });

  it("of a wall nobody else wrote on brings an empty frame: both numbers are counted by every browser", async () => {
    const { anna, ben } = await wall();
    await write(anna.socket, "Anna alone");
    expect(await reveal(anna.socket)).toMatchObject({ type: "ack", seq: 3 });
    expect(await anna.socket.waitFor((event) => event.type === "notes.revealed")).toEqual({
      type: "notes.revealed",
      seq: 2,
      notes: [],
    });
    expect(await ben.socket.waitFor((event) => event.type === "notes.revealed")).toMatchObject({
      seq: 2,
      notes: [{ text: "Anna alone", mine: false }],
    });
  });

  it("happens once and is never taken back: sent again it changes nothing, and nothing asks for hidden writing", async () => {
    const { anna, ben } = await wall();
    await write(ben.socket, "Ben's");
    expect(await reveal(anna.socket)).toMatchObject({ type: "ack", seq: 3 });
    // the same command again: an ack with the number the wall stands at, nothing told
    expect(await reveal(anna.socket)).toMatchObject({ type: "ack", seq: 3 });
    expect(await ask(ben.socket, { type: "admin.phase.set", phase: "open" })).toBe("NOT_ADMIN");
    // there is no command that hides again
    expect(await ask(anna.socket, { type: "admin.phase.set", phase: "writing" })).toBe("INVALID");
    await settle();
    expect(ofType(ben.socket.events, "phase.changed")).toHaveLength(1);
    expect(ofType(ben.socket.events, "notes.revealed")).toHaveLength(1);
    expect(await resync(ben.socket)).toMatchObject({ phase: "open", seq: 3 });
  });

  it("opens the wall: notes reach everyone, anybody moves any note, groups can be made", async () => {
    const { anna, ben, cem } = await wall();
    const bens = await write(ben.socket, "Ben's");
    expect((await reveal(anna.socket)).type).toBe("ack");

    const groupId = generateHexId();
    expect(await ask(cem.socket, { type: "group.create", groupId, title: "Now", x: 0, y: 0, w: 600, h: 400 })).toBe(
      "ack",
    );
    expect(await ask(cem.socket, { type: "notes.move", moves: [{ noteId: bens, x: 16, y: 48, groupId }] })).toBe("ack");
    expect(await ben.socket.waitFor((event) => event.type === "notes.moved")).toMatchObject({
      moves: [{ noteId: bens, x: 16, y: 48, groupId }],
    });
    const late = await write(cem.socket, "A late idea");
    expect(await ben.socket.waitFor((event) => event.type === "note.created" && event.note.id === late)).toMatchObject({
      note: { mine: false, text: "A late idea" },
    });
    // the text stays its writer's, deleting its writer's or the moderation's
    expect(await ask(anna.socket, { type: "note.update", noteId: bens, text: "Anna was here" })).toBe("NOT_AUTHOR");
    expect(await ask(cem.socket, { type: "note.delete", noteId: bens })).toBe("NOT_AUTHOR");
    expect(await ask(anna.socket, { type: "note.delete", noteId: bens })).toBe("ack");
    await settle();
    expect(ofType(ben.socket.events, "wall.occupancy")).toEqual([]);
  });

  it("a wall made without hidden writing is open from the start", async () => {
    const { wallId, adminToken } = await createWall();
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    expect(anna.sync).toMatchObject({ phase: "open", hidden: 0 });
    await write(anna.socket, "For all to see");
    expect(await ben.socket.waitFor((event) => event.type === "note.created")).toMatchObject({
      note: { text: "For all to see", mine: false },
    });
    expect(await reveal(anna.socket)).toMatchObject({ type: "ack", seq: 1 });
  });
});

// ───────────────────────── stream and snapshot ─────────────────────────

const fold = (events: readonly ServerEvent[], from: WallState = initialWallState) =>
  events.reduce(applyServerEvent, from);

/** The people are compared as a set: two who joined in the same millisecond stand in a snapshot by their id and in
 *  a stream in the order they came. Everything else is compared as it is, the order of the notes included. */
const comparable = (state: WallState) => ({
  ...state,
  participants: [...state.participants].sort((a, b) => a.id.localeCompare(b.id)),
});

/** Asks for a fresh snapshot and holds that the frames this connection got before it build the same wall. Every
 *  frame the wall had sent is delivered ahead of the snapshot it answers with, so the frames before the snapshot
 *  are exactly what this browser knew when the snapshot was built (RetroBeam's `expectConvergence`). */
async function expectSame(socket: TestSocket, label: string): Promise<Sync> {
  socket.send({ type: "resync" });
  const snapshot = (await socket.waitForNext((event) => event.type === "sync")) as Sync;
  const streamed = fold(socket.events.slice(0, socket.events.indexOf(snapshot)));
  expect(comparable(streamed), `stream and snapshot disagree for ${label}`).toEqual(comparable(fold([snapshot])));
  // and the stream had no hole: a hidden change still brought its number
  expect(streamed.gap, `${label} missed a number`).toBe(false);
  return snapshot;
}

describe("stream and snapshot", () => {
  /** A wall in the middle of its writing: three people, notes of each, texts changed, notes moved and deleted. */
  async function writing() {
    const people = await wall();
    const { anna, ben, cem } = people;
    const notes = {
      anna: [await write(anna.socket, "Anna: fewer meetings", 100, 100), await write(anna.socket, "Anna: no Fridays")],
      ben: [await write(ben.socket, "Ben: better coffee", 200, 200)],
      cem: [await write(cem.socket, "Cem: a quiet room", 300, 300), await write(cem.socket, "Cem: a double")],
    };
    expect(
      await ask(anna.socket, { type: "note.update", noteId: notes.anna[0], text: "Anna: far fewer meetings" }),
    ).toBe("ack");
    expect(
      await ask(ben.socket, { type: "notes.move", moves: [{ noteId: notes.ben[0], x: 250, y: 260, groupId: null }] }),
    ).toBe("ack");
    expect(await ask(cem.socket, { type: "note.delete", noteId: notes.cem.pop() })).toBe("ack");
    return { ...people, notes };
  }

  /** What nobody but its writer may get while the notes are hidden. */
  const SECRETS = { anna: ["Anna:", "fewer meetings", "no Fridays"], ben: ["Ben:", "coffee"], cem: ["Cem:", "quiet"] };

  it("build the same wall for every recipient while the notes are hidden", async () => {
    const { anna, ben, cem, notes } = await writing();
    const [forAnna, forBen, forCem] = [
      await expectSame(anna.socket, "the moderation in writing"),
      await expectSame(ben.socket, "a member in writing"),
      await expectSame(cem.socket, "another member in writing"),
    ];
    // and that wall is the person's own notes with a number for the rest
    expect(forAnna).toMatchObject({ phase: "writing", seq: 8, hidden: 2 });
    expect(forAnna.notes.map((note) => note.id)).toEqual(notes.anna);
    expect(forBen).toMatchObject({ seq: 8, hidden: 3 });
    expect(forBen.notes.map((note) => note.id)).toEqual(notes.ben);
    expect(forCem).toMatchObject({ seq: 8, hidden: 3 });
    expect(forCem.notes.map((note) => note.id)).toEqual(notes.cem);

    // frame for frame: nothing a person received holds a text, an id or a place of somebody else's note, or says
    // who wrote
    expectNoLeak(anna.socket, [...SECRETS.ben, ...SECRETS.cem, ...notes.ben, ...notes.cem], [ben.you, cem.you], "Anna");
    expectNoLeak(
      ben.socket,
      [...SECRETS.anna, ...SECRETS.cem, ...notes.anna, ...notes.cem],
      [anna.you, cem.you],
      "Ben",
    );
    expectNoLeak(
      cem.socket,
      [...SECRETS.anna, ...SECRETS.ben, ...notes.anna, ...notes.ben],
      [anna.you, ben.you],
      "Cem",
    );
    // of the others' changes a person got numbers only
    const types = new Set(ben.socket.events.map((event) => event.type));
    expect([...types].sort()).toEqual([
      "ack",
      "note.created",
      "notes.moved",
      "presence.join",
      "sync",
      "wall.occupancy",
    ]);
  });

  it("build the same wall across a reconnect in the middle of the writing: nothing is revealed, nothing is lost", async () => {
    const { wallId, anna, ben, cem, notes } = await writing();
    // Ben loses the line; the others write on
    ben.socket.ws.close(1000, "line lost");
    await anna.socket.waitFor((event) => event.type === "presence.leave");
    const more = await write(anna.socket, "Anna: written while Ben was away", 555, 666);
    expect(await ask(cem.socket, { type: "note.update", noteId: notes.cem[0], text: "Cem: a very quiet room" })).toBe(
      "ack",
    );

    const back = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(back.you).toBe(ben.you);
    // nothing lost: his note, where he moved it; nothing revealed: of the others a number
    expect(back.sync).toMatchObject({
      phase: "writing",
      seq: 10,
      hidden: 4,
      notes: [{ id: notes.ben[0], mine: true, text: "Ben: better coffee", x: 250, y: 260 }],
    });
    // and the new connection goes on in step: what comes after its snapshot builds the wall the next snapshot holds
    await write(anna.socket, "Anna: and one more");
    const own = await write(back.socket, "Ben: back again");
    expect(await ask(anna.socket, { type: "note.delete", noteId: more })).toBe("ack");
    const forBen = await expectSame(back.socket, "a member who came back in writing");
    expect(forBen).toMatchObject({ seq: 13, hidden: 4 });
    expect(forBen.notes.map((note) => note.id)).toEqual([notes.ben[0], own]);
    await expectSame(anna.socket, "the moderation, who stayed");

    const secrets = [...SECRETS.anna, ...SECRETS.cem, "while Ben was away", "one more", '"x":555', '"y":666'];
    expectNoLeak(back.socket, [...secrets, ...notes.anna, ...notes.cem, more], [anna.you, cem.you], "Ben, back");
    expectNoLeak(ben.socket, [...secrets, ...notes.anna, ...notes.cem, more], [anna.you, cem.you], "Ben, before");
  });

  it("build the same wall across an eviction of the object, on the sockets that stay open", async () => {
    const { wallId, anna, ben, cem, notes } = await writing();
    await evictAllDurableObjects();

    // the woken object still hides, still counts for each person, and still knows whose note is whose
    const more = await write(cem.socket, "Cem: after the eviction");
    expect(await ben.socket.waitFor((event) => event.type === "wall.occupancy" && event.seq === 9)).toEqual({
      type: "wall.occupancy",
      seq: 9,
      hidden: 4,
    });
    expect(await ask(ben.socket, { type: "note.update", noteId: more, text: "Mine now" })).toBe("NOT_FOUND");
    expect(await ask(ben.socket, { type: "note.update", noteId: notes.ben[0], text: "Ben: much better coffee" })).toBe(
      "ack",
    );
    await refill(wallId);
    expect(await expectSame(ben.socket, "a member after an eviction")).toMatchObject({ seq: 10, hidden: 4 });
    expect(await expectSame(anna.socket, "the moderation after an eviction")).toMatchObject({ seq: 10, hidden: 3 });
    expect(await expectSame(cem.socket, "the writer after an eviction")).toMatchObject({ seq: 10, hidden: 3 });
    expectNoLeak(ben.socket, [...SECRETS.anna, ...SECRETS.cem, more], [anna.you, cem.you], "Ben");

    // revealing after an eviction brings each what they did not have
    await evictAllDurableObjects();
    expect(await reveal(anna.socket)).toMatchObject({ type: "ack", seq: 12 });
    await refill(wallId);
    for (const [person, label] of [
      [ben, "a member"],
      [anna, "the moderation"],
      [cem, "another member"],
    ] as const) {
      const sync = await expectSame(person.socket, `${label} after revealing`);
      expect(sync).toMatchObject({ phase: "open", seq: 12, hidden: 0 });
      expect(sync.notes).toHaveLength(5);
    }
  });

  it("build the same wall through revealing and after it, with a clock that ran, for those who were there and a latecomer", async () => {
    const { wallId, anna, ben, cem, notes } = await writing();
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: 1 })).toBe("ack");
    await expectSame(ben.socket, "a member with a paused clock");
    expect(await ask(anna.socket, { type: "admin.clock.resume", rev: 2 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: 3 })).toBe("ack");

    expect(await reveal(anna.socket)).toMatchObject({ type: "ack", seq: 14 });
    await refill(wallId);
    const forBen = await expectSame(ben.socket, "a member after revealing");
    expect(forBen).toMatchObject({ phase: "open", hidden: 0, seq: 14, clock: { rev: 4, endsAt: null, leftMs: null } });
    expect(forBen.notes.map((note) => note.mine)).toEqual([false, false, true, false]);
    await expectSame(anna.socket, "the moderation after revealing");

    // the open wall: a group, a movement of somebody else's note, a late note, a delete by the moderation
    const groupId = generateHexId();
    expect(await ask(ben.socket, { type: "group.create", groupId, title: "Rooms", x: 0, y: 0, w: 900, h: 600 })).toBe(
      "ack",
    );
    expect(
      await ask(ben.socket, { type: "notes.move", moves: [{ noteId: notes.cem[0], x: 40, y: 40, groupId }] }),
    ).toBe("ack");
    await write(cem.socket, "Cem: a late idea");
    expect(await ask(anna.socket, { type: "note.delete", noteId: notes.anna[1] })).toBe("ack");
    await refill(wallId);
    for (const [person, label] of [
      [ben, "a member"],
      [anna, "the moderation"],
      [cem, "another member"],
    ] as const) {
      expect(await expectSame(person.socket, `${label} on the open wall`)).toMatchObject({ seq: 18 });
    }
    const dora = await join(wallId, "Dora");
    expect(await ask(dora.socket, { type: "group.update", groupId, title: "Quiet rooms" })).toBe("ack");
    const forDora = await expectSame(dora.socket, "a latecomer on the open wall");
    expect(forDora.notes.every((note) => !note.mine)).toBe(true);
    // also revealed, no frame says whose a note is
    expectNoLeak(ben.socket, [], [anna.you, cem.you], "Ben");
    expectNoLeak(dora.socket, [], [anna.you, ben.you, cem.you], "Dora");
  });

  it("the count a socket carries is the storage's: a socket that carries none gets it from there", async () => {
    const { wallId, anna, ben, cem } = await writing();
    // as if no socket had ever carried a count
    await runInDurableObject(stubOf(wallId), (_instance, state) => {
      for (const ws of state.getWebSockets()) {
        const attachment = { ...(ws.deserializeAttachment() as { hidden?: number }) };
        delete attachment.hidden;
        ws.serializeAttachment(attachment);
      }
    });
    await write(anna.socket, "Anna: one more");
    expect(await ben.socket.waitFor((event) => event.type === "wall.occupancy" && event.seq === 9)).toMatchObject({
      hidden: 4,
    });
    expect(await cem.socket.waitFor((event) => event.type === "wall.occupancy" && event.seq === 9)).toMatchObject({
      hidden: 4,
    });
    // the change put the count back on the sockets of everyone it was told to as a number
    await runInDurableObject(stubOf(wallId), (_instance, state) => {
      const carried = state
        .getWebSockets()
        .map((ws) => ws.deserializeAttachment() as { participantId: string; hidden?: number });
      expect(carried.find((attachment) => attachment.participantId === ben.you)?.hidden).toBe(4);
      expect(carried.find((attachment) => attachment.participantId === cem.you)?.hidden).toBe(4);
    });
    await expectSame(ben.socket, "a member whose socket carried no count");
    await expectSame(anna.socket, "the writer whose socket carried no count");
  });
});
