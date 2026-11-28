// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as z from "zod/mini";
import { hexIdSchema } from "../ids.js";
import type { RejectCode, TeamsCommand } from "../protocol.js";
import { TEAM_MAX_SIZE, type Step } from "./method.js";
import { estimateNoteHeight, NOTE_WIDTH } from "./note-size.js";

// Pairs and small groups (stage M4, PLAN-METHODEN.md 4, docs/architektur-methoden.md 3.2). A step in pairs or small
// groups works in teams; the app forms them at random from the people present, and the moderation may swap people
// (the owner's decision 4). Everybody stays on the one wall: a team's notes are seen by its members alone until a
// later step shows them to everybody, and each team writes in an area of its own on the surface. Talking happens
// in the video tool's breakout rooms, which the moderation fills after the team map.
//
// What a wall stores of it is one row (`meta 'teams'`, `Teams` below), written with every change: forming (in the
// transaction of the step move), merging, placing somebody who comes late, a swap by the moderation. Pure functions
// here; the Durable Object reads who is present from its open sockets and draws the seed with
// `crypto.getRandomValues`, and stores it, so a forming can be told again from the row alone.
//
// Who sees a note of somebody else in a step whose visibility is `team` (domain/visibility.ts): whoever shares a
// team with its writer, in the teams in force now or in teams that were in force before, for the notes written
// while those were (`TeamEntry.until`). So what was shown stays shown, as revealing has always been: a merge shows
// the pair's notes to the four and hides nothing, and a swap by the moderation lets the person who moved keep what
// they saw; the notes they write afterwards go to their new team alone.

/** Where a team writes: a span of slots on a band of the surface (`areaBox`). Teams that are merged take the slots
 *  of both, so a four's area holds the areas of its two pairs and the notes written there stay inside it. */
export const teamAreaSchema = z.object({
  first: z.int().check(z.minimum(0)),
  count: z.int().check(z.minimum(1)),
});
export type TeamArea = z.infer<typeof teamAreaSchema>;

/** A grouping that was in force and has been replaced: its teams, and the moment it was replaced. A note written
 *  before that moment stays seen by the team its writer had in it. */
export interface TeamEntry {
  /** The step the teams were formed for. */
  step: number;
  teams: string[][];
  areas: TeamArea[];
  /** The moment, on the worker's clock, the grouping was replaced. */
  until: number;
}

/** The value of the row `meta 'teams'`. */
export interface Teams {
  /** Counts the changes: `admin.teams.set` names the one it was made for. */
  rev: number;
  /** The step the teams in force were formed for. */
  step: number;
  /** The seed of the last random forming (32 bits, from `crypto.getRandomValues`). */
  seed: number;
  /** The teams in force: each a list of participant ids. A team's number is its place in the list, from 1. */
  teams: string[][];
  /** Each team's area, in the same order. */
  areas: TeamArea[];
  /** The groupings in force before, oldest first. */
  history: TeamEntry[];
  /** The number of the change that wrote the row (wall-room.ts, currentSeq()). */
  seq: number;
}

/** What one person is told of the teams (`sync`, `step.changed`, `team.changed`): the moderation the whole map, to
 *  fill the breakout rooms; everybody else their own team. Every team's area and number goes to everybody: a
 *  number and a place on the surface say nothing about who is in it. */
export const teamViewSchema = z.object({
  rev: z.int().check(z.minimum(0)),
  step: z.int().check(z.minimum(0)),
  /** Each team's area, by number. */
  areas: z.array(teamAreaSchema),
  /** The person's own team: its index (number − 1), or null: in none. */
  own: z.nullable(z.int().check(z.minimum(0))),
  /** Each team's members, by number: the moderation gets every team, everybody else only their own (null where
   *  not told). Ids of participants, whose names the browser knows from the people on the wall. */
  members: z.array(z.nullable(z.array(hexIdSchema))),
});
export type TeamView = z.infer<typeof teamViewSchema>;

/** The teams a person may see notes by: those in force and those in force before. */
export type TeamSight = Pick<Teams, "teams" | "history">;

