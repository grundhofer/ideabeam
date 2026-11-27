// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Change, ContentEvent, Note, ServerEvent } from "../protocol.js";
import type { NoteLevel } from "./agenda.js";
import { shareTeam, type TeamSight } from "./teams.js";

// Who may read what (PLAN.md 3.4, „Verbergen am Filter“), and what leaves the worker about who wrote a note.
//
// Two rules, and every frame about notes goes through them:
//
//  1. While the notes are hidden (`sight` is `hidden`: the wall has reached no step that shows them, domain/agenda.ts,
//     `noteLevel`), a person reads their own notes and nobody else's. Of the others' they learn one number: how many
//     there are. No id, no writer, no length, no place.
//  2. Who wrote a note never leaves the worker, in no step (the owner's decision 14, PLAN.md 7.2). A note is sent
//     with `mine`: whether the person the frame goes to wrote it.
//
// `team` (stage M4, domain/teams.ts): in a step in pairs or small groups a person reads, beside their own, the notes
// of whoever shares a team with them (`shareTeam`); of everybody else's they learn the number, as while hidden. The
// teams only ever widen what is seen: a merge or a swap brings a person notes, never takes one away.
//
// The worker stores notes with their writer (`StoredNote`) and sends them through the functions below: a snapshot
// and an export through `notesFor`, a stored change through `eventFor`, the revealing through `revealedFor`. They
// are the only way from a stored note to a frame, so snapshot and stream cannot disagree about what a person reads.

/** A note as the wall stores it: with the id of the person who wrote it. This shape never leaves the worker. A
 *  person who had the wall forget them leaves notes under an id that is nobody's any more. */
export type StoredNote = Omit<Note, "mine"> & { authorId: string };

/** Whether a person may read a note: their own always, anybody's once the wall is revealed, and in a step of teams
 *  the notes of their team (`shared`: the note's writer shares a team with them that lets them read it; a browser
 *  holds no note it may not read, so for it every note it holds is shared). */
export function maySeeNote(sight: NoteLevel, note: Pick<Note, "mine"> & { shared?: boolean }): boolean {
  return sight === "all" || note.mine || (sight === "team" && note.shared === true);
}

/** Whether a person may read a stored note: what `maySeeNote` says, with whether it is theirs and whether it is
 *  shared worked out from its writer. */
export function maySeeStored(
  note: Pick<StoredNote, "authorId" | "createdAt">,
  sight: NoteLevel,
  viewer: string | null,
  teams?: TeamSight | null,
): boolean {
  if (sight === "all") return true;
  if (viewer === null) return false;
  if (note.authorId === viewer) return true;
  return sight === "team" && shareTeam(teams, note.authorId, viewer, note.createdAt);
}

/** A stored note as one person gets it: without its writer, with `mine`. `viewer` is null for nobody in
 *  particular: no note is theirs. */
export function noteFor(note: StoredNote, viewer: string | null): Note {
  const { authorId, ...rest } = note;
  return { ...rest, mine: viewer !== null && authorId === viewer };
}

/** What a person gets of the wall's notes, and how many they do not get. */
export interface NotesView {
  notes: Note[];
  /** How many notes of the wall are left out. */
  hidden: number;
}

/** The wall's notes for one person, in the order given: what a snapshot holds, and what an export may hold. While
 *  they are hidden these are the person's own, and for nobody in particular (`viewer` null) none at all; in a step
 *  of teams the person's own and their team's (`teams`). */
export function notesFor(
  notes: readonly StoredNote[],
  sight: NoteLevel,
  viewer: string | null,
  teams?: TeamSight | null,
): NotesView {
  const visible: Note[] = [];
  for (const stored of notes) {
    if (maySeeStored(stored, sight, viewer, teams)) visible.push(noteFor(stored, viewer));
  }
  return { notes: visible, hidden: notes.length - visible.length };
}

/** What a person can read of the notes at one moment: the level of the furthest step reached, and the teams. */
export interface Sight {
  level: NoteLevel;
  teams?: TeamSight | null;
}

/** What revealing brings a person: the notes they may read after (`after`) and could not before (`before`), in the
 *  order given, and nothing else: exactly the difference. Left out, before is hidden and after is everybody: the
 *  revealing of hidden writing. Since what is seen only widens, none of them is theirs. */
export function revealedFor(
  notes: readonly StoredNote[],
  viewer: string,
  before: Sight = { level: "hidden" },
  after: Sight = { level: "all" },
): Note[] {
  return notes
    .filter(
      (note) =>
        maySeeStored(note, after.level, viewer, after.teams) && !maySeeStored(note, before.level, viewer, before.teams),
    )
    .map((note) => noteFor(note, viewer));
}

/** How a change moves the number of notes that are hidden from everybody but its writer: a note more, a note
 *  fewer, or the same notes. */
export function hiddenChange(change: Change | ContentEvent): -1 | 0 | 1 {
  if (change.type === "note.created") return 1;
  if (change.type === "note.deleted") return -1;
  return 0;
}

/** What one person hears of a stored change. `event` is the change as the person who made it (`by`) gets it;
 *  `hidden` is how many notes are hidden from `viewer` after it. In a step of teams, `sees` says which notes the
 *  viewer may read (their team's): they hear the change of those, and of the others only its number; a movement
 *  is told with the notes they may read alone.
 *
 *  Once the notes are shown everybody hears the change, and a new note says for each whether it is theirs. While
 *  they are hidden a change is always to a note of whoever made it (domain/rules.ts), so they alone hear it;
 *  everybody else hears its number and the count. */
export function eventFor(
  event: ContentEvent,
  by: string,
  viewer: string,
  sight: NoteLevel,
  hidden: number,
  sees?: (noteId: string) => boolean,
): ServerEvent {
  if (viewer === by) return event;
  if (sight === "team" && sees !== undefined) {
    const occupancy: ServerEvent = { type: "wall.occupancy", seq: event.seq, hidden };
    switch (event.type) {
      case "note.created":
        return sees(event.note.id) ? { ...event, note: { ...event.note, mine: false } } : occupancy;
      case "note.updated":
      case "note.deleted":
        return sees(event.noteId) ? event : occupancy;
      case "notes.moved": {
        const moves = event.moves.filter((move) => sees(move.noteId));
        return moves.length === 0 ? occupancy : { ...event, moves };
      }
      default:
        // groups and arranging are not done in a step of teams (domain/agenda.ts, `capabilities`)
        return occupancy;
    }
  }
  if (sight !== "all") return { type: "wall.occupancy", seq: event.seq, hidden };
  return event.type === "note.created" ? { ...event, note: { ...event.note, mine: false } } : event;
}
