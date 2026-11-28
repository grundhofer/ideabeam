// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  agendaFor,
  CATALOGUE,
  checkAgenda,
  decideAgendaSet,
  fieldBoxes,
  fieldsTop,
  itemOfStep,
  itemSpan,
  keepsSteps,
  levelsAt,
  MAX_AGENDA_ITEMS,
  METHOD_ORDER,
  methodOfStep,
  promptOf,
  reachedItems,
  requestOf,
  resolveAgenda,
  resolvedAgendaSchema,
  stepContext,
  stepReveals,
  wallMarkdown,
  writingFrom,
  type AgendaItemRequest,
  type Group,
  type MethodId,
  type StoredNote,
} from "../src/index.js";

// Stage M7 (PLAN-METHODEN.md 5): an agenda of several methods on one wall, run one after the other, each with an
// optional prompt; the moderation may change the methods the wall has not reached, never a step it has reached.

const THREE: AgendaItemRequest[] = [
  { methodId: "still-sammeln" },
  { methodId: "nutzen-aufwand", prompt: "Which of them first?" },
  { methodId: "scheitern" },
];
const AGENDA = resolveAgenda({ items: THREE });
const ADMIN = { role: "admin" };

describe("an agenda of several methods", () => {
  it("resolves every method's steps in order, each with its item, and keeps each item's prompt", () => {
    expect(AGENDA.items).toEqual([
      { methodId: "still-sammeln", version: CATALOGUE["still-sammeln"].version },
      { methodId: "nutzen-aufwand", version: CATALOGUE["nutzen-aufwand"].version, prompt: "Which of them first?" },
      { methodId: "scheitern", version: CATALOGUE.scheitern.version },
    ]);
    const lengths = THREE.map(({ methodId }) => CATALOGUE[methodId].steps.length);
    expect(AGENDA.steps).toHaveLength(lengths.reduce((a, b) => a + b, 0));
    expect(itemSpan(AGENDA, 0)).toEqual({ from: 0, end: lengths[0] });
    expect(itemSpan(AGENDA, 1)).toEqual({ from: lengths[0], end: (lengths[0] ?? 0) + (lengths[1] ?? 0) });
    expect(itemSpan(AGENDA, 3)).toEqual({ from: -1, end: -1 });
    expect(itemOfStep(AGENDA, itemSpan(AGENDA, 2).from)).toBe(2);
    expect(methodOfStep(AGENDA, itemSpan(AGENDA, 1).from)).toBe("nutzen-aufwand");
    // the prompt where an item has one, else the wall's question
    expect(promptOf(AGENDA, 0, "What slows us down?")).toBe("What slows us down?");
    expect(promptOf(AGENDA, itemSpan(AGENDA, 1).from, "What slows us down?")).toBe("Which of them first?");
    expect(resolvedAgendaSchema.safeParse(JSON.parse(JSON.stringify(AGENDA))).success).toBe(true);
    // the request the moderation edits is what made the agenda
    expect(requestOf(AGENDA)).toEqual(THREE);
  });

  it("the language of the fields' titles is kept only for a method that begins with fields", () => {
    const agenda = resolveAgenda({
      items: [
        { methodId: "still-sammeln", language: "en" },
        { methodId: "annahmen", language: "en" },
      ],
    });
    expect(agenda.items.map((item) => item.language)).toEqual([undefined, "en"]);
  });

  it("every two methods of the catalogue run one after the other (checkAgenda)", () => {
    for (const first of METHOD_ORDER) {
      for (const second of METHOD_ORDER) {
        const agenda = resolveAgenda({ items: [{ methodId: first }, { methodId: second }] });
        expect(checkAgenda(agenda), `${first} → ${second}`).toEqual([]);
      }
    }
  });

  it("eight of the longest methods still fit the stored agenda", () => {
    const longest = [...METHOD_ORDER].sort(
      (a, b) => CATALOGUE[b].steps.length - CATALOGUE[a].steps.length,
    )[0] as MethodId;
    const agenda = agendaFor({
      hidden: true,
      agenda: { items: Array.from({ length: MAX_AGENDA_ITEMS }, () => ({ methodId: longest })) },
    });
    expect(resolvedAgendaSchema.safeParse(agenda).success).toBe(true);
  });

  it("keeps the step of every note, so that each note belongs to its method, and the next method writes hidden again", () => {
    expect(keepsSteps(AGENDA.steps)).toBe(true);
    // a single method of before keeps none, as it always did
    expect(keepsSteps(resolveAgenda({ items: [{ methodId: "still-sammeln" }] }).steps)).toBe(false);
    const scheitern = itemSpan(AGENDA, 2).from;
    const reasons = scheitern + 1; // „Gründe aufschreiben“, hidden
    expect(AGENDA.steps[reasons]?.visibility).toBe("hidden");
    expect(writingFrom(AGENDA.steps, reasons)).toBe(reasons);
    // in the reasons step of the third method: the first method's ideas stay shown, the new reasons are hidden
    const levels = levelsAt(AGENDA, reasons);
    expect(levels[0]).toBe("all");
    expect(levels[reasons]).toBe("hidden");
    // its reveal by turn shows nothing by being reached; the step after it shows the rest, and asks first
    expect(stepReveals(AGENDA, { reach: reasons + 1 }, reasons + 2)).toBe(true);
  });

  it("a method's records are its own: in the second method's decision step only its notes are decisions", () => {
    const agenda = resolveAgenda({ items: [{ methodId: "nutzen-aufwand" }, { methodId: "entscheidung" }] });
    const decideFirst = agenda.steps.findIndex((step) => step.type === "decide");
    const decideSecond = agenda.steps.findIndex((step, at) => step.type === "decide" && at > decideFirst);
    const first = stepContext(agenda, { step: decideFirst, reach: decideFirst });
    const second = stepContext(agenda, { step: decideSecond, reach: decideSecond });
    expect(first.decisionSteps.every((at) => agenda.steps[at]?.item === 0)).toBe(true);
    expect(second.decisionSteps.length).toBeGreaterThan(0);
    expect(second.decisionSteps.every((at) => agenda.steps[at]?.item === 1)).toBe(true);
  });
});

