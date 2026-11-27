// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Hidden voting on the wall (PLAN-METHODEN.md 5, stage M2): „Still sammeln“ reaches its vote, everybody casts a
// ballot, the moderation counts. Acceptance of M2: before counting no frame to any browser carries somebody else's
// ballot or a tally; a ballot sent twice stays one. These tests read the frames as they arrived, text for text.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  applyServerEvent,
  canonicalBallot,
  generateHexId,
  initialWallState,
  type Ballot,
  type ServerEvent,
} from "@ideabeam/shared";
import {
  answer,
  ask,
  createHiddenWall,
  join,
  resync,
  setDailyRows,
  settle,
  type Sync,
  type TestSocket,
} from "./helpers.js";

const ofType = <T extends ServerEvent["type"]>(events: ServerEvent[], type: T) =>
  events.filter((event): event is Extract<ServerEvent, { type: T }> => event.type === type);

const go = (from: number, to: number) => ({ type: "admin.step.go", from, to });
/** „Still sammeln“: write 0, reveal 1, group 2, vote 3, discuss 4. */
const VOTE = 3;

async function write(socket: TestSocket, text: string): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(socket, { type: "note.create", noteId, text, x: 0, y: 0 })).toBe("ack");
  return noteId;
}

/** A wall in its vote: Anna moderates, Ben and Cem take part. Five notes, two of them in one group: the options are
 *  that group and the three notes in none, and the budget is two points (a quarter of four, at least two). */
async function aWallThatVotes() {
  const { wallId, adminToken } = await createHiddenWall();
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  const cem = await join(wallId, "Cem");
  const notes = [
    await write(anna.socket, "Weniger Termine"),
    await write(ben.socket, "Kürzere Termine"),
    await write(cem.socket, "Fokuszeit"),
    await write(ben.socket, "Ein Board"),
    await write(cem.socket, "Mehr Pausen"),
  ];
  expect(await ask(anna.socket, go(0, 1))).toBe("ack");
  expect(await ask(anna.socket, go(1, 2))).toBe("ack");
  const groupId = generateHexId();
  expect(await ask(anna.socket, { type: "group.create", groupId, title: "Termine", x: 0, y: 0, w: 600, h: 400 })).toBe(
    "ack",
  );
  expect(
    await ask(anna.socket, {
      type: "notes.move",
      moves: notes.slice(0, 2).map((noteId, n) => ({ noteId, x: 16 + n * 256, y: 40, groupId })),
    }),
  ).toBe("ack");
  expect(await ask(anna.socket, go(2, VOTE))).toBe("ack");
  await ben.socket.waitFor((event) => event.type === "step.changed" && event.step === VOTE);
  await cem.socket.waitFor((event) => event.type === "step.changed" && event.step === VOTE);
  return { wallId, adminToken, anna, ben, cem, notes, groupId };
}

const dots = (points: Record<string, number>): Extract<Ballot, { kind: "dots" }> => ({ kind: "dots", points });
const cast = (ballot: Ballot, step = VOTE) => ({ type: "ballot.cast", step, ballot });

describe("entering the vote", () => {
  it("freezes what may be chosen, once: the groups that hold notes, then the notes in none; with its budget", async () => {
    const { anna, ben, notes, groupId } = await aWallThatVotes();
    const changed = ofType(ben.socket.events, "step.changed").at(-1);
    const round = {
      step: VOTE,
      options: [{ id: groupId, kind: "group" }, ...notes.slice(2).map((id) => ({ id, kind: "note" }))],
      omitted: 0,
      limit: 2,
      counted: false,
    };
    expect(changed).toMatchObject({ step: VOTE, reach: VOTE, round, voted: 0, ballot: null });
    // nothing is written, moved, deleted or grouped while the vote runs
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "Spät", x: 0, y: 0 })).toBe(
      "PHASE",
    );
    expect(await ask(anna.socket, { type: "note.delete", noteId: notes[4] })).toBe("PHASE");
    expect(await ask(anna.socket, { type: "group.delete", groupId })).toBe("PHASE");
    // back to grouping, a group more, and on to the vote again: the options stay those frozen the first time
    expect(await ask(anna.socket, go(VOTE, 2))).toBe("ack");
    const late = generateHexId();
    expect(
      await ask(anna.socket, { type: "group.create", groupId: late, title: "Neu", x: 900, y: 0, w: 600, h: 400 }),
    ).toBe("ack");
    expect(
      await ask(anna.socket, { type: "notes.move", moves: [{ noteId: notes[4], x: 920, y: 40, groupId: late }] }),
    ).toBe("ack");
    expect(await ask(anna.socket, go(2, VOTE))).toBe("ack");
    const again = await ben.socket.waitFor(
      (event) => event.type === "step.changed" && event.step === VOTE && event.seq > (changed?.seq ?? 0),
    );
    expect(again).toMatchObject({ round });
    expect((await resync(ben.socket)).votes).toEqual([round]);
  });
});

