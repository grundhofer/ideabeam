// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Hono, type Context, type Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  adminTokenSchema,
  arrangeLanguageSchema,
  arrangeRequestSchema,
  createWallRequestSchema,
  EXPORT_SESSION_SCHEME,
  PROTOCOL_VERSION,
  sessionKeySchema,
  type BudgetSpent,
  type CreateWallResponse,
  type ExportError,
} from "@ideabeam/shared";
import { proposeFor, refusal } from "./arrange.js";
import { generateSecret } from "./ids.js";
import { dailyWalls, WALL_BUDGET_KEY } from "./rate-limiter.js";
import { limiterStub, newWall, wallStub } from "./wall-stub.js";

export { RateLimiter } from "./rate-limiter.js";
export { WallRoom } from "./wall-room.js";

const app = new Hono<{ Bindings: Env }>();

// API responses are data, never pages. robots.txt keeps crawlers off /api/, but that stops fetching, not indexing
// a URL somebody linked, and a wall's address is its capability. The asset layer's header rules cannot reach these:
// /api/* runs the Worker first. A WebSocket upgrade (101) is left alone — that response comes from the Durable
// Object and cannot be re-wrapped without losing the socket.
app.use("/api/*", async (c, next) => {
  await next();
  if (c.res.status !== 101) c.header("X-Robots-Tag", "noindex");
});

// Says that the Worker runs and which protocol it speaks.
app.get("/api/health", (c) => c.json({ ok: true, protocolVersion: PROTOCOL_VERSION }));

// Making a wall is unauthenticated and each call makes a Durable Object with storage and an alarm. The free-tier
// allowance is account-wide and shared with RetroBeam and FokusBeam, so one unthrottled script takes all three
// products offline until midnight UTC. Keyed on the client IP, which is all a product without accounts has.
//
// TWO layers, and only the second is a guarantee:
//
//  1. The platform binding, best effort. Its counters are per-machine and
//     reconciled in the background, so on a low-traffic Worker it admits
//     everything. It costs nothing and does shed load once traffic is high
//     enough to be worth shedding, so it runs first and saves a Durable Object
//     request when it fires — but nothing may depend on it.
//  2. The RateLimiter Durable Object, authoritative. One instance,
//     single-threaded, so its count is exact. Costs one DO request per attempt
//     — cheap next to the object a create would otherwise make.
const CREATE_BURST = 10;
const CREATE_PER_SEC = 10 / 60; // ten a minute sustained

function createLimit() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const key = c.req.header("cf-connecting-ip") ?? "unknown";
    const cheap = await c.env.CREATE_LIMITER.limit({ key });
    if (!cheap.success) {
      return c.json({ error: "RATE_LIMITED" }, 429, { "retry-after": "60" });
    }
    const decision = await limiterStub(c.env).take(`create:${key}`, CREATE_BURST, CREATE_PER_SEC);
    if (!decision.allowed) {
      return c.json({ error: "RATE_LIMITED" }, 429, { "retry-after": String(decision.retryAfter) });
    }
    await next();
  };
}

// The body is one short field; nothing legitimate is large.
const smallBody = bodyLimit({
  maxSize: 4 * 1024,
  onError: (c) => c.json({ error: "PAYLOAD_TOO_LARGE" }, 413),
});

// A new wall. The answer carries its two capabilities: the wall's id, which is its address and lets anyone in, and
// the admin token, which stays in the creating browser. The wall starts with hidden writing unless the request says
// `hidden: false` (PLAN.md 2.1).
app.post("/api/walls", smallBody, createLimit(), async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = createWallRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "INVALID_REQUEST" }, 400);
  }
  // The day's walls (PLAN.md 3.6): every wall is an object that writes rows, and the allowance for rows is the
  // account's. A wall that is made takes one of the day's; when they are spent, none is made until 00:00 UTC, and
  // the answer says so and when. Asked last, so a request that makes no wall takes none.
  const budget = await limiterStub(c.env).spendDaily(WALL_BUDGET_KEY, dailyWalls(c.env));
  if (!budget.granted) {
    const wait = Math.max(1, Math.ceil((budget.resetsAt - Date.now()) / 1000));
    return c.json({ error: "BUDGET_SPENT", resetsAt: budget.resetsAt } satisfies BudgetSpent, 429, {
      "retry-after": String(wait),
    });
  }
  const { wallId, stub } = newWall(c.env);
  const adminToken = generateSecret();
  await stub.initialize({ wallId, question: parsed.data.question, adminToken, hidden: parsed.data.hidden });
  return c.json({ wallId, adminToken } satisfies CreateWallResponse);
});

