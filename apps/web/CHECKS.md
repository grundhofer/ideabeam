# Checks

What the checks of this product do not see, and every waiver with its reason (core rule 31). `pnpm checks` and `ci`
run the rest; their result is the run itself. Keep this file current.

## Not checked

- Chromium only: WebKit and a real screen reader never ran, and Firefox only as the smoke test's second person
  (`scripts/smoke.mjs --selftest`: the door, writing hidden, revealing, the deletion; no check of a view, no axe).
- Forced colours and the system's contrast modes, the browser's zoom to 400 % (a width of 320 px) and larger spacing of
  lines, paragraphs, words and letters were never checked. The 200 % checks set the text size, not the zoom.
- Keyboard alone: making, joining and deleting a wall, the appearance and the language, the command palette, notes
  and groups on the surface, the list with „Verschieben nach …“ and arranging in the list have tests. Revealing, the
  clock, „Meine Angaben löschen“, „Als Markdown sichern“ and „QR-Code zeigen“ have none of their own, and nobody went
  through every task with the keyboard.
- axe runs on every screen of `tests/screens.spec.ts` in light at 390 px and in dark at 1440 px, in German apart from
  the start and the door. The other two pairings and English run only for the surface and the list of a wall with
  groups (`tests/groups.spec.ts`), the QR code (`tests/export.spec.ts`) and the three legal texts
  (`tests/legal.spec.ts`).
- The start page's texts were rewritten on 2026-11-25 to say what v0.1 does; the owner has not read them.
- A real phone: the start, the views and large text were seen only in Chromium at 390 px.
- The product's deploy: the Worker `ideabeam` was never deployed, and ideabeam.de is not bought. Its config (the top
  level of `apps/worker/wrangler.jsonc`, the custom domain, 8,000 neurons) and the preview's (`env.vorschau`, no route,
  1,000 neurons) were read back from the built `dist/ideabeam/wrangler.json` of each build, never from Cloudflare: that
  the custom domain attaches, that www redirects (a rule of the zone, set by hand) and that the preview keeps its walls
  after its first deploy as an environment (same Worker name, so the same Durable Objects) are unverified.
  `scripts/production-deploy.sh` was run only up to its refusals (changes in the tree; HEAD off `main` and off a tag; a
  commit in no remote branch; release:check failing), in a clone, never up to the build or `wrangler deploy`;
  `scripts/preview-deploy.sh` was not run at all since it moved to the environment. The preview Worker
  `ideabeam-vorschau` was deployed last at code `40f08fe` (stage 4b, before stage 5): the export, the QR code and the
  accessibility statement were never on Cloudflare, and its budget is still 8,000 neurons there until its next deploy. The weekly question for a newer copy never ran
  (`SEBARO_FOUNDRY_TOKEN` is missing in the repository).
- The imprint, the privacy notice and the accessibility statement are drafts, read by neither their operator nor a
  lawyer. The imprint and the privacy notice come from FokusBeam's texts (there from RetroBeam's); the privacy notice
  was read end to end against the code on 2026-11-25 (state `d3cc22a` with stage 5, step B): stages 1 to 4b, „Als
  Markdown sichern“ and the QR code, every key the app writes to `localStorage` and `sessionStorage`, the header rules,
  what the Worker logs (nothing of its own; `invocation_logs` off), the two counters and the deletion after 30 days.
  `pnpm release:check` looks for placeholders in `src/content/operator.ts` and for a placeholder written as a literal
  into a text of `src/content/`, not for what the law asks; it fails today, on purpose, for the three facts only the
  operator has (`NOTICE_REVIEWED`, `CLOUDFLARE_SETTINGS_CHECKED`, `REPO_URL`). The English texts
  are translations of the German ones. The privacy notice has to change with every stage that stores, shows or sends
  something new.
- The privacy notice says that the footer links the exact running state on GitHub. That holds only for a build whose
  deploy sets `VITE_COMMIT_SHA` (`src/lib/source.ts`): both deploy scripts set it, and `scripts/production-deploy.sh`
  finds the commit in the built files before it deploys; while `REPO_URL` is a placeholder the footer has no such link
  at all, and that the commit is in the public repository `REPO_URL` names is not checked (the script checks only that
  some remote branch this clone knows holds it).
