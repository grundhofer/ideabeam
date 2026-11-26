#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// measure-key.mjs: measures „Ordnen“ with a key of one's own (PLAN.md 4.5, stage 4b): the notes of a test board,
// arranged by a provider of the list, and the proposal held against the themes the corpus knows. It runs the same
// code the moderation's browser runs (apps/web/src/lib/key-run.ts, with the prompts, the run and the check of
// @ideabeam/arrange), in Node: what is measured here is what the product does. No wall is made and the product's
// server is not involved.
//
//   <KEY>=… node scripts/measure-key.mjs mistral|openai|anthropic [--board onboarding|stadtteil|both] [--limit <n>]
//                                        [--lang de|en] [--dirty mixed|only] [--runs <n>] [--seed <n>] [--model <id>]
//   node scripts/measure-key.mjs --selftest
//
// **The key** comes from the environment and from nowhere else, one variable per provider: MISTRAL_API_KEY,
// OPENAI_API_KEY, ANTHROPIC_API_KEY. It is never taken as an argument (arguments end up in the shell's history and
// in the list of processes) and never printed. It goes to the provider it belongs to, in the header of each call.
//
//   --board   the test board of docs/messung/korpus.json: 250 notes in five themes, half German, half English.
//             `both`: the two boards as one, 500 notes in ten themes, under the first board's question
//   --limit   only the first n notes of the shuffled board: a small wall
//   --lang    the language of the titles; the question is asked in the same
//   --dirty   the corpus's dirty notes of the board, 30 of them: single words, typos, emoji. `mixed` adds them to
//             the board's notes, `only` arranges them alone
//   --runs    how often the same notes are arranged, to see how much a run differs from the next
//   --seed    the order of the notes (the corpus lists them theme by theme)
//   --model   another model than the one the provider's entry names (packages/arrange/src/providers.ts)
//   --base    for trying the script out: every call goes to this address instead of the provider's, with the same
//             path. Only an address of this machine is taken (127.0.0.1, localhost): a key never goes to a host
//             that a typing mistake names. What answers there is no provider, and nothing is measured
//
// What it says for every run, as scripts/measure-arrange.mjs does for the Worker: how long the run took, the
// groups with their titles and sizes, and against the corpus's themes the Adjusted Rand Index (1: as the corpus,
// 0: chance), the purity (the share of notes that lie with the majority theme of their group) and the share of
// notes without a group; for --dirty mixed the same for the dirty notes alone; and the calls and tokens, as the
// provider counted them. A note without a group counts as a group of its own. The last line is the whole result
// as JSON, for docs/. A model belongs in the list people see once it reaches ARI 0.7 on the two boards (PLAN.md
// 4.5): then its entry gets `measured: true`.
//
// What it costs: the provider bills the key's account for every call. A wall of 250 notes is six calls, about
// 15,000 tokens read and 1,500 written, more for a model that thinks.
//
// How it loads the product's code: that code is TypeScript, and its packages import each other in the way a
// bundler resolves, which Node alone does not. esbuild, which the web app has through wrangler, bundles the one
// file into memory, and Node imports the result. Nothing is written to disk, and no further tool is needed: run
// `pnpm install` once. Needs Node 22.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// how long the app waits for a run before it gives up and ends every call (apps/web/src/store/arrange.ts,
// ARRANGE_WAIT_MS): a run that takes longer gives no proposal in the product either
const RUN_LIMIT_MS = 120_000;
// the wall's limits, as packages/shared/src/protocol.ts states them
const MAX_NOTES = 500;
const NOTE_TEXT_MAX = 300;
// the names of the keys' variables, as the usage text states them; the provider list is held against them below
const KEYS = { mistral: "MISTRAL_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };

const USAGE =
  "usage: <KEY>=… node scripts/measure-key.mjs mistral|openai|anthropic [--board onboarding|stadtteil|both] " +
  "[--limit <n>] [--lang de|en] [--dirty mixed|only] [--runs <n>] [--seed <n>] [--model <id>]\n" +
  "       node scripts/measure-key.mjs --selftest\n" +
  "the key is read from the environment, never from an argument: " +
  Object.entries(KEYS)
    .map(([provider, name]) => `${name} for ${provider}`)
    .join(", ");

const fail = (message) => {
  process.stderr.write(`measure-key: ${message}\n`);
  process.exit(1);
};
const hex = (bytes) => randomBytes(bytes).toString("hex");

// ───────────────────────── the score (as in scripts/measure-arrange.mjs) ─────────────────────────

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

/** How a proposal compares with the themes the corpus knows. `notes` are the notes with their theme; `proposal` is
 *  the run's. A note without a group is a group of its own for the index, and counts against the purity. */
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

// ───────────────────────── the product's code ─────────────────────────

/** The run the browser makes and the list of providers, bundled from the product's TypeScript into memory. */
async function product() {
  const web = createRequire(new URL("../apps/web/package.json", import.meta.url));
  let esbuild;
  try {
    // wrangler is the web app's own dependency and brings esbuild as its bundler
    esbuild = createRequire(web.resolve("wrangler"))("esbuild");
  } catch {
    fail("esbuild was not found through apps/web: run `pnpm install` first");
  }
  const built = await esbuild.build({
    stdin: {
      contents:
        'export { runWithKey } from "./src/lib/key-run.ts";\n' +
        'export { PROVIDERS, modelOf } from "@ideabeam/arrange";\n',
      resolveDir: fileURLToPath(new URL("../apps/web/", import.meta.url)),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    write: false,
    logLevel: "silent",
  });
  const code = Buffer.from(built.outputFiles[0].contents).toString("base64");
  return import(`data:text/javascript;base64,${code}`);
}

/** Holds the score's arithmetic against partitions whose values are known, and loads the product's code. No
 *  network. */
async function selftest() {
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
  process.stdout.write("measure-key: the score's arithmetic holds\n");
  // the product's code loads, and its list of providers names the variables the usage text names
  const { PROVIDERS, runWithKey } = await product();
  if (typeof runWithKey !== "function") fail("selftest: the product's run did not load");
  for (const provider of PROVIDERS) {
    if (KEYS[provider.id] !== provider.keyEnv) {
      fail(`selftest: the key of ${provider.id} is ${provider.keyEnv} in the product and ${KEYS[provider.id]} here`);
    }
  }
  if (PROVIDERS.length !== Object.keys(KEYS).length) fail("selftest: the product's list of providers is another");
  process.stdout.write(
    `measure-key: the product's code loads: ${PROVIDERS.map((provider) => `${provider.id} (${provider.model})`).join(", ")}\n`,
  );
}

// ───────────────────────── the options ─────────────────────────

const given = process.argv.slice(2);
if (given.includes("--selftest")) {
  await selftest();
  process.exit(0);
}
const options = {
  board: "onboarding",
  limit: "0",
  lang: "de",
  dirty: "none",
  runs: "1",
  seed: "1",
  model: "",
  base: "",
};
const plain = [];
for (let n = 0; n < given.length; n++) {
  const name = given[n].startsWith("--") ? given[n].slice(2) : null;
  if (name === null) plain.push(given[n]);
  else if (name in options && given[n + 1] !== undefined) options[name] = given[++n];
  else fail(USAGE);
}
// (an argument that is no provider is not echoed: somebody may have put a key there)
if (plain.length !== 1 || !(plain[0] in KEYS)) fail(USAGE);
const providerId = plain[0];
const [limit, runs, seed] = [Number(options.limit), Number(options.runs), Number(options.seed)];
if (!["de", "en"].includes(options.lang)) fail("--lang is de or en");
if (!["none", "mixed", "only"].includes(options.dirty)) fail("--dirty is mixed or only");
if (!Number.isInteger(limit) || limit < 0) fail("--limit is a number of notes");
if (!Number.isInteger(runs) || runs < 1 || runs > 20) fail("--runs is 1 to 20");
if (!Number.isInteger(seed)) fail("--seed is a whole number");
let base = null;
if (options.base !== "") {
  try {
    base = new URL(options.base);
  } catch {
    fail("--base is an address");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || !/^https?:$/.test(base.protocol)) {
    fail("--base takes an address of this machine only (127.0.0.1 or localhost): the key goes with every call");
  }
}
const key = (process.env[KEYS[providerId]] ?? "").trim();
if (key === "") fail(`set ${KEYS[providerId]} to a key of ${providerId}: the key is read from the environment alone`);

// ───────────────────────── the notes ─────────────────────────

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

// ───────────────────────── the runs ─────────────────────────

const { runWithKey, PROVIDERS, modelOf } = await product();
const provider = PROVIDERS.find((one) => one.id === providerId);
if (provider === undefined || provider.keyEnv !== KEYS[providerId]) {
  fail(`the product's list of providers does not match this script's for ${providerId}`);
}
const model = modelOf(provider, options.model).id;

/** With --base: the `fetch` every call goes through, which leads to the stand-in on this machine. */
const standIn =
  base === null
    ? undefined
    : (input, init) => {
        const asked = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        return fetch(new URL(asked.pathname + asked.search, base), init);
      };

const percent = (share) => `${(share * 100).toFixed(1)} %`;
const said = (line) => process.stdout.write(`${line}\n`);
// whatever is printed, the key is not in it: a line that held it would not be written
const safe = (line) => (line.includes(key) ? fail("a line of the output held the key: nothing was printed") : line);

let stop = new AbortController();
// Ctrl-C ends the run and every call that is out
process.once("SIGINT", () => {
  said("interrupted");
  stop.abort();
  process.exit(130);
});

/** One run: the product's run with the key, how long it took, and how the proposal compares with the corpus. */
async function arrange() {
  stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), RUN_LIMIT_MS);
  const started = performance.now();
  const seconds = () => Math.round((performance.now() - started) / 100) / 10;
  let run;
  try {
    run = await runWithKey(
      { provider: providerId, key },
      {
        question: board.question[options.lang],
        notes: notes.map((note) => ({ id: note.noteId, text: note.text })),
        language: options.lang,
      },
      stop.signal,
      { model: options.model === "" ? undefined : options.model, fetch: standIn },
    );
  } catch {
    // the run was ended: after the time the app waits
    return { ok: false, seconds: seconds(), why: "TIMEOUT" };
  } finally {
    clearTimeout(timer);
  }
  if (!run.ok) return { ok: false, seconds: seconds(), why: run.why, usage: run.usage };
  const themeOf = new Map(notes.map((note) => [note.noteId, note.theme]));
  const groups = run.proposal.groups.map((group) => {
    const counts = new Map();
    for (const noteId of group.noteIds) counts.set(themeOf.get(noteId), (counts.get(themeOf.get(noteId)) ?? 0) + 1);
    const [theme, most] = [...counts].sort((a, b) => b[1] - a[1])[0];
    return { title: group.title, notes: group.noteIds.length, mostly: theme, ofThat: most };
  });
  return {
    ok: true,
    seconds: seconds(),
    groups,
    all: score(notes, run.proposal),
    ...(options.dirty === "mixed"
      ? {
          dirty: score(
            notes.filter((note) => note.dirty),
            run.proposal,
          ),
        }
      : {}),
    usage: run.usage,
    partial: run.partial,
  };
}

