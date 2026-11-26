// A proposal laid over a wall: what the preview shows, what „Anwenden“ sends, how both follow the wall while other
// people change it, and when taking a run back has to ask. And the numbers the layout of a proposal shares with
// the surface.
import { expect, test } from "vitest";
import { FRAME_HEAD, FRAME_PAD, NOTE_GAP } from "@ideabeam/arrange";
import {
  applyChange,
  decide,
  initialWallState,
  readerOf,
  type ContentCommand,
  type Group,
  type Note,
  type Proposal,
  type WallContent,
} from "@ideabeam/shared";
import { arrangeable, arrangementOf, previewOf, undoAsks } from "./arrange";
import { GROUP_HEAD, GROUP_PAD, groupOf } from "./surface/groups";
import { boxOf, GAP } from "./surface/notes";

const id = (n: number) => n.toString(16).padStart(32, "0");
const note = (n: number, text: string, at: Partial<Note> = {}): Note => ({
  id: id(n),
  mine: false,
  text,
  x: n * 300,
  y: 1000,
  groupId: null,
  createdAt: n,
  updatedAt: n,
  ...at,
});
const group = (n: number, title: string, at: Partial<Group> = {}): Group => ({
  id: id(0xa0 + n),
  title,
  titleSource: "person",
  locked: true,
  x: 0,
  y: 0,
  w: 528,
  h: 280,
  ord: n,
  ...at,
});
/** The ids a proposal's groups get: the first two of them. */
const IDS = [id(0xf1), id(0xf2)];
const ME = { id: id(0xee), role: "admin" as const };

// six notes, three about meetings and three about tools, and what the AI makes of them
const NOTES = [
  note(1, "Termine kürzen"),
  note(2, "Termine ohne Ergebnis"),
  note(3, "Termine bündeln"),
  note(4, "Werkzeuge vereinheitlichen"),
  note(5, "Werkzeuge erklären"),
  note(6, "Werkzeuge abschaffen"),
];
const WALL: WallContent = { notes: NOTES, groups: [] };
const PROPOSAL: Proposal = {
  groups: [
    { title: "Termine", noteIds: [id(1), id(2), id(3)] },
    { title: "Werkzeuge", noteIds: [id(4), id(5)] },
  ],
  loose: [id(6)],
};

/** What the wall itself makes of the command the browser would send: the rules of the shared package. */
function applied(content: WallContent, command: ContentCommand): WallContent {
  const decision = decide(readerOf(content), command, ME, 0, "open");
  if (decision.kind !== "changed") throw new Error(`the wall would not take it: ${decision.kind}`);
  return applyChange(content, decision.change);
}

test("the numbers a proposal is laid out by are the surface's own", () => {
  // packages/arrange cannot read the app: it repeats the room of a frame's head, the room to its edge and the room
  // between two notes. A change of one without the other would put notes on a frame's edge.
  expect(FRAME_HEAD).toBe(GROUP_HEAD);
  expect(FRAME_PAD).toBe(GROUP_PAD);
  expect(NOTE_GAP).toBe(GAP);
});

