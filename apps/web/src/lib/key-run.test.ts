// „Ordnen“ with the moderation's own key, as the browser runs it: the real run of @ideabeam/arrange against a
// `fetch` of the test that stands in for Mistral and OpenAI. What goes out is read whole (address, headers, body,
// what a browser would add), and every way a provider can fail is answered here. The answers of a model are those
// of the package's stand-in, which puts notes together that begin with the same word. Anthropic, which is asked
// through its own client, has key-anthropic.test.ts.
import { afterEach, describe, expect, test, vi } from "vitest";
import { fakeAsk, HEDGE_AFTER_MS, type ArrangeInput, type ModelRequest } from "@ideabeam/arrange";
import { CALL_LIMIT_MS, runWithKey } from "./key-run";

// A key of the test: no provider's, and recognisable wherever it turned up.
const KEY = "key-of-the-test-0123456789";
const id = (n: number) => n.toString(16).padStart(32, "0");
const INPUT: ArrangeInput = {
  question: "Was hält uns auf?",
  language: "de",
  notes: [
    "Termine kürzen",
    "Werkzeuge vereinheitlichen",
    "Termine ohne Ergebnis",
    "Werkzeuge erklären",
    "Termine bündeln",
    "Werkzeuge abschaffen",
  ].map((text, n) => ({ id: id(n + 1), text })),
};
const PROPOSAL = {
  groups: [
    { title: "Termine", noteIds: [id(1), id(3), id(5)] },
    { title: "Werkzeuge", noteIds: [id(2), id(4), id(6)] },
  ],
  loose: [],
};

type Sent = { url: string; init: RequestInit; body: Record<string, unknown> };
/** The question a chat completion's body asks, as the package's request, and the step of a run it belongs to: what
 *  the stand-in answers. */
function requestOf(body: Record<string, unknown>): { request: ModelRequest; step: "themes" | "assign" } {
  const [system, user] = body.messages as Array<{ content: string }>;
  const { schema } = (body.response_format as { json_schema: { schema: Record<string, unknown> } }).json_schema;
  const request = { system: system?.content ?? "", user: user?.content ?? "", schema, maxTokens: 0 };
  return { request, step: "themes" in (schema.properties as object) ? "themes" : "assign" };
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** What a provider's model answers to a body: the stand-in's answer in the shape of a chat completion. */
async function completion(body: Record<string, unknown>) {
  const { request, step } = requestOf(body);
  const { content } = await fakeAsk(request, step);
  return json(200, {
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  });
}

/** A `fetch` of the test: records what was sent and answers with `answer`. */
function provider(answer: (sent: Sent, n: number) => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetcher = vi.fn((url: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(url), init, body: JSON.parse(String(init.body)) as Record<string, unknown> };
    sent.push(call);
    return Promise.resolve(answer(call, sent.length));
  }) as unknown as typeof fetch;
  return { sent, fetcher };
}
const run = (name: "mistral" | "openai", fetcher: typeof fetch, signal = new AbortController().signal) =>
  runWithKey({ provider: name, key: KEY }, INPUT, signal, { fetch: fetcher });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a run with a key", () => {
  test.each([
    ["mistral", "https://api.eu.mistral.ai/v1/chat/completions", "mistral-small-2603"],
    ["openai", "https://api.openai.com/v1/chat/completions", "gpt-6-luna"],
  ] as const)("asks %s at its address with the key in one header, and gives the proposal", async (name, url, model) => {
    const { sent, fetcher } = provider(({ body }) => completion(body));
    const result = await run(name, fetcher);
    expect(result).toMatchObject({ ok: true, proposal: PROPOSAL, partial: false });
    // one call for the themes, one for the six notes
    expect(sent).toHaveLength(2);
    for (const { url: asked, init, body } of sent) {
      expect(asked).toBe(url);
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });
      // no cookie and no address of the page goes with it
      expect(init.credentials).toBe("omit");
      expect(init.referrerPolicy).toBe("no-referrer");
      expect(body.model).toBe(model);
      // the key is in the header alone
      expect(String(init.body)).not.toContain(KEY);
      expect(asked).not.toContain(KEY);
    }
    // the first call reads every note and asks for themes, the second assigns them
    expect(JSON.stringify(sent[0]?.body)).toContain("Which themes do these notes fall into?");
    expect(JSON.stringify(sent[0]?.body)).toContain("Termine ohne Ergebnis");
    expect(JSON.stringify(sent[1]?.body)).toContain("Assign every note");
    // what the provider counted is what the run used; no neurons: those are Cloudflare's
    expect(result.usage).toEqual({ calls: 2, failed: 0, hedged: 0, neurons: 0, inputTokens: 200, outputTokens: 40 });
  });

  test("asks another model where a measurement names one", async () => {
    const { sent, fetcher } = provider(({ body }) => completion(body));
    await runWithKey({ provider: "mistral", key: KEY }, INPUT, new AbortController().signal, {
      fetch: fetcher,
      model: "mistral-large-4",
    });
    expect(sent.map(({ body }) => body.model)).toEqual(["mistral-large-4", "mistral-large-4"]);
  });
});

