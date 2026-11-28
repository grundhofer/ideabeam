// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Stage M7 (PLAN-METHODEN.md 5): an agenda of several methods on one wall, against the real object in workerd, read
// from the frames themselves:
//  - three methods run through, one after the other: the ideas and groups of the first are what the second scores
//    (its options are the wall's, not its own step's), the third writes hidden again while the first's notes stay
//    shown, and the export has a section for each;
//  - the moderation changes the methods not reached yet (`admin.agenda.set`): everybody hears the agenda, a method
//    the wall has reached cannot change, nobody else may change it;
//  - „Annahmen prüfen“ as a later method gets its fields when the wall reaches it, below what the wall holds.
// The rules themselves: packages/shared/test/agenda.test.ts.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateHexId, type AgendaItemRequest, type CreateWallResponse, type ServerEvent } from "@ideabeam/shared";
import { ask, join, postWall, resync, settle, type Sync, type TestSocket } from "./helpers.js";

type StepChanged = Extract<ServerEvent, { type: "step.changed" }>;
type AgendaChanged = Extract<ServerEvent, { type: "agenda.changed" }>;

async function createWall(items: AgendaItemRequest[], question = "What slows us down?") {
  const response = await postWall({ question, agenda: { items } });
  expect(response.status).toBe(200);
  return (await response.json()) as CreateWallResponse;
}

interface Person {
  socket: TestSocket;
  sync: Sync;
  you: string;
  sessionKey: string;
}

async function write(person: Person, text: string, x = 0, y = 0): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(person.socket, { type: "note.create", noteId, text, x, y })).toBe("ack");
  return noteId;
}

const THREE: AgendaItemRequest[] = [
  { methodId: "still-sammeln" },
  { methodId: "nutzen-aufwand", prompt: "Which of them first?" },
  { methodId: "scheitern" },
];

describe("an agenda of three methods", () => {
  it("runs through: the first method's groups are scored in the second, the third writes hidden again, the export has three sections", async () => {
    const { wallId, adminToken } = await createWall(THREE);
    const anna: Person = await join(wallId, "Anna", { adminToken });
    const ben: Person = await join(wallId, "Ben");
    expect(anna.sync.agenda.items.map((item) => item.methodId)).toEqual(THREE.map((item) => item.methodId));
    expect(anna.sync.agenda.items[1]?.prompt).toBe("Which of them first?");
    let step = 0;
    const go = async () =>
      expect(await ask(anna.socket, { type: "admin.step.go", from: step, to: ++step })).toBe("ack");

    // 1. „Still sammeln“: write hidden, reveal, bundle, vote, discuss
    const build = await write(anna, "The build is slow");
    const tickets = await write(ben, "Two ticket systems");
    const meetings = await write(ben, "Too many meetings");
    await go(); // reveal
    await go(); // bundle
    const groupId = generateHexId();
    expect(await ask(anna.socket, { type: "group.create", groupId, title: "Tools", x: 0, y: 0, w: 528, h: 400 })).toBe(
      "ack",
    );
    expect(
      await ask(anna.socket, {
        type: "notes.move",
        moves: [
          { noteId: build, x: 16, y: 40, groupId },
          { noteId: tickets, x: 16, y: 200, groupId },
        ],
      }),
    ).toBe("ack");
    await go(); // vote
    expect(
      await ask(ben.socket, { type: "ballot.cast", step: 3, ballot: { kind: "dots", points: { [groupId]: 2 } } }),
    ).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.step.count", step: 3 })).toBe("ack");
    await go(); // discuss

    // 2. „Nutzen und Aufwand“: the options written for everybody, then scored: the first method's group and its
    // note in no group come along (chaining: ideas → score)
    await go();
    expect(step).toBe(5);
    const option = await write(anna, "Merge the ticket systems");
    await go(); // score
    const entered = (await ben.socket.waitFor((e) => e.type === "step.changed" && e.step === 6)) as StepChanged;
    expect(entered.round?.options.map((one) => one.id).sort()).toEqual([groupId, meetings, option].sort());
    expect(
      await ask(ben.socket, {
        type: "ballot.cast",
        step: 6,
        ballot: { kind: "score", scores: { [groupId]: [5, 2], [meetings]: [3, 4], [option]: [4, 3] } },
      }),
    ).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.step.count", step: 6 })).toBe("ack");
    await go(); // discuss
    await go(); // decide
    const decision = await write(anna, "Tools first");
    expect(
      await ask(anna.socket, {
        type: "note.action",
        noteId: decision,
        action: { who: "", due: "", why: "Most value" },
      }),
    ).toBe("ack");
    // the first method's notes are no decisions of this one
    expect(
      await ask(anna.socket, { type: "note.action", noteId: meetings, action: { who: "", due: "", why: "x" } }),
    ).toBe("INVALID");

    // 3. „Scheitern vorwegdenken“: the plan, then reasons in private again
    await go(); // plan
    await go(); // reasons, hidden
    const marks = anna.socket.raw.length;
    await write(ben, "Nobody owns the migration");
    await settle();
    expect(anna.socket.raw.slice(marks).join("\n")).not.toContain("Nobody owns the migration");
    // the first method's notes stay shown to everybody
    const seen = await resync(ben.socket);
    expect(seen.notes.map((note) => note.text)).toContain("The build is slow");
    const annaSees = await resync(anna.socket);
    expect(annaSees.notes.map((note) => note.text)).not.toContain("Nobody owns the migration");
    await go(); // reveal by turn: nothing shown by being reached
    expect(await ask(anna.socket, { type: "admin.turn.next", step: 11, shown: 0 })).toBe("ack");
    await anna.socket.waitFor((e) => e.type === "turn.shown");
    await go(); // risks
    await go(); // adjust the plan
    expect(step).toBe(13);
    // the last step: there is no step after it
    expect(await ask(anna.socket, { type: "admin.step.go", from: 13, to: 14 })).toBe("INVALID");

    const response = await SELF.fetch(`https://example.com/api/walls/${wallId}/export?lang=en`, {
      headers: { authorization: `Session ${ben.sessionKey}` },
    });
    const text = await response.text();
    for (const heading of ["## 1. Write alone, group, vote in secret", "## 2. ", "## 3. Imagine the failure"]) {
      expect(text).toContain(heading);
    }
    expect(text).toContain("**Question:** Which of them first?");
    expect(text.indexOf("### Tools")).toBeLessThan(text.indexOf("## 2. "));
    expect(text.indexOf("Tools first")).toBeGreaterThan(text.indexOf("## 2. "));
    expect(text.indexOf("Nobody owns the migration")).toBeGreaterThan(text.indexOf("## 3. "));
    expect(text).not.toMatch(/\bAnna\b|\bBen\b/);
  });
});

