// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// load-test.mjs: many walls at once, each living through what a real wall does, against a deployed Worker (the
// preview). It talks to the Worker as browsers would; it needs no login and no token.
//
//   node scripts/load-test.mjs https://<worker>.<subdomain>.workers.dev [--walls 5] [--people 5] [--notes 5]
//                              [--moves 3] [--minutes 30] [--budget <the Worker's DAILY_WALLS>]
//
// What a wall lives through: its people join (the first with the admin token, as the moderation), each writes
// --notes notes, one at a time over the first 40 % of the wall's --minutes; then the second person makes a group by
// hand, and over the next 30 % each person moves --moves of their notes, one movement a frame, the first of them into
// that group. From the join to the end every socket sends the heartbeat the browser sends ("ping" every 30 s,
// apps/web/src/lib/socket.ts) and, after its last movement, nothing else. At the end the moderation deletes the wall
// (`admin.wall.delete`), so nothing of the test stays stored: also when something in the wall failed, and also on
// Ctrl-C (a second Ctrl-C stops at once). The ids of walls it could not delete are printed; they delete themselves 30
// days after the last join.
//
// The Worker's brakes (apps/worker/src/index.ts): ten walls at once from one address, then ten a minute; so walls are
// made ten at once and then one every 6.5 s, and a refusal waits as long as the Worker says. And the day's budget of
// walls (DAILY_WALLS): the script reads it from apps/worker/wrangler.jsonc, or for a local address from
// apps/worker/.dev.vars, unless --budget names the deployed Worker's own. The default is a fifth of it, ten at most;
// more than the budget is refused, more than half of it is warned about. Walls made earlier today count against it
// too, and the script cannot see them: when the Worker answers BUDGET_SPENT, no further wall is tried.
//
// What it says at the end: how many walls, connections, frames and answers there were, how long a command waited
// for its `ack`, and what went wrong. What it cannot see is what the run cost: read that for the minutes it prints
// with scripts/cloudflare-metrics.mjs (the object's awake time, the requests, the rows).
//
// It spends real allowance of the account the Worker runs in: one of the day's walls per wall, and by the model of
// apps/worker/test/cost.test.ts 19 rows written for making the wall (the day's count included), 2 per person and 1
// per note, movement and group: about 70 per wall with the defaults, and what its deletion writes, which that test
// does not count.
import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const [base, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = rest.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(rest[at + 1]);
};
const usage =
  "usage: node scripts/load-test.mjs https://<worker address> [--walls 5] [--people 5] [--notes 5] [--moves 3] " +
  "[--minutes 30] [--budget <DAILY_WALLS>]";
const refuse = (why) => {
  console.error(why ? `${why}\n${usage}` : usage);
  process.exit(2);
};
if (!base || !/^https?:\/\//.test(base)) refuse();
const origin = new URL(base).origin;
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(origin).hostname);

// the wall's limits, as packages/shared/src/protocol.ts states them
const MAX_ONLINE = 30;
const MAX_NOTES = 500;
// the browser's heartbeat (apps/web/src/lib/socket.ts)
const HEARTBEAT_MS = 30_000;
// the rows the cost test counts (apps/worker/test/cost.test.ts): for making the wall (the day's count included) and
// per person; one more per note, movement and group. What a deletion writes, the test does not count.
const ROWS = { wall: 19, person: 2 };

/** The day's budget of walls the script can know about: --budget, or the number the repository gives the Worker. */
function knownBudget() {
  const given = flag("budget", null);
  if (given !== null) return { walls: given, from: "--budget" };
  const file = new URL(local ? "../apps/worker/.dev.vars" : "../apps/worker/wrangler.jsonc", import.meta.url);
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const found = (local ? /^DAILY_WALLS=(\d+)/m : /"DAILY_WALLS":\s*"(\d+)"/).exec(text)?.[1];
  // the Worker's own fallback (packages/shared/src/domain/budget.ts) where a deployment names none
  if (found === undefined) return { walls: 80, from: "the shared rules' default (no number found in the repository)" };
  return { walls: Number(found), from: local ? "apps/worker/.dev.vars" : "apps/worker/wrangler.jsonc" };
}

const BUDGET = knownBudget();
const WALLS = flag("walls", Math.min(10, Math.max(1, Math.floor(BUDGET.walls / 5))));
const PEOPLE = flag("people", 5);
const NOTES = flag("notes", 5);
const MOVES = flag("moves", 3);
const MINUTES = flag("minutes", 30);
if (![BUDGET.walls, WALLS, PEOPLE, NOTES, MOVES].every((n) => Number.isInteger(n) && n >= 0)) refuse();
if (!Number.isFinite(MINUTES) || MINUTES <= 0 || WALLS < 1 || PEOPLE < 1 || NOTES < 1) refuse();
if (PEOPLE > MAX_ONLINE) refuse(`A wall takes ${MAX_ONLINE} people at once.`);
if (PEOPLE * NOTES > MAX_NOTES) refuse(`A wall holds ${MAX_NOTES} notes: ${PEOPLE} people with ${NOTES} each is more.`);
if (WALLS > BUDGET.walls) {
  refuse(
    `${WALLS} walls are more than the day's budget of ${BUDGET.walls} (${BUDGET.from}). If the Worker has another ` +
      "number, name it with --budget.",
  );
}

