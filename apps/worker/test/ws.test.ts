// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { env, evictAllDurableObjects, runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  generateHexId,
  generateSessionKey,
  MAX_FRAME_BYTES,
  MAX_ONLINE,
  PROTOCOL_VERSION,
  type ServerEvent,
} from "@ideabeam/shared";
import { wallStub } from "../src/wall-stub.js";
import {
  answer,
  ask,
  connect,
  createHiddenWall,
  createWall,
  join,
  resync,
  setDailyRows,
  settle,
  type Sync,
} from "./helpers.js";

const names = (sync: { participants: Array<{ name: string }> }) => sync.participants.map((p) => p.name);

const ofType = (events: ServerEvent[], type: ServerEvent["type"]) => events.filter((event) => event.type === type);

function stubOf(wallId: string) {
  const stub = wallStub(env, wallId);
  if (stub === null) throw new Error("the namespace did not take its own id");
  return stub;
}

describe("joining", () => {
  it("answers with the whole wall and says who you are", async () => {
    const { wallId } = await createWall("What slows us down?");
    const anna = await join(wallId, "Anna");
    expect(anna.sync.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(anna.sync.wall).toMatchObject({ id: wallId, question: "What slows us down?" });
    expect(anna.sync.participants).toEqual([{ id: anna.you, name: "Anna", role: "member", online: true }]);
    expect(Math.abs(anna.sync.serverNow - Date.now())).toBeLessThan(5000);
  });

  it("makes whoever holds the admin token the admin, and nobody else", async () => {
    const { wallId, adminToken } = await createWall();
    const admin = await join(wallId, "Anna", { adminToken });
    const guesser = await join(wallId, "Ben", { adminToken: "0".repeat(32) });
    const member = await join(wallId, "Cem");
    const roles = Object.fromEntries((await resync(member.socket)).participants.map((p) => [p.name, p.role]));
    expect(roles).toEqual({ Anna: "admin", Ben: "member", Cem: "member" });
    expect(admin.sync.participants[0]?.role).toBe("admin");
    expect(guesser.sync.participants.find((p) => p.id === guesser.you)?.role).toBe("member");
  });

  it("tells the others, and shows the newcomer who is there", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const ben = await join(wallId, "Ben");
    expect(names(ben.sync)).toEqual(["Anna", "Ben"]);
    const heard = await anna.socket.waitFor((event) => event.type === "presence.join");
    expect(heard).toEqual({
      type: "presence.join",
      participant: { id: ben.you, name: "Ben", role: "member", online: true },
    });
    // The newcomer does not hear their own arrival.
    await settle();
    expect(ofType(ben.socket.events, "presence.join")).toEqual([]);
  });

  it("allows one name per wall, however it is written", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    for (const name of ["Anna", "anna", "  ANNA  "]) {
      const socket = await connect(wallId);
      socket.send({ type: "join", name, sessionKey: generateSessionKey() });
      expect(await socket.waitFor((event) => event.type === "error")).toEqual({ type: "error", code: "NAME_TAKEN" });
      // Refused means not on the wall.
      socket.send({ type: "resync" });
      expect(await socket.waitForNext((event) => event.type === "error")).toEqual({
        type: "error",
        code: "NOT_JOINED",
      });
    }
    expect(names(await resync(anna.socket))).toEqual(["Anna"]);
  });

  it("is one person per socket", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    anna.socket.send({ type: "join", name: "Second", sessionKey: generateSessionKey() });
    expect(await anna.socket.waitForNext((event) => event.type === "error")).toEqual({
      type: "error",
      code: "BAD_MESSAGE",
    });
    expect(names(await resync(anna.socket))).toEqual(["Anna"]);
  });

  it(`lets ${MAX_ONLINE} people in at once and tells the next that the wall is full`, async () => {
    const { wallId } = await createWall();
    const people = [];
    for (let i = 1; i <= MAX_ONLINE; i++) people.push(await join(wallId, `Person ${i}`));
    const late = await connect(wallId);
    const sessionKey = generateSessionKey();
    late.send({ type: "join", name: "Too late", sessionKey });
    expect(await late.waitFor((event) => event.type === "error")).toEqual({ type: "error", code: "WALL_FULL" });

    // Somebody leaves: a place is free again.
    people[0]?.socket.ws.close(1000, "bye");
    await people[1]?.socket.waitFor((event) => event.type === "presence.leave");
    late.send({ type: "join", name: "Too late", sessionKey });
    const sync = await late.waitFor((event) => event.type === "sync");
    expect(sync.type === "sync" && sync.participants.filter((p) => p.online)).toHaveLength(MAX_ONLINE);
  });
});

