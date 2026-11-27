// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

// A wall of the builds before the methods (schema 3) under this build (schema 4, stage M1 of PLAN-METHODEN.md): its
// flow row holds a phase where this build writes a step, and it has no agenda row. It is read as it stands
// (wall-room.ts, readFlow(); packages/shared, domain/flow.ts, readStoredFlow()): hidden writing is „Still sammeln“ in
// its writing step, a revealed wall a „Freie Wand“. Acceptance of M1: such a wall shows exactly what it showed, in
// both states, and a visit writes no row; its next step move or control of the clock writes the new shape.

import { runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { generateHexId, type ServerEvent } from "@ideabeam/shared";
import {
  answer,
  asSchemaThree,
  ask,
  createHiddenWall,
  createWall,
  FREE,
  join,
  resync,
  settle,
  stubOf,
  WRITING,
  type Sync,
} from "./helpers.js";

/** Counts every row the wall's object writes from now on, through its SQL (the way cost.test.ts counts). */
function counting(wallId: string): Promise<void> {
  return runInDurableObject(stubOf(wallId), (instance) => {
    const holder = instance as unknown as { sql: SqlStorage; written?: number };
    if (holder.written !== undefined) return;
    holder.written = 0;
    const target = holder.sql;
    holder.sql = {
      exec: (query: string, ...bindings: unknown[]) => {
        const cursor = target.exec(query, ...bindings);
        const rows = cursor.toArray();
        holder.written = (holder.written ?? 0) + cursor.rowsWritten;
        return {
          toArray: () => rows,
          one: () => {
            if (rows.length !== 1) throw new Error(`one() of ${rows.length} rows`);
            return rows[0];
          },
          [Symbol.iterator]: () => rows[Symbol.iterator](),
        } as unknown as ReturnType<SqlStorage["exec"]>;
      },
    } as unknown as SqlStorage;
  });
}

const written = (wallId: string) =>
  runInDurableObject(stubOf(wallId), (instance) => (instance as unknown as { written?: number }).written ?? -1);

/** The wall's meta rows, by key. */
const meta = (wallId: string) =>
  runInDurableObject(stubOf(wallId), (_instance, state) =>
    Object.fromEntries(
      state.storage.sql
        .exec("SELECT key, value FROM meta ORDER BY key")
        .toArray()
        .map((row) => [String(row.key), String(row.value)]),
    ),
  );

/** What a snapshot shows of a wall, without what it says about the agenda: the notes, the count of the hidden ones,
 *  the groups, the clock, the number, the run. */
const shows = ({ notes, hidden, groups, clock, seq, arrangeRun }: Sync) => ({
  notes,
  hidden,
  groups,
  clock,
  seq,
  arrangeRun,
});

function exportOf(wallId: string, sessionKey: string): Promise<string> {
  return SELF.fetch(`https://example.com/api/walls/${wallId}/export?lang=de`, {
    headers: { authorization: `Session ${sessionKey}` },
  }).then((response) => response.text());
}

describe("a wall of schema 3", () => {
  it("in hidden writing shows exactly what it showed, as „Still sammeln“ in its writing step, and a visit writes no row", async () => {
    const { wallId, adminToken } = await createHiddenWall("Was hält uns auf?");
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    for (const [socket, text] of [
      [anna.socket, "Annas Geheimnis"],
      [ben.socket, "Bens Geheimnis"],
      [ben.socket, "Bens zweites"],
    ] as const) {
      expect(await ask(socket, { type: "note.create", noteId: generateHexId(), text, x: 0, y: 0 })).toBe("ack");
    }
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 10 })).toBe("ack");
    const before = { anna: await resync(anna.socket), ben: await resync(ben.socket) };
    const exported = await exportOf(wallId, ben.sessionKey);
    for (const person of [anna, ben]) person.socket.ws.close(1000, "deploy");
    await settle();

    await asSchemaThree(wallId, "writing");
    const stored = await meta(wallId);
    expect(JSON.parse(stored.flow ?? "")).toMatchObject({ phase: "writing", seq: 4 });
    expect(stored.agenda).toBeUndefined();
    await counting(wallId);

    // every way in: the door's question, the sockets, a snapshot asked again, the export, „Ordnen“'s question
    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(200);
    const back = {
      anna: await join(wallId, "Anna", { adminToken, sessionKey: anna.sessionKey }),
      ben: await join(wallId, "Ben", { sessionKey: ben.sessionKey }),
    };
    expect(shows(back.anna.sync)).toEqual(shows(before.anna));
    expect(shows(back.ben.sync)).toEqual(shows(before.ben));
    expect(back.ben.sync).toMatchObject({ ...WRITING, hidden: 1, notes: [{ text: "Bens Geheimnis" }, {}] });
    expect(shows(await resync(back.ben.socket))).toEqual(shows(before.ben));
    expect(await exportOf(wallId, ben.sessionKey)).toBe(exported);
    expect(await runInDurableObject(stubOf(wallId), (instance) => instance.arrangeInput(adminToken))).toEqual({
      kind: "refused",
      code: "PHASE",
    });
    // a command that the step does not take is refused as before, and writes nothing either
    expect(
      await ask(back.anna.socket, {
        type: "group.create",
        groupId: generateHexId(),
        title: "",
        x: 0,
        y: 0,
        w: 200,
        h: 200,
      }),
    ).toBe("PHASE");

    expect(await written(wallId)).toBe(0);
    expect(await meta(wallId)).toEqual(stored);
  });

  it("revealed shows exactly what it showed, as a „Freie Wand“, and a visit writes no row", async () => {
    const { wallId, adminToken } = await createWall("Was hilft uns?");
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    const groupId = generateHexId();
    expect(await ask(anna.socket, { type: "note.create", noteId: generateHexId(), text: "Für alle", x: 0, y: 0 })).toBe(
      "ack",
    );
    expect(await ask(ben.socket, { type: "group.create", groupId, title: "Gruppe", x: 0, y: 0, w: 400, h: 400 })).toBe(
      "ack",
    );
    const before = await resync(ben.socket);
    for (const person of [anna, ben]) person.socket.ws.close(1000, "deploy");
    await settle();

    await asSchemaThree(wallId, "open");
    const stored = await meta(wallId);
    await counting(wallId);

    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(200);
    const back = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    expect(shows(back.sync)).toEqual(shows(before));
    expect(back.sync).toMatchObject({ ...FREE, hidden: 0, notes: [{ text: "Für alle", mine: false }] });
    expect(await runInDurableObject(stubOf(wallId), (instance) => instance.arrangeInput(adminToken))).toMatchObject({
      kind: "notes",
    });
    const exported = await exportOf(wallId, ben.sessionKey);
    expect(exported).toContain("**Freie Wand:**");
    expect(exported).toContain("- Für alle");

    expect(await written(wallId)).toBe(0);
    expect(await meta(wallId)).toEqual(stored);
  });

  it("writes the new shape with its next change of the flow: the step, its agenda and its schema, once", async () => {
    const { wallId, adminToken } = await createHiddenWall();
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "Bens", x: 0, y: 0 })).toBe(
      "ack",
    );
    anna.socket.ws.close(1000, "deploy");
    ben.socket.ws.close(1000, "deploy");
    await settle();
    await asSchemaThree(wallId, "writing");

    const admin = await join(wallId, "Anna", { adminToken, sessionKey: anna.sessionKey });
    const member = await join(wallId, "Ben", { sessionKey: ben.sessionKey });
    await counting(wallId);
    // the first control of the clock: the flow, and once the agenda and the schema beside it
    expect(await ask(admin.socket, { type: "admin.clock.start", rev: 0, minutes: 5 })).toBe("ack");
    expect(await written(wallId)).toBe(3);
    const after = await meta(wallId);
    expect(after.schemaVersion).toBe("4");
    expect(JSON.parse(after.flow ?? "")).toMatchObject({ v: 2, step: 0, reach: 0, seq: 2 });
    expect(JSON.parse(after.agenda ?? "")).toMatchObject({ items: [{ methodId: "still-sammeln", version: 1 }] });
    // from then on a wall of this build: a control is one row, revealing is one row and the step move it always was
    expect(await ask(admin.socket, { type: "admin.clock.pause", rev: 1 })).toBe("ack");
    expect(await written(wallId)).toBe(4);
    expect(await answer(admin.socket, { type: "admin.step.go", from: 0, to: 1 })).toMatchObject({
      type: "ack",
      seq: 5,
    });
    expect(await written(wallId)).toBe(5);
    expect(await member.socket.waitFor((event) => event.type === "step.changed")).toEqual({
      type: "step.changed",
      seq: 5,
      step: 1,
      reach: 1,
    } satisfies ServerEvent);
  });
});