describe("a ballot", () => {
  it("goes to its voter as stored and to everybody else as a number; sent twice it stays one", async () => {
    const { anna, ben, cem, notes, groupId } = await aWallThatVotes();
    const before = { anna: anna.socket.raw.length, cem: cem.socket.raw.length };
    const ballot = dots({ [groupId]: 1, [notes[2]!]: 1 });
    const first = await answer(ben.socket, cast(ballot));
    expect(first).toMatchObject({ type: "ack" });
    const seq = first.type === "ack" ? first.seq : -1;
    // the voter: the ballot in one spelling, and how many have voted
    const stored = ofType(ben.socket.events, "ballot.stored");
    expect(stored).toEqual([{ type: "ballot.stored", seq, step: VOTE, ballot: dots({ ...ballot.points }), voted: 1 }]);
    // everybody else, the moderation included: the number, and nothing else
    for (const other of [anna, cem]) {
      expect(await other.socket.waitFor((event) => event.type === "votes.count")).toEqual({
        type: "votes.count",
        seq,
        step: VOTE,
        voted: 1,
      });
    }
    await settle();
    expect(anna.socket.raw.slice(before.anna)).toEqual([
      JSON.stringify({ type: "votes.count", seq, step: VOTE, voted: 1 }),
    ]);
    expect(cem.socket.raw.slice(before.cem)).toHaveLength(1);

    // the same ballot again, in another order: one ballot, no row, no frame, the same number
    const othersHeard = anna.socket.raw.length;
    expect(await answer(ben.socket, cast(dots({ [notes[2]!]: 1, [groupId]: 1 })))).toMatchObject({ type: "ack", seq });
    await settle();
    expect(anna.socket.raw.length).toBe(othersHeard);
    // another ballot replaces it: still one voter
    expect(await answer(ben.socket, cast(dots({ [groupId]: 2 })))).toMatchObject({ type: "ack", seq: seq + 1 });
    expect(await anna.socket.waitFor((event) => event.type === "votes.count" && event.seq === seq + 1)).toMatchObject({
      voted: 1,
    });
    expect(await resync(ben.socket)).toMatchObject({ ballot: dots({ [groupId]: 2 }), voted: 1, results: [] });
    expect(await resync(cem.socket)).toMatchObject({ ballot: null, voted: 1, results: [] });
  });

  it("is refused past its budget, outside its options, in another step, and once the vote is counted", async () => {
    const { anna, ben, notes, groupId } = await aWallThatVotes();
    expect(await ask(ben.socket, cast(dots({ [groupId]: 3 })))).toBe("INVALID");
    // a note in a group is no option of its own: the group is
    expect(await ask(ben.socket, cast(dots({ [notes[0]!]: 1 })))).toBe("INVALID");
    expect(await ask(ben.socket, cast(dots({})))).toBe("INVALID");
    expect(await ask(ben.socket, cast({ kind: "approval", chosen: [groupId] }))).toBe("INVALID");
    expect(await ask(ben.socket, cast(dots({ [groupId]: 1 }), 2))).toBe("STALE");
    expect(await ask(ben.socket, { type: "admin.step.count", step: VOTE })).toBe("NOT_ADMIN");
    expect(await ask(anna.socket, { type: "admin.step.count", step: VOTE })).toBe("ack");
    expect(await ask(ben.socket, cast(dots({ [groupId]: 1 })))).toBe("PHASE");
    // a step that does not vote takes no ballot and no counting
    expect(await ask(anna.socket, go(VOTE, VOTE + 1))).toBe("ack");
    expect(await ask(ben.socket, cast(dots({ [groupId]: 1 }), VOTE + 1))).toBe("PHASE");
    expect(await ask(anna.socket, { type: "admin.step.count", step: VOTE + 1 })).toBe("PHASE");
  });

  it("counts against the brake of the wall's day", async () => {
    const { wallId, ben, groupId } = await aWallThatVotes();
    await setDailyRows(wallId, 1);
    const said = await answer(ben.socket, cast(dots({ [groupId]: 1 })));
    expect(said).toMatchObject({ type: "reject", code: "DAY_SPENT" });
  });
});

