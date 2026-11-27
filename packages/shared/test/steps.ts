// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { agendaOf, stepContext, type StepContext } from "../src/index.js";

// The two ways a wall stood before the methods, as steps (domain/flow.ts): hidden writing is the writing step of
// „Still sammeln“, a wall whose notes are there for everyone is the one step of „Freie Wand“, or „Still sammeln“
// once it is revealed. What the tests of the rules hand in where they handed in a phase.

export const HIDDEN_AGENDA = agendaOf("still-sammeln");
export const OPEN_AGENDA = agendaOf("free");

/** The writing step: everybody writes, nobody reads the others' notes. */
export const WRITING: StepContext = stepContext(HIDDEN_AGENDA, { step: 0, reach: 0 });
/** Revealed: every note is there for everyone, groups and arranging are allowed. */
export const OPEN: StepContext = stepContext(HIDDEN_AGENDA, { step: 1, reach: 1 });

/** What a `sync` says of a wall in hidden writing, and of a wall whose notes are there for everyone. */
export const WRITING_SYNC = { agenda: HIDDEN_AGENDA, step: 0, reach: 0 };
export const OPEN_SYNC = { agenda: OPEN_AGENDA, step: 0, reach: 0 };
