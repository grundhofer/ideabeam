// key-anthropic.ts: asking Anthropic with the moderation's own key, through Anthropic's own client. Loaded only when
// Anthropic is the provider of a run (key-run.ts): the client is the largest part of „Eigener Schlüssel“, and nobody
// who arranges with Cloudflare, Mistral or OpenAI needs it.
//
// The client is told to run in a browser (`dangerouslyAllowBrowser`): Anthropic's API takes a call from a page only
// with the header that option sends, and its warning is about a key that a page ships to everybody. Here the key is
// the moderation's own, typed into its own browser and held in this tab's memory (store/key.ts).
//
// What the request holds and how the answer is read are the package's (provider-calls.ts): no temperature, the
// schema without list bounds, `stop_reason` before the content. What is the client's alone stands here: one
// attempt per call (the run asks a second time itself, and hedges), no logging, no tracing, and for the models that
// have one Anthropic's own fallback when a request is declined.
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC, anthropicParams, modelOf, readAnthropicMessage, type ProviderFailure } from "@ideabeam/arrange";
import { CALL_LIMIT_MS, type Caller } from "./key-run";

/** Why a call failed, from the class of what the client threw: never from the words of a message, which change and
 *  which may quote what was sent. Most specific first. A call the run itself ended is thrown on. */
export function anthropicFailure(error: unknown): ProviderFailure {
  if (error instanceof Anthropic.APIUserAbortError) throw error;
  // no answer at all, or none in time (a subclass of APIError: before it)
  if (error instanceof Anthropic.APIConnectionError) return "UNREACHABLE";
  if (error instanceof Anthropic.AuthenticationError) return "KEY_REFUSED";
  if (error instanceof Anthropic.PermissionDeniedError) return "KEY_REFUSED";
  if (error instanceof Anthropic.PaymentRequiredError) return "NO_CREDIT";
  // a limit of what the account may spend answers with the status of a rate limit: the class tells them apart
  if (
    error instanceof Anthropic.EnforcedSpendLimitReachedError ||
    error instanceof Anthropic.ContractSpendLimitReachedError
  ) {
    return "NO_CREDIT";
  }
  if (error instanceof Anthropic.RateLimitError) return "RATE_LIMITED";
  if (error instanceof Anthropic.OverloadedError || error instanceof Anthropic.ServiceUnavailableError) {
    return "RATE_LIMITED";
  }
  if (error instanceof Anthropic.InternalServerError) return "UNREACHABLE";
  // 400, 404, 413, 422: the model, the schema, a field
  if (error instanceof Anthropic.APIError) return "REJECTED";
  // not the provider's doing: nothing can be made of it
  return "UNUSABLE";
}

/** The function a run asks Anthropic through, with `key`. `model`: another one than the provider's own; `fetcher`:
 *  the `fetch` the client uses instead of the browser's (a measurement's stand-in, a test). */
export function anthropicCaller(key: string, model?: string, fetcher?: typeof fetch): Caller {
  const setting = modelOf(ANTHROPIC, model);
  const client = new Anthropic({
    apiKey: key,
    dangerouslyAllowBrowser: true,
    // the run's own second attempt and its call beside a slow one are the only repeats: a call made here goes out
    // once, and ends after the time one call may take
    maxRetries: 0,
    timeout: CALL_LIMIT_MS,
    // nothing of a request is written anywhere, and no trace context goes out with it
    logLevel: "off",
    openTelemetry: false,
    // no cookie and no address of this page goes with a call: the address of a wall is the right to join it
    fetchOptions: { credentials: "omit", referrerPolicy: "no-referrer" },
    ...(fetcher === undefined ? {} : { fetch: fetcher }),
  });
  return async (request, signal) => {
    const params = anthropicParams(request, setting);
    try {
      // Anthropic's fallback for a declined request is a beta of its API: it goes through the client's beta
      // namespace, which sends the beta's name as a header. A model without it is asked the plain way
      const message =
        params.betas === undefined
          ? await client.messages.create(params, { signal })
          : await client.beta.messages.create(params, { signal });
      return readAnthropicMessage(message);
    } catch (error) {
      // the run was ended: whatever the client makes of that, it is no answer of the provider's
      if (signal.aborted) throw error;
      return { ok: false, why: anthropicFailure(error) };
    }
  };
}
