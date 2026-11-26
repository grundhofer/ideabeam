// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, MODELS, modelSetting, neuronsOf } from "../src/index.js";

describe("the model as a setting", () => {
  it("is the measured one where a deployment names none, with its price beside it", () => {
    for (const unset of [undefined, null, "", "   "]) {
      expect(modelSetting(unset), String(unset)).toEqual({
        id: "@cf/google/gemma-4-26b-a4b-it",
        neuronsPerMInput: 9091,
        neuronsPerMOutput: 27273,
        extras: { chat_template_kwargs: { enable_thinking: false } },
        tokenReserve: 1500,
      });
    }
    expect(DEFAULT_MODEL).toBe("@cf/google/gemma-4-26b-a4b-it");
  });

  it("knows the two measured stand-ins by their ids", () => {
    expect(modelSetting("@cf/mistralai/mistral-small-3.1-24b-instruct")).toMatchObject({
      neuronsPerMInput: 31876,
      neuronsPerMOutput: 50488,
      extras: {},
    });
    expect(modelSetting(" @cf/openai/gpt-oss-120b ")).toMatchObject({
      id: "@cf/openai/gpt-oss-120b",
      neuronsPerMInput: 31818,
      neuronsPerMOutput: 68182,
      extras: { reasoning_effort: "low" },
    });
    expect(MODELS.map((model) => model.id)).toContain(DEFAULT_MODEL);
  });

  it("asks a model it does not know as it is, and reckons it at the dearest price it knows", () => {
    expect(modelSetting("@cf/some/new-model")).toEqual({
      id: "@cf/some/new-model",
      neuronsPerMInput: 31876,
      neuronsPerMOutput: 68182,
      extras: {},
      tokenReserve: 0,
    });
  });
});

describe("what a call cost", () => {
  const gemma = modelSetting(null);

  it("is the number of neurons the answer names", () => {
    expect(neuronsOf({ neurons: 38.7, inputTokens: 1616, outputTokens: 877 }, gemma)).toBe(38.7);
    expect(neuronsOf({ neurons: 0, inputTokens: 10, outputTokens: 10 }, gemma)).toBe(0);
  });

  it("is reckoned from the tokens at the model's price where the answer names none", () => {
    // the small wall of the measurement: 1,616 tokens read and 877 written came to 39 neurons
    expect(neuronsOf({ inputTokens: 1616, outputTokens: 877 }, gemma)).toBeCloseTo(38.61, 2);
    expect(neuronsOf({ inputTokens: 1_000_000, outputTokens: 0 }, gemma)).toBe(9091);
    expect(neuronsOf({ inputTokens: 0, outputTokens: 1_000_000 }, gemma)).toBe(27273);
    // a number that is none counts as not named
    expect(neuronsOf({ neurons: Number.NaN, inputTokens: 1_000_000, outputTokens: 0 }, gemma)).toBe(9091);
    expect(neuronsOf({ neurons: -5, inputTokens: 1_000_000, outputTokens: 0 }, gemma)).toBe(9091);
  });
});
