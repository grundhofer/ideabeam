// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ArrangeLanguage, Proposal } from "@ideabeam/shared";
import { buildProposal, readAssignment, readThemes } from "./answers.js";
import {
  assignRequest,
  batchesOf,
  themeCounts,
  themesRequest,
  type ArrangeNote,
  type ModelRequest,
  type Theme,
} from "./prompts.js";

// A run (PLAN.md 4.3): the order of the calls, which of them run side by side, and what happens when one fails or
// is slow. It asks through a function it is handed and does no I/O of its own: the Worker hands in Workers AI, a
// browser with a key of its own its provider, a test its canned answers.
//
//  1. Themes: one call with every note.
//  2. Assign: the notes in batches of fifty, all batches side by side.
//
// No call merges the themes in between: measured, it reworded the themes of the first call, took 4 to 7 seconds,
// and the arrangement was worse with it (prompts.ts).
//
// A call that throws, or answers what cannot be read, is asked once more. Without themes after that there is no
// run. A batch without an answer after that leaves its notes without a group; when no batch got an answer, or no
// note a group, there is no proposal.
//
// A call that is slow is asked a second time beside itself, and the first readable answer of the two counts (the
// hedge). Measured, now and then one call waits 30 to 60 seconds while its neighbours answer in 10, and a run is as
// slow as its slowest call. When to hedge, and the clock that says so, are handed in (`ArrangeTiming`): without them
// nothing is hedged.

/** Which step of a run a call belongs to. */
export type ArrangeStep = "themes" | "assign";

/** What one call used. */
export interface CallUsage {
  neurons: number;
  inputTokens: number;
  outputTokens: number;
}

/** A model's answer to one request: what it wrote (text, or an object where the service parsed it), and what the
 *  call used, where the service says so. */
export interface ModelAnswer {
  content: unknown;
  usage: CallUsage | null;
}

/** Asks the model. It may throw: the run takes that as no answer. */
export type Ask = (request: ModelRequest, step: ArrangeStep) => Promise<ModelAnswer>;

/** The clock of a run that hedges: `wait` resolves after so many milliseconds, and `hedgeAfter` says for each step
 *  how long a call may be out before the same request is asked a second time beside it. */
export interface ArrangeTiming {
  wait(ms: number): Promise<void>;
  hedgeAfter: Record<ArrangeStep, number>;
}

/** After how long a call that has not answered is asked a second time beside itself; the first readable answer of
 *  the two counts. Measured against Workers AI on 2026-11-23: a call for the themes takes 5 to 9 seconds, one in
 *  ten up to 15; a call that assigns a batch takes 5 to 10; and now and then one takes 17 to 60 while its
 *  neighbours are done. So the second call is made where a healthy one would have answered. The Worker hedges by
 *  these times, and so does a browser that asks a provider with the moderation's own key, where they are not
 *  measured. */
export const HEDGE_AFTER_MS: Record<ArrangeStep, number> = { themes: 15_000, assign: 12_000 };

/** What a run used: the calls it made, how many of them gave nothing readable, how many were the second call of a
 *  hedge, and the sum of what they used. */
export interface RunUsage extends CallUsage {
  calls: number;
  failed: number;
  hedged: number;
}

export type ArrangeRun =
  | {
      ok: true;
      proposal: Proposal;
      /** The themes the model named, with those that got no note. */
      themes: Theme[];
      /** How many batches stayed without an answer; their notes are in the proposal's `loose`. */
      unanswered: number;
      usage: RunUsage;
    }
  /** No proposal. `step` says where the run ended. What it used until then is still used. */
  | { ok: false; step: "themes" | "assign"; usage: RunUsage };

export interface ArrangeInput {
  /** The wall's question. */
  question: string;
  /** The notes to arrange, in the wall's order. */
  notes: readonly ArrangeNote[];
  /** The language the themes' titles are written in. */
  language: ArrangeLanguage;
}

