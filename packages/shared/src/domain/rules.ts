// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  GROUP_FIELDS,
  MAX_GROUPS,
  MAX_NOTES,
  type Change,
  type ContentCommand,
  type Group,
  type Note,
  type NoteMove,
  type Participant,
  type RejectCode,
} from "../protocol.js";
import { decideArrangeApply, decideArrangeUndo, type ArrangeRecord } from "./arrange.js";
import type { StepContext } from "./flow.js";
import { maySeeNote } from "./visibility.js";

// What a command does to a wall: the one place that decides it, for the worker that stores the answer and for the
// browser that shows it before the worker has answered (domain/wall.ts). Whether a frame is a command at all, with
// a text of the right length and a place on the surface, the schemas of protocol.ts have decided before.
//
// Who may do what, in which step (PLAN.md 2.1, 3.4; PLAN-METHODEN.md 4). The step the wall is in says what may be
// done (`ctx.can`, domain/agenda.ts, `capabilities`); the furthest step reached says what is seen of the others'
// notes (`ctx.sight`). What a step does not allow is refused with `PHASE`.
//
// Once the notes are shown: everyone on the wall writes notes, moves any note, and, in a step that sorts, makes,
// renames, moves, resizes and deletes groups. A note's text is its writer's alone; deleting a note is its writer's
// or an admin's. Applying an arrangement and taking it back are the moderation's (domain/arrange.ts).
//
// In a step of teams (stage M4) a person's team's notes are there for them as on a revealed wall (`shared`): they
// move them, and change and delete their own; everybody else's are not on the wall for them, as while hidden.
//
// While they are hidden: everyone writes, and a person's notes are theirs alone. Nobody reads, changes, moves or
// deletes a note of somebody else, the moderation included: to a command, such a note is not on the wall
// (domain/visibility.ts), so the answer never says that it is. A hidden step does not sort: a command about a group
// is refused with `PHASE`.
//
// Whose a note is, the rules ask as `mine`: the browser knows no more than that about a note, and the worker
// answers it for whoever sent the command.

/** Who sent the command. */
export type Actor = Pick<Participant, "id" | "role">;

/** Where a note lies, and the group it belongs to or none. */
export type Placement = Pick<Note, "x" | "y" | "groupId">;

/** What the rules ask about the wall as it stands. They ask for single things, never for the whole wall: the
 *  worker answers each question with a look into its storage, and reads nothing the command does not need. `mine`
 *  is asked for whoever sent the command. */
export interface WallReader {
  /** A note's text and whether it is the sender's, or null: the wall holds no such note. `shared`: in a step of
   *  teams, the note's writer shares a team with the sender that lets them read it (domain/teams.ts). */
  note(id: string): (Pick<Note, "mine" | "text"> & { shared?: boolean }) | null;
  /** Where a note lies and whether it is the sender's, or null: the wall holds no such note. */
  placement(id: string): (Placement & Pick<Note, "mine"> & { shared?: boolean }) | null;
  group(id: string): Group | null;
  /** How many notes the wall holds. */
  noteCount(): number;
  /** The `ord` of every group the wall holds. */
  groupOrds(): number[];
  /** Every group the wall holds. */
  groups(): Group[];
  /** The ids of the notes that lie in a group. */
  members(groupId: string): string[];
  /** The run that arranged the wall last, while it can be taken back, or null. The worker answers with all the wall
   *  remembers of it; a browser knows which run it was and no more. */
  arranged(): ArrangeRecord | Pick<ArrangeRecord, "runId"> | null;
}

export type Decision =
  /** Not allowed, or not possible: nothing is stored, the sender is told why. */
  | { kind: "refused"; code: RejectCode }
  /** The wall is already as the command wants it: the command sent a second time, or one that asks for what is so.
   *  Nothing is stored and nobody is told; the sender gets its `ack`. */
  | { kind: "unchanged" }
  /** What to store and to tell everyone, once it has its number. With an arrangement: what the wall has to remember
   *  of it (`record`), so that it can be taken back. */
  | { kind: "changed"; change: Change; record?: ArrangeRecord };

const refused = (code: RejectCode): Decision => ({ kind: "refused", code });
const changed = (change: Change): Decision => ({ kind: "changed", change });
const UNCHANGED: Decision = { kind: "unchanged" };

/** Only its writer changes a note's text. */
export function mayEditNote(note: Pick<Note, "mine">): boolean {
  return note.mine;
}

/** Its writer takes a note off the wall, or an admin. */
export function mayDeleteNote(note: Pick<Note, "mine">, by: Pick<Actor, "role">): boolean {
  return note.mine || by.role === "admin";
}

/** What the command of `by` makes of the wall in the step it is in. `now` is the clock of whoever asks: the
 *  worker's when it stores, the browser's for what it shows meanwhile. */
