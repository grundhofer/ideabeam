// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as z from "zod/mini";
import { CATALOGUE, DEFAULT_METHOD } from "../methods/catalogue.js";
import {
  MAX_STEPS,
  methodIdSchema,
  stepSchema,
  type MethodId,
  type NoteKind,
  type Step,
  type StepVisibility,
} from "./method.js";
import { estimateUnitSchema } from "./vote.js";

// A wall's agenda (docs/architektur-methoden.md 1): the methods it runs, one after the other, flattened into the
// steps it walks through. A wall stores its agenda resolved, at its creation, as one row (`meta 'agenda'`): a copy
// of the steps, not a reference to the catalogue, so a deploy that changes a method does not shift the steps of a
// wall that runs. The words stay keys (methods/texts.ts).
//
// Stage M1: one method a wall (PLAN-METHODEN.md 7, question 7); the request already had the shape of the agenda of
// several methods. Stage M7 runs several, one after the other on the same wall (up to MAX_AGENDA_ITEMS), each with an
// optional prompt of its own (the wall's question where it has none); the moderation may change the items the wall
// has not reached (`decideAgendaSet`), never a step it has reached.

/** How many methods an agenda may name (stage M7). */
export const MAX_AGENDA_ITEMS = 8;
/** The longest prompt of an agenda item: as long as a wall's question. */
export const PROMPT_MAX = 140;

/** The prompt of an agenda item: what its method asks, where it is not the wall's question (stage M7). */
export const promptSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(PROMPT_MAX));

/** One method of what `POST /api/walls` may ask for (and `admin.agenda.set`, stage M7). `unit`: what the estimates
 *  of a method that estimates count („Tage“, „€“), as the moderation typed it on `/neu` (stage M3); it goes into the
 *  vote of every step of the method that estimates, and means nothing to a method without one. `language` (stage
 *  M6): the language of the moderation's browser, for the titles of the fields a method begins with (`Method.fields`,
 *  „Annahmen prüfen“). Left out: German. `prompt` (stage M7): what this method asks; left out, the wall's question. */
export const agendaItemRequestSchema = z.strictObject({
  methodId: methodIdSchema,
  unit: z.optional(estimateUnitSchema),
  language: z.optional(z.enum(["de", "en"])),
  prompt: z.optional(promptSchema),
});
export type AgendaItemRequest = z.infer<typeof agendaItemRequestSchema>;

/** What `POST /api/walls` may ask for: the methods, in order. */
export const agendaRequestSchema = z.strictObject({
  items: z.array(agendaItemRequestSchema).check(z.minLength(1), z.maxLength(MAX_AGENDA_ITEMS)),
});
export type AgendaRequest = z.infer<typeof agendaRequestSchema>;

/** A step as a wall stores it: the catalogue's step, and the agenda item it belongs to. */
export const resolvedStepSchema = z.extend(stepSchema, { item: z.int().check(z.minimum(0)) });
export type ResolvedStep = z.infer<typeof resolvedStepSchema>;

/** An item of a wall's agenda as it stores it: which method, in which version; its prompt, where it has one (stage
 *  M7); and, for a method that begins with fixed fields, the language of their titles, so that the fields of an item
 *  after the first can be made when the wall reaches it (stage M7). */
export const resolvedItemSchema = z.object({
  methodId: methodIdSchema,
  version: z.int(),
  prompt: z.optional(promptSchema),
  language: z.optional(z.enum(["de", "en"])),
});
export type ResolvedItem = z.infer<typeof resolvedItemSchema>;

/** A wall's agenda as it stores it and sends it in every `sync`: which methods, in which version, and their steps. */
export const resolvedAgendaSchema = z.object({
  items: z.array(resolvedItemSchema).check(z.minLength(1), z.maxLength(MAX_AGENDA_ITEMS)),
  steps: z.array(resolvedStepSchema).check(z.minLength(1), z.maxLength(MAX_STEPS)),
});
export type ResolvedAgenda = z.infer<typeof resolvedAgendaSchema>;

