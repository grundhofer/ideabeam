// arrange.ts: „Ordnen“ in the moderation's browser, as it goes (PLAN.md 4.3): the moderation asks the Worker for a
// proposal and waits; the proposal stands as a preview, in this browser alone; „Anwenden“ sends it to the wall as one
// command, „Verwerfen“ lets it go. Nothing here is stored, in the browser or anywhere else: a proposal lives in this
// tab's memory until it is applied or discarded, and a reload forgets it.
//
// What the preview shows and what „Anwenden“ sends are worked out from the wall as it stands, each time anew
// (lib/arrange.ts): the wall goes on under a proposal, and everybody else keeps working on it.
//
// With the moderation's own key (PLAN.md 4.5, store/key.ts) the proposal comes from the moderation's provider,
// asked straight from this browser (lib/key-run.ts): the Worker is not asked at all, and everything after the
// proposal is the same. That part of the app is loaded when such a run starts, and not before.
import { create } from "zustand";
import {
  ARRANGE_MIN_NOTES,
  dropPending,
  generateHexId,
  shown,
  type ArrangeLanguage,
  type ArrangeSource,
  type Proposal,
} from "@ideabeam/shared";
import type { ProviderId } from "@ideabeam/arrange";
import { proposeArrangement } from "../lib/api";
import { arrangeable, arrangementOf, arrangeNotes } from "../lib/arrange";
import type { OwnKey } from "./key";
import { useWall, type Rejected } from "./wall";

/** How long the app waits for a proposal before it gives up. The Worker answers once, after the whole run: a large
 *  wall takes about a minute at the AI's service. */
export const ARRANGE_WAIT_MS = 120_000;

/** A proposal as it came, and the ids its groups will get on the wall: minted here, so the preview and the command
 *  name the same groups. `source`: who worked it out, the app's own service or the moderation's provider; the wall
 *  is told with the arrangement. */
type Run = { proposal: Proposal; groupIds: string[]; partial: boolean; source: ArrangeSource };

/** Where „Ordnen“ stands in this browser.
 *  - `running`: the Worker has been asked and has not answered, or, with the moderation's own key, its provider
 *    (`provider`; null: the Worker). `since` is this browser's clock when it was asked, `notes` how many notes the
 *    AI has to arrange.
 *  - `preview`: a proposal stands over the wall, for this browser alone. `partial`: a part of the notes got no
 *    answer from the AI and lies without a group.
 *  - `applying`: the proposal is on its way to the wall as the command `opId`; `again`: for the second time, after
 *    the wall refused the first because it had changed meanwhile. */
export type Arranging =
  | { is: "idle" }
  | { is: "running"; since: number; notes: number; provider: ProviderId | null }
  | ({ is: "preview" } & Run)
  | ({ is: "applying"; opId: string; again: boolean } & Run);

type Arrange = {
  arranging: Arranging;
  /** How many runs the wall has left now, of those it has in any 24 hours, as the last proposal's answer said.
   *  null: not known (no run on this visit yet, or one whose answer never came: it may have counted all the same). */
  runsLeft: number | null;
  /** „Ordnen“: asks for a proposal for the wall this tab is on. `language` is the one the titles are written in. */
  ask(wallId: string, adminToken: string, language: ArrangeLanguage): void;
  /** „Ordnen“ with the moderation's own key: asks its provider from this browser, with the wall as this browser
   *  shows it. Nothing goes to the Worker, and the wall's runs and the product's budget are not touched. */
  askWithKey(wallId: string, own: OwnKey, language: ArrangeLanguage): void;
  /** „Abbrechen“: ends the waiting. The run goes on at the Worker and counts. With the moderation's own key it
   *  ends the calls to the provider themselves. */
  cancel(): void;
  /** „Verwerfen“: the proposal goes, the wall is as it was. */
  discard(): void;
  /** „Anwenden“: the proposal, laid out from the wall as it stands now, goes to the wall as one command. */
  apply(): void;
  /** Nothing of a run stays: the wall was left. */
  reset(): void;
};

const IDLE: Arranging = { is: "idle" };

// the request that is out: the handle that ends the waiting, and the timer that ends it by itself
let waiting: { stop: AbortController; timer: ReturnType<typeof setTimeout> } | null = null;

