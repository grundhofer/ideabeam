// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  ANTHROPIC,
  ANTHROPIC_FALLBACK_BETA,
  anthropicParams,
  assignRequest,
  centsPerWall,
  ENDS_A_RUN,
  failureOfStatus,
  MISTRAL,
  mistralCall,
  modelOf,
  offered,
  OPENAI,
  openaiCall,
  providerOf,
  PROVIDERS,
  readAnthropicMessage,
  readChatCompletion,
  themesRequest,
  THINKING_RESERVE,
  withoutListBounds,
  type ArrangeNote,
  type Theme,
} from "../src/index.js";

// A key of the test: no provider's, and recognisable wherever it turned up.
const KEY = "key-of-the-test-0123456789";
const QUESTION = "What slows us down?";
const THEMES: Theme[] = [
  { title: "Meetings", description: "Too many, too long." },
  { title: "Tools", description: "What the tooling costs." },
];
const NOTES: ArrangeNote[] = ["Too many meetings", "The build is slow", "Meetings without an agenda"].map(
  (text, n) => ({ id: n.toString(16).padStart(32, "0"), text }),
);
/** A small assignment request: two themes, three notes. */
const ASSIGN = assignRequest(QUESTION, THEMES, NOTES);
const SYSTEM =
  "You sort sticky notes from a brainstorming board into themes. The notes are short and written in German or English. Answer with JSON only.";
const USER =
  'Board question: "What slows us down?"\n\n' +
  "Themes:\nA. Meetings: Too many, too long.\nB. Tools: What the tooling costs.\n\n" +
  "Sticky notes:\n1. Too many meetings\n2. The build is slow\n3. Meetings without an agenda\n\n" +
  "Assign every note to the one theme that fits it best. Answer as JSON: the note number as key, the theme letter as value. Write the JSON on a single line, without spaces or line breaks.";
const SCHEMA = {
  type: "object",
  properties: {
    "1": { type: "string", enum: ["A", "B"] },
    "2": { type: "string", enum: ["A", "B"] },
    "3": { type: "string", enum: ["A", "B"] },
  },
  required: ["1", "2", "3"],
  additionalProperties: false,
};

/** Every place of a value where a string stands, as one text. */
const everything = (value: unknown) => JSON.stringify(value);

