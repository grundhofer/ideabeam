// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as z from "zod/mini";
import { agendaRequestSchema, resolvedAgendaSchema } from "./domain/agenda.js";
import { MAX_STEPS } from "./domain/method.js";
import { ballotSchema, voteResultSchema, voteRoundSchema } from "./domain/vote.js";
import { hexIdSchema, wallIdSchema } from "./ids.js";
import { sessionKeySchema } from "./session-key.js";

// The schemas are written with `zod/mini`: a check is a function handed to `.check()`, and `z.optional()`,
// `z.nullable()` and `z._default()` wrap a schema. zod's classic build (`import { z } from "zod"`, with a method for
// each of these) takes and refuses the same, but loads in some 10 ms more, which the Worker pays at every fresh start
// (docs/messung-4a.md, section 8); it also made the Worker's file 126 KB larger, and the app's first load 17 KB (gzip).
// ESLint refuses every import of zod but this one, and apps/web/tests/worker.spec.ts reads the built files for the
// classic build. `zod/mini` loads no texts for its errors: every message reads „Invalid input“, so nothing may read
// one.

// zod compiles a fast parser with `new Function` where the runtime allows it, and finds out by trying. The app's
// Content-Security-Policy allows no eval, and reports even the attempt that zod catches; a Worker allows none
// either. So: no attempt. The frames are small; the plain parser is fast enough. (`zod/mini` 4.6.7 brings no such
// parser, so the setting changes nothing today: it stays for the version or the build that does.)
z.config({ jitless: true });

// The frames browser and worker exchange: small JSON text frames, parsed on both ends with the schemas below, so
// neither side ever acts on a shape it did not expect. Stage 1 holds the wall and who is on it, stage 2 the notes,
// the groups and where the notes lie, stage 3 hidden writing, revealing, the clock of the writing and the brake of a
// wall's day, stage 4 arranging: the moderation applies a proposal and takes it back. Stage M1 of the methods
// (PLAN-METHODEN.md 5) turned the two phases into the steps of a wall's agenda: `admin.step.go`, `step.changed`.
// Stage M2 brought hidden voting (domain/vote.ts): `ballot.cast`, `admin.step.count`, and to the browsers
// `ballot.stored` (the voter's own), `votes.count` (a number), `results.published` (once counted).

// The version of these frames. A deploy disconnects every socket, and a tab that reconnects still runs the old
// script: the worker names its version in every `sync`, and a browser that reads another one asks for a reload
// instead of guessing. Raised with every change a running tab cannot read (PLAN.md 3.4).
export const PROTOCOL_VERSION = 8;

// The admin's capability, minted with the wall and kept in the creating browser: 128 bits of hex. Anything else
// cannot be one and is refused before it is compared.
export const adminTokenSchema = z.string().check(z.regex(/^[0-9a-f]{32}$/));

export const displayNameSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(40));
// A wall has no name: the question it asks is its title.
export const questionSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(140));

/** How many people can be on a wall at once. */
export const MAX_ONLINE = 30;
/** How many people a wall remembers at all, present or not: a bound for its storage, far past any real team. */
export const MAX_PARTICIPANTS = 200;
/** How large a frame may be, in bytes as it travels (PLAN.md 3.3). Stage 1's frames are a few hundred bytes; the
 *  bound is sized for the one that will carry a whole arrangement. */
export const MAX_FRAME_BYTES = 256 * 1024;

// What a wall holds at most (PLAN.md 3.3). Both sides read the numbers here: the worker refuses what is past them,
// the app does not offer it.
/** How many notes a wall holds: the upper bound the surface is measured for. */
export const MAX_NOTES = 500;
/** How long a note's text is at most, in characters as a script counts them (UTF-16 units), after trimming. */
export const NOTE_TEXT_MAX = 300;
/** How many groups a wall holds. */
export const MAX_GROUPS = 80;
/** How long a group's title is at most. A group may have none yet: the frame comes first, the words after. */
export const GROUP_TITLE_MAX = 60;
/** How many notes one `notes.move` carries at most: every note of a wall, so arranging is one frame. */
export const MAX_MOVES = MAX_NOTES;
/** The surface has no edge, but its numbers have one: a position is a whole number of world units (one unit is
 *  1/16 rem) between -COORD_LIMIT and +COORD_LIMIT (PLAN.md 3.1). It is the place of a note's or a frame's top
 *  left corner. */
export const COORD_LIMIT = 50_000;
/** The smallest side of a group's frame: still large enough to take hold of. */
export const GROUP_MIN_SIZE = 96;
/** The largest side of a group's frame: room for every note of a wall in one group, several times over. */
export const GROUP_MAX_SIZE = 20_000;

export const noteTextSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(NOTE_TEXT_MAX));
export const groupTitleSchema = z.string().check(z.trim(), z.maxLength(GROUP_TITLE_MAX));
export const coordSchema = z.int().check(z.minimum(-COORD_LIMIT), z.maximum(COORD_LIMIT));
export const groupSizeSchema = z.int().check(z.minimum(GROUP_MIN_SIZE), z.maximum(GROUP_MAX_SIZE));

