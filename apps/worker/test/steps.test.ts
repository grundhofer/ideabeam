// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// The steps of a wall's agenda (PLAN-METHODEN.md 4, stage M1): the moderation moves forward, back and past a step
// with `admin.step.go`; every browser hears `step.changed`. Acceptance of M1: going back never hides. These tests
// read the frames as they arrived, text for text.

import { describe, expect, it } from "vitest";
import { agendaOf, generateHexId, type ServerEvent } from "@ideabeam/shared";
import { answer, ask, createHiddenWall, join, postWall, resync, settle, type TestSocket } from "./helpers.js";

const ofType = <T extends ServerEvent["type"]>(events: ServerEvent[], type: T) =>
  events.filter((event): event is Extract<ServerEvent, { type: T }> => event.type === type);

async function write(socket: TestSocket, text: string): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(socket, { type: "note.create", noteId, text, x: 0, y: 0 })).toBe("ack");
  return noteId;
}

const go = (from: number, to: number) => ({ type: "admin.step.go", from, to });

describe("going back", () => {
  it("never hides: no frame takes a note away, and what is written in an earlier step is seen at once", async () => {
    const { wallId, adminToken } = await createHiddenWall();
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    const annas = await write(anna.socket, "Annas erster");
    await write(ben.socket, "Bens erster");
    // revealing (1 → notes.revealed 3, step.changed 4), then on to grouping (5)
    expect(await answer(anna.socket, go(0, 1))).toMatchObject({ type: "ack", seq: 4 });
    expect(await answer(anna.socket, go(1, 2))).toMatchObject({ type: "ack", seq: 5 });
    await ben.socket.waitFor((event) => event.type === "step.changed" && event.seq === 5);
    const revealedFrames = ben.socket.raw.length;

    // back to the writing step: the step changes, what was reached stays
    expect(await answer(anna.socket, go(2, 0))).toMatchObject({ type: "ack", seq: 6 });
    expect(await ben.socket.waitFor((event) => event.type === "step.changed" && event.seq === 6)).toEqual({
      type: "step.changed",
      seq: 6,
      step: 0,
      reach: 2,
    });
    // a note written now is there for everyone at once, as in every step after revealing
    const later = await write(anna.socket, "Annas später");
    expect(await ben.socket.waitFor((event) => event.type === "note.created" && event.note.id === later)).toMatchObject(
      {
        note: { text: "Annas später", mine: false },
      },
    );
    await settle();
    const after = ben.socket.raw.slice(revealedFrames).map((text) => JSON.parse(text) as { type: string });
    // the frames after going back: the step and the new note. Nothing that hides or stands in for a note: no `wall.occupancy`, no second `notes.revealed`, no delete
    expect(after.map((frame) => frame.type)).toEqual(["step.changed", "note.created"]);
    expect(ofType(ben.socket.events, "notes.revealed")).toHaveLength(1);
    // a snapshot of the wall in the writing step holds every note, Anna's first among them
    const sync = await resync(ben.socket);
    expect(sync).toMatchObject({ step: 0, reach: 2, hidden: 0 });
    expect(sync.notes.map((note) => note.text)).toEqual(["Annas erster", "Bens erster", "Annas später"]);
    expect(sync.notes.find((note) => note.id === annas)).toMatchObject({ mine: false });
    // the writing step's own rules hold: no groups, and its clock
    expect(
      await ask(ben.socket, { type: "group.create", groupId: generateHexId(), title: "", x: 0, y: 0, w: 200, h: 200 }),
    ).toBe("PHASE");
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 3 })).toBe("ack");
    // and forward again reveals nothing a second time: one frame, one number
    const before = ben.socket.events.length;
    expect(await answer(anna.socket, go(0, 1))).toMatchObject({ type: "ack", seq: 9 });
    await settle();
    expect(ben.socket.events.slice(before).map((event) => event.type)).toEqual(["step.changed"]);
  });
});

describe("a step move", () => {
  it("forward without revealing is one frame with one number, and stops the clock of the step", async () => {
    const { wallId, adminToken } = await createHiddenWall();
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    expect(await answer(anna.socket, go(0, 1))).toMatchObject({ seq: 2 });
    const before = ben.socket.events.length;
    expect(await answer(anna.socket, go(1, 4))).toMatchObject({ type: "ack", seq: 3 });
    await settle();
    expect(ben.socket.events.slice(before)).toEqual([{ type: "step.changed", seq: 3, step: 4, reach: 4 }]);
  });

  it("names the step it was made in: sent again it changes nothing, made for a step the wall has left it is refused", async () => {
    const { wallId, adminToken } = await createHiddenWall();
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    expect(await answer(anna.socket, go(0, 1))).toMatchObject({ type: "ack", seq: 2 });
    expect(await answer(anna.socket, go(0, 1))).toMatchObject({ type: "ack", seq: 2 });
    expect(await ask(anna.socket, go(0, 2))).toBe("STALE");
    expect(await ask(anna.socket, go(1, 5))).toBe("INVALID");
    expect(await ask(ben.socket, go(1, 2))).toBe("NOT_ADMIN");
    await settle();
    expect(ofType(ben.socket.events, "step.changed")).toHaveLength(1);
  });
});

describe("a new wall's method", () => {
  it("is the one the request names, whatever `hidden` says", async () => {
    const response = await postWall({ question: "Q?", hidden: true, agenda: { items: [{ methodId: "free" }] } });
    expect(response.status).toBe(200);
    const { wallId } = (await response.json()) as { wallId: string };
    expect((await join(wallId, "Anna")).sync).toMatchObject({ agenda: agendaOf("free"), step: 0, reach: 0 });
    for (const agenda of [{ items: [{ methodId: "nope" }] }, { items: [] }, "free"]) {
      expect((await postWall({ question: "Q?", agenda })).status, JSON.stringify(agenda)).toBe(400);
    }
  });
});