describe("the list of providers", () => {
  it("is Mistral, OpenAI and Anthropic, each called at one address of its own origin", () => {
    expect(PROVIDERS.map((provider) => provider.id)).toEqual(["mistral", "openai", "anthropic"]);
    expect(PROVIDERS.map((provider) => provider.url)).toEqual([
      "https://api.eu.mistral.ai/v1/chat/completions",
      "https://api.openai.com/v1/chat/completions",
      "https://api.anthropic.com/v1/messages",
    ]);
    for (const provider of PROVIDERS) {
      expect(new URL(provider.url).origin, provider.id).toBe(provider.origin);
      expect(new URL(provider.keyPage).protocol, provider.id).toBe("https:");
      expect(
        provider.models.map((model) => model.id),
        provider.id,
      ).toContain(provider.model);
      expect(providerOf(provider.id)).toBe(provider);
    }
    expect(new Set(PROVIDERS.map((provider) => provider.keyEnv)).size).toBe(3);
  });

  it("names the models the reports name; Anthropic's is one value among three", () => {
    expect(PROVIDERS.map((provider) => provider.model)).toEqual([
      "mistral-small-2603",
      "gpt-6-luna",
      "claude-opus-5-5",
    ]);
    expect(ANTHROPIC.models.map((model) => model.id)).toEqual([
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
    ]);
    // Claude Haiku 5.5 has no fallback at Anthropic: a list of fallbacks would be refused there
    expect(ANTHROPIC.models.map((model) => model.fallbacks)).toEqual([true, true, false]);
  });

  it("offers nobody a provider whose model is not measured, unless the tab was told to", () => {
    // no model of the three is measured yet (PLAN.md 7.2, no. 20): this line changes with the first measurement
    expect(PROVIDERS.map((provider) => provider.measured)).toEqual([false, false, false]);
    expect(offered(false)).toEqual([]);
    expect(offered(true)).toEqual(PROVIDERS);
    const one = [{ ...MISTRAL, measured: true }, OPENAI];
    expect(offered(false, one).map((provider) => provider.id)).toEqual(["mistral"]);
    expect(offered(true, one).map((provider) => provider.id)).toEqual(["mistral", "openai"]);
  });

  it("gives a model's setting by its id, and a model it does not know the provider's own setting", () => {
    expect(modelOf(ANTHROPIC).id).toBe("claude-opus-5-5");
    expect(modelOf(ANTHROPIC, "  ").id).toBe("claude-opus-5-5");
    expect(modelOf(ANTHROPIC, "claude-haiku-5-5")).toMatchObject({ id: "claude-haiku-5-5", fallbacks: false });
    expect(modelOf(MISTRAL, "mistral-large-4")).toEqual({ ...modelOf(MISTRAL), id: "mistral-large-4" });
  });

  it("reckons a wall of 250 notes from the list prices: 15,000 tokens read, 1,500 written, 1,500 more thought", () => {
    const cents = (id: string, provider: typeof MISTRAL | typeof OPENAI | typeof ANTHROPIC) =>
      Math.round(centsPerWall(modelOf(provider, id)) * 1000) / 1000;
    expect(cents("mistral-small-2603", MISTRAL)).toBe(0.347);
    expect(cents("gpt-6-luna", OPENAI)).toBe(0.225);
    expect(cents("claude-opus-5-5", ANTHROPIC)).toBe(12);
    expect(cents("claude-sonnet-5-5", ANTHROPIC)).toBe(6);
    expect(cents("claude-haiku-5-5", ANTHROPIC)).toBe(0.3);
  });
});

describe("the request to Mistral", () => {
  it("is this address, these two headers and this body, exactly", () => {
    expect(mistralCall(ASSIGN, KEY, modelOf(MISTRAL))).toEqual({
      url: "https://api.eu.mistral.ai/v1/chat/completions",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: {
        model: "mistral-small-2603",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
        temperature: 0,
        max_tokens: 70,
        response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema: SCHEMA } },
        reasoning_effort: "none",
      },
    });
  });

  it("keeps the bounds of the themes' list in its schema", () => {
    const { body } = mistralCall(themesRequest(QUESTION, NOTES, "de"), KEY, modelOf(MISTRAL));
    expect(everything(body)).toContain('"minItems":2,"maxItems":2');
  });
});

describe("the request to OpenAI", () => {
  it("is this address, these two headers and this body, exactly", () => {
    expect(openaiCall(ASSIGN, KEY, modelOf(OPENAI))).toEqual({
      url: "https://api.openai.com/v1/chat/completions",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: {
        model: "gpt-6-luna",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
        reasoning_effort: "none",
        temperature: 0,
        seed: 1,
        max_completion_tokens: 70,
        response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema: SCHEMA } },
      },
    });
  });

  it("sends neither a temperature nor a seed once the model thinks, and leaves room for the thinking", () => {
    const thinking = { ...modelOf(OPENAI, "gpt-6.2-sol"), effort: "low" as const, thinks: true };
    const { body } = openaiCall(ASSIGN, KEY, thinking);
    expect(Object.keys(body).sort()).toEqual(
      ["max_completion_tokens", "messages", "model", "reasoning_effort", "response_format"].sort(),
    );
    expect(body).toMatchObject({ model: "gpt-6.2-sol", reasoning_effort: "low" });
    expect(body.max_completion_tokens).toBe(70 + THINKING_RESERVE);
    // never the name the model's limit had before
    expect(body).not.toHaveProperty("max_tokens");
  });
});

