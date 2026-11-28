# IdeaBeam

A brainstorming wall without accounts: someone makes a wall, shares its link, everyone joins with a display name
and writes notes, and an AI groups the notes by meaning. A sibling of RetroBeam and FokusBeam.

The plan, the owner's decisions and the stages with their acceptance criteria are in [`PLAN.md`](PLAN.md) (German).
Read its section 7 before you change what the product does. State: stages 1 to 3 (make a wall, join; the
surface with notes and groups, the list view; hidden writing, revealing, the clock), stage 4a (grouping by
Cloudflare's AI: „Ordnen“, its preview, „Anwenden“, „Rückgängig“) and stage 4b (the moderation's own key for
Mistral, OpenAI or Anthropic: „Eigener KI-Schlüssel“) are merged into `main` by the owner's word (2026-11-24); no
provider's model is measured yet, so nobody is offered 4b (see „The moderation's own key“ below). Grouping in the browser (4c)
follows. The guided methods have their own plan, [`PLAN-METHODEN.md`](PLAN-METHODEN.md): stage M1 (methods as data, a
wall's agenda and its steps, „Weiter“ and „Zurück“, the choice of the method on `/neu`), stage M2 (hidden voting:
ballots, counting, the result as a ranking), stage M3 (estimates in two rounds: median, middle half, range, reasons
without names) and stage M4 (pairs and small groups: teams formed at random, swaps by the moderation, team visibility,
steps that move on by themselves through the one alarm, „1-2-4-Alle“) are merged into `main` and deployed (`cd154d5`,
2026-11-27, with the evidence rating removed); stage M5 (revealing by turn, the ranking panel, actions with „Wer“ and
„Bis wann“, rounds that hide again, and the methods „Rückblick nach Ziel und Daten“, „Scheitern vorwegdenken“,
„Stille Ideenrunde mit Rangfolge“, „Was? Na und? Was nun?“) is merged (`1a2b46a`); stage M6 (the
score by criteria with its table, roles of teams, the consent round, decisions and measurable results recorded by the
moderation, fixed fields, and the methods „Kriterienbewertung“, „Nutzen und Aufwand“, „Gegenposition prüfen“,
„Entscheidungsprotokoll mit Zustimmungsrunde“, „Annahmen prüfen“, „Ziele mit messbaren Ergebnissen“) is merged
(`3a14f30`); stage M7 (an agenda of up to eight methods on one wall, each with its own prompt, the earlier
methods' groups and notes offered to a later vote, „Mehr“ → „Ablauf“ for the methods not reached, `admin.agenda.set`,
protocol 12, an export section per method, and „Geführte Methoden“ on the start) is merged (`b3c3894`); M5 to M7 are deployed
since 2026-11-28. Each stage's state is under its heading there.

## Commands

```sh
pnpm install
pnpm dev        # the app, the Worker and its Durable Object in real workerd, one process: http://localhost:5173
pnpm checks     # everything the CI runs except the audit: worker and shared rules, then the web app's own checks
pnpm test       # the tests of the worker (in workerd), of the shared rules and of arranging
pnpm --filter @ideabeam/web <script>      # one script of the web app: checks, test, test:e2e, sebaro:build …
pnpm --filter @ideabeam/worker types      # after every change of apps/worker/wrangler.jsonc
node scripts/measure-cloudflare.mjs <address>   # deployed Worker: EU, pings billed, idle socket. Spends its allowance
                                                # (about 25 rows, 2,000 frames) and 1 of the day's walls
node scripts/load-test.mjs <address>            # walls living a whole session, then deleted. Spends the Worker's
                                                # allowance (about 70 rows a wall) and a fifth of the day's walls
node scripts/cloudflare-metrics.mjs <account id> <from> <to> [--worker <name>]  # what Cloudflare counted; spends nothing
node scripts/measure-arrange.mjs <address>      # „Ordnen“ on a test board, held against the corpus. Spends 1 of the
                                                # day's walls, about 270 rows and the run's neurons (130 to 180)
MISTRAL_API_KEY=… node scripts/measure-key.mjs mistral   # the same with a key of one's own (also openai, anthropic,
                                                # each with its own variable): the browser's code, run in Node. The
                                                # provider bills the key's account, six calls for 250 notes
CLOUDFLARE_ACCOUNT_ID=… sh scripts/preview-deploy.sh     # the preview `ideabeam-vorschau` (environment `vorschau`),
                                                # at its workers.dev address; on the owner's word
CLOUDFLARE_ACCOUNT_ID=… sh scripts/production-deploy.sh  # the product `ideabeam` on ideabeam.de; on the owner's word.
                                                # Refuses with changes, off `main` or a tag, with an unpushed commit
                                                # and while release:check fails (today, on purpose)
node scripts/smoke.mjs https://ideabeam.de      # two browsers through a deployment: make, join, write hidden, reveal,
                                                # Markdown, delete. 1 of the day's walls, about 35 rows; „Ordnen“
                                                # only with --ordnen (neurons). Prints no token
node scripts/smoke.mjs --selftest               # the same against `vite preview` of the last build (port 4173)
```

