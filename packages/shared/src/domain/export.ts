// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { criterionName, methodAttribution, methodTexts, roleTexts, stepName } from "../methods/texts.js";
import type { ArrangeLanguage, Group } from "../protocol.js";
import { keepsSteps } from "./agenda.js";
import type { MethodId, Step } from "./method.js";
import { areaAt, roleOf, teamCounts, type TeamArea, type Teams } from "./teams.js";
import { notesFor, type Seen, type StoredNote } from "./visibility.js";
import { CATALOGUE } from "../methods/catalogue.js";
import type { ConsentResult, EstimateResult, EstimateSummary, RankingResult, VoteResult } from "./vote.js";

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
//  - **Teams by their count alone** (stage M4): how many teams each step in pairs or small groups had, never who was
//    in them; the notes the teams wrote stand like every note, once a step shows them to everybody (the presenting
//    of „1-2-4-Alle“). While a step of teams lasts, a person's file holds their own notes and their team's.
//  - **The attribution a method's licence asks for** (Liberating Structures, CC BY-SA 4.0), under its description.
//  - **Notes by the step they were written in** (stage M5), for a method of more than one round of writing or with
//    actions: the notes in no group stand under the name of their step (the goal, the facts, the reasons, each round
//    of „Was? Na und? Was nun?“), in the order of the steps; groups stand as before. The actions the moderation
//    agreed on stand last, as task lines with who does them and by when (`- [ ] … — Wer: …, bis: …`), as typed and
//    escaped like every text; an action nobody agreed on stays a note of its step. A note still waiting for its turn
//    is left out like a hidden one, and a line says how many are.
//  - **Stage M6:** a score with criteria as a table, the mean per criterion and the total for every option, never a
//    single score; a consent round as how many gave each answer and the reasons of the objections, sorted, never who
//    answered what; the decisions the moderation recorded, each with who decided (the moderation), its reasons, the
//    objections still open and the review date; the measurable results it recorded, as a nested list under the goal
//    each belongs to, with target, owner and review date; and, in a step whose teams have roles, the notes of each
//    team under its role (from the team's area, as the list has them), never who was in it.
//  - **The fixed words in the language of whoever asks** (`de` or `en`, as „Ordnen“ takes it: a wall has no
//    language of its own). They stand in the table below and nowhere else; the Worker writes the file, so they
//    cannot come from the app's string tables.

