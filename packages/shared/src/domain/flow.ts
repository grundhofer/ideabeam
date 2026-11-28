// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AutoCommand, Clock, RejectCode, StepCommand } from "../protocol.js";
import {
  agendaOf,
  capabilities,
  keepsSteps,
  noteLevel,
  startsWriting,
  stepsOfKind,
  writingFrom,
  type Capabilities,
  type NoteLevel,
  type ResolvedAgenda,
} from "./agenda.js";
import { NO_CLOCK, stoppedClock } from "./clock.js";
import type { Actor } from "./rules.js";
import { shownByTurn, turnRoundOf, type TurnRound } from "./turns.js";
import type { Seen } from "./visibility.js";
import { openRound, roundOf, type VoteRound } from "./vote.js";

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
  /** The number of the change that wrote this row last: a step move, a control of the clock, or counting a vote. */
  seq: number;
  /** The votes of the steps the wall has entered that vote (stage M2, domain/vote.ts): each with its options,
   *  frozen when the wall first entered its step, and whether it is counted. Kept for every such step, also after
   *  the wall has moved on: going back and forth neither freezes the options again nor opens a counted vote. Left
   *  out while there is none. No ballot stands here: they have a table of their own. */
  votes?: VoteRound[];
  /** The steps that move on by themselves (`advance: "auto"`) whose moving on the moderation has switched off
   *  (stage M4): there the wall waits for „Weiter“ when the time is up. Left out while there is none. */
  manual?: number[];
  /** The orders of the steps that reveal by turn which the wall has entered (stage M5, domain/turns.ts): frozen
   *  when it first entered each, with how many are shown. Note ids: this never leaves the worker. Left out while there
   *  is none. */
  turns?: TurnRound[];
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
      ...(Array.isArray(value.votes) && value.votes.length > 0 ? { votes: value.votes } : {}),
      ...(Array.isArray(value.manual) && value.manual.length > 0 ? { manual: value.manual } : {}),
      ...(Array.isArray(value.turns) && value.turns.length > 0 ? { turns: value.turns } : {}),
    };
    return { flow, legacy: agenda === null ? agendaOf("still-sammeln") : null };
  }
  // the old shape, or none at all: a wall that has no row hides rather than shows
  const phase = value?.phase ?? "writing";
  const flow: Flow = { v: 2, step: 0, reach: 0, clock: value?.clock ?? NO_CLOCK, seq: value?.seq ?? 0 };
  if (agenda !== null) return { flow, legacy: null };
  return { flow, legacy: agendaOf(phase === "writing" ? "still-sammeln" : "free") };
}

/** A new wall's flow: at its first step, with no clock. Where its agenda begins with a step that votes (the first
 *  estimate, stage M3), that vote is open from the start, as a step move into it would open it: an estimate offers
 *  nothing to choose, so nothing on the wall needs to exist first. */
export function initialFlow(agenda?: Pick<ResolvedAgenda, "steps">): Flow {
  const flow: Flow = { v: 2, step: 0, reach: 0, clock: NO_CLOCK, seq: 0 };
  const config = agenda?.steps[0]?.vote;
  if (config === undefined) return flow;
  return { ...flow, votes: [openRound(0, config, { notes: [], groups: [] }, false)] };
}

// ───────────────────────── what a step allows ─────────────────────────

/** What the rules ask about the step a wall is in (domain/rules.ts, domain/clock.ts, domain/visibility.ts). */
export interface StepContext {
  /** What is seen of the notes of others: of the notes of the wall's first round of writing, which, before stage M5,
   *  were all of them. */
  sight: NoteLevel;
  /** What is seen of a note written now, by others (stage M5): in a later round of writing that is hidden again
   *  while what was shown stays shown. Where a step reveals by turn, the turns' notes are not counted. */
  writes: NoteLevel;
  /** What is seen of each note (`sightOf`): the one level where it is the same for all, else per note. A browser,
   *  which knows no order of turns, works it out without the notes shown by turn: it holds them anyway. */
  seen: Seen;
  /** The step the wall is in: a note written now is written in it. */
  at: number;
  /** The steps whose notes are actions (`noteKind: "action"`, stage M5). */
  actionSteps: readonly number[];
  /** The steps whose notes are decisions and measurable results (`noteKind: "decision"`, `"result"`, stage M6): the
   *  moderation records them in a step of type `decide`, as it agrees on actions. */
  decisionSteps: readonly number[];
  resultSteps: readonly number[];
  /** Whether a note keeps the step it is written in (`keepsSteps`, domain/agenda.ts). */
  keepsSteps: boolean;
  /** What may be done in the step. */
  can: Capabilities;
}