The product and the preview are two Workers of one config (`apps/worker/wrangler.jsonc`): the top level is the
product, `env.vorschau` the preview. Two Worker names are two Durable Object namespaces: the preview's walls never
move to the product. A deploy with `--name` alone takes the top level, the domain included: deploy only through the
two scripts (a measuring Worker: `--env vorschau --name …`, `scripts/measure-cloudflare.mjs`).

Node 22, pnpm (the version `package.json` names) and Python 3.10 for the kit of the sebaro copy.

## Layout

```
apps/web         the React app: the sebaro starter `webapp-vite` 3.0.2, adapted (docs/HERKUNFT.md)
apps/worker      the Hono Worker and the WallRoom Durable Object; the wrangler config lives here
packages/shared  the protocol and the rules both sides share: plain functions, no I/O; and the catalogue of the
                 methods with their words in German and English (methods/), which the Worker's export needs too
packages/arrange „Ordnen“: the prompts, the check of every answer, the proposal, its layout, and the providers of
                 „Eigener Schlüssel“ with their requests and answers: plain functions, no I/O
docs/            ANSICHTEN.md (views), HERKUNFT.md (what was copied from where), sebaro-luecken.md,
                 and the measurement reports (messung*.md, messung/, ki-anbieter.md)
```

The throwaway prototype of stage 0 (model measurements) lives on the branch `proto/e0-messung` only. No code of it
goes into the product.

## Rules of this repository

- **The rules of the product live in `packages/shared`** as pure functions with tests. The Durable Object parses,
  asks them, stores and sends; the app renders. Neither grows rules of its own.
- **Schemas are written with `zod/mini`** (`import * as z from "zod/mini"`: checks as functions in `.check()`,
  `z.optional()`, `z.nullable()`, `z._default()` around a schema), never with zod's classic build. The classic build
  loads in some 10 ms more, which the Worker pays at every fresh start, where the free plan names 10 ms of CPU a
  request (docs/messung-4a.md, section 8); it also made the Worker's file 126 KB larger, and the app's first load
  17 KB (gzip). ESLint refuses every import of zod but `zod/mini`, and `apps/web/tests/worker.spec.ts` reads the
  built files for the classic build. `zod/mini` loads no texts for its errors, every message reads „Invalid input“:
  nothing may read an error's message.
- **A Durable Object must be able to hibernate after every event.** No `setTimeout`, no `setInterval`, no
  `ws.accept()` (use `this.ctx.acceptWebSocket`), no open outbound connection, no state in memory between two
  events: what a handler needs stands in SQLite or in a socket's attachment. Time is a stored deadline plus the one
  alarm; the browser counts. ESLint refuses the three calls in `apps/worker/src`.
- **The Durable Object never calls the AI.** The Worker does (PLAN.md 4.3): a call that waits half a minute would
  keep the object awake and multiply what it bills.
- **No local run and no test reaches Cloudflare's AI.** The binding `AI` (`apps/worker/wrangler.jsonc`) has no
  local stand-in: left alone, every local start of the Worker would open a session with the account, which needs a
  login and asks the real AI. `remoteBindings: false` in `apps/web/vite.config.ts` and `apps/worker/vitest.config.ts`
  switches that off, and must stay. Local runs ask a stand-in instead (`ARRANGE_FAKE=1` in `apps/worker/.dev.vars`,
  `packages/arrange/src/fake.ts`); the tests of the route hand in an AI of their own (`test/arrange-helpers.ts`).
  A bare `wrangler dev` in `apps/worker` would connect: do not run it.
