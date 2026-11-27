// test-steps.ts: where a wall stands, as its `sync` says it (packages/shared, domain/flow.ts), for the tests that
// handed in a phase before the methods: hidden writing is „Still sammeln“ in its writing step, a wall whose notes are
// there for everyone a „Freie Wand“ at its one step, or „Still sammeln“ once it is revealed.
import { agendaOf } from "@ideabeam/shared";

export const WRITING_SYNC = { agenda: agendaOf("still-sammeln"), step: 0, reach: 0 };
export const REVEALED_SYNC = { agenda: agendaOf("still-sammeln"), step: 1, reach: 1 };
export const OPEN_SYNC = { agenda: agendaOf("free"), step: 0, reach: 0 };
