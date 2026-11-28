// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  agendaOf,
  ballotSchema,
  CATALOGUE,
  checkAgenda,
  checkBallot,
  criteriaOf,
  criteriaSteps,
  decide,
  decideBallot,
  enterTeams,
  fieldBoxes,
  keepsSteps,
  METHOD_TEXTS,
  noteActionSchema,
  openRound,
  optionsSteps,
  readerOf,
  roleOf,
  roleTeamCount,
  stepContext,
  tally,
  voteResultSchema,
  wallMarkdown,
  writingFrom,
  type Ballot,
  type MethodId,
  type Note,
  type RankingResult,
  type ResolvedAgenda,
  type StoredNote,
  type Teams,
  type VoteRound,
} from "../src/index.js";

// Stage M6 (PLAN-METHODEN.md 5, „Paket B“): the score with criteria (the step's own or notes), roles of teams, the
// consent round, decisions and measurable results recorded in a step of type `decide`, fixed fields, and the five
// methods with them (plus the quick „Nutzen und Aufwand“). The frames on the server:
// apps/worker/test/methods-m6.test.ts.

const id = (letter: string) => letter.repeat(32);
const ANNA = id("a");
const BEN = id("b");
const NOW = 1_795_300_000_000;
const M6: MethodId[] = ["kriterien", "nutzen-aufwand", "gegenposition", "entscheidung", "annahmen", "ziele"];

const stored = (letter: string, authorId: string, more: Partial<StoredNote> = {}): StoredNote => ({
  id: id(letter),
  authorId,
  text: `Note ${letter}`,
  x: 0,
  y: 0,
  groupId: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...more,
});

