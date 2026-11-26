#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// seed-wall.mjs: puts N notes on a wall, over the public API and the wall's socket, the way browsers do; with
// --groups also groups with the notes in them. It is for the measurement of the surface with a full wall (PLAN.md,
// stage 2: 500 notes, panning and zooming at 30 frames a second on the Pixel 5) and for screenshots, not a feature
// of the app.
//
//   node scripts/seed-wall.mjs <base address> <count> [wall id] [--groups <n>] [--loose <n>]
//   node scripts/seed-wall.mjs http://localhost:5173 500
//   node scripts/seed-wall.mjs http://localhost:5173 20 --groups 3 --loose 3
//
// Without a wall id it makes a wall and prints its address and its moderation link (open that one to delete the
// wall afterwards: „Mehr“ › „Wand löschen“). The wall it makes is an open one, without hidden writing: every browser
// gets every note at once, and groups can be made. With a wall id it adds to that wall; while that wall's notes are
// still hidden it takes the notes (each browser then sees a number, not the notes) and refuses the groups.
//
// --groups <n> makes n groups with titles, frames side by side, and spreads the notes over them in turn; --loose <n>
// leaves the last n notes without a group, in rows under the frames. Without --groups the notes lie in one block.
//
// What it costs: one row written per note, per group and per person it joins as, and one for the command that says
// which group each note lies in (PLAN.md 3.6); and the day's budget of walls when it makes one. A wall takes two
// frames a second from one socket after a burst of forty (apps/worker, wall-room.ts), so the script joins as
// several people, each sending no more than a burst holds: 500 notes are fourteen people, and done in a few
// seconds. Needs Node 22 (fetch and WebSocket are built in), nothing else.
import { randomBytes } from "node:crypto";

// the wall's limits, as packages/shared/src/protocol.ts states them
const MAX_NOTES = 500;
const MAX_GROUPS = 80;
const MAX_ONLINE = 30;
// a socket's burst is forty frames; one is the join, and one stays in hand
const PER_PERSON = 38;
// two browsers still fit on the wall beside the script's people
const MAX_PEOPLE = MAX_ONLINE - 2;
// a note is 240 units wide; the texts below take at most five lines, which is 152 units of height
const PITCH = { x: 256, y: 168 };
// a frame keeps 40 units for its title and 16 between its edge and its notes (apps/web, lib/surface/groups.ts);
// 32 units lie between two frames
const FRAME = { head: 40, pad: 16, gap: 32 };
const ANSWER_MS = 30_000;

const TEXTS = [
  "Weniger Termine",
  "Entscheidungen aufschreiben",
  "Der Build dauert zu lange",
  "Wer ist wofür zuständig?",
  "Zwei Ticket-Systeme nebeneinander: eins davon abschalten",
  "Jeden Montag eine halbe Stunde planen, statt jeden Tag eine Viertelstunde",
  "Fokuszeit am Vormittag, ohne Nachrichten",
  "Kundengespräche für alle mitschneiden und teilen",
  "Dokumentation dort, wo der Code liegt",
  "Mehr Pausen",
];

const TITLES = ["Abstimmung", "Werkzeuge", "Fokus", "Wissen teilen", "Planung", "Kundschaft", "Pausen", "Technik"];

const fail = (message) => {
  process.stderr.write(`seed-wall: ${message}\n`);
  process.exit(1);
};
const hex = (bytes) => randomBytes(bytes).toString("hex");

