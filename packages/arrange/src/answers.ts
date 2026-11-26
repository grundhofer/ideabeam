// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GROUP_TITLE_MAX, type Proposal } from "@ideabeam/shared";
import { DESCRIPTION_MAX, oneLine, themeLetter, type ArrangeNote, type Theme } from "./prompts.js";

// What the model answered, checked (PLAN.md 4.3, step 5). The schema asks the model for a shape; nothing here
// trusts that it kept to it. An answer is read as far as it can be read and held against what was asked: the
// notes of the batch and the letters of the themes. What does not fit is left out, never guessed: a note without a
// valid answer stays without a group, a theme without notes is no group. So the worst a hostile note can do, by
// talking the model into something, is a poor arrangement of its own wall, which the moderation sees before it
// applies it.

/** A text cut to `max` characters as a script counts them, never through the middle of a character that takes two
 *  (an emoji). */
export function clip(text: string, max: number): string {
  let cut = "";
  for (const character of text) {
    if (cut.length + character.length > max) break;
    cut += character;
  }
  return cut.trimEnd();
}

/** A text of the model as the product shows it: on one line, without control characters, at most `max` long. */
function cleaned(value: unknown, max: number): string {
  return typeof value === "string" ? clip(oneLine(value.replace(/\p{Cc}/gu, " ")), max) : "";
}

/** The JSON object in what a model wrote, or null. A model may put words or a fence around its JSON, or its
 *  thinking before it; an answer that is an object already is taken as it is. Anything else is no answer: a list,
 *  a number, plain text. */