/** The items a request asks for, resolved against the catalogue, numbered from `first` on: every method's steps, in
 *  order, each with the item it belongs to. */
function resolveItems(
  items: readonly AgendaItemRequest[],
  first: number,
): { items: ResolvedItem[]; steps: ResolvedStep[] } {
  return {
    items: items.map(({ methodId, prompt, language }) => ({
      methodId,
      version: CATALOGUE[methodId].version,
      ...(prompt === undefined ? {} : { prompt }),
      ...(language !== undefined && CATALOGUE[methodId].fields !== undefined ? { language } : {}),
    })),
    steps: items.flatMap(({ methodId, unit }, at) =>
      CATALOGUE[methodId].steps.map((step): ResolvedStep => ({
        ...step,
        ...(step.vote?.kind === "estimate" && unit !== undefined ? { vote: { ...step.vote, unit } } : {}),
        item: first + at,
      })),
    ),
  };
}

/** The agenda a request asks for, resolved against the catalogue: every method's steps, in order, each with the
 *  item it belongs to. */
export function resolveAgenda(request: AgendaRequest): ResolvedAgenda {
  return resolveItems(request.items, 0);
}

/** The agenda of one method. */
export function agendaOf(methodId: MethodId): ResolvedAgenda {
  return resolveAgenda({ items: [{ methodId }] });
}

/** The agenda of a new wall: the one the request names, else what `hidden` stood for before there were methods:
 *  hidden writing is „Still sammeln“, a wall that shows every note at once is „Freie Wand“. */
export function agendaFor(request: { hidden: boolean; agenda?: AgendaRequest }): ResolvedAgenda {
  if (request.agenda !== undefined) return resolveAgenda(request.agenda);
  return agendaOf(request.hidden ? DEFAULT_METHOD : "free");
}

// ───────────────────────── items (stage M7) ─────────────────────────

/** The steps of agenda item `item`: from its first step to the one after its last (`end`, exclusive). Both -1 where
 *  the agenda has no such item. */
export function itemSpan(agenda: Pick<ResolvedAgenda, "steps">, item: number): { from: number; end: number } {
  const from = agenda.steps.findIndex((step) => step.item === item);
  if (from < 0) return { from: -1, end: -1 };
  let end = from;
  while (end < agenda.steps.length && agenda.steps[end]?.item === item) end += 1;
  return { from, end };
}

/** The agenda item a step belongs to. */
export function itemOfStep(agenda: Pick<ResolvedAgenda, "steps">, step: number): number {
  return agenda.steps[step]?.item ?? 0;
}

/** What the method of step `step` asks: its item's prompt, else the wall's question. */
export function promptOf(agenda: ResolvedAgenda, step: number, question: string): string {
  return agenda.items[itemOfStep(agenda, step)]?.prompt ?? question;
}

/** How many items a wall that has reached step `reach` has begun: every item whose first step is reached. They never
 *  change again (`decideAgendaSet`). */
export function reachedItems(agenda: ResolvedAgenda, reach: number): number {
  return agenda.items.filter((_, item) => {
    const { from } = itemSpan(agenda, item);
    return from >= 0 && from <= reach;
  }).length;
}

/** The items of an agenda as a request would name them (stage M7): what the moderation edits, and what a request is
 *  compared with. The unit is the one the method's estimates carry. */
export function requestOf(agenda: ResolvedAgenda): AgendaItemRequest[] {
  return agenda.items.map((item, at) => {
    const unit = agenda.steps.find((step) => step.item === at && step.vote?.kind === "estimate")?.vote;
    return {
      methodId: item.methodId,
      ...(unit?.kind === "estimate" && unit.unit !== null && unit.unit !== undefined ? { unit: unit.unit } : {}),
      ...(item.language === undefined ? {} : { language: item.language }),
      ...(item.prompt === undefined ? {} : { prompt: item.prompt }),
    };
  });
}

/** Whether two items name the same method with the same prompt and unit (the language of a field's title is the
 *  browser's, and changes nothing once the fields are made). */
