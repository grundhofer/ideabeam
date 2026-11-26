// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// The tests run inside real workerd, with the Durable Object and its SQLite. Storage isolation is per test FILE, so
// tests must not assume clean storage across the tests of one file.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // The binding `AI` (wrangler.jsonc) has no local stand-in: with remote bindings on, the pool would open a
      // session with the Cloudflare account before the first test, which needs a login and reaches the real AI. Off,
      // the binding exists and throws when it is called. No test calls it: the tests of the route hand in an AI of
      // their own (test/arrange-helpers.ts).
      remoteBindings: false,
      // The day's budget of walls (wrangler.jsonc sets it for the deployment). The tests make more walls than that, so they run with a
      // number of their own; budget.test.ts fills the count up to it where it tests the budget. What .dev.vars
      // sets for local runs about arranging (the pool reads that file too) is put back: the day's neurons are the
      // product's, and the stand-in for the AI is off, so that a test that wants it says so.
      miniflare: { bindings: { DAILY_WALLS: "1000000", DAILY_NEURONS: "8000", ARRANGE_FAKE: "" } },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
