import { expect, test } from "vitest";
import { COORD_LIMIT, estimateNoteHeight, NOTE_WIDTH } from "@ideabeam/shared";
import { boxOf, freeSpot, GAP, nearestInDirection, onSurface, sizeOf, STEP, stepped } from "./notes";
import type { Box } from "./view";

const SIZE = sizeOf("Idee");
const at = (id: string, x: number, y: number): Box & { id: string } => ({ id, x, y, ...SIZE });
const ids = (...notes: Array<{ id: string } | null>) => notes.map((note) => note?.id ?? null);

test("a note's box is its fixed width and the height its text gives it", () => {
  expect(boxOf({ x: 12, y: -40, text: "Idee" })).toEqual({
    x: 12,
    y: -40,
    w: NOTE_WIDTH,
    h: estimateNoteHeight("Idee"),
  });
  const long = "Ein langer Zettel mit vielen Wörtern, die über mehrere Zeilen laufen und Platz brauchen. ".repeat(3);
  expect(boxOf({ x: 0, y: 0, text: long }).h).toBeGreaterThan(SIZE.h);
});

test("an arrow key jumps to the nearest note in its direction", () => {
  // a grid of three by two, 256 apart across and 136 down
  const grid = [at("a", 0, 0), at("b", 256, 0), at("c", 512, 0), at("d", 0, 136), at("e", 256, 136), at("f", 512, 136)];
  const from = (id: string) => grid.find((note) => note.id === id)!;
  expect(ids(nearestInDirection(from("a"), grid, "right"))).toEqual(["b"]);
  expect(ids(nearestInDirection(from("b"), grid, "right"))).toEqual(["c"]);
  expect(ids(nearestInDirection(from("c"), grid, "left"))).toEqual(["b"]);
  expect(ids(nearestInDirection(from("a"), grid, "down"))).toEqual(["d"]);
  expect(ids(nearestInDirection(from("e"), grid, "up"))).toEqual(["b"]);
  // nothing lies that way: the place stays
  expect(nearestInDirection(from("a"), grid, "left")).toBeNull();
  expect(nearestInDirection(from("a"), grid, "up")).toBeNull();
  expect(nearestInDirection(from("f"), grid, "right")).toBeNull();
  expect(nearestInDirection(from("f"), grid, "down")).toBeNull();
  // the note itself is never the answer
  expect(nearestInDirection(from("a"), [from("a")], "right")).toBeNull();
});

test("a note in line comes before a nearer one off to the side; without one in line, the nearest on that side", () => {
  const here = at("a", 0, 0);
  const inLine = at("b", 900, 40);
  const aside = at("c", 200, 600);
  expect(ids(nearestInDirection(here, [here, inLine, aside], "right"))).toEqual(["b"]);
  expect(ids(nearestInDirection(here, [here, inLine, aside], "down"))).toEqual(["c"]);
  // only the note far off to the side lies to the right at all: it is reached all the same
  expect(ids(nearestInDirection(here, [here, aside], "right"))).toEqual(["c"]);
});

test("every note of a scattered wall is reached from every other with the arrow keys", () => {
  // deterministic scatter
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const notes = Array.from({ length: 40 }, (_, n) =>
    at(String(n).padStart(2, "0"), Math.round(random() * 4000), Math.round(random() * 2400)),
  );
  const reached = new Set<string>([notes[0]!.id]);
  const queue = [notes[0]!];
  while (queue.length > 0) {
    const from = queue.pop()!;
    for (const direction of ["left", "right", "up", "down"] as const) {
      const next = nearestInDirection(from, notes, direction);
      if (next && !reached.has(next.id)) {
        reached.add(next.id);
        queue.push(next);
      }
    }
  }
  expect(reached.size).toBe(notes.length);
});

test("two notes at the very same place are still told apart: the later id lies to the right and below", () => {
  const first = at("a", 100, 100);
  const second = at("b", 100, 100);
  expect(ids(nearestInDirection(first, [first, second], "right"))).toEqual(["b"]);
  expect(ids(nearestInDirection(first, [first, second], "down"))).toEqual(["b"]);
  expect(nearestInDirection(first, [first, second], "left")).toBeNull();
  expect(ids(nearestInDirection(second, [first, second], "left"))).toEqual(["a"]);
  expect(ids(nearestInDirection(second, [first, second], "up"))).toEqual(["a"]);
});