function sameItem(a: AgendaItemRequest, b: AgendaItemRequest): boolean {
  return (
    a.methodId === b.methodId && (a.prompt ?? null) === (b.prompt ?? null) && (a.unit ?? null) === (b.unit ?? null)
  );
}

export type AgendaDecision =
  | { kind: "refused"; code: "NOT_ADMIN" | "INVALID" | "STALE" }
  /** The agenda says so already: the command sent a second time. */
  | { kind: "unchanged" }
  /** The agenda after the change, and the steps whose moving on by itself the moderation switched off that still
   *  stand (`Flow.manual`): those of the items that were replaced fall away. */
  | { kind: "changed"; agenda: ResolvedAgenda; manual: number[] };

/** What the moderation's `admin.agenda.set` (stage M7) makes of a wall's agenda: `items` is the whole agenda as the
 *  moderation wants it. The items the wall has begun (`reachedItems`) must stand in it first, as they are: a step
 *  that was reached never changes. A command that names them otherwise was made for an agenda the wall has left
 *  (`STALE`): the wall reached an item meanwhile, or somebody else changed it. The items after them are the
 *  moderation's to add, remove and reorder; they are resolved against the catalogue anew, and the agenda must run
 *  (`checkAgenda`) and fit (MAX_AGENDA_ITEMS, MAX_STEPS), else `INVALID`. */
export function decideAgendaSet(
  agenda: ResolvedAgenda,
  flow: { reach: number; manual?: readonly number[] },
  items: readonly AgendaItemRequest[],
  by: { role: string },
): AgendaDecision {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (items.length === 0 || items.length > MAX_AGENDA_ITEMS) return { kind: "refused", code: "INVALID" };
  const fixed = reachedItems(agenda, flow.reach);
  const stored = requestOf(agenda);
  if (
    items.length < fixed ||
    stored.slice(0, fixed).some((item, at) => !sameItem(item, items[at] as AgendaItemRequest))
  ) {
    return { kind: "refused", code: "STALE" };
  }
  const wanted = items.slice(fixed);
  const kept = stored.slice(fixed);
  if (wanted.length === kept.length && wanted.every((item, at) => sameItem(item, kept[at] as AgendaItemRequest))) {
    return { kind: "unchanged" };
  }
  const tail = resolveItems(wanted, fixed);
  const next: ResolvedAgenda = {
    items: [...agenda.items.slice(0, fixed), ...tail.items],
    steps: [...agenda.steps.filter((step) => step.item < fixed), ...tail.steps],
  };
  if (next.steps.length > MAX_STEPS || checkAgenda(next).length > 0) return { kind: "refused", code: "INVALID" };
  const end = itemSpan(agenda, fixed - 1).end;
  return { kind: "changed", agenda: next, manual: (flow.manual ?? []).filter((step) => step < end) };
}

/** The method a step belongs to. */
export function methodOfStep(agenda: ResolvedAgenda, step: number): MethodId {
  const item = agenda.steps[step]?.item ?? 0;
  return agenda.items[item]?.methodId ?? agenda.items[0]?.methodId ?? DEFAULT_METHOD;
}

// ───────────────────────── capabilities ─────────────────────────

/** What may be done in a step: the refusals of the old phases (`PHASE`), per step.
 *  - `write`: write notes, change and delete one's own.
 *  - `move`: move notes (while they are hidden, one's own only: domain/rules.ts).
 *  - `group`: make, rename, move and delete groups.
 *  - `arrange`: „Ordnen“: ask for a proposal, apply it, take it back.
 *  - `clock`: the moderation's clock. In M1 the clock of the writing, as before: in a hidden writing step; since M4
 *    also in every step that moves on by itself when its time is up (`advance: "auto"`), whose time it is.
 *  - `ballot`: vote (`ballot.cast`), and the moderation counts (`admin.step.count`): a step with a vote
 *    (domain/vote.ts). Nothing is written, moved or grouped in it: the options are frozen. A step that names a
 *    `noteKind` takes notes beside its vote all the same (the reasons beside the first estimate, stage M3): they
 *    are written, changed and deleted, at the step's visibility.
 *  - `turn` (stage M5): the step shows the hidden notes one at a time, and the moderation shows the next one
 *    (`admin.turn.next`, domain/turns.ts). Nothing is written, deleted or grouped in it: the order is frozen, and a
 *    note written or deleted meanwhile would shift it. Notes are moved, the shown ones by everybody.
 *  - `decide` (stage M5): the moderation gives an action its „Wer“ and „Bis wann“ (`note.action`, domain/rules.ts):
 *    a step of type `decide`. */
