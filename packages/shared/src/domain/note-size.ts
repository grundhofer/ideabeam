// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// How large a note is. Its width is fixed; its height is worked out from its text by the function below, and by
// nothing else: not by the font a device happens to render with, not by a measurement in the page. So a note is
// equally tall in every browser, and whoever arranges the wall (PLAN.md 4.3, step 7) can lay the notes out without
// a page to measure them in: the same function gives the same answer in the moderation's browser, in everybody
// else's and in a test.
//
// It is an estimate of how the text wraps, and it errs towards room: the surface draws a note in the box this
// gives and has to cope with a text that would need more (very wide glyphs).
//
// All lengths are world units: one unit is 1/16 rem (PLAN.md 3.1).

/** A note's width. */
export const NOTE_WIDTH = 240;
/** The space between a note's edge and its text, on every side. */
export const NOTE_PADDING = 16;
/** The height of one line of a note's text. */
export const NOTE_LINE_HEIGHT = 24;
/** How many characters fit one line of a note at its fixed width. */
export const NOTE_CHARS_PER_LINE = 24;
/** A note is never shorter than this many lines: a single word still looks like a note. */
export const NOTE_MIN_LINES = 3;

/** How many lines the text takes when it wraps at NOTE_CHARS_PER_LINE: at spaces where it can, inside a word
 *  where the word alone is longer than a line. A line break in the text starts a new line. Characters are counted
 *  as code points, so an emoji is one. */
export function noteLines(text: string): number {
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    // how much of the current line is taken
    let used = 0;
    let wrapped = 1;
    for (const word of paragraph.split(/[ \t]+/)) {
      let length = Array.from(word).length;
      if (length === 0) continue;
      // the word goes on the current line, after a space, when it fits there
      const withSpace = used === 0 ? length : used + 1 + length;
      if (withSpace <= NOTE_CHARS_PER_LINE) {
        used = withSpace;
        continue;
      }
      if (used > 0) wrapped += 1;
      // a word longer than a line fills whole lines and leaves a rest
      while (length > NOTE_CHARS_PER_LINE) {
        length -= NOTE_CHARS_PER_LINE;
        wrapped += 1;
      }
      used = length;
    }
    lines += wrapped;
  }
  return lines;
}

/** A note's height for its text: the lines it takes, never fewer than NOTE_MIN_LINES, and the padding above and
 *  below. */
export function estimateNoteHeight(text: string): number {
  return 2 * NOTE_PADDING + Math.max(NOTE_MIN_LINES, noteLines(text)) * NOTE_LINE_HEIGHT;
}
