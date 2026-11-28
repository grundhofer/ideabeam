// view.ts: the arithmetic of the surface's view: which part of the world the surface shows, and how large. Pure
// functions, no page: the surface (components/Surface.tsx) holds one View and writes it as one CSS transform.
//
// Every length is a number of units of 1/16 rem, on the surface as in the world (PLAN.md 3.1): the surface turns
// the pixels of a pointer into units once, where it reads them. `zoom` is the ratio between the two: at 1 a world
// unit is drawn one unit large.
//
// The wheel and zoom arithmetic follows RetroBeam's BoardCanvas.tsx (docs/HERKUNFT.md); the world there had a fixed
// size, this one has none.

export type Point = { x: number; y: number };
export type Size = { w: number; h: number };
/** A rectangle: its top left corner and its size. */
export type Box = Point & Size;

/** Where the world's origin lies on the surface, and how large the world is drawn. */
export type View = { x: number; y: number; zoom: number };

/** The smallest zoom: every note of a full wall, laid out side by side, still fits a phone. */
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 2;
/** One step of the zoom keys and the zoom controls. */
export const ZOOM_STEP = 1.25;
/** The room kept between the surface's edge and what is brought into view. */
export const MARGIN = 24;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The point of the world that lies under a point of the surface. */
export function toWorld(view: View, at: Point): Point {
  return { x: (at.x - view.x) / view.zoom, y: (at.y - view.y) / view.zoom };
}

/** Where on the surface a point of the world lies. */
export function toSurface(view: View, at: Point): Point {
  return { x: view.x + at.x * view.zoom, y: view.y + at.y * view.zoom };
}

/** The view moved by a distance on the surface. */
export function panBy(view: View, dx: number, dy: number): View {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

/** The view at another zoom, kept inside the limits; the point of the world under `at` stays where it is. */
export function zoomAt(view: View, at: Point, zoom: number): View {
  const next = clampZoom(zoom);
  const world = toWorld(view, at);
  return { zoom: next, x: at.x - world.x * next, y: at.y - world.y * next };
}

/** The zoom after a wheel has turned by `delta`: away from the person zooms in. Each notch changes the zoom by the
 *  same share, so zooming in and out by the same turn ends where it began. */
export function wheelZoom(zoom: number, delta: number): number {
  return zoom * Math.exp(-delta * 0.002);
}

/** Two fingers: the view that was `view` when the fingers lay at `from`, now that they lie at `to`. The point of
 *  the world that lay between them is still between them, and the world has grown as their distance has. */
export function pinch(view: View, from: [Point, Point], to: [Point, Point]): View {
  const middle = ([a, b]: [Point, Point]): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const spread = ([a, b]: [Point, Point]) => Math.hypot(a.x - b.x, a.y - b.y);
  const before = spread(from);
  const zoom = clampZoom(before > 0 ? (view.zoom * spread(to)) / before : view.zoom);
  const world = toWorld(view, middle(from));
  const now = middle(to);
  return { zoom, x: now.x - world.x * zoom, y: now.y - world.y * zoom };
}

/** The part of the world the surface shows. */
export function visible(view: View, surface: Size): Box {
  const { x, y } = toWorld(view, { x: 0, y: 0 });
  return { x, y, w: surface.w / view.zoom, h: surface.h / view.zoom };
}

/** The smallest box around all the boxes, or null for none. */
export function around(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const box of boxes) {
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.w);
    bottom = Math.max(bottom, box.y + box.h);
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** „Alles zeigen“: the view that shows the whole box in the middle of the surface, as large as it fits and never
 *  larger than life. Without a box (an empty wall) the world's origin lies in the middle: every browser on an empty
 *  wall looks at the same place, so the first notes land where everyone sees them. */
export function fit(box: Box | null, surface: Size, margin = MARGIN): View {
  if (box === null) return { x: surface.w / 2, y: surface.h / 2, zoom: 1 };
  const room = { w: Math.max(1, surface.w - 2 * margin), h: Math.max(1, surface.h - 2 * margin) };
  const zoom = Math.min(1, clampZoom(Math.min(room.w / Math.max(1, box.w), room.h / Math.max(1, box.h))));
  return {
    zoom,
    x: (surface.w - box.w * zoom) / 2 - box.x * zoom,
    y: (surface.h - box.h * zoom) / 2 - box.y * zoom,
  };
}

/** „Alles zeigen“ in a step of teams: the zoom of `fit` for `box` (the notes and the headings of the areas, so the
 *  notes stay readable), the view placed at the top of the areas' band `areas`: its top edge with the headings a
 *  margin under the surface's top, no empty band above it; across, the band in the middle where it fits, else its
 *  left edge a margin from the surface's left, so the first heading is never cut. The band may run off the bottom. */
export function fitTop(box: Box | null, areas: Box, surface: Size, margin = MARGIN): View {
  const { zoom } = fit(box ?? areas, surface, margin);
  const across = areas.w * zoom;
  return {
    zoom,
    x: across <= surface.w - 2 * margin ? (surface.w - across) / 2 - areas.x * zoom : margin - areas.x * zoom,
    y: margin - areas.y * zoom,
  };
}

/** The view moved by the least distance that shows the box whole, with room around it; a view that shows it
 *  already stays. A box larger than the surface shows its top left corner. */
export function reveal(view: View, surface: Size, box: Box, margin = MARGIN): View {
  const along = (start: number, length: number, room: number) => {
    const end = start + length;
    if (start < margin) return margin - start;
    if (end > room - margin) return Math.max(margin - start, room - margin - end);
    return 0;
  };
  const at = toSurface(view, box);
  const dx = along(at.x, box.w * view.zoom, surface.w);
  const dy = along(at.y, box.h * view.zoom, surface.h);
  return dx === 0 && dy === 0 ? view : panBy(view, dx, dy);
}
