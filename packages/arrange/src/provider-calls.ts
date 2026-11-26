// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readChatAnswer } from "./answers.js";
import type { ModelRequest } from "./prompts.js";
import { MISTRAL, OPENAI, THINKING_RESERVE, type Effort, type ProviderModel } from "./providers.js";

// „Eigener Schlüssel“ (PLAN.md 4.5): what goes to a provider for one question of a run, and what its answer says.
// Plain functions: a request as an address, headers and a body; an answer as what the model wrote, or why there is
// none. Whoever calls (the moderation's browser, the measuring script) sends the one and hands back the other, and
// nothing here knows a network. The key enters a header and nothing else: no address, no body, no message of an
// error.
//
// Every provider gets the same two halves of the prompt and the same schema (prompts.ts), and every answer goes
// through the same check (answers.ts). What differs is the envelope, and three things the providers' pages say
// (docs/ki-anbieter-4b.md, docs/ki-anbieter-4b-us.md, read on 2026-11-23, none of it seen in a real answer):
//  - Mistral and OpenAI take the shape of OpenAI's chat completions; Anthropic has its own Messages API.
//  - OpenAI counts the answer's tokens as `max_completion_tokens`; Anthropic refuses `temperature` at any value,
//    and OpenAI wants it gone as soon as its model thinks.
//  - Anthropic refuses a schema that bounds the length of a list. The bounds are left out there: the run's own
//    check keeps the counts (answers.ts, run.ts).

/** Why a call to a provider gave no answer.
 *  - `KEY_REFUSED`: the provider does not take the key (wrong, expired, without the right).
 *  - `NO_CREDIT`: the account has no credit, or a limit of what it may spend is reached.
 *  - `RATE_LIMITED`: too many calls in a short time, or the provider is overloaded: worth trying again later.
 *  - `REJECTED`: the provider does not take the request itself: the model, the schema, a field.
 *  - `DECLINED`: the model refused to answer, for the provider's own reasons.
 *  - `UNREACHABLE`: no answer came, or one the caller may not read, or the provider failed.
 *  - `UNUSABLE`: an answer came that nothing can be made of: empty, or cut off at the limit of its tokens. */
export type ProviderFailure =
  "KEY_REFUSED" | "NO_CREDIT" | "RATE_LIMITED" | "REJECTED" | "DECLINED" | "UNREACHABLE" | "UNUSABLE";

/** The failures no further call of the same run can get past: the key, the account, the request's own shape. A run
 *  that met one of them asks no more. */
export const ENDS_A_RUN: ReadonlySet<ProviderFailure> = new Set(["KEY_REFUSED", "NO_CREDIT", "REJECTED"]);

/** What a provider answered to one request: what the model wrote and what the call used, as the provider counts
 *  it, or why there is no answer. */
export type ProviderResult =
  | { ok: true; content: string; usage: { inputTokens: number; outputTokens: number } | null }
  | { ok: false; why: ProviderFailure };

/** A request as it goes over the line, for a provider that is asked with a plain HTTP call. */
export interface HttpCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

const failed = (why: ProviderFailure): ProviderResult => ({ ok: false, why });
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** What a provider's status says where its body says nothing more telling. */
export function failureOfStatus(status: number): ProviderFailure {
  if (status === 401 || status === 403) return "KEY_REFUSED";
  if (status === 402) return "NO_CREDIT";
  // 503 and 529: the provider says it is overloaded, which passes as a rate limit does
  if (status === 429 || status === 503 || status === 529) return "RATE_LIMITED";
  if (status === 408 || status >= 500) return "UNREACHABLE";
  return "REJECTED";
}

// ───────────────────────── Mistral and OpenAI: chat completions ─────────────────────────

const messages = (request: ModelRequest) => [
  { role: "system", content: request.system },
  { role: "user", content: request.user },
];
const answerFormat = (request: ModelRequest) => ({
  type: "json_schema",
  json_schema: { name: "answer", strict: true, schema: request.schema },
});
const limit = (request: ModelRequest, model: Pick<ProviderModel, "thinks">) =>
  request.maxTokens + (model.thinks ? THINKING_RESERVE : 0);
const bearer = (key: string) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

/** The request to Mistral. Only the two headers its preflight is known to allow, and only fields its pages name:
 *  Mistral's own name for a seed is another one, so none is sent. `reasoning_effort: "none"` keeps the model from
 *  thinking, which would eat the answer's tokens. */
export function mistralCall(request: ModelRequest, key: string, model: ProviderModel): HttpCall {
  return {
    url: MISTRAL.url,
    headers: bearer(key),
    body: {
      model: model.id,
      messages: messages(request),
      temperature: 0,
      max_tokens: limit(request, model),
      response_format: answerFormat(request),
      reasoning_effort: model.effort,
    },
  };
}

/** The request to OpenAI. `temperature` and `seed` go only while the model does not think: OpenAI's guide says to
 *  remove them otherwise. */
export function openaiCall(request: ModelRequest, key: string, model: ProviderModel): HttpCall {
  return {
    url: OPENAI.url,
    headers: bearer(key),
    body: {
      model: model.id,
      messages: messages(request),
      reasoning_effort: model.effort,
      ...(model.effort === "none" ? { temperature: 0, seed: 1 } : {}),
      max_completion_tokens: limit(request, model),
      response_format: answerFormat(request),
    },
  };
}

