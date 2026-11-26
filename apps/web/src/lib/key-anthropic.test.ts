// Asking Anthropic with the moderation's own key: Anthropic's real client against a `fetch` of the test. What the
// client sends is read whole and pinned: the address, every header (the key's value masked, never printed), the
// body. And every way a call can end without an answer goes through the client's own error classes.
import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ANTHROPIC, assignRequest, themesRequest, THINKING_RESERVE, type ArrangeNote } from "@ideabeam/arrange";
import { anthropicCaller, anthropicFailure } from "./key-anthropic";
import { runWithKey } from "./key-run";

// A key of the test: no provider's, and recognisable wherever it turned up.
const KEY = "key-of-the-test-0123456789";
const NOTES: ArrangeNote[] = ["Too many meetings", "The build is slow", "Meetings without an agenda"].map(
  (text, n) => ({ id: n.toString(16).padStart(32, "0"), text }),
);
const THEMES = [
  { title: "Meetings", description: "Too many, too long." },
  { title: "Tools", description: "What the tooling costs." },
];
const ASSIGN = assignRequest("What slows us down?", THEMES, NOTES);

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const message = (fields: Record<string, unknown> = {}) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text: '{"1":"A","2":"B","3":"A"}' }],
  stop_reason: "end_turn",
  stop_details: null,
  usage: { input_tokens: 140, output_tokens: 60, iterations: null },
  ...fields,
});
const failure = (type: string, details?: Record<string, unknown>) => ({
  type: "error",
  error: { type, message: `words of the provider that quote ${KEY}`, ...(details ? { details } : {}) },
  request_id: "req_1",
});

type Sent = {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
  init: RequestInit;
};
/** A `fetch` of the test: records what the client sent and answers with `answer`. */
function anthropic(answer: (sent: Sent) => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetcher = vi.fn((url: string | URL | Request, init: RequestInit = {}) => {
    const call = {
      url: String(url),
      method: init.method,
      headers: Object.fromEntries(new Headers(init.headers)),
      body: JSON.parse(String(init.body)) as unknown,
      init,
    };
    sent.push(call);
    return Promise.resolve(answer(call));
  }) as unknown as typeof fetch;
  return { sent, fetcher };
}
const live = () => new AbortController().signal;

afterEach(() => vi.restoreAllMocks());