export function readJson(content: unknown): Record<string, unknown> | null {
  const object = (value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (typeof content !== "string") return object(content);
  const text = content.replace(/<think>[\s\S]*?<\/think>/gu, "").trim();
  const parse = (json: string): unknown => {
    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  };
  const whole = parse(text);
  if (whole !== undefined) return object(whole);
  const [from, to] = [text.indexOf("{"), text.lastIndexOf("}")];
  return from >= 0 && to > from ? object(parse(text.slice(from, to + 1))) : null;
}

/** The themes in an answer, at most `max`: each with a title of at most GROUP_TITLE_MAX characters and a
 *  description on one line. An entry without a title is left out, and so is a title that is there already,
 *  however it is capitalised: a wall with two groups of one title tells nobody which is which. None: the answer
 *  was no list of themes. */
export function readThemes(content: unknown, max: number): Theme[] {
  const list = readJson(content)?.themes;
  if (!Array.isArray(list)) return [];
  const themes: Theme[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (themes.length >= max) break;
    if (entry === null || typeof entry !== "object") continue;
    const { title: rawTitle, description: rawDescription } = entry as Record<string, unknown>;
    const title = cleaned(rawTitle, GROUP_TITLE_MAX);
    const key = title.toLowerCase();
    if (title === "" || seen.has(key)) continue;
    seen.add(key);
    themes.push({ title, description: cleaned(rawDescription, DESCRIPTION_MAX) });
  }
  return themes;
}

/** The keys of a batch's answer that the text names more than once. JSON.parse keeps the last of them and says
 *  nothing; an answer that names a note twice has not decided about it. */
function namedTwice(content: unknown): Set<string> {
  const twice = new Set<string>();
  if (typeof content !== "string") return twice;
  const seen = new Set<string>();
  for (const [, key] of content.matchAll(/"(\d+)"\s*:/gu)) {
    if (key === undefined) continue;
    if (seen.has(key)) twice.add(key);
    seen.add(key);
  }
  return twice;
}

/** What an answer says about a batch: for each of its notes the theme it goes to (the theme's place in `themes`),
 *  as pairs of note id and theme. A theme is named by its letter (prompts.ts). The schema allows the letters of the
 *  list as they stand there; a model that is not held to it may write one small or with the list's dot ("b",
 *  "B."), which still names that theme and no other, so both are read. A note is left out when the answer does not
 *  name it, names it twice, or gives it anything else: a letter past the list, two letters, a title, a number. A
 *  key that is no number of the batch is ignored. null: the answer is no JSON object at all, and the call is worth
 *  asking again. */
export function readAssignment(
  content: unknown,
  batch: readonly ArrangeNote[],
  themes: readonly Theme[],
): Array<[noteId: string, theme: number]> | null {
  const answer = readJson(content);
  if (answer === null) return null;
  const twice = namedTwice(content);
  const byLetter = new Map(themes.map((_, index) => [themeLetter(index), index]));
  const pairs: Array<[string, number]> = [];
  batch.forEach((note, index) => {
    const key = String(index + 1);
    if (twice.has(key) || !Object.hasOwn(answer, key)) return;
    const value = answer[key];
    const letter = typeof value === "string" ? /^([A-Za-z])\.?$/u.exec(value.trim())?.[1] : undefined;
    const theme = letter === undefined ? undefined : byLetter.get(letter.toUpperCase());
    if (theme !== undefined) pairs.push([note.id, theme]);
  });
  return pairs;
}

/** The proposal: every theme that got notes as a group, in the themes' order, and every other note in `loose`.
 *  It is built by going through the wall's notes, so each of them stands in it once and nothing else can: a pair
 *  that names a note the wall does not have is never looked up. A pair with a theme that is not in the list counts
 *  for nothing; a note that is named in two pairs has no group. */
export function buildProposal(
  notes: readonly ArrangeNote[],
  themes: readonly Theme[],
  pairs: Iterable<readonly [noteId: string, theme: number]>,
): Proposal {
  const themeOf = new Map<string, number | null>();
  for (const [noteId, theme] of pairs) {
    const valid = Number.isInteger(theme) && theme >= 0 && theme < themes.length;
    themeOf.set(noteId, themeOf.has(noteId) || !valid ? null : theme);
  }
  const members: string[][] = themes.map(() => []);
  const loose: string[] = [];
  for (const note of notes) {
    const theme = themeOf.get(note.id) ?? null;
    if (theme === null) loose.push(note.id);
    else members[theme]?.push(note.id);
  }
  const groups = themes.flatMap((theme, index) => {
    const noteIds = members[index] ?? [];
    return noteIds.length === 0 ? [] : [{ title: clip(theme.title, GROUP_TITLE_MAX), noteIds }];
  });
  return { groups, loose };
}

/** What one call used, as the answer says it. */
export interface AnswerUsage {
  /** The neurons Cloudflare counted for the call, where the answer names them. */
  neurons?: number;
  inputTokens: number;
  outputTokens: number;
}

/** A chat completion as a model's service returns it, read without trusting its shape: the text of the answer
 *  (or the object, where the service has parsed it already) and what the call used. Workers AI answers the
 *  measured models in the shape of OpenAI's chat completions (`choices[0].message.content`, `usage`); older
 *  models of it answer `{ response, usage }`. */
export function readChatAnswer(raw: unknown): { content: unknown; usage: AnswerUsage | null } {
  if (raw === null || typeof raw !== "object") return { content: raw, usage: null };
  const answer = raw as Record<string, unknown>;
  const choice = Array.isArray(answer.choices) ? (answer.choices[0] as unknown) : undefined;
  const message =
    choice !== null && typeof choice === "object" ? ((choice as Record<string, unknown>).message as unknown) : null;
  const content =
    message !== null && typeof message === "object" ? (message as Record<string, unknown>).content : answer.response;
  const usage = answer.usage;
  if (usage === null || typeof usage !== "object") return { content, usage: null };
  const { neurons, prompt_tokens: read, completion_tokens: written } = usage as Record<string, unknown>;
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
  return {
    content,
    usage: {
      ...(typeof neurons === "number" && Number.isFinite(neurons) && neurons >= 0 ? { neurons } : {}),
      inputTokens: Math.round(count(read)),
      outputTokens: Math.round(count(written)),
    },
  };
}