- The accessibility statement (`src/content/accessibility.*.tsx`) claims only what a test of this repository or an
  item of this file shows, as of 2026-11-25; it says „teilweise vereinbar“ with WCAG 2.2 AA and claims no conformance.
  That the BFSG does not apply is the operator's statement (2026-11-26: an exception, a micro-enterprise providing a
  service, § 3 Abs. 3 BFSG), checked by no lawyer; the statement is published voluntarily and names no market
  surveillance authority.
  When a check is added or a limitation found or removed, the statement and its date (`STATEMENT_DATE`) change with
  it.
- The host's header rules were read back from the built app in `vite preview` (`tests/worker.spec.ts`), never from
  Cloudflare for this product; FokusBeam's file, which this one follows, was read back from its deployed Worker.
- The day's budget of walls: the app's sentence is tested against an answer put in the Worker's place
  (`tests/budget.spec.ts`, `src/pages/NewWall.test.tsx`); the count itself is the Worker's test. No test spent a real
  day's budget, here or on Cloudflare.
- Words in code: the lint sees text between tags and the attributes `aria-label`, `aria-description`, `alt`,
  `placeholder` and `title`, not a string that code passes to a function.
- The copy's check of a view reads no pseudo-elements and no focus rings.
- The question before closing or reloading with unsaved changes is the browser's own; its text cannot be set.
- The CI: the remote (`origin`, private) exists since 2026-11-24, and the workflow `ci` ran green there on that day.
  A state that is not pushed did not run there; its steps are those of `pnpm checks` plus the audit.
- Cloudflare: only the preview `ideabeam-vorschau` ran there (see the deploy above). On it a wall was made in the EU
  jurisdiction (`scripts/measure-cloudflare.mjs`, 2026-11-22, PLAN.md 3.6). Every test here runs the Worker and its
  Durable Object in local workerd, where the EU jurisdiction is not implemented and `apps/worker/src/wall-stub.ts`
  takes its fallback.
- The Worker's tests run in the workerd the test pool brings (it knows no compatibility date after 2026-08-22), the
  end-to-end tests in the newer one of wrangler; neither is the version Cloudflare runs.
- Two browsers on one wall are two browser contexts of one Chromium on one machine, against `vite preview`: no real
  network between them, no second device.
- The smoke test (`scripts/smoke.mjs`) is no part of `pnpm checks`: it starts a preview of its own on port 4173 after
  the end-to-end tests, and the CI installs no Firefox. Run it by hand after a build: `node scripts/smoke.mjs
  --selftest` (with `--ordnen`, against the stand-in). It ran green that way on 2026-11-25 in Chromium and Firefox,
  with and without `--ordnen`. It never ran against a deployment; its fallback to two Chromium contexts (no Firefox
  installed) and its refusal of a taken port never ran.
- The clipboard: the two copy keys were checked in Chromium with the permission granted. Where a browser refuses,
  the key says „Kopieren ging nicht“; the wall's link then still stands in the address bar, the moderation link
  stands nowhere else.
- Two tabs of one browser: that a tab follows what another one stored (a wall, an admin token) is tested in jsdom
  with a `storage` event of the test, not with two real tabs.
- A wall that fills up: tested with thirty sockets of the test itself, not with thirty browsers.
- The request for a wall that fails for lack of a connection: its view was looked at with an answer of the wrong
  shape, which takes the same path in the app; a refused connection writes to the console, which the screen check
  does not allow.
- The moderation link: that no address a browser asks for carries the token is tested for the pages and their
  sockets. What a browser does with an address before the page runs (its history, a sync of open tabs between
  devices) is outside any test here; the app takes the token out of the address before it draws anything.
- The surface with a full wall: 500 notes at 30 frames a second on the Pixel 5 (PLAN.md, stage 2) was not measured.
  `scripts/seed-wall.mjs` fills a wall for it. No test here measures frames.
- The surface under a finger: panning, dragging a note and two fingers were driven with a mouse and with pointer
  events the test itself made up, never with a touch screen. A trackpad's pinch was a wheel with Strg held, as
  Chromium reports it. What a phone's on-screen keyboard does to the field a note is written in was never seen.