const VIEW: Box = { x: -500, y: -300, w: 1000, h: 600 };

test("a new note lands in the middle of the view while nothing lies there", () => {
  expect(freeSpot(SIZE, [], VIEW, { x: 0, y: 0 })).toEqual({ x: -NOTE_WIDTH / 2, y: -SIZE.h / 2 });
  // whole numbers, always
  const spot = freeSpot(SIZE, [], VIEW, { x: 0.4, y: 10.6 });
  expect(Number.isInteger(spot.x) && Number.isInteger(spot.y)).toBe(true);
});

test("where the middle is taken, the new note lands beside a neighbour, covering nothing and in view", () => {
  const taken: Box[] = [{ x: -NOTE_WIDTH / 2, y: -SIZE.h / 2, ...SIZE }];
  const covers = (spot: { x: number; y: number }, box: Box) =>
    spot.x < box.x + box.w && box.x < spot.x + SIZE.w && spot.y < box.y + box.h && box.y < spot.y + SIZE.h;
  for (let n = 0; n < 12; n++) {
    const spot = freeSpot(SIZE, taken, VIEW, { x: 0, y: 0 });
    expect(taken.some((box) => covers(spot, box))).toBe(false);
    // inside the view, whole
    expect(spot.x).toBeGreaterThanOrEqual(VIEW.x);
    expect(spot.y).toBeGreaterThanOrEqual(VIEW.y);
    expect(spot.x + SIZE.w).toBeLessThanOrEqual(VIEW.x + VIEW.w);
    expect(spot.y + SIZE.h).toBeLessThanOrEqual(VIEW.y + VIEW.h);
    taken.push({ ...spot, ...SIZE });
  }
  // the first neighbour lies directly below the first note, a gap away: the nearest free place
  expect(taken[1]).toEqual({ x: -NOTE_WIDTH / 2, y: SIZE.h / 2 + GAP, ...SIZE });
});

test("a view that is full sends the new note to the nearest free place outside it; a wall that is full, to the middle", () => {
  // one note fills the small view
  const small: Box = { x: -150, y: -80, w: 300, h: 160 };
  const taken: Box[] = [{ x: -NOTE_WIDTH / 2, y: -SIZE.h / 2, ...SIZE }];
  const spot = freeSpot(SIZE, taken, small, { x: 0, y: 0 });
  expect(spot).toEqual({ x: -NOTE_WIDTH / 2, y: SIZE.h / 2 + GAP });
  // nothing beside the one note is free either (the notes around it are at the surface's edge and beyond): the
  // wanted place is the answer, a note is never refused for lack of room
  const walled: Box[] = [
    { x: -COORD_LIMIT - 1000, y: -COORD_LIMIT - 1000, w: 2 * COORD_LIMIT + 2000, h: 2 * COORD_LIMIT + 2000 },
  ];
  expect(freeSpot(SIZE, walled, VIEW, { x: 0, y: 0 })).toEqual({ x: -NOTE_WIDTH / 2, y: -SIZE.h / 2 });
});

test("a place is a whole number of units inside the surface's numbers", () => {
  expect(onSurface({ x: 10.4, y: -7.5 })).toEqual({ x: 10, y: -7 });
  expect(onSurface({ x: 99_999, y: -99_999 })).toEqual({ x: COORD_LIMIT, y: -COORD_LIMIT });
});

test("one step of the move mode is 32 units, and stops at the surface's edge", () => {
  expect(STEP).toBe(32);
  expect(stepped({ x: 0, y: 0 }, "right")).toEqual({ x: 32, y: 0 });
  expect(stepped({ x: 0, y: 0 }, "left")).toEqual({ x: -32, y: 0 });
  expect(stepped({ x: 0, y: 0 }, "up")).toEqual({ x: 0, y: -32 });
  expect(stepped({ x: 0, y: 0 }, "down")).toEqual({ x: 0, y: 32 });
  expect(stepped({ x: COORD_LIMIT - 10, y: 0 }, "right")).toEqual({ x: COORD_LIMIT, y: 0 });
});
