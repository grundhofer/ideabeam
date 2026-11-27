// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Estimating in rounds (stage M3): the summary of estimates, which estimates fit, how they are counted, the method
// „Schätzen – Diskutieren – Schätzen“ with its steps, its unit from the request, and its rounds in the export.

import { describe, expect, it } from "vitest";
import {
  agendaFor,
  agendaOf,
  agendaRequestSchema,
  aggregate,
  ballotSchema,
  CATALOGUE,
  canonicalBallot,
  checkAgenda,
  checkBallot,
  createWallRequestSchema,
  decideBallot,
  decideCount,
  decideStep,
  estimateNumber,
  initialFlow,
  noteLevel,
  openRound,
  sameBallot,
  stepContext,
  tally,
  voteResultSchema,
  wallMarkdown,
  type Ballot,
  type EstimateResult,
  type StoredNote,
  type VoteConfig,
} from "../src/index.js";

const ESTIMATE: VoteConfig = { kind: "estimate", unit: null, min: null, max: null };
const round = (step = 0, counted = false) => ({ step, options: [], omitted: 0, limit: 1, counted });
const estimate = (value: number): Ballot => ({ kind: "estimate", value });
const label = () => "";

describe("the summary of estimates", () => {
  it("an odd number: the middle one is the median; the quartiles lie between the estimates around them", () => {
    expect(aggregate([60, 25, 40, 30, 50])).toEqual({ n: 5, median: 40, q1: 30, q3: 50, min: 25, max: 60 });
    // 1, 2, 3, 4, 100: the quartiles at a quarter and three quarters of the way, interpolated
    expect(aggregate([100, 3, 1, 4, 2])).toEqual({ n: 5, median: 3, q1: 2, q3: 4, min: 1, max: 100 });
    expect(aggregate([10, 20, 30])).toEqual({ n: 3, median: 20, q1: 15, q3: 25, min: 10, max: 30 });
  });

  it("an even number: the median lies halfway between the two in the middle", () => {
    expect(aggregate([40, 10, 30, 20])).toEqual({ n: 4, median: 25, q1: 17.5, q3: 32.5, min: 10, max: 40 });
    expect(aggregate([5, 7])).toEqual({ n: 2, median: 6, q1: 5.5, q3: 6.5, min: 5, max: 7 });
    expect(aggregate([10, 23, 37, 90])).toEqual({ n: 4, median: 30, q1: 19.75, q3: 50.25, min: 10, max: 90 });
  });

  it("a single estimate is all of it at once; none is no summary", () => {
    expect(aggregate([42])).toEqual({ n: 1, median: 42, q1: 42, q3: 42, min: 42, max: 42 });
    expect(aggregate([])).toBeNull();
  });

  it("is rounded to six places, so no binary rest reaches a sentence; equal estimates and negatives work", () => {
    expect(aggregate([0.1, 0.2])?.median).toBe(0.15);
    expect(aggregate([0.1, 0.2, 0.3, 0.4])?.q1).toBe(0.175);
    expect(aggregate([7, 7, 7, 7])).toEqual({ n: 4, median: 7, q1: 7, q3: 7, min: 7, max: 7 });
    expect(aggregate([-5, 5])).toEqual({ n: 2, median: 0, q1: -2.5, q3: 2.5, min: -5, max: 5 });
  });

  it("never the mean: a far estimate moves the median not at all", () => {
    expect(aggregate([10, 11, 12])?.median).toBe(11);
    expect(aggregate([10, 11, 1_000_000])?.median).toBe(11);
  });
});

