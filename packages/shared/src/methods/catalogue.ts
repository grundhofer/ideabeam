// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Method, MethodId } from "../domain/method.js";

// The catalogue of methods as code data (docs/architektur-methoden.md 1). The words of each method, in German and
// English, stand in methods/texts.ts; a test holds both against this list, and a method without its name and short
// description in both languages does not build (PLAN-METHODEN.md 2).
//
// Three methods so far:
//
//  - „Still sammeln, bündeln, verdeckt wählen“ (docs/methoden-katalog.md, method 2), complete since stage M2
//    (version 2: its vote). Its first step of the catalogue, „Frage stellen“, is part of „Ideen schreiben“ here: a
//    wall shows its question from the start, and people write from the moment they arrive, hidden, as every wall
//    with hidden writing did before. So a wall starts where it starts today, and revealing is one step on. The vote
//    gives points, a quarter of the options a person and at least two, hidden and all at once; the options are the
//    groups after „Bündeln“, and the notes in no group (domain/vote.ts). Version 1 (stage M1, without the vote)
//    stands on no wall outside the tests: a wall keeps the copy it was made with (domain/agenda.ts).
//  - „Schätzen – Diskutieren – Schätzen“ (method 5, stage M3): everyone estimates a number in secret, with a short
//    reason beside it; the moderation counts, and everyone sees the median, the middle half and the range, never a
//    single estimate; the reasons are shown, without names; the group discusses the differences; everyone
//    estimates again, seeing only the first round's summary; the result shows both rounds. Its first step of the
//    catalogue, „Schätzfrage stellen“, is part of the first estimate, as „Frage stellen“ is part of „Ideen
//    schreiben“: the wall shows its question from the start. „Abweichungen besprechen“ is the catalogue's step in
//    small groups; until stage M4 brings pairs and small groups it is a step for everyone (`plenary`). The unit
//    (`unit`) is the moderation's, named on `/neu` (domain/agenda.ts); no bounds.
//  - „1-2-4-Alle“ (method 3, stage M4, from Liberating Structures, CC BY-SA 4.0 with the attribution of
//    methods/texts.ts): everyone thinks and writes alone for a minute, hidden; then in pairs, which the app forms at
//    random from the people present, each pair seeing its own notes; then the pairs are merged into fours, each four
//    seeing its notes and finding what matters most; then every four presents its core idea to everybody, and every
//    note is there for everyone. Its first step of the catalogue, „Frage stellen“, is part of the writing, as in
//    „Still sammeln“: four steps instead of five, about 15 minutes instead of 16. The three short steps move on by
//    themselves when their time is up (`advance: "auto"`, the owner's decision 2: only in short, timed methods
//    like this one); the moderation starts the first clock, and can pause a clock, switch a step's moving on off,
//    or press „Weiter“ at any time. The presenting has no clock and waits for „Weiter“, of which there is none:
//    it is the last step.
//  - „Freie Wand“: one step, writing and arranging, every note there for everyone at once: the wall made without
//    hidden writing.
//
// A step's capabilities (what may be done in it) follow from its type and visibility (domain/agenda.ts).

const MINUTE = 60;

export const CATALOGUE: Readonly<Record<MethodId, Method>> = {
  "still-sammeln": {
    id: "still-sammeln",
    version: 2,
    purpose: "collect",
    steps: [
      {
        key: "write",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 7 * MINUTE,
        advance: "moderation",
        output: "notes",
      },
      {
        key: "reveal",
        type: "reveal",
        mode: "plenary",
        visibility: "all",
        durationSec: 1 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "cluster",
        type: "cluster",
        mode: "plenary",
        visibility: "all",
        durationSec: 6 * MINUTE,
        advance: "moderation",
        output: "groups",
      },
      {
        key: "vote",
        type: "vote",
        mode: "individual",
        visibility: "aggregate",
        durationSec: 3 * MINUTE,
        advance: "moderation",
        output: "ranking",
        vote: { kind: "dots", perPerson: null, maxPerOption: null },
      },
      {
        key: "discuss",
        type: "discuss",
        mode: "plenary",
        visibility: "all",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "none",
      },
    ],
    minutes: 25,
    groupSize: [3, 30],
  },
  "eins-zwei-vier": {
    id: "eins-zwei-vier",
    version: 1,
    purpose: "collect",
    steps: [
      {
        key: "alone",
        type: "write",
        mode: "individual",
        visibility: "hidden",
        durationSec: 1 * MINUTE,
        advance: "auto",
        output: "notes",
      },
      {
        key: "pairs",
        type: "discuss",
        mode: "pair",
        visibility: "team",
        durationSec: 2 * MINUTE,
        advance: "auto",
        output: "notes",
        team: { size: 2, form: "random" },
      },
      {
        key: "fours",
        type: "discuss",
        mode: "group",
        visibility: "team",
        durationSec: 5 * MINUTE,
        advance: "auto",
        output: "notes",
        team: { size: 4, form: "merge" },
      },
      {
        key: "present",
        type: "discuss",
        mode: "presentation",
        visibility: "all",
        durationSec: 7 * MINUTE,
        advance: "moderation",
        output: "notes",
      },
    ],
    minutes: 15,
    groupSize: [4, 30],
    attribution: "liberatingStructures",
  },
  schaetzen: {
    id: "schaetzen",
    version: 1,
    purpose: "decide",
    steps: [
      {
        key: "estimate1",
        type: "estimate",
        mode: "individual",
        visibility: "aggregate",
        durationSec: 4 * MINUTE,
        advance: "moderation",
        output: "estimate",
        vote: { kind: "estimate", unit: null, min: null, max: null },
        noteKind: "reason",
      },
      {
        key: "feedback",
        type: "reveal",
        mode: "plenary",
        visibility: "anonymous",
        durationSec: 3 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "discuss",
        type: "discuss",
        mode: "plenary",
        visibility: "all",
        durationSec: 8 * MINUTE,
        advance: "moderation",
        output: "none",
      },
      {
        key: "estimate2",
        type: "estimate",
        mode: "individual",
        visibility: "aggregate",
        durationSec: 3 * MINUTE,
        advance: "moderation",
        output: "estimate",
        vote: { kind: "estimate", unit: null, min: null, max: null },
      },
      {
        key: "result",
        type: "discuss",
        mode: "plenary",
        visibility: "aggregate",
        durationSec: 5 * MINUTE,
        advance: "moderation",
        output: "none",
      },
    ],
    minutes: 25,
    groupSize: [5, 30],
  },
  free: {
    id: "free",
    version: 1,
    purpose: "none",
    steps: [
      {
        key: "wall",
        type: "cluster",
        mode: "plenary",
        visibility: "all",
        durationSec: null,
        advance: "moderation",
        output: "groups",
      },
    ],
    minutes: null,
    groupSize: [1, 30],
  },
};

/** The methods in the order of the choice on `/neu` (docs/methoden-katalog.md, (b)): by purpose, the one that is
 *  chosen at first leading, „Freie Wand“ last. */
export const METHOD_ORDER: readonly MethodId[] = ["still-sammeln", "eins-zwei-vier", "schaetzen", "free"];

/** The method a new wall gets when nothing else is asked: the best supported one (PLAN-METHODEN.md 3). */
export const DEFAULT_METHOD: MethodId = "still-sammeln";