const hex = (bytes) => randomBytes(bytes).toString("hex");
const stamp = () => new Date().toISOString();
const message = (error) => (error instanceof Error ? error.message : String(error));
const SESSION_MS = MINUTES * 60_000;

// Ctrl-C ends every wall early, and each is deleted on its way out; a second Ctrl-C stops at once.
let stopping = false;
const sleepers = new Set();
/** Waits, unless the test is stopping: then it returns at once. */
const sleep = (ms) =>
  new Promise((resolve) => {
    if (stopping) return resolve();
    const done = () => {
      clearTimeout(timer);
      sleepers.delete(done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    sleepers.add(done);
  });

const count = {
  walls: 0,
  /** how long the walls stood, from their making to the moderation's deletion, added up */
  wallMs: 0,
  sockets: 0,
  frames: 0,
  notes: 0,
  moves: 0,
  groups: 0,
  acks: 0,
  rejects: 0,
  eventsIn: 0,
  pings: 0,
  pongs: 0,
  closedEarly: 0,
  budgetSpent: false,
  problems: [],
};
/** how long a command waited for its `ack`, per command, in ms */
const waited = [];
/** walls made and not yet seen deleted: id → label */
const standing = new Map();
const problem = (what) => {
  count.problems.push(what);
  console.error(stamp(), "problem:", what);
};

process.on("SIGINT", () => {
  if (stopping) {
    console.error("\nStopped. Walls NOT deleted:", [...standing.keys()].join(" ") || "none");
    process.exit(1);
  }
  stopping = true;
  console.error("\nStopping: every wall is deleted now (Ctrl-C again stops at once).");
  for (const wake of [...sleepers]) wake();
});

/** A wall on the Worker, or null when the day's budget is spent. A refusal by the brake waits as long as the Worker
 *  says. */
async function makeWall(question) {
  for (let attempt = 0; attempt < 20 && !stopping; attempt++) {
    if (count.budgetSpent) return null;
    const response = await fetch(`${origin}/api/walls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (response.ok) return response.json();
    const body = await response.text();
    if (response.status === 429 && body.includes("BUDGET_SPENT")) {
      count.budgetSpent = true;
      return null;
    }
    if (response.status !== 429) throw new Error(`the wall was not made: ${response.status} ${body}`);
    await sleep((Number(response.headers.get("retry-after")) || 6) * 1000);
  }
  if (stopping) return null;
  throw new Error("refused by the brake twenty times");
}

/** A person on a wall: a socket that has joined, with the heartbeat a browser sends. */
function join(wallId, name, sessionKey, adminToken) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${origin.replace(/^http/, "ws")}/api/walls/${wallId}/ws`);
    const waiting = new Map();
    const person = { ws, name, done: false, joined: false, beat: null };
    const fail = setTimeout(() => reject(new Error(`${name}: no answer from the wall within 15 s`)), 15_000);
    person.ask = (command) =>
      new Promise((answered, refused) => {
        const opId = hex(16);
        const timer = setTimeout(() => refused(new Error(`${name}: no answer to ${command.type} within 15 s`)), 15_000);
        waiting.set(opId, { answered, refused, timer, sentAt: Date.now() });
        count.frames += 1;
        ws.send(JSON.stringify({ ...command, opId }));
      });
    ws.addEventListener("open", () => {
      count.frames += 1;
      ws.send(JSON.stringify({ type: "join", name, sessionKey, ...(adminToken ? { adminToken } : {}) }));
    });
    ws.addEventListener("message", (incoming) => {
      if (incoming.data === "pong") {
        count.pongs += 1;
        return;
      }
      count.eventsIn += 1;
      const event = JSON.parse(String(incoming.data));
      if (event.type === "sync") {
        clearTimeout(fail);
        person.joined = true;
        person.beat = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          count.pings += 1;
          ws.send("ping");
        }, HEARTBEAT_MS);
        resolve(person);
      } else if (event.type === "ack" || event.type === "reject") {
        const asked = waiting.get(event.opId);
        if (!asked) return;
        waiting.delete(event.opId);
        clearTimeout(asked.timer);
        if (event.type === "ack") {
          count.acks += 1;
          waited.push(Date.now() - asked.sentAt);
          asked.answered();
        } else {
          count.rejects += 1;
          asked.refused(new Error(`${name}: the wall refused ${event.code}`));
        }
      } else if (event.type === "error") {
        // before the `sync` it is the answer to the join (NAME_TAKEN, WALL_FULL), and the join's caller counts it
        if (person.joined) problem(`${name}: the wall answered ${event.code}`);
        else reject(new Error(`${name}: the wall answered ${event.code}`));
      }
    });
    ws.addEventListener("close", (event) => {
      clearInterval(person.beat);
      if (!person.done) {
        count.closedEarly += 1;
        // a browser would connect again by itself (apps/web/src/lib/socket.ts); this socket does not
        problem(`${name}: the connection closed before the test was over (code ${event.code}, „${event.reason}“)`);
      }
    });
    ws.addEventListener("error", () => reject(new Error(`${name}: the socket failed`)));
  });
}

