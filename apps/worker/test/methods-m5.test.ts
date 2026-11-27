// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// The methods of stage M5 (PLAN-METHODEN.md 5, „Paket A“) against the real object in workerd, read from the frames
// themselves, text for text:
//  - revealing by turn („Stille Ideenrunde mit Rangfolge“, „Scheitern vorwegdenken“): entering the step shows no
//    note; each „Nächster Zettel“ shows exactly one, to everybody at once, interleaved by writer; no frame carries a
//    note before its turn; the next step shows the rest; the order never leaves the object;
//  - a later round of writing hides the new notes again while what was shown stays shown („Was? Na und? Was nun?“,
//    „Rückblick nach Ziel und Daten“), and the small groups are kept from round to round;
//  - a vote over the notes of one step, and the actions with „Wer“ and „Bis wann“ that the moderation agrees on,
//    in the snapshot and the export, never refused for the moderation and refused for everybody else.
// The rules themselves: packages/shared/test/turns.test.ts, test/m5.test.ts.

import { runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateHexId, type CreateWallResponse, type MethodId, type ServerEvent } from "@ideabeam/shared";
import { answer, ask, join, postWall, resync, settle, stubOf, type Sync, type TestSocket } from "./helpers.js";

type TurnShown = Extract<ServerEvent, { type: "turn.shown" }>;
type StepChanged = Extract<ServerEvent, { type: "step.changed" }>;
type Revealed = Extract<ServerEvent, { type: "notes.revealed" }>;

async function createWall(methodId: MethodId, question = "What matters most?"): Promise<CreateWallResponse> {
  const response = await postWall({ question, agenda: { items: [{ methodId }] } });
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

async function write(person: Person, text: string): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(person.socket, { type: "note.create", noteId, text, x: 0, y: 0 })).toBe("ack");
  return noteId;
}

const texts = (frames: readonly string[]) => frames.join("\n");

/** The wall as Markdown, in English, for the person behind a session key. */
async function exportOf(wallId: string, sessionKey: string): Promise<string> {
  const response = await SELF.fetch(`https://example.com/api/walls/${wallId}/export?lang=en`, {
    headers: { authorization: `Session ${sessionKey}` },
  });
  expect(response.status).toBe(200);
  return response.text();
}

