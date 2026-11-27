# Architecture: IdeaBeam as a guided workshop room

Proposal of 2026-11-27 for PLAN-METHODEN.md, written against `main` at `c31ed87` (read-only analysis of `AGENTS.md`,
`PLAN.md`, `docs/recherche-methoden.md`, `protocol.ts`, `domain/{visibility,clock,wall,rules,export,budget}.ts`,
`wall-room.ts`, `NewWall.tsx`, `Start.tsx`, `lib/guide.ts`, `lib/clock.ts`, `Wall.tsx`). Check it against the code
that holds when M1 starts. The name of the method without a flow is „Freie Wand“ (methoden-katalog.md); this text
calls it `free` in code.

Three facts from the code that shape the design:

- **One row holds the flow.** Phase and clock live in the single row `meta 'flow'` (`{phase, clock, seq}`). Revealing
  writes one row, each clock control one.
- **Visibility is one rule.** `maySeeNote(phase, note)` and `notesFor` / `revealedFor` / `eventFor` in
  `domain/visibility.ts` decide everything; `phase` is `writing | open`. `decide()` (`rules.ts`) and `decideClock()`
  take `Phase`.
- **Authors are already hidden everywhere** (owner's decision 14): a browser learns only `mine`. „Content visible,
  author hidden“ is today's floor for notes, not a new level.

## 1 Data model

`packages/shared/src/domain/method.ts` (zod/mini, pure):

```ts
stepType   = "impulse" | "write" | "reveal" | "cluster" | "discuss" | "vote" | "rank" | "score"
           | "estimate" | "present" | "decide" | "roleRound" | "consent"
mode       = "individual" | "pair" | "group" | "plenary" | "presentation"
visibility = "hidden" | "team" | "all" | "aggregate" | "anonymous"
actor      = "moderation" | "everyone" | "team" | "decider"
outputKind = "none" | "notes" | "groups" | "ballots" | "ranking" | "estimate" | "decisions" | "actions"

step = {
  key: string,                     // text key "<methodId>.<stepKey>"; texts are not stored on the wall
  type, mode, visibility, actor,
  durationSec: int | null,         // suggested; the moderation can change it
  advance: "moderation" | "auto",
  autoClock: boolean,
  input?:  { from: "item" | "step", ref?: int, kind: outputKind, topN?: int },
  output: outputKind,
  team?:  { size: 2..7, form: "random" | "moderation" | "merge" | "keep" },
  vote?:  voteConfig,
  round?: { n: int, of: int },
  noteKind?: "idea" | "reason" | "action" | "decision" | "criterion",
}
method = { id, version, items: Array<step | { method: methodId }>,   // nesting
           minutes, groupSize,   // no evidence level: the owner's decision of 2026-11-27 (PLAN-METHODEN.md 7, q. 5)
           attribution?: "liberatingStructures" | "leanCoffee" }
agendaRequest = { items: Array<{ methodId, prompt?: string(≤140), minutes?: Record<stepKey, int> }> }  // 1..8
resolvedStep  = step & { item: int, path: string, prompt: string }
```

- **Catalogue as code data** in `packages/shared/src/methods/catalogue.ts`, each method frozen with a `version`.
- **Pure functions** in `domain/agenda.ts`: `resolveAgenda(request, catalogue)` flattens nesting;
  `checkAgenda(steps)` checks that typed outputs chain and enforces evidence rules as checks („a vote follows a
  write“, „the default vote is hidden“); `capabilities(step)` → `{write, editOwn, move, group, arrange, ballot,
  teamOnly}`, generalising today's `PHASE` refusals.
- **The wall stores a resolved copy of its agenda** at creation as `meta 'agenda'` (2–4 KB, 1 row), not a reference
  to the catalogue, so a deploy cannot shift a running wall's steps. Texts stay keys; a missing key falls back to the
  generic text of the step type.
- **Position in the existing `meta 'flow'` row**, version 2:

```ts
interface FlowV2 { v: 2; step: int; stage: "active" | "counted"; reach: int;  // highest step reached
                   turn: int;                                                  // round-robin reveal counter
                   clock: Clock; auto: { at: number, step: int, rev: int } | null;
                   options: string[] | null;                                   // frozen choices of a vote step
                   seq: int }
```

Every step move writes 1 row, as revealing does today.

### Migration (schema 3 → 4, `migrate()` in `wall-room.ts`)

- `ALTER TABLE notes ADD COLUMN step INTEGER NOT NULL DEFAULT 0`, `… team TEXT`, `… kind TEXT NOT NULL DEFAULT
  'idea'` (metadata only). New table `ballots` (WITHOUT ROWID).
- No wall gets an agenda row by migration: `readAgenda()` returns `LEGACY_AGENDA` when `meta 'agenda'` is missing.
  `readFlow()` reads both shapes: v1 `writing` → step 0 (`write`, hidden), v1 `open` → step 1 (`cluster`, all). The
  v2 shape is written with the next change only.
- Legacy agenda = today's flow: `write` (individual, hidden) → `cluster` (plenary, all, arrange allowed). A wall made
  with `hidden:false` gets `free` (one step: write + cluster, all).
- `POST /api/walls` keeps `hidden` and adds `agenda: z.optional(agendaRequestSchema)`; without one, `hidden ?
  "still-sammeln" : "free"`.
- `legacyPhase(flow, steps)` keeps `decide()`, `arrangeInput()` and `wallMarkdown()` working in the first commit;
  afterwards they move to `StepContext`.
- `PROTOCOL_VERSION` 6 → 7; `phase.changed` gives way to `step.changed`.

## 2 Visibility per step

- Levels ordered `hidden < team < all`. `anonymous` equals `all` for notes (decision 14) and stays in the model so a
  later „named“ level needs only an owner decision. `aggregate` applies to ballots only: single ballots never leave
  the Worker, not even to the moderation; only `tally()` results, once counted.
- **Visibility only widens:** `levelOf(note) = max { steps[s].visibility : s ∈ [note.step .. flow.reach], same item }`
  — it depends on `reach`, not on the current step, so going back never hides.
- `ViewContext = { steps, flow, teamOf }`; `maySee(note, ctx, viewer)`; `notesFor(notes, ctx, viewer)` keeps its
  return shape; `revealedFor(notes, before, after, viewer)` serves reveal, team → all, merge and round-robin turns;
  `eventFor(...)` keeps `wall.occupancy` as the stand-in frame.
- **Round-robin reveal** (NGT, pre-mortem): `revealOrder(notes)` interleaves by author on the server; `flow.turn = k`
  shows the first k. Each „Nächster Zettel“ is 1 row plus `notes.revealed`.
- `decide()` takes `ctx: StepContext = { capabilities, viewerTeam, seen }` instead of `phase`.

## 3 New building blocks

### 3.1 Hidden simultaneous voting (`domain/vote.ts`)

```ts
voteConfig =
 | { kind: "dots",     perPerson: int, maxPerOption: int, stack: boolean }  // default perPerson = max(2, ceil(options/4))
 | { kind: "approval", max: int }
 | { kind: "rank",     top: int }                                           // Borda points
 | { kind: "score",    min: 1, max: 5, criteria?: string[] }
 | { kind: "estimate", unit?: string, min?: number, max?: number }
 | { kind: "consent" }                                                      // agree / can live with / objection + reason
 | { kind: "choose",   n: 1, scope: "team" }
```

- `optionsFor(step, content, results)` (≤ 80 options, frozen into `flow.options`), `checkBallot`, `tally`,
  `aggregate(numbers) = {n, median, q1, q3, min, max}`.
- Storage `ballots (step, voter, ballot, seq, PRIMARY KEY (step, voter)) WITHOUT ROWID`; a ballot is absolute
  (recast overwrites). Results in `meta 'result:<step>'`, written at counting.
- Protocol: `ballot.cast {opId, step, ballot}` (current step, `stage === "active"`, else `PHASE`; empty withdraws);
  `admin.step.count`; to the voter `ballot.stored`; to others `votes.count {voted}` (a number, never a tally); to all
  `results.published {tally}`; `sync` gains own ballot, `voted`, `results`. The browser holds a draft and sends on
  „Abgeben“.
- Cost for 8 people ≈ 13 rows per vote; estimates in two rounds ≈ 28. Ballots count against `wallBrake`.

### 3.2 Pairs and small groups (`domain/teams.ts`)

- `meta 'teams'` = `{rev, step, teams, history}` (1 row per change); `history` keeps membership at the widening step
  stable after a merge.
- `formTeams(presentIds, size, seed)` (seed from `crypto.getRandomValues`, stored; never a team of 1; present =
  open sockets), `mergeTeams` (2 → 4, odd count makes a three), `placeLatecomer`, `checkTeams`, `areaOrigin`.
- One wall with sub-areas, not one Durable Object per team. Notes carry `team`; the surface and the list draw what
  `notesFor` returns.
- Protocol: `admin.teams.set {opId, rev, teams}`; `team.changed` (full map to the moderation, own team to others);
  forming happens in the same transaction as the step move.
- Talking happens in the video tool; the step text names the breakout room.
- Cost for 1-2-4-Alle with 8 people ≈ 45 rows.

### 3.3 Time and Durable Object rules

- The clock stays data; it is cleared or started from `durationSec` in the same row as the step move.
- Auto-advance with the one alarm: `nextAlarm(retentionAt, flow) = min(retentionAt, flow.auto?.at)`; `alarm()`
  destroys when retention is due, else moves one step if `flow.auto` is due and still matches (stale check), then
  re-arms. Nothing in memory; a late or doubled alarm does nothing.

## 4 Moderation flow

- `admin.step.go {opId, from, to}` covers forward, skip and back; `from` makes it idempotent (`STALE` on mismatch).
  `decideStep(flow, steps, cmd, actor)` in `domain/flow.ts` returns the new flow and effects (reveal, form/merge
  teams, freeze options, clock). Back never hides, keeps ballots and results; reopening a counted vote is not in v1.
  Skipped steps count as reached.
- `/neu`: the question first, then „Methode“ as a radio list with name, short description (always visible),
  minutes, group size (no evidence word, PLAN-METHODEN.md 7, question 5); „Zeiten anpassen“; in M7 „Weitere Methode
  anhängen“.
- Wall: the `app-state` area becomes the step header: „Schritt 2 von 5 · Still schreiben“ with the time; the
  instruction for this role; personal progress; the next step. `stepGuide(step, role, standing)` grows out of
  `guide()`. Primary action for the moderation „Weiter: <next>“ (in a vote: „Auszählen“, then „Weiter“); „Zurück“,
  „Überspringen“, „Ablauf“, „Teams“ under „Mehr“. Vote steps show a ballot panel instead of the surface; results as a
  ranked list with numbers, no coloured bars. Step changes and „Zeit um“ are announced; focus never moves while
  someone types.

## 5 Export

`wallMarkdown` gains `steps`, `flow`, `results` and team counts, still behind `notesFor`. Per agenda item
`## 1. <Methodenname>` with its short description and prompt, then rankings (with the counting method), estimates
(median, range, middle half, n, per round), consent counts with objections, decisions and actions as task lines.
No single ballots, names or team members.

## 6 Stages

See PLAN-METHODEN.md, section 5 (M1 to M7, 30 / 51 AT).

## 7 Detailed open questions

Beyond PLAN-METHODEN.md section 7, decided by the recommendation unless the owner says otherwise: results go to
everyone at once when counted; going back is allowed but never undoes a vote; the moderation is the decider in v1
(the step text says the decider speaks last); the plain wall stays as „Freie Wand“; authors are never shown
(decision 14).
