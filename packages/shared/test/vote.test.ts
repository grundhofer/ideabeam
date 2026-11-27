// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Hidden voting (domain/vote.ts, stage M2): what may be chosen, the budget, which ballots fit, how they are counted,
// and the rules of `ballot.cast` and `admin.step.count`.

import { describe, expect, it } from "vitest";
import {
  ballotSchema,
  canonicalBallot,
  checkBallot,
  countedRounds,
  decideBallot,
  decideCount,
  generateHexId,
  limitOf,
  MAX_OPTIONS,
  openRound,
  optionsFor,
  sameBallot,
  tally,
  voteResultSchema,
  type Ballot,
  type VoteConfig,
  type VoteRound,
} from "../src/index.js";
import { HIDDEN_AGENDA } from "./steps.js";

const ids = Array.from({ length: 6 }, () => generateHexId()).sort();
const [a, b, c, d] = ids as [string, string, string, string];
const DOTS: VoteConfig = { kind: "dots", perPerson: null, maxPerOption: null };
const round = (options: string[], limit: number, counted = false): VoteRound => ({
  step: 3,
  options: options.map((id) => ({ id, kind: "note" as const })),
  omitted: 0,
  limit,
  counted,
});
const note = (id: string, createdAt: number, groupId: string | null = null) => ({ id, createdAt, groupId });
const label = (option: { id: string }) => `text ${option.id.slice(0, 4)}`;

describe("what may be chosen", () => {
  it("the groups that hold a note, in the order of the list, then the notes in no group; else the notes", () => {
    const [g1, g2, g3] = [generateHexId(), generateHexId(), generateHexId()];
    const content = {
      groups: [
        { id: g2, ord: 2 },
        { id: g1, ord: 1 },
        // an empty group offers nothing
        { id: g3, ord: 3 },
      ],
      notes: [note(a, 3, g1), note(b, 1, null), note(c, 2, g2), note(d, 4, "f".repeat(32))],
    };
    expect(optionsFor(content, true)).toEqual({
      options: [
        { id: g1, kind: "group" },
        { id: g2, kind: "group" },
        // a note whose group is gone counts as in none
        { id: b, kind: "note" },
        { id: d, kind: "note" },
      ],
      omitted: 0,
    });
    expect(optionsFor({ groups: [], notes: [note(b, 2), note(a, 1)] }, true).options.map((o) => o.id)).toEqual([a, b]);
  });

  it("at most 80, and says how many were left out; nothing while the notes are hidden", () => {
    const notes = Array.from({ length: 95 }, (_, n) => note(generateHexId(), n));
    const { options, omitted } = optionsFor({ groups: [], notes }, true);
    expect(options).toHaveLength(MAX_OPTIONS);
    expect(omitted).toBe(15);
    expect(optionsFor({ groups: [], notes }, false)).toEqual({ options: [], omitted: 0 });
  });

  it("a round begins with its options frozen, its budget set and nothing counted", () => {
    const content = { groups: [], notes: ids.map((id, n) => note(id, n)) };
    expect(openRound(3, DOTS, content, true)).toEqual({
      step: 3,
      options: ids.map((id) => ({ id, kind: "note" })),
      omitted: 0,
      limit: 2,
      counted: false,
    });
  });
});

describe("the budget", () => {
  it("points: a quarter of the options, at least two, or what the step names", () => {
    expect([0, 1, 4, 8, 9, 12, 13, 80].map((n) => limitOf(DOTS, n))).toEqual([2, 2, 2, 2, 3, 3, 4, 20]);
    expect(limitOf({ kind: "dots", perPerson: 5, maxPerOption: null }, 40)).toBe(5);
  });

  it("approval and rank never ask for more than there is; score is every option", () => {
    expect(limitOf({ kind: "approval", max: null }, 12)).toBe(3);
    expect(limitOf({ kind: "approval", max: 4 }, 2)).toBe(2);
    expect(limitOf({ kind: "rank", top: null }, 12)).toBe(5);
    expect(limitOf({ kind: "rank", top: null }, 3)).toBe(3);
    expect(limitOf({ kind: "score", criteria: [] }, 7)).toBe(7);
  });
});

