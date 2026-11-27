// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  Change,
  Clock,
  ContentCommand,
  ContentEvent,
  Group,
  Note,
  NoteMove,
  Participant,
  ServerEvent,
  WallInfo,
} from "../protocol.js";
import type { ResolvedAgenda } from "./agenda.js";
import { numbersOf } from "./arrange.js";
import { NO_CLOCK, stoppedClock } from "./clock.js";
import { NO_STEP, stepContext, type StepContext } from "./flow.js";
import { decide, type WallReader } from "./rules.js";
import type { TeamView } from "./teams.js";
import type { TurnView } from "./turns.js";
import type { Ballot, VoteResult, VoteRound } from "./vote.js";

/** What a wall holds: its notes with their places, and its groups. Both in the order they were made. */
export interface WallContent {
  notes: Note[];
  groups: Group[];
}

/** A command of this browser that the worker has not answered yet. */
export interface PendingCommand {
  command: ContentCommand;
  /** The browser's clock when the command was made: the time its note shows until the worker's event brings the
   *  stored one. */
  at: number;
}

/** What a browser knows about the wall it is on: the last `sync`, moved on by every event after it. */
export interface WallState extends WallContent {
  /** null until the first `sync` of this connection has arrived. */
  wall: WallInfo | null;
  participants: Participant[];
  /** This browser's own participant. */
  you: string | null;
  /** The worker's protocol version, from the last `sync`. */
  protocolVersion: number | null;
  /** The wall was deleted while this browser was on it. Nothing after it changes that. */
  deleted: boolean;
  /** The wall's agenda (domain/agenda.ts), or null until the first `sync`. */
  agenda: ResolvedAgenda | null;
  /** The step the wall is in, and the furthest one it has reached (domain/flow.ts). While the notes are hidden
   *  (`stepContextOf`), `notes` holds this browser's own notes and no others. */
  step: number;
  reach: number;
  /** How many notes the wall holds that this browser has not got: the other people's, while the notes are hidden.
   *  0 once they are revealed. */
  hidden: number;
  /** The clock of the step. What is left of it: domain/clock.ts, with the worker's time. */
  clock: Clock;
  /** The run that arranged the wall last, while the moderation can take it back (`admin.arrange.undo` names it), or
   *  null: there is nothing to take back. */
  arrangeRun: string | null;
  /** The votes of the steps the wall has entered that vote (domain/vote.ts): options, budget, counted or not. */
  votes: VoteRound[];
  /** This person's own ballot in the step the wall is in, as the wall stored it, or null. */
  ballot: Ballot | null;
  /** How many people have voted in the step the wall is in. */
  voted: number;
  /** The results of the counted votes. */
  results: VoteResult[];
  /** The teams as this person is told them (stage M4, domain/teams.ts), or null: the wall has formed none. */
  teams: TeamView | null;
  /** The steps that move on by themselves whose moving on the moderation has switched off. */
  manual: number[];
  /** The steps that reveal by turn which the wall has entered: how many notes are shown and left (stage M5). */
  turns: TurnView[];
  // `notes` and `groups` are what the worker has told: the wall as it is stored. What a browser shows is `shown()`.
  /** The number of the last stored change this browser has heard of (protocol.ts, `seq`). */
  seq: number;
  /** This browser and the wall are out of step: an event came whose number was not the next one. What this browser
   *  has may lack something until it asks for the wall again (`resync`); the `sync` that answers clears this. */
  gap: boolean;
  /** This browser's own commands that are on their way, oldest first. `shown()` lays them over what the worker has
   *  told; `ack` and `reject` take them out. */
  pending: PendingCommand[];
}

export const initialWallState: WallState = {
  wall: null,
  participants: [],
  you: null,
  protocolVersion: null,
  deleted: false,
  // until the first `sync` says what is so: nothing is taken to be visible, nothing to be allowed
  agenda: null,
  step: 0,
  reach: 0,
  hidden: 0,
  clock: NO_CLOCK,
  arrangeRun: null,
  votes: [],
  ballot: null,
  voted: 0,
  results: [],
  teams: null,
  manual: [],
  turns: [],
  notes: [],
  groups: [],
  seq: 0,
  gap: false,
  pending: [],
};

/** The one place a server event changes what the browser knows. Pure: the same events give the same wall. An
 *  `error` changes nothing here; whoever sent the frame reacts to it. */