export const participantRoleSchema = z.enum(["admin", "member"]);
export type ParticipantRole = z.infer<typeof participantRoleSchema>;

export const participantSchema = z.object({
  id: hexIdSchema,
  name: displayNameSchema,
  role: participantRoleSchema,
  /** Read from the open sockets when the frame is built, never stored. */
  online: z.boolean(),
});
export type Participant = z.infer<typeof participantSchema>;

// Where a wall stands (PLAN-METHODEN.md 4): in a step of its agenda (domain/agenda.ts, domain/flow.ts). What may be
// done follows from the step it is in; what is seen of the others' notes from the furthest step it has reached, so
// going back never hides. In a hidden step everybody writes, and nobody reads what the others wrote: the worker
// leaves their notes out of everything it sends (domain/visibility.ts).

/** The shortest and the longest time the moderation can set the writing's clock to, in minutes. */
export const CLOCK_MIN_MINUTES = 1;
export const CLOCK_MAX_MINUTES = 60;
export const clockMinutesSchema = z.int().check(z.minimum(CLOCK_MIN_MINUTES), z.maximum(CLOCK_MAX_MINUTES));

// The clock of the writing (the owner's decision 13, PLAN.md 7.2). It is data, not a timer: the moment the time
// ends, or what is left of it while it is paused. Neither is set: no clock. Worker and browser work out what is
// left with the same function (domain/clock.ts); nothing happens by itself when the time is up.
export const clockSchema = z.object({
  /** Counts the controls: every one that was taken made the next revision, and a control names the revision it was
   *  made for, so it never acts twice. */
  rev: z.int().check(z.minimum(0)),
  /** While the clock runs: the moment of the worker's clock at which the time ends. */
  endsAt: z.nullable(z.int()),
  /** While the clock is paused: how much is left, in milliseconds. */
  leftMs: z.nullable(z.int().check(z.minimum(0))),
});
export type Clock = z.infer<typeof clockSchema>;

// A note as one browser gets it: what was written, whether it is this browser's person who wrote it, and where it
// lies now. Who wrote a note never leaves the worker (the owner's decision 14, PLAN.md 7.2): `mine` is worked out
// per recipient (domain/visibility.ts), and a note whose writer had the wall forget them is nobody's. In storage
// the place a note was made at stands in its own row and every later place in the one layout row (PLAN.md 3.3); on
// the wire a note simply has a place. Its width is fixed and its height follows from its text
// (domain/note-size.ts), so neither travels.
export const noteSchema = z.object({
  id: hexIdSchema,
  /** Whether the person this frame goes to wrote the note. */
  mine: z.boolean(),
  text: noteTextSchema,
  x: coordSchema,
  y: coordSchema,
  /** The group the note belongs to, or null: it lies on the wall by itself. */
  groupId: z.nullable(hexIdSchema),
  createdAt: z.int(),
  updatedAt: z.int(),
});
export type Note = z.infer<typeof noteSchema>;

/** Who gave a group its title: the AI when it arranged (`ki`, PLAN.md 4.3), or a person. */
export const titleSourceSchema = z.enum(["ki", "person"]);
export type TitleSource = z.infer<typeof titleSourceSchema>;

export const groupSchema = z.object({
  id: hexIdSchema,
  title: groupTitleSchema,
  titleSource: titleSourceSchema,
  /** Arranging leaves a locked group and the notes in it alone. A group made by hand is locked, and so is a group
   *  of the AI's from the moment a person renames it (domain/rules.ts). */
  locked: z.boolean(),
  x: coordSchema,
  y: coordSchema,
  w: groupSizeSchema,
  h: groupSizeSchema,
  /** The group's place in a list of the groups: the order they were made in. */
  ord: z.int(),
});
export type Group = z.infer<typeof groupSchema>;

/** What a `group.update` may change. */
export const GROUP_FIELDS = ["title", "x", "y", "w", "h"] as const;

/** Where one note goes: its new place, and the group it now belongs to or none. Absolute, like every command. */
export const noteMoveSchema = z.object({
  noteId: hexIdSchema,
  x: coordSchema,
  y: coordSchema,
  groupId: z.nullable(hexIdSchema),
});
export type NoteMove = z.infer<typeof noteMoveSchema>;

// Arranging (PLAN.md 3.4, 4.3). Who worked a proposal out: Cloudflare's AI asked by the Worker (`service`), the
// moderation's own provider asked by its browser (`key`), or a model in the moderation's browser (`browser`). The
// wall does not care: all three end in the same command.
export const arrangeSourceSchema = z.enum(["service", "key", "browser"]);
export type ArrangeSource = z.infer<typeof arrangeSourceSchema>;