const result = {
  provider: providerId,
  model,
  ...(base === null ? {} : { standIn: base.origin }),
  at: new Date().toISOString(),
  board: board.id,
  notes: notes.length,
  dirty: options.dirty,
  language: options.lang,
  seed,
  runs: [],
};
let failed = false;
said(
  `${board.id}: ${notes.length} notes for ${provider.name}, ${model}` +
    (options.dirty === "none" ? "" : `, ${notes.filter((note) => note.dirty).length} of them dirty`) +
    (base === null ? "" : `; every call goes to ${base.origin}, not to ${provider.origin}`),
);
for (let n = 1; n <= runs; n++) {
  const outcome = await arrange();
  result.runs.push(outcome);
  if (!outcome.ok) {
    failed = true;
    said(safe(`run ${n}: no proposal after ${outcome.seconds} s: ${outcome.why}`));
    // the key, the account or the request's shape: the next run would end the same way
    if (["KEY_REFUSED", "NO_CREDIT", "REJECTED"].includes(outcome.why)) break;
    continue;
  }
  const { all, usage } = outcome;
  said(
    safe(
      `run ${n}: ${outcome.seconds} s, ${outcome.groups.length} groups, ARI ${all.ari.toFixed(2)}, purity ` +
        `${all.purity.toFixed(2)}, without a group ${percent(all.withoutGroup)}${outcome.partial ? " (partial)" : ""}`,
    ),
  );
  if (outcome.dirty !== undefined) {
    const part = outcome.dirty;
    said(
      `       the dirty notes alone: ARI ${part.ari.toFixed(2)}, purity ${part.purity.toFixed(2)}, ` +
        `without a group ${percent(part.withoutGroup)}`,
    );
  }
  said(
    safe(
      `       ${usage.calls} calls (${usage.failed} without an answer, ${usage.hedged} beside a slow one), ` +
        `${usage.inputTokens} + ${usage.outputTokens} tokens as ${provider.name} counted them, ${model}`,
    ),
  );
  for (const group of outcome.groups) {
    said(safe(`       ${String(group.notes).padStart(4)}  ${group.title}  (${group.ofThat} of them ${group.mostly})`));
  }
  if (base !== null) said("       a stand-in answered, not a provider: this measures nothing");
}
said(safe(JSON.stringify(result)));
process.exit(failed ? 1 : 0);
