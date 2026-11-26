// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// „Eigener Schlüssel“ (PLAN.md 4.5): the providers a moderation can arrange with from its own account, as data. The
// list is fixed: there is no address to type in. What is asked of a provider and how its answer is read stands in
// provider-calls.ts; this file holds what can be said about a provider without calling it, so the app can show the
// list without loading a prompt.
//
// Every fact here was read or tested on 2026-11-23 and is told with its source in docs/ki-anbieter-4b.md (Mistral,
// section 3.4) and docs/ki-anbieter-4b-us.md (OpenAI, section 3.1; Anthropic, section 3.2). No call with a real key
// was made: what a provider answers to the requests of this package is not seen yet.
//
// **A further provider is one entry of PROVIDERS**, its origin in the app's Content-Security-Policy (the app's test
// of its headers reads this list), and, where its API is none of the shapes provider-calls.ts knows, its request
// and its answer there. It may be offered once its model is measured at ARI 0.7 or better on the test boards
// (`measured`, PLAN.md 4.5); until then only a tab that was told to shows it (`offered`).

/** A provider of the list. */
export type ProviderId = "mistral" | "openai" | "anthropic";

/** How much a model thinks before it answers, in the word its provider takes. Mistral and OpenAI: `reasoning_effort`,
 *  where `none` switches thinking off. Anthropic: `output_config.effort`, which knows no `none`. */
export type Effort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

/** A provider's model, as a setting: what its request has to say, and what it costs. */
export interface ProviderModel<E extends Effort = Effort> {
  id: string;
  /** What the request says about thinking. */
  effort: E;
  /** Whether the model thinks before it answers, at this `effort`. Its thinking is billed as written tokens and
   *  counts against the limit of the answer, so the request leaves room for it (THINKING_RESERVE). */
  thinks: boolean;
  /** Anthropic alone: whether a request the model declines for policy reasons is asked again, at Anthropic, of the
   *  model Anthropic names for that (`fallbacks: "default"`). Claude Haiku 5.5 has no such fallback. */
  fallbacks: boolean;
  /** The provider's list price in US dollars per million tokens, read and written. */
  usdPerMInput: number;
  usdPerMOutput: number;
}

/** What the interface says about a provider before a note goes there. Kinds of facts, not sentences: the words are
 *  the app's, in both languages. */
export interface ProviderFacts {
  /** Where the provider computes. `eu`: by its own word in data centres in the EU and EFTA, for the address the app
   *  calls. `anywhere`: it promises no place. */
  place: "eu" | "anywhere";
  /** For how many days at most the provider keeps what it was sent and what it answered. */
  keptDays: number;
  /** Whether the provider says it keeps content longer that its checks flag, or that the law makes it keep. */
  keptLongerWhenFlagged: boolean;
  /** Whether the provider trains on what it is sent. `no`: by its own word not, unless the account agreed to it.
   *  `account`: a setting of the account decides, and the provider does not say plainly what holds without it. */
  training: "no" | "account";
  /** Whether the provider refuses calls from a browser for accounts that have agreed zero data retention with it:
   *  such a key is refused here although it is valid, and the sentence of a refused key says so. */
  refusesBrowserWithoutRetention: boolean;
}

export interface Provider<E extends Effort = Effort> {
  id: ProviderId;
  /** The provider's name. Never translated. */
  name: string;
  /** The one origin the moderation's browser calls: what the app's Content-Security-Policy allows. */
  origin: string;
  /** The address every call goes to. */
  url: string;
  /** The page of the provider that says where a key is made, or where it is made. */
  keyPage: string;
  /** The environment variable scripts/measure-key.mjs reads this provider's key from. */
  keyEnv: string;
  /** The model that is asked: one of `models`. A setting, never a constant where the model is asked: a provider
   *  takes a model away, or the owner chooses another. */
  model: string;
  models: ReadonlyArray<ProviderModel<E>>;
  /** Whether `model` was measured on the test boards at ARI 0.7 or better (PLAN.md 4.5, docs/). Only then does
   *  everybody who moderates see the provider. */
  measured: boolean;
  facts: ProviderFacts;
}

/** Mistral, at its endpoint for the EU. The address without `.eu` commits to no place (docs/ki-anbieter-4b.md,
 *  3.4); the EU endpoint costs a tenth more, which the prices below hold. Whether `mistral-small-2603` is served
 *  there is not verified: „Available models vary by region“. */
export const MISTRAL: Provider<"none" | "low" | "medium" | "high"> = {
  id: "mistral",
  name: "Mistral",
  origin: "https://api.eu.mistral.ai",
  url: "https://api.eu.mistral.ai/v1/chat/completions",
  keyPage: "https://docs.mistral.ai/admin/identity-access/api-keys",
  keyEnv: "MISTRAL_API_KEY",
  model: "mistral-small-2603",
  models: [
    {
      id: "mistral-small-2603",
      effort: "none",
      thinks: false,
      fallbacks: false,
      usdPerMInput: 0.165,
      usdPerMOutput: 0.66,
    },
  ],
  measured: false,
  facts: {
    place: "eu",
    keptDays: 30,
    keptLongerWhenFlagged: false,
    training: "account",
    refusesBrowserWithoutRetention: false,
  },
};

