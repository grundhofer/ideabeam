#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// measure-arrange.mjs: measures „Ordnen“ as the product does it (PLAN.md 4.6, stage 4a): a wall with the notes of
// one test board, arranged by the deployed Worker's route, and the proposal held against the themes the corpus
// knows. It talks to the Worker as a browser would; it needs no login and no token of the account.
//
//   node scripts/measure-arrange.mjs https://<worker>.<subdomain>.workers.dev [--board onboarding|stadtteil|both]
//                                    [--limit <n>] [--lang de|en] [--dirty mixed|only] [--runs <n>] [--seed <n>]
//                                    [--keep]
//   node scripts/measure-arrange.mjs --selftest
//
// What it does: makes an open wall with the board's question; writes the board's notes over the wall's socket as
// several people, in an order shuffled by --seed (the corpus lists them theme by theme); asks
// `POST /api/walls/:id/arrange` with the wall's admin token, --runs times; and deletes the wall, also when
// something failed (--keep leaves it and prints its moderation link).
//
//   --board   the test board of docs/messung/korpus.json: 250 notes in five themes, half German, half English.
//             `both` puts the two boards on one wall under the first board's question: 500 notes, a wall's limit,
//             in ten themes. It tries the largest run; its index says little, a wall gets six themes at most
//   --limit   only the first n notes of the shuffled board: a small wall (PLAN.md 4.6 asks for 8 to 15)
//   --lang    the language of the titles (the request's `language`); the question is asked in the same
//   --dirty   the corpus's dirty notes of the board, 30 of them: single words, typos, emoji. `mixed` adds them to
//             the board's notes, `only` arranges them alone
//   --runs    how often the same wall is arranged, to see how much a run differs from the next (a wall has six
//             runs in 24 hours)
//
// What it says for every run: how long the request took, the groups with their titles and sizes, and against the
// corpus's themes the Adjusted Rand Index (1: as the corpus, 0: chance), the purity (the share of notes that lie
// with the majority theme of their group) and the share of notes without a group; for --dirty mixed the same for
// the dirty notes alone; and what the run cost, as the Worker reports it. A note without a group counts as a group
// of its own, as in the measurement of stage 0b. The last line is the whole result as JSON, for docs/.
//
// What it costs the deployment: one of the day's walls; one row written per note and two per person it joins as;
// per run two rows of the AI's counter, one of the wall's six runs in 24 hours and the run's neurons from the budget
// of 24 hours (measured: 130 to 180 for 250 notes, about 20 for 30). Against a local address (`pnpm dev`) the
// stand-in of apps/worker/.dev.vars answers, not a model: that tries the script out and measures nothing.
// Needs Node 22 (fetch and WebSocket are built in), nothing else.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

// a socket's burst is forty frames; one is the join, and one stays in hand (apps/worker, wall-room.ts)
const PER_PERSON = 38;
// the wall's limits, as packages/shared/src/protocol.ts states them
const MAX_NOTES = 500;
const NOTE_TEXT_MAX = 300;
const WALL_DAILY_RUNS = 6;
const ANSWER_MS = 30_000;

const USAGE =
  "usage: node scripts/measure-arrange.mjs <base address> [--board onboarding|stadtteil|both] [--limit <n>] " +
  "[--lang de|en] [--dirty mixed|only] [--runs <n>] [--seed <n>] [--keep]\n" +
  "       node scripts/measure-arrange.mjs --selftest";

const fail = (message) => {
  process.stderr.write(`measure-arrange: ${message}\n`);
  process.exit(1);
};
const hex = (bytes) => randomBytes(bytes).toString("hex");

// ───────────────────────── the score ─────────────────────────

const pairs = (n) => (n * (n - 1)) / 2;

/** The Adjusted Rand Index of two ways to sort the same things: 1 when they sort alike, about 0 when they agree
 *  no more than chance would. `a` and `b` name each thing's group, in the same order. */