describe("the moderation changes the methods not reached yet (`admin.agenda.set`)", () => {
  const second = itemSpan(AGENDA, 1).from;

  it("adds, removes and reorders the methods after the one the wall is in", () => {
    const flow = { reach: 2 };
    expect(reachedItems(AGENDA, flow.reach)).toBe(1);
    const reordered = [THREE[0], THREE[2], THREE[1]] as AgendaItemRequest[];
    const moved = decideAgendaSet(AGENDA, flow, reordered, ADMIN);
    expect(moved.kind).toBe("changed");
    if (moved.kind !== "changed") return;
    expect(requestOf(moved.agenda)).toEqual(reordered);
    // the steps reached are the very same objects' copies, and come first
    expect(moved.agenda.steps.slice(0, second)).toEqual(AGENDA.steps.slice(0, second));
    expect(moved.agenda.steps.slice(second).every((step) => step.item >= 1)).toBe(true);
    expect(checkAgenda(moved.agenda)).toEqual([]);

    const removed = decideAgendaSet(AGENDA, flow, [THREE[0] as AgendaItemRequest], ADMIN);
    expect(removed.kind === "changed" && removed.agenda.items.length).toBe(1);
    const added = decideAgendaSet(AGENDA, flow, [...THREE, { methodId: "ziele", prompt: "Our goals?" }], ADMIN);
    expect(added.kind === "changed" && added.agenda.items.at(-1)).toEqual({
      methodId: "ziele",
      version: CATALOGUE.ziele.version,
      prompt: "Our goals?",
    });
  });

  it("never changes a method the wall has reached: the same list again changes nothing, another one is stale", () => {
    // in the second method's first step: two methods are reached
    const flow = { reach: second };
    expect(reachedItems(AGENDA, flow.reach)).toBe(2);
    expect(decideAgendaSet(AGENDA, flow, THREE, ADMIN)).toEqual({ kind: "unchanged" });
    // the reached second method taken away, swapped or given another prompt: refused
    for (const items of [
      [THREE[0], THREE[2]],
      [THREE[0], THREE[2], THREE[1]],
      [THREE[0], { ...THREE[1], prompt: "Another one" }, THREE[2]],
      [{ methodId: "free" }, THREE[1], THREE[2]],
    ] as AgendaItemRequest[][]) {
      expect(decideAgendaSet(AGENDA, flow, items, ADMIN), JSON.stringify(items)).toEqual({
        kind: "refused",
        code: "STALE",
      });
    }
    // going back keeps the reach: what was reached stays fixed
    expect(decideAgendaSet(AGENDA, { reach: second }, [THREE[0] as AgendaItemRequest], ADMIN).kind).toBe("refused");
  });

  it("is the moderation's alone, and refuses an agenda that is too long", () => {
    expect(decideAgendaSet(AGENDA, { reach: 0 }, THREE, { role: "member" })).toEqual({
      kind: "refused",
      code: "NOT_ADMIN",
    });
    const nine = Array.from({ length: MAX_AGENDA_ITEMS + 1 }, () => ({ methodId: "free" as const }));
    expect(decideAgendaSet(AGENDA, { reach: 0 }, [THREE[0] as AgendaItemRequest, ...nine.slice(1)], ADMIN)).toEqual({
      kind: "refused",
      code: "INVALID",
    });
  });

  it("drops the switched-off moving on of the steps of methods it takes away", () => {
    const agenda = resolveAgenda({ items: [{ methodId: "still-sammeln" }, { methodId: "eins-zwei-vier" }] });
    const pairs = agenda.steps.findIndex((step) => step.item === 1 && step.advance === "auto");
    const changed = decideAgendaSet(agenda, { reach: 1, manual: [pairs] }, [{ methodId: "still-sammeln" }], ADMIN);
    expect(changed).toMatchObject({ kind: "changed", manual: [] });
  });
});

