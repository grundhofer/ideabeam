// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Estimating in rounds on the wall (PLAN-METHODEN.md 5, stage M3): „Schätzen – Diskutieren – Schätzen“ from its first
// estimate to its result. Acceptance of M3: the second round shows only the summary of the first, never a single
// estimate. These tests read every frame as it arrived, text for text, for the estimates of the others.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateHexId, type ServerEvent } from "@ideabeam/shared";
import { answer, ask, join, postWall, resync, settle } from "./helpers.js";

const ofType = <T extends ServerEvent["type"]>(events: ServerEvent[], type: T) =>
  events.filter((event): event is Extract<ServerEvent, { type: T }> => event.type === type);

const go = (from: number, to: number) => ({ type: "admin.step.go", from, to });
const cast = (value: number, step: number) => ({ type: "ballot.cast", step, ballot: { kind: "estimate", value } });
/** „Schätzen“: first estimate 0, feedback 1, discuss 2, estimate again 3, result 4. */
const [FIRST, FEEDBACK, DISCUSS, AGAIN, RESULT] = [0, 1, 2, 3, 4];

/** A wall that estimates in days: Anna moderates, Ben, Cem and Dora take part. */
async function aWallThatEstimates() {
  const response = await postWall({
    question: "Wie viele Tage braucht der Umzug?",
    agenda: { items: [{ methodId: "schaetzen", unit: "Tage" }] },
  });
  expect(response.status).toBe(200);
  const { wallId, adminToken } = (await response.json()) as { wallId: string; adminToken: string };
  const anna = await join(wallId, "Anna", { adminToken });
  const ben = await join(wallId, "Ben");
  const cem = await join(wallId, "Cem");
  const dora = await join(wallId, "Dora");
  return { wallId, anna, ben, cem, dora };
}

/** Every number the frames carry, but the numbers of changes, times and places: what a frame could give away of
 *  an estimate. */
function numbersIn(raw: readonly string[]): Set<number> {
  const found = new Set<number>();
  const skip = new Set(["seq", "createdAt", "updatedAt", "x", "y", "w", "h", "at", "rev", "endsAt", "resetsAt"]);
  const walk = (value: unknown, key: string) => {
    if (typeof value === "number" && !skip.has(key)) found.add(value);
    else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
    else if (typeof value === "object" && value !== null) {
      for (const [inner, item] of Object.entries(value)) walk(item, inner);
    }
  };
  for (const text of raw) walk(JSON.parse(text), "");
  return found;
}

describe("the first estimate", () => {
  it("opens with the wall, in its unit; the reasons beside it are hidden like hidden writing", async () => {
    const { anna, ben } = await aWallThatEstimates();
    expect(anna.sync).toMatchObject({
      step: FIRST,
      votes: [{ step: FIRST, options: [], omitted: 0, limit: 1, counted: false }],
      ballot: null,
      voted: 0,
      results: [],
    });
    expect(anna.sync.agenda.steps[FIRST]?.vote).toEqual({ kind: "estimate", unit: "Tage", min: null, max: null });
    // a reason: its writer reads it, the others learn that there is one
    const noteId = generateHexId();
    expect(await ask(ben.socket, { type: "note.create", noteId, text: "Letztes Mal 30", x: 0, y: 0 })).toBe("ack");
    await anna.socket.waitFor((event) => event.type === "wall.occupancy" && event.hidden === 1);
    expect((await resync(anna.socket)).notes).toEqual([]);
    expect((await resync(ben.socket)).notes).toMatchObject([{ id: noteId, text: "Letztes Mal 30", mine: true }]);
    // no group, no arranging while the estimates are hidden
    expect(
      await ask(anna.socket, { type: "group.create", groupId: generateHexId(), title: "", x: 0, y: 0, w: 400, h: 400 }),
    ).toBe("PHASE");
  });

  it("an estimate goes to its writer and to the others as a number of estimates; one that does not fit is refused", async () => {
    const { anna, ben, cem } = await aWallThatEstimates();
    const first = await answer(ben.socket, cast(23, FIRST));
    expect(first).toMatchObject({ type: "ack" });
    expect(ofType(ben.socket.events, "ballot.stored").at(-1)).toMatchObject({
      ballot: { kind: "estimate", value: 23 },
      voted: 1,
    });
    await cem.socket.waitFor((event) => event.type === "votes.count");
    expect(await ask(cem.socket, { type: "ballot.cast", step: FIRST, ballot: { kind: "estimate", value: "40" } })).toBe(
      "INVALID",
    );
    expect(await ask(cem.socket, { type: "ballot.cast", step: FIRST, ballot: { kind: "dots", points: {} } })).toBe(
      "INVALID",
    );
    // the same estimate again writes nothing and tells nobody
    const before = anna.socket.raw.length;
    expect(await ask(ben.socket, cast(23, FIRST))).toBe("ack");
    await settle();
    expect(anna.socket.raw.length).toBe(before);
    expect(numbersIn(anna.socket.raw).has(23)).toBe(false);
  });
});