export function decide(wall: WallReader, command: ContentCommand, by: Actor, now: number, ctx: StepContext): Decision {
  // A note the sender may not read is not on the wall for them: no answer tells them otherwise.
  const seen = <T extends Pick<Note, "mine"> & { shared?: boolean }>(note: T | null): T | null =>
    note !== null && maySeeNote(ctx.sight, note) ? note : null;
  switch (command.type) {
    case "note.create": {
      if (!ctx.can.write) return refused("PHASE");
      const existing = wall.note(command.noteId);
      // The same note again (the answer to the first frame was lost): it is there. Somebody else's id is no retry,
      // hidden or not: an id is 128 random bits and never told while its note is hidden, so nobody can ask for one.
      if (existing !== null) return existing.mine ? UNCHANGED : refused("CONFLICT");
      if (wall.noteCount() >= MAX_NOTES) return refused("LIMIT");
      return changed({
        type: "note.created",
        note: {
          id: command.noteId,
          // as its writer gets it: the worker says `mine` anew for everyone else (domain/visibility.ts)
          mine: true,
          text: command.text,
          x: command.x,
          y: command.y,
          groupId: null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    case "note.update": {
      if (!ctx.can.write) return refused("PHASE");
      const existing = seen(wall.note(command.noteId));
      if (existing === null) return refused("NOT_FOUND");
      if (!mayEditNote(existing)) return refused("NOT_AUTHOR");
      if (existing.text === command.text) return UNCHANGED;
      return changed({ type: "note.updated", noteId: command.noteId, text: command.text, updatedAt: now });
    }
    case "note.delete": {
      // not in a step that votes: its options are frozen (domain/agenda.ts, `capabilities`)
      if (!ctx.can.write) return refused("PHASE");
      const existing = seen(wall.note(command.noteId));
      // Gone already, by this command sent before or by somebody else: what the command wants is so.
      if (existing === null) return UNCHANGED;
      if (!mayDeleteNote(existing, by)) return refused("NOT_AUTHOR");
      return changed({ type: "note.deleted", noteId: command.noteId });
    }
    case "notes.move": {
      if (!ctx.can.move) return refused("PHASE");
      // A selection is dragged while somebody else deletes one of its notes, or the group it is dropped into: the
      // rest of the movement still happens. A note that is gone is left out, a group that is gone is no group.
      // While the notes are hidden a person moves their own only: the others' are not there for them.
      const known = new Map<string, boolean>();
      const groupExists = (id: string): boolean => {
        let exists = known.get(id);
        if (exists === undefined) {
          exists = wall.group(id) !== null;
          known.set(id, exists);
        }
        return exists;
      };
      const moves: NoteMove[] = [];
      for (const move of command.moves) {
        const from = seen(wall.placement(move.noteId));
        if (from === null) continue;
        const groupId = move.groupId !== null && groupExists(move.groupId) ? move.groupId : null;
        if (from.x === move.x && from.y === move.y && from.groupId === groupId) continue;
        moves.push({ noteId: move.noteId, x: move.x, y: move.y, groupId });
      }
      return moves.length === 0 ? UNCHANGED : changed({ type: "notes.moved", moves });
    }
    case "group.create": {
      if (!ctx.can.group) return refused("PHASE");
      // A group has no author: whoever names an id that exists means that group, and it is there.
      if (wall.group(command.groupId) !== null) return UNCHANGED;
      const ords = wall.groupOrds();
      if (ords.length >= MAX_GROUPS) return refused("LIMIT");
      return changed({
        type: "group.created",
        group: {
          id: command.groupId,
          title: command.title,
          // made by hand: the title is a person's, and arranging leaves the group alone (PLAN.md 4.3)
          titleSource: "person",
          locked: true,
          x: command.x,
          y: command.y,
          w: command.w,
          h: command.h,
          ord: Math.max(0, ...ords) + 1,
        },
      });
    }
    case "group.update": {
      if (!ctx.can.group) return refused("PHASE");
      const existing = wall.group(command.groupId);
      if (existing === null) return refused("NOT_FOUND");
      const group: Group = {
        ...existing,
        title: command.title ?? existing.title,
        x: command.x ?? existing.x,
        y: command.y ?? existing.y,
        w: command.w ?? existing.w,
        h: command.h ?? existing.h,
      };
      if (GROUP_FIELDS.every((field) => group[field] === existing[field])) return UNCHANGED;
      // A group a person renames is theirs from then on, like one made by hand: the title is a person's, and
      // arranging leaves the group and its notes alone (the owner's decision 16, PLAN.md 7.2). Moving or resizing
      // the frame locks nothing.
      if (group.title !== existing.title) {
        group.titleSource = "person";
        group.locked = true;
      }
      return changed({ type: "group.updated", group });
    }
    case "group.delete":
      if (!ctx.can.group) return refused("PHASE");
      if (wall.group(command.groupId) === null) return UNCHANGED;
      return changed({ type: "group.deleted", groupId: command.groupId });
    case "admin.arrange.apply":
      return decideArrangeApply(wall, command, by, ctx);
    case "admin.arrange.undo":
      return decideArrangeUndo(wall, command, by, ctx);
  }
}