describe("the methods of stage M6", () => {
  it("every one runs, and says the words of its own criteria, roles and fields in both languages", () => {
    for (const methodId of M6) {
      expect(checkAgenda(agendaOf(methodId)), methodId).toEqual([]);
      for (const language of ["de", "en"] as const) {
        const texts = METHOD_TEXTS[language].methods[methodId];
        for (const step of CATALOGUE[methodId].steps) {
          if (step.vote?.kind === "score") {
            for (const key of step.vote.criteria) expect(texts.criteria?.[key], `${methodId} ${key}`).toBeTruthy();
          }
          for (const role of step.team?.roles ?? []) expect(texts.roles?.[role]?.name, role).toBeTruthy();
          // every step says what to do now (stage M5's `hint`)
          expect(texts.steps[step.key]?.hint, `${methodId} ${step.key} ${language}`).toBeTruthy();
        }
        for (const field of CATALOGUE[methodId].fields ?? []) expect(texts.fields?.[field], field).toBeTruthy();
      }
    }
  });

  it("„Ziele mit messbaren Ergebnissen“ is never called by the name it is widely known by", () => {
    for (const language of ["de", "en"] as const) {
      const texts = METHOD_TEXTS[language].methods.ziele;
      expect(JSON.stringify(texts)).not.toMatch(/OKR|Objectives and Key Results/);
    }
  });

  it("„Kriterienbewertung“: criteria in private, agreed, options for everybody, a score with the criteria of notes", () => {
    const steps = CATALOGUE.kriterien.steps;
    expect(steps.map((step) => step.type)).toEqual(["write", "discuss", "write", "score", "discuss", "decide"]);
    expect(steps.map((step) => step.visibility)).toEqual(["hidden", "all", "all", "aggregate", "all", "all"]);
    const agenda = agendaOf("kriterien");
    expect(criteriaSteps(agenda.steps, 3)).toEqual([0, 1]);
    expect(optionsSteps(agenda.steps, 3)).toEqual([2]);
    // the notes keep their step, and the options count from the first step: they are seen by everybody at once
    expect(keepsSteps(agenda.steps)).toBe(true);
    expect(writingFrom(agenda.steps, 2)).toBe(0);
  });

  it("„Nutzen und Aufwand“ scores value and low effort, „Annahmen prüfen“ harm and how little is known", () => {
    expect(CATALOGUE["nutzen-aufwand"].steps[1]?.vote).toEqual({ kind: "score", criteria: ["value", "ease"] });
    expect(CATALOGUE.annahmen.steps[2]?.vote).toEqual({ kind: "score", criteria: ["harm", "unknown"] });
    // the assumptions written alone and those added while they are bundled
    expect(optionsSteps(agendaOf("annahmen").steps, 2)).toEqual([0, 1]);
    expect(CATALOGUE.annahmen.fields).toEqual(["customers", "problem", "solution", "money", "delivery"]);
  });

  it("„Entscheidungsprotokoll“: a consent round about the proposal's notes, before the reactions are revealed", () => {
    const steps = CATALOGUE.entscheidung.steps;
    expect(steps.map((step) => step.type)).toEqual([
      "present",
      "write",
      "discuss",
      "write",
      "consent",
      "discuss",
      "decide",
    ]);
    expect(steps[4]?.vote).toEqual({ kind: "consent" });
    expect(optionsSteps(agendaOf("entscheidung").steps, 4)).toEqual([1]);
    expect(steps[6]?.noteKind).toBe("decision");
  });

  it("the checks of an agenda refuse criteria from no step, criteria nobody has seen, and roles that are not formed anew", () => {
    const base = agendaOf("kriterien");
    const unknown: ResolvedAgenda = {
      ...base,
      steps: base.steps.map((step, at) => (at === 3 ? { ...step, criteriaFrom: ["nope"] } : step)),
    };
    expect(checkAgenda(unknown)).toContainEqual({ kind: "criteriaShape", step: 3 });
    // criteria written in private and never shown before the score
    const unseen: ResolvedAgenda = {
      items: base.items,
      steps: [base.steps[0], base.steps[3]].flatMap((step) => {
        if (step === undefined) return [];
        if (step.key !== "score") return [step];
        // without its options, so that only the criteria are in question
        const rest = { ...step, criteriaFrom: ["criteria"] };
        delete rest.optionsFrom;
        return [rest];
      }),
    };
    expect(checkAgenda(unseen)).toContainEqual({ kind: "criteriaShape", step: 1 });
    const ownCriteria: ResolvedAgenda = {
      ...base,
      steps: base.steps.map((step, at) =>
        at === 3 ? { ...step, vote: { kind: "score" as const, criteria: ["cost"] } } : step,
      ),
    };
    expect(checkAgenda(ownCriteria)).toContainEqual({ kind: "criteriaShape", step: 3 });
    const roles: ResolvedAgenda = {
      ...agendaOf("gegenposition"),
      steps: agendaOf("gegenposition").steps.map((step) =>
        step.team === undefined ? step : { ...step, team: { ...step.team, form: "keep" as const } },
      ),
    };
    expect(checkAgenda(roles)).toContainEqual({ kind: "teamShape", step: 2 });
  });
});

describe("the score with criteria (stage M6)", () => {
  const options = [
    { id: id("1"), kind: "note" as const },
    { id: id("2"), kind: "note" as const },
  ];

  it("takes the first five criteria notes in the order they were written, and counts the rest", () => {
    const notes = ["f", "e", "d", "c", "b", "a"].map((letter, at) => ({
      id: id(letter),
      text: `Kriterium ${letter}`,
      createdAt: NOW + (5 - at),
    }));
    expect(criteriaOf(notes)).toEqual({
      criteria: ["Kriterium a", "Kriterium b", "Kriterium c", "Kriterium d", "Kriterium e"],
      omitted: 1,
    });
    const round = openRound(3, { kind: "score", criteria: [] }, { notes: [], groups: [] }, true, criteriaOf(notes));
    expect(round.criteria).toHaveLength(5);
    expect(round.criteriaOmitted).toBe(1);
  });

  it("asks one score per criterion of the round, and counts the mean per criterion and the total", () => {
    const round: VoteRound = {
      step: 3,
      options,
      omitted: 0,
      limit: 2,
      counted: false,
      criteria: ["Kosten", "Nutzen"],
    };
    const config = { kind: "score" as const, criteria: [] };
    const ballot = (one: number[], two?: number[]): Ballot => ({
      kind: "score",
      scores: { [id("1")]: one, ...(two === undefined ? {} : { [id("2")]: two }) },
    });
    expect(checkBallot(round, config, ballot([4, 5]))).toBe(true);
    expect(checkBallot(round, config, ballot([4]))).toBe(false);
    expect(checkBallot(round, config, ballot([4, 5, 1]))).toBe(false);
    const result = tally(round, config, [ballot([4, 5], [1, 2]), ballot([2, 4], [3, 3])], () => "x");
    expect(result.criteria).toEqual(["Kosten", "Nutzen"]);
    expect(result.rows[0]).toMatchObject({ id: id("1"), scores: [3, 4.5], points: 3.75, by: 2, rank: 1 });
    expect(result.rows[1]).toMatchObject({ id: id("2"), scores: [2, 2.5], points: 2.25, by: 2, rank: 2 });
    expect(voteResultSchema.safeParse(result).success).toBe(true);
  });

  it("with the step's own criteria, as before: no words in the round or the result", () => {
    const round = openRound(1, { kind: "score", criteria: ["value", "ease"] }, { notes: [], groups: [] }, true);
    expect(round.criteria).toBeUndefined();
    expect(
      checkBallot(
        { ...round, options },
        { kind: "score", criteria: ["value", "ease"] },
        {
          kind: "score",
          scores: { [id("1")]: [5, 2] },
        },
      ),
    ).toBe(true);
  });
});

