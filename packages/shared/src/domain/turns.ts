// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as z from "zod/mini";
import type { RejectCode } from "../protocol.js";

// Revealing by turn (stage M5, PLAN-METHODEN.md 5, docs/architektur-methoden.md 2): „Stille Ideenrunde mit
// Rangfolge“ and „Scheitern vorwegdenken“ show the notes written in private one at a time, as a round of the table
// would: everybody's first note, then everybody's second, and so on, without a name. A step of type `reveal` with
// `turns` (domain/method.ts) does it.
//
// When the wall enters such a step for the first time the order is frozen into its flow (`TurnRound`): the notes
// that nobody but their writer sees then, interleaved by writer, the writers in an order drawn at random from a seed
// of the platform's random source, so the first note is nobody's in particular. The order is note ids, and an id is
// never told while its note is hidden: the order never leaves the worker. What a browser learns is how many notes
// are shown and how many are left (`TurnView`). The moderation's „Nächster Zettel“ (`admin.turn.next`) shows the next
// one: one row written, the flow. Reaching the step shows nothing by itself (domain/agenda.ts, `noteLevel`); the
// next step that shows everything shows the rest.
//
// Nothing is written or deleted in the step (domain/agenda.ts, `capabilities`): a note more or fewer would shift the
// order. A note that is gone all the same (deleted in an earlier step the moderation went back to) is passed over.

/** A step's order of revealing, as the wall's flow holds it from the moment the wall entered the step. Never sent. */
export interface TurnRound {
  /** The step that reveals by turn. */
  step: number;
  /** The notes in the order they are shown: ids, so the order never leaves the worker. */
  order: string[];
  /** How many of `order` are shown, gone ones passed over included. */
  shown: number;
}

/** What a browser is told of a step that reveals by turn: how many notes are shown, and how many are left. */
export const turnViewSchema = z.object({
  step: z.int().check(z.minimum(0)),
  shown: z.int().check(z.minimum(0)),
  left: z.int().check(z.minimum(0)),
});
export type TurnView = z.infer<typeof turnViewSchema>;

/** A random number from a seed, the same sequence for the same seed (mulberry32), as teams are formed. */
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

/** The order in which notes are shown by turn: one note of each writer, then the second of each, and so on; each
 *  writer's notes in the order they were made, the writers in an order drawn from `seed`. Pure: the same notes and
 *  seed give the same order. */
export function revealOrder(
  notes: ReadonlyArray<{ id: string; authorId: string; createdAt: number }>,
  seed: number,
): string[] {
  const byWriter = new Map<string, Array<{ id: string; createdAt: number }>>();
  for (const note of notes) byWriter.set(note.authorId, [...(byWriter.get(note.authorId) ?? []), note]);
  const writers = [...byWriter.keys()].sort();
  const next = random(seed);
  // Fisher–Yates
  for (let at = writers.length - 1; at > 0; at -= 1) {
    const other = Math.floor(next() * (at + 1));
    [writers[at], writers[other]] = [writers[other] as string, writers[at] as string];
  }
  const lists = writers.map((writer) =>
    [...(byWriter.get(writer) ?? [])].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)),
  );
  const order: string[] = [];
  for (let turn = 0; lists.some((list) => turn < list.length); turn += 1) {
    for (const list of lists) {
      const note = list[turn];
      if (note !== undefined) order.push(note.id);
    }
  }
  return order;
}

/** The round of a step, from a flow's rounds, or null: the wall has not entered it. */
export function turnRoundOf(rounds: readonly TurnRound[] | undefined, step: number): TurnRound | null {
  return rounds?.find((round) => round.step === step) ?? null;
}

/** Every note shown by turn so far, in any step. */
export function shownByTurn(rounds: readonly TurnRound[] | undefined): Set<string> {
  const shown = new Set<string>();
  for (const round of rounds ?? []) for (const id of round.order.slice(0, round.shown)) shown.add(id);
  return shown;
}

/** What a browser is told of a round: shown and left, of the notes that are still there. */
export function turnViewOf(round: TurnRound, exists: (id: string) => boolean): TurnView {
  const shown = round.order.slice(0, round.shown).filter(exists).length;
  const left = round.order.slice(round.shown).filter(exists).length;
  return { step: round.step, shown, left };
}

export type TurnDecision =
  | { kind: "refused"; code: RejectCode }
  /** Shown already: the command sent a second time, or none is left. */
  | { kind: "unchanged" }
  /** The round after it, and the note it shows. */
  | { kind: "changed"; round: TurnRound; noteId: string };

/** What the moderation's „Nächster Zettel“ (`admin.turn.next`) makes of a round: the moderation's alone
 *  (`NOT_ADMIN`), in the step the wall is in (`STALE` for one it has left), in a step that reveals by turn (`PHASE`).
 *  `shown` is how many the browser knew to be shown when it was pressed: sent a second time, the wall has shown more
 *  already, and nothing changes. The next note that is still there is shown; gone ones are passed over. */
export function decideTurn(
  flow: { step: number; turns?: readonly TurnRound[] | undefined },
  steps: ReadonlyArray<{ turns?: true | undefined }>,
  command: { step: number; shown: number },
  by: { role: "admin" | "member" },
  exists: (id: string) => boolean,
): TurnDecision {
  if (by.role !== "admin") return { kind: "refused", code: "NOT_ADMIN" };
  if (command.step !== flow.step) return { kind: "refused", code: "STALE" };
  const round = turnRoundOf(flow.turns, flow.step);
  if (steps[flow.step]?.turns !== true || round === null) return { kind: "refused", code: "PHASE" };
  const view = turnViewOf(round, exists);
  if (command.shown < view.shown) return { kind: "unchanged" };
  if (command.shown > view.shown) return { kind: "refused", code: "STALE" };
  let at = round.shown;
  while (at < round.order.length && !exists(round.order[at] as string)) at += 1;
  const noteId = round.order[at];
  if (noteId === undefined) return { kind: "unchanged" };
  return { kind: "changed", round: { ...round, shown: at + 1 }, noteId };
}

/** The rounds of a flow with one of them as it stands now. */
export function withTurnRound(rounds: readonly TurnRound[] | undefined, round: TurnRound): TurnRound[] {
  return [...(rounds ?? []).filter((known) => known.step !== round.step), round];
}