/** A group a run makes: its frame, its title, and the notes that go into it. */
export const arrangeGroupSchema = z.object({
  groupId: hexIdSchema,
  title: groupTitleSchema,
  x: coordSchema,
  y: coordSchema,
  w: groupSizeSchema,
  h: groupSizeSchema,
  noteIds: z.array(hexIdSchema).check(z.minLength(1), z.maxLength(MAX_NOTES)),
});
export type ArrangeGroup = z.infer<typeof arrangeGroupSchema>;

/** Whether the two halves of an arrangement say the same: every group and every note is named once, a note goes
 *  into the group that lists it, and into none when no group does. */
function arrangementAgrees(groups: readonly ArrangeGroup[], moves: readonly NoteMove[]): boolean {
  const groupOf = new Map<string, string>();
  const groupIds = new Set<string>();
  for (const group of groups) {
    if (groupIds.has(group.groupId)) return false;
    groupIds.add(group.groupId);
    for (const noteId of group.noteIds) {
      if (groupOf.has(noteId)) return false;
      groupOf.set(noteId, group.groupId);
    }
  }
  const moved = new Set<string>();
  for (const move of moves) {
    if (moved.has(move.noteId) || move.groupId !== (groupOf.get(move.noteId) ?? null)) return false;
    moved.add(move.noteId);
  }
  // no group lists a note the moves leave out
  return [...groupOf.keys()].every((noteId) => moved.has(noteId));
}

// `POST /api/walls/:id/arrange` (PLAN.md 4.3): the moderation asks the Worker for a proposal. The request carries
// the wall's admin token in its `Authorization` header (`Bearer <token>`) and, as its body, the language the titles
// are to be written in, and nothing else: the Worker reads the notes from the wall itself. A body with anything
// more is refused, so the route never is an AI for texts somebody sends in.
export const arrangeLanguageSchema = z.enum(["de", "en"]);
export type ArrangeLanguage = z.infer<typeof arrangeLanguageSchema>;
export const arrangeRequestSchema = z.strictObject({ language: arrangeLanguageSchema });

/** How many notes a wall has to offer before the AI is asked: the notes that lie in no locked group. Below it
 *  there is nothing to find themes in, and the route answers `NOTHING_TO_ARRANGE` without a call. */
export const ARRANGE_MIN_NOTES = 6;

/** A proposal: groups with a title and their notes, and the notes that found no group. Every note the Worker read
 *  stands in it once. Nothing of it is stored until the moderation applies it (`admin.arrange.apply`), with the
 *  places a layout gives it (packages/arrange). */
export const proposalSchema = z.object({
  groups: z.array(z.object({ title: groupTitleSchema, noteIds: z.array(hexIdSchema).check(z.minLength(1)) })),
  loose: z.array(hexIdSchema),
});
export type Proposal = z.infer<typeof proposalSchema>;

export const arrangeResponseSchema = z.object({
  proposal: proposalSchema,
  /** What the run cost: the neurons Cloudflare counted (or, where an answer named none, the neurons its tokens
   *  cost), the calls that were made, and the tokens read and written. A slow call that was asked a second time
   *  and overtaken is in it at what the call that overtook it used: the run does not wait to hear its own. */
  cost: z.object({
    neurons: z.number(),
    calls: z.int(),
    inputTokens: z.int(),
    outputTokens: z.int(),
  }),
  /** A part of the notes got no answer from the AI, also when asked again: they stand in `loose`. */
  partial: z.boolean(),
  /** How many runs the wall has left now, of those it has in any 24 hours (domain/budget.ts). */
  runsLeft: z.int(),
  /** The model that was asked: its id at Workers AI. A local run, which asks no model, says `stand-in`. */
  model: z.string(),
});
export type ArrangeResponse = z.infer<typeof arrangeResponseSchema>;

/** Why the route gave no proposal.
 *  - `WALL_NOT_FOUND` (404): no such wall.
 *  - `NOT_ADMIN` (401): the request carries no admin token, or not this wall's.
 *  - `INVALID_REQUEST` (400): the body is not `{ language }`.
 *  - `PHASE` (409): the notes are still hidden. Arranging comes after revealing.
 *  - `NOTHING_TO_ARRANGE` (409): fewer than ARRANGE_MIN_NOTES notes lie outside the locked groups (`notes` says how
 *    many, `min` how many it takes). No call was made.
 *  - `AI_BUDGET_SPENT` (429): the AI's budget is spent, for every wall. Either the product's own count of the last
 *    24 hours does not hold the run: it fits again at `resetsAt`. Or Cloudflare refused a call because the account's
 *    allowance is used up: then there is no `resetsAt`, the product does not know when Cloudflare's window frees up.
 *  - `WALL_RUNS_SPENT` (429): this wall has had its runs of the last 24 hours; the next one at `resetsAt`.
 *  - `AI_FAILED` (502): the AI did not answer, or answered what is no proposal, also when asked a second time.
 *  - `AI_UNAVAILABLE` (503): this deployment has no AI to ask. */