describe("the request to Anthropic, as its client sends it", () => {
  test("goes to this address with these headers and this body, exactly", async () => {
    const { sent, fetcher } = anthropic(() => json(200, message()));
    const result = await anthropicCaller(KEY, undefined, fetcher)(ASSIGN, live());
    expect(result).toEqual({
      ok: true,
      content: '{"1":"A","2":"B","3":"A"}',
      usage: { inputTokens: 140, outputTokens: 60 },
    });
    expect(sent).toHaveLength(1);
    const [{ url, method, headers, body, init } = {} as Sent] = sent;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(method).toBe("POST");
    // The key goes out in one header. Its value is checked and then masked: the list below never holds it
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
    const said: Record<string, string> = { ...headers, authorization: "Bearer <key>" };
    // what the client says about the machine it runs on differs from machine to machine: named here, not pinned
    const ofTheMachine = [
      "user-agent",
      "x-stainless-arch",
      "x-stainless-os",
      "x-stainless-runtime",
      "x-stainless-runtime-version",
    ];
    for (const name of ofTheMachine) {
      expect(said[name], name).toEqual(expect.any(String));
      delete said[name];
    }
    expect(said).toEqual({
      accept: "application/json",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      // the header without which Anthropic's API refuses a call from a page
      "anthropic-dangerous-direct-browser-access": "true",
      "anthropic-version": "2026-10-21",
      authorization: "Bearer <key>",
      "content-type": "application/json",
      "x-stainless-lang": "js",
      "x-stainless-package-version": "1.13.0",
      // one attempt, which may take a minute: the run repeats a call itself
      "x-stainless-retry-count": "0",
      "x-stainless-timeout": "60",
    });
    expect(body).toEqual({
      model: "claude-opus-5-5",
      max_tokens: 70 + THINKING_RESERVE,
      system:
        "You sort sticky notes from a brainstorming board into themes. The notes are short and written in German or English. Answer with JSON only.",
      messages: [
        {
          role: "user",
          content:
            'Board question: "What slows us down?"\n\n' +
            "Themes:\nA. Meetings: Too many, too long.\nB. Tools: What the tooling costs.\n\n" +
            "Sticky notes:\n1. Too many meetings\n2. The build is slow\n3. Meetings without an agenda\n\n" +
            "Assign every note to the one theme that fits it best. Answer as JSON: the note number as key, the theme letter as value. Write the JSON on a single line, without spaces or line breaks.",
        },
      ],
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              "1": { type: "string", enum: ["A", "B"] },
              "2": { type: "string", enum: ["A", "B"] },
              "3": { type: "string", enum: ["A", "B"] },
            },
            required: ["1", "2", "3"],
            additionalProperties: false,
          },
        },
      },
      fallbacks: "default",
    });
    // the key is in that one header and nowhere else, and neither a cookie nor the page's address goes with the call
    expect(JSON.stringify({ url, body, said })).not.toContain(KEY);
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
  });

  test("asks Claude Haiku 5.5, which has no fallback, the plain way: no beta, no `fallbacks`", async () => {
    const { sent, fetcher } = anthropic(() => json(200, message({ model: "claude-haiku-5-5" })));
    await anthropicCaller(KEY, "claude-haiku-5-5", fetcher)(ASSIGN, live());
    const [{ url, headers, body } = {} as Sent] = sent;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers).not.toHaveProperty("anthropic-beta");
    expect(Object.keys(body as object).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    expect(body).toMatchObject({ model: "claude-haiku-5-5" });
  });

  test("sends the themes' schema without the bounds of its list, for every model of the list", async () => {
    for (const model of ANTHROPIC.models) {
      const { sent, fetcher } = anthropic(() => json(200, message()));
      await anthropicCaller(KEY, model.id, fetcher)(themesRequest("What slows us down?", NOTES, "en"), live());
      const text = JSON.stringify(sent[0]?.body);
      expect(text, model.id).toContain('"themes":{"type":"array"');
      expect(text, model.id).not.toMatch(/minItems|maxItems|temperature|"seed"|"thinking"/);
    }
  });
});

describe("an answer of Anthropic that is none", () => {
  test("a refusal comes with status 200: it is read from how the message ended, before its content", async () => {
    const refused = message({
      content: [{ type: "text", text: '{"1":"A"' }],
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: null },
    });
    const { fetcher } = anthropic(() => json(200, refused));
    expect(await anthropicCaller(KEY, undefined, fetcher)(ASSIGN, live())).toEqual({ ok: false, why: "DECLINED" });
  });

  test("an answer cut off at the limit of its tokens is none", async () => {
    const { fetcher } = anthropic(() => json(200, message({ stop_reason: "max_tokens" })));
    expect(await anthropicCaller(KEY, undefined, fetcher)(ASSIGN, live())).toEqual({ ok: false, why: "UNUSABLE" });
  });
});