test("the preview shows the wall as the proposal would leave it: its groups, its notes in them, the rest beside", () => {
  const preview = previewOf(WALL, PROPOSAL, IDS);
  expect(preview.groups).toBe(2);
  expect(preview.loose).toBe(1);
  expect(preview.content.groups.map((one) => [one.id, one.title, one.titleSource, one.locked])).toEqual([
    [IDS[0], "Termine", "ki", false],
    [IDS[1], "Werkzeuge", "ki", false],
  ]);
  const groupIds = Object.fromEntries(preview.content.notes.map((one) => [one.id, one.groupId]));
  expect(groupIds).toEqual({
    [id(1)]: IDS[0],
    [id(2)]: IDS[0],
    [id(3)]: IDS[0],
    [id(4)]: IDS[1],
    [id(5)]: IDS[1],
    [id(6)]: null,
  });
  // every note of a group lies in its frame, and the note without a group in none: surface and list tell one story
  for (const one of preview.content.notes) {
    expect(groupOf(boxOf(one), preview.content.groups)).toBe(one.groupId);
  }
  // every note has moved: none lies where it lay
  const before = new Map(NOTES.map((one) => [one.id, one]));
  for (const one of preview.content.notes) {
    expect([one.x, one.y]).not.toEqual([before.get(one.id)?.x, before.get(one.id)?.y]);
  }
  // the box the view shows holds everything the proposal placed
  const { bounds } = preview;
  expect(bounds).not.toBeNull();
  for (const box of [...preview.content.groups, ...preview.content.notes.map(boxOf)]) {
    expect(box.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(box.y).toBeGreaterThanOrEqual(bounds!.y);
    expect(box.x + box.w).toBeLessThanOrEqual(bounds!.x + bounds!.w);
    expect(box.y + box.h).toBeLessThanOrEqual(bounds!.y + bounds!.h);
  }
  // the wall itself is untouched: a preview stores nothing and sends nothing
  expect(WALL.notes).toBe(NOTES);
  expect(WALL.groups).toEqual([]);
});

test("what „Anwenden“ sends makes of the wall exactly what the preview showed", () => {
  const arrangement = arrangementOf(WALL, PROPOSAL, IDS);
  expect(arrangement).not.toBeNull();
  const command: ContentCommand = { type: "admin.arrange.apply", opId: id(0x99), source: "service", ...arrangement! };
  expect(applied(WALL, command)).toEqual(previewOf(WALL, PROPOSAL, IDS).content);
});

test("a note deleted under the preview drops out of it; a note written under it stays where it lies", () => {
  // somebody deletes a note of „Werkzeuge“ and writes a new one while the proposal stands
  const later: WallContent = {
    notes: [...NOTES.filter((one) => one.id !== id(4)), note(7, "Neu dazugekommen", { x: -900, y: -900 })],
    groups: [],
  };
  const preview = previewOf(later, PROPOSAL, IDS);
  expect(preview.content.notes.map((one) => one.id)).not.toContain(id(4));
  expect(preview.content.notes.filter((one) => one.groupId === IDS[1]).map((one) => one.id)).toEqual([id(5)]);
  // the new note is no part of the proposal: it lies where its writer put it, without a group
  expect(preview.content.notes.find((one) => one.id === id(7))).toMatchObject({ x: -900, y: -900, groupId: null });
  expect(preview.groups).toBe(2);
  // and the command is laid out from that wall: it names no note that is gone
  const arrangement = arrangementOf(later, PROPOSAL, IDS)!;
  expect(arrangement.moves.map((move) => move.noteId).sort()).toEqual([id(1), id(2), id(3), id(5), id(6)]);
  const command: ContentCommand = { type: "admin.arrange.apply", opId: id(0x99), source: "service", ...arrangement };
  expect(applied(later, command)).toEqual(preview.content);
});

test("no frame is laid over a note the proposal does not know: the arrangement lies under it", () => {
  // without the new note the arrangement lies around the world's origin: the new note is written right there
  const [first] = arrangementOf(WALL, PROPOSAL, IDS)!.groups;
  const written = note(7, "Neu dazugekommen", { x: first!.x + 40, y: first!.y + 60 });
  const arrangement = arrangementOf({ notes: [...NOTES, written], groups: [] }, PROPOSAL, IDS)!;
  const box = boxOf(written);
  expect(arrangement.moves.map((move) => move.noteId)).not.toContain(written.id);
  for (const frame of arrangement.groups) expect(frame.y).toBeGreaterThanOrEqual(box.y + box.h);
  for (const move of arrangement.moves) expect(move.y).toBeGreaterThanOrEqual(box.y + box.h);
});

test("a group that loses every note under the preview is not made; with nothing left there is no arrangement", () => {
  const without = { notes: NOTES.filter((one) => one.id !== id(4) && one.id !== id(5)), groups: [] };
  const preview = previewOf(without, PROPOSAL, IDS);
  expect(preview.content.groups.map((one) => one.title)).toEqual(["Termine"]);
  expect(preview.groups).toBe(1);
  // every note of the proposal is gone: nothing to arrange, and the wall is shown as it stands
  const empty: WallContent = { notes: [note(7, "Neu dazugekommen")], groups: [] };
  expect(arrangementOf(empty, PROPOSAL, IDS)).toBeNull();
  expect(previewOf(empty, PROPOSAL, IDS)).toEqual({ content: empty, groups: 0, loose: 0, bounds: null });
});

test("a group made by hand stays as it is: its notes are left out, and the arrangement lies under it", () => {
  // while the proposal stands somebody makes a group by hand and puts a note of the proposal into it
  const hand = group(1, "Von Hand", { x: 2000, y: 2000 });
  const taken = note(2, "Termine ohne Ergebnis", { x: 2016, y: 2040, groupId: hand.id });
  const wall: WallContent = { notes: NOTES.map((one) => (one.id === taken.id ? taken : one)), groups: [hand] };
  expect(arrangeable(wall)).toBe(5);
  const preview = previewOf(wall, PROPOSAL, IDS);
  // the frame made by hand and the note in it lie where they lay
  expect(preview.content.groups.find((one) => one.id === hand.id)).toEqual(hand);
  expect(preview.content.notes.find((one) => one.id === taken.id)).toEqual(taken);
  // everything the proposal places lies under the frame made by hand
  expect(preview.bounds!.y).toBeGreaterThanOrEqual(hand.y + hand.h);
  // the wall takes the command: it touches nothing that is a person's
  const arrangement = arrangementOf(wall, PROPOSAL, IDS)!;
  expect(arrangement.moves.map((move) => move.noteId)).not.toContain(taken.id);
  const command: ContentCommand = { type: "admin.arrange.apply", opId: id(0x99), source: "service", ...arrangement };
  expect(applied(wall, command)).toEqual(preview.content);
});

/** A wall an earlier run arranged: two groups of the AI's, the first three notes in one, the other three in the
 *  other. */
function arrangedBefore(second: Partial<Group> = {}): { wall: WallContent; first: Group; second: Group } {
  const first = group(1, "Alt eins", { titleSource: "ki", locked: false, x: 0, y: 0 });
  const other = group(2, "Alt zwei", { titleSource: "ki", locked: false, x: 600, y: 0, ...second });
  const notes = NOTES.map((one, n) => ({
    ...one,
    x: (n < 3 ? 0 : 600) + 16,
    y: 40 + n * 10,
    groupId: (n < 3 ? first : other).id,
  }));
  return { wall: { notes, groups: [first, other] }, first, second: other };
}

test("the frames of an earlier run go with a new one; a group a person renamed since stays as it is, with its notes, and nothing lies over it", () => {
  const before = arrangedBefore();
  // as long as both are the AI's, every note may be arranged again, and both frames go
  expect(arrangeable(before.wall)).toBe(6);
  expect(previewOf(before.wall, PROPOSAL, IDS).content.groups.map((one) => one.title)).toEqual([
    "Termine",
    "Werkzeuge",
  ]);

  // a person renames the second group: by the wall's own rules it is theirs from then on
  const rename: ContentCommand = {
    type: "group.update",
    opId: id(0x98),
    groupId: before.second.id,
    title: "Unser Name",
  };
  const wall = applied(before.wall, rename);
  const renamed = wall.groups.find((one) => one.id === before.second.id)!;
  expect(renamed).toMatchObject({ title: "Unser Name", titleSource: "person", locked: true });
  const inIt = wall.notes.filter((one) => one.groupId === renamed.id);
  expect(inIt.map((one) => one.id)).toEqual([id(4), id(5), id(6)]);
  // its notes are no longer the AI's to arrange
  expect(arrangeable(wall)).toBe(3);

  // a proposal that still names them (it was asked for before the renaming): they are left out of what is sent
  const arrangement = arrangementOf(wall, PROPOSAL, IDS)!;
  expect(arrangement.moves.map((move) => move.noteId).sort()).toEqual([id(1), id(2), id(3)]);
  expect(arrangement.groups.map((one) => one.title)).toEqual(["Termine"]);
  const preview = previewOf(wall, PROPOSAL, IDS);
  // the other frame of the earlier run goes; the renamed one stands as it stood, with every note in it
  expect(preview.content.groups.map((one) => one.title)).toEqual(["Unser Name", "Termine"]);
  expect(preview.content.groups.find((one) => one.id === renamed.id)).toEqual(renamed);
  expect(preview.content.notes.filter((one) => one.groupId === renamed.id)).toEqual(inIt);
  expect(preview.bounds!.y).toBeGreaterThanOrEqual(renamed.y + renamed.h);
  // and the wall takes the command: it touches nothing that is a person's
  const command: ContentCommand = { type: "admin.arrange.apply", opId: id(0x99), source: "service", ...arrangement };
  expect(applied(wall, command)).toEqual(preview.content);
});

test("a frame of an older build that carries a person's title without being locked stays, empty, and nothing lies over it", () => {
  // a wall that was arranged before renaming locked a group: its renamed group is not locked, and nothing migrates it
  const { wall, second: legacy } = arrangedBefore({ title: "Unser Name", titleSource: "person", locked: false });
  // it is not locked: every note may be arranged, as then
  expect(arrangeable(wall)).toBe(6);
  const preview = previewOf(wall, PROPOSAL, IDS);
  expect(preview.content.groups.map((one) => one.title)).toEqual(["Unser Name", "Termine", "Werkzeuge"]);
  expect(preview.content.groups.find((one) => one.id === legacy.id)).toEqual(legacy);
  expect(preview.content.notes.filter((one) => one.groupId === legacy.id)).toEqual([]);
  expect(preview.bounds!.y).toBeGreaterThanOrEqual(legacy.y + legacy.h);
});

test("the preview follows the wall also while the proposal is on its way: it shows the same wall", () => {
  // „Anwenden“ was pressed: the browser shows its own command at once, and the preview still lies over that
  const arrangement = arrangementOf(WALL, PROPOSAL, IDS)!;
  const command: ContentCommand = { type: "admin.arrange.apply", opId: id(0x99), source: "service", ...arrangement };
  const sent = applied(WALL, command);
  expect(previewOf(sent, PROPOSAL, IDS).content).toEqual(sent);
  expect(previewOf(sent, PROPOSAL, IDS).groups).toBe(2);
});

test("„Rückgängig“ acts at once right after the run, and asks first once the wall has changed since", () => {
  const RUN = id(0x99);
  const after = { ...initialWallState, arrangeRun: RUN, seq: 12 };
  // this browser saw the run arrive, and the wall still stands at the number it stood at then
  expect(undoAsks(after, { runId: RUN, seq: 12 })).toBe(false);
  // somebody moved a note, wrote one, renamed a group: the wall's number moved on
  expect(undoAsks({ ...after, seq: 13 }, { runId: RUN, seq: 12 })).toBe(true);
  // a change of this browser is on its way: it will have changed in a moment
  const moving: ContentCommand = { type: "note.delete", opId: id(0x77), noteId: id(1) };
  expect(undoAsks({ ...after, pending: [{ command: moving, at: 0 }] }, { runId: RUN, seq: 12 })).toBe(true);
  // this browser did not see the run arrive (it joined later, it loaded the page again): it cannot tell, and asks
  expect(undoAsks(after, null)).toBe(true);
  // another run is the wall's last one by now
  expect(undoAsks({ ...after, arrangeRun: id(0x98) }, { runId: RUN, seq: 12 })).toBe(true);
  // nothing to take back
  expect(undoAsks({ ...after, arrangeRun: null }, { runId: RUN, seq: 12 })).toBe(true);
});

test("the notes the AI may arrange are those in no group a person made by hand or renamed", () => {
  expect(arrangeable(WALL)).toBe(6);
  const hand = group(1, "Von Hand");
  const run = group(2, "Von der KI", { titleSource: "ki", locked: false });
  // a group of the AI's that a person renamed: locked from then on
  const renamed = group(3, "Umbenannt", { titleSource: "person", locked: true });
  // the same from a wall of an older build: a person's title, not locked
  const legacy = group(4, "Früher umbenannt", { titleSource: "person", locked: false });
  const wall: WallContent = {
    notes: [
      note(1, "in einer Gruppe von Hand", { groupId: hand.id }),
      note(2, "in einer Gruppe der KI", { groupId: run.id }),
      note(3, "ohne Gruppe"),
      note(4, "in einer umbenannten Gruppe", { groupId: renamed.id }),
      note(5, "in einer früher umbenannten Gruppe", { groupId: legacy.id }),
    ],
    groups: [hand, run, renamed, legacy],
  };
  expect(arrangeable(wall)).toBe(3);
});
