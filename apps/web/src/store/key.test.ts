// The moderation's own key lives in the tab's memory and nowhere else: taking it writes to no storage of the
// browser, and a store made anew, as after a reload, holds none.
import { afterEach, expect, test } from "vitest";
import { keyFault, useOwnKey } from "./key";

// A key of the test: no provider's, and recognisable wherever it turned up.
const KEY = "key-of-the-test-0123456789";

afterEach(() => useOwnKey.setState(useOwnKey.getInitialState()));

test("a key that is taken is held in memory; removing it leaves nothing", () => {
  expect(useOwnKey.getState()).toMatchObject({ own: null, unlocked: false });
  useOwnKey.getState().take({ provider: "mistral", key: KEY });
  expect(useOwnKey.getState().own).toEqual({ provider: "mistral", key: KEY });
  // another key takes its place
  useOwnKey.getState().take({ provider: "anthropic", key: `${KEY}-2` });
  expect(useOwnKey.getState().own).toEqual({ provider: "anthropic", key: `${KEY}-2` });
  useOwnKey.getState().drop();
  expect(useOwnKey.getState().own).toBeNull();
});

test("neither the key nor the switch is written to any storage of the browser", () => {
  localStorage.clear();
  sessionStorage.clear();
  const cookies = document.cookie;
  useOwnKey.getState().unlock();
  useOwnKey.getState().take({ provider: "openai", key: KEY });
  expect({ ...localStorage }).toEqual({});
  expect({ ...sessionStorage }).toEqual({});
  expect(document.cookie).toBe(cookies);
  expect(location.href).not.toContain(KEY);
  // a store as a reload makes it: nothing is brought back from anywhere
  expect(useOwnKey.getInitialState()).toMatchObject({ own: null, unlocked: false });
});

test("the switch stays on for the tab once it was set", () => {
  useOwnKey.getState().unlock();
  useOwnKey.getState().drop();
  expect(useOwnKey.getState().unlocked).toBe(true);
});

test("a key is what can stand in a header: one run of visible characters, whatever its form", () => {
  expect(keyFault("")).toBe("missing");
  expect(keyFault("   \n")).toBe("missing");
  // spaces and line breaks around it come from copying: they are no part of it
  expect(keyFault(`  ${KEY}\n`)).toBeUndefined();
  for (const key of ["sk-ant-api03-abc_DEF-123", "sk-proj-AbC123", "0123456789abcdef0123456789abcdef", "a"]) {
    expect(keyFault(key), key).toBeUndefined();
  }
  for (const key of ["two parts", "line\nbreak", "tab\there", "schlüssel", "key…", "emoji🔑"]) {
    expect(keyFault(key), key).toBe("malformed");
  }
});
