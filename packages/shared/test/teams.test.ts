// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  agendaOf,
  areaAt,
  areaBox,
  areaHead,
  autoAt,
  checkAgenda,
  checkTeams,
  decideAuto,
  decideAutoSwitch,
  decideStep,
  decideTeamsSet,
  enterTeams,
  eventFor,
  formTeams,
  initialFlow,
  layoutIntoAreas,
  mergeTeams,
  nextAlarm,
  notesFor,
  placeLatecomer,
  revealedFor,
  shareTeam,
  stepContext,
  swapped,
  teamCount,
  teamCounts,
  teamViewFor,
  wallMarkdown,
  type ContentEvent,
  type Flow,
  type StoredNote,
  type Teams,
} from "../src/index.js";

const NOW = 1_795_300_000_000;
const id = (n: number) => n.toString(16).padStart(32, "0");
const PEOPLE = Array.from({ length: 8 }, (_, n) => id(n + 1));
const AGENDA = agendaOf("eins-zwei-vier");

const note = (n: number, authorId: string, createdAt = NOW): StoredNote => ({
  id: id(100 + n),
  authorId,
  text: `note ${n}`,
  x: 0,
  y: 0,
  groupId: null,
  createdAt,
  updatedAt: createdAt,
});

describe("forming teams", () => {
  it("counts teams so that none is of one, and a count that does not divide makes threes", () => {
    expect([1, 2, 3, 4, 5, 7, 8].map((n) => teamCount(n, 2))).toEqual([1, 1, 1, 2, 2, 3, 4]);
    // six at four: two threes, as the catalogue says (nine: three threes); five at four: one five
    expect([4, 5, 6, 7, 8, 9].map((n) => teamCount(n, 4))).toEqual([1, 1, 2, 2, 2, 3]);
    expect(teamCount(0, 2)).toBe(0);
  });

  it("deals everybody present into teams at random by the seed: the same seed the same teams, whatever the order", () => {
    const teams = formTeams(PEOPLE, 2, 42);
    expect(teams).toHaveLength(4);
    expect(teams.every((team) => team.length === 2)).toBe(true);
    expect(teams.flat().sort()).toEqual([...PEOPLE].sort());
    expect(formTeams([...PEOPLE].reverse(), 2, 42)).toEqual(teams);
    // another seed, other pairs (for these two seeds)
    expect(formTeams(PEOPLE, 2, 7)).not.toEqual(teams);
    // seven people: never a team of one
    const odd = formTeams(PEOPLE.slice(0, 7), 2, 42);
    expect(odd.map((team) => team.length).sort()).toEqual([2, 2, 3]);
    expect(formTeams([], 2, 1)).toEqual([]);
    expect(formTeams([PEOPLE[0] as string], 2, 1)).toEqual([[PEOPLE[0]]]);
  });

  it("merges pairs into fours with their areas; an odd team joins the last", () => {
    const pairs = [PEOPLE.slice(0, 2), PEOPLE.slice(2, 4), PEOPLE.slice(4, 6), PEOPLE.slice(6, 8)];
    const areas = pairs.map((_, first) => ({ first, count: 1 }));
    expect(mergeTeams(pairs, areas)).toEqual({
      teams: [PEOPLE.slice(0, 4), PEOPLE.slice(4, 8)],
      areas: [
        { first: 0, count: 2 },
        { first: 2, count: 2 },
      ],
    });
    const three = mergeTeams(pairs.slice(0, 3), areas.slice(0, 3));
    expect(three.teams).toEqual([PEOPLE.slice(0, 6)]);
    expect(three.areas).toEqual([{ first: 0, count: 3 }]);
    expect(mergeTeams(pairs.slice(0, 1), areas.slice(0, 1)).teams).toEqual([PEOPLE.slice(0, 2)]);
  });

  it("places somebody who comes late in the smallest team, once", () => {
    const teams = [PEOPLE.slice(0, 3), PEOPLE.slice(3, 5)];
    expect(placeLatecomer(teams, id(99))).toEqual([PEOPLE.slice(0, 3), [...PEOPLE.slice(3, 5), id(99)]]);
    expect(placeLatecomer(teams, PEOPLE[0] as string)).toBeNull();
    expect(placeLatecomer([], id(99))).toBeNull();
  });

  it("enters a step of teams: forms at random, merges, brings a step's teams back, and leaves other steps alone", () => {
    const pairs = enterTeams(null, AGENDA.steps[1] ?? {}, 1, PEOPLE, 42, NOW) as Teams;
    expect(pairs).toMatchObject({ rev: 1, step: 1, seed: 42, history: [] });
    expect(pairs.teams).toEqual(formTeams(PEOPLE, 2, 42));
    expect(enterTeams(pairs, AGENDA.steps[1] ?? {}, 1, PEOPLE, 9, NOW)).toBeNull();
    expect(enterTeams(pairs, AGENDA.steps[3] ?? {}, 3, PEOPLE, 9, NOW)).toBeNull();
    // somebody who came meanwhile joins a four
    const fours = enterTeams(pairs, AGENDA.steps[2] ?? {}, 2, [...PEOPLE, id(99)], 9, NOW + 1) as Teams;
    expect(fours.teams.map((team) => team.length).sort()).toEqual([4, 5]);
    expect(fours.history).toEqual([{ step: 1, teams: pairs.teams, areas: pairs.areas, until: NOW + 1 }]);
    expect(fours.seed).toBe(42);
    // back to the pairs: the pairs of before, with the latecomer placed
    const back = enterTeams(fours, AGENDA.steps[1] ?? {}, 1, PEOPLE, 5, NOW + 2) as Teams;
    expect(back.teams).toEqual(pairs.teams);
    expect(back.rev).toBe(3);
  });
});