export const useArrange = create<Arrange>()((set, get) => {
  /** „Ordnen“ ended without a proposal: the wall says why, where it says every change that was not taken. */
  const failed = (rejected: Extract<Rejected, { command: "arrange" }>) => {
    set({ arranging: IDLE, runsLeft: null });
    useWall.setState({ rejected });
  };
  /** The same for a run with the moderation's own key. What the wall has left of its runs at the Worker stays as it
   *  is known: this run was none of them. */
  const failedWithKey = (code: Extract<Rejected, { command: "arrange.key" }>["code"], provider: ProviderId) => {
    set({ arranging: IDLE });
    useWall.setState({ rejected: { code, command: "arrange.key", provider } });
  };

  /** A run begins: whoever is asked has until ARRANGE_WAIT_MS. Null: one is out already, a proposal stands, or the
   *  wall is another one. */
  const begin = (wallId: string, provider: ProviderId | null) => {
    const wall = useWall.getState();
    if (get().arranging.is !== "idle" || wall.wallId !== wallId) return null;
    const stop = new AbortController();
    const asked = { stop, timer: setTimeout(() => stop.abort(), ARRANGE_WAIT_MS) };
    waiting = asked;
    // a reason that still stands from an earlier change is put away, as with every new change
    wall.dismissRejected();
    set({ arranging: { is: "running", since: Date.now(), notes: arrangeable(shown(wall.state)), provider } });
    return asked;
  };
  /** The request is over. Whether its answer still counts: not after „Abbrechen“, not once the wall was left. */
  const over = (asked: NonNullable<typeof waiting>) => {
    clearTimeout(asked.timer);
    if (waiting !== asked) return false;
    waiting = null;
    return true;
  };
  /** A proposal has come: it stands as a preview, unless nothing of it is left on the wall. True: it stands. */
  const propose = (proposal: Proposal, partial: boolean, source: ArrangeSource) => {
    const groupIds = proposal.groups.map(() => generateHexId());
    // every note of it was deleted while the AI worked, or lies in a group a person made or renamed meanwhile
    if (arrangementOf(shown(useWall.getState().state), proposal, groupIds) === null) return false;
    set({ arranging: { is: "preview", proposal, groupIds, partial, source } });
    return true;
  };

  return {
    arranging: IDLE,
    runsLeft: null,
    ask(wallId, adminToken, language) {
      const asked = begin(wallId, null);
      if (asked === null) return;
      proposeArrangement(wallId, adminToken, language, asked.stop.signal).then(
        (proposed) => {
          if (!over(asked)) return;
          if (!proposed.ok) {
            const { why, resetsAt, min } = proposed;
            failed({
              code: why,
              command: "arrange",
              // with the time it goes on, the clock it was heard at: the view reads no clock while it renders
              ...(resetsAt === undefined ? {} : { resetsAt, at: Date.now() }),
              ...(min === undefined ? {} : { min }),
            });
            return;
          }
          const { proposal, partial, runsLeft } = proposed.answer;
          if (!propose(proposal, partial, "service")) failed({ code: "NOTHING_LEFT", command: "arrange" });
          set({ runsLeft });
        },
        () => {
          // the waiting was ended: by „Abbrechen“, which has said so itself, or by the time it may take
          if (over(asked)) failed({ code: "TIMEOUT", command: "arrange" });
        },
      );
    },
    askWithKey(wallId, own, language) {
      const wall = useWall.getState();
      if (get().arranging.is !== "idle" || wall.wallId !== wallId) return;
      // what the Worker reads from the wall for a run of its own, read here from the wall as this browser shows it
      const notes = arrangeNotes(shown(wall.state));
      const question = wall.state.wall?.question ?? "";
      // too few notes: said as the Worker says it, and nobody is asked
      if (notes.length < ARRANGE_MIN_NOTES) {
        wall.dismissRejected();
        useWall.setState({ rejected: { code: "NOTHING_TO_ARRANGE", command: "arrange", min: ARRANGE_MIN_NOTES } });
        return;
      }
      const asked = begin(wallId, own.provider);
      if (asked === null) return;
      const { signal } = asked.stop;
      import("../lib/key-run")
        .then(
          ({ runWithKey }) => runWithKey(own, { question, notes, language }, signal),
          () => "LOAD" as const,
        )
        .then(
          (run) => {
            if (!over(asked)) return;
            if (run === "LOAD") failedWithKey("LOAD", own.provider);
            else if (!run.ok) failedWithKey(run.why, own.provider);
            else if (!propose(run.proposal, run.partial, "key")) {
              set({ arranging: IDLE });
              useWall.setState({ rejected: { code: "NOTHING_LEFT", command: "arrange" } });
            }
          },
          () => {
            // The run was ended: by „Abbrechen“, which has said so itself, or by the time it may take. Anything
            // else that fails here is no answer either.
            if (over(asked)) failedWithKey(signal.aborted ? "TIMEOUT" : "UNUSABLE", own.provider);
          },
        );
    },
    cancel() {
      const now = get().arranging;
      if (now.is !== "running") return;
      const asked = waiting;
      waiting = null;
      if (asked !== null) {
        clearTimeout(asked.timer);
        asked.stop.abort();
      }
      // A run at the Worker may have counted all the same: how many the wall has left is not known any more. A run
      // with the moderation's own key was none of the wall's runs.
      set(now.provider === null ? { arranging: IDLE, runsLeft: null } : { arranging: IDLE });
    },
    discard() {
      if (get().arranging.is === "preview") set({ arranging: IDLE });
    },
    apply() {
      const now = get().arranging;
      if (now.is !== "preview") return;
      const wall = useWall.getState();
      const arrangement = arrangementOf(shown(wall.state), now.proposal, now.groupIds);
      if (arrangement === null) {
        failed({ code: "NOTHING_LEFT", command: "arrange" });
        return;
      }
      const opId = generateHexId();
      set({ arranging: { ...now, is: "applying", opId, again: false } });
      wall.send({ type: "admin.arrange.apply", opId, source: now.source, ...arrangement });
    },
    reset() {
      const asked = waiting;
      waiting = null;
      if (asked !== null) {
        clearTimeout(asked.timer);
        asked.stop.abort();
      }
      set({ arranging: IDLE, runsLeft: null });
    },
  };
});

