// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  COORD_LIMIT,
  estimateNoteHeight,
  GROUP_MAX_SIZE,
  GROUP_MIN_SIZE,
  NOTE_WIDTH,
  type ArrangeGroup,
  type NoteMove,
  type Proposal,
} from "@ideabeam/shared";

// Where a proposal's notes and frames go (PLAN.md 4.3, step 7): the frames by size in rows, the notes inside a
// frame in rows, the notes without a group in rows under the frames. A note's height comes from its text by the
// shared estimate (estimateNoteHeight), never from a page that measures it: the same proposal gives the same
// places in the moderation's browser, in a test and in a script, and those places fit on every device.
//
// The result is the two halves of `admin.arrange.apply`: the groups with their frames, and where every note goes.
//
// All lengths are world units (1/16 rem, PLAN.md 3.1), all places whole numbers.

/** The room a frame keeps at its top for its title, and between its edge and its notes: the surface's own numbers
 *  (apps/web, lib/surface/groups.ts: GROUP_HEAD, GROUP_PAD). */
export const FRAME_HEAD = 40;
export const FRAME_PAD = 16;
/** The room between two notes (apps/web, lib/surface/notes.ts: GAP), and between two frames. */
export const NOTE_GAP = 16;
export const FRAME_GAP = 32;

/** A box on the surface: its top left corner and its size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What `admin.arrange.apply` carries beside its `opId` and its source. */
export interface Arrangement {
  groups: ArrangeGroup[];
  moves: NoteMove[];
}

export interface LayoutInput {
  proposal: Proposal;
  /** The text of every note on the wall that the proposal may name, by the note's id. A note that is not in it
   *  (deleted since the proposal was made) is left out, and a group that keeps no note is not made. */
  texts: ReadonlyMap<string, string>;
  /** An id for each group of the proposal, in the proposal's order: minted by whoever applies the arrangement. */
  groupIds: readonly string[];
  /** What stays where it is: the frames of the locked groups and the notes in them. The arrangement is put under
   *  all of it. Nothing: the arrangement lies around the world's origin, where an empty surface looks. */
  keep?: readonly Rect[];
}

/** Notes in rows of `columns`, from the top left corner of their block: each note's place, and the block's size.
 *  A row is as tall as its tallest note. */
function inRows(heights: readonly number[], columns: number): { places: Array<[x: number, y: number]>; size: Rect } {
  const places: Array<[number, number]> = [];
  let y = 0;
  let bottom = 0;
  for (let start = 0; start < heights.length; start += columns) {
    const row = heights.slice(start, start + columns);
    row.forEach((_, column) => places.push([column * (NOTE_WIDTH + NOTE_GAP), y]));
    bottom = y + Math.max(...row);
    y = bottom + NOTE_GAP;
  }
  const widest = Math.min(columns, heights.length);
  return { places, size: { x: 0, y: 0, w: widest * NOTE_WIDTH + Math.max(0, widest - 1) * NOTE_GAP, h: bottom } };
}

/** How many notes lie beside each other in a frame: so that the frame comes out about as wide as tall. A note is
 *  about twice as wide as tall, so there are about twice as many rows as columns. */
const columnsFor = (notes: number) => (notes <= 1 ? 1 : Math.max(2, Math.ceil(Math.sqrt(notes / 2))));

const side = (length: number) => Math.min(GROUP_MAX_SIZE, Math.max(GROUP_MIN_SIZE, length));

/** The places of a proposal: see the head of this file. The groups come back largest first, the order they lie in
 *  and the order the wall will list them in. */