describe("fields of a later method", () => {
  it("begin below what the wall holds", () => {
    expect(fieldsTop([], [], 120)).toBe(0);
    const top = fieldsTop([{ y: 100, h: 400 }], [{ y: 900 }], 120);
    expect(top).toBe(900 + 120 + 128);
    expect(fieldBoxes(5, top)[0]?.y).toBe(top);
    expect(fieldBoxes(5)[0]?.y).toBe(0);
  });
});

describe("the export of an agenda of several methods", () => {
  const at = Date.UTC(2026, 10, 28, 10, 0, 0);
  const id = (letter: string) => letter.repeat(32);
  const note = (letter: string, text: string, step: number, groupId: string | null = null): StoredNote => ({
    id: id(letter),
    authorId: id("a"),
    text,
    x: 0,
    y: 0,
    groupId,
    createdAt: at - 1000 + letter.charCodeAt(0),
    updatedAt: at,
    step,
  });
  const group: Group = {
    id: id("g"),
    title: "Tools",
    titleSource: "person",
    locked: false,
    x: 0,
    y: 0,
    w: 400,
    h: 300,
    ord: 1,
  };

  it("has a section for each method with its name, short description, prompt and what it made", () => {
    const scheitern = itemSpan(AGENDA, 2).from;
    const text = wallMarkdown({
      question: "What slows us down?",
      methodId: "still-sammeln",
      sight: { levels: AGENDA.steps.map(() => "all"), shown: new Set() },
      steps: AGENDA.steps,
      items: AGENDA.items,
      notes: [
        note("b", "The build", 0, id("g")),
        note("c", "Two ticket systems", 0, id("g")),
        note("d", "Nobody owns it", scheitern + 1),
      ],
      groups: [group],
      results: [],
      viewer: id("a"),
      at,
      language: "en",
    });
    expect(text).toContain("## 1. Write alone, group, vote in secret");
    expect(text).toContain("## 2. ");
    expect(text).toContain("**Question:** Which of them first?");
    // the group stands with the method its notes were written in, one level down
    const first = text.indexOf("## 1.");
    const secondAt = text.indexOf("## 2.");
    expect(text.indexOf("### Tools")).toBeGreaterThan(first);
    expect(text.indexOf("### Tools")).toBeLessThan(secondAt);
    // the reason of the third method under its step there
    expect(text.indexOf("Nobody owns it")).toBeGreaterThan(text.indexOf("## 3."));
    // no name, ever
    expect(text).not.toContain(id("a"));
  });
});
