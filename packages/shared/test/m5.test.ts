// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  agendaOf,
  CATALOGUE,
  capabilities,
  checkAgenda,
  decide,
  decideStep,
  decideTurn,
  enterTeams,
  keepsSteps,
  levelFor,
  maySeeStored,
  noteFor,
  notesFor,
  readerOf,
  revealedFor,
  revealOrder,
  shownByTurn,
  sightOf,
  stepContext,
  stepReveals,
  turnViewOf,
  wallMarkdown,
  writingFrom,
  type Flow,
  type Note,
  type ResolvedAgenda,
  type StoredNote,
  type Teams,
  type TurnRound,
} from "../src/index.js";

// Stage M5 (PLAN-METHODEN.md 5, „Paket A“): revealing by turn, a later round of writing that hides again while what
// was shown stays shown, teams kept from round to round, votes over the notes of one step, and actions with „Wer“
// and „Bis wann“. The frames on the server: apps/worker/test/methods-m5.test.ts.

const id = (letter: string) => letter.repeat(32);
const ANNA = id("a");
const BEN = id("b");
const CEM = id("c");
const NOW = 1_795_300_000_000;

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

const flowAt = (step: number, reach = step, more: Partial<Flow> = {}): Flow => ({
  v: 2,
  step,
  reach,
  clock: { rev: 0, endsAt: null, leftMs: null },
  seq: 0,
  ...more,
});

describe("the four methods of stage M5", () => {
  it("can run, and the ones that ask for new notes after showing keep the step of a note", () => {
    for (const methodId of ["rueckblick", "scheitern", "ideenrunde", "was-na-und"] as const) {
      expect(checkAgenda(agendaOf(methodId)), methodId).toEqual([]);
      const seconds = CATALOGUE[methodId].steps.reduce((sum, step) => sum + (step.durationSec ?? 0), 0);
      // the minutes cover the steps, with the catalogue's folded steps (question, close) on top
      expect(CATALOGUE[methodId].minutes, methodId).toBeGreaterThanOrEqual(Math.round(seconds / 60));
    }
    expect(keepsSteps(agendaOf("rueckblick").steps)).toBe(true);
    expect(keepsSteps(agendaOf("scheitern").steps)).toBe(true);
    expect(keepsSteps(agendaOf("was-na-und").steps)).toBe(true);
    expect(keepsSteps(agendaOf("ideenrunde").steps)).toBe(false);
    // every method before M5 keeps none: every note of it counts from step 0, as it always did
    for (const methodId of ["still-sammeln", "eins-zwei-vier", "schaetzen", "free"] as const) {
      expect(keepsSteps(agendaOf(methodId).steps), methodId).toBe(false);
      const steps = agendaOf(methodId).steps;
      for (let at = 0; at < steps.length; at += 1) expect(writingFrom(steps, at)).toBe(0);
    }
    expect(CATALOGUE["was-na-und"].attribution).toBe("liberatingStructures");
  });

  it("checks what the new parts need: a turn on a revealing step after hidden writing, options from an earlier step, actions with a step that decides", () => {
    const steps = agendaOf("ideenrunde").steps;
    const reveal = steps[1] as ResolvedAgenda["steps"][number];
    expect(checkAgenda({ steps: [{ ...reveal, type: "discuss" }, ...steps.slice(2)] })).toContainEqual({
      kind: "turnShape",
      step: 0,
    });
    const retro = agendaOf("rueckblick").steps;
    expect(
      checkAgenda({ steps: retro.map((step) => (step.key === "vote" ? { ...step, optionsFrom: "nothing" } : step)) }),
    ).toContainEqual({ kind: "optionsShape", step: 7 });
    // the vote before the actions are revealed would offer what nobody has seen
    expect(checkAgenda({ steps: retro.filter((step) => step.key !== "revealActions") })).toContainEqual({
      kind: "voteUnseen",
      step: 6,
    });
    expect(checkAgenda({ steps: retro.filter((step) => step.key !== "decide") })).toContainEqual({
      kind: "actionShape",
      step: 5,
    });
  });

  it("a step that reveals by turn writes nothing and groups nothing; a step that decides decides", () => {
    expect(capabilities(agendaOf("ideenrunde").steps[1] as never)).toMatchObject({
      write: false,
      move: true,
      group: false,
      arrange: false,
      turn: true,
    });
    expect(capabilities(agendaOf("rueckblick").steps[8] as never)).toMatchObject({ write: true, decide: true });
    expect(capabilities(agendaOf("scheitern").steps[0] as never)).toMatchObject({ write: false, move: false });
  });
});