describe("a ballot", () => {
  const vote = round([a, b, c], 3);

  it("points: only the vote's options, within the budget, at least one; stacked unless the step caps it", () => {
    expect(checkBallot(vote, DOTS, { kind: "dots", points: { [a]: 2, [b]: 1 } })).toBe(true);
    expect(checkBallot(vote, DOTS, { kind: "dots", points: { [a]: 3 } })).toBe(true);
    expect(checkBallot(vote, DOTS, { kind: "dots", points: { [a]: 2, [b]: 2 } })).toBe(false);
    expect(checkBallot(vote, DOTS, { kind: "dots", points: {} })).toBe(false);
    expect(checkBallot(vote, DOTS, { kind: "dots", points: { [d]: 1 } })).toBe(false);
    const capped: VoteConfig = { kind: "dots", perPerson: null, maxPerOption: 1 };
    expect(checkBallot(vote, capped, { kind: "dots", points: { [a]: 2 } })).toBe(false);
    expect(checkBallot(vote, capped, { kind: "dots", points: { [a]: 1, [c]: 1 } })).toBe(true);
    // a ballot of another kind than the step's
    expect(checkBallot(vote, DOTS, { kind: "approval", chosen: [a] })).toBe(false);
  });

  it("approval, rank and score each within their bounds", () => {
    const approval: VoteConfig = { kind: "approval", max: 2 };
    expect(checkBallot(round([a, b, c], 2), approval, { kind: "approval", chosen: [a, b] })).toBe(true);
    expect(checkBallot(round([a, b, c], 2), approval, { kind: "approval", chosen: [a, b, c] })).toBe(false);
    const rank: VoteConfig = { kind: "rank", top: 2 };
    expect(checkBallot(round([a, b, c], 2), rank, { kind: "rank", order: [c, a] })).toBe(true);
    expect(checkBallot(round([a, b, c], 2), rank, { kind: "rank", order: [c, a, b] })).toBe(false);
    const score: VoteConfig = { kind: "score", criteria: ["impact", "effort"] };
    expect(checkBallot(vote, score, { kind: "score", scores: { [a]: [5, 2] } })).toBe(true);
    expect(checkBallot(vote, score, { kind: "score", scores: { [a]: [5] } })).toBe(false);
  });

  it("the wire refuses a mark out of range, an id twice, a score past 5", () => {
    for (const ballot of [
      { kind: "dots", points: { [a]: 0 } },
      { kind: "dots", points: { [a]: 1.5 } },
      { kind: "dots", points: { nope: 1 } },
      { kind: "approval", chosen: [a, a] },
      { kind: "rank", order: [b, b] },
      { kind: "score", scores: { [a]: [6] } },
      { kind: "score", scores: { [a]: [] } },
      { kind: "veto", chosen: [a] },
    ]) {
      expect(ballotSchema.safeParse(ballot).success, JSON.stringify(ballot)).toBe(false);
    }
  });

  it("one spelling: the same ballot in another order is the same ballot; a rank's order is its meaning", () => {
    expect(sameBallot({ kind: "dots", points: { [b]: 1, [a]: 2 } }, { kind: "dots", points: { [a]: 2, [b]: 1 } })).toBe(
      true,
    );
    expect(sameBallot({ kind: "approval", chosen: [b, a] }, { kind: "approval", chosen: [a, b] })).toBe(true);
    expect(sameBallot({ kind: "rank", order: [b, a] }, { kind: "rank", order: [a, b] })).toBe(false);
    expect(sameBallot(null, { kind: "rank", order: [a] })).toBe(false);
    expect(canonicalBallot({ kind: "approval", chosen: [c, a] })).toEqual({ kind: "approval", chosen: [a, c] });
  });
});

