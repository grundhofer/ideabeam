// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as z from "zod/mini";
import { hexIdSchema } from "../ids.js";
import type { RejectCode } from "../protocol.js";

// Hidden, simultaneous voting (PLAN-METHODEN.md 4, docs/architektur-methoden.md 3.1, stage M2). Every person votes in
// their own browser and sends with „Abgeben“; the wall stores one ballot a person and step, tells everybody else
// only how many have voted, and never a single ballot, not even to the moderation. When the moderation counts, the
// tally goes to everyone at once (the owner's decisions, PLAN-METHODEN.md 7). What may be chosen is frozen when the
// wall enters the step: the groups after „Bündeln“, else the notes.
//
// Five kinds, set by the method's step (`Step.vote`):
//  - `dots`: points with a budget a person, stacked on an option or spread; the default budget is a quarter of the
//    options, at least two (docs/methoden-katalog.md, method 2).
//  - `approval`: up to so many options, each chosen once.
//  - `rank`: the first so many options in order, counted by Borda: the first of k gets k points, the last 1.
//  - `score`: 1 to 5 for an option, once, or once per criterion; the result is the mean.
//  - `estimate` (stage M3): one number a person, with the step's unit and within its bounds; no options. The result
//    is the median with the quartiles, the lowest and the highest estimate and how many there were
//    (`aggregate`), never the mean alone and never a single estimate (docs/architektur-methoden.md 3.1).
//
// This file imports nothing from the protocol at run time (domain/method.ts imports it, and the protocol imports
// that): the schemas it needs stand here.

/** How many options a vote offers at most: the groups a wall can hold. */
export const MAX_OPTIONS = 80;
/** The lowest and the highest score. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;
/** How many criteria a score may have. */
export const MAX_CRITERIA = 5;
/** The largest budget a step may name. */
export const MAX_BUDGET = 100;

const budgetSchema = z.int().check(z.minimum(1), z.maximum(MAX_BUDGET));
/** The largest amount an estimate may name, either way: far past any effort, date or sum, and still exact in a
 *  double. */
export const ESTIMATE_LIMIT = 1e12;
/** How long the unit of an estimate may be: „Tage“, „Personentage“, „€“, „%“. */
export const UNIT_MAX = 20;
const estimateValueSchema = z.number().check(z.minimum(-ESTIMATE_LIMIT), z.maximum(ESTIMATE_LIMIT));
/** The unit of an estimate, as the moderation typed it on `/neu`: one line, no control characters. */
export const estimateUnitSchema = z
  .string()
  .check(z.minLength(1), z.maxLength(UNIT_MAX), z.regex(/^[^\p{Cc}\u2028\u2029]+$/u));
const criterionKeySchema = z.string().check(z.regex(/^[a-z][a-zA-Z0-9]{0,31}$/));

/** How a step's vote works, as the catalogue has it and a wall stores it with its agenda. null leaves a number to
 *  the default, worked out from the options when the step begins (`limitOf`). */
export const voteConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dots"), perPerson: z.nullable(budgetSchema), maxPerOption: z.nullable(budgetSchema) }),
  z.object({ kind: z.literal("approval"), max: z.nullable(budgetSchema) }),
  z.object({ kind: z.literal("rank"), top: z.nullable(budgetSchema) }),
  z.object({
    kind: z.literal("score"),
    /** The text keys of the criteria (`<methodId>.<criterion>`); none: one score for an option. */
    criteria: z.array(criterionKeySchema).check(z.maxLength(MAX_CRITERIA)),
  }),
  z.object({
    kind: z.literal("estimate"),
    /** What the number counts, or null: a bare number. The moderation names it on `/neu` (domain/agenda.ts). */
    unit: z.nullable(estimateUnitSchema),
    /** The lowest and the highest number taken, or null: no bound. */
    min: z.nullable(estimateValueSchema),
    max: z.nullable(estimateValueSchema),
  }),
]);
export type VoteConfig = z.infer<typeof voteConfigSchema>;
export type VoteKind = VoteConfig["kind"];

/** One thing to choose: a group, or a note in no group. Its words are read from the wall: a ballot names the id. */
export const voteOptionSchema = z.object({ id: hexIdSchema, kind: z.enum(["group", "note"]) });
export type VoteOption = z.infer<typeof voteOptionSchema>;

/** A vote of a step, as the wall's flow holds it from the moment the wall entered the step: what may be chosen,
 *  frozen then; how many options were left out past MAX_OPTIONS; the budget it was given (`limitOf`); and whether it
 *  is counted. Nothing of it is a ballot: every browser gets it. */