describe("the request to Anthropic", () => {
  it("is these parameters for its client, exactly: the system prompt on its own, no temperature, no seed", () => {
    expect(anthropicParams(ASSIGN, modelOf(ANTHROPIC))).toEqual({
      model: "claude-opus-5-5",
      max_tokens: 70 + THINKING_RESERVE,
      system: SYSTEM,
      messages: [{ role: "user", content: USER }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    expect(ANTHROPIC_FALLBACK_BETA).toBe("server-side-fallback-2026-07-01");
  });

  it("asks Claude Sonnet 5.5 the same way, and Claude Haiku 5.5 without a fallback", () => {
    const sonnet = anthropicParams(ASSIGN, modelOf(ANTHROPIC, "claude-sonnet-5-5"));
    expect(sonnet).toEqual({ ...anthropicParams(ASSIGN, modelOf(ANTHROPIC)), model: "claude-sonnet-5-5" });
    const haiku = anthropicParams(ASSIGN, modelOf(ANTHROPIC, "claude-haiku-5-5"));
    expect(Object.keys(haiku).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    expect(haiku.model).toBe("claude-haiku-5-5");
  });

  it("names nothing the API refuses: no sampling, no seed, no thinking switch, no name or strictness of the schema", () => {
    for (const model of ANTHROPIC.models) {
      const params = everything(anthropicParams(themesRequest(QUESTION, NOTES, "en"), model));
      for (const refused of ["temperature", "top_p", "top_k", "seed", "thinking", "strict", "response_format"]) {
        expect(params, `${model.id}: ${refused}`).not.toContain(`"${refused}"`);
      }
    }
  });

  it("sends the themes' schema without the bounds of its list, which the API refuses with a 400", () => {
    const request = themesRequest(QUESTION, NOTES, "de");
    // the request of the package asks for a number of themes ...
    expect(everything(request.schema)).toContain('"minItems":2,"maxItems":2');
    // ... and Anthropic gets the same schema without the two keys, and nothing else changed
    const { schema } = anthropicParams(request, modelOf(ANTHROPIC)).output_config.format;
    expect(everything(schema)).not.toMatch(/minItems|maxItems/);
    const themes = (request.schema.properties as { themes: Record<string, unknown> }).themes;
    const { minItems, maxItems, ...list } = themes;
    expect([minItems, maxItems]).toEqual([2, 2]);
    expect(schema).toEqual({ ...request.schema, properties: { themes: list } });
    // the request itself is not touched: the next provider still gets the bounds
    expect(everything(request.schema)).toContain('"minItems":2,"maxItems":2');
  });

  it("takes the bounds from a list's schema alone: a property that is called so stays", () => {
    const schema = {
      type: "object",
      properties: { minItems: { type: "string" }, list: { type: "array", minItems: 3, maxItems: 6, items: {} } },
      required: ["minItems", "list"],
    };
    expect(withoutListBounds(schema)).toEqual({
      type: "object",
      properties: { minItems: { type: "string" }, list: { type: "array", items: {} } },
      required: ["minItems", "list"],
    });
  });
});

describe("the key", () => {
  it("stands in the one header of a request and nowhere else: no address, no body", () => {
    for (const call of [mistralCall(ASSIGN, KEY, modelOf(MISTRAL)), openaiCall(ASSIGN, KEY, modelOf(OPENAI))]) {
      expect(call.headers.Authorization).toBe(`Bearer ${KEY}`);
      expect(call.url).not.toContain(KEY);
      expect(everything(call.body)).not.toContain(KEY);
      expect(Object.keys(call.headers)).toEqual(["Authorization", "Content-Type"]);
    }
  });
});

const chat = (message: Record<string, unknown>, finish = "stop") => ({
  choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: finish }],
  usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138 },
});

describe("an answer of Mistral or OpenAI", () => {
  it("is what the model wrote and the tokens the provider counted", () => {
    for (const provider of ["mistral", "openai"] as const) {
      expect(readChatCompletion(provider, 200, chat({ content: '{"1":"A"}' }))).toEqual({
        ok: true,
        content: '{"1":"A"}',
        usage: { inputTokens: 120, outputTokens: 18 },
      });
    }
  });

  it("is read from the parts of text where a model answers in parts, its thinking left out", () => {
    const parts = [
      { type: "thinking", thinking: [{ type: "text", text: "Meetings first." }] },
      { type: "text", text: '{"1":' },
      { type: "text", text: '"A"}' },
    ];
    expect(readChatCompletion("mistral", 200, chat({ content: parts }))).toMatchObject({ content: '{"1":"A"}' });
  });

  it("is none where the model refused, where it was cut off, and where nothing was written", () => {
    expect(readChatCompletion("openai", 200, chat({ content: null, refusal: "I can’t help with that." }))).toEqual({
      ok: false,
      why: "DECLINED",
    });
    expect(readChatCompletion("openai", 200, chat({ content: "" }, "content_filter"))).toEqual({
      ok: false,
      why: "DECLINED",
    });
    expect(readChatCompletion("mistral", 200, chat({ content: '{"1":"A","2":' }, "length"))).toEqual({
      ok: false,
      why: "UNUSABLE",
    });
    for (const body of [chat({ content: null }), chat({ content: "  " }), { choices: [] }, {}, null, "ok", []]) {
      expect(readChatCompletion("mistral", 200, body), everything(body)).toEqual({ ok: false, why: "UNUSABLE" });
    }
  });

  it("without the provider's count of tokens is an answer all the same", () => {
    const { choices } = chat({ content: "{}" });
    expect(readChatCompletion("openai", 200, { choices })).toEqual({ ok: true, content: "{}", usage: null });
  });
});

describe("a failure of Mistral or OpenAI", () => {
  it("is read from the status: the key, the credit, the rate, the request, the provider itself", () => {
    const by: Array<[number, string]> = [
      [401, "KEY_REFUSED"],
      [402, "NO_CREDIT"],
      [429, "RATE_LIMITED"],
      [503, "RATE_LIMITED"],
      [529, "RATE_LIMITED"],
      [400, "REJECTED"],
      [404, "REJECTED"],
      [413, "REJECTED"],
      [422, "REJECTED"],
      [408, "UNREACHABLE"],
      [500, "UNREACHABLE"],
      [502, "UNREACHABLE"],
      [504, "UNREACHABLE"],
    ];
    for (const [status, why] of by) {
      expect(failureOfStatus(status), String(status)).toBe(why);
      // Mistral's body is `{"detail": …}`: it tells nothing the status does not
      expect(readChatCompletion("mistral", status, { detail: "Invalid API Key" }), String(status)).toEqual({
        ok: false,
        why,
      });
      expect(readChatCompletion("openai", status, null), String(status)).toEqual({ ok: false, why });
    }
    expect(failureOfStatus(403)).toBe("KEY_REFUSED");
    expect(readChatCompletion("mistral", 403, null)).toEqual({ ok: false, why: "KEY_REFUSED" });
  });

  it("at OpenAI tells an account without credit from a rate limit by the code: both answer 429", () => {
    const error = (fields: Record<string, unknown>) => ({ error: { message: "…", param: null, ...fields } });
    for (const code of [
      "credit_balance_exhausted",
      "organization_spend_limit_exceeded",
      "project_spend_limit_exceeded",
      "organization_usage_limit_exceeded",
      "insufficient_quota",
    ]) {
      expect(readChatCompletion("openai", 429, error({ type: "invalid_request_error", code })), code).toEqual({
        ok: false,
        why: "NO_CREDIT",
      });
    }
    // the code may name the credit while the type is the broader one, or the other way round
    expect(readChatCompletion("openai", 429, error({ type: "insufficient_quota", code: null }))).toEqual({
      ok: false,
      why: "NO_CREDIT",
    });
    for (const code of ["rate_limit_exceeded", "slow_down", null]) {
      expect(readChatCompletion("openai", 429, error({ type: "rate_limit_error", code })), String(code)).toEqual({
        ok: false,
        why: "RATE_LIMITED",
      });
    }
    // the same words at Mistral say nothing: only the status is read there
    expect(readChatCompletion("mistral", 429, error({ code: "insufficient_quota" }))).toEqual({
      ok: false,
      why: "RATE_LIMITED",
    });
    // a wrong key, and a country OpenAI does not serve: there the key is not what is wrong
    expect(readChatCompletion("openai", 401, error({ code: "invalid_api_key" }))).toEqual({
      ok: false,
      why: "KEY_REFUSED",
    });
    expect(readChatCompletion("openai", 403, error({ code: "unsupported_country_region_territory" }))).toEqual({
      ok: false,
      why: "REJECTED",
    });
  });

  it("never carries a word of the provider's answer: a failure is one of seven names", () => {
    const secret = "sk-proj-SECRET in the provider's words";
    const result = readChatCompletion("openai", 401, { error: { message: `Incorrect API key provided: ${secret}` } });
    expect(everything(result)).toBe('{"ok":false,"why":"KEY_REFUSED"}');
  });

  it("ends a run where no further call can get past it: the key, the account, the request's shape", () => {
    expect([...ENDS_A_RUN].sort()).toEqual(["KEY_REFUSED", "NO_CREDIT", "REJECTED"]);
  });
});

const message = (fields: Record<string, unknown>) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text: '{"1":"A"}' }],
  stop_reason: "end_turn",
  stop_details: null,
  usage: { input_tokens: 140, output_tokens: 90, iterations: null },
  ...fields,
});

