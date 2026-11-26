// api.ts: the four requests the app makes beside a wall's socket: make a wall, ask what a wall asks, ask for a
// proposal of how to arrange a wall's notes, and fetch the wall as Markdown. All go to the app's own origin, to the
// Worker under /api/. A failure is a value, not an exception: the view says in a sentence what is wrong and what to
// do.
import {
  arrangeErrorSchema,
  arrangeResponseSchema,
  budgetSpentSchema,
  createWallResponseSchema,
  EXPORT_SESSION_SCHEME,
  wallInfoSchema,
  type ArrangeErrorCode,
  type ArrangeLanguage,
  type ArrangeResponse,
  type CreateWallResponse,
  type WallInfo,
} from "@ideabeam/shared";

/** A new wall with its two capabilities, or why there is none: too many walls from this address in a minute
 *  (`limited`), the day's walls of the whole product are taken until `resetsAt` (`spent`), or anything else, no
 *  connection first of all (`failed`). */
export type Made =
  | { ok: true; wall: CreateWallResponse }
  | { ok: false; why: "limited" | "failed" }
  | { ok: false; why: "spent"; resetsAt: number };

/** `hidden`: the wall starts with hidden writing; everyone writes for themselves until the moderation reveals
 *  (PLAN.md 2.1). Without it every note is there for everyone at once. */
export async function createWall(question: string, hidden: boolean): Promise<Made> {
  try {
    const response = await fetch("/api/walls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, hidden }),
    });
    if (response.status === 429) {
      // two brakes answer 429: the one per address, and the day's budget, which says when it goes on
      const spent = budgetSpentSchema.safeParse(await response.json().catch(() => null));
      return spent.success ? { ok: false, why: "spent", resetsAt: spent.data.resetsAt } : { ok: false, why: "limited" };
    }
    if (!response.ok) return { ok: false, why: "failed" };
    const made = createWallResponseSchema.safeParse(await response.json());
    return made.success ? { ok: true, wall: made.data } : { ok: false, why: "failed" };
  } catch {
    return { ok: false, why: "failed" };
  }
}

/** A wall's question, or why there is none: no such wall, never made or deleted (`unknown`), or the request itself
 *  failed (`failed`), which says nothing about the wall. */
export type Found = { ok: true; wall: WallInfo } | { ok: false; why: "unknown" | "failed" };

export async function findWall(wallId: string): Promise<Found> {
  try {
    const response = await fetch(`/api/walls/${encodeURIComponent(wallId)}`);
    if (response.status === 404) return { ok: false, why: "unknown" };
    if (!response.ok) return { ok: false, why: "failed" };
    const body = (await response.json()) as { wall?: unknown };
    const wall = wallInfoSchema.safeParse(body.wall);
    return wall.success ? { ok: true, wall: wall.data } : { ok: false, why: "failed" };
  } catch {
    return { ok: false, why: "failed" };
  }
}

/** Why „Ordnen“ gave no proposal: one of the Worker's own reasons (protocol.ts), or the request never got an answer
 *  (`NETWORK`), or an answer that is none of the route's: another status, another shape, a body the Worker found too
 *  large (`UNKNOWN`). */
export type ArrangeFailure = ArrangeErrorCode | "NETWORK" | "UNKNOWN";

/** A proposal with what the run cost and how many runs the wall has left now, or why there is none; with it what
 *  the Worker said beside the reason: when a run fits again into a budget that is spent (`resetsAt`; left out where
 *  Cloudflare refused, and nobody knows), how many notes it takes (`min`). */
export type Proposed =
  { ok: true; answer: ArrangeResponse } | { ok: false; why: ArrangeFailure; resetsAt?: number; min?: number };

/** „Ordnen“: asks the Worker for a proposal of how to arrange the wall's notes (PLAN.md 4.3). The request carries the
 *  admin token in its `Authorization` header and the language of the titles as its body, and nothing else: the Worker
 *  reads the notes from the wall itself. It is answered once, when the whole run is over; `signal` ends the waiting
 *  (the request then rejects: whoever ended it knows why). */
export async function proposeArrangement(
  wallId: string,
  adminToken: string,
  language: ArrangeLanguage,
  signal?: AbortSignal,
): Promise<Proposed> {
  let response: Response;
  try {
    response = await fetch(`/api/walls/${encodeURIComponent(wallId)}/arrange`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ language }),
      signal,
    });
  } catch (error) {
    // the waiting was ended on purpose: that is no failure of the network
    if (signal?.aborted) throw error;
    return { ok: false, why: "NETWORK" };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, why: "UNKNOWN" };
  }
  if (response.ok) {
    const answer = arrangeResponseSchema.safeParse(body);
    return answer.success ? { ok: true, answer: answer.data } : { ok: false, why: "UNKNOWN" };
  }
  const refused = arrangeErrorSchema.safeParse(body);
  if (!refused.success) return { ok: false, why: "UNKNOWN" };
  const { error, resetsAt, min } = refused.data;
  return {
    ok: false,
    why: error,
    ...(resetsAt === undefined ? {} : { resetsAt }),
    ...(min === undefined ? {} : { min }),
  };
}

/** The wall as Markdown with the name to save it under, or why there is none: the wall is gone (`unknown`), this
 *  browser is nobody on it (`stranger`: it never joined, or had the wall forget it), or the request failed
 *  (`failed`). */
export type Exported =
  { ok: true; text: string; fileName: string } | { ok: false; why: "unknown" | "stranger" | "failed" };

/** The file's name from the answer's `Content-Disposition`, which the Worker makes of letters, digits and hyphens. */
function fileNameOf(response: Response): string | null {
  const name = /filename="([A-Za-z0-9-]+\.md)"/.exec(response.headers.get("content-disposition") ?? "")?.[1];
  return name ?? null;
}

/** „Als Markdown sichern“: the wall as this browser's person may see it (PLAN.md 3.2). Who asks is the session key
 *  this browser joined the wall with, in the `Authorization` header; the language names the file's fixed words. */
export async function exportWall(wallId: string, sessionKey: string, language: ArrangeLanguage): Promise<Exported> {
  try {
    const response = await fetch(`/api/walls/${encodeURIComponent(wallId)}/export?lang=${language}`, {
      headers: { authorization: `${EXPORT_SESSION_SCHEME} ${sessionKey}` },
      cache: "no-store",
    });
    if (response.status === 404) return { ok: false, why: "unknown" };
    if (response.status === 401) return { ok: false, why: "stranger" };
    const fileName = fileNameOf(response);
    if (!response.ok || fileName === null) return { ok: false, why: "failed" };
    return { ok: true, text: await response.text(), fileName };
  } catch {
    return { ok: false, why: "failed" };
  }
}