describe("the consent round (stage M6)", () => {
  const config = { kind: "consent" as const };
  const round: VoteRound = { step: 4, options: [{ id: id("1"), kind: "note" }], omitted: 0, limit: 1, counted: false };

  it("an objection needs its reason, and no other answer has one", () => {
    expect(checkBallot(round, config, { kind: "consent", answer: "agree" })).toBe(true);
    expect(checkBallot(round, config, { kind: "consent", answer: "live" })).toBe(true);
    expect(checkBallot(round, config, { kind: "consent", answer: "object", reason: "Zu teuer" })).toBe(true);
    expect(checkBallot(round, config, { kind: "consent", answer: "object" })).toBe(false);
    expect(checkBallot(round, config, { kind: "consent", answer: "agree", reason: "Gut" })).toBe(false);
    // a reason is one line, and not empty
    expect(ballotSchema.safeParse({ kind: "consent", answer: "object", reason: "a\nb" }).success).toBe(false);
    expect(ballotSchema.safeParse({ kind: "consent", answer: "object", reason: "  " }).success).toBe(false);
    expect(ballotSchema.safeParse({ kind: "consent", answer: "maybe" }).success).toBe(false);
  });

  it("the same answer twice is one; another answer changes it", () => {
    const flow = { step: 4, votes: [round] };
    const steps = agendaOf("entscheidung").steps;
    const agree: Ballot = { kind: "consent", answer: "agree" };
    expect(decideBallot(flow, steps, { step: 4, ballot: agree }, agree)).toEqual({ kind: "unchanged" });
    expect(decideBallot(flow, steps, { step: 4, ballot: { kind: "consent", answer: "live" } }, agree)).toMatchObject({
      kind: "changed",
    });
    expect(decideBallot(flow, steps, { step: 3, ballot: agree }, null)).toEqual({ kind: "refused", code: "STALE" });
  });

  it("counts the answers and lists the objections' reasons sorted, never who gave them", () => {
    const result = tally(
      round,
      config,
      [
        { kind: "consent", answer: "object", reason: "Zu teuer" },
        { kind: "consent", answer: "agree" },
        { kind: "consent", answer: "object", reason: "Abhängig von einem Anbieter" },
        { kind: "consent", answer: "live" },
        // does not fit: counts for nothing
        { kind: "consent", answer: "object" },
      ],
      () => "",
    );
    expect(result).toEqual({
      step: 4,
      kind: "consent",
      voters: 4,
      agree: 1,
      live: 1,
      object: 2,
      objections: ["Abhängig von einem Anbieter", "Zu teuer"],
    });
    expect(voteResultSchema.safeParse(result).success).toBe(true);
  });
});

