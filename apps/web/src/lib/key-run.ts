// key-run.ts: „Ordnen“ with the moderation's own key (PLAN.md 4.5): the run of @ideabeam/arrange, the same prompts
// and the same check of every answer the Worker uses, asked of the moderation's provider straight from this
// browser. Nothing of it goes to the app's own server: not the key, not a note, not the answer.
//
// This file and what it imports (the prompts, the run) are loaded when a run with a key starts, and not before:
// store/arrange.ts imports it on demand, and tests/arrange.spec.ts holds that no file the app loads at its start
// carries a prompt. Anthropic's client is loaded later still, when Anthropic is the provider (key-anthropic.ts).
//
// scripts/measure-key.mjs runs this same file in Node, against a test board: what is measured there is what the
// browser does. So nothing here needs a window: `fetch`, timers and signals are in both.
//
// The key goes into the header of a call and nowhere else. No error made here carries it or a word of a provider's
// answer: a call that fails is one of the names of ProviderFailure.
import {
  arrange,
  ENDS_A_RUN,
  HEDGE_AFTER_MS,
  mistralCall,
  modelOf,
  openaiCall,
  providerOf,
  readChatCompletion,
  type ArrangeInput,
  type Ask,
  type ModelRequest,
  type ProviderFailure,
  type ProviderId,
  type ProviderResult,
  type RunUsage,
  type Theme,
} from "@ideabeam/arrange";
import type { Proposal } from "@ideabeam/shared";

/** How long one call may take before the run takes it as no answer. The Worker gives a call to Workers AI 30
 *  seconds; a provider's model that thinks before it answers may need longer, and nothing is measured yet. With 60,
 *  a call that hangs still leaves the run one more attempt inside the two minutes the app waits. */
export const CALL_LIMIT_MS = 60_000;

/** A proposal, or why there is none: what the provider's answers said, or `LOAD`: the provider's client is a part
 *  of the app of its own, and it did not load. `partial`: a part of the notes got no answer and lies in
 *  `proposal.loose`. */
export type KeyRun =
  | { ok: true; proposal: Proposal; partial: boolean; themes: Theme[]; usage: RunUsage }
  | { ok: false; why: ProviderFailure | "LOAD"; usage: RunUsage };

export type KeyRunOptions = {
  /** Another model than the provider's own: a measurement tries one. */
  model?: string | undefined;
  /** The `fetch` every call goes through. The app passes none and uses the browser's; the measuring script hands in
   *  one that leads to its stand-in. */
  fetch?: typeof fetch | undefined;
};

/** Asks a provider one question. Resolves with what it answered or why not; rejects only when `signal` ended the
 *  call. */
export type Caller = (request: ModelRequest, signal: AbortSignal) => Promise<ProviderResult>;

const aborted = () => new DOMException("the run was ended", "AbortError");

/** Resolves after `ms`; rejects as soon as `signal` ends the run, so no timer outlives it. */
function waited(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(aborted());
    const stop = () => {
      clearTimeout(timer);
      reject(aborted());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** Mistral and OpenAI: one HTTP call, with the key in its header. No cookie and no address of this page goes with
 *  it: the address of a wall is the right to join it. A call that got no answer the script may read is
 *  `UNREACHABLE`: no connection, and also an error answer that the provider sent without the header that lets a
 *  browser read it, which looks the same from here. */
function chatCaller(provider: "mistral" | "openai", key: string, model: string | undefined, fetcher: typeof fetch) {
  const setting = modelOf(providerOf(provider), model);
  const caller: Caller = async (request, signal) => {
    const { url, headers, body } =
      provider === "mistral" ? mistralCall(request, key, setting) : openaiCall(request, key, setting);
    // the call's own time limit, and the run's end: whichever comes first ends the call
    const limit = new AbortController();
    const end = () => limit.abort();
    const timer = setTimeout(end, CALL_LIMIT_MS);
    signal.addEventListener("abort", end, { once: true });
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: limit.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      // an error's body may be no JSON at all: the status says enough then
      const answer: unknown = await response.json().catch(() => null);
      if (signal.aborted) throw aborted();
      return readChatCompletion(provider, response.status, answer);
    } catch {
      if (signal.aborted) throw aborted();
      return { ok: false, why: "UNREACHABLE" };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", end);
    }
  };
  return caller;
}

/** The function a run asks a provider through. Anthropic is asked through its own client, which is loaded only
 *  when it is needed; null: it did not load. */
async function callerOf(own: { provider: ProviderId; key: string }, options: KeyRunOptions): Promise<Caller | null> {
  if (own.provider === "anthropic") {
    const client = await import("./key-anthropic").catch(() => null);
    return client === null ? null : client.anthropicCaller(own.key, options.model, options.fetch);
  }
  return chatCaller(own.provider, own.key, options.model, options.fetch ?? fetch);
}

/** Arranges the notes with the moderation's own key: asks its provider for themes and for each note's theme, with
 *  the second call beside a slow one that the Worker makes too, checks every answer, and returns the proposal or
 *  why there is none. `signal` ends the run and every call that is out; the promise then rejects, and whoever ended
 *  it knows why.
 *
 *  Why there is no proposal: a failure no further call can get past (the key, the account, the request's shape)
 *  ends the run's asking at once and is the reason; else the reason is what the last failed call said; and where
 *  every call answered and nothing could be made of the answers, `UNUSABLE`. */
export async function runWithKey(
  own: { provider: ProviderId; key: string },
  input: ArrangeInput,
  signal: AbortSignal,
  options: KeyRunOptions = {},
): Promise<KeyRun> {
  const call = await callerOf(own, options);
  if (call === null) {
    const usage = { calls: 0, failed: 0, hedged: 0, neurons: 0, inputTokens: 0, outputTokens: 0 };
    return { ok: false, why: "LOAD", usage };
  }
  // what the run's calls said about why they failed: the failure that ended the asking, and the last one heard
  const heard: { ended: ProviderFailure | null; last: ProviderFailure | null } = { ended: null, last: null };
  const ask: Ask = async (request) => {
    if (signal.aborted) throw aborted();
    // the name of the failure and nothing else: an error's message can end up anywhere
    if (heard.ended !== null) throw new Error(heard.ended);
    const result = await call(request, signal);
    if (!result.ok) {
      heard.last = result.why;
      if (ENDS_A_RUN.has(result.why)) heard.ended = result.why;
      throw new Error(result.why);
    }
    // a provider counts tokens, not Cloudflare's neurons
    return { content: result.content, usage: result.usage === null ? null : { neurons: 0, ...result.usage } };
  };
  const run = await arrange(input, ask, { wait: (ms) => waited(ms, signal), hedgeAfter: HEDGE_AFTER_MS });
  if (signal.aborted) throw aborted();
  if (!run.ok) return { ok: false, why: heard.ended ?? heard.last ?? "UNUSABLE", usage: run.usage };
  return { ok: true, proposal: run.proposal, partial: run.unanswered > 0, themes: run.themes, usage: run.usage };
}
