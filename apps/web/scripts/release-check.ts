// release-check.ts: the gate of a release. `pnpm release:check` runs before the build of a public release
// (scripts/production-deploy.sh refuses without it; the preview's scripts/preview-deploy.sh does not run it) and is no
// part of `ci`: it fails while a legal fact of the
// deployment is
// still a placeholder, a value in square brackets in src/content/operator.ts: the operator's address, the day the
// operator released the legal texts, the day the Cloudflare settings were checked, the repository the source link
// leads to. The legal texts beside it (imprint, privacy notice, accessibility statement: every .tsx file in the same folder) are
// read too, for a placeholder written into a text itself instead of into operator.ts: `<PlaceholderField
// value="[…]" />`. An argument names another operator file (the test); its folder is the one whose texts are read.
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = process.argv[2] ?? fileURLToPath(new URL("../src/content/operator.ts", import.meta.url));
// a string literal that is a placeholder: "[…]", as a property's value or a constant's
const left = [...readFileSync(file, "utf8").matchAll(/(\w+)\s*(?::\s*\w+\s*)?[:=]\s*"(\[[^"\]]*\])"/g)].map(
  ([, name, value]) => `${basename(file)}: ${name}: ${value}`,
);
// a placeholder written into a legal text: the value of a PlaceholderField as a literal, "[…]" or {"[…]"}
const folder = dirname(file);
for (const text of readdirSync(folder).filter((name) => name.endsWith(".tsx"))) {
  const source = readFileSync(join(folder, text), "utf8");
  for (const [, value] of source.matchAll(/<PlaceholderField\s+value=\{?"(\[[^"\]]*\])"\}?/g))
    left.push(`${text}: ${value}`);
}
if (left.length) {
  process.stderr.write(
    `No release: ${left.length} placeholder${left.length === 1 ? "" : "s"} left in src/content/.\n` +
      left.map((line) => `  ${line}\n`).join(""),
  );
  process.exitCode = 1;
}
