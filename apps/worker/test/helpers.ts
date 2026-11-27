// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { env, runInDurableObject, SELF } from "cloudflare:test";
import { expect } from "vitest";
import {
  generateHexId,
  generateSessionKey,
  parseServerEvent,
  type CreateWallResponse,
  type RejectCode,
  type ServerEvent,
} from "@ideabeam/shared";
import { wallStub } from "../src/wall-stub.js";

// The create route is rate limited per client IP. Real requests
// always carry cf-connecting-ip (Cloudflare sets it at the edge); SELF.fetch
// does not, so every test would otherwise share one bucket and the suite would
// throttle itself. Give each caller its own address — the limiter stays fully
// enforced, and a dedicated test hammers a single IP on purpose.
let ipCounter = 0;
export function freshIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 254}.${Math.floor(ipCounter / 254)}`;
}

export function ipHeaders(ip = freshIp()): Record<string, string> {
  return { "cf-connecting-ip": ip };
}

export function postWall(body: unknown, ip?: string): Promise<Response> {
  return SELF.fetch("https://example.com/api/walls", {
    method: "POST",
    headers: { "content-type": "application/json", ...ipHeaders(ip) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** A wall where everybody sees every note at once (`hidden: false`): the wall the tests of notes, groups and people
 *  are about. The route's own default is hidden writing: `createHiddenWall`. */
export async function createWall(question = "What should we build next?"): Promise<CreateWallResponse> {
  const response = await postWall({ question, hidden: false });
  expect(response.status).toBe(200);
  return (await response.json()) as CreateWallResponse;
}

/** A wall as the route makes it when nothing else is asked: it starts with hidden writing („Still sammeln“, in its
 *  writing step). */
export async function createHiddenWall(question = "What should we build next?"): Promise<CreateWallResponse> {
  const response = await postWall({ question });
  expect(response.status).toBe(200);
  return (await response.json()) as CreateWallResponse;
}

// What a `sync` says of where a wall stands (packages/shared, domain/flow.ts): in the hidden writing step of
// „Still sammeln“, revealed (its next step), or at the one step of „Freie Wand“, a wall made without hidden writing.
const STILL = { items: [{ methodId: "still-sammeln", version: 1 }] };
export const WRITING = { agenda: STILL, step: 0, reach: 0 };
export const REVEALED = { agenda: STILL, step: 1, reach: 1 };
export const FREE = { agenda: { items: [{ methodId: "free", version: 1 }] }, step: 0, reach: 0 };
/** Makes a wall what the builds before the methods stored (schema 3): its flow row in the old shape, with the phase
 *  in place of the step, the clock and the number it had; no agenda row. */
export function asSchemaThree(wallId: string, phase: "writing" | "open"): Promise<void> {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    const sql = state.storage.sql;
    const flow = JSON.parse(String(sql.exec("SELECT value FROM meta WHERE key = 'flow'").one().value)) as {
      clock: unknown;
      seq: number;
    };
    sql.exec("UPDATE meta SET value = '3' WHERE key = 'schemaVersion'");
    sql.exec(
      "UPDATE meta SET value = ? WHERE key = 'flow'",
      JSON.stringify({ phase, clock: flow.clock, seq: flow.seq }),
    );
    sql.exec("DELETE FROM meta WHERE key = 'agenda'");
  });
}

/** Revealing: the moderation's step move from the writing step to the one that shows the notes. */
export const REVEAL = { type: "admin.step.go", from: 0, to: 1 } as const;

export interface TestSocket {
  ws: WebSocket;
  events: ServerEvent[];
  /** Frames that are no events: the heartbeat's "pong". */
  other: string[];
  /** Every frame as it arrived, text for text: what a test of what leaves the wall has to read. */
  raw: string[];
  /** Whether the server closed the socket. */
  closed: () => boolean;
  /** Waits until an event matching the predicate has arrived, INCLUDING ones
   *  already in the log. The predicate receives the event's index so a caller
   *  can require a fresh one. Prefer `waitForNext` when the point is that
   *  something new arrives. */
  waitFor(predicate: (event: ServerEvent, index: number) => boolean): Promise<ServerEvent>;
  /** Like waitFor, but ignores everything already received. */
  waitForNext(predicate: (event: ServerEvent) => boolean): Promise<ServerEvent>;
  /** Waits for a frame that is no event. */
  waitForOther(text: string): Promise<void>;
  send(command: unknown): void;
  sendRaw(frame: string | ArrayBuffer): void;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Opens a socket to the wall. A wall that does not take it answers with its status instead. */
export async function upgrade(wallId: string): Promise<Response> {
  return SELF.fetch(`https://example.com/api/walls/${wallId}/ws`, { headers: { Upgrade: "websocket" } });
}

