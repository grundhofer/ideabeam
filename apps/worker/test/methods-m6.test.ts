// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// The methods of stage M6 (PLAN-METHODEN.md 5, „Paket B“) against the real object in workerd, read from the frames
// themselves, text for text:
//  - the score with the criteria of notes („Kriterienbewertung“): the criteria frozen into the round, no score in any
//    frame of anybody else before counting, the result with its criteria and means, the export as a table;
//  - the consent round („Entscheidungsprotokoll mit Zustimmungsrunde“): no answer and no reason in any frame of
//    anybody else before counting, the result to everybody at once with the reasons sorted, the decision recorded with
//    its reasons, open objections and review date;
//  - the fixed fields of „Annahmen prüfen“, made with the wall in the language asked for, and a score over the notes
//    of two steps, not over the fields;
//  - teams with roles („Gegenposition prüfen“): two teams, each told its own;
//  - goals with measurable results („Ziele mit messbaren Ergebnissen“): the record with goal and target, the export
//    nested under the goals.
// The rules themselves: packages/shared/test/m6.test.ts.

import { runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateHexId, type CreateWallResponse, type MethodId, type ServerEvent } from "@ideabeam/shared";
import { ask, join, postWall, resync, settle, stubOf, type Sync, type TestSocket } from "./helpers.js";

type StepChanged = Extract<ServerEvent, { type: "step.changed" }>;
type Published = Extract<ServerEvent, { type: "results.published" }>;

async function createWall(methodId: MethodId, question = "Which supplier?", language?: "de" | "en") {
  const response = await postWall({
    question,
    agenda: { items: [{ methodId, ...(language === undefined ? {} : { language }) }] },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as CreateWallResponse;
}

interface Person {
  name: string;
  socket: TestSocket;
  sync: Sync;
  you: string;
  sessionKey: string;
}

async function people(wallId: string, adminToken: string, names: string[]): Promise<Person[]> {
  const joined: Person[] = [];
  for (const [n, name] of names.entries()) {
    joined.push({ name, ...(await join(wallId, name, n === 0 ? { adminToken } : {})) });
  }
  return joined;
}

async function write(person: Person, text: string, x = 0, y = 0): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(person.socket, { type: "note.create", noteId, text, x, y })).toBe("ack");
  return noteId;
}

const texts = (frames: readonly string[]) => frames.join("\n");

async function exportOf(wallId: string, sessionKey: string, lang = "en"): Promise<string> {
  const response = await SELF.fetch(`https://example.com/api/walls/${wallId}/export?lang=${lang}`, {
    headers: { authorization: `Session ${sessionKey}` },
  });
  expect(response.status).toBe(200);
  return response.text();
}

describe("the score with the criteria of notes", () => {
  it("„Kriterienbewertung“: the criteria are frozen into the round, no score leaves before counting, the result has the means per criterion", async () => {
    const { wallId, adminToken } = await createWall("kriterien");
    const group = await people(wallId, adminToken, ["Anna", "Ben", "Cem"]);
    const [anna, ben, cem] = group as [Person, Person, Person];
    const go = async (from: number) =>
      expect(await ask(anna.socket, { type: "admin.step.go", from, to: from + 1 })).toBe("ack");
    await write(anna, "Low cost");
    await write(ben, "Quick to start");
    await go(0);
    // a criterion added while they are agreed on counts too
    await write(cem, "Good support");
    await go(1);
    const optionA = await write(anna, "Supplier A");
    const optionB = await write(ben, "Supplier B");
    await go(2);
    const changed = (await cem.socket.waitFor((e) => e.type === "step.changed" && e.step === 3)) as StepChanged;
    expect(changed.round?.criteria).toEqual(["Low cost", "Quick to start", "Good support"]);
    // the options are the notes of the options step, never the criteria
    expect(changed.round?.options.map((option) => option.id).sort()).toEqual([optionA, optionB].sort());
    // nothing is written in a step that scores
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "x", x: 0, y: 0 })).toBe(
      "PHASE",
    );

    const marks = group.map((person) => person.socket.raw.length);
    const score = (a: number[], b: number[]) => ({
      type: "ballot.cast",
      step: 3,
      ballot: { kind: "score", scores: { [optionA]: a, [optionB]: b } },
    });
    // a ballot that does not score every criterion is refused
    expect(await ask(ben.socket, { ...score([5, 4], [1, 1]) })).toBe("INVALID");
    expect(await ask(ben.socket, score([5, 4, 4], [1, 2, 3]))).toBe("ack");
    expect(await ask(cem.socket, score([3, 2, 4], [2, 2, 2]))).toBe("ack");
    await settle();
    // no frame of anybody else carries a score, not even the moderation's
    for (const [n, person] of group.entries()) {
      const since = texts(person.socket.raw.slice(marks[n]));
      if (person !== ben) expect(since).not.toContain("[5,4,4]");
      if (person !== cem) expect(since).not.toContain("[3,2,4]");
      if (person === anna) expect(since).not.toContain('"scores"');
    }
    expect(await ask(anna.socket, { type: "admin.step.count", step: 3 })).toBe("ack");
    const published = (await ben.socket.waitFor((e) => e.type === "results.published")) as Published;
    expect(published.result).toMatchObject({
      kind: "score",
      voters: 2,
      criteria: ["Low cost", "Quick to start", "Good support"],
      rows: [
        { id: optionA, scores: [4, 3, 4], points: 3.67, by: 2, rank: 1 },
        { id: optionB, scores: [1.5, 2, 2.5], points: 2, by: 2, rank: 2 },
      ],
    });
    await go(3);
    await go(4);
    const decision = await write(ben, "We take supplier A");
    expect(
      await ask(anna.socket, {
        type: "note.action",
        noteId: decision,
        action: { who: "", due: "", why: "Best total" },
      }),
    ).toBe("ack");
    const exported = await exportOf(wallId, cem.sessionKey);
    expect(exported).toContain("| Place | Option | Low cost | Quick to start | Good support | Overall | Rated by |");
    expect(exported).toContain("| 1 | Supplier A | 4 | 3 | 4 | 3.67 | 2 |");
    expect(exported).toContain(
      "## Decisions\n\n- We take supplier A\n  - Decided by: the moderation\n  - Reasons: Best total",
    );
    expect(exported).not.toMatch(/\bAnna\b|\bBen\b|\bCem\b/);
  });
});

