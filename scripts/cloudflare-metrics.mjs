// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// cloudflare-metrics.mjs: what Cloudflare counted for the account's Durable Objects in a window of time, read from
// its GraphQL analytics. It is what the dashboard shows, as numbers: requests by kind, the time objects were awake,
// WebSocket messages, rows read and written. With it the measurements of scripts/measure-cloudflare.mjs and of
// scripts/load-test.mjs are read without a browser.
//
//   node scripts/cloudflare-metrics.mjs <account id> <from> <to> [--worker <name>]
//   node scripts/cloudflare-metrics.mjs 0123…cdef 2026-11-22T08:10:00Z 2026-11-22T09:25:00Z --worker ideabeam-vorschau
//
// The account is shared with RetroBeam (PLAN.md 3.6). --worker keeps one Worker's rows: `ideabeam-vorschau` is the
// preview (scripts/preview-deploy.sh), `ideabeam` the product's name (apps/worker/wrangler.jsonc). Its Durable Object
// classes are `WallRoom` (one object per wall) and `RateLimiter` (the brake and the day's count of walls). Without
// --worker every Worker of the account is listed.
//
// The account id is the one `pnpm exec wrangler whoami` lists. The login is wrangler's own: its OAuth token lasts
// about an hour, and any wrangler command (`whoami`) renews it. CLOUDFLARE_API_TOKEN, when set, is used instead and
// needs „Account Analytics: Read“; to name the namespaces (which Worker, which class) it also needs „Workers Scripts:
// Read“, and without it the namespaces are listed by their ids only. The token is never printed.
//
// It reads, it changes nothing, and it costs nothing of the free plan's allowance. The numbers arrive a few minutes
// after the fact. A Worker that was deleted keeps its numbers; its name then reads `__unknown__`, and its namespaces
// are no longer listed, so they stay without a name.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const at = args.indexOf("--worker");
const worker = at === -1 ? null : args[at + 1];
const [account, from, to] = at === -1 ? args : [...args.slice(0, at), ...args.slice(at + 2)];
if (!account || !from || !to || (at !== -1 && !worker)) {
  console.error(
    "usage: node scripts/cloudflare-metrics.mjs <account id> <from, ISO time> <to, ISO time> [--worker <name>]",
  );
  process.exit(2);
}

function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const places = [
    `${homedir()}/Library/Preferences/.wrangler/config/default.toml`,
    `${process.env.XDG_CONFIG_HOME ?? `${homedir()}/.config`}/.wrangler/config/default.toml`,
  ];
  for (const place of places) {
    const found = existsSync(place) ? /oauth_token\s*=\s*"([^"]+)"/.exec(readFileSync(place, "utf8"))?.[1] : null;
    if (found) return found;
  }
  console.error("No login: set CLOUDFLARE_API_TOKEN, or log wrangler in (pnpm exec wrangler login).");
  process.exit(1);
}

async function ask(query) {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { account, filter: { datetime_geq: from, datetime_leq: to } } }),
  });
  const answer = await response.json();
  if (answer.errors?.length) {
    console.error(`Cloudflare refused: ${answer.errors.map((error) => error.message).join("; ")}`);
    console.error("An „Authentication error“ usually means wrangler's token ran out: run `pnpm exec wrangler whoami`.");
    process.exit(1);
  }
  return answer.data.viewer.accounts[0];
}

/** Which Worker and class each Durable Object namespace of the account belongs to, by namespace id; null when the
 *  token may not read it. Namespaces of a deleted Worker are not listed. */
async function namespaces() {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/workers/durable_objects/namespaces?per_page=100`,
      { headers: { authorization: `Bearer ${token()}` } },
    );
    const answer = await response.json();
    if (!answer.success) return null;
    return new Map(answer.result.map((namespace) => [namespace.id, namespace]));
  } catch {
    return null;
  }
}

const { durableObjectsInvocationsAdaptiveGroups: invocations } = await ask(`
  query ($account: String!, $filter: AccountDurableObjectsInvocationsAdaptiveGroupsFilter_InputObject) {
    viewer { accounts(filter: { accountTag: $account }) {
      durableObjectsInvocationsAdaptiveGroups(limit: 100, filter: $filter) {
        dimensions { scriptName type status }
        sum { requests wallTime }
      }
    } }
  }`);
const { durableObjectsPeriodicGroups: periodic } = await ask(`
  query ($account: String!, $filter: AccountDurableObjectsPeriodicGroupsFilter_InputObject) {
    viewer { accounts(filter: { accountTag: $account }) {
      durableObjectsPeriodicGroups(limit: 100, filter: $filter) {
        dimensions { namespaceId }
        sum { activeTime cpuTime inboundWebsocketMsgCount outboundWebsocketMsgCount rowsRead rowsWritten }
        max { activeWebsocketConnections }
      }
    } }
  }`);
const named = await namespaces();

const seconds = (microseconds) => Math.round(microseconds / 1e4) / 100;
console.log(`Durable Objects of the account, ${from} to ${to}${worker ? `, the Worker ${worker} only` : ""}`);
console.log("\nRequests, by Worker and kind (http: a request or a socket's upgrade, with the time the socket stayed");
console.log("open; jsrpc: a method called by the Worker; hibernation: a frame or a close that woke the object; and");
console.log("the alarms, which in IdeaBeam are only a wall's day of deletion, 30 days on):");
console.table(
  invocations
    .filter(({ dimensions }) => !worker || dimensions.scriptName === worker)
    .map(({ dimensions, sum }) => ({
      worker: dimensions.scriptName,
      kind: dimensions.type,
      status: dimensions.status,
      requests: sum.requests,
      "wall s": seconds(sum.wallTime),
    })),
);
console.log("By namespace. „awake s“ is the time that is billed as duration; rows are the storage's:");
if (named === null) {
  console.log("(The token may not list the namespaces: they stand by id, and --worker does not narrow this table.)");
}
console.table(
  periodic
    .map(({ dimensions, sum, max }) => ({ namespace: named?.get(dimensions.namespaceId), dimensions, sum, max }))
    .filter(({ namespace }) => !worker || named === null || namespace?.script === worker)
    .map(({ namespace, dimensions, sum, max }) => ({
      ...(named === null ? {} : { worker: namespace?.script ?? "?", class: namespace?.class ?? "?" }),
      namespace: dimensions.namespaceId,
      "sockets at most": max.activeWebsocketConnections,
      "awake s": seconds(sum.activeTime),
      "cpu ms": Math.round(sum.cpuTime / 1000),
      "frames in": sum.inboundWebsocketMsgCount,
      "frames out": sum.outboundWebsocketMsgCount,
      "rows read": sum.rowsRead,
      "rows written": sum.rowsWritten,
    })),
);
