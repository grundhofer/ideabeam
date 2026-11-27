// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  MAX_GROUPS,
  type Change,
  type ContentCommand,
  type ContentEvent,
  type Group,
  type NoteMove,
} from "../protocol.js";
import type { StepContext } from "./flow.js";
import type { Actor, Decision, WallReader } from "./rules.js";

// Arranging, as the wall sees it (PLAN.md 3.4, 4.3). Who worked the arrangement out, the wall does not know and
// does not ask: the moderation sends the whole result in one command (`admin.arrange.apply`), and to the wall it is
// one large movement with new groups. What the wall holds to:
//
//  - **A locked group is never touched.** A group a person made by hand is locked, and so is a group of a run from
//    the moment a person renames it: it is that person's from then on (domain/rules.ts; the owner's decision 16,
//    PLAN.md 7.2). An arrangement that moves a note out of a locked group is refused as a whole, and taking an
//    arrangement back leaves a locked group where it stands, also one the run itself made, with every note that
//    lies in it by then.
//  - **A run replaces the frames of the run before it.** The groups a run makes are not locked, and their titles
//    are the AI's (`ki`). A group that is not locked, that the new arrangement leaves without a note and whose
//    title is still the AI's is taken away with it: nobody has to clear the old frames by hand.
//  - **A title a person wrote is never the AI's to change or to throw away.** A run only makes groups, it writes
//    no title of a group that is there; and a group a person renamed is locked, so no run takes its notes.
//  - **The last run can be taken back**, exactly: the wall remembers where every note the run moved lay before,
//    which groups the run made and which it took away (`ArrangeRecord`, one stored row). `admin.arrange.undo` puts
//    every one of those notes back, takes the run's groups away and brings the others back; what a person has
//    locked since stays. Only the last run: the next one writes over what the wall remembers.
//
// A wall that was arranged before renaming locked a group can still hold a group that is NOT locked and whose title
// is a person's. There is no migration: nothing locks such a group after the fact, and it behaves as it did then. A
// run may take its notes, and the group stays as an empty frame with its title, for the people on the wall to fill
// or to delete; taking back the run that made it takes it away. Renamed once more, it is locked like every other.

/** What a wall remembers of the run that arranged it last, so that the run can be taken back. */
export interface ArrangeRecord {
  /** The run: the `opId` of its `admin.arrange.apply`. */
  runId: string;
  /** Where every note the run moved lay before, and the group it was in or null. */
  before: Record<string, [x: number, y: number, groupId: string | null]>;
  /** The groups the run made. */
  made: string[];
  /** The groups the run took away, as they were. */
  gone: Group[];
}

/** How many numbers a stored change takes (protocol.ts, `seq`): one, except an arrangement that is applied or
 *  taken back, which takes as many as the rows it writes: one for every group it makes, brings back or takes away,
 *  the layout row, and the row of what the wall remembers of the run. So the brake of a wall's day, which counts
 *  numbers, counts an arrangement by what it costs: a wall cannot write a hundred rows a change all day long. */
export function numbersOf(change: Change | ContentEvent): number {
  if (change.type === "arrange.applied") return change.groups.length + change.removed.length + 2;
  if (change.type === "arrange.undone") return change.restored.length + change.removed.length + 2;
  return 1;
}

type ApplyCommand = Extract<ContentCommand, { type: "admin.arrange.apply" }>;
type UndoCommand = Extract<ContentCommand, { type: "admin.arrange.undo" }>;

const UNCHANGED: Decision = { kind: "unchanged" };

/** What the moderation's `admin.arrange.apply` makes of the wall. All of it or nothing: an arrangement that names a
 *  note that is gone, or touches what is a person's, is refused as a whole, and the browser that made it works it
 *  out again from the wall as it stands. Sent again, it finds itself applied and changes nothing. */