export const arrangeErrorCodeSchema = z.enum([
  "WALL_NOT_FOUND",
  "NOT_ADMIN",
  "INVALID_REQUEST",
  "PHASE",
  "NOTHING_TO_ARRANGE",
  "AI_BUDGET_SPENT",
  "WALL_RUNS_SPENT",
  "AI_FAILED",
  "AI_UNAVAILABLE",
]);
export type ArrangeErrorCode = z.infer<typeof arrangeErrorCodeSchema>;

export const arrangeErrorSchema = z.object({
  error: arrangeErrorCodeSchema,
  /** With `WALL_RUNS_SPENT`, and with `AI_BUDGET_SPENT` where the product's own count refused: the moment the run
   *  fits again (domain/budget.ts). Left out where Cloudflare refused. */
  resetsAt: z.optional(z.int()),
  /** With `NOTHING_TO_ARRANGE`: how many notes there are to arrange, and how many it takes. */
  notes: z.optional(z.int()),
  min: z.optional(z.int()),
});
export type ArrangeError = z.infer<typeof arrangeErrorSchema>;

// `GET /api/walls/:id/export?lang=de|en` (PLAN.md 3.2): the wall as Markdown, as the person who asks may see it
// (domain/export.ts). Who asks is said by the session key their browser joined the wall with, in the `Authorization`
// header (`Session <key>`), never in the address, which ends up in logs and histories. `lang` is the language of the
// file's fixed words, the language „Ordnen“ takes. The answer is the file (`text/markdown`), or one of these:
//  - `WALL_NOT_FOUND` (404): no such wall.
//  - `NOT_ON_WALL` (401): no session key, or one that is nobody's on this wall.
//  - `INVALID_REQUEST` (400): no `lang`, or another one.
export const EXPORT_SESSION_SCHEME = "Session";
export const exportErrorCodeSchema = z.enum(["WALL_NOT_FOUND", "NOT_ON_WALL", "INVALID_REQUEST"]);
export type ExportErrorCode = z.infer<typeof exportErrorCodeSchema>;
export const exportErrorSchema = z.object({ error: exportErrorCodeSchema });
export type ExportError = z.infer<typeof exportErrorSchema>;

export const wallInfoSchema = z.object({
  id: wallIdSchema,
  question: questionSchema,
  createdAt: z.int(),
});
export type WallInfo = z.infer<typeof wallInfoSchema>;

// `agenda`: the method the wall runs (domain/agenda.ts). Left out, `hidden` says it, as it did before there were
// methods: hidden writing (left out, too) is „Still sammeln, bündeln, verdeckt wählen“, a wall that shows every note
// at once („hidden: false“) is „Freie Wand“. With an agenda, `hidden` is not read.
export const createWallRequestSchema = z.object({
  question: questionSchema,
  hidden: z._default(z.boolean(), true),
  agenda: z.optional(agendaRequestSchema),
});
export const createWallResponseSchema = z.object({ wallId: wallIdSchema, adminToken: adminTokenSchema });
export type CreateWallResponse = z.infer<typeof createWallResponseSchema>;
/** The answer of `POST /api/walls` (status 429) when the day's walls are spent (domain/budget.ts): the product
 *  makes no wall until `resetsAt`, the next 00:00 UTC. Walls that exist go on. */
export const budgetSpentSchema = z.object({ error: z.literal("BUDGET_SPENT"), resetsAt: z.int() });
export type BudgetSpent = z.infer<typeof budgetSpentSchema>;

