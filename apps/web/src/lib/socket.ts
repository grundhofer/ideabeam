// socket.ts: the wall's socket. From RetroBeam's BoardSocket (docs/HERKUNFT.md): partysocket reconnects, this class
// adds what a wall needs on top: the join goes first on every connection, commands written while offline wait,
// unanswered ones are sent again, and a connection that looks open but is dead is found and replaced.
import { WebSocket as ReconnectingWebSocket } from "partysocket";
import { parseServerEvent, type ClientCommand, type ServerEvent } from "@ideabeam/shared";

export type ConnectionStatus = "connecting" | "online" | "offline";

export type WallSocketOptions = {
  wallId: string;
  /** Called on every (re)connect: the join carries the stored session key, so a reconnect reclaims the same person
   *  and the fresh `sync` brings the wall as it stands. */
  join: () => Extract<ClientCommand, { type: "join" }>;
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** A command that waited for a connection and will never be sent: too many waited behind it. Whoever showed
   *  what it does takes that back. */
  onLost?: (command: ClientCommand) => void;
};

// The runtime answers "ping" with "pong" without waking the Durable Object. Whether such a ping counts as a request
// is not checked yet (PLAN.md 8); until then RetroBeam's interval.
const HEARTBEAT_INTERVAL_MS = 30_000;
// Silence for two intervals means the socket is dead rather than idle. TCP can hold a half-open connection open for
// minutes; until it notices, every send goes into a socket nobody is reading.
const PONG_TIMEOUT_MS = HEARTBEAT_INTERVAL_MS * 2;
// A queue that grows without bound is a memory leak and, on reconnect, a burst of stale frames. Kept below the
// server's per-socket budget (40, wall-room.ts): a flush larger than that bucket would be partly refused.
const MAX_QUEUED = 20;

/** Commands the server can safely be told twice. Everything sent again after a reconnect must be idempotent: the
 *  client cannot know whether the original was applied before the socket died, only that no answer came back. */
function isResendable(command: ClientCommand): command is ClientCommand & { opId: string } {
  return "opId" in command;
}

export class WallSocket {
  private readonly ws: ReconnectingWebSocket;
  private readonly heartbeat: ReturnType<typeof setInterval>;
  private readonly onVisibility: () => void;
  private readonly join: WallSocketOptions["join"];
  private readonly onLost: WallSocketOptions["onLost"];
  // Commands must never travel before this connection's `join` frame: the server refuses traffic from a socket that
  // has not joined. partysocket's own queue flushes BEFORE the open event (i.e. before our join), so its buffering
  // is off and this class queues offline commands itself, flushing them right after the join.
  private joinedThisConnection = false;
  private pending: ClientCommand[] = [];
  // Sent, but neither acked nor rejected: sent again on the next connection, before the offline queue drains, so
  // the order holds.
  private inFlight = new Map<string, ClientCommand>();
  private lastPongAt = Date.now();
  private pingOutstanding = false;
  // Closed on purpose (left, refused, the wall is gone): the connection's own end, which the browser reports a
  // moment later, is no drop to tell anybody about.
  private closed = false;

  constructor(options: WallSocketOptions) {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${location.host}/api/walls/${options.wallId}/ws`;
    options.onStatus("connecting");
    this.join = options.join;
    this.onLost = options.onLost;

    this.ws = new ReconnectingWebSocket(url, [], { maxEnqueuedMessages: 0 });
    this.ws.addEventListener("open", () => {
      options.onStatus("online");
      this.lastPongAt = Date.now();
      this.pingOutstanding = false;
      this.ws.send(JSON.stringify(this.join()));
      this.joinedThisConnection = true;
      for (const command of this.inFlight.values()) this.ws.send(JSON.stringify(command));
      // What waited is in flight from here on, like a command sent while online: should this connection die before
      // the answer, the next one sends it again.
      for (const command of this.pending.splice(0)) {
        if (isResendable(command)) this.inFlight.set(command.opId, command);
        this.ws.send(JSON.stringify(command));
      }
    });
    this.ws.addEventListener("message", (event) => {
      const data = event.data as unknown;
      if (data === "pong") {
        this.lastPongAt = Date.now();
        this.pingOutstanding = false;
        return;
      }
      const parsed = parseServerEvent(data);
      if (!parsed) return;
      // The server has spoken about this operation either way, so it is no longer in flight.
      if ((parsed.type === "ack" || parsed.type === "reject") && parsed.opId !== undefined) {
        this.inFlight.delete(parsed.opId);
      }
      options.onEvent(parsed);
    });
    this.ws.addEventListener("close", () => {
      this.joinedThisConnection = false;
      this.pingOutstanding = false;
      if (!this.closed) options.onStatus("offline");
    });

    this.heartbeat = setInterval(() => {
      if (this.ws.readyState !== this.ws.OPEN) return;
      // A ping that was never answered means this socket is half-open: it looks writable and nothing arrives.
      // Force a reconnect rather than keep feeding it, which is what leaves a wall silently frozen.
      if (this.pingOutstanding && Date.now() - this.lastPongAt > PONG_TIMEOUT_MS) {
        this.ws.reconnect();
        return;
      }
      this.pingOutstanding = true;
      this.ws.send("ping");
    }, HEARTBEAT_INTERVAL_MS);

    // Coming back to a backgrounded tab is exactly when a socket turns out to have died while nobody was looking;
    // probe at once instead of waiting out the interval.
    this.onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (this.ws.readyState === this.ws.OPEN) {
        this.pingOutstanding = true;
        this.ws.send("ping");
      } else {
        this.ws.reconnect();
      }
    };
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  send(command: ClientCommand): void {
    if (this.joinedThisConnection && this.ws.readyState === this.ws.OPEN) {
      if (isResendable(command)) this.inFlight.set(command.opId, command);
      this.ws.send(JSON.stringify(command));
      return;
    }
    if (this.pending.length >= MAX_QUEUED) {
      const lost = this.pending.shift();
      if (lost !== undefined) this.onLost?.(lost);
    }
    this.pending.push(command);
  }

  /** Stops sending a command again that the wall will never answer (it was dropped for the rate limit): whoever
   *  showed what it does has taken that back, and a later connection must not bring it back. */
  forget(opId: string): void {
    this.inFlight.delete(opId);
    this.pending = this.pending.filter((command) => !("opId" in command && command.opId === opId));
  }

  /** Joins again on the open connection, when what the join carries has changed (an admin token arrived): the wall
   *  answers with a fresh `sync`. Offline there is nothing to do: the next connection's join carries it anyway. */
  rejoin(): void {
    if (this.joinedThisConnection && this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(this.join()));
  }

  close(): void {
    this.closed = true;
    clearInterval(this.heartbeat);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.ws.close();
  }
}