- **Every write is counted.** The free plan's limit that binds is rows written per day, shared with RetroBeam and
  FokusBeam on the same account (PLAN.md 3.6). Do not persist presence, and do not add a write per event without
  a reason.
- **RetroBeam and FokusBeam are never changed from here.** Code is copied from their committed history, with its
  source and commit in `docs/HERKUNFT.md`; a fix that they need too is reported to the owner.
- **One format:** Prettier with `printWidth` 120 everywhere, also for copied files. Source files in `apps/worker`
  and `packages/*` carry the two SPDX lines; the files of `apps/web` carry none (`REUSE.toml`).
- **`@ideabeam/shared` and `@ideabeam/arrange` enter `apps/web` as devDependencies.** The licence list of „Über“
  walks the app's `dependencies` and refuses a licence that is not on its list, AGPL included. Vite bundles them
  either way.
- **The prompts, the run and a provider's client load only for a run with the moderation's own key.** What the app
  loads at its start, on a wall and for a run with Cloudflare takes the layout of a proposal and the list of
  providers from `@ideabeam/arrange` and nothing else. The run (`apps/web/src/lib/key-run.ts`) and Anthropic's
  client (`key-anthropic.ts`) are imported with `import(…)` alone; the stand-in is in no file of the app.
  `apps/web/tests/arrange.spec.ts` reads the built files for all of it. It holds because `packages/arrange` says
  `"sideEffects": false`: without that line the bundler puts the prompts into the wall's file. Nothing in that
  package may do anything when it is imported.
- **No test and no script of a check reaches a provider.** The end-to-end tests answer the providers' addresses
  themselves (`page.route`), the unit tests hand in a `fetch` of their own, and the keys they use are no provider's.
  `scripts/measure-key.mjs` is the one thing that calls a provider, with a key from the environment, on the owner's
  word; its `--base` leads to a stand-in on this machine instead.
- **The Worker's test set moves together or not at all:** `vitest` 4.1.12, `@cloudflare/vitest-pool-workers`
  0.23.0 and `wrangler` 4.164.0 in `apps/worker`, the set RetroBeam runs. The pool brings its own, older workerd:
  `compatibility_date` in `wrangler.jsonc` may not pass 2026-08-22 or every worker test fails to start. The pool
  package is deprecated (renamed `@cloudflare/vitest-plugin`); moving to it is an open task of its own.
- **A preview server left running makes every end-to-end test fail.** Playwright reuses whatever listens on port
  4173, and a server started before the last build serves the old files. Run with `CI=1`, which refuses a port
  that is taken. Other sessions on this machine use the same port for their own products: never stop a process by
  port or by name, only one you started, by its PID; if the port is taken, wait and try again.
- **The frame of every page is `apps/web/src/components/View.tsx`:** head, content, action zone, footer, in this
  order. The footer with „Impressum“ and „Datenschutz“ is always the last thing on the page and the primary action
  stands above it: the owner's word on FokusBeam's first interface, which stood on the same starter. A page that
  is no wall has the site's head (`SiteHeader.tsx`) and one column in the middle; the wall has a head of its own
  with „Link kopieren“ and „Mehr“ (`wall`, `tools`, `more`), says its state at its top, large (`app-state`), and
  fills `app-wall` with its content. There is no app frame and no navigation at the edge. The frame is FokusBeam's
  (`docs/HERKUNFT.md`); the deviations from sebaro's web-app rules are A6 and A7 in `docs/sebaro-luecken.md`.
- **The legal texts live in `apps/web/src/content/`** as markup, one file per page and language, and read the
  operator from `operator.ts`. A value in square brackets there is a placeholder: the pages say „Entwurf“, and
  `pnpm --filter @ideabeam/web release:check` refuses. Only the operator fills them: they say that a person read
  the texts, checked the Cloudflare settings, and where the public source is. When the app stores or sends
  something new (notes, the AI), the privacy notice changes in the same commit, in both languages.
- **The host's headers are `apps/web/static/_headers`**, emitted with the build: the policy as a header (kept equal
  to the `<meta>` by `src/headers.test.ts`), noindex for `/w/*` and for every workers.dev address.
  `tests/worker.spec.ts` reads them back from the built app. A deploy script must not overwrite the file.
- **The DEPLOY recipes in `apps/web` are the starter's and do not fit** an app with a Worker; the two deploy scripts
  above do. Nothing is deployed without the owner's word.
