import { expect, test } from "vitest";
import { COORD_LIMIT, GROUP_MAX_SIZE, GROUP_MIN_SIZE, NOTE_WIDTH, type Group, type Note } from "@ideabeam/shared";
import {
  changing,
  everything,
  frameAround,
  framed,
  GROUP_HEAD,
  GROUP_PAD,
  groupAt,
  groupOf,
  looseFrame,
  looseSpot,
  movedTo,
  NEW_GROUP,
  placeIn,
  placeOutside,
  reframed,
  shifted,
} from "./groups";
import { boxOf, crowds, GAP, inside, sizeOf } from "./notes";
import type { Box } from "./view";

const SIZE = sizeOf("Idee");

const group = (id: string, x: number, y: number, w = 600, h = 400, ord = 1): Group => ({
  id,
  title: id,
  titleSource: "person",
  locked: true,
  x,
  y,
  w,
  h,
  ord,
});
const note = (id: string, x: number, y: number, groupId: string | null = null): Note => ({
  id,
  mine: false,
  text: "Idee",
  x,
  y,
  groupId,
  createdAt: 1,
  updatedAt: 1,
});
const byId = (notes: Note[]) => new Map(notes.map((one) => [one.id, one]));

test("a point lies in the frame around it, and in none outside every frame", () => {
  const groups = [group("a", 0, 0), group("b", 1000, 0)];
  expect(groupAt({ x: 10, y: 10 }, groups)?.id).toBe("a");
  expect(groupAt({ x: 1300, y: 200 }, groups)?.id).toBe("b");
  expect(groupAt({ x: 800, y: 200 }, groups)).toBeNull();
  // the left and the top edge belong to the frame, the right and the bottom edge do not
  expect(groupAt({ x: 0, y: 0 }, groups)?.id).toBe("a");
  expect(groupAt({ x: 600, y: 10 }, groups)).toBeNull();
  expect(groupAt({ x: 10, y: 400 }, groups)).toBeNull();
  expect(groupAt({ x: 10, y: 10 }, [])).toBeNull();
});

test("where frames lie over each other, the smaller one holds the point; equally large, the later one", () => {
  const outer = group("outer", 0, 0, 1000, 800);
  const inner = group("inner", 100, 100, 300, 300);
  expect(groupAt({ x: 200, y: 200 }, [outer, inner])?.id).toBe("inner");
  expect(groupAt({ x: 200, y: 200 }, [inner, outer])?.id).toBe("inner");
  expect(groupAt({ x: 600, y: 600 }, [outer, inner])?.id).toBe("outer");
  expect(groupAt({ x: 10, y: 10 }, [group("first", 0, 0), group("second", 0, 0)])?.id).toBe("second");
});

test("a note belongs to the frame its middle lies in", () => {
  const groups = [group("a", 0, 0)];
  // its corner is outside, its middle inside
  expect(groupOf({ x: -100, y: -40, ...SIZE }, groups)).toBe("a");
  // its corner is inside, its middle outside
  expect(groupOf({ x: 590, y: 390, ...SIZE }, groups)).toBeNull();
});

test("„Alles zeigen“ shows the notes and the frames: the smallest box around all of them", () => {
  expect(everything([], [])).toBeNull();
  expect(everything([note("n", 0, 0)], [])).toEqual({ x: 0, y: 0, ...SIZE });
  // an empty frame far from the notes is shown too
  expect(everything([note("n", 0, 0)], [group("a", 2000, -300, 400, 300)])).toEqual({
    x: 0,
    y: -300,
    w: 2400,
    h: 300 + SIZE.h,
  });
  expect(everything([], [group("a", -50, -60, 200, 100)])).toEqual({ x: -50, y: -60, w: 200, h: 100 });
});

test("a frame keeps inside the protocol's limits: whole units, sides between the smallest and the largest", () => {
  expect(framed({ x: 10.4, y: -3.6, w: 200.5, h: 12 })).toEqual({ x: 10, y: -4, w: 201, h: GROUP_MIN_SIZE });
  expect(framed({ x: COORD_LIMIT + 9, y: 0, w: 99_999, h: 300 })).toEqual({
    x: COORD_LIMIT,
    y: 0,
    w: GROUP_MAX_SIZE,
    h: 300,
  });
});

