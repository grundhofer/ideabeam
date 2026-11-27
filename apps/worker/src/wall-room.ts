// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DurableObject } from "cloudflare:workers";
import {
  agendaFor,
  countedRounds,
  decide,
  decideBallot,
  decideClock,
  decideCount,
  decideStep,
  displayNameKey,
  eventFor,
  exportFileName,
  hiddenChange,
  initialFlow,
  joinNotice,
  MAX_FRAME_BYTES,
  MAX_ONLINE,
  MAX_PARTICIPANTS,
  methodOfStep,
  notesFor,
  numbersOf,
  openRound,
  planJoin,
  PROTOCOL_VERSION,
  readClientFrame,
  readStoredFlow,
  revealedFor,
  roundOf,
  stepContext,
  tally,
  WALL_DAILY_ROWS,
  wallBrake,
  wallMarkdown,
  type AgendaRequest,
  type ArrangeLanguage,
  type ArrangeRecord,
  type Ballot,
  type BallotCommand,
  type ClientCommand,
  type ClockCommand,
  type ContentCommand,
  type ContentEvent,
  type CountCommand,
  type DayMark,
  type ErrorCode,
  type Flow,
  type Group,
  type Participant,
  type ParticipantRole,
  type Placement,
  type RejectCode,
  type ResolvedAgenda,
  type ServerEvent,
  type StepCommand,
  type StepContext,
  type StoredNote,
  type TitleSource,
  type VoteOption,
  type VoteResult,
  type VoteRound,
  type WallInfo,
  type WallReader,
} from "@ideabeam/shared";
import { generateSecret, safeEqual } from "./ids.js";

// A wall deletes itself this long after the last time somebody joined it (PLAN.md 3.3).
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
// The deadline moves at most once a day: every move is two rows written (the deadline and the alarm), and the
// free plan's limit that binds is rows written.
const RETENTION_STEP_MS = 24 * 60 * 60 * 1000;

interface SocketAttachment {
  participantId: string | null;
  /** Token bucket, carried in the attachment so it survives hibernation — the
   *  DO keeps no in-memory session state by design. `at` is the epoch-ms the
   *  bucket was last refilled. */
  budget?: { tokens: number; at: number };
  /** The number of the wall's last stored change, on every socket of a person who has joined (currentSeq()). */
  seq?: number;
  /** While the notes are hidden: how many notes the wall holds that are not this socket's person's, the number the
   *  next `wall.occupancy` moves on from (publish()). Like `seq` a copy of what the storage says, put right by
   *  every snapshot. */
  hidden?: number;
}

// Inbound WebSocket messages are billed at a 20:1 discount, but the free-tier allowance is account-wide and shared
// with RetroBeam and FokusBeam, so a runaway client spends everyone's budget. A person on a wall sends a frame
// when a note is written and when a drag ends, never while it lasts (PLAN.md 3.4); this bucket allows a burst of
// forty and two a second after it, which no person approaches and a loop hits at once.
const BUCKET_CAPACITY = 40;
const BUCKET_REFILL_PER_SEC = 2;
// `resync` is the one command whose answer is large relative to its frame — the whole wall — so it costs more.
const RESYNC_COST = 10;

// Raised with every change of what a wall stores; migrate() brings a wall of an older build up to it.
const SCHEMA_VERSION = 4;
// The oldest schema this build reads as it stands, without a row written: a wall of schema 3 has no agenda row and
// its flow row in the old shape, and both are read as they are (readFlow()). Its next step move or control of the
// clock writes them in the shape of schema 4 (writeFlow()).
const READS_AS_IS = 3;

// Every table is WITHOUT ROWID. A table with a rowid keeps its text key in a second tree: measured in workerd
// (2026-11-22, and by FokusBeam before), an insert is then two rows written, without it one. Rows written are the
// limit that binds (PLAN.md 3.6). For the same reason no table has an index beside its key, but one: a session key
// has to be a single person's.
//
// What a wall holds (PLAN.md 3.3). A note's row has the place the note was made at (x0, y0). Every place a note
// was moved to since, and the group it belongs to, stands in ONE row: layout 'pos', a JSON object
// { noteId: [x, y, groupId | null] }. So a movement is one row written, however many notes it moves.
//
// Every row carries `seq`: the number of the change that wrote it last (currentSeq()).
//
// An arrangement (PLAN.md 3.4) writes that row and a second one beside it: layout 'pos.prev', what the wall
// remembers of its last run so that the run can be taken back (`ArrangeRecord`, packages/shared, domain/arrange.ts):
// where every note the run moved lay before, the groups it made, the groups it took away. One row however many
// notes, written by the run and deleted when the run is taken back; the next run writes over it. A wall of an
// older build simply has no such row.
//
// Where the wall stands in its agenda, the step and the furthest one reached, and the clock of the step stand in ONE
// row of meta, 'flow' (`Flow`, packages/shared/src/domain/flow.ts), with the number of the change that wrote it
// last: a step move is one row written (revealing among them), and so is every control of the clock. The wall's
// agenda, the steps of its method copied at its creation (domain/agenda.ts), is the row 'agenda', written once. What
// the wall remembers about its day for the brake (packages/shared/src/domain/budget.ts) is the row 'day', written
// once a day.
//
// One statement per entry, each run by itself: a cursor counts the rows of its own statement, and the cost test
// counts every row a wall writes, its tables included.
const WALL_TABLES = [
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    demoted INTEGER NOT NULL DEFAULT 0,
    session_key TEXT NOT NULL UNIQUE,
    joined_at INTEGER NOT NULL
  ) WITHOUT ROWID`,
];
const CONTENT_TABLES = [
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    text TEXT NOT NULL,
    x0 INTEGER NOT NULL,
    y0 INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    seq INTEGER NOT NULL
  ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_source TEXT NOT NULL,
    locked INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    w INTEGER NOT NULL,
    h INTEGER NOT NULL,
    ord INTEGER NOT NULL,
    seq INTEGER NOT NULL
  ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS layout (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL,
    seq INTEGER NOT NULL
  ) WITHOUT ROWID`,
];

// The ballots of hidden votes (stage M2 of the methods, packages/shared/src/domain/vote.ts): one row a person and
// step, absolute, a second „Abgeben“ writes over the first. Who voted stands here and never leaves the object: what
// a browser gets of the table is its own ballot and how many rows a step has; the moderation's counting reads the
// ballots and stores one result (meta 'result:<step>'). The table is made with the first ballot a wall stores, in
// the same transaction, not with the wall: a wall that never votes does not pay for it, and a wall without it has
// no ballot (hasBallots()).
const BALLOT_TABLE = `CREATE TABLE IF NOT EXISTS ballots (
    step INTEGER NOT NULL,
    voter TEXT NOT NULL,
    ballot TEXT NOT NULL,
    seq INTEGER NOT NULL,
    PRIMARY KEY (step, voter)
  ) WITHOUT ROWID`;

const NOTE_COLUMNS = "id, author_id, text, x0, y0, created_at, updated_at, seq";
const GROUP_COLUMNS = "id, title, title_source, locked, x, y, w, h, ord, seq";

export interface WallCreation {
  wallId: string;
  question: string;
  adminToken: string;
  /** Whether the wall starts with hidden writing: without an agenda, „Still sammeln“, else „Freie Wand“. */
  hidden: boolean;
  /** The method the wall runs (domain/agenda.ts). */
  agenda?: AgendaRequest;
}

/** Where the wall stands, as it reads it: its flow, its agenda, and whether the agenda is the one its old phase
 *  stands for (a wall of schema 3 that has not changed its flow since: readStoredFlow()). */
interface FlowState {
  flow: Flow;
  agenda: ResolvedAgenda;
  legacy: boolean;
}