export interface Capabilities {
  write: boolean;
  move: boolean;
  group: boolean;
  arrange: boolean;
  clock: boolean;
  ballot: boolean;
  turn: boolean;
  decide: boolean;
}

const NOTE_STEPS = new Set<Step["type"]>(["impulse", "write", "reveal", "cluster", "discuss"]);
const SORT_STEPS = new Set<Step["type"]>(["reveal", "cluster", "discuss"]);

export function capabilities(
  step: Pick<Step, "type" | "visibility" | "vote" | "noteKind"> & Partial<Pick<Step, "advance" | "turns">>,
): Capabilities {
  const turn = step.turns === true;
  const notes = NOTE_STEPS.has(step.type) || step.noteKind !== undefined;
  // groups need the notes to be seen: while they are hidden, nobody sorts what nobody can read
  const sorts = SORT_STEPS.has(step.type) && levelOf(step.visibility) === "all" && !turn;
  return {
    write: notes && !turn,
    move: notes,
    group: sorts,
    arrange: sorts,
    clock: step.type === "write" || step.advance === "auto",
    ballot: step.vote !== undefined,
    turn,
    decide: step.type === "decide",
  };
}

const VOTE_STEPS = new Set<Step["type"]>(["vote", "rank", "score", "estimate", "consent"]);
/** Which vote kinds a step type takes. */
const VOTE_KINDS: Partial<Record<Step["type"], readonly string[]>> = {
  vote: ["dots", "approval"],
  rank: ["rank"],
  score: ["score"],
  estimate: ["estimate"],
  consent: ["consent"],
};

// ───────────────────────── visibility ─────────────────────────

/** Who sees a note: its writer alone, the writer's pair or group, everyone. Who wrote it is never shown. */
export type NoteLevel = "hidden" | "team" | "all";

const RANK: Record<NoteLevel, number> = { hidden: 0, team: 1, all: 2 };

/** What a step's visibility means for the notes in it. `anonymous` is `all` (authors are hidden everywhere);
 *  `aggregate` is about ballots, and shows no note. */
export function levelOf(visibility: StepVisibility): NoteLevel {
  if (visibility === "all" || visibility === "anonymous") return "all";
  return visibility === "team" ? "team" : "hidden";
}

/** Who sees a note that was written in step `from`, once the wall has reached step `reach`: the widest visibility of
 *  the steps from the one it was written in up to the furthest one reached (docs/architektur-methoden.md 2). It
 *  depends on `reach`, never on the step the wall is in now: so going back never hides what was shown.
 *
 *  A step that reveals by turn (`turns`, stage M5) counts for nothing here: reaching it shows no note, each one is
 *  shown when its turn comes (domain/turns.ts), and the rest by the next step that shows everything.
 *
 *  `from`: the step a note counts from (`writingFrom`). Until stage M5 every method began with its one round of
 *  writing, so every note counted from step 0, which is what `from` left out says, and what a wall of an older build,
 *  which stores no step with a note, still says of every note. */
export function noteLevel(
  steps: readonly (Pick<Step, "visibility"> & Partial<Pick<Step, "turns">>)[],
  reach: number,
  from = 0,
): NoteLevel {
  let level: NoteLevel = "hidden";
  for (let at = Math.max(0, from); at <= reach && at < steps.length; at += 1) {
    const step = steps[at];
    if (step === undefined || step.turns === true) continue;
    const here = levelOf(step.visibility);
    if (RANK[here] > RANK[level]) level = here;
  }
  return level;
}