describe("a later round of writing hides again", () => {
  const agenda = agendaOf("was-na-und");
  const first = stored("1", BEN);
  const second = stored("2", BEN, { step: 3 });

  it("a note counts from the step that began its round; what was shown stays shown", () => {
    expect(writingFrom(agenda.steps, 2)).toBe(1);
    expect(writingFrom(agenda.steps, 3)).toBe(3);
    expect(writingFrom(agenda.steps, 5)).toBe(4);
    // in the second round, written alone: the first round's note is everybody's, the second's its writer's
    const seen = sightOf(agenda, { reach: 3 });
    expect(typeof seen).toBe("object");
    expect(levelFor(seen, first)).toBe("all");
    expect(levelFor(seen, second)).toBe("hidden");
    expect(maySeeStored(first, seen, ANNA)).toBe(true);
    expect(maySeeStored(second, seen, ANNA)).toBe(false);
    expect(maySeeStored(second, seen, BEN)).toBe(true);
    expect(notesFor([first, second], seen, ANNA)).toMatchObject({ hidden: 1 });
    // the small groups: the team's; presented: everybody's
    expect(levelFor(sightOf(agenda, { reach: 4 }), second)).toBe("team");
    expect(sightOf(agenda, { reach: 5 })).toBe("all");
    // going back to the hidden step hides nothing again
    expect(levelFor(stepContext(agenda, { step: 3, reach: 5 }).seen, second)).toBe("all");
  });

  it("„Ordnen“ is not offered while some notes are hidden from somebody: a step that sorts, gone back to", () => {
    expect(stepContext(agenda, { step: 2, reach: 2 }).can.arrange).toBe(true);
    expect(stepContext(agenda, { step: 2, reach: 3 }).can).toMatchObject({ arrange: false, group: true });
  });

  it("what a step says of a note written now, and which move reveals", () => {
    expect(stepContext(agenda, { step: 3, reach: 3 })).toMatchObject({ sight: "all", writes: "hidden" });
    expect(stepReveals(agenda, { reach: 4 }, 5)).toBe(true);
    expect(stepReveals(agenda, { reach: 2 }, 3)).toBe(false);
    // into the small groups the notes go to the team alone: that asks nothing
    expect(stepReveals(agenda, { reach: 3 }, 4)).toBe(false);
  });

  it("the rules: a note written in such a step keeps its step, the others' new notes are not on the wall for a command", () => {
    const ctx = stepContext(agenda, { step: 3, reach: 3 });
    const made = decide(
      readerOf({ notes: [], groups: [] }),
      { type: "note.create", opId: id("0"), noteId: id("9"), text: "so what", x: 0, y: 0 },
      { id: ANNA, role: "member" },
      NOW,
      ctx,
    );
    expect(made).toMatchObject({ kind: "changed", change: { note: { step: 3 } } });
    // the worker says per note whether the sender reads it (`seen`): the hidden note of somebody else is not there
    const reader = {
      ...readerOf({ notes: [], groups: [] }),
      note: () => ({ mine: false, text: "x", seen: false }),
    };
    expect(
      decide(
        reader,
        { type: "note.update", opId: id("0"), noteId: id("2"), text: "y" },
        { id: ANNA, role: "admin" },
        NOW,
        ctx,
      ),
    ).toEqual({ kind: "refused", code: "NOT_FOUND" });
  });

  it("the teams of the next round are kept, with areas of their own beside the last ones", () => {
    const formed = enterTeams(null, { team: { size: 2, form: "random" } }, 1, [ANNA, BEN, CEM, id("d")], 7, NOW);
    const kept = enterTeams(
      formed as Teams,
      { team: { size: 2, form: "keep" } },
      4,
      [ANNA, BEN, CEM, id("d")],
      9,
      NOW + 1,
    );
    expect(kept?.teams).toEqual(formed?.teams);
    expect(kept?.areas).toEqual([
      { first: 2, count: 1 },
      { first: 3, count: 1 },
    ]);
    expect(kept?.history).toHaveLength(1);
    // without teams in force, kept teams are formed at random
    expect(enterTeams(null, { team: { size: 2, form: "keep" } }, 4, [ANNA, BEN], 9, NOW)?.teams).toHaveLength(1);
  });
});