describe("the moderation's teams", () => {
  const current: Teams = {
    rev: 2,
    step: 1,
    seed: 1,
    teams: [PEOPLE.slice(0, 2), PEOPLE.slice(2, 4)],
    areas: [
      { first: 0, count: 1 },
      { first: 1, count: 1 },
    ],
    history: [],
    seq: 5,
  };
  const admin = { role: "admin" } as const;

  it("takes the same people in as many teams, none empty, none of one where pairs fit", () => {
    const swap = swapped(current.teams, PEOPLE[0] as string, PEOPLE[2] as string);
    expect(swap).toEqual([
      [PEOPLE[2], PEOPLE[1]],
      [PEOPLE[0], PEOPLE[3]],
    ]);
    expect(checkTeams(current.teams, swap)).toBe(true);
    expect(checkTeams(current.teams, [[PEOPLE[0] as string], PEOPLE.slice(1, 4)])).toBe(false);
    expect(checkTeams(current.teams, [PEOPLE.slice(0, 4)])).toBe(false);
    expect(checkTeams(current.teams, [PEOPLE.slice(0, 2), [PEOPLE[2] as string, id(99)]])).toBe(false);
    expect(checkTeams(current.teams, [PEOPLE.slice(0, 2), [PEOPLE[2] as string, PEOPLE[2] as string]])).toBe(false);
    // with three people in two teams, one of one cannot be helped
    expect(checkTeams([PEOPLE.slice(0, 2), [PEOPLE[2] as string]], [[PEOPLE[0] as string], PEOPLE.slice(1, 3)])).toBe(
      true,
    );
  });

  it("decides: only the moderation, only in the step of the teams, only for the revision it was made for", () => {
    const swap = swapped(current.teams, PEOPLE[0] as string, PEOPLE[2] as string);
    const at = { at: 1, team: true };
    expect(decideTeamsSet(current, at, { rev: 2, teams: swap }, { role: "member" }, NOW)).toEqual({
      kind: "refused",
      code: "NOT_ADMIN",
    });
    expect(decideTeamsSet(current, { at: 3, team: false }, { rev: 2, teams: swap }, admin, NOW)).toMatchObject({
      code: "PHASE",
    });
    expect(decideTeamsSet(null, at, { rev: 2, teams: swap }, admin, NOW)).toMatchObject({ code: "PHASE" });
    expect(decideTeamsSet(current, at, { rev: 1, teams: swap }, admin, NOW)).toMatchObject({ code: "STALE" });
    expect(decideTeamsSet(current, at, { rev: 1, teams: current.teams }, admin, NOW)).toEqual({ kind: "unchanged" });
    expect(decideTeamsSet(current, at, { rev: 2, teams: [PEOPLE.slice(0, 4)] }, admin, NOW)).toMatchObject({
      code: "INVALID",
    });
    const decided = decideTeamsSet(current, at, { rev: 2, teams: swap }, admin, NOW);
    expect(decided).toMatchObject({ kind: "changed", teams: { rev: 3, teams: swap, areas: current.areas } });
    if (decided.kind === "changed")
      expect(decided.teams.history).toEqual([{ step: 1, teams: current.teams, areas: current.areas, until: NOW }]);
  });

  it("tells the moderation the map, everybody else their own team", () => {
    expect(teamViewFor(current, PEOPLE[0] as string, true)).toEqual({
      rev: 2,
      step: 1,
      areas: current.areas,
      own: 0,
      members: current.teams,
    });
    expect(teamViewFor(current, PEOPLE[3] as string, false)).toEqual({
      rev: 2,
      step: 1,
      areas: current.areas,
      own: 1,
      members: [null, PEOPLE.slice(2, 4)],
    });
    expect(teamViewFor(current, id(99), false).members).toEqual([null, null]);
  });
});