export const voteRoundSchema = z.object({
  step: z.int().check(z.minimum(0)),
  options: z.array(voteOptionSchema).check(z.maxLength(MAX_OPTIONS)),
  omitted: z.int().check(z.minimum(0)),
  limit: z.int().check(z.minimum(0)),
  counted: z.boolean(),
});
export type VoteRound = z.infer<typeof voteRoundSchema>;

const idsUnique = (ids: readonly string[]) => new Set(ids).size === ids.length;
const fewKeys = (record: Record<string, unknown>) => Object.keys(record).length <= MAX_OPTIONS;

/** A ballot as a browser sends it with „Abgeben“ and the wall stores it: absolute, every time the whole of it. */
export const ballotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dots"),
    /** Points by option; an option without points is left out. */
    points: z.record(hexIdSchema, budgetSchema).check(z.refine(fewKeys)),
  }),
  z.object({
    kind: z.literal("approval"),
    chosen: z.array(hexIdSchema).check(z.maxLength(MAX_OPTIONS), z.refine(idsUnique)),
  }),
  z.object({
    kind: z.literal("rank"),
    /** The options in order, the first first. */
    order: z.array(hexIdSchema).check(z.maxLength(MAX_OPTIONS), z.refine(idsUnique)),
  }),
  z.object({
    kind: z.literal("score"),
    /** By option: one score, or one for each criterion in their order. */
    scores: z
      .record(
        hexIdSchema,
        z
          .array(z.int().check(z.minimum(SCORE_MIN), z.maximum(SCORE_MAX)))
          .check(z.minLength(1), z.maxLength(MAX_CRITERIA)),
      )
      .check(z.refine(fewKeys)),
  }),
  z.object({
    kind: z.literal("estimate"),
    /** The person's number, in the step's unit. */
    value: estimateValueSchema,
  }),
]);
export type Ballot = z.infer<typeof ballotSchema>;

/** One line of a result: an option, its points, how many ballots gave it any, and its place. Places are shared on
 *  equal points (1, 1, 3). The words are the option's when it was counted, so a group renamed or deleted later does
 *  not change a result. For `score`, `points` is the mean (of the criteria's means) and `scores` the mean of each
 *  criterion; an option nobody scored has 0 and `by` 0. */
export const voteResultRowSchema = z.object({
  id: hexIdSchema,
  kind: z.enum(["group", "note"]),
  label: z.string().check(z.maxLength(300)),
  points: z.number(),
  by: z.int().check(z.minimum(0)),
  rank: z.int().check(z.minimum(1)),
  scores: z.optional(z.array(z.number())),
});
export type VoteResultRow = z.infer<typeof voteResultRowSchema>;

/** A counted vote over options: the kind and budget it was counted by, how many ballots there were, and every option
 *  in the order of its place. */
export const rankingResultSchema = z.object({
  step: z.int().check(z.minimum(0)),
  kind: z.enum(["dots", "approval", "rank", "score"]),
  limit: z.int().check(z.minimum(0)),
  voters: z.int().check(z.minimum(0)),
  rows: z.array(voteResultRowSchema).check(z.maxLength(MAX_OPTIONS)),
});
export type RankingResult = z.infer<typeof rankingResultSchema>;

/** What a counted estimate shows (`aggregate`): how many estimates, their median, the quartiles that bound the middle
 *  half, the lowest and the highest. Never the mean alone, never who estimated what. */
export const estimateSummarySchema = z.object({
  n: z.int().check(z.minimum(1)),
  median: z.number(),
  q1: z.number(),
  q3: z.number(),
  min: z.number(),
  max: z.number(),
});
export type EstimateSummary = z.infer<typeof estimateSummarySchema>;

/** A counted estimate: its unit, how many estimates there were, and their summary (null: nobody estimated). */
export const estimateResultSchema = z.object({
  step: z.int().check(z.minimum(0)),
  kind: z.literal("estimate"),
  unit: z.nullable(estimateUnitSchema),
  voters: z.int().check(z.minimum(0)),
  summary: z.nullable(estimateSummarySchema),
});
export type EstimateResult = z.infer<typeof estimateResultSchema>;

/** A counted vote: a ranking of options, or the summary of estimates. */
export const voteResultSchema = z.union([rankingResultSchema, estimateResultSchema]);
export type VoteResult = z.infer<typeof voteResultSchema>;

// ───────────────────────── the options ─────────────────────────

