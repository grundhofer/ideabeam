// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Participant, ServerEvent } from "../protocol.js";

export interface JoinInput {
  /** Sanitized display name (already validated by the protocol schema). */
  requestedName: string;
  /** Whether this join may moderate: the supplied admin token matched the wall's, and the person was not demoted
   *  (both decided by the caller). */
  isAdmin: boolean;
  /** Participant previously registered under the supplied session key, if any. */
  existing: Participant | null;
  /** Pre-generated id used only when this join creates a new participant. */
  newId: string;
}

export interface JoinPlan {
  participant: Participant;
  isNew: boolean;
}

// Pure join decision: reclaim identity via session key (keeping the id stable
// across reconnects), allow renaming on rejoin, and only ever upgrade the
// role — an admin who rejoins without the admin token stays admin, so a dropped
// connection cannot demote anyone.
export function planJoin(input: JoinInput): JoinPlan {
  const { requestedName, isAdmin, existing, newId } = input;

  if (existing) {
    return {
      participant: {
        ...existing,
        name: requestedName,
        role: isAdmin ? "admin" : existing.role,
        online: true,
      },
      isNew: false,
    };
  }

  return {
    participant: {
      id: newId,
      name: requestedName,
      role: isAdmin ? "admin" : "member",
      online: true,
    },
    isNew: true,
  };
}

export interface JoinNotice {
  /** The person as the wall knew them before this join; null for somebody new. */
  before: Participant | null;
  /** The person after it: the participant of the join's plan. */
  after: Participant;
  /** Whether a socket of this person was open before this join: another tab, or an earlier join on the same socket. */
  wasOnline: boolean;
}

// What a join tells the others on the wall. Somebody who was not here has come: `presence.join`, which carries
// name and role, so coming back under a new name is one frame. Somebody who was here already has not come again,
// so the others hear of it only when the join changed what the wall has stored about the person: `roster.updated`.
// It mirrors leaving, which is told when the LAST socket of a person closes.
export function joinNotice(
  notice: JoinNotice,
): Extract<ServerEvent, { type: "presence.join" | "roster.updated" }> | null {
  const { before, after, wasOnline } = notice;
  if (!wasOnline) return { type: "presence.join", participant: after };
  const changed = before === null || before.name !== after.name || before.role !== after.role;
  return changed ? { type: "roster.updated", participant: after } : null;
}