describe("a run that gives no proposal", () => {
  test("ends at once on a key the provider refuses: one call, and no second try", async () => {
    const { sent, fetcher } = provider(() => json(401, { detail: "Invalid API Key" }));
    expect(await run("mistral", fetcher)).toMatchObject({ ok: false, why: "KEY_REFUSED" });
    expect(sent).toHaveLength(1);
  });

  test("ends at once on an account without credit, at OpenAI told from a rate limit by its code", async () => {
    const spent = { error: { message: "…", type: "insufficient_quota", code: "credit_balance_exhausted" } };
    const openai = provider(() => json(429, spent));
    expect(await run("openai", openai.fetcher)).toMatchObject({ ok: false, why: "NO_CREDIT" });
    expect(openai.sent).toHaveLength(1);
    const mistral = provider(() => json(402, { detail: "Payment required" }));
    expect(await run("mistral", mistral.fetcher)).toMatchObject({ ok: false, why: "NO_CREDIT" });
    expect(mistral.sent).toHaveLength(1);
  });

  test("ends at once on a request the provider does not take", async () => {
    const { sent, fetcher } = provider(() => json(404, { error: { code: "model_not_found" } }));
    expect(await run("openai", fetcher)).toMatchObject({ ok: false, why: "REJECTED" });
    expect(sent).toHaveLength(1);
  });

  test("tries a call once more on a rate limit, and says so when that fails too", async () => {
    const { sent, fetcher } = provider(() => json(429, { error: { type: "rate_limit_error", code: "slow_down" } }));
    expect(await run("openai", fetcher)).toMatchObject({ ok: false, why: "RATE_LIMITED" });
    expect(sent).toHaveLength(2);
  });

  test("takes a call that got no answer the script may read as a provider that cannot be reached", async () => {
    // what `fetch` does without a connection, and also when an error answer lacks the header that lets a page read it
    const fetcher = vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch;
    expect(await run("mistral", fetcher)).toMatchObject({ ok: false, why: "UNREACHABLE" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    // a provider that fails, with a body that is no JSON
    const failing = vi.fn(() => Promise.resolve(new Response("<html>502</html>", { status: 502 })));
    expect(await run("openai", failing as unknown as typeof fetch)).toMatchObject({ ok: false, why: "UNREACHABLE" });
  });

  test("says that a model refused to answer", async () => {
    const refusal = {
      choices: [{ message: { content: null, refusal: "I can’t help with that." }, finish_reason: "stop" }],
    };
    const { fetcher } = provider(() => json(200, refusal));
    expect(await run("openai", fetcher)).toMatchObject({ ok: false, why: "DECLINED" });
  });

  test("says that nothing could be made of the answers: cut off, no JSON, or themes that sort nothing", async () => {
    const answerOf = (content: string, finish = "stop") =>
      json(200, { choices: [{ message: { content }, finish_reason: finish }] });
    const cut = provider(() => answerOf('{"themes":[{"title":"Ter', "length"));
    expect(await run("mistral", cut.fetcher)).toMatchObject({ ok: false, why: "UNUSABLE" });
    // an answer that reads as JSON and names one theme: the run's own check refuses it, no call failed
    const one = provider(() => answerOf('{"themes":[{"title":"Alles","description":"Alles."}]}'));
    expect(await run("mistral", one.fetcher)).toMatchObject({ ok: false, why: "UNUSABLE" });
    expect(one.sent).toHaveLength(2);
  });

  test("never carries the key or a word of the provider: the result is one of the names", async () => {
    const { fetcher } = provider(() => json(401, { error: { message: `Incorrect API key provided: ${KEY}` } }));
    const result = await run("openai", fetcher);
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(result)).not.toContain("Incorrect");
  });
});

describe("a part of the notes without an answer", () => {
  test("lies without a group, and the proposal says that it is partial", async () => {
    // sixty notes: two batches, of fifty and of ten. The second batch's call fails every time
    const notes = Array.from({ length: 60 }, (_, n) => ({
      id: id(n + 1),
      text: `${n % 2 === 0 ? "Termine" : "Werkzeuge"} Nummer ${n + 1}`,
    }));
    const { sent, fetcher } = provider(({ body }) => {
      const { request, step } = requestOf(body);
      return step === "assign" && request.user.includes("Nummer 51") ? json(500, {}) : completion(body);
    });
    const input = { ...INPUT, notes };
    const result = await runWithKey({ provider: "mistral", key: KEY }, input, new AbortController().signal, {
      fetch: fetcher,
    });
    // the themes, the first batch, and the second batch twice
    expect(sent).toHaveLength(4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partial).toBe(true);
    expect(result.proposal.loose).toHaveLength(10);
    expect(result.proposal.groups.map((group) => group.noteIds.length)).toEqual([25, 25]);
  });
});

describe("ending a run", () => {
  test("ends the call that is out and makes no further one: the run rejects, and whoever ended it knows why", async () => {
    const stop = new AbortController();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_url: string | URL | Request, init: RequestInit = {}) => {
      if (init.signal) signals.push(init.signal);
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;
    const running = run("mistral", fetcher, stop.signal);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    stop.abort();
    await expect(running).rejects.toMatchObject({ name: "AbortError" });
    // the one call that was out was ended, and none followed it
    expect(signals.map((signal) => signal.aborted)).toEqual([true]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("a run that is ended before it began asks nobody", async () => {
    const stop = new AbortController();
    stop.abort();
    const { sent, fetcher } = provider(({ body }) => completion(body));
    await expect(run("openai", fetcher, stop.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(sent).toEqual([]);
  });
});

describe("a slow call", () => {
  test("is asked a second time beside itself after the Worker's times, and the first answer counts", async () => {
    vi.useFakeTimers();
    const sent: Array<{ at: number; step: string }> = [];
    const started = Date.now();
    const fetcher = vi.fn((_url: string | URL | Request, init: RequestInit = {}) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push({ at: Date.now() - started, step: requestOf(body).step });
      // the first call for the themes never answers by itself
      if (sent.length === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      return completion(body);
    }) as unknown as typeof fetch;
    const running = run("mistral", fetcher);
    await vi.advanceTimersByTimeAsync(HEDGE_AFTER_MS.themes - 1);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await running;
    expect(result).toMatchObject({ ok: true, proposal: PROPOSAL });
    expect(sent).toEqual([
      { at: 0, step: "themes" },
      { at: 15_000, step: "themes" },
      { at: 15_000, step: "assign" },
    ]);
    expect(result.usage).toMatchObject({ calls: 3, hedged: 1 });
  });

  test("ends after the time one call may take, and the run goes on to its second attempt", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const ended: boolean[] = [];
    const fetcher = vi.fn((_url: string | URL | Request, init: RequestInit = {}) => {
      const n = calls++;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          ended[n] = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;
    const running = run("openai", fetcher);
    // the first call and, from 15 seconds on, the one beside it; each ends after CALL_LIMIT_MS
    await vi.advanceTimersByTimeAsync(CALL_LIMIT_MS);
    expect(ended).toEqual([true]);
    await vi.advanceTimersByTimeAsync(HEDGE_AFTER_MS.themes);
    expect(ended).toEqual([true, true]);
    // the second attempt: two more calls, which end the same way; then the run says the provider did not answer
    await vi.advanceTimersByTimeAsync(CALL_LIMIT_MS + HEDGE_AFTER_MS.themes);
    expect(await running).toMatchObject({ ok: false, why: "UNREACHABLE" });
    expect(calls).toBe(4);
  });
});
