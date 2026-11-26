// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { generateHexId, HEX_ID_PATTERN, hexIdSchema, wallIdSchema } from "../src/index.js";

describe("hex ids", () => {
  it("mints 128 bits as 32 lowercase hex characters", () => {
    const id = generateHexId();
    expect(id).toMatch(HEX_ID_PATTERN);
    expect(id).toHaveLength(32);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, generateHexId));
    expect(ids.size).toBe(1000);
  });

  it("the schema takes a minted id and refuses another shape", () => {
    expect(hexIdSchema.safeParse(generateHexId()).success).toBe(true);
    for (const wrong of ["", "abc", "A".repeat(32), "g".repeat(32), "0".repeat(31), "0".repeat(33)]) {
      expect(hexIdSchema.safeParse(wrong).success, wrong).toBe(false);
    }
  });
});

describe("wall ids", () => {
  it("are 64 lowercase hex characters and nothing else", () => {
    expect(wallIdSchema.safeParse("0".repeat(64)).success).toBe(true);
    for (const wrong of ["", "0".repeat(32), "0".repeat(63), "0".repeat(65), "G".repeat(64), "../" + "0".repeat(61)]) {
      expect(wallIdSchema.safeParse(wrong).success, wrong).toBe(false);
    }
  });
});
