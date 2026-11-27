// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  agendaFor,
  agendaOf,
  capabilities,
  checkAgenda,
  createWallRequestSchema,
  decideStep,
  initialFlow,
  noteLevel,
  readStoredFlow,
  resolvedAgendaSchema,
  stepContext,
  stepWidens,
  type Flow,
  type Participant,
  type ResolvedAgenda,
} from "../src/index.js";
import { HIDDEN_AGENDA, OPEN, OPEN_AGENDA, WRITING } from "./steps.js";

const anna: Pick<Participant, "role"> = { role: "admin" };
const ben: Pick<Participant, "role"> = { role: "member" };
const go = (from: number, to: number) => ({ from, to });
const at = (step: number, reach = step): Flow => ({ ...initialFlow(), step, reach });

describe("a wall's agenda", () => {
  it("a new wall runs the method it asks for, or what `hidden` stood for before there were methods", () => {
    expect(agendaFor({ hidden: true })).toEqual(agendaOf("still-sammeln"));
    expect(agendaFor({ hidden: false })).toEqual(agendaOf("free"));
    expect(agendaFor({ hidden: true, agenda: { items: [{ methodId: "free" }] } })).toEqual(agendaOf("free"));
    expect(agendaFor({ hidden: false, agenda: { items: [{ methodId: "still-sammeln" }] } })).toEqual(HIDDEN_AGENDA);
  });

  it("is a copy of the steps, with the method's version: what a wall stores and sends", () => {
    expect(HIDDEN_AGENDA.items).toEqual([{ methodId: "still-sammeln", version: 1 }]);
    expect(HIDDEN_AGENDA.steps.map((step) => step.key)).toEqual(["write", "reveal", "cluster", "discuss"]);
    expect(HIDDEN_AGENDA.steps.every((step) => step.item === 0)).toBe(true);
    expect(resolvedAgendaSchema.safeParse(JSON.parse(JSON.stringify(HIDDEN_AGENDA))).success).toBe(true);
    // a wall's stored copy stays small: one row
    expect(JSON.stringify(HIDDEN_AGENDA).length).toBeLessThan(1024);
  });

  it("the request names a method of the catalogue, one in M1, and nothing else", () => {
    const parse = (body: unknown) => createWallRequestSchema.safeParse(body);
    expect(parse({ question: "Q", agenda: { items: [{ methodId: "free" }] } }).success).toBe(true);
    expect(parse({ question: "Q" }).data).toEqual({ question: "Q", hidden: true });
    for (const agenda of [
      { items: [] },
      { items: [{ methodId: "brainstorm" }] },
      { items: [{ methodId: "free" }, { methodId: "free" }] },
      { items: [{ methodId: "free", prompt: "x" }] },
      { items: [{ methodId: "free" }], more: 1 },
      "free",
    ]) {
      expect(parse({ question: "Q", agenda }).success, JSON.stringify(agenda)).toBe(false);
    }
  });

  it("an agenda whose hidden notes are never shown, or with a step key twice, cannot run", () => {
    const write = HIDDEN_AGENDA.steps[0]!;
    const hiddenOnly: ResolvedAgenda = { items: HIDDEN_AGENDA.items, steps: [write] };
    expect(checkAgenda(hiddenOnly)).toEqual([{ kind: "neverShown", step: 0 }]);
    const twice: ResolvedAgenda = { items: HIDDEN_AGENDA.items, steps: [write, write, HIDDEN_AGENDA.steps[1]!] };
    expect(checkAgenda(twice)).toEqual([{ kind: "duplicateKey", step: 1 }]);
  });
});

describe("what a step allows", () => {
  it("writing hidden: notes and the clock, no groups and no arranging, and nobody reads the others' notes", () => {
    expect(WRITING).toEqual({
      sight: "hidden",
      can: { write: true, move: true, group: false, arrange: false, clock: true },
    });
  });

  it("every step after revealing, and the free wall: notes, groups and arranging, no clock", () => {
    for (const step of [1, 2, 3]) {
      expect(stepContext(HIDDEN_AGENDA, at(step)), String(step)).toEqual(OPEN);
    }
    expect(stepContext(OPEN_AGENDA, at(0))).toEqual(OPEN);
  });

  it("a step that sorts but hides sorts nothing: nobody groups what nobody can read", () => {
    expect(capabilities({ type: "cluster", visibility: "hidden" })).toMatchObject({ group: false, arrange: false });
    expect(capabilities({ type: "cluster", visibility: "anonymous" })).toMatchObject({ group: true, arrange: true });
  });
});

