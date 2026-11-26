// notes.ts: where notes lie on the surface, as arithmetic: the box a note takes, the note the arrow keys jump to,
// a free place for a new note, one step of the move mode. Pure functions; the rules of what a command does are
// in @ideabeam/shared and are not repeated here.
//
// The free place follows the idea of RetroBeam's nearestOpenCanvasPosition (docs/HERKUNFT.md): candidates sorted by
// their distance to the wanted place, the first one that covers nothing. The candidates here are the places beside
// the notes that are there, so new notes line up with their neighbours without a grid.
import { COORD_LIMIT, estimateNoteHeight, NOTE_WIDTH, type Note } from "@ideabeam/shared";
import type { Box, Point, Size } from "./view";

/** One step of the move mode, in world units (PLAN.md 3.7). */
export const STEP = 32;
/** The room between a new note and its neighbours. */
export const GAP = 16;

export type Direction = "left" | "right" | "up" | "down";

/** The box a note takes on the surface: its fixed width and the height its text gives it. */
export function boxOf(note: Pick<Note, "x" | "y" | "text">): Box {
  return { x: note.x, y: note.y, w: NOTE_WIDTH, h: estimateNoteHeight(note.text) };
}

/** The size of a note with this text. */
export function sizeOf(text: string): Size {
  return { w: NOTE_WIDTH, h: estimateNoteHeight(text) };
}

const centre = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/** The note the arrow key jumps to from `from`: the nearest one that lies in the direction. Notes in line with
 *  `from` (nearer along the direction than across it) come first; only where there is none, the nearest one
 *  anywhere on that side. null: nothing lies that way. Every note of a wall is reached from every other. */
export function nearestInDirection<T extends Box & { id: string }>(
  from: Box & { id?: string },
  others: readonly T[],
  direction: Direction,
): T | null {
  const start = centre(from);
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const horizontal = direction === "left" || direction === "right";
  let best: { note: T; inLine: boolean; score: number } | null = null;
  for (const note of others) {
    if (note.id === from.id) continue;
    const to = centre(note);
    let along = (horizontal ? to.x - start.x : to.y - start.y) * sign;
    const across = Math.abs(horizontal ? to.y - start.y : to.x - start.x);
    // two notes at the very same place: the one with the later id counts as lying to the right and below
    if (along === 0 && across === 0 && from.id !== undefined) along = (note.id > from.id ? 1 : -1) * sign;
    if (along <= 0) continue;
    const inLine = across <= along;
    const score = inLine ? along + across : along + 2 * across;
    if (
      best === null ||
      (inLine && !best.inLine) ||
      (inLine === best.inLine && (score < best.score || (score === best.score && note.id < best.note.id)))
    ) {
      best = { note, inLine, score };
    }
  }
  return best?.note ?? null;
}

/** Whether two boxes lie nearer to each other than the gap. */
export function crowds(a: Box, b: Box, gap: number): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/** Whether a box lies whole inside a frame. */
export const inside = (box: Box, frame: Box) =>
  box.x >= frame.x && box.y >= frame.y && box.x + box.w <= frame.x + frame.w && box.y + box.h <= frame.y + frame.h;

/** A whole number of units, inside the surface's numbers (COORD_LIMIT of the protocol). */
export function onSurface(at: Point): Point {
  const whole = (value: number) => Math.min(COORD_LIMIT, Math.max(-COORD_LIMIT, Math.round(value)));
  return { x: whole(at.x), y: whole(at.y) };
}

/** A place for a new note of `size`: its top left corner. Wanted is the place where its middle lies at `near`;
 *  where that covers a note, the nearest free place beside one of the notes, first among the places `within` (the
 *  part of the world in view) shows whole, then anywhere. A wall so crowded that nothing is free gets the wanted
 *  place all the same: a note is never refused for lack of room. */
export function freeSpot(size: Size, occupied: readonly Box[], within: Box, near: Point): Point {
  const wanted = onSurface({ x: near.x - size.w / 2, y: near.y - size.h / 2 });
  const free = (at: Point) => !occupied.some((box) => crowds({ ...at, ...size }, box, GAP));
  if (free(wanted)) return wanted;
  const candidates: Point[] = [];
  for (const box of occupied) {
    candidates.push(
      { x: box.x + box.w + GAP, y: box.y },
      { x: box.x, y: box.y + box.h + GAP },
      { x: box.x - size.w - GAP, y: box.y },
      { x: box.x, y: box.y - size.h - GAP },
    );
  }
  const distance = (at: Point) => (at.x - wanted.x) ** 2 + (at.y - wanted.y) ** 2;
  // equally near: below before above, right before left, as a page fills
  const sorted = candidates.map(onSurface).sort((a, b) => distance(a) - distance(b) || b.y - a.y || b.x - a.x);
  let elsewhere: Point | null = null;
  for (const at of sorted) {
    if (!free(at)) continue;
    if (inside({ ...at, ...size }, within)) return at;
    elsewhere ??= at;
  }
  return elsewhere ?? wanted;
}

/** Where a note lies after one step of the move mode. */
export function stepped(at: Point, direction: Direction, step = STEP): Point {
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const horizontal = direction === "left" || direction === "right";
  return onSurface({ x: at.x + (horizontal ? sign * step : 0), y: at.y + (horizontal ? 0 : sign * step) });
}