describe("an answer of Anthropic", () => {
  it("is the text of its text blocks, after its thinking, with the tokens the provider counted", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "…" },
      { type: "text", text: '{"1":"A",' },
      { type: "text", text: '"2":"B"}' },
    ];
    expect(readAnthropicMessage(message({ content }))).toEqual({
      ok: true,
      content: '{"1":"A","2":"B"}',
      usage: { inputTokens: 140, outputTokens: 90 },
    });
  });

  it("is none when the model refused, whatever the message holds: how it ended is read first", () => {
    const refused = { stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: null } };
    expect(readAnthropicMessage(message({ ...refused, content: [] }))).toEqual({ ok: false, why: "DECLINED" });
    // a refusal in the middle of an answer leaves a part of it behind: that is no answer either
    expect(readAnthropicMessage(message(refused))).toEqual({ ok: false, why: "DECLINED" });
    // the category is information, not the sign: a refusal without one is a refusal
    expect(readAnthropicMessage(message({ stop_reason: "refusal", stop_details: null }))).toEqual({
      ok: false,
      why: "DECLINED",
    });
  });

  it("is none when it stopped for anything but its own end, or wrote nothing", () => {
    for (const stop of ["max_tokens", "model_context_window_exceeded", "pause_turn", "tool_use", null, undefined]) {
      expect(readAnthropicMessage(message({ stop_reason: stop })), String(stop)).toEqual({
        ok: false,
        why: "UNUSABLE",
      });
    }
    const onlyThought = [{ type: "thinking", thinking: "", signature: "…" }];
    for (const content of [[], onlyThought, [{ type: "text", text: " " }], "text", null]) {
      expect(readAnthropicMessage(message({ content })), everything(content)).toEqual({ ok: false, why: "UNUSABLE" });
    }
    for (const none of [null, undefined, "", [], 3]) {
      expect(readAnthropicMessage(none)).toEqual({ ok: false, why: "UNUSABLE" });
    }
  });

  it("that another model gave after the first declined counts the tokens of both attempts", () => {
    const usage = {
      input_tokens: 150,
      output_tokens: 95,
      iterations: [
        { type: "message", model: "claude-opus-5-5", input_tokens: 140, output_tokens: 0 },
        { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 150, output_tokens: 95 },
      ],
    };
    const content = [
      { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-4-8" } },
      { type: "text", text: '{"1":"B"}' },
    ];
    expect(readAnthropicMessage(message({ content, usage, model: "claude-opus-4-8" }))).toEqual({
      ok: true,
      content: '{"1":"B"}',
      usage: { inputTokens: 290, outputTokens: 95 },
    });
  });

  it("without a count of tokens is an answer all the same", () => {
    expect(readAnthropicMessage(message({ usage: undefined }))).toEqual({
      ok: true,
      content: '{"1":"A"}',
      usage: null,
    });
  });
});