/** What one person does on the wall, from the first note to the last movement. A failure ends this person's part
 *  and is counted; the others go on. */
async function act(label, person, index, started, group) {
  const notes = [];
  try {
    // writing, over the first 40 % of the wall's time, each person at their own pace
    const gap = (SESSION_MS * 0.4) / NOTES;
    await sleep(Math.random() * gap);
    for (let n = 0; n < NOTES && !stopping; n++) {
      const noteId = hex(16);
      await person.ask({
        type: "note.create",
        noteId,
        text: `Idee ${n + 1} von ${person.name} im Lasttest`,
        // the wall's notes in a grid of twenty columns, well inside the surface's limits
        x: ((index * NOTES + n) % 20) * 256,
        y: Math.floor((index * NOTES + n) / 20) * 168,
      });
      count.notes += 1;
      notes.push(noteId);
      await sleep(gap);
    }
    // arranging, over the next 30 %: the second person makes the group, then everyone moves their notes
    await sleep(started + SESSION_MS * 0.4 - Date.now());
    if (group.maker === person) {
      try {
        if (!stopping) {
          await person.ask({
            type: "group.create",
            groupId: group.id,
            title: "Lasttest",
            x: -2000,
            y: -2000,
            w: 1200,
            h: 800,
          });
          count.groups += 1;
          group.made = true;
        }
      } finally {
        group.settle();
      }
    }
    await group.ready;
    const moveGap = (SESSION_MS * 0.3) / Math.max(1, MOVES);
    await sleep(Math.random() * moveGap);
    for (let m = 0; m < MOVES && !stopping && notes.length > 0; m++) {
      const noteId = notes[m % notes.length];
      // the first movement takes a note into the group, once there is one; the others put it somewhere else
      const into = m === 0 && group.made;
      const move = into
        ? { noteId, x: -2000 + 16 + (index % 4) * 256, y: -2000 + 16 + Math.floor(index / 4) * 168, groupId: group.id }
        : { noteId, x: (index % 20) * 256 + 64 * ((m % 3) + 1), y: 8000 + (m % 200) * 168, groupId: null };
      await person.ask({ type: "notes.move", moves: [move] });
      count.moves += 1;
      await sleep(moveGap);
    }
  } catch (error) {
    problem(`${label}: ${message(error)}`);
  } finally {
    // whatever ended the group's maker, the others do not wait for the group any longer
    if (group.maker === person) group.settle();
  }
}

/** One wall from its creation to its deletion. Resolves when it is gone; a failure is counted, not thrown, and the
 *  wall is deleted all the same: nothing of the test stays stored. */
async function live(index) {
  const label = `Wand ${index + 1}`;
  let wall = null;
  const people = [];
  const admin = { name: "Person 1", sessionKey: hex(16) };
  let opened = 0;
  try {
    wall = await makeWall(`Lasttest ${index + 1}: was machen wir anders?`);
    if (wall === null) {
      if (count.budgetSpent) problem(`${label}: not made, the day's budget of walls is spent (BUDGET_SPENT)`);
      return;
    }
    standing.set(wall.wallId, label);
    count.walls += 1;
    const started = Date.now();
    opened = started;
    for (let n = 0; n < PEOPLE && !stopping; n++) {
      people.push(
        n === 0
          ? await join(wall.wallId, admin.name, admin.sessionKey, wall.adminToken)
          : await join(wall.wallId, `Person ${n + 1}`, hex(16)),
      );
      count.sockets += 1;
    }
    const group = { id: hex(16), maker: people[Math.min(1, people.length - 1)], made: false };
    group.ready = new Promise((resolve) => (group.settle = resolve));
    await Promise.all(people.map((person, n) => act(`${label}, ${person.name}`, person, n, started, group)));
    // the rest of the wall's time: nobody does anything but the heartbeat
    await sleep(started + SESSION_MS - Date.now());
  } catch (error) {
    problem(`${label}: ${message(error)}`);
  }
  if (wall === null) return;
  // the wall goes, whatever happened on it: through the moderation's socket, or a new one that joins as the same
  // person with the admin token
  for (const person of people) person.done = true;
  try {
    const [first] = people;
    const moderation =
      first?.ws.readyState === WebSocket.OPEN
        ? first
        : await join(wall.wallId, admin.name, admin.sessionKey, wall.adminToken);
    moderation.done = true;
    await moderation.ask({ type: "admin.wall.delete" });
    await new Promise((resolve) => setTimeout(resolve, 500));
    for (const person of [...people, moderation]) person.ws.close();
    count.wallMs += Date.now() - opened;
    const gone = await fetch(`${origin}/api/walls/${wall.wallId}`);
    if (gone.status === 404) standing.delete(wall.wallId);
    else problem(`${label}: still there after its deletion (${gone.status}): ${wall.wallId}`);
  } catch (error) {
    problem(`${label} was not deleted (${wall.wallId}): ${message(error)}`);
  }
}