// Browser → worker. A command that changes something carries an `opId` the browser minted, and is answered under
// it: `ack`, or `reject` with the reason. Every such command is absolute, never a difference, and names the thing
// it is about by an id the browser minted: sent again after a reconnect, it finds its work done and changes
// nothing (PLAN.md 3.4).
export const clientCommandSchema = z.discriminatedUnion("type", [
  // The first frame of every connection. The session key was minted by the browser before its first join, so a
  // join that is repeated (a lost answer, a reload, a reconnect) reclaims the same person.
  z.object({
    type: z.literal("join"),
    name: displayNameSchema,
    sessionKey: sessionKeySchema,
    adminToken: z.optional(adminTokenSchema),
  }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("resync") }),
  z.object({ type: z.literal("admin.wall.delete"), opId: hexIdSchema }),
  // „Meine Angaben löschen“: the wall forgets the sender, their name, role and session key. Their notes stay,
  // without a name (the owner's decision K, PLAN.md 7.3): nobody stands behind them any more, so nobody changes
  // their text, and the moderation can still delete them.
  z.object({ type: z.literal("me.erase"), opId: hexIdSchema }),

  // A note, at the place the browser chose for it. Whoever sends it is its author.
  z.object({
    type: z.literal("note.create"),
    opId: hexIdSchema,
    noteId: hexIdSchema,
    text: noteTextSchema,
    x: coordSchema,
    y: coordSchema,
  }),
  // A note's text: its author's alone.
  z.object({ type: z.literal("note.update"), opId: hexIdSchema, noteId: hexIdSchema, text: noteTextSchema }),
  // Its author's, or an admin's.
  z.object({ type: z.literal("note.delete"), opId: hexIdSchema, noteId: hexIdSchema }),
  // One movement, one frame (PLAN.md 3.4): sent when a drag ends, never while it lasts, and for a whole selection
  // at once. Each note is named once.
  z.object({
    type: z.literal("notes.move"),
    opId: hexIdSchema,
    moves: z.array(noteMoveSchema).check(
      z.minLength(1),
      z.maxLength(MAX_MOVES),
      z.refine((moves) => new Set(moves.map((move) => move.noteId)).size === moves.length),
    ),
  }),
  // A group made by hand: a frame, with a title or still without one.
  z.object({
    type: z.literal("group.create"),
    opId: hexIdSchema,
    groupId: hexIdSchema,
    title: groupTitleSchema,
    x: coordSchema,
    y: coordSchema,
    w: groupSizeSchema,
    h: groupSizeSchema,
  }),
  // What is named changes, what is left out stays: a new title does not undo a move somebody else made meanwhile.
  z
    .object({
      type: z.literal("group.update"),
      opId: hexIdSchema,
      groupId: hexIdSchema,
      title: z.optional(groupTitleSchema),
      x: z.optional(coordSchema),
      y: z.optional(coordSchema),
      w: z.optional(groupSizeSchema),
      h: z.optional(groupSizeSchema),
    })
    .check(z.refine((command) => GROUP_FIELDS.some((field) => command[field] !== undefined))),
  // The frame goes, its notes stay where they lie, without a group.
  z.object({ type: z.literal("group.delete"), opId: hexIdSchema, groupId: hexIdSchema }),

  // The moderation's: to another step of the agenda, forward, back or past one (domain/flow.ts). `from` is the step
  // the command was made in: sent a second time it finds its work done, made for a step the wall has left it is
  // refused (`STALE`). A move to a step that shows the hidden notes is revealing: everybody gets the notes they did
  // not have. Going back never hides them again.
  z.object({
    type: z.literal("admin.step.go"),
    opId: hexIdSchema,
    from: z.int().check(z.minimum(0), z.maximum(MAX_STEPS - 1)),
    to: z.int().check(z.minimum(0), z.maximum(MAX_STEPS - 1)),
  }),
  // The moderation's controls of the writing's clock. Each names the revision of the clock it was made for
  // (`rev`): one that arrives a second time, or after somebody else's control, is refused (`STALE`) and does not
  // act again. `start` sets the time and lets it run, also over a clock that runs already.
  z.object({
    type: z.literal("admin.clock.start"),
    opId: hexIdSchema,
    rev: clockSchema.shape.rev,
    minutes: clockMinutesSchema,
  }),
  z.object({ type: z.literal("admin.clock.pause"), opId: hexIdSchema, rev: clockSchema.shape.rev }),
  z.object({ type: z.literal("admin.clock.resume"), opId: hexIdSchema, rev: clockSchema.shape.rev }),
  // five minutes more (domain/clock.ts, CLOCK_EXTEND_MINUTES), also when the time is up or paused
  z.object({ type: z.literal("admin.clock.extend"), opId: hexIdSchema, rev: clockSchema.shape.rev }),
  // no clock any more
  z.object({ type: z.literal("admin.clock.clear"), opId: hexIdSchema, rev: clockSchema.shape.rev }),

  // Everybody's, in a step that votes (domain/vote.ts): the sender's whole ballot for the step the wall is in, sent
  // with „Abgeben“. Absolute: sent again, it replaces the one stored, and the same ballot twice is one. `step` is the
  // step it was made in: made for a step the wall has left, it is refused (`STALE`); once the vote is counted,
  // nothing more is taken (`PHASE`).
  z.object({
    type: z.literal("ballot.cast"),
    opId: hexIdSchema,
    step: z.int().check(z.minimum(0), z.maximum(MAX_STEPS - 1)),
    ballot: ballotSchema,
  }),
  // The moderation's: counts the vote of the step the wall is in, and everybody gets the result at once. Once.
  z.object({
    type: z.literal("admin.step.count"),
    opId: hexIdSchema,
    step: z.int().check(z.minimum(0), z.maximum(MAX_STEPS - 1)),
  }),

  // The moderation's: a whole arrangement in one frame (PLAN.md 3.4). The groups it makes, each with its frame, its
  // title and its notes, and where every note it touches goes: into one of these groups, or to a place without a
  // group. Both halves have to say the same about which note lies in which group. The command's `opId` is the
  // run's name from then on: `admin.arrange.undo` takes it back under that name.
  z
    .object({
      type: z.literal("admin.arrange.apply"),
      opId: hexIdSchema,
      source: arrangeSourceSchema,
      groups: z.array(arrangeGroupSchema).check(z.minLength(1), z.maxLength(MAX_GROUPS)),
      moves: z.array(noteMoveSchema).check(z.minLength(1), z.maxLength(MAX_MOVES)),
    })
    .check(z.refine((command) => arrangementAgrees(command.groups, command.moves))),
  // The moderation's: takes the last arrangement back. It names the run it means (`runId`, the `opId` of that
  // run's `admin.arrange.apply`), so it is absolute like every command: sent a second time it finds its work done,
  // and it never takes back a run that came after the one it was made for.
  z.object({ type: z.literal("admin.arrange.undo"), opId: hexIdSchema, runId: hexIdSchema }),
]);
export type ClientCommand = z.infer<typeof clientCommandSchema>;

