// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Method, MethodId, Step } from "../domain/method.js";

// The catalogue of methods as code data (docs/architektur-methoden.md 1). The words of each method, in German and
// English, stand in methods/texts.ts; a test holds both against this list, and a method without its name and short
// description in both languages does not build (PLAN-METHODEN.md 2).
//
// Three methods so far:
//
//  - „Still sammeln, bündeln, verdeckt wählen“ (docs/methoden-katalog.md, method 2), complete since stage M2
//    (version 2: its vote). Its first step of the catalogue, „Frage stellen“, is part of „Ideen schreiben“ here: a
//    wall shows its question from the start, and people write from the moment they arrive, hidden, as every wall
//    with hidden writing did before. So a wall starts where it starts today, and revealing is one step on. The vote
//    gives points, a quarter of the options a person and at least two, hidden and all at once; the options are the
//    groups after „Bündeln“, and the notes in no group (domain/vote.ts). Version 1 (stage M1, without the vote)
//    stands on no wall outside the tests: a wall keeps the copy it was made with (domain/agenda.ts).
//  - „Schätzen – Diskutieren – Schätzen“ (method 5, stage M3): everyone estimates a number in secret, with a short
//    reason beside it; the moderation counts, and everyone sees the median, the middle half and the range, never a
//    single estimate; the reasons are shown, without names; the group discusses the differences; everyone
//    estimates again, seeing only the first round's summary; the result shows both rounds. Its first step of the
//    catalogue, „Schätzfrage stellen“, is part of the first estimate, as „Frage stellen“ is part of „Ideen
//    schreiben“: the wall shows its question from the start. „Abweichungen besprechen“ is the catalogue's step in
//    small groups; until stage M4 brings pairs and small groups it is a step for everyone (`plenary`). The unit
//    (`unit`) is the moderation's, named on `/neu` (domain/agenda.ts); no bounds.
//  - „1-2-4-Alle“ (method 3, stage M4, from Liberating Structures, CC BY-SA 4.0 with the attribution of
//    methods/texts.ts): everyone thinks and writes alone for a minute, hidden; then in pairs, which the app forms at
//    random from the people present, each pair seeing its own notes; then the pairs are merged into fours, each four
//    seeing its notes and finding what matters most; then every four presents its core idea to everybody, and every
//    note is there for everyone. Its first step of the catalogue, „Frage stellen“, is part of the writing, as in
//    „Still sammeln“: four steps instead of five, about 15 minutes instead of 16. The three short steps move on by
//    themselves when their time is up (`advance: "auto"`, the owner's decision 2: only in short, timed methods
//    like this one); the moderation starts the first clock, and can pause a clock, switch a step's moving on off,
//    or press „Weiter“ at any time. The presenting has no clock and waits for „Weiter“, of which there is none:
//    it is the last step.
//  - „Freie Wand“: one step, writing and arranging, every note there for everyone at once: the wall made without
//    hidden writing.
//
// Stage M5 (PLAN-METHODEN.md 5, „Paket A“), from the catalogue's methods 1, 8, 4 and 10:
//
//  - „Rückblick nach Ziel und Daten“ (method 1): the goal and then the facts and numbers, each written in private;
//    revealed; small groups find reasons for the gap; the groups present and bundle them; everybody proposes actions
//    in private; the actions are revealed; everybody votes on them with points; the moderation agrees on up to three,
//    each with „Wer“ and „Bis wann“. The catalogue's „Einstimmen“ is the wall's question (which names what and which
//    period), its „Abschluss“ part of agreeing on the actions: nine steps instead of ten. The catalogue votes on the
//    actions while they are hidden; a vote never offers what nobody has seen, so a short step reveals them first
//    (`revealActions`). Its texts say that the data step asks for facts and numbers, from records rather than memory,
//    and claim nothing about why the method works (docs/belege-pruefung.md: the benefit found comes from objective
//    data, not from the comparison with a goal).
//  - „Scheitern vorwegdenken“ (method 8): the plan is presented (nobody writes); everybody imagines it has failed and
//    writes in private why (the catalogue's prompt is the step's own sentence: one step instead of two); the reasons
//    are revealed one at a time, by turn, without names (`turns`); they are bundled into risks; the plan is adjusted:
//    the changes are actions, which the moderation agrees on with „Wer“ and „Bis wann“.
//  - „Stille Ideenrunde mit Rangfolge“ (method 4): everybody collects ideas in private (the question is the wall's:
//    „Frage stellen“ is part of it); the ideas are revealed one at a time, by turn; they are clarified, without
//    judging, and the same ideas may be bundled; everybody ranks their top five in private (Borda; fewer places where
//    there are fewer ideas, and the step is named „Die wichtigsten ranken“ since stage M6 for that reason); the result.
//  - „Was? Na und? Was nun?“ (method 10, from Liberating Structures, CC BY-SA 4.0 with the attribution of
//    methods/texts.ts): three rounds, „Was ist passiert?“, „Was bedeutet das?“, „Was tun wir jetzt?“, each alone
//    and hidden, then in small groups of about five, then presented to everybody. The small groups are formed at
//    random in the first round and kept for the next two (`keep`), each round with areas of its own. The catalogue's
//    „Einführung“ is the wall's question. Every step waits for „Weiter“ (the owner's decision 2: moving on by itself
//    only in short, timed methods like 1-2-4-Alle).
//
// Stage M6 (PLAN-METHODEN.md 5, „Paket B“), from the catalogue's methods 6, 7, 9, 11 and 12:
//
//  - „Kriterienbewertung“ (method 6): everybody proposes criteria in private, before the options are talked about;
//    the criteria are revealed and agreed on (the notes that stand when the score begins are the criteria, the first
//    five in the order they were written: `criteriaFrom`); the options are written and presented, for everybody at
//    once; everybody scores every option on every criterion from 1 to 5, in private (`score`, equal weights); the
//    moderation counts, and everybody sees the means per criterion and the total, never a single score; the group
//    talks about where it lies apart; the moderation records the overall judgement last, a departure from the result
//    with its reasons (`decision`). The catalogue's „Summe zeigen“ is the counting of the score: six steps instead of
//    seven. The result shows no spread: with few people a spread would tell single scores.
//  - „Nutzen und Aufwand“: the catalogue's quick variant of method 6 as a method of its own, so that it stands on
//    `/neu` with its own time: the criteria are fixed (`value`, the benefit; `ease`, how little effort, so that 5 is
//    the best on both and the mean ranks as it should), the steps of the criteria fall away: four steps, 20 minutes.
//  - „Gegenposition prüfen“ (method 7): the proposal is presented (nobody writes); everybody notes their own doubts in
//    private; two small groups with roles (`roles`): one looks for weaknesses and counter-assumptions, the other writes
//    down the proposal's assumptions (each group sees its members' doubts there); the groups present, every note is
//    there for everybody; the moderation records what holds and what changes (`decision`).
//  - „Entscheidungsprotokoll mit Zustimmungsrunde“ (method 9): the frame (what is decided, by when; the moderation
//    decides, in v1); the proposal, written as notes for everybody; questions to understand it; reactions in private;
//    the consent round („Sicher genug, um es auszuprobieren?“: agree, can live with it, objection with its reason,
//    hidden until counted, about the proposal's notes: `optionsFrom`); the objections and reactions revealed and
//    worked in; the moderation records the decision with its reasons, the objections still open and a review date,
//    and speaks last.
//  - „Annahmen prüfen“ (method 11): a canvas of our own, five fields the wall begins with (`fields`: customers,
//    problem, solution, money, delivery, three over two); the catalogue's „Vorhaben in einem Satz“ is the wall's
//    question. Everybody writes assumptions in private into the fields; they are revealed and bundled; everybody scores
//    each assumption on two axes, how bad it would be if wrong and how little is known about it (`harm`, `unknown`:
//    the catalogue's „Wie gut belegt?“ asked the other way round, so that 5 means risky on both and the mean ranks the
//    riskiest first); the riskiest are discussed; small groups design a test for each (actions); the tests are
//    presented and the moderation agrees on each with who and by when. Six steps instead of seven.
//  - „Ziele mit messbaren Ergebnissen“ (method 12; the name it is widely known by is not used): the period and the
//    direction are presented; goals in private; revealed and bundled; everybody chooses up to three (`approval`);
//    small groups write measurable results; they present; the moderation records each result with who answers for
//    it, its target, the goal it belongs to and the date to check it (`result`).
//
// A step's capabilities (what may be done in it) follow from its type and visibility (domain/agenda.ts).