// The wall's question, for the view that asks a newcomer for their name. An id the namespace did not make is
// refused here, without waking any object; a wall that was deleted answers the same 404 from its (then empty)
// object.
app.get("/api/walls/:id", async (c) => {
  const wall = await wallStub(c.env, c.req.param("id"))?.info();
  if (!wall) {
    return c.json({ error: "WALL_NOT_FOUND" }, 404);
  }
  return c.json({ wall });
});

app.get("/api/walls/:id/ws", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.json({ error: "EXPECTED_WEBSOCKET" }, 426);
  }
  const stub = wallStub(c.env, c.req.param("id"));
  if (stub === null) {
    return c.json({ error: "WALL_NOT_FOUND" }, 404);
  }
  // Forwarded to the object, which finishes the upgrade, or answers 404 for a wall that was deleted.
  return stub.fetch(c.req.raw);
});

// „Ordnen“: a proposal for the wall's notes, worked out by Workers AI (PLAN.md 4.3, src/arrange.ts). Only for the
// wall's moderation: the admin token travels in the `Authorization` header (`Bearer <token>`), never in the address,
// which ends up in logs and histories. The body says which language the titles are to be written in and nothing
// else: the notes are read from the wall, and a body that brings anything more is refused. Nothing is stored but
// the count of what the run spent; the proposal is on no wall until the moderation applies it over its socket.
app.post("/api/walls/:id/arrange", smallBody, async (c) => {
  const answer = (outcome: Awaited<ReturnType<typeof proposeFor>>) => {
    const resetsAt = "resetsAt" in outcome.body ? outcome.body.resetsAt : undefined;
    const wait = resetsAt === undefined ? null : Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000));
    return Response.json(outcome.body, {
      status: outcome.status,
      headers: wait === null ? {} : { "retry-after": String(wait) },
    });
  };
  const wallId = c.req.param("id");
  const stub = wallStub(c.env, wallId);
  if (stub === null) return answer(refusal({ error: "WALL_NOT_FOUND" }));
  const token = adminTokenSchema.safeParse(/^Bearer (.+)$/.exec(c.req.header("authorization") ?? "")?.[1]);
  if (!token.success) return answer(refusal({ error: "NOT_ADMIN" }));
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = arrangeRequestSchema.safeParse(body);
  if (!parsed.success) return answer(refusal({ error: "INVALID_REQUEST" }));
  return answer(await proposeFor(c.env, wallId, stub, token.data, parsed.data.language));
});

// The wall as Markdown (PLAN.md 3.2), through the same filter as the person's snapshot: the wall's object decides
// (WallRoom.exportFor()). Who asks is said by the session key their browser joined with, in the `Authorization`
// header (`Session <key>`), never in the address; `lang` names the language of the file's fixed words. Nothing is
// written. The file is an attachment with a safe name, never cached, never indexed.
app.get("/api/walls/:id/export", async (c) => {
  const stub = wallStub(c.env, c.req.param("id"));
  if (stub === null) return c.json({ error: "WALL_NOT_FOUND" } satisfies ExportError, 404);
  const scheme = new RegExp(`^${EXPORT_SESSION_SCHEME} (.+)$`);
  const key = sessionKeySchema.safeParse(scheme.exec(c.req.header("authorization") ?? "")?.[1]);
  if (!key.success) return c.json({ error: "NOT_ON_WALL" } satisfies ExportError, 401);
  const language = arrangeLanguageSchema.safeParse(c.req.query("lang"));
  if (!language.success) return c.json({ error: "INVALID_REQUEST" } satisfies ExportError, 400);
  const made = await stub.exportFor(key.data, language.data);
  if (made.kind === "missing") return c.json({ error: "WALL_NOT_FOUND" } satisfies ExportError, 404);
  if (made.kind === "refused") return c.json({ error: "NOT_ON_WALL" } satisfies ExportError, 401);
  return new Response(made.text, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      // the name is ASCII letters, digits and hyphens (exportFileName): it needs no quoting beyond the quotes
      "content-disposition": `attachment; filename="${made.fileName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
});

app.notFound((c) => c.json({ error: "NOT_FOUND" }, 404));

export default app;
