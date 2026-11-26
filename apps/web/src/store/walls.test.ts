import { expect, test } from "vitest";
import { SESSION_KEY_PATTERN } from "@ideabeam/shared";
import { id as product } from "../../sebaro.product.json";
import { useWalls } from "./walls";

const A = "a".repeat(64);
const B = "b".repeat(64);
const TOKEN = "c".repeat(32);
const STORE = `${product}-walls`;

test("a wall that is new gets a session key; coming back keeps it", () => {
  const { remember } = useWalls.getState();
  const first = remember({ id: A, question: "Was hält uns auf?", as: "Anna" });
  expect(first.sessionKey).toMatch(SESSION_KEY_PATTERN);

  const again = remember({ id: A, question: "Was hält uns noch auf?", as: "Anna B." });
  expect(again.sessionKey).toBe(first.sessionKey);
  expect(useWalls.getState().walls).toHaveLength(1);
  expect(useWalls.getState().walls[0]).toMatchObject({ question: "Was hält uns noch auf?", as: "Anna B." });
});

test("a wall that is new takes the key the live wall joined with", () => {
  const key = "d".repeat(32);
  expect(useWalls.getState().remember({ id: A, question: "Frage", as: "Anna", sessionKey: key }).sessionKey).toBe(key);
});

test("a wall made here is known before anybody has joined it, without a name; the join brings the name", () => {
  useWalls.setState({ displayName: "Anna" });
  const { remember } = useWalls.getState();
  const made = remember({ id: A, question: "Was hält uns auf?" });
  expect(made.as).toBeUndefined();
  // no name was given: the one typed last stays the one offered
  expect(useWalls.getState().displayName).toBe("Anna");

  const joined = remember({ id: A, question: "Was hält uns auf?", as: "Anna M." });
  expect(joined.as).toBe("Anna M.");
  expect(joined.sessionKey).toBe(made.sessionKey);
  // a later visit that names nobody keeps the name
  expect(remember({ id: A, question: "Was hält uns auf?" }).as).toBe("Anna M.");
});

test("the wall visited last stands first, and the name used last is offered again", () => {
  const { remember } = useWalls.getState();
  remember({ id: A, question: "Erste", as: "Anna" });
  remember({ id: B, question: "Zweite", as: "Anna M." });
  expect(useWalls.getState().walls.map((wall) => wall.question)).toEqual(["Zweite", "Erste"]);
  remember({ id: A, question: "Erste", as: "Anna" });
  expect(useWalls.getState().walls.map((wall) => wall.question)).toEqual(["Erste", "Zweite"]);
  expect(useWalls.getState().displayName).toBe("Anna");
});

test("an admin token is kept by wall, also of a wall this browser was never on", () => {
  useWalls.getState().keepToken(A, TOKEN);
  expect(useWalls.getState().adminTokens).toEqual({ [A]: TOKEN });
  expect(useWalls.getState().walls).toEqual([]);
});

test("a token that is held is never replaced: another one can only be wrong", () => {
  const { keepToken } = useWalls.getState();
  keepToken(A, TOKEN);
  keepToken(A, "e".repeat(32));
  expect(useWalls.getState().adminTokens[A]).toBe(TOKEN);
});

test("a wall that is gone is dropped, with its token", () => {
  const { remember, keepToken, forget } = useWalls.getState();
  remember({ id: A, question: "Erste", as: "Anna" });
  remember({ id: B, question: "Zweite", as: "Anna" });
  keepToken(A, TOKEN);
  keepToken(B, TOKEN);
  forget(A);
  expect(useWalls.getState().walls.map((wall) => wall.id)).toEqual([B]);
  expect(useWalls.getState().adminTokens).toEqual({ [B]: TOKEN });
});

test("the walls and the tokens are stored under one key of the product, with a version", () => {
  useWalls.getState().remember({ id: A, question: "Erste", as: "Anna" });
  useWalls.getState().keepToken(A, TOKEN);
  const stored = JSON.parse(localStorage.getItem(STORE) ?? "{}") as {
    version: number;
    state: { displayName: string; walls: Array<{ id: string }>; adminTokens: Record<string, string> };
  };
  expect(stored.version).toBe(1);
  expect(stored.state.displayName).toBe("Anna");
  expect(stored.state.walls.map((wall) => wall.id)).toEqual([A]);
  expect(stored.state.adminTokens).toEqual({ [A]: TOKEN });
});

test("what another tab stores is followed, so this tab's next write does not lose it", () => {
  useWalls.getState().remember({ id: A, question: "Erste", as: "Anna" });
  // another tab made a wall: it wrote the key with both walls and the new wall's token
  const other = JSON.parse(localStorage.getItem(STORE) ?? "{}") as {
    state: { walls: Array<Record<string, string>>; adminTokens: Record<string, string> };
  };
  other.state.walls.unshift({
    id: B,
    question: "Zweite",
    sessionKey: "d".repeat(32),
    visited: "2026-11-22T10:00:00.000Z",
  });
  other.state.adminTokens[B] = TOKEN;
  localStorage.setItem(STORE, JSON.stringify(other));
  window.dispatchEvent(new StorageEvent("storage", { key: STORE }));

  expect(useWalls.getState().walls.map((wall) => wall.id)).toEqual([B, A]);
  useWalls.getState().remember({ id: A, question: "Erste", as: "Anna" });
  const stored = JSON.parse(localStorage.getItem(STORE) ?? "{}") as typeof other;
  expect(stored.state.walls.map((wall) => wall.id)).toEqual([A, B]);
  expect(stored.state.adminTokens).toEqual({ [B]: TOKEN });
});
