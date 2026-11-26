// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  arrange,
  chatRequest,
  fakeAsk,
  HEDGE_AFTER_MS,
  modelSetting,
  neuronsOf,
  readChatAnswer,
  type ArrangeRun,
  type ArrangeTiming,
  type Ask,
  type ModelSetting,
} from "@ideabeam/arrange";
import {
  ARRANGE_MIN_NOTES,
  arrangeEstimate,
  WALL_DAILY_RUNS,
  type ArrangeError,
  type ArrangeLanguage,
  type ArrangeResponse,
} from "@ideabeam/shared";
import { dailyNeurons } from "./rate-limiter.js";
import type { WallRoom } from "./wall-room.js";
import { limiterStub } from "./wall-stub.js";

// „Ordnen“, the Worker's part (PLAN.md 4.3): a proposal for a wall, worked out by Workers AI.
//
// The Worker asks, never the wall's Durable Object: a call to the AI waits for many seconds, and an object that
// waits is an object that is billed for being awake. The wall is asked once, for its notes, and answers at once;
// the counter is asked twice, before the run and after it; in between only this request waits.
//
// What the route stores is the count of what it spent, and nothing else: the proposal goes back to the
// moderation's browser and is on no wall until the moderation applies it there (`admin.arrange.apply`).
//
// The notes come from the wall, never from the request: a route that arranged whatever text it was sent would be an
// AI for everybody who can make a wall.

/** How long one call to the model may take before the run takes it as no answer. By then its second call
 *  (HEDGE_AFTER_MS, packages/arrange) has been out for as long as a healthy call takes. */
const CALL_TIMEOUT_MS = 30_000;

/** The run's clock: over after `ms`. Built on a signal's timeout, as the time limit of a call below: `setTimeout`
 *  is refused in this folder (eslint.config.js), where it would keep a Durable Object awake. */
const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    AbortSignal.timeout(ms).addEventListener("abort", () => resolve(), { once: true });
  });

/** What the route uses of the binding `AI`: one call. Narrow on purpose: it is the seam a test hands its own AI
 *  in through (`{ ...env, AI }`), and the model's id is a setting, not one of the names the binding's types list. */
interface ModelBinding {
  run(model: string, input: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
}

/** The name the route's answer gives the stand-in of local runs in place of a model's id: nobody takes its
 *  arrangement for a model's, also not in a deployment that got the switch by mistake. */
export const STAND_IN = "stand-in";

/** Whether Cloudflare refused a call because the account's free allowance of neurons is used up. At the REST
 *  endpoint that is a 429 whose body reads `{"errors":[{"message":"AiError: AiError: you have used up your daily
 *  free allocation of 10,000 neurons, …","code":4006}],"success":false}` (seen on 2026-11-23, docs/messung-4a.md,
 *  section 9). What the binding `AI` throws for it was never seen. Its own code (workerd 1.20261117.1,
 *  `_parseError`) makes an error whose message begins with the code, „4006: …“, or is the body as it came. So this
 *  reads generously: the code 4006 on what was thrown, or a message that names the code or says „daily free
 *  allocation“, on an error, as a bare text, or inside a list of `errors` as the endpoint's body has it. */
export function allowanceSpent(error: unknown): boolean {
  if (typeof error === "string") return /\b4006\b|daily free allocation/iu.test(error);
  if (typeof error !== "object" || error === null) return false;
  const { code, message, errors } = error as { code?: unknown; message?: unknown; errors?: unknown };
  if ((typeof code === "number" || typeof code === "string") && Number(code) === 4006) return true;
  if (typeof message === "string" && allowanceSpent(message)) return true;
  return Array.isArray(errors) && errors.some(allowanceSpent);
}

/** Who a run asks: the function it asks through and the name the answer says, or null: this deployment has nothing
 *  to ask.
 *  - Local runs (`ARRANGE_FAKE=1` in .dev.vars): a stand-in without network that answers the same every time, and
 *    at once: nothing to hedge, so no `timing`.
 *  - Else the binding `AI`: Workers AI, with the model the deployment names, and the clock a slow call is hedged by.
 *
 *  `refused` says whether Cloudflare has refused a call of this run because the account's allowance is used up
 *  (`allowanceSpent`). From that call on the run's further calls fail at once, without asking the service: the
 *  allowance is the account's, so the second try of a call and the call beside a slow one would only be refused
 *  again. */
export function askOf(
  env: Env,
  model: ModelSetting,
): { ask: Ask; name: string; timing?: ArrangeTiming; refused(): boolean } | null {
  if (env.ARRANGE_FAKE === "1") return { ask: fakeAsk, name: STAND_IN, refused: () => false };
  const binding = env.AI as unknown as ModelBinding | undefined;
  if (binding === undefined || binding === null || typeof binding.run !== "function") return null;
  let refused = false;
  const spent = () => {
    refused = true;
    return new Error("Workers AI refused the call: the account's allowance is used up");
  };
  const ask: Ask = async (request) => {
    if (refused) throw spent();
    const signal = AbortSignal.timeout(CALL_TIMEOUT_MS);
    const late = new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("the model did not answer in time")), { once: true });
    });
    let raw: unknown;
    try {
      raw = await Promise.race([binding.run(model.id, chatRequest(request, model), { signal }), late]);
    } catch (error) {
      throw allowanceSpent(error) ? spent() : error;
    }
    // a refusal that came back as an answer instead of being thrown is the same refusal
    if (allowanceSpent(raw)) throw spent();
    const { content, usage } = readChatAnswer(raw);
    return {
      content,
      usage:
        usage === null
          ? null
          : { neurons: neuronsOf(usage, model), inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    };
  };
  return { ask, name: model.id, timing: { wait, hedgeAfter: HEDGE_AFTER_MS }, refused: () => refused };
}

