// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pairs and small groups (stage M4 of the methods, PLAN-METHODEN.md 5): „1-2-4-Alle“ against the real object in
// workerd. The acceptance: a team sees no other team's notes (read from the frames themselves, text for text);
// merging shows exactly the difference; a workshop survives the object's eviction in the middle of a step of teams;
// a step that moves on by itself does so through the one alarm, an alarm that comes late or twice does nothing, and
// the day the wall deletes itself still comes. The rules themselves: packages/shared/test/teams.test.ts.

import { evictAllDurableObjects, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  areaAt,
  areaBox,
  generateHexId,
  type Clock,
  type CreateWallResponse,
  type ServerEvent,
  type TeamView,
} from "@ideabeam/shared";
import { answer, ask, join, postWall, resync, settle, stubOf, type Sync, type TestSocket } from "./helpers.js";

type StepChanged = Extract<ServerEvent, { type: "step.changed" }>;
type Revealed = Extract<ServerEvent, { type: "notes.revealed" }>;
type TeamChanged = Extract<ServerEvent, { type: "team.changed" }>;

const MIN = 60_000;

async function createWall(): Promise<CreateWallResponse> {
  const response = await postWall({
    question: "How do we onboard faster?",
    agenda: { items: [{ methodId: "eins-zwei-vier" }] },
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

/** A 1-2-4-Alle wall with Anna moderating and three more; everybody writes one note while alone. */
async function wall(names = ["Anna", "Ben", "Cem", "Dora"]) {
  const { wallId, adminToken } = await createWall();
  const people: Person[] = [];
  for (const [n, name] of names.entries()) {
    people.push({ name, ...(await join(wallId, name, n === 0 ? { adminToken } : {})) });
  }
  for (const person of people) {
    expect(
      await ask(person.socket, {
        type: "note.create",
        noteId: generateHexId(),
        text: `alone:${person.name}`,
        x: 0,
        y: 0,
      }),
    ).toBe("ack");
  }
  return { wallId, adminToken, people, anna: people[0] as Person };
}

const textsIn = (frames: readonly string[]) => frames.join("\n");
/** The team of `you` in the moderation's map. */
const partnersOf = (map: TeamView, you: string): string[] => map.members.find((team) => team?.includes(you)) ?? [you];

describe("pairs and small groups", () => {
  it("forms pairs from the people present; a pair reads its own notes and of the others only how many there are", async () => {
    const { people, anna } = await wall();
    const before = people.map((person) => person.socket.raw.length);
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    const views = new Map<string, TeamView>();
    for (const person of people) {
      const changed = (await person.socket.waitFor((e) => e.type === "step.changed" && e.step === 1)) as StepChanged;
      expect(changed.team).toBeDefined();
      views.set(person.you, changed.team as TeamView);
      // the step moves on by itself: its clock runs from the move, two minutes
      expect(changed.clock?.endsAt).toBe((changed.serverNow ?? 0) + 2 * MIN);
    }
    // the moderation is told the whole map, everybody else their own team
    const map = views.get(anna.you) as TeamView;
    expect(map.members).toHaveLength(2);
    expect(map.members.every((team) => team !== null && team.length === 2)).toBe(true);
    expect(map.members.flat().sort()).toEqual(people.map((person) => person.you).sort());
    for (const person of people.slice(1)) {
      const view = views.get(person.you) as TeamView;
      expect(view.members.filter((team) => team !== null)).toHaveLength(1);
      expect(view.members[view.own as number]).toContain(person.you);
    }
    // every frame since the move, text for text: the partner's note, never another pair's
    for (const [n, person] of people.entries()) {
      const partner = partnersOf(map, person.you).find((id) => id !== person.you) as string;
      const partnerName = people.find((other) => other.you === partner)?.name as string;
      const frames = textsIn(person.socket.raw.slice(before[n]));
      expect(frames).toContain(`alone:${partnerName}`);
      for (const other of people) {
        if (other.you === person.you || other.you === partner) continue;
        expect(frames, `${person.name} reads ${other.name}`).not.toContain(`alone:${other.name}`);
      }
      const revealed = person.socket.events.find((e) => e.type === "notes.revealed") as Revealed;
      expect(revealed.notes.map((note) => note.text)).toEqual([`alone:${partnerName}`]);
      expect(revealed.hidden).toBe(2);
      expect((await resync(person.socket)).hidden).toBe(2);
    }

    // a note written in the pair: the partner reads it, the other pair hears a number
    const ben = people[1] as Person;
    const benPartner = partnersOf(map, ben.you).find((id) => id !== ben.you) as string;
    const marks = people.map((person) => person.socket.raw.length);
    const noteId = generateHexId();
    expect(await ask(ben.socket, { type: "note.create", noteId, text: "pair:Ben", x: 40, y: 1300 })).toBe("ack");
    await settle();
    for (const [n, person] of people.entries()) {
      const frames = textsIn(person.socket.raw.slice(marks[n]));
      if (person.you === ben.you || person.you === benPartner) expect(frames).toContain("pair:Ben");
      else {
        expect(frames).not.toContain("pair:Ben");
        expect(frames).not.toContain(noteId);
        expect(frames).toContain('"wall.occupancy"');
      }
    }
    // and nobody outside the pair may touch it: to them it is not on the wall
    const outsider = people.find((person) => person.you !== ben.you && person.you !== benPartner) as Person;
    expect(await ask(outsider.socket, { type: "note.update", noteId, text: "mine now" })).toBe("NOT_FOUND");
    const partner = people.find((person) => person.you === benPartner) as Person;
    // the partner moves it, but its text stays its writer's
    expect(await ask(partner.socket, { type: "notes.move", moves: [{ noteId, x: 80, y: 1320, groupId: null }] })).toBe(
      "ack",
    );
    expect(await ask(partner.socket, { type: "note.update", noteId, text: "mine now" })).toBe("NOT_AUTHOR");
  });

  it("forming the pairs moves everybody's notes written alone into their team's area, and tells each their own", async () => {
    const { people, anna } = await wall();
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    for (const person of people) {
      const changed = (await person.socket.waitFor((e) => e.type === "step.changed" && e.step === 1)) as StepChanged;
      const team = changed.team as TeamView;
      const area = areaBox(team.areas[team.own as number] as never);
      // the person's own note and the partner's: both moved, both now in the team's area
      expect(changed.moves).toHaveLength(2);
      const sync = await resync(person.socket);
      expect(sync.notes).toHaveLength(2);
      for (const note of sync.notes) {
        expect(areaAt(team.areas, note), `${person.name}: ${JSON.stringify(note)}`).toBe(team.own);
        expect(note.y).toBe(area.y + 48);
      }
    }
    // the merge moves nothing: the fours' areas hold the pairs'
    expect(await ask(anna.socket, { type: "admin.step.go", from: 1, to: 2 })).toBe("ack");
    const merged = (await anna.socket.waitFor((e) => e.type === "step.changed" && e.step === 2)) as StepChanged;
    expect(merged.moves).toBeUndefined();
  });

  it("merging the pairs into fours shows exactly the other pair's notes, and going back hides nothing", async () => {
    const { people, anna } = await wall();
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    for (const person of people) {
      await person.socket.waitFor((e) => e.type === "step.changed" && e.step === 1);
      await ask(person.socket, {
        type: "note.create",
        noteId: generateHexId(),
        text: `pair:${person.name}`,
        x: 0,
        y: 1300,
      });
    }
    const map = (anna.socket.events.find((e) => e.type === "step.changed" && e.step === 1) as StepChanged)
      .team as TeamView;
    const marks = people.map((person) => person.socket.events.length);
    expect(await ask(anna.socket, { type: "admin.step.go", from: 1, to: 2 })).toBe("ack");
    for (const [n, person] of people.entries()) {
      const pair = partnersOf(map, person.you);
      const revealed = (await person.socket.waitFor(
        (e, index) => index >= (marks[n] as number) && e.type === "notes.revealed",
      )) as Revealed;
      // exactly the other pair's notes, both of them, and nothing they had already
      const others = people.filter((other) => !pair.includes(other.you)).map((other) => other.name);
      expect(revealed.notes.map((note) => note.text).sort()).toEqual(
        others.flatMap((name) => [`alone:${name}`, `pair:${name}`]).sort(),
      );
      expect(revealed.hidden).toBe(0);
      const changed = (await person.socket.waitFor((e) => e.type === "step.changed" && e.step === 2)) as StepChanged;
      expect(changed.team?.members.flat().filter((id) => id !== null)).toHaveLength(person === anna ? 4 : 4);
      expect(changed.team?.areas).toEqual([{ first: 0, count: 2 }]);
    }
    // back to the pairs: the pairs come back, and every note stays seen
    expect(await ask(anna.socket, { type: "admin.step.go", from: 2, to: 1 })).toBe("ack");
    const back = await resync(people[1]?.socket as TestSocket);
    expect(back.notes).toHaveLength(8);
    expect(back.hidden).toBe(0);
    expect(back.teams?.members).toHaveLength(2);
  });

  it("the moderation swaps two people: they read their new partner's notes and keep what they read", async () => {
    const { people, anna } = await wall();
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    await settle();
    const sync = await resync(anna.socket);
    const teams = sync.teams as TeamView;
    const [first, second] = teams.members as [string[], string[]];
    const a = first[0] as string;
    const b = second[0] as string;
    const swappedTeams = [first.map((id) => (id === a ? b : id)), second.map((id) => (id === b ? a : id))];
    const member = people.find((person) => person.you !== anna.you) as Person;
    expect(await ask(member.socket, { type: "admin.teams.set", rev: teams.rev, teams: swappedTeams })).toBe(
      "NOT_ADMIN",
    );
    // not the same people, or a team left with one person when pairs fit: refused
    expect(
      await ask(anna.socket, { type: "admin.teams.set", rev: teams.rev, teams: [[a], [...first.slice(1), ...second]] }),
    ).toBe("INVALID");
    expect(
      await ask(anna.socket, { type: "admin.teams.set", rev: teams.rev, teams: [[a, b], [generateHexId()]] }),
    ).toBe("INVALID");
    const mover = people.find((person) => person.you === a) as Person;
    const marks = mover.socket.raw.length;
    expect(await ask(anna.socket, { type: "admin.teams.set", rev: teams.rev, teams: swappedTeams })).toBe("ack");
    // the same teams again change nothing; teams made for the old revision are refused
    expect(await ask(anna.socket, { type: "admin.teams.set", rev: teams.rev, teams: swappedTeams })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.teams.set", rev: teams.rev, teams: [first, second] })).toBe("STALE");
    const changed = (await mover.socket.waitFor((e) => e.type === "team.changed")) as TeamChanged;
    const newPartner = second.find((id) => id !== b) as string;
    const newName = people.find((person) => person.you === newPartner)?.name as string;
    expect(changed.notes.map((note) => note.text)).toEqual([`alone:${newName}`]);
    expect(changed.team.members[changed.team.own as number]?.sort()).toEqual([a, newPartner].sort());
    const now = await resync(mover.socket);
    // the old partner's note stays, the new one's comes: three of four notes
    expect(now.notes).toHaveLength(3);
    expect(now.hidden).toBe(1);
    expect(textsIn(mover.socket.raw.slice(marks))).not.toContain(`alone:${people.find((p) => p.you === b)?.name}`);
  });

  it("somebody who comes late joins the smallest team; the others hear of it", async () => {
    const { wallId, people, anna } = await wall(["Anna", "Ben", "Cem", "Dora", "Emil"]);
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    await settle();
    const sizes = ((await resync(anna.socket)).teams as TeamView).members.map((team) => team?.length);
    expect(sizes.sort()).toEqual([2, 3]);
    const late = await join(wallId, "Finn");
    const view = late.sync.teams as TeamView;
    expect(view.members[view.own as number]).toHaveLength(3);
    expect(view.members.filter((team) => team !== null)).toHaveLength(1);
    const told = (await anna.socket.waitFor((e) => e.type === "team.changed")) as TeamChanged;
    expect(told.team.members.map((team) => team?.length).sort()).toEqual([3, 3]);
    expect(told.seq).toBe(late.sync.seq);
    // coming back is no coming late
    late.socket.ws.close(1000, "bye");
    await settle();
    const again = await join(wallId, "Finn", { sessionKey: late.sessionKey });
    expect(again.sync.teams?.rev).toBe(view.rev);
    expect(people).toHaveLength(5);
  });

  it("survives the object's eviction in the middle of a step of teams", async () => {
    const { wallId, people, anna } = await wall();
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    await settle();
    const syncs = new Map<string, Sync>();
    for (const person of people) syncs.set(person.you, await resync(person.socket));
    for (const person of people) person.socket.ws.close(1000, "bye");
    await settle();
    await evictAllDurableObjects();
    // nothing was in memory: everybody comes back to the same teams, the same notes and the same clock
    for (const person of people) {
      const back = await join(wallId, person.name, { sessionKey: person.sessionKey });
      const was = syncs.get(person.you) as Sync;
      expect(back.sync.teams).toEqual(was.teams);
      expect(back.sync.notes.map((note) => note.text).sort()).toEqual(was.notes.map((note) => note.text).sort());
      expect(back.sync.hidden).toBe(was.hidden);
      expect(back.sync.clock).toEqual(was.clock);
      person.socket = back.socket;
    }
    // and goes on: the merge shows the rest
    expect(await ask(people[0]?.socket as TestSocket, { type: "admin.step.go", from: 1, to: 2 })).toBe("ack");
    expect((await resync(people[2]?.socket as TestSocket)).notes).toHaveLength(4);
  });
});

/** What the wall has stored about its time: the flow's clock and step, the deletion day, and the one alarm. */
function stored(wallId: string) {
  return runInDurableObject(stubOf(wallId), async (_instance, state) => {
    const meta = (key: string) =>
      String(state.storage.sql.exec("SELECT value FROM meta WHERE key = ?", key).one().value);
    const flow = JSON.parse(meta("flow")) as { step: number; clock: Clock };
    return {
      step: flow.step,
      clock: flow.clock,
      retentionAt: Number(meta("retentionAt")),
      alarm: await state.storage.getAlarm(),
    };
  });
}

/** Moves the stored clock back: as if this many milliseconds had passed. */
function timePasses(wallId: string, ms: number) {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    const sql = state.storage.sql;
    const flow = JSON.parse(String(sql.exec("SELECT value FROM meta WHERE key = 'flow'").one().value)) as {
      clock: Clock;
    };
    if (flow.clock.endsAt !== null) flow.clock.endsAt -= ms;
    sql.exec("UPDATE meta SET value = ? WHERE key = 'flow'", JSON.stringify(flow));
  });
}

describe("steps that move on by themselves", () => {
  it("the clock of a timed step sets the alarm; when the time is up the alarm moves on, forming the pairs", async () => {
    const { wallId, people, anna } = await wall();
    const before = await stored(wallId);
    expect(before.alarm).toBe(before.retentionAt);
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 1 })).toBe("ack");
    const running = await stored(wallId);
    expect(running.alarm).toBe(running.clock.endsAt);

    // too early: the alarm finds nothing due and arms itself again
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);
    await settle();
    expect((await stored(wallId)).step).toBe(0);
    expect((await stored(wallId)).alarm).toBe(running.clock.endsAt);

    await timePasses(wallId, 2 * MIN);
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);
    for (const person of people) {
      const changed = (await person.socket.waitFor((e) => e.type === "step.changed" && e.step === 1)) as StepChanged;
      expect(changed.team?.own).not.toBeNull();
    }
    const moved = await stored(wallId);
    expect(moved.step).toBe(1);
    expect(moved.alarm).toBe(moved.clock.endsAt);

    // an alarm that rings twice, or late, finds the pairs' time running: nothing happens
    const frames = anna.socket.events.length;
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);
    await settle();
    expect(anna.socket.events).toHaveLength(frames);
    expect((await stored(wallId)).step).toBe(1);

    // „5 Minuten mehr“ moves the alarm with the clock
    expect(await ask(anna.socket, { type: "admin.clock.extend", rev: moved.clock.rev })).toBe("ack");
    const extended = await stored(wallId);
    expect(extended.alarm).toBe(extended.clock.endsAt);
    // pausing the clock stops the moving on: the alarm is the wall's last day again
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: extended.clock.rev })).toBe("ack");
    expect((await stored(wallId)).alarm).toBe(before.retentionAt);
  });

  it("the moderation switches a step's moving on off: the time runs out and the wall waits for „Weiter“", async () => {
    const { wallId, people, anna } = await wall();
    const member = people[1] as Person;
    expect(await ask(member.socket, { type: "admin.step.auto", step: 0, on: false })).toBe("NOT_ADMIN");
    expect(await ask(anna.socket, { type: "admin.step.auto", step: 3, on: false })).toBe("INVALID");
    expect(await ask(anna.socket, { type: "admin.step.auto", step: 0, on: false })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.step.auto", step: 0, on: false })).toBe("ack");
    await member.socket.waitFor((e) => e.type === "auto.changed" && e.manual.includes(0));
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 1 })).toBe("ack");
    const running = await stored(wallId);
    expect(running.alarm).toBe(running.retentionAt);
    await timePasses(wallId, 2 * MIN);
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);
    await settle();
    expect((await stored(wallId)).step).toBe(0);
    expect((await resync(member.socket)).manual).toEqual([0]);
    // switched on again, with the time up: the next alarm moves on
    expect(await ask(anna.socket, { type: "admin.step.auto", step: 0, on: true })).toBe("ack");
    expect((await stored(wallId)).alarm).toBe((await stored(wallId)).clock.endsAt);
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);
    await member.socket.waitFor((e) => e.type === "step.changed" && e.step === 1);
  });

  it("the day the wall deletes itself still comes in the middle of a timed step", async () => {
    const { wallId, people, anna } = await wall();
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    await runInDurableObject(stubOf(wallId), (_instance, state) => {
      state.storage.sql.exec("UPDATE meta SET value = ? WHERE key = 'retentionAt'", String(Date.now() - 1000));
    });
    expect(await runDurableObjectAlarm(stubOf(wallId))).toBe(true);
    await people[1]?.socket.waitFor((e) => e.type === "wall.deleted");
    expect(
      await runInDurableObject(stubOf(wallId), (_instance, state) =>
        state.storage.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray(),
      ),
    ).toEqual([]);
  });

  it("a member's frames never carry the map, and the step's clock is refused outside the moderation", async () => {
    const { people, anna } = await wall();
    expect(await ask(anna.socket, { type: "admin.step.go", from: 0, to: 1 })).toBe("ack");
    await settle();
    const member = people[2] as Person;
    const said = await answer(member.socket, { type: "admin.clock.pause", rev: 1 });
    expect(said).toMatchObject({ type: "reject", code: "NOT_ADMIN" });
    const others = people.filter((person) => person !== member).map((person) => person.you);
    const sync = await resync(member.socket);
    const own = (sync.teams as TeamView).members[(sync.teams as TeamView).own as number] ?? [];
    for (const id of others) if (!own.includes(id)) expect(JSON.stringify(sync.teams)).not.toContain(id);
  });
});
