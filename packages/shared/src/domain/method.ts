// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as z from "zod/mini";
import { voteConfigSchema } from "./vote.js";

// A method as data (PLAN-METHODEN.md 4, docs/architektur-methoden.md 1): a list of steps, each with a type, a form
// of working, a visibility, a suggested time and what it makes. The methods themselves stand in the catalogue
// (methods/catalogue.ts), their words in both languages beside it (methods/texts.ts): a step carries a key, never a
// text, so a wall stores no words and a deploy that rewords a step changes no running wall.
//
// Stage M1 built the engine and two methods with it: „Still sammeln, bündeln, verdeckt wählen“ and „Freie Wand“;
// stage M2 gave the first its vote (domain/vote.ts); stage M3 brought estimating in rounds and the method
// „Schätzen – Diskutieren – Schätzen“; stage M4 pairs and small groups (`team`, domain/teams.ts), steps that move on by
// themselves when their time is up (`advance: "auto"`) and the method „1-2-4-Alle“; stage M5 revealing one note at a
// time by turn (`turns`), votes over the notes of one step (`optionsFrom`), teams kept from round to round (`keep`),
// actions with „Wer“ and „Bis wann“ (`noteKind: "action"`, a step of type `decide`) and four methods with them. The
// enums already name what the later stages bring, so that a wall's stored copy of its agenda keeps one shape from now
// on.

/** The ids of the methods in the catalogue. A method is never renamed: a wall stores the id. */
export const METHOD_IDS = [
  "still-sammeln",
  "eins-zwei-vier",
  "schaetzen",
  "free",
  "rueckblick",
  "scheitern",
  "ideenrunde",
  "was-na-und",
] as const;
export const methodIdSchema = z.enum(METHOD_IDS);
export type MethodId = z.infer<typeof methodIdSchema>;

/** What a step does. */
export const stepTypeSchema = z.enum([
  "impulse",
  "write",
  "reveal",
  "cluster",
  "discuss",
  "vote",
  "rank",
  "score",
  "estimate",
  "present",
  "decide",
  "roleRound",
  "consent",
]);
export type StepType = z.infer<typeof stepTypeSchema>;

/** Who works with whom: alone, in pairs, in small groups, everyone together, one presenting to the others. */
export const stepModeSchema = z.enum(["individual", "pair", "group", "plenary", "presentation"]);
export type StepMode = z.infer<typeof stepModeSchema>;

/** Who sees what is written in the step: only its writer, the own pair or group, everyone, only the counted result
 *  (ballots), everyone without the writer's name. Who wrote a note is never shown in any of them (the owner's
 *  decision 14, PLAN.md 7.2): `anonymous` equals `all` for notes and stays for a later named level. */
export const stepVisibilitySchema = z.enum(["hidden", "team", "all", "aggregate", "anonymous"]);
export type StepVisibility = z.infer<typeof stepVisibilitySchema>;

/** What a step makes. */
export const outputKindSchema = z.enum([
  "none",
  "notes",
  "groups",
  "ballots",
  "ranking",
  "estimate",
  "decisions",
  "actions",
]);
export type OutputKind = z.infer<typeof outputKindSchema>;

/** What the notes of a step are, where a step that is no step of writing takes notes beside its own work
 *  (docs/architektur-methoden.md 1): `reason`, the short reason beside a first estimate (stage M3). A step of
 *  writing or sorting takes notes by its type and needs none of it. `action` (stage M5): the notes written in the
 *  step are actions; in a step of type `decide` the moderation gives an action its „Wer“ and „Bis wann“ and so
 *  agrees on it (domain/rules.ts, `note.action`). */
export const noteKindSchema = z.enum(["idea", "reason", "action", "decision", "criterion"]);
export type NoteKind = z.infer<typeof noteKindSchema>;

/** What a method is for: the heading it stands under in the choice on `/neu` (docs/methoden-katalog.md, (b)).
 *  `none`: the wall without a fixed sequence, the choice's last option. */
export const PURPOSES = ["collect", "decide", "plan", "review", "risk", "none"] as const;
export type Purpose = (typeof PURPOSES)[number];

