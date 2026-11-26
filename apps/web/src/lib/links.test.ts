import { afterEach, expect, test, vi } from "vitest";
import { adminLink, adoptAdminLink, takeAdminFragment, wallIdOf, wallLink } from "./links";

const WALL = "0123456789abcdef".repeat(4);
const TOKEN = "fedcba9876543210fedcba9876543210";

afterEach(() => history.replaceState(null, "", "/"));

test("the wall's link is its address alone", () => {
  expect(wallLink("https://example.org", WALL)).toBe(`https://example.org/w/${WALL}`);
});

test("the moderation link carries the token in the fragment, never in the path or the query", () => {
  const url = new URL(adminLink("https://example.org", WALL, TOKEN));
  expect(url.pathname).toBe(`/w/${WALL}`);
  expect(url.search).toBe("");
  expect(url.hash).toBe(`#admin=${TOKEN}`);
});

test("a path names a wall only with an id of a wall's shape", () => {
  expect(wallIdOf(`/w/${WALL}`)).toBe(WALL);
  expect(wallIdOf(`/w/${WALL}/`)).toBe(WALL);
  expect(wallIdOf("/w/keine-wand")).toBeNull();
  expect(wallIdOf(`/w/${WALL}/mehr`)).toBeNull();
  expect(wallIdOf(`/x/${WALL}`)).toBeNull();
  expect(wallIdOf("/")).toBeNull();
});

test("a well-formed token is taken and the fragment emptied", () => {
  expect(takeAdminFragment(`#admin=${TOKEN}`)).toEqual({ token: TOKEN, hash: "" });
});

test("other parts of the fragment stay, in their order", () => {
  expect(takeAdminFragment(`#a=1&admin=${TOKEN}&b`)).toEqual({ token: TOKEN, hash: "#a=1&b" });
});

test("a fragment without admin= is not ours to touch", () => {
  expect(takeAdminFragment("")).toBeNull();
  expect(takeAdminFragment("#")).toBeNull();
  expect(takeAdminFragment("#section")).toBeNull();
  expect(takeAdminFragment("#administrator=1")).toBeNull();
});

test.each([
  ["cut short", `#admin=${TOKEN.slice(0, 31)}`],
  ["too long", `#admin=${TOKEN}0`],
  ["upper case", `#admin=${TOKEN.toUpperCase()}`],
  ["not hex", `#admin=${"g".repeat(32)}`],
  ["empty", "#admin="],
  ["the bare key", "#admin"],
  ["given twice", `#admin=${TOKEN}&admin=${TOKEN}`],
])("a malformed token (%s) is refused and taken out all the same", (_, hash) => {
  expect(takeAdminFragment(hash)).toEqual({ token: null, hash: "" });
});

test("adopting hands the token over and leaves no trace of it in the address", () => {
  history.replaceState(null, "", `/w/${WALL}#admin=${TOKEN}`);
  const entries = history.length;
  const keep = vi.fn();
  adoptAdminLink(keep);
  expect(keep).toHaveBeenCalledExactlyOnceWith(WALL, TOKEN);
  expect(location.pathname).toBe(`/w/${WALL}`);
  expect(location.hash).toBe("");
  expect(location.href).not.toContain(TOKEN);
  // replaced, not pushed: Back does not lead to an entry with the token
  expect(history.length).toBe(entries);
});

test("a malformed link is taken out of the address and hands nothing over", () => {
  history.replaceState(null, "", `/w/${WALL}#admin=nope&keep=1`);
  const keep = vi.fn();
  adoptAdminLink(keep);
  expect(keep).not.toHaveBeenCalled();
  expect(location.hash).toBe("#keep=1");
});

test("a token at an address that is no wall's is taken out and handed to nobody", () => {
  history.replaceState(null, "", `/waende#admin=${TOKEN}`);
  const keep = vi.fn();
  adoptAdminLink(keep);
  expect(keep).not.toHaveBeenCalled();
  expect(location.href).not.toContain(TOKEN);
});

test("no link, no change", () => {
  history.replaceState(null, "", `/w/${WALL}#keep=1`);
  const keep = vi.fn();
  adoptAdminLink(keep);
  expect(keep).not.toHaveBeenCalled();
  expect(location.hash).toBe("#keep=1");
});