function adjustedRand(a, b) {
  const cells = new Map();
  const [rows, columns] = [new Map(), new Map()];
  for (let n = 0; n < a.length; n++) {
    const key = `${a[n]}\u0000${b[n]}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
    rows.set(a[n], (rows.get(a[n]) ?? 0) + 1);
    columns.set(b[n], (columns.get(b[n]) ?? 0) + 1);
  }
  const sum = (counts) => [...counts.values()].reduce((total, count) => total + pairs(count), 0);
  const [index, inRows, inColumns] = [sum(cells), sum(rows), sum(columns)];
  const expected = (inRows * inColumns) / pairs(a.length);
  const most = (inRows + inColumns) / 2;
  // both sort everything into one group, or each thing into its own: they agree entirely
  return most === expected ? 1 : (index - expected) / (most - expected);
}

/** How a proposal compares with the themes the corpus knows. `notes` are the wall's notes with their theme;
 *  `proposal` is the route's. A note without a group is a group of its own for the index, and counts against the
 *  purity. */
function score(notes, proposal) {
  const groupOf = new Map();
  proposal.groups.forEach((group, index) => {
    for (const noteId of group.noteIds) groupOf.set(noteId, index);
  });
  const predicted = notes.map((note, n) => groupOf.get(note.noteId) ?? `none-${n}`);
  const truth = notes.map((note) => note.theme);
  // per group: how many of its notes are of its most frequent theme
  const themes = new Map();
  notes.forEach((note) => {
    const group = groupOf.get(note.noteId);
    if (group === undefined) return;
    const counts = themes.get(group) ?? new Map();
    counts.set(note.theme, (counts.get(note.theme) ?? 0) + 1);
    themes.set(group, counts);
  });
  const majority = [...themes.values()].reduce((total, counts) => total + Math.max(...counts.values()), 0);
  const grouped = notes.filter((note) => groupOf.has(note.noteId)).length;
  const round = (value) => Math.round(value * 10_000) / 10_000;
  return {
    notes: notes.length,
    ari: round(adjustedRand(predicted, truth)),
    purity: round(notes.length === 0 ? 0 : majority / notes.length),
    withoutGroup: round(notes.length === 0 ? 0 : 1 - grouped / notes.length),
  };
}

/** Holds the score's arithmetic against partitions whose values are known. No network. */
function selftest() {
  const close = (got, want, what) => {
    if (Math.abs(got - want) > 1e-4) fail(`selftest: ${what} is ${got}, expected ${want}`);
  };
  close(adjustedRand([0, 0, 1, 1], [5, 5, 7, 7]), 1, "the index of two equal partitions");
  close(adjustedRand([0, 0, 1, 1], [0, 0, 1, 2]), 0.5714, "the index of a partition with one group split");
  close(adjustedRand([0, 0, 1, 1], [0, 1, 0, 1]), -0.5, "the index of two partitions that cross");
  close(adjustedRand([0, 0, 0, 1, 1, 1], [0, 0, 1, 1, 2, 2]), 0.2424, "the index of scikit-learn's example");
  const notes = ["a", "a", "a", "b", "b", "b"].map((theme, n) => ({ noteId: String(n), theme }));
  const all = score(notes, { groups: [{ noteIds: ["0", "1", "2"] }, { noteIds: ["3", "4", "5"] }], loose: [] });
  close(all.ari, 1, "the index of a proposal that is the corpus");
  close(all.purity, 1, "its purity");
  const mixed = score(notes, { groups: [{ noteIds: ["0", "1", "3"] }, { noteIds: ["4", "5"] }], loose: ["2"] });
  close(mixed.purity, 4 / 6, "the purity with a note in the wrong group and one without a group");
  close(mixed.withoutGroup, 1 / 6, "the share without a group");
  close(mixed.ari, adjustedRand([0, 0, "x", 0, 1, 1], ["a", "a", "a", "b", "b", "b"]), "a note alone is its own group");
  process.stdout.write("measure-arrange: the score's arithmetic holds\n");
}

// ───────────────────────── the options ─────────────────────────

const given = process.argv.slice(2);
if (given.includes("--selftest")) {
  selftest();
  process.exit(0);
}
const options = { board: "onboarding", limit: "0", lang: "de", dirty: "none", runs: "1", seed: "1", keep: false };
const plain = [];
for (let n = 0; n < given.length; n++) {
  const name = given[n].startsWith("--") ? given[n].slice(2) : null;
  if (name === null) plain.push(given[n]);
  else if (name === "keep") options.keep = true;
  else if (name in options && given[n + 1] !== undefined) options[name] = given[++n];
  else fail(USAGE);
}
const [base] = plain;
if (!base || !/^https?:\/\//.test(base) || plain.length !== 1) fail(USAGE);
const origin = new URL(base).origin;
const [limit, runs, seed] = [Number(options.limit), Number(options.runs), Number(options.seed)];
if (!["de", "en"].includes(options.lang)) fail("--lang is de or en");
if (!["none", "mixed", "only"].includes(options.dirty)) fail("--dirty is mixed or only");
if (!Number.isInteger(limit) || limit < 0) fail("--limit is a number of notes");
if (!Number.isInteger(runs) || runs < 1 || runs > WALL_DAILY_RUNS) fail(`--runs is 1 to ${WALL_DAILY_RUNS}`);
if (!Number.isInteger(seed)) fail("--seed is a whole number");

// ───────────────────────── the wall's notes ─────────────────────────

const corpus = JSON.parse(readFileSync(new URL("../docs/messung/korpus.json", import.meta.url), "utf8"));
const board =
  options.board === "both"
    ? {
        id: "both",
        question: corpus.boards[0].question,
        // a theme's name with its board's: the two boards share no theme
        themes: corpus.boards.flatMap((b) => b.themes.map((theme) => ({ ...theme, id: `${b.id}/${theme.id}` }))),
      }
    : corpus.boards.find((candidate) => candidate.id === options.board);
if (board === undefined) fail(`no board "${options.board}": ${corpus.boards.map((b) => b.id).join(", ")}, both`);

/** The same order for the same seed: a small generator of numbers (mulberry32), seeded from the board and --seed. */
function shuffled(list, name) {
  let state = [...`${name}-${seed}`].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) | 0, 7);
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let n = out.length - 1; n > 0; n--) {
    const other = Math.floor(next() * (n + 1));
    [out[n], out[other]] = [out[other], out[n]];
  }
  return out;
}

const clean = shuffled(
  board.themes.flatMap((theme) => theme.notes.map((note) => ({ text: note.t, theme: theme.id, dirty: false }))),
  board.id,
).slice(0, limit === 0 ? undefined : limit);
const dirty = (corpus.dirty ?? [])
  .filter((note) => note.board === board.id)
  .map((note) => ({ text: note.t, theme: note.theme, dirty: true }));
if (options.dirty !== "none" && dirty.length === 0) fail("the corpus has no dirty notes for this board");
const notes = shuffled(
  options.dirty === "only" ? dirty : options.dirty === "mixed" ? [...clean, ...dirty] : clean,
  `${board.id}-wall`,
).map((note) => ({ ...note, noteId: hex(16) }));
if (notes.length > MAX_NOTES) fail(`a wall holds ${MAX_NOTES} notes at most`);
const tooLong = notes.find((note) => note.text.length > NOTE_TEXT_MAX);
if (tooLong !== undefined) fail(`a note of the corpus is longer than a wall takes: "${tooLong.text.slice(0, 40)}…"`);

// ───────────────────────── the wall ─────────────────────────

/** One person: joins the wall, sends their commands, and leaves once the wall has answered every one of them. With
 *  the admin token the person is the moderation. After scripts/seed-wall.mjs. */
function write(wallId, name, commands, adminToken) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${origin.replace(/^http/, "ws")}/api/walls/${wallId}/ws`);
    const waiting = new Set(commands.map((command) => command.opId));
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`${name}: ${waiting.size} commands were not answered in time`));
    }, ANSWER_MS);
    const stop = (error) => {
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve();
    };
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "join", name, sessionKey: hex(16), ...(adminToken ? { adminToken } : {}) }));
    });
    socket.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data));
      if (frame.type === "sync") {
        for (const command of commands) socket.send(JSON.stringify(command));
      } else if (frame.type === "ack") {
        waiting.delete(frame.opId);
        if (waiting.size === 0) stop();
      } else if (frame.type === "reject" || frame.type === "error") {
        stop(new Error(`${name}: the wall answered ${frame.type} ${frame.code}`));
      } else if (frame.type === "wall.deleted") {
        stop(new Error("the wall was deleted"));
      }
    });
    socket.addEventListener("error", () => stop(new Error(`${name}: the socket failed`)));
  });
}