export function applyServerEvent(state: WallState, event: ServerEvent): WallState {
  if (state.deleted) return state;
  switch (event.type) {
    case "sync":
      return {
        wall: event.wall,
        participants: event.participants,
        you: event.you.participantId,
        protocolVersion: event.protocolVersion,
        deleted: false,
        agenda: event.agenda,
        step: event.step,
        reach: event.reach,
        hidden: event.hidden,
        clock: event.clock,
        arrangeRun: event.arrangeRun,
        votes: event.votes,
        ballot: event.ballot,
        voted: event.voted,
        results: event.results,
        teams: event.teams,
        manual: event.manual,
        turns: event.turns,
        notes: event.notes,
        groups: event.groups,
        seq: event.seq,
        gap: false,
        // What is on its way stays on its way: the socket sends an unanswered command again after a reconnect, and
        // its answer comes on the new connection.
        pending: state.pending,
      };
    case "presence.join":
    case "roster.updated": {
      // Someone new, or someone known: back again, or here all along with a new name or a new role.
      const known = state.participants.some((p) => p.id === event.participant.id);
      return {
        ...state,
        participants: known
          ? state.participants.map((p) => (p.id === event.participant.id ? event.participant : p))
          : [...state.participants, event.participant],
      };
    }
    case "presence.leave":
      return {
        ...state,
        participants: state.participants.map((p) => (p.id === event.participantId ? { ...p, online: false } : p)),
      };
    case "participant.removed":
      // somebody had the wall forget them: they go from the people, their notes stay
      return { ...state, participants: state.participants.filter((p) => p.id !== event.participantId) };
    case "wall.deleted":
      return { ...state, deleted: true };
    case "erased":
      // this browser's own person is gone: whoever holds the socket ends the visit
      return state;
    case "note.created":
    case "note.updated":
    case "note.deleted":
    case "note.action":
    case "notes.moved":
    case "group.created":
    case "group.updated":
    case "group.deleted":
      return { ...state, ...applyChange(state, event), ...numbered(state, event.seq) };
    case "arrange.applied":
      // the wall's last run from now on: the one `admin.arrange.undo` can name
      return {
        ...state,
        ...applyChange(state, event),
        arrangeRun: event.runId,
        ...numbered(state, event.seq, numbersOf(event)),
      };
    case "arrange.undone":
      return {
        ...state,
        ...applyChange(state, event),
        arrangeRun: null,
        ...numbered(state, event.seq, numbersOf(event)),
      };
    case "wall.occupancy":
      // somebody else changed a note this browser may not read: the change's number, and how many are hidden now
      return { ...state, hidden: event.hidden, ...numbered(state, event.seq) };
    case "notes.revealed":
      // the notes this browser did not have: nothing is hidden any more, or, into a step of teams, those of the
      // other teams
      return {
        ...state,
        notes: event.notes.reduce((notes, note) => place(without(notes, note.id), note, madeBefore), state.notes),
        hidden: event.hidden ?? 0,
        ...numbered(state, event.seq),
      };
    case "team.changed":
      return {
        ...state,
        teams: event.team,
        notes: event.notes.reduce((notes, note) => place(without(notes, note.id), note, madeBefore), state.notes),
        hidden: event.hidden,
        ...numbered(state, event.seq),
      };
    case "turn.shown":
      // „Nächster Zettel“: the note this browser did not have, and the step's turns as they stand
      return {
        ...state,
        notes: event.notes.reduce((notes, note) => place(without(notes, note.id), note, madeBefore), state.notes),
        hidden: event.hidden,
        turns: withTurn(state.turns, event.turn),
        ...numbered(state, event.seq),
      };
    case "auto.changed":
      return { ...state, manual: event.manual, ...numbered(state, event.seq) };
    case "step.changed":
      return {
        ...state,
        // forming teams moved notes into the teams' areas
        ...(event.moves === undefined || event.moves.length === 0
          ? {}
          : { notes: applyChange(state, { type: "notes.moved", moves: event.moves }).notes }),
        step: event.step,
        reach: Math.max(event.reach, event.step),
        // the step is over, and with it its time: the worker stores the same (domain/flow.ts); a step that moves on
        // by itself starts its own
        clock: event.clock ?? stoppedClock(state.clock),
        teams: event.team ?? state.teams,
        // the step's vote, how many have voted in it and one's own ballot, where the step votes
        votes: event.round === undefined ? state.votes : withRound(state.votes, event.round),
        voted: event.voted ?? 0,
        ballot: event.ballot ?? null,
        // into a step that reveals by turn: its turns as they stand
        turns: event.turn === undefined ? state.turns : withTurn(state.turns, event.turn),
        ...numbered(state, event.seq),
      };
    case "ballot.stored":
      return {
        ...state,
        ...(event.step === state.step ? { ballot: event.ballot, voted: event.voted } : {}),
        ...numbered(state, event.seq),
      };
    case "votes.count":
      return { ...state, ...(event.step === state.step ? { voted: event.voted } : {}), ...numbered(state, event.seq) };
    case "results.published":
      return {
        ...state,
        results: [...state.results.filter((result) => result.step !== event.result.step), event.result],
        votes: state.votes.map((round) => (round.step === event.result.step ? { ...round, counted: true } : round)),
        ...numbered(state, event.seq),
      };
    case "clock.changed":
      return { ...state, clock: event.clock, ...numbered(state, event.seq) };
    // The worker has spoken about the command: taken, it is in what the worker has told (its event came before
    // the `ack`); refused, it never happened. Either way it is no longer on its way.
    case "ack":
    case "reject":
      return event.opId === undefined ? state : dropPending(state, event.opId);
    case "error":
      return state;
  }
}