describe("an estimate as a ballot", () => {
  it("one finite number within the limit; nothing else is an estimate", () => {
    expect(ballotSchema.safeParse(estimate(2.5)).success).toBe(true);
    expect(ballotSchema.safeParse(estimate(-1e12)).success).toBe(true);
    expect(ballotSchema.safeParse(estimate(1e13)).success).toBe(false);
    expect(ballotSchema.safeParse({ kind: "estimate", value: Number.NaN }).success).toBe(false);
    expect(ballotSchema.safeParse({ kind: "estimate", value: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(ballotSchema.safeParse({ kind: "estimate", value: "40" }).success).toBe(false);
    expect(ballotSchema.safeParse({ kind: "estimate" }).success).toBe(false);
  });

  it("fits an estimate step within its bounds, and no other vote", () => {
    expect(checkBallot(round(), ESTIMATE, estimate(40))).toBe(true);
    const bounded: VoteConfig = { kind: "estimate", unit: "%", min: 0, max: 100 };
    expect(checkBallot(round(), bounded, estimate(0))).toBe(true);
    expect(checkBallot(round(), bounded, estimate(100))).toBe(true);
    expect(checkBallot(round(), bounded, estimate(101))).toBe(false);
    expect(checkBallot(round(), bounded, estimate(-1))).toBe(false);
    expect(checkBallot(round(), { kind: "dots", perPerson: 2, maxPerOption: null }, estimate(1))).toBe(false);
    expect(checkBallot(round(), ESTIMATE, { kind: "dots", points: {} })).toBe(false);
  });

  it("the same estimate twice is one; -0 is 0", () => {
    expect(sameBallot(estimate(40), estimate(40))).toBe(true);
    expect(sameBallot(estimate(40), estimate(41))).toBe(false);
    expect(JSON.stringify(canonicalBallot(estimate(-0)))).toBe(JSON.stringify(estimate(0)));
  });

  it("an estimate step opens without options and takes one estimate a person", () => {
    expect(openRound(0, ESTIMATE, { notes: [], groups: [] }, false)).toEqual({
      step: 0,
      options: [],
      omitted: 0,
      limit: 1,
      counted: false,
    });
  });
});

describe("counting estimates", () => {
  it("gives the summary with the unit and how many estimated, never a single estimate", () => {
    const config: VoteConfig = { kind: "estimate", unit: "Tage", min: null, max: null };
    const result = tally(round(3), config, [estimate(10), estimate(23), estimate(37), estimate(90)], label);
    expect(result).toEqual({
      step: 3,
      kind: "estimate",
      unit: "Tage",
      voters: 4,
      summary: { n: 4, median: 30, q1: 19.75, q3: 50.25, min: 10, max: 90 },
    });
    expect(voteResultSchema.safeParse(result).success).toBe(true);
    // the two in the middle stand nowhere in the result
    expect(JSON.stringify(result)).not.toMatch(/\b23\b|\b37\b/);
  });

  it("nobody estimated: no summary; a ballot that does not fit counts for nothing", () => {
    expect(tally(round(), ESTIMATE, [], label)).toMatchObject({ voters: 0, summary: null });
    const bounded: VoteConfig = { kind: "estimate", unit: null, min: 0, max: 10 };
    expect(tally(round(), bounded, [estimate(5), estimate(50)], label)).toMatchObject({
      voters: 1,
      summary: { n: 1, median: 5 },
    });
  });
});

describe("„Schätzen – Diskutieren – Schätzen“", () => {
  const agenda = agendaOf("schaetzen");
  const steps = agenda.steps;

  it("estimates hidden with a reason, shows the summary and the reasons, discusses, estimates again, shows both", () => {
    expect(steps.map((step) => step.type)).toEqual(["estimate", "reveal", "discuss", "estimate", "discuss"]);
    expect(steps.map((step) => step.visibility)).toEqual(["aggregate", "anonymous", "all", "aggregate", "aggregate"]);
    expect(steps[0]).toMatchObject({ vote: { kind: "estimate" }, noteKind: "reason", output: "estimate" });
    expect(steps[3]).toMatchObject({ vote: { kind: "estimate" }, output: "estimate" });
    expect(steps[3]?.noteKind).toBeUndefined();
    expect(checkAgenda(agenda)).toEqual([]);
    expect(CATALOGUE.schaetzen).toMatchObject({ purpose: "decide", groupSize: [5, 30] });
    const seconds = steps.reduce((sum, step) => sum + (step.durationSec ?? 0), 0);
    expect(CATALOGUE.schaetzen.minutes).toBe(Math.ceil(seconds / 300) * 5);
  });

  it("the reasons are written in the first estimate, hidden, and shown from the feedback on; none in round 2", () => {
    const first = stepContext(agenda, { step: 0, reach: 0 });
    expect(first.can).toMatchObject({ write: true, ballot: true, group: false, arrange: false });
    expect(first.sight).toBe("hidden");
    expect(stepContext(agenda, { step: 1, reach: 1 }).sight).toBe("all");
    expect(stepContext(agenda, { step: 3, reach: 3 }).can).toMatchObject({ write: false, ballot: true });
    // going back to the first estimate hides nothing again
    expect(stepContext(agenda, { step: 0, reach: 1 }).sight).toBe("all");
    expect(noteLevel(steps, 0)).toBe("hidden");
  });

  it("moving to the feedback reveals the reasons; each estimate step opens its own vote", () => {
    const flow = initialFlow();
    expect(
      decideStep({ ...flow, votes: [round(0, true)] }, agenda, { from: 0, to: 1 }, { role: "admin" }),
    ).toMatchObject({ kind: "changed", widens: true, opens: false });
    const atDiscuss = { ...flow, step: 2, reach: 2, votes: [round(0, true)] };
    expect(decideStep(atDiscuss, agenda, { from: 2, to: 3 }, { role: "admin" })).toMatchObject({
      kind: "changed",
      widens: false,
      opens: true,
    });
  });

  it("an estimate is taken in its round until it is counted; counting is the moderation's", () => {
    const flow = { step: 3, votes: [round(0, true), round(3)] };
    expect(decideBallot(flow, steps, { step: 3, ballot: estimate(40) }, null)).toEqual({
      kind: "changed",
      ballot: estimate(40),
    });
    expect(decideBallot(flow, steps, { step: 0, ballot: estimate(40) }, null)).toEqual({
      kind: "refused",
      code: "STALE",
    });
    expect(decideBallot(flow, steps, { step: 3, ballot: { kind: "dots", points: {} } }, null)).toMatchObject({
      kind: "refused",
      code: "INVALID",
    });
    expect(decideBallot({ step: 0, votes: flow.votes }, steps, { step: 0, ballot: estimate(1) }, null)).toEqual({
      kind: "refused",
      code: "PHASE",
    });
    expect(decideCount(flow, steps, { step: 3 }, { role: "admin" })).toMatchObject({ kind: "changed" });
  });

  it("the unit the moderation typed goes into both estimates; a method without an estimate ignores it", () => {
    const request = { items: [{ methodId: "schaetzen" as const, unit: "Tage" }] };
    expect(agendaRequestSchema.safeParse(request).success).toBe(true);
    const made = agendaFor({ hidden: true, agenda: request });
    expect(made.steps[0]?.vote).toEqual({ kind: "estimate", unit: "Tage", min: null, max: null });
    expect(made.steps[3]?.vote).toEqual({ kind: "estimate", unit: "Tage", min: null, max: null });
    expect(agendaFor({ hidden: true, agenda: { items: [{ methodId: "schaetzen" }] } }).steps[0]?.vote).toMatchObject({
      unit: null,
    });
    expect(agendaFor({ hidden: true, agenda: { items: [{ methodId: "free", unit: "Tage" }] } })).toEqual(
      agendaOf("free"),
    );
    for (const unit of ["", "x".repeat(21), "Tage\nmehr", "a b"]) {
      expect(agendaRequestSchema.safeParse({ items: [{ methodId: "schaetzen", unit }] }).success, unit).toBe(false);
    }
    expect(createWallRequestSchema.safeParse({ question: "Wie viele Tage?", agenda: request }).success).toBe(true);
  });
});

describe("the rounds in the export", () => {
  const AT = Date.UTC(2026, 10, 27, 10, 0, 0);
  const anna = "a".repeat(32);
  const round1: EstimateResult = {
    step: 0,
    kind: "estimate",
    unit: "Tage",
    voters: 8,
    summary: { n: 8, median: 40, q1: 30, q3: 50, min: 25, max: 60 },
  };
  const round2: EstimateResult = {
    step: 3,
    kind: "estimate",
    unit: "Tage",
    voters: 7,
    summary: { n: 7, median: 42.5, q1: 38, q3: 46, min: 30, max: 1200 },
  };
  const reason = (letter: string, authorId: string, text: string): StoredNote => ({
    id: letter.repeat(32),
    authorId,
    text,
    x: 0,
    y: 0,
    groupId: null,
    createdAt: AT - 1000,
    updatedAt: AT - 1000,
  });
  const input = {
    question: "Wie viele Tage braucht der Umzug?",
    methodId: "schaetzen" as const,
    sight: "all" as const,
    notes: [reason("1", anna, "Letztes Mal 30 Tage"), reason("2", "b".repeat(32), "Server *alt*")],
    groups: [],
    viewer: anna,
    at: AT,
    language: "de" as const,
    results: [round1, round2],
  };

  it("both rounds' summaries with the unit and how the median moved, and the reasons without names", () => {
    const text = wallMarkdown(input);
    expect(text).toContain(
      [
        "## Schätzung, Runde 1",
        "",
        "_Verdeckt geschätzt, zugleich ausgezählt: 8 Schätzungen._",
        "",
        "- Median: 40 Tage",
        "- Mittlere Hälfte: 30 bis 50 Tage",
        "- Spanne: 25 bis 60 Tage",
        "",
        "## Schätzung, Runde 2",
        "",
        "_Verdeckt geschätzt, zugleich ausgezählt: 7 Schätzungen._",
        "",
        "- Median: 42,5 Tage",
        "- Mittlere Hälfte: 38 bis 46 Tage",
        "- Spanne: 30 bis 1.200 Tage",
        "- Gegenüber Runde 1: Median von 40 auf 42,5 Tage, mittlere Hälfte von 20 auf 8 Tage breit",
      ].join("\n"),
    );
    expect(text).toContain(["## Begründungen", "", "- Letztes Mal 30 Tage", "- Server \\*alt\\*"].join("\n"));
    expect(text).toContain("**Schätzen – Diskutieren – Schätzen:** Alle schätzen verdeckt");
    // no word of voting, no name
    expect(text).not.toContain("Wahl");
    expect(text).not.toContain(anna);
  });

  it("in English, and a round nobody estimated in", () => {
    const text = wallMarkdown({
      ...input,
      language: "en",
      results: [{ ...round1, unit: null, voters: 0, summary: null }, round2],
    });
    expect(text).toContain(["## Estimate, round 1", "", "_Nobody estimated._"].join("\n"));
    expect(text).toContain("- Range: 30 to 1,200 Tage");
    // no round before it with a summary: nothing to compare with
    expect(text).not.toContain("Since round");
    expect(text).toContain("## Reasons");
  });

  it("while the reasons are hidden, one's own alone; numbers as each language writes them", () => {
    const text = wallMarkdown({ ...input, sight: "hidden", results: [] });
    expect(text).toContain("- Letztes Mal 30 Tage");
    expect(text).not.toContain("Server");
    expect(estimateNumber(1234.567, "de")).toBe("1.234,57");
    expect(estimateNumber(1234.567, "en")).toBe("1,234.57");
    expect(estimateNumber(0.15, "de")).toBe("0,15");
  });
});