test("the frame of a new group around notes: the title's room above them, the edge's room around them", () => {
  const boxes = [boxOf(note("a", 100, 200)), boxOf(note("b", 400, 360))];
  const frame = frameAround(boxes);
  expect(frame).toEqual({
    x: 100 - GROUP_PAD,
    y: 200 - GROUP_HEAD,
    w: 300 + NOTE_WIDTH + 2 * GROUP_PAD,
    h: 160 + SIZE.h + GROUP_HEAD + GROUP_PAD,
  });
  // every note it was drawn around belongs to it
  for (const box of boxes) expect(groupOf(box, [{ ...frame, id: "new" }])).toBe("new");
});

test("a new frame has room for four short notes", () => {
  const { spots, frame } = placeIn({ x: 0, y: 0, ...NEW_GROUP }, [SIZE, SIZE, SIZE, SIZE], []);
  expect(frame).toEqual({ x: 0, y: 0, ...NEW_GROUP });
  expect(spots).toEqual([
    { x: GROUP_PAD, y: GROUP_HEAD },
    { x: GROUP_PAD + NOTE_WIDTH + GAP, y: GROUP_HEAD },
    { x: GROUP_PAD, y: GROUP_HEAD + SIZE.h + GAP },
    { x: GROUP_PAD + NOTE_WIDTH + GAP, y: GROUP_HEAD + SIZE.h + GAP },
  ]);
});

test("a free place inside a frame: beside and under what lies there, covering nothing", () => {
  const frame: Box = { x: 1000, y: 500, ...NEW_GROUP };
  const there = { x: 1000 + GROUP_PAD, y: 500 + GROUP_HEAD, ...SIZE };
  const { spots, frame: after } = placeIn(frame, [SIZE, SIZE], [there]);
  expect(after).toEqual(frame);
  expect(spots).toEqual([
    { x: there.x + NOTE_WIDTH + GAP, y: there.y },
    { x: there.x, y: there.y + SIZE.h + GAP },
  ]);
  const inner = { x: frame.x, y: frame.y + GROUP_HEAD - 1, w: frame.w, h: frame.h };
  for (const spot of spots) {
    expect(inside({ ...spot, ...SIZE }, inner)).toBe(true);
    expect(crowds({ ...spot, ...SIZE }, there, GAP)).toBe(false);
  }
});

test("a frame whose room is used up grows downwards; one narrower than a note grows to the right", () => {
  const frame: Box = { x: 0, y: 0, ...NEW_GROUP };
  const five = placeIn(frame, [SIZE, SIZE, SIZE, SIZE, SIZE], []);
  expect(five.spots[4]).toEqual({ x: GROUP_PAD, y: GROUP_HEAD + 2 * (SIZE.h + GAP) });
  expect(five.frame).toEqual({ ...frame, h: GROUP_HEAD + 3 * SIZE.h + 2 * GAP + GROUP_PAD });
  // the smallest frame there is takes a note all the same
  const small = placeIn({ x: 0, y: 0, w: GROUP_MIN_SIZE, h: GROUP_MIN_SIZE }, [SIZE], []);
  expect(small.spots).toEqual([{ x: GROUP_PAD, y: GROUP_HEAD }]);
  expect(small.frame).toEqual({ x: 0, y: 0, w: NOTE_WIDTH + 2 * GROUP_PAD, h: GROUP_HEAD + SIZE.h + GROUP_PAD });
  // a note that lies right under the frame is not covered when the frame grows: the new one goes past it
  const under = { x: GROUP_PAD, y: NEW_GROUP.h + 4, ...SIZE };
  const past = placeIn(frame, [SIZE, SIZE, SIZE, SIZE, SIZE], [under]);
  expect(crowds({ ...past.spots[4]!, ...SIZE }, under, GAP)).toBe(false);
  expect(past.spots[4]!.y).toBe(under.y + SIZE.h + GAP);
});

