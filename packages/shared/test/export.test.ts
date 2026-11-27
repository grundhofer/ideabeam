// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  escapeMarkdown,
  exportDate,
  exportFileName,
  wallMarkdown,
  type ExportInput,
  type Group,
  type StoredNote,
} from "../src/index.js";

// 2026-11-25, 10:00 UTC
const AT = Date.UTC(2026, 10, 25, 10, 0, 0);
const NOW = AT - 3_600_000;
const id = (letter: string) => letter.repeat(32);
const ANNA = id("a");
const BEN = id("b");

const note = (letter: string, authorId: string, text: string, groupId: string | null, made = 0): StoredNote => ({
  id: id(letter),
  authorId,
  text,
  x: 0,
  y: 0,
  groupId,
  createdAt: NOW + made,
  updatedAt: NOW + made,
});

const group = (letter: string, title: string, ord: number): Group => ({
  id: id(letter),
  title,
  titleSource: "ki",
  locked: false,
  x: 0,
  y: 0,
  w: 400,
  h: 400,
  ord,
});

/** The method of the wall, its name and short description, above the results (PLAN-METHODEN.md 2). */
const METHOD_LINE =
  "**Still sammeln, bündeln, verdeckt wählen:** Alle schreiben Ideen verdeckt, die Ideen werden gebündelt, dann wählt jede Person verdeckt; heraus kommt eine Rangfolge.";

const input = (over: Partial<ExportInput>): ExportInput => ({
  question: "Was hilft uns?",
  methodId: "still-sammeln",
  sight: "all",
  notes: [],
  groups: [],
  viewer: ANNA,
  at: AT,
  language: "de",
  ...over,
});

describe("the export of a revealed wall", () => {
  const groups = [group("8", "Werkzeuge", 2), group("7", "Zeit", 1), group("9", "", 3)];
  const notes = [
    note("1", BEN, "Ruhige Vormittage", id("7"), 2),
    note("2", ANNA, "Weniger Meetings", id("7"), 1),
    note("3", BEN, "Ein gutes Board", id("8"), 3),
    note("4", ANNA, "Kaffee", null, 4),
    note("5", BEN, "Eine Gruppe, die es nicht mehr gibt", id("f"), 5),
  ];

  it("has the question as title, the date, every group as a heading in the list's order, the rest last", () => {
    expect(wallMarkdown(input({ notes, groups }))).toBe(
      [
        "# Was hilft uns?",
        "",
        "_IdeaBeam · Stand: 25.11.2026_",
        "",
        METHOD_LINE,
        "",
        "## Zeit",
        "",
        "- Weniger Meetings",
        "- Ruhige Vormittage",
        "",
        "## Werkzeuge",
        "",
        "- Ein gutes Board",
        "",
        "## Ohne Titel",
        "",
        "_Keine Zettel in dieser Gruppe._",
        "",
        "## Ohne Gruppe",
        "",
        "- Kaffee",
        "- Eine Gruppe, die es nicht mehr gibt",
        "",
      ].join("\n"),
    );
  });

  it("is the same for everybody once the notes are revealed, and names nobody", () => {
    const forAnna = wallMarkdown(input({ notes, groups }));
    expect(wallMarkdown(input({ notes, groups, viewer: BEN }))).toBe(forAnna);
    expect(forAnna).not.toContain(ANNA);
    expect(forAnna).not.toContain(BEN);
  });

  it("speaks English to whoever asks in English", () => {
    const text = wallMarkdown(input({ notes, groups, language: "en" }));
    expect(text).toContain("_IdeaBeam · As of 2026-11-25_");
    expect(text).toContain("## Untitled\n\n_No notes in this group._");
    expect(text).toContain("## Without a group");
  });

  it("calls the notes of a wall without groups simply its notes", () => {
    expect(wallMarkdown(input({ notes: [note("1", BEN, "Eins", null)] }))).toContain("## Zettel\n\n- Eins\n");
    expect(wallMarkdown(input({ notes: [note("1", BEN, "One", null)], language: "en" }))).toContain("## Notes\n");
  });

  it("says so when the wall is empty", () => {
    expect(wallMarkdown(input({}))).toBe(
      `# Was hilft uns?\n\n_IdeaBeam · Stand: 25.11.2026_\n\n${METHOD_LINE}\n\n_Noch keine Zettel._\n`,
    );
  });
});

describe("the export while the notes are hidden", () => {
  const notes = [
    note("1", ANNA, "Annas erster", null, 1),
    note("2", BEN, "Bens geheimer", null, 2),
    note("3", ANNA, "Annas zweiter", null, 3),
  ];

  it("holds the person's own notes and nothing of the others' but their number", () => {
    const text = wallMarkdown(input({ sight: "hidden", notes }));
    expect(text).toBe(
      [
        "# Was hilft uns?",
        "",
        "_IdeaBeam · Stand: 25.11.2026_",
        "",
        METHOD_LINE,
        "",
        "_Die Zettel sind noch verdeckt: Hier stehen nur deine. 1 Zettel der anderen fehlt._",
        "",
        "## Deine Zettel",
        "",
        "- Annas erster",
        "- Annas zweiter",
        "",
      ].join("\n"),
    );
    expect(text).not.toContain("Bens");
  });

  it("counts the others' notes in both languages", () => {
    const ben = wallMarkdown(input({ sight: "hidden", notes, viewer: BEN, language: "en" }));
    expect(ben).toContain("_The notes are still hidden: only yours are here. 2 notes by the others are left out._");
    expect(ben).toContain("## Your notes\n\n- Bens geheimer\n");
    expect(ben).not.toContain("Annas");
  });

  it("says when the person has written nothing yet", () => {
    const text = wallMarkdown(input({ sight: "hidden", notes, viewer: id("c") }));
    expect(text).toContain("3 Zettel der anderen fehlen.");
    expect(text).toContain("_Noch keine Zettel von dir._");
    expect(text).not.toContain("Annas");
    expect(text).not.toContain("Bens");
  });
});

