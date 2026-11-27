// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { methodTexts } from "../methods/texts.js";
import type { ArrangeLanguage, Group } from "../protocol.js";
import type { NoteLevel } from "./agenda.js";
import type { MethodId } from "./method.js";
import { notesFor, type StoredNote } from "./visibility.js";
import { CATALOGUE } from "../methods/catalogue.js";
import type { EstimateResult, EstimateSummary, RankingResult, VoteResult } from "./vote.js";

type VoteKind = RankingResult["kind"];

// The export of a wall as Markdown (PLAN.md 2.1, „Export: Markdown: Gruppen als Überschriften“; 3.2, `GET
// /api/walls/:id/export`). Its model is RetroBeam's `packages/shared/src/domain/export.ts` (docs/HERKUNFT.md): the
// title, a line in italics with the date, a heading per column with the notes as list items, a file name made safe.
// What is IdeaBeam's own:
//
//  - **The same filter as the snapshot.** The export of one person is what `notesFor` gives that person
//    (domain/visibility.ts, PLAN.md 3.4): while the notes are hidden their own and nobody else's, and a line says how
//    many are left out. Nothing else reads the stored notes here.
//  - **No name, anywhere** (the owner's decision 14, PLAN.md 7.2): not who wrote a note, not who is on the wall, not
//    who saved the file. RetroBeam's names on request have no counterpart.
//  - **The order of the list view** (apps/web/src/components/WallList.tsx), which is the wall as headings and rows:
//    the groups in the order of the list (`ord`, then id), each with its notes in the order they were made (then id),
//    then the notes in no group under a heading of their own. A group with no notes stays, with a line that says so:
//    the heading is something the team wrote. A reader who saw the list finds the same order in the file.
//  - **Text a person typed is text, never Markdown.** A note, a group's title and the question cannot make a heading,
//    a list, a link, an image, a quote, code or HTML: every character that means something to Markdown is escaped
//    with a backslash, and a line break becomes a space, so a note stays one list item. A bare address in a note
//    (`https://…`) may still be shown as a link by a viewer that links addresses by itself (GitHub's flavour); its
//    text is then its target, so nothing is hidden behind other words.
//  - **The method above the results** (PLAN-METHODEN.md 2): its name and its short description, in a line of their
//    own under the date, so a reader knows how the notes came about.
//  - **The results of the counted votes** (stage M2), under the method: each a ranking with places and points, and a
//    line that names how it was counted (points with a budget, choices, Borda, the mean of scores) and how many
//    ballots there were. Never a single ballot, never who voted (PLAN-METHODEN.md 4). A vote that is not counted is
//    not in the file at all. A counted estimate (stage M3) is its round's summary: the median, the middle half, the
//    range and how many estimated, with the unit; from the second round on, how the median and the middle half
//    moved since the round before. Never a single estimate.
//  - **The reasons of a method that asks for them** (the notes beside a first estimate, stage M3) stand under
//    „Begründungen“ instead of „Zettel“, without names like every note.
//  - **The fixed words in the language of whoever asks** (`de` or `en`, as „Ordnen“ takes it: a wall has no
//    language of its own). They stand in the table below and nowhere else; the Worker writes the file, so they
//    cannot come from the app's string tables.

/** What one export is made from: the wall as it is stored, who asks, when, and in which language. */
export interface ExportInput {
  question: string;
  /** The method the wall runs: its name and short description stand above the results. */
  methodId: MethodId;
  /** What is seen of the others' notes (domain/agenda.ts, `noteLevel`). */
  sight: NoteLevel;
  /** Every note of the wall, with its writer: what of it goes into the file is decided here, by `notesFor`. */
  notes: readonly StoredNote[];
  groups: readonly Group[];
  /** The results of the wall's counted votes, in the order of their steps. Left out: none. */
  results?: readonly VoteResult[];
  /** The participant the export is for. */
  viewer: string;
  /** The moment of the export, milliseconds since 1970: the date in the file and in its name. */
  at: number;
  language: ArrangeLanguage;
}

