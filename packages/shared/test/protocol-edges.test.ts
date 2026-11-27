// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  adminTokenSchema,
  arrangeErrorSchema,
  arrangeGroupSchema,
  arrangeResponseSchema,
  budgetSpentSchema,
  clockSchema,
  createWallRequestSchema,
  displayNameSchema,
  generateHexId,
  generateSessionKey,
  GROUP_TITLE_MAX,
  groupSchema,
  groupTitleSchema,
  hexIdSchema,
  MAX_MOVES,
  MAX_NOTES,
  noteSchema,
  noteTextSchema,
  parseClientCommand,
  parseServerEvent,
  participantSchema,
  proposalSchema,
  PROTOCOL_VERSION,
  questionSchema,
  readClientFrame,
  wallInfoSchema,
  type Group,
  type Note,
} from "../src/index.js";
import { OPEN_SYNC } from "./steps.js";

// The edges of the schemas that protocol.test.ts does not name: what a schema makes of a value (a trim, a default,
// a key it does not know) and where exactly it stops taking one. They hold whatever the schemas are written with.

const WALL_ID = "ab".repeat(32);
const ID = "0f".repeat(16);

const wire = (command: unknown) => parseClientCommand(JSON.stringify(command));
const event = (frame: unknown) => parseServerEvent(JSON.stringify(frame));

const participant = { id: ID, name: "Anna", role: "member", online: true } as const;
const note: Note = {
  id: ID,
  mine: true,
  text: "Fewer meetings",
  x: 0,
  y: 0,
  groupId: null,
  createdAt: 1,
  updatedAt: 1,
};
const group: Group = {
  id: ID,
  title: "Meetings",
  titleSource: "person",
  locked: true,
  x: 0,
  y: 0,
  w: 600,
  h: 400,
  ord: 1,
};
const sync = {
  type: "sync",
  protocolVersion: PROTOCOL_VERSION,
  serverNow: 1_795_300_000_000,
  wall: { id: WALL_ID, question: "What slows us down?", createdAt: 1_795_300_000_000 },
  participants: [participant],
  you: { participantId: ID },
  seq: 0,
  ...OPEN_SYNC,
  hidden: 0,
  clock: { rev: 0, endsAt: null, leftMs: null },
  notes: [note],
  groups: [group],
  arrangeRun: null,
  votes: [],
  ballot: null,
  voted: 0,
  results: [],
  teams: null,
  manual: [],
};
const answer = {
  proposal: { groups: [{ title: "Meetings", noteIds: [ID] }], loose: [] },
  cost: { neurons: 41.25, calls: 3, inputTokens: 1600, outputTokens: 900 },
  partial: false,
  runsLeft: 5,
  model: "stand-in",
};

describe("texts", () => {
  it("a name, a question and a title are measured after trimming, and only their ends are trimmed", () => {
    expect(displayNameSchema.parse(` ${"x".repeat(40)}\t`)).toBe("x".repeat(40));
    expect(displayNameSchema.safeParse(`x ${"x".repeat(39)}`).success).toBe(false);
    expect(questionSchema.parse(`\n${"x".repeat(140)}  `)).toBe("x".repeat(140));
    expect(groupTitleSchema.parse(` ${"x".repeat(GROUP_TITLE_MAX)} `)).toBe("x".repeat(GROUP_TITLE_MAX));
    // what a script calls white space goes: tabs, line ends, the no-break space
    expect(displayNameSchema.parse("\t Anna\u00a0\r\n")).toBe("Anna");
    expect(displayNameSchema.parse(" Anna  Maria ")).toBe("Anna  Maria");
  });

  it("a text is a string and nothing else", () => {
    for (const schema of [displayNameSchema, questionSchema, noteTextSchema, groupTitleSchema]) {
      for (const value of [7, null, undefined, true, ["Anna"], { name: "Anna" }]) {
        expect(schema.safeParse(value).success, String(value)).toBe(false);
      }
    }
  });

  it("comes out trimmed wherever a frame carries it", () => {
    expect(event({ type: "presence.join", participant: { ...participant, name: " Anna " } })).toEqual({
      type: "presence.join",
      participant,
    });
    expect(
      event({ type: "note.updated", seq: 1, noteId: ID, text: " Shorter meetings\n", updatedAt: 2 }),
    ).toMatchObject({
      text: "Shorter meetings",
    });
    expect(event({ ...sync, wall: { ...sync.wall, question: "  What slows us down? " } })).toEqual(sync);
    expect(wallInfoSchema.parse({ id: WALL_ID, question: " Why? ", createdAt: 1 }).question).toBe("Why?");
    expect(proposalSchema.parse({ groups: [{ title: " Meetings ", noteIds: [ID] }], loose: [] })).toEqual(
      answer.proposal,
    );
  });
});

