// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  decide,
  decideStep,
  initialFlow,
  MAX_GROUPS,
  MAX_NOTES,
  mayDeleteNote,
  mayEditNote,
  noteFor,
  readerOf,
  type Actor,
  type ContentCommand,
  type Decision,
  type Group,
  type StoredNote,
  type WallReader,
  type StepContext,
} from "../src/index.js";
import { HIDDEN_AGENDA, OPEN, WRITING } from "./steps.js";

const NOW = 1_795_300_000_000;
const id = (letter: string) => letter.repeat(32);
const OP = id("0");

const anna: Actor = { id: id("a"), role: "admin" };
const ben: Actor = { id: id("b"), role: "member" };
const cem: Actor = { id: id("c"), role: "member" };

/** A note as the wall stores it: with who wrote it. The rules get it as whoever asks gets it (`viewOf`). */
const note = (letter: string, author: Actor, more: Partial<StoredNote> = {}): StoredNote => ({
  id: id(letter),
  authorId: author.id,
  text: `Note ${letter}`,
  x: 0,
  y: 0,
  groupId: null,
  createdAt: NOW - 1000,
  updatedAt: NOW - 1000,
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

interface Stored {
  notes: StoredNote[];
  groups: Group[];
}
const wall = (notes: StoredNote[] = [], groups: Group[] = []): Stored => ({ notes, groups });
/** The wall as the rules ask about it for `by`: every note says whether it is theirs, and not whose it is. */
const viewOf = (content: Stored, by: Actor): WallReader =>
  readerOf({ notes: content.notes.map((stored) => noteFor(stored, by.id)), groups: content.groups });
const ask = (content: Stored, command: ContentCommand, by: Actor, ctx: StepContext = OPEN): Decision =>
  decide(viewOf(content, by), command, by, NOW, ctx);

const REFUSED = (code: string) => ({ kind: "refused", code });
const UNCHANGED = { kind: "unchanged" };

describe("who may do what with a note", () => {
  // a browser knows of a note whether it is its own person's, and its person's role: that decides
  const bens = note("1", ben);
  const as = (viewer: Actor) => noteFor(bens, viewer.id);

  it("only its author changes its text, the admin included", () => {
    expect(mayEditNote(as(ben))).toBe(true);
    expect(mayEditNote(as(cem))).toBe(false);
    expect(mayEditNote(as(anna))).toBe(false);
  });

  it("its author takes it off the wall, or an admin; nobody else", () => {
    expect(mayDeleteNote(as(ben), ben)).toBe(true);
    expect(mayDeleteNote(as(anna), anna)).toBe(true);
    expect(mayDeleteNote(as(cem), cem)).toBe(false);
  });

  it("a note whose writer the wall has forgotten is nobody's: an admin may still delete it", () => {
    const orphan = noteFor(note("1", { id: id("e"), role: "member" }), ben.id);
    expect(orphan.mine).toBe(false);
    expect(mayEditNote(orphan)).toBe(false);
    expect(mayDeleteNote(orphan, ben)).toBe(false);
    expect(mayDeleteNote(orphan, anna)).toBe(true);
  });
});

describe("note.create", () => {
  const create: ContentCommand = {
    type: "note.create",
    opId: OP,
    noteId: id("1"),
    text: "Fewer meetings",
    x: 40,
    y: -8,
  };

  it("makes the sender's note at the place it names, in no group, with the clock of whoever decides", () => {
    expect(ask(wall(), create, ben)).toEqual({
      kind: "changed",
      change: {
        type: "note.created",
        note: {
          id: id("1"),
          // as its writer gets it; who that is, the change does not say
          mine: true,
          text: "Fewer meetings",
          x: 40,
          y: -8,
          groupId: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
    });
  });

  it("sent again by its author it changes nothing, whatever has happened to the note since", () => {
    const made = note("1", ben, { text: "Fewer meetings", x: 40, y: -8 });
    expect(ask(wall([made]), create, ben)).toEqual(UNCHANGED);
    expect(ask(wall([{ ...made, text: "Shorter meetings", x: 900, groupId: id("g") }]), create, ben)).toEqual(
      UNCHANGED,
    );
  });

  it("is refused under an id that is somebody else's note", () => {
    expect(ask(wall([note("1", cem)]), create, ben)).toEqual(REFUSED("CONFLICT"));
  });

  it(`is refused when the wall holds ${MAX_NOTES} notes, and taken with one fewer`, () => {
    const full: WallReader = { ...viewOf(wall(), ben), noteCount: () => MAX_NOTES };
    expect(decide(full, create, ben, NOW, OPEN)).toEqual(REFUSED("LIMIT"));
    const almost: WallReader = { ...viewOf(wall(), ben), noteCount: () => MAX_NOTES - 1 };
    expect(decide(almost, create, ben, NOW, OPEN).kind).toBe("changed");
    // the note that is there already is no new one: a full wall still answers its own author's retry
    const retried: WallReader = { ...viewOf(wall([note("1", ben)]), ben), noteCount: () => MAX_NOTES };
    expect(decide(retried, create, ben, NOW, OPEN)).toEqual(UNCHANGED);
  });
});

describe("note.update", () => {
  const update: ContentCommand = { type: "note.update", opId: OP, noteId: id("1"), text: "Shorter meetings" };

  it("changes the text and says when", () => {
    expect(ask(wall([note("1", ben)]), update, ben)).toEqual({
      kind: "changed",
      change: { type: "note.updated", noteId: id("1"), text: "Shorter meetings", updatedAt: NOW },
    });
  });

  it("is the author's alone: not another member's, not the admin's", () => {
    expect(ask(wall([note("1", ben)]), update, cem)).toEqual(REFUSED("NOT_AUTHOR"));
    expect(ask(wall([note("1", ben)]), update, anna)).toEqual(REFUSED("NOT_AUTHOR"));
  });

  it("changes nothing when the text is that already", () => {
    expect(ask(wall([note("1", ben, { text: "Shorter meetings" })]), update, ben)).toEqual(UNCHANGED);
  });

  it("is refused for a note that is not on the wall", () => {
    expect(ask(wall([note("2", ben)]), update, ben)).toEqual(REFUSED("NOT_FOUND"));
  });
});

describe("note.delete", () => {
  const remove: ContentCommand = { type: "note.delete", opId: OP, noteId: id("1") };

  it("takes the note off the wall for its author and for an admin", () => {
    const deleted = { kind: "changed", change: { type: "note.deleted", noteId: id("1") } };
    expect(ask(wall([note("1", ben)]), remove, ben)).toEqual(deleted);
    expect(ask(wall([note("1", ben)]), remove, anna)).toEqual(deleted);
  });

  it("is refused for another member", () => {
    expect(ask(wall([note("1", ben)]), remove, cem)).toEqual(REFUSED("NOT_AUTHOR"));
  });

  it("changes nothing when the note is gone already, whoever asks", () => {
    expect(ask(wall(), remove, ben)).toEqual(UNCHANGED);
    expect(ask(wall(), remove, cem)).toEqual(UNCHANGED);
  });
});

describe("notes.move", () => {
  const move = (moves: Array<[string, number, number, string | null]>): ContentCommand => ({
    type: "notes.move",
    opId: OP,
    moves: moves.map(([letter, x, y, groupId]) => ({ noteId: id(letter), x, y, groupId })),
  });

  it("moves anybody's note, for anybody", () => {
    expect(ask(wall([note("1", ben)]), move([["1", 10, 20, null]]), cem)).toEqual({
      kind: "changed",
      change: { type: "notes.moved", moves: [{ noteId: id("1"), x: 10, y: 20, groupId: null }] },
    });
  });

  it("puts a note into a group, takes it out again, and moves it within one", () => {
    const g = group("g");
    const into = ask(wall([note("1", ben)], [g]), move([["1", 0, 0, g.id]]), ben);
    expect(into).toEqual({
      kind: "changed",
      change: { type: "notes.moved", moves: [{ noteId: id("1"), x: 0, y: 0, groupId: g.id }] },
    });
    const inside = wall([note("1", ben, { groupId: g.id })], [g]);
    expect(ask(inside, move([["1", 0, 0, null]]), ben)).toMatchObject({ change: { moves: [{ groupId: null }] } });
    expect(ask(inside, move([["1", 30, 0, g.id]]), ben)).toMatchObject({
      change: { moves: [{ x: 30, groupId: g.id }] },
    });
  });

  it("moves a whole selection in one change", () => {
    const notes = [note("1", ben), note("2", cem), note("3", anna)];
    const decision = ask(
      wall(notes),
      move([
        ["1", 10, 10, null],
        ["2", 20, 20, null],
        ["3", 30, 30, null],
      ]),
      ben,
    );
    expect(decision).toMatchObject({ kind: "changed", change: { type: "notes.moved" } });
    expect(decision.kind === "changed" && decision.change.type === "notes.moved" && decision.change.moves).toHaveLength(
      3,
    );
  });

  it("leaves out a note that lies there already, and changes nothing when all of them do", () => {
    const g = group("g");
    const notes = [note("1", ben, { x: 10, y: 10 }), note("2", ben, { x: 5, y: 5, groupId: g.id })];
    expect(
      ask(
        wall(notes, [g]),
        move([
          ["1", 10, 10, null],
          ["2", 6, 5, g.id],
        ]),
        ben,
      ),
    ).toEqual({
      kind: "changed",
      change: { type: "notes.moved", moves: [{ noteId: id("2"), x: 6, y: 5, groupId: g.id }] },
    });
    expect(
      ask(
        wall(notes, [g]),
        move([
          ["1", 10, 10, null],
          ["2", 5, 5, g.id],
        ]),
        ben,
      ),
    ).toEqual(UNCHANGED);
  });

  it("leaves out a note that is gone, and moves the rest", () => {
    expect(
      ask(
        wall([note("1", ben)]),
        move([
          ["1", 10, 10, null],
          ["2", 20, 20, null],
        ]),
        ben,
      ),
    ).toEqual({
      kind: "changed",
      change: { type: "notes.moved", moves: [{ noteId: id("1"), x: 10, y: 10, groupId: null }] },
    });
    expect(ask(wall(), move([["2", 20, 20, null]]), ben)).toEqual(UNCHANGED);
  });

  it("a group that is gone is no group: the note goes to its place and belongs to none", () => {
    expect(ask(wall([note("1", ben)]), move([["1", 10, 10, id("g")]]), ben)).toEqual({
      kind: "changed",
      change: { type: "notes.moved", moves: [{ noteId: id("1"), x: 10, y: 10, groupId: null }] },
    });
    // already there and in no group: nothing to do
    expect(ask(wall([note("1", ben, { x: 10, y: 10 })]), move([["1", 10, 10, id("g")]]), ben)).toEqual(UNCHANGED);
  });

  it("asks about each group once, however many notes go into it", () => {
    const g = group("g");
    const notes = Array.from({ length: 5 }, (_, i) => note(String(i + 1), ben));
    let asked = 0;
    const reader: WallReader = {
      ...viewOf(wall(notes, [g]), ben),
      group: (groupId) => {
        asked += 1;
        return groupId === g.id ? g : null;
      },
    };
    decide(reader, move(notes.map((n, i) => [String(i + 1), i, i, g.id])), ben, NOW, OPEN);
    expect(asked).toBe(1);
  });
});

describe("group.create", () => {
  const create: ContentCommand = {
    type: "group.create",
    opId: OP,
    groupId: id("g"),
    title: "Meetings",
    x: 100,
    y: 200,
    w: 600,
    h: 400,
  };

  it("makes a group by hand: the title is a person's, the group is locked, and it comes last", () => {
    expect(ask(wall(), create, ben)).toEqual({
      kind: "changed",
      change: {
        type: "group.created",
        group: {
          id: id("g"),
          title: "Meetings",
          titleSource: "person",
          locked: true,
          x: 100,
          y: 200,
          w: 600,
          h: 400,
          ord: 1,
        },
      },
    });
    const after = ask(wall([], [group("h", { ord: 3 }), group("i", { ord: 7 })]), create, ben);
    expect(after).toMatchObject({ change: { group: { ord: 8 } } });
  });

  it("may have no title yet", () => {
    expect(ask(wall(), { ...create, title: "" }, ben)).toMatchObject({
      change: { group: { title: "", locked: true } },
    });
  });

  it("sent again it changes nothing, whatever has happened to the group since", () => {
    expect(ask(wall([], [group("g", { title: "Renamed", x: -50 })]), create, cem)).toEqual(UNCHANGED);
  });

  it(`is refused when the wall holds ${MAX_GROUPS} groups, and taken with one fewer`, () => {
    const groups = Array.from({ length: MAX_GROUPS }, (_, i) => ({
      ...group("h"),
      id: `${i}`.padStart(32, "0"),
      ord: i + 1,
    }));
    expect(ask(wall([], groups), create, ben)).toEqual(REFUSED("LIMIT"));
    expect(ask(wall([], groups.slice(1)), create, ben)).toMatchObject({ change: { group: { ord: MAX_GROUPS + 1 } } });
  });
});

describe("group.update", () => {
  const existing = group("g", {
    title: "Meetings",
    titleSource: "ki",
    locked: false,
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    ord: 4,
  });
  const update = (fields: object): ContentCommand =>
    ({ type: "group.update", opId: OP, groupId: id("g"), ...fields }) as ContentCommand;

  it("changes what it names and leaves the rest, for anybody", () => {
    expect(ask(wall([], [existing]), update({ x: 40, y: -40 }), cem)).toEqual({
      kind: "changed",
      change: { type: "group.updated", group: { ...existing, x: 40, y: -40 } },
    });
    expect(ask(wall([], [existing]), update({ w: 300 }), ben)).toEqual({
      kind: "changed",
      change: { type: "group.updated", group: { ...existing, w: 300 } },
    });
  });

  it("a new title makes the group a person's from then on: the title is theirs, and the group is locked like one made by hand", () => {
    for (const by of [ben, anna]) {
      expect(ask(wall([], [existing]), update({ title: "Fewer meetings" }), by)).toEqual({
        kind: "changed",
        change: {
          type: "group.updated",
          group: { ...existing, title: "Fewer meetings", titleSource: "person", locked: true },
        },
      });
    }
    // renamed and moved in one command
    expect(ask(wall([], [existing]), update({ title: "Fewer meetings", x: 40, w: 900 }), ben)).toMatchObject({
      change: { group: { title: "Fewer meetings", titleSource: "person", locked: true, x: 40, w: 900 } },
    });
    // the title may be taken away again: that is a person's word on it too
    expect(ask(wall([], [existing]), update({ title: "" }), ben)).toMatchObject({
      change: { group: { title: "", titleSource: "person", locked: true } },
    });
    // a group made by hand stays what it is
    const hand = group("g", { title: "Ours" });
    expect(ask(wall([], [hand]), update({ title: "Ours, renamed" }), ben)).toMatchObject({
      change: { group: { title: "Ours, renamed", titleSource: "person", locked: true } },
    });
  });

  it("moving or resizing a frame locks nothing, and leaves the title's source alone", () => {
    for (const fields of [{ x: 1 }, { y: -9 }, { w: 300 }, { h: 900 }, { x: 5, y: 5, w: 700, h: 700 }]) {
      expect(ask(wall([], [existing]), update(fields), ben), JSON.stringify(fields)).toEqual({
        kind: "changed",
        change: { type: "group.updated", group: { ...existing, ...fields, titleSource: "ki", locked: false } },
      });
    }
    // a command that names the title as it is, beside a move: nobody renamed anything
    expect(ask(wall([], [existing]), update({ title: "Meetings", x: 7 }), ben)).toEqual({
      kind: "changed",
      change: { type: "group.updated", group: { ...existing, x: 7 } },
    });
  });

  it("a group of an older build that carries a person's title without being locked: moving leaves it so, renaming locks it", () => {
    // before renaming locked a group, a renamed group of the AI's stayed unlocked; walls of then still hold such
    const legacy = group("g", { title: "Ours", titleSource: "person", locked: false });
    expect(ask(wall([], [legacy]), update({ x: 12 }), ben)).toMatchObject({
      change: { group: { titleSource: "person", locked: false, x: 12 } },
    });
    expect(ask(wall([], [legacy]), update({ title: "Ours, again" }), ben)).toMatchObject({
      change: { group: { title: "Ours, again", titleSource: "person", locked: true } },
    });
  });

  it("changes nothing when everything it names is so already", () => {
    expect(ask(wall([], [existing]), update({ title: "Meetings", x: 0, w: 600 }), ben)).toEqual(UNCHANGED);
  });

  it("is refused for a group that is not on the wall", () => {
    expect(ask(wall(), update({ x: 1 }), ben)).toEqual(REFUSED("NOT_FOUND"));
  });
});

describe("group.delete", () => {
  const remove: ContentCommand = { type: "group.delete", opId: OP, groupId: id("g") };

  it("takes the group off the wall, for anybody", () => {
    expect(ask(wall([note("1", ben, { groupId: id("g") })], [group("g")]), remove, cem)).toEqual({
      kind: "changed",
      change: { type: "group.deleted", groupId: id("g") },
    });
  });

  it("changes nothing when the group is gone already", () => {
    expect(ask(wall(), remove, ben)).toEqual(UNCHANGED);
  });
});

describe("while the notes are hidden", () => {
  const hidden = (content: Stored, command: ContentCommand, by: Actor) => ask(content, command, by, WRITING);
  const move = (letter: string, groupId: string | null = null): ContentCommand => ({
    type: "notes.move",
    opId: OP,
    moves: [{ noteId: id(letter), x: 10, y: 20, groupId }],
  });

  it("everybody writes, and changes, moves and deletes what they wrote themselves", () => {
    const content = wall([note("1", ben)]);
    expect(hidden(wall(), { type: "note.create", opId: OP, noteId: id("1"), text: "Mine", x: 0, y: 0 }, ben).kind).toBe(
      "changed",
    );
    expect(hidden(content, { type: "note.update", opId: OP, noteId: id("1"), text: "Changed" }, ben).kind).toBe(
      "changed",
    );
    expect(hidden(content, move("1"), ben)).toEqual({
      kind: "changed",
      change: { type: "notes.moved", moves: [{ noteId: id("1"), x: 10, y: 20, groupId: null }] },
    });
    expect(hidden(content, { type: "note.delete", opId: OP, noteId: id("1") }, ben)).toEqual({
      kind: "changed",
      change: { type: "note.deleted", noteId: id("1") },
    });
  });

  it("somebody else's note is not on the wall for a command: no answer says that it is there", () => {
    const content = wall([note("1", ben)]);
    for (const other of [cem, anna]) {
      // the same answers as for a note that does not exist
      expect(hidden(content, { type: "note.update", opId: OP, noteId: id("1"), text: "Changed" }, other)).toEqual(
        hidden(wall(), { type: "note.update", opId: OP, noteId: id("1"), text: "Changed" }, other),
      );
      expect(hidden(content, { type: "note.update", opId: OP, noteId: id("1"), text: "Changed" }, other)).toEqual(
        REFUSED("NOT_FOUND"),
      );
      expect(hidden(content, { type: "note.delete", opId: OP, noteId: id("1") }, other)).toEqual(UNCHANGED);
      expect(hidden(content, move("1"), other)).toEqual(UNCHANGED);
    }
  });

  it("a movement takes the sender's own notes and leaves the others' out", () => {
    const content = wall([note("1", ben), note("2", cem)]);
    const both: ContentCommand = {
      type: "notes.move",
      opId: OP,
      moves: [
        { noteId: id("1"), x: 10, y: 20, groupId: null },
        { noteId: id("2"), x: 30, y: 40, groupId: null },
      ],
    };
    expect(hidden(content, both, ben)).toEqual({
      kind: "changed",
      change: { type: "notes.moved", moves: [{ noteId: id("1"), x: 10, y: 20, groupId: null }] },
    });
  });

  it("an id that is somebody else's note is still no new note", () => {
    const create: ContentCommand = { type: "note.create", opId: OP, noteId: id("1"), text: "Mine", x: 0, y: 0 };
    expect(hidden(wall([note("1", cem)]), create, ben)).toEqual(REFUSED("CONFLICT"));
    expect(hidden(wall([note("1", ben)]), create, ben)).toEqual(UNCHANGED);
  });

  it("there are no groups yet: making, changing or deleting one is refused, and says that it is the step", () => {
    const content = wall([], [group("g")]);
    const commands: ContentCommand[] = [
      { type: "group.create", opId: OP, groupId: id("h"), title: "", x: 0, y: 0, w: 200, h: 200 },
      { type: "group.update", opId: OP, groupId: id("g"), x: 5 },
      { type: "group.delete", opId: OP, groupId: id("g") },
      // also what would change nothing: the answer is about the step, not about the group
      { type: "group.create", opId: OP, groupId: id("g"), title: "", x: 0, y: 0, w: 200, h: 200 },
      { type: "group.delete", opId: OP, groupId: id("h") },
    ];
    for (const command of commands) {
      for (const by of [anna, ben]) expect(hidden(content, command, by), command.type).toEqual(REFUSED("PHASE"));
    }
  });

  it("the wall's limit counts every note, hidden or not", () => {
    const full: WallReader = { ...viewOf(wall(), ben), noteCount: () => MAX_NOTES };
    const create: ContentCommand = { type: "note.create", opId: OP, noteId: id("1"), text: "Mine", x: 0, y: 0 };
    expect(decide(full, create, ben, NOW, WRITING)).toEqual(REFUSED("LIMIT"));
  });
});

describe("revealing", () => {
  // revealing is the step move from the writing step to the one that shows the notes (domain/flow.ts)
  const reveal = { type: "admin.step.go", opId: OP, from: 0, to: 1 } as const;
  const writing = initialFlow();
  const open = { ...initialFlow(), step: 1, reach: 1 };

  it("is the moderation's alone", () => {
    expect(decideStep(writing, HIDDEN_AGENDA, reveal, anna)).toMatchObject({
      kind: "changed",
      flow: { step: 1, reach: 1 },
      widens: true,
    });
    expect(decideStep(writing, HIDDEN_AGENDA, reveal, ben)).toEqual(REFUSED("NOT_ADMIN"));
    expect(decideStep(open, HIDDEN_AGENDA, reveal, ben)).toEqual(REFUSED("NOT_ADMIN"));
  });

  it("sent again it changes nothing: the wall is revealed", () => {
    expect(decideStep(open, HIDDEN_AGENDA, reveal, anna)).toEqual(UNCHANGED);
  });
});

describe("what the rules ask about the wall", () => {
  // The worker answers every question with a look into its storage, and rows read are counted (PLAN.md 3.6): a
  // command asks for what it needs and for nothing else.
  function counting(content: Stored) {
    const asked: string[] = [];
    const inner = viewOf(content, ben);
    const reader: WallReader = {
      note: (noteId) => (asked.push("note"), inner.note(noteId)),
      placement: (noteId) => (asked.push("placement"), inner.placement(noteId)),
      group: (groupId) => (asked.push("group"), inner.group(groupId)),
      noteCount: () => (asked.push("noteCount"), inner.noteCount()),
      groupOrds: () => (asked.push("groupOrds"), inner.groupOrds()),
      groups: () => (asked.push("groups"), inner.groups()),
      members: (groupId) => (asked.push("members"), inner.members(groupId)),
      arranged: () => (asked.push("arranged"), inner.arranged()),
    };
    return { reader, asked };
  }
  const content = wall([note("1", ben), note("2", ben)], [group("g")]);
  const cases: Array<[ContentCommand, string[]]> = [
    [{ type: "note.create", opId: OP, noteId: id("9"), text: "New", x: 0, y: 0 }, ["note", "noteCount"]],
    [{ type: "note.create", opId: OP, noteId: id("1"), text: "Again", x: 0, y: 0 }, ["note"]],
    [{ type: "note.update", opId: OP, noteId: id("1"), text: "Other" }, ["note"]],
    [{ type: "note.delete", opId: OP, noteId: id("1") }, ["note"]],
    [
      {
        type: "notes.move",
        opId: OP,
        moves: [
          { noteId: id("1"), x: 1, y: 1, groupId: id("g") },
          { noteId: id("2"), x: 2, y: 2, groupId: null },
        ],
      },
      ["placement", "group", "placement"],
    ],
    [
      { type: "group.create", opId: OP, groupId: id("h"), title: "", x: 0, y: 0, w: 200, h: 200 },
      ["group", "groupOrds"],
    ],
    [{ type: "group.update", opId: OP, groupId: id("g"), x: 5 }, ["group"]],
    [{ type: "group.delete", opId: OP, groupId: id("g") }, ["group"]],
  ];

  for (const [command, expected] of cases) {
    it(`${command.type}: ${expected.join(", ")}`, () => {
      const { reader, asked } = counting(content);
      decide(reader, command, ben, NOW, OPEN);
      expect(asked).toEqual(expected);
    });
  }
});
