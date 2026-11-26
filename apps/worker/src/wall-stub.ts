// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { WALL_ID_PATTERN } from "@ideabeam/shared";
import type { RateLimiter } from "./rate-limiter.js";
import type { WallRoom } from "./wall-room.js";

let jurisdictionSupported: boolean | null = null;

// All wall DOs live in the EU jurisdiction (GDPR / decided, PLAN.md 3.5). Every access path
// goes through this helper, so no wall is ever made or looked up outside it.
//
// Local workerd (vite dev, wrangler dev, vitest-pool-workers) throws
// "Jurisdiction restrictions are not implemented in workerd" — production
// Cloudflare implements them. The fallback below exists ONLY for local
// runtimes; EU pinning must be smoke-checked against production after deploy.
function wallNamespace(env: Env): DurableObjectNamespace<WallRoom> {
  if (jurisdictionSupported === false) return env.WALL_ROOM;
  try {
    const namespace = env.WALL_ROOM.jurisdiction("eu");
    jurisdictionSupported = true;
    return namespace;
  } catch (error) {
    // ONLY the local-workerd error may fall through to the plain namespace.
    // Anything else must throw: silently falling back in production would
    // make walls outside the EU.
    if (error instanceof Error && /not implemented/i.test(error.message)) {
      jurisdictionSupported = false;
      return env.WALL_ROOM;
    }
    throw error;
  }
}

// A wall's id IS the id of its Durable Object, as the namespace mints it: 64 hex digits, random, unguessable, and
// valid for this namespace alone. That is what lets the Worker refuse a made-up address without waking, or creating,
// any object: `idFromString` throws for an id the namespace did not make. (RetroBeam names its objects after a
// random string of its own instead, where every well-formed id reaches an object.)

/** A wall that does not exist yet, with the id its address will carry. */
export function newWall(env: Env): { wallId: string; stub: DurableObjectStub<WallRoom> } {
  const namespace = wallNamespace(env);
  const id = namespace.newUniqueId();
  return { wallId: id.toString(), stub: namespace.get(id) };
}

/** The wall behind an id from an address, or null when the id is not one this namespace made. Whether the wall
 *  still exists is the object's to say (`info()`): a deleted wall keeps its id. */
export function wallStub(env: Env, wallId: string): DurableObjectStub<WallRoom> | null {
  if (!WALL_ID_PATTERN.test(wallId)) return null;
  const namespace = wallNamespace(env);
  try {
    return namespace.get(namespace.idFromString(wallId));
  } catch {
    return null;
  }
}

/** The single rate-limiter instance. One object, so its counts are exact; not
 *  jurisdiction-pinned because it holds no personal data — ephemeral
 *  per-address counters that never touch disk, and two stored counts per day:
 *  how many walls were made, and what the AI was asked (the neurons, and how
 *  many runs each wall had, under a key that is not the wall's address). */
export function limiterStub(env: Env): DurableObjectStub<RateLimiter> {
  return env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName("global"));
}