/** How a vote was counted, in a sentence: what the file names above a ranking. */
const COUNTED_DE: Record<VoteKind, (limit: number) => string> = {
  dots: (limit) => `Gezählt nach Punkten: ${limit === 1 ? "1 Punkt" : `${limit} Punkte`} je Person, frei verteilt.`,
  approval: (limit) => `Gezählt nach Zustimmung: bis zu ${limit} Stimmen je Person, eine je Option.`,
  rank: (limit) =>
    `Gezählt nach Borda: Jede Person ordnet ihre ersten ${limit}, Platz 1 bekommt ${limit} Punkte, der letzte 1.`,
  score: () => "Gezählt als Mittelwert der Bewertungen von 1 bis 5.",
};
const COUNTED_EN: Record<VoteKind, (limit: number) => string> = {
  dots: (limit) => `Counted by points: ${limit === 1 ? "1 point" : `${limit} points`} a person, spread freely.`,
  approval: (limit) => `Counted by approval: up to ${limit} votes a person, one per option.`,
  rank: (limit) => `Counted by Borda: everyone ranks their first ${limit}, place 1 gets ${limit} points, the last 1.`,
  score: () => "Counted as the mean of scores from 1 to 5.",
};

const WORDS = {
  de: {
    reasons: "Begründungen",
    round: (n: number) => `Schätzung, Runde ${n}`,
    estimated: (n: number) =>
      `Verdeckt geschätzt, zugleich ausgezählt: ${n === 1 ? "1 Schätzung" : `${n} Schätzungen`}.`,
    noEstimate: "Niemand hat geschätzt.",
    median: (value: string) => `Median: ${value}`,
    middle: (from: string, to: string) => `Mittlere Hälfte: ${from} bis ${to}`,
    range: (from: string, to: string) => `Spanne: ${from} bis ${to}`,
    moved: (round: number, from: string, to: string, widthFrom: string, widthTo: string) =>
      `Gegenüber Runde ${round}: Median von ${from} auf ${to}, mittlere Hälfte von ${widthFrom} auf ${widthTo} breit`,
    stand: (date: string) => `IdeaBeam · Stand: ${date}`,
    hidden: (count: number) =>
      count === 1
        ? "Die Zettel sind noch verdeckt: Hier stehen nur deine. 1 Zettel der anderen fehlt."
        : `Die Zettel sind noch verdeckt: Hier stehen nur deine. ${count} Zettel der anderen fehlen.`,
    none: "Noch keine Zettel.",
    noneOwn: "Noch keine Zettel von dir.",
    untitled: "Ohne Titel",
    emptyGroup: "Keine Zettel in dieser Gruppe.",
    ungrouped: "Ohne Gruppe",
    notes: "Zettel",
    own: "Deine Zettel",
    result: "Ergebnis der Wahl",
    resultOf: (step: number) => `Ergebnis der Wahl (Schritt ${step})`,
    counted: (kind: VoteKind, limit: number, voters: number) =>
      `${COUNTED_DE[kind](limit)} Verdeckt abgegeben, zugleich ausgezählt: ${voters === 1 ? "1 Stimmzettel" : `${voters} Stimmzettel`}.`,
    place: (rank: number, label: string, amount: string) => `Platz ${rank}: ${label} · ${amount}`,
    amount: (kind: VoteKind, points: number, by: number) =>
      kind === "score"
        ? by === 0
          ? "keine Bewertung"
          : `Mittelwert ${String(points).replace(".", ",")}`
        : kind === "approval"
          ? points === 1
            ? "1 Stimme"
            : `${points} Stimmen`
          : points === 1
            ? "1 Punkt"
            : `${points} Punkte`,
  },
  en: {
    reasons: "Reasons",
    round: (n: number) => `Estimate, round ${n}`,
    estimated: (n: number) => `Estimated in secret, counted at once: ${n === 1 ? "1 estimate" : `${n} estimates`}.`,
    noEstimate: "Nobody estimated.",
    median: (value: string) => `Median: ${value}`,
    middle: (from: string, to: string) => `Middle half: ${from} to ${to}`,
    range: (from: string, to: string) => `Range: ${from} to ${to}`,
    moved: (round: number, from: string, to: string, widthFrom: string, widthTo: string) =>
      `Since round ${round}: median from ${from} to ${to}, middle half from ${widthFrom} to ${widthTo} wide`,
    stand: (date: string) => `IdeaBeam · As of ${date}`,
    hidden: (count: number) =>
      count === 1
        ? "The notes are still hidden: only yours are here. 1 note by the others is left out."
        : `The notes are still hidden: only yours are here. ${count} notes by the others are left out.`,
    none: "No notes yet.",
    noneOwn: "No notes of yours yet.",
    untitled: "Untitled",
    emptyGroup: "No notes in this group.",
    ungrouped: "Without a group",
    notes: "Notes",
    own: "Your notes",
    result: "Result of the vote",
    resultOf: (step: number) => `Result of the vote (step ${step})`,
    counted: (kind: VoteKind, limit: number, voters: number) =>
      `${COUNTED_EN[kind](limit)} Cast in secret, counted at once: ${voters === 1 ? "1 ballot" : `${voters} ballots`}.`,
    place: (rank: number, label: string, amount: string) => `Place ${rank}: ${label} · ${amount}`,
    amount: (kind: VoteKind, points: number, by: number) =>
      kind === "score"
        ? by === 0
          ? "not scored"
          : `mean ${points}`
        : kind === "approval"
          ? points === 1
            ? "1 vote"
            : `${points} votes`
          : points === 1
            ? "1 point"
            : `${points} points`,
  },
} as const;