const USAGE = "usage: node scripts/seed-wall.mjs <base address> <count> [wall id] [--groups <n>] [--loose <n>]";
// the options and their numbers; what is left are the address, the count and the wall
const given = process.argv.slice(2);
const options = { groups: 0, loose: 0 };
const plain = [];
for (let n = 0; n < given.length; n++) {
  const name = given[n].startsWith("--") ? given[n].slice(2) : null;
  if (name === null) plain.push(given[n]);
  else if (name in options && /^\d+$/.test(given[n + 1] ?? "")) options[name] = Number(given[++n]);
  else fail(USAGE);
}
const [base, countArg, givenWall] = plain;
const count = Number(countArg);
if (!base || !Number.isInteger(count) || count < 1 || plain.length > 3) fail(USAGE);
if (count > MAX_NOTES) fail(`a wall holds ${MAX_NOTES} notes at most`);
if (givenWall !== undefined && !/^[0-9a-f]{64}$/.test(givenWall)) fail("the wall id is 64 hex digits");
if (options.groups > MAX_GROUPS) fail(`a wall holds ${MAX_GROUPS} groups at most`);
if (options.loose > 0 && options.groups === 0) fail("--loose leaves notes out of the groups: it needs --groups");
if (options.loose > count) fail(`--loose ${options.loose} is more than the ${count} notes`);
const people = Math.ceil(count / PER_PERSON);
if (people > MAX_PEOPLE) fail(`${count} notes need ${people} people, more than fit on a wall`);

const origin = new URL(base).origin;

/** Makes a wall and returns its id and admin token. */
async function makeWall() {
  const response = await fetch(`${origin}/api/walls`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // open from the start: a wall with hidden writing shows nobody the notes of the script's people, and has no
    // groups until its moderation reveals (packages/shared, domain/rules.ts)
    body: JSON.stringify({ question: `Messung: ${count} Zettel`, hidden: false }),
  });
  if (response.status === 429) fail("no wall was made: the limit per address or the day's budget of walls is spent");
  if (!response.ok) fail(`no wall was made: ${response.status}`);
  return response.json();
}

/** A note at a place, as the command that makes it. */
const noteAt = (n, x, y) => ({
  type: "note.create",
  opId: hex(16),
  noteId: hex(16),
  text: `${n + 1}. ${TEXTS[n % TEXTS.length]}`,
  x,
  y,
});

/** The notes with their places: a block of columns around the world's origin, where an empty wall looks. */
function plan() {
  const columns = Math.ceil(Math.sqrt((count * PITCH.y) / PITCH.x) * 1.3);
  const rows = Math.ceil(count / columns);
  const left = -Math.round((columns * PITCH.x) / 2);
  const top = -Math.round((rows * PITCH.y) / 2);
  return Array.from({ length: count }, (_, n) =>
    noteAt(n, left + (n % columns) * PITCH.x, top + Math.floor(n / columns) * PITCH.y),
  );
}

/** The notes in groups: frames of one size side by side (up to four in a row, more in rows of about as many as
 *  there are rows), each with its notes in columns under its title; the notes left out in rows under the frames.
 *  Returns the notes, the groups, and which group each note lies in. */
function planGroups() {
  const grouped = count - options.loose;
  const most = Math.ceil(grouped / options.groups);
  const columns = Math.max(2, Math.ceil(Math.sqrt((most * PITCH.y) / PITCH.x)));
  const lines = Math.max(1, Math.ceil(most / columns));
  // the room between two notes is part of the pitch: the last column and the last row give theirs to the edge
  const size = { w: columns * PITCH.x + FRAME.pad, h: FRAME.head + lines * PITCH.y };
  const perRow = options.groups <= 4 ? options.groups : Math.ceil(Math.sqrt(options.groups));
  const frameRows = Math.ceil(options.groups / perRow);
  const width = perRow * (size.w + FRAME.gap) - FRAME.gap;
  const height = frameRows * (size.h + FRAME.gap) - FRAME.gap;
  const left = -Math.round(width / 2);
  const top = -Math.round(height / 2);
  const groups = Array.from({ length: options.groups }, (_, g) => ({
    type: "group.create",
    opId: hex(16),
    groupId: hex(16),
    title: TITLES[g % TITLES.length] + (g < TITLES.length ? "" : ` ${Math.floor(g / TITLES.length) + 1}`),
    x: left + (g % perRow) * (size.w + FRAME.gap),
    y: top + Math.floor(g / perRow) * (size.h + FRAME.gap),
    ...size,
  }));
  const notes = [];
  const moves = [];
  for (let n = 0; n < grouped; n++) {
    const group = groups[n % options.groups];
    const at = Math.floor(n / options.groups);
    const note = noteAt(
      n,
      group.x + FRAME.pad + (at % columns) * PITCH.x,
      group.y + FRAME.head + Math.floor(at / columns) * PITCH.y,
    );
    notes.push(note);
    moves.push({ noteId: note.noteId, x: note.x, y: note.y, groupId: group.groupId });
  }
  const looseColumns = Math.max(1, Math.floor((width + PITCH.x - 240) / PITCH.x));
  for (let n = 0; n < options.loose; n++) {
    notes.push(
      noteAt(
        grouped + n,
        left + (n % looseColumns) * PITCH.x,
        top + height + 2 * FRAME.gap + Math.floor(n / looseColumns) * PITCH.y,
      ),
    );
  }
  return { notes, groups, moves };
}

