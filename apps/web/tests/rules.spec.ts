// Rules of the app's own sources that no other check sees: lengths in src/app.css come from tokens, every class is
// sebaro's or the app's own, a view that cannot be loaded says so, and paper shows only the content.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { enter, lookAt, QUESTION } from "./app";
import { collectCut, sidewaysScroll } from "./sebaro-checks";

const ROUTES = [
  "/",
  "/waende",
  "/neu",
  "/w/keine-wand",
  "/einstellungen",
  "/lizenzen",
  "/impressum",
  "/barrierefreiheit",
  "/gibt-es-nicht",
];

const LENGTH = /(?<![\w-])\d*\.?\d+(px|rem|em|ch|vw|vh|vi|vb|vmin|vmax|cqi|cqw)\b/;

function untokenedLengths(file: string): string[] {
  const found: string[] = [];
  let inComment = false,
    said = "";
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, n) => {
      if (!line.trim()) {
        said = "";
        return;
      }
      let code = "";
      for (let i = 0; i < line.length; i++) {
        if (!inComment && line.startsWith("/*", i)) {
          inComment = true;
          i++;
          continue;
        }
        if (inComment && line.startsWith("*/", i)) {
          inComment = false;
          i++;
          continue;
        }
        if (inComment) said += line[i];
        else code += line[i];
      }
      if (!LENGTH.test(code)) return;
      const where = `${file.split("/").slice(-2).join("/")}:${n + 1}: ${code.trim()}`;
      if (/@(media|container)/.test(code) && /\d(px|ch|vw|vh)\b/.test(code))
        found.push(`${where} (a query steps in rem or em)`);
      else if (!/no sebaro token/.test(said)) found.push(where);
    });
  return found;
}

test("a length in src/app.css is a token or says „no sebaro token“ with its reason; queries step in rem or em", () => {
  expect(untokenedLengths(new URL("../src/app.css", import.meta.url).pathname)).toEqual([]);
});

test("only sebaro's classes (that exist in the copy) and the app's own app-* classes", async ({ page }) => {
  const root = new URL("../src/sebaro/", import.meta.url);
  const known = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(css|js|svg)$/.test(f))
    .map((f) => readFileSync(new URL(f, root), "utf8"))
    .join("\n");
  // a class the copy's markup of a part writes although no rule of the stylesheet styles it
  const HOOKS = ["sb-danger-action--outlined"];
  const bad = new Set<string>();
  // a wall with people on it, here and away, a group and notes is a view too, as its surface and as its list; and
  // with it the start and „Meine Wände“ are not empty
  await page.goto("/");
  const { wallId } = await enter(page, {
    hidden: false,
    others: ["Ben"],
    notes: ["Weniger Termine"],
    groups: [{ title: "Werkzeuge", notes: ["Der Build dauert zu lange"] }],
  });
  const look = async (route: string, as = route) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const classes = await page.evaluate(() => [
      ...new Set([...document.querySelectorAll("[class]")].flatMap((e) => [...e.classList])),
    ]);
    for (const c of classes) {
      if (c.startsWith("app-") || HOOKS.includes(c)) continue;
      if (!c.startsWith("sb-") || !new RegExp(`${c}(?![\\w-])`).test(known)) bad.add(`${as} ${c}`);
    }
  };
  for (const route of [`/w/${wallId}`, ...ROUTES]) await look(route);
  await lookAt(page, "list");
  await look(`/w/${wallId}`, "the wall as its list");
  await expect(page.locator(".app-list__row")).toHaveCount(2);
  expect([...bad]).toEqual([]);
});

test("paper shows only the content, whole", async ({ page }) => {
  await page.goto("/");
  await enter(page, { hidden: false, others: ["Ben"], notes: ["Weniger Termine"] });
  await page.emulateMedia({ media: "print" });
  // a wall: its head with its tools, the wall's bar, the surface's tools, the action zone and the footer's links
  // stay off the paper; its question is the document's title, and its notes are on it
  await expect(page.getByRole("main")).toContainText("Weniger Termine");
  for (const part of [
    ".app-wall-head",
    ".app-wall-bar",
    ".app-surface__tools",
    ".sb-bottom-block",
    ".sb-site-footer__links",
  ]) {
    await expect(page.locator(part)).not.toHaveCount(0);
    for (const element of await page.locator(part).all()) await expect(element).toBeHidden();
  }
  await expect(page).toHaveTitle(new RegExp(QUESTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByRole("main")).toContainText("Anna (du)");
  await expect(page.getByRole("main")).toContainText("Ben");
  expect(await page.getByRole("main").evaluate((el) => getComputedStyle(el).overflowY)).toBe("visible");
  // a page with the site's head: the head, the action zone and the footer's links stay off it, the list is the
  // content
  await page.goto("/waende");
  await expect(page.getByRole("main")).toContainText(QUESTION);
  for (const part of [".sb-site-header", ".sb-bottom-block", ".sb-site-footer__links"])
    await expect(page.locator(part).first()).toBeHidden();
});

// the chunk of a view that main.tsx loads with lazy(): held back, the view fails as on a broken connection
const LAZY_VIEW = /\/assets\/Settings-.*\.js$/;

test("a view that cannot be loaded says so; the shell stays and „Noch mal versuchen“ loads it", async ({ page }) => {
  await page.route(LAZY_VIEW, (route) => route.abort());
  await page.goto("/einstellungen");
  const heading = page.locator("[data-sb-view] h1");
  await expect(heading).toHaveText("Fehler");
  await expect(page.getByRole("main")).toContainText("Diese Ansicht ließ sich nicht anzeigen.");
  await expect(page.locator(".sb-site-nav a")).toHaveText(["Meine Wände", "Einstellungen"]);
  await page.unroute(LAZY_VIEW);
  await page.getByRole("button", { name: "Noch mal versuchen" }).click();
  await expect(heading).toHaveText("Einstellungen");
});

// the error view is no case of screens.spec.ts (a failed load writes to the console, on purpose): its own look
for (const [scheme, width] of [
  ["light", 390],
  ["dark", 1440],
] as const) {
  test(`the error view ${scheme} ${width}px: axe, no sideways scroll, no cut text`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: scheme });
    const page = await context.newPage();
    await page.route(LAZY_VIEW, (route) => route.abort());
    await page.goto("/einstellungen");
    await expect(page.locator("h1:visible")).toHaveText(["Fehler"]);
    await page.evaluate(() => document.fonts.ready.then(() => true));
    expect(await page.evaluate(sidewaysScroll)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(collectCut)).toEqual([]);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    const shot = `fehler-${scheme}-${width}.png`;
    await page.screenshot({ path: path.join(test.info().project.outputDir, "screens", shot) });
    await context.close();
  });
}
