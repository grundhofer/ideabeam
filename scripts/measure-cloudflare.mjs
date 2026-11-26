// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// measure-cloudflare.mjs: the three things about Cloudflare that local workerd cannot tell, for a wall. It talks to a
// deployed Worker over its public address, as a browser would; it needs no login and no token.
//
//   node scripts/measure-cloudflare.mjs https://<worker>.<subdomain>.workers.dev [--pings 2000] [--idle-minutes 20]
//
// The Worker to measure is the preview (`ideabeam-vorschau`, scripts/preview-deploy.sh), or the API alone, without
// the app, so no page with placeholder legal texts goes public. Either is a deploy, and nothing is deployed without
// the owner's word (AGENTS.md):
//
//   cd apps/worker && pnpm exec wrangler deploy --env vorschau --name ideabeam-messung   # the account RetroBeam is in;
//                                     # --env vorschau: the top level of wrangler.jsonc would claim ideabeam.de
//   node scripts/measure-cloudflare.mjs https://ideabeam-messung.<subdomain>.workers.dev
//   cd apps/worker && pnpm exec wrangler delete --name ideabeam-messung      # once the numbers are read
//
// What it does, and what each step answers:
//   1. Makes a wall. On Cloudflare `jurisdiction("eu")` is implemented, and wall-stub.ts falls back to the plain
//      namespace only for local workerd's "not implemented": a wall that is made there was made in the EU. Against
//      a local address this step says that it cannot tell.
//   2. One socket sends --pings heartbeats ("ping", answered "pong" by the runtime: wall-room.ts sets the automatic
//      answer) and nothing else. Whether such a ping is billed cannot be read from outside: read it afterwards, for
//      the minutes this script prints, with scripts/cloudflare-metrics.mjs (or in the dashboard, under Workers &
//      Pages > Durable Objects > the WallRoom namespace > Metrics). If "requests" or incoming WebSocket messages grew
//      by about the number of pings, they count (20 to 1 on the bill); if they grew by a handful, they do not.
//   3. One socket joins and then stays silent. The script says when Cloudflare closed it, or that it was still open
//      after --idle-minutes. That is the longest the heartbeat interval may be (apps/web/src/lib/socket.ts: 30 s).
// At the end the moderation deletes the wall (`admin.wall.delete`), also when a step failed, so nothing of the
// measurement stays stored; if that fails, the script says the wall's id.
//
// What it costs: one of the day's walls (DAILY_WALLS in apps/worker/wrangler.jsonc), about 25 rows written (19 for
// making the wall, the day's count included, and 2 for each of its three people, as apps/worker/test/cost.test.ts
// counts them) and what its deletion writes, a few requests, and with the defaults 2,000 frames in and out, which
// are what step 2 is there to find out about.
import { randomBytes } from "node:crypto";

const [base, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = rest.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(rest[at + 1]);
};
const PINGS = flag("pings", 2000);
const IDLE_MINUTES = flag("idle-minutes", 20);

if (!base || !/^https?:\/\//.test(base) || !Number.isFinite(PINGS) || !Number.isFinite(IDLE_MINUTES)) {
  console.error(
    "usage: node scripts/measure-cloudflare.mjs https://<worker address> [--pings 2000] [--idle-minutes 20]",
  );
  process.exit(2);
}

const origin = new URL(base).origin;
const hex = (bytes) => randomBytes(bytes).toString("hex");
const now = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A socket on the wall, joined: resolves once the wall has answered with its `sync`. `ask` sends a command and
 *  resolves with the wall's `ack`. */
