// wall-view.ts: how a wall is looked at: as its surface, or as its list, which is the same wall as headings and
// rows (PLAN.md 3.7). The choice is the browser's own: made once, it holds for every wall this browser opens, in a
// key of localStorage; it never leaves the device. Without a choice the width decides: on a phone twenty notes
// fitted onto the surface are too small to read, so a narrow window opens the list.
import { id as product } from "../../sebaro.product.json";

export type WallView = "surface" | "list";

const KEY = `${product}-view`;
/** Below this width a wall opens as its list, unless the browser holds a choice: sebaro's first page breakpoint,
 *  640 px at the standard text size. */
export const LIST_BELOW = "(max-width: 39.99rem)";

/** The view this browser chose, or null: it never chose. */
export function storedView(): WallView | null {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "surface" || stored === "list" ? stored : null;
  } catch {
    // storage blocked: the width decides
    return null;
  }
}

/** Keeps the choice for the walls this browser opens from now on. */
export function storeView(view: WallView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // storage blocked: the choice holds while the wall is open
  }
}

/** The view a wall opens in: the browser's choice, else the list in a narrow window and the surface in a wide one. */
export function firstView(): WallView {
  return storedView() ?? (window.matchMedia(LIST_BELOW).matches ? "list" : "surface");
}