/** What one export is made from: the wall as it is stored, who asks, when, and in which language. */
export interface ExportInput {
  question: string;
  /** The method the wall runs: its name and short description stand above the results. */
  methodId: MethodId;
  /** What is seen of the others' notes (domain/flow.ts, `sightOf`): one level, or a level per note (stage M5). */
  sight: Seen;
  /** The wall's steps as it stores them (its agenda): the names of the steps the notes were written in, and which take
   *  actions. Left out: the catalogue's steps of the method. */
  steps?: readonly Step[];
  /** Every note of the wall, with its writer: what of it goes into the file is decided here, by `notesFor`. */
  notes: readonly StoredNote[];
  groups: readonly Group[];
  /** The results of the wall's counted votes, in the order of their steps. Left out: none. */
  results?: readonly VoteResult[];
  /** The wall's teams (stage M4): who sees what in a step of teams, and how many teams each step had. Left out:
   *  none. */
  teams?: Teams | null;
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
    consent: "Zustimmungsrunde",
    answered: (n: number) => `Verdeckt abgegeben, zugleich ausgezählt: ${n === 1 ? "1 Antwort" : `${n} Antworten`}.`,
    agree: (n: number) => `Zustimmung: ${n}`,
    live: (n: number) => `Kann damit leben: ${n}`,
    object: (n: number) => `Einwand: ${n}`,
    objections: "Einwände",
    table: { place: "Platz", option: "Option", total: "Gesamt", by: "Bewertet von" },
    decisions: "Entscheidungen",
    decidedBy: "Entschieden von: der Moderation",
    why: "Begründung",
    open: "Offene Einwände",
    review: "Prüftermin",
    goals: "Ziele und messbare Ergebnisse",
    goal: (label: string) => `Ziel: ${label}`,
    noGoal: "Ohne Ziel",
    target: "Zielwert",
    owner: "Verantwortlich",
    team: (step: string, n: number, role: string) => `${step} · Team ${n}: ${role}`,
    reasons: "Begründungen",
    agreed: "Festgelegte Aktionen",
    who: "Wer",
    due: "bis",
    hiddenSome: (count: number) =>
      count === 1
        ? "1 Zettel ist noch verdeckt und fehlt hier."
        : `${count} Zettel sind noch verdeckt und fehlen hier.`,
    teams: (parts: string) => `In Teams gearbeitet: ${parts}.`,
    teamCount: (step: string, n: number) => `${step}: ${n === 1 ? "1 Team" : `${n} Teams`}`,
    hiddenTeam: (count: number) =>
      count === 1
        ? "Die Teams arbeiten noch für sich: Hier stehen deine Zettel und die deines Teams. 1 Zettel der anderen fehlt."
        : `Die Teams arbeiten noch für sich: Hier stehen deine Zettel und die deines Teams. ${count} Zettel der anderen fehlen.`,
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
    ownTeam: "Deine Zettel und die deines Teams",
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
    consent: "Consent round",
    answered: (n: number) => `Answered in secret, counted at once: ${n === 1 ? "1 answer" : `${n} answers`}.`,
    agree: (n: number) => `Agree: ${n}`,
    live: (n: number) => `Can live with it: ${n}`,
    object: (n: number) => `Objection: ${n}`,
    objections: "Objections",
    table: { place: "Place", option: "Option", total: "Overall", by: "Rated by" },
    decisions: "Decisions",
    decidedBy: "Decided by: the moderation",
    why: "Reasons",
    open: "Open objections",
    review: "Review date",
    goals: "Goals and measurable results",
    goal: (label: string) => `Goal: ${label}`,
    noGoal: "Without a goal",
    target: "Target",
    owner: "Owner",
    team: (step: string, n: number, role: string) => `${step} · team ${n}: ${role}`,
    reasons: "Reasons",
    agreed: "Agreed actions",
    who: "Who",
    due: "by",
    hiddenSome: (count: number) =>
      count === 1 ? "1 note is still hidden and left out here." : `${count} notes are still hidden and left out here.`,
    teams: (parts: string) => `Worked in teams: ${parts}.`,
    teamCount: (step: string, n: number) => `${step}: ${n === 1 ? "1 team" : `${n} teams`}`,
    hiddenTeam: (count: number) =>
      count === 1
        ? "The teams still work on their own: your notes and your team's are here. 1 note by the others is left out."
        : `The teams still work on their own: your notes and your team's are here. ${count} notes by the others are left out.`,
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
    ownTeam: "Your notes and your team's",
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

/** The lines of a counted consent round (stage M6): how many answered, how many gave each answer, and the reasons of
 *  the objections as the result has them (sorted). */
function consentLines(result: ConsentResult, language: ArrangeLanguage): string[] {
  const words = WORDS[language];
  const lines = [`## ${words.consent}`, "", `_${words.answered(result.voters)}_`, ""];
  lines.push(`- ${words.agree(result.agree)}`, `- ${words.live(result.live)}`, `- ${words.object(result.object)}`);
  if (result.objections.length > 0) {
    lines.push(`- ${words.objections}:`);
    for (const reason of result.objections) lines.push(`  - ${escapeMarkdown(reason)}`);
  }
  return [...lines, ""];
}

/** The words of a score's criteria (stage M6): those frozen with the result (notes), else the step's own keys in the
 *  language. None: one score for an option. */
function criteriaWords(result: RankingResult, steps: readonly Step[], methodId: MethodId, language: ArrangeLanguage) {
  if (result.criteria !== undefined) return result.criteria;
  const vote = steps[result.step]?.vote;
  return vote?.kind === "score" ? vote.criteria.map((key) => criterionName(language, methodId, key)) : [];
}

/** A number of a mean as the language writes it: „3,5“, „3.5“. */
function meanNumber(value: number, language: ArrangeLanguage): string {
  return language === "de" ? String(value).replace(".", ",") : String(value);
}

/** A counted score with criteria as a Markdown table (stage M6): place, option, the mean per criterion, the total and
 *  how many scored it. Never a single score. */
function scoreTable(result: RankingResult, criteria: readonly string[], language: ArrangeLanguage): string[] {
  const words = WORDS[language];
  const head = [
    words.table.place,
    words.table.option,
    ...criteria.map(escapeMarkdown),
    words.table.total,
    words.table.by,
  ];
  const lines = [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`];
  for (const row of result.rows) {
    const label = row.label.trim() === "" ? words.untitled : escapeMarkdown(row.label);
    const cells =
      row.by === 0 ? criteria.map(() => "–") : criteria.map((_, at) => meanNumber(row.scores?.[at] ?? 0, language));
    const total = row.by === 0 ? "–" : meanNumber(row.points, language);
    lines.push(`| ${[String(row.rank), label, ...cells, total, String(row.by)].join(" | ")} |`);
  }
  return lines;
}

/** The areas of the teams a step had (stage M6, the notes of a step with roles by team), or null. */
function areasOf(teams: Teams | null | undefined, step: number): readonly TeamArea[] | null {
  if (teams === null || teams === undefined) return null;
  if (teams.step === step) return teams.areas;
  const entry = [...teams.history].reverse().find((one) => one.step === step);
  return entry?.areas ?? null;
}

/** The wall as one person may see it, as a Markdown document. */
export function wallMarkdown(input: ExportInput): string {
  const words = WORDS[input.language];
  const view = notesFor(input.notes, input.sight, input.viewer, input.teams);
  const groups = [...input.groups].sort((a, b) => a.ord - b.ord || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const notes = [...view.notes].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const known = new Set(groups.map((group) => group.id));
  const steps = input.steps ?? CATALOGUE[input.methodId].steps;
  // a method of more than one round of writing, or with actions, lists its notes by the step they were written in
  const actionSteps = new Set(steps.flatMap((step, at) => (step.noteKind === "action" ? [at] : [])));
  const decisionSteps = new Set(steps.flatMap((step, at) => (step.noteKind === "decision" ? [at] : [])));
  const resultSteps = new Set(steps.flatMap((step, at) => (step.noteKind === "result" ? [at] : [])));
  const sectioned = keepsSteps(steps);
  // the actions the moderation agreed on: as task lines at the end, nowhere else; the decisions and the measurable
  // results it recorded (stage M6) in sections of their own before them
  const recordedIn = (kinds: Set<number>) =>
    sectioned ? notes.filter((note) => note.action !== undefined && kinds.has(note.step ?? 0)) : [];
  const agreed = recordedIn(actionSteps);
  const decided = recordedIn(decisionSteps);
  const measured = recordedIn(resultSteps);
  const recorded = new Set([...agreed, ...decided, ...measured]);
  const inGroup = new Map<string, string[]>();
  const loose: string[] = [];
  const looseBy = new Map<number, string[]>();
  for (const note of notes) {
    if (recorded.has(note)) continue;
    // a note whose group is gone counts as in none, as in the list
    if (note.groupId === null || !known.has(note.groupId)) {
      loose.push(note.text);
      looseBy.set(note.step ?? 0, [...(looseBy.get(note.step ?? 0) ?? []), note.text]);
    } else inGroup.set(note.groupId, [...(inGroup.get(note.groupId) ?? []), note.text]);
  }
  const writing = typeof input.sight === "string" ? input.sight !== "all" : view.hidden > 0;
  const method = methodTexts(input.language, input.methodId);

  const lines: string[] = [
    `# ${escapeMarkdown(input.question)}`,
    "",
    `_${words.stand(exportDate(input.at, input.language))}_`,
    "",
    `**${escapeMarkdown(method.name)}:** ${escapeMarkdown(method.short)}`,
    "",
  ];
  const attribution = methodAttribution(input.language, input.methodId);
  if (attribution !== null) lines.push(`_${escapeMarkdown(`${attribution.credit} ${attribution.licence}`)}_`, "");
  const counts = teamCounts(input.teams);
  if (counts.length > 0) {
    const parts = counts.map(({ step, teams }) =>
      words.teamCount(stepName(input.language, input.methodId, steps[step]?.key ?? ""), teams),
    );
    lines.push(`_${escapeMarkdown(words.teams(parts.join("; ")))}_`, "");
  }
  const results = input.results ?? [];
  const rankings = results.filter(
    (result): result is RankingResult => result.kind !== "estimate" && result.kind !== "consent",
  );
  let rounds = 0;
  let before: EstimateSummary | null = null;
  for (const result of results) {
    if (result.kind === "estimate") {
      rounds += 1;
      lines.push(...estimateLines(result, rounds, before, input.language));
      before = result.summary;
      continue;
    }
    if (result.kind === "consent") {
      lines.push(...consentLines(result, input.language));
      continue;
    }
    lines.push(`## ${rankings.length === 1 ? words.result : words.resultOf(result.step + 1)}`, "");
    lines.push(`_${words.counted(result.kind, result.limit, result.voters)}_`, "");
    const criteria = criteriaWords(result, steps, input.methodId, input.language);
    if (result.kind === "score" && criteria.length > 0) {
      lines.push(...scoreTable(result, criteria, input.language), "");
      continue;
    }
    for (const row of result.rows) {
      const label = row.label.trim() === "" ? words.untitled : escapeMarkdown(row.label);
      lines.push(`- ${words.place(row.rank, label, words.amount(result.kind, row.points, row.by))}`);
    }
    lines.push("");
  }
  if (writing && view.hidden > 0) {
    const said =
      typeof input.sight !== "string"
        ? words.hiddenSome(view.hidden)
        : input.sight === "team"
          ? words.hiddenTeam(view.hidden)
          : words.hidden(view.hidden);
    lines.push(`_${said}_`, "");
  }
  if (notes.length === 0 && groups.length === 0) lines.push(`_${writing ? words.noneOwn : words.none}_`, "");

  for (const group of groups) {
    const title = group.title.trim() === "" ? words.untitled : escapeMarkdown(group.title);
    lines.push(`## ${title}`, "");
    const texts = inGroup.get(group.id) ?? [];
    if (texts.length === 0) lines.push(`_${words.emptyGroup}_`);
    for (const text of texts) lines.push(`- ${escapeMarkdown(text)}`);
    lines.push("");
  }
  if (sectioned) {
    // by the step they were written in, in the order of the steps; in a step whose teams have roles (stage M6), by
    // team, as the list has them: by the team's area the note lies in
    const looseNotes = notes.filter(
      (note) => !recorded.has(note) && (note.groupId === null || !known.has(note.groupId)),
    );
    for (const [step, texts] of [...looseBy.entries()].sort((a, b) => a[0] - b[0])) {
      const name = stepName(input.language, input.methodId, steps[step]?.key ?? "");
      const areas = steps[step]?.team?.roles === undefined ? null : areasOf(input.teams, step);
      if (areas !== null) {
        const byTeam = new Map<number | null, string[]>();
        for (const note of looseNotes.filter((one) => (one.step ?? 0) === step)) {
          const team = areaAt(areas, note);
          byTeam.set(team, [...(byTeam.get(team) ?? []), note.text]);
        }
        for (const [team, inTeam] of [...byTeam.entries()].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))) {
          const role = team === null ? null : roleOf(steps[step] ?? {}, team);
          const words2 = role === null ? null : roleTexts(input.language, input.methodId, role);
          const heading = team === null || words2 === null ? name : words.team(name, team + 1, words2.name);
          lines.push(`## ${escapeMarkdown(heading)}`, "");
          for (const text of inTeam) lines.push(`- ${escapeMarkdown(text)}`);
          lines.push("");
        }
        continue;
      }
      lines.push(`## ${escapeMarkdown(name)}`, "");
      for (const text of texts) lines.push(`- ${escapeMarkdown(text)}`);
      lines.push("");
    }
    if (decided.length > 0) {
      lines.push(`## ${words.decisions}`, "");
      for (const note of decided) {
        lines.push(`- ${escapeMarkdown(note.text)}`, `  - ${words.decidedBy}`);
        if (note.action?.why) lines.push(`  - ${words.why}: ${escapeMarkdown(note.action.why)}`);
        if (note.action?.open) lines.push(`  - ${words.open}: ${escapeMarkdown(note.action.open)}`);
        if (note.action?.due) lines.push(`  - ${words.review}: ${escapeMarkdown(note.action.due)}`);
      }
      lines.push("");
    }
    if (measured.length > 0) {
      lines.push(`## ${words.goals}`, "");
      // the goals in the order of the vote on them, then the results without one
      const order = new Map<string, { rank: number; label: string }>();
      for (const result of rankings) {
        for (const row of result.rows) if (!order.has(row.id)) order.set(row.id, { rank: row.rank, label: row.label });
      }
      const goals = [...new Set(measured.map((note) => note.action?.goal ?? null))].sort((a, b) => {
        const [x, y] = [a === null ? undefined : order.get(a), b === null ? undefined : order.get(b)];
        return (x?.rank ?? Number.POSITIVE_INFINITY) - (y?.rank ?? Number.POSITIVE_INFINITY);
      });
      for (const goal of goals) {
        const label = goal === null ? undefined : order.get(goal)?.label;
        lines.push(
          `- ${goal === null || label === undefined ? words.noGoal : words.goal(label.trim() === "" ? words.untitled : escapeMarkdown(label))}`,
        );
        for (const note of measured.filter((one) => (one.action?.goal ?? null) === goal)) {
          const parts = [
            ...(note.action?.target ? [`${words.target}: ${escapeMarkdown(note.action.target)}`] : []),
            ...(note.action?.who ? [`${words.owner}: ${escapeMarkdown(note.action.who)}`] : []),
            ...(note.action?.due ? [`${words.review}: ${escapeMarkdown(note.action.due)}`] : []),
          ];
          lines.push(`  - [ ] ${escapeMarkdown(note.text)}${parts.length > 0 ? ` — ${parts.join(", ")}` : ""}`);
        }
      }
      lines.push("");
    }
    if (agreed.length > 0) {
      lines.push(`## ${words.agreed}`, "");
      for (const note of agreed) {
        const parts = [
          ...(note.action?.who ? [`${words.who}: ${escapeMarkdown(note.action.who)}`] : []),
          ...(note.action?.due ? [`${words.due}: ${escapeMarkdown(note.action.due)}`] : []),
        ];
        lines.push(`- [ ] ${escapeMarkdown(note.text)}${parts.length > 0 ? ` — ${parts.join(", ")}` : ""}`);
      }
      lines.push("");
    }
  } else if (loose.length > 0) {
    // on a wall without groups these are simply its notes; while the notes are hidden, one's own (as the list says)
    const reasons = steps.some((step) => step.noteKind === "reason");
    lines.push(
      `## ${groups.length > 0 ? words.ungrouped : writing ? (input.sight === "team" ? words.ownTeam : words.own) : reasons ? words.reasons : words.notes}`,
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