describe("ids and tokens", () => {
  it("are the whole text: nothing before it, nothing after it, no capitals, and no number", () => {
    expect(hexIdSchema.safeParse(ID).success).toBe(true);
    expect(adminTokenSchema.safeParse(ID).success).toBe(true);
    for (const wrong of [`${ID}\n`, ` ${ID}`, `${ID} `, ID.toUpperCase(), ID.slice(1), `${ID}0`, 0, null, undefined]) {
      expect(hexIdSchema.safeParse(wrong).success, String(wrong)).toBe(false);
      expect(adminTokenSchema.safeParse(wrong).success, String(wrong)).toBe(false);
    }
  });
});

describe("numbers", () => {
  const ack = (seq: unknown) => ({ type: "ack", opId: ID, seq });

  it("a whole number is one a script counts exactly", () => {
    expect(event(ack(Number.MAX_SAFE_INTEGER))).not.toBeNull();
    for (const seq of [Number.MAX_SAFE_INTEGER + 1, 1e21, 0.1, "1", true, null]) {
      expect(event(ack(seq)), String(seq)).toBeNull();
    }
  });

  it("the worker's clock and the neurons of a run may have a fraction, and are numbers that end", () => {
    const changed = { type: "clock.changed", seq: 1, clock: sync.clock, serverNow: 1_795_300_000_000.5 };
    expect(event(changed)).toEqual(changed);
    expect(event({ ...changed, serverNow: "now" })).toBeNull();
    for (const neurons of [Number.NaN, Number.POSITIVE_INFINITY, "41", null]) {
      const cost = { ...answer.cost, neurons };
      expect(arrangeResponseSchema.safeParse({ ...answer, cost }).success, String(neurons)).toBe(false);
    }
  });
});

describe("the clock", () => {
  it("names its revision, its end and what is left: each a whole number, the last two or null, none left out", () => {
    expect(clockSchema.safeParse({ rev: 0, endsAt: null, leftMs: null }).success).toBe(true);
    expect(clockSchema.safeParse({ rev: 7, endsAt: 1_795_300_600_000, leftMs: 0 }).success).toBe(true);
    for (const clock of [
      { rev: 0, endsAt: null },
      { rev: 0, leftMs: null },
      { endsAt: null, leftMs: null },
      { rev: null, endsAt: null, leftMs: null },
      { rev: -1, endsAt: null, leftMs: null },
      { rev: 0.5, endsAt: null, leftMs: null },
      { rev: 0, endsAt: 1.5, leftMs: null },
      { rev: 0, endsAt: "soon", leftMs: null },
      { rev: 0, endsAt: null, leftMs: -1 },
      { rev: 0, endsAt: null, leftMs: 0.5 },
    ]) {
      expect(clockSchema.safeParse(clock).success, JSON.stringify(clock)).toBe(false);
    }
  });
});

describe("keys", () => {
  it("one that no schema names is dropped, also deep inside a frame", () => {
    expect(createWallRequestSchema.parse({ question: "Why?", hidden: false, admin: true })).toEqual({
      question: "Why?",
      hidden: false,
    });
    expect(wire({ type: "leave", opId: ID, name: "Anna" })).toEqual({ type: "leave" });
    expect(event({ type: "presence.join", participant: { ...participant, sessionKey: generateSessionKey() } })).toEqual(
      {
        type: "presence.join",
        participant,
      },
    );
    expect(
      arrangeResponseSchema.parse({ ...answer, cost: { ...answer.cost, seconds: 12 }, prompt: "Group these notes" }),
    ).toEqual(answer);
  });

  it("one that may be left out may not be null, and one that may be null may not be left out", () => {
    expect(arrangeErrorSchema.safeParse({ error: "PHASE", resetsAt: null }).success).toBe(false);
    expect(arrangeErrorSchema.safeParse({ error: "PHASE", resetsAt: 1.5 }).success).toBe(false);
    expect(arrangeErrorSchema.safeParse({ error: "NOTHING_TO_ARRANGE", notes: null, min: 6 }).success).toBe(false);
    expect(arrangeErrorSchema.safeParse({ error: "NOTHING_TO_ARRANGE", notes: 3, min: "6" }).success).toBe(false);
    expect(event({ type: "reject", opId: null, code: "INVALID" })).toBeNull();
    expect(event({ type: "reject", opId: ID, code: "DAY_SPENT", resetsAt: null })).toBeNull();
    expect(wire({ type: "join", name: "Anna", sessionKey: generateSessionKey(), adminToken: null })).toBeNull();
    expect(wire({ type: "group.update", opId: ID, groupId: ID, title: null, x: 40 })).toBeNull();

    const placeless: Partial<Note> = { ...note };
    delete placeless.groupId;
    expect(noteSchema.safeParse(placeless).success).toBe(false);
    const runless: Partial<typeof sync> = { ...sync };
    delete runless.arrangeRun;
    expect(event(sync)).toEqual(sync);
    expect(event(runless)).toBeNull();
  });

  it("hidden writing is the default for a key that is left out or undefined", () => {
    expect(createWallRequestSchema.parse({ question: "Why?", hidden: undefined })).toEqual({
      question: "Why?",
      hidden: true,
    });
  });
});

