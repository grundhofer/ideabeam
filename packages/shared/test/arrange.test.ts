// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  applyChange,
  decide,
  MAX_GROUPS,
  numbersOf,
  readerOf,
  type Actor,
  type ArrangeRecord,
  type ContentCommand,
  type Decision,
  type Group,
  type Note,
  type WallContent,
  type WallReader,
  type StepContext,
} from "../src/index.js";
import { OPEN, WRITING } from "./steps.js";

// Arranging as the wall decides it (domain/arrange.ts): what an arrangement may touch, what it leaves behind, and
// that taking it back brings the wall back. The wall of these tests is played here in memory: what the rules decide
// is applied by the shared reducer, and what the wall remembers of a run is kept beside it, as the worker keeps it
// in its storage.

const NOW = 1_795_300_000_000;
const id = (letter: string) => letter.repeat(32);

const anna: Actor = { id: id("a"), role: "admin" };
const ben: Actor = { id: id("b"), role: "member" };

const note = (letter: string, more: Partial<Note> = {}): Note => ({
  id: id(letter),
  mine: false,
  text: `Note ${letter}`,
  x: 0,
  y: 0,
  groupId: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...more,
});

/** A group a person made by hand: locked, its title theirs. */
const byHand = (letter: string, more: Partial<Group> = {}): Group => ({
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

/** A wall and what it remembers of its last run. */
interface Wall extends WallContent {
  record: ArrangeRecord | null;
}

const readerFor = (wall: Wall): WallReader => ({ ...readerOf(wall), arranged: () => wall.record });

const ask = (wall: Wall, command: ContentCommand, by: Actor = anna, ctx: StepContext = OPEN): Decision =>
  decide(readerFor(wall), command, by, NOW, ctx);

/** The wall after a command the rules took: its content, and what it remembers. */
function after(wall: Wall, command: ContentCommand, by: Actor = anna): Wall {
  const decision = ask(wall, command, by);
  if (decision.kind !== "changed") throw new Error(`${command.type} was not taken: ${JSON.stringify(decision)}`);
  const record =
    decision.change.type === "arrange.applied"
      ? (decision.record ?? null)
      : decision.change.type === "arrange.undone"
        ? null
        : wall.record;
  return { ...applyChange(wall, decision.change), record };
}

type Apply = Extract<ContentCommand, { type: "admin.arrange.apply" }>;

/** An arrangement: each group with the letters of its notes, the notes one under the other in its frame; the
 *  letters in `loose` in a row without a group. */
function arrangement(run: string, groups: Record<string, string>, loose = ""): Apply {
  const made = Object.entries(groups).map(([letter, notes], column) => ({
    groupId: id(letter),
    title: `Theme ${letter}`,
    x: 1000 + column * 400,
    y: 1000,
    w: 300,
    h: 600,
    noteIds: [...notes].map(id),
  }));
  return {
    type: "admin.arrange.apply",
    opId: id(run),
    source: "service",
    groups: made,
    moves: [
      ...made.flatMap((group) =>
        group.noteIds.map((noteId, row) => ({
          noteId,
          x: group.x + 16,
          y: group.y + 40 + row * 120,
          groupId: group.groupId,
        })),
      ),
      ...[...loose].map((letter, column) => ({ noteId: id(letter), x: 1000 + column * 260, y: 2000, groupId: null })),
    ],
  };
}

const undo = (run: string, opId = "0"): ContentCommand => ({
  type: "admin.arrange.undo",
  opId: id(opId),
  runId: id(run),
});

/** Six notes scattered over the wall, in no group. */
const scattered = (): Note[] => [..."123456"].map((letter, n) => note(letter, { x: n * 37 - 90, y: n * -53 + 11 }));

const empty = (notes: Note[], groups: Group[] = []): Wall => ({ notes, groups, record: null });

describe("applying an arrangement", () => {
  it("is the moderation's, and only once the notes are revealed", () => {
    const wall = empty(scattered());
    const command = arrangement("r", { c: "123", d: "456" });
    expect(ask(wall, command, ben)).toEqual({ kind: "refused", code: "NOT_ADMIN" });
    expect(ask(wall, command, anna, WRITING)).toEqual({ kind: "refused", code: "PHASE" });
    expect(ask(wall, command, anna).kind).toBe("changed");
  });

  it("makes the groups, the AI's and not locked, in the order of the command, and puts every note where it says", () => {
    const wall = empty(scattered(), [byHand("h", { ord: 4 })]);
    const command = arrangement("r", { c: "12", d: "345" }, "6");
    const decision = ask(wall, command);
    expect(decision).toMatchObject({
      kind: "changed",
      change: {
        type: "arrange.applied",
        runId: id("r"),
        source: "service",
        groups: [
          { id: id("c"), title: "Theme c", titleSource: "ki", locked: false, x: 1000, y: 1000, w: 300, h: 600, ord: 5 },
          { id: id("d"), title: "Theme d", titleSource: "ki", locked: false, ord: 6 },
        ],
        moves: command.moves,
        removed: [],
      },
    });
    const arranged = after(wall, command);
    expect(arranged.groups.map((group) => group.id)).toEqual([id("h"), id("c"), id("d")]);
    expect(arranged.notes.map(({ id: noteId, x, y, groupId }) => ({ noteId, x, y, groupId }))).toEqual(
      [...command.moves].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    );
  });

  it("remembers where every note it moved lay, and which groups it made: what taking it back needs", () => {
    const wall = empty(scattered());
    const decision = ask(wall, arrangement("r", { c: "123", d: "456" }));
    expect(decision.kind === "changed" && decision.record).toEqual({
      runId: id("r"),
      before: Object.fromEntries(wall.notes.map((n) => [n.id, [n.x, n.y, null]])),
      made: [id("c"), id("d")],
      gone: [],
    });
  });

  it("leaves a note alone that lies where the arrangement wants it, in no group: nothing to move, nothing to put back", () => {
    const wall = empty([...scattered().slice(0, 5), note("6", { x: 1000, y: 2000 })]);
    const decision = ask(wall, arrangement("r", { c: "12345" }, "6"));
    if (decision.kind !== "changed" || decision.change.type !== "arrange.applied") throw new Error("not applied");
    expect(decision.change.moves.map((move) => move.noteId)).not.toContain(id("6"));
    expect(decision.record?.before).not.toHaveProperty(id("6"));
  });

  it("is refused as a whole when it names a note that is gone, and changes nothing", () => {
    const wall = empty(scattered().slice(0, 5));
    expect(ask(wall, arrangement("r", { c: "123", d: "456" }))).toEqual({ kind: "refused", code: "NOT_FOUND" });
  });

  it("never touches a locked group: a note that lies in one is not the arrangement's to move", () => {
    const hand = byHand("h");
    const notes = scattered().map((n) => (n.id === id("3") ? { ...n, groupId: hand.id } : n));
    const wall = empty(notes, [hand]);
    expect(ask(wall, arrangement("r", { c: "123", d: "456" }))).toEqual({ kind: "refused", code: "CONFLICT" });
    // without that note the arrangement is taken, and the locked group and its note are as they were
    const arranged = after(wall, arrangement("r", { c: "12", d: "456" }));
    expect(arranged.groups.find((group) => group.id === hand.id)).toEqual(hand);
    expect(arranged.notes.find((n) => n.id === id("3"))).toEqual(notes[2]);
  });

  it("makes groups under ids of its own: an id that is a group's already is refused, locked or not", () => {
    const wall = empty(scattered(), [byHand("c")]);
    expect(ask(wall, arrangement("r", { c: "123", d: "456" }))).toEqual({ kind: "refused", code: "CONFLICT" });
    const unlocked = empty(scattered(), [byHand("c", { locked: false, titleSource: "ki" })]);
    expect(ask(unlocked, arrangement("r", { c: "123", d: "456" }))).toEqual({ kind: "refused", code: "CONFLICT" });
  });

  it(`stops at ${MAX_GROUPS} groups, counting the frames it takes away as gone`, () => {
    const hands = Array.from({ length: MAX_GROUPS - 1 }, (_, n) =>
      byHand("h", { id: (n + 1).toString(16).padStart(32, "f"), ord: n + 1 }),
    );
    const full = empty(scattered(), hands);
    expect(ask(full, arrangement("r", { c: "123", d: "456" }))).toEqual({ kind: "refused", code: "LIMIT" });
    expect(ask(full, arrangement("r", { c: "123456" })).kind).toBe("changed");
    // a second run takes the first one's frame away and may make one in its place
    const once = after(full, arrangement("r", { c: "123456" }));
    expect(once.groups).toHaveLength(MAX_GROUPS);
    expect(ask(once, arrangement("s", { d: "123456" })).kind).toBe("changed");
    expect(ask(once, arrangement("s", { d: "123", e: "456" }))).toEqual({ kind: "refused", code: "LIMIT" });
  });

  it("sent again it finds itself applied: nothing changes, nothing is told", () => {
    const wall = empty(scattered());
    const command = arrangement("r", { c: "123", d: "456" });
    expect(ask(after(wall, command), command)).toEqual({ kind: "unchanged" });
  });
});

describe("a second run", () => {
  const first = arrangement("r", { c: "123", d: "456" });

  it("takes the frames of the first away when it takes all their notes", () => {
    const once = after(empty(scattered()), first);
    const decision = ask(once, arrangement("s", { e: "1245", f: "36" }));
    expect(decision).toMatchObject({ change: { removed: [id("c"), id("d")] }, record: { made: [id("e"), id("f")] } });
    const twice = after(once, arrangement("s", { e: "1245", f: "36" }));
    expect(twice.groups.map((group) => group.id)).toEqual([id("e"), id("f")]);
    // what it remembers is its own run: the frames it took away, as they were, and where the notes lay in them
    expect(twice.record?.gone).toEqual(once.groups);
    expect(twice.record?.before[id("1")]).toEqual([1016, 1040, id("c")]);
  });

  it("leaves a frame of the first that keeps a note the second does not name", () => {
    const once = after(empty([...scattered(), note("7")]), arrangement("r", { c: "1237", d: "456" }));
    const twice = after(once, arrangement("s", { e: "123456" }));
    expect(twice.groups.map((group) => group.id)).toEqual([id("c"), id("e")]);
    expect(twice.notes.find((n) => n.id === id("7"))?.groupId).toBe(id("c"));
  });

  it("leaves a group a person renamed since, and the notes in it: renaming locked it, and taking the second run back leaves it too", () => {
    const once = after(empty(scattered()), first);
    const renamed = after(once, { type: "group.update", opId: id("0"), groupId: id("c"), title: "Ours" }, ben);
    expect(renamed.groups[0]).toMatchObject({ id: id("c"), title: "Ours", titleSource: "person", locked: true });
    const kept = renamed.notes.filter((n) => n.groupId === id("c"));
    expect(kept.map((n) => n.id)).toEqual([id("1"), id("2"), id("3")]);
    // a run that names one of its notes is refused as a whole
    expect(ask(renamed, arrangement("s", { e: "1245", f: "36" }))).toEqual({ kind: "refused", code: "CONFLICT" });
    // and no run writes a title of a group that is there: naming its id is refused
    expect(ask(renamed, arrangement("s", { c: "456" }))).toEqual({ kind: "refused", code: "CONFLICT" });
    // a run over the rest takes the other frame of the first run away, and nothing of the renamed group
    const second = arrangement("s", { e: "45", f: "6" });
    expect(ask(renamed, second)).toMatchObject({ change: { removed: [id("d")] }, record: { gone: [once.groups[1]] } });
    const twice = after(renamed, second);
    expect(twice.groups.map((group) => group.id)).toEqual([id("c"), id("e"), id("f")]);
    expect(twice.groups[0]).toEqual(renamed.groups[0]);
    expect(twice.notes.filter((n) => n.groupId === id("c"))).toEqual(kept);
    // taking the second run back brings the wall back that it found: the renamed group with its notes, as it stood
    const back = after(twice, undo("s"));
    expect(back.groups).toEqual(renamed.groups);
    expect(back.notes).toEqual(renamed.notes);
  });

  it("a group of an older build's run that carries a person's title without being locked behaves as it did then", () => {
    // Before renaming locked a group, a renamed group of a run kept `locked: false`. A wall arranged then still holds
    // such a group, and nothing migrates it.
    const once = after(empty(scattered()), first);
    const legacy: Wall = {
      ...once,
      groups: once.groups.map((group) =>
        group.id === id("c") ? { ...group, title: "Ours", titleSource: "person", locked: false } : group,
      ),
    };
    // a run takes its notes; only the frame whose title is still the AI's goes, this one stays, empty, with its title
    const second = arrangement("s", { e: "1245", f: "36" });
    expect(ask(legacy, second)).toMatchObject({ change: { removed: [id("d")] } });
    const twice = after(legacy, second);
    expect(twice.groups.find((group) => group.id === id("c"))).toEqual(legacy.groups[0]);
    expect(twice.notes.every((n) => n.groupId !== id("c"))).toBe(true);
    // no run writes its title: naming its id is refused
    expect(ask(legacy, arrangement("s", { c: "123456" }))).toEqual({ kind: "refused", code: "CONFLICT" });
    // taking back the run that made it takes it away with the run's other group
    expect(ask(legacy, undo("r"))).toMatchObject({ change: { removed: [id("c"), id("d")] } });
    expect(after(legacy, undo("r"))).toMatchObject({ groups: [], notes: scattered() });
    // renamed once more, it is locked like every other: the run that made it leaves it from then on
    const again = after(legacy, { type: "group.update", opId: id("0"), groupId: id("c"), title: "Ours, again" }, ben);
    expect(again.groups[0]).toMatchObject({ title: "Ours, again", titleSource: "person", locked: true });
    expect(ask(again, undo("r"))).toMatchObject({ change: { removed: [id("d")] } });
  });

  it("leaves a group made by hand alone, empty or not", () => {
    const hand = byHand("h", { ord: 9 });
    const once = after(empty(scattered(), [hand]), first);
    const twice = after(once, arrangement("s", { e: "123456" }));
    expect(twice.groups.find((group) => group.id === hand.id)).toEqual(hand);
  });
});

describe("taking an arrangement back", () => {
  const command = arrangement("r", { c: "123", d: "45" }, "6");

  it("is the moderation's, and names the run it means", () => {
    const arranged = after(empty(scattered()), command);
    expect(ask(arranged, undo("r"), ben)).toEqual({ kind: "refused", code: "NOT_ADMIN" });
    expect(ask(arranged, undo("r"), anna, WRITING)).toEqual({ kind: "refused", code: "PHASE" });
    // another run than the wall's last one cannot be taken back any more
    expect(ask(arranged, undo("q"))).toEqual({ kind: "refused", code: "STALE" });
    expect(ask(arranged, undo("r")).kind).toBe("changed");
  });

  it("restores every position exactly: each note lies where it lay, in the group it was in, and the run's groups are gone", () => {
    const hand = byHand("h");
    const before = empty(
      scattered().map((n, index) => (index === 0 ? { ...n, x: -4821, y: 37, groupId: null } : n)),
      [hand],
    );
    const arranged = after(before, command);
    expect(arranged.notes).not.toEqual(before.notes);
    const back = after(arranged, undo("r"));
    expect(back.notes).toEqual(before.notes);
    expect(back.groups).toEqual(before.groups);
    expect(back.record).toBeNull();
  });

  it("restores the wall a second run found: the first run's frames are back, with the notes in them", () => {
    const once = after(empty(scattered()), arrangement("r", { c: "123", d: "456" }));
    const twice = after(once, arrangement("s", { e: "1245", f: "36" }));
    const back = after(twice, undo("s"));
    expect(back.notes).toEqual(once.notes);
    expect(back.groups).toEqual(once.groups);
    // what the wall remembered of the first run is gone: one step back, not two
    expect(ask(back, undo("r"))).toEqual({ kind: "unchanged" });
  });

  it("sent again, or with nothing to take back, it changes nothing", () => {
    const wall = empty(scattered());
    expect(ask(wall, undo("r"))).toEqual({ kind: "unchanged" });
    expect(ask(after(after(wall, command), undo("r")), undo("r", "9"))).toEqual({ kind: "unchanged" });
  });

  it("puts a note back that somebody moved since, and leaves alone what the run never moved", () => {
    const before = empty([...scattered(), note("7", { x: 5, y: 5 })]);
    let wall = after(before, command);
    // Ben drags a note of the run somewhere else, moves the note the run did not touch, and writes a new one
    wall = after(wall, {
      type: "notes.move",
      opId: id("0"),
      moves: [
        { noteId: id("1"), x: 777, y: 777, groupId: id("d") },
        { noteId: id("7"), x: 9, y: 9, groupId: id("c") },
      ],
    });
    wall = after(wall, { type: "note.create", opId: id("0"), noteId: id("8"), text: "Late", x: 1, y: 2 }, ben);
    const back = after(wall, undo("r"));
    expect(back.notes.find((n) => n.id === id("1"))).toMatchObject({ x: -90, y: 11, groupId: null });
    // the note the run never moved keeps its place; the group it was put into is gone, so it has none
    expect(back.notes.find((n) => n.id === id("7"))).toMatchObject({ x: 9, y: 9, groupId: null });
    expect(back.notes.find((n) => n.id === id("8"))).toMatchObject({ x: 1, y: 2, groupId: null });
    expect(back.groups).toEqual([]);
  });

  it("leaves a note that was deleted since deleted, and a note that lies in a locked group now where it is", () => {
    const hand = byHand("h");
    let wall = after(empty(scattered(), [hand]), command);
    wall = after(wall, { type: "note.delete", opId: id("0"), noteId: id("2") });
    wall = after(wall, {
      type: "notes.move",
      opId: id("0"),
      moves: [{ noteId: id("4"), x: 20, y: 60, groupId: hand.id }],
    });
    const decision = ask(wall, undo("r"));
    if (decision.kind !== "changed" || decision.change.type !== "arrange.undone") throw new Error("not undone");
    expect(decision.change.moves.map((move) => move.noteId).sort()).toEqual([id("1"), id("3"), id("5"), id("6")]);
    const back = after(wall, undo("r"));
    expect(back.notes.some((n) => n.id === id("2"))).toBe(false);
    expect(back.notes.find((n) => n.id === id("4"))).toMatchObject({ x: 20, y: 60, groupId: hand.id });
    expect(back.groups).toEqual([hand]);
  });

  it("takes every group of the run away, also one somebody moved or resized since; one deleted since is gone already", () => {
    let wall = after(empty(scattered()), arrangement("r", { c: "12", d: "34", e: "56" }));
    wall = after(wall, { type: "group.update", opId: id("0"), groupId: id("c"), x: 5, w: 900 }, ben);
    expect(wall.groups[0]).toMatchObject({ id: id("c"), x: 5, w: 900, locked: false });
    wall = after(wall, { type: "group.delete", opId: id("0"), groupId: id("e") }, ben);
    const decision = ask(wall, undo("r"));
    expect(decision).toMatchObject({ change: { type: "arrange.undone", removed: [id("c"), id("d")], restored: [] } });
    const back = after(wall, undo("r"));
    expect(back.groups).toEqual([]);
    expect(back.notes).toEqual(scattered());
  });

  it("leaves a group of the run that a person renamed since, with the notes in it: it is locked, and its notes are not put back", () => {
    const before = empty(scattered());
    let wall = after(before, arrangement("r", { c: "12", d: "34", e: "56" }));
    wall = after(wall, { type: "group.update", opId: id("0"), groupId: id("d"), title: "Ours" }, ben);
    // since then a note of another group of the run was dragged into the renamed one, and one of its own out of it
    wall = after(wall, {
      type: "notes.move",
      opId: id("0"),
      moves: [
        { noteId: id("5"), x: 1420, y: 1300, groupId: id("d") },
        { noteId: id("4"), x: 50, y: 60, groupId: null },
      ],
    });
    const renamed = wall.groups.find((group) => group.id === id("d"));
    expect(renamed).toMatchObject({ title: "Ours", titleSource: "person", locked: true });
    const inIt = wall.notes.filter((n) => n.groupId === id("d"));
    expect(inIt.map((n) => n.id)).toEqual([id("3"), id("5")]);

    const decision = ask(wall, undo("r"));
    if (decision.kind !== "changed" || decision.change.type !== "arrange.undone") throw new Error("not undone");
    // the renamed group is not among those that go, and no note that lies in it is moved
    expect(decision.change.removed).toEqual([id("c"), id("e")]);
    expect(decision.change.restored).toEqual([]);
    expect(decision.change.moves.map((move) => move.noteId).sort()).toEqual([id("1"), id("2"), id("4"), id("6")]);

    const back = after(wall, undo("r"));
    expect(back.groups).toEqual([renamed]);
    expect(back.notes.filter((n) => n.groupId === id("d"))).toEqual(inIt);
    // every other note of the run lies where it lay before the run, also the one that was dragged out of the group
    for (const letter of "1246") {
      expect(back.notes.find((n) => n.id === id(letter))).toEqual(before.notes.find((n) => n.id === id(letter)));
    }
    // the run is taken back: nothing is left to take back, and the group is a person's group like any other
    expect(back.record).toBeNull();
    expect(ask(back, undo("r"))).toEqual({ kind: "unchanged" });
  });

  it("brings a frame back that the run took away, unless somebody made a group under its id since", () => {
    const once = after(empty(scattered()), arrangement("r", { c: "123", d: "456" }));
    let twice = after(once, arrangement("s", { e: "123456" }));
    twice = after(
      twice,
      { type: "group.create", opId: id("0"), groupId: id("c"), title: "Mine", x: 0, y: 0, w: 200, h: 200 },
      ben,
    );
    const back = after(twice, undo("s"));
    expect(back.groups.map((group) => [group.id, group.title])).toEqual([
      [id("d"), "Theme d"],
      [id("c"), "Mine"],
    ]);
    // the notes that lay in the frame that is not back have no group; their places are the old ones
    expect(back.notes.find((n) => n.id === id("1"))).toMatchObject({ x: 1016, y: 1040, groupId: null });
    expect(back.notes.find((n) => n.id === id("4"))).toMatchObject({ x: 1416, y: 1040, groupId: id("d") });
  });

  it("in a browser shows nothing before the wall has spoken: a browser knows which run it was, not what the wall remembers", () => {
    const arranged = after(empty(scattered()), command);
    const browser = readerOf(arranged, id("r"));
    expect(decide(browser, undo("r"), anna, NOW, OPEN)).toEqual({ kind: "unchanged" });
    expect(decide(browser, undo("q"), anna, NOW, OPEN)).toEqual({ kind: "refused", code: "STALE" });
    // and the same arrangement sent again is known as applied there too
    expect(decide(browser, command, anna, NOW, OPEN)).toEqual({ kind: "unchanged" });
  });
});

describe("how an arrangement counts", () => {
  it("takes as many numbers as rows it writes: every group that comes or goes, and the two rows of the layout", () => {
    const wall = empty(scattered());
    const first = ask(wall, arrangement("r", { c: "12", d: "34", e: "56" }));
    if (first.kind !== "changed") throw new Error("not applied");
    expect(numbersOf(first.change)).toBe(3 + 2);
    // a second run takes the first one's three frames away and makes two: seven rows
    const once = after(wall, arrangement("r", { c: "12", d: "34", e: "56" }));
    const second = ask(once, arrangement("s", { f: "123", g: "456" }));
    if (second.kind !== "changed") throw new Error("not applied");
    expect(numbersOf(second.change)).toBe(2 + 3 + 2);
    // taking it back takes two frames away and brings three back
    const back = ask(after(once, arrangement("s", { f: "123", g: "456" })), undo("s"));
    if (back.kind !== "changed") throw new Error("not undone");
    expect(numbersOf(back.change)).toBe(3 + 2 + 2);
  });

  it("every other change takes one number", () => {
    expect(numbersOf({ type: "note.deleted", noteId: id("1") })).toBe(1);
    expect(numbersOf({ type: "group.deleted", groupId: id("c") })).toBe(1);
    expect(numbersOf({ type: "notes.moved", moves: [{ noteId: id("1"), x: 0, y: 0, groupId: null }] })).toBe(1);
  });
});
