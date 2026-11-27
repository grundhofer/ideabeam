// wall.ts: the wall this tab is on, live: what the socket has told, moved on by the shared reducer. Nothing here is
// stored; a reload joins again and gets the wall as it stands. What the app remembers about walls is store/walls.ts.
import { create } from "zustand";
import {
  applyCommand,
  applyServerEvent,
  dropPending,
  generateHexId,
  generateSessionKey,
  initialWallState,
  PROTOCOL_VERSION,
  type Ballot,
  type BallotCommand,
  type ClockCommand,
  type ContentCommand,
  type CountCommand,
  type RejectCode,
  type ServerEvent,
  type StepCommand,
  type WallState,
} from "@ideabeam/shared";
import type { ProviderFailure, ProviderId } from "@ideabeam/arrange";
import { findWall, type ArrangeFailure } from "../lib/api";
import type { Arranged } from "../lib/arrange";
import { workerTime } from "../lib/clock";
import { WallSocket, type ConnectionStatus } from "../lib/socket";
import { useWalls } from "./walls";

/** Why the wall did not let this browser on. */
export type Refusal = "NAME_TAKEN" | "WALL_FULL";

/** The commands of the wall's flow, whose result shows once the wall has said so, to everyone at once: the
 *  moderation's step moves (revealing among them), the controls of the writing's clock and counting a vote; and
 *  everybody's ballot, which shows as stored once the wall has stored it (stage M2). */
type FlowCommand = StepCommand | ClockCommand | BallotCommand | CountCommand;

/** A change of this browser that the wall did not take, and so is taken back: the reason, and the kind of command
 *  it was (null: neither a change of the wall's content nor a step of its flow). Beside the wall's own reasons:
 *  `RATE_LIMIT`, too many frames at once, and `LOST`, the change waited for a connection behind too many others.
 *
 *  „Ordnen“ that gave no proposal stands here too, as the one step of the moderation that is no command of the
 *  socket: `command` is `arrange`, and the reason is the Worker's (lib/api.ts) or the app's own: `TIMEOUT`, no
 *  answer in the time the app waits, and `NOTHING_LEFT`, a proposal none of whose notes is left to arrange. With the
 *  moderation's own key the provider is asked from this browser: `command` is `arrange.key`, and the reason is what
 *  the provider's answers said (packages/arrange, provider-calls.ts) or the app's own: `TIMEOUT`, the provider was
 *  not done in the time the app waits, and `LOAD`, the part of the app that asks a provider did not load. */
export type Rejected =
  | {
      code: RejectCode | "RATE_LIMIT" | "LOST";
      command: ContentCommand["type"] | FlowCommand["type"] | null;
      /** with `DAY_SPENT`: the moment the wall takes changes again, the next 00:00 UTC */
      resetsAt?: number;
    }
  | {
      code: ArrangeFailure | "TIMEOUT" | "NOTHING_LEFT";
      command: "arrange";
      /** with `WALL_RUNS_SPENT`, and with `AI_BUDGET_SPENT` where the product's own count refused: the moment the
       *  run fits again, within 24 hours. Left out where Cloudflare itself refused: the app does not know when that
       *  goes on */
      resetsAt?: number;
      /** with `resetsAt`: this device's clock when the answer came. The sentence says from it whether the moment
       *  lies on the next day */
      at?: number;
      /** with `NOTHING_TO_ARRANGE`: how many notes it takes */
      min?: number;
    }
  | {
      code: ProviderFailure | "TIMEOUT" | "LOAD";
      command: "arrange.key";
      /** the provider that was asked: the sentence names it, and nothing else of what it said */
      provider: ProviderId;
    };

/** A control of the writing's clock as the wall's view asks for it. The store adds the revision of the clock it is
 *  made for. */
export type ClockControl = { type: "start"; minutes: number } | { type: "pause" | "resume" | "extend" | "clear" };

// A `resync` costs the wall a whole snapshot and this socket ten frames of its budget (wall-room.ts): after one that
// was refused for the rate limit, the next try waits until the budget has filled again.
const RESYNC_RETRY_MS = 6000;

