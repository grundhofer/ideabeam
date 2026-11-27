import { afterEach, expect, test, vi } from "vitest";
import { createWall, exportWall, findWall, proposeArrangement } from "./api";

const WALL = "ab".repeat(32);
const TOKEN = "cd".repeat(16);

/** The Worker's answer to the next request. */
function answer(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

afterEach(() => vi.restoreAllMocks());

test("a new wall comes back with its id and the admin token", async () => {
  const fetched = answer(200, { wallId: WALL, adminToken: TOKEN });
  expect(await createWall("Was hält uns auf?", "still-sammeln")).toEqual({
    ok: true,
    wall: { wallId: WALL, adminToken: TOKEN },
  });
  const [url, init] = fetched.mock.calls[0] ?? [];
  expect(url).toBe("/api/walls");
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({
    question: "Was hält uns auf?",
    agenda: { items: [{ methodId: "still-sammeln" }] },
  });
  // the method is asked for by its id: a wall without hidden writing is a „Freie Wand“
  await createWall("Was hält uns auf?", "free");
  expect(JSON.parse(String(fetched.mock.calls[1]?.[1]?.body))).toEqual({
    question: "Was hält uns auf?",
    agenda: { items: [{ methodId: "free" }] },
  });
});

test("too many walls from one address is its own answer; everything else is a failure", async () => {
  answer(429, { error: "RATE_LIMITED" });
  expect(await createWall("x", "still-sammeln")).toEqual({ ok: false, why: "limited" });
  // the day's walls are taken: the same status, and the time it goes on
  answer(429, { error: "BUDGET_SPENT", resetsAt: 1_795_392_000_000 });
  expect(await createWall("x", "still-sammeln")).toEqual({ ok: false, why: "spent", resetsAt: 1_795_392_000_000 });
  answer(500, {});
  expect(await createWall("x", "still-sammeln")).toEqual({ ok: false, why: "failed" });
  // an answer of another shape is no wall
  answer(200, { wallId: "short", adminToken: TOKEN });
  expect(await createWall("x", "still-sammeln")).toEqual({ ok: false, why: "failed" });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  expect(await createWall("x", "still-sammeln")).toEqual({ ok: false, why: "failed" });
});

test("a wall is found by its id, and a wall that is not there is told from a request that failed", async () => {
  const wall = { id: WALL, question: "Was hält uns auf?", createdAt: 1_795_300_000_000 };
  const fetched = answer(200, { wall });
  expect(await findWall(WALL)).toEqual({ ok: true, wall });
  expect(fetched.mock.calls[0]?.[0]).toBe(`/api/walls/${WALL}`);

  answer(404, { error: "WALL_NOT_FOUND" });
  expect(await findWall(WALL)).toEqual({ ok: false, why: "unknown" });
  answer(503, {});
  expect(await findWall(WALL)).toEqual({ ok: false, why: "failed" });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  expect(await findWall(WALL)).toEqual({ ok: false, why: "failed" });
});

const NOTE = "ef".repeat(16);
const PROPOSAL = {
  proposal: { groups: [{ title: "Termine", noteIds: [NOTE] }], loose: [] },
  cost: { neurons: 12.5, calls: 3, inputTokens: 900, outputTokens: 120 },
  partial: false,
  runsLeft: 5,
  model: "stand-in",
};

test("„Ordnen“ asks with the admin token in the header and the language alone as the body", async () => {
  const fetched = answer(200, PROPOSAL);
  expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({ ok: true, answer: PROPOSAL });
  const [url, init] = fetched.mock.calls[0] ?? [];
  expect(url).toBe(`/api/walls/${WALL}/arrange`);
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
  // no note's text leaves the browser: the Worker reads the notes from the wall
  expect(JSON.parse(String(init?.body))).toEqual({ language: "de" });
});

test("every reason of the route comes back as itself, with the time a budget fills again and the notes it takes", async () => {
  answer(409, { error: "NOTHING_TO_ARRANGE", notes: 3, min: 6 });
  expect(await proposeArrangement(WALL, TOKEN, "en")).toEqual({ ok: false, why: "NOTHING_TO_ARRANGE", min: 6 });
  answer(429, { error: "AI_BUDGET_SPENT", resetsAt: 1_795_392_000_000 });
  expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({
    ok: false,
    why: "AI_BUDGET_SPENT",
    resetsAt: 1_795_392_000_000,
  });
  // Cloudflare's own refusal: the same reason, and no time, which nobody knows
  answer(429, { error: "AI_BUDGET_SPENT" });
  expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({ ok: false, why: "AI_BUDGET_SPENT" });
  answer(429, { error: "WALL_RUNS_SPENT", resetsAt: 1_795_392_000_000 });
  expect(await proposeArrangement(WALL, TOKEN, "de")).toMatchObject({ ok: false, why: "WALL_RUNS_SPENT" });
  for (const [status, error] of [
    [404, "WALL_NOT_FOUND"],
    [401, "NOT_ADMIN"],
    [400, "INVALID_REQUEST"],
    [409, "PHASE"],
    [502, "AI_FAILED"],
    [503, "AI_UNAVAILABLE"],
  ] as const) {
    answer(status, { error });
    expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({ ok: false, why: error });
  }
});

test("an answer that is none of the route's is told from a request that got none", async () => {
  // a body the Worker found too large, a status of the host, a proposal of another shape, no JSON at all
  answer(413, { error: "PAYLOAD_TOO_LARGE" });
  expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({ ok: false, why: "UNKNOWN" });
  answer(500, {});
  expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({ ok: false, why: "UNKNOWN" });
  answer(200, { proposal: { groups: [{ title: "Termine", noteIds: [] }], loose: [] } });
  expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({ ok: false, why: "UNKNOWN" });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>", { status: 502 }));
  expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({ ok: false, why: "UNKNOWN" });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  expect(await proposeArrangement(WALL, TOKEN, "de")).toEqual({ ok: false, why: "NETWORK" });
});

test("waiting that was ended on purpose is no failure of the network: the request rejects", async () => {
  const waiting = new AbortController();
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  const asked = proposeArrangement(WALL, TOKEN, "de", waiting.signal);
  waiting.abort();
  await expect(asked).rejects.toThrow("aborted");
});

test("the wall as a file: asked with the session key in a header, never in the address; the name from the answer", async () => {
  const KEY = "12".repeat(16);
  const fetched = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("# Was hält uns auf?\n", {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": 'attachment; filename="Was-haelt-uns-auf-2026-11-25.md"',
      },
    }),
  );
  expect(await exportWall(WALL, KEY, "en")).toEqual({
    ok: true,
    text: "# Was hält uns auf?\n",
    fileName: "Was-haelt-uns-auf-2026-11-25.md",
  });
  const [url, init] = fetched.mock.calls[0] ?? [];
  expect(url).toBe(`/api/walls/${WALL}/export?lang=en`);
  expect(String(url)).not.toContain(KEY);
  expect(new Headers(init?.headers).get("authorization")).toBe(`Session ${KEY}`);
});

test("the wall as a file: a wall that is gone, a browser that is nobody on it, and everything else", async () => {
  const KEY = "12".repeat(16);
  answer(404, { error: "WALL_NOT_FOUND" });
  expect(await exportWall(WALL, KEY, "de")).toEqual({ ok: false, why: "unknown" });
  answer(401, { error: "NOT_ON_WALL" });
  expect(await exportWall(WALL, KEY, "de")).toEqual({ ok: false, why: "stranger" });
  answer(500, {});
  expect(await exportWall(WALL, KEY, "de")).toEqual({ ok: false, why: "failed" });
  // an answer without a safe name is none of the route's
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("x", { status: 200, headers: { "content-disposition": 'attachment; filename="../x.md"' } }),
  );
  expect(await exportWall(WALL, KEY, "de")).toEqual({ ok: false, why: "failed" });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  expect(await exportWall(WALL, KEY, "de")).toEqual({ ok: false, why: "failed" });
});