/** What `optionsFor` reads of a wall: its notes with the group each lies in, and its groups. */
export interface VoteContent {
  notes: ReadonlyArray<{ id: string; groupId: string | null; createdAt: number }>;
  groups: ReadonlyArray<{ id: string; ord: number }>;
}

/** What may be chosen in a vote that begins now: every group that holds a note, in the order of the list, and every
 *  note in no group, in the order they were made; on a wall without groups, its notes. At most MAX_OPTIONS of them,
 *  groups first; `omitted` says how many were left out. `shown` says whether everybody sees every note: a vote never
 *  offers what is hidden (checkAgenda refuses such a method; this holds it all the same). */
export function optionsFor(content: VoteContent, shown: boolean): { options: VoteOption[]; omitted: number } {
  if (!shown) return { options: [], omitted: 0 };
  const groups = [...content.groups].sort((a, b) => a.ord - b.ord || compare(a.id, b.id));
  const known = new Set(groups.map((group) => group.id));
  const notes = [...content.notes].sort((a, b) => a.createdAt - b.createdAt || compare(a.id, b.id));
  const filled = new Set(
    notes.flatMap((note) => (note.groupId !== null && known.has(note.groupId) ? [note.groupId] : [])),
  );
  const all: VoteOption[] = [
    ...groups.filter((group) => filled.has(group.id)).map((group): VoteOption => ({ id: group.id, kind: "group" })),
    ...notes
      .filter((note) => note.groupId === null || !known.has(note.groupId))
      .map((note): VoteOption => ({ id: note.id, kind: "note" })),
  ];
  return { options: all.slice(0, MAX_OPTIONS), omitted: Math.max(0, all.length - MAX_OPTIONS) };
}

/** The budget of a vote over `options` options: what the step names, else the default. Points: a quarter of the
 *  options, at least two (docs/methoden-katalog.md, method 2). Approval: the same, never more than the options.
 *  Rank: the first five, never more than the options. Score: every option. */
export function limitOf(config: VoteConfig, options: number): number {
  const quarter = Math.max(2, Math.ceil(options / 4));
  switch (config.kind) {
    case "dots":
      return config.perPerson ?? quarter;
    case "approval":
      return Math.min(options, config.max ?? quarter);
    case "rank":
      return Math.min(options, config.top ?? 5);
    case "score":
      return options;
    case "estimate":
      return 1;
  }
}

/** The vote of step `step` as it begins: its options frozen, its budget set, nothing counted. An estimate has no
 *  options: it asks for a number. */
export function openRound(step: number, config: VoteConfig, content: VoteContent, shown: boolean): VoteRound {
  const { options, omitted } = config.kind === "estimate" ? { options: [], omitted: 0 } : optionsFor(content, shown);
  return { step, options, omitted, limit: limitOf(config, options.length), counted: false };
}

/** The vote of a step, from a flow's rounds, or null: the wall has not entered it yet. */
export function roundOf(rounds: readonly VoteRound[] | undefined, step: number): VoteRound | null {
  return rounds?.find((round) => round.step === step) ?? null;
}

// ───────────────────────── a ballot ─────────────────────────

/** How many points, choices, places or scored options a ballot gives: what a budget bounds. */
export function ballotUse(ballot: Ballot): number {
  switch (ballot.kind) {
    case "dots":
      return Object.values(ballot.points).reduce((sum, points) => sum + points, 0);
    case "approval":
      return ballot.chosen.length;
    case "rank":
      return ballot.order.length;
    case "score":
      return Object.keys(ballot.scores).length;
    case "estimate":
      return 1;
  }
}

/** Whether a ballot fits the vote: the kind of the step, only its options, within its budget, and at least one mark
 *  (an empty ballot says nothing, and „abgegeben“ would be untrue of it). */
export function checkBallot(round: Pick<VoteRound, "options" | "limit">, config: VoteConfig, ballot: Ballot): boolean {
  if (ballot.kind !== config.kind) return false;
  if (ballot.kind === "estimate") return config.kind === "estimate" && withinBounds(config, ballot.value);
  const known = new Set(round.options.map((option) => option.id));
  const ids =
    ballot.kind === "dots"
      ? Object.keys(ballot.points)
      : ballot.kind === "approval"
        ? ballot.chosen
        : ballot.kind === "rank"
          ? ballot.order
          : Object.keys(ballot.scores);
  if (ids.length === 0 || ids.some((id) => !known.has(id))) return false;
  const use = ballotUse(ballot);
  switch (ballot.kind) {
    case "dots": {
      const cap = config.kind === "dots" ? (config.maxPerOption ?? round.limit) : round.limit;
      return use <= round.limit && Object.values(ballot.points).every((points) => points <= cap);
    }
    case "approval":
    case "rank":
      return use <= round.limit;
    case "score": {
      const width = config.kind === "score" ? Math.max(1, config.criteria.length) : 1;
      return Object.values(ballot.scores).every((scores) => scores.length === width);
    }
  }
}

