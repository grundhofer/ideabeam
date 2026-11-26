// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GROUP_TITLE_MAX } from "@ideabeam/shared";
import { clip } from "./answers.js";
import { modelSetting, neuronsOf } from "./model.js";
import { MAX_THEMES, type ModelRequest } from "./prompts.js";
import type { Ask, ArrangeStep, ModelAnswer } from "./run.js";

// A stand-in for the model, for local runs and end-to-end tests: no network, no account, and the same answer every
// time. It answers the two kinds of request of a run in the shape the real model answers them, so everything after
// the call is the product's real code: reading the answer, checking it, building the proposal.
//
// Its rule: **a note belongs with the notes that begin with the same word.** The themes are the first words of the
// notes, the most frequent first; a note whose first word is no theme goes to the last one. A test that wants two
// groups writes notes that begin with two words.
//
// It reads the notes back out of the prompt, so it knows the prompts' layout (prompts.ts) and breaks with it: the
// tests of this package hold the two together. It is no model and must never stand in for one in a deployment.

/** The lines of a numbered list in a prompt, after the line that ends with `heading`. */
function listAfter(prompt: string, heading: string): string[] {
  const start = prompt.indexOf(heading);
  if (start < 0) return [];
  const block = prompt.slice(start + heading.length).split("\n\n")[0] ?? "";
  return block
    .split("\n")
    .map((line) => /^\d+\. (.*)$/u.exec(line)?.[1])
    .filter((text): text is string => text !== undefined);
}

/** A note's first word, as the key its theme is found by. */
const firstWord = (text: string) => (/[\p{L}\p{N}]+/u.exec(text)?.[0] ?? "").toLowerCase();

const titled = (word: string) => clip(word.charAt(0).toUpperCase() + word.slice(1), GROUP_TITLE_MAX);

function limits(schema: Record<string, unknown>): [min: number, max: number] {
  const themes = (schema.properties as { themes?: { minItems?: number; maxItems?: number } } | undefined)?.themes;
  return [themes?.minItems ?? 2, themes?.maxItems ?? MAX_THEMES];
}

function themesOf(request: ModelRequest): unknown {
  const [min, max] = limits(request.schema);
  const counts = new Map<string, number>();
  for (const text of listAfter(request.user, "sticky notes from the board:\n")) {
    const word = firstWord(text);
    if (word !== "") counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  // the most frequent first; among equals the one that came first (a Map keeps the order of arrival)
  const words = [...counts].sort((a, b) => b[1] - a[1]).map(([word]) => word);
  const themes = words.slice(0, max).map((word) => ({
    title: titled(word),
    description: `Notes that begin with "${word}".`,
  }));
  for (let n = themes.length + 1; themes.length < min; n++) {
    themes.push({ title: `Theme ${n}`, description: "Nothing begins with this." });
  }
  return { themes };
}

function assignedOf(request: ModelRequest): unknown {
  // the themes as the prompt lists them: a letter, the title, the description
  const themes = request.user
    .split("\n")
    .map((line) => /^([A-Z])\. (.*?): /u.exec(line))
    .filter((found) => found !== null);
  const byWord = new Map(themes.map((found) => [(found[2] ?? "").toLowerCase(), found[1] ?? ""]));
  const last = themes[themes.length - 1]?.[1] ?? "";
  const notes = listAfter(request.user, "Sticky notes:\n");
  return Object.fromEntries(notes.map((text, index) => [String(index + 1), byWord.get(firstWord(text)) ?? last]));
}

const ANSWERS: Record<ArrangeStep, (request: ModelRequest) => unknown> = {
  themes: themesOf,
  assign: assignedOf,
};

/** The stand-in, as the function a run asks through. What it says a call used is reckoned from the lengths of the
 *  prompt and the answer at the default model's price, so a local day's budget moves as a real one would. */
export const fakeAsk: Ask = (request, step) => {
  const content = JSON.stringify(ANSWERS[step](request));
  const inputTokens = Math.ceil((request.system.length + request.user.length) / 4);
  const outputTokens = Math.ceil(content.length / 4);
  const answer: ModelAnswer = {
    content,
    usage: { neurons: neuronsOf({ inputTokens, outputTokens }, modelSetting(null)), inputTokens, outputTokens },
  };
  return Promise.resolve(answer);
};
