// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// The model that arranges, as a setting (PLAN.md 4.3). A deployment names a model by its id; what the product needs
// to know about a model stands here beside the id: what it costs, and what its request has to carry. The models
// below are the ones that were measured on the test walls (docs/messung-0b.md, section 7): the default and the two
// that stand in for it when Cloudflare takes it away. One of the measured models was withdrawn two days before its
// measurement, so the id is never a constant where the model is asked.

/** A model at Workers AI and what asking it takes. */
export interface ModelSetting {
  id: string;
  /** What the model costs, in neurons per million tokens: read (input) and written (output). From Cloudflare's
   *  price list of Workers AI, read on 2026-11-23. Used where an answer does not name its neurons itself. */
  neuronsPerMInput: number;
  neuronsPerMOutput: number;
  /** What the model's request carries beside the usual fields: here, the word not to think before answering. */
  extras: Record<string, unknown>;
  /** Tokens of the answer kept in hand for a model that thinks all the same. */
  tokenReserve: number;
}

export const MODELS: readonly ModelSetting[] = [
  {
    id: "@cf/google/gemma-4-26b-a4b-it",
    neuronsPerMInput: 9091,
    neuronsPerMOutput: 27273,
    extras: { chat_template_kwargs: { enable_thinking: false } },
    tokenReserve: 1500,
  },
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    neuronsPerMInput: 31876,
    neuronsPerMOutput: 50488,
    extras: {},
    tokenReserve: 0,
  },
  {
    id: "@cf/openai/gpt-oss-120b",
    neuronsPerMInput: 31818,
    neuronsPerMOutput: 68182,
    extras: { reasoning_effort: "low" },
    tokenReserve: 1500,
  },
];

/** The model that is asked where a deployment names none: the one that arranged best and nearly cheapest. */
export const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

/** The setting of the model a deployment names, or of the default where it names none. A model this file does not
 *  know is asked as it is, without extras, and reckoned at the dearest price known here: the day's budget then
 *  errs towards spending less. */
export function modelSetting(id: string | null | undefined): ModelSetting {
  const wanted = (id ?? "").trim() || DEFAULT_MODEL;
  const known = MODELS.find((model) => model.id === wanted);
  if (known !== undefined) return known;
  return {
    id: wanted,
    neuronsPerMInput: Math.max(...MODELS.map((model) => model.neuronsPerMInput)),
    neuronsPerMOutput: Math.max(...MODELS.map((model) => model.neuronsPerMOutput)),
    extras: {},
    tokenReserve: 0,
  };
}

/** What a call cost, in neurons: the number the answer names, or, where it names none, its tokens at the model's
 *  price. */
export function neuronsOf(
  usage: { neurons?: number | undefined; inputTokens: number; outputTokens: number },
  model: Pick<ModelSetting, "neuronsPerMInput" | "neuronsPerMOutput">,
): number {
  if (usage.neurons !== undefined && Number.isFinite(usage.neurons) && usage.neurons >= 0) return usage.neurons;
  return (usage.inputTokens * model.neuronsPerMInput + usage.outputTokens * model.neuronsPerMOutput) / 1_000_000;
}