/** A ballot in one spelling: the same ballot sent twice is the same text, so a second „Abgeben“ writes nothing.
 *  The order of a rank is its meaning; every other order is not. */
export function canonicalBallot(ballot: Ballot): Ballot {
  const sorted = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => compare(a, b)));
  switch (ballot.kind) {
    case "dots":
      return { kind: "dots", points: sorted(ballot.points) };
    case "approval":
      return { kind: "approval", chosen: [...ballot.chosen].sort(compare) };
    case "rank":
      return { kind: "rank", order: [...ballot.order] };
    case "score":
      return { kind: "score", scores: sorted(ballot.scores) };
    case "estimate":
      // -0 and 0 are one number, and one text
      return { kind: "estimate", value: ballot.value === 0 ? 0 : ballot.value };
  }
}

/** Whether two ballots say the same. */
export function sameBallot(a: Ballot | null, b: Ballot | null): boolean {
  if (a === null || b === null) return a === b;
  return JSON.stringify(canonicalBallot(a)) === JSON.stringify(canonicalBallot(b));
}

// ───────────────────────── counting ─────────────────────────

/** The vote kinds that rank options. */
export type RankingConfig = Exclude<VoteConfig, { kind: "estimate" }>;

/** The result of a vote from its ballots: a ranking of its options, or for an estimate its summary (`aggregate`).
 *  `label` gives an option's words as the wall holds them now. A ballot that does not fit the vote (it cannot be
 *  stored, `checkBallot`) counts for nothing. */
export function tally(
  round: VoteRound,
  config: RankingConfig,
  ballots: readonly Ballot[],
  label: (option: VoteOption) => string,
): RankingResult;
export function tally(
  round: VoteRound,
  config: VoteConfig,
  ballots: readonly Ballot[],
  label: (option: VoteOption) => string,
): VoteResult;
export function tally(
  round: VoteRound,
  config: VoteConfig,
  ballots: readonly Ballot[],
  label: (option: VoteOption) => string,
): VoteResult {
  const valid = ballots.filter((ballot) => checkBallot(round, config, ballot));
  if (config.kind === "estimate") {
    const values = valid.flatMap((ballot) => (ballot.kind === "estimate" ? [ballot.value] : []));
    return { step: round.step, kind: "estimate", unit: config.unit, voters: values.length, summary: aggregate(values) };
  }
  const points = new Map<string, number>();
  const by = new Map<string, number>();
  const sums = new Map<string, number[]>();
  const add = (id: string, amount: number) => {
    points.set(id, (points.get(id) ?? 0) + amount);
    by.set(id, (by.get(id) ?? 0) + 1);
  };
  for (const ballot of valid) {
    switch (ballot.kind) {
      case "dots":
        for (const [id, given] of Object.entries(ballot.points)) add(id, given);
        break;
      case "approval":
        for (const id of ballot.chosen) add(id, 1);
        break;
      case "rank":
        // Borda over the places the vote asks for: the first of k gets k points, the last 1
        ballot.order.forEach((id, place) => add(id, round.limit - place));
        break;
      case "score":
        for (const [id, scores] of Object.entries(ballot.scores)) {
          by.set(id, (by.get(id) ?? 0) + 1);
          const sum = sums.get(id) ?? scores.map(() => 0);
          sums.set(
            id,
            sum.map((value, at) => value + (scores[at] ?? 0)),
          );
        }
        break;
    }
  }
  const rows = round.options.map((option, order) => {
    const count = by.get(option.id) ?? 0;
    if (config.kind !== "score") {
      return { option, order, row: { points: points.get(option.id) ?? 0, by: count } };
    }
    const means = (sums.get(option.id) ?? []).map((sum) => round2(sum / Math.max(1, count)));
    const mean = means.length === 0 ? 0 : round2(means.reduce((a, b) => a + b, 0) / means.length);
    return { option, order, row: { points: mean, by: count, scores: means } };
  });
  rows.sort((a, b) => b.row.points - a.row.points || a.order - b.order);
  let place = 0;
  return {
    step: round.step,
    kind: config.kind,
    limit: round.limit,
    voters: valid.length,
    rows: rows.map(({ option, row }, at) => {
      if (at === 0 || (rows[at - 1]?.row.points ?? 0) !== row.points) place = at + 1;
      return {
        id: option.id,
        kind: option.kind,
        label: label(option).slice(0, 300),
        points: row.points,
        by: row.by,
        rank: place,
        ...("scores" in row ? { scores: row.scores } : {}),
      };
    }),
  };
}