describe("revealing by turn", () => {
  it("entering the step shows nothing; each „Nächster Zettel“ shows one note to everybody at once, interleaved by writer; no frame carries a note before its turn", async () => {
    const { wallId, adminToken } = await createWall("ideenrunde");
    const group = await people(wallId, adminToken, ["Anna", "Ben", "Cem"]);
    const [anna, ben, cem] = group as [Person, Person, Person];
    const written = new Map<string, string>();
    for (const person of group) {
      for (const n of [1, 2]) {
        const text = `idea ${person.name} ${n}`;
        written.set(text, person.name);
        await write(person, text);
      }
    }
    // Ben writes a third: the order deals the third round to Ben alone
    written.set("idea Ben 3", "Ben");
    await write(ben, "idea Ben 3");

    const marks = group.map((person) => person.socket.raw.length);
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    for (const person of group) {
      const changed = (await person.socket.waitFor((e) => e.type === "step.changed" && e.step === 1)) as StepChanged;
      expect(changed.turn).toEqual({ step: 1, shown: 0, left: 7 });
    }
    await settle();
    // no note was revealed by entering the step, and nobody got anybody else's note
    for (const [n, person] of group.entries()) {
      const since = person.socket.raw.slice(marks[n]);
      expect(since.some((frame) => frame.includes('"notes.revealed"'))).toBe(false);
      for (const [text, writer] of written) if (writer !== person.name) expect(texts(since)).not.toContain(text);
    }
    // a member may not reveal
    expect(await ask(ben.socket, { type: "admin.turn.next", step: 1, shown: 0 })).toBe("NOT_ADMIN");

    const order: string[] = [];
    for (let shown = 0; shown < 7; shown += 1) {
      const before = group.map((person) => person.socket.raw.length);
      expect(await ask(anna.socket, { type: "admin.turn.next", step: 1, shown })).toBe("ack");
      const frames = await Promise.all(
        group.map(
          (person) =>
            person.socket.waitFor(
              (e, index) => index >= 0 && e.type === "turn.shown" && e.turn.shown === shown + 1,
            ) as Promise<TurnShown>,
        ),
      );
      // the note shown now: everybody but its writer gets it in this frame, its writer had it
      const got = frames.flatMap((frame) => frame.notes.map((note) => note.text));
      const text = got[0] as string;
      expect(new Set(got)).toEqual(new Set([text]));
      expect(got).toHaveLength(2);
      order.push(text);
      for (const frame of frames) expect(frame.turn).toEqual({ step: 1, shown: shown + 1, left: 6 - shown });
      // nothing else: no note that has not had its turn yet reached anybody
      for (const [n, person] of group.entries()) {
        const since = texts(person.socket.raw.slice(before[n]));
        for (const later of [...written.keys()].filter((one) => !order.includes(one))) {
          if (written.get(later) !== person.name) expect(since).not.toContain(later);
        }
      }
    }
    // interleaved: every writer's first note before anybody's second, the third last
    const writers = order.map((text) => written.get(text));
    expect(new Set(writers.slice(0, 3)).size).toBe(3);
    expect(new Set(writers.slice(3, 6)).size).toBe(3);
    expect(order[6]).toBe("idea Ben 3");
    // each writer's notes in the order they were written
    for (const person of group) {
      const own = order.filter((text) => written.get(text) === person.name);
      expect(own).toEqual([...own].sort());
    }
    // none left: pressed again it changes nothing, the same press twice is one
    expect(await ask(anna.socket, { type: "admin.turn.next", step: 1, shown: 7 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.turn.next", step: 1, shown: 3 })).toBe("ack");
    expect((await resync(cem.socket)).turns).toEqual([{ step: 1, shown: 7, left: 0 }]);
    // the order never left the object: no frame names a note before it was shown, no frame has an „order“
    for (const person of group) expect(texts(person.socket.raw)).not.toContain('"order"');
  });

  it("moving on before every note is shown shows the rest; a snapshot holds exactly the shown notes", async () => {
    const { wallId, adminToken } = await createWall("scheitern", "Our launch plan");
    const [anna, ben] = await people(wallId, adminToken, ["Anna", "Ben"]);
    if (anna === undefined || ben === undefined) throw new Error("nobody joined");
    // the plan is presented: nobody writes yet
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "early", x: 0, y: 0 })).toBe(
      "PHASE",
    );
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    await write(anna, "reason Anna");
    await write(ben, "reason Ben 1");
    await write(ben, "reason Ben 2");
    expect(await ask(anna.socket, { type: "admin.step.go", from: 1, to: 2 })).toBe("ack");
    // nothing is written or deleted while the notes are revealed by turn
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "late", x: 0, y: 0 })).toBe(
      "PHASE",
    );
    expect(await ask(anna.socket, { type: "admin.turn.next", step: 2, shown: 0 })).toBe("ack");
    const shown = (await anna.socket.waitFor((e) => e.type === "turn.shown")) as TurnShown;
    const benSync = await resync(ben.socket);
    const annaSync = await resync(anna.socket);
    // Ben holds his two and the one shown, if it is Anna's; Anna hers and the one shown
    const first = shown.notes[0]?.text ?? "reason Anna";
    expect(annaSync.notes.map((note) => note.text).sort()).toEqual([...new Set(["reason Anna", first])].sort());
    expect(benSync.notes.map((note) => note.text).sort()).toEqual(
      [...new Set(["reason Ben 1", "reason Ben 2", first])].sort(),
    );
    expect(annaSync.hidden + annaSync.notes.length).toBe(3);
    // the export holds what the snapshot holds, and says how many are still hidden
    const exported = await exportOf(wallId, anna.sessionKey);
    for (const text of ["reason Anna", first]) expect(exported).toContain(`- ${text}`);
    expect(exported).toContain(
      annaSync.hidden === 1 ? "1 note is still hidden" : `${annaSync.hidden} notes are still hidden`,
    );
    for (const text of ["reason Ben 1", "reason Ben 2"].filter((one) => one !== first)) {
      expect(exported).not.toContain(text);
    }
    // on: the rest is revealed, to everybody, exactly the difference
    expect(await ask(anna.socket, { type: "admin.step.go", from: 2, to: 3 })).toBe("ack");
    const revealed = (await anna.socket.waitFor((e) => e.type === "notes.revealed")) as Revealed;
    expect(revealed.notes.map((note) => note.text).sort()).toEqual(
      ["reason Ben 1", "reason Ben 2", "reason Anna"].filter((text) => text !== first && text !== "reason Anna").sort(),
    );
    expect((await resync(anna.socket)).notes).toHaveLength(3);
  });
});