/** Arranges the notes: asks the model for themes and for each note's theme, checks every answer, and returns the
 *  proposal. With `timing`, a call that is slow is hedged. Never throws for what the model does. */
export async function arrange(input: ArrangeInput, ask: Ask, timing?: ArrangeTiming): Promise<ArrangeRun> {
  const { question, notes, language } = input;
  const usage: RunUsage = { calls: 0, failed: 0, hedged: 0, neurons: 0, inputTokens: 0, outputTokens: 0 };
  const spend = (used: CallUsage | null) => {
    if (used === null) return;
    usage.neurons += used.neurons;
    usage.inputTokens += used.inputTokens;
    usage.outputTokens += used.outputTokens;
  };

  /** One call: what `read` makes of its answer, or null, and what the call used. */
  async function called<T>(
    request: ModelRequest,
    step: ArrangeStep,
    read: (content: unknown) => T | null,
  ): Promise<{ value: T | null; used: CallUsage | null }> {
    let used: CallUsage | null = null;
    try {
      const answer = await ask(request, step);
      used = answer.usage;
      return { value: read(answer.content), used };
    } catch {
      // no answer: the attempt waits for its other call, or has failed
      return { value: null, used };
    }
  }

  /** One attempt at a request: the call, and, when it has not answered after the step's hedge time, the same call
   *  once more beside it. The first answer that `read` can make something of, without waiting for the other call;
   *  null once every call of the attempt has given nothing. A call that fails before the hedge time ends the
   *  attempt at once. */
  function attempt<T>(
    request: ModelRequest,
    step: ArrangeStep,
    read: (content: unknown) => T | null,
  ): Promise<T | null> {
    return new Promise((resolve) => {
      /** The calls that have not answered yet. */
      let out = 0;
      let over = false;
      const call = () => {
        usage.calls += 1;
        out += 1;
        void called(request, step, read).then(({ value, used }) => {
          // an answer that comes after the attempt took the other call's: reckoned then, and counted no further
          if (over) return;
          out -= 1;
          spend(used);
          if (value === null) {
            usage.failed += 1;
          } else if (out > 0) {
            // The other call is still out, and the run does not wait to hear what it used: it is reckoned at what
            // this one used. A call that is cut off or fails costs less, so the budget errs towards spending less.
            spend(used);
          }
          if (value !== null || out === 0) {
            over = true;
            resolve(value);
          }
        });
      };
      call();
      if (timing === undefined) return;
      const hedge = () => {
        if (over) return;
        usage.hedged += 1;
        call();
      };
      // a clock that fails hedges nothing: the attempt goes on with its one call
      void (async () => timing.wait(timing.hedgeAfter[step]))().then(hedge, () => undefined);
    });
  }

  /** One request, attempted at most twice: the first answer that `read` can make something of. */
  async function asked<T>(
    request: ModelRequest,
    step: ArrangeStep,
    read: (content: unknown) => T | null,
  ): Promise<T | null> {
    for (let n = 0; n < 2; n++) {
      const value = await attempt(request, step, read);
      if (value !== null) return value;
    }
    return null;
  }

  const [, most] = themeCounts(notes.length);
  const themes = await asked(themesRequest(question, notes, language), "themes", (content) => {
    const named = readThemes(content, most);
    // a theme alone sorts nothing: fewer than two is no answer
    return named.length >= 2 ? named : null;
  });
  if (themes === null) return { ok: false, step: "themes", usage };

  const batches = batchesOf(notes);
  const answers = await Promise.all(
    batches.map((batch) =>
      asked(assignRequest(question, themes, batch), "assign", (content) => readAssignment(content, batch, themes)),
    ),
  );
  const unanswered = answers.filter((answer) => answer === null).length;
  if (unanswered === batches.length) return { ok: false, step: "assign", usage };
  const proposal = buildProposal(
    notes,
    themes,
    answers.flatMap((answer) => answer ?? []),
  );
  if (proposal.groups.length === 0) return { ok: false, step: "assign", usage };
  return { ok: true, proposal, themes, unanswered, usage };
}