test("a note that leaves its group gets the nearest free place outside every frame", () => {
  const frame = { x: 0, y: 0, ...NEW_GROUP };
  const inFrame = { x: GROUP_PAD, y: GROUP_HEAD, ...SIZE };
  const within = { x: -2000, y: -2000, w: 4000, h: 4000 };
  const [spot] = placeOutside([inFrame], [frame], within);
  expect(crowds({ ...spot!, ...SIZE }, frame, GAP)).toBe(false);
  // beside the frame it came out of, not somewhere far off
  expect(Math.abs(spot!.x - inFrame.x) + Math.abs(spot!.y - inFrame.y)).toBeLessThan(NEW_GROUP.w + NEW_GROUP.h);
  // two notes that leave together do not land on each other
  const second = { x: GROUP_PAD + NOTE_WIDTH + GAP, y: GROUP_HEAD, ...SIZE };
  const [one, two] = placeOutside([inFrame, second], [frame], within);
  expect(crowds({ ...one!, ...SIZE }, { ...two!, ...SIZE }, GAP)).toBe(false);
  // a note that lies outside every frame already stays where it is
  const loose = { x: 900, y: 900, ...SIZE };
  expect(placeOutside([loose], [frame], within)).toEqual([{ x: 900, y: 900 }]);
});

test("a selection moves as one: the same distance for every note, each in the frame its middle lies in", () => {
  const groups = [group("a", 1000, 0, 600, 400)];
  const notes = [note("1", 0, 0), note("2", 300, 40), note("3", 0, 600, "a")];
  const moves = shifted(notes, { x: 1050.4, y: 59.6 }, groups);
  expect(moves).toEqual([
    { noteId: "1", x: 1050, y: 60, groupId: "a" },
    { noteId: "2", x: 1350, y: 100, groupId: "a" },
    // it lay in the group by its record alone; where it lies now, no frame holds it
    { noteId: "3", x: 1050, y: 660, groupId: null },
  ]);
  // a move that leaves a note where it is, in its group, changes nothing
  expect(
    changing(shifted([note("3", 1100, 100, "a")], { x: 0, y: 0 }, groups), byId([note("3", 1100, 100, "a")])),
  ).toEqual([]);
});

test("a selection stops together at the surface's edge: the notes keep their places to each other", () => {
  const notes = [note("1", COORD_LIMIT - 100, 0), note("2", COORD_LIMIT - 400, -COORD_LIMIT + 30)];
  const moves = shifted(notes, { x: 500, y: -200 }, []);
  expect(moves).toEqual([
    { noteId: "1", x: COORD_LIMIT, y: -30, groupId: null },
    { noteId: "2", x: COORD_LIMIT - 300, y: -COORD_LIMIT, groupId: null },
  ]);
});

test("a frame that moves takes its notes with it, and takes in the notes without a group it comes to lie on", () => {
  const a = group("a", 0, 0, 600, 400);
  const b = group("b", 2000, 1000, 600, 400, 2);
  const notes = [
    note("mine", 16, 40, "a"),
    note("loose", 2100, 100),
    // a note of another group that lies where the frame comes to lie stays with its own group
    note("theirs", 2300, 100, "b"),
    note("far", 5000, 5000),
  ];
  const to = { ...a, x: 2000, y: 20 };
  expect(reframed(a, to, notes, [a, b])).toEqual([
    { noteId: "mine", x: 2016, y: 60, groupId: "a" },
    { noteId: "loose", x: 2100, y: 100, groupId: "a" },
  ]);
  // a frame that does not move changes nothing
  expect(reframed(a, a, notes, [a, b])).toEqual([]);
});

test("a frame of another size lets go of the notes it no longer holds, and takes in loose ones it now holds", () => {
  const a = group("a", 0, 0, 600, 400);
  const outer = group("outer", -100, -100, 2000, 2000, 2);
  const notes = [note("stays", 16, 40, "a"), note("leaves", 340, 260, "a"), note("joins", 700, 40)];
  // smaller: the note in its far corner is outside now
  expect(reframed(a, { ...a, w: 300, h: 300 }, notes, [a])).toEqual([
    { noteId: "leaves", x: 340, y: 260, groupId: null },
  ]);
  // where another frame lies around it, the note belongs to that one
  expect(reframed(a, { ...a, w: 300, h: 300 }, notes, [a, outer])).toEqual([
    { noteId: "leaves", x: 340, y: 260, groupId: "outer" },
  ]);
  // larger: the note beside it lies inside now
  expect(reframed(a, { ...a, w: 1000 }, notes, [a])).toEqual([{ noteId: "joins", x: 700, y: 40, groupId: "a" }]);
});