describe("coming back", () => {
  it("is the same person under the same session key, not a second one", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const first = await join(wallId, "Ben");
    first.socket.ws.close(1000, "reload");
    await anna.socket.waitFor((event) => event.type === "presence.leave");

    const again = await join(wallId, "Ben", { sessionKey: first.sessionKey });
    expect(again.you).toBe(first.you);
    expect(again.sync.participants).toHaveLength(2);
    expect(again.sync.participants.every((p) => p.online)).toBe(true);
  });

  it("may take a new name, and the others see it", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const ben = await join(wallId, "Ben");
    ben.socket.ws.close(1000, "reload");
    await anna.socket.waitFor((event) => event.type === "presence.leave");

    const renamed = await join(wallId, "Benjamin", { sessionKey: ben.sessionKey });
    expect(renamed.you).toBe(ben.you);
    expect(
      await anna.socket.waitFor((event) => event.type === "presence.join" && event.participant.name === "Benjamin"),
    ).toMatchObject({ participant: { id: ben.you } });
    // ...but not a name that is somebody else's.
    renamed.socket.ws.close(1000, "reload");
    const socket = await connect(wallId);
    socket.send({ type: "join", name: "anna", sessionKey: ben.sessionKey });
    expect(await socket.waitFor((event) => event.type === "error")).toEqual({ type: "error", code: "NAME_TAKEN" });
  });

  it("keeps the admin an admin without the token, and never makes a member one", async () => {
    const { wallId, adminToken } = await createWall();
    const admin = await join(wallId, "Anna", { adminToken });
    const member = await join(wallId, "Ben");
    admin.socket.ws.close(1000, "reload");
    member.socket.ws.close(1000, "reload");

    const adminBack = await join(wallId, "Anna", { sessionKey: admin.sessionKey });
    const memberBack = await join(wallId, "Ben", { sessionKey: member.sessionKey, adminToken: "0".repeat(32) });
    expect(memberBack.sync.participants).toEqual([
      { id: admin.you, name: "Anna", role: "admin", online: true },
      { id: member.you, name: "Ben", role: "member", online: true },
    ]);
    expect(adminBack.you).toBe(admin.you);
  });

  it("leaves a demoted admin a member, token or not", async () => {
    const { wallId, adminToken } = await createWall();
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    // Stage 1 has no command that demotes. The row is written here the way the role command will write it.
    await runInDurableObject(stubOf(wallId), (_instance, state) => {
      state.storage.sql.exec("UPDATE participants SET role = 'member', demoted = 1 WHERE id = ?", anna.you);
    });
    anna.socket.ws.close(1000, "reload");
    await ben.socket.waitFor((event) => event.type === "presence.leave");

    const back = await join(wallId, "Anna", { sessionKey: anna.sessionKey, adminToken });
    expect(back.sync.participants.find((p) => p.id === anna.you)?.role).toBe("member");
  });
});

