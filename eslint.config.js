// eslint.config.js: ESLint for the worker and the shared rules. apps/web keeps the config of the sebaro starter and
// is linted from its own folder. The same rules as there, without React; and in the worker's source nothing that
// keeps a Durable Object from hibernating. Here and there: of zod only `zod/mini`.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const AWAKE =
  "A Durable Object with a pending timer never hibernates and bills for every second: store a deadline, set the alarm, and let the browser count.";

// Every import of zod but "zod/mini": the classic build ("zod", "zod/v4", "zod/v3") and whatever else the package
// offers. apps/web/tests/worker.spec.ts reads the built files for what this rule cannot see.
const MINI =
  'zod\'s classic build makes every fresh start of the Worker some 10 ms longer (docs/messung-4a.md, section 8): write schemas with `import * as z from "zod/mini"`.';

export default defineConfig(
  globalIgnores(["apps/web", "proto", "**/node_modules", "**/dist", "**/.wrangler", "**/worker-configuration.d.ts"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
      "no-restricted-imports": ["error", { patterns: [{ regex: "^zod(?!/mini$)(/.*)?$", message: MINI }] }],
    },
  },
  {
    files: ["apps/worker/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "setTimeout", message: AWAKE },
        { name: "setInterval", message: AWAKE },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='accept']",
          message:
            "ws.accept() pins the Durable Object in memory for as long as the socket lives: use this.ctx.acceptWebSocket(ws), the Hibernation API.",
        },
      ],
    },
  },
);
