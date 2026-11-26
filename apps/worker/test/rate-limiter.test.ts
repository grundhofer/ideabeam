// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateSecret, safeEqual } from "../src/ids.js";
import { limiterStub } from "../src/wall-stub.js";

// Cloudflare's Rate Limiting binding is documented as permissive and eventually
// consistent, and in production it admitted 50 creation requests from one
// address in a few seconds (RetroBeam). These tests are about the replacement,
// which counts exactly because a Durable Object is single-threaded. The route
// that uses it is tested in http.test.ts.

describe("RateLimiter", () => {
  it("admits the burst, refuses the rest, and says when to come back", async () => {
    const limiter = limiterStub(env);
    const key = `burst-${crypto.randomUUID()}`;
    const results = [];
    for (let i = 0; i < 14; i++) {
      results.push(await limiter.take(key, 10, 10 / 60));
    }
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(results.filter((r) => !r.allowed)).toHaveLength(4);
    // A refusal has to tell the caller something actionable.
    for (const refused of results.filter((r) => !r.allowed)) {
      expect(refused.retryAfter).toBeGreaterThan(0);
    }
  });

  it("counts each key separately", async () => {
    const limiter = limiterStub(env);
    const mine = `a-${crypto.randomUUID()}`;
    const theirs = `b-${crypto.randomUUID()}`;
    for (let i = 0; i < 10; i++) await limiter.take(mine, 10, 10 / 60);
    expect((await limiter.take(mine, 10, 10 / 60)).allowed).toBe(false);
    // One abusive address must not lock everyone else out.
    expect((await limiter.take(theirs, 10, 10 / 60)).allowed).toBe(true);
  });

  it("refills over time", async () => {
    const limiter = limiterStub(env);
    const key = `refill-${crypto.randomUUID()}`;
    // The clock is the test's: on a busy machine the four takes below could
    // span more than the 50 ms one token takes to come back at 20 per second.
    const start = Date.now();
    for (let i = 0; i < 3; i++) await limiter.take(key, 3, 20, start);
    expect((await limiter.take(key, 3, 20, start)).allowed).toBe(false);
    expect((await limiter.take(key, 3, 20, start + 40)).allowed).toBe(false);
    expect((await limiter.take(key, 3, 20, start + 150)).allowed).toBe(true);
  });
});

describe("capability secrets", () => {
  it("are 128 bits of hex and never the same twice", () => {
    const a = generateSecret();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(generateSecret());
  });

  it("compare in constant time, by value and by length", () => {
    const secret = generateSecret();
    expect(safeEqual(secret, secret)).toBe(true);
    expect(safeEqual(secret, generateSecret())).toBe(false);
    expect(safeEqual(secret, secret.slice(1))).toBe(false);
  });
});