describe("more than one tab", () => {
  it("a second tab of somebody who is here is no arrival, and leaving is told when the last tab closes", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const tabOne = await join(wallId, "Ben");
    await anna.socket.waitFor((event) => event.type === "presence.join");
    const tabTwo = await join(wallId, "Ben", { sessionKey: tabOne.sessionKey });
    expect(tabTwo.you).toBe(tabOne.you);
    expect(tabTwo.sync.participants).toHaveLength(2);

    tabOne.socket.ws.close(1000, "tab closed");
    await settle();
    // Ben came once, changed nothing with the second tab, and is still here.
    expect(ofType(anna.socket.events, "presence.join")).toHaveLength(1);
    expect(ofType(anna.socket.events, "roster.updated")).toEqual([]);
    expect(ofType(anna.socket.events, "presence.leave")).toEqual([]);
    expect((await resync(anna.socket)).participants.find((p) => p.id === tabOne.you)?.online).toBe(true);

    tabTwo.socket.ws.close(1000, "tab closed");
    expect(await anna.socket.waitFor((event) => event.type === "presence.leave")).toEqual({
      type: "presence.leave",
      participantId: tabOne.you,
    });
    // Gone, but known: the wall remembers the person, offline.
    expect((await resync(anna.socket)).participants.find((p) => p.id === tabOne.you)?.online).toBe(false);
  });

  it("a new name from a second tab is a roster update for everyone else, the first tab included", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const tabOne = await join(wallId, "Ben");
    const tabTwo = await join(wallId, "Benjamin", { sessionKey: tabOne.sessionKey });
    expect(names(tabTwo.sync)).toEqual(["Anna", "Benjamin"]);

    const update = {
      type: "roster.updated",
      participant: { id: tabOne.you, name: "Benjamin", role: "member", online: true },
    };
    expect(await anna.socket.waitFor((event) => event.type === "roster.updated")).toEqual(update);
    expect(await tabOne.socket.waitFor((event) => event.type === "roster.updated")).toEqual(update);
    await settle();
    // Nobody came, and the tab that asked has it in its snapshot.
    expect(ofType(anna.socket.events, "presence.join")).toHaveLength(1);
    expect(ofType(tabTwo.socket.events, "roster.updated")).toEqual([]);
  });

  it("the admin token in a second tab makes the person admin in every tab", async () => {
    const { wallId, adminToken } = await createWall();
    const tabOne = await join(wallId, "Anna");
    expect(tabOne.sync.participants[0]?.role).toBe("member");
    await join(wallId, "Anna", { sessionKey: tabOne.sessionKey, adminToken });
    expect(await tabOne.socket.waitFor((event) => event.type === "roster.updated")).toEqual({
      type: "roster.updated",
      participant: { id: tabOne.you, name: "Anna", role: "admin", online: true },
    });

    // The role is the person's, not the socket's: the first tab may now do what only the admin may.
    const opId = generateHexId();
    tabOne.socket.send({ type: "admin.wall.delete", opId });
    expect(await tabOne.socket.waitFor((event) => event.type === "ack")).toEqual({ type: "ack", opId, seq: 0 });
  });

  it("a join sent again on the same socket tells nobody, unless it brings a new name", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const ben = await join(wallId, "Ben");
    await anna.socket.waitFor((event) => event.type === "presence.join");

    ben.socket.send({ type: "join", name: "Ben", sessionKey: ben.sessionKey });
    const again = (await ben.socket.waitForNext((event) => event.type === "sync")) as Sync;
    expect(names(again)).toEqual(["Anna", "Ben"]);
    await settle();
    expect(anna.socket.events).toHaveLength(2); // her own sync, and Ben's arrival

    ben.socket.send({ type: "join", name: "Benjamin", sessionKey: ben.sessionKey });
    expect(await anna.socket.waitFor((event) => event.type === "roster.updated")).toEqual({
      type: "roster.updated",
      participant: { id: ben.you, name: "Benjamin", role: "member", online: true },
    });
  });
});

describe("leaving", () => {
  it("closes the socket of whoever says leave", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const ben = await join(wallId, "Ben");
    ben.socket.send({ type: "leave" });
    await anna.socket.waitFor((event) => event.type === "presence.leave");
    expect(ben.socket.closed()).toBe(true);
  });
});