interface ParticipantRow {
  id: string;
  name: string;
  role: string;
  demoted: number;
}

interface NoteRow {
  id: string;
  author_id: string;
  text: string;
  x0: number;
  y0: number;
  created_at: number;
  updated_at: number;
  seq: number;
}

interface GroupRow {
  id: string;
  title: string;
  title_source: string;
  locked: number;
  x: number;
  y: number;
  w: number;
  h: number;
  ord: number;
  seq: number;
}

/** The value of layout 'pos': where every note lies that was moved since it was made, and its group or null. */
type Positions = Record<string, [x: number, y: number, groupId: string | null]>;

/** The wall as the rules ask about it for one person, and the positions the answers were read from: a command reads
 *  the one layout row at most once, and whoever stores its change writes that row from what was read. */
interface StoredWall extends WallReader {
  positions(): Positions;
}

/** What the Worker gets when it asks for the notes to arrange (`arrangeInput`). */
export type ArrangeNotes =
  /** Never made, or deleted. */
  | { kind: "missing" }
  /** Not the wall's admin token, or the step the wall is in does not arrange (the notes are still hidden). */
  | { kind: "refused"; code: "NOT_ADMIN" | "PHASE" }
  /** The wall's question and the notes that lie in no locked group: id and text, in the order they were made. */
  | { kind: "notes"; question: string; notes: Array<{ id: string; text: string }> };

/** What `exportFor` answers: no such wall, nobody on it under this session key, or the file. */
export type WallExport =
  /** Never made, or deleted. */
  | { kind: "missing" }
  /** The session key is nobody's on this wall: never joined, or had the wall forget them. */
  | { kind: "refused" }
  /** The wall as this person may see it, as Markdown, and the name to save it under. */
  | { kind: "markdown"; text: string; fileName: string };

type Sync = Extract<ServerEvent, { type: "sync" }>;