describe("the consent round", () => {
  it("„Entscheidungsprotokoll“: no answer and no reason leaves before counting; the result to everybody at once; the decision recorded", async () => {
    const { wallId, adminToken } = await createWall("entscheidung", "Which supplier do we take?");
    const group = await people(wallId, adminToken, ["Anna", "Ben", "Cem"]);
    const [anna, ben, cem] = group as [Person, Person, Person];
    const go = async (from: number) =>
      expect(await ask(anna.socket, { type: "admin.step.go", from, to: from + 1 })).toBe("ack");
    // the frame: nobody writes
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "x", x: 0, y: 0 })).toBe(
      "PHASE",
    );
    await go(0);
    const proposal = await write(ben, "Take supplier B for a year");
    await go(1);
    await go(2);
    await write(cem, "Reaction: worried about the price");
    await go(3);
    const changed = (await anna.socket.waitFor((e) => e.type === "step.changed" && e.step === 4)) as StepChanged;
    // the round is about the proposal's notes
    expect(changed.round?.options).toEqual([{ id: proposal, kind: "note" }]);
    // the reactions are still hidden from everybody but their writer
    expect(texts(anna.socket.raw)).not.toContain("worried about the price");

    const marks = group.map((person) => person.socket.raw.length);
    expect(await ask(ben.socket, { type: "ballot.cast", step: 4, ballot: { kind: "consent", answer: "agree" } })).toBe(
      "ack",
    );
    // an objection without its reason is refused
    expect(await ask(cem.socket, { type: "ballot.cast", step: 4, ballot: { kind: "consent", answer: "object" } })).toBe(
      "INVALID",
    );
    expect(
      await ask(cem.socket, {
        type: "ballot.cast",
        step: 4,
        ballot: { kind: "consent", answer: "object", reason: "Lock-in for a year" },
      }),
    ).toBe("ack");
    expect(await ask(anna.socket, { type: "ballot.cast", step: 4, ballot: { kind: "consent", answer: "live" } })).toBe(
      "ack",
    );
    await settle();
    for (const [n, person] of group.entries()) {
      const since = texts(person.socket.raw.slice(marks[n]));
      if (person !== cem) expect(since).not.toContain("Lock-in for a year");
      // nobody learns anybody else's answer: only their own ballot is told back to them
      const answers = [...since.matchAll(/"answer":"(\w+)"/g)].map((match) => match[1]);
      expect(answers.every((one) => one === { Anna: "live", Ben: "agree", Cem: "object" }[person.name])).toBe(true);
      expect(since).toContain('"votes.count"');
    }
    // counting is the moderation's
    expect(await ask(ben.socket, { type: "admin.step.count", step: 4 })).toBe("NOT_ADMIN");
    expect(await ask(anna.socket, { type: "admin.step.count", step: 4 })).toBe("ack");
    for (const person of group) {
      const published = (await person.socket.waitFor((e) => e.type === "results.published")) as Published;
      expect(published.result).toEqual({
        step: 4,
        kind: "consent",
        voters: 3,
        agree: 1,
        live: 1,
        object: 1,
        objections: ["Lock-in for a year"],
      });
    }
    await go(4);
    // the reactions are revealed now
    await anna.socket.waitFor((e) => e.type === "notes.revealed");
    expect(texts(anna.socket.raw)).toContain("worried about the price");
    await go(5);
    const decision = await write(ben, "We take supplier B for six months");
    expect(
      await ask(anna.socket, {
        type: "note.action",
        noteId: decision,
        action: { who: "Anna", due: "1 June" },
      }),
    ).toBe("INVALID");
    expect(
      await ask(anna.socket, {
        type: "note.action",
        noteId: decision,
        action: { who: "", due: "1 June", why: "Shorter lock-in", open: "Price for the second half" },
      }),
    ).toBe("ack");
    expect((await resync(cem.socket)).notes.find((note) => note.id === decision)?.action).toEqual({
      who: "",
      due: "1 June",
      why: "Shorter lock-in",
      open: "Price for the second half",
    });
    const exported = await exportOf(wallId, cem.sessionKey);
    expect(exported).toContain("## Consent round\n\n_Answered in secret, counted at once: 3 answers._");
    expect(exported).toContain("- Objections:\n  - Lock-in for a year");
    expect(exported).toContain(
      "- We take supplier B for six months\n  - Decided by: the moderation\n  - Reasons: Shorter lock-in\n  - Open objections: Price for the second half\n  - Review date: 1 June",
    );
    expect(exported).not.toMatch(/\bAnna\b|\bBen\b|\bCem\b/);
  });
});

