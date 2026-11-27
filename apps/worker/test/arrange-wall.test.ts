// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Applying an arrangement and taking it back, on the wall (PLAN.md 3.4): `admin.arrange.apply` and
// `admin.arrange.undo` over a socket, against the real object and its storage. What the rules decide is tested in
// packages/shared (test/arrange.test.ts); here the whole way: the route's proposal, the product's layout, the
// command, what the wall stores, what every browser hears, and what a snapshot says afterwards.

import { evictAllDurableObjects, runInDurableObject } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import {
  applyServerEvent,
  generateHexId,
  initialWallState,
  type ArrangeRecord,
  type Proposal,
  type ServerEvent,
} from "@ideabeam/shared";
import {
  applyOf,
  arrangeRoute,
  proposed,
  refill,
  said,
  scriptedAi,
  setArrangeCount,
  wellBehaved,
  writeNotes,
} from "./arrange-helpers.js";
import {
  asSchemaThree,
  ask,
  createHiddenWall,
  createWall,
  FREE,
  join,
  resync,
  setDailyRows,
  settle,
  stubOf,
  type Sync,
} from "./helpers.js";

type Person = Awaited<ReturnType<typeof join>>;
type Applied = Extract<ServerEvent, { type: "arrange.applied" }>;
type Undone = Extract<ServerEvent, { type: "arrange.undone" }>;

const TEXTS = Array.from({ length: 14 }, (_, n) => `Thought number ${n + 1}, as somebody wrote it down`);

/** An open wall with its moderation Anna and Ben, notes of both scattered over it, and some of them moved. */
async function wall(texts = TEXTS) {
  const { wallId, adminToken } = await createWall("What slows us down?");
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  const half = Math.ceil(texts.length / 2);
  const noteIds = [
    ...(await writeNotes(anna.socket, texts.slice(0, half))),
    ...(await writeNotes(ben.socket, texts.slice(half), half)),
  ];
  // a few notes were dragged since they were made: they lie where the layout row says, not where they were made
  expect(
    await ask(ben.socket, {
      type: "notes.move",
      moves: [
        { noteId: noteIds[0], x: -4821, y: 37, groupId: null },
        { noteId: noteIds[3], x: 919, y: -2203, groupId: null },
      ],
    }),
  ).toBe("ack");
  await refill(wallId);
  return { wallId, adminToken, anna, ben, noteIds };
}

/** A group made by hand with these notes in it, as a person would put them there. */
async function byHand(person: Person, noteIds: string[], title = "Ours", x = 3000): Promise<string> {
  const groupId = generateHexId();
  expect(await ask(person.socket, { type: "group.create", groupId, title, x, y: -3000, w: 900, h: 600 })).toBe("ack");
  const moves = noteIds.map((noteId, n) => ({ noteId, x: x + 16 + n * 256, y: -2960, groupId }));
  if (moves.length > 0) expect(await ask(person.socket, { type: "notes.move", moves })).toBe("ack");
  return groupId;
}

/** The route's proposal for the wall, from an AI of the test's that names these themes. */
async function propose(wallId: string, adminToken: string, titles?: string[]): Promise<Proposal> {
  await setArrangeCount(null);
  const ai = scriptedAi(wellBehaved(titles));
  return (await proposed(await arrangeRoute(wallId, adminToken, { ai }))).proposal;
}

/** Applies the route's proposal with the product's layout, as the moderation, and returns the command. */
async function arranged(people: { wallId: string; adminToken: string; anna: Person }, titles?: string[]) {
  // a test asks for more snapshots than a person would: every socket may send again
  await refill(people.wallId);
  const proposal = await propose(people.wallId, people.adminToken, titles);
  const command = applyOf(proposal, await resync(people.anna.socket));
  expect(await said(people.anna.socket, command)).toBe("ack");
  return command;
}

/** What a snapshot holds of the wall's content: the notes with their places, the groups, and the run to undo. */
const contentOf = (sync: Sync) => ({ notes: sync.notes, groups: sync.groups, arrangeRun: sync.arrangeRun });
/** The same without whose note is whose: what two different people's snapshots have in common. */
const placesOf = (sync: Sync) => sync.notes.map(({ id, x, y, groupId, text }) => ({ id, x, y, groupId, text }));

/** The layout rows as the wall has stored them. */
const layoutRows = (wallId: string) =>
  runInDurableObject(stubOf(wallId), (_instance, state) =>
    Object.fromEntries(
      state.storage.sql
        .exec("SELECT k, v, seq FROM layout")
        .toArray()
        .map((row) => [String(row.k), { value: JSON.parse(String(row.v)) as unknown, seq: Number(row.seq) }]),
    ),
  );

const undo = (runId: string) => ({ type: "admin.arrange.undo", opId: generateHexId(), runId });