/** Whether a step begins a round of writing (stage M5): its notes start hidden, or seen by the team alone, and it
 *  takes notes. A step that shows only what is counted (`aggregate`) begins none: a note written there, beside a
 *  vote, belongs to the round it stands in. */
export function startsWriting(
  step: Pick<Step, "type" | "visibility" | "vote" | "noteKind"> & Partial<Pick<Step, "advance" | "turns">>,
): boolean {
  return (step.visibility === "hidden" || step.visibility === "team") && capabilities(step).write;
}

/** Whether the notes of an agenda keep the step they were written in (stage M5): where a round of writing begins
 *  after notes were shown to everybody (the next round of „Was? Na und? Was nun?“, the actions of „Rückblick nach
 *  Ziel und Daten“, the reasons of „Scheitern vorwegdenken“ after the plan was presented), or where notes are
 *  actions. Stage M6: also where notes are of another kind than ideas and the reasons beside an estimate (criteria,
 *  decisions, goals, results), and where a step takes its options or criteria from the notes of certain steps. Every
 *  method before stage M5 keeps none: every note of it counts from step 0, as it always did. Stage M7: an agenda of
 *  more than one method keeps them always, so that each note belongs to the method it was written in (the export
 *  lists it there) and the next method's writing begins a round of its own. */
export function keepsSteps(steps: readonly (Step & { item?: number })[]): boolean {
  return steps.some(
    (step, at) =>
      (step.item ?? 0) > 0 ||
      (step.noteKind !== undefined && step.noteKind !== "reason" && step.noteKind !== "idea") ||
      step.optionsFrom !== undefined ||
      step.criteriaFrom !== undefined ||
      (at > 0 && startsWriting(step) && noteLevel(steps, at) === "all"),
  );
}

/** The step a note written in step `at` counts from: the last step at or before it that begins a round of writing
 *  (`startsWriting`), or 0. So a method that shows its notes and then asks for new ones in private (the next round
 *  of „Was? Na und? Was nun?“, the actions of „Rückblick nach Ziel und Daten“) hides the new ones, and what was shown
 *  stays shown. 0 for every note of a method that keeps no steps (`keepsSteps`): it hides nothing again. */
export function writingFrom(steps: readonly Step[], at: number): number {
  if (!keepsSteps(steps)) return 0;
  for (let from = Math.min(at, steps.length - 1); from > 0; from -= 1) {
    const step = steps[from];
    if (step !== undefined && startsWriting(step)) return from;
  }
  return 0;
}

/** The earlier steps of the same agenda item that `keys` name, or null where one of them names none. */
function stepsNamed(steps: readonly ResolvedStep[], at: number, keys: readonly string[]): number[] | null {
  const step = steps[at];
  if (step === undefined) return null;
  const found = keys.map((key) =>
    steps.findIndex((other, index) => index < at && other.item === step.item && other.key === key),
  );
  return found.some((index) => index < 0) ? null : found;
}

/** The steps of the same agenda item whose notes a step's `optionsFrom` names, or null: it names none, or a key that
 *  is no earlier step of its method. */
export function optionsSteps(steps: readonly ResolvedStep[], at: number): number[] | null {
  const from = steps[at]?.optionsFrom;
  if (from === undefined) return null;
  return stepsNamed(steps, at, typeof from === "string" ? [from] : from);
}

/** The steps of the same agenda item whose notes are the criteria of a score (`criteriaFrom`, stage M6), or null. */
export function criteriaSteps(steps: readonly ResolvedStep[], at: number): number[] | null {
  const from = steps[at]?.criteriaFrom;
  return from === undefined ? null : stepsNamed(steps, at, from);
}

/** The steps whose notes a step of type `decide` records, by the kind of record (stage M5: actions; stage M6:
 *  decisions and measurable results). */