// What the wall says about a proposal that is on its way to it, and the wall's end. Heard here, in the same step in
// which the wall's store changes, so no view ever draws the moment in between.
useWall.subscribe((wall, before) => {
  const { arranging, runsLeft, reset } = useArrange.getState();
  // the wall was left or is gone, or it has forgotten this person: nothing of a run stays
  if (wall.wallId !== before.wallId || wall.state.deleted || wall.erased) {
    if (arranging.is !== "idle" || runsLeft !== null) reset();
    return;
  }
  if (arranging.is !== "applying") return;
  // the wall's event has come: the run is the wall's last one, and everybody has it
  if (wall.state.arrangeRun === arranging.opId) {
    useArrange.setState({ arranging: IDLE });
    return;
  }
  const refused = wall.rejected;
  if (refused === null || refused === before.rejected || refused.command !== "admin.arrange.apply") return;
  const { proposal, partial, source } = arranging;
  // The wall took nothing of it. A note the arrangement names is gone, or lies in a group somebody made by hand or
  // renamed meanwhile: the proposal is laid out again from the wall as it stands and sent once more, under new names.
  if ((refused.code === "NOT_FOUND" || refused.code === "CONFLICT") && !arranging.again) {
    const groupIds = proposal.groups.map(() => generateHexId());
    // the refused command is still among those on their way: the wall without it
    const arrangement = arrangementOf(shown(dropPending(wall.state, arranging.opId)), proposal, groupIds);
    if (arrangement === null) {
      useArrange.setState({ arranging: IDLE, runsLeft: null });
      useWall.setState({ rejected: { code: "NOTHING_LEFT", command: "arrange" } });
      return;
    }
    const opId = generateHexId();
    useArrange.setState({ arranging: { is: "applying", proposal, groupIds, partial, source, opId, again: true } });
    // (sending puts the first refusal's reason away)
    useWall.getState().send({ type: "admin.arrange.apply", opId, source, ...arrangement });
    return;
  }
  // Refused for good: the wall says why (lib/rejected.ts), and the proposal stands as it stood, to be applied once
  // more or discarded.
  useArrange.setState({ arranging: { is: "preview", proposal, groupIds: arranging.groupIds, partial, source } });
});
