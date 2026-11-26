// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  estimateNoteHeight,
  NOTE_CHARS_PER_LINE,
  NOTE_LINE_HEIGHT,
  NOTE_MIN_LINES,
  NOTE_PADDING,
  NOTE_TEXT_MAX,
  noteLines,
} from "../src/index.js";

const words = (count: number, length: number) => Array.from({ length: count }, () => "x".repeat(length)).join(" ");
const height = (lines: number) => 2 * NOTE_PADDING + lines * NOTE_LINE_HEIGHT;

describe("noteLines", () => {
  it("a text that fits one line is one line, up to the last character", () => {
    expect(noteLines("Fewer meetings")).toBe(1);
    expect(noteLines("x".repeat(NOTE_CHARS_PER_LINE))).toBe(1);
    expect(noteLines("x".repeat(NOTE_CHARS_PER_LINE + 1))).toBe(2);
  });

  it("wraps at a space, and the space at the break takes no room", () => {
    // two words that fill a line each: the space between them is where the line ends
    expect(noteLines(words(2, NOTE_CHARS_PER_LINE))).toBe(2);
    // 5 + 1 + 5 + 1 + 5 + 1 + 5 = 23 fit; the fifth word starts the second line
    expect(noteLines(words(4, 5))).toBe(1);
    expect(noteLines(words(5, 5))).toBe(2);
    expect(noteLines(words(8, 5))).toBe(2);
    expect(noteLines(words(9, 5))).toBe(3);
  });

  it("breaks a word that is longer than a line, and goes on behind its rest", () => {
    expect(noteLines("x".repeat(2 * NOTE_CHARS_PER_LINE))).toBe(2);
    expect(noteLines("x".repeat(2 * NOTE_CHARS_PER_LINE + 1))).toBe(3);
    // the rest of the long word is 4 characters: "abc" fits behind it, a longer word does not
    expect(noteLines(`${"x".repeat(NOTE_CHARS_PER_LINE + 4)} abc`)).toBe(2);
    expect(noteLines(`${"x".repeat(NOTE_CHARS_PER_LINE + 4)} ${"y".repeat(NOTE_CHARS_PER_LINE - 4)}`)).toBe(3);
    // a long word does not share a line with what stands before it
    expect(noteLines(`ab ${"x".repeat(NOTE_CHARS_PER_LINE + 1)}`)).toBe(3);
  });

  it("a line break in the text starts a new line, an empty line counts", () => {
    expect(noteLines("one\ntwo")).toBe(2);
    expect(noteLines("one\n\ntwo")).toBe(3);
    expect(noteLines(`${words(5, 5)}\nlast`)).toBe(3);
  });

  it("several spaces are one place to break, not words of their own", () => {
    expect(noteLines("a    b")).toBe(1);
    expect(noteLines(`${"x".repeat(NOTE_CHARS_PER_LINE)}     y`)).toBe(2);
  });

  it("counts an emoji as one character, not as the two units a script stores it in", () => {
    expect("🎉".length).toBe(2);
    expect(noteLines("🎉".repeat(NOTE_CHARS_PER_LINE))).toBe(1);
    expect(noteLines("🎉".repeat(NOTE_CHARS_PER_LINE + 1))).toBe(2);
  });
});

describe("estimateNoteHeight", () => {
  it("is the same for the same text, whoever asks", () => {
    const text = "We decide too much in meetings and write too little down.";
    expect(estimateNoteHeight(text)).toBe(estimateNoteHeight(text));
  });

  it("is never less than the shortest note: a word, or a few of them", () => {
    expect(estimateNoteHeight("ok")).toBe(height(NOTE_MIN_LINES));
    expect(estimateNoteHeight(words(NOTE_MIN_LINES, NOTE_CHARS_PER_LINE))).toBe(height(NOTE_MIN_LINES));
  });

  it("grows by one line's height with every line past that, padding above and below", () => {
    expect(estimateNoteHeight(words(NOTE_MIN_LINES + 1, NOTE_CHARS_PER_LINE))).toBe(height(NOTE_MIN_LINES + 1));
    expect(estimateNoteHeight(words(NOTE_MIN_LINES + 2, NOTE_CHARS_PER_LINE))).toBe(height(NOTE_MIN_LINES + 2));
  });

  it("the longest note there is has a height, and it is the tallest", () => {
    const longest = "x".repeat(NOTE_TEXT_MAX);
    expect(estimateNoteHeight(longest)).toBe(height(Math.ceil(NOTE_TEXT_MAX / NOTE_CHARS_PER_LINE)));
    expect(estimateNoteHeight(longest)).toBeGreaterThan(estimateNoteHeight(words(20, 5)));
  });
});