/** One person: joins the wall, sends their commands (notes, groups, the one that says which group each note lies
 *  in), and leaves once the wall has answered every one of them. */
function write(wallId, name, notes) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${origin.replace(/^http/, "ws")}/api/walls/${wallId}/ws`);
    const waiting = new Set(notes.map((note) => note.opId));
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
      socket.send(JSON.stringify({ type: "join", name, sessionKey: hex(16) }));
    });
    socket.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data));
      if (frame.type === "sync") {
        for (const note of notes) socket.send(JSON.stringify(note));
      } else if (frame.type === "ack") {
        waiting.delete(frame.opId);
        if (waiting.size === 0) stop();
      } else if (frame.type === "reject" && frame.code === "PHASE") {
        stop(new Error(`${name}: the wall's notes are still hidden, and a hidden wall has no groups: reveal it first`));
      } else if (frame.type === "reject" || frame.type === "error") {
        stop(new Error(`${name}: the wall answered ${frame.type} ${frame.code}`));
      } else if (frame.type === "wall.deleted") {
        stop(new Error("the wall was deleted"));
      }
    });
    socket.addEventListener("error", () => stop(new Error(`${name}: the socket failed`)));
  });
}

const made = givenWall === undefined ? await makeWall() : null;
const wallId = givenWall ?? made.wallId;
const { notes, groups, moves } = options.groups > 0 ? planGroups() : { notes: plan(), groups: [], moves: [] };
// names are one per wall: a run of its own gets names of its own
const run = hex(2);
const started = Date.now();
try {
  await Promise.all(
    Array.from({ length: people }, (_, n) =>
      write(wallId, `Seed ${run} ${String(n + 1).padStart(2, "0")}`, notes.slice(n * PER_PERSON, (n + 1) * PER_PERSON)),
    ),
  );
  // The groups come once the notes lie there, made by people of their own, one after the other so they stand in
  // their order; the last of them says in one command which group each note lies in (a note is made without one).
  const sorting = moves.length > 0 ? [{ type: "notes.move", opId: hex(16), moves }] : [];
  const makers = Math.ceil(groups.length / (PER_PERSON - 1));
  for (let n = 0; n < makers; n++) {
    const own = groups.slice(n * (PER_PERSON - 1), (n + 1) * (PER_PERSON - 1));
    await write(wallId, `Seed ${run} G${n + 1}`, n === makers - 1 ? [...own, ...sorting] : own);
  }
} catch (error) {
  fail(`${error.message}. The wall is at ${origin}/w/${wallId}`);
}
process.stdout.write(
  [
    `${count} notes written by ${people} people in ${((Date.now() - started) / 1000).toFixed(1)} s` +
      (groups.length > 0 ? `, ${moves.length} of them in ${groups.length} groups` : ""),
    `wall:       ${origin}/w/${wallId}`,
    ...(made ? [`moderation: ${origin}/w/${wallId}#admin=${made.adminToken}`] : []),
    "",
  ].join("\n"),
);