describe("teams with roles (stage M6)", () => {
  it("as many teams as roles, more only past the largest team, fewer only where two a role do not come", () => {
    expect(roleTeamCount(4, 2)).toBe(2);
    expect(roleTeamCount(5, 2)).toBe(2);
    expect(roleTeamCount(12, 2)).toBe(2);
    expect(roleTeamCount(14, 2)).toBe(2);
    expect(roleTeamCount(15, 2)).toBe(4);
    expect(roleTeamCount(3, 2)).toBe(1);
    expect(roleTeamCount(0, 2)).toBe(0);
  });

  it("„Gegenposition prüfen“ forms two teams of the people present, the first against, the second the assumptions", () => {
    const step = CATALOGUE.gegenposition.steps[2] ?? { team: undefined };
    const people = ["a", "b", "c", "d", "e", "f"].map(id);
    const teams = enterTeams(null, step, 2, people, 7, NOW) as Teams;
    expect(teams.teams).toHaveLength(2);
    expect(teams.teams.map((team) => team.length)).toEqual([3, 3]);
    expect(roleOf(step, 0)).toBe("against");
    expect(roleOf(step, 1)).toBe("assumptions");
    expect(roleOf(step, 2)).toBe("against");
    expect(roleOf({ team: { size: 2, form: "random" } }, 0)).toBeNull();
  });
});

describe("decisions and measurable results recorded in a step of type `decide` (stage M6)", () => {
  const note = (step: number, more: Partial<Note> = {}): Note => ({
    id: id("5"),
    mine: false,
    text: "Wir nehmen Anbieter B",
    x: 0,
    y: 0,
    groupId: null,
    createdAt: NOW,
    updatedAt: NOW,
    step,
    ...more,
  });
  const record = (action: Record<string, string>) =>
    ({ type: "note.action", opId: id("0"), noteId: id("5"), action: { who: "", due: "", ...action } }) as const;

  it("a decision takes its reasons, the objections still open and a review date, and no „Wer“", () => {
    const agenda = agendaOf("entscheidung");
    const ctx = stepContext(agenda, { step: 6, reach: 6 });
    const wall = readerOf({ notes: [note(6)], groups: [] });
    expect(
      decide(
        wall,
        record({ why: "Günstiger", open: "Datenschutz klären", due: "1. März" }),
        { id: ANNA, role: "admin" },
        NOW,
        ctx,
      ),
    ).toMatchObject({
      kind: "changed",
      change: { type: "note.action", action: { why: "Günstiger", open: "Datenschutz klären", due: "1. März" } },
    });
    expect(decide(wall, record({ who: "Anna" }), { id: ANNA, role: "admin" }, NOW, ctx)).toEqual({
      kind: "refused",
      code: "INVALID",
    });
    expect(decide(wall, record({ target: "von 3 auf 1" }), { id: ANNA, role: "admin" }, NOW, ctx)).toEqual({
      kind: "refused",
      code: "INVALID",
    });
    expect(decide(wall, record({ why: "x" }), { id: BEN, role: "member" }, NOW, ctx)).toEqual({
      kind: "refused",
      code: "NOT_ADMIN",
    });
    // the same record again changes nothing
    const recorded = readerOf({
      notes: [note(6, { action: { who: "", due: "1. März", why: "Günstiger" } })],
      groups: [],
    });
    expect(
      decide(recorded, record({ why: "Günstiger", due: "1. März" }), { id: ANNA, role: "admin" }, NOW, ctx),
    ).toEqual({ kind: "unchanged" });
  });

  it("a measurable result takes its owner, target, goal and review date; an action takes none of the new fields", () => {
    const ziele = agendaOf("ziele");
    const ctx = stepContext(ziele, { step: 6, reach: 6 });
    const wall = readerOf({ notes: [note(4)], groups: [] });
    expect(
      decide(
        wall,
        {
          ...record({ who: "Ben", target: "von 3 auf 1 Tag", due: "Ende März" }),
          action: { who: "Ben", due: "Ende März", target: "von 3 auf 1 Tag", goal: id("9") },
        },
        { id: ANNA, role: "admin" },
        NOW,
        ctx,
      ),
    ).toMatchObject({ kind: "changed" });
    expect(decide(wall, record({ why: "x" }), { id: ANNA, role: "admin" }, NOW, ctx)).toEqual({
      kind: "refused",
      code: "INVALID",
    });
    const annahmen = stepContext(agendaOf("annahmen"), { step: 5, reach: 5 });
    const test = readerOf({ notes: [note(4)], groups: [] });
    expect(
      decide(test, record({ who: "Ben", due: "Freitag" }), { id: ANNA, role: "admin" }, NOW, annahmen),
    ).toMatchObject({
      kind: "changed",
    });
    expect(decide(test, record({ target: "x" }), { id: ANNA, role: "admin" }, NOW, annahmen)).toEqual({
      kind: "refused",
      code: "INVALID",
    });
  });

  it("the record's texts are one line each and have their lengths", () => {
    expect(noteActionSchema.safeParse({ who: "", due: "", why: "a\nb" }).success).toBe(false);
    expect(noteActionSchema.safeParse({ who: "", due: "", why: "x".repeat(301) }).success).toBe(false);
    expect(noteActionSchema.safeParse({ who: "", due: "", target: "x".repeat(61) }).success).toBe(false);
    expect(noteActionSchema.safeParse({ who: "", due: "", goal: "nope" }).success).toBe(false);
  });
});

