// groups.ts: groups on the surface, as arithmetic: which frame a point lies in, a free place inside a frame, the
// frame around some notes, what a frame's move or new size does to the notes, and the move of a whole selection.
// Pure functions; what a command does to the wall is decided in @ideabeam/shared and is not repeated here.
//
// One rule runs through all of it: **a note belongs to the frame its middle lies in.** The wall stores a note's
// group beside its place and checks neither against the other (the AI will later set both at once); the browser
// that moves a note or a frame says both in the same breath, so the list and the surface never tell two stories.
import {
  GROUP_MAX_SIZE,
  GROUP_MIN_SIZE,
  COORD_LIMIT,
  NOTE_WIDTH,
  type Group,
  type Note,
  type NoteMove,
} from "@ideabeam/shared";
import { boxOf, crowds, freeSpot, GAP, inside, onSurface, sizeOf } from "./notes";
import { around, type Box, type Point, type Size } from "./view";

/** The room a frame keeps at its top for its title, above the notes in it. */
export const GROUP_HEAD = 40;
/** The room between a frame's edge and the notes in it. */
export const GROUP_PAD = 16;
/** A new frame: room for four short notes, two beside each other. */
export const NEW_GROUP: Size = {
  w: 2 * NOTE_WIDTH + GAP + 2 * GROUP_PAD,
  h: GROUP_HEAD + 2 * sizeOf("").h + GAP + GROUP_PAD,
};

/** A frame: a group's box, and which group it is. */
export type Frame = Box & { id: string };

export const middleOf = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

const holds = (frame: Box, at: Point) =>
  at.x >= frame.x && at.x < frame.x + frame.w && at.y >= frame.y && at.y < frame.y + frame.h;

/** One side of a frame, inside the limits of the protocol: a whole number of units. */
const side = (length: number) => Math.min(GROUP_MAX_SIZE, Math.max(GROUP_MIN_SIZE, Math.round(length)));

/** The frame a point lies in, or null. Where frames lie over each other, the smallest one: a frame inside another
 *  is the nearer one. Equally large, the later one, which is drawn above. */
export function groupAt<T extends Frame>(at: Point, groups: readonly T[]): T | null {
  let best: T | null = null;
  for (const group of groups) {
    if (!holds(group, at)) continue;
    if (best === null || group.w * group.h <= best.w * best.h) best = group;
  }
  return best;
}

/** The group a box belongs to: the frame its middle lies in, or none. */
export function groupOf(box: Box, groups: readonly Frame[]): string | null {
  return groupAt(middleOf(box), groups)?.id ?? null;
}

/** The smallest box around every note and every frame, or null for an empty wall: what „Alles zeigen“ shows. */
export function everything(notes: readonly Pick<Note, "x" | "y" | "text">[], groups: readonly Box[]): Box | null {
  return around([...notes.map(boxOf), ...groups.map(({ x, y, w, h }) => ({ x, y, w, h }))]);
}

/** A frame's box as the wall takes it: its corner a whole number of units on the surface, its sides inside the
 *  limits. */
export function framed(box: Box): Box {
  return { ...onSurface(box), w: side(box.w), h: side(box.h) };
}

/** The frame of a new group around these boxes (at least one): the room for the title above them, the room to the
 *  edge on the other sides. */
export function frameAround(boxes: readonly Box[]): Box {
  const all = around(boxes) ?? { x: 0, y: 0, w: 0, h: 0 };
  return framed({
    x: all.x - GROUP_PAD,
    y: all.y - GROUP_HEAD,
    w: all.w + 2 * GROUP_PAD,
    h: all.h + GROUP_HEAD + GROUP_PAD,
  });
}

/** Places for notes of these sizes inside a frame, and the frame afterwards. The places are read as a page: the
 *  first free one from the top, then from the left, beside or under what lies in the frame already. A frame whose
 *  room is used up grows downwards, one narrower than a note grows to the right first: a note is never refused for
 *  lack of room. `occupied` is everything on the wall that stays where it is. */