/** Where a browser stands after an event that carries a number. Every stored change reaches a socket once and in
 *  order, after the snapshot that socket got, as itself or as the frame that stands in for it (`wall.occupancy`).
 *  So the next event carries the next number; any other number says that something went wrong on the way. The event
 *  is applied all the same (it is absolute and the latest word), and `gap` asks whoever holds the socket to get the
 *  wall again. `took` is how many numbers the event's change took: one, but for an arrangement (`numbersOf`), whose
 *  frame carries the last of its numbers. */
function numbered(state: WallState, seq: number, took = 1): Pick<WallState, "seq" | "gap"> {
  return { seq, gap: state.gap || seq !== state.seq + took };
}

/** The turns with one step's as it stands now. */
function withTurn(turns: TurnView[], turn: TurnView): TurnView[] {
  return [...turns.filter((known) => known.step !== turn.step), turn];
}

/** The votes with one of them as it stands now. */
function withRound(votes: VoteRound[], round: VoteRound): VoteRound[] {
  return [...votes.filter((known) => known.step !== round.step), round];
}

/** A command of this browser, applied at once: it is on its way from now on, and `shown()` includes what it does.
 *  The caller sends the same command to the worker. `now` is the browser's clock. */
export function applyCommand(state: WallState, command: ContentCommand, now: number): WallState {
  if (state.deleted) return state;
  return { ...state, pending: [...state.pending, { command, at: now }] };
}

/** Takes a command back that is on its way: the worker refused it or took it (`applyServerEvent` does this for
 *  `ack` and `reject`), or it will never be answered because it was never sent. */
export function dropPending(state: WallState, opId: string): WallState {
  if (!state.pending.some((pending) => pending.command.opId === opId)) return state;
  return { ...state, pending: state.pending.filter((pending) => pending.command.opId !== opId) };
}

// One answer per state: whoever renders asks often, and gets the same object as long as nothing changed.
const views = new WeakMap<WallState, WallContent>();

/** The wall as this browser shows it: what the worker has told, and over it this browser's own commands that are
 *  on their way, each decided by the same rules the worker will decide it by (domain/rules.ts). A command the
 *  rules refuse or find done shows nothing. When the worker's answer takes a command out of `pending`, what it did
 *  is gone from here, or has arrived in what the worker told. */
export function shown(state: WallState): WallContent {
  const known = views.get(state);
  if (known !== undefined) return known;
  let content: WallContent = { notes: state.notes, groups: state.groups };
  const me = self(state);
  if (me !== null) {
    for (const { command, at } of state.pending) {
      const decision = decide(readerOf(content, state.arrangeRun), command, me, at, stepContextOf(state));
      if (decision.kind === "changed") content = applyChange(content, decision.change);
    }
  }
  views.set(state, content);
  return content;
}

/** The wall after a change: what a stored event tells, or what the rules make of a command. Pure, and the same
 *  for worker events and for the browser's own commands, so both give the same wall. */