describe("revealing by turn", () => {
  const notes = [
    stored("1", ANNA, { createdAt: NOW + 1 }),
    stored("2", ANNA, { createdAt: NOW + 2 }),
    stored("3", BEN, { createdAt: NOW + 3 }),
    stored("4", CEM, { createdAt: NOW + 4 }),
    stored("5", CEM, { createdAt: NOW + 5 }),
    stored("6", CEM, { createdAt: NOW + 6 }),
  ];

  it("the order deals one note of each writer, then the second of each, each writer's in the order written", () => {
    const order = revealOrder(notes, 42);
    expect(order).toHaveLength(6);
    const writerOf = new Map(notes.map((note) => [note.id, note.authorId]));
    expect(new Set(order.slice(0, 3).map((one) => writerOf.get(one))).size).toBe(3);
    expect(new Set(order.slice(3, 5).map((one) => writerOf.get(one)))).toEqual(new Set([ANNA, CEM]));
    expect(order[5]).toBe(id("6"));
    expect(order.indexOf(id("1"))).toBeLessThan(order.indexOf(id("2")));
    // the same notes and seed, the same order; the writers' order comes from the seed
    expect(revealOrder([...notes].reverse(), 42)).toEqual(order);
    const firsts = new Set(
      Array.from({ length: 20 }, (_, seed) => writerOf.get(revealOrder(notes, seed)[0] as string)),
    );
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("reaching the step shows nothing; each turn shows exactly the next note, to everybody", () => {
    const agenda = agendaOf("ideenrunde");
    const into = decideStep(flowAt(0), agenda, { from: 0, to: 1 }, { role: "admin" });
    expect(into).toMatchObject({ kind: "changed", widens: false, turns: true });
    const round: TurnRound = { step: 1, order: revealOrder(notes, 1), shown: 0 };
    const before = sightOf(agenda, { reach: 1, turns: [round] });
    expect(notesFor(notes, before, BEN).notes.map((note) => note.id)).toEqual([id("3")]);
    const exists = () => true;
    const next = decideTurn(
      flowAt(1, 1, { turns: [round] }),
      agenda.steps,
      { step: 1, shown: 0 },
      { role: "admin" },
      exists,
    );
    expect(next).toMatchObject({ kind: "changed", noteId: round.order[0] });
    if (next.kind !== "changed") return;
    const after = sightOf(agenda, { reach: 1, turns: [next.round] });
    const shown = notes.find((note) => note.id === next.noteId) as StoredNote;
    for (const viewer of [ANNA, BEN, CEM]) {
      expect(revealedFor(notes, viewer, { level: before }, { level: after })).toEqual(
        shown.authorId === viewer ? [] : [noteFor(shown, viewer)],
      );
    }
    expect(turnViewOf(next.round, exists)).toEqual({ step: 1, shown: 1, left: 5 });
    expect(shownByTurn([next.round])).toEqual(new Set([next.noteId]));
    // the same press twice is one; a member may not; another step is stale
    const flow = flowAt(1, 1, { turns: [next.round] });
    expect(decideTurn(flow, agenda.steps, { step: 1, shown: 0 }, { role: "admin" }, exists)).toEqual({
      kind: "unchanged",
    });
    expect(decideTurn(flow, agenda.steps, { step: 1, shown: 1 }, { role: "member" }, exists)).toEqual({
      kind: "refused",
      code: "NOT_ADMIN",
    });
    expect(decideTurn(flow, agenda.steps, { step: 0, shown: 1 }, { role: "admin" }, exists)).toEqual({
      kind: "refused",
      code: "STALE",
    });
    expect(decideTurn(flowAt(0), agenda.steps, { step: 0, shown: 0 }, { role: "admin" }, exists)).toEqual({
      kind: "refused",
      code: "PHASE",
    });
    // the next step shows the rest, and asks first
    expect(stepReveals(agenda, { reach: 1 }, 2)).toBe(true);
    expect(sightOf(agenda, { reach: 2, turns: [next.round] })).toBe("all");
  });

  it("a note that is gone is passed over, and counted nowhere", () => {
    const agenda = agendaOf("ideenrunde");
    const round: TurnRound = { step: 1, order: [id("1"), id("3"), id("4")], shown: 0 };
    const exists = (one: string) => one !== id("1");
    expect(turnViewOf(round, exists)).toEqual({ step: 1, shown: 0, left: 2 });
    const next = decideTurn(
      flowAt(1, 1, { turns: [round] }),
      agenda.steps,
      { step: 1, shown: 0 },
      { role: "admin" },
      exists,
    );
    expect(next).toMatchObject({ kind: "changed", noteId: id("3"), round: { shown: 2 } });
  });
});

describe("actions", () => {
  const agenda = agendaOf("rueckblick");
  const decideCtx = stepContext(agenda, { step: 8, reach: 8 });
  const action = (more: Partial<Note> = {}): Note => ({
    id: id("5"),
    mine: false,
    text: "Write acceptance criteria",
    x: 0,
    y: 0,
    groupId: null,
    createdAt: NOW,
    updatedAt: NOW,
    step: 5,
    ...more,
  });
  const agree = (who: string, due: string) =>
    ({ type: "note.action", opId: id("0"), noteId: id("5"), action: { who, due } }) as const;

  it("the moderation agrees on an action in a step that decides, nobody else, nothing that is no action, never outside the step", () => {
    const wall = readerOf({ notes: [action()], groups: [] });
    expect(decide(wall, agree("Anna", "Friday"), { id: ANNA, role: "admin" }, NOW, decideCtx)).toEqual({
      kind: "changed",
      change: { type: "note.action", noteId: id("5"), action: { who: "Anna", due: "Friday" } },
    });
    expect(decide(wall, agree("Anna", "Friday"), { id: BEN, role: "member" }, NOW, decideCtx)).toEqual({
      kind: "refused",
      code: "NOT_ADMIN",
    });
    const voteCtx = stepContext(agenda, { step: 7, reach: 7 });
    expect(decide(wall, agree("Anna", ""), { id: ANNA, role: "admin" }, NOW, voteCtx)).toEqual({
      kind: "refused",
      code: "PHASE",
    });
    const goal = readerOf({ notes: [action({ step: undefined })], groups: [] });
    expect(decide(goal, agree("Anna", ""), { id: ANNA, role: "admin" }, NOW, decideCtx)).toEqual({
      kind: "refused",
      code: "INVALID",
    });
    // the same again changes nothing; null takes it back
    const agreed = readerOf({ notes: [action({ action: { who: "Anna", due: "Friday" } })], groups: [] });
    expect(decide(agreed, agree("Anna", "Friday"), { id: ANNA, role: "admin" }, NOW, decideCtx)).toEqual({
      kind: "unchanged",
    });
    expect(
      decide(agreed, { ...agree("", ""), action: null }, { id: ANNA, role: "admin" }, NOW, decideCtx),
    ).toMatchObject({ kind: "changed", change: { action: null } });
  });

  it("the export lists the notes by their step and the agreed actions as tasks, escaped, without names", () => {
    const notes = [
      stored("1", ANNA, { text: "Ship the *search*" }),
      stored("2", BEN, { text: "3 of 5 stories", step: 1 }),
      stored("3", BEN, { text: "Pair on reviews", step: 5 }),
      stored("4", ANNA, { text: "[Write] criteria", step: 5, action: { who: "Ben <b>", due: "15. Dez" } }),
      stored("5", CEM, { text: "Book a room", step: 8, action: { who: "", due: "" } }),
    ];
    const text = wallMarkdown({
      question: "Sprint 12",
      methodId: "rueckblick",
      sight: "all",
      steps: agenda.steps,
      notes,
      groups: [],
      viewer: ANNA,
      at: Date.UTC(2026, 10, 27),
      language: "de",
    });
    expect(text).toContain("## Was sollte passieren? Das Ziel aufschreiben\n\n- Ship the \\*search\\*\n");
    expect(text).toContain("## Was ist passiert? Fakten, Zahlen, Zeitleiste\n\n- 3 of 5 stories\n");
    expect(text).toContain("## Aktionen vorschlagen\n\n- Pair on reviews\n");
    expect(text).toContain(
      "## Festgelegte Aktionen\n\n- [ ] \\[Write\\] criteria — Wer: Ben \\<b\\>, bis: 15\\. Dez\n- [ ] Book a room\n",
    );
    expect(text).not.toContain("## Bis zu drei Aktionen festlegen");
    // the method's line says what it is, and nothing about why it works
    expect(text).toContain("**Rückblick nach Ziel und Daten:** Ihr stellt Ziel und tatsächlichen Verlauf mit Fakten");
  });

  it("the export of a step that reveals by turn leaves out what has not had its turn, and says how many", () => {
    const agenda = agendaOf("ideenrunde");
    const notes = [stored("1", ANNA), stored("2", BEN), stored("3", CEM)];
    const text = wallMarkdown({
      question: "Ideas",
      methodId: "ideenrunde",
      sight: sightOf(agenda, { reach: 1, turns: [{ step: 1, order: [id("2"), id("3"), id("1")], shown: 1 }] }),
      steps: agenda.steps,
      notes,
      groups: [],
      viewer: ANNA,
      at: Date.UTC(2026, 10, 27),
      language: "en",
    });
    expect(text).toContain("_1 note is still hidden and left out here._");
    expect(text).toContain("- Note 1");
    expect(text).toContain("- Note 2");
    expect(text).not.toContain("Note 3");
  });
});
