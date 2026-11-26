import { afterEach, expect, test, vi } from "vitest";
import { firstView, LIST_BELOW, storedView, storeView } from "./wall-view";

const narrow = (matches: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches, media: query }) as MediaQueryList);

afterEach(() => vi.restoreAllMocks());

test("without a choice the width decides: a narrow window opens the list, a wide one the surface", () => {
  const asked = narrow(true);
  expect(firstView()).toBe("list");
  expect(asked).toHaveBeenCalledWith(LIST_BELOW);
  narrow(false);
  expect(firstView()).toBe("surface");
  expect(storedView()).toBeNull();
});

test("a choice is the browser's: it holds at every width, and only „surface“ and „list“ are choices", () => {
  narrow(true);
  storeView("surface");
  expect(localStorage.getItem("ideabeam-view")).toBe("surface");
  expect(firstView()).toBe("surface");
  narrow(false);
  storeView("list");
  expect(firstView()).toBe("list");
  // what another build may have left there is no choice
  localStorage.setItem("ideabeam-view", "grid");
  expect(storedView()).toBeNull();
  expect(firstView()).toBe("surface");
});