export function decideArrangeApply(
  wall: WallReader,
  command: ApplyCommand,
  by: Pick<Actor, "role">,
  ctx: StepContext,
): Decision {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (!ctx.can.arrange) return { kind: "refused", code: "PHASE" };
  if (wall.arranged()?.runId === command.opId) return UNCHANGED;

  const groups = wall.groups();
  const existing = new Map(groups.map((group) => [group.id, group]));
  if (command.groups.some((group) => existing.has(group.groupId))) return { kind: "refused", code: "CONFLICT" };

  const before: ArrangeRecord["before"] = {};
  const moves: NoteMove[] = [];
  for (const move of command.moves) {
    const from = wall.placement(move.noteId);
    if (from === null) return { kind: "refused", code: "NOT_FOUND" };
    if (from.groupId !== null && existing.get(from.groupId)?.locked === true) {
      return { kind: "refused", code: "CONFLICT" };
    }
    // a note that lies there already, in no group, is not moved: there is nothing to put back
    if (from.x === move.x && from.y === move.y && from.groupId === move.groupId) continue;
    before[move.noteId] = [from.x, from.y, from.groupId];
    moves.push({ noteId: move.noteId, x: move.x, y: move.y, groupId: move.groupId });
  }

  // Every note the command names leaves the group it was in: for one of the new groups, or for none. So a frame of
  // an earlier run (not locked, its title the AI's) goes when the command names every note in it.
  const named = new Set(command.moves.map((move) => move.noteId));
  const gone = groups.filter(
    (group) =>
      !group.locked && group.titleSource === "ki" && wall.members(group.id).every((noteId) => named.has(noteId)),
  );
  if (groups.length - gone.length + command.groups.length > MAX_GROUPS) return { kind: "refused", code: "LIMIT" };

  const last = Math.max(0, ...groups.map((group) => group.ord));
  const made = command.groups.map((group, index): Group => ({
    id: group.groupId,
    title: group.title,
    // the run's: the title is the AI's until a person writes one, and the next run may take the frame away
    titleSource: "ki",
    locked: false,
    x: group.x,
    y: group.y,
    w: group.w,
    h: group.h,
    ord: last + 1 + index,
  }));
  return {
    kind: "changed",
    change: {
      type: "arrange.applied",
      runId: command.opId,
      source: command.source,
      groups: made,
      moves,
      removed: gone.map((group) => group.id),
    },
    record: { runId: command.opId, before, made: made.map((group) => group.id), gone },
  };
}

/** What the moderation's `admin.arrange.undo` makes of the wall: the run it names is taken back, if it is the
 *  wall's last one.
 *
 *  Every note the run moved goes back to where it lay, into the group it was in, also when somebody has moved it
 *  since. Two exceptions: a note that was deleted stays deleted, and a note that lies in a locked group now stays
 *  there. Every group the run made goes, also one that somebody has moved or resized since: taking a run back is
 *  the moderation's own step to the wall as it was, and that wall had no such group. A note that somebody put into
 *  such a group since stays where it lies, without a group. One kind of group of the run does not go: one that is
 *  locked by now, because a person renamed it. It is that person's, and it stays as it stands, with the notes in
 *  it: they are not put back. The groups the run took away come back.
 *
 *  Nothing to take back (the command sent a second time): nothing changes. Another run is the wall's last one:
 *  `STALE`. A browser knows which run is the last one but not what the wall remembers of it: there the command
 *  shows nothing until the wall's event tells what went where. */
export function decideArrangeUndo(
  wall: WallReader,
  command: UndoCommand,
  by: Pick<Actor, "role">,
  ctx: StepContext,
): Decision {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (!ctx.can.arrange) return { kind: "refused", code: "PHASE" };
  const last = wall.arranged();
  if (last === null) return UNCHANGED;
  if (last.runId !== command.runId) return { kind: "refused", code: "STALE" };
  if (!("before" in last)) return UNCHANGED;

  const existing = new Map(wall.groups().map((group) => [group.id, group]));
  // The run's groups that are still there and still the run's. One that somebody deleted since is gone already;
  // one that a person renamed since is locked, and stays.
  const removed = last.made.filter((groupId) => existing.get(groupId)?.locked === false);
  const going = new Set(removed);
  // a group the run took away comes back, unless somebody made one under its id since
  const restored = last.gone.filter((group) => !existing.has(group.id));
  const back = new Set(restored.map((group) => group.id));

  const moves: NoteMove[] = [];
  for (const [noteId, [x, y, groupId]] of Object.entries(last.before)) {
    const now = wall.placement(noteId);
    if (now === null) continue;
    if (now.groupId !== null && existing.get(now.groupId)?.locked === true) continue;
    // The group the note was in: back again, or still there. One that is gone for good is no group, and neither is
    // a locked one under the old id: the run never took a note out of a locked group, so somebody has locked it
    // since (renamed it, or made a group under that id), and a locked group is not this command's to fill.
    const still =
      groupId !== null && (back.has(groupId) || (existing.get(groupId)?.locked === false && !going.has(groupId)));
    const target = still ? groupId : null;
    if (now.x === x && now.y === y && now.groupId === target) continue;
    moves.push({ noteId, x, y, groupId: target });
  }
  return { kind: "changed", change: { type: "arrange.undone", runId: last.runId, moves, removed, restored } };
}