async function makeWall() {
  const response = await fetch(`${origin}/api/walls`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // open from the start: arranging comes after revealing, and nothing here needs hidden writing
    body: JSON.stringify({ question: board.question[options.lang], hidden: false }),
  });
  if (response.status === 429) fail("no wall was made: the limit per address or the day's budget of walls is spent");
  if (!response.ok) fail(`no wall was made: ${response.status}`);
  return response.json();
}

/** One run: the route's answer, how long it took, and how the proposal compares with the corpus. */
async function arrange(wallId, adminToken) {
  const started = performance.now();
  const response = await fetch(`${origin}/api/walls/${wallId}/arrange`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ language: options.lang }),
  });
  const seconds = Math.round((performance.now() - started) / 100) / 10;
  const body = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, seconds, error: body };
  const themeOf = new Map(notes.map((note) => [note.noteId, note.theme]));
  const groups = body.proposal.groups.map((group) => {
    const counts = new Map();
    for (const noteId of group.noteIds) counts.set(themeOf.get(noteId), (counts.get(themeOf.get(noteId)) ?? 0) + 1);
    const [theme, most] = [...counts].sort((a, b) => b[1] - a[1])[0];
    return { title: group.title, notes: group.noteIds.length, mostly: theme, ofThat: most };
  });
  return {
    ok: true,
    seconds,
    groups,
    all: score(notes, body.proposal),
    ...(options.dirty === "mixed"
      ? {
          dirty: score(
            notes.filter((note) => note.dirty),
            body.proposal,
          ),
        }
      : {}),
    cost: body.cost,
    partial: body.partial,
    model: body.model,
    runsLeft: body.runsLeft,
  };
}

