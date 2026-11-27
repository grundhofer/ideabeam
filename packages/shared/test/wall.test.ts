// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  applyChange,
  applyCommand,
  applyServerEvent,
  dropPending,
  initialWallState,
  NO_CLOCK,
  numbersOf,
  PROTOCOL_VERSION,
  self,
  shown,
  type Clock,
  type ContentCommand,
  type Group,
  type Note,
  type Participant,
  type ServerEvent,
  type WallState,
  NO_STEP,
  stepContextOf,
} from "../src/index.js";
import { OPEN_SYNC, WRITING_SYNC } from "./steps.js";

const NOW = 1_795_300_000_000;
const id = (letter: string) => letter.repeat(32);

const anna: Participant = { id: id("a"), name: "Anna", role: "admin", online: true };
const ben: Participant = { id: id("b"), name: "Ben", role: "member", online: true };

/** A note as this browser gets it. The browser of these tests is Ben's (`wallOf`): his notes are `mine`. */
const note = (letter: string, author: Participant, more: Partial<Note> = {}): Note => ({
  id: id(letter),
  mine: author.id === ben.id,
  text: `Note ${letter}`,
  x: 0,
  y: 0,
  groupId: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...more,
});

const group = (letter: string, more: Partial<Group> = {}): Group => ({
  id: id(letter),
  title: `Group ${letter}`,
  titleSource: "person",
  locked: true,
  x: 0,
  y: 0,
  w: 600,
  h: 400,
  ord: 1,
  ...more,
});

type Sync = Extract<ServerEvent, { type: "sync" }>;

const sync: Sync = {
  type: "sync",
  protocolVersion: PROTOCOL_VERSION,
  serverNow: NOW,
  wall: { id: "ab".repeat(32), question: "What slows us down?", createdAt: NOW },
  participants: [anna],
  you: { participantId: anna.id },
  seq: 0,
  ...OPEN_SYNC,
  hidden: 0,
  clock: NO_CLOCK,
  notes: [],
  groups: [],
  arrangeRun: null,
  votes: [],
  ballot: null,
  voted: 0,
  results: [],
  teams: null,
  manual: [],
  turns: [],
};

/** A wall this browser is on as Ben, with what it holds and the number it stands at. */
const wallOf = (notes: Note[], groups: Group[] = [], seq = 10): WallState =>
  applyServerEvent(initialWallState, {
    ...sync,
    participants: [anna, ben],
    you: { participantId: ben.id },
    seq,
    notes,
    groups,
  });

const apply = (events: ServerEvent[], from: WallState = initialWallState) => events.reduce(applyServerEvent, from);