/** How many numbers an arrangement of these tests takes, applied or taken back, on a wall without earlier frames:
 *  one for each of its four groups, and two for the layout's rows (packages/shared, `numbersOf`). */
const TOOK = 4 + 2;

describe("applying an arrangement", () => {
  it("makes the groups, the AI's and not locked, puts the notes into them, and tells everyone in one numbered frame", async () => {
    const people = await wall();
    const { anna, ben, noteIds } = people;
    const before = await resync(anna.socket);
    const proposal = await propose(people.wallId, people.adminToken);
    const command = applyOf(proposal, before);
    expect(await said(anna.socket, command)).toBe("ack");

    const event = (await ben.socket.waitFor((e) => e.type === "arrange.applied")) as Applied;
    // the frame carries the last of the numbers the arrangement took: one for every row it wrote
    expect(event).toMatchObject({ seq: before.seq + TOOK, runId: command.opId, source: "service", removed: [] });
    expect(event.groups.map((group) => [group.id, group.title, group.titleSource, group.locked])).toEqual(
      command.groups.map((group) => [group.groupId, group.title, "ki", false]),
    );
    expect(event.groups.map((group) => group.ord)).toEqual([1, 2, 3, 4]);
    expect(event.moves).toEqual(command.moves);
    // the moderation's own browser hears the event before the ack
    const own = anna.socket.events;
    expect(own.findIndex((e) => e.type === "arrange.applied")).toBeLessThan(
      own.findIndex((e) => e.type === "ack" && e.opId === command.opId),
    );

    // every note lies where the command says, in its group; a snapshot says the same, and that there is a run to undo
    const after = await resync(ben.socket);
    expect(after).toMatchObject({ seq: before.seq + TOOK, arrangeRun: command.opId });
    const places = new Map(command.moves.map((move) => [move.noteId, move]));
    for (const note of after.notes) {
      expect({ noteId: note.id, x: note.x, y: note.y, groupId: note.groupId }).toEqual(places.get(note.id));
    }
    expect(after.notes.map((note) => note.id)).toEqual(noteIds);
    expect(after.groups).toEqual(event.groups);
  });

  it("is the moderation's alone, and only once the notes are revealed", async () => {
    const people = await wall();
    const command = applyOf(await propose(people.wallId, people.adminToken), await resync(people.anna.socket));
    expect(await said(people.ben.socket, command)).toBe("NOT_ADMIN");
    expect(await said(people.ben.socket, undo(command.opId))).toBe("NOT_ADMIN");
    expect((await resync(people.anna.socket)).groups).toEqual([]);

    const hidden = await createHiddenWall();
    const anna = await join(hidden.wallId, "Anna", { adminToken: hidden.adminToken });
    const [noteId] = await writeNotes(anna.socket, ["Mine"]);
    const groupId = generateHexId();
    const early = {
      type: "admin.arrange.apply",
      opId: generateHexId(),
      source: "browser",
      groups: [{ groupId, title: "Early", x: 0, y: 0, w: 300, h: 300, noteIds: [noteId] }],
      moves: [{ noteId, x: 16, y: 40, groupId }],
    };
    expect(await said(anna.socket, early)).toBe("PHASE");
    expect(await said(anna.socket, undo(early.opId))).toBe("PHASE");
  });

  it("is refused when it is no arrangement: halves that disagree, a note in two groups, a frame off the surface", async () => {
    const people = await wall();
    const good = applyOf(await propose(people.wallId, people.adminToken), await resync(people.anna.socket));
    const [first, second] = good.groups;
    if (first === undefined || second === undefined) throw new Error("two groups expected");
    const broken = [
      {
        ...good,
        groups: [first, { ...second, noteIds: [...second.noteIds, first.noteIds[0]] }, ...good.groups.slice(2)],
      },
      { ...good, moves: good.moves.map((move, n) => (n === 0 ? { ...move, groupId: null } : move)) },
      { ...good, moves: good.moves.slice(1) },
      { ...good, groups: [{ ...first, x: 60_000 }, ...good.groups.slice(1)] },
      { ...good, source: "somebody" },
      { ...good, groups: [] },
    ];
    for (const command of broken) {
      expect(await said(people.anna.socket, { ...command, opId: generateHexId() })).toBe("INVALID");
    }
    expect(await resync(people.anna.socket)).toMatchObject({ groups: [], arrangeRun: null });
  });

  it("is refused as a whole when a note it names is gone, and takes nothing of it", async () => {
    const people = await wall();
    const before = await resync(people.anna.socket);
    const command = applyOf(await propose(people.wallId, people.adminToken), before);
    // Ben deletes a note of his while the moderation looks at the proposal
    expect(await ask(people.ben.socket, { type: "note.delete", noteId: people.noteIds[13] })).toBe("ack");
    expect(await said(people.anna.socket, command)).toBe("NOT_FOUND");
    const after = await resync(people.anna.socket);
    expect(after).toMatchObject({ groups: [], arrangeRun: null, seq: before.seq + 1 });
    expect(placesOf(after)).toEqual(placesOf(before).slice(0, 13));
    // worked out again from the wall as it stands, it is taken
    expect(await said(people.anna.socket, applyOf(await propose(people.wallId, people.adminToken), after))).toBe("ack");
  });

  it("sent again it is no second arrangement: an ack, nothing told, no number taken", async () => {
    const people = await wall();
    const command = await arranged(people);
    const after = await resync(people.ben.socket);
    const frames = people.ben.socket.events.length;
    expect(await said(people.anna.socket, command)).toBe("ack");
    await settle();
    expect(people.ben.socket.events.slice(frames).filter((event) => event.type === "arrange.applied")).toEqual([]);
    expect(contentOf(await resync(people.ben.socket))).toEqual(contentOf(after));
    expect((await resync(people.ben.socket)).seq).toBe(after.seq);
  });

  it("builds the same wall from the frames of a connection as a fresh snapshot shows, through applying and taking back", async () => {
    const people = await wall();
    const { anna, ben } = people;
    const from = ben.socket.events.length;
    const start = await resync(ben.socket);
    const first = await arranged(people);
    expect(await ask(ben.socket, { type: "group.update", groupId: first.groups[0]?.groupId, title: "Ours now" })).toBe(
      "ack",
    );
    const second = await arranged(people, ["One", "Two", "Three"]);
    const built = () =>
      ben.socket.events
        .slice(from)
        .filter((event) => event.type !== "ack")
        .reduce(applyServerEvent, initialWallState);
    const now = await resync(ben.socket);
    let state = built();
    expect({ notes: state.notes, groups: state.groups, arrangeRun: state.arrangeRun, seq: state.seq }).toEqual({
      ...contentOf(now),
      seq: now.seq,
    });
    expect(state.gap).toBe(false);
    expect(now.arrangeRun).toBe(second.opId);

    expect(await said(anna.socket, undo(second.opId))).toBe("ack");
    const back = await resync(ben.socket);
    state = built();
    expect({ notes: state.notes, groups: state.groups, arrangeRun: state.arrangeRun, seq: state.seq }).toEqual({
      ...contentOf(back),
      seq: back.seq,
    });
    expect(state.gap).toBe(false);
    expect(back.seq).toBeGreaterThan(start.seq);
    // a newcomer gets the same wall
    const cem = await join(people.wallId, "Cem");
    expect(placesOf(cem.sync)).toEqual(placesOf(back));
    expect(cem.sync.groups).toEqual(back.groups);
  });

  it("goes past the wall's brake like every change: a wall that has written its day's rows refuses it, and says when it goes on", async () => {
    const people = await wall();
    const command = applyOf(await propose(people.wallId, people.adminToken), await resync(people.anna.socket));
    await setDailyRows(people.wallId, 1);
    people.anna.socket.send(command);
    const refused = await people.anna.socket.waitFor((event) => event.type === "reject" && event.opId === command.opId);
    expect(refused).toMatchObject({ code: "DAY_SPENT" });
    expect("resetsAt" in refused && refused.resetsAt).toBeGreaterThan(Date.now());
  });

  it("counts in the wall's brake by the rows it writes: arranging and taking back all day cannot write without end", async () => {
    const people = await wall();
    const { anna } = people;
    const start = (await resync(anna.socket)).seq;
    // room for the changes the wall has stored today, and for two arrangements with their rows
    await setDailyRows(people.wallId, start + 2 * TOOK);
    const first = await arranged(people);
    await setDailyRows(people.wallId, start + 2 * TOOK);
    expect(await said(anna.socket, undo(first.opId))).toBe("ack");
    expect((await resync(anna.socket)).seq).toBe(start + 2 * TOOK);
    // two changes, but as many numbers as rows: the day is spent, for an arrangement and for a single note
    const again = applyOf(await propose(people.wallId, people.adminToken), await resync(anna.socket));
    await setDailyRows(people.wallId, start + 2 * TOOK);
    expect(await said(anna.socket, again)).toBe("DAY_SPENT");
    expect(await ask(anna.socket, { type: "note.create", noteId: generateHexId(), text: "One more", x: 0, y: 0 })).toBe(
      "DAY_SPENT",
    );
  });
});