- The field a note is written in grows with its text through `field-sizing`; the fallback for a browser without it
  never ran.
- The surface for a screen reader: it is a list box whose options are the groups and the notes, with the keys in its
  description; axe finds nothing, and nobody listened to it. The list of the wall is meant to be the screen reader's
  way: axe finds nothing there either, at 390 px, at 1440 px and at 200 %, in light and dark, and nobody listened
  to that either.
- Groups under a finger: a frame's head and its resize handle were dragged with a mouse, never with a touch screen.
  Several notes are selected by touch with „Auswählen“ in the surface's tools: tested with Playwright's taps on an
  emulated touch screen (`tests/groups.spec.ts`), never on a real one; on a phone the list has „Verschieben nach …“
  for one note at a time.
- The frame of a picked note and of a drop target keep their width at every zoom through a custom property the
  surface writes when the view rests: while a zoom is under way they are drawn at the old width. Looked at in
  Chromium only.
- Text cut by the surface: the surface cuts what lies outside its view, on purpose. The check of cut text sees a
  wall as it opens, with every note in view; a wall that was panned or zoomed is not checked for cut text.
- A reject by the wall: seen for a wall that is full, with the test standing in for the wall, and for a note that
  is somebody else's, which the app refuses by the shared rules before it sends. The other reasons (a note that was
  just deleted, the rate limit, a change lost offline) are tested in jsdom with the wall's frames made up.
- „Eigener Schlüssel“ (stage 4b): **no call ever reached a provider.** The end-to-end tests answer the three
  providers' addresses themselves, the unit tests hand in a `fetch` of their own, and `scripts/measure-key.mjs` ran
  only against a stand-in on this machine. What a provider takes and answers is read from its pages
  (`docs/ki-anbieter-4b.md`, `docs/ki-anbieter-4b-us.md`), not seen: whether Mistral serves `mistral-small-2603` at
  its EU address and takes `reasoning_effort: "none"`; whether OpenAI takes `temperature` and `seed` with
  `gpt-6-luna`; whether Anthropic takes the assignment's schema, and the fallback beta from a page (its preflight
  allows the header, tested without a key); how much the Claude models think at `effort: "low"`; whether six calls
  at once pass a new account's rate limit at any of the three; and that a successful answer carries the header
  that lets a page read it (seen for the preflights and the error answers only).
- No provider's model is measured: no ARI, no time for a run. The second call beside a slow one goes out after the
  times measured for Workers AI, and the 60 seconds a call may take are a guess. What a wall costs is reckoned from
  the price lists and an assumed 250 tokens of thinking a call.
- The key's field: it is a password field with `autocomplete="off"`, and nothing in the app stores what is typed.
  Whether a browser's own password manager offers to store it was not seen with a real profile.
- The switch `#eigener-schluessel` and the key itself are in no storage and in no address after the app has run:
  tested. What a browser does with an address before the page runs (its history, a sync of open tabs between
  devices) is outside any test, as for the moderation link.
- The own-key dialog and its states were looked at in Chromium at 390, 1440 and 2000 px, light and dark; no real
  phone, no screen reader. On a phone the dialog's body scrolls once a key is set and the field has an error, and
  nothing marks that it scrolls (`docs/sebaro-luecken.md`, B21).