describe("fixed fields", () => {
  it("„Annahmen prüfen“ begins with five fields titled in the language asked for; the score is over the assumptions, never the fields", async () => {
    const { wallId, adminToken } = await createWall("annahmen", "A delivery service for spare parts", "en");
    const [anna, ben] = (await people(wallId, adminToken, ["Anna", "Ben"])) as [Person, Person];
    const fields = anna.sync.groups;
    expect(fields.map((group) => group.title)).toEqual(["Customers", "Problem", "Solution", "Money", "Delivery"]);
    expect(fields.every((group) => group.titleSource === "person" && group.locked)).toBe(true);
    // German when nothing is asked
    const german = await createWall("annahmen", "Ein Lieferdienst");
    const [dora] = (await people(german.wallId, german.adminToken, ["Dora"])) as [Person];
    expect(dora.sync.groups.map((group) => group.title)).toEqual([
      "Kundschaft",
      "Problem",
      "Lösung",
      "Geld",
      "Umsetzung",
    ]);
    // in the hidden step, a person puts their own assumption into a field
    const field = fields[0];
    const one = await write(ben, "Workshops order online", 0, 0);
    expect(
      await ask(ben.socket, {
        type: "notes.move",
        moves: [{ noteId: one, x: (field?.x ?? 0) + 16, y: (field?.y ?? 0) + 40, groupId: field?.id }],
      }),
    ).toBe("ack");
    // nobody else sees it, nor where it lies
    await settle();
    expect(texts(anna.socket.raw)).not.toContain("Workshops order online");
    expect(texts(anna.socket.raw)).not.toContain(one);
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    const two = await write(anna, "They pay within 30 days");
    expect(await ask(anna.socket, { type: "admin.step.go", from: 1, to: 2 })).toBe("ack");
    const round = (await resync(ben.socket)).votes.find((vote) => vote.step === 2);
    expect(round?.options).toEqual([
      { id: one, kind: "note" },
      { id: two, kind: "note" },
    ]);
    expect(round?.criteria).toBeUndefined();
    // two scores an assumption: how bad if wrong, how little we know
    expect(
      await ask(ben.socket, { type: "ballot.cast", step: 2, ballot: { kind: "score", scores: { [one]: [5, 4] } } }),
    ).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.step.count", step: 2 })).toBe("ack");
    const exported = await exportOf(wallId, ben.sessionKey);
    expect(exported).toContain("| Place | Option | Harm if wrong | How little we know | Overall | Rated by |");
    expect(exported).toContain("## Customers\n\n- Workshops order online");
    // on to the tests in small groups and their agreement: the export still holds the fields and the table
    for (const from of [2, 3, 4]) {
      expect(await ask(anna.socket, { type: "admin.step.go", from, to: from + 1 })).toBe("ack");
    }
    const test = await write(ben, "Test: call ten workshops", 16, 1300);
    expect(await ask(anna.socket, { type: "note.action", noteId: test, action: { who: "Ben", due: "Friday" } })).toBe(
      "ack",
    );
    const last = await exportOf(wallId, ben.sessionKey);
    // and in German: the criteria in German, the fields as they were titled when the wall was made
    expect(await exportOf(wallId, ben.sessionKey, "de")).toContain("| Platz | Option | Schaden, wenn falsch |");
    expect(last).toContain("## Agreed actions\n\n- [ ] Test: call ten workshops — Who: Ben, by: Friday");
  });
});

