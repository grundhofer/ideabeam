// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { joinNotice, planJoin } from "../src/domain/join.js";
import type { Participant } from "../src/protocol.js";

const existing: Participant = {
  id: "p1",
  name: "Old Name",
  role: "member",
  online: false,
};

describe("planJoin", () => {
  it("creates a new member", () => {
    const plan = planJoin({ requestedName: "Anna", isAdmin: false, existing: null, newId: "p9" });
    expect(plan.isNew).toBe(true);
    expect(plan.participant).toEqual({ id: "p9", name: "Anna", role: "member", online: true });
  });

  it("grants the admin role when the admin token matched", () => {
    const plan = planJoin({ requestedName: "Anna", isAdmin: true, existing: null, newId: "p9" });
    expect(plan.participant.role).toBe("admin");
  });

  it("reclaims identity on rejoin: same id, new name, back online", () => {
    const plan = planJoin({ requestedName: "New Name", isAdmin: false, existing, newId: "unused" });
    expect(plan.isNew).toBe(false);
    expect(plan.participant).toEqual({ ...existing, name: "New Name", online: true });
  });

  it("only ever upgrades the role, never demotes", () => {
    const admin: Participant = { ...existing, role: "admin" };
    const withoutToken = planJoin({ requestedName: "Anna", isAdmin: false, existing: admin, newId: "unused" });
    expect(withoutToken.participant.role).toBe("admin");

    const upgraded = planJoin({ requestedName: "Anna", isAdmin: true, existing, newId: "unused" });
    expect(upgraded.participant.role).toBe("admin");
  });
});

describe("joinNotice", () => {
  const ben: Participant = { id: "p2", name: "Ben", role: "member", online: true };

  it("somebody new has come", () => {
    expect(joinNotice({ before: null, after: ben, wasOnline: false })).toEqual({
      type: "presence.join",
      participant: ben,
    });
  });

  it("somebody known who was away has come, and a new name travels in the same frame", () => {
    const renamed: Participant = { ...ben, name: "Benjamin" };
    expect(joinNotice({ before: ben, after: ben, wasOnline: false })?.type).toBe("presence.join");
    expect(joinNotice({ before: ben, after: renamed, wasOnline: false })).toEqual({
      type: "presence.join",
      participant: renamed,
    });
  });

  it("somebody who is here already has not come again: a second tab that changes nothing is told to nobody", () => {
    expect(joinNotice({ before: ben, after: ben, wasOnline: true })).toBeNull();
  });

  it("somebody who is here and joins under a new name or as admin is a change of the roster", () => {
    for (const after of [{ ...ben, name: "Benjamin" }, { ...ben, role: "admin" } as const]) {
      expect(joinNotice({ before: ben, after, wasOnline: true })).toEqual({
        type: "roster.updated",
        participant: after,
      });
    }
  });
});