export function applyChange(content: WallContent, change: Change | ContentEvent): WallContent {
  const { notes, groups } = content;
  switch (change.type) {
    case "note.created":
      return { notes: place(without(notes, change.note.id), change.note, madeBefore), groups };
    case "note.updated":
      return {
        notes: notes.map((note) =>
          note.id === change.noteId ? { ...note, text: change.text, updatedAt: change.updatedAt } : note,
        ),
        groups,
      };
    case "note.deleted":
      return { notes: without(notes, change.noteId), groups };
    case "note.action":
      return {
        notes: notes.map((note) => {
          if (note.id !== change.noteId) return note;
          if (change.action !== null) return { ...note, action: change.action };
          const rest = { ...note };
          delete rest.action;
          return rest;
        }),
        groups,
      };
    case "notes.moved": {
      const to = new Map(change.moves.map((move) => [move.noteId, move]));
      return {
        notes: notes.map((note) => {
          const move = to.get(note.id);
          return move === undefined ? note : { ...note, x: move.x, y: move.y, groupId: move.groupId };
        }),
        groups,
      };
    }
    case "group.created":
    case "group.updated":
      return { notes, groups: place(without(groups, change.group.id), change.group, listedBefore) };
    case "group.deleted":
      return {
        // its notes stay where they lie, without a group
        notes: notes.map((note) => (note.groupId === change.groupId ? { ...note, groupId: null } : note)),
        groups: without(groups, change.groupId),
      };
    case "arrange.applied":
      return rearranged(content, change.moves, change.removed, change.groups);
    case "arrange.undone":
      return rearranged(content, change.moves, change.removed, change.restored);
  }
}

/** The wall after an arrangement, or after one was taken back: the notes that are named lie where the change says,
 *  the groups that go are gone (a note that still lay in one stays where it lies, without a group), and the groups
 *  that come stand in their places in the list. */
function rearranged(
  content: WallContent,
  moves: readonly NoteMove[],
  removed: readonly string[],
  added: readonly Group[],
): WallContent {
  const to = new Map(moves.map((move) => [move.noteId, move]));
  const going = new Set(removed);
  return {
    notes: content.notes.map((note) => {
      const move = to.get(note.id);
      if (move !== undefined) return { ...note, x: move.x, y: move.y, groupId: move.groupId };
      return note.groupId !== null && going.has(note.groupId) ? { ...note, groupId: null } : note;
    }),
    groups: added.reduce(
      (groups, group) => place(without(groups, group.id), group, listedBefore),
      content.groups.filter((group) => !going.has(group.id)),
    ),
  };
}

/** The wall's content as the rules ask about it, in a browser: every note says itself whether it is this
 *  browser's person's (`mine`). `arrangeRun` is the run that can be taken back, as far as a browser knows it: which
 *  one it was (`WallState.arrangeRun`). */
export function readerOf(content: WallContent, arrangeRun: string | null = null): WallReader {
  // every note a browser holds is one it may read: in a step of teams, its own or its team's (`shared`)
  let byId: Map<string, Note & { shared: true }> | null = null;
  const note = (id: string) =>
    (byId ??= new Map(content.notes.map((n) => [n.id, { ...n, shared: true as const }]))).get(id) ?? null;
  return {
    note,
    placement: note,
    group: (id) => content.groups.find((group) => group.id === id) ?? null,
    noteCount: () => content.notes.length,
    groupOrds: () => content.groups.map((group) => group.ord),
    groups: () => content.groups,
    members: (groupId) => content.notes.filter((n) => n.groupId === groupId).map((n) => n.id),
    arranged: () => (arrangeRun === null ? null : { runId: arrangeRun }),
  };
}

/** What the step the wall is in allows, and what is seen of the others' notes, as this browser knows it. Before the
 *  first `sync`: nothing (`NO_STEP`). One answer per state, as `shown()` gives. */
export function stepContextOf(state: Pick<WallState, "agenda" | "step" | "reach">): StepContext {
  return state.agenda === null ? NO_STEP : stepContext(state.agenda, { step: state.step, reach: state.reach });
}

/** The person this browser is, once the wall is known. */
export function self(state: WallState): Participant | null {
  return state.participants.find((p) => p.id === state.you) ?? null;
}

function without<T extends { id: string }>(list: T[], id: string): T[] {
  return list.some((entry) => entry.id === id) ? list.filter((entry) => entry.id !== id) : list;
}

// The order of a snapshot (the worker sorts the same way), kept when an event adds to it: notes by when they were
// made, groups by their `ord`, and by id where those are equal.
const madeBefore = (a: Note, b: Note) => a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id);
const listedBefore = (a: Group, b: Group) => a.ord < b.ord || (a.ord === b.ord && a.id < b.id);

/** `list` with `item` at its place. New things are the latest, so the place is looked for from the end. */
function place<T>(list: T[], item: T, before: (a: T, b: T) => boolean): T[] {
  let at = list.length;
  while (at > 0 && before(item, list[at - 1] as T)) at -= 1;
  return [...list.slice(0, at), item, ...list.slice(at)];
}