/** The commands that change what a wall holds: its notes, its groups, where the notes lie. */
export type ContentCommand = Extract<
  ClientCommand,
  {
    type:
      | "note.create"
      | "note.update"
      | "note.delete"
      | "notes.move"
      | "group.create"
      | "group.update"
      | "group.delete"
      | "admin.arrange.apply"
      | "admin.arrange.undo";
  }
>;

/** The moderation's command that moves the wall to another step. */
export type StepCommand = Extract<ClientCommand, { type: "admin.step.go" }>;

/** A ballot, cast. */
export type BallotCommand = Extract<ClientCommand, { type: "ballot.cast" }>;

/** The moderation's command that counts a vote. */
export type CountCommand = Extract<ClientCommand, { type: "admin.step.count" }>;

/** The moderation's controls of the clock. */
export type ClockCommand = Extract<
  ClientCommand,
  {
    type: "admin.clock.start" | "admin.clock.pause" | "admin.clock.resume" | "admin.clock.extend" | "admin.clock.clear";
  }
>;

/** Why a command of a joined person was refused.
 *  - `INVALID`: the frame names an operation but is no command the wall takes: a text too long, a place off the
 *    surface, a frame too small.
 *  - `NOT_ADMIN`: only an admin may do this.
 *  - `NOT_AUTHOR`: only the note's author may do this (deleting: its author or an admin).
 *  - `NOT_FOUND`: the note or the group to change is not on the wall. An arrangement names a note that is gone.
 *  - `CONFLICT`: the id of the new note is another person's note already. An arrangement touches what is a
 *    person's: a note that lies in a locked group, or a group id that is taken.
 *  - `LIMIT`: the wall holds as many notes, or groups, as it may.
 *  - `PHASE`: the step the wall is in does not take this (the name is the one of the phases before): a group or
 *    an arrangement while the notes are hidden, the clock outside a step of writing, a note in a step that votes,
 *    a ballot or counting outside one, a ballot after the vote is counted.
 *  - `STALE`: a control of the clock that was made for another revision of it: taken already, or overtaken. An
 *    undo of an arrangement that is not the wall's last one. A step move, a ballot or counting made for a step the
 *    wall has left.
 *  - `DAY_SPENT`: the wall has written what one wall may write on a UTC day (domain/budget.ts). The frame says
 *    when it takes changes again (`resetsAt`). */
export const rejectCodeSchema = z.enum([
  "NOT_ADMIN",
  "INVALID",
  "NOT_AUTHOR",
  "NOT_FOUND",
  "CONFLICT",
  "LIMIT",
  "PHASE",
  "STALE",
  "DAY_SPENT",
]);
export type RejectCode = z.infer<typeof rejectCodeSchema>;

