// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

declare module "cloudflare:test" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Env {}
}

// A source file as text (Vite's `?raw`): for the test that reads what the wall's code names.
declare module "*?raw" {
  const text: string;
  export default text;
}