// ───────────────────────── forming ─────────────────────────

/** A random number from a seed, the same sequence for the same seed (mulberry32): forming is pure, and a test can
 *  name the seed. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** How many teams `people` people make at the size `size`: as many as fill the size, but never so many that a team
 *  would have fewer than two members, nor fewer than the size less one where the size is larger than three (so
 *  six people at four make two threes, as the catalogue says: „geht die Zahl nicht auf, entstehen Dreiergruppen“). */
export function teamCount(people: number, size: number): number {
  if (people <= 0) return 0;
  const least = Math.max(2, size - 1);
  let count = Math.ceil(people / size);
  while (count > 1 && Math.floor(people / count) < least) count -= 1;
  return count;
}

/** How many teams a step with roles makes (stage M6, „Gegenposition prüfen“): one for each role, more only where a
 *  team would grow past TEAM_MAX_SIZE (then a multiple of the roles, so every role has as many teams), fewer only
 *  where there are not two people for each role. */
export function roleTeamCount(people: number, roles: number): number {
  if (people <= 0) return 0;
  if (people < 2 * roles) return Math.max(1, Math.floor(people / 2));
  let count = roles;
  while (Math.ceil(people / count) > TEAM_MAX_SIZE && Math.floor(people / (count + roles)) >= 2) count += roles;
  return count;
}

/** The role of a team (stage M6): the step's roles in turn, the first team the first; null without roles. */
export function roleOf(step: Pick<Step, "team">, team: number): string | null {
  const roles = step.team?.roles;
  return roles === undefined || roles.length === 0 ? null : (roles[team % roles.length] ?? null);
}

/** Teams of about `size` from the people present, at random by `seed`. The people are dealt round by round into
 *  the teams, so the sizes differ by one at most. Never a team of 1 where two or more are present; nobody present,
 *  no team. The order of `present` does not matter. `count` (stage M6, a step with roles): exactly so many teams. */
export function formTeams(present: readonly string[], size: number, seed: number, count?: number): string[][] {
  const people = [...new Set(present)].sort();
  const next = random(seed);
  // Fisher–Yates
  for (let at = people.length - 1; at > 0; at -= 1) {
    const other = Math.floor(next() * (at + 1));
    [people[at], people[other]] = [people[other] as string, people[at] as string];
  }
  const many = count ?? teamCount(people.length, size);
  const teams: string[][] = Array.from({ length: many }, () => []);
  people.forEach((person, at) => teams[at % many]?.push(person));
  return teams;
}

/** The areas of teams formed anew: one slot each. */
export function freshAreas(count: number): TeamArea[] {
  return Array.from({ length: count }, (_, first) => ({ first, count: 1 }));
}

/** Pairs become fours (docs/architektur-methoden.md 3.2): the teams are put together two by two, in their order,
 *  each with its partner's members and area. Where the count of teams is odd, the last one joins the team before
 *  it: a pair left over makes a six rather than stay a pair (and a three left over, a seven). One team stays as it
 *  is. Nobody is moved apart from the people they were with. */
export function mergeTeams(
  teams: readonly string[][],
  areas: readonly TeamArea[],
): { teams: string[][]; areas: TeamArea[] } {
  const merged: string[][] = [];
  const spans: TeamArea[] = [];
  for (let at = 0; at < teams.length; at += 2) {
    const members = [...(teams[at] ?? []), ...(teams[at + 1] ?? [])];
    const area = spanOf([areas[at], areas[at + 1]]);
    // the odd one out joins the last pair of teams
    if (at + 1 >= teams.length && merged.length > 0) {
      merged[merged.length - 1]?.push(...members);
      spans[spans.length - 1] = spanOf([spans[spans.length - 1], area]);
      continue;
    }
    merged.push(members);
    spans.push(area);
  }
  return { teams: merged, areas: spans };
}

function spanOf(areas: ReadonlyArray<TeamArea | undefined>): TeamArea {
  const known = areas.filter((area): area is TeamArea => area !== undefined);
  if (known.length === 0) return { first: 0, count: 1 };
  const first = Math.min(...known.map((area) => area.first));
  const end = Math.max(...known.map((area) => area.first + area.count));
  return { first, count: end - first };
}

