// The start (core rule 29): the first paint is the whole screen in the product's colour with the white sign, then
// the app. The colour is the tile colour of the product's group: sebaro.product.json names the group, the copy's
// product/tiles.json gives its colour. The start fades in 200 ms under every motion setting. That it shows only on
// the first visit per tab is the copy's sb-start.js.
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const json = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const group: string = json("../sebaro.product.json").tile;
const hex: string = json("../src/sebaro/product/tiles.json").groups[group].tile;
const TILE = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));

type Box = { x: number; y: number; width: number; height: number };

/** The colours of a screenshot at its four corners, and how many pixels in `box` are white. A blank page of the same
 *  browser reads it: the app's own page allows no data: or blob: image. */
async function look(page: Page, png: Buffer, box: Box) {
  const blank = await page.context().newPage();
  const seen = await blank.evaluate(
    async ({ data, box }) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(image.width, image.height).getContext("2d")!;
      canvas.drawImage(image, 0, 0);
      const at = (x: number, y: number) => [...canvas.getImageData(x, y, 1, 1).data.slice(0, 3)];
      const [right, bottom] = [image.width - 1, image.height - 1];
      const area = canvas.getImageData(
        Math.floor(box.x),
        Math.floor(box.y),
        Math.ceil(box.width),
        Math.ceil(box.height),
      );
      let white = 0;
      for (let i = 0; i < area.data.length; i += 4)
        if (area.data.slice(i, i + 3).every((part) => part === 255)) white++;
      return { corners: [at(0, 0), at(right, 0), at(0, bottom), at(right, bottom)], white };
    },
    { data: png.toString("base64"), box },
  );
  await blank.close();
  return seen;
}

// light with motion, dark with „Bewegung immer reduzieren“: the fade is the same
for (const [scheme, setting] of [
  ["light", false],
  ["dark", true],
] as const) {
  {
    test(`the start, then the app: ${scheme}${setting ? ", motion reduced" : ""}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: scheme,
      });
      const page = await context.newPage();
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`console: ${m.text()}`);
      });
      page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
      if (setting) await page.addInitScript(() => localStorage.setItem("sb-motion", "reduce"));
      const shot = (name: string) => path.join(test.info().project.outputDir, "screens", `start-${scheme}-${name}.png`);

      // the app's code held back: the page shows what it paints before the app runs
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(/\/assets\/index-.*\.js$/, async (route) => {
        await held;
        await route.continue();
      });
      await page.goto("/", { waitUntil: "commit" });
      const sign = page.locator("body > .sb-start > .sb-start__tile > svg");
      await expect(sign).toBeVisible();
      const box = (await sign.boundingBox())!;
      const first = await look(page, await page.screenshot({ path: shot("1-first") }), box);
      expect(first.corners, "the whole screen in the tile colour").toEqual([TILE, TILE, TILE, TILE]);
      expect(first.white, "the white sign in the middle").toBeGreaterThan(0);

      // the app runs: once it has painted and the page has loaded, the start fades in 200 ms and is gone
      release();
      await expect(page.locator("h1:visible")).toHaveText("Alle schreiben Zettel, eine KI ordnet sie.");
      await expect(page.locator("body > .sb-start")).toBeHidden();
      await expect(page.locator("html")).not.toHaveClass(/sb-starting/);
      const fades = await page
        .locator("body > .sb-start")
        .evaluate((start) => start.getAnimations().map((a) => a.effect?.getTiming().duration));
      expect(fades, "the start faded once, in 200 ms").toEqual([200]);
      const after = await look(page, await page.screenshot({ path: shot("2-app") }), box);
      expect(after.corners, "the app's own ground").not.toContainEqual(TILE);
      expect(problems, "console and page errors").toEqual([]);
      await context.close();
    });
  }
}
