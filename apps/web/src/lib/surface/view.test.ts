import { expect, test } from "vitest";
import {
  around,
  clampZoom,
  fit,
  fitTop,
  MARGIN,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  pinch,
  reveal,
  toSurface,
  toWorld,
  visible,
  wheelZoom,
  zoomAt,
  type View,
} from "./view";

const SURFACE = { w: 1000, h: 600 };
const near = (value: number, wanted: number) => expect(value).toBeCloseTo(wanted, 6);

test("a point of the surface and a point of the world are each other's answer", () => {
  const view: View = { x: 120, y: -40, zoom: 0.5 };
  expect(toWorld(view, { x: 120, y: -40 })).toEqual({ x: 0, y: 0 });
  expect(toWorld(view, { x: 220, y: 60 })).toEqual({ x: 200, y: 200 });
  expect(toSurface(view, { x: 200, y: 200 })).toEqual({ x: 220, y: 60 });
  const there = toSurface(view, toWorld(view, { x: 333, y: 77 }));
  near(there.x, 333);
  near(there.y, 77);
});

test("panning moves the world by the distance of the pointer and keeps the zoom", () => {
  expect(panBy({ x: 10, y: 20, zoom: 0.7 }, 30, -5)).toEqual({ x: 40, y: 15, zoom: 0.7 });
});

test("zooming keeps the point of the world under the pointer where it is", () => {
  const view: View = { x: 50, y: 80, zoom: 1 };
  const pointer = { x: 400, y: 300 };
  const under = toWorld(view, pointer);
  for (const zoom of [0.25, 0.8, 1.6, 2]) {
    const next = zoomAt(view, pointer, zoom);
    expect(next.zoom).toBe(zoom);
    const still = toWorld(next, pointer);
    near(still.x, under.x);
    near(still.y, under.y);
  }
});

test("the zoom stays inside its limits, also when the wheel asks for more", () => {
  expect(clampZoom(0.001)).toBe(MIN_ZOOM);
  expect(clampZoom(40)).toBe(MAX_ZOOM);
  const view: View = { x: 0, y: 0, zoom: 1 };
  expect(zoomAt(view, { x: 10, y: 10 }, 99).zoom).toBe(MAX_ZOOM);
  expect(zoomAt(view, { x: 10, y: 10 }, 0).zoom).toBe(MIN_ZOOM);
  // at the limit the point under the pointer still does not move
  const out = zoomAt(view, { x: 500, y: 300 }, 0);
  near(toWorld(out, { x: 500, y: 300 }).x, 500);
});

test("the wheel zooms by the same share each notch: in and out by the same turn ends where it began", () => {
  expect(wheelZoom(1, -100)).toBeGreaterThan(1);
  expect(wheelZoom(1, 100)).toBeLessThan(1);
  near(wheelZoom(wheelZoom(0.6, -240), 240), 0.6);
});

test("two fingers: what lay between them stays between them, and the world grows as their distance does", () => {
  const view: View = { x: 100, y: 50, zoom: 1 };
  const from: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: 200, y: 200 },
    { x: 400, y: 200 },
  ];
  // the fingers move apart to twice the distance, and their middle moves 50 to the right
  const to: typeof from = [
    { x: 150, y: 200 },
    { x: 550, y: 200 },
  ];
  const between = toWorld(view, { x: 300, y: 200 });
  const next = pinch(view, from, to);
  expect(next.zoom).toBe(2);
  const still = toWorld(next, { x: 350, y: 200 });
  near(still.x, between.x);
  near(still.y, between.y);
  // fingers that only move pan
  const moved = pinch(view, from, [
    { x: 230, y: 240 },
    { x: 430, y: 240 },
  ]);
  expect(moved).toEqual({ x: 130, y: 90, zoom: 1 });
  // two fingers on one spot say nothing about the zoom
  expect(pinch(view, [from[0], from[0]], to).zoom).toBe(1);
});

test("the part of the world in view follows from the view and the surface's size", () => {
  expect(visible({ x: 0, y: 0, zoom: 1 }, SURFACE)).toEqual({ x: 0, y: 0, w: 1000, h: 600 });
  expect(visible({ x: 100, y: 50, zoom: 0.5 }, SURFACE)).toEqual({ x: -200, y: -100, w: 2000, h: 1200 });
});