describe("taking an arrangement back", () => {
  it("restores every position exactly: every note lies where it lay, the run's groups are gone, and nothing is left to take back", async () => {
    const people = await wall();
    const { anna, ben } = people;
    const before = await resync(ben.socket);
    const stored = await layoutRows(people.wallId);
    const command = await arranged(people);
    const during = await resync(ben.socket);
    // the arrangement moved every note of the wall
    expect(during.notes.every((note, n) => note.x !== before.notes[n]?.x || note.y !== before.notes[n]?.y)).toBe(true);
    expect(during.groups).toHaveLength(4);

    expect(await said(anna.socket, undo(command.opId))).toBe("ack");
    const event = (await ben.socket.waitFor((e) => e.type === "arrange.undone")) as Undone;
    expect(event).toMatchObject({ seq: during.seq + TOOK, runId: command.opId, restored: [] });
    expect([...event.removed].sort()).toEqual(command.groups.map((group) => group.groupId).sort());
    expect(event.moves).toHaveLength(TEXTS.length);

    const after = await resync(ben.socket);
    expect(contentOf(after)).toEqual(contentOf(before));
    expect(after.seq).toBe(before.seq + 2 * TOOK);
    // and for the moderation's own snapshot: the same places, whose note is whose as before
    expect(placesOf(await resync(anna.socket))).toEqual(placesOf(before));
    // in the storage: the places as they were, and what the wall remembered of the run is gone
    const rows = await layoutRows(people.wallId);
    expect(Object.keys(rows)).toEqual(["pos"]);
    for (const [noteId, place] of Object.entries(stored.pos?.value as Record<string, unknown>)) {
      expect((rows.pos?.value as Record<string, unknown>)[noteId]).toEqual(place);
    }
    expect(rows.pos?.seq).toBe(after.seq);
  });

  it("remembers the run in one stored row beside the layout: where every note lay, the groups it made", async () => {
    const people = await wall();
    const before = await resync(people.anna.socket);
    const command = await arranged(people);
    const rows = await layoutRows(people.wallId);
    expect(Object.keys(rows).sort()).toEqual(["pos", "pos.prev"]);
    const record = rows["pos.prev"]?.value as ArrangeRecord;
    expect(record.runId).toBe(command.opId);
    expect(record.made.sort()).toEqual(command.groups.map((group) => group.groupId).sort());
    expect(record.gone).toEqual([]);
    expect(record.before).toEqual(Object.fromEntries(before.notes.map((note) => [note.id, [note.x, note.y, null]])));
    expect(rows["pos.prev"]?.seq).toBe(before.seq + TOOK);
  });

  it("names the run it means: another one than the wall's last is stale, and taking the same one back twice changes nothing", async () => {
    const people = await wall();
    const { anna, ben } = people;
    expect(await said(anna.socket, undo(generateHexId()))).toBe("ack"); // nothing to take back: nothing happens
    const first = await arranged(people);
    const second = await arranged(people, ["One", "Two"]);
    expect(await said(anna.socket, undo(first.opId))).toBe("STALE");
    expect((await resync(ben.socket)).arrangeRun).toBe(second.opId);
    expect(await said(anna.socket, undo(second.opId))).toBe("ack");
    const back = await resync(ben.socket);
    const frames = ben.socket.events.length;
    expect(await said(anna.socket, undo(second.opId))).toBe("ack");
    await settle();
    expect(ben.socket.events.slice(frames).filter((event) => event.type === "arrange.undone")).toEqual([]);
    expect((await resync(ben.socket)).seq).toBe(back.seq);
    // one step back, not two: the first run stands, and can no longer be taken back
    expect(back.arrangeRun).toBeNull();
    expect(back.groups.map((group) => group.id).sort()).toEqual(first.groups.map((group) => group.groupId).sort());
  });

  it("of a second run brings the first run's frames back, with every note in the frame it lay in", async () => {
    const people = await wall();
    const { anna, ben } = people;
    await arranged(people);
    const once = await resync(ben.socket);
    const second = await arranged(people, ["One", "Two"]);
    const twice = await resync(ben.socket);
    // the second run took the first one's four frames away and made two
    const applied = ben.socket.events.filter((event): event is Applied => event.type === "arrange.applied");
    expect([...(applied[1]?.removed ?? [])].sort()).toEqual(once.groups.map((group) => group.id).sort());
    expect(twice.groups.map((group) => group.title)).toEqual(["One", "Two"]);

    expect(await said(anna.socket, undo(second.opId))).toBe("ack");
    const event = (await ben.socket.waitFor((e) => e.type === "arrange.undone")) as Undone;
    expect(event.restored).toEqual(once.groups);
    const back = await resync(ben.socket);
    expect(back.notes).toEqual(once.notes);
    expect(back.groups).toEqual(once.groups);
  });

  it("puts a note back that somebody dragged since, leaves a deleted one deleted, and a note written since where it lies", async () => {
    const people = await wall();
    const { anna, ben, noteIds } = people;
    const before = await resync(ben.socket);
    const command = await arranged(people);
    const [dragged, deleted] = [noteIds[2], noteIds[13]];
    expect(await ask(ben.socket, { type: "notes.move", moves: [{ noteId: dragged, x: 7, y: 7, groupId: null }] })).toBe(
      "ack",
    );
    expect(await ask(ben.socket, { type: "note.delete", noteId: deleted })).toBe("ack");
    const [late] = await writeNotes(ben.socket, ["A late thought"], 40);
    const into = command.groups[0]?.groupId;
    expect(await ask(ben.socket, { type: "notes.move", moves: [{ noteId: late, x: 1, y: 2, groupId: into }] })).toBe(
      "ack",
    );

    expect(await said(anna.socket, undo(command.opId))).toBe("ack");
    const after = await resync(ben.socket);
    expect(after.groups).toEqual([]);
    expect(after.notes.filter((note) => note.id !== late)).toEqual(before.notes.filter((note) => note.id !== deleted));
    expect(after.notes.find((note) => note.id === late)).toMatchObject({ x: 1, y: 2, groupId: null });
  });
});