function join(wallId, name, sessionKey, adminToken) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${origin.replace(/^http/, "ws")}/api/walls/${wallId}/ws`);
    const waiting = new Map();
    const state = { ws, pongs: 0, closedAt: null, closeCode: null };
    const fail = setTimeout(() => reject(new Error(`${name}: no answer from the wall within 10 s`)), 10_000);
    state.ask = (command) =>
      new Promise((answered, refused) => {
        const opId = hex(16);
        const timer = setTimeout(() => refused(new Error(`${name}: no answer to ${command.type} within 10 s`)), 10_000);
        waiting.set(opId, { answered, refused, timer });
        ws.send(JSON.stringify({ ...command, opId }));
      });
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "join", name, sessionKey, ...(adminToken ? { adminToken } : {}) }));
    });
    ws.addEventListener("message", (event) => {
      const data = String(event.data);
      if (data === "pong") {
        state.pongs += 1;
        return;
      }
      const frame = JSON.parse(data);
      if (frame.type === "sync") {
        clearTimeout(fail);
        resolve(state);
      } else if (frame.type === "ack" || frame.type === "reject") {
        const asked = waiting.get(frame.opId);
        if (!asked) return;
        waiting.delete(frame.opId);
        clearTimeout(asked.timer);
        if (frame.type === "ack") asked.answered();
        else asked.refused(new Error(`${name}: the wall refused ${frame.code}`));
      } else if (frame.type === "error") reject(new Error(`${name}: the wall refused: ${frame.code}`));
    });
    ws.addEventListener("close", (event) => {
      state.closedAt = Date.now();
      state.closeCode = event.code;
    });
    ws.addEventListener("error", () => reject(new Error(`${name}: the socket failed`)));
  });
}

const result = { worker: origin, startedAt: now() };

// 1. a wall, made on Cloudflare
const made = await fetch(`${origin}/api/walls`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question: "Messung" }),
});
if (!made.ok) {
  console.error(`The wall was not made: HTTP ${made.status} ${await made.text()}`);
  process.exit(1);
}
const { wallId, adminToken } = await made.json();
// the moderation's session key, kept: should its socket be gone at the end, a new one reclaims the same person
const admin = { name: "Moderation", sessionKey: hex(16), socket: null };
let failed = null;
try {
  // local workerd does not implement jurisdictions: there this step says only that the Worker runs
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(origin).hostname);
  result.wall = { made: true, idLength: wallId.length, onCloudflare: !local };
  console.log(
    local
      ? `1. A wall was made (id of ${wallId.length} hex digits). This is a local address: local workerd has no ` +
          "jurisdictions, so this says NOTHING about the EU."
      : `1. A wall was made (id of ${wallId.length} hex digits): the EU jurisdiction did not refuse it.`,
  );

  admin.socket = await join(wallId, admin.name, admin.sessionKey, adminToken);

  // 2. heartbeats, and nothing else, on one socket
  const pinger = await join(wallId, "Ping", hex(16));
  const pingFrom = now();
  for (let i = 0; i < PINGS; i++) {
    if (pinger.ws.readyState !== WebSocket.OPEN) throw new Error(`the ping socket closed after ${i} pings`);
    pinger.ws.send("ping");
    await sleep(50);
  }
  await sleep(2000);
  result.pings = { sent: PINGS, answered: pinger.pongs, from: pingFrom, to: now() };
  console.log(`2. ${PINGS} pings sent, ${pinger.pongs} answered, between ${pingFrom} and ${result.pings.to} (UTC).`);
  console.log("   Read the WallRoom namespace's metrics for these minutes (see the head of this file).");
  pinger.ws.close();

  // 3. a socket that says nothing after its join
  const silent = await join(wallId, "Still", hex(16));
  const silentFrom = Date.now();
  console.log(`3. A silent socket is open since ${now()}; watching it for up to ${IDLE_MINUTES} minutes …`);
  while (silent.closedAt === null && Date.now() - silentFrom < IDLE_MINUTES * 60_000) await sleep(1000);
  const seconds = Math.round(((silent.closedAt ?? Date.now()) - silentFrom) / 1000);
  result.idle =
    silent.closedAt === null
      ? { stillOpenAfterSeconds: seconds }
      : { closedAfterSeconds: seconds, code: silent.closeCode };
  console.log(
    silent.closedAt === null
      ? `   Still open after ${seconds} s: a heartbeat every ${IDLE_MINUTES} minutes would have been enough.`
      : `   Closed after ${seconds} s (code ${silent.closeCode}): the heartbeat has to come sooner than that.`,
  );
  silent.ws.close();
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
  console.error(`A step failed: ${failed}`);
}

// nothing of the measurement stays stored, whatever happened above: through the moderation's socket, or a new one
// that joins as the same person (the moderation's socket was as silent as step 3's for as long)
try {
  const open = admin.socket?.ws.readyState === WebSocket.OPEN;
  const socket = open ? admin.socket : await join(wallId, admin.name, admin.sessionKey, adminToken);
  await socket.ask({ type: "admin.wall.delete" });
  await sleep(1500);
  const gone = await fetch(`${origin}/api/walls/${wallId}`);
  result.wall.deleted = gone.status === 404;
  console.log(
    result.wall.deleted
      ? "The wall is deleted."
      : `The wall is NOT deleted (HTTP ${gone.status}): its id is ${wallId}. It deletes itself 30 days after the last join.`,
  );
} catch (error) {
  result.wall.deleted = false;
  console.error(
    `The wall is NOT deleted (${error instanceof Error ? error.message : String(error)}): its id is ${wallId}. ` +
      "It deletes itself 30 days after the last join.",
  );
}

result.finishedAt = now();
if (failed) result.failed = failed;
console.log(JSON.stringify(result, null, 2));
process.exit(failed || !result.wall.deleted ? 1 : 0);