describe("frames the wall does not take", () => {
  /** A frame that would be a command if it were not for its size: exactly `bytes` long. */
  const padded = (bytes: number) => {
    const empty = JSON.stringify({ type: "resync", padding: "" }).length;
    return JSON.stringify({ type: "resync", padding: "x".repeat(bytes - empty) });
  };

  it("refuses a command before the join", async () => {
    const { wallId } = await createWall();
    const socket = await connect(wallId);
    socket.send({ type: "resync" });
    expect(await socket.waitFor((event) => event.type === "error")).toEqual({ type: "error", code: "NOT_JOINED" });
  });

  it("refuses what is no command, what is not text and what is too large", async () => {
    const { wallId } = await createWall();
    const { socket } = await join(wallId, "Anna");
    const frames: Array<string | ArrayBuffer> = [
      "hello",
      '{"type":"note.create"}',
      new Uint8Array([1, 2, 3]).buffer,
      padded(MAX_FRAME_BYTES + 1),
      // Fewer characters than the bound, more bytes: the frame is measured as it travels.
      JSON.stringify({ type: "resync", padding: "ä".repeat(MAX_FRAME_BYTES / 2) }),
    ];
    for (const frame of frames) {
      socket.sendRaw(frame);
      expect(await socket.waitForNext((event) => event.type === "error")).toEqual({
        type: "error",
        code: "BAD_MESSAGE",
      });
    }
  });

  it("takes a frame of exactly the size the protocol allows", async () => {
    const { wallId } = await createWall();
    const { socket } = await join(wallId, "Anna");
    const frame = padded(MAX_FRAME_BYTES);
    expect(frame).toHaveLength(256 * 1024);
    socket.sendRaw(frame);
    expect(await socket.waitForNext((event) => event.type === "sync" || event.type === "error")).toMatchObject({
      type: "sync",
    });
  });

  it("answers the heartbeat without it being a command", async () => {
    const { wallId } = await createWall();
    const { socket } = await join(wallId, "Anna");
    socket.sendRaw("ping");
    await socket.waitForOther("pong");
    expect(ofType(socket.events, "error")).toEqual([]);
  });

  it("stops a socket that sends faster than any person could", async () => {
    const { wallId } = await createWall();
    const { socket } = await join(wallId, "Anna");
    for (let i = 0; i < 80; i++) socket.sendRaw("nonsense");
    expect(await socket.waitFor((event) => event.type === "error" && event.code === "RATE_LIMIT")).toBeTruthy();
    // The first frames were read (and refused as nonsense), the rest were not read at all.
    const codes = socket.events.flatMap((event) => (event.type === "error" ? [event.code] : []));
    expect(codes.filter((code) => code === "BAD_MESSAGE").length).toBeLessThanOrEqual(40);
  });
});

