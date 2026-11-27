// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  eventFor,
  hiddenChange,
  maySeeNote,
  noteFor,
  notesFor,
  revealedFor,
  type ContentEvent,
  type Group,
  type StoredNote,
} from "../src/index.js";

const NOW = 1_795_300_000_000;
const id = (letter: string) => letter.repeat(32);
const ANNA = id("a");
const BEN = id("b");
/** Somebody who had the wall forget them: the id names nobody any more. */
const GONE = id("e");

const stored = (letter: string, authorId: string, text = `Note ${letter}`): StoredNote => ({
  id: id(letter),
  authorId,
  text,
  x: 10,
  y: 20,
  groupId: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const WALL = [stored("1", ANNA, "Anna's first"), stored("2", BEN, "Ben's"), stored("3", ANNA), stored("4", GONE)];

describe("who may read a note", () => {
  it("their own always, anybody's once the wall is revealed", () => {
    expect(maySeeNote("hidden", { mine: true })).toBe(true);
    expect(maySeeNote("hidden", { mine: false })).toBe(false);
    expect(maySeeNote("all", { mine: true })).toBe(true);
    expect(maySeeNote("all", { mine: false })).toBe(true);
  });
});

describe("a note as one person gets it", () => {
  it("says whether it is theirs, and not whose it is", () => {
    const note = stored("1", ANNA);
    expect(noteFor(note, ANNA)).toEqual({
      id: id("1"),
      mine: true,
      text: "Note 1",
      x: 10,
      y: 20,
      groupId: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(noteFor(note, BEN).mine).toBe(false);
    for (const viewer of [ANNA, BEN, null]) {
      expect(noteFor(note, viewer)).not.toHaveProperty("authorId");
      expect(JSON.stringify(noteFor(note, viewer))).not.toContain(ANNA);
    }
  });

  it("is nobody's when its writer had the wall forget them, and for nobody in particular", () => {
    expect(noteFor(stored("4", GONE), ANNA).mine).toBe(false);
    expect(noteFor(stored("4", GONE), BEN).mine).toBe(false);
    expect(noteFor(stored("1", ANNA), null).mine).toBe(false);
  });
});

describe("the notes of a snapshot or an export", () => {
  it("while the notes are hidden: a person's own, and a number for all the others", () => {
    expect(notesFor(WALL, "hidden", ANNA)).toEqual({
      notes: [noteFor(stored("1", ANNA, "Anna's first"), ANNA), noteFor(stored("3", ANNA), ANNA)],
      hidden: 2,
    });
    expect(notesFor(WALL, "hidden", BEN)).toEqual({ notes: [noteFor(stored("2", BEN, "Ben's"), BEN)], hidden: 3 });
  });

  it("an export before revealing holds no note of somebody else: not a text, not an id, not a writer", () => {
    const forBen = JSON.stringify(notesFor(WALL, "hidden", BEN));
    for (const foreign of ["Anna's first", "Note 3", "Note 4", id("1"), id("3"), id("4"), ANNA, GONE]) {
      expect(forBen, foreign).not.toContain(foreign);
    }
    expect(forBen).toContain("Ben's");
    // for nobody in particular it holds no note at all
    expect(notesFor(WALL, "hidden", null)).toEqual({ notes: [], hidden: 4 });
    // and somebody who wrote nothing gets nothing but the number
    expect(notesFor(WALL, "hidden", id("c"))).toEqual({ notes: [], hidden: 4 });
  });

  it("once revealed: every note, in the order given, each saying whether it is the reader's", () => {
    const view = notesFor(WALL, "all", BEN);
    expect(view.hidden).toBe(0);
    expect(view.notes.map((note) => [note.id, note.mine])).toEqual([
      [id("1"), false],
      [id("2"), true],
      [id("3"), false],
      [id("4"), false],
    ]);
    expect(JSON.stringify(view)).not.toContain(ANNA);
    expect(notesFor(WALL, "all", null).notes.every((note) => !note.mine)).toBe(true);
  });

  it("an empty wall hides nothing", () => {
    expect(notesFor([], "hidden", ANNA)).toEqual({ notes: [], hidden: 0 });
  });
});

describe("revealing", () => {
  it("brings a person exactly the notes they did not have: together with their own, the whole wall", () => {
    for (const viewer of [ANNA, BEN, id("c")]) {
      const had = notesFor(WALL, "hidden", viewer);
      const revealed = revealedFor(WALL, viewer);
      expect(revealed).toHaveLength(had.hidden);
      expect(revealed.every((note) => !note.mine)).toBe(true);
      const all = [...had.notes, ...revealed].sort((a, b) => a.id.localeCompare(b.id));
      expect(all).toEqual(notesFor(WALL, "all", viewer).notes);
    }
  });
});

describe("what one person hears of a stored change", () => {
  const note = noteFor(stored("5", ANNA, "Anna's new one"), ANNA);
  const group: Group = {
    id: id("g"),
    title: "Group",
    titleSource: "person",
    locked: true,
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    ord: 1,
  };
  const events: ContentEvent[] = [
    { type: "note.created", seq: 7, note },
    { type: "note.updated", seq: 7, noteId: note.id, text: "Anna's changed one", updatedAt: NOW + 1 },
    { type: "note.deleted", seq: 7, noteId: note.id },
    { type: "notes.moved", seq: 7, moves: [{ noteId: note.id, x: 300, y: 400, groupId: null }] },
  ];

  it("while the notes are hidden: whoever made the change hears it, everybody else its number and the count", () => {
    for (const event of events) {
      expect(eventFor(event, ANNA, ANNA, "hidden", 3), event.type).toBe(event);
      const forBen = eventFor(event, ANNA, BEN, "hidden", 3);
      expect(forBen, event.type).toEqual({ type: "wall.occupancy", seq: 7, hidden: 3 });
      // nothing of the change is in it: no id, no text, no place, no writer
      expect(Object.keys(forBen).sort()).toEqual(["hidden", "seq", "type"]);
    }
  });

  it("the count moves by one with a note written or deleted, and stands still otherwise", () => {
    expect(events.map(hiddenChange)).toEqual([1, 0, -1, 0]);
    expect(hiddenChange({ type: "group.deleted", groupId: group.id })).toBe(0);
  });

  it("once revealed: everybody hears the change, and a new note says for each whether it is theirs", () => {
    const created = events[0] as ContentEvent;
    expect(eventFor(created, ANNA, ANNA, "all", 0)).toEqual({ type: "note.created", seq: 7, note });
    expect(eventFor(created, ANNA, BEN, "all", 0)).toEqual({
      type: "note.created",
      seq: 7,
      note: { ...note, mine: false },
    });
    for (const event of [...events.slice(1), { type: "group.created", seq: 7, group } as ContentEvent]) {
      expect(eventFor(event, ANNA, BEN, "all", 0), event.type).toBe(event);
      expect(eventFor(event, ANNA, ANNA, "all", 0), event.type).toBe(event);
    }
  });

  it("no frame of it names who made the change", () => {
    for (const event of events) {
      for (const sight of ["hidden", "all"] as const) {
        expect(JSON.stringify(eventFor(event, ANNA, BEN, sight, 1))).not.toContain(ANNA);
        expect(JSON.stringify(eventFor(event, ANNA, ANNA, sight, 1))).not.toContain(ANNA);
      }
    }
  });
});