describe("fixed fields (stage M6)", () => {
  it("five frames, three over two, none overlapping", () => {
    const boxes = fieldBoxes(5);
    expect(boxes).toHaveLength(5);
    expect(new Set(boxes.slice(0, 3).map((box) => box.y)).size).toBe(1);
    expect(new Set(boxes.slice(3).map((box) => box.y)).size).toBe(1);
    expect(boxes[3]?.y).toBeGreaterThan(boxes[0]?.y ?? 0);
    for (const [at, a] of boxes.entries()) {
      for (const b of boxes.slice(at + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }
    }
  });
});

describe("the export of the methods of stage M6", () => {
  const base = { question: "Welcher Anbieter?", viewer: ANNA, at: NOW, language: "de" as const, groups: [] };

  it("a score with criteria as a table of means, never a single score", () => {
    const result: RankingResult = {
      step: 3,
      kind: "score",
      limit: 2,
      voters: 2,
      criteria: ["Kosten | Preis", "Nutzen"],
      rows: [
        { id: id("1"), kind: "note", label: "Anbieter A", points: 3.75, by: 2, rank: 1, scores: [3, 4.5] },
        { id: id("2"), kind: "note", label: "Anbieter B", points: 0, by: 0, rank: 2, scores: [] },
      ],
    };
    const text = wallMarkdown({
      ...base,
      methodId: "kriterien",
      sight: { levels: agendaOf("kriterien").steps.map(() => "all"), shown: new Set() },
      steps: agendaOf("kriterien").steps,
      notes: [],
      results: [result],
    });
    expect(text).toContain("| Platz | Option | Kosten \\| Preis | Nutzen | Gesamt | Bewertet von |");
    expect(text).toContain("| 1 | Anbieter A | 3 | 4,5 | 3,75 | 2 |");
    expect(text).toContain("| 2 | Anbieter B | – | – | – | 0 |");
  });

  it("the step's own criteria in the language of whoever asks", () => {
    const steps = agendaOf("nutzen-aufwand").steps;
    const result: RankingResult = {
      step: 1,
      kind: "score",
      limit: 1,
      voters: 1,
      rows: [{ id: id("1"), kind: "note", label: "Option", points: 4, by: 1, rank: 1, scores: [5, 3] }],
    };
    const common = {
      ...base,
      methodId: "nutzen-aufwand" as const,
      sight: "all" as const,
      steps,
      notes: [],
      results: [result],
    };
    expect(wallMarkdown(common)).toContain("| Platz | Option | Nutzen | Geringer Aufwand | Gesamt | Bewertet von |");
    expect(wallMarkdown({ ...common, language: "en" })).toContain(
      "| Place | Option | Value | Low effort | Overall | Rated by |",
    );
  });

  it("the consent round, the decision with who decided, its reasons, open objections and review date", () => {
    const agenda = agendaOf("entscheidung");
    const text = wallMarkdown({
      ...base,
      methodId: "entscheidung",
      sight: { levels: agenda.steps.map(() => "all"), shown: new Set() },
      steps: agenda.steps,
      notes: [
        stored("1", BEN, { text: "Anbieter B nehmen", step: 1 }),
        stored("2", ANNA, {
          text: "Wir nehmen Anbieter B",
          step: 6,
          action: { who: "", due: "1. März", why: "Günstiger", open: "Datenschutz klären" },
        }),
      ],
      results: [{ step: 4, kind: "consent", voters: 3, agree: 1, live: 1, object: 1, objections: ["Zu teuer"] }],
    });
    expect(text).toContain("## Zustimmungsrunde");
    expect(text).toContain("_Verdeckt abgegeben, zugleich ausgezählt: 3 Antworten._");
    expect(text).toContain("- Zustimmung: 1\n- Kann damit leben: 1\n- Einwand: 1\n- Einwände:\n  - Zu teuer");
    expect(text).toContain(
      "## Entscheidungen\n\n- Wir nehmen Anbieter B\n  - Entschieden von: der Moderation\n  - Begründung: Günstiger\n  - Offene Einwände: Datenschutz klären\n  - Prüftermin: 1\\. März",
    );
    expect(text).toContain("## Vorschlag vorstellen\n\n- Anbieter B nehmen");
    expect(text).not.toMatch(/\bAnna\b|\bBen\b/);
  });

  it("the measurable results nested under their goals, in the order of the vote; the rest under no goal", () => {
    const agenda = agendaOf("ziele");
    const text = wallMarkdown({
      ...base,
      language: "en",
      methodId: "ziele",
      sight: { levels: agenda.steps.map(() => "all"), shown: new Set() },
      steps: agenda.steps,
      notes: [
        stored("1", BEN, {
          text: "Reply time",
          step: 4,
          action: { who: "Ben", due: "March", target: "from 3 days to 1", goal: id("8") },
        }),
        stored("2", BEN, { text: "Fewer tickets", step: 4, action: { who: "", due: "", goal: id("9") } }),
        stored("3", BEN, { text: "Loose result", step: 4, action: { who: "", due: "" } }),
      ],
      results: [
        {
          step: 3,
          kind: "approval",
          limit: 3,
          voters: 2,
          rows: [
            { id: id("9"), kind: "group", label: "Calmer support", points: 2, by: 2, rank: 1 },
            { id: id("8"), kind: "group", label: "Faster support", points: 1, by: 1, rank: 2 },
          ],
        },
      ],
    });
    expect(text).toContain(
      "## Goals and measurable results\n\n- Goal: Calmer support\n  - [ ] Fewer tickets\n- Goal: Faster support\n  - [ ] Reply time — Target: from 3 days to 1, Owner: Ben, Review date: March\n- Without a goal\n  - [ ] Loose result",
    );
  });

  it("the notes of a step whose teams have roles, under each team and its role, never who was in it", () => {
    const agenda = agendaOf("gegenposition");
    const teams: Teams = {
      rev: 1,
      step: 2,
      seed: 1,
      teams: [[ANNA], [BEN]],
      areas: [
        { first: 0, count: 1 },
        { first: 1, count: 1 },
      ],
      history: [],
      seq: 0,
    };
    const text = wallMarkdown({
      ...base,
      methodId: "gegenposition",
      sight: { levels: agenda.steps.map(() => "all"), shown: new Set() },
      steps: agenda.steps,
      notes: [
        stored("1", ANNA, { text: "Zu teuer", step: 2, x: 16, y: 1300 }),
        stored("2", BEN, { text: "Kunden wollen es", step: 2, x: 912, y: 1300 }),
      ],
      teams,
    });
    expect(text).toContain("## Rollen: Schwächen suchen, Annahmen aufschreiben · Team 1: Gegenposition\n\n- Zu teuer");
    expect(text).toContain(
      "## Rollen: Schwächen suchen, Annahmen aufschreiben · Team 2: Annahmen\n\n- Kunden wollen es",
    );
    expect(text).not.toMatch(/\bAnna\b|\bBen\b/);
  });
});