const MINUTE = 60;

/** The three steps of a round of „Was? Na und? Was nun?“: alone and hidden, in the small group, presented. */
function roundOfThree(prefix: "what" | "soWhat" | "nowWhat", form: "random" | "keep"): Method["steps"] {
  return [
    {
      key: `${prefix}Alone`,
      type: "write",
      mode: "individual",
      visibility: "hidden",
      durationSec: 1 * MINUTE,
      advance: "moderation",
      output: "notes",
    },
    {
      key: `${prefix}Group`,
      type: "discuss",
      mode: "group",
      visibility: "team",
      durationSec: 5 * MINUTE,
      advance: "moderation",
      output: "notes",
      team: { size: 5, form },
    },
    {
      key: `${prefix}Present`,
      type: "discuss",
      mode: "presentation",
      visibility: "all",
      durationSec: 3 * MINUTE,
      advance: "moderation",
      output: "notes",
    },
  ];
}

/** A step of a method of stage M6 in few words: what it does, how, who sees, its minutes, what it makes; the rest as
 *  its own fields. Every step waits for „Weiter“. */
function step(
  key: string,
  type: Step["type"],
  mode: Step["mode"],
  visibility: Step["visibility"],
  minutes: number,
  output: Step["output"],
  rest: Partial<Step> = {},
): Step {
  return { key, type, mode, visibility, durationSec: minutes * MINUTE, advance: "moderation", output, ...rest };
}

