// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// `GET /api/walls/:id/export` (PLAN.md 3.2): the wall as Markdown, through the same filter as the snapshot. What the
// file says is the shared rule's (packages/shared/test/export.test.ts); here the whole way: who may ask, what the
// answer carries, that hidden notes stay hidden, and that asking writes nothing.

import { runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateHexId, generateSessionKey } from "@ideabeam/shared";
import { answer, ask, createHiddenWall, createWall, join, REVEAL, stubOf, type TestSocket } from "./helpers.js";

function exportOf(wallId: string, sessionKey: string | null, lang: string | null = "de"): Promise<Response> {
  const query = lang === null ? "" : `?lang=${lang}`;
  return SELF.fetch(`https://example.com/api/walls/${wallId}/export${query}`, {
    headers: sessionKey === null ? {} : { authorization: `Session ${sessionKey}` },
  });
}

async function write(socket: TestSocket, text: string): Promise<string> {
  const noteId = generateHexId();
  expect(await ask(socket, { type: "note.create", noteId, text, x: 0, y: 0 })).toBe("ack");
  return noteId;
}

async function frame(socket: TestSocket, title: string): Promise<string> {
  const groupId = generateHexId();
  expect(await ask(socket, { type: "group.create", groupId, title, x: 0, y: 0, w: 600, h: 400 })).toBe("ack");
  return groupId;
}

/** Counts the rows the wall's object writes from now on: every statement through its SqlStorage. Gives back how
 *  many were written, and puts the storage back. */
async function countWrites(wallId: string): Promise<() => Promise<number>> {
  let written = 0;
  await runInDurableObject(stubOf(wallId), (instance) => {
    const holder = instance as unknown as { sql: SqlStorage; uncounted?: SqlStorage };
    const target = holder.sql;
    holder.uncounted = target;
    holder.sql = {
      exec: (query: string, ...bindings: unknown[]) => {
        const cursor = target.exec(query, ...bindings);
        const rows = cursor.toArray();
        written += cursor.rowsWritten;
        return {
          toArray: () => rows,
          one: () => rows[0],
          [Symbol.iterator]: () => rows[Symbol.iterator](),
        } as unknown as ReturnType<SqlStorage["exec"]>;
      },
    } as unknown as SqlStorage;
  });
  return async () => {
    await runInDurableObject(stubOf(wallId), (instance) => {
      const holder = instance as unknown as { sql: SqlStorage; uncounted?: SqlStorage };
      if (holder.uncounted !== undefined) holder.sql = holder.uncounted;
    });
    return written;
  };
}

