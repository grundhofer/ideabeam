// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Method, MethodId } from "../domain/method.js";

// The catalogue of methods as code data (docs/architektur-methoden.md 1). The words of each method, in German and
// English, stand in methods/texts.ts; a test holds both against this list, and a method without its name and short
// description in both languages does not build (PLAN-METHODEN.md 2).
//
// Two methods so far:
//
//  - „Still sammeln, bündeln, verdeckt wählen“ (docs/methoden-katalog.md, method 2), complete since stage M2
//    (version 2: its vote). Its first step of the catalogue, „Frage stellen“, is part of „Ideen schreiben“ here: a
//    wall shows its question from the start, and people write from the moment they arrive, hidden, as every wall
//    with hidden writing did before. So a wall starts where it starts today, and revealing is one step on. The vote
//    gives points, a quarter of the options a person and at least two, hidden and all at once; the options are the
//    groups after „Bündeln“, and the notes in no group (domain/vote.ts). Version 1 (stage M1, without the vote)
//    stands on no wall outside the tests: a wall keeps the copy it was made with (domain/agenda.ts).
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
    evidence: "metaAnalysis",
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
    evidence: "studies",
  },
};

/** The methods in the order of the choice on `/neu` (docs/methoden-katalog.md, (b)): by purpose, the one that is
 *  chosen at first leading, „Freie Wand“ last. */
export const METHOD_ORDER: readonly MethodId[] = ["still-sammeln", "free"];

/** The method a new wall gets when nothing else is asked: the best supported one (PLAN-METHODEN.md 3). */
export const DEFAULT_METHOD: MethodId = "still-sammeln";