type Live = {
  wallId: string | null;
  state: WallState;
  /** `idle`: not on a wall, or refused */
  status: "idle" | ConnectionStatus;
  refusal: Refusal | null;
  /** the Worker speaks another version of the protocol than this script: the page has to be loaded again */
  outdated: boolean;
  /** the last change of this browser that the wall did not take, until the next change or until it is dismissed */
  rejected: Rejected | null;
  /** the wall has forgotten this browser's person, on its own word (`erase`) or on that of another tab */
  erased: boolean;
  /** The arrangement this browser saw arrive last (`arrange.applied`): the run, and the number the wall stood at
   *  right after it. While the wall still stands at that number, nothing has changed since the run, and taking it
   *  back loses nothing (lib/arrange.ts). null: none arrived on this visit. */
  arranged: Arranged | null;
  /** This browser's clock less the worker's, from the last frame that carried the worker's time (`sync`,
   *  `clock.changed`). The clock of the writing ends at a moment of the worker's clock: with this distance a browser
   *  whose own clock is wrong shows the same minute as everybody else (lib/clock.ts). */
  skew: number;
  /** The worker's clock as this browser last reckoned it: set by every frame that carries the worker's time, moved
   *  on by look(). The view works out what is left of the clock from it, so it never reads a clock while it
   *  renders. */
  now: number;
  /** Looks at the clock again: the browser counts. The view calls it when the minute turns (lib/clock.ts). */
  look(): void;
  /** Joins the wall under a name. Coming back, it is the same person: the session key is the stored one. With an
   *  admin token in this browser's storage, the join carries it and the person moderates. */
  enter(wallId: string, as: string): void;
  /** Leaves the wall and forgets what was live. */
  leave(): void;
  /** The moderation's: deletes the wall for everyone. */
  deleteWall(): void;
  /** „Meine Angaben löschen“: the wall forgets this person; their notes stay, without a name. The wall's word on it
   *  (`erased`) ends the visit, and this browser forgets the wall, its admin token included. */
  erase(): void;
  /** A change to the wall's content, at once: it shows from now on (`shown(state)`) and is on its way to the wall,
   *  which answers under its `opId`. A reject takes it back and says why (`rejected`). */
  send(command: ContentCommand): void;
  /** The moderation's: moves the wall to another step of its agenda, from the one this browser knows it in (a move
   *  that shows the hidden notes is revealing, for good). Nothing shows before the wall has said so, to everyone at
   *  once. */
  goStep(to: number): void;
  /** The moderation's: a control of the writing's clock, made for the clock as this browser knows it. Nothing shows
   *  before the wall has said so. */
  setClock(control: ClockControl): void;
  /** „Abgeben“: this person's whole ballot for the step the wall is in, as this browser knows it. It shows as cast
   *  once the wall has stored it (`state.ballot`); nobody else learns more than that one more has voted. */
  castBallot(ballot: Ballot): void;
  /** The moderation's „Auszählen“: the vote of the step the wall is in is counted, and everybody gets the result at
   *  once. */
  countVotes(): void;
  /** The reason of the last reject has been read. */
  dismissRejected(): void;
};

// the socket is no state: nothing renders from it
let socket: WallSocket | null = null;
// while on a wall: ends following the stored admin tokens
let unfollow = () => {};
// This browser and the wall are out of step (`gap`) and the wall has been asked again: no second question until
// the `sync` that answers, or until the question itself was refused.
let resyncAsked = false;
let resyncRetry: ReturnType<typeof setTimeout> | undefined;
// The moderation's commands of the flow that the wall has not answered yet, by their operation. Nothing of them
// shows before the wall has said so, so they are no part of `state.pending`; what an answer needs to know about
// them stands here. `sent`: the frame went out on a connection. `again`: that connection dropped before the answer,
// so the socket sends the frame once more (lib/socket.ts), and the wall may see it twice.
const asked = new Map<string, { type: FlowCommand["type"]; sent: boolean; again: boolean }>();

const closed = {
  wallId: null,
  state: initialWallState,
  status: "idle",
  refusal: null,
  outdated: false,
  rejected: null,
  erased: false,
  arranged: null,
  skew: 0,
  now: 0,
} as const;