describe("counting", () => {
  it("ACCEPTANCE: before counting no frame to anybody carries another person's ballot or a tally; then everybody gets the result at once", async () => {
    const { anna, ben, cem, notes, groupId } = await aWallThatVotes();
    const ballots = {
      anna: dots({ [notes[2]!]: 2 }),
      ben: dots({ [groupId]: 1, [notes[3]!]: 1 }),
      cem: dots({ [groupId]: 2 }),
    };
    expect(await ask(anna.socket, cast(ballots.anna))).toBe("ack");
    expect(await ask(ben.socket, cast(ballots.ben))).toBe("ack");
    expect(await ask(cem.socket, cast(ballots.cem))).toBe("ack");
    await settle();
    // the frames every socket got up to now, joins and snapshots among them
    const sockets = { anna, ben, cem } as const;
    for (const [name, person] of Object.entries(sockets)) {
      const frames = person.socket.raw.map((text) => JSON.parse(text) as Record<string, unknown>);
      for (const frame of frames) {
        // no tally of any kind
        expect(frame.type, name).not.toBe("results.published");
        if (frame.type === "sync") expect(frame.results, name).toEqual([]);
        // a ballot only in the frames meant for its own voter
        const carried = frame.type === "ballot.stored" || frame.type === "sync" || frame.type === "step.changed";
        if (!carried) expect("ballot" in frame, `${name}: ${frame.type}`).toBe(false);
      }
      const own = JSON.stringify(canonicalBallot(ballots[name as keyof typeof ballots]));
      for (const [other, ballot] of Object.entries(ballots)) {
        if (other === name) continue;
        // nobody else's ballot, in any spelling, in any frame
        expect(
          person.socket.raw.some((text) => text.includes(JSON.stringify(ballot.points))),
          `${name} ⟵ ${other}`,
        ).toBe(false);
      }
      expect(ofType(person.socket.events, "ballot.stored").every((event) => JSON.stringify(event.ballot) === own)).toBe(
        true,
      );
    }

    const counted = await answer(anna.socket, { type: "admin.step.count", step: VOTE });
    expect(counted).toMatchObject({ type: "ack" });
    const results = await Promise.all(
      [anna, ben, cem].map((person) => person.socket.waitFor((event) => event.type === "results.published")),
    );
    // one frame, the same for everybody
    expect(new Set(results.map((event) => JSON.stringify(event))).size).toBe(1);
    expect(results[0]).toMatchObject({
      type: "results.published",
      result: {
        step: VOTE,
        kind: "dots",
        limit: 2,
        voters: 3,
        rows: [
          { id: groupId, kind: "group", label: "Termine", points: 3, by: 2, rank: 1 },
          { id: notes[2], kind: "note", label: "Fokuszeit", points: 2, by: 1, rank: 2 },
          { id: notes[3], kind: "note", label: "Ein Board", points: 1, by: 1, rank: 3 },
          { id: notes[4], kind: "note", label: "Mehr Pausen", points: 0, by: 0, rank: 4 },
        ],
      },
    });
    // the result names no voter
    for (const person of [anna, ben, cem]) {
      expect(JSON.stringify(results[0])).not.toContain(person.you);
    }
    // counted once: sent again it changes nothing
    const seq = counted.type === "ack" ? counted.seq : -1;
    expect(await answer(anna.socket, { type: "admin.step.count", step: VOTE })).toMatchObject({ type: "ack", seq });
  });

  it("snapshot and stream agree: what a browser builds from the frames is what a snapshot says, before and after counting", async () => {
    const { wallId, anna, ben, cem, groupId, notes } = await aWallThatVotes();
    // Cem's browser as it stands from its frames, from its first snapshot on
    const fromStream = () => cem.socket.events.reduce(applyServerEvent, initialWallState);
    const voteFields = (state: Pick<Sync, "votes" | "ballot" | "voted" | "results" | "seq">) => ({
      votes: state.votes,
      ballot: state.ballot,
      voted: state.voted,
      results: state.results,
      seq: state.seq,
    });
    expect(await ask(cem.socket, cast(dots({ [notes[4]!]: 1 })))).toBe("ack");
    expect(await ask(ben.socket, cast(dots({ [groupId]: 2 })))).toBe("ack");
    await cem.socket.waitFor((event) => event.type === "votes.count" && event.voted === 2);
    const streamed = fromStream();
    expect(streamed.gap).toBe(false);
    expect(voteFields(streamed)).toEqual(voteFields(await resync(cem.socket)));
    expect(await ask(anna.socket, { type: "admin.step.count", step: VOTE })).toBe("ack");
    await cem.socket.waitFor((event) => event.type === "results.published");
    expect(await ask(anna.socket, go(VOTE, VOTE + 1))).toBe("ack");
    await cem.socket.waitFor((event) => event.type === "step.changed" && event.step === VOTE + 1);
    const after = fromStream();
    expect(after.gap).toBe(false);
    expect(voteFields(after)).toEqual(voteFields(await resync(cem.socket)));
    expect(after.results).toHaveLength(1);
    // and somebody who comes only now gets the result in their first snapshot
    const late = await join(wallId, "Dora");
    expect(late.sync.results).toEqual(after.results);
    expect(late.sync).toMatchObject({ ballot: null, voted: 0 });
  });

  it("going back into a counted vote opens nothing: the result stays, ballots are refused, one's own ballot comes back", async () => {
    const { anna, ben, groupId } = await aWallThatVotes();
    expect(await ask(ben.socket, cast(dots({ [groupId]: 2 })))).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.step.count", step: VOTE })).toBe("ack");
    expect(await ask(anna.socket, go(VOTE, VOTE + 1))).toBe("ack");
    expect(await ask(anna.socket, go(VOTE + 1, VOTE))).toBe("ack");
    const back = await ben.socket.waitFor(
      (event) => event.type === "step.changed" && event.step === VOTE && event.reach === VOTE + 1,
    );
    expect(back).toMatchObject({ step: VOTE, round: { counted: true }, voted: 1, ballot: dots({ [groupId]: 2 }) });
    await settle();
    const annas = ofType(anna.socket.events, "step.changed").at(-1);
    expect(annas).toMatchObject({ step: VOTE, voted: 1, ballot: null });
    expect(await ask(ben.socket, cast(dots({ [groupId]: 1 })))).toBe("PHASE");
  });
});