describe("lists", () => {
  const frame = { groupId: ID, title: "Theme", x: 0, y: 0, w: 600, h: 400 };
  const ids = (count: number) => Array.from({ length: count }, generateHexId);

  it(`a group of an arrangement takes 1 to ${MAX_NOTES} notes`, () => {
    expect(arrangeGroupSchema.safeParse({ ...frame, noteIds: ids(1) }).success).toBe(true);
    expect(arrangeGroupSchema.safeParse({ ...frame, noteIds: ids(MAX_NOTES) }).success).toBe(true);
    expect(arrangeGroupSchema.safeParse({ ...frame, noteIds: [] }).success).toBe(false);
    expect(arrangeGroupSchema.safeParse({ ...frame, noteIds: ids(MAX_NOTES + 1) }).success).toBe(false);
  });

  it(`an arrangement moves up to ${MAX_MOVES} notes`, () => {
    const [first, ...rest] = ids(MAX_MOVES + 1);
    const moves = [
      { noteId: first, x: 0, y: 0, groupId: ID },
      ...rest.map((noteId) => ({ noteId, x: 0, y: 0, groupId: null })),
    ];
    const apply = (count: number) =>
      wire({
        type: "admin.arrange.apply",
        opId: ID,
        source: "service",
        groups: [{ ...frame, noteIds: [first] }],
        moves: moves.slice(0, count),
      });
    expect(apply(MAX_MOVES)).not.toBeNull();
    expect(apply(MAX_MOVES + 1)).toBeNull();
  });

  it("is a list: not null, not one thing, not an object", () => {
    expect(event({ type: "notes.revealed", seq: 1, notes: [note] })).not.toBeNull();
    for (const notes of [null, note, { 0: note }, "notes"]) {
      expect(event({ type: "notes.revealed", seq: 1, notes }), JSON.stringify(notes)).toBeNull();
    }
    expect(proposalSchema.safeParse({ groups: [] }).success).toBe(false);
  });
});

describe("words and switches", () => {
  it("a word comes from its set, and yes or no is said as true or false", () => {
    expect(event({ type: "step.changed", seq: 1, step: "closed", reach: 0 })).toBeNull();
    expect(groupSchema.safeParse(group).success).toBe(true);
    expect(groupSchema.safeParse({ ...group, titleSource: "ai" }).success).toBe(false);
    expect(groupSchema.safeParse({ ...group, locked: 1 }).success).toBe(false);
    expect(noteSchema.safeParse({ ...note, mine: "true" }).success).toBe(false);
    expect(participantSchema.safeParse({ ...participant, online: null }).success).toBe(false);
    expect(arrangeResponseSchema.safeParse({ ...answer, partial: "no" }).success).toBe(false);
  });
});

describe("the frames with numbers of their own", () => {
  it("a snapshot counts hidden notes from 0 and names its version as a number", () => {
    expect(event({ ...sync, hidden: 4 })).toEqual({ ...sync, hidden: 4 });
    expect(event({ ...sync, hidden: -1 })).toBeNull();
    expect(event({ ...sync, protocolVersion: String(PROTOCOL_VERSION) })).toBeNull();
  });

  it("the answer with a proposal says everything about the run, in whole numbers where it counts", () => {
    expect(arrangeResponseSchema.safeParse(answer).success).toBe(true);
    const unsaid: Partial<typeof answer> = { ...answer };
    delete unsaid.runsLeft;
    expect(arrangeResponseSchema.safeParse(unsaid).success).toBe(false);
    expect(arrangeResponseSchema.safeParse({ ...answer, model: 7 }).success).toBe(false);
    expect(arrangeResponseSchema.safeParse({ ...answer, cost: { ...answer.cost, calls: 1.5 } }).success).toBe(false);
    expect(budgetSpentSchema.safeParse({ error: "BUDGET_SPENT", resetsAt: 1.5 }).success).toBe(false);
  });
});

describe("a frame that is no command", () => {
  it("names an operation only with a type that is a text, also an empty one", () => {
    expect(readClientFrame(JSON.stringify({ type: "", opId: ID }))).toEqual({ kind: "invalid", opId: ID });
    expect(readClientFrame(JSON.stringify({ type: 7, opId: ID }))).toEqual({ kind: "unreadable" });
    expect(readClientFrame(JSON.stringify({ type: "note.delete", opId: ID.toUpperCase() }))).toEqual({
      kind: "unreadable",
    });
  });
});