describe("a failure of Anthropic", () => {
  const cases: Array<[string, Response | Error, string]> = [
    ["a key it does not take", json(401, failure("authentication_error")), "KEY_REFUSED"],
    ["a key without the right", json(403, failure("permission_error")), "KEY_REFUSED"],
    ["an account without credit", json(402, failure("billing_error")), "NO_CREDIT"],
    [
      "the monthly limit of what the account may spend, answered as a rate limit",
      json(429, failure("rate_limit_error", { error_code: "enforced_spend_limit_reached" })),
      "NO_CREDIT",
    ],
    [
      "the spend limit of a contract",
      json(429, failure("rate_limit_error", { error_code: "contract_spend_limit_reached" })),
      "NO_CREDIT",
    ],
    ["a rate limit", json(429, failure("rate_limit_error"), { "retry-after": "7" }), "RATE_LIMITED"],
    [
      "a limit on how fast usage may grow",
      json(429, failure("rate_limit_error", { error_code: "ramp_limit_exceeded" })),
      "RATE_LIMITED",
    ],
    ["an overloaded API", json(529, failure("overloaded_error")), "RATE_LIMITED"],
    ["a service that is not available", json(503, failure("api_error")), "RATE_LIMITED"],
    ["a request it refuses", json(400, failure("invalid_request_error")), "REJECTED"],
    ["a model it does not know", json(404, failure("not_found_error")), "REJECTED"],
    ["a failure of its own", json(500, failure("api_error")), "UNREACHABLE"],
    ["no connection", new TypeError("Failed to fetch"), "UNREACHABLE"],
  ];
  test.each(cases)("%s", async (_what, answer, why) => {
    const fetcher = vi.fn(() =>
      answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer.clone()),
    ) as unknown as typeof fetch;
    const result = await anthropicCaller(KEY, undefined, fetcher)(ASSIGN, live());
    expect(result).toEqual({ ok: false, why });
    // one attempt: the client repeats nothing by itself, the run does
    expect(fetcher).toHaveBeenCalledTimes(1);
    // nothing of the provider's words, which may quote what was sent, and nothing of the key
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  test("is read from the class of the client's error, most specific first", () => {
    const headers = new Headers();
    const thrown = (status: number, type: string) =>
      Anthropic.APIError.generate(status, failure(type), undefined, headers);
    expect(anthropicFailure(thrown(401, "authentication_error"))).toBe("KEY_REFUSED");
    expect(anthropicFailure(thrown(402, "billing_error"))).toBe("NO_CREDIT");
    expect(anthropicFailure(thrown(422, "invalid_request_error"))).toBe("REJECTED");
    expect(anthropicFailure(new Anthropic.APIConnectionTimeoutError())).toBe("UNREACHABLE");
    // not the provider's doing
    expect(anthropicFailure(new TypeError("a fault of the app"))).toBe("UNUSABLE");
    // a call the run itself ended is no failure of the provider: it is thrown on
    expect(() => anthropicFailure(new Anthropic.APIUserAbortError())).toThrow(Anthropic.APIUserAbortError);
  });
});

describe("a whole run at Anthropic", () => {
  test("ends at once on a refused key, and says that the key was refused", async () => {
    const { sent, fetcher } = anthropic(() => json(401, failure("authentication_error")));
    const notes = Array.from({ length: 6 }, (_, n) => ({ id: String(n), text: `Termine ${n}` }));
    const run = await runWithKey(
      { provider: "anthropic", key: KEY },
      { question: "Was hält uns auf?", language: "de", notes },
      live(),
      { fetch: fetcher },
    );
    expect(run).toMatchObject({ ok: false, why: "KEY_REFUSED" });
    expect(sent).toHaveLength(1);
  });

  test("says so when Anthropic's client, a part of the app of its own, does not load", async () => {
    vi.resetModules();
    vi.doMock("./key-anthropic", () => {
      throw new Error("the file was not fetched");
    });
    const { runWithKey: run } = await import("./key-run");
    const { sent, fetcher } = anthropic(() => json(200, message()));
    const notes = Array.from({ length: 6 }, (_, n) => ({ id: String(n), text: `Termine ${n}` }));
    const input = { question: "Was hält uns auf?", language: "de" as const, notes };
    expect(await run({ provider: "anthropic", key: KEY }, input, live(), { fetch: fetcher })).toMatchObject({
      ok: false,
      why: "LOAD",
    });
    expect(sent).toEqual([]);
    vi.doUnmock("./key-anthropic");
    vi.resetModules();
  });

  test("ending the run ends the client's call, and no answer is made of it", async () => {
    const stop = new AbortController();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_url: string | URL | Request, init: RequestInit = {}) => {
      if (init.signal) signals.push(init.signal);
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;
    const call = anthropicCaller(KEY, undefined, fetcher)(ASSIGN, stop.signal);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    stop.abort();
    await expect(call).rejects.toBeInstanceOf(Anthropic.APIUserAbortError);
    expect(signals.map((signal) => signal.aborted)).toEqual([true]);
  });
});