describe("the moderation changes the methods not reached yet", () => {
  it("adds, reorders and removes them; everybody hears the agenda; a reached method never changes", async () => {
    const { wallId, adminToken } = await createWall(THREE);
    const anna: Person = await join(wallId, "Anna", { adminToken });
    const ben: Person = await join(wallId, "Ben");
    const reordered = [THREE[0], THREE[2], { methodId: "ziele", prompt: "Our goals?" }] as AgendaItemRequest[];
    expect(await ask(anna.socket, { type: "admin.agenda.set", items: reordered })).toBe("ack");
    const heard = (await ben.socket.waitFor((e) => e.type === "agenda.changed")) as AgendaChanged;
    expect(heard.agenda.items.map((item) => [item.methodId, item.prompt])).toEqual([
      ["still-sammeln", undefined],
      ["scheitern", undefined],
      ["ziele", "Our goals?"],
    ]);
    // the same list again changes nothing and tells nobody
    const marks = ben.socket.events.length;
    expect(await ask(anna.socket, { type: "admin.agenda.set", items: reordered })).toBe("ack");
    await settle();
    expect(ben.socket.events.slice(marks).some((e) => e.type === "agenda.changed")).toBe(false);
    // nobody but the moderation
    expect(await ask(ben.socket, { type: "admin.agenda.set", items: THREE })).toBe("NOT_ADMIN");
    // the snapshot carries it
    expect((await resync(ben.socket)).agenda.items.map((item) => item.methodId)).toEqual([
      "still-sammeln",
      "scheitern",
      "ziele",
    ]);

    // into the second method: the first two are reached now
    for (let step = 0; step < 5; step += 1) {
      expect(await ask(anna.socket, { type: "admin.step.go", from: step, to: step + 1 })).toBe("ack");
    }
    expect(await ask(anna.socket, { type: "admin.agenda.set", items: [THREE[0]] })).toBe("STALE");
    expect(await ask(anna.socket, { type: "admin.agenda.set", items: [THREE[0], THREE[1], reordered[2]] })).toBe(
      "STALE",
    );
    // going back keeps them reached
    expect(await ask(anna.socket, { type: "admin.step.go", from: 5, to: 4 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.agenda.set", items: [THREE[0]] })).toBe("STALE");
    // the method after them is still the moderation's
    expect(await ask(anna.socket, { type: "admin.agenda.set", items: reordered.slice(0, 2) })).toBe("ack");
    const last = (await ben.socket.waitFor(
      (e) => e.type === "agenda.changed" && e.agenda.items.length === 2,
    )) as AgendaChanged;
    expect(last.agenda.items).toHaveLength(2);
    // the reached steps are the very same
    expect(last.agenda.steps.slice(0, 10)).toEqual(heard.agenda.steps.slice(0, 10));
  });
});

describe("„Annahmen prüfen“ as a later method", () => {
  it("gets its fields when the wall reaches it, in the language asked for, below the notes", async () => {
    const { wallId, adminToken } = await createWall([{ methodId: "free" }, { methodId: "annahmen", language: "en" }]);
    const anna: Person = await join(wallId, "Anna", { adminToken });
    const ben: Person = await join(wallId, "Ben");
    expect(anna.sync.groups).toEqual([]);
    await write(ben, "An early note", 0, 600);
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    await ben.socket.waitFor((e) => e.type === "group.created");
    const sync = await resync(ben.socket);
    expect(sync.groups.map((group) => group.title)).toEqual(["Customers", "Problem", "Solution", "Money", "Delivery"]);
    expect(Math.min(...sync.groups.map((group) => group.y))).toBeGreaterThan(600);
    // going back and forth makes them once
    expect(await ask(anna.socket, { type: "admin.step.go", from: 1, to: 0 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    expect((await resync(ben.socket)).groups).toHaveLength(5);
  });
});