// One wall = one WallRoom, SQLite-backed, in the EU jurisdiction (wall-stub.ts).
//
// The rule every line of this class keeps: nothing lives in memory between two events. What a handler needs stands
// in SQLite or in a socket's attachment, so the object can hibernate after each event and bills for milliseconds,
// not for the hours a workshop lasts. No setTimeout, no setInterval, no ws.accept() (eslint.config.js refuses them),
// and no call out of the object: the AI is asked by the Worker, never from here (PLAN.md 4.3). Time is a stored
// deadline plus the one alarm.
//
// The second rule: a wall that does not exist stores nothing. The schema is written when the wall is made, not
// when the object wakes, and deleting a wall empties its storage entirely — so an old link to a deleted wall wakes
// an object that finds nothing, answers so, and is gone again, instead of leaving an empty database behind.
export class WallRoom extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  /** How many rows the wall writes on one UTC day before it refuses further changes: the shared rules' number. A
   *  field only so that a test can lower it; it is never written while the object runs. */
  private readonly dailyRows: number = WALL_DAILY_ROWS;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  // ───────────────────────── called by the Worker ─────────────────────────

  /** Makes the wall. Called once, by the route that minted this object's id. */
  async initialize(creation: WallCreation): Promise<void> {
    if (this.exists()) return;
    const now = Date.now();
    const retentionAt = now + RETENTION_MS;
    for (const table of [...WALL_TABLES, ...CONTENT_TABLES]) this.sql.exec(table);
    const agenda = agendaFor(creation);
    this.sql.exec(
      `INSERT INTO meta (key, value) VALUES
         ('id', ?), ('question', ?), ('adminToken', ?), ('createdAt', ?), ('schemaVersion', ?), ('retentionAt', ?),
         ('flow', ?), ('agenda', ?)`,
      creation.wallId,
      creation.question,
      creation.adminToken,
      String(now),
      String(SCHEMA_VERSION),
      String(retentionAt),
      JSON.stringify(initialFlow(agenda)),
      JSON.stringify(agenda),
    );
    await this.ctx.storage.setAlarm(retentionAt);
  }

  /** The wall's question for whoever holds its address, or null: never made, or deleted. */
  async info(): Promise<WallInfo | null> {
    if (!this.exists()) return null;
    this.migrate();
    return this.wallInfo();
  }

  /** The notes the AI may arrange, for the Worker's route (src/arrange.ts): the Worker asks the AI, this object
   *  never does, and this call does not wait for anything. Only for whoever holds the wall's admin token, only once
   *  the notes are revealed, and only the notes that lie in no locked group: a locked group is a person's, and
   *  arranging leaves it and its notes alone (PLAN.md 4.3). What leaves is a note's id and its text: not who wrote
   *  it, not where it lies. Reads, and writes nothing (a wall of an older build is brought up first, as at every
   *  visit). */
  async arrangeInput(adminToken: string): Promise<ArrangeNotes> {
    if (!this.exists()) return { kind: "missing" };
    this.migrate();
    const stored = this.getMeta("adminToken");
    if (stored === null || !safeEqual(adminToken, stored)) return { kind: "refused", code: "NOT_ADMIN" };
    if (!this.stepNow().can.arrange) return { kind: "refused", code: "PHASE" };
    const locked = new Set(
      this.sql
        .exec("SELECT id FROM groups WHERE locked = 1")
        .toArray()
        .map((row) => String(row.id)),
    );
    const { positions } = this.readPositions();
    const notes = this.sql
      .exec("SELECT id, text FROM notes ORDER BY created_at, id")
      .toArray()
      .map((row) => ({ id: String(row.id), text: String(row.text) }))
      .filter((note) => {
        const groupId = positions[note.id]?.[2] ?? null;
        return groupId === null || !locked.has(groupId);
      });
    return { kind: "notes", question: this.getMeta("question") ?? "", notes };
  }

  /** The wall as Markdown for the person behind a session key (PLAN.md 3.2, `GET /api/walls/:id/export`): through
   *  the same filter as their snapshot (`wallMarkdown` asks `notesFor`), so while the notes are hidden it holds their
   *  own and nobody else's. Only for somebody on the wall: the session key the browser joined with names them, and
   *  the wall's address alone gets nothing. Reads, and writes nothing: no row, no deadline, no count (a wall of an
   *  older build is brought up first, as at every visit). */
  async exportFor(sessionKey: string, language: ArrangeLanguage): Promise<WallExport> {
    if (!this.exists()) return { kind: "missing" };
    this.migrate();
    const row = this.sql.exec("SELECT id FROM participants WHERE session_key = ?", sessionKey).toArray()[0];
    if (row === undefined) return { kind: "refused" };
    const at = Date.now();
    const question = this.getMeta("question") ?? "";
    const content = this.readContent();
    const { flow, agenda } = this.readFlow();
    const text = wallMarkdown({
      question,
      methodId: methodOfStep(agenda, flow.step),
      sight: stepContext(agenda, flow).sight,
      notes: content.notes,
      groups: content.groups,
      // the counted votes' rankings, never a ballot
      results: this.readResults(flow.votes),
      viewer: String(row.id),
      at,
      language,
    });
    return { kind: "markdown", text, fileName: exportFileName(question, at) };
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json({ error: "EXPECTED_WEBSOCKET" }, { status: 426 });
    }
    if (!this.exists()) {
      return Response.json({ error: "WALL_NOT_FOUND" }, { status: 404 });
    }
    this.migrate();
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // Heartbeats are answered by the runtime without waking a hibernated object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ participantId: null } satisfies SocketAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ───────────────────────── the sockets ─────────────────────────

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string" || tooLarge(message)) {
      this.sendError(ws, "BAD_MESSAGE");
      return;
    }
    // The heartbeat, should the automatic answer ever not be in place: it never costs budget.
    if (message === "ping") {
      this.trySend(ws, "pong");
      return;
    }
    // Charged before the frame is read, so a flood of nonsense drains the bucket too.
    if (!this.spendBudget(ws, 1)) {
      this.sendError(ws, "RATE_LIMIT");
      return;
    }
    const frame = readClientFrame(message);
    if (frame.kind === "unreadable") {
      this.sendError(ws, "BAD_MESSAGE");
      return;
    }
    // The wall was deleted while this socket was open (or the frame raced the deletion).
    if (!this.exists()) {
      this.send(ws, { type: "wall.deleted" });
      this.close(ws, "wall deleted");
      return;
    }
    // It names an operation, but is no command the wall takes (a text too long, a place off the surface). A person
    // on the wall is told so under the operation's id: their browser takes back what it showed for it.
    if (frame.kind === "invalid") {
      if (this.participantForSocket(ws) === null) this.sendError(ws, "NOT_JOINED");
      else this.reject(ws, frame.opId, "INVALID");
      return;
    }
    const command = frame.command;

    if (command.type === "join") {
      await this.handleJoin(ws, command);
      return;
    }
    if (command.type === "leave") {
      this.close(ws, "left");
      return;
    }

    // Everything else requires a joined participant.
    const participant = this.participantForSocket(ws);
    if (participant === null) {
      this.sendError(ws, "NOT_JOINED");
      return;
    }
    switch (command.type) {
      case "resync":
        if (!this.spendBudget(ws, RESYNC_COST - 1)) {
          this.sendError(ws, "RATE_LIMIT");
          return;
        }
        this.sendSync(ws, participant.id);
        return;
      case "admin.wall.delete":
        if (participant.role !== "admin") {
          this.reject(ws, command.opId, "NOT_ADMIN");
          return;
        }
        this.ack(ws, command.opId, this.currentSeq());
        await this.destroy();
        return;
      case "me.erase":
        this.handleErase(ws, participant, command.opId);
        return;
      case "note.create":
      case "note.update":
      case "note.delete":
      case "notes.move":
      case "group.create":
      case "group.update":
      case "group.delete":
      case "admin.arrange.apply":
      case "admin.arrange.undo":
        this.handleContent(ws, participant, command);
        return;
      case "admin.step.go":
        this.handleStep(ws, participant, command);
        return;
      case "ballot.cast":
        this.handleBallot(ws, participant, command);
        return;
      case "admin.step.count":
        this.handleCount(ws, participant, command);
        return;
      case "admin.clock.start":
      case "admin.clock.pause":
      case "admin.clock.resume":
      case "admin.clock.extend":
      case "admin.clock.clear":
        this.handleClock(ws, participant, command);
        return;
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.handleDisconnect(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.handleDisconnect(ws);
  }

  /** Token bucket per socket, stored in the attachment so it survives
   *  hibernation. Returns false when the frame must be dropped. */
  private spendBudget(ws: WebSocket, cost: number): boolean {
    const attachment = readAttachment(ws);
    if (attachment === null) return true; // not ours to police
    const now = Date.now();
    const previous = attachment.budget ?? { tokens: BUCKET_CAPACITY, at: now };
    const refilled = Math.min(BUCKET_CAPACITY, previous.tokens + ((now - previous.at) / 1000) * BUCKET_REFILL_PER_SEC);
    const allowed = refilled >= cost;
    ws.serializeAttachment({
      ...attachment,
      budget: { tokens: allowed ? refilled - cost : refilled, at: now },
    } satisfies SocketAttachment);
    return allowed;
  }

  private async handleJoin(ws: WebSocket, command: Extract<ClientCommand, { type: "join" }>): Promise<void> {
    const now = Date.now();
    const row =
      (this.sql
        .exec("SELECT id, name, role, demoted FROM participants WHERE session_key = ?", command.sessionKey)
        .toArray()[0] as unknown as ParticipantRow | undefined) ?? null;

    // A socket is one person. A second join under another session key would leave the first person standing on
    // the wall with nobody behind them.
    const already = readAttachment(ws)?.participantId ?? null;
    if (already !== null && already !== row?.id) {
      this.sendError(ws, "BAD_MESSAGE");
      return;
    }

    const storedToken = this.getMeta("adminToken");
    const tokenMatches =
      command.adminToken !== undefined && storedToken !== null && safeEqual(command.adminToken, storedToken);
    // An admin who was demoted stays demoted: the token must not quietly promote its holder again.
    const isAdmin = tokenMatches && row?.demoted !== 1;

    const existing = row ? rowToParticipant(row, true) : null;
    const plan = planJoin({ requestedName: command.name, isAdmin, existing, newId: generateSecret() });
    const participant = plan.participant;

    // One name per wall: a name has to say who. Only a new person or a new name is checked, so somebody returning
    // under their own name is never locked out.
    if (
      (row === null || displayNameKey(row.name) !== displayNameKey(participant.name)) &&
      this.nameTaken(participant)
    ) {
      this.sendError(ws, "NAME_TAKEN");
      return;
    }

    // Read before this socket counts as the person's: whether they were here already decides what the others hear.
    const online = this.onlineIds();
    const wasOnline = online.has(participant.id);
    if (!wasOnline && online.size >= MAX_ONLINE) {
      this.sendError(ws, "WALL_FULL");
      return;
    }

    if (plan.isNew) {
      const known = Number(this.sql.exec("SELECT COUNT(*) AS n FROM participants").one().n);
      if (known >= MAX_PARTICIPANTS) {
        this.sendError(ws, "WALL_FULL");
        return;
      }
      this.sql.exec(
        "INSERT INTO participants (id, name, role, demoted, session_key, joined_at) VALUES (?, ?, ?, 0, ?, ?)",
        participant.id,
        participant.name,
        participant.role,
        command.sessionKey,
        now,
      );
    } else if (row !== null && (row.name !== participant.name || row.role !== participant.role)) {
      // A reconnect that changes nothing writes nothing.
      this.sql.exec(
        "UPDATE participants SET name = ?, role = ? WHERE id = ?",
        participant.name,
        participant.role,
        participant.id,
      );
    }

    ws.serializeAttachment({ ...readAttachment(ws), participantId: participant.id } satisfies SocketAttachment);
    this.sendSync(ws, participant.id);
    const notice = joinNotice({ before: existing, after: participant, wasOnline });
    if (notice !== null) this.broadcast(notice, ws);
    await this.keepWall(now);
  }

  private nameTaken(participant: Participant): boolean {
    const key = displayNameKey(participant.name);
    return this.sql
      .exec("SELECT id, name FROM participants")
      .toArray()
      .some((other) => String(other.id) !== participant.id && displayNameKey(String(other.name)) === key);
  }

  private handleDisconnect(closing: WebSocket): void {
    const participantId = readAttachment(closing)?.participantId ?? null;
    if (participantId === null || !this.exists()) return;
    const stillHere = this.ctx
      .getWebSockets()
      .some((ws) => ws !== closing && readAttachment(ws)?.participantId === participantId);
    if (stillHere) return; // another tab of the same person is still open
    this.broadcast({ type: "presence.leave", participantId }, closing);
  }

  /** „Meine Angaben löschen“: the wall forgets the person, their name, role and session key: one row. Their notes
   *  stay, without a name (the owner's decision K, PLAN.md 7.3): a note keeps the id of its author, which no longer
   *  names anybody, so the note is nobody's (`mine` for no one), nobody changes its text again and the moderation
   *  can still delete it. While the notes are hidden such a note stays hidden from everyone. Every socket of the
   *  person is told and closed, so no other tab of the same browser joins again by itself; the others see the
   *  person go. An admin may do it too: the token stays the wall's, and whoever holds it moderates again, as a new
   *  person. From FokusBeam's `handleErase`. */
  private handleErase(ws: WebSocket, participant: Participant, opId: string): void {
    this.sql.exec("DELETE FROM participants WHERE id = ?", participant.id);
    // no stored change of the wall's content: the frames about people carry no number
    this.ack(ws, opId, this.currentSeq());
    const frame = JSON.stringify({ type: "erased" } satisfies ServerEvent);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = readAttachment(socket);
      if (attachment?.participantId !== participant.id) continue;
      this.trySend(socket, frame);
      // nobody stands behind this socket any more: its close is no leaving
      socket.serializeAttachment({ ...attachment, participantId: null } satisfies SocketAttachment);
      this.close(socket, "erased");
    }
    this.broadcast({ type: "participant.removed", participantId: participant.id });
  }

  // ───────────────────────── notes, groups, places ─────────────────────────

  /** A command that changes what the wall holds. The rules decide (packages/shared/src/domain/rules.ts) from what
   *  this object reads for them and the step the wall is in; what they decide is stored under the next number and
   *  told to everyone who may read it (publish()). The sender hears the event like everyone else and its `ack` after
   *  it, so its browser never shows the wall without what it just did. Every command is safe to arrive twice: the
   *  second time the rules find its work done, and it is answered without a row written and without a frame to
   *  anyone else.
   *
   *  A change that would be stored is asked past the wall's brake first (packages/shared/src/domain/budget.ts): a
   *  wall that has written its day's rows refuses it, and says when the day turns. Asking reads one row; the
   *  first change of a UTC day writes that row, in the transaction of the change. */
  private handleContent(ws: WebSocket, participant: Participant, command: ContentCommand): void {
    const now = Date.now();
    const ctx = this.stepNow();
    const wall = this.reader(participant.id);
    const decision = decide(wall, command, participant, now, ctx);
    if (decision.kind === "refused") {
      this.reject(ws, command.opId, decision.code);
      return;
    }
    const seq = this.currentSeq();
    if (decision.kind === "unchanged") {
      this.ack(ws, command.opId, seq);
      return;
    }
    const brake = wallBrake(this.readDayMark(), seq, now, this.dailyRows);
    if (!brake.allowed) {
      this.send(ws, { type: "reject", opId: command.opId, code: "DAY_SPENT", resetsAt: brake.resetsAt });
      return;
    }
    // the next number; an arrangement takes as many as the rows it writes, and carries the last of them
    const event = { ...decision.change, seq: seq + numbersOf(decision.change) } as ContentEvent;
    this.store(event, wall, participant.id, brake.fresh ? brake.mark : null, decision.record);
    this.publish(event, participant.id, ctx);
    this.ack(ws, command.opId, event.seq);
  }

  /** The wall as the rules ask about it for one person: whether a note is theirs is answered here, from who wrote
   *  it. Each question is one look into the storage, and nothing is read that the command does not ask for: a
   *  note's text is changed without the positions being read, a note is moved without its text. */
  private reader(participantId: string): StoredWall {
    let read: Positions | null = null;
    const positions = (): Positions => (read ??= this.readPositions().positions);
    let arranged: ArrangeRecord | null | undefined;
    return {
      positions,
      note: (id) => {
        const row = this.sql.exec("SELECT author_id, text FROM notes WHERE id = ?", id).toArray()[0];
        return row === undefined ? null : { mine: String(row.author_id) === participantId, text: String(row.text) };
      },
      placement: (id) => {
        const row = this.sql.exec("SELECT author_id, x0, y0 FROM notes WHERE id = ?", id).toArray()[0];
        if (row === undefined) return null;
        return {
          ...placementOf(Number(row.x0), Number(row.y0), positions()[id]),
          mine: String(row.author_id) === participantId,
        };
      },
      group: (id) => {
        const row = this.sql.exec(`SELECT ${GROUP_COLUMNS} FROM groups WHERE id = ?`, id).toArray()[0];
        return row === undefined ? null : rowToGroup(row as unknown as GroupRow);
      },
      noteCount: () => Number(this.sql.exec("SELECT COUNT(*) AS n FROM notes").one().n),
      groupOrds: () =>
        this.sql
          .exec("SELECT ord FROM groups")
          .toArray()
          .map((row) => Number(row.ord)),
      groups: () => this.readGroups().groups,
      // a note has a group only in the layout row: a note that was never moved lies in none
      members: (groupId) =>
        Object.entries(positions())
          .filter(([, position]) => position[2] === groupId)
          .map(([noteId]) => noteId),
      arranged: () => (arranged === undefined ? (arranged = this.readArranged()) : arranged),
    };
  }

  /** Writes a change, with its number in the row it writes. One row for a note made or changed, for a group made
   *  or changed, and for a movement of any number of notes. Two for a delete: the row that goes, and the layout
   *  row, which loses the note's place (or the group, for the notes that were in it) and keeps the number: a
   *  deleted row cannot say when it was deleted. `by` is who made the change: a new note is theirs. `day` is the
   *  mark of a UTC day that begins with this change (the wall's brake), or null: one row more, once a day.
   *
   *  An arrangement writes one row for every group it makes and for every group it takes away, and two more
   *  however many notes it moves: the layout row, and beside it what the wall remembers of the run (`record`).
   *  Taking it back writes one row for every group that goes or comes back, the layout row, and the row of what
   *  was remembered, which goes. */
  private store(event: ContentEvent, wall: StoredWall, by: string, day: DayMark | null, record?: ArrangeRecord): void {
    // all of it or none: a delete never takes the row and leaves the place
    this.ctx.storage.transactionSync(() => {
      if (day !== null) this.setMeta("day", JSON.stringify(day));
      switch (event.type) {
        case "note.created": {
          const { note } = event;
          this.sql.exec(
            `INSERT INTO notes (${NOTE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            note.id,
            by,
            note.text,
            note.x,
            note.y,
            note.createdAt,
            note.updatedAt,
            event.seq,
          );
          return;
        }
        case "note.updated":
          this.sql.exec(
            "UPDATE notes SET text = ?, updated_at = ?, seq = ? WHERE id = ?",
            event.text,
            event.updatedAt,
            event.seq,
            event.noteId,
          );
          return;
        case "note.deleted": {
          const positions = wall.positions();
          delete positions[event.noteId];
          this.sql.exec("DELETE FROM notes WHERE id = ?", event.noteId);
          this.writePositions(positions, event.seq);
          return;
        }
        case "notes.moved": {
          const positions = wall.positions();
          for (const move of event.moves) positions[move.noteId] = [move.x, move.y, move.groupId];
          this.writePositions(positions, event.seq);
          return;
        }
        case "group.created":
        case "group.updated":
          this.writeGroup(event.group, event.seq);
          return;
        case "group.deleted": {
          // its notes stay where they lie, without a group
          const positions = wall.positions();
          for (const position of Object.values(positions)) {
            if (position[2] === event.groupId) position[2] = null;
          }
          this.sql.exec("DELETE FROM groups WHERE id = ?", event.groupId);
          this.writePositions(positions, event.seq);
          return;
        }
        case "arrange.applied":
        case "arrange.undone": {
          const positions = wall.positions();
          // a note that still lies in a group that goes stays where it lies, without a group
          const going = new Set(event.removed);
          for (const position of Object.values(positions)) {
            if (position[2] !== null && going.has(position[2])) position[2] = null;
          }
          for (const move of event.moves) positions[move.noteId] = [move.x, move.y, move.groupId];
          for (const groupId of event.removed) this.sql.exec("DELETE FROM groups WHERE id = ?", groupId);
          for (const group of event.type === "arrange.applied" ? event.groups : event.restored) {
            this.writeGroup(group, event.seq);
          }
          this.writePositions(positions, event.seq);
          if (event.type === "arrange.undone") this.sql.exec("DELETE FROM layout WHERE k = 'pos.prev'");
          else if (record !== undefined) this.writeLayout("pos.prev", JSON.stringify(record), event.seq);
          return;
        }
      }
    });
  }

  /** A group's row, made or written over, with the number of the change that wrote it. */
  private writeGroup(group: Group, seq: number): void {
    this.sql.exec(
      `INSERT INTO groups (${GROUP_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, title_source = excluded.title_source,
         locked = excluded.locked, x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h,
         seq = excluded.seq`,
      group.id,
      group.title,
      group.titleSource,
      group.locked ? 1 : 0,
      group.x,
      group.y,
      group.w,
      group.h,
      group.ord,
      seq,
    );
  }

  private readPositions(): { positions: Positions; seq: number } {
    const row = this.sql.exec("SELECT v, seq FROM layout WHERE k = 'pos'").toArray()[0];
    return row === undefined
      ? { positions: {}, seq: 0 }
      : { positions: JSON.parse(String(row.v)) as Positions, seq: Number(row.seq) };
  }

  private writePositions(positions: Positions, seq: number): void {
    this.writeLayout("pos", JSON.stringify(positions), seq);
  }

  private writeLayout(key: "pos" | "pos.prev", value: string, seq: number): void {
    this.sql.exec(
      `INSERT INTO layout (k, v, seq) VALUES (?, ?, ?)
       ON CONFLICT(k) DO UPDATE SET v = excluded.v, seq = excluded.seq`,
      key,
      value,
      seq,
    );
  }

  /** What the wall remembers of the run that arranged it last, or null: no run, or it was taken back. */
  private readArranged(): ArrangeRecord | null {
    const row = this.sql.exec("SELECT v FROM layout WHERE k = 'pos.prev'").toArray()[0];
    return row === undefined ? null : (JSON.parse(String(row.v)) as ArrangeRecord);
  }

  // `seq`, the number of the wall's last stored change (PLAN.md 3.4), without a counter that is written.
  //
  // RetroBeam keeps the number in a row of its own and writes it with every command: a second row for each, where
  // rows written are the limit that binds. Here the number costs none. Every row a change writes carries the
  // number of that change (notes, groups and the layout row have a `seq` column), so the wall's number is the
  // largest one stored. Looking for the largest reads every row, since `seq` is no key and an index on it would be
  // the second row again. So the number is also kept where a hibernating object may keep things beside its
  // storage: in the attachment of every socket of somebody who has joined. A change is stored, then noted on
  // every such socket while it is told (publish()). The next command reads it there: no row read, no row written.
  //
  // The storage stays the truth and the sockets a copy of it. A wall nobody is on has no socket: the next join
  // reads the number from the rows its snapshot reads anyway (readContent()), and every snapshot holds the copy
  // against those rows (buildSync()). A delete leaves no row behind that could carry its number, so it writes it
  // into the layout row (store()); a step move and the clock write theirs into the row they change ('flow'). With
  // that, the largest stored number is the wall's number at every moment, and it never runs backwards, whoever
  // comes or goes.

  /** The number of the wall's last stored change. */
  private currentSeq(): number {
    return this.carriedSeq() ?? this.storedSeq();
  }

  /** The wall's number as the sockets carry it, or null: no socket of a joined person carries one. */
  private carriedSeq(): number | null {
    let seq: number | null = null;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = readAttachment(ws);
      if ((attachment?.participantId ?? null) === null || typeof attachment?.seq !== "number") continue;
      seq = Math.max(seq ?? 0, attachment.seq);
    }
    return seq;
  }

  /** The wall's number as the storage has it. Reads every note and every group: the way without a socket, never
   *  the way of a command. */
  private storedSeq(): number {
    const row = this.sql
      .exec(
        `SELECT MAX(seq) AS seq FROM (
           SELECT seq FROM notes UNION ALL SELECT seq FROM groups UNION ALL SELECT seq FROM layout
         )`,
      )
      .one();
    return Math.max(Number(row.seq ?? 0), this.readFlow().flow.seq, this.ballotSeq());
  }

  // ───────────────────────── the step, the clock, the brake ─────────────────────────

  /** A step move (`admin.step.go`): the rules decide (packages/shared/src/domain/flow.ts), this stores the flow and
   *  tells everyone. One row written: the step, the furthest one reached, the clock stopped and the number of the
   *  change (and once, for a wall of schema 3, its agenda and schema beside it: writeFlow()). A move that shows the
   *  hidden notes is revealing: every browser gets the notes it did not have, each its own frame, and then the step.
   *  These are two frames with two numbers, so revealing takes two: a browser counts every frame it gets
   *  (packages/shared/src/domain/wall.ts), and none of them may stand for two. Any other move is one frame with one
   *  number. Going back hides nothing: what is seen follows the furthest step reached. Sent again, the command finds
   *  the wall in its step and changes nothing. The brake never refuses it.
   *
   *  Into a step that votes (stage M2), the first time: its options are frozen into the same row (`openRound`,
   *  packages/shared/src/domain/vote.ts), and the step's frame carries its vote, how many have voted in it and each
   *  person's own ballot in it, so every browser gets a frame of its own there. */
  private handleStep(ws: WebSocket, participant: Participant, command: StepCommand): void {
    const state = this.readFlow();
    const decision = decideStep(state.flow, state.agenda, command, participant);
    if (decision.kind === "refused") {
      this.reject(ws, command.opId, decision.code);
      return;
    }
    const seq = this.currentSeq();
    if (decision.kind === "unchanged") {
      this.ack(ws, command.opId, seq);
      return;
    }
    const changedSeq = decision.widens ? seq + 2 : seq + 1;
    // Into a step that votes for the first time: what may be chosen is frozen now, in the same row (stage M2).
    const to = decision.flow.step;
    const config = state.agenda.steps[to]?.vote;
    const content = decision.widens || decision.opens ? this.readContent() : null;
    let votes = state.flow.votes;
    if (decision.opens && config !== undefined && content !== null) {
      const sight = stepContext(state.agenda, decision.flow).sight;
      votes = [...(votes ?? []), openRound(to, config, content, sight === "all")];
    }
    this.writeFlow(state, { v: 2, ...decision.flow, seq: changedSeq, ...(votes === undefined ? {} : { votes }) });
    // A step that votes: every browser gets its vote, how many have voted in it, and its own ballot in it (one
    // voted there before the wall left the step). Nobody else's.
    const round = roundOf(votes, to);
    const ballots = round === null ? null : this.readBallots(to);
    const changedFor = new Map<string, string>();
    const changed = (viewer: string): string => {
      const key = ballots === null || !ballots.has(viewer) ? "" : viewer;
      let frame = changedFor.get(key);
      if (frame === undefined) {
        const event: ServerEvent = {
          type: "step.changed",
          seq: changedSeq,
          step: to,
          reach: decision.flow.reach,
          ...(round === null || ballots === null
            ? {}
            : { round, voted: ballots.size, ballot: ballots.get(viewer) ?? null }),
        };
        frame = JSON.stringify(event);
        changedFor.set(key, frame);
      }
      return frame;
    };
    if (!decision.widens || content === null) {
      this.deliver(changedSeq, (viewer) => ({ frames: [changed(viewer)] }));
      this.ack(ws, command.opId, changedSeq);
      return;
    }
    const { notes } = content;
    // one text per person, however many tabs they have open
    const revealed = new Map<string, string>();
    this.deliver(changedSeq, (viewer) => {
      let frame = revealed.get(viewer);
      if (frame === undefined) {
        const event: ServerEvent = { type: "notes.revealed", seq: seq + 1, notes: revealedFor(notes, viewer) };
        frame = JSON.stringify(event);
        revealed.set(viewer, frame);
      }
      return { frames: [frame, changed(viewer)], hidden: 0 };
    });
    this.ack(ws, command.opId, changedSeq);
  }

  /** A ballot (`ballot.cast`, stage M2): the rules decide (packages/shared/src/domain/vote.ts), this stores it and
   *  tells. One row written: the person's ballot of the step, with the number of the change; the first ballot of a
   *  wall makes the table beside it. Its sender's sockets get the ballot as stored and how many have voted now
   *  (`ballot.stored`), everybody else that number alone (`votes.count`): no ballot and no tally leaves for anybody
   *  else, the moderation included. The same ballot again writes nothing and tells nobody. A ballot is a change of
   *  the wall: the brake of the wall's day counts it and may refuse it. */
  private handleBallot(ws: WebSocket, participant: Participant, command: BallotCommand): void {
    const now = Date.now();
    const state = this.readFlow();
    const stored = this.readBallots(command.step, participant.id).get(participant.id) ?? null;
    const decision = decideBallot(state.flow, state.agenda.steps, command, stored);
    if (decision.kind === "refused") {
      this.reject(ws, command.opId, decision.code);
      return;
    }
    const seq = this.currentSeq();
    if (decision.kind === "unchanged") {
      this.ack(ws, command.opId, seq);
      return;
    }
    const brake = wallBrake(this.readDayMark(), seq, now, this.dailyRows);
    if (!brake.allowed) {
      this.send(ws, { type: "reject", opId: command.opId, code: "DAY_SPENT", resetsAt: brake.resetsAt });
      return;
    }
    const next = seq + 1;
    const fresh = !this.hasBallots();
    this.ctx.storage.transactionSync(() => {
      if (brake.fresh) this.setMeta("day", JSON.stringify(brake.mark));
      if (fresh) this.sql.exec(BALLOT_TABLE);
      this.sql.exec(
        `INSERT INTO ballots (step, voter, ballot, seq) VALUES (?, ?, ?, ?)
         ON CONFLICT(step, voter) DO UPDATE SET ballot = excluded.ballot, seq = excluded.seq`,
        command.step,
        participant.id,
        JSON.stringify(decision.ballot),
        next,
      );
    });
    const voted = this.votedIn(command.step);
    const own = JSON.stringify({
      type: "ballot.stored",
      seq: next,
      step: command.step,
      ballot: decision.ballot,
      voted,
    } satisfies ServerEvent);
    const count = JSON.stringify({ type: "votes.count", seq: next, step: command.step, voted } satisfies ServerEvent);
    this.deliver(next, (viewer) => ({ frames: [viewer === participant.id ? own : count] }));
    this.ack(ws, command.opId, next);
  }

  /** The moderation counts (`admin.step.count`, stage M2): the rules decide, `tally` counts the stored ballots, and
   *  the result goes to everybody at once (`results.published`). Two rows written: the result (meta
   *  'result:<step>', with the words of the options as they stand now) and the flow, in which the vote is counted
   *  from now on, with the number of the change. Sent again it finds the vote counted and changes nothing. As a
   *  step move, counting is never refused by the brake: a workshop is not stopped short of its result. */
  private handleCount(ws: WebSocket, participant: Participant, command: CountCommand): void {
    const state = this.readFlow();
    const decision = decideCount(state.flow, state.agenda.steps, command, participant);
    if (decision.kind === "refused") {
      this.reject(ws, command.opId, decision.code);
      return;
    }
    const seq = this.currentSeq();
    if (decision.kind === "unchanged") {
      this.ack(ws, command.opId, seq);
      return;
    }
    const { notes, groups } = this.readContent();
    const texts = new Map<string, string>([
      ...notes.map((note): [string, string] => [note.id, note.text]),
      ...groups.map((group): [string, string] => [group.id, group.title]),
    ]);
    const label = (option: VoteOption) => texts.get(option.id) ?? "";
    const ballots = [...this.readBallots(command.step).values()];
    const result = tally(decision.round, decision.config, ballots, label);
    const next = seq + 1;
    this.writeFlow(state, { ...state.flow, votes: countedRounds(state.flow.votes, command.step), seq: next }, () =>
      this.setMeta(`result:${command.step}`, JSON.stringify(result)),
    );
    const frame = JSON.stringify({ type: "results.published", seq: next, result } satisfies ServerEvent);
    this.deliver(next, () => ({ frames: [frame] }));
    this.ack(ws, command.opId, next);
  }

  /** Whether the wall has stored a ballot ever: the table is made with the first one. */
  private hasBallots(): boolean {
    return this.sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ballots'").toArray().length > 0;
  }

  /** The ballots of a step by who cast them; with `voter`, that person's alone. Never leaves the object as it is. */
  private readBallots(step: number, voter?: string): Map<string, Ballot> {
    const ballots = new Map<string, Ballot>();
    if (!this.hasBallots()) return ballots;
    const rows =
      voter === undefined
        ? this.sql.exec("SELECT voter, ballot FROM ballots WHERE step = ?", step).toArray()
        : this.sql.exec("SELECT voter, ballot FROM ballots WHERE step = ? AND voter = ?", step, voter).toArray();
    for (const row of rows) ballots.set(String(row.voter), JSON.parse(String(row.ballot)) as Ballot);
    return ballots;
  }

  /** How many people have voted in a step: a number, the one thing the others learn before counting. */
  private votedIn(step: number): number {
    if (!this.hasBallots()) return 0;
    return Number(this.sql.exec("SELECT COUNT(*) AS n FROM ballots WHERE step = ?", step).one().n);
  }

  /** The largest number a ballot's row carries (currentSeq()). */
  private ballotSeq(): number {
    if (!this.hasBallots()) return 0;
    return Number(this.sql.exec("SELECT MAX(seq) AS seq FROM ballots").one().seq ?? 0);
  }

  /** The results of the counted votes, in the order of their steps. */
  private readResults(rounds: readonly VoteRound[] | undefined): VoteResult[] {
    return (rounds ?? [])
      .filter((round) => round.counted)
      .sort((a, b) => a.step - b.step)
      .flatMap((round) => {
        const stored = this.getMeta(`result:${round.step}`);
        return stored === null ? [] : [JSON.parse(stored) as VoteResult];
      });
  }

  /** A control of the clock: the rules decide (packages/shared/src/domain/clock.ts), this stores the clock and
   *  tells everyone, with the worker's time. One row written. Nothing is armed: when the time is up, nothing happens
   *  here, and the object's one alarm stays the day the wall deletes itself. The brake never refuses a control. */
  private handleClock(ws: WebSocket, participant: Participant, command: ClockCommand): void {
    const now = Date.now();
    const state = this.readFlow();
    const decision = decideClock(state.flow.clock, command, participant, stepContext(state.agenda, state.flow), now);
    if (decision.kind === "refused") {
      this.reject(ws, command.opId, decision.code);
      return;
    }
    const seq = this.currentSeq() + 1;
    this.writeFlow(state, { ...state.flow, clock: decision.clock, seq });
    const frame = JSON.stringify({
      type: "clock.changed",
      seq,
      clock: decision.clock,
      serverNow: now,
    } satisfies ServerEvent);
    this.deliver(seq, () => ({ frames: [frame] }));
    this.ack(ws, command.opId, seq);
  }

  /** Where the wall stands in its agenda, and the agenda. A wall of schema 3 is read as it stands, and nothing is
   *  written: its old phase stands for a method (readStoredFlow(), packages/shared/src/domain/flow.ts). Every wall of
   *  this build has both rows (initialize(), migrate()); should the flow ever be missing, the wall hides rather than
   *  shows. Two rows read. */
  private readFlow(): FlowState {
    const flow = this.getMeta("flow");
    const agenda = this.getMeta("agenda");
    const stored = agenda === null ? null : (JSON.parse(agenda) as ResolvedAgenda);
    const read = readStoredFlow(flow === null ? null : JSON.parse(flow), stored);
    // without a stored agenda there is always the old phase's (readStoredFlow())
    return { flow: read.flow, agenda: read.legacy ?? (stored as ResolvedAgenda), legacy: read.legacy !== null };
  }

  /** What the step the wall is in allows, and what is seen of the others' notes. */
  private stepNow(): StepContext {
    const { flow, agenda } = this.readFlow();
    return stepContext(agenda, flow);
  }

  /** Writes the flow in the shape of now. A wall of schema 3 that has not changed its flow since writes, in the same
   *  transaction and once, the agenda its old phase stood for and its schema: from then on it is a wall of schema 4.
   *  Two rows more, once, for a wall that was made before the methods. `beside` writes in the same transaction:
   *  counting stores its result so. */
  private writeFlow(state: FlowState, flow: Flow, beside?: () => void): void {
    this.ctx.storage.transactionSync(() => {
      beside?.();
      this.setMeta("flow", JSON.stringify(flow));
      if (!state.legacy) return;
      this.setMeta("agenda", JSON.stringify(state.agenda));
      this.setMeta("schemaVersion", String(SCHEMA_VERSION));
    });
  }

  /** What the wall remembers about its day, or null: it has stored no change yet. */
  private readDayMark(): DayMark | null {
    const stored = this.getMeta("day");
    return stored === null ? null : (JSON.parse(stored) as DayMark);
  }

  /** How many notes the wall holds that are not this person's, as the storage has it. Reads every note: the way of
   *  a socket that carries no count, never the usual way of a command (publish()). */
  private hiddenFor(participantId: string): number {
    return Number(this.sql.exec("SELECT COUNT(*) AS n FROM notes WHERE author_id != ?", participantId).one().n);
  }

  // ───────────────────────── time ─────────────────────────

  // The object has exactly ONE alarm slot, and it holds the day the wall deletes itself (PLAN.md 3.2).
  override async alarm(): Promise<void> {
    if (!this.exists()) return;
    this.migrate();
    const retentionAt = Number(this.getMeta("retentionAt"));
    if (Date.now() >= retentionAt - 250) {
      await this.destroy(); // terminal: the storage is empty afterwards
      return;
    }
    // Woken early, or by an alarm set before the deadline moved: arm it again.
    await this.ctx.storage.setAlarm(retentionAt);
  }

  /** Somebody joined: the wall is in use, so its last day moves out, at most once a day. */
  private async keepWall(now: number): Promise<void> {
    const retentionAt = Number(this.getMeta("retentionAt"));
    if (retentionAt - now >= RETENTION_MS - RETENTION_STEP_MS) return;
    const next = now + RETENTION_MS;
    this.setMeta("retentionAt", String(next));
    await this.ctx.storage.setAlarm(next);
  }

  /** Tells everyone, closes every socket and empties the storage: nothing of the wall is left, and the object
   *  ceases to exist once it shuts down. Every entry point asks exists() first, so the instance that is still in
   *  memory never queries a table that is gone. */
  private async destroy(): Promise<void> {
    const frame = JSON.stringify({ type: "wall.deleted" } satisfies ServerEvent);
    for (const ws of this.ctx.getWebSockets()) {
      this.trySend(ws, frame);
      this.close(ws, "wall deleted");
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  // ───────────────────────── reading the wall ─────────────────────────

  /** Brings a wall that an older build made up to this build's tables. Asked where a visit begins (the wall's
   *  info, a new socket) and by the alarm: a deploy closes every socket, so nothing else reaches a wall first.
   *  From FokusBeam's `migrate`. */
  private migrate(): void {
    const from = Number(this.getMeta("schemaVersion") ?? "0");
    // 3 → 4: the agenda and the flow in its new shape (stage M1 of the methods). Nothing is written on a visit:
    // readFlow() reads a wall of schema 3 as it stands, and its next change of the flow writes the new shape
    // (writeFlow()). So a wall of schema 3 shows exactly what it showed, and a look at it costs no row.
    if (from >= READS_AS_IS) return;
    // all of it or none: a wall never stands between two schemas
    this.ctx.storage.transactionSync(() => {
      // 1 → 2: notes, groups and the layout (stage 2). The two tables of stage 1 stay as they were made.
      if (from < 2) for (const table of CONTENT_TABLES) this.sql.exec(table);
      // 2 → 3: the phase and the clock (stage 3). A wall from before the phases showed every note to everyone, and
      // people have read them: it is revealed, and stays as it was. No table changes: a note's row has always held
      // who wrote it, and what a browser gets of that is decided where the frame is built. Written in the shape of
      // schema 4 at once: a „Freie Wand“ at its one step, which is what such a wall was.
      if (from < 3) {
        this.setMeta("flow", JSON.stringify(initialFlow()));
        this.setMeta("agenda", JSON.stringify(agendaFor({ hidden: false })));
      }
      this.setMeta("schemaVersion", String(SCHEMA_VERSION));
    });
  }

  /** Whether the wall was made and not deleted. A wall that does not exist has no tables at all. */
  private exists(): boolean {
    const hasSchema =
      this.sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").toArray().length > 0;
    return hasSchema && this.getMeta("id") !== null;
  }

  private wallInfo(): WallInfo {
    return {
      id: this.getMeta("id") ?? "",
      question: this.getMeta("question") ?? "",
      createdAt: Number(this.getMeta("createdAt") ?? "0"),
    };
  }

  /** Sends the whole wall to a socket of somebody who has joined. From here on the socket carries the wall's
   *  number like every other one (currentSeq()), and how many notes are hidden from its person (publish()). */
  private sendSync(ws: WebSocket, participantId: string): void {
    const sync = this.buildSync(participantId);
    ws.serializeAttachment({
      ...readAttachment(ws),
      participantId,
      seq: sync.seq,
      hidden: sync.hidden,
    } satisfies SocketAttachment);
    this.send(ws, sync);
  }

  /** The whole wall for one person. Built per person, and the one place a snapshot is built: what this person may
   *  read of the notes is decided by the shared rules (`notesFor`), as publish() has them decide it for an event.
   *  Stored notes leave the object through these two, through revealing (handleStep()) and through the export
   *  (exportFor(), which asks the same rule), nowhere else. */
  private buildSync(participantId: string): Sync {
    const { flow, agenda } = this.readFlow();
    const content = this.readContent();
    const view = notesFor(content.notes, stepContext(agenda, flow).sight, participantId);
    // a step that votes: one's own ballot in it and how many have voted, never anybody else's ballot; and the
    // results of what is counted
    const round = roundOf(flow.votes, flow.step);
    return {
      type: "sync",
      protocolVersion: PROTOCOL_VERSION,
      serverNow: Date.now(),
      wall: this.wallInfo(),
      participants: this.roster(),
      you: { participantId },
      // A snapshot reads every row anyway, so it knows the number as the storage has it and takes the larger of
      // the two: sockets and storage agree, and where they ever did not, the snapshot puts it right.
      seq: Math.max(this.carriedSeq() ?? 0, content.seq, flow.seq, this.ballotSeq()),
      agenda,
      step: flow.step,
      reach: flow.reach,
      hidden: view.hidden,
      clock: flow.clock,
      notes: view.notes,
      groups: content.groups,
      arrangeRun: this.readArranged()?.runId ?? null,
      votes: flow.votes ?? [],
      ballot: round === null ? null : (this.readBallots(flow.step, participantId).get(participantId) ?? null),
      voted: round === null ? 0 : this.votedIn(flow.step),
      results: this.readResults(flow.votes),
    };
  }

  /** Everything the wall holds, each note with who wrote it and at the place it lies now, and the largest number a
   *  row of the content carries. What of it a person gets is not decided here. */
  private readContent(): { notes: StoredNote[]; groups: Group[]; seq: number } {
    const layout = this.readPositions();
    let seq = layout.seq;
    const notes = this.sql
      .exec(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY created_at, id`)
      .toArray()
      .map((found): StoredNote => {
        const row = found as unknown as NoteRow;
        seq = Math.max(seq, Number(row.seq));
        return {
          id: String(row.id),
          authorId: String(row.author_id),
          text: String(row.text),
          ...placementOf(Number(row.x0), Number(row.y0), layout.positions[String(row.id)]),
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
        };
      });
    const groups = this.readGroups();
    return { notes, groups: groups.groups, seq: Math.max(seq, groups.seq) };
  }

  /** Every group of the wall, in the order of the list, and the largest number a group's row carries. */
  private readGroups(): { groups: Group[]; seq: number } {
    let seq = 0;
    const groups = this.sql
      .exec(`SELECT ${GROUP_COLUMNS} FROM groups ORDER BY ord, id`)
      .toArray()
      .map((found) => {
        const row = found as unknown as GroupRow;
        seq = Math.max(seq, Number(row.seq));
        return rowToGroup(row);
      });
    return { groups, seq };
  }

  /** Who is here is read from the open sockets, never written: presence costs no row. */
  private onlineIds(): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const participantId = readAttachment(ws)?.participantId ?? null;
      if (participantId !== null) ids.add(participantId);
    }
    return ids;
  }

  private roster(): Participant[] {
    const online = this.onlineIds();
    return this.sql
      .exec("SELECT id, name, role, demoted FROM participants ORDER BY joined_at, id")
      .toArray()
      .map((row) => rowToParticipant(row as unknown as ParticipantRow, online.has(String(row.id))));
  }

  private participantForSocket(ws: WebSocket): Participant | null {
    const participantId = readAttachment(ws)?.participantId ?? null;
    if (participantId === null) return null;
    const row = this.sql
      .exec("SELECT id, name, role, demoted FROM participants WHERE id = ?", participantId)
      .toArray()[0] as unknown as ParticipantRow | undefined;
    return row ? rowToParticipant(row, true) : null;
  }

  private getMeta(key: string): string | null {
    const row = this.sql.exec("SELECT value FROM meta WHERE key = ?", key).toArray()[0];
    return row ? String(row.value) : null;
  }

  private setMeta(key: string, value: string): void {
    this.sql.exec(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  }

  // ───────────────────────── sending ─────────────────────────

  private send(ws: WebSocket, event: ServerEvent): void {
    this.trySend(ws, JSON.stringify(event));
  }

  private sendError(ws: WebSocket, code: ErrorCode): void {
    this.send(ws, { type: "error", code });
  }

  private ack(ws: WebSocket, opId: string, seq: number): void {
    this.send(ws, { type: "ack", opId, seq });
  }

  private reject(ws: WebSocket, opId: string, code: RejectCode): void {
    this.send(ws, { type: "reject", opId, code });
  }

  /** Tells everyone on the wall of a stored change of its content. The one way such a change leaves the object:
   *  what each person hears of it is decided by the shared rules (`eventFor`), per socket, as buildSync() has them
   *  decide it for a snapshot. `event` is the change as `by`, who made it, gets it.
   *
   *  While the notes are hidden, everybody but `by` hears the change's number and how many notes are hidden from
   *  them now. That count is carried on the socket and moved on by the change, so telling it reads no row; a socket
   *  that carries none gets it from the storage. */
  private publish(event: ContentEvent, by: string, ctx: StepContext): void {
    // one text per distinct frame: whoever made the change, everybody else, and each count
    const texts = new Map<string, string>();
    const text = (key: string, viewer: string, hidden: number): string => {
      let frame = texts.get(key);
      if (frame === undefined) {
        frame = JSON.stringify(eventFor(event, by, viewer, ctx.sight, hidden));
        texts.set(key, frame);
      }
      return frame;
    };
    const moved = hiddenChange(event);
    this.deliver(event.seq, (viewer, attachment) => {
      if (viewer === by) return { frames: [text("by", viewer, 0)] };
      if (ctx.sight === "all") return { frames: [text("others", viewer, 0)] };
      // never below none: a count is a frame every browser has to be able to read
      const hidden = attachment.hidden === undefined ? this.hiddenFor(viewer) : Math.max(0, attachment.hidden + moved);
      return { frames: [text(`hidden ${hidden}`, viewer, hidden)], hidden };
    });
  }

  /** Sends every socket of a joined person the frames `frames` gives for it, and notes on it the wall's number
   *  after them (currentSeq()) and, where `frames` says one, the count of the notes hidden from its person. Every
   *  frame that carries a number goes out through here, so no socket ever misses one. */
  private deliver(
    seq: number,
    frames: (participantId: string, attachment: SocketAttachment) => { frames: string[]; hidden?: number },
  ): void {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = readAttachment(ws);
      const participantId = attachment?.participantId ?? null;
      if (attachment === null || participantId === null) continue;
      const out = frames(participantId, attachment);
      try {
        ws.serializeAttachment({
          ...attachment,
          seq,
          ...(out.hidden === undefined ? {} : { hidden: out.hidden }),
        } satisfies SocketAttachment);
      } catch {
        // already closed: it sends no command any more, and every other socket has the number
      }
      for (const frame of out.frames) this.trySend(ws, frame);
    }
  }

  /** To everyone who has joined, except `exclude`. */
  private broadcast(event: ServerEvent, exclude?: WebSocket): void {
    const frame = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude || (readAttachment(ws)?.participantId ?? null) === null) continue;
      this.trySend(ws, frame);
    }
  }

  // A socket can die between getWebSockets() and send() — one dead socket
  // must not stop the others from hearing.
  private trySend(ws: WebSocket, frame: string): void {
    try {
      ws.send(frame);
    } catch {
      // already closed
    }
  }

  private close(ws: WebSocket, reason: string): void {
    try {
      ws.close(1000, reason);
    } catch {
      // already closing
    }
  }
}

function rowToParticipant(row: ParticipantRow, online: boolean): Participant {
  return {
    id: String(row.id),
    name: String(row.name),
    role: String(row.role) as ParticipantRole,
    online,
  };
}

function rowToGroup(row: GroupRow): Group {
  return {
    id: String(row.id),
    title: String(row.title),
    titleSource: String(row.title_source) as TitleSource,
    locked: Number(row.locked) === 1,
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.w),
    h: Number(row.h),
    ord: Number(row.ord),
  };
}

/** Where a note lies: where it was moved to last, or where it was made, in no group. */
function placementOf(x0: number, y0: number, moved: Positions[string] | undefined): Placement {
  return moved === undefined ? { x: x0, y: y0, groupId: null } : { x: moved[0], y: moved[1], groupId: moved[2] };
}

function readAttachment(ws: WebSocket): SocketAttachment | null {
  const attachment: unknown = ws.deserializeAttachment();
  if (attachment === null || typeof attachment !== "object") return null;
  return attachment as SocketAttachment;
}

/** Whether a text frame is larger than the protocol allows, measured as it travels: in UTF-8 bytes. The cap exists
 *  to refuse absurd frames before paying for JSON.parse, so the look is cheap: a string's length bounds its bytes
 *  from both sides (a UTF-16 code unit becomes one to three), and only a frame between the bounds is encoded. */
function tooLarge(frame: string): boolean {
  if (frame.length > MAX_FRAME_BYTES) return true;
  if (frame.length * 3 <= MAX_FRAME_BYTES) return false;
  return new TextEncoder().encode(frame).byteLength > MAX_FRAME_BYTES;
}
