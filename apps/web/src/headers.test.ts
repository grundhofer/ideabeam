import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { PROVIDERS } from "@ideabeam/arrange";

// the tests run from the app's folder (jsdom gives a module no file address of its own)
const headers = readFileSync("static/_headers", "utf8");
const page = readFileSync("index.html", "utf8");

/** The lines under a path of the header file, as name and value. */
function rules(path: string): Record<string, string> {
  const lines = headers.split("\n");
  const at = lines.indexOf(path);
  if (at === -1) throw new Error(`no rules for ${path}`);
  const found: Record<string, string> = {};
  for (const line of lines.slice(at + 1)) {
    if (!line.startsWith("  ")) break;
    const colon = line.indexOf(":");
    found[line.slice(2, colon)] = line.slice(colon + 1).trim();
  }
  return found;
}

test("the policy the host sends is the page's own, plus the one directive that works only as a header", () => {
  const meta = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(page)?.[1];
  expect(meta).toBeDefined();
  expect(rules("/*")["Content-Security-Policy"]).toBe(`${meta}; frame-ancestors 'none'`);
});

test("the page may call its own origin and the providers of „Eigener Schlüssel“, and nobody else", () => {
  const policy = rules("/*")["Content-Security-Policy"] ?? "";
  const directives = Object.fromEntries(
    policy.split(";").map((directive) => {
      const [name = "", ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
  // exactly the origins the moderation's browser calls with its own key (packages/arrange, providers.ts): a provider
  // that joins the list joins this line, and no other host is ever allowed
  expect(directives["connect-src"]).toEqual(["'self'", ...PROVIDERS.map((provider) => provider.origin)]);
  expect(directives["connect-src"]).toEqual([
    "'self'",
    "https://api.eu.mistral.ai",
    "https://api.openai.com",
    "https://api.anthropic.com",
  ]);
  // an origin and nothing more: no wildcard, no path, no other scheme
  for (const source of (directives["connect-src"] ?? []).slice(1)) expect(source).toMatch(/^https:\/\/[a-z0-9.-]+$/);
  // everything else still comes from the app's own origin alone
  for (const name of ["default-src", "script-src", "style-src", "img-src", "font-src", "base-uri", "form-action"]) {
    expect(directives[name], name).toEqual(["'self'"]);
  }
  expect(directives["object-src"]).toEqual(["'none'"]);
  expect(directives["frame-ancestors"]).toEqual(["'none'"]);
});

test("walls and the workers.dev addresses are kept out of search indexes; the start page is not", () => {
  expect(rules("/w/*")).toEqual({ "X-Robots-Tag": "noindex" });
  expect(rules("https://:worker.:subdomain.workers.dev/*")).toEqual({ "X-Robots-Tag": "noindex" });
  expect(rules("/*")["X-Robots-Tag"]).toBeUndefined();
});