/** The areas of teams that are kept for another round (stage M5, `keep`): the same spans, beside the last ones. */
export function shiftedAreas(areas: readonly TeamArea[]): TeamArea[] {
  const end = Math.max(0, ...areas.map((area) => area.first + area.count));
  return areas.map((area) => ({ first: area.first + end, count: area.count }));
}

/** Somebody who is in no team comes (late, or back after the forming): they join the smallest team, the first of
 *  the smallest where several are. null: they are in a team already, or there is no team to join. */
export function placeLatecomer(teams: readonly string[][], person: string): string[][] | null {
  if (teams.length === 0 || teams.some((team) => team.includes(person))) return null;
  let smallest = 0;
  teams.forEach((team, at) => {
    if (team.length < (teams[smallest]?.length ?? 0)) smallest = at;
  });
  return teams.map((team, at) => (at === smallest ? [...team, person] : [...team]));
}

/** Whether the moderation's teams (`admin.teams.set`) are the teams in force with people swapped or moved: the same
 *  people, each once, in as many teams, none empty, and none of one person where every team could have two. */
export function checkTeams(current: readonly string[][], proposed: readonly string[][]): boolean {
  if (proposed.length !== current.length) return false;
  const before = current.flat();
  const after = proposed.flat();
  if (after.length !== before.length || new Set(after).size !== after.length) return false;
  const known = new Set(before);
  if (!after.every((person) => known.has(person))) return false;
  const pairsFit = before.length >= 2 * proposed.length;
  return proposed.every((team) => team.length >= (pairsFit ? 2 : 1));
}

/** Whether two lists of teams are the same, team for team. */
export function sameTeams(a: readonly string[][], b: readonly string[][]): boolean {
  return (
    a.length === b.length &&
    a.every((team, at) => {
      const other = b[at] ?? [];
      return team.length === other.length && team.every((person) => other.includes(person));
    })
  );
}

/** The teams after the wall entered step `at` (`step`), or null: the step works in no teams, or the teams in force
 *  were formed for it already. A step entered again (the moderation went back) gets the teams it had; one entered
 *  for the first time forms them as it says: anew at random, by merging the teams in force, or by keeping them with
 *  fresh areas (stage M5). Whoever is present
 *  and in no team then joins one (`placeLatecomer`). `now` is the moment the grouping in force is replaced. */
export function enterTeams(
  current: Teams | null,
  step: Pick<Step, "team">,
  at: number,
  present: readonly string[],
  seed: number,
  now: number,
): Teams | null {
  const settings = step.team;
  if (settings === undefined) return null;
  if (current !== null && current.step === at) return null;
  const known = current === null ? undefined : [...current.history].reverse().find((entry) => entry.step === at);
  let teams: string[][];
  let areas: TeamArea[];
  let usedSeed = current?.seed ?? seed;
  if (known !== undefined) {
    teams = known.teams.map((team) => [...team]);
    areas = known.areas.map((area) => ({ ...area }));
  } else if (settings.form === "merge" && current !== null && current.teams.length > 0) {
    ({ teams, areas } = mergeTeams(current.teams, current.areas));
  } else if (settings.form === "keep" && current !== null && current.teams.length > 0) {
    // the same teams, each with a fresh area beside the last ones: the notes of this round do not land on those of
    // the round before
    teams = current.teams.map((team) => [...team]);
    areas = shiftedAreas(current.areas);
  } else {
    const people = new Set(present).size;
    teams = formTeams(
      present,
      settings.size,
      seed,
      settings.roles === undefined ? undefined : roleTeamCount(people, settings.roles.length),
    );
    // stage M7: teams formed anew after the teams of an earlier method get areas beside all of those, so the notes
    // of this method do not land on the notes of that one (within one method a step that forms teams at random is
    // never entered while teams of another step are in force, unless it is entered again: then `known` holds)
    const used = current === null ? [] : [current.areas, ...current.history.map((entry) => entry.areas)].flat();
    const end = Math.max(0, ...used.map((area) => area.first + area.count));
    areas = freshAreas(teams.length).map((area) => ({ first: area.first + end, count: area.count }));
    usedSeed = seed;
  }
  for (const person of [...present].sort()) {
    const placed = placeLatecomer(teams, person);
    if (placed !== null) teams = placed;
  }
  return {
    rev: (current?.rev ?? 0) + 1,
    step: at,
    seed: usedSeed,
    teams,
    areas,
    history: current === null ? [] : [...current.history, entryOf(current, now)],
    seq: current?.seq ?? 0,
  };
}

