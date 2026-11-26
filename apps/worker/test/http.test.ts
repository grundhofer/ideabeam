// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { env, listDurableObjectIds, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "@ideabeam/shared";
import { createWall, freshIp, join, postWall, upgrade } from "./helpers.js";

const info = (wallId: string) => SELF.fetch(`https://example.com/api/walls/${wallId}`);

describe("GET /api/health", () => {
  it("says the worker runs and which protocol it speaks", async () => {
    const response = await SELF.fetch("https://example.com/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, protocolVersion: PROTOCOL_VERSION });
  });

  it("keeps API responses out of search indexes", async () => {
    const response = await SELF.fetch("https://example.com/api/health");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });
});

describe("an unknown API path", () => {
  it("answers 404 as data, also kept out of search indexes", async () => {
    const response = await SELF.fetch("https://example.com/api/nothing-here");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "NOT_FOUND" });
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });
});

describe("POST /api/walls", () => {
  it("makes a wall and returns its two capabilities", async () => {
    const { wallId, adminToken } = await createWall("What should we build next?");
    expect(wallId).toMatch(/^[0-9a-f]{64}$/);
    expect(adminToken).toMatch(/^[0-9a-f]{32}$/);
  });

  it("gives every wall an id and a token of its own", async () => {
    const a = await createWall();
    const b = await createWall();
    expect(a.wallId).not.toBe(b.wallId);
    expect(a.adminToken).not.toBe(b.adminToken);
  });

  it("trims the question and refuses a body without one", async () => {
    const { wallId } = await createWall("  Was hält uns auf?  ");
    expect(await (await info(wallId)).json()).toMatchObject({ wall: { question: "Was hält uns auf?" } });

    for (const body of [{ question: "   " }, { question: "x".repeat(141) }, { question: 7 }, {}, "not json", "[]"]) {
      const response = await postWall(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
    }
  });

  it("starts the wall with hidden writing unless the request says otherwise", async () => {
    const asked = async (body: object) => {
      const response = await postWall({ question: "What slows us down?", ...body });
      expect(response.status).toBe(200);
      const { wallId } = (await response.json()) as { wallId: string };
      return (await join(wallId, "Anna")).sync.phase;
    };
    expect(await asked({})).toBe("writing");
    expect(await asked({ hidden: true })).toBe("writing");
    expect(await asked({ hidden: false })).toBe("open");
    for (const hidden of ["no", 0, null]) {
      const response = await postWall({ question: "What slows us down?", hidden });
      expect(response.status, String(hidden)).toBe(400);
    }
  });

  it("refuses a body larger than anything a question needs", async () => {
    const response = await postWall({ question: "x", padding: "y".repeat(5000) });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "PAYLOAD_TOO_LARGE" });
  });

  it("admits ten walls a minute from one address, refuses the eleventh, and lets other addresses through", async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await postWall({ question: `Question ${i}` }, ip)).status);
    expect(statuses.slice(0, 10)).toEqual(Array<number>(10).fill(200));
    expect(statuses[10]).toBe(429);

    const refused = await postWall({ question: "One more" }, ip);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "RATE_LIMITED" });
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);

    expect((await postWall({ question: "From elsewhere" })).status).toBe(200);
  });
});

describe("GET /api/walls/:id", () => {
  it("returns the wall's question and nothing that is a secret", async () => {
    const { wallId, adminToken } = await createWall("What slows us down?");
    const response = await info(wallId);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      wall: { id: wallId, question: "What slows us down?", createdAt: expect.any(Number) as number },
    });
    expect(text).not.toContain(adminToken);
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("refuses an id of another shape", async () => {
    for (const id of ["abc", "g".repeat(64), "AB".repeat(32), "ab".repeat(31)]) {
      const response = await info(id);
      expect(response.status, id).toBe(404);
      expect(await response.json()).toEqual({ error: "WALL_NOT_FOUND" });
    }
  });

  it("refuses a made-up id without waking or making any object", async () => {
    await createWall(); // so the namespace holds at least one object to count
    const before = await listDurableObjectIds(env.WALL_ROOM);
    for (const id of [
      "ab".repeat(32),
      "0".repeat(64),
      "f".repeat(64),
      crypto.randomUUID().replaceAll("-", "").repeat(2),
    ]) {
      const response = await info(id);
      expect(response.status, id).toBe(404);
      expect(await response.json()).toEqual({ error: "WALL_NOT_FOUND" });
    }
    const after = await listDurableObjectIds(env.WALL_ROOM);
    expect(after.map(String).sort()).toEqual(before.map(String).sort());
  });
});

describe("GET /api/walls/:id/ws", () => {
  it("wants a WebSocket", async () => {
    const { wallId } = await createWall();
    const response = await SELF.fetch(`https://example.com/api/walls/${wallId}/ws`);
    expect(response.status).toBe(426);
    expect(await response.json()).toEqual({ error: "EXPECTED_WEBSOCKET" });
  });

  it("opens no socket to a wall that was never made", async () => {
    const response = await upgrade("ab".repeat(32));
    expect(response.status).toBe(404);
    expect(response.webSocket).toBeNull();
  });
});