describe("two rounds", () => {
  it("the moderation counts, everybody sees the summary only; the second round shows only the first's summary", async () => {
    const { anna, ben, cem, dora } = await aWallThatEstimates();
    const people = [anna, ben, cem, dora];
    const reasons: string[] = [];
    // four estimates of which the two in the middle never appear anywhere: 10, 23, 37, 90 give the median 30, the
    // middle half 19.75 to 50.25 and the range 10 to 90
    const first = [10, 23, 37, 90];
    for (const [n, person] of people.entries()) {
      expect(await ask(person.socket, cast(first[n]!, FIRST))).toBe("ack");
      const noteId = generateHexId();
      reasons.push(noteId);
      expect(await ask(person.socket, { type: "note.create", noteId, text: `Grund ${n + 1}`, x: n * 300, y: 0 })).toBe(
        "ack",
      );
    }
    // counting is the moderation's
    expect(await ask(ben.socket, { type: "admin.step.count", step: FIRST })).toBe("NOT_ADMIN");
    expect(await ask(anna.socket, { type: "admin.step.count", step: FIRST })).toBe("ack");
    const summary1 = { n: 4, median: 30, q1: 19.75, q3: 50.25, min: 10, max: 90 };
    const published = await ben.socket.waitFor((event) => event.type === "results.published");
    expect(published).toMatchObject({
      result: { step: FIRST, kind: "estimate", unit: "Tage", voters: 4, summary: summary1 },
    });
    // counted, an estimate is no longer taken
    expect(await ask(ben.socket, cast(24, FIRST))).toBe("PHASE");

    // the feedback reveals the reasons, without names
    expect(await ask(anna.socket, go(FIRST, FEEDBACK))).toBe("ack");
    const revealed = await cem.socket.waitFor((event) => event.type === "notes.revealed");
    expect(revealed.type === "notes.revealed" && revealed.notes.map((note) => note.text).sort()).toEqual([
      "Grund 1",
      "Grund 2",
      "Grund 4",
    ]);
    expect(JSON.stringify(revealed)).not.toMatch(/authorId|Anna|Ben|Dora/);
    expect(await ask(anna.socket, go(FEEDBACK, DISCUSS))).toBe("ack");
    // no reason is written while estimating again: it would be seen at once
    expect(await ask(anna.socket, go(DISCUSS, AGAIN))).toBe("ack");
    const into = await dora.socket.waitFor((event) => event.type === "step.changed" && event.step === AGAIN);
    expect(into).toMatchObject({
      round: { step: AGAIN, options: [], limit: 1, counted: false },
      voted: 0,
      ballot: null,
    });
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "Spät", x: 0, y: 0 })).toBe(
      "PHASE",
    );
    const again = (await resync(dora.socket)).results;
    expect(again).toEqual([{ step: FIRST, kind: "estimate", unit: "Tage", voters: 4, summary: summary1 }]);

    const second = [28, 31, 33, 60];
    for (const [n, person] of people.entries()) expect(await ask(person.socket, cast(second[n]!, AGAIN))).toBe("ack");
    await settle();
    // ACCEPTANCE: up to here no browser got anybody else's estimate, in no frame: the first round's two in the
    // middle (23, 37) nowhere, the second round's none at all but one's own
    for (const [n, person] of people.entries()) {
      const seen = numbersIn(person.socket.raw);
      for (const value of [23, 37]) {
        if (first[n] === value) continue;
        expect(seen.has(value), `${n}: ${value}`).toBe(false);
      }
      for (const [m, value] of second.entries()) {
        if (m === n) continue;
        expect(seen.has(value), `${n}: ${value}`).toBe(false);
      }
      // every estimate a browser got is its own
      for (const stored of ofType(person.socket.events, "ballot.stored")) {
        expect([first[n], second[n]]).toContain(stored.ballot.kind === "estimate" ? stored.ballot.value : -1);
      }
    }

    expect(await ask(anna.socket, { type: "admin.step.count", step: AGAIN })).toBe("ack");
    expect(await ask(anna.socket, go(AGAIN, RESULT))).toBe("ack");
    const end = await resync(ben.socket);
    expect(end.results).toEqual([
      { step: FIRST, kind: "estimate", unit: "Tage", voters: 4, summary: summary1 },
      {
        step: AGAIN,
        kind: "estimate",
        unit: "Tage",
        voters: 4,
        summary: { n: 4, median: 32, q1: 30.25, q3: 39.75, min: 28, max: 60 },
      },
    ]);
    // the reasons stay visible in the result
    expect(end.notes.map((note) => note.text).sort()).toEqual(["Grund 1", "Grund 2", "Grund 3", "Grund 4"]);
  });
});

describe("the export of the rounds", () => {
  it("both summaries and the reasons, no single estimate and no name", async () => {
    const { wallId, anna, ben } = await aWallThatEstimates();
    for (const [person, value] of [
      [anna, 20],
      [ben, 40],
    ] as const) {
      expect(await ask(person.socket, cast(value, FIRST))).toBe("ack");
    }
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "Wie 2025", x: 0, y: 0 })).toBe(
      "ack",
    );
    expect(await ask(anna.socket, { type: "admin.step.count", step: FIRST })).toBe("ack");
    expect(await ask(anna.socket, go(FIRST, FEEDBACK))).toBe("ack");
    const response = await exportOf(wallId, anna);
    expect(response).toContain("## Schätzung, Runde 1");
    expect(response).toContain("- Median: 30 Tage");
    expect(response).toContain("- Spanne: 20 bis 40 Tage");
    expect(response).toContain("## Begründungen");
    expect(response).toContain("- Wie 2025");
    expect(response).not.toMatch(/Anna|Ben/);
  });
});

async function exportOf(wallId: string, person: { sessionKey: string }): Promise<string> {
  const response = await SELF.fetch(`https://example.com/api/walls/${wallId}/export?lang=de`, {
    headers: { authorization: `Session ${person.sessionKey}` },
  });
  expect(response.status).toBe(200);
  return response.text();
}