describe("who reads what in a step of teams", () => {
  const [anna, ben, cem, dora] = PEOPLE as [string, string, string, string];
  const pairs: Teams = {
    rev: 1,
    step: 1,
    seed: 1,
    teams: [
      [anna, ben],
      [cem, dora],
    ],
    areas: [
      { first: 0, count: 1 },
      { first: 1, count: 1 },
    ],
    history: [],
    seq: 1,
  };
  const notes = [note(1, anna), note(2, ben), note(3, cem), note(4, dora)];

  it("a pair reads its own notes, of the others only how many", () => {
    const view = notesFor(notes, "team", anna, pairs);
    expect(view.notes.map((n) => n.text)).toEqual(["note 1", "note 2"]);
    expect(view.hidden).toBe(2);
    // without teams, or for nobody in particular, a step of teams shows nothing of others
    expect(notesFor(notes, "team", anna, null).notes).toHaveLength(1);
    expect(notesFor(notes, "team", null, pairs).notes).toHaveLength(0);
  });

  it("entering the pairs and merging them each bring exactly the difference", () => {
    const into = revealedFor(notes, anna, { level: "hidden" }, { level: "team", teams: pairs });
    expect(into.map((n) => n.text)).toEqual(["note 2"]);
    const fours = enterTeams(pairs, AGENDA.steps[2] ?? {}, 2, [], 3, NOW + 10) as Teams;
    const merged = revealedFor(notes, anna, { level: "team", teams: pairs }, { level: "team", teams: fours });
    expect(merged.map((n) => n.text)).toEqual(["note 3", "note 4"]);
    expect(revealedFor(notes, anna, { level: "team", teams: fours }, { level: "all" })).toEqual([]);
  });

  it("after a swap the one who moved keeps the old partner's notes of before, and the new team reads theirs", () => {
    const swap = decideTeamsSet(
      pairs,
      { at: 1, team: true },
      {
        rev: 1,
        teams: [
          [cem, ben],
          [anna, dora],
        ],
      },
      { role: "admin" },
      NOW + 5,
    );
    if (swap.kind !== "changed") throw new Error("the swap was refused");
    const after = [...notes, note(5, ben, NOW + 6)];
    // Anna still reads Ben's note of before, not the one he wrote after she moved
    expect(shareTeam(swap.teams, ben, anna, NOW)).toBe(true);
    expect(shareTeam(swap.teams, ben, anna, NOW + 6)).toBe(false);
    expect(notesFor(after, "team", anna, swap.teams).notes.map((n) => n.text)).toEqual(["note 1", "note 2", "note 4"]);
    // Cem reads Ben's both notes, and Dora's of before
    expect(notesFor(after, "team", cem, swap.teams).notes.map((n) => n.text)).toEqual([
      "note 2",
      "note 3",
      "note 4",
      "note 5",
    ]);
    // what is seen only widens: nothing anybody read before the swap is gone after it
    for (const viewer of [anna, ben, cem, dora]) {
      const before = notesFor(notes, "team", viewer, pairs).notes.map((n) => n.id);
      const later = notesFor(notes, "team", viewer, swap.teams).notes.map((n) => n.id);
      expect(later).toEqual(expect.arrayContaining(before));
    }
  });

  it("a change in a step of teams is heard by whoever may read its note, as a number by the others", () => {
    const created: ContentEvent = {
      type: "note.created",
      seq: 7,
      note: { id: id(200), mine: true, text: "pair idea", x: 0, y: 0, groupId: null, createdAt: NOW, updatedAt: NOW },
    };
    const sees = (viewer: string) => (noteId: string) => noteId === id(200) && shareTeam(pairs, anna, viewer, NOW);
    expect(eventFor(created, anna, ben, "team", 2, sees(ben))).toMatchObject({
      type: "note.created",
      note: { mine: false },
    });
    expect(eventFor(created, anna, cem, "team", 3, sees(cem))).toEqual({ type: "wall.occupancy", seq: 7, hidden: 3 });
    const moved: ContentEvent = {
      type: "notes.moved",
      seq: 8,
      moves: [
        { noteId: id(200), x: 1, y: 1, groupId: null },
        { noteId: id(201), x: 2, y: 2, groupId: null },
      ],
    };
    expect(eventFor(moved, anna, ben, "team", 2, sees(ben))).toEqual({ ...moved, moves: [moved.moves[0]] });
  });
});