test("„Verschieben nach …“: into a group the notes get free places in its frame, out of it places beside it", () => {
  const a = group("a", 0, 0, NEW_GROUP.w, NEW_GROUP.h);
  const b = group("b", 1000, 0, NEW_GROUP.w, NEW_GROUP.h, 2);
  const within = { x: -3000, y: -3000, w: 6000, h: 6000 };
  const inA = note("inA", GROUP_PAD, GROUP_HEAD, "a");
  const notes = [inA, note("loose", 700, 700), note("inB", 1000 + GROUP_PAD, GROUP_HEAD, "b")];
  // two notes into „a“: beside the one that lies there, then under it; the one that is there already stays
  const into = movedTo(notes, a, notes, [a, b], within);
  expect(into.frame).toBeNull();
  expect(into.moves).toEqual([
    { noteId: "loose", x: GROUP_PAD + NOTE_WIDTH + GAP, y: GROUP_HEAD, groupId: "a" },
    { noteId: "inB", x: GROUP_PAD, y: GROUP_HEAD + SIZE.h + GAP, groupId: "a" },
  ]);
  // out of every group: outside both frames, and the note that had none stays
  const out = movedTo(notes, null, notes, [a, b], within);
  expect(out.moves.map((move) => move.noteId)).toEqual(["inA", "inB"]);
  for (const move of out.moves) {
    expect(move.groupId).toBeNull();
    expect(groupOf({ ...move, ...SIZE }, [a, b])).toBeNull();
  }
  // a frame that is full grows, and says so
  const full = Array.from({ length: 4 }, (_, n) =>
    note(`f${n}`, GROUP_PAD + (n % 2) * (NOTE_WIDTH + GAP), GROUP_HEAD + Math.floor(n / 2) * (SIZE.h + GAP), "a"),
  );
  const fifth = note("fifth", 3000, 3000);
  const grown = movedTo([fifth], a, [...full, fifth], [a], within);
  expect(grown.frame).toEqual({ x: 0, y: 0, w: NEW_GROUP.w, h: NEW_GROUP.h + SIZE.h + GAP });
  expect(grown.moves).toEqual([{ noteId: "fifth", x: GROUP_PAD, y: GROUP_HEAD + 2 * (SIZE.h + GAP), groupId: "a" }]);
});

test("a note written in the list lands outside every frame: beside the last loose note, else under everything", () => {
  const a = group("a", 0, 0, NEW_GROUP.w, NEW_GROUP.h);
  // an empty wall: around the world's origin, where an empty surface looks
  expect(looseSpot(SIZE, [], [])).toEqual({ x: -SIZE.w / 2, y: -SIZE.h / 2 });
  // only a frame with its notes: under it, at its left edge
  const inA = note("inA", GROUP_PAD, GROUP_HEAD, "a");
  expect(looseSpot(SIZE, [inA], [a])).toEqual({ x: 0, y: NEW_GROUP.h + GAP });
  // a loose note: the next one lands beside it, covering nothing and in no frame
  const loose = note("loose", 0, NEW_GROUP.h + GAP);
  const next = looseSpot(SIZE, [inA, loose], [a]);
  expect(crowds({ ...next, ...SIZE }, boxOf(loose), GAP)).toBe(false);
  expect(groupOf({ ...next, ...SIZE }, [a])).toBeNull();
  expect(Math.abs(next.x - loose.x) + Math.abs(next.y - loose.y)).toBeLessThanOrEqual(NOTE_WIDTH + GAP);
});

test("a group made in the list gets a frame beside everything, covering nothing", () => {
  expect(looseFrame([], [])).toEqual({ x: -NEW_GROUP.w / 2, y: -NEW_GROUP.h / 2, ...NEW_GROUP });
  const a = group("a", 0, 0, NEW_GROUP.w, NEW_GROUP.h);
  const loose = note("loose", 0, NEW_GROUP.h + GAP);
  const frame = looseFrame([loose], [a]);
  expect(frame).toEqual({ x: NEW_GROUP.w + GAP, y: 0, ...NEW_GROUP });
  expect(crowds(frame, a, GAP)).toBe(false);
  expect(crowds(frame, boxOf(loose), GAP)).toBe(false);
});
