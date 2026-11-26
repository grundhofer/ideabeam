// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the tests of arranging share: an AI that is the test's, the route called with it, and a look into the counter
// of the AI's budget.
//
// No test reaches Cloudflare's AI. The pool runs without remote bindings (vitest.config.ts), so the binding `AI` of
// the test environment could only throw; and the route is not asked through `SELF` here but through the Worker's
// own `fetch` with an environment in which `AI` is the object below, or one that fails. That is the seam: the route
// takes its model from `env.AI` (src/arrange.ts), and a test hands in what answers.

import { env, runInDurableObject } from "cloudflare:test";
import { expect } from "vitest";
import { layoutProposal } from "@ideabeam/arrange";
import {
  arrangeResponseSchema,
  generateHexId,
  type ArrangeDay,
  type ArrangeResponse,
  type ArrangeWindow,
  type Proposal,
} from "@ideabeam/shared";
import worker from "../src/index.js";
import { wallKey } from "../src/arrange.js";
import { limiterStub } from "../src/wall-stub.js";
import { ask, stubOf, type Sync, type TestSocket } from "./helpers.js";

/** One call to the AI as the route made it: the model, and the request as Workers AI would get it. */
export interface AiCall {
  model: string;
  input: {
    messages: Array<{ role: string; content: string }>;
    response_format: { type: string; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
    [field: string]: unknown;
  };
  /** Which step of the run the call is: read from the schema it asks for, as a model's service would see it. */
  step: "themes" | "assign";
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

/** What a scripted AI says to a call: the text of its answer, or an Error to throw; at once, or when the promise
 *  the script hands back is over (a model that is slow). One that never answers hands back a promise that stays
 *  open. */
export type AiScript = (call: AiCall, nth: number) => string | Error | Promise<string | Error>;

/** The letters an assignment call allows, one for each theme it lists, and the numbers of its notes. */
export function assignmentOf(call: AiCall): { keys: string[]; letters: string[] } {
  const properties = (call.schema.properties ?? {}) as Record<string, { enum?: string[] }>;
  const keys = Object.keys(properties);
  return { keys, letters: properties[keys[0] ?? ""]?.enum ?? [] };
}

/** The notes of a call as its prompt lists them: the text after each number. */
export function notesIn(call: AiCall): string[] {
  const heading = call.step === "assign" ? "Sticky notes:\n" : "sticky notes from the board:\n";
  const block = call.user.slice(call.user.indexOf(heading) + heading.length).split("\n\n")[0] ?? "";
  return block.split("\n").map((line) => line.replace(/^\d+\. /u, ""));
}

export const themesAnswer = (titles: string[]) =>
  JSON.stringify({ themes: titles.map((title) => ({ title, description: `Everything about ${title}.` })) });

/** A model that behaves: `themes` titles, and every note of a batch to a theme in turn, by the theme's letter. */
export function wellBehaved(titles = ["Meetings", "Tools", "People", "Planning"]): AiScript {
  return (call) => {
    if (call.step !== "assign") return themesAnswer(titles);
    const { keys, letters } = assignmentOf(call);
    return JSON.stringify(Object.fromEntries(keys.map((key, n) => [key, letters[n % letters.length]])));
  };
}

/** An AI for the route: answers from the script in the shape Workers AI answers the measured models in, and keeps
 *  every call it got. */
export function scriptedAi(script: AiScript = wellBehaved(), usage: Record<string, number> | null = null) {
  const calls: AiCall[] = [];
  const binding = {
    async run(model: string, input: AiCall["input"]): Promise<unknown> {
      const schema = input.response_format.json_schema.schema;
      const user = input.messages[1]?.content ?? "";
      const step = "themes" in ((schema.properties ?? {}) as object) ? "themes" : "assign";
      const call: AiCall = { model, input, step, system: input.messages[0]?.content ?? "", user, schema };
      const nth = calls.filter((earlier) => earlier.step === step).length;
      calls.push(call);
      const answer = await script(call, nth);
      if (answer instanceof Error) throw answer;
      return {
        id: "chatcmpl-test",
        object: "chat.completion",
        model,
        choices: [{ index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" }],
        usage: usage ?? { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 },
      };
    },
  };
  return { binding, calls, steps: () => calls.map((call) => call.step) };
}

export interface RouteOptions {
  /** The AI the route asks. None: one that fails when it is called. Never the test environment's own binding. */
  ai?: { binding: unknown };
  /** Variables of the deployment, over the test environment's. */
  vars?: Partial<Record<"DAILY_NEURONS" | "ARRANGE_MODEL" | "ARRANGE_FAKE", string>>;
  /** The request's body. Left out: `{ language: "de" }`. */
  body?: unknown;
  /** The request's headers, in place of the admin token's. */
  headers?: Record<string, string>;
}

/** `POST /api/walls/:id/arrange`, through the Worker's own `fetch`. */
export function arrangeRoute(wallId: string, adminToken: string | null, options: RouteOptions = {}): Promise<Response> {
  const body = "body" in options ? options.body : { language: "de" };
  const request = new Request(`https://example.com/api/walls/${wallId}/arrange`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? (adminToken === null ? {} : { authorization: `Bearer ${adminToken}` })),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const none = { run: () => Promise.reject(new Error("the test handed in no AI")) };
  const bindings = { ...env, ...options.vars, AI: options.ai === undefined ? none : options.ai.binding };
  return Promise.resolve(worker.fetch(request, bindings as Env));
}

/** The route's answer when it is a proposal. */
export async function proposed(response: Response): Promise<ArrangeResponse> {
  const body: unknown = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(200);
  return arrangeResponseSchema.parse(body);
}

/** What the counter of the AI's budget has stored, or null: the neurons of the last 24 hours in their slots, and
 *  when each wall was arranged. */
export function arrangeCount(): Promise<ArrangeWindow | null> {
  return runInDurableObject(limiterStub(env), (_instance, state) => {
    const row = state.storage.sql.exec("SELECT value FROM arrange_budget WHERE key = 'day'").toArray()[0];
    return row === undefined ? null : (JSON.parse(String(row.value)) as ArrangeWindow);
  });
}

/** Sets what the counter has stored: a count, the count of a UTC day as the build before this one stored it, or
 *  nothing. The counter is one object for a whole test file. */
export function setArrangeCount(count: ArrangeWindow | ArrangeDay | null): Promise<void> {
  return runInDurableObject(limiterStub(env), (_instance, state) => {
    state.storage.sql.exec("DELETE FROM arrange_budget");
    if (count !== null) {
      state.storage.sql.exec("INSERT INTO arrange_budget (key, value) VALUES ('day', ?)", JSON.stringify(count));
    }
  });
}

/** The neurons a count holds: the sum of its slots. */
export const neuronsOf = (count: ArrangeWindow | null): number =>
  Math.round((count?.slots ?? []).reduce((sum, [, neurons]) => sum + neurons, 0) * 100) / 100;

/** How many runs the counter has for a wall. */
export async function runsOf(wallId: string): Promise<number> {
  return (await arrangeCount())?.runs[await wallKey(wallId)]?.length ?? 0;
}

/** Every socket of the wall may send again as if minutes had passed: a test writes faster than a person. */
export function refill(wallId: string): Promise<void> {
  return runInDurableObject(stubOf(wallId), (_instance, state) => {
    for (const ws of state.getWebSockets()) {
      const attachment = { ...(ws.deserializeAttachment() as { budget?: unknown }) };
      delete attachment.budget;
      ws.serializeAttachment(attachment);
    }
  });
}

/** Writes notes with these texts as the person behind the socket, each at a place of its own, and returns their
 *  ids in the order of the texts. More than a socket's burst of frames: `refill` between the parts. */
export async function writeNotes(socket: TestSocket, texts: string[], from = 0): Promise<string[]> {
  const ids: string[] = [];
  for (const [n, text] of texts.entries()) {
    const noteId = generateHexId();
    ids.push(noteId);
    const at = from + n;
    expect(await ask(socket, { type: "note.create", noteId, text, x: at * 13 - 400, y: at * -7 + 90 })).toBe("ack");
    // The wall lists its notes by the moment they were made, and by their ids within one millisecond: the next
    // note is made a millisecond later, so the notes stand in the order of the texts.
    const acked = Date.now();
    while (Date.now() <= acked) await new Promise((resolve) => setTimeout(resolve, 1));
  }
  return ids;
}

/** The command that applies a proposal to the wall as a snapshot shows it: the layout the product's browser would
 *  work out, under groups with new ids. What stays where it is (the locked groups) is kept clear. */
export function applyOf(proposal: Proposal, wall: Sync, source = "service") {
  const locked = wall.groups.filter((group) => group.locked);
  const { groups, moves } = layoutProposal({
    proposal,
    texts: new Map(wall.notes.map((note) => [note.id, note.text])),
    groupIds: proposal.groups.map(() => generateHexId()),
    keep: locked.map(({ x, y, w, h }) => ({ x, y, w, h })),
  });
  return { type: "admin.arrange.apply", opId: generateHexId(), source, groups, moves };
}

/** Sends a command under the `opId` it carries and waits for the wall's word on it: "ack", or the code it was
 *  refused with. (`ask` of helpers.ts mints an `opId` of its own; an arrangement's `opId` is its run's name.) */
export async function said(socket: TestSocket, command: { opId: string }): Promise<string> {
  socket.send(command);
  const answer = await socket.waitFor(
    (event) => (event.type === "ack" || event.type === "reject") && event.opId === command.opId,
  );
  return answer.type === "reject" ? answer.code : "ack";
}
