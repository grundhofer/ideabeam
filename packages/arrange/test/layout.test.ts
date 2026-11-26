// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { clientCommandSchema, COORD_LIMIT, estimateNoteHeight, NOTE_WIDTH, type Proposal } from "@ideabeam/shared";
import {
  FRAME_GAP,
  FRAME_HEAD,
  FRAME_PAD,
  layoutProposal,
  NOTE_GAP,
  type Arrangement,
  type Rect,
} from "../src/index.js";

const id = (n: number) => n.toString(16).padStart(32, "0");
const groupId = (n: number) => (0xa00 + n).toString(16).padStart(32, "0");

const SHORT = "Fewer meetings";
const LONG =
  "Every Monday half an hour of planning instead of a quarter of an hour every single day of the week, please";

/** A wall's notes by number: every third one is a long text, so rows have notes of different heights. */
const textOf = (n: number) => (n % 3 === 0 ? LONG : SHORT);
const textsFor = (count: number) => new Map(Array.from({ length: count }, (_, n) => [id(n + 1), textOf(n + 1)]));

/** A proposal with groups of these sizes, the notes numbered through, and `loose` notes after them. */
function proposalOf(sizes: number[], loose = 0): Proposal {
  let next = 1;
  const take = (count: number) => Array.from({ length: count }, () => id(next++));
  return {
    groups: sizes.map((size, n) => ({ title: `Theme ${n + 1}`, noteIds: take(size) })),
    loose: take(loose),
  };
}

function layout(sizes: number[], loose = 0, keep?: Rect[]): Arrangement {
  const total = sizes.reduce((sum, size) => sum + size, 0) + loose;
  return layoutProposal({
    proposal: proposalOf(sizes, loose),
    texts: textsFor(total),
    groupIds: sizes.map((_, n) => groupId(n + 1)),
    ...(keep === undefined ? {} : { keep }),
  });
}

const boxOf = (move: { noteId: string; x: number; y: number }, texts: Map<string, string>): Rect => ({
  x: move.x,
  y: move.y,
  w: NOTE_WIDTH,
  h: estimateNoteHeight(texts.get(move.noteId) ?? ""),
});
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const within = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