/** Nothing may be done and nothing of others is seen: what a browser takes before it knows the wall. */
export const NO_STEP: StepContext = {
  sight: "hidden",
  writes: "hidden",
  seen: "hidden",
  at: 0,
  actionSteps: [],
  decisionSteps: [],
  resultSteps: [],
  keepsSteps: false,
  can: {
    write: false,
    move: false,
    group: false,
    arrange: false,
    clock: false,
    ballot: false,
    turn: false,
    decide: false,
  },
};

/** The step context of a wall that stands at `flow` in `agenda`. */
export function stepContext(
  agenda: ResolvedAgenda,
  flow: Pick<Flow, "step" | "reach"> & Partial<Pick<Flow, "turns">>,
): StepContext {
  const step = agenda.steps[flow.step];
  if (step === undefined) return NO_STEP;
  const seen = sightOf(agenda, flow);
  const can = capabilities(step);
  return {
    sight: noteLevel(agenda.steps, flow.reach),
    writes: noteLevel(agenda.steps, flow.reach, writingFrom(agenda.steps, flow.step)),
    seen,
    at: flow.step,
    actionSteps: stepsOfKind(agenda.steps, "action"),
    decisionSteps: stepsOfKind(agenda.steps, "decision"),
    resultSteps: stepsOfKind(agenda.steps, "result"),
    keepsSteps: keepsSteps(agenda.steps),
    // „Ordnen“ hands every note to the AI and moves any of them: not while some notes are hidden from somebody (a
    // step that sorts, gone back to from a later round of hidden writing)
    can: typeof seen === "string" ? can : { ...can, arrange: false },
  };
}

/** The level of a note written in each step, once the wall has reached `reach` (stage M5): from the step it counts
 *  from (`writingFrom`), the turns of a step that reveals by turn not counted. */
export function levelsAt(agenda: Pick<ResolvedAgenda, "steps">, reach: number): NoteLevel[] {
  const { steps } = agenda;
  if (!keepsSteps(steps)) return steps.map(() => noteLevel(steps, reach));
  // the same as `writingFrom` for every step, in one pass
  let from = 0;
  return steps.map((step, at) => {
    if (at > 0 && startsWriting(step)) from = at;
    return noteLevel(steps, reach, from);
  });
}

/** What is seen of the notes of a wall that stands at `flow` (domain/visibility.ts): one level where every note that
 *  can be on the wall (written in a step up to `reach`) is seen alike and no note waits for its turn; else a level per
 *  step and the notes shown by turn. Every method before stage M5 gives the one level, `noteLevel` from step 0. */
export function sightOf(
  agenda: Pick<ResolvedAgenda, "steps">,
  flow: Pick<Flow, "reach"> & Partial<Pick<Flow, "turns">>,
): Seen {
  const levels = levelsAt(agenda, flow.reach);
  const first = levels[0] ?? "hidden";
  const alike = levels.every((level, at) => at > flow.reach || level === first);
  if (alike && (first === "all" || (flow.turns ?? []).length === 0)) return first;
  return { levels, shown: shownByTurn(flow.turns) };
}

// ───────────────────────── moving between steps ─────────────────────────

export type StepDecision =
  | { kind: "refused"; code: RejectCode }
  /** The wall is in that step already: the command sent a second time. */
  | { kind: "unchanged" }
  /** The flow after the move, and whether what is seen of the notes widens with it: then every browser gets the
   *  notes it did not have (`notes.revealed`) before the step. `opens`: the step moved to votes and the wall enters
   *  it for the first time: its options are frozen now (domain/vote.ts, `openRound`), in the same row. `turns`: the
   *  step moved to reveals by turn and the wall enters it for the first time: its order is frozen now
   *  (domain/turns.ts), in the same row. */
  | {
      kind: "changed";
      flow: Pick<Flow, "step" | "reach" | "clock">;
      widens: boolean;
      opens: boolean;
      turns: boolean;
    };

/** What the moderation's `admin.step.go` makes of a wall's flow (docs/architektur-methoden.md 4): forward, back or
 *  past a step, the moderation's alone. Forward into a step that moves on by itself (stage M4), the step's clock
 *  starts with its time at `now`; every other move stops the clock. `from` names the step the command was made in: sent a second time, it finds
 *  the wall in its `to` and changes nothing; made for a step the wall has left meanwhile, it is refused (`STALE`).
 *  A step move stops the clock, as revealing did. Going back keeps `reach`: nothing is hidden again. */