const percent = (share) => `${(share * 100).toFixed(1)} %`;
const said = (line) => process.stdout.write(`${line}\n`);

const { wallId, adminToken } = await makeWall();
const run = hex(2);
const result = {
  worker: origin,
  at: new Date().toISOString(),
  board: board.id,
  notes: notes.length,
  dirty: options.dirty,
  language: options.lang,
  seed,
  runs: [],
};
let failed = false;
/** Deletes the wall, as its moderation; with --keep it stays and its moderation link is printed. */
const removeWall = () =>
  options.keep
    ? Promise.resolve(said(`the wall stays: ${origin}/w/${wallId}#admin=${adminToken}`))
    : write(wallId, `Messung ${run} Ende`, [{ type: "admin.wall.delete", opId: hex(16) }], adminToken).then(
        () => said("the wall is deleted"),
        (error) => said(`the wall could not be deleted (${error.message}): ${origin}/w/${wallId}#admin=${adminToken}`),
      );
// Ctrl-C: nothing of the measurement stays stored
process.once("SIGINT", () => {
  said("interrupted");
  void removeWall().finally(() => process.exit(130));
});
try {
  // The people write one after the other, so the wall holds the notes in the shuffled order: it lists them by the
  // moment they were made, and that is the order the model reads them in.
  const people = Math.ceil(notes.length / PER_PERSON);
  const started = Date.now();
  for (let n = 0; n < people; n++) {
    const own = notes.slice(n * PER_PERSON, (n + 1) * PER_PERSON).map((note, at) => ({
      type: "note.create",
      opId: hex(16),
      noteId: note.noteId,
      text: note.text,
      x: ((n * PER_PERSON + at) % 20) * 256,
      y: Math.floor((n * PER_PERSON + at) / 20) * 168,
    }));
    await write(wallId, `Messung ${run} ${String(n + 1).padStart(2, "0")}`, own);
  }
  said(
    `${board.id}: ${notes.length} notes written by ${people} people in ${((Date.now() - started) / 1000).toFixed(1)} s` +
      (options.dirty === "none" ? "" : `, ${notes.filter((note) => note.dirty).length} of them dirty`),
  );

  for (let n = 1; n <= runs; n++) {
    const outcome = await arrange(wallId, adminToken);
    result.runs.push(outcome);
    if (!outcome.ok) {
      failed = true;
      said(`run ${n}: no proposal after ${outcome.seconds} s: ${outcome.status} ${JSON.stringify(outcome.error)}`);
      // a budget that is spent stays spent: no further run is tried
      if (outcome.status === 429) break;
      continue;
    }
    const { all, cost } = outcome;
    said(
      `run ${n}: ${outcome.seconds} s, ${outcome.groups.length} groups, ARI ${all.ari.toFixed(2)}, purity ` +
        `${all.purity.toFixed(2)}, without a group ${percent(all.withoutGroup)}${outcome.partial ? " (partial)" : ""}`,
    );
    if (outcome.dirty !== undefined) {
      const part = outcome.dirty;
      said(
        `       the dirty notes alone: ARI ${part.ari.toFixed(2)}, purity ${part.purity.toFixed(2)}, ` +
          `without a group ${percent(part.withoutGroup)}`,
      );
    }
    said(
      `       ${cost.neurons} neurons, ${cost.calls} calls, ${cost.inputTokens} + ${cost.outputTokens} tokens, ` +
        `${outcome.model}; ${outcome.runsLeft} runs left for this wall now, of six in 24 hours`,
    );
    for (const group of outcome.groups) {
      said(`       ${String(group.notes).padStart(4)}  ${group.title}  (${group.ofThat} of them ${group.mostly})`);
    }
    if (outcome.model === "stand-in") said("       the Worker's stand-in answered, not a model: this measures nothing");
  }
} catch (error) {
  failed = true;
  said(`failed: ${error.message}`);
} finally {
  await removeWall();
}
said(JSON.stringify(result));
process.exit(failed ? 1 : 0);