describe("steps that move on by themselves", () => {
  const flow = (more: Partial<Flow> = {}): Flow => ({ ...initialFlow(AGENDA), ...more });
  const running = { rev: 1, endsAt: NOW + 60_000, leftMs: null };

  it("move on when their clock ends, through the one alarm; never the last step, never with the clock paused", () => {
    expect(autoAt(AGENDA, flow())).toBeNull();
    expect(autoAt(AGENDA, flow({ clock: running }))).toBe(NOW + 60_000);
    expect(autoAt(AGENDA, flow({ clock: { rev: 2, endsAt: null, leftMs: 30_000 } }))).toBeNull();
    expect(autoAt(AGENDA, flow({ clock: running, manual: [0] }))).toBeNull();
    expect(autoAt(AGENDA, flow({ step: 3, reach: 3, clock: running }))).toBeNull();
    expect(nextAlarm(NOW + 1e9, AGENDA, flow({ clock: running }))).toBe(NOW + 60_000);
    expect(nextAlarm(NOW + 1e9, AGENDA, flow())).toBe(NOW + 1e9);
    // the wall's last day comes first if it is earlier
    expect(nextAlarm(NOW + 1, AGENDA, flow({ clock: running }))).toBe(NOW + 1);
    // „Still sammeln“ waits for „Weiter“, whatever its clock does
    expect(autoAt(agendaOf("still-sammeln"), flow({ clock: running }))).toBeNull();
  });

  it("an alarm moves on once the time is up, and starts the next step's clock; a late or second one does nothing", () => {
    expect(decideAuto(flow({ clock: running }), AGENDA, NOW)).toBeNull();
    const due = decideAuto(flow({ clock: running }), AGENDA, NOW + 60_000);
    expect(due).toMatchObject({
      kind: "changed",
      flow: { step: 1, reach: 1, clock: { rev: 2, endsAt: NOW + 60_000 + 120_000, leftMs: null } },
      widens: true,
    });
    if (due?.kind !== "changed") throw new Error("not due");
    const after: Flow = { ...flow(), ...due.flow };
    expect(decideAuto(after, AGENDA, NOW + 60_000)).toBeNull();
  });

  it("a step move starts the clock only forward into a timed step", () => {
    const into = decideStep(flow(), AGENDA, { from: 0, to: 1 }, { role: "admin" }, NOW);
    expect(into).toMatchObject({ kind: "changed", flow: { clock: { endsAt: NOW + 120_000 } } });
    const back = decideStep(
      flow({ step: 2, reach: 2, clock: running }),
      AGENDA,
      { from: 2, to: 1 },
      { role: "admin" },
      NOW,
    );
    expect(back).toMatchObject({ kind: "changed", flow: { clock: { endsAt: null, leftMs: null } } });
    // the presenting has a time on the list but no clock: it waits for the moderation
    const present = decideStep(flow({ step: 2, reach: 2 }), AGENDA, { from: 2, to: 3 }, { role: "admin" }, NOW);
    expect(present).toMatchObject({ kind: "changed", flow: { clock: { endsAt: null } } });
  });

  it("the moderation switches a step's moving on off and on", () => {
    const admin = { role: "admin" } as const;
    expect(decideAutoSwitch(flow(), AGENDA, { step: 0, on: false }, { role: "member" })).toMatchObject({
      code: "NOT_ADMIN",
    });
    expect(decideAutoSwitch(flow(), AGENDA, { step: 3, on: false }, admin)).toMatchObject({ code: "INVALID" });
    expect(decideAutoSwitch(flow(), AGENDA, { step: 0, on: true }, admin)).toEqual({ kind: "unchanged" });
    expect(decideAutoSwitch(flow({ manual: [2] }), AGENDA, { step: 0, on: false }, admin)).toEqual({
      kind: "changed",
      manual: [0, 2],
    });
    expect(decideAutoSwitch(flow({ manual: [0, 2] }), AGENDA, { step: 0, on: true }, admin)).toEqual({
      kind: "changed",
      manual: [2],
    });
  });
});