/** The codes by which OpenAI says that an account has no credit or has reached a limit of what it may spend. It
 *  answers them with the status of a rate limit, 429: only the code tells „add credit“ from „wait“. */
const OPENAI_SPENT = new Set([
  "insufficient_quota",
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
]);

function openaiFailure(status: number, body: unknown): ProviderFailure {
  const error = record(record(body)?.error);
  const named = [error?.code, error?.type].filter((name) => typeof name === "string");
  if (status === 429 && named.some((name) => OPENAI_SPENT.has(name))) return "NO_CREDIT";
  // OpenAI answers 403 to a country it does not serve: the key is not what is wrong
  if (status === 403) return "REJECTED";
  return failureOfStatus(status);
}

/** What a model wrote, as text. Mistral may answer in parts, its thinking among them: the parts of text count. */
function writtenText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const parts = content
    .map((part) => record(part))
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => String(part?.text));
  return parts.length === 0 ? null : parts.join("");
}

/** What Mistral or OpenAI answered, from the status and the body of the answer, read without trusting its shape.
 *  A model that refused, and an answer cut off at the limit of its tokens, are no answer. */
export function readChatCompletion(provider: "mistral" | "openai", status: number, body: unknown): ProviderResult {
  if (status < 200 || status > 299) {
    return failed(provider === "openai" ? openaiFailure(status, body) : failureOfStatus(status));
  }
  const choices = record(body)?.choices;
  const choice = record(Array.isArray(choices) ? choices[0] : null);
  const message = record(choice?.message);
  if (choice === null || message === null) return failed("UNUSABLE");
  const refusal = message.refusal;
  if ((typeof refusal === "string" && refusal !== "") || choice.finish_reason === "content_filter") {
    return failed("DECLINED");
  }
  if (choice.finish_reason === "length") return failed("UNUSABLE");
  const content = writtenText(message.content);
  if (content === null || content.trim() === "") return failed("UNUSABLE");
  const { usage } = readChatAnswer(body);
  return {
    ok: true,
    content,
    usage: usage === null ? null : { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
}

// ───────────────────────── Anthropic: the Messages API ─────────────────────────

/** The beta under which Anthropic asks another model when the requested one declines a request for policy reasons
 *  (`fallbacks`). Without it a declined request simply stays declined. */
export const ANTHROPIC_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** The request to Anthropic, as the parameters of its client's `messages.create`. The client adds the address, the
 *  key and its own headers. */
export interface AnthropicParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user"; content: string }>;
  output_config: {
    effort: Exclude<Effort, "none">;
    format: { type: "json_schema"; schema: Record<string, unknown> };
  };
  /** With `fallbacks`: the beta it needs. The client sends it as a header. */
  betas?: string[];
  fallbacks?: "default";
}

/** A schema without the bounds on the length of its lists: Anthropic refuses `minItems` above 1 and every
 *  `maxItems` with a 400. Only the two keys of a list's own schema go; a property that happened to be called so
 *  would stay. */
export function withoutListBounds(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(withoutListBounds);
  const node = record(schema);
  if (node === null) return schema;
  const isList = node.type === "array";
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !(isList && (key === "minItems" || key === "maxItems")))
      .map(([key, value]) => [key, withoutListBounds(value)]),
  );
}

/** The request to Anthropic. The system prompt stands in its own field; no `temperature` and no `seed`, which the
 *  API refuses; no `thinking` field, so the model decides itself how much it thinks, held short by `effort`; and
 *  room for that thinking in `max_tokens`. */
export function anthropicParams(request: ModelRequest, model: ProviderModel<Exclude<Effort, "none">>): AnthropicParams {
  return {
    model: model.id,
    max_tokens: limit(request, model),
    system: request.system,
    messages: [{ role: "user", content: request.user }],
    output_config: {
      effort: model.effort,
      format: { type: "json_schema", schema: withoutListBounds(request.schema) as Record<string, unknown> },
    },
    ...(model.fallbacks ? { betas: [ANTHROPIC_FALLBACK_BETA], fallbacks: "default" as const } : {}),
  };
}

/** What Anthropic answered: the message its client returns, read without trusting its shape. How the message ended
 *  is read before anything it holds: a refusal (`stop_reason: "refusal"`, with status 200) is no answer, and
 *  neither is one that stopped for anything but its own end. The text is that of the message's text blocks; its
 *  thinking and the mark of a fallback are other blocks. What the call used is every attempt's, where another model
 *  answered after the first declined. */
export function readAnthropicMessage(message: unknown): ProviderResult {
  const answer = record(message);
  if (answer === null) return failed("UNUSABLE");
  if (answer.stop_reason === "refusal") return failed("DECLINED");
  if (answer.stop_reason !== "end_turn") return failed("UNUSABLE");
  const blocks = Array.isArray(answer.content) ? answer.content.map((block) => record(block)) : [];
  const content = blocks
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => String(block?.text))
    .join("");
  if (content.trim() === "") return failed("UNUSABLE");
  const usage = record(answer.usage);
  if (usage === null) return { ok: true, content, usage: null };
  const attempts = Array.isArray(usage.iterations) ? usage.iterations.map((entry) => record(entry)) : [];
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
  const sum = (field: "input_tokens" | "output_tokens") =>
    attempts.length === 0 ? count(usage[field]) : attempts.reduce((total, entry) => total + count(entry?.[field]), 0);
  return { ok: true, content, usage: { inputTokens: sum("input_tokens"), outputTokens: sum("output_tokens") } };
}
