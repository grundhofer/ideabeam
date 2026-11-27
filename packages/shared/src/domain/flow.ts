// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Clock, RejectCode, StepCommand } from "../protocol.js";
import { agendaOf, capabilities, noteLevel, type Capabilities, type NoteLevel, type ResolvedAgenda } from "./agenda.js";
import { NO_CLOCK, stoppedClock } from "./clock.js";
import type { Actor } from "./rules.js";

// Where a wall stands in its agenda (docs/architektur-methoden.md 1, 4): the step it is in, the furthest step it has
// reached, and the clock of the step. One row holds it (`meta 'flow'`), as the phase and the clock did before: every
// step move is one row written, as revealing was.
//
// What a person may do and read follows from it:
//  - what may be done, from the step the wall is in (`capabilities`, domain/agenda.ts);
//  - what is seen of the notes, from the furthest step reached (`noteLevel`): visibility only widens, and going back
//    never hides what was shown. That is the old rule „revealing is never taken back“, made general.

/** The value of the row `meta 'flow'`, version 2. */
export interface Flow {
  v: 2;
  /** The step the wall is in: an index into its agenda's steps. */
  step: number;
  /** The furthest step the wall has reached. Never below `step`. Skipped steps count as reached. */
  reach: number;
  /** The clock of the step. A step move stops it. */
  clock: Clock;
  /** The number of the change that wrote this row last: a step move, or a control of the clock. */
  seq: number;
}

/** The row as the builds before methods wrote it (schema 3): the phase and the clock. */
export interface LegacyFlow {
  phase: "writing" | "open";
  clock: Clock;
  seq: number;
}

/** A wall as it stands in its flow, read from what it stores: the flow in its current shape, and, for a wall of an
 *  older build that has no agenda row, the agenda its old phase stands for. */
export interface ReadFlow {
  flow: Flow;
  /** null: the wall stores its agenda. Otherwise the agenda of the wall's old phase, which the wall writes beside
   *  its flow the next time the flow changes, and never on a read. */
  legacy: ResolvedAgenda | null;
}

/** The flow of a wall of a build before the methods, in the shape of now. Its phase stood for what is now a method:
 *  hidden writing is „Still sammeln“ in its writing step, a wall whose notes are there for everyone is „Freie Wand“
 *  (PLAN-METHODEN.md 4). Both begin at their first step, so either reads as step 0, reached and no further: what is
 *  seen stays exactly what was seen. A revealed wall that began with hidden writing becomes a „Freie Wand“ too: the
 *  stored phase does not say how it began, and nothing after the revealing changes for it. */
export function readStoredFlow(stored: unknown, agenda: ResolvedAgenda | null): ReadFlow {
  const value = (stored ?? null) as Partial<Flow> & Partial<LegacyFlow>;
  if (value !== null && value.v === 2) {
    const flow: Flow = {
      v: 2,
      step: value.step ?? 0,
      reach: Math.max(value.reach ?? 0, value.step ?? 0),
      clock: value.clock ?? NO_CLOCK,
      seq: value.seq ?? 0,
    };
    return { flow, legacy: agenda === null ? agendaOf("still-sammeln") : null };
  }
  // the old shape, or none at all: a wall that has no row hides rather than shows
  const phase = value?.phase ?? "writing";
  const flow: Flow = { v: 2, step: 0, reach: 0, clock: value?.clock ?? NO_CLOCK, seq: value?.seq ?? 0 };
  if (agenda !== null) return { flow, legacy: null };
  return { flow, legacy: agendaOf(phase === "writing" ? "still-sammeln" : "free") };
}

/** A new wall's flow: at its first step, with no clock. */
export function initialFlow(): Flow {
  return { v: 2, step: 0, reach: 0, clock: NO_CLOCK, seq: 0 };
}

// ───────────────────────── what a step allows ─────────────────────────

/** What the rules ask about the step a wall is in (domain/rules.ts, domain/clock.ts, domain/visibility.ts). */
export interface StepContext {
  /** What is seen of the notes of others. */
  sight: NoteLevel;
  /** What may be done in the step. */
  can: Capabilities;
}

/** Nothing may be done and nothing of others is seen: what a browser takes before it knows the wall. */
export const NO_STEP: StepContext = {
  sight: "hidden",
  can: { write: false, move: false, group: false, arrange: false, clock: false },
};

/** The step context of a wall that stands at `flow` in `agenda`. */
export function stepContext(agenda: ResolvedAgenda, flow: Pick<Flow, "step" | "reach">): StepContext {
  const step = agenda.steps[flow.step];
  if (step === undefined) return NO_STEP;
  return { sight: noteLevel(agenda.steps, flow.reach), can: capabilities(step) };
}

// ───────────────────────── moving between steps ─────────────────────────

export type StepDecision =
  | { kind: "refused"; code: RejectCode }
  /** The wall is in that step already: the command sent a second time. */
  | { kind: "unchanged" }
  /** The flow after the move, and whether what is seen of the notes widens with it: then every browser gets the
   *  notes it did not have (`notes.revealed`) before the step. */
  | { kind: "changed"; flow: Pick<Flow, "step" | "reach" | "clock">; widens: boolean };

/** What the moderation's `admin.step.go` makes of a wall's flow (docs/architektur-methoden.md 4): forward, back or
 *  past a step, the moderation's alone. `from` names the step the command was made in: sent a second time, it finds
 *  the wall in its `to` and changes nothing; made for a step the wall has left meanwhile, it is refused (`STALE`).
 *  A step move stops the clock, as revealing did. Going back keeps `reach`: nothing is hidden again. */
export function decideStep(
  flow: Flow,
  agenda: Pick<ResolvedAgenda, "steps">,
  command: Pick<StepCommand, "from" | "to">,
  by: Pick<Actor, "role">,
): StepDecision {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (command.to >= agenda.steps.length) return { kind: "refused", code: "INVALID" };
  if (flow.step === command.to) return { kind: "unchanged" };
  if (flow.step !== command.from) return { kind: "refused", code: "STALE" };
  const reach = Math.max(flow.reach, command.to);
  return {
    kind: "changed",
    flow: { step: command.to, reach, clock: stoppedClock(flow.clock) },
    widens: noteLevel(agenda.steps, reach) !== noteLevel(agenda.steps, flow.reach),
  };
}

/** Whether moving to step `to` would show notes that are hidden now: the move the app asks about first, since it
 *  cannot be undone. */
export function stepWidens(agenda: Pick<ResolvedAgenda, "steps">, flow: Pick<Flow, "reach">, to: number): boolean {
  return noteLevel(agenda.steps, Math.max(flow.reach, to)) !== noteLevel(agenda.steps, flow.reach);
}