describe("the export", () => {
  it("holds the ranking with points and how it was counted once counted; never a ballot, never a name", async () => {
    const { wallId, anna, ben, cem, groupId, notes } = await aWallThatVotes();
    expect(await ask(ben.socket, cast(dots({ [groupId]: 2 })))).toBe("ack");
    expect(await ask(cem.socket, cast(dots({ [notes[3]!]: 1 })))).toBe("ack");
    const exported = async () => {
      const response = await SELF.fetch(`https://example.com/api/walls/${wallId}/export?lang=de`, {
        headers: { Authorization: `Session ${cem.sessionKey}` },
      });
      expect(response.status).toBe(200);
      return response.text();
    };
    // not counted: no word about the vote
    expect(await exported()).not.toContain("Ergebnis der Wahl");
    expect(await ask(anna.socket, { type: "admin.step.count", step: VOTE })).toBe("ack");
    const text = await exported();
    expect(text).toContain(
      [
        "## Ergebnis der Wahl",
        "",
        "_Gezählt nach Punkten: 2 Punkte je Person, frei verteilt. Verdeckt abgegeben, zugleich ausgezählt: 2 Stimmzettel._",
        "",
        "- Platz 1: Termine · 2 Punkte",
        "- Platz 2: Ein Board · 1 Punkt",
        "- Platz 3: Fokuszeit · 0 Punkte",
        "- Platz 3: Mehr Pausen · 0 Punkte",
      ].join("\n"),
    );
    for (const name of ["Anna", "Ben", "Cem"]) expect(text).not.toContain(name);
  });
});
