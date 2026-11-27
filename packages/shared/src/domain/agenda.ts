// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as z from "zod/mini";
import { CATALOGUE, DEFAULT_METHOD } from "../methods/catalogue.js";
import { MAX_STEPS, methodIdSchema, stepSchema, type MethodId, type Step, type StepVisibility } from "./method.js";
import { estimateUnitSchema } from "./vote.js";

// A wall's agenda (docs/architektur-methoden.md 1): the methods it runs, one after the other, flattened into the
// steps it walks through. A wall stores its agenda resolved, at its creation, as one row (`meta 'agenda'`): a copy
// of the steps, not a reference to the catalogue, so a deploy that changes a method does not shift the steps of a
// wall that runs. The words stay keys (methods/texts.ts).
//
// Stage M1: one method a wall (PLAN-METHODEN.md 7, question 7); the request already has the shape of the agenda of
// several methods that M7 brings.

/** How many methods an agenda may name. One in M1; M7 raises it. */
export const MAX_AGENDA_ITEMS = 1;

/** What `POST /api/walls` may ask for: the methods, in order. `unit`: what the estimates of a method that estimates
 *  count („Tage“, „€“), as the moderation typed it on `/neu` (stage M3); it goes into the vote of every step of the
 *  method that estimates, and means nothing to a method without one. */
export const agendaRequestSchema = z.strictObject({
  items: z
    .array(z.strictObject({ methodId: methodIdSchema, unit: z.optional(estimateUnitSchema) }))
    .check(z.minLength(1), z.maxLength(MAX_AGENDA_ITEMS)),
});
export type AgendaRequest = z.infer<typeof agendaRequestSchema>;

/** A step as a wall stores it: the catalogue's step, and the agenda item it belongs to. */
export const resolvedStepSchema = z.extend(stepSchema, { item: z.int().check(z.minimum(0)) });
export type ResolvedStep = z.infer<typeof resolvedStepSchema>;

/** A wall's agenda as it stores it and sends it in every `sync`: which methods, in which version, and their steps. */
export const resolvedAgendaSchema = z.object({
  items: z.array(z.object({ methodId: methodIdSchema, version: z.int() })).check(z.minLength(1), z.maxLength(8)),
  steps: z.array(resolvedStepSchema).check(z.minLength(1), z.maxLength(MAX_STEPS)),
});
export type ResolvedAgenda = z.infer<typeof resolvedAgendaSchema>;

/** The agenda a request asks for, resolved against the catalogue: every method's steps, in order, each with the
 *  item it belongs to. */
export function resolveAgenda(request: AgendaRequest): ResolvedAgenda {
  const items = request.items.map(({ methodId }) => ({ methodId, version: CATALOGUE[methodId].version }));
  const steps = request.items.flatMap(({ methodId, unit }, item) =>
    CATALOGUE[methodId].steps.map((step): ResolvedStep => ({
      ...step,
      ...(step.vote?.kind === "estimate" && unit !== undefined ? { vote: { ...step.vote, unit } } : {}),
      item,
    })),
  );
  return { items, steps };
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
 *  - `clock`: the moderation's clock. In M1 the clock of the writing, as before: in a hidden writing step.
 *  - `ballot`: vote (`ballot.cast`), and the moderation counts (`admin.step.count`): a step with a vote
 *    (domain/vote.ts). Nothing is written, moved or grouped in it: the options are frozen. A step that names a
 *    `noteKind` takes notes beside its vote all the same (the reasons beside the first estimate, stage M3): they
 *    are written, changed and deleted, at the step's visibility. */
export interface Capabilities {
  write: boolean;
  move: boolean;
  group: boolean;
  arrange: boolean;
  clock: boolean;
  ballot: boolean;
}

const NOTE_STEPS = new Set<Step["type"]>(["impulse", "write", "reveal", "cluster", "discuss"]);
const SORT_STEPS = new Set<Step["type"]>(["reveal", "cluster", "discuss"]);

export function capabilities(step: Pick<Step, "type" | "visibility" | "vote" | "noteKind">): Capabilities {
  const notes = NOTE_STEPS.has(step.type) || step.noteKind !== undefined;
  // groups need the notes to be seen: while they are hidden, nobody sorts what nobody can read
  const sorts = SORT_STEPS.has(step.type) && levelOf(step.visibility) === "all";
  return {
    write: notes,
    move: notes,
    group: sorts,
    arrange: sorts,
    clock: step.type === "write",
    ballot: step.vote !== undefined,
  };
}

const VOTE_STEPS = new Set<Step["type"]>(["vote", "rank", "score", "estimate"]);
/** Which vote kinds a step type takes. */
const VOTE_KINDS: Partial<Record<Step["type"], readonly string[]>> = {
  vote: ["dots", "approval"],
  rank: ["rank"],
  score: ["score"],
  estimate: ["estimate"],
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
 *  Stage M1 stores no step with a note: both of its methods begin with their writing step, so every note counts
 *  from step 0 (`from` left out), which gives the same answer for every note. The column comes with the first
 *  method that hides again after it has shown (M4, M5). */
export function noteLevel(steps: readonly Pick<Step, "visibility">[], reach: number, from = 0): NoteLevel {
  let level: NoteLevel = "hidden";
  for (let at = Math.max(0, from); at <= reach && at < steps.length; at += 1) {
    const step = steps[at];
    if (step === undefined) continue;
    const here = levelOf(step.visibility);
    if (RANK[here] > RANK[level]) level = here;
  }
  return level;
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
  | { kind: "voteUnseen"; step: number };

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
  });
  return problems;
}