- **No push without the owner's word.** The remote is a private GitHub repository (`origin`, since 2026-11-24).
  Before it becomes public, its history is read through for anything personal (the commits carry the owner's
  e-mail address).
- German and English from the first version; the product's name is never translated.

## The moderation's own key (stage 4b)

With a key of its own the moderation's browser asks its provider directly, with the prompts and the check of
`packages/arrange`; the Worker is not asked, and the wall's six runs and the product's neurons are not touched
(PLAN.md 4.5; what was tested about the providers: `docs/ki-anbieter-4b.md`, `docs/ki-anbieter-4b-us.md`).

- **The key never leaves the tab's memory, except in the header of a call to the provider it is for.** It lives in
  `apps/web/src/store/key.ts`, a store that is not persisted: no `localStorage`, no `sessionStorage`, no cookie, no
  address, no log, no text of an error, no request to this product's server and no frame of a wall's socket. A
  reload forgets it. The dialog reads it from a password field once and never shows it again. Whoever changes this
  code keeps it so: `apps/web/tests/own-key.spec.ts` („ACCEPTANCE“) reads every request and every frame of a whole
  run for the key.
- **Nothing a provider wrote reaches a sentence.** A call that fails is one of seven names (`ProviderFailure`,
  `packages/arrange/src/provider-calls.ts`); the sentence names the provider and what to do now
  (`apps/web/src/lib/rejected.ts`). A provider's message may quote the key or a note.
- **A provider is shown once its model is measured.** Every entry of `PROVIDERS`
  (`packages/arrange/src/providers.ts`) carries `measured`, and it is `true` only after
  `scripts/measure-key.mjs` reached ARI 0.7 on the two test boards and the numbers stand in `docs/`. Today all
  three are `false`, so „Eigener KI-Schlüssel“ is in nobody's „Mehr“.
- **The switch for a tab.** `#eigener-schluessel` behind a wall's address (`/w/<id>#eigener-schluessel`, beside a
  moderation link's token: `#admin=<token>&eigener-schluessel`) offers the unmeasured providers too, each with the
  sentence that its arrangement is not measured yet. It is for the owner trying his own key and for the tests, and
  it is no part of the interface. The app reads it once, takes it out of the address at once and keeps it in the
  tab's memory (`apps/web/src/lib/key-switch.ts`): it cannot be bookmarked, it is not stored, a reload switches it
  off.
- **A further provider** is one entry of `PROVIDERS` (its name, its one address, the page where a key is made, the
  variable the measuring script reads its key from, its model with price and what its request needs, the facts the
  interface states, `measured: false`); its origin in `connect-src` of `apps/web/index.html` and
  `apps/web/static/_headers` (`src/headers.test.ts` holds both against the list); and, where its API has neither
  the shape of OpenAI's chat completions nor Anthropic's, its request and its answer in `provider-calls.ts` with a
  test that pins the exact body and headers. A provider that does not let a browser read its answers (CORS, also on
  its error answers) cannot join. The interface needs no new string: the sentences are built from the kinds of
  facts.
- **Anthropic is asked through its own client** (`@anthropic-ai/sdk`, `dangerouslyAllowBrowser`), never with a
  hand-written request: one attempt per call, no logging, no tracing, the model's own fallback for a declined
  request where it has one. Its dependency `fast-sha256` brought the licence „Unlicense“ into the list of
  `vite.config.ts`, confirmed by the owner (PLAN.md 7.2, no. 23).

## Design and technology: sebaro

This product follows sebaro. The kit is `https://github.com/grundhofer/sebaro-blueprint`; use a local checkout where
there is one.

- **Kind:** web app. Its rules beyond the core: `<kit>/design/platforms/webapp.md`. Its technology plan:
  `templates/webapp-vite/BLUEPRINT.md` in the private `grundhofer/sebaro-foundry` (read with `gh`); the copy this
  product started from is [`apps/web/BLUEPRINT.md`](apps/web/BLUEPRINT.md).
- **Before any UI work** read `<kit>/design/KERN.md` (31 core rules) and pick the view type of the screen in
  `<kit>/design/views.md`. The product's views with their types: [`docs/ANSICHTEN.md`](docs/ANSICHTEN.md).
- **The sebaro copy** is `apps/web/src/sebaro`. Never edit it. Parts and tokens come from there; what is missing
  is built beside it.
- **Gaps and decided deviations** of this product: `docs/sebaro-luecken.md`.