describe("the layout of a proposal", () => {
  it("is the two halves of the command that applies it, and the wall's schema takes it", () => {
    const arrangement = layout([14, 9, 30, 4], 5);
    const command = { type: "admin.arrange.apply", opId: id(999), source: "service", ...arrangement };
    expect(clientCommandSchema.safeParse(command).success).toBe(true);
    expect(arrangement.moves).toHaveLength(62);
  });

  it("lays the frames by size, largest first, and keeps each group's id and title", () => {
    const arrangement = layout([4, 30, 9, 30]);
    expect(arrangement.groups.map((group) => [group.title, group.noteIds.length, group.groupId])).toEqual([
      ["Theme 2", 30, groupId(2)],
      ["Theme 4", 30, groupId(4)],
      ["Theme 3", 9, groupId(3)],
      ["Theme 1", 4, groupId(1)],
    ]);
  });

  it("puts every note of a group inside its frame, under the room for the title, and no note on another", () => {
    const texts = textsFor(62);
    const { groups, moves } = layout([14, 9, 30, 4], 5);
    for (const group of groups) {
      const notes = moves.filter((move) => move.groupId === group.groupId);
      expect(notes.map((move) => move.noteId)).toEqual(group.noteIds);
      for (const move of notes) {
        const box = boxOf(move, texts);
        expect(
          within(box, {
            x: group.x + FRAME_PAD,
            y: group.y + FRAME_HEAD,
            w: group.w - 2 * FRAME_PAD,
            h: group.h - FRAME_HEAD - FRAME_PAD,
          }),
        ).toBe(true);
      }
    }
    const boxes = moves.map((move) => boxOf(move, texts));
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++)
        expect(overlap(boxes[a] as Rect, boxes[b] as Rect), `${a}/${b}`).toBe(false);
    }
  });

  it("lays a group's notes in rows, left to right: a row is as tall as its tallest note", () => {
    const texts = textsFor(9);
    const { groups, moves } = layout([9]);
    const [group] = groups;
    if (group === undefined) throw new Error("no group");
    // nine notes lie three beside each other
    const columns = [0, 1, 2].map((column) => group.x + FRAME_PAD + column * (NOTE_WIDTH + NOTE_GAP));
    expect(moves.map((move) => move.x)).toEqual([...columns, ...columns, ...columns]);
    const rows = [0, 3, 6].map((start) => moves.slice(start, start + 3));
    let top = group.y + FRAME_HEAD;
    for (const row of rows) {
      expect(row.map((move) => move.y)).toEqual([top, top, top]);
      top += Math.max(...row.map((move) => estimateNoteHeight(texts.get(move.noteId) ?? ""))) + NOTE_GAP;
    }
    expect(group.h).toBe(top - NOTE_GAP + FRAME_PAD - group.y);
    expect(group.w).toBe(3 * NOTE_WIDTH + 2 * NOTE_GAP + 2 * FRAME_PAD);
  });

  it("lays the frames in rows that do not touch each other", () => {
    const { groups } = layout([40, 35, 30, 25, 20, 15, 10, 5]);
    for (let a = 0; a < groups.length; a++) {
      for (let b = a + 1; b < groups.length; b++) {
        const [one, other] = [groups[a] as Rect, groups[b] as Rect];
        const apart = {
          ...one,
          x: one.x - FRAME_GAP + 1,
          y: one.y - FRAME_GAP + 1,
          w: one.w + 2 * FRAME_GAP - 2,
          h: one.h + 2 * FRAME_GAP - 2,
        };
        expect(overlap(apart, other), `${a}/${b}`).toBe(false);
      }
    }
    // more than one row of frames, and the first frame of each row at the block's left edge
    const lefts = groups.map((group) => group.x);
    const left = Math.min(...lefts);
    expect(lefts.filter((x) => x === left).length).toBeGreaterThan(1);
    expect(groups[0]).toMatchObject({ x: left, y: Math.min(...groups.map((group) => group.y)) });
  });

  it("lays frames of the same size beside each other: the block is wider than tall, never one tall column", () => {
    // Three, four and six groups of equal size: what a small wall and an even run give. A row used to end as soon
    // as the next frame passed the block's width by a few units, and such frames stood one under the other.
    for (const sizes of [
      [4, 4, 4],
      [4, 4, 4, 4],
      [20, 20, 20, 20, 20, 20],
    ]) {
      const { groups } = layout(sizes);
      const width = Math.max(...groups.map((group) => group.x + group.w)) - Math.min(...groups.map((group) => group.x));
      const height =
        Math.max(...groups.map((group) => group.y + group.h)) - Math.min(...groups.map((group) => group.y));
      expect(width, sizes.join()).toBeGreaterThan(height);
      // and more than one frame in the first row
      expect(groups.filter((group) => group.y === groups[0]?.y).length, sizes.join()).toBeGreaterThan(1);
    }
  });

  it("puts the notes without a group in rows under the frames, outside every frame", () => {
    const texts = textsFor(31);
    const { groups, moves } = layout([12, 12], 7);
    const loose = moves.filter((move) => move.groupId === null);
    expect(loose.map((move) => move.noteId)).toEqual([25, 26, 27, 28, 29, 30, 31].map(id));
    const bottom = Math.max(...groups.map((group) => group.y + group.h));
    for (const move of loose) {
      expect(move.y).toBeGreaterThanOrEqual(bottom + 2 * FRAME_GAP);
      for (const group of groups) expect(overlap(boxOf(move, texts), group)).toBe(false);
    }
    expect(Math.min(...loose.map((move) => move.x))).toBe(Math.min(...groups.map((group) => group.x)));
  });

  it("lies around the world's origin on a wall where nothing stays", () => {
    const { groups, moves } = layout([14, 9, 30, 4], 5);
    const texts = textsFor(62);
    const boxes = [...groups, ...moves.map((move) => boxOf(move, texts))];
    const left = Math.min(...boxes.map((box) => box.x));
    const right = Math.max(...boxes.map((box) => box.x + box.w));
    const top = Math.min(...boxes.map((box) => box.y));
    const bottom = Math.max(...boxes.map((box) => box.y + box.h));
    expect(Math.abs(left + right)).toBeLessThanOrEqual(1);
    expect(Math.abs(top + bottom)).toBeLessThanOrEqual(1);
  });

  it("lies under everything that stays: the locked groups and their notes are not covered", () => {
    const keep: Rect[] = [
      { x: -300, y: -200, w: 600, h: 400 },
      { x: 500, y: 100, w: 240, h: 900 },
    ];
    const { groups, moves } = layout([14, 9], 3, keep);
    const texts = textsFor(26);
    for (const box of [...groups, ...moves.map((move) => boxOf(move, texts))]) {
      expect(box.y).toBeGreaterThanOrEqual(1000 + 2 * FRAME_GAP);
      expect(box.x).toBeGreaterThanOrEqual(-300);
      for (const kept of keep) expect(overlap(box, kept)).toBe(false);
    }
    expect(Math.min(...groups.map((group) => group.x))).toBe(-300);
    expect(Math.min(...groups.map((group) => group.y))).toBe(1000 + 2 * FRAME_GAP);
  });

  it("gives the same places for the same proposal, on every device: whole numbers, from the texts alone", () => {
    const first = layout([14, 9, 30, 4], 5);
    expect(layout([14, 9, 30, 4], 5)).toEqual(first);
    for (const value of [
      ...first.groups.flatMap((g) => [g.x, g.y, g.w, g.h]),
      ...first.moves.flatMap((m) => [m.x, m.y]),
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("holds a whole wall: 500 notes in eight groups stay on the surface's numbers", () => {
    const sizes = [120, 90, 80, 60, 50, 40, 30, 20];
    const arrangement = layout(sizes, 10);
    const command = { type: "admin.arrange.apply", opId: id(999), source: "service", ...arrangement };
    expect(clientCommandSchema.safeParse(command).success).toBe(true);
    expect(arrangement.moves).toHaveLength(500);
    // also when what stays lies at the very edge of the surface: the block is pushed back onto it
    const edge = layout(sizes, 10, [{ x: COORD_LIMIT - 300, y: COORD_LIMIT - 300, w: 240, h: 200 }]);
    expect(clientCommandSchema.safeParse({ ...command, ...edge }).success).toBe(true);
  });

  it("leaves a note out that is no longer on the wall, and makes no group that keeps no note", () => {
    const proposal = proposalOf([3, 2], 2);
    const texts = textsFor(7);
    for (const gone of [id(4), id(5), id(6)]) texts.delete(gone);
    const { groups, moves } = layoutProposal({ proposal, texts, groupIds: [groupId(1), groupId(2)] });
    expect(groups.map((group) => group.groupId)).toEqual([groupId(1)]);
    expect(moves.map((move) => move.noteId)).toEqual([id(1), id(2), id(3), id(7)]);
  });

  it("gives one note a frame of its own that the wall takes, and two notes a row", () => {
    const one = layout([1, 2]);
    expect(
      clientCommandSchema.safeParse({ type: "admin.arrange.apply", opId: id(999), source: "browser", ...one }).success,
    ).toBe(true);
    const [two, single] = one.groups;
    expect(single).toMatchObject({
      w: NOTE_WIDTH + 2 * FRAME_PAD,
      h: FRAME_HEAD + estimateNoteHeight(textOf(1)) + FRAME_PAD,
    });
    expect(two?.w).toBe(2 * NOTE_WIDTH + NOTE_GAP + 2 * FRAME_PAD);
  });
});