export async function connect(wallId: string): Promise<TestSocket> {
  const response = await upgrade(wallId);
  expect(response.status).toBe(101);
  const ws = response.webSocket;
  if (!ws) throw new Error("no websocket on 101 response");
  ws.accept();

  const events: ServerEvent[] = [];
  const other: string[] = [];
  const raw: string[] = [];
  let closed = false;
  ws.addEventListener("message", (event) => {
    raw.push(String(event.data));
    const parsed = parseServerEvent(event.data);
    if (parsed) events.push(parsed);
    else other.push(String(event.data));
  });
  ws.addEventListener("close", () => {
    closed = true;
  });

  async function until<T>(look: () => T | undefined, what: string): Promise<T> {
    const deadline = Date.now() + 2000;
    for (;;) {
      const found = look();
      if (found !== undefined) return found;
      if (Date.now() > deadline) {
        throw new Error(`timed out waiting for ${what}; saw: ${JSON.stringify(events)} and ${JSON.stringify(other)}`);
      }
      await pause(10);
    }
  }

  const socket: TestSocket = {
    ws,
    events,
    other,
    raw,
    closed: () => closed,
    waitFor: (predicate) => until(() => events.find((event, index) => predicate(event, index)), "an event"),
    waitForNext(predicate) {
      const from = events.length;
      return socket.waitFor((event, index) => index >= from && predicate(event));
    },
    async waitForOther(text) {
      await until(() => (other.includes(text) ? true : undefined), `the frame "${text}"`);
    },
    send(command) {
      ws.send(JSON.stringify(command));
    },
    sendRaw(frame) {
      ws.send(frame);
    },
  };
  return socket;
}

export type Sync = Extract<ServerEvent, { type: "sync" }>;

/** A person on the wall: a socket that has joined and got its first sync. */
export async function join(
  wallId: string,
  name: string,
  options: { sessionKey?: string; adminToken?: string } = {},
): Promise<{ socket: TestSocket; sync: Sync; you: string; sessionKey: string }> {
  const socket = await connect(wallId);
  const sessionKey = options.sessionKey ?? generateSessionKey();
  socket.send({
    type: "join",
    name,
    sessionKey,
    ...(options.adminToken === undefined ? {} : { adminToken: options.adminToken }),
  });
  const sync = (await socket.waitFor((event) => event.type === "sync")) as Sync;
  return { socket, sync, you: sync.you.participantId, sessionKey };
}

/** The wall as the server sees it now, asked through a socket that is on it. */
export async function resync(socket: TestSocket): Promise<Sync> {
  socket.send({ type: "resync" });
  return (await socket.waitForNext((event) => event.type === "sync")) as Sync;
}

/** Long enough for a frame that should NOT come to have come. */
export const settle = () => pause(60);

/** The wall's object, to look into its storage. */
export function stubOf(wallId: string) {
  const stub = wallStub(env, wallId);
  if (stub === null) throw new Error("the namespace did not take its own id");
  return stub;
}

/** Lowers what the wall may write on a UTC day (wall-room.ts, `dailyRows`), so that a test reaches the brake with a
 *  few changes. The number is the instance's: an eviction brings the real one back. */
export function setDailyRows(wallId: string, rows: number): Promise<void> {
  return runInDurableObject(stubOf(wallId), (instance) => {
    Reflect.set(instance, "dailyRows", rows);
  });
}

export type Answer = Extract<ServerEvent, { type: "ack" | "reject" }>;

/** Sends a command under a fresh opId and waits for the wall's word on it: the `ack` or the `reject`. */
export async function answer(socket: TestSocket, command: Record<string, unknown>): Promise<Answer> {
  const opId = generateHexId();
  socket.send({ ...command, opId });
  return (await socket.waitFor(
    (event) => (event.type === "ack" || event.type === "reject") && event.opId === opId,
  )) as Answer;
}

/** Like `answer`, in a word: "ack", or the code the command was refused with. */
export async function ask(socket: TestSocket, command: Record<string, unknown>): Promise<"ack" | RejectCode> {
  const said = await answer(socket, command);
  return said.type === "reject" ? said.code : "ack";
}