describe("counting", () => {
  it("points add up; places are shared on equal points; every option is listed, with its words", () => {
    const vote = round([a, b, c, d], 3);
    const ballots: Ballot[] = [
      { kind: "dots", points: { [a]: 1, [b]: 2 } },
      { kind: "dots", points: { [b]: 1, [c]: 2 } },
      { kind: "dots", points: { [a]: 3 } },
    ];
    const result = tally(vote, DOTS, ballots, label);
    expect(result).toMatchObject({ step: 3, kind: "dots", limit: 3, voters: 3 });
    expect(result.rows.map((row) => [row.id, row.points, row.by, row.rank])).toEqual([
      [a, 4, 2, 1],
      [b, 3, 2, 2],
      [c, 2, 1, 3],
      [d, 0, 0, 4],
    ]);
    expect(result.rows[0]?.label).toBe(label({ id: a }));
    expect(voteResultSchema.safeParse(result).success).toBe(true);
    const tied = tally(vote, DOTS, [{ kind: "dots", points: { [c]: 1, [b]: 1 } }], label);
    // equal points keep the order of the options, and share the place
    expect(tied.rows.map((row) => [row.id, row.rank])).toEqual([
      [b, 1],
      [c, 1],
      [a, 3],
      [d, 3],
    ]);
  });

  it("a ballot that does not fit counts for nothing", () => {
    const result = tally(round([a, b], 2), DOTS, [{ kind: "dots", points: { [a]: 5 } }], label);
    expect(result.voters).toBe(0);
    expect(result.rows.every((row) => row.points === 0)).toBe(true);
  });

  it("approval counts the people; rank counts by Borda over the places asked for", () => {
    const approval = tally(
      round([a, b, c], 2),
      { kind: "approval", max: 2 },
      [
        { kind: "approval", chosen: [a, b] },
        { kind: "approval", chosen: [b] },
      ],
      label,
    );
    expect(approval.rows.map((row) => [row.id, row.points])).toEqual([
      [b, 2],
      [a, 1],
      [c, 0],
    ]);
    const rank = tally(
      round([a, b, c], 3),
      { kind: "rank", top: 3 },
      [
        { kind: "rank", order: [a, b, c] },
        { kind: "rank", order: [b, a] },
        { kind: "rank", order: [b] },
      ],
      label,
    );
    // a: 3 + 2, b: 2 + 3 + 3, c: 1
    expect(rank.rows.map((row) => [row.id, row.points])).toEqual([
      [b, 8],
      [a, 5],
      [c, 1],
    ]);
  });

  it("score: the mean of each criterion and of the criteria; an option nobody scored is last with 0", () => {
    const result = tally(
      round([a, b, c], 3),
      { kind: "score", criteria: ["impact", "effort"] },
      [
        { kind: "score", scores: { [a]: [5, 3], [b]: [2, 2] } },
        { kind: "score", scores: { [a]: [4, 2] } },
      ],
      label,
    );
    expect(result.rows.map((row) => [row.id, row.points, row.by, row.scores])).toEqual([
      [a, 3.5, 2, [4.5, 2.5]],
      [b, 2, 1, [2, 2]],
      [c, 0, 0, []],
    ]);
  });
});

describe("the rules of the commands", () => {
  const steps = HIDDEN_AGENDA.steps;
  const flow = { step: 3, votes: [round([a, b, c], 2)] };
  const cast = (ballot: Ballot, step = 3) => ({ step, ballot });

  it("a ballot is taken in the step that votes, before counting, when it fits; the same again changes nothing", () => {
    const ballot: Ballot = { kind: "dots", points: { [b]: 1, [a]: 1 } };
    expect(decideBallot(flow, steps, cast(ballot), null)).toEqual({ kind: "changed", ballot: canonicalBallot(ballot) });
    expect(decideBallot(flow, steps, cast(ballot), canonicalBallot(ballot))).toEqual({ kind: "unchanged" });
    expect(decideBallot(flow, steps, cast({ kind: "dots", points: { [a]: 2 } }), ballot)).toMatchObject({
      kind: "changed",
    });
    expect(decideBallot(flow, steps, cast({ kind: "dots", points: { [a]: 3 } }), null)).toEqual({
      kind: "refused",
      code: "INVALID",
    });
    expect(decideBallot(flow, steps, cast(ballot, 2), null)).toEqual({ kind: "refused", code: "STALE" });
    expect(decideBallot({ step: 2, votes: flow.votes }, steps, cast(ballot, 2), null)).toEqual({
      kind: "refused",
      code: "PHASE",
    });
    expect(decideBallot({ step: 3, votes: countedRounds(flow.votes, 3) }, steps, cast(ballot), null)).toEqual({
      kind: "refused",
      code: "PHASE",
    });
  });

  it("counting is the moderation's, in the step that votes, once", () => {
    const anna = { role: "admin" } as const;
    expect(decideCount(flow, steps, { step: 3 }, anna)).toMatchObject({ kind: "changed", round: flow.votes[0] });
    expect(decideCount(flow, steps, { step: 3 }, { role: "member" })).toEqual({ kind: "refused", code: "NOT_ADMIN" });
    expect(decideCount(flow, steps, { step: 2 }, anna)).toEqual({ kind: "refused", code: "STALE" });
    expect(decideCount({ step: 2, votes: flow.votes }, steps, { step: 2 }, anna)).toEqual({
      kind: "refused",
      code: "PHASE",
    });
    expect(decideCount({ step: 3, votes: countedRounds(flow.votes, 3) }, steps, { step: 3 }, anna)).toEqual({
      kind: "unchanged",
    });
  });
});