/** A wall's key in the counter of the AI's budget: the start of a hash of its address. The address itself is the
 *  capability of everybody on the wall and is stored nowhere but in the wall. */
export async function wallKey(wallId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(wallId));
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** What the route answers: a proposal, or why there is none, with the status that goes with it. */
export type ArrangeOutcome = { status: 200; body: ArrangeResponse } | { status: number; body: ArrangeError };

const STATUS: Record<ArrangeError["error"], number> = {
  WALL_NOT_FOUND: 404,
  NOT_ADMIN: 401,
  INVALID_REQUEST: 400,
  PHASE: 409,
  NOTHING_TO_ARRANGE: 409,
  AI_BUDGET_SPENT: 429,
  WALL_RUNS_SPENT: 429,
  AI_FAILED: 502,
  AI_UNAVAILABLE: 503,
};

export const refusal = (body: ArrangeError): ArrangeOutcome => ({ status: STATUS[body.error], body });

const hundredths = (neurons: number) => Math.round(neurons * 100) / 100;

/** A proposal for the wall, or why there is none. In this order: the wall says whether the token is its admin's
 *  and hands out its notes; a wall with too few notes ends here; the counter is asked whether the budget of the
 *  last 24 hours holds the run and the wall has a run left; only then is the AI called; and whatever the run used
 *  is booked before the answer leaves.
 *
 *  The product's count can let a run through that Cloudflare refuses: the allowance is the account's, and other
 *  products and measurements spend from it too. A run that gave no proposal because of that says so
 *  (`AI_BUDGET_SPENT`), and names no time: the product does not know when Cloudflare's window frees up. The wall
 *  gets its run back, and a call that was refused brings no usage, so nothing is booked for it. */
export async function proposeFor(
  env: Env,
  wallId: string,
  wall: DurableObjectStub<WallRoom>,
  adminToken: string,
  language: ArrangeLanguage,
): Promise<ArrangeOutcome> {
  const input = await wall.arrangeInput(adminToken);
  if (input.kind === "missing") return refusal({ error: "WALL_NOT_FOUND" });
  if (input.kind === "refused") return refusal({ error: input.code });
  if (input.notes.length < ARRANGE_MIN_NOTES) {
    return refusal({ error: "NOTHING_TO_ARRANGE", notes: input.notes.length, min: ARRANGE_MIN_NOTES });
  }
  const model = modelSetting(env.ARRANGE_MODEL);
  const asked = askOf(env, model);
  if (asked === null) return refusal({ error: "AI_UNAVAILABLE" });

  const limiter = limiterStub(env);
  const grant = await limiter.reserveArrange(await wallKey(wallId), arrangeEstimate(input.notes.length), {
    neurons: dailyNeurons(env),
    runs: WALL_DAILY_RUNS,
  });
  if (!grant.granted) {
    return refusal({
      error: grant.why === "budget" ? "AI_BUDGET_SPENT" : "WALL_RUNS_SPENT",
      resetsAt: grant.resetsAt,
    });
  }

  let run: ArrangeRun;
  try {
    run = await arrange({ question: input.question, notes: input.notes, language }, asked.ask, asked.timing);
  } catch (error) {
    // not the model's doing (a run takes that as no answer): the reservation is given back, the error is the route's
    await limiter.bookArrange(grant.reservation, 0, false);
    throw error;
  }
  await limiter.bookArrange(grant.reservation, run.usage.neurons, run.ok);
  if (!run.ok) return refusal({ error: asked.refused() ? "AI_BUDGET_SPENT" : "AI_FAILED" });
  return {
    status: 200,
    body: {
      proposal: run.proposal,
      cost: {
        neurons: hundredths(run.usage.neurons),
        calls: run.usage.calls,
        inputTokens: run.usage.inputTokens,
        outputTokens: run.usage.outputTokens,
      },
      partial: run.unanswered > 0,
      runsLeft: grant.runsLeft,
      model: asked.name,
    },
  };
}