describe("1-2-4-Alle as a method", () => {
  it("writes alone hidden, shares in pairs and fours seen by the team, presents to everybody; three timed steps", () => {
    expect(AGENDA.steps.map((step) => [step.mode, step.visibility, step.advance])).toEqual([
      ["individual", "hidden", "auto"],
      ["pair", "team", "auto"],
      ["group", "team", "auto"],
      ["presentation", "all", "moderation"],
    ]);
    expect(AGENDA.steps.map((step) => step.team)).toEqual([
      undefined,
      { size: 2, form: "random" },
      { size: 4, form: "merge" },
      undefined,
    ]);
    expect(checkAgenda(AGENDA)).toEqual([]);
    // what is seen widens hidden, team, team, all; the clock is the moderation's in the timed steps
    expect(AGENDA.steps.map((_, step) => stepContext(AGENDA, { step, reach: step }).sight)).toEqual([
      "hidden",
      "team",
      "team",
      "all",
    ]);
    expect(AGENDA.steps.map((_, step) => stepContext(AGENDA, { step, reach: step }).can.clock)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("an agenda whose steps of teams do not fit is refused", () => {
    const [alone, pairs, fours, present] = AGENDA.steps as [never, never, never, never];
    const steps = (list: object[]) => ({ steps: list as never });
    expect(checkAgenda(steps([alone, { ...(pairs as object), team: undefined }, present]))).toContainEqual({
      kind: "teamShape",
      step: 1,
    });
    expect(checkAgenda(steps([alone, fours, present]))).toContainEqual({ kind: "teamShape", step: 1 });
    expect(checkAgenda(steps([alone, { ...(pairs as object), mode: "plenary" }, present]))).toContainEqual({
      kind: "teamShape",
      step: 1,
    });
    expect(checkAgenda(steps([alone, pairs, fours]))).toContainEqual({ kind: "autoShape", step: 2 });
  });
});

describe("areas and the export", () => {
  it("a four's area holds the areas of its pairs", () => {
    const pair = areaBox({ first: 1, count: 1 });
    const four = areaBox({ first: 0, count: 2 });
    expect(pair.x).toBeGreaterThanOrEqual(four.x);
    expect(pair.x + pair.w).toBeLessThanOrEqual(four.x + four.w);
    expect(
      areaAt(
        [
          { first: 0, count: 1 },
          { first: 1, count: 1 },
        ],
        { x: pair.x + 10, y: pair.y + 10 },
      ),
    ).toBe(1);
    expect(areaAt([{ first: 0, count: 1 }], { x: -10, y: 0 })).toBeNull();
  });

  it("names how many teams each step had, never who was in them, and the attribution", () => {
    const pairs = enterTeams(null, AGENDA.steps[1] ?? {}, 1, PEOPLE, 4, NOW) as Teams;
    const fours = enterTeams(pairs, AGENDA.steps[2] ?? {}, 2, PEOPLE, 4, NOW + 1) as Teams;
    expect(teamCounts(fours)).toEqual([
      { step: 1, teams: 4 },
      { step: 2, teams: 2 },
    ]);
    const input = {
      question: "How do we onboard faster?",
      methodId: "eins-zwei-vier" as const,
      notes: PEOPLE.map((person, n) => note(n, person)),
      groups: [],
      teams: fours,
      viewer: PEOPLE[0] as string,
      at: NOW,
    };
    const de = wallMarkdown({ ...input, sight: "all", language: "de" });
    expect(de).toContain(
      "In Teams gearbeitet: Zu zweit austauschen: 4 Teams; Zu viert: das Wichtigste herausarbeiten: 2 Teams.",
    );
    expect(de).toContain("Liberating Structures Fieldbook, 2026");
    expect(de).toContain("CC BY-SA 4.0");
    for (const person of PEOPLE) expect(de).not.toContain(person);
    expect(de.match(/^- note/gm)).toHaveLength(8);
    const en = wallMarkdown({ ...input, sight: "team", language: "en" });
    expect(en).toContain("Worked in teams: Share in pairs: 4 teams; In fours: find what matters most: 2 teams.");
    // in the fours a person's file holds their four's notes
    expect(en.match(/^- note/gm)).toHaveLength(4);
    expect(en).toContain("The teams still work on their own");
  });
});

describe("notes into the teams' areas", () => {
  it("moves each person's notes written alone into their team's area, in rows of three, and leaves the rest", () => {
    const teams = {
      teams: [PEOPLE.slice(0, 2), PEOPLE.slice(2, 4)],
      areas: [
        { first: 0, count: 1 },
        { first: 1, count: 1 },
      ],
    };
    const notes = [
      ...[0, 1, 2, 3].map((n) => note(n, PEOPLE[0] as string)),
      note(4, PEOPLE[3] as string),
      { ...note(5, PEOPLE[2] as string), groupId: id(300) },
      note(6, id(99)),
    ];
    const moves = layoutIntoAreas(notes, teams);
    const first = areaBox(teams.areas[0] as never);
    const second = areaBox(teams.areas[1] as never);
    expect(moves.map((move) => move.noteId)).toEqual([id(100), id(101), id(102), id(103), id(104)]);
    expect(moves.map((move) => areaAt(teams.areas, move))).toEqual([0, 0, 0, 0, 1]);
    // three in a row, the fourth in the next one
    expect(moves.slice(0, 3).map((move) => move.y)).toEqual([first.y + 48, first.y + 48, first.y + 48]);
    expect(moves[3]?.y).toBeGreaterThan(first.y + 48);
    expect(moves[3]?.x).toBe(first.x + 16);
    expect(moves[4]).toEqual({ noteId: id(104), x: second.x + 16, y: second.y + 48, groupId: null });
    // a note already in an area stays: the merge moves nothing
    expect(layoutIntoAreas([{ ...note(7, PEOPLE[0] as string), ...moves[0], id: id(107) }], teams)).toEqual([]);
    expect(areaHead({ first: 1, count: 1 })).toEqual({ ...second, h: 48 });
  });
});
