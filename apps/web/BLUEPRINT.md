# Web app blueprint

How a sebaro web app is built: an application in the browser without a window, shipped as static files. How it
looks is the Blueprint (`design/KERN.md`, `design/views.md`, `design/platforms/webapp.md`). The starter is this plan
as code.

## Stack

React with TypeScript (strict), built by Vite, installed with pnpm. zustand holds state, react-router the routes,
i18next the words; Vitest and Playwright test. Versions stand in `package.json` and the lockfile alone.

Why: one language for logic and interface, a static build any host serves, and the copy's React parts fit as they
are.

A further dependency needs the owner's OK. The build refuses a licence that is not on the list in `vite.config.ts`
and a package without a licence text (standard texts: `licences/`).

## When it does not fit

Ask the owner before you build, and never bend the base, when the product needs

- a server of its own: accounts, sync between devices, shared data, a secret;
- pages a search engine must read, or more content than tool (`website-astro`);
- a window with sidebar and inspector, files on disk, an installed program (`desktop-tauri`);
- what a browser cannot do on a phone, or a store listing (`android-compose`);
- another framework, a UI or CSS library, a second design system.

## Structure

```
src/main.tsx      routes, error boundary, start
src/pages/        one file per route
src/components/   Shell (frame), View, More (menu), Commands (palette)
src/lib/          the product's rules: plain functions, no React
src/i18n.ts       the languages
src/sebaro/       the sebaro copy, never edited
sebaro-product/   sign, favicons, manifest, written by the copy's kit
```

- **Rules live in `src/lib/`:** what an entry may be, how a draft is checked. Stores hold state and ask there.
- **A view is a `<View>`** with name, view type and title: without `back` a top-level place, with `back` a
  sub-view. The `handle` of its route names its place; `Shell` builds the frame from it. From 840 px the list stays
  beside its entry; a form stands alone, without navigation.
- **Parts come from the copy:** `src/sebaro/react/`, else the markup of the copy's README. A missing part is built
  in `src/components/` from tokens.
- **Every route has an error boundary.** A failure is a sentence: what is wrong, what to do.
- **An overlay follows state:** a dialog, a menu or the toast is open exactly while React's state says so.
- **One file names the product:** `sebaro.product.json` gives id, name, sign and colour. Title, manifest, start,
  „Über“ and the storage key follow it.
- **The fixed places are built:** „Mehr“, „Einstellungen“ with „Über“ and the licences, the footer, the command
  palette. A new command is one more option there.

## State and saving

What must survive a reload is a zustand store with `persist`: one key in `localStorage`, with a `version`. A change
of the stored shape raises it and adds `migrate`. Saving is local and done at once: no spinner, no toast. A form
holds its draft as text, checks it in `src/lib/` when it is sent, and asks before unsaved changes are lost.

Files, more than a few megabytes or anything shared do not fit there: ask, as above.

## Text and language

Every word comes from the string tables, German and English from the first version. A further language is its file
in `src/i18n/` and its line in `src/i18n.ts`, with its name and Intl locale. Numbers and dates go through
`src/lib/format.ts`. A sentence with a value is one string with a placeholder, never built in code.

## Tests

- Vitest, beside the file: the rules, the stores, the main flows in jsdom.
- Playwright against the build: every view and overlay state in light at 390 px and in dark at 1440 px, one form in
  English at 200 % text; then the main flows by keyboard, unsaved changes, the start, print.

No matrix beyond that. A new rule gets a unit test, a new view its line in `tests/screens.spec.ts`.

## Quality

ESLint, Prettier and `tsc`; their configs say what they ask. The copy and `sebaro-product/` are never linted,
formatted or edited.

## Security and privacy

- The Content-Security-Policy in `index.html` allows own files alone. Widen it only for what the product can name.
- No request to a third-party server. An exception is decided with the owner and stands in the privacy text; so
  does the host.
- Nothing secret in the code or the build: all of it is public.
- „Impressum“ and „Datenschutz“ are placeholders. `pnpm release:check`, run by every deploy recipe, fails on the
  sample imprint.

## Size and speed

`pnpm build` fails above a budget of `scripts/budget.ts`. A view the start does not need loads with `lazy()`. Above
a budget, cut first (a pack of the copy, a dependency); ask the owner before you raise a number.

## Build, release, updates

- `ci` runs every check on each push and pull request, and an audit of what ships.
- `dist/` is static; the host is the product's choice. It serves the app at the root of a domain and answers every
  path without a file with `index.html`. Recipes: `DEPLOY-*.md`. A release is a merge to `main` with a green `ci`.
- Dependabot keeps packages and actions current; actions are pinned by commit.
- The sebaro copy is updated with `node src/sebaro/checks/update-copy.mjs`, as a commit of its own; `ci` asks
  weekly for a newer release. Releases are private: the repository secret `SEBARO_FOUNDRY_TOKEN`, on a machine
  `gh auth login`. `--packs` drops packs the product does not use.

## Before you say done

`pnpm checks` runs what `ci` runs. Then look at every changed view in light and dark, narrow and wide, and write
into `CHECKS.md` what you could not check.