describe("hibernation", () => {
  it("identity, role and the wall with its notes, groups and positions survive the Durable Object being evicted", async () => {
    const { wallId, adminToken } = await createWall("What do we keep?");
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    // What the wall holds: a note that lies where it was made, a group, and a note that was moved into the group.
    const [annas, bens, groupId] = [generateHexId(), generateHexId(), generateHexId()];
    const group = { type: "group.create", groupId, title: "Keep", x: 0, y: 0, w: 600, h: 400 };
    expect(await ask(anna.socket, { type: "note.create", noteId: annas, text: "The retro", x: 10, y: 20 })).toBe("ack");
    expect(await ask(ben.socket, { type: "note.create", noteId: bens, text: "The demo", x: 30, y: 40 })).toBe("ack");
    expect(await ask(ben.socket, group)).toBe("ack");
    expect(await ask(anna.socket, { type: "notes.move", moves: [{ noteId: bens, x: 50, y: 60, groupId }] })).toBe(
      "ack",
    );
    const before = await resync(ben.socket);
    // Something only the instance in memory holds, to see below that it really went.
    await runInDurableObject(stubOf(wallId), (instance) => {
      Reflect.set(instance, "markOfTheFirstInstance", true);
    });

    // Tear the instance down. Storage is kept and the sockets are hibernated:
    // whatever the object held in memory is gone. The SAME sockets go on.
    await evictAllDurableObjects();

    const after = await resync(ben.socket);
    expect(after.you.participantId).toBe(ben.you);
    expect(after.wall).toMatchObject({ id: wallId, question: "What do we keep?" });
    expect(after.participants).toEqual([
      { id: anna.you, name: "Anna", role: "admin", online: true },
      { id: ben.you, name: "Ben", role: "member", online: true },
    ]);
    expect(
      await runInDurableObject(stubOf(wallId), (instance) => Reflect.get(instance, "markOfTheFirstInstance")),
    ).toBeUndefined();

    // The notes with their texts and whose they are, the group, and where each note lies: all as before.
    expect(after.notes).toMatchObject([
      { id: annas, mine: false, text: "The retro", x: 10, y: 20, groupId: null },
      { id: bens, mine: true, text: "The demo", x: 50, y: 60, groupId },
    ]);
    expect(after.groups).toMatchObject([{ id: groupId, title: "Keep", titleSource: "person", locked: true, ord: 1 }]);
    expect(after.notes).toEqual(before.notes);
    expect(after.groups).toEqual(before.groups);
    expect(after.seq).toBe(4);

    // The woken object still knows whose note is whose, and goes on counting where the first one stopped: a change
    // made through a socket from before the eviction reaches the other socket from before it.
    expect(await ask(ben.socket, { type: "note.update", noteId: annas, text: "Mine now" })).toBe("NOT_AUTHOR");
    const move = { type: "notes.move", moves: [{ noteId: annas, x: 70, y: 80, groupId }] };
    expect(await answer(anna.socket, move)).toMatchObject({ type: "ack", seq: 5 });
    expect(await ben.socket.waitFor((event) => event.type === "notes.moved" && event.seq === 5)).toMatchObject({
      moves: [{ noteId: annas, x: 70, y: 80, groupId }],
    });

    // And the woken object still knows who may do what.
    const refused = generateHexId();
    ben.socket.send({ type: "admin.wall.delete", opId: refused });
    expect(await ben.socket.waitForNext((event) => event.type === "reject")).toEqual({
      type: "reject",
      opId: refused,
      code: "NOT_ADMIN",
    });

    // A newcomer after the eviction is heard by a socket from before it, and gets the wall as it stands.
    const cem = await join(wallId, "Cem");
    expect(
      await anna.socket.waitFor((event) => event.type === "presence.join" && event.participant.id === cem.you),
    ).toBeTruthy();
    expect(cem.sync.seq).toBe(5);
    expect(cem.sync.notes).toMatchObject([
      { id: annas, x: 70, y: 80, groupId },
      { id: bens, x: 50, y: 60, groupId },
    ]);

    // The admin's socket from before the eviction is still the admin's.
    const taken = generateHexId();
    anna.socket.send({ type: "admin.wall.delete", opId: taken });
    expect(await anna.socket.waitFor((event) => event.type === "ack" && event.opId === taken)).toEqual({
      type: "ack",
      opId: taken,
      seq: 5,
    });
    await ben.socket.waitFor((event) => event.type === "wall.deleted");
  });

  it("the phase, the hidden notes, the clock and the brake's day mark survive the Durable Object being evicted", async () => {
    const { wallId, adminToken } = await createHiddenWall("What do we hide?");
    const anna = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    const [annas, bens] = [generateHexId(), generateHexId()];
    expect(await ask(anna.socket, { type: "note.create", noteId: annas, text: "Anna's secret", x: 10, y: 20 })).toBe(
      "ack",
    );
    expect(await ask(ben.socket, { type: "note.create", noteId: bens, text: "Ben's own", x: 30, y: 40 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.start", rev: 0, minutes: 30 })).toBe("ack");
    expect(await ask(anna.socket, { type: "admin.clock.pause", rev: 1 })).toBe("ack");
    const before = await resync(ben.socket);
    expect(before).toMatchObject({ phase: "writing", seq: 4, hidden: 1, clock: { rev: 2, endsAt: null } });
    const stored = () =>
      runInDurableObject(stubOf(wallId), (_instance, state) =>
        Object.fromEntries(
          state.storage.sql
            .exec("SELECT key, value FROM meta WHERE key IN ('flow', 'day')")
            .toArray()
            .map((row) => [String(row.key), JSON.parse(String(row.value)) as unknown]),
        ),
      );
    const rows = await stored();
    expect(rows).toMatchObject({ flow: { phase: "writing", seq: 4, clock: before.clock }, day: { seq: 0 } });
    await runInDurableObject(stubOf(wallId), (instance) => {
      Reflect.set(instance, "markOfTheFirstInstance", true);
    });

    await evictAllDurableObjects();

    expect(
      await runInDurableObject(stubOf(wallId), (instance) => Reflect.get(instance, "markOfTheFirstInstance")),
    ).toBeUndefined();
    expect(await stored()).toEqual(rows);

    // The phase and what it hides: Ben still gets his own note and a number, in a snapshot and in the stream.
    const after = await resync(ben.socket);
    expect(after).toMatchObject({ phase: "writing", seq: 4, hidden: 1, notes: [{ id: bens, mine: true }] });
    expect(after.notes).toEqual(before.notes);
    const more = generateHexId();
    expect(
      await ask(anna.socket, { type: "note.create", noteId: more, text: "Anna's second secret", x: 0, y: 0 }),
    ).toBe("ack");
    expect(await ben.socket.waitFor((event) => event.type === "wall.occupancy" && event.seq === 5)).toEqual({
      type: "wall.occupancy",
      seq: 5,
      hidden: 2,
    });
    expect(await ask(ben.socket, { type: "note.update", noteId: annas, text: "Mine now" })).toBe("NOT_FOUND");
    expect(ben.socket.raw.some((frame) => frame.includes("secret") || frame.includes(annas))).toBe(false);

    // The clock: the same data, and the woken object knows its revision. A control made for the old one is stale.
    expect(after.clock).toEqual(before.clock);
    expect(await ask(anna.socket, { type: "admin.clock.resume", rev: 1 })).toBe("STALE");
    expect(await answer(anna.socket, { type: "admin.clock.resume", rev: 2 })).toMatchObject({ type: "ack", seq: 6 });

    // The brake's day mark: the woken object counts today's rows from where the day began, not from where it woke.
    // Six changes were stored today, four before the eviction and two after it (three notes, three controls of the
    // clock): with a brake of five rows the wall is spent, with one of seven it takes one more.
    await setDailyRows(wallId, 5);
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "One more", x: 0, y: 0 })).toBe(
      "DAY_SPENT",
    );
    await setDailyRows(wallId, 7);
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "One more", x: 0, y: 0 })).toBe(
      "ack",
    );
    expect(await ask(ben.socket, { type: "note.create", noteId: generateHexId(), text: "And one", x: 0, y: 0 })).toBe(
      "DAY_SPENT",
    );
    expect((await stored()).day).toEqual(rows.day);

    // Revealing through a socket from before the eviction brings the socket from before it what it did not have.
    expect(await answer(anna.socket, { type: "admin.phase.set", phase: "open" })).toMatchObject({
      type: "ack",
      seq: 9,
    });
    expect(await ben.socket.waitFor((event) => event.type === "notes.revealed")).toMatchObject({
      seq: 8,
      notes: [
        { id: annas, mine: false, text: "Anna's secret" },
        { id: more, mine: false },
      ],
    });
    await evictAllDurableObjects();
    expect(await resync(ben.socket)).toMatchObject({ phase: "open", seq: 9, hidden: 0 });
  });
});