export function placeIn(frame: Box, sizes: readonly Size[], occupied: readonly Box[]): { spots: Point[]; frame: Box } {
  const widest = Math.max(0, ...sizes.map((size) => size.w));
  let room: Box = { x: frame.x, y: frame.y, w: Math.max(frame.w, side(widest + 2 * GROUP_PAD)), h: frame.h };
  const taken = [...occupied];
  const free = (box: Box) => !taken.some((other) => crowds(box, other, GAP));
  const spots: Point[] = [];
  for (const size of sizes) {
    const inner: Box = {
      x: room.x + GROUP_PAD,
      y: room.y + GROUP_HEAD,
      w: room.w - 2 * GROUP_PAD,
      h: room.h - GROUP_HEAD - GROUP_PAD,
    };
    const within = taken.filter((box) => crowds(box, inner, 0));
    const candidates: Point[] = [{ x: inner.x, y: inner.y }];
    for (const box of within) {
      candidates.push({ x: box.x + box.w + GAP, y: box.y }, { x: inner.x, y: box.y + box.h + GAP });
    }
    candidates.sort((a, b) => a.y - b.y || a.x - b.x);
    let spot = candidates.find((at) => inside({ ...at, ...size }, inner) && free({ ...at, ...size }));
    if (spot === undefined) {
      // nothing is free inside: under everything that lies in the frame, past whatever lies under the frame, and
      // the frame grows down to hold it
      let y = Math.max(inner.y, ...within.map((box) => box.y + box.h + GAP));
      for (;;) {
        const blocking = taken.find((other) => crowds({ x: inner.x, y, ...size }, other, GAP));
        if (blocking === undefined) break;
        y = blocking.y + blocking.h + GAP;
      }
      spot = { x: inner.x, y };
      room = { ...room, h: Math.max(room.h, side(y + size.h + GROUP_PAD - room.y)) };
    }
    spot = onSurface(spot);
    spots.push(spot);
    taken.push({ ...spot, ...size });
  }
  return { spots, frame: room };
}

/** Places outside every frame for notes that leave their group: each the free place nearest to where the note
 *  lies, first among the places `within` shows whole. `occupied` is everything that stays: the other notes and
 *  every frame. A note that lies outside every frame already stays where it is. */
export function placeOutside(boxes: readonly Box[], occupied: readonly Box[], within: Box): Point[] {
  const taken = [...occupied];
  return boxes.map((box) => {
    const spot = freeSpot({ w: box.w, h: box.h }, taken, within, middleOf(box));
    taken.push({ ...spot, w: box.w, h: box.h });
    return spot;
  });
}

/** A distance along one axis, cut where the first of these places would leave the surface's numbers. */
function limited(by: number, places: readonly number[]): number {
  if (places.length === 0) return 0;
  const whole = Math.round(by);
  return Math.max(-COORD_LIMIT - Math.min(...places), Math.min(COORD_LIMIT - Math.max(...places), whole));
}

/** The move of a selection: every note goes the same distance, so the notes keep their places to each other (the
 *  distance is cut where the first of them meets the surface's edge), and each belongs to the frame its middle
 *  lies in afterwards. One `notes.move` carries the answer. */
export function shifted(notes: readonly Note[], by: Point, groups: readonly Frame[]): NoteMove[] {
  const dx = limited(
    by.x,
    notes.map((note) => note.x),
  );
  const dy = limited(
    by.y,
    notes.map((note) => note.y),
  );
  return notes.map((note) => {
    const at = { x: note.x + dx, y: note.y + dy };
    return { noteId: note.id, ...at, groupId: groupOf({ ...boxOf(note), ...at }, groups) };
  });
}

/** What a frame's move or new size does to the notes, as the moves of one `notes.move` (none: nothing changes).
 *  - The frame's notes go with it, the same distance.
 *  - A frame of another size lets go of a note of its own whose middle it no longer holds: that note belongs to
 *    whatever frame holds it now, or to none.
 *  - A note without a group whose middle the frame now holds joins it. A note of another group stays with that
 *    one. */
export function reframed(group: Group, to: Box, notes: readonly Note[], groups: readonly Group[]): NoteMove[] {
  const dx = to.x - group.x;
  const dy = to.y - group.y;
  const sized = to.w !== group.w || to.h !== group.h;
  const frames: Frame[] = groups.map((other) => (other.id === group.id ? { ...to, id: group.id } : other));
  const moves: NoteMove[] = [];
  for (const note of notes) {
    if (note.groupId === group.id) {
      const at = onSurface({ x: note.x + dx, y: note.y + dy });
      const box = { ...boxOf(note), ...at };
      const groupId = sized && !holds(to, middleOf(box)) ? groupOf(box, frames) : group.id;
      if (at.x !== note.x || at.y !== note.y || groupId !== group.id) moves.push({ noteId: note.id, ...at, groupId });
    } else if (note.groupId === null && groupOf(boxOf(note), frames) === group.id) {
      moves.push({ noteId: note.id, x: note.x, y: note.y, groupId: group.id });
    }
  }
  return moves;
}

