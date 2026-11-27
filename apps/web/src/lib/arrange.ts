// arrange.ts: „Ordnen“ in the moderation's browser, as arithmetic (PLAN.md 4.3, steps 6 to 8): what a proposal of the
// AI makes of the wall as it stands, shown before anything is sent or stored, and when taking an arrangement back
// has to ask first. Pure functions; the rules of what an arrangement does to a wall are in @ideabeam/shared, where
// a proposal's notes and frames go is in @ideabeam/arrange, and neither is repeated here.
//
// A proposal names notes and gives each group a title, nothing else. Its places are worked out from the wall as it
// stands at that moment, each time anew: when the preview is drawn, when somebody else changes the wall under it,
// and when the moderation applies it. So a note that was deleted meanwhile drops out, a note that was written
// meanwhile stays where it lies, and what „Anwenden“ sends is what the preview showed.
import { layoutProposal, type Arrangement } from "@ideabeam/arrange";
import {
  agendaOf,
  applyChange,
  decideArrangeApply,
  readerOf,
  stepContext,
  type ContentCommand,
  type Proposal,
  type WallContent,
  type WallState,
} from "@ideabeam/shared";
import { boxOf } from "./surface/notes";
import { around, type Box } from "./surface/view";

/** A step in which the moderation arranges: the one step of „Freie Wand“, where everything is allowed. A preview is
 *  asked for only in such a step (pages/Wall.tsx). */
const ARRANGING = stepContext(agendaOf("free"), { step: 0, reach: 0 });

/** How many of a wall's notes the AI may arrange: those that lie in no locked group, which is a group a person made
 *  by hand or renamed. The Worker counts the same way when it reads the notes for a run. */
export function arrangeable(content: WallContent): number {
  const locked = lockedOf(content);
  return content.notes.filter((note) => note.groupId === null || !locked.has(note.groupId)).length;
}

const lockedOf = (content: WallContent) =>
  new Set(content.groups.filter((group) => group.locked).map((group) => group.id));

/** The notes the AI may arrange, as a run gets them: id and text, in the order they were made. What the Worker
 *  reads from the wall for a run of its own (wall-room.ts, `arrangeInput`), read here from the wall as this browser
 *  shows it: with the moderation's own key the browser asks, and the Worker is not involved. */
export function arrangeNotes(content: WallContent): Array<{ id: string; text: string }> {
  const locked = lockedOf(content);
  return content.notes
    .filter((note) => note.groupId === null || !locked.has(note.groupId))
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, text }) => ({ id, text }));
}

/** The two halves of `admin.arrange.apply` for a proposal, from the wall as it stands: the groups with their frames,
 *  and where every note goes. `groupIds` names the proposal's groups in its order. A note in a locked group is left
 *  out, and so is one that is gone; the arrangement is put under what stays where it is: the frames of the locked
 *  groups with their notes (made by hand, or renamed by a person), a frame that carries a person's title without
 *  being locked (a wall arranged before renaming locked a group can hold one: it stays as an empty frame when a run
 *  takes its notes), and a note the proposal does not know (written while the AI worked, or while the proposal
 *  stood): no frame is laid over it. null: nothing of the proposal is left to arrange. */
export function arrangementOf(
  content: WallContent,
  proposal: Proposal,
  groupIds: readonly string[],
): Arrangement | null {
  const locked = lockedOf(content);
  const kept = content.notes.filter((note) => note.groupId !== null && locked.has(note.groupId));
  const free = content.notes.filter((note) => note.groupId === null || !locked.has(note.groupId));
  const named = new Set([...proposal.groups.flatMap((group) => group.noteIds), ...proposal.loose]);
  const unknown = free.filter((note) => !named.has(note.id));
  const arrangement = layoutProposal({
    proposal,
    texts: new Map(free.map((note) => [note.id, note.text])),
    groupIds,
    keep: [
      ...content.groups
        .filter((group) => group.locked || group.titleSource === "person")
        .map(({ x, y, w, h }) => ({ x, y, w, h })),
      ...kept.map(boxOf),
      ...unknown.map(boxOf),
    ],
  });
  return arrangement.groups.length === 0 ? null : arrangement;
}

/** A proposal laid over the wall. */
export type Preview = {
  /** the wall as it would stand with the proposal applied */
  content: WallContent;
  /** how many groups the proposal makes of the notes that are still there */
  groups: number;
  /** how many of its notes found no group */
  loose: number;
  /** the box around everything the proposal places: what the view shows when the preview opens. null: nothing of
   *  the proposal is left */
  bounds: Box | null;
};

// The name the preview's command goes by. It is never sent: `admin.arrange.apply` gets an id of its own.
const PREVIEW = "0".repeat(32);

/** The wall with a proposal applied, worked out by the rules the wall itself applies it by (domain/arrange.ts): the
 *  groups the run would make, the frames of an earlier run it would take away, every note at its place. Nothing is
 *  sent. Where the rules would refuse the arrangement, or nothing of the proposal is left, the wall is shown as it
 *  stands. */
export function previewOf(content: WallContent, proposal: Proposal, groupIds: readonly string[]): Preview {
  const arrangement = arrangementOf(content, proposal, groupIds);
  if (arrangement === null) return { content, groups: 0, loose: 0, bounds: null };
  const command: Extract<ContentCommand, { type: "admin.arrange.apply" }> = {
    type: "admin.arrange.apply",
    opId: PREVIEW,
    source: "service",
    ...arrangement,
  };
  const decision = decideArrangeApply(readerOf(content), command, { role: "admin" }, ARRANGING);
  const texts = new Map(content.notes.map((note) => [note.id, note.text]));
  const loose = arrangement.moves.filter((move) => move.groupId === null);
  return {
    content: decision.kind === "changed" ? applyChange(content, decision.change) : content,
    groups: arrangement.groups.length,
    loose: loose.length,
    bounds: around([
      ...arrangement.groups.map(({ x, y, w, h }) => ({ x, y, w, h })),
      ...loose.map((move) => boxOf({ x: move.x, y: move.y, text: texts.get(move.noteId) ?? "" })),
    ]),
  };
}

/** The wall's last arrangement as this browser saw it arrive: the run, and the number the wall stood at right after
 *  it (store/wall.ts). */
export type Arranged = { runId: string; seq: number };

/** Whether „Rückgängig“ has to ask first. Taking a run back puts every note the run moved where it lay before, also
 *  one that somebody has moved since, and takes the run's groups away, also one that was moved since; a group that
 *  was renamed since stays, with its notes (domain/arrange.ts). Right after the run nothing can be lost by that,
 *  and it acts at once. Once the wall has changed since (its number moved on, or a change of this browser is on its
 *  way), or this browser did not see the run arrive and so cannot tell (it joined later, it reconnected), it asks
 *  and says what is lost. */
export function undoAsks(state: Pick<WallState, "arrangeRun" | "seq" | "pending">, arranged: Arranged | null): boolean {
  if (state.arrangeRun === null || arranged === null) return true;
  return arranged.runId !== state.arrangeRun || arranged.seq !== state.seq || state.pending.length > 0;
}