/** The teams in force with new members, the grouping before kept in the history (a swap, a latecomer). */
export function changedTeams(current: Teams, teams: string[][], now: number): Teams {
  return { ...current, rev: current.rev + 1, teams, history: [...current.history, entryOf(current, now)] };
}

function entryOf(teams: Teams, until: number): TeamEntry {
  return { step: teams.step, teams: teams.teams, areas: teams.areas, until };
}

/** What the moderation's `admin.teams.set` makes of the teams: allowed only in a step of teams whose teams are in
 *  force (`step`, the step the wall is in), only for the teams it was made for (`rev`, else `STALE`), only with the
 *  same people (`checkTeams`, else `INVALID`). The same teams again change nothing. */
export function decideTeamsSet(
  current: Teams | null,
  step: { at: number; team: boolean },
  command: Pick<TeamsCommand, "rev" | "teams">,
  by: { role: "admin" | "member" },
  now: number,
): { kind: "refused"; code: RejectCode } | { kind: "unchanged" } | { kind: "changed"; teams: Teams } {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (!step.team || current === null || current.step !== step.at) return { kind: "refused", code: "PHASE" };
  if (sameTeams(current.teams, command.teams)) return { kind: "unchanged" };
  if (command.rev !== current.rev) return { kind: "refused", code: "STALE" };
  if (!checkTeams(current.teams, command.teams)) return { kind: "refused", code: "INVALID" };
  return {
    kind: "changed",
    teams: changedTeams(
      current,
      command.teams.map((team) => [...team]),
      now,
    ),
  };
}

/** Two people change teams: what the moderation's „Tauschen“ sends. */
export function swapped(teams: readonly string[][], a: string, b: string): string[][] {
  return teams.map((team) => team.map((person) => (person === a ? b : person === b ? a : person)));
}

// ───────────────────────── who sees what ─────────────────────────

/** Whether `viewer` shares a team with `author` that lets them read the author's note made at `createdAt`: in the
 *  teams in force, or in teams that were in force when the note was written. Never for nobody in particular. */
export function shareTeam(
  teams: TeamSight | null | undefined,
  author: string,
  viewer: string | null,
  createdAt: number,
): boolean {
  if (teams === null || teams === undefined || viewer === null) return false;
  const together = (grouping: readonly string[][]) =>
    grouping.some((team) => team.includes(author) && team.includes(viewer));
  if (together(teams.teams)) return true;
  return teams.history.some((entry) => createdAt < entry.until && together(entry.teams));
}

/** The index of a person's team in force, or null. */
export function teamOf(teams: Pick<Teams, "teams"> | null | undefined, person: string): number | null {
  if (teams === null || teams === undefined) return null;
  const at = teams.teams.findIndex((team) => team.includes(person));
  return at < 0 ? null : at;
}

/** What one person is told of the teams: the moderation the map, everybody else their own team. */
export function teamViewFor(teams: Teams, viewer: string, admin: boolean): TeamView {
  const own = teamOf(teams, viewer);
  return {
    rev: teams.rev,
    step: teams.step,
    areas: teams.areas,
    own,
    members: teams.teams.map((team, at) => (admin || at === own ? [...team] : null)),
  };
}

/** How many teams each step formed: what the export says of the teams, and nothing of who was in them. In the
 *  order of the steps; a step entered twice counts once, with the teams it had last. */
