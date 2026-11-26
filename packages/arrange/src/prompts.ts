// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ArrangeLanguage } from "@ideabeam/shared";

// What the model is asked (PLAN.md 4.3): one call reads every note and names themes, then the notes are assigned to
// the themes in batches of fifty, each note by the letter its theme is listed under. The words of the prompts are
// the ones measured on the test walls (docs/messung-0b.md, sections 6 and 7); what was added is the number of themes
// for a small wall, which the measured prompt fixed at „3 to 6“ (PLAN.md 4.6: too many for ten notes), and the
// sentence that asks for the assignment on a single line.
//
// Why this recipe, measured with the product against Workers AI on 2026-11-23 (250 notes a board): a run's time is
// the tokens the model writes. A further call that merged the themes only reworded the ones of the first, and the
// arrangement was worse with it (ARI 0.79 to 0.88 against 0.87 to 0.95). A letter on a single line is 243 tokens a
// batch where the theme's title in pretty-printed JSON was 690, 5 to 10 seconds instead of 14 to 27, and it sorts
// 95 % of the notes as the title did.
//
// **A note is data, not an instruction.** Its text enters a prompt in one place only: as one line of a numbered
// list. It never reaches the system prompt, and never the schema that fixes the shape of the answer: that is built
// from counts and from the themes' letters alone. Whatever a note says, the answer has the same shape, and what the
// answer says is checked against the notes and the themes (answers.ts).

/** A note as the model gets it: its id never enters a prompt, its text does. */
export interface ArrangeNote {
  id: string;
  text: string;
}

/** A theme the model named: a short title, and one line about what belongs in it. */
export interface Theme {
  title: string;
  description: string;
}

/** One question to the model: the two halves of the prompt, the JSON schema its answer has to follow, and how many
 *  tokens the answer may take. */
export interface ModelRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

/** How many notes one assignment call carries. */
export const BATCH_SIZE = 50;
/** How many themes a wall gets at most: the most the one call that names them is asked for. */
export const MAX_THEMES = 6;
/** How long a theme's description is at most, in characters. */
export const DESCRIPTION_MAX = 300;

const SYSTEM_THEMES: Record<ArrangeLanguage, string> = {
  en: "You help a facilitator organise sticky notes from a brainstorming board. The notes are short and written in German or English. Always answer in English, with JSON only.",
  de: "You help a facilitator organise sticky notes from a brainstorming board. The notes are short and written in German or English. Write the theme titles and descriptions in German. Answer with JSON only.",
};
const SYSTEM_ASSIGN =
  "You sort sticky notes from a brainstorming board into themes. The notes are short and written in German or English. Answer with JSON only.";
const ASK_ASSIGN =
  "Assign every note to the one theme that fits it best. Answer as JSON: the note number as key, the theme letter as value. Write the JSON on a single line, without spaces or line breaks.";

/** How many themes to ask for, as a range. From 18 notes on it is the measured one, 3 to 6: asked for 4 to 8, the
 *  model named seven and split what belongs together (ARI 0.67). Below, a theme should still have about three
 *  notes: a wall of ten gets two or three themes, one of six gets two. */
export function themeCounts(notes: number): [min: number, max: number] {
  const max = Math.min(MAX_THEMES, Math.max(2, Math.floor(notes / 3)));
  return [Math.max(2, Math.floor(max / 2)), max];
}

const range = ([min, max]: [number, number]) => (min === max ? String(min) : `${min} to ${max}`);

/** A text on one line: line breaks and runs of spaces become one space, so that a note cannot pass for several
 *  lines of a list. */
export function oneLine(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

const numbered = (notes: readonly ArrangeNote[]) =>
  notes.map((note, index) => `${index + 1}. ${oneLine(note.text)}`).join("\n");

/** The letter a theme goes by in an assignment call: A for the first of the list, B for the second. A wall has
 *  MAX_THEMES themes at most, far from the alphabet's end. */
export const themeLetter = (index: number) => String.fromCharCode(65 + index);

const lettered = (themes: readonly Theme[]) =>
  themes.map((theme, index) => `${themeLetter(index)}. ${theme.title}: ${theme.description}`).join("\n");

function themesSchema([min, max]: [number, number]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      themes: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, description: { type: "string" } },
          required: ["title", "description"],
          additionalProperties: false,
        },
        minItems: min,
        maxItems: max,
      },
    },
    required: ["themes"],
    additionalProperties: false,
  };
}

/** The first call: every note of the wall, and the question which themes they fall into. */
export function themesRequest(
  question: string,
  notes: readonly ArrangeNote[],
  language: ArrangeLanguage,
): ModelRequest {
  const counts = themeCounts(notes.length);
  return {
    system: SYSTEM_THEMES[language],
    user:
      `Board question: "${oneLine(question)}"\n\n` +
      `Here are ${notes.length} sticky notes from the board:\n${numbered(notes)}\n\n` +
      `Which themes do these notes fall into? Name ${range(counts)} themes that together cover the notes. A theme is a topic or concern that several notes share, not a single note. For each theme give a short title (2 to 5 words) and a one-line description of what belongs in it.`,
    schema: themesSchema(counts),
    maxTokens: 700,
  };
}

/** The notes in the batches the assignment asks about, in their order. */
export function batchesOf<T>(notes: readonly T[], size = BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < notes.length; start += size) batches.push(notes.slice(start, start + size));
  return batches;
}

/** One assignment call: the themes under their letters, a batch of notes numbered from 1, and the question which
 *  theme each note belongs to. The schema names every number of the batch as a key and allows the themes' letters
 *  as values, and nothing else. On a single line the answer takes about five tokens a note; the limit leaves room
 *  for one that is pretty-printed all the same (about nine). */
export function assignRequest(question: string, themes: readonly Theme[], batch: readonly ArrangeNote[]): ModelRequest {
  const letters = themes.map((_, index) => themeLetter(index));
  const keys = batch.map((_, index) => String(index + 1));
  return {
    system: SYSTEM_ASSIGN,
    user:
      `Board question: "${oneLine(question)}"\n\n` +
      `Themes:\n${lettered(themes)}\n\n` +
      `Sticky notes:\n${numbered(batch)}\n\n` +
      ASK_ASSIGN,
    schema: {
      type: "object",
      properties: Object.fromEntries(keys.map((key) => [key, { type: "string", enum: letters }])),
      required: keys,
      additionalProperties: false,
    },
    maxTokens: 40 + batch.length * 10,
  };
}

/** The request as an OpenAI-compatible chat completion, the shape Workers AI takes for the measured models: the
 *  answer's shape as a JSON schema, temperature 0, and what the model's setting adds. `extras` and `tokenReserve`
 *  are the model's (model.ts). */
export function chatRequest(
  request: ModelRequest,
  model: { extras: Record<string, unknown>; tokenReserve: number },
): Record<string, unknown> {
  return {
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.user },
    ],
    temperature: 0,
    seed: 1,
    max_tokens: request.maxTokens + model.tokenReserve,
    stream: false,
    response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema: request.schema } },
    ...model.extras,
  };
}