- „Als Markdown sichern“: the file was saved by Chromium's download in the end-to-end tests (from a Blob made in
  the tab) and read back; no phone saved one, and what Safari on iOS does with a Blob download (it shows the file
  or asks where to put it) was not seen. The file was read as text, never opened in a Markdown viewer: that the
  escaping keeps every note one plain list item is tested on the text (`packages/shared/test/export.test.ts`), and
  a viewer that links bare addresses by itself (GitHub's flavour) will show a note's address as a link.
- The date in the file and in its name is the day in UTC: just after midnight in Germany the file names the day
  before. Not changed: the Worker has no time zone of the person.
- The QR code: **no phone scanned it.** The tests compare the drawn modules with what `uqr` encodes for the wall's
  link (`tests/export.spec.ts`), and they are not those of the moderation link; whether a camera reads it from a
  projector across a room, and at what size, was not tried. Its size in the dialog (at most 28 rem, at most half the
  window's height, 448 px at 1440 × 900) was looked at in Chromium only.
- The methods (stage M1, PLAN-METHODEN.md): the choice on `/neu` and its „Mehr dazu“, the step header, „Weiter“
  and „Zurück“ are tested in jsdom (`src/pages/NewWall.test.tsx`, `src/pages/Wall.test.tsx`) and through the
  Worker's frames (`apps/worker/test/steps.test.ts`, `migration.test.ts`); in a browser only as far as the screens
  `neu` and `neu-offen` (with „Mehr dazu“ open) and the existing walls show them. No end-to-end test goes back with
  „Zurück“ in a browser, and nobody has looked at the new header and the choice at 2000 px, light and dark, or at
  200 % in English. The keyboard reaches the choice (option fields and „Mehr dazu“ are native controls), but no
  test walks it. The words of „Freie Wand“ are this stage's own, not the catalogue's. The choice shows no evidence
  level and no evidence sentence (the owner's decision of 2026-11-27, PLAN-METHODEN.md 7, question 5). „Still
  sammeln, bündeln, verdeckt wählen“ names a vote and a ranking that come only with M2: until then its name and short
  description promise more than a wall does.
  A wall of schema 3 (before the methods) was played only in workerd's test pool, by rewriting a wall of this build
  into the old shape (`asSchemaThree`), never with a wall a deployed v0.1 made.
- The hidden vote (stage M2): `tests/vote.spec.ts` reads every frame of a second browser before counting (no other
  person's ballot, no tally), sends a ballot twice, counts, and walks the ballot with the keyboard alone; the
  screens `wand-wahl` and `wand-ergebnis` run axe in light at 390 px, dark at 1440 px and at 200 %. The ballot panel
  offers points and choices (`dots`, `approval`); ranking (`rank`) has its panel since stage M5, scores (`score`)
  theirs since stage M6 (both below). Nobody looked at the panel at 2000 px or with a screen reader; the guide
  sentences speak of points, which is true for the one vote there is. „5 von 8“ counts the people here now, at least
  as many as have voted.
- Estimating in rounds (stage M3): `tests/estimate.spec.ts` plays „Schätzen – Diskutieren – Schätzen“ with two
  browsers from the first estimate to the result, reads the other browser's frames for the estimate of the first
  before counting and of the second round at all, and casts an estimate and a reason with the keyboard alone; the
  screens `wand-schaetzung`, `wand-schaetzung-runde-2` and `wand-schaetzung-ergebnis` run axe in light at 390 px,
  dark at 1440 px and at 200 %, `neu-schaetzen` (the unit's field) in light and dark. With two people the range of a
  round is both estimates: the summary gives away the smallest and the largest estimate by design, which the privacy
  notice says; the worker test (`apps/worker/test/estimates.test.ts`) checks with four people that the two in the
  middle reach no frame. Nobody looked at the panels at 2000 px or with a screen reader; the step „Abweichungen
  besprechen“ is one for everyone until stage M4 brings small groups.
- Pairs and small groups (stage M4): `tests/teams.spec.ts` plays „1-2-4-Alle“ with four browsers (the moderation and
  three who join at the door): each writes alone, the moderation moves into the pairs, each browser names its team
  and partner and holds its partner's note; every frame each browser received since the move is read for the other
  pair's notes and a note written in a pair is read for in the other pair's frames; the moderation swaps two people
  through „Mehr“ → „Teams“ with the keyboard alone (Enter, arrow keys, Tab; the focus stays on the pressed key after
  the swap); the merge shows every note to the four; the presenting asks before it shows everything; the export
  names how many teams there were and no name. The screens `wand-team` (surface, team's area) and `wand-teams` (the
  moderation's map with a swap begun) run axe in light at 390 px, dark at 1440 px and at 200 %, `wand-team-liste`
  (the list with the team's heading) in light and dark. Moving on by itself when the time is up is tested in the
  Worker only (`apps/worker/test/teams.test.ts`, with `runDurableObjectAlarm`): no end-to-end test waits a minute
  for it, so the browser's side of it (the step frame with the clock the move started) is read only by the unit
  test of the reducer's input and by `tests/teams.spec.ts` for a move the moderation made. Nobody looked at the
  areas at 2000 px or with a screen reader; the areas on the surface are drawn and hidden from screen readers, the
  list says the same with a heading per team.
- The methods of stage M5: `tests/methods-m5.spec.ts` plays each of the four methods with two browsers (the
  moderation and one who joins at the door) through all its steps and saves its export. „Stille Ideenrunde mit
  Rangfolge“: after every „Nächster Zettel“ each browser's received frames are read for the other's notes, and a note
  is in a browser's frames exactly when it is on its surface (no note before its turn); the ranking is done with the
  keyboard alone (Tab to „Wählen“, Enter, Shift+Tab to „Nach oben“, Enter with the focus following the row, Tab to
  „Abgeben“). „Rückblick nach Ziel und Daten“ reads the other browser's frames for a hidden action. „Was? Na und? Was
  nun?“ reads them for each round's hidden note. The Worker reads the frames of three people through a whole round
  by turn (`apps/worker/test/methods-m5.test.ts`). The screens `wand-reihum` (the moderation in a step that reveals by
  turn), `wand-rangfolge` (the ranking with two chosen) and `wand-aktionen` (the moderation's actions with their
  fields) run axe in light at 390 px, dark at 1440 px and at 200 %, `wand-aktionen-lesen` in light and dark. Not
  seen: the small groups of „Was? Na und? Was nun?“ and of the retrospective with more than one team in a browser
  (the Worker test plays eight people in two teams), the turn step in the list view, the ranking and the actions at
  2000 px or with a screen reader, the actions' fields filled by somebody without a mouse beyond Enter in a field.
- The methods of stage M6: `tests/methods-m6.spec.ts` plays each of the six methods („Kriterienbewertung“, „Nutzen
  und Aufwand“, „Gegenposition prüfen“, „Entscheidungsprotokoll mit Zustimmungsrunde“, „Annahmen prüfen“, „Ziele mit
  messbaren Ergebnissen“) with two browsers through all its steps and saves its export; „Gegenposition prüfen“ with
  two more people who are no browser, so that two teams with their roles form. „Kriterienbewertung“: the second
  browser scores six fields with the keyboard alone (Tab to each select, a digit chooses, Tab to „Abgeben“, Enter);
  the moderation's received frames carry no `"scores"` before counting, and the other browser's carry only its own
  ballot as stored; half an option cannot be sent. „Entscheidungsprotokoll“: the answer is chosen with the arrow
  keys, an objection without its reason is not sent, and before counting neither browser's frames carry the other's
  answer or the reason. „Annahmen prüfen“ moves an assumption into a field through the list's „Verschieben nach …“
  in the hidden step, and reads the moderation's frames for it. The Worker reads the frames of three people for
  scores and consent answers (`apps/worker/test/methods-m6.test.ts`). The screens `wand-bewertung` (the score with
  one option scored), `wand-bewertung-ergebnis` (the table), `wand-zustimmung` (an objection with its field),
  `wand-entscheidungen` (the moderation's decisions with their fields) and `wand-ergebnisse` (the measurable results
  with the goal to choose) run axe in light at 390 px, dark at 1440 px and at 200 %, `wand-zustimmung-ergebnis` in
  light and dark. Not seen: the role line and the fields of „Annahmen prüfen“ on the surface in a screen of their own
  (the end-to-end tests read them), any of the panels at 2000 px or with a screen reader, a score with many options
  on a phone (each option is a group of up to five selects), the decision and result fields filled without a mouse.

## Waivers

- `wand-qr` in dark at 1440 px runs without the copy's check of a view (`tests/screens.spec.ts`). Core rule 7 asks
  for the QR code in the light theme's colours in dark mode too; the check resolves every colour in the view's own
  mode and reads the code's white and ink as colours without a role. In light at 390 px the same screen runs with
  the check, and axe runs on the dialog at both widths in both modes (`tests/export.spec.ts`). The gap is B24 in
  `docs/sebaro-luecken.md`.