export const CATALOGUE: Readonly<Record<MethodId, Method>> = {
  "still-sammeln": {
    id: "still-sammeln",
    version: 2,
    purpose: "collect",
    steps: [
      {
        key: "write",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 7 * MINUTE,
        advance: "moderation",
        output: "notes",
      },
      {
        key: "reveal",
        type: "reveal",
        mode: "plenary",
        visibility: "all",
        durationSec: 1 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "cluster",
        type: "cluster",
        mode: "plenary",
        visibility: "all",
        durationSec: 6 * MINUTE,
        advance: "moderation",
        output: "groups",
      },
      {
        key: "vote",
        type: "vote",
        mode: "individual",
        visibility: "aggregate",
        durationSec: 3 * MINUTE,
        advance: "moderation",
        output: "ranking",
        vote: { kind: "dots", perPerson: null, maxPerOption: null },
      },
      {
        key: "discuss",
        type: "discuss",
        mode: "plenary",
        visibility: "all",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "none",
      },
    ],
    minutes: 25,
    groupSize: [3, 30],
  },
  "eins-zwei-vier": {
    id: "eins-zwei-vier",
    version: 1,
    purpose: "collect",
    steps: [
      {
        key: "alone",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 1 * MINUTE,
        advance: "auto",
        output: "notes",
      },
      {
        key: "pairs",
        type: "discuss",
        mode: "pair",
        visibility: "team",
        durationSec: 2 * MINUTE,
        advance: "auto",
        output: "notes",
        team: { size: 2, form: "random" },
      },
      {
        key: "fours",
        type: "discuss",
        mode: "group",
        visibility: "team",
        durationSec: 5 * MINUTE,
        advance: "auto",
        output: "notes",
        team: { size: 4, form: "merge" },
      },
      {
        key: "present",
        type: "discuss",
        mode: "presentation",
        visibility: "all",
        durationSec: 7 * MINUTE,
        advance: "moderation",
        output: "notes",
      },
    ],
    minutes: 15,
    groupSize: [4, 30],
    attribution: "liberatingStructures",
  },
  schaetzen: {
    id: "schaetzen",
    version: 1,
    purpose: "decide",
    steps: [
      {
        key: "estimate1",
        type: "estimate",
        mode: "individual",
        visibility: "aggregate",
        durationSec: 4 * MINUTE,
        advance: "moderation",
        output: "estimate",
        vote: { kind: "estimate", unit: null, min: null, max: null },
        noteKind: "reason",
      },
      {
        key: "feedback",
        type: "reveal",
        mode: "plenary",
        visibility: "anonymous",
        durationSec: 3 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "discuss",
        type: "discuss",
        mode: "plenary",
        visibility: "all",
        durationSec: 8 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "estimate2",
        type: "estimate",
        mode: "individual",
        visibility: "aggregate",
        durationSec: 3 * MINUTE,
        advance: "moderation",
        output: "estimate",
        vote: { kind: "estimate", unit: null, min: null, max: null },
      },
      {
        key: "result",
        type: "discuss",
        mode: "plenary",
        visibility: "aggregate",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "none",
      },
    ],
    minutes: 25,
    groupSize: [5, 30],
  },
  rueckblick: {
    id: "rueckblick",
    version: 1,
    purpose: "review",
    steps: [
      {
        key: "goal",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 4 * MINUTE,
        advance: "moderation",
        output: "notes",
      },
      {
        key: "data",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 6 * MINUTE,
        advance: "moderation",
        output: "notes",
      },
      {
        key: "reveal",
        type: "reveal",
        mode: "plenary",
        visibility: "anonymous",
        durationSec: 2 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "reasons",
        type: "discuss",
        mode: "group",
        visibility: "team",
        durationSec: 10 * MINUTE,
        advance: "moderation",
        output: "notes",
        team: { size: 4, form: "random" },
      },
      {
        key: "present",
        type: "cluster",
        mode: "presentation",
        visibility: "all",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "groups",
      },
      {
        key: "actions",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 4 * MINUTE,
        advance: "moderation",
        output: "actions",
        noteKind: "action",
      },
      {
        key: "revealActions",
        type: "reveal",
        mode: "plenary",
        visibility: "anonymous",
        durationSec: 1 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "vote",
        type: "vote",
        mode: "individual",
        visibility: "aggregate",
        durationSec: 3 * MINUTE,
        advance: "moderation",
        output: "ranking",
        vote: { kind: "dots", perPerson: null, maxPerOption: null },
        optionsFrom: "actions",
      },
      {
        key: "decide",
        type: "decide",
        mode: "plenary",
        visibility: "all",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "actions",
        noteKind: "action",
      },
    ],
    minutes: 45,
    groupSize: [3, 12],
  },
  scheitern: {
    id: "scheitern",
    version: 1,
    purpose: "risk",
    steps: [
      {
        key: "plan",
        type: "present",
        mode: "presentation",
        visibility: "all",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "reasons",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 8 * MINUTE,
        advance: "moderation",
        output: "notes",
      },
      {
        key: "reveal",
        type: "reveal",
        mode: "plenary",
        visibility: "anonymous",
        durationSec: 8 * MINUTE,
        advance: "moderation",
        output: "none",
        turns: true,
      },
      {
        key: "risks",
        type: "cluster",
        mode: "plenary",
        visibility: "anonymous",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "groups",
      },
      {
        key: "adjust",
        type: "decide",
        mode: "plenary",
        visibility: "all",
        durationSec: 8 * MINUTE,
        advance: "moderation",
        output: "actions",
        noteKind: "action",
      },
    ],
    minutes: 35,
    groupSize: [3, 12],
  },
  ideenrunde: {
    id: "ideenrunde",
    version: 1,
    purpose: "decide",
    steps: [
      {
        key: "collect",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 10 * MINUTE,
        advance: "moderation",
        output: "notes",
      },
      {
        key: "reveal",
        type: "reveal",
        mode: "plenary",
        visibility: "anonymous",
        durationSec: 10 * MINUTE,
        advance: "moderation",
        output: "none",
        turns: true,
      },
      {
        key: "clarify",
        type: "discuss",
        mode: "plenary",
        visibility: "anonymous",
        durationSec: 8 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "rank",
        type: "rank",
        mode: "individual",
        visibility: "aggregate",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "ranking",
        vote: { kind: "rank", top: 5 },
      },
      {
        key: "result",
        type: "discuss",
        mode: "plenary",
        visibility: "all",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "none",
      },
    ],
    minutes: 40,
    groupSize: [4, 10],
  },
  "was-na-und": {
    id: "was-na-und",
    version: 1,
    purpose: "review",
    steps: [...roundOfThree("what", "random"), ...roundOfThree("soWhat", "keep"), ...roundOfThree("nowWhat", "keep")],
    minutes: 30,
    groupSize: [4, 30],
    attribution: "liberatingStructures",
  },
  kriterien: {
    id: "kriterien",
    version: 1,
    purpose: "decide",
    steps: [
      step("criteria", "write", "individual", "hidden", 3, "notes", { noteKind: "criterion" }),
      step("agree", "discuss", "plenary", "all", 5, "notes", { noteKind: "criterion" }),
      step("options", "write", "presentation", "all", 5, "notes"),
      step("score", "score", "individual", "aggregate", 10, "ranking", {
        vote: { kind: "score", criteria: [] },
        optionsFrom: "options",
        criteriaFrom: ["criteria", "agree"],
      }),
      step("discuss", "discuss", "plenary", "all", 10, "none"),
      step("decide", "decide", "plenary", "all", 5, "decisions", { noteKind: "decision" }),
    ],
    minutes: 40,
    groupSize: [3, 12],
  },
  "nutzen-aufwand": {
    id: "nutzen-aufwand",
    version: 1,
    purpose: "decide",
    steps: [
      step("options", "write", "presentation", "all", 5, "notes"),
      step("score", "score", "individual", "aggregate", 6, "ranking", {
        vote: { kind: "score", criteria: ["value", "ease"] },
      }),
      step("discuss", "discuss", "plenary", "all", 5, "none"),
      step("decide", "decide", "plenary", "all", 4, "decisions", { noteKind: "decision" }),
    ],
    minutes: 20,
    groupSize: [3, 12],
  },
  gegenposition: {
    id: "gegenposition",
    version: 1,
    purpose: "decide",
    steps: [
      step("proposal", "present", "presentation", "all", 5, "none"),
      step("doubts", "write", "individual", "hidden", 3, "notes"),
      step("roles", "discuss", "group", "team", 10, "notes", {
        team: { size: 6, form: "random", roles: ["against", "assumptions"] },
      }),
      step("present", "discuss", "presentation", "all", 7, "notes"),
      step("decide", "decide", "plenary", "all", 10, "decisions", { noteKind: "decision" }),
    ],
    minutes: 35,
    groupSize: [4, 12],
  },
  entscheidung: {
    id: "entscheidung",
    version: 1,
    purpose: "decide",
    steps: [
      step("frame", "present", "plenary", "all", 5, "none"),
      step("proposal", "write", "presentation", "all", 5, "notes"),
      step("questions", "discuss", "plenary", "all", 5, "none"),
      step("reactions", "write", "individual", "hidden", 4, "notes"),
      step("consent", "consent", "individual", "aggregate", 5, "ballots", {
        vote: { kind: "consent" },
        optionsFrom: "proposal",
      }),
      step("objections", "discuss", "plenary", "all", 10, "notes"),
      step("record", "decide", "plenary", "all", 5, "decisions", { noteKind: "decision" }),
    ],
    minutes: 40,
    groupSize: [3, 12],
  },
  annahmen: {
    id: "annahmen",
    version: 1,
    purpose: "plan",
    steps: [
      step("collect", "write", "individual", "hidden", 8, "notes"),
      step("reveal", "cluster", "plenary", "all", 7, "groups"),
      step("rate", "score", "individual", "aggregate", 6, "ranking", {
        vote: { kind: "score", criteria: ["harm", "unknown"] },
        optionsFrom: ["collect", "reveal"],
      }),
      step("discuss", "discuss", "plenary", "all", 8, "none"),
      step("tests", "discuss", "group", "team", 10, "actions", {
        noteKind: "action",
        team: { size: 3, form: "random" },
      }),
      step("present", "decide", "presentation", "all", 6, "actions", { noteKind: "action" }),
    ],
    minutes: 45,
    groupSize: [3, 12],
    fields: ["customers", "problem", "solution", "money", "delivery"],
  },
  ziele: {
    id: "ziele",
    version: 1,
    purpose: "plan",
    steps: [
      step("period", "present", "presentation", "all", 3, "none"),
      step("goals", "write", "individual", "hidden", 6, "notes", { noteKind: "goal" }),
      step("cluster", "cluster", "plenary", "all", 6, "groups"),
      step("pick", "vote", "individual", "aggregate", 3, "ranking", {
        vote: { kind: "approval", max: 3 },
      }),
      step("results", "discuss", "group", "team", 12, "notes", {
        noteKind: "result",
        team: { size: 3, form: "random" },
      }),
      step("present", "discuss", "presentation", "all", 8, "notes", { noteKind: "result" }),
      step("agree", "decide", "plenary", "all", 6, "goals", { noteKind: "result" }),
    ],
    minutes: 45,
    groupSize: [3, 15],
  },
  free: {
    id: "free",
    version: 1,
    purpose: "none",
    steps: [
      {
        key: "wall",
        type: "cluster",
        mode: "plenary",
        visibility: "all",
        durationSec: null,
        advance: "moderation",
        output: "groups",
      },
    ],
    minutes: null,
    groupSize: [1, 30],
  },
};

/** The methods in the order of the choice on `/neu` (docs/methoden-katalog.md, (b)): by purpose, the one that is
 *  chosen at first leading, „Freie Wand“ last. */
export const METHOD_ORDER: readonly MethodId[] = [
  "still-sammeln",
  "eins-zwei-vier",
  "ideenrunde",
  "kriterien",
  "nutzen-aufwand",
  "schaetzen",
  "gegenposition",
  "entscheidung",
  "ziele",
  "annahmen",
  "rueckblick",
  "was-na-und",
  "scheitern",
  "free",
];

/** The method a new wall gets when nothing else is asked: the best supported one (PLAN-METHODEN.md 3). */
export const DEFAULT_METHOD: MethodId = "still-sammeln";