describe("a later round of writing hides again", () => {
  it("„Was? Na und? Was nun?“: the second round's notes go to their writer alone, then to the kept small group, then to everybody; the first round's stay seen", async () => {
    const { wallId, adminToken } = await createWall("was-na-und");
    const names = ["Anna", "Ben", "Cem", "Dora", "Emil", "Finn", "Gül", "Hana"];
    const group = await people(wallId, adminToken, names);
    const [anna] = group as [Person];
    const firstIds = new Map<string, string>();
    for (const person of group) firstIds.set(person.name, await write(person, `what ${person.name}`));
    /** The moderation's map of the teams after a move, from its own frame. */
    const go = async (from: number) => {
      expect(await ask(anna.socket, { type: "admin.step.go", from, to: from + 1 })).toBe("ack");
      let changed: StepChanged | null = null;
      for (const person of group) {
        const frame = (await person.socket.waitFor(
          (e) => e.type === "step.changed" && e.step === from + 1,
        )) as StepChanged;
        if (person === anna) changed = frame;
      }
      return changed as StepChanged;
    };
    const firstMap = (await go(0)).team;
    const firstTeams = (firstMap?.members ?? []).map((team) => [...(team ?? [])].sort());
    // eight people in small groups of about five: two fours
    expect(firstTeams.map((team) => team.length)).toEqual([4, 4]);
    await go(1);
    await go(2);
    const marks = group.map((person) => person.socket.raw.length);
    for (const person of group) await write(person, `soWhat ${person.name}`);
    await settle();
    for (const [n, person] of group.entries()) {
      const since = texts(person.socket.raw.slice(marks[n]));
      for (const other of group) {
        if (other !== person) expect(since).not.toContain(`soWhat ${other.name}`);
      }
      const sync = await resync(person.socket);
      // the first round's eight, the own one of the second, seven hidden
      expect(sync.notes).toHaveLength(9);
      expect(sync.hidden).toBe(7);
    }
    // the first round's notes are still moved for everybody to see
    const annaNote = firstIds.get("Anna");
    expect(
      await ask(anna.socket, { type: "notes.move", moves: [{ noteId: annaNote, x: 40, y: 40, groupId: null }] }),
    ).toBe("ack");
    for (const person of group.slice(1)) {
      await person.socket.waitFor((e) => e.type === "notes.moved" && e.moves.some((move) => move.noteId === annaNote));
    }
    // into the small groups: the same teams as in the first round, with areas of their own beside the first ones
    const kept = (await go(3)).team;
    expect((kept?.members ?? []).map((team) => [...(team ?? [])].sort())).toEqual(firstTeams);
    const firstEnd = Math.max(...(firstMap?.areas ?? []).map((area) => area.first + area.count));
    expect(kept?.areas.every((area) => area.first >= firstEnd)).toBe(true);
    for (const person of group) {
      const own = await resync(person.socket);
      const mates = (kept?.members ?? []).find((team) => team?.includes(person.you)) ?? [];
      // the second round's notes of the own team, and no other
      expect(own.notes.filter((note) => note.text.startsWith("soWhat")).length).toBe(mates.length);
      expect(own.notes).toHaveLength(8 + mates.length);
      // the first round's note everybody had seen did not move into the areas
      expect(own.notes.find((note) => note.id === annaNote)).toMatchObject({ x: 40, y: 40 });
    }
    await go(4);
    for (const person of group) expect((await resync(person.socket)).notes).toHaveLength(16);
  });
});