export function decideStep(
  flow: Flow,
  agenda: Pick<ResolvedAgenda, "steps">,
  command: Pick<StepCommand, "from" | "to">,
  by: Pick<Actor, "role">,
  now?: number,
): StepDecision {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (command.to >= agenda.steps.length) return { kind: "refused", code: "INVALID" };
  if (flow.step === command.to) return { kind: "unchanged" };
  if (flow.step !== command.from) return { kind: "refused", code: "STALE" };
  const reach = Math.max(flow.reach, command.to);
  const into = agenda.steps[command.to];
  const timed =
    now !== undefined && command.to > flow.step && into?.advance === "auto" && into.durationSec !== null
      ? { rev: flow.clock.rev + 1, endsAt: now + into.durationSec * 1000, leftMs: null }
      : null;
  return {
    kind: "changed",
    flow: { step: command.to, reach, clock: timed ?? stoppedClock(flow.clock) },
    widens: stepWidens(agenda, flow, command.to),
    opens: agenda.steps[command.to]?.vote !== undefined && roundOf(flow.votes, command.to) === null,
    turns: agenda.steps[command.to]?.turns === true && turnRoundOf(flow.turns, command.to) === null,
  };
}

/** Whether moving to step `to` would let somebody see notes they do not see now: the notes of some step widen. */
export function stepWidens(agenda: Pick<ResolvedAgenda, "steps">, flow: Pick<Flow, "reach">, to: number): boolean {
  const before = levelsAt(agenda, flow.reach);
  const after = levelsAt(agenda, Math.max(flow.reach, to));
  return after.some((level, at) => at <= Math.max(flow.reach, to) && level !== before[at]);
}

/** Whether moving to step `to` would show to everybody notes that are not shown to everybody now (written in a step
 *  up to the furthest one reached): the move the app asks about first, since it cannot be undone. Into a step of
 *  teams the notes go to the team alone, which is the step's own doing and asks nothing; a step that reveals by turn
 *  shows nothing by being reached. */
export function stepReveals(agenda: Pick<ResolvedAgenda, "steps">, flow: Pick<Flow, "reach">, to: number): boolean {
  const before = levelsAt(agenda, flow.reach);
  const after = levelsAt(agenda, Math.max(flow.reach, to));
  return after.some((level, at) => at <= flow.reach && level === "all" && before[at] !== "all");
}

// ───────────────────────── moving on by itself ─────────────────────────

/** When the step the wall is in moves on by itself, or null: it does not (it waits for „Weiter“, its clock is not
 *  running, the moderation switched its moving on off, or it is the last step). The moment is the end of the
 *  step's clock: pausing the clock stops it, „5 Minuten mehr“ moves it (stage M4). */
export function autoAt(
  agenda: Pick<ResolvedAgenda, "steps">,
  flow: Pick<Flow, "step" | "clock" | "manual">,
): number | null {
  const step = agenda.steps[flow.step];
  if (step === undefined || step.advance !== "auto" || flow.step + 1 >= agenda.steps.length) return null;
  if ((flow.manual ?? []).includes(flow.step)) return null;
  if (flow.clock.leftMs !== null || flow.clock.endsAt === null) return null;
  return flow.clock.endsAt;
}

/** The moment the object's one alarm is to ring (docs/architektur-methoden.md 3.3): the day the wall deletes itself,
 *  or before it the moment the step moves on by itself. */
export function nextAlarm(
  retentionAt: number,
  agenda: Pick<ResolvedAgenda, "steps">,
  flow: Pick<Flow, "step" | "clock" | "manual">,
): number {
  const at = autoAt(agenda, flow);
  return at === null ? retentionAt : Math.min(retentionAt, at);
}

/** What the alarm makes of the flow at `now`: the move to the next step, as if the moderation had pressed „Weiter“,
 *  or null: nothing is due. An alarm that rings late finds the step moved on already, or the time moved: it does
 *  nothing; one that rings twice finds the next step, whose time has not run out. */
export function decideAuto(flow: Flow, agenda: Pick<ResolvedAgenda, "steps">, now: number): StepDecision | null {
  const at = autoAt(agenda, flow);
  if (at === null || now < at) return null;
  return decideStep(flow, agenda, { from: flow.step, to: flow.step + 1 }, { role: "admin" }, now);
}

/** What the moderation's `admin.step.auto` makes of the flow: a step that moves on by itself does so (`on`) or waits
 *  for „Weiter“. The flow's new list of such steps, or a refusal, or null: it is so already. */
export function decideAutoSwitch(
  flow: Flow,
  agenda: Pick<ResolvedAgenda, "steps">,
  command: Pick<AutoCommand, "step" | "on">,
  by: Pick<Actor, "role">,
): { kind: "refused"; code: RejectCode } | { kind: "unchanged" } | { kind: "changed"; manual: number[] } {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (agenda.steps[command.step]?.advance !== "auto") return { kind: "refused", code: "INVALID" };
  const manual = flow.manual ?? [];
  const off = manual.includes(command.step);
  if (off !== command.on) return { kind: "unchanged" };
  return {
    kind: "changed",
    manual: command.on
      ? manual.filter((step) => step !== command.step)
      : [...manual, command.step].sort((a, b) => a - b),
  };
}
