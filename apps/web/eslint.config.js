// eslint.config.js: ESLint with typescript-eslint and the rules of React's hooks. Beside the recommended rules: no
// promise left unhandled, no `any`, no console, no word written into JSX, and of zod only `zod/mini`.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const WORD = "Every word comes from the i18next resources (src/i18n/): use t() or <Trans>.";
// Every import of zod but "zod/mini", as in the root's eslint.config.js: the classic build is 17 KB more of the
// first load, gzipped. tests/worker.spec.ts reads the built files for what this rule cannot see.
const MINI =
  'zod\'s classic build is heavy and slow to load (docs/messung-4a.md, section 8): write schemas with `import * as z from "zod/mini"`.';

export default defineConfig(
  // the sebaro copy and the product's files are never edited, so never linted
  globalIgnores(["dist", ".wrangler", "src/sebaro", "sebaro-product", "test-results", "playwright-report"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
      "no-restricted-imports": ["error", { patterns: [{ regex: "^zod(?!/mini$)(/.*)?$", message: MINI }] }],
    },
  },
  {
    files: ["src/**/*.tsx"],
    // src/content/ holds the legal texts: long-form content with headings, lists and links, one file per page and
    // language, written as markup. Every other word of the app comes from the string tables
    ignores: ["src/**/*.test.tsx", "src/content/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        // text between tags, and a string in braces between tags; signs and numbers alone are values
        { selector: "JSXText[value=/\\p{L}/u]", message: WORD },
        {
          selector: ":matches(JSXElement, JSXFragment) > JSXExpressionContainer > Literal[value=/\\p{L}/u]",
          message: WORD,
        },
        // the attributes a person reads or hears
        {
          selector: "JSXAttribute[name.name=/^(aria-label|aria-description|alt|placeholder|title)$/] > Literal",
          message: WORD,
        },
      ],
    },
  },
);