describe("applyServerEvent", () => {
  it("knows nothing before the first sync", () => {
    expect(initialWallState.wall).toBeNull();
    expect(self(initialWallState)).toBeNull();
  });

  it("a sync is the whole wall, and says who this browser is", () => {
    const state = apply([sync]);
    expect(state.wall?.question).toBe("What slows us down?");
    expect(state.participants).toEqual([anna]);
    expect(state.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(self(state)).toEqual(anna);
  });

  it("someone new is added at the end", () => {
    const state = apply([sync, { type: "presence.join", participant: ben }]);
    expect(state.participants).toEqual([anna, ben]);
  });

  it("someone known who comes back keeps their place and takes the new name and role", () => {
    const renamed: Participant = { ...ben, name: "Benjamin", role: "admin" };
    const state = apply([
      sync,
      { type: "presence.join", participant: ben },
      { type: "presence.leave", participantId: ben.id },
      { type: "presence.join", participant: renamed },
    ]);
    expect(state.participants).toEqual([anna, renamed]);
  });

  it("someone who leaves stays on the wall, offline", () => {
    const state = apply([
      sync,
      { type: "presence.join", participant: ben },
      { type: "presence.leave", participantId: ben.id },
    ]);
    expect(state.participants).toEqual([anna, { ...ben, online: false }]);
  });

  it("a roster update changes the name and the role of someone who is here, in their place", () => {
    const changed: Participant = { ...anna, name: "Anna M.", role: "member" };
    const state = apply([
      sync,
      { type: "presence.join", participant: ben },
      { type: "roster.updated", participant: changed },
    ]);
    expect(state.participants).toEqual([changed, ben]);
    // This browser's own person changes with it.
    expect(self(state)).toEqual(changed);
  });

  it("someone the wall forgot is gone from the people, and their notes stay", () => {
    const notes = [note("1", anna), note("2", ben)];
    const state = apply([{ type: "participant.removed", participantId: anna.id }], wallOf(notes));
    expect(state.participants).toEqual([ben]);
    expect(state.notes).toEqual(notes);
  });

  it("the word that this browser's own person is erased changes nothing here: the store ends the visit", () => {
    const before = wallOf([note("1", ben)]);
    expect(applyServerEvent(before, { type: "erased" })).toBe(before);
  });

  it("a later sync replaces what was known", () => {
    const state = apply([sync, { type: "presence.join", participant: ben }, sync]);
    expect(state.participants).toEqual([anna]);
  });

  it("answers to a single command change nothing", () => {
    const before = apply([sync]);
    const after = apply(
      [
        { type: "ack", opId: "c".repeat(32), seq: 0 },
        { type: "reject", code: "NOT_ADMIN" },
        { type: "error", code: "RATE_LIMIT" },
      ],
      before,
    );
    expect(after).toBe(before);
  });

  it("a deleted wall stays deleted, whatever arrives after it", () => {
    const deleted = apply([sync, { type: "wall.deleted" }]);
    expect(deleted.deleted).toBe(true);
    expect(apply([{ type: "presence.join", participant: ben }, sync], deleted)).toBe(deleted);
  });
});

describe("what the wall holds", () => {
  it("a sync brings the notes, the groups and the number the wall stands at", () => {
    const g = group("g");
    const notes = [note("1", anna), note("2", ben, { x: 40, y: 80, groupId: g.id })];
    const state = wallOf(notes, [g], 17);
    expect(state.notes).toEqual(notes);
    expect(state.groups).toEqual([g]);
    expect(state.seq).toBe(17);
    expect(state.gap).toBe(false);
  });

  it("a new note comes last; one made at the same moment is placed by its id, as a snapshot places it", () => {
    const first = note("5", anna, { createdAt: NOW });
    const state = apply(
      [
        { type: "note.created", seq: 11, note: note("9", ben, { createdAt: NOW + 5 }) },
        { type: "note.created", seq: 12, note: note("7", ben, { createdAt: NOW + 5 }) },
        { type: "note.created", seq: 13, note: note("3", ben, { createdAt: NOW }) },
      ],
      wallOf([first]),
    );
    expect(state.notes.map((n) => n.id)).toEqual([id("3"), id("5"), id("7"), id("9")]);
  });

  it("a note's new text replaces the old one and keeps its place", () => {
    const state = apply(
      [{ type: "note.updated", seq: 11, noteId: id("1"), text: "Shorter meetings", updatedAt: NOW + 60_000 }],
      wallOf([note("1", ben, { x: 12, y: 34, groupId: id("g") }), note("2", anna)], [group("g")]),
    );
    expect(state.notes).toEqual([
      note("1", ben, { text: "Shorter meetings", updatedAt: NOW + 60_000, x: 12, y: 34, groupId: id("g") }),
      note("2", anna),
    ]);
  });

  it("a deleted note is gone", () => {
    const state = apply(
      [{ type: "note.deleted", seq: 11, noteId: id("1") }],
      wallOf([note("1", ben), note("2", anna)]),
    );
    expect(state.notes).toEqual([note("2", anna)]);
  });

  it("a movement puts every note it names at its place and into its group, and leaves the others", () => {
    const state = apply(
      [
        {
          type: "notes.moved",
          seq: 11,
          moves: [
            { noteId: id("1"), x: 100, y: 200, groupId: id("g") },
            { noteId: id("3"), x: -5, y: -6, groupId: null },
          ],
        },
      ],
      wallOf([note("1", ben), note("2", anna), note("3", anna, { groupId: id("g") })], [group("g")]),
    );
    expect(state.notes).toEqual([
      note("1", ben, { x: 100, y: 200, groupId: id("g") }),
      note("2", anna),
      note("3", anna, { x: -5, y: -6, groupId: null }),
    ]);
  });

  it("a new group is listed by its ord; a changed one keeps its place", () => {
    const state = apply(
      [
        { type: "group.created", seq: 11, group: group("h", { ord: 2 }) },
        { type: "group.updated", seq: 12, group: group("g", { title: "Renamed", x: 50 }) },
      ],
      wallOf([], [group("g", { ord: 1 })]),
    );
    expect(state.groups).toEqual([group("g", { title: "Renamed", x: 50 }), group("h", { ord: 2 })]);
  });

  it("a deleted group is gone, and its notes stay where they lie, without a group", () => {
    const state = apply(
      [{ type: "group.deleted", seq: 11, groupId: id("g") }],
      wallOf(
        [note("1", ben, { x: 7, y: 8, groupId: id("g") }), note("2", anna, { groupId: id("h") })],
        [group("g"), group("h", { ord: 2 })],
      ),
    );
    expect(state.groups).toEqual([group("h", { ord: 2 })]);
    expect(state.notes).toEqual([note("1", ben, { x: 7, y: 8, groupId: null }), note("2", anna, { groupId: id("h") })]);
  });

  it("applyChange takes what the rules decided, without a number, like an event with one", () => {
    const content = { notes: [note("1", ben)], groups: [] };
    expect(applyChange(content, { type: "note.deleted", noteId: id("1") })).toEqual(
      applyChange(content, { type: "note.deleted", seq: 3, noteId: id("1") }),
    );
  });
});

describe("the number of a stored change", () => {
  it("moves on with every event", () => {
    const state = apply(
      [
        { type: "note.created", seq: 11, note: note("1", ben) },
        { type: "note.deleted", seq: 12, noteId: id("1") },
      ],
      wallOf([]),
    );
    expect(state.seq).toBe(12);
    expect(state.gap).toBe(false);
  });

  it("an event at or below the number the browser stands at cannot be: it is applied, and says that both are out of step", () => {
    const state = apply([{ type: "note.deleted", seq: 10, noteId: id("1") }], wallOf([note("1", ben)], [], 10));
    expect(state.notes).toEqual([]);
    expect(state.seq).toBe(10);
    expect(state.gap).toBe(true);
    expect(apply([{ type: "note.deleted", seq: 4, noteId: id("1") }], wallOf([note("1", ben)], [], 10))).toMatchObject({
      seq: 4,
      gap: true,
    });
  });

  it("an event further on than the next is applied, and says that something was missed", () => {
    const state = apply([{ type: "note.created", seq: 13, note: note("2", anna) }], wallOf([note("1", ben)], [], 10));
    expect(state.notes).toHaveLength(2);
    expect(state.seq).toBe(13);
    expect(state.gap).toBe(true);
    // it stays said while events go on, and the next snapshot clears it
    const later = apply([{ type: "note.deleted", seq: 14, noteId: id("2") }], state);
    expect(later.gap).toBe(true);
    const fresh = apply([{ ...sync, seq: 14, notes: [note("1", ben)] }], later);
    expect(fresh.gap).toBe(false);
    expect(fresh.seq).toBe(14);
  });

  it("frames about people carry no number and move none", () => {
    const before = wallOf([], [], 10);
    const after = apply([{ type: "presence.leave", participantId: anna.id }], before);
    expect(after.seq).toBe(10);
    expect(after.gap).toBe(false);
  });
});

describe("while the notes are hidden", () => {
  /** A wall in its hidden writing step this browser is on as Ben: his own notes, and a number for the others'. */
  const writing = (notes: Note[], hidden: number, seq = 10): WallState =>
    applyServerEvent(initialWallState, {
      ...sync,
      participants: [anna, ben],
      you: { participantId: ben.id },
      seq,
      ...WRITING_SYNC,
      hidden,
      notes,
    });

  it("a sync says the step and how many notes of the others it leaves out", () => {
    const state = writing([note("1", ben)], 4);
    expect(state).toMatchObject({ step: 0, reach: 0 });
    expect(stepContextOf(state).sight).toBe("hidden");
    expect(state.hidden).toBe(4);
    expect(state.notes).toEqual([note("1", ben)]);
  });

  it("knows no step before the first sync, and takes nothing to be visible", () => {
    expect(initialWallState).toMatchObject({ agenda: null, step: 0, reach: 0, hidden: 0, clock: NO_CLOCK });
    expect(stepContextOf(initialWallState)).toEqual(NO_STEP);
  });

  it("somebody else's change comes as a number: the count moves, the notes do not, and no step is missed", () => {
    const state = apply(
      [
        { type: "wall.occupancy", seq: 11, hidden: 5 },
        { type: "wall.occupancy", seq: 12, hidden: 5 },
        { type: "wall.occupancy", seq: 13, hidden: 4 },
      ],
      writing([note("1", ben)], 4),
    );
    expect(state.hidden).toBe(4);
    expect(state.notes).toEqual([note("1", ben)]);
    expect(state.seq).toBe(13);
    expect(state.gap).toBe(false);
  });

  it("a count that skips a number says that something was missed, like any other event", () => {
    const state = apply([{ type: "wall.occupancy", seq: 12, hidden: 5 }], writing([], 4));
    expect(state).toMatchObject({ hidden: 5, seq: 12, gap: true });
  });

  it("this browser's own change leaves the count alone", () => {
    const state = apply([{ type: "note.created", seq: 11, note: note("2", ben) }], writing([note("1", ben)], 4));
    expect(state.notes).toHaveLength(2);
    expect(state.hidden).toBe(4);
  });

  it("revealing brings the notes this browser did not have, each at its place among its own, and then the step", () => {
    const own = [note("3", ben, { createdAt: NOW + 20 }), note("5", ben, { createdAt: NOW + 40 })];
    const others = [
      note("2", anna, { createdAt: NOW + 10 }),
      note("4", anna, { createdAt: NOW + 30 }),
      note("6", anna, { createdAt: NOW + 40 }),
    ];
    const revealed = apply([{ type: "notes.revealed", seq: 11, notes: others }], writing(own, 3));
    expect(revealed.notes.map((n) => n.id)).toEqual([id("2"), id("3"), id("4"), id("5"), id("6")]);
    expect(revealed.notes.map((n) => n.mine)).toEqual([false, true, false, true, false]);
    expect(revealed.hidden).toBe(0);
    // between the two frames the wall is still in its writing step
    expect(revealed).toMatchObject({ step: 0, seq: 11, gap: false });
    const open = apply([{ type: "step.changed", seq: 12, step: 1, reach: 1 }], revealed);
    expect(open).toMatchObject({ step: 1, reach: 1, hidden: 0, seq: 12, gap: false });
    expect(stepContextOf(open).sight).toBe("all");
    expect(open.notes).toBe(revealed.notes);
  });

  it("revealing a wall nobody else wrote on brings no note, and both frames count", () => {
    const state = apply(
      [
        { type: "notes.revealed", seq: 11, notes: [] },
        { type: "step.changed", seq: 12, step: 1, reach: 1 },
      ],
      writing([note("1", ben)], 0),
    );
    expect(state).toMatchObject({ step: 1, hidden: 0, seq: 12, gap: false });
    expect(state.notes).toEqual([note("1", ben)]);
  });

  it("a command about a group shows nothing while the notes are hidden: the rules refuse it here as on the wall", () => {
    const state = applyCommand(
      writing([], 0),
      { type: "group.create", opId: id("0"), groupId: id("g"), title: "", x: 0, y: 0, w: 300, h: 300 },
      NOW,
    );
    expect(shown(state).groups).toEqual([]);
    // the same command on a revealed wall shows at once
    const open = applyCommand(
      wallOf([]),
      { type: "group.create", opId: id("0"), groupId: id("g"), title: "", x: 0, y: 0, w: 300, h: 300 },
      NOW,
    );
    expect(shown(open).groups).toHaveLength(1);
  });

  it("this browser's own note shows at once while it is hidden from the others", () => {
    const state = applyCommand(
      writing([], 2),
      { type: "note.create", opId: id("0"), noteId: id("1"), text: "Mine", x: 0, y: 0 },
      NOW,
    );
    expect(shown(state).notes).toMatchObject([{ id: id("1"), mine: true, text: "Mine" }]);
    expect(state.hidden).toBe(2);
  });
});

describe("the clock of the writing", () => {
  const running: Clock = { rev: 1, endsAt: NOW + 600_000, leftMs: null };

  it("comes with the sync, and every control that was taken brings the clock after it", () => {
    const state = apply([{ ...sync, clock: running }]);
    expect(state.clock).toEqual(running);
    const paused: Clock = { rev: 2, endsAt: null, leftMs: 540_000 };
    const after = apply([{ type: "clock.changed", seq: 1, clock: paused, serverNow: NOW + 60_000 }], state);
    expect(after.clock).toEqual(paused);
    expect(after).toMatchObject({ seq: 1, gap: false });
  });

  it("ends with the step: revealing stops it and leaves its revision", () => {
    const state = apply([
      { ...sync, ...WRITING_SYNC, clock: running },
      { type: "step.changed", seq: 1, step: 1, reach: 1 },
    ]);
    expect(state.clock).toEqual({ rev: 1, endsAt: null, leftMs: null });
    const paused = apply([
      { ...sync, ...WRITING_SYNC, clock: { rev: 4, endsAt: null, leftMs: 1000 } },
      { type: "step.changed", seq: 1, step: 1, reach: 1 },
    ]);
    expect(paused.clock).toEqual({ rev: 4, endsAt: null, leftMs: null });
  });
});

describe("a command of this browser", () => {
  const OP = id("0");
  const create: ContentCommand = {
    type: "note.create",
    opId: OP,
    noteId: id("1"),
    text: "Fewer meetings",
    x: 40,
    y: 80,
  };
  const made: Note = note("1", ben, {
    text: "Fewer meetings",
    x: 40,
    y: 80,
    createdAt: NOW + 500,
    updatedAt: NOW + 500,
  });

  it("shows at once, and what the worker has told stays as it is", () => {
    const before = wallOf([]);
    const state = applyCommand(before, create, NOW + 500);
    expect(state.pending).toEqual([{ command: create, at: NOW + 500 }]);
    expect(state.notes).toEqual([]);
    expect(state.seq).toBe(10);
    expect(shown(state).notes).toEqual([made]);
    expect(shown(before).notes).toEqual([]);
  });

  it("is confirmed by the worker's event and then its ack: the note stays, now with the stored time", () => {
    const stored = { ...made, createdAt: NOW + 900, updatedAt: NOW + 900 };
    let state = applyCommand(wallOf([]), create, NOW + 500);
    state = applyServerEvent(state, { type: "note.created", seq: 11, note: stored });
    // the event came, the ack not yet: the note is there once
    expect(shown(state).notes).toEqual([stored]);
    expect(state.pending).toHaveLength(1);
    state = applyServerEvent(state, { type: "ack", opId: OP, seq: 11 });
    expect(state.pending).toEqual([]);
    expect(shown(state).notes).toEqual([stored]);
    expect(state.notes).toEqual([stored]);
  });

  it("is taken back when the worker refuses it", () => {
    let state = applyCommand(wallOf([note("2", anna)]), create, NOW + 500);
    expect(shown(state).notes).toHaveLength(2);
    state = applyServerEvent(state, { type: "reject", opId: OP, code: "LIMIT" });
    expect(state.pending).toEqual([]);
    expect(shown(state).notes).toEqual([note("2", anna)]);
  });

  it("an answer to another operation, or to none, leaves it on its way", () => {
    const state = applyCommand(wallOf([]), create, NOW + 500);
    expect(applyServerEvent(state, { type: "ack", opId: id("f"), seq: 11 })).toBe(state);
    expect(applyServerEvent(state, { type: "reject", opId: id("f"), code: "INVALID" })).toBe(state);
    expect(applyServerEvent(state, { type: "reject", code: "INVALID" })).toBe(state);
    expect(applyServerEvent(state, { type: "error", code: "RATE_LIMIT" })).toBe(state);
  });

  it("can be given up by the browser itself: a command that will never be sent", () => {
    const state = applyCommand(wallOf([]), create, NOW + 500);
    expect(shown(dropPending(state, OP)).notes).toEqual([]);
    expect(dropPending(state, id("f"))).toBe(state);
  });

  it("several lie over each other in the order they were made", () => {
    const g = id("g");
    let state = wallOf([]);
    state = applyCommand(state, create, NOW + 500);
    state = applyCommand(
      state,
      { type: "group.create", opId: id("2"), groupId: g, title: "", x: 0, y: 0, w: 300, h: 300 },
      NOW + 600,
    );
    state = applyCommand(
      state,
      { type: "notes.move", opId: id("3"), moves: [{ noteId: id("1"), x: 10, y: 10, groupId: g }] },
      NOW + 700,
    );
    state = applyCommand(
      state,
      { type: "note.update", opId: id("4"), noteId: id("1"), text: "Shorter meetings" },
      NOW + 800,
    );
    expect(shown(state)).toEqual({
      notes: [{ ...made, text: "Shorter meetings", updatedAt: NOW + 800, x: 10, y: 10, groupId: g }],
      groups: [group("g", { title: "", w: 300, h: 300 })],
    });
    // the first is refused: what was built on it shows nothing either
    state = applyServerEvent(state, { type: "reject", opId: OP, code: "LIMIT" });
    expect(shown(state)).toEqual({ notes: [], groups: [group("g", { title: "", w: 300, h: 300 })] });
  });

  it("lies over what others do meanwhile: a note this browser moves stays where it put it", () => {
    let state = wallOf([note("1", anna)]);
    state = applyCommand(
      state,
      { type: "notes.move", opId: OP, moves: [{ noteId: id("1"), x: 10, y: 10, groupId: null }] },
      NOW,
    );
    state = applyServerEvent(state, {
      type: "notes.moved",
      seq: 11,
      moves: [{ noteId: id("1"), x: 99, y: 99, groupId: null }],
    });
    expect(state.notes[0]).toMatchObject({ x: 99, y: 99 });
    expect(shown(state).notes[0]).toMatchObject({ x: 10, y: 10 });
    // the worker took this browser's movement after the other one
    state = applyServerEvent(state, {
      type: "notes.moved",
      seq: 12,
      moves: [{ noteId: id("1"), x: 10, y: 10, groupId: null }],
    });
    state = applyServerEvent(state, { type: "ack", opId: OP, seq: 12 });
    expect(shown(state).notes[0]).toMatchObject({ x: 10, y: 10 });
    expect(state.pending).toEqual([]);
  });

  it("shows only what the rules allow: another person's text does not change, even for a moment", () => {
    const annas = note("1", anna);
    const state = applyCommand(
      wallOf([annas]),
      { type: "note.update", opId: OP, noteId: id("1"), text: "Mine now" },
      NOW,
    );
    expect(shown(state).notes).toEqual([annas]);
  });

  it("stays on its way over a reconnect: the snapshot replaces what the worker has told, not what was sent", () => {
    let state = applyCommand(wallOf([]), create, NOW + 500);
    state = applyServerEvent(state, { ...sync, participants: [anna, ben], you: { participantId: ben.id }, seq: 30 });
    expect(state.pending).toHaveLength(1);
    expect(shown(state).notes).toEqual([made]);
  });

  it("is ignored on a wall that was deleted, and before this browser knows who it is", () => {
    const deleted = applyServerEvent(wallOf([]), { type: "wall.deleted" });
    expect(applyCommand(deleted, create, NOW)).toBe(deleted);
    const unknown = applyCommand(initialWallState, create, NOW);
    expect(shown(unknown).notes).toEqual([]);
  });

  it("gives the same answer for the same state, so whoever renders can compare", () => {
    const state = applyCommand(wallOf([note("2", anna)]), create, NOW + 500);
    expect(shown(state)).toBe(shown(state));
    const quiet = wallOf([note("2", anna)]);
    expect(shown(quiet)).toBe(shown(quiet));
    expect(shown(quiet).notes).toBe(quiet.notes);
  });
});

describe("arranging", () => {
  const RUN = id("e");
  const made: Group = { ...group("c"), title: "Theme", titleSource: "ki", locked: false, x: 1000, y: 1000, ord: 2 };
  const old: Group = { ...group("d"), title: "Earlier", titleSource: "ki", locked: false, ord: 1 };
  const notes = [note("1", ben, { x: 1, y: 2, groupId: id("d") }), note("2", anna, { x: 3, y: 4 }), note("3", anna)];
  // Each of the two events takes four numbers: a group that comes, a group that goes, the layout row, and the row
  // of what the wall remembers. Its frame carries the last of them.
  const applied: ServerEvent = {
    type: "arrange.applied",
    seq: 14,
    runId: RUN,
    source: "service",
    groups: [made],
    moves: [
      { noteId: id("1"), x: 1016, y: 1040, groupId: id("c") },
      { noteId: id("2"), x: 1016, y: 1160, groupId: id("c") },
    ],
    removed: [id("d")],
  };
  const undone: ServerEvent = {
    type: "arrange.undone",
    seq: 18,
    runId: RUN,
    moves: [
      { noteId: id("1"), x: 1, y: 2, groupId: id("d") },
      { noteId: id("2"), x: 3, y: 4, groupId: null },
    ],
    removed: [id("c")],
    restored: [old],
  };

  it("a sync says whether there is a run to take back, and which", () => {
    expect(initialWallState.arrangeRun).toBeNull();
    expect(wallOf(notes).arrangeRun).toBeNull();
    const state = applyServerEvent(initialWallState, { ...sync, arrangeRun: RUN });
    expect(state.arrangeRun).toBe(RUN);
  });

  it("an applied arrangement brings its groups, puts the notes where it says, takes the earlier frames away and is the run to take back", () => {
    const state = apply([applied], wallOf(notes, [old]));
    expect(state.groups).toEqual([made]);
    expect(state.notes).toEqual([
      note("1", ben, { x: 1016, y: 1040, groupId: id("c") }),
      note("2", anna, { x: 1016, y: 1160, groupId: id("c") }),
      note("3", anna),
    ]);
    expect(state.arrangeRun).toBe(RUN);
    expect(state).toMatchObject({ seq: 14, gap: false });
  });

  it("a note the arrangement does not name stays where it lies; in a frame that goes it has no group any more", () => {
    const left = note("4", anna, { x: 9, y: 9, groupId: id("d") });
    const state = apply([applied], wallOf([...notes, left], [old]));
    expect(state.notes.find((n) => n.id === id("4"))).toEqual({ ...left, groupId: null });
  });

  it("taking it back puts the notes back, takes its groups away, brings the earlier frames back, and leaves nothing to take back", () => {
    const before = wallOf(notes, [old]);
    const state = apply([applied, undone], before);
    expect(state.notes).toEqual(before.notes);
    expect(state.groups).toEqual(before.groups);
    expect(state.arrangeRun).toBeNull();
    expect(state).toMatchObject({ seq: 18, gap: false });
  });

  it("both events take as many numbers as rows they write, and carry the last: any other number says that something was missed", () => {
    expect(numbersOf(applied)).toBe(4);
    expect(numbersOf(undone)).toBe(4);
    expect(numbersOf({ type: "notes.moved", seq: 3, moves: [{ noteId: id("1"), x: 0, y: 0, groupId: null }] })).toBe(1);
    // the event before it was missed
    expect(apply([undone], wallOf(notes, [old])).gap).toBe(true);
    // a frame that carries the next number, as every other change does, is not the one that was expected
    expect(apply([{ ...applied, seq: 11 }], wallOf(notes, [old])).gap).toBe(true);
    expect(apply([applied, { ...undone, seq: 15 }], wallOf(notes, [old])).gap).toBe(true);
  });

  describe("as a command of the moderation's browser", () => {
    /** The same wall in Anna's browser: she moderates. */
    const annas = (run: string | null = null): WallState =>
      applyServerEvent(initialWallState, { ...sync, seq: 10, notes, groups: [old], arrangeRun: run });
    const command: ContentCommand = {
      type: "admin.arrange.apply",
      opId: RUN,
      source: "service",
      groups: [{ groupId: id("c"), title: "Theme", x: 1000, y: 1000, w: 600, h: 400, noteIds: [id("1"), id("2")] }],
      moves: [
        { noteId: id("1"), x: 1016, y: 1040, groupId: id("c") },
        { noteId: id("2"), x: 1016, y: 1160, groupId: id("c") },
      ],
    };

    it("an arrangement shows at once: the groups, the notes in them, the earlier frame gone", () => {
      const state = applyCommand(annas(), command, NOW);
      expect(shown(state).groups).toEqual([made]);
      expect(shown(state).notes.map((n) => [n.x, n.y, n.groupId])).toEqual([
        [1016, 1040, id("c")],
        [1016, 1160, id("c")],
        [0, 0, null],
      ]);
      // what the worker has told is as it was, and there is nothing to take back yet
      expect(state.groups).toEqual([old]);
      expect(state.arrangeRun).toBeNull();
    });

    it("is confirmed by the wall's event and its ack: shown once, and then the wall's own", () => {
      let state = applyCommand(annas(), command, NOW);
      state = applyServerEvent(state, applied);
      expect(shown(state).groups).toEqual([made]);
      expect(state.arrangeRun).toBe(RUN);
      state = applyServerEvent(state, { type: "ack", opId: RUN, seq: 14 });
      expect(state.pending).toEqual([]);
      expect(shown(state).groups).toEqual([made]);
    });

    it("is taken back when the wall refuses it", () => {
      let state = applyCommand(annas(), command, NOW);
      state = applyServerEvent(state, { type: "reject", opId: RUN, code: "NOT_FOUND" });
      expect(shown(state)).toMatchObject({ groups: [old], notes });
    });

    it("shows nothing in a browser that does not moderate: the rules refuse it there as on the wall", () => {
      const state = applyCommand(wallOf(notes, [old]), command, NOW);
      expect(shown(state)).toMatchObject({ groups: [old], notes });
    });

    it("taking a run back shows nothing until the wall says what went where", () => {
      const arranged = applyServerEvent(annas(), applied);
      const state = applyCommand(arranged, { type: "admin.arrange.undo", opId: id("0"), runId: RUN }, NOW);
      expect(shown(state)).toMatchObject({ groups: arranged.groups, notes: arranged.notes });
      const back = applyServerEvent(applyServerEvent(state, undone), { type: "ack", opId: id("0"), seq: 18 });
      expect(shown(back)).toMatchObject({ groups: [old], notes });
      expect(back.pending).toEqual([]);
    });
  });
});

describe("a vote (stage M2)", () => {
  const option = "c".repeat(32);
  const round = { step: 3, options: [{ id: option, kind: "note" as const }], omitted: 0, limit: 2, counted: false };
  const result = {
    step: 3,
    kind: "dots" as const,
    limit: 2,
    voters: 2,
    rows: [{ id: option, kind: "note" as const, label: "Weniger Termine", points: 3, by: 2, rank: 1 }],
  };

  it("entering the step brings its vote, how many have voted and one's own ballot; leaving it forgets the last two", () => {
    const ballot = { kind: "dots" as const, points: { [option]: 2 } };
    const inside = apply(
      [{ type: "step.changed", seq: 11, step: 3, reach: 3, round, voted: 1, ballot }],
      wallOf([], [], 10),
    );
    expect(inside).toMatchObject({ step: 3, votes: [round], voted: 1, ballot, gap: false });
    const after = apply([{ type: "step.changed", seq: 12, step: 4, reach: 4 }], inside);
    expect(after).toMatchObject({ votes: [round], voted: 0, ballot: null });
  });

  it("one's own ballot stored, the others' count, and the result: each a number of its own, nothing missed", () => {
    const inside = apply([{ type: "step.changed", seq: 11, step: 3, reach: 3, round, voted: 0 }], wallOf([], [], 10));
    const ballot = { kind: "dots" as const, points: { [option]: 1 } };
    const voted = apply(
      [
        { type: "votes.count", seq: 12, step: 3, voted: 1 },
        { type: "ballot.stored", seq: 13, step: 3, ballot, voted: 2 },
        { type: "results.published", seq: 14, result },
      ],
      inside,
    );
    expect(voted).toMatchObject({ voted: 2, ballot, results: [result], gap: false, seq: 14 });
    expect(voted.votes).toEqual([{ ...round, counted: true }]);
    // a count of another step than the one the wall is in moves the number and nothing else
    expect(apply([{ type: "votes.count", seq: 15, step: 1, voted: 7 }], voted).voted).toBe(2);
  });
});