/** „Verschieben nach …“: where the chosen notes go when they are moved into a group, or out of every group
 *  (`target` null). A note that is there already stays where it lies. Into a group: free places inside its frame,
 *  and the frame's new box where it had to grow for them (`frame`, else null). Out of every group: the free place
 *  nearest to each note outside every frame, first among the places `within` shows. `notes` is every note of the
 *  wall. */
export function movedTo(
  chosen: readonly Note[],
  target: Group | null,
  notes: readonly Note[],
  groups: readonly Group[],
  within: Box,
): { moves: NoteMove[]; frame: Box | null } {
  const going = chosen.filter((note) => note.groupId !== (target?.id ?? null));
  const leaving = new Set(going.map((note) => note.id));
  const staying = notes.filter((note) => !leaving.has(note.id)).map(boxOf);
  if (target === null) {
    const spots = placeOutside(going.map(boxOf), [...staying, ...groups], within);
    return { frame: null, moves: going.map((note, n) => ({ noteId: note.id, ...spots[n]!, groupId: null })) };
  }
  const { spots, frame } = placeIn(
    target,
    going.map((note) => sizeOf(note.text)),
    staying,
  );
  return {
    frame: frame.w !== target.w || frame.h !== target.h ? frame : null,
    moves: going.map((note, n) => ({ noteId: note.id, ...spots[n]!, groupId: target.id })),
  };
}

/** No part of the world before another: for a place that is looked for without a view (the list). */
const ANYWHERE: Box = { x: -2 * COORD_LIMIT, y: -2 * COORD_LIMIT, w: 4 * COORD_LIMIT, h: 4 * COORD_LIMIT };

/** A place for a note that is written without a view of the surface (in the list): outside every frame, beside
 *  the note that was last put down without a group; where there is none, under everything that lies on the wall;
 *  on an empty wall around the world's origin, where an empty surface looks. */
export function looseSpot(size: Size, notes: readonly Note[], groups: readonly Group[]): Point {
  const without = notes.filter((note) => note.groupId === null);
  const last = without[without.length - 1];
  const all = everything(notes, groups);
  const near =
    last !== undefined
      ? middleOf(boxOf(last))
      : all !== null
        ? { x: all.x + size.w / 2, y: all.y + all.h + GAP + size.h / 2 }
        : { x: 0, y: 0 };
  return freeSpot(size, [...notes.map(boxOf), ...groups], ANYWHERE, near);
}

/** The frame of a group that is made without a view of the surface (in the list): a new frame's size, beside
 *  everything that lies on the wall, level with its top; on an empty wall around the world's origin. */
export function looseFrame(notes: readonly Note[], groups: readonly Group[]): Box {
  const all = everything(notes, groups);
  const near = all !== null ? { x: all.x + all.w + GAP + NEW_GROUP.w / 2, y: all.y + NEW_GROUP.h / 2 } : { x: 0, y: 0 };
  return { ...freeSpot(NEW_GROUP, [...notes.map(boxOf), ...groups], ANYWHERE, near), ...NEW_GROUP };
}

/** „Verschieben nach …“ without a view of the surface: as `movedTo`, with no part of the world before another. */
export function movedToAnywhere(
  chosen: readonly Note[],
  target: Group | null,
  notes: readonly Note[],
  groups: readonly Group[],
): { moves: NoteMove[]; frame: Box | null } {
  return movedTo(chosen, target, notes, groups, ANYWHERE);
}

/** Only the moves that change something: a note that lies there already, in that group, is left out. */
export function changing(moves: readonly NoteMove[], notes: ReadonlyMap<string, Note>): NoteMove[] {
  return moves.filter((move) => {
    const note = notes.get(move.noteId);
    return note !== undefined && (note.x !== move.x || note.y !== move.y || note.groupId !== move.groupId);
  });
}