/** OpenAI's chat completions. `gpt-6-luna` is its cheapest current model and the one whose thinking can be switched
 *  off (docs/ki-anbieter-4b-us.md, 3.1). */
export const OPENAI: Provider<"none" | "low" | "medium" | "high" | "xhigh" | "max"> = {
  id: "openai",
  name: "OpenAI",
  origin: "https://api.openai.com",
  url: "https://api.openai.com/v1/chat/completions",
  keyPage: "https://platform.openai.com/api-keys",
  keyEnv: "OPENAI_API_KEY",
  model: "gpt-6-luna",
  models: [
    { id: "gpt-6-luna", effort: "none", thinks: false, fallbacks: false, usdPerMInput: 0.1, usdPerMOutput: 0.5 },
  ],
  measured: false,
  facts: {
    place: "anywhere",
    keptDays: 30,
    keptLongerWhenFlagged: true,
    training: "no",
    refusesBrowserWithoutRetention: false,
  },
};

/** Anthropic's Messages API, asked through Anthropic's own client (the app's lib/key-anthropic.ts). The owner has
 *  not chosen the model yet: `model` is the one value to change, and each of the three brings what it needs. All
 *  three think before they answer unless the request is simple, and on Claude Opus 5.5 that cannot be switched
 *  off; `effort: "low"` keeps it short, which is what Anthropic recommends for sorting and classifying
 *  (docs/ki-anbieter-4b-us.md, 3.2). */
export const ANTHROPIC: Provider<"low" | "medium" | "high" | "xhigh" | "max"> = {
  id: "anthropic",
  name: "Anthropic",
  origin: "https://api.anthropic.com",
  url: "https://api.anthropic.com/v1/messages",
  keyPage: "https://platform.claude.com/settings/keys",
  keyEnv: "ANTHROPIC_API_KEY",
  model: "claude-opus-5-5",
  models: [
    { id: "claude-opus-5-5", effort: "low", thinks: true, fallbacks: true, usdPerMInput: 4, usdPerMOutput: 20 },
    { id: "claude-sonnet-5-5", effort: "low", thinks: true, fallbacks: true, usdPerMInput: 2, usdPerMOutput: 10 },
    { id: "claude-haiku-5-5", effort: "low", thinks: true, fallbacks: false, usdPerMInput: 0.1, usdPerMOutput: 0.5 },
  ],
  measured: false,
  facts: {
    place: "anywhere",
    keptDays: 30,
    keptLongerWhenFlagged: true,
    training: "no",
    refusesBrowserWithoutRetention: true,
  },
};

/** The list, in the order the app shows it. */
export const PROVIDERS: ReadonlyArray<Provider> = [MISTRAL, OPENAI, ANTHROPIC];

/** The provider of an id. */
export function providerOf(id: ProviderId): Provider {
  const provider = PROVIDERS.find((one) => one.id === id);
  if (provider === undefined) throw new Error(`no provider "${id}"`);
  return provider;
}

/** The providers a moderation may choose from: those whose model is measured, and in a tab that was told to show
 *  the others too (`unlocked`: the owner trying his own key, the tests), all of them. */
export function offered(unlocked: boolean, providers: ReadonlyArray<Provider> = PROVIDERS): ReadonlyArray<Provider> {
  return providers.filter((provider) => provider.measured || unlocked);
}

/** The setting of the model a provider is asked with: the one it names, or the one a measurement names (`id`). A
 *  model this file does not know is asked as the provider's own would be, under the other id. */
export function modelOf<E extends Effort>(provider: Provider<E>, id?: string | null): ProviderModel<E> {
  const wanted = (id ?? "").trim() || provider.model;
  const known = provider.models.find((model) => model.id === wanted);
  if (known !== undefined) return known;
  const own = provider.models.find((model) => model.id === provider.model);
  if (own === undefined) throw new Error(`${provider.id} names a model it has no setting for`);
  return { ...own, id: wanted };
}

/** How many tokens a request leaves beyond the answer's own for a model that thinks first. Thinking is cut off at
 *  the limit like the answer, and an answer that is cut is none; what is not used is not billed. Anthropic's own
 *  starting value for a request that is not streamed. Not measured. */
export const THINKING_RESERVE = 16_000;

/** What a wall of 250 notes takes, in tokens: one call for the themes that reads every note, five that assign
 *  fifty each (docs/ki-anbieter-4b-us.md, section 3), and for a model that thinks 250 tokens of thinking a call.
 *  The last number is an assumption: no provider publishes one, and none is measured. */
const WALL = { input: 15_000, output: 1_500, thinking: 1_500 };

/** What arranging a wall of 250 notes costs with a model, in US cents at the provider's list price. An estimate
 *  from the token counts above, not a measurement. */
export function centsPerWall(model: Pick<ProviderModel, "thinks" | "usdPerMInput" | "usdPerMOutput">): number {
  const written = WALL.output + (model.thinks ? WALL.thinking : 0);
  return ((WALL.input * model.usdPerMInput + written * model.usdPerMOutput) / 1_000_000) * 100;
}