describe("what is a person's", () => {
  it("locked groups stay unchanged: the route does not read their notes, the wall refuses an arrangement that moves one, and taking back leaves them", async () => {
    const people = await wall();
    const { anna, ben, noteIds } = people;
    const kept = noteIds.slice(0, 3);
    const groupId = await byHand(ben, kept);
    const before = await resync(ben.socket);
    const locked = before.groups.find((group) => group.id === groupId);
    const lockedNotes = before.notes.filter((note) => note.groupId === groupId);
    expect(locked).toMatchObject({ locked: true, titleSource: "person" });
    expect(lockedNotes).toHaveLength(3);

    // the proposal does not name the notes of the locked group
    const proposal = await propose(people.wallId, people.adminToken);
    const named = [...proposal.groups.flatMap((group) => group.noteIds), ...proposal.loose];
    expect(named.sort()).toEqual(noteIds.slice(3).sort());

    // an arrangement that names one of them all the same is refused, and nothing of it is taken
    const greedy: Proposal = {
      groups: [
        { title: "Everything", noteIds: [...proposal.groups.flatMap((group) => group.noteIds), kept[0] as string] },
      ],
      loose: proposal.loose,
    };
    expect(await said(anna.socket, applyOf(greedy, before))).toBe("CONFLICT");
    expect(contentOf(await resync(ben.socket))).toEqual(contentOf(before));
    // and so is one that takes the locked group's id for a group of its own
    const honest = applyOf(proposal, before);
    const stolen = {
      ...honest,
      opId: generateHexId(),
      groups: honest.groups.map((group, n) => (n === 0 ? { ...group, groupId } : group)),
      moves: honest.moves.map((move) => (move.groupId === honest.groups[0]?.groupId ? { ...move, groupId } : move)),
    };
    expect(await said(anna.socket, stolen)).toBe("CONFLICT");

    // applied as proposed: the locked group and its notes are as they were, and no frame of the run lies on them
    await refill(people.wallId);
    expect(await said(anna.socket, honest)).toBe("ack");
    const during = await resync(ben.socket);
    expect(during.groups.find((group) => group.id === groupId)).toEqual(locked);
    expect(during.notes.filter((note) => note.groupId === groupId)).toEqual(lockedNotes);
    for (const frame of honest.groups) {
      expect(frame.y).toBeGreaterThanOrEqual((locked?.y ?? 0) + (locked?.h ?? 0));
    }
    // a second run and its undo leave them alone as well
    const second = await arranged(people, ["One", "Two"]);
    expect(await said(anna.socket, undo(second.opId))).toBe("ack");
    const after = await resync(ben.socket);
    expect(after.groups.find((group) => group.id === groupId)).toEqual(locked);
    expect(after.notes.filter((note) => note.groupId === groupId)).toEqual(lockedNotes);
  });

  it("a note that somebody put into a locked group since the run stays there when the run is taken back", async () => {
    const people = await wall();
    const { anna, ben, noteIds } = people;
    const groupId = await byHand(ben, []);
    const command = await arranged(people);
    const moved = { noteId: noteIds[5], x: 3016, y: -2960, groupId };
    expect(await ask(ben.socket, { type: "notes.move", moves: [moved] })).toBe("ack");
    expect(await said(anna.socket, undo(command.opId))).toBe("ack");
    const after = await resync(ben.socket);
    expect(after.notes.find((note) => note.id === noteIds[5])).toMatchObject({ x: 3016, y: -2960, groupId });
    expect(after.groups.map((group) => group.id)).toEqual([groupId]);
  });

  it("a group of the AI's that a person renames is theirs from then on: its notes are not handed out, a later run leaves it and them, and so does taking that run back", async () => {
    const people = await wall();
    const { anna, ben, noteIds } = people;
    const first = await arranged(people);
    const renamedId = first.groups[0]?.groupId as string;
    const inIt = new Set(first.groups[0]?.noteIds ?? []);
    expect(inIt.size).toBeGreaterThan(0);
    // renaming is everybody's: Ben does not moderate
    expect(await ask(ben.socket, { type: "group.update", groupId: renamedId, title: "What Ben calls it" })).toBe("ack");
    const told = anna.socket.events.findLast((event) => event.type === "group.updated");
    expect(told).toMatchObject({ group: { id: renamedId, titleSource: "person", locked: true } });
    const before = await resync(ben.socket);
    const renamed = before.groups.find((group) => group.id === renamedId);
    expect(renamed).toMatchObject({ title: "What Ben calls it", titleSource: "person", locked: true });
    const kept = before.notes.filter((note) => note.groupId === renamedId);
    expect(kept.map((note) => note.id).sort()).toEqual([...inIt].sort());
    const rest = noteIds.filter((noteId) => !inIt.has(noteId));

    // the wall hands the Worker every note but those of the renamed group, so the AI never reads them
    const input = await stubOf(people.wallId).arrangeInput(people.adminToken);
    if (input.kind !== "notes") throw new Error(`no notes: ${input.kind}`);
    expect(input.notes.map((note) => note.id)).toEqual(rest);
    await setArrangeCount(null);
    const ai = scriptedAi(wellBehaved(["One", "Two"]));
    const { proposal } = await proposed(await arrangeRoute(people.wallId, people.adminToken, { ai }));
    expect(ai.calls).toHaveLength(2);
    for (const call of ai.calls) for (const note of kept) expect(call.user).not.toContain(note.text);
    expect([...proposal.groups.flatMap((group) => group.noteIds), ...proposal.loose].sort()).toEqual([...rest].sort());

    // an arrangement that names one of its notes all the same is refused as a whole
    const greedy: Proposal = {
      groups: [{ title: "Everything", noteIds: [...rest, kept[0]?.id as string] }],
      loose: [],
    };
    expect(await said(anna.socket, applyOf(greedy, before))).toBe("CONFLICT");
    // and so is a run that names the group's id to give it a title of its own
    const second = applyOf(proposal, before);
    const overwrite = {
      ...second,
      opId: generateHexId(),
      groups: second.groups.map((group, n) =>
        n === 0 ? { ...group, groupId: renamedId, title: "The AI's word" } : group,
      ),
      moves: second.moves.map((move) =>
        move.groupId === second.groups[0]?.groupId ? { ...move, groupId: renamedId } : move,
      ),
    };
    expect(await said(anna.socket, overwrite)).toBe("CONFLICT");
    expect(contentOf(await resync(ben.socket))).toEqual(contentOf(before));

    // applied as proposed: the first run's other frames are gone, the renamed one stands with its notes as it
    // stood, and no frame of the new run lies on it
    await refill(people.wallId);
    expect(await said(anna.socket, second)).toBe("ack");
    const after = await resync(ben.socket);
    expect(after.groups.map((group) => group.title).sort()).toEqual(["One", "Two", "What Ben calls it"]);
    expect(after.groups.find((group) => group.id === renamedId)).toEqual(renamed);
    expect(after.notes.filter((note) => note.groupId === renamedId)).toEqual(kept);
    for (const frame of second.groups) {
      expect(frame.y).toBeGreaterThanOrEqual((renamed?.y ?? 0) + (renamed?.h ?? 0));
    }

    // taking the second run back leaves it too: the wall is what that run found, the renamed group in it
    expect(await said(anna.socket, undo(second.opId))).toBe("ack");
    expect(contentOf(await resync(ben.socket))).toEqual({ ...contentOf(before), arrangeRun: null });
  });

  it("taking a run back leaves a group of that run that a person has renamed since, with the notes in it; moving a frame keeps it the run's", async () => {
    const people = await wall();
    const { anna, ben } = people;
    const start = await resync(ben.socket);
    const command = await arranged(people);
    const [movedId, renamedId] = [command.groups[0]?.groupId as string, command.groups[1]?.groupId as string];
    // one frame is dragged and resized: that locks nothing. Another is renamed
    expect(await ask(ben.socket, { type: "group.update", groupId: movedId, x: -7000, y: 6000, w: 1200 })).toBe("ack");
    expect(await ask(ben.socket, { type: "group.update", groupId: renamedId, title: "Ours" })).toBe("ack");
    const during = await resync(ben.socket);
    expect(during.groups.find((group) => group.id === movedId)).toMatchObject({ x: -7000, w: 1200, locked: false });
    const renamed = during.groups.find((group) => group.id === renamedId);
    expect(renamed).toMatchObject({ title: "Ours", titleSource: "person", locked: true });
    const kept = during.notes.filter((note) => note.groupId === renamedId);
    expect(kept.length).toBeGreaterThan(0);
    const keptIds = new Set(kept.map((note) => note.id));

    expect(await said(anna.socket, undo(command.opId))).toBe("ack");
    const event = (await ben.socket.waitFor((e) => e.type === "arrange.undone")) as Undone;
    // the renamed group is not among those that go, and none of its notes is moved
    const others = command.groups.map((group) => group.groupId).filter((groupId) => groupId !== renamedId);
    expect([...event.removed].sort()).toEqual([...others].sort());
    expect(event.restored).toEqual([]);
    expect(event.moves.some((move) => keptIds.has(move.noteId))).toBe(false);
    expect(event.moves).toHaveLength(TEXTS.length - kept.length);
    // three groups went, and the layout's two rows were written
    expect(event.seq).toBe(during.seq + 3 + 2);

    const after = await resync(ben.socket);
    expect(after.arrangeRun).toBeNull();
    expect(after.groups).toEqual([renamed]);
    expect(after.notes.filter((note) => note.groupId === renamedId)).toEqual(kept);
    // every other note lies where it lay before the run
    expect(after.notes.filter((note) => !keptIds.has(note.id))).toEqual(
      start.notes.filter((note) => !keptIds.has(note.id)),
    );
    // the group is a person's group like any other from here on: the next run leaves it alone
    const proposal = await propose(people.wallId, people.adminToken, ["One", "Two"]);
    expect([...proposal.groups.flatMap((group) => group.noteIds), ...proposal.loose]).toHaveLength(
      TEXTS.length - kept.length,
    );
  });
});

