// For unit tests: a WebSocket of the test in place of the browser's. The app's real socket (lib/socket.ts and
// partysocket) connects to it, so what goes out is what a wall would get, and the test speaks as the wall.
import { expect, vi } from "vitest";
import type { ClientCommand, ServerEvent } from "@ideabeam/shared";

export class FakeWebSocket extends EventTarget {
  static all: FakeWebSocket[] = [];
  readyState = 0;
  binaryType = "blob";
  /** every frame the app sent, the heartbeat left out */
  sent: ClientCommand[] = [];
  constructor(readonly url: string) {
    super();
    FakeWebSocket.all.push(this);
  }
  send(data: string) {
    if (data !== "ping") this.sent.push(JSON.parse(data) as ClientCommand);
  }
  /** As in a browser: closed at once, and the close is reported a moment later. */
  close() {
    this.readyState = 3;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  }
  // the wall's side
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  tell(event: ServerEvent) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(event) }));
  }
  drop() {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}

/** Puts the test's WebSocket in place; `vi.unstubAllGlobals()` takes it out again. */
export function fakeSockets() {
  FakeWebSocket.all = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
}

/** The socket the app opens next, connected: its join has gone out. */
export async function nextSocket(after = FakeWebSocket.all.length) {
  await vi.waitFor(() => expect(FakeWebSocket.all.length).toBeGreaterThan(after));
  const socket = FakeWebSocket.all.at(-1)!;
  socket.open();
  return socket;
}