/** The longest suggested time of one step, in seconds. */
export const STEP_MAX_SECONDS = 60 * 60;
/** How many steps a wall's agenda holds at most: eight methods of the longest kind, far past any workshop. */
export const MAX_STEPS = 60;

const stepKeySchema = z.string().check(z.regex(/^[a-z][a-zA-Z0-9]{0,31}$/));

/** The largest team a step forms. */
export const TEAM_MAX_SIZE = 7;

/** How a step in pairs or small groups gets its teams (stage M4, domain/teams.ts): `size` is the size it aims at
 *  (a count that does not divide makes some teams one larger, never a team of 1); `form` says where they come
 *  from: `random`, the app forms them anew from the people present, at random; `merge`, the teams of the step
 *  before are put together two by two (pairs become fours); `keep` (stage M5), the teams in force stay as they are,
 *  with areas of their own beside the last ones (the next round of „Was? Na und? Was nun?“), and where there are
 *  none yet they are formed at random. */
export const teamSettingsSchema = z.object({
  size: z.int().check(z.minimum(2), z.maximum(TEAM_MAX_SIZE)),
  form: z.enum(["random", "merge", "keep"]),
});
export type TeamSettings = z.infer<typeof teamSettingsSchema>;

/** One step of a method, as the catalogue has it and a wall stores it. */
export const stepSchema = z.object({
  /** The step's text key within its method: its words are `<methodId>.<key>` (methods/texts.ts). */
  key: stepKeySchema,
  type: stepTypeSchema,
  mode: stepModeSchema,
  visibility: stepVisibilitySchema,
  /** The suggested time, or null: the step has none. */
  durationSec: z.nullable(z.int().check(z.minimum(0), z.maximum(STEP_MAX_SECONDS))),
  /** Who moves on: the moderation presses „Weiter“ (the owner's decision 2). `auto`, only in short, timed methods
   *  (stage M4, „1-2-4-Alle“): when the step's clock runs out, the wall moves to the next step by itself, through the
   *  object's one alarm (domain/flow.ts, `nextAlarm`); entering such a step forward starts its clock from
   *  `durationSec`, and the moderation can pause the clock or switch the step's moving on off (`manual`). */
  advance: z.enum(["moderation", "auto"]),
  output: outputKindSchema,
  /** How a step of type `vote`, `rank` or `score` is voted (domain/vote.ts): a step votes if and only if it has one
   *  (`checkAgenda`). */
  vote: z.optional(voteConfigSchema),
  /** The step takes notes of this kind beside its vote (`capabilities`, domain/agenda.ts): the reasons beside the
   *  first estimate. Left out: notes only where the step's type is about notes. */
  noteKind: z.optional(noteKindSchema),
  /** A step in pairs or small groups: how its teams are formed (domain/teams.ts). Its notes are seen by the
   *  writer's team (`visibility: "team"`). */
  team: z.optional(teamSettingsSchema),
  /** A step of type `reveal` that shows the hidden notes one at a time (stage M5, domain/turns.ts): in an order
   *  interleaved by writer and without names, frozen when the wall enters the step; the moderation shows the next
   *  one with „Nächster Zettel“. Reaching the step shows nothing by itself: a note is shown when its turn comes, or
   *  by a later step that shows everything. */
  turns: z.optional(z.literal(true)),
  /** A step that votes over the notes written in one earlier step of its method, named by its key, and not over the
   *  groups and the notes of the whole wall (stage M5: the actions of „Rückblick nach Ziel und Daten“). */
  optionsFrom: z.optional(stepKeySchema),
});
export type Step = z.infer<typeof stepSchema>;

/** A method of the catalogue. */
export interface Method {
  id: MethodId;
  /** Raised with every change of its steps: a wall stores the version it was made with. */
  version: number;
  purpose: Purpose;
  steps: readonly Step[];
  /** The time it takes, rounded, in minutes; null: no fixed sequence. */
  minutes: number | null;
  /** How many people it is made for, from and to. */
  groupSize: readonly [min: number, max: number];
  /** A licence that asks for a visible attribution (PLAN-METHODEN.md 7, question 6): „1-2-4-Alle“ (stage M4), „Was?
   *  Na und? Was nun?“ (stage M5). The
   *  words of the attribution stand in methods/texts.ts (`ATTRIBUTION`). */
  attribution?: "liberatingStructures";
}