describe("the wall and the AI", () => {
  it("the WallRoom makes no outgoing call: not for the route's read, not when an arrangement is applied or taken back", async () => {
    const people = await wall();
    // Whatever leaves the object would go through `fetch` or through the binding `AI`: both are watched. The
    // object runs in the test's isolate, so its `fetch` is this one; its `AI` is replaced in its own environment.
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.reject(new Error("a call left the test")));
    let asked = 0;
    const poison = () =>
      runInDurableObject(stubOf(people.wallId), (instance) => {
        const own = Reflect.get(instance, "env") as Record<string, unknown>;
        Reflect.set(instance, "env", {
          ...own,
          AI: {
            run: () => {
              asked += 1;
              throw new Error("the WallRoom asked the AI");
            },
          },
        });
      });
    await poison();
    try {
      const ai = scriptedAi();
      await setArrangeCount(null);
      const { proposal } = await proposed(await arrangeRoute(people.wallId, people.adminToken, { ai }));
      // the Worker asked the AI: the test's, twice; the wall was only read
      expect(ai.calls).toHaveLength(2);
      const command = applyOf(proposal, await resync(people.anna.socket));
      expect(await said(people.anna.socket, command)).toBe("ack");
      expect(await said(people.anna.socket, undo(command.opId))).toBe("ack");
      expect(await resync(people.ben.socket)).toMatchObject({ groups: [], arrangeRun: null });
      expect(asked).toBe(0);
      expect(fetched).not.toHaveBeenCalled();
    } finally {
      fetched.mockRestore();
    }
  });

  it("the wall's source names neither the binding nor a call out of the object", async () => {
    const { default: source } = await import("../src/wall-room.ts?raw");
    const code = source
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\/?\*)/u.test(line))
      // the object's own handler of requests is called `fetch`: its definition is no call
      .filter((line) => !line.includes("override async fetch(request: Request)"))
      .join("\n");
    expect(code.length).toBeGreaterThan(10_000);
    expect(code).not.toMatch(/\.AI\b/u);
    expect(code).not.toMatch(/\bfetch\(/u);
    expect(code).not.toMatch(/\bconnect\(|new WebSocket\(/u);
  });

  it("what the wall remembers of a run, and that there is one to take back, survive the Durable Object being evicted", async () => {
    const people = await wall();
    const { anna, ben } = people;
    const before = await resync(ben.socket);
    const command = await arranged(people);
    const during = await resync(ben.socket);
    await runInDurableObject(stubOf(people.wallId), (instance) => {
      Reflect.set(instance, "markOfTheFirstInstance", true);
    });

    await evictAllDurableObjects();

    expect(
      await runInDurableObject(stubOf(people.wallId), (instance) => Reflect.get(instance, "markOfTheFirstInstance")),
    ).toBeUndefined();
    // the same sockets go on: the snapshot is the same, and the woken object takes the run back exactly
    const woken = await resync(ben.socket);
    expect(contentOf(woken)).toEqual(contentOf(during));
    expect(woken).toMatchObject({ seq: during.seq, arrangeRun: command.opId });
    expect(await said(anna.socket, undo(command.opId))).toBe("ack");
    const after = await resync(ben.socket);
    expect(contentOf(after)).toEqual(contentOf(before));
    expect(after.seq).toBe(during.seq + TOOK);
  });
});

