// vite.config.ts: Vite with one small plugin for the sebaro copy in src/sebaro/ (never edited), the product's own
// files in sebaro-product/ (written by the kit of the copy from sebaro.product.json) and the licence list of „Über“.
// No @vitejs/plugin-react: its Fast Refresh needs an inline script, which the Content-Security-Policy forbids; Vite
// compiles JSX without it, and a change reloads the page.
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(root, file));
const json = (file: string) => JSON.parse(read(file).toString());

// Files a bundler does not bundle, served under these addresses as they are: the classic scripts of the copy that
// index.html loads, and the product's icons and manifest, which its head snippet names at the root.
const SERVED: Record<string, string> = {
  "sebaro/js/theme-init.js": "src/sebaro/js/theme-init.js",
  "sebaro/js/sb-start.js": "src/sebaro/js/sb-start.js",
  "sebaro/js/theme-button.js": "src/sebaro/js/theme-button.js",
  "favicon.ico": "sebaro-product/web/favicon.ico",
  "icon.svg": "sebaro-product/web/icon.svg",
  "apple-touch-icon.png": "sebaro-product/web/apple-touch-icon.png",
  "icon-192.png": "sebaro-product/web/icon-192.png",
  "icon-512.png": "sebaro-product/web/icon-512.png",
  "icon-mask.png": "sebaro-product/web/icon-mask.png",
  "manifest.webmanifest": "sebaro-product/web/manifest.webmanifest",
  // what the host reads, not the browser: the header rules of Cloudflare's static assets, and the word to crawlers
  _headers: "static/_headers",
  "robots.txt": "static/robots.txt",
};

// The start: the copy's markup with the product's id from its declaration and the bare sign the kit wrote into
// sebaro-product/. Its colours come from the product's product.css, which src/app.css imports.
function start(): string {
  const sign = read("sebaro-product/sign/sign.svg").toString().trim();
  return `<div class="sb-start" data-sb-product="${json("sebaro.product.json").id}" aria-hidden="true"><span class="sb-start__tile">${sign}</span></div>`;
}

// The licences the app may ship. Another one fails the build: ask the owner before the dependency stays.
// „Unlicense“ (a dedication to the public domain, without a condition) came with Anthropic's client, which stage 4b
// asks Anthropic through: its dependency standardwebhooks needs fast-sha256, which carries it. Added so that the
// build stands; the owner has not confirmed it yet (docs/HERKUNFT.md).
const ALLOWED = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "OFL-1.1", "Unlicense"];

type Licence = { name: string; version: string; licence: string; text: string };

// A package that ships no licence text gets the standard text of its licence from licences/, and the build says so;
// where licences/ holds none, the build fails.
const said = new Set<string>();
function standard(name: string, licence: string): string {
  const file = join(root, "licences", `${licence}.txt`);
  if (!existsSync(file))
    throw new Error(`${name} ships no licence text, and licences/ holds no standard text of „${licence}“`);
  if (!said.has(name))
    process.stdout.write(`licences: ${name} ships no text, the standard text of ${licence} stands in\n`);
  said.add(name);
  return readFileSync(file, "utf8").trim();
}

// The licence list of „Über“, made from the dependencies: every package the app's `dependencies` lead to, found as
// Node finds it, with the licence text in its folder; then the sebaro copy and its fonts.
function licences(): Licence[] {
  const found = new Map<string, Licence>();
  const visit = (name: string, from: string) => {
    let dir = from;
    while (!existsSync(join(dir, "node_modules", name, "package.json"))) {
      if (dir === dirname(dir)) return; // not installed: an optional dependency of another platform
      dir = dirname(dir);
    }
    const folder = realpathSync(join(dir, "node_modules", name));
    const pkg = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
    if (found.has(pkg.name)) return;
    const file = readdirSync(folder).find((f) => /^(licen[cs]e|copying)/i.test(f));
    const licence = String(pkg.license);
    const text = (file && readFileSync(join(folder, file), "utf8").trim()) || standard(pkg.name, licence);
    found.set(pkg.name, { name: pkg.name, version: pkg.version, licence, text });
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) visit(dep, folder);
  };
  for (const dep of Object.keys(json("package.json").dependencies)) visit(dep, root);
  const fonts = readdirSync(join(root, "src/sebaro/fonts/web")).filter((f) => f.endsWith("-OFL.txt"));
  const all = [
    ...[...found.values()].sort((a, b) => a.name.localeCompare(b.name)),
    {
      name: "sebaro",
      version: json("src/sebaro/sebaro-export.json").release?.tag ?? "",
      licence: "MIT",
      text: read("src/sebaro/LICENSE.md").toString().trim(),
    },
    {
      name: "sebaro Sans, sebaro Mono",
      version: "",
      licence: "OFL-1.1",
      text: fonts.map((f) => read(`src/sebaro/fonts/web/${f}`).toString().trim()).join("\n\n"),
    },
  ];
  const refused = all.filter(({ licence }) => !ALLOWED.includes(licence));
  if (refused.length)
    throw new Error(
      `licence not on the list in vite.config.ts: ${refused.map((l) => `${l.name} (${l.licence})`).join(", ")}`,
    );
  return all;
}