describe("deleting the wall", () => {
  it("is the admin's alone", async () => {
    const { wallId } = await createWall();
    const anna = await join(wallId, "Anna");
    const opId = generateHexId();
    anna.socket.send({ type: "admin.wall.delete", opId });
    expect(await anna.socket.waitFor((event) => event.type === "reject")).toEqual({
      type: "reject",
      opId,
      code: "NOT_ADMIN",
    });
    expect((await SELF.fetch(`https://example.com/api/walls/${wallId}`)).status).toBe(200);
  });

  it("tells everyone, closes every socket and leaves nothing behind", async () => {
    const { wallId, adminToken } = await createWall();
    const admin = await join(wallId, "Anna", { adminToken });
    const ben = await join(wallId, "Ben");
    const opId = generateHexId();
    admin.socket.send({ type: "admin.wall.delete", opId });

    expect(await admin.socket.waitFor((event) => event.type === "ack")).toEqual({ type: "ack", opId, seq: 0 });
    await admin.socket.waitFor((event) => event.type === "wall.deleted");
    await ben.socket.waitFor((event) => event.type === "wall.deleted");
    await settle();
    expect(admin.socket.closed()).toBe(true);
    expect(ben.socket.closed()).toBe(true);

    // The address answers like one that never led anywhere.
    const info = await SELF.fetch(`https://example.com/api/walls/${wallId}`);
    expect(info.status).toBe(404);
    const again = await SELF.fetch(`https://example.com/api/walls/${wallId}/ws`, { headers: { Upgrade: "websocket" } });
    expect(again.status).toBe(404);
  });
});