export function layoutProposal(input: LayoutInput): Arrangement {
  const { proposal, texts, groupIds, keep = [] } = input;
  const heightOf = (noteId: string) => estimateNoteHeight(texts.get(noteId) ?? "");

  // Each frame by itself first: its notes in rows under the room for its title.
  const frames = proposal.groups
    .map((group, index) => {
      const noteIds = group.noteIds.filter((noteId) => texts.has(noteId));
      const rows = inRows(noteIds.map(heightOf), columnsFor(noteIds.length));
      return {
        groupId: groupIds[index] ?? "",
        title: group.title,
        noteIds,
        places: rows.places,
        w: side(rows.size.w + 2 * FRAME_PAD),
        h: side(FRAME_HEAD + rows.size.h + FRAME_PAD),
      };
    })
    .filter((frame) => frame.noteIds.length > 0 && frame.groupId !== "")
    // by size: the frame with the most notes first; equally many stay in the proposal's order
    .map((frame, index) => ({ frame, index }))
    .sort((a, b) => b.frame.noteIds.length - a.frame.noteIds.length || a.index - b.index)
    .map(({ frame }) => frame);

  // The frames in rows, a row about as wide as the whole block is to become: a little wider than tall. A frame
  // still goes into a row while its middle lies inside that width: a row that ended where the next frame would
  // pass the width by a few units left four equal frames in one tall column instead of two by two.
  const area = frames.reduce((sum, frame) => sum + (frame.w + FRAME_GAP) * (frame.h + FRAME_GAP), 0);
  const rowWidth = Math.max(Math.round(Math.sqrt(area * 1.6)), ...frames.map((frame) => frame.w));
  const corners: Array<[number, number]> = [];
  let [x, y, rowHeight, width] = [0, 0, 0, 0];
  for (const frame of frames) {
    if (x > 0 && x + frame.w / 2 > rowWidth) {
      [x, y, rowHeight] = [0, y + rowHeight + FRAME_GAP, 0];
    }
    corners.push([x, y]);
    width = Math.max(width, x + frame.w);
    rowHeight = Math.max(rowHeight, frame.h);
    x += frame.w + FRAME_GAP;
  }
  const framesBottom = frames.length === 0 ? 0 : y + rowHeight;

  // The notes without a group: in rows under the frames, as wide as the frames together.
  const loose = proposal.loose.filter((noteId) => texts.has(noteId));
  const looseColumns = Math.max(1, Math.floor((Math.max(width, NOTE_WIDTH) + NOTE_GAP) / (NOTE_WIDTH + NOTE_GAP)));
  const looseRows = inRows(loose.map(heightOf), looseColumns);
  const looseTop = frames.length === 0 ? 0 : framesBottom + 2 * FRAME_GAP;
  width = Math.max(width, looseRows.size.w);
  const height = loose.length === 0 ? framesBottom : looseTop + looseRows.size.h;

  // The whole block: under what stays, or around the origin; and on the surface's numbers in either case.
  const fit = (corner: number, length: number) =>
    Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT - length, Math.round(corner)));
  const left = fit(keep.length === 0 ? -width / 2 : Math.min(...keep.map((rect) => rect.x)), width);
  const top = fit(
    keep.length === 0 ? -height / 2 : Math.max(...keep.map((rect) => rect.y + rect.h)) + 2 * FRAME_GAP,
    height,
  );

  const groups: ArrangeGroup[] = [];
  const moves: NoteMove[] = [];
  frames.forEach((frame, index) => {
    const [cornerX, cornerY] = corners[index] ?? [0, 0];
    const [frameX, frameY] = [left + cornerX, top + cornerY];
    groups.push({
      groupId: frame.groupId,
      title: frame.title,
      x: frameX,
      y: frameY,
      w: frame.w,
      h: frame.h,
      noteIds: frame.noteIds,
    });
    frame.noteIds.forEach((noteId, at) => {
      const [noteX, noteY] = frame.places[at] ?? [0, 0];
      moves.push({ noteId, x: frameX + FRAME_PAD + noteX, y: frameY + FRAME_HEAD + noteY, groupId: frame.groupId });
    });
  });
  loose.forEach((noteId, at) => {
    const [noteX, noteY] = looseRows.places[at] ?? [0, 0];
    moves.push({ noteId, x: left + noteX, y: top + looseTop + noteY, groupId: null });
  });
  return { groups, moves };
}