describe("visibility only widens", () => {
  it("a note is seen as widely as the widest step between the one it was written in and the furthest reached", () => {
    expect(noteLevel(HIDDEN_AGENDA.steps, 0)).toBe("hidden");
    expect(noteLevel(HIDDEN_AGENDA.steps, 1)).toBe("all");
    expect(noteLevel(HIDDEN_AGENDA.steps, 3)).toBe("all");
    expect(noteLevel(OPEN_AGENDA.steps, 0)).toBe("all");
    // a step that hides after one that showed: a note written in it is hidden until a later step shows it
    const steps = [
      { visibility: "all" },
      { visibility: "hidden" },
      { visibility: "team" },
      { visibility: "all" },
    ] as const;
    expect(noteLevel(steps, 1, 1)).toBe("hidden");
    expect(noteLevel(steps, 2, 1)).toBe("team");
    expect(noteLevel(steps, 3, 1)).toBe("all");
  });

  it("going back keeps what was reached, so nothing is hidden again", () => {
    const back = decideStep(at(2, 2), HIDDEN_AGENDA, go(2, 0), anna);
    expect(back).toMatchObject({ kind: "changed", flow: { step: 0, reach: 2 }, widens: false });
    if (back.kind !== "changed") return;
    // in the writing step again: the notes stay seen, and what is allowed is the writing step's
    expect(stepContext(HIDDEN_AGENDA, back.flow)).toEqual({ sight: "all", can: WRITING.can });
    // and forward from there widens nothing either
    expect(decideStep({ ...at(0, 2) }, HIDDEN_AGENDA, go(0, 1), anna)).toMatchObject({ widens: false });
    expect(stepWidens(HIDDEN_AGENDA, { reach: 2 }, 1)).toBe(false);
  });
});

describe("moving between steps", () => {
  it("forward to the step that shows the notes is revealing: it widens, once", () => {
    expect(decideStep(at(0), HIDDEN_AGENDA, go(0, 1), anna)).toMatchObject({
      kind: "changed",
      flow: { step: 1, reach: 1 },
      widens: true,
    });
    expect(stepWidens(HIDDEN_AGENDA, { reach: 0 }, 1)).toBe(true);
    expect(decideStep(at(1), HIDDEN_AGENDA, go(1, 2), anna)).toMatchObject({ widens: false });
  });

  it("past a step: the skipped ones count as reached", () => {
    expect(decideStep(at(0), HIDDEN_AGENDA, go(0, 3), anna)).toMatchObject({
      flow: { step: 3, reach: 3 },
      widens: true,
    });
  });

  it("is the moderation's alone", () => {
    expect(decideStep(at(0), HIDDEN_AGENDA, go(0, 1), ben)).toEqual({ kind: "refused", code: "NOT_ADMIN" });
  });

  it("sent a second time it finds its work done; made for a step the wall has left it is refused", () => {
    expect(decideStep(at(1), HIDDEN_AGENDA, go(0, 1), anna)).toEqual({ kind: "unchanged" });
    expect(decideStep(at(2), HIDDEN_AGENDA, go(0, 1), anna)).toEqual({ kind: "refused", code: "STALE" });
  });

  it("no step past the agenda's last", () => {
    expect(decideStep(at(0), HIDDEN_AGENDA, go(0, 4), anna)).toEqual({ kind: "refused", code: "INVALID" });
    expect(decideStep(at(0), OPEN_AGENDA, go(0, 1), anna)).toEqual({ kind: "refused", code: "INVALID" });
  });

  it("a move stops the clock of the step, and keeps its revision", () => {
    const flow: Flow = { ...at(0), clock: { rev: 3, endsAt: 1_000_000, leftMs: null } };
    expect(decideStep(flow, HIDDEN_AGENDA, go(0, 1), anna)).toMatchObject({
      flow: { clock: { rev: 3, endsAt: null, leftMs: null } },
    });
  });
});

describe("a wall of a build before the methods (schema 3)", () => {
  const clock = { rev: 2, endsAt: 1_795_300_600_000, leftMs: null };

  it("in hidden writing it is „Still sammeln“ in its writing step: hidden, with its clock", () => {
    const read = readStoredFlow({ phase: "writing", clock, seq: 7 }, null);
    expect(read).toEqual({ flow: { v: 2, step: 0, reach: 0, clock, seq: 7 }, legacy: HIDDEN_AGENDA });
    expect(stepContext(HIDDEN_AGENDA, read.flow)).toEqual(WRITING);
  });

  it("revealed, or made without hidden writing, it is a „Freie Wand“: everything there for everyone", () => {
    const read = readStoredFlow({ phase: "open", clock: { rev: 2, endsAt: null, leftMs: null }, seq: 9 }, null);
    expect(read.legacy).toEqual(OPEN_AGENDA);
    expect(read.flow).toMatchObject({ v: 2, step: 0, reach: 0, seq: 9 });
    expect(stepContext(OPEN_AGENDA, read.flow)).toEqual(OPEN);
  });

  it("a wall that stores its agenda reads its flow as it is, in either shape", () => {
    expect(readStoredFlow({ v: 2, step: 2, reach: 3, clock, seq: 4 }, HIDDEN_AGENDA)).toEqual({
      flow: { v: 2, step: 2, reach: 3, clock, seq: 4 },
      legacy: null,
    });
    expect(readStoredFlow({ phase: "writing", clock, seq: 1 }, OPEN_AGENDA).legacy).toBeNull();
  });

  it("a wall without a flow row hides rather than shows", () => {
    const read = readStoredFlow(null, null);
    expect(read.legacy).toEqual(HIDDEN_AGENDA);
    expect(stepContext(HIDDEN_AGENDA, read.flow).sight).toBe("hidden");
  });
});