describe("text a person typed", () => {
  it("cannot make a heading, a list, a link, an image, code, HTML or a quote", () => {
    expect(escapeMarkdown("# Überschrift")).toBe("\\# Überschrift");
    expect(escapeMarkdown("- Punkt")).toBe("\\- Punkt");
    expect(escapeMarkdown("+ Punkt")).toBe("\\+ Punkt");
    expect(escapeMarkdown("1. Erstens")).toBe("1\\. Erstens");
    expect(escapeMarkdown("2) Zweitens")).toBe("2\\) Zweitens");
    expect(escapeMarkdown("[harmlos](https://example.invalid)")).toBe("\\[harmlos\\](https://example.invalid)");
    expect(escapeMarkdown("![Bild](x.png)")).toBe("!\\[Bild\\](x.png)");
    expect(escapeMarkdown("<img src=x onerror=alert(1)>")).toBe("\\<img src=x onerror=alert(1)\\>");
    expect(escapeMarkdown("> Zitat")).toBe("\\> Zitat");
    expect(escapeMarkdown("`code` *fett* _schräg_ ~weg~ a|b \\")).toBe(
      "\\`code\\` \\*fett\\* \\_schräg\\_ \\~weg\\~ a\\|b \\\\",
    );
    expect(escapeMarkdown("&amp; &#38; & Co.")).toBe("\\&amp; \\&\\#38; & Co.");
  });

  it("stays on one line", () => {
    expect(escapeMarkdown("Erste Zeile\n\n# Zweite\r\nDritte Vierte\tFünfte")).toBe(
      "Erste Zeile \\# Zweite Dritte Vierte Fünfte",
    );
  });

  it("keeps plain punctuation as it is", () => {
    expect(escapeMarkdown("Mehr Zeit (freitags), bitte! 3-mal: ja.")).toBe("Mehr Zeit (freitags), bitte! 3-mal: ja.");
  });

  it("is escaped in the question and in a group's title as in a note", () => {
    const text = wallMarkdown(
      input({
        question: "# Frage [mit](link)",
        groups: [group("7", "*Titel*", 1)],
        notes: [note("1", ANNA, "- kein Punkt\n## keine Überschrift", id("7"))],
      }),
    );
    expect(text).toContain("# \\# Frage \\[mit\\](link)\n");
    expect(text).toContain("## \\*Titel\\*\n");
    expect(text).toContain("- \\- kein Punkt \\#\\# keine Überschrift\n");
    // every line that starts a block is one the export wrote
    const blocks = text.split("\n").filter((line) => /^(#|-|\d+\.|>|<|\[)/.test(line));
    expect(blocks).toEqual([
      "# \\# Frage \\[mit\\](link)",
      "## \\*Titel\\*",
      "- \\- kein Punkt \\#\\# keine Überschrift",
    ]);
  });
});

describe("the date and the file's name", () => {
  it("writes the day in UTC as each language writes a date", () => {
    expect(exportDate(AT, "de")).toBe("25.11.2026");
    expect(exportDate(AT, "en")).toBe("2026-11-25");
    expect(exportDate(Date.UTC(2026, 11, 31, 23, 59), "de")).toBe("31.12.2026");
  });

  it("makes the question a safe name with the day", () => {
    expect(exportFileName("Was hilft uns?", AT)).toBe("Was-hilft-uns-2026-11-25.md");
    expect(exportFileName("Größere Übungen für Äpfel", AT)).toBe("Groessere-Uebungen-fuer-Aepfel-2026-11-25.md");
    expect(exportFileName("Café crème", AT)).toBe("Cafe-creme-2026-11-25.md");
    expect(exportFileName('../"; rm -rf /', AT)).toBe("rm-rf-2026-11-25.md");
    expect(exportFileName("🙂🙂", AT)).toBe("IdeaBeam-2026-11-25.md");
    const long = exportFileName("a".repeat(200), AT);
    expect(long).toBe(`${"a".repeat(60)}-2026-11-25.md`);
    expect(exportFileName("Was hilft uns? ".repeat(10), AT)).toMatch(/^[A-Za-z0-9-]+\.md$/);
  });
});

describe("the method above the results", () => {
  it("names the wall's method with its short description, in the language of whoever asks", () => {
    expect(wallMarkdown(input({ methodId: "free" }))).toContain(
      "**Freie Wand:** Alle schreiben Zettel, die sofort für alle sichtbar sind, und ordnen sie gemeinsam, ohne festen Ablauf.\n",
    );
    const english = wallMarkdown(input({ methodId: "still-sammeln", language: "en" }));
    expect(english).toContain(
      "**Write alone, group, vote in secret:** Everyone writes ideas in private, the ideas are grouped, then everyone votes in secret; you get a ranking.\n",
    );
    // under the date, above every heading of the results
    expect(english.indexOf("**Write alone")).toBeGreaterThan(english.indexOf("As of"));
  });
});