/** Whether an estimate lies within the step's bounds. */
function withinBounds(config: Extract<VoteConfig, { kind: "estimate" }>, value: number): boolean {
  return (config.min === null || value >= config.min) && (config.max === null || value <= config.max);
}

/** The summary of estimates (docs/architektur-methoden.md 3.1): how many, the median, the first and the third
 *  quartile, the lowest and the highest; null for none. The quartiles are interpolated between the two estimates
 *  they fall between, as spreadsheets do (QUARTILE.INC, R's type 7): the median of 10, 20, 30, 40 is 25, its middle
 *  half 17.5 to 32.5. One estimate is all of them at once. Rounded to six places, so that no binary rest
 *  (0.30000000000000004) reaches a sentence. */
export function aggregate(numbers: readonly number[]): EstimateSummary | null {
  const sorted = numbers.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return null;
  const at = (p: number) => {
    const h = (n - 1) * p;
    const low = Math.floor(h);
    const lower = sorted[low] ?? 0;
    const upper = sorted[Math.min(n - 1, low + 1)] ?? lower;
    return round6(lower + (h - low) * (upper - lower));
  };
  return {
    n,
    median: at(0.5),
    q1: at(0.25),
    q3: at(0.75),
    min: round6(sorted[0] ?? 0),
    max: round6(sorted[n - 1] ?? 0),
  };
}

function round6(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

// ───────────────────────── the rules of the commands ─────────────────────────

/** What a step of a wall's agenda says about voting: its index, and its vote config if it has one. */
interface VoteStepView {
  vote?: VoteConfig | undefined;
}

export type BallotDecision =
  | { kind: "refused"; code: RejectCode }
  /** The same ballot is stored already: sent a second time. Nothing is written. */
  | { kind: "unchanged" }
  | { kind: "changed"; ballot: Ballot };

/** What the wall makes of `ballot.cast` (docs/architektur-methoden.md 3.1). Only in the step the wall is in (made for
 *  a step it has left: `STALE`), only in a step that votes and only before it is counted (`PHASE`), only a ballot
 *  that fits (`INVALID`). The same ballot again changes nothing. `stored`: this person's ballot of the step. */
export function decideBallot(
  flow: { step: number; votes?: readonly VoteRound[] | undefined },
  steps: readonly VoteStepView[],
  command: { step: number; ballot: Ballot },
  stored: Ballot | null,
): BallotDecision {
  if (command.step !== flow.step) return { kind: "refused", code: "STALE" };
  const config = steps[flow.step]?.vote;
  const round = roundOf(flow.votes, flow.step);
  if (config === undefined || round === null || round.counted) return { kind: "refused", code: "PHASE" };
  if (!checkBallot(round, config, command.ballot)) return { kind: "refused", code: "INVALID" };
  const ballot = canonicalBallot(command.ballot);
  return sameBallot(ballot, stored) ? { kind: "unchanged" } : { kind: "changed", ballot };
}

export type CountDecision =
  | { kind: "refused"; code: RejectCode }
  /** Counted already: the command sent a second time. */
  | { kind: "unchanged" }
  | { kind: "changed"; round: VoteRound; config: VoteConfig };

/** What the wall makes of the moderation's `admin.step.count`: the moderation's alone, in the step the wall is in
 *  (`STALE` for one it has left), in a step that votes (`PHASE`). Counted once; a counted vote is never opened again
 *  (docs/architektur-methoden.md 4). */
export function decideCount(
  flow: { step: number; votes?: readonly VoteRound[] | undefined },
  steps: readonly VoteStepView[],
  command: { step: number },
  by: { role: "admin" | "member" },
): CountDecision {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (command.step !== flow.step) return { kind: "refused", code: "STALE" };
  const config = steps[flow.step]?.vote;
  const round = roundOf(flow.votes, flow.step);
  if (config === undefined || round === null) return { kind: "refused", code: "PHASE" };
  if (round.counted) return { kind: "unchanged" };
  return { kind: "changed", round, config };
}

/** The rounds of a flow with one of them counted. */
export function countedRounds(rounds: readonly VoteRound[] | undefined, step: number): VoteRound[] {
  return (rounds ?? []).map((round) => (round.step === step ? { ...round, counted: true } : round));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