test("the box around boxes; none for none", () => {
  expect(around([])).toBeNull();
  expect(
    around([
      { x: 10, y: 20, w: 240, h: 104 },
      { x: -300, y: 400, w: 240, h: 200 },
    ]),
  ).toEqual({ x: -300, y: 20, w: 550, h: 580 });
});

test("„Alles zeigen“ puts the box in the middle, whole, with room around it", () => {
  const box = { x: -2000, y: 1000, w: 4000, h: 1200 };
  const view = fit(box, SURFACE);
  // the width binds: 952 units of room for 4000
  near(view.zoom, (SURFACE.w - 2 * MARGIN) / 4000);
  const corner = toSurface(view, box);
  near(corner.x, MARGIN);
  near(corner.y + (box.h * view.zoom) / 2, SURFACE.h / 2);
  // the height binds for a tall box
  const tall = fit({ x: 0, y: 0, w: 100, h: 5520 }, SURFACE);
  near(tall.zoom, 0.1);
  near(toSurface(tall, { x: 50, y: 2760 }).x, SURFACE.w / 2);
});

test("„Alles zeigen“ never draws larger than life, and never smaller than the least zoom", () => {
  const small = fit({ x: 40, y: 40, w: 240, h: 104 }, SURFACE);
  expect(small.zoom).toBe(1);
  expect(toSurface(small, { x: 160, y: 92 })).toEqual({ x: 500, y: 300 });
  const huge = fit({ x: -50_000, y: -50_000, w: 100_000, h: 100_000 }, SURFACE);
  expect(huge.zoom).toBe(MIN_ZOOM);
  // what does not fit is still centred
  expect(toSurface(huge, { x: 0, y: 0 })).toEqual({ x: 500, y: 300 });
  // a surface with no room yet (not laid out) gives a view all the same
  expect(Number.isFinite(fit({ x: 0, y: 0, w: 240, h: 104 }, { w: 0, h: 0 }).zoom)).toBe(true);
});

test("an empty wall shows the world's origin in the middle, at life size", () => {
  expect(fit(null, SURFACE)).toEqual({ x: 500, y: 300, zoom: 1 });
});

test("revealing moves the view by the least distance that shows the box whole", () => {
  const view: View = { x: 0, y: 0, zoom: 1 };
  // in view already: nothing moves, and the same view comes back
  expect(reveal(view, SURFACE, { x: 100, y: 100, w: 240, h: 104 })).toBe(view);
  // past the right edge: back by the overhang and the margin
  expect(reveal(view, SURFACE, { x: 900, y: 100, w: 240, h: 104 })).toEqual({ x: -164, y: 0, zoom: 1 });
  // above the top edge
  expect(reveal(view, SURFACE, { x: 100, y: -200, w: 240, h: 104 })).toEqual({ x: 0, y: 224, zoom: 1 });
  // zoomed: the distance is the surface's
  const far = reveal({ x: 0, y: 0, zoom: 0.5 }, SURFACE, { x: 2400, y: 0, w: 240, h: 104 });
  near(toSurface(far, { x: 2640, y: 0 }).x, SURFACE.w - MARGIN);
  // larger than the surface: its top left corner shows
  const big = reveal(view, SURFACE, { x: 500, y: 300, w: 4000, h: 3000 });
  expect(toSurface(big, { x: 500, y: 300 })).toEqual({ x: MARGIN, y: MARGIN });
});

test("„Alles zeigen“ in a step of teams keeps the zoom of the notes and puts the areas' band at the top", () => {
  // one area, narrower than the surface: the zoom of the notes and the head, the band in the middle across, its top a
  // margin under the surface's top, whatever lies below it
  const area = { x: 0, y: 1200, w: 832, h: 1280 };
  const notes = { x: 0, y: 1200, w: 832, h: 160 };
  const one = fitTop(notes, area, SURFACE);
  expect(one.zoom).toBe(fit(notes, SURFACE).zoom);
  const at = toSurface(one, area);
  expect(at.y).toBeCloseTo(MARGIN);
  expect(at.x).toBeCloseTo((SURFACE.w - area.w * one.zoom) / 2);
  // a band wider than the surface at that zoom: its left edge a margin from the surface's left, the first heading
  // whole; the rest runs off to the right
  const band = { x: 0, y: 1200, w: 1728, h: 1280 };
  const wide = fitTop({ x: 0, y: 1200, w: 300, h: 100 }, band, SURFACE);
  expect(wide.zoom).toBe(1);
  expect(toSurface(wide, band)).toEqual({ x: MARGIN, y: MARGIN });
});