describe("the export of a revealed wall", () => {
  it("is the wall as Markdown: the question, the groups as headings, the notes as items, no names", async () => {
    const { wallId, adminToken } = await createWall("Was hilft uns?");
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    const time = await frame(anna.socket, "Zeit");
    const tools = await frame(anna.socket, "Werkzeuge");
    const quiet = await write(ben.socket, "Ruhige Vormittage");
    const board = await write(anna.socket, "Ein gutes **Board**");
    await write(ben.socket, "Kaffee");
    expect(
      await ask(anna.socket, {
        type: "notes.move",
        moves: [
          { noteId: quiet, x: 20, y: 40, groupId: time },
          { noteId: board, x: 20, y: 40, groupId: tools },
        ],
      }),
    ).toBe("ack");

    const response = await exportOf(wallId, ben.sessionKey);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="Was-hilft-uns-\d{4}-\d{2}-\d{2}\.md"$/,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    const text = await response.text();
    expect(text).toMatch(/^# Was hilft uns\?\n\n_IdeaBeam · Stand: \d{2}\.\d{2}\.\d{4}_\n\n/);
    expect(text).toContain(
      "## Zeit\n\n- Ruhige Vormittage\n\n## Werkzeuge\n\n- Ein gutes \\*\\*Board\\*\\*\n\n## Ohne Gruppe\n\n- Kaffee\n",
    );
    for (const name of ["Anna", "Ben", anna.you, ben.you, anna.sessionKey, ben.sessionKey, adminToken]) {
      expect(text).not.toContain(name);
    }
    // the same file for the moderation, in English for whoever asks in English
    expect(await (await exportOf(wallId, anna.sessionKey)).text()).toBe(text);
    const english = await (await exportOf(wallId, anna.sessionKey, "en")).text();
    expect(english).toContain("## Without a group\n\n- Kaffee\n");
    expect(english).toMatch(/_IdeaBeam · As of \d{4}-\d{2}-\d{2}_/);
  });
});

describe("the export while the notes are hidden", () => {
  it("holds the person's own notes alone, and after revealing everybody's", async () => {
    const { wallId, adminToken } = await createHiddenWall("Was fehlt?");
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    await write(anna.socket, "Annas Zettel");
    await write(ben.socket, "Bens Geheimnis");
    await write(ben.socket, "Bens zweiter");

    const forAnna = await (await exportOf(wallId, anna.sessionKey)).text();
    expect(forAnna).toContain("## Deine Zettel\n\n- Annas Zettel\n");
    expect(forAnna).toContain("2 Zettel der anderen fehlen.");
    expect(forAnna).not.toContain("Bens");
    const forBen = await (await exportOf(wallId, ben.sessionKey)).text();
    expect(forBen).toContain("- Bens Geheimnis\n- Bens zweiter\n");
    expect(forBen).not.toContain("Annas");

    expect(await answer(anna.socket, REVEAL)).toMatchObject({ type: "ack" });
    const after = await (await exportOf(wallId, ben.sessionKey)).text();
    expect(after).toContain("## Zettel\n\n- Annas Zettel\n- Bens Geheimnis\n- Bens zweiter\n");
    expect(after).not.toContain("noch verdeckt");
    // the wall's method above the results, with its short description
    expect(after).toContain("**Still sammeln, bündeln, verdeckt wählen:** Alle schreiben Ideen verdeckt,");
  });
});

describe("who may ask", () => {
  it("nobody for a wall that does not exist, or was never one", async () => {
    const { wallId, adminToken } = await createWall();
    const anna = await join(wallId, "Anna", { adminToken });
    // a made-up address: the namespace did not make it
    const madeUp = await exportOf("f".repeat(64), anna.sessionKey);
    expect(madeUp.status).toBe(404);
    expect(await madeUp.json()).toEqual({ error: "WALL_NOT_FOUND" });
    // a wall that was deleted
    expect(await answer(anna.socket, { type: "admin.wall.delete" })).toMatchObject({ type: "ack" });
    const gone = await exportOf(wallId, anna.sessionKey);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: "WALL_NOT_FOUND" });
  });

  it("nobody who is not on the wall: no key, a key that is nobody's, the admin token, a forgotten person", async () => {
    const { wallId, adminToken } = await createWall();
    await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    await write(ben.socket, "Bens Zettel");
    for (const response of [
      await exportOf(wallId, null),
      await exportOf(wallId, generateSessionKey()),
      await exportOf(wallId, "not-a-key"),
      // the moderation's token is no person on the wall
      await exportOf(wallId, adminToken),
    ]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "NOT_ON_WALL" });
    }
    // a key in the address is no key
    const inQuery = await SELF.fetch(
      `https://example.com/api/walls/${wallId}/export?lang=de&session=${ben.sessionKey}`,
    );
    expect(inQuery.status).toBe(401);
    // the Bearer scheme is the moderation's, for „Ordnen“
    const bearer = await SELF.fetch(`https://example.com/api/walls/${wallId}/export?lang=de`, {
      headers: { authorization: `Bearer ${ben.sessionKey}` },
    });
    expect(bearer.status).toBe(401);
    // somebody who had the wall forget them
    expect(await ask(ben.socket, { type: "me.erase" })).toBe("ack");
    expect((await exportOf(wallId, ben.sessionKey)).status).toBe(401);
  });

  it("only in German or English", async () => {
    const { wallId } = await createWall();
    const ben = await join(wallId, "Ben");
    for (const lang of [null, "fr", "DE", ""]) {
      const response = await exportOf(wallId, ben.sessionKey, lang);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
    }
  });
});

describe("what asking costs", () => {
  it("writes no row, also for a refused request, and tells nobody on the wall", async () => {
    const { wallId, adminToken } = await createWall();
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    // the counter sees a write: a note is a row
    const counting = await countWrites(wallId);
    await write(ben.socket, "Ein Zettel");
    expect(await counting()).toBeGreaterThan(0);
    const frames = anna.socket.events.length;
    const done = await countWrites(wallId);
    expect((await exportOf(wallId, ben.sessionKey)).status).toBe(200);
    expect((await exportOf(wallId, anna.sessionKey, "en")).status).toBe(200);
    expect((await exportOf(wallId, generateSessionKey())).status).toBe(401);
    expect(await done()).toBe(0);
    expect(anna.socket.events).toHaveLength(frames);
  });
});