export const RECORD_KINDS = ["action", "decision", "result"] as const satisfies readonly NoteKind[];
export type RecordKind = (typeof RECORD_KINDS)[number];

/** The steps whose notes are of kind `kind`. */
export function stepsOfKind(steps: readonly Pick<Step, "noteKind">[], kind: NoteKind): number[] {
  return steps.flatMap((step, at) => (step.noteKind === kind ? [at] : []));
}

// ───────────────────────── fixed fields ─────────────────────────

/** The width and the height of a fixed field (`Method.fields`, stage M6), in world units (1/16 rem): room for about
 *  three notes side by side and four rows, so a field rarely grows. */
export const FIELD_WIDTH = 832;
export const FIELD_HEIGHT = 720;
const FIELD_GAP = 64;
/** How many fields stand in the first row: three, the rest below. Our own layout (three over two, read row by row),
 *  no canvas of anybody else's. */
const FIELDS_PER_ROW = 3;

/** The frames of a method's fixed fields, in their order: three in a row, the rest centred in a row below. `top`:
 *  where the first row begins; below what the wall holds already, for a method that is not the agenda's first (stage
 *  M7, `fieldsTop`). */
export function fieldBoxes(count: number, top = 0): Array<{ x: number; y: number; w: number; h: number }> {
  const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let at = 0; at < count; at += 1) {
    const row = Math.floor(at / FIELDS_PER_ROW);
    const inRow = Math.min(FIELDS_PER_ROW, count - row * FIELDS_PER_ROW);
    const offset = ((FIELDS_PER_ROW - inRow) * (FIELD_WIDTH + FIELD_GAP)) / 2;
    const col = at % FIELDS_PER_ROW;
    boxes.push({
      x: Math.round(offset + col * (FIELD_WIDTH + FIELD_GAP)),
      y: top + row * (FIELD_HEIGHT + FIELD_GAP),
      w: FIELD_WIDTH,
      h: FIELD_HEIGHT,
    });
  }
  return boxes;
}

/** Where the fields of a method after the agenda's first begin (stage M7): a gap below the lowest of what the wall
 *  holds, its groups and its notes (`noteHeight`, the height of a note as drawn), so they cover nothing. */
export function fieldsTop(
  groups: ReadonlyArray<{ y: number; h: number }>,
  notes: ReadonlyArray<{ y: number }>,
  noteHeight: number,
): number {
  const bottoms = [...groups.map((group) => group.y + group.h), ...notes.map((note) => note.y + noteHeight)];
  return bottoms.length === 0 ? 0 : Math.max(...bottoms) + 2 * FIELD_GAP;
}

// ───────────────────────── checks ─────────────────────────

/** Why an agenda cannot run. Every method of the catalogue passes (test/agenda.test.ts). */
export type AgendaProblem =
  /** a step key twice within one method: its words could not be told apart */
  | { kind: "duplicateKey"; step: number }
  /** the notes of a hidden step are never shown: no later step widens what is seen */
  | { kind: "neverShown"; step: number }
  /** a step of type vote, rank or score without its vote, one of another type with a vote, or a vote of a kind its
   *  type does not take; or a vote that is not hidden until counted (`aggregate`, PLAN-METHODEN.md 1) */
  | { kind: "voteShape"; step: number }
  /** a vote would offer notes nobody but their writers has seen: no step up to it shows them. An estimate offers
   *  nothing and may stand before any note is shown */
  | { kind: "voteUnseen"; step: number }
  /** a step in teams that is not seen by its team, or works alone or with everybody; or one seen by its team that
   *  forms no teams (stage M4) */
  | { kind: "teamShape"; step: number }
  /** a step that moves on by itself without a time to run out, or as the last step, after which there is nowhere to
   *  move */
  | { kind: "autoShape"; step: number }
  /** a step that reveals by turn that is no step of type `reveal` shown to everybody, or that comes before any
   *  hidden writing (stage M5) */
  | { kind: "turnShape"; step: number }
  /** a vote's `optionsFrom` names no earlier step of its method, or a vote over options names it while it is no vote
   *  over options (stage M5) */
  | { kind: "optionsShape"; step: number }
  /** a step of type `decide` that takes no actions, or an action step outside a method with a step of type `decide`
   *  (stage M5): nobody could agree on them. Since stage M6 decisions and measurable results alike */
  | { kind: "actionShape"; step: number }
  /** a score's `criteriaFrom` names no earlier step of its method, the step is no score, its vote names criteria of
   *  its own, or the criteria notes are not seen by everybody when it begins (stage M6) */
  | { kind: "criteriaShape"; step: number };