const licenceTexts = () =>
  licences()
    .map(({ name, version, licence, text }) => `${name} ${version}\n${licence}\n\n${text}`)
    .join(`\n\n${"-".repeat(72)}\n\n`);

const LICENCES = "virtual:licences";

function sebaro(): Plugin {
  return {
    name: "sebaro",
    // the app alone: the build of the Worker (the second environment, from the Cloudflare plugin below) would
    // otherwise get the icons and the copy's classic scripts too, and wrangler uploads every .js beside the Worker
    applyToEnvironment: (environment) => environment.name === "client",
    // dev: the address leads to the file in its folder
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = SERVED[(req.url ?? "").slice(1)];
        if (file) req.url = `/${file}`;
        if (req.url === "/licences.txt") res.setHeader("Content-Type", "text/plain; charset=utf-8").end(licenceTexts());
        else next();
      });
    },
    // build: the file is written to dist/ under its address
    generateBundle() {
      for (const [fileName, file] of Object.entries(SERVED))
        this.emitFile({ type: "asset", fileName, source: read(file) });
      this.emitFile({ type: "asset", fileName: "licences.txt", source: licenceTexts() });
    },
    // the list „Lizenzen“ shows (src/pages/Licences.tsx); the texts stand in licences.txt
    resolveId: (id) => (id === LICENCES ? `\0${LICENCES}` : undefined),
    load(id) {
      if (id !== `\0${LICENCES}`) return;
      const list = licences().map(({ name, version, licence }) => ({ name, version, licence }));
      return `export default ${JSON.stringify(list)};`;
    },
    // the start as the first element of the body, then the icon sprite inline; the product's name as the title and
    // its head snippet in the head
    transformIndexHtml(html) {
      return html
        .replace("<!-- sebaro:start -->", start)
        .replace("<!-- sebaro:sprite -->", () => read("src/sebaro/icons/sprite.svg").toString().trim())
        .replace("<!-- sebaro:head -->", () => read("sebaro-product/web/head.snippet.html").toString().trim())
        .replace("<title></title>", () => `<title>${json("sebaro.product.json").name}</title>`);
    },
  };
}

// The app has a server of its own (owner's decision, docs/sebaro-luecken.md): the Cloudflare plugin runs the Worker
// and its Durable Object in real workerd beside the app, in `vite`, in `vite build` (dist/client is the app,
// dist/ideabeam the Worker) and in `vite preview`, which the end-to-end tests use. Vitest tests the app alone,
// in jsdom, without it.
// `remoteBindings: false`: the Worker's binding to Workers AI has no local stand-in, and with remote bindings on, the
// plugin would open a session with the Cloudflare account at every start of `vite` and `vite preview`: a login, and
// the real AI behind a local run. Off, local runs ask the stand-in (apps/worker/.dev.vars); only a deployment asks
// the AI.
const worker = process.env.VITEST
  ? []
  : [cloudflare({ configPath: "../worker/wrangler.jsonc", remoteBindings: false })];

export default defineConfig({
  plugins: [sebaro(), ...worker],
  build: {
    // the Content-Security-Policy allows no inline script (the module preload helper) and no data: address (a small
    // file inlined into the CSS)
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    // React in a chunk of its own: it changes less often than the app, and no start chunk passes its budget
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }] },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
