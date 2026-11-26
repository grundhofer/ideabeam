// The switch that offers providers whose model is not measured yet: a part of an address's fragment, read once and
// taken out of the address at once.
import { afterEach, expect, test, vi } from "vitest";
import { adoptKeySwitch, KEY_SWITCH, takeKeySwitch } from "./key-switch";

const WALL = `/w/${"ab".repeat(32)}`;
afterEach(() => history.replaceState(null, "", "/"));

test("the switch is the part `eigener-schluessel` of a fragment, alone or beside other parts", () => {
  expect(KEY_SWITCH).toBe("eigener-schluessel");
  expect(takeKeySwitch("#eigener-schluessel")).toBe("");
  expect(takeKeySwitch("eigener-schluessel")).toBe("");
  // beside a moderation link's token, in either order: the rest stays for whoever reads it
  expect(takeKeySwitch("#admin=abc&eigener-schluessel")).toBe("#admin=abc");
  expect(takeKeySwitch("#eigener-schluessel&admin=abc")).toBe("#admin=abc");
  expect(takeKeySwitch("#eigener-schluessel&eigener-schluessel")).toBe("");
});

test("a fragment without the switch stays as it is", () => {
  for (const hash of ["", "#", "#ordnen", "#admin=abc", "#eigener-schluessel=1", "#mein-eigener-schluessel", "#x&y"]) {
    expect(takeKeySwitch(hash), hash).toBeNull();
  }
});

test("the switch is taken out of the address at once, and the tab is told once", () => {
  const on = vi.fn();
  history.replaceState({ idx: 3 }, "", `${WALL}?x=1#eigener-schluessel`);
  adoptKeySwitch(on);
  expect(on).toHaveBeenCalledTimes(1);
  // the path and the query stay, the fragment is gone, and the router's own state of the entry is kept
  expect(location.pathname + location.search + location.hash).toBe(`${WALL}?x=1`);
  expect(history.state).toEqual({ idx: 3 });
  // read again, there is nothing to adopt
  adoptKeySwitch(on);
  expect(on).toHaveBeenCalledTimes(1);
});

test("the rest of a fragment stays in the address; an address without the switch tells nothing", () => {
  const on = vi.fn();
  history.replaceState(null, "", `${WALL}#ordnen&eigener-schluessel`);
  adoptKeySwitch(on);
  expect(location.hash).toBe("#ordnen");
  expect(on).toHaveBeenCalledTimes(1);
  history.replaceState(null, "", `${WALL}#ordnen`);
  adoptKeySwitch(on);
  expect(location.hash).toBe("#ordnen");
  expect(on).toHaveBeenCalledTimes(1);
});