/** Why a frame was not taken at all. */
export const errorCodeSchema = z.enum(["BAD_MESSAGE", "RATE_LIMIT", "NOT_JOINED", "NAME_TAKEN", "WALL_FULL"]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// Worker → browser.
//
// `seq` counts the changes a wall has stored: every command that changed something got the next number, and the
// event that tells of it carries it. A `sync` says which number the snapshot stands at, so a browser knows where it
// is: the next event carries the next number, and any other number means that browser and wall are out of step
// and the wall has to be asked again (`resync`). Who is here is not stored and not counted: the frames about
// people carry no `seq`. A change a browser may not read (somebody else's hidden note) still reaches it as a
// number: `wall.occupancy` stands in for it, so no browser ever misses one.
//
// One kind of change takes more than one number: an arrangement, applied or taken back, takes as many as the rows
// it writes (`numbersOf`, domain/arrange.ts), and its frame carries the last of them. The brake of a wall's day
// counts numbers (domain/budget.ts), and an arrangement can write a row for every group of the wall: it has to
// weigh what it writes. Both sides work the count out from the frame itself.
export const serverEventSchema = z.discriminatedUnion("type", [
  // The whole wall as it stands: the answer to `join` and `resync`. There is no replay of what was missed; a
  // reconnect simply gets the snapshot again.
  z.object({
    type: z.literal("sync"),
    protocolVersion: z.int(),
    /** The worker's clock when the frame was built; the browser keeps the distance to its own. */
    serverNow: z.number(),
    wall: wallInfoSchema,
    participants: z.array(participantSchema),
    you: z.object({ participantId: hexIdSchema }),
    /** The number of the last stored change that is in this snapshot. */
    seq: z.int(),
    /** The wall's agenda: its methods and their steps (domain/agenda.ts). */
    agenda: resolvedAgendaSchema,
    /** The step the wall is in, and the furthest one it has reached (domain/flow.ts). */
    step: z.int().check(z.minimum(0)),
    reach: z.int().check(z.minimum(0)),
    /** How many notes the wall holds that are not in this snapshot: the other people's, while the notes are hidden.
     *  A number and nothing else. 0 once the wall is revealed. */
    hidden: z.int().check(z.minimum(0)),
    clock: clockSchema,
    /** In the order they were made. While the notes are hidden: this person's own only. */
    notes: z.array(noteSchema),
    /** In the order they were made. */
    groups: z.array(groupSchema),
    /** The run that arranged the wall last, while it can be taken back (`admin.arrange.undo`): the `opId` of its
     *  `admin.arrange.apply`. null: there is nothing to take back. */
    arrangeRun: z.nullable(hexIdSchema),
    /** The votes of the steps the wall has entered that vote: their options, budgets and whether they are counted
     *  (domain/vote.ts). No ballot. */
    votes: z.array(voteRoundSchema),
    /** This person's own ballot in the step the wall is in, or null: none, or the step does not vote. Never anybody
     *  else's. */
    ballot: z.nullable(ballotSchema),
    /** How many people have voted in the step the wall is in: a number, and nothing about who or what. */
    voted: z.int().check(z.minimum(0)),
    /** The results of the counted votes. Nothing of a vote that is not counted. */
    results: z.array(voteResultSchema),
  }),
  // The answer to a command that was taken. `seq` is the number its change got; a command that found its work
  // done changed nothing, and its answer names the number the wall stands at.
  z.object({ type: z.literal("ack"), opId: hexIdSchema, seq: z.int() }),
  z.object({
    type: z.literal("reject"),
    opId: z.optional(hexIdSchema),
    code: rejectCodeSchema,
    /** With `DAY_SPENT`: the moment the wall takes changes again, the next 00:00 UTC. */
    resetsAt: z.optional(z.int()),
  }),
  // Somebody came: the first socket of a person opened. Their name and role are in it, so a person who comes back
  // under a new name needs no second frame.
  z.object({ type: z.literal("presence.join"), participant: participantSchema }),
  // Somebody went: the last socket of a person closed.
  z.object({ type: z.literal("presence.leave"), participantId: hexIdSchema }),
  // What the wall has stored about somebody who is here changed: their name or their role.
  z.object({ type: z.literal("roster.updated"), participant: participantSchema }),
  // Somebody had the wall forget them (`me.erase`): they are no longer on it, here or away. Their notes stay.
  z.object({ type: z.literal("participant.removed"), participantId: hexIdSchema }),
  // To every socket of the person who had the wall forget them, before the wall closes it: nobody stands behind
  // the socket any more, so the browser does not join again by itself.
  z.object({ type: z.literal("erased") }),
  z.object({ type: z.literal("wall.deleted") }),
  z.object({ type: z.literal("error"), code: errorCodeSchema }),

  // What a command changed, told to everyone on the wall who may read it, its sender included and before the
  // `ack`. While the notes are hidden that is the writer alone; everyone else gets `wall.occupancy`.
  z.object({ type: z.literal("note.created"), seq: z.int(), note: noteSchema }),
  z.object({
    type: z.literal("note.updated"),
    seq: z.int(),
    noteId: hexIdSchema,
    text: noteTextSchema,
    updatedAt: z.int(),
  }),
  z.object({ type: z.literal("note.deleted"), seq: z.int(), noteId: hexIdSchema }),
  // Only the notes that went somewhere: a note that lay there already, or is gone, is not in it.
  z.object({ type: z.literal("notes.moved"), seq: z.int(), moves: z.array(noteMoveSchema).check(z.minLength(1)) }),
  z.object({ type: z.literal("group.created"), seq: z.int(), group: groupSchema }),
  z.object({ type: z.literal("group.updated"), seq: z.int(), group: groupSchema }),
  // Its notes stay where they lie, without a group: no second frame says so.
  z.object({ type: z.literal("group.deleted"), seq: z.int(), groupId: hexIdSchema }),

  // An arrangement was applied (PLAN.md 3.4): the groups the run made, where the notes it touched went, and the
  // groups of an earlier run that it left without notes and took away (`removed`). `runId` names the run for
  // `admin.arrange.undo`.
  z.object({
    type: z.literal("arrange.applied"),
    seq: z.int(),
    runId: hexIdSchema,
    source: arrangeSourceSchema,
    groups: z.array(groupSchema),
    moves: z.array(noteMoveSchema),
    removed: z.array(hexIdSchema),
  }),
  // The last arrangement was taken back: where the notes it had moved lie again, the groups it had made and that
  // go (`removed`), and the groups it had taken away and that are back (`restored`). A group of the run goes also
  // when a person has moved it since; one a person has renamed since is locked and stays, with the notes in it
  // (domain/arrange.ts).
  z.object({
    type: z.literal("arrange.undone"),
    seq: z.int(),
    runId: hexIdSchema,
    moves: z.array(noteMoveSchema),
    removed: z.array(hexIdSchema),
    restored: z.array(groupSchema),
  }),

  // In place of a change this browser may not read, while the notes are hidden: somebody else wrote, changed,
  // moved or deleted a note. It carries the change's number and how many notes are hidden from this browser now,
  // and nothing else: no id, no writer, no length, no place.
  z.object({ type: z.literal("wall.occupancy"), seq: z.int(), hidden: z.int().check(z.minimum(0)) }),
  // Revealing, first frame: the notes this browser did not have, in the order they were made. Each browser gets
  // its own.
  z.object({ type: z.literal("notes.revealed"), seq: z.int(), notes: z.array(noteSchema) }),
  // The wall is in another step from now on, and has reached `reach`. A move that reveals sends `notes.revealed`
  // first, and this with the next number. The clock of the step stops with every move (domain/flow.ts).
  // Into a step that votes it carries the step's vote (`round`: frozen options, budget, counted or not), how many
  // have voted in it, and the receiver's own ballot in it, if they voted there before the wall left the step: each
  // browser gets its own. No other ballot, no tally.
  z.object({
    type: z.literal("step.changed"),
    seq: z.int(),
    step: z.int().check(z.minimum(0)),
    reach: z.int().check(z.minimum(0)),
    round: z.optional(voteRoundSchema),
    voted: z.optional(z.int().check(z.minimum(0))),
    ballot: z.optional(z.nullable(ballotSchema)),
  }),
  // To every socket of the person who voted, before the `ack`: the ballot as stored, and how many have voted now.
  z.object({
    type: z.literal("ballot.stored"),
    seq: z.int(),
    step: z.int().check(z.minimum(0)),
    ballot: ballotSchema,
    voted: z.int().check(z.minimum(0)),
  }),
  // To everybody else, for the same change: how many have voted now. A number and nothing else, never a tally.
  z.object({
    type: z.literal("votes.count"),
    seq: z.int(),
    step: z.int().check(z.minimum(0)),
    voted: z.int().check(z.minimum(0)),
  }),
  // The moderation counted: the result, to everybody at once.
  z.object({ type: z.literal("results.published"), seq: z.int(), result: voteResultSchema }),
  // A control of the clock was taken. `serverNow` is the worker's clock when it was: the browser keeps the distance
  // to its own and counts from the clock's end.
  z.object({ type: z.literal("clock.changed"), seq: z.int(), clock: clockSchema, serverNow: z.number() }),
]);
export type ServerEvent = z.infer<typeof serverEventSchema>;

/** The events that tell of a stored change of the wall's content, as whoever may read it gets it: each carries the
 *  `seq` the change got. */
export type ContentEvent = Extract<
  ServerEvent,
  {
    type:
      | "note.created"
      | "note.updated"
      | "note.deleted"
      | "notes.moved"
      | "group.created"
      | "group.updated"
      | "group.deleted"
      | "arrange.applied"
      | "arrange.undone";
  }
>;

type WithoutSeq<Event> = Event extends unknown ? Omit<Event, "seq"> : never;

/** A stored change before it has its number: what the rules make of a command (domain/rules.ts). */
export type Change = WithoutSeq<ContentEvent>;

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** What a frame from a browser is. */
export type ClientFrame =
  | { kind: "command"; command: ClientCommand }
  /** It names an operation, but is no command the wall takes: refused under its `opId` (`INVALID`), so the browser
   *  that sent it can take back what it showed. */
  | { kind: "invalid"; opId: string }
  /** Nothing to answer to. */
  | { kind: "unreadable" };

const operationSchema = z.object({ type: z.string(), opId: hexIdSchema });

export function readClientFrame(raw: unknown): ClientFrame {
  const json = parseJson(raw);
  const parsed = clientCommandSchema.safeParse(json);
  if (parsed.success) return { kind: "command", command: parsed.data };
  const operation = operationSchema.safeParse(json);
  return operation.success ? { kind: "invalid", opId: operation.data.opId } : { kind: "unreadable" };
}

export function parseClientCommand(raw: unknown): ClientCommand | null {
  const frame = readClientFrame(raw);
  return frame.kind === "command" ? frame.command : null;
}

export function parseServerEvent(raw: unknown): ServerEvent | null {
  const parsed = serverEventSchema.safeParse(parseJson(raw));
  return parsed.success ? parsed.data : null;
}