describe("a wall that an older build made", () => {
  it("of stage 3 takes an arrangement and its undo as it is: nothing it stores had to change", async () => {
    const people = await wall();
    const { anna, ben } = people;
    const groupId = await byHand(ben, people.noteIds.slice(0, 2));
    // as stage 3 left it: the same tables, schema 3, its flow in the old shape, no agenda and no row about a run
    await asSchemaThree(people.wallId, "open");
    const schema = () =>
      runInDurableObject(stubOf(people.wallId), (_instance, state) => ({
        version: String(state.storage.sql.exec("SELECT value FROM meta WHERE key = 'schemaVersion'").one().value),
        layout: state.storage.sql
          .exec("SELECT k FROM layout ORDER BY k")
          .toArray()
          .map((row) => String(row.k)),
      }));
    expect(await schema()).toEqual({ version: "3", layout: ["pos"] });
    const before = await resync(ben.socket);
    expect(before.arrangeRun).toBeNull();
    expect(before.groups).toMatchObject([{ id: groupId, locked: true }]);

    const command = await arranged(people);
    expect(await schema()).toEqual({ version: "3", layout: ["pos", "pos.prev"] });
    expect(await said(anna.socket, undo(command.opId))).toBe("ack");
    expect(await schema()).toEqual({ version: "3", layout: ["pos"] });
    expect(contentOf(await resync(ben.socket))).toEqual(contentOf(before));
  });

  it("of stage 4a before renaming locked a group: a renamed group that is not locked behaves as it did, and nothing migrates it", async () => {
    const people = await wall();
    const { anna, ben } = people;
    const first = await arranged(people);
    const legacyId = first.groups[0]?.groupId as string;
    // as that build stored a group of the AI's that a person had renamed: the title a person's, the group not locked
    await runInDurableObject(stubOf(people.wallId), (_instance, state) => {
      state.storage.sql.exec(
        "UPDATE groups SET title = 'Ours', title_source = 'person', locked = 0 WHERE id = ?",
        legacyId,
      );
    });
    const legacy = (await resync(ben.socket)).groups.find((group) => group.id === legacyId);
    expect(legacy).toMatchObject({ title: "Ours", titleSource: "person", locked: false });
    // its notes are handed out and arranged again, as then, and it stays as an empty frame with its title
    const proposal = await propose(people.wallId, people.adminToken, ["One", "Two"]);
    expect(proposal.groups.flatMap((group) => group.noteIds)).toHaveLength(TEXTS.length);
    const second = applyOf(proposal, await resync(anna.socket));
    expect(await said(anna.socket, second)).toBe("ack");
    const after = await resync(ben.socket);
    expect(after.groups.map((group) => group.title).sort()).toEqual(["One", "Ours", "Two"]);
    expect(after.groups.find((group) => group.id === legacyId)).toEqual(legacy);
    expect(after.notes.some((note) => note.groupId === legacyId)).toBe(false);
    // renamed once more, it is locked like every other
    expect(await ask(ben.socket, { type: "group.update", groupId: legacyId, title: "Ours, again" })).toBe("ack");
    expect((await resync(ben.socket)).groups.find((group) => group.id === legacyId)).toMatchObject({
      title: "Ours, again",
      titleSource: "person",
      locked: true,
    });
  });

  it("of stage 2 is brought up where the route reaches it first, and its notes can be arranged", async () => {
    const people = await wall();
    for (const person of [people.anna, people.ben]) person.socket.ws.close(1000, "deploy");
    await settle();
    await runInDurableObject(stubOf(people.wallId), (_instance, state) => {
      state.storage.sql.exec("UPDATE meta SET value = '2' WHERE key = 'schemaVersion'");
      state.storage.sql.exec("DELETE FROM meta WHERE key IN ('flow', 'day')");
    });
    await setArrangeCount(null);
    const { proposal } = await proposed(await arrangeRoute(people.wallId, people.adminToken, { ai: scriptedAi() }));
    expect([...proposal.groups.flatMap((group) => group.noteIds), ...proposal.loose].sort()).toEqual(
      [...people.noteIds].sort(),
    );
    const anna = await join(people.wallId, "Anna", {
      adminToken: people.adminToken,
      sessionKey: people.anna.sessionKey,
    });
    expect(anna.sync).toMatchObject({ ...FREE, arrangeRun: null });
    const command = applyOf(proposal, anna.sync);
    expect(await said(anna.socket, command)).toBe("ack");
    expect((await resync(anna.socket)).arrangeRun).toBe(command.opId);
  });
});