const startedAt = new Date();
console.log(
  stamp(),
  `${WALLS} walls of ${PEOPLE} people, ${NOTES} notes and ${MOVES} movements each, ${MINUTES} minutes a wall, ` +
    `against ${origin}`,
);
console.log(stamp(), `the day's budget the script knows: ${BUDGET.walls} walls (${BUDGET.from})`);
if (WALLS > BUDGET.walls / 2) {
  console.warn(
    stamp(),
    `WARNING: ${WALLS} walls take more than half of the day's ${BUDGET.walls}: whoever else uses this Worker today ` +
      "may find none left.",
  );
}
const walls = [];
for (let index = 0; index < WALLS && !stopping && !count.budgetSpent; index++) {
  walls.push(live(index));
  // ten at once, then ten a minute: what the Worker's brake allows from one address
  if (index >= 9) await sleep(6_500);
}
console.log(stamp(), "every wall is on its way; waiting for them to end");
const report = setInterval(
  () =>
    console.log(
      stamp(),
      `walls ${count.walls}, connections ${count.sockets}, notes ${count.notes}, movements ${count.moves}, ` +
        `problems ${count.problems.length}`,
    ),
  5 * 60_000,
);
await Promise.all(walls);
clearInterval(report);
const endedAt = new Date();

waited.sort((a, b) => a - b);
const at = (share) => (waited.length ? waited[Math.min(waited.length - 1, Math.floor(waited.length * share))] : null);
const rows = count.walls * ROWS.wall + count.sockets * ROWS.person + count.notes + count.moves + count.groups;
console.log("");
console.log(
  "From",
  startedAt.toISOString(),
  "to",
  endedAt.toISOString(),
  `(${((endedAt - startedAt) / 60_000).toFixed(1)} minutes)`,
);
console.log(
  `Walls made: ${count.walls} of ${WALLS}${count.budgetSpent ? " (the day's budget ran out)" : ""}. ` +
    `Connections: ${count.sockets} of ${count.walls * PEOPLE}; closed before the end: ${count.closedEarly}.`,
);
console.log(
  `Frames sent (without heartbeats): ${count.frames}, of them ${count.notes} notes, ${count.moves} movements, ` +
    `${count.groups} groups. Answers: ${count.acks} ack, ${count.rejects} reject. Frames received: ${count.eventsIn}.`,
);
console.log(`Heartbeats: ${count.pings} sent, ${count.pongs} answered.`);
console.log(`A command's ack came after: median ${at(0.5)} ms, 95 % within ${at(0.95)} ms, at most ${at(1)} ms.`);
console.log(`Wall hours: ${(count.wallMs / 3_600_000).toFixed(2)} (the time each wall stood, added up).`);
console.log(`Rows written by the model of apps/worker/test/cost.test.ts: about ${rows}, and what the deletions write.`);
if (stopping) console.log("Stopped early by Ctrl-C: the walls did not live their whole time.");
console.log(`Problems: ${count.problems.length}`);
for (const line of count.problems.slice(0, 40)) console.log("  " + line);
console.log(standing.size ? `Walls NOT deleted: ${[...standing.keys()].join(" ")}` : "Every wall made is deleted.");
console.log("");
const worker = /\.workers\.dev$/.test(new URL(origin).hostname) ? new URL(origin).hostname.split(".")[0] : null;
console.log("What it cost, in Cloudflare's own numbers (they may lag some minutes):");
console.log(
  `  node scripts/cloudflare-metrics.mjs <account id> ${startedAt.toISOString()} ` +
    `${new Date(endedAt.getTime() + 60_000).toISOString()} --worker ${worker ?? "<worker name>"}`,
);
if (local) console.log("  (This was a local address: Cloudflare counted nothing of this run.)");
process.exit(count.problems.length || standing.size || stopping ? 1 : 0);