/** The day of a moment in UTC, as the language writes a date: „25.11.2026“, „2026-11-25“. UTC, so the Worker and a
 *  test write the same day wherever they run. */
export function exportDate(at: number, language: ArrangeLanguage): string {
  const iso = new Date(at).toISOString().slice(0, 10);
  if (language === "en") return iso;
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

// Every ASCII character with a meaning in CommonMark or GitHub's flavour wherever it stands, where a backslash takes
// it away: emphasis, code and strikethrough (`*`, `_`, `` ` ``, `~`), links and images (`[`, `]`: without them `(`,
// `)` and `!` mean nothing), HTML and autolinks (`<`, `>`), headings (`#`), tables (`|`), the escape itself (`\`).
// `&` only where it would begin an entity (`&amp;`, `&#38;`). `+`, `-`, `=` and a number followed by `.` or `)`
// mean something only where a line begins: they are taken care of there. Plain punctuation stays as it is, so the
// file still reads well as text.
const INLINE = /[\\`*_~[\]<>#|]|&(?=#?[0-9A-Za-z]+;)/g;

/** A text a person typed, as Markdown that shows exactly that text and does nothing else, on one line. */
export function escapeMarkdown(text: string): string {
  const line = text
    // every kind of line break, also the Unicode ones a list item would break at, and tabs, which could indent
    .replace(/[\r\n\u2028\u2029\u0085\t\v\f]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(INLINE, (char) => `\\${char}`);
  // where the item's text begins: a list marker, a setext underline, an ordered list's number
  return line.replace(/^([+\-=])/, "\\$1").replace(/^(\d+)([.)])/, "$1\\$2");
}

/** A number of an estimate as the language writes it: „2,5“ and „1.200“, „2.5“ and „1,200“; at most two places
 *  after the point. The app writes the same (components/Estimate.tsx). */
export function estimateNumber(value: number, language: ArrangeLanguage): string {
  return new Intl.NumberFormat(language === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 }).format(value);
}

/** The lines of a counted estimate: its heading, how many estimated, and its summary; `before`, the summary of the
 *  round before it, for how it moved. */
function estimateLines(
  result: EstimateResult,
  round: number,
  before: EstimateSummary | null,
  language: ArrangeLanguage,
): string[] {
  const words = WORDS[language];
  const unit = result.unit === null ? "" : ` ${escapeMarkdown(result.unit)}`;
  const num = (value: number) => estimateNumber(value, language);
  const lines = [`## ${words.round(round)}`, ""];
  const summary = result.summary;
  if (summary === null) return [...lines, `_${words.noEstimate}_`, ""];
  lines.push(`_${words.estimated(summary.n)}_`, "");
  lines.push(`- ${words.median(num(summary.median) + unit)}`);
  lines.push(`- ${words.middle(num(summary.q1), num(summary.q3) + unit)}`);
  lines.push(`- ${words.range(num(summary.min), num(summary.max) + unit)}`);
  if (before !== null) {
    lines.push(
      `- ${words.moved(
        round - 1,
        num(before.median),
        num(summary.median) + unit,
        num(before.q3 - before.q1),
        num(summary.q3 - summary.q1) + unit,
      )}`,
    );
  }
  return [...lines, ""];
}

/** The wall as one person may see it, as a Markdown document. */
export function wallMarkdown(input: ExportInput): string {
  const words = WORDS[input.language];
  const view = notesFor(input.notes, input.sight, input.viewer);
  const groups = [...input.groups].sort((a, b) => a.ord - b.ord || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const notes = [...view.notes].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const known = new Set(groups.map((group) => group.id));
  const inGroup = new Map<string, string[]>();
  const loose: string[] = [];
  for (const note of notes) {
    // a note whose group is gone counts as in none, as in the list
    if (note.groupId === null || !known.has(note.groupId)) loose.push(note.text);
    else inGroup.set(note.groupId, [...(inGroup.get(note.groupId) ?? []), note.text]);
  }
  const writing = input.sight !== "all";
  const method = methodTexts(input.language, input.methodId);

  const lines: string[] = [
    `# ${escapeMarkdown(input.question)}`,
    "",
    `_${words.stand(exportDate(input.at, input.language))}_`,
    "",
    `**${escapeMarkdown(method.name)}:** ${escapeMarkdown(method.short)}`,
    "",
  ];
  const results = input.results ?? [];
  const rankings = results.filter((result) => result.kind !== "estimate");
  let rounds = 0;
  let before: EstimateSummary | null = null;
  for (const result of results) {
    if (result.kind === "estimate") {
      rounds += 1;
      lines.push(...estimateLines(result, rounds, before, input.language));
      before = result.summary;
      continue;
    }
    lines.push(`## ${rankings.length === 1 ? words.result : words.resultOf(result.step + 1)}`, "");
    lines.push(`_${words.counted(result.kind, result.limit, result.voters)}_`, "");
    for (const row of result.rows) {
      const label = row.label.trim() === "" ? words.untitled : escapeMarkdown(row.label);
      lines.push(`- ${words.place(row.rank, label, words.amount(result.kind, row.points, row.by))}`);
    }
    lines.push("");
  }
  if (writing && view.hidden > 0) lines.push(`_${words.hidden(view.hidden)}_`, "");
  if (notes.length === 0 && groups.length === 0) lines.push(`_${writing ? words.noneOwn : words.none}_`, "");

  for (const group of groups) {
    const title = group.title.trim() === "" ? words.untitled : escapeMarkdown(group.title);
    lines.push(`## ${title}`, "");
    const texts = inGroup.get(group.id) ?? [];
    if (texts.length === 0) lines.push(`_${words.emptyGroup}_`);
    for (const text of texts) lines.push(`- ${escapeMarkdown(text)}`);
    lines.push("");
  }
  if (loose.length > 0) {
    // on a wall without groups these are simply its notes; while the notes are hidden, one's own (as the list says)
    const reasons = CATALOGUE[input.methodId].steps.some((step) => step.noteKind === "reason");
    lines.push(
      `## ${groups.length > 0 ? words.ungrouped : writing ? words.own : reasons ? words.reasons : words.notes}`,
      "",
    );
    for (const text of loose) lines.push(`- ${escapeMarkdown(text)}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

/** The file's name: the question in letters, digits and hyphens, at most 60 of them, and the day of the export.
 *  ASCII alone, so it stands in a `Content-Disposition` header as it is and every system can save it. */
export function exportFileName(question: string, at: number): string {
  const safe = question
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${safe || "IdeaBeam"}-${new Date(at).toISOString().slice(0, 10)}.md`;
}