describe("actions", () => {
  it("„Rückblick nach Ziel und Daten“: the vote offers the proposed actions alone; the moderation agrees on actions with who and by when, nobody else does, and the export lists them as tasks", async () => {
    const { wallId, adminToken } = await createWall("rueckblick", "Sprint 12");
    const group = await people(wallId, adminToken, ["Anna", "Ben", "Cem"]);
    const [anna, ben] = group as [Person, Person];
    const go = async (from: number) =>
      expect(await ask(anna.socket, { type: "admin.step.go", from, to: from + 1 })).toBe("ack");
    await write(anna, "Goal: ship the search");
    await go(0);
    await write(ben, "Data: 3 of 5 stories done");
    await go(1);
    await go(2);
    await write(ben, "Reason: unclear scope");
    await go(3);
    await go(4);
    const action1 = await write(anna, "Write acceptance criteria | first");
    const action2 = await write(ben, "Pair on reviews");
    await go(5);
    await go(6);
    const round = (await resync(ben.socket)).votes.find((vote) => vote.step === 7);
    expect(round?.options.map((option) => option.id).sort()).toEqual([action1, action2].sort());
    expect(
      await ask(ben.socket, { type: "ballot.cast", step: 7, ballot: { kind: "dots", points: { [action2]: 2 } } }),
    ).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.step.count", step: 7 })).toBe("ack");
    // agreeing is the decide step's
    expect(
      await ask(anna.socket, { type: "note.action", noteId: action1, action: { who: "Anna", due: "Friday" } }),
    ).toBe("PHASE");
    await go(7);
    expect(await ask(ben.socket, { type: "note.action", noteId: action1, action: { who: "Ben", due: "" } })).toBe(
      "NOT_ADMIN",
    );
    // a note that is no action is none
    const goal = (await resync(anna.socket)).notes.find((note) => note.text.startsWith("Goal"));
    expect(await ask(anna.socket, { type: "note.action", noteId: goal?.id, action: { who: "x", due: "" } })).toBe(
      "INVALID",
    );
    const said = await answer(anna.socket, {
      type: "note.action",
      noteId: action1,
      action: { who: "Anna *", due: "Friday" },
    });
    expect(said.type).toBe("ack");
    const told = await ben.socket.waitFor((e) => e.type === "note.action");
    expect(told).toMatchObject({ noteId: action1, action: { who: "Anna *", due: "Friday" } });
    // the same again changes nothing; a new action in the step is an action too
    expect(
      await ask(anna.socket, { type: "note.action", noteId: action1, action: { who: "Anna *", due: "Friday" } }),
    ).toBe("ack");
    const action3 = await write(ben, "Book a room");
    expect(await ask(anna.socket, { type: "note.action", noteId: action3, action: { who: "", due: "" } })).toBe("ack");
    const sync = await resync(ben.socket);
    expect(sync.notes.find((note) => note.id === action1)).toMatchObject({
      step: 5,
      action: { who: "Anna *", due: "Friday" },
    });
    expect(sync.notes.find((note) => note.id === action3)).toMatchObject({ step: 8, action: { who: "", due: "" } });
    // stored in the note's row
    const stored = await runInDurableObject(stubOf(wallId), (_instance, state) =>
      String(state.storage.sql.exec("SELECT action FROM notes WHERE id = ?", action1).one().action),
    );
    expect(JSON.parse(stored)).toEqual({ who: "Anna *", due: "Friday" });
    // the export: every step's notes under its name, the agreed actions as tasks, escaped, no name of a person who
    // wrote; an action nobody agreed on stays a note of its step
    const exported = await exportOf(wallId, ben.sessionKey);
    expect(exported).toContain("## What was supposed to happen? Write down the goal\n\n- Goal: ship the search");
    expect(exported).toContain("## What happened? Facts, numbers, timeline\n\n- Data: 3 of 5 stories done");
    expect(exported).toContain("## Why the gap? Reasons in small groups\n\n- Reason: unclear scope");
    expect(exported).toContain("## Propose actions\n\n- Pair on reviews");
    expect(exported).toContain(
      "## Agreed actions\n\n- [ ] Write acceptance criteria \\| first — Who: Anna \\*, by: Friday\n- [ ] Book a room\n",
    );
    expect(exported).toContain("Counted by points");
    for (const name of ["Ben", "Cem"]) expect(exported).not.toContain(name);
    // taken back
    expect(await ask(anna.socket, { type: "note.action", noteId: action3, action: null })).toBe("ack");
    expect((await resync(anna.socket)).notes.find((note) => note.id === action3)?.action).toBeUndefined();
  });
});
