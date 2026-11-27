// The Worker behind the built app. `vite preview` runs it in real workerd beside the app's files (vite.config.ts),
// so these tests meet what a deploy ships: the files of the app, and under /api/ the Worker with its Durable Object.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("the Worker answers under /api/, as data kept out of search indexes", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true });
  expect(response.headers()["x-robots-tag"]).toBe("noindex");
});

test("an unknown path under /api/ is the Worker's 404, not the app", async ({ request }) => {
  const response = await request.get("/api/nothing-here");
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: "NOT_FOUND" });
});

test("a wall's address has no file and is answered with the app", async ({ request }) => {
  const response = await request.get(`/w/${"0123456789abcdef".repeat(4)}`, { headers: { accept: "text/html" } });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/html");
});

test("the app reaches the Worker: its Content-Security-Policy allows its own origin", async ({ page }) => {
  const refused: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") refused.push(message.text());
  });
  await page.goto("/");
  const health = await page.evaluate(async () => (await fetch("/api/health")).json());
  expect(health).toMatchObject({ ok: true });
  expect(refused).toEqual([]);
});

const A_WALL = `/w/${"0123456789abcdef".repeat(4)}`;

test("the host's header rules hold: a wall is kept out of search indexes, the start page is not", async ({
  request,
}) => {
  const wall = await request.get(A_WALL, { headers: { accept: "text/html" } });
  expect(wall.headers()["x-robots-tag"]).toBe("noindex");
  const start = await request.get("/", { headers: { accept: "text/html" } });
  expect(start.headers()["x-robots-tag"]).toBeUndefined();
  // every page: the policy as a header, with the directive a <meta> cannot carry
  for (const answer of [start, wall]) {
    expect(answer.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(answer.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(answer.headers()["referrer-policy"]).toBe("no-referrer");
    expect(answer.headers()["x-content-type-options"]).toBe("nosniff");
  }
});

test("the header rules themselves are not a page, and crawlers are told to stay off the API", async ({ request }) => {
  const rules = await request.get("/_headers", { headers: { accept: "text/html" } });
  expect(await rules.text()).not.toContain("X-Robots-Tag");
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const lines = (await robots.text()).split("\n").filter((line) => line !== "" && !line.startsWith("#"));
  expect(lines).toEqual(["User-agent: *", "Disallow: /api/"]);
});

test("a wall's page asks crawlers not to list it, and the tag goes with the wall", async ({ page }) => {
  await page.goto(A_WALL);
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await page.getByRole("main").getByRole("link", { name: "Zurück" }).click();
  await expect(page.locator("[data-sb-view] h1")).toHaveText("Alle schreiben Zettel, eine KI ordnet sie.");
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
});

test("the Worker and the app's files hold zod's mini build and nothing of its classic one", () => {
  // The classic build makes every fresh start of the Worker some 10 ms longer and the app's first load heavier
  // (docs/messung-4a.md, section 8). ESLint refuses its import; this reads what was built. zod registers every kind
  // of schema under a name, a string no bundler shortens or drops: every schema of the classic build is a "ZodType",
  // every one of zod/mini a "ZodMiniType", and the name they share, "$ZodType", begins with another sign.
  const dist = new URL("../dist/", import.meta.url).pathname;
  for (const folder of ["ideabeam", "client/assets"]) {
    const scripts = readdirSync(path.join(dist, folder)).filter((file) => file.endsWith(".js"));
    const naming = (kind: RegExp) =>
      scripts.filter((file) => kind.test(readFileSync(path.join(dist, folder, file), "utf8")));
    expect(naming(/["'`]ZodMiniType["'`]/), folder).not.toEqual([]);
    expect(naming(/["'`]ZodType["'`]/), folder).toEqual([]);
  }
});

test("the words of the methods load with `/neu` and the wall, never at the app's start, and the Worker has them", () => {
  // They stand in the shared package (packages/shared, methods/texts.ts): the Worker writes the export, which names
  // the wall's method with its short description, and the app shows the same words on `/neu` and on the wall. The
  // start loads none of them: PLAN-METHODEN.md, section 6 („nachgeladen, damit der Start nicht schwerer wird“).
  const dist = new URL("../dist/", import.meta.url).pathname;
  const words = [
    "Alle schreiben Ideen verdeckt, die Ideen werden gebündelt",
    "Everyone writes notes that everyone sees",
  ];
  const holding = (folder: string, files: string[]) =>
    files.filter((file) => words.some((part) => readFileSync(path.join(dist, folder, file), "utf8").includes(part)));
  const worker = readdirSync(path.join(dist, "ideabeam")).filter((file) => file.endsWith(".js"));
  expect(holding("ideabeam", worker)).not.toEqual([]);

  const assets = path.join(dist, "client/assets");
  const scripts = readdirSync(assets).filter((file) => file.endsWith(".js"));
  expect(holding("client/assets", scripts)).not.toEqual([]);
  // the files the start loads: the entry and every file it names in a plain `import … from` or `export … from`, as
  // tests/arrange.spec.ts reads them. A file asked for with `import(…)` (a view) is fetched when that view opens
  const page = readFileSync(path.join(dist, "client/index.html"), "utf8");
  const start = [...page.matchAll(/(?:src|href)="\/assets\/([\w.-]+\.js)"/g)].map(([, name]) => name ?? "");
  expect(start.length).toBeGreaterThan(1);
  const loaded = new Set<string>();
  for (let file = start.pop(); file !== undefined; file = start.pop()) {
    if (loaded.has(file)) continue;
    loaded.add(file);
    const code = readFileSync(path.join(assets, file), "utf8");
    for (const [, name] of code.matchAll(/\b(?:import|export)\b[^"'`()]*?["'`]\.\/([\w.-]+\.js)["'`]/g)) {
      if (name !== undefined) start.push(name);
    }
  }
  expect(holding("client/assets", [...loaded])).toEqual([]);
});