describe("teams with roles", () => {
  it("„Gegenposition prüfen“: two teams, each told its own; the export lists the notes by team and role", async () => {
    const { wallId, adminToken } = await createWall("gegenposition", "Move to the new office?");
    const group = await people(wallId, adminToken, ["Anna", "Ben", "Cem", "Dora"]);
    const [anna] = group as [Person];
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    for (const person of group) await write(person, `Doubt of ${person.name.length}${person.you.slice(0, 4)}`);
    expect(await ask(anna.socket, { type: "admin.step.go", from: 1, to: 2 })).toBe("ack");
    const views = await Promise.all(
      group.map(
        (person) => person.socket.waitFor((e) => e.type === "step.changed" && e.step === 2) as Promise<StepChanged>,
      ),
    );
    // the moderation gets the map of both teams; everybody else their own
    expect(views[0]?.team?.members.filter((team) => team !== null)).toHaveLength(2);
    for (const view of views.slice(1)) {
      expect(view.team?.members.filter((team) => team !== null)).toHaveLength(1);
      expect(view.team?.own).not.toBeNull();
    }
    const sizes = (views[0]?.team?.members ?? []).map((team) => team?.length);
    expect(sizes).toEqual([2, 2]);
    // each team writes in its area
    const areas = views[0]?.team?.areas ?? [];
    for (const person of group) {
      const own = views[0]?.team?.members.findIndex((team) => team?.includes(person.you)) ?? 0;
      const box = areas[own];
      await write(person, `Team note ${own + 1} ${person.you.slice(0, 4)}`, 16 + (box?.first ?? 0) * 896, 1300);
    }
    expect(await ask(anna.socket, { type: "admin.step.go", from: 2, to: 3 })).toBe("ack");
    const exported = await exportOf(wallId, anna.sessionKey);
    expect(exported).toContain(
      "## Roles: find weaknesses, write down assumptions · team 1: Counter-position\n\n- Team note 1",
    );
    expect(exported).toContain(
      "## Roles: find weaknesses, write down assumptions · team 2: Assumptions\n\n- Team note 2",
    );
    expect(exported).toContain("Worked in teams:");
    expect(exported).not.toMatch(/\bAnna\b|\bBen\b|\bCem\b|\bDora\b/);
  });
});

describe("goals with measurable results", () => {
  it("„Ziele mit messbaren Ergebnissen“: up to three goals by approval, results recorded with goal, target, owner and review date, nested in the export", async () => {
    const { wallId, adminToken } = await createWall("ziele", "Our goals for the first quarter");
    const group = await people(wallId, adminToken, ["Anna", "Ben"]);
    const [anna, ben] = group as [Person, Person];
    const go = async (from: number) =>
      expect(await ask(anna.socket, { type: "admin.step.go", from, to: from + 1 })).toBe("ack");
    await go(0);
    const faster = await write(anna, "Faster support");
    const calmer = await write(ben, "Calmer releases");
    await go(1);
    await go(2);
    const round = (await resync(ben.socket)).votes.find((vote) => vote.step === 3);
    expect(round?.limit).toBe(2);
    expect(
      await ask(ben.socket, { type: "ballot.cast", step: 3, ballot: { kind: "approval", chosen: [faster, calmer] } }),
    ).toBe("ack");
    expect(
      await ask(anna.socket, { type: "ballot.cast", step: 3, ballot: { kind: "approval", chosen: [faster] } }),
    ).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.step.count", step: 3 })).toBe("ack");
    await go(3);
    const result = await write(ben, "Reply within one day");
    await go(4);
    await go(5);
    // a result takes no reasons; the goal is an option of the vote
    expect(
      await ask(anna.socket, { type: "note.action", noteId: result, action: { who: "Ben", due: "", why: "x" } }),
    ).toBe("INVALID");
    expect(
      await ask(anna.socket, {
        type: "note.action",
        noteId: result,
        action: { who: "Ben", due: "end of March", target: "from 3 days to 1", goal: faster },
      }),
    ).toBe("ack");
    const exported = await exportOf(wallId, ben.sessionKey);
    expect(exported).toContain(
      "## Goals and measurable results\n\n- Goal: Faster support\n  - [ ] Reply within one day — Target: from 3 days to 1, Owner: Ben, Review date: end of March",
    );
    expect(exported).toContain("Counted by approval: up to 2 votes a person");
    // the record stands in the note's row
    const stored = await runInDurableObject(stubOf(wallId), (_instance, state) =>
      String(state.storage.sql.exec("SELECT action FROM notes WHERE id = ?", result).one().action),
    );
    expect(JSON.parse(stored)).toEqual({ who: "Ben", due: "end of March", target: "from 3 days to 1", goal: faster });
  });
});