export function teamCounts(teams: Teams | null | undefined): Array<{ step: number; teams: number }> {
  if (teams === null || teams === undefined) return [];
  const byStep = new Map<number, number>();
  for (const entry of teams.history) byStep.set(entry.step, entry.teams.length);
  byStep.set(teams.step, teams.teams.length);
  return [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([step, count]) => ({ step, teams: count }));
}

// ───────────────────────── areas ─────────────────────────

/** Where the band of the team areas begins on the surface, how wide a slot is and how tall the band: in world units
 *  (1/16 rem, domain/note-size.ts). A slot holds three notes side by side. The band lies below the place where a
 *  wall's first notes go, so the notes written alone before the teams met stay where they are. */
export const AREA_TOP = 1_200;
export const AREA_LEFT = 0;
export const AREA_SLOT = 832;
export const AREA_GAP = 64;
export const AREA_HEIGHT = 1_280;

/** The box of a team's area on the surface. */
export function areaBox(area: TeamArea): { x: number; y: number; w: number; h: number } {
  return {
    x: AREA_LEFT + area.first * (AREA_SLOT + AREA_GAP),
    y: AREA_TOP,
    w: area.count * AREA_SLOT + (area.count - 1) * AREA_GAP,
    h: AREA_HEIGHT,
  };
}

/** The team whose area a point lies in, by index, or null. */
export function areaAt(areas: readonly TeamArea[], point: { x: number; y: number }): number | null {
  const at = areas.findIndex((area) => {
    const box = areaBox(area);
    return point.x >= box.x && point.x < box.x + box.w && point.y >= box.y && point.y < box.y + box.h;
  });
  return at < 0 ? null : at;
}

/** The strip at the top of a team's area that holds its heading: what a view fits to besides the notes, so the area's
 *  number is in view without its empty rest (apps/web, Surface.tsx). */
export const AREA_HEAD = 48;
const AREA_PAD = 16;

export function areaHead(area: TeamArea): { x: number; y: number; w: number; h: number } {
  return { ...areaBox(area), h: AREA_HEAD };
}

/** Where the notes go when the teams are formed (stage M4): every note in no group that lies outside its writer's
 *  team's area moves into it, the notes of a team in rows of three from the area's top left, in the order given. So a
 *  pair finds both its notes written alone side by side in its area, and a four, whose area holds its pairs' areas,
 *  finds them where they were (but those of somebody the moderation swapped, which follow them). Notes whose writer
 *  is in no team stay where they are. One movement, one row written (the layout row), in the transaction of the step
 *  move. The worker hands in the notes that are not shown to everybody yet (stage M5): a note the whole wall has seen
 *  stays where the wall put it, also when the teams of the next round are kept. */
export function layoutIntoAreas(
  notes: ReadonlyArray<{ id: string; authorId: string; text: string; x: number; y: number; groupId: string | null }>,
  teams: Pick<Teams, "teams" | "areas">,
): Array<{ noteId: string; x: number; y: number; groupId: null }> {
  const moves: Array<{ noteId: string; x: number; y: number; groupId: null }> = [];
  // per team, where its next note goes: the column, the top of the row and the row's tallest note so far
  const cursor = new Map<number, { col: number; top: number; tallest: number }>();
  for (const note of notes) {
    if (note.groupId !== null) continue;
    const team = teamOf(teams, note.authorId);
    const area = team === null ? undefined : teams.areas[team];
    // already in the writer's team's area: it stays
    if (team === null || area === undefined || areaAt(teams.areas, note) === team) continue;
    const box = areaBox(area);
    const perRow = Math.max(1, Math.floor((box.w - AREA_PAD) / (NOTE_WIDTH + AREA_PAD)));
    let at = cursor.get(team) ?? { col: 0, top: box.y + AREA_HEAD, tallest: 0 };
    if (at.col >= perRow) at = { col: 0, top: at.top + at.tallest + AREA_PAD, tallest: 0 };
    moves.push({ noteId: note.id, x: box.x + AREA_PAD + at.col * (NOTE_WIDTH + AREA_PAD), y: at.top, groupId: null });
    cursor.set(team, { col: at.col + 1, top: at.top, tallest: Math.max(at.tallest, estimateNoteHeight(note.text)) });
  }
  return moves;
}