export function checkAgenda(agenda: Pick<ResolvedAgenda, "steps">): AgendaProblem[] {
  const problems: AgendaProblem[] = [];
  const seen = new Set<string>();
  agenda.steps.forEach((step, at) => {
    const key = `${step.item}.${step.key}`;
    if (seen.has(key)) problems.push({ kind: "duplicateKey", step: at });
    seen.add(key);
    const writes = step.output === "notes" || step.noteKind !== undefined;
    if (writes && noteLevel(agenda.steps, agenda.steps.length - 1, at) !== "all") {
      problems.push({ kind: "neverShown", step: at });
    }
    const votes = VOTE_STEPS.has(step.type);
    if (
      votes !== (step.vote !== undefined) ||
      (step.vote !== undefined && !(VOTE_KINDS[step.type] ?? []).includes(step.vote.kind)) ||
      (votes && step.visibility !== "aggregate")
    ) {
      problems.push({ kind: "voteShape", step: at });
    }
    if (votes && step.vote?.kind !== "estimate" && noteLevel(agenda.steps, at) !== "all") {
      problems.push({ kind: "voteUnseen", step: at });
    }
    if (step.optionsFrom !== undefined) {
      const froms = optionsSteps(agenda.steps, at);
      if (froms === null || !votes || step.vote?.kind === "estimate") {
        problems.push({ kind: "optionsShape", step: at });
      } else if (froms.some((from) => noteLevel(agenda.steps, at, writingFrom(agenda.steps, from)) !== "all")) {
        problems.push({ kind: "voteUnseen", step: at });
      }
    }
    if (step.criteriaFrom !== undefined) {
      const froms = criteriaSteps(agenda.steps, at);
      if (
        froms === null ||
        step.vote?.kind !== "score" ||
        step.vote.criteria.length > 0 ||
        froms.some((from) => noteLevel(agenda.steps, at, writingFrom(agenda.steps, from)) !== "all")
      ) {
        problems.push({ kind: "criteriaShape", step: at });
      }
    }
    if (
      step.turns === true &&
      (step.type !== "reveal" ||
        levelOf(step.visibility) !== "all" ||
        !agenda.steps.slice(0, at).some((before) => before.visibility === "hidden" && startsWriting(before)))
    ) {
      problems.push({ kind: "turnShape", step: at });
    }
    const recorded = (kind: NoteKind | undefined) => kind === "action" || kind === "decision" || kind === "result";
    if (
      (step.type === "decide" && !recorded(step.noteKind)) ||
      (recorded(step.noteKind) &&
        !agenda.steps.some(
          (other) => other.item === step.item && other.type === "decide" && other.noteKind === step.noteKind,
        ))
    ) {
      problems.push({ kind: "actionShape", step: at });
    }
    const teamed = step.team !== undefined;
    if (
      teamed !== (step.visibility === "team") ||
      (teamed && step.mode !== "pair" && step.mode !== "group") ||
      (teamed &&
        step.team?.form === "merge" &&
        !agenda.steps.slice(0, at).some((before) => before.team !== undefined)) ||
      (step.team?.roles !== undefined && step.team.form !== "random")
    ) {
      problems.push({ kind: "teamShape", step: at });
    }
    if (step.advance === "auto" && (step.durationSec === null || at === agenda.steps.length - 1)) {
      problems.push({ kind: "autoShape", step: at });
    }
  });
  return problems;
}