export const useWall = create<Live>()((set, get) => {
  const drop = () => {
    unfollow();
    unfollow = () => {};
    socket?.close();
    socket = null;
    resyncAsked = false;
    clearTimeout(resyncRetry);
    asked.clear();
  };

  /** A step of the flow goes to the wall. It is remembered until the wall answers, and a reason that still stands
   *  from an earlier change is put away, as with every new change. */
  const ask = (command: FlowCommand) => {
    if (socket === null) return;
    asked.set(command.opId, { type: command.type, sent: get().status === "online", again: false });
    set({ rejected: null });
    socket.send(command);
  };

  /** Out of step with the wall: ask for it again, once. Offline there is nothing to ask: the next connection's
   *  join brings the wall anyway. */
  const resync = () => {
    if (resyncAsked || !get().state.gap || get().status !== "online") return;
    resyncAsked = true;
    socket?.send({ type: "resync" });
  };

  /** The wall is gone: say so, stop reconnecting and drop it from the walls this browser knows. */
  const gone = (wallId: string) => {
    drop();
    useWalls.getState().forget(wallId);
    set((live) => (live.wallId === wallId ? { state: { ...live.state, deleted: true }, status: "idle" } : live));
  };

  return {
    ...closed,
    enter(wallId, as) {
      drop();
      const known = useWalls.getState().walls.find((wall) => wall.id === wallId);
      // a person who was never on this wall gets a key now; it is stored once the wall has let them on
      const sessionKey = known?.sessionKey ?? generateSessionKey();
      set({ ...closed, wallId, status: "connecting" });

      const onEvent = (event: ServerEvent) => {
        if (get().wallId !== wallId) return;
        if (event.type === "error" && (event.code === "NAME_TAKEN" || event.code === "WALL_FULL")) {
          // refused: a socket that kept reconnecting would only be refused again
          drop();
          set({ status: "idle", refusal: event.code });
          return;
        }
        if (event.type === "wall.deleted") {
          gone(wallId);
          return;
        }
        if (event.type === "erased") {
          // the wall no longer knows this person: nothing to reconnect as, and nothing to keep about the wall
          drop();
          useWalls.getState().forget(wallId);
          set({ status: "idle", erased: true });
          return;
        }
        if (event.type === "error" && event.code === "RATE_LIMIT") {
          // The wall dropped a frame unread, and does not say which. A `resync` that is out is the likeliest: it
          // costs the most. It is asked again once the budget has filled.
          if (resyncAsked) {
            clearTimeout(resyncRetry);
            resyncRetry = setTimeout(() => {
              resyncAsked = false;
              resync();
            }, RESYNC_RETRY_MS);
            return;
          }
          // Else it was the oldest change still on its way: the wall answers in the order it reads. It is taken
          // back, and never sent again. Had the wall taken it after all, its event would bring it back.
          const lost = get().state.pending[0]?.command;
          if (lost !== undefined) {
            socket?.forget(lost.opId);
            set((live) => ({
              state: dropPending(live.state, lost.opId),
              rejected: { code: "RATE_LIMIT", command: lost.type },
            }));
            return;
          }
          // No change of the content is on its way: then it was a step of the flow, if one is. It is never sent
          // again either: a reveal that went out by itself on some later connection would surprise everyone.
          const [flowId] = asked.keys();
          const flow = flowId === undefined ? undefined : asked.get(flowId);
          if (flowId === undefined || flow === undefined) return;
          asked.delete(flowId);
          socket?.forget(flowId);
          set({ rejected: { code: "RATE_LIMIT", command: flow.type } });
          return;
        }
        if (event.type === "sync") {
          // on: from now on this browser knows the wall and is the same person on it
          useWalls.getState().remember({ id: wallId, question: event.wall.question, as, sessionKey });
          set({ outdated: event.protocolVersion !== PROTOCOL_VERSION });
          resyncAsked = false;
          clearTimeout(resyncRetry);
        }
        // the wall has spoken about a step of the flow: it is no longer on its way
        const flow =
          (event.type === "ack" || event.type === "reject") && event.opId !== undefined
            ? asked.get(event.opId)
            : undefined;
        if (flow !== undefined && "opId" in event && event.opId !== undefined) asked.delete(event.opId);
        if (event.type === "reject") {
          // the change is taken back below, by the reducer; here is why
          const refused = get().state.pending.find(({ command }) => command.opId === event.opId)?.command;
          // A control of the clock that went out twice (the line dropped before its answer) is answered `STALE`
          // when the wall took the first one: the clock this browser has got is right, and there is nothing to say.
          const echo = event.code === "STALE" && flow?.again === true;
          if (!echo) {
            set({
              rejected: {
                code: event.code,
                command: refused?.type ?? flow?.type ?? null,
                ...(event.resetsAt === undefined ? {} : { resetsAt: event.resetsAt }),
              },
            });
          }
        }
        // The worker's time, where a frame carries it: the distance to this browser's clock, and the moment the
        // clock's sentence is worked out for, in the same step as the clock itself.
        const timed = event.type === "sync" || event.type === "clock.changed";
        set((live) => {
          const state = applyServerEvent(live.state, event);
          return {
            state,
            ...(timed ? { skew: Date.now() - event.serverNow, now: event.serverNow } : {}),
            // an arrangement arrived: the run, and where the wall stands right after it
            ...(event.type === "arrange.applied" ? { arranged: { runId: event.runId, seq: state.seq } } : {}),
          };
        });
        resync();
      };

      const onStatus = (status: ConnectionStatus) => {
        if (get().wallId !== wallId) return;
        set({ status });
        // The steps of the flow that are on their way: with a connection the ones that waited go out (the socket
        // sends them right after the join); without one, those that had gone out will go out a second time.
        for (const flow of asked.values()) {
          if (status === "online") flow.sent = true;
          else if (status === "offline" && flow.sent) flow.again = true;
        }
        // A wall that was deleted while this tab was away refuses every new connection, and the socket would try
        // forever: ask once per drop whether the wall is still there.
        if (status === "offline") {
          void findWall(wallId).then((found) => {
            if (!found.ok && found.why === "unknown" && get().wallId === wallId) gone(wallId);
          });
        }
      };

      socket = new WallSocket({
        wallId,
        // the token is read when the join is written: one that arrived since the last connection goes with it
        join: () => {
          const adminToken = useWalls.getState().adminTokens[wallId];
          return { type: "join", name: as, sessionKey, ...(adminToken === undefined ? {} : { adminToken }) };
        },
        onEvent,
        onStatus,
        // a change that waited for a connection and never went out: it is taken back
        onLost: (command) => {
          if (get().wallId !== wallId || !("opId" in command)) return;
          const flow = asked.get(command.opId);
          if (flow !== undefined) {
            asked.delete(command.opId);
            set({ rejected: { code: "LOST", command: flow.type } });
            return;
          }
          const lost = get().state.pending.find((pending) => pending.command.opId === command.opId)?.command;
          if (lost === undefined) return;
          set((live) => ({
            state: dropPending(live.state, lost.opId),
            rejected: { code: "LOST", command: lost.type },
          }));
        },
      });
      // a moderation link opened while this tab is on the wall: the join goes again, now with the token
      unfollow = useWalls.subscribe((now, before) => {
        const adminToken = now.adminTokens[wallId];
        if (adminToken !== undefined && adminToken !== before.adminTokens[wallId]) socket?.rejoin();
      });
    },
    leave() {
      drop();
      set(closed);
    },
    deleteWall() {
      socket?.send({ type: "admin.wall.delete", opId: generateHexId() });
    },
    erase() {
      socket?.send({ type: "me.erase", opId: generateHexId() });
    },
    send(command) {
      if (socket === null) return;
      set((live) => ({ state: applyCommand(live.state, command, Date.now()), rejected: null }));
      socket.send(command);
    },
    goStep(to) {
      ask({ type: "admin.step.go", opId: generateHexId(), from: get().state.step, to });
    },
    setClock(control) {
      const opId = generateHexId();
      const rev = get().state.clock.rev;
      ask(
        control.type === "start"
          ? { type: "admin.clock.start", opId, rev, minutes: control.minutes }
          : { type: `admin.clock.${control.type}`, opId, rev },
      );
    },
    castBallot(ballot) {
      ask({ type: "ballot.cast", opId: generateHexId(), step: get().state.step, ballot });
    },
    countVotes() {
      ask({ type: "admin.step.count", opId: generateHexId(), step: get().state.step });
    },
    look() {
      set((live) => ({ now: workerTime(Date.now(), live.skew) }));
    },
    dismissRejected() {
      set({ rejected: null });
    },
  };
});
