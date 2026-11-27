// Wall.tsx: the wall behind an address. Whoever opens the address is first asked nothing: the app looks whether the
// wall exists. A browser that was on it before goes back on under its name; a new one joins with a name, at the
// wall's door. On the wall stand its question, its state with what to do now, its notes and groups as a
// surface (components/Surface.tsx) or as a list (components/WallList.tsx), and the people on it (docs/ANSICHTEN.md). The wall's tools are in its head: the link to copy and, in „Mehr“, the moderation's. The address is the capability: whoever has it may join. Who moderates holds a second one, the
// admin token: in the browser that made the wall, or from a moderation link opened here (lib/links.ts).
//
// A wall runs a method (PLAN-METHODEN.md): the steps of its agenda, which its state names at the top („Schritt 1 von
// 4: Ideen schreiben“), with what to do now, the next step, and the method with its short description. The
// moderation moves on with „Weiter: <next step>“, its primary action where the step has no other, and goes back with
// „Zurück“ under „Mehr“; going back never hides. „Still sammeln“ starts with hidden writing: everyone sees their own
// notes and how many the others have written, the state says so, and the moderation reveals, for good („Weiter:
// Aufdecken“, which asks first). In a writing step the moderation can set a clock; everybody reads the time left at
// the wall's top and in the tab's title (lib/clock.ts). A „Freie Wand“ has one step, and every note is there for
// everyone at once.
//
// Once the notes are revealed the moderation's primary action is „Ordnen“ (PLAN.md 4.3): the AI proposes groups, the
// proposal stands on the wall as a preview in the moderation's browser alone, and „Anwenden“ makes it the wall's for
// everyone, „Verwerfen“ lets it go (store/arrange.ts, lib/arrange.ts). The line under the action says where it is
// computed, before anything is sent. The last arrangement can be taken back: at once while nothing has changed
// since, after a question once something has.
//
// With a key of its own (PLAN.md 4.5, „Eigener KI-Schlüssel“ in „Mehr“, store/key.ts) the moderation's browser asks
// its own provider instead: the line under the action then names that provider, and a quiet line at the wall's top
// says so and how to go back.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { offered, providerOf } from "@ideabeam/arrange";
import {
  extendClock,
  generateHexId,
  MAX_GROUPS,
  MAX_NOTES,
  methodOfStep,
  methodTexts,
  nameInitials,
  self,
  shown,
  stepContextOf,
  stepName,
  stepWidens,
  WALL_DAILY_RUNS,
  WALL_ID_PATTERN,
  type Participant,
  type WallInfo,
} from "@ideabeam/shared";
import { ClockControls } from "../components/ClockControls";
import { CopyKey } from "../components/CopyKey";
import { OwnKeyAsk, providerFacts } from "../components/OwnKeyAsk";
import { QrCode } from "../components/QrCode";
import { Segmented } from "../components/Segmented";
import { Surface, type WallHandle } from "../components/Surface";
import { View } from "../components/View";
import { WallList } from "../components/WallList";
import { useLang } from "../i18n";
import { exportWall, findWall } from "../lib/api";
import { arrangeable, previewOf, undoAsks } from "../lib/arrange";
import { clockLine, useClockTurns } from "../lib/clock";
import { saveText } from "../lib/download";
import { laterDay, clock as timeOfDay, unit } from "../lib/format";
import { guide, summary } from "../lib/guide";
import { checkText, DISPLAY_NAME_MAX, tidy, type TextFault } from "../lib/input";
import { adminLink, wallLink } from "../lib/links";
import { usePaced } from "../lib/paced";
import { rejectKey } from "../lib/rejected";
import { firstView, storeView, type WallView } from "../lib/wall-view";
import { ActionZone } from "../sebaro/react/ActionZone";
import { Dialog } from "../sebaro/react/Dialog";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";
import { Status } from "../sebaro/react/Status";
import { useArrange } from "../store/arrange";
import { useOwnKey } from "../store/key";
import { useToast } from "../store/toast";
import { useWall, type Refusal, type Rejected } from "../store/wall";
import { useWalls } from "../store/walls";

const START = "/";

/** What the app knows about the address: still asking, no such wall, the request failed, or the wall. */
type Found = { is: "asking" } | { is: "unknown" } | { is: "failed" } | { is: "found"; wall: WallInfo };

export default function Wall() {
  const { id = "" } = useParams();
  // A wall's address is its capability: no search index may list one that was posted in public. The host says
  // so in a header (static/_headers); this tag is the half for a crawler that runs the script.
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.append(tag);
    return () => tag.remove();
  }, []);
  // another address is another wall: nothing of the last one stays
  return <WallAt key={id} wallId={id} />;
}

function WallAt({ wallId }: { wallId: string }) {
  const { t } = useTranslation();
  const wellFormed = WALL_ID_PATTERN.test(wallId);
  const [found, setFound] = useState<Found>(wellFormed ? { is: "asking" } : { is: "unknown" });
  const [attempt, setAttempt] = useState(0);
  const as = useWalls((state) => state.walls.find((wall) => wall.id === wallId)?.as);
  const live = useWall();
  const mine = live.wallId === wallId;

  // does the wall exist?
  useEffect(() => {
    if (!wellFormed) return;
    let current = true;
    void findWall(wallId).then((result) => {
      if (!current) return;
      if (result.ok) setFound({ is: "found", wall: result.wall });
      else {
        setFound({ is: result.why });
        if (result.why === "unknown") useWalls.getState().forget(wallId);
      }
    });
    return () => {
      current = false;
    };
  }, [wallId, wellFormed, attempt]);

  // leaving the view leaves the wall
  useEffect(() => () => useWall.getState().leave(), [wallId]);

  // a browser that was on this wall before goes back on under its name, as the same person
  const exists = found.is === "found";
  useEffect(() => {
    if (!exists || as === undefined) return;
    const wall = useWall.getState();
    if (wall.wallId !== wallId) wall.enter(wallId, as);
  }, [exists, wallId, as]);

  // What stands at this address now. It changes while the address stays: asking, then the door or the wall, perhaps
  // the wall's end. Each time the view is another one, and its heading takes the focus, as after a navigation; the
  // first one took it from Shell, or, on the page's first load, leaves it to the browser.
  const joining = mine && live.refusal === null && !live.state.wall;
  const stage =
    found.is !== "found"
      ? found.is
      : mine && live.state.deleted
        ? "deleted"
        : mine && live.erased
          ? "erased"
          : mine && live.state.wall
            ? "on"
            : joining && as !== undefined
              ? "opening"
              : "door";
  const shown = useRef(stage);
  useLayoutEffect(() => {
    if (shown.current === stage) return;
    shown.current = stage;
    document.querySelector<HTMLElement>("[data-sb-view] h1")?.focus();
  }, [stage]);

  if (found.is === "asking") return <Opening />;
  if (found.is === "unknown") {
    return (
      <View name="wand" type="state-error" title={t("wall.unknownTitle")} back={START} noPrimary>
        <div className="sb-container">
          <p>{t("wall.unknownText")}</p>
        </div>
      </View>
    );
  }
  if (found.is === "failed") {
    const again = () => {
      setFound({ is: "asking" });
      setAttempt(attempt + 1);
    };
    return (
      <View
        name="wand"
        type="state-error"
        title={t("wall.title")}
        back={START}
        zone={
          <ActionZone>
            <button className="sb-primary-action" type="button" onClick={again}>
              <span className="sb-primary-action__label">{t("common.retry")}</span>
            </button>
          </ActionZone>
        }
      >
        <div className="sb-container">
          <p>{t("wall.failedText")}</p>
        </div>
      </View>
    );
  }

  if (stage === "deleted") {
    return (
      <View name="wand" type="state-error" title={t("wall.deletedTitle")} back={START} noPrimary>
        <div className="sb-container">
          <p>{t("wall.deletedText")}</p>
        </div>
      </View>
    );
  }
  // „Meine Angaben löschen“: the wall has forgotten this person, and this browser the wall
  if (stage === "erased") {
    return (
      <View name="wand" type="state-error" title={t("wall.erasedTitle")} back={START} noPrimary>
        <div className="sb-container">
          <p>{t("wall.erasedText")}</p>
        </div>
      </View>
    );
  }
  // on the wall: the first `sync` of this visit has arrived
  if (stage === "on") return <OnWall wallId={wallId} />;
  // on the way, as somebody the wall knows
  if (stage === "opening") return <Opening />;
  // new here, or not let on. The door stays while the wall is asked, so the name typed stays too
  return (
    <Door
      wall={found.wall}
      refusal={mine ? live.refusal : null}
      busy={joining}
      onJoin={(name) => useWall.getState().enter(wallId, name)}
    />
  );
}

/** Remote work that may take more than a moment says so where its result will stand. */
function Opening() {
  const { t } = useTranslation();
  return (
    <View name="wand" type="state-loading" title={t("wall.title")} back={START} noPrimary>
      <div className="sb-container">
        <p role="status">{t("wall.opening")}</p>
      </div>
    </View>
  );
}

const FIELD = "app-f-as";

/** The wall's door: its question is the heading, and the one thing asked is the name to join with. */
function Door(props: { wall: WallInfo; refusal: Refusal | null; busy: boolean; onJoin(name: string): void }) {
  const { t } = useTranslation();
  const { wall, refusal, busy, onJoin } = props;
  const [as, setAs] = useState(useWalls.getState().displayName);
  const [fault, setFault] = useState<TextFault>();
  // the name the wall refused: its sentence stands until another name is typed
  const [sent, setSent] = useState("");
  const taken = refusal === "NAME_TAKEN" && tidy(as) === sent;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = checkText(as, DISPLAY_NAME_MAX);
    setFault(found);
    if (found) {
      document.getElementById(FIELD)?.focus();
      return;
    }
    setSent(tidy(as));
    onJoin(tidy(as));
  };
  // the wall said no: the focus goes to the field the answer is about
  useEffect(() => {
    if (refusal === "NAME_TAKEN") document.getElementById(FIELD)?.focus();
  }, [refusal]);

  const label = t("common.yourName");
  const error =
    fault === "missing"
      ? t("common.missing", { label })
      : fault === "tooLong"
        ? t("common.tooLong", { label, max: DISPLAY_NAME_MAX })
        : taken
          ? t("join.taken")
          : undefined;

  return (
    <View name="beitreten" type="form" title={wall.question} back={START}>
      <div className="sb-container">
        <form className="sb-form-grid" id="app-form" aria-label={t("join.title")} noValidate onSubmit={onSubmit}>
          <Field id={FIELD} label={label} help={t("common.yourNameHelp")} error={error}>
            {(control) => (
              <input
                {...control}
                type="text"
                autoComplete="nickname"
                required
                value={as}
                onChange={(e) => {
                  setAs(e.target.value);
                  setFault(undefined);
                }}
              />
            )}
          </Field>
          <div className="sb-form-grid__actions">
            {/* the reason of a refusal that is no field's: a line of its own in the action's row, right before it */}
            <p className="sb-form-grid__message" role="alert">
              {refusal === "WALL_FULL" && (
                <>
                  <Icon name="error--filled-16" size={16} />
                  {t("join.full")}
                </>
              )}
            </p>
            <button
              className="sb-primary-action"
              type="submit"
              aria-busy={busy || undefined}
              data-sb-progress={busy ? "indeterminate" : undefined}
            >
              <span className="sb-primary-action__label">
                {t(busy ? "join.joining" : refusal === "WALL_FULL" ? "common.retry" : "join.title")}
              </span>
              <i className="sb-primary-action__bar" aria-hidden="true" />
            </button>
          </div>
          <p className="sb-action-hint sb-form-grid__wide">{t("common.toServer")}</p>
        </form>
      </div>
    </View>
  );
}

function Person({ person, you }: { person: Participant; you: boolean }) {
  const { t } = useTranslation();
  const admin = person.role === "admin";
  return (
    <li className="sb-list-row">
      <span className="sb-list-row__lead">
        {/* the avatar's ring and shield repeat for the eye what the row says in words */}
        <span
          className="sb-avatar sb-avatar--32"
          aria-hidden="true"
          data-sb-presence={person.online ? undefined : "offline"}
        >
          {nameInitials(person.name)}
          {admin && <Icon name="shield--16" size={16} className="sb-avatar__role" />}
        </span>
      </span>
      <div className="sb-list-row__main">
        <p className="sb-list-row__title">
          {person.name}
          {you && <> {t("wall.you")}</>}
        </p>
        {admin && <p className="sb-list-row__meta">{t("wall.admin")}</p>}
      </div>
      <span className="sb-list-row__trail">
        {person.online ? (
          <Status tone="success" icon="success--16" small>
            {t("wall.here")}
          </Status>
        ) : (
          <Status tone="neutral" icon="pending--16" small>
            {t("wall.away")}
          </Status>
        )}
      </span>
    </li>
  );
}

// below this width the people stand under the surface, behind their heading; from it on, beside the surface
const NARROW = "(max-width: 63.99rem)";

/** While the AI arranges: one sentence that says what happens, and how long it has taken so far. Both stand once the
 *  answer has taken a second (a run that is refused answers at once, and never worked), the sentence as large as the
 *  state. It is said to a screen reader once, when it appears; the seconds are read, not announced. No steps and no
 *  bar: the Worker answers once, when the whole run is over, and the app knows nothing in between. `provider`: the
 *  moderation's own, by its name, where its key is asked with. */
function Waiting(props: { since: number; notes: number; provider: string | null; say(sentence: string): void }) {
  const { since, notes, provider, say } = props;
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [since]);
  // with the moderation's own key the sentence names its provider, and says nothing of how long: that is measured
  // for Cloudflare alone
  const sentence =
    provider === null
      ? t("arrange.runningState", { count: notes })
      : t("arrange.runningStateKey", { count: notes, provider });
  const shows = seconds >= 1;
  useEffect(() => {
    if (shows) say(sentence);
  }, [shows, sentence, say]);
  if (!shows) return null;
  return (
    <>
      <p className="app-state__clock">{sentence}</p>
      <p className="app-state__note sb-num">{t("arrange.elapsed", { count: seconds })}</p>
    </>
  );
}

function OnWall({ wallId }: { wallId: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const { state, status, outdated, rejected, skew, now, arranged } = useWall();
  // the store's actions: they are the same functions as long as the app runs
  const { look, deleteWall, erase, send, goStep, setClock, dismissRejected } = useWall.getState();
  const adminToken = useWalls((walls) => walls.adminTokens[wallId]);
  // the session key this browser joined the wall with: it says who asks for the wall as a file
  const sessionKey = useWalls((walls) => walls.walls.find((wall) => wall.id === wallId)?.sessionKey);
  // „Ordnen“ as it stands in this browser: asked, a proposal as a preview, on its way to the wall
  const { arranging, runsLeft } = useArrange();
  // the moderation's own key, in this tab's memory alone, and the providers this tab offers for one
  const { own, unlocked } = useOwnKey();
  const providers = offered(unlocked);
  const keyOf = own === null ? null : providerOf(own.provider);
  // the dialog that asks first: deleting the wall, having the wall forget oneself, revealing the notes, or taking
  // an arrangement back once the wall has changed since; the dialog of the moderation's own key; and the one that
  // shows the wall's link as a QR code
  const [asking, setAsking] = useState<"delete" | "erase" | "reveal" | "undo" | "key" | "qr" | null>(null);
  // The wall as its surface or as its list: the browser's choice, else the list in a narrow window (lib/wall-view.ts).
  // Either one answers the wall's two actions, „Neuer Zettel“ and „Neue Gruppe“.
  const [mode, setMode] = useState<WallView>(firstView);
  const shownAs = useRef<WallHandle>(null);
  // what the surface or the list says to a screen reader about the person's own doing: a note put down, notes
  // moved into a group, a selection
  const [said, setSaid] = useState("");
  // the people: open beside the surface, behind their heading under it
  const [listed, setListed] = useState(() => !window.matchMedia(NARROW).matches);
  useEffect(() => {
    const narrow = window.matchMedia(NARROW);
    const follow = () => setListed(!narrow.matches);
    narrow.addEventListener?.("change", follow);
    return () => narrow.removeEventListener?.("change", follow);
  }, []);

  const me = self(state);
  const admin = me?.role === "admin";
  const question = state.wall?.question ?? "";
  // The wall as this browser shows it. While a proposal of the AI stands (or is on its way to the wall), that is the
  // wall with the proposal laid over it, worked out anew from whatever the wall holds: nobody else sees it, and
  // what the others change meanwhile arrives underneath (lib/arrange.ts).
  const stored = shown(state);
  const proposed = arranging.is === "preview" || arranging.is === "applying" ? arranging : null;
  const preview = useMemo(
    () => (proposed === null ? null : previewOf(stored, proposed.proposal, proposed.groupIds)),
    [stored, proposed],
  );
  const { notes, groups } = preview?.content ?? stored;
  // the moderation waits for a proposal or looks at one: its own changing of the wall rests
  const paused = arranging.is !== "idle";
  const link = wallLink(location.origin, wallId);
  // Where the wall stands in its agenda: what the step allows, and what is seen of the others' notes (packages/shared,
  // domain/flow.ts). While the notes are hidden this browser holds its own notes alone; of the others' it knows how
  // many there are, and nothing else.
  const step = stepContextOf(state);
  const writing = step.sight !== "all";
  const steps = state.agenda?.steps ?? [];
  const methodId = state.agenda === null ? null : methodOfStep(state.agenda, state.step);
  const method = methodId === null ? null : methodTexts(lang, methodId);
  /** a step's name, in the words of its own method */
  const nameOf = (at: number) =>
    state.agenda === null || steps[at] === undefined
      ? ""
      : stepName(lang, methodOfStep(state.agenda, at), steps[at].key);
  const nextStep = state.step + 1 < steps.length ? state.step + 1 : null;
  const backStep = state.step > 0 && state.step - 1 < steps.length ? state.step - 1 : null;
  // the next step shows the notes that are hidden now: moving there is revealing, and asks first
  const nextReveals = nextStep !== null && state.agenda !== null && stepWidens(state.agenda, state, nextStep);
  // „Weiter: <next step>“: where it would reveal, it asks first; any other step move acts at once
  const goNext = () => {
    if (nextStep === null) return;
    if (nextReveals) setAsking("reveal");
    else goStep(nextStep);
  };
  const total = notes.length + state.hidden;
  // The clock of the writing: what is left at the worker's time as this browser reckons it. The browser counts: it
  // looks again whenever the minute turns.
  useClockTurns(state.clock, skew, look);
  const time = clockLine(state.clock, now);

  // The wall moved to another step while this browser was on it: said once. Where the notes were revealed with it,
  // that is said, for all of them (PLAN.md 3.7), and a question about revealing that still stood is answered.
  const [was, setWas] = useState({ step: state.step, sight: step.sight });
  if (was.step !== state.step || was.sight !== step.sight) {
    setWas({ step: state.step, sight: step.sight });
    if (was.sight !== "all" && step.sight === "all") {
      setSaid(notes.length === 0 ? t("wall.revealedNone") : t("wall.revealed", { count: notes.length }));
    } else if (was.step !== state.step) {
      setSaid(t("wall.step.said", { n: state.step + 1, of: steps.length, name: nameOf(state.step) }));
    }
    if (asking === "reveal") setAsking(null);
  }
  // The wall was arranged, or an arrangement was taken back, while this browser was on it: said once, for the whole
  // of it (PLAN.md 3.7: „Geordnet: 7 Gruppen.“), to everybody.
  const [run, setRun] = useState(state.arrangeRun);
  if (run !== state.arrangeRun) {
    setRun(state.arrangeRun);
    setSaid(state.arrangeRun === null ? t("arrange.saidUndone") : t("arrange.saidApplied", { count: groups.length }));
    if (state.arrangeRun === null && asking === "undo") setAsking(null);
  }
  // Taking the last arrangement back is the moderation's. Right after the run it loses nothing and acts at once;
  // once the wall has changed since, it asks first (lib/arrange.ts).
  const undoable = admin && step.can.arrange && !paused && state.arrangeRun !== null;
  const undoAsksFirst = undoAsks(state, arranged);
  const undo = () => {
    if (state.arrangeRun === null) return;
    send({ type: "admin.arrange.undo", opId: generateHexId(), runId: state.arrangeRun });
  };
  // the notes that stay on the wall without a name when this person has the wall forget them
  const ownNotes = me === null ? 0 : notes.filter((note) => note.mine).length;

  // How the wall stands: what is wrong with the line, or how many notes lie on it and how many people are here.
  // Notes arrive in bursts, and the sentence is a live region: a change shows at once, what follows in the next
  // moment shows together, so a burst is said in a sentence or two (lib/paced.ts). The numbers are paced, not the
  // words: another language shows at once.
  const here = state.participants.filter((person) => person.online).length;
  const line = outdated ? "outdated" : status !== "online" ? "reconnecting" : "online";
  // a note counts as lying in a group while that group is on the wall
  const framed = new Set(groups.map((group) => group.id));
  const inGroups = notes.filter((note) => note.groupId !== null && framed.has(note.groupId)).length;
  const unnamed = groups.filter((group) => group.title === "").length;
  // how many notes the AI may arrange: those in no group a person made by hand or renamed
  const free = useMemo(() => arrangeable({ notes, groups }), [notes, groups]);
  const [stood, count, present, known, frames, sorted, untitled, open] = usePaced(
    [line, total, here, state.participants.length, groups.length, inGroups, unnamed, free].join(" "),
  ).split(" ");
  // the phase, the clock and whether the wall was arranged are not paced: what the wall offers changes with them at
  // once
  const standing = {
    admin,
    notes: Number(count),
    people: Number(known),
    groups: Number(frames),
    grouped: Number(sorted),
    untitled: Number(untitled),
    hidden: writing,
    step: steps[state.step]?.type,
    timeUp: time?.is === "over",
    arrangeable: Number(open),
    arranged: state.arrangeRun === null ? null : undoAsksFirst ? ("changed" as const) : ("fresh" as const),
  };
  // the first half of the state sentence: how many notes, and once the wall has groups, what the groups hold
  const noteCount = t("wall.noteCount", { count: standing.notes });
  const groupCount = t("wall.groupCount", { count: standing.groups });
  const emptyGroups = t("wall.emptyGroupCount", { count: standing.groups });
  const holds = {
    none: t("wall.noNotes"),
    plain: t("wall.notes", { count: standing.notes }),
    allGrouped: t("wall.allGrouped", { notes: noteCount, groups: groupCount }),
    someGrouped: t("wall.someGrouped", { notes: noteCount, grouped: standing.grouped, groups: groupCount }),
    noneGrouped: t("wall.noneGrouped", { notes: noteCount, groups: emptyGroups }),
    noNotesGroups: t("wall.noNotesGroups", { groups: emptyGroups }),
    hiddenNone: t("wall.hiddenNone"),
    hiddenNotes: t("wall.hiddenNotes", { count: standing.notes }),
  }[summary(standing)];
  // A proposal stands: the state says so, with its numbers, and that nobody else sees it. It takes the place of the
  // wall's own sentence, which would count groups that are on no wall yet.
  const proposal =
    preview === null
      ? null
      : t(preview.loose > 0 ? "arrange.proposalLoose" : "arrange.proposal", {
          groups: t("wall.groupCount", { count: preview.groups }),
          loose: t("wall.noteCount", { count: preview.loose }),
        });
  const trouble = stood === "outdated" ? t("wall.outdated") : stood === "reconnecting" ? t("wall.reconnecting") : null;
  const sentence =
    trouble ?? proposal ?? t("wall.summary", { notes: holds, people: t("wall.count", { count: Number(present) }) });
  // after a run: how many runs 24 hours allow a wall and how many of them this one has left now, said to the
  // moderation in a quiet line
  const runs =
    // (not with the moderation's own key: such a run is none of the wall's)
    !admin || runsLeft === null || arranging.is === "running" || own !== null
      ? null
      : runsLeft > 0
        ? t("arrange.runsLeft", { count: runsLeft, runs: WALL_DAILY_RUNS })
        : t("arrange.runsNone", { runs: WALL_DAILY_RUNS });
  // The time left as a sentence in whole minutes, and the same, shorter, as the tab's title: the minutes first, so
  // they stay readable in a narrow tab. No bar, no seconds, no sound (sebaro „Collaboration“).
  const timeSentence =
    time === null
      ? ""
      : time.is === "over"
        ? t("wall.clock.over")
        : t(`wall.clock.${time.is}`, { count: time.minutes });
  const tab =
    time === null
      ? undefined
      : time.is === "left"
        ? t("wall.clock.tab.left", { left: unit(lang, time.minutes, t("wall.clock.min")), question })
        : t(`wall.clock.tab.${time.is}`, { question });

  // The moderation link is copied from the menu, where no key stays to say „Kopiert“: the one toast without
  // „Rückgängig“. It says what the link is good for.
  const copyAdminLink = (token: string) => {
    const say = useToast.getState().show;
    navigator.clipboard.writeText(adminLink(location.origin, wallId, token)).then(
      () => say(t("wall.adminLinkCopied")),
      () => say(t("wall.copyFailed")),
    );
  };

  // „Als Markdown sichern“ (PLAN.md 2.1): the wall as this person may see it, fetched from the Worker through the same
  // filter as the snapshot, and handed to the browser as a file made here (lib/download.ts), which works on a phone
  // too. Past a second the key says it is busy (sebaro: remote work over 1 s says so); a failure is said in a toast,
  // as a copy from the menu is, since the menu keeps no key to say it in.
  const [saving, setSaving] = useState<"no" | "quiet" | "busy">("no");
  const saveMarkdown = () => {
    if (saving !== "no") return;
    const say = useToast.getState().show;
    if (sessionKey === undefined) return say(t("wall.exportStranger"));
    setSaving("quiet");
    const busy = window.setTimeout(() => setSaving((now) => (now === "quiet" ? "busy" : now)), 1000);
    void exportWall(wallId, sessionKey, lang).then((exported) => {
      window.clearTimeout(busy);
      setSaving("no");
      if (exported.ok) {
        saveText(exported.fileName, exported.text);
        setSaid(t("wall.exported", { name: exported.fileName }));
      } else say(t(exported.why === "stranger" ? "wall.exportStranger" : "wall.exportFailed"));
    });
  };

  const refuse = useCallback((refused: Rejected) => useWall.setState({ rejected: refused }), []);
  // the sentence of a change that was not taken, or of „Ordnen“ that gave no proposal; a full wall names the limit
  // that was met, a wall whose day is spent the time of this device's clock at which it goes on, too few notes how
  // many it takes
  const problemKey = rejected === null ? null : rejectKey(rejected);
  // The AI's budget and a wall's runs go on within 24 hours, at any time of day: the sentence names the time of
  // this device's clock and says „morgen“ where that lies on the next day
  const resumes =
    rejected?.command !== "arrange" || rejected.resetsAt === undefined
      ? ""
      : t(laterDay(rejected.resetsAt, rejected.at ?? rejected.resetsAt) ? "reject.whenTomorrow" : "reject.whenToday", {
          time: timeOfDay(lang, rejected.resetsAt),
        });
  const problem =
    rejected === null || problemKey === null
      ? null
      : t(`reject.${problemKey}`, {
          max: problemKey === "limitGroups" ? MAX_GROUPS : MAX_NOTES,
          time: !("resetsAt" in rejected) || rejected.resetsAt === undefined ? "" : timeOfDay(lang, rejected.resetsAt),
          when: resumes,
          min: "min" in rejected ? rejected.min : undefined,
          runs: WALL_DAILY_RUNS,
          // the moderation's own provider, by its name: nothing else of what it answered enters a sentence
          provider: rejected.command === "arrange.key" ? providerOf(rejected.provider).name : undefined,
        });
  // A run with the moderation's own key that gave no proposal: its sentence is brought into view, above the action
  // zone. On a phone the wall's top takes most of the window, the key that was pressed stands at its bottom, and
  // these sentences are long: without this their end lies under the zone.
  const keyProblem = rejected?.command === "arrange.key" ? problem : null;
  useEffect(() => {
    if (keyProblem === null) return;
    // The zone changes its height in the same moment („Ordnen läuft …“ becomes „Ordnen“ with its lines), and the
    // page learns the room it has to keep free above it only after the next layout (View.tsx): two frames on
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        document.querySelector(".app-surface__problem")?.scrollIntoView({ block: "nearest" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [keyProblem]);
  const choose = (next: WallView) => {
    storeView(next);
    setMode(next);
  };
  // „Ordnen“ is the moderation's, once the notes are revealed: its zone is the zone of arranging from then on, also
  // on a wall that is still empty, as „Aufdecken“ is the zone's action before. So the zone has one height whatever
  // lies on the wall, and the surface above it does not jump when the first note arrives.
  const arranges = admin && step.can.arrange;
  const { ask, askWithKey, cancel, discard, apply } = useArrange.getState();
  const startArranging = () => {
    // what was said last is put away: the same sentence said again is heard again
    setSaid("");
    // with a key of its own the moderation's browser asks its provider, and the Worker is not asked at all
    if (own !== null) askWithKey(wallId, own, lang);
    // The request carries the admin token. A browser that moderates and no longer holds it (the wall was taken out
    // of this device's list in another tab) cannot ask, and says so
    else if (adminToken !== undefined) ask(wallId, adminToken, lang);
    else useWall.setState({ rejected: { code: "NOT_ADMIN", command: "arrange" } });
  };
  // the provider a run that is out asks: the moderation's own, or none: the Worker asks
  const asked = arranging.is === "running" && arranging.provider !== null ? providerOf(arranging.provider).name : null;
  const cancelArranging = () => {
    cancel();
    setSaid(asked === null ? t("arrange.saidCancelled") : t("arrange.saidCancelledKey", { provider: asked }));
  };
  const discardProposal = () => {
    // everything goes back to where it lay, and the view to where it looked
    shownAs.current?.lookBack();
    discard();
    setSaid(t("arrange.saidDiscarded"));
  };
  // The preview opens: the view shows the proposal whole, „Alles zeigen“ of what it places, and remembers where it
  // looked before. „Anwenden“ is through: the zone under the wall has another height by then, and the surface with
  // it, so the arrangement is shown whole once more. On this device alone: nobody else's view is moved.
  const previewing = preview !== null;
  const bounds = preview?.bounds ?? null;
  const placed = useRef<{ box: typeof bounds; looked: boolean; was: typeof arranging.is }>({
    box: null,
    looked: false,
    was: arranging.is,
  });
  useLayoutEffect(() => {
    const before = placed.current;
    const looked = previewing && (before.looked || bounds !== null);
    placed.current = { box: previewing ? bounds : before.box, looked, was: arranging.is };
    if (previewing && !before.looked && bounds !== null) shownAs.current?.lookAt(bounds, true);
    else if (before.was === "applying" && arranging.is === "idle" && before.box !== null) {
      shownAs.current?.lookAt(before.box, false);
    }
  }, [previewing, bounds, arranging.is]);
  // What the surface glides for: another arrangement on the wall, and the preview of one in this browser.
  const motion = `${state.arrangeRun ?? ""}:${previewing ? "preview" : ""}`;
  // The zone's actions change under the focus: „Ordnen“ becomes „Anwenden“ in the same place, a key goes when its
  // time is over. Whether the focus stands in the zone is read here, before the change; afterwards it is put where
  // the next step is. After „Anwenden“ that is the wall itself, which the action changed: a key pressed twice must
  // not start the next run. Where the key that had the focus is gone, it is the zone's primary action.
  const zoneNow = `${arranging.is}:${undoable && !undoAsksFirst}`;
  const focusInZone = document.activeElement?.closest(".sb-bottom-block") != null;
  const zoneWas = useRef({ zone: zoneNow, is: arranging.is });
  useLayoutEffect(() => {
    const before = zoneWas.current;
    zoneWas.current = { zone: zoneNow, is: arranging.is };
    if (before.zone === zoneNow || !focusInZone) return;
    const active = document.activeElement;
    const gone = active === null || active === document.body || !active.isConnected;
    if (before.is === "applying" && arranging.is === "idle") shownAs.current?.focus();
    else if (gone) document.querySelector<HTMLElement>(".sb-bottom-block .sb-primary-action")?.focus();
    // only when the zone's actions have changed: `focusInZone` is the reading of that render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneNow]);
  // what both ways of looking at the wall get: the same notes and groups, and the same way to change them
  const wall = me !== null && {
    ref: shownAs,
    notes,
    groups,
    // how many notes of the others are hidden from this browser, or null: the wall is revealed
    hidden: writing ? state.hidden : null,
    you: me,
    send,
    problem,
    onRefuse: refuse,
    onDismiss: dismissRejected,
    say: setSaid,
    paused,
    motion,
  };

  // The wall's tools stand in its head, out of the content's way: the link as a key, and in „Mehr“ what belongs to
  // the moderation. Only a browser that holds the token can hand it on; what deletes stands last, after a line.
  // the clock's controls are the moderation's, in a writing step
  const clocked = admin && step.can.clock && stood !== "outdated";

  // The wall's primary action stands in the zone above the footer, with the line that says where a note goes. It is
  // everyone's: „Neuer Zettel“. In a step that does not arrange the moderation's next step is the next step of the
  // method, and so is its primary action: „Weiter: <next step>“ („Weiter: Aufdecken“ while the notes are hidden);
  // „Neuer Zettel“ stays beside it as the zone's second action. In a step that arranges the moderation's next step
  // is „Ordnen“, with „Neuer Zettel“ beside it in the same way, and „Weiter“ stands in the state above. While the AI is
  // asked the zone holds the waiting and „Abbrechen“, while a proposal stands „Anwenden“ and „Verwerfen“: always one
  // primary action and at most one with an outline. The two keys keep their places through all of it, so the focus
  // stays where it is.
  const compose = () => shownAs.current?.compose();
  const applying = arranging.is === "applying";
  const waiting = arranging.is === "running";
  // the zone's second key: „Neuer Zettel“, then „Abbrechen“, then „Verwerfen“
  const secondWord = waiting ? t("common.cancel") : previewing ? t("common.discard") : t("note.new");
  const pressSecond = waiting ? cancelArranging : previewing ? discardProposal : compose;
  // its primary key: „Ordnen“, which shows its own progress while the AI is asked, then „Anwenden“, which shows its
  // own while the proposal is on its way to the wall
  const firstBusy = waiting || applying;
  const firstWord = previewing
    ? t(applying ? "arrange.applying" : "arrange.apply")
    : t(waiting ? "arrange.running" : "arrange.start");
  const pressFirst = previewing ? apply : startArranging;
  return (
    <View
      name="wand"
      wall
      wide
      type={mode === "list" ? "list" : "tool"}
      title={question}
      tab={tab}
      tools={<CopyKey quiet word={t("wall.copyLink")} text={link} />}
      more={{
        first: [
          // the moderation's way back to the step before: nothing that was shown is hidden again
          ...(admin && backStep !== null
            ? [
                {
                  id: "app-more-back",
                  label: t("wall.step.back", { name: nameOf(backStep) }),
                  onPress: () => goStep(backStep),
                },
              ]
            : []),
          ...(admin && adminToken !== undefined
            ? [{ id: "app-more-adminlink", label: t("wall.copyAdminLink"), onPress: () => copyAdminLink(adminToken) }]
            : []),
          // the moderation's own key: offered once a provider's model is measured, or in a tab that was told to
          // (lib/key-switch.ts)
          ...(admin && providers.length > 0
            ? [{ id: "app-more-key", label: t("key.entry"), onPress: () => setAsking("key") }]
            : []),
          // everybody's: the wall's link as a code to scan, and the wall as a file, at any time (while the notes are
          // hidden, a person's own notes)
          { id: "app-more-qr", label: t("wall.qrShow"), onPress: () => setAsking("qr") },
          { id: "app-more-export", label: t("wall.export"), onPress: saveMarkdown },
        ],
        last: [
          // Taking the arrangement back once the wall has changed since loses what was done since: it stands here,
          // with what deletes, and asks first. Right after the run it stands in the action zone and acts at once.
          ...(undoable && undoAsksFirst
            ? [{ id: "app-more-undo", label: t("arrange.undoName"), danger: true, onPress: () => setAsking("undo") }]
            : []),
          { id: "app-more-erase", label: t("wall.erase"), danger: true, onPress: () => setAsking("erase") },
          ...(admin
            ? [{ id: "app-more-delete", label: t("wall.delete"), danger: true, onPress: () => setAsking("delete") }]
            : []),
        ],
      }}
      zone={
        arranges ? (
          <ActionZone>
            <div className="app-zone-actions">
              {/* right after an arrangement, while nothing has changed since: taking it back loses nothing. A quiet
                  third key; on a phone its icon alone, so the three stand in one row */}
              {undoable && !undoAsksFirst && (
                <button
                  key="undo"
                  className="sb-text-action app-tool"
                  type="button"
                  aria-label={t("arrange.undoName")}
                  onClick={() => {
                    undo();
                    // the key goes with the arrangement: the wall, which it changes, takes the focus
                    shownAs.current?.focus();
                  }}
                >
                  <Icon name="undo" />
                  <span className="app-tool__word">{t("common.undo")}</span>
                </button>
              )}
              <button key="second" className="sb-secondary-action" type="button" onClick={pressSecond}>
                {!paused && <Icon name="plus" />}
                {secondWord}
              </button>
              <button
                key="first"
                className="sb-primary-action"
                type="button"
                aria-busy={firstBusy || undefined}
                data-sb-progress={firstBusy ? "indeterminate" : undefined}
                onClick={firstBusy ? undefined : pressFirst}
              >
                <span className="sb-primary-action__label">{firstWord}</span>
                <i className="sb-primary-action__bar" aria-hidden="true" />
              </button>
            </div>
            {/* where it goes, under the action that sends it. Before the moderation arranges: where it is computed
                (PLAN.md 4.2), with the way to the privacy notice's section on it */}
            {waiting ? (
              <p className="sb-action-hint">
                {asked === null
                  ? t("arrange.cancelHint", { runs: WALL_DAILY_RUNS })
                  : t("arrange.cancelHintKey", { provider: asked })}
              </p>
            ) : previewing ? (
              <p className="sb-action-hint">{t("arrange.applyHint")}</p>
            ) : (
              <>
                <p className="sb-action-hint">
                  {keyOf === null ? (
                    <Trans i18nKey="arrange.where" components={{ privacy: <Link to="/datenschutz#ordnen" /> }} />
                  ) : (
                    // with the moderation's own key: its provider, and what that provider does with the notes
                    <Trans
                      i18nKey="arrange.whereKey"
                      values={{ provider: keyOf.name, facts: providerFacts(t, keyOf) }}
                      components={{ privacy: <Link to="/datenschutz#eigener-ki-schluessel" /> }}
                    />
                  )}
                </p>
                <p className="sb-action-hint">{t("arrange.whereNote")}</p>
              </>
            )}
          </ActionZone>
        ) : (
          <ActionZone hint={t(writing ? "common.toServerHidden" : "common.toServer")}>
            {admin && nextStep !== null ? (
              <div className="app-zone-actions">
                <button className="sb-secondary-action" type="button" onClick={compose}>
                  <Icon name="plus" />
                  {t("note.new")}
                </button>
                <button className="sb-primary-action" type="button" onClick={goNext}>
                  <Icon name={nextReveals ? "eye" : "arrow-right"} />
                  <span className="sb-primary-action__label">{t("wall.step.forward", { name: nameOf(nextStep) })}</span>
                </button>
              </div>
            ) : (
              <button className="sb-primary-action" type="button" onClick={compose}>
                <Icon name="plus" />
                <span className="sb-primary-action__label">{t("note.new")}</span>
              </button>
            )}
          </ActionZone>
        )
      }
    >
      {/* the state of the wall, large: how many notes in how many groups, who is here, or what is wrong with the
          connection; under it what to do now, a sentence per role (lib/guide.ts). Beside it, under it on a phone:
          for the moderation of a hidden wall the clock's controls, how the wall is looked at, and the wall's second
          action, „Neue Gruppe“ */}
      <div className="app-wall-top">
        <section className="app-state" aria-label={t("wall.state")}>
          {/* where the wall stands in its method: step x of y, its name and the step after it. A method of one step
              has no steps to count */}
          {steps.length > 1 && (
            <p className="app-state__step">
              {nextStep !== null
                ? t("wall.step.positionNext", {
                    n: state.step + 1,
                    of: steps.length,
                    name: nameOf(state.step),
                    next: nameOf(nextStep),
                  })
                : t("wall.step.positionLast", { n: state.step + 1, of: steps.length, name: nameOf(state.step) })}
            </p>
          )}
          <p className="app-state__sentence" role="status">
            {sentence}
          </p>
          {stood !== "outdated" && (
            <>
              {/* the clock of the writing, as large as the state: said when the minute turns. The region is there
                  before its sentence, so a clock that starts is said too */}
              {step.can.clock && (
                <p className="app-state__clock" role="status">
                  {timeSentence}
                </p>
              )}
              {arranging.is === "running" ? (
                // the AI is asked: what happens, and for how long by now
                <Waiting since={arranging.since} notes={arranging.notes} provider={asked} say={setSaid} />
              ) : preview !== null ? (
                <>
                  {/* a connection that is cut is said first; the proposal stands all the same */}
                  {trouble !== null && <p className="app-state__clock">{proposal}</p>}
                  {proposed?.partial && <p className="app-state__note">{t("arrange.partial")}</p>}
                  <p className="app-state__note">{t("arrange.previewNote")}</p>
                </>
              ) : (
                <>
                  <p className="app-state__note">{t(`wall.guide.${guide(standing)}`)}</p>
                  {/* in a step that arranges, „Ordnen“ is the zone's primary action: the way to the next step
                      stands here */}
                  {arranges && nextStep !== null && !paused && (
                    <div className="app-state__key">
                      <button className="sb-text-action" type="button" onClick={goNext}>
                        <Icon name="arrow-right" />
                        {t("wall.step.forward", { name: nameOf(nextStep) })}
                      </button>
                    </div>
                  )}
                  {state.arrangeRun !== null ? (
                    // The wall is arranged: it is the result now (`result`, docs/ANSICHTEN.md), and what one does
                    // with a result is to keep it. For everybody, right under what to do now; the zone keeps the
                    // wall's own actions (docs/sebaro-luecken.md, A20)
                    <div className="app-state__key">
                      <button
                        className="sb-secondary-action"
                        type="button"
                        aria-busy={saving === "busy" || undefined}
                        onClick={saveMarkdown}
                      >
                        <Icon name="download" />
                        {saving === "busy" ? t("wall.exporting") : t("wall.export")}
                      </button>
                      <p className="sb-action-hint">{t("wall.exportHint")}</p>
                    </div>
                  ) : (
                    // nobody else has come yet: the link the sentence speaks of, to copy right here
                    standing.people <= 1 && (
                      <div className="app-state__key">
                        <CopyKey word={t("wall.copyLink")} text={link} />
                      </div>
                    )
                  )}
                </>
              )}
              {runs !== null && <p className="app-state__note app-muted">{runs}</p>}
              {/* the moderation's own key is set: who „Ordnen“ asks now, and how to go back to Cloudflare. While a
                  run is out or a proposal stands, the state says what goes on, and this line rests */}
              {admin && keyOf !== null && !paused && (
                <p className="app-state__note app-muted">
                  {t("arrange.keyOn", { provider: keyOf.name })}
                  {!keyOf.measured && <> {t("key.unmeasured", { provider: keyOf.name })}</>}
                </p>
              )}
            </>
          )}
        </section>
        <div className="app-wall-bar" data-clock={clocked ? "" : undefined}>
          {/* the clock is the moderation's, and the writing's: once the notes are revealed there is none */}
          {clocked && (
            <ClockControls line={time} canExtend={extendClock(state.clock, now) !== null} onControl={setClock} />
          )}
          <Segmented
            legend={t("wall.view")}
            quiet
            options={[
              { value: "surface", label: t("wall.viewSurface") },
              { value: "list", label: t("wall.viewList") },
            ]}
            value={mode}
            onChange={choose}
          />
          {/* groups come in a step that sorts: while the notes are hidden there are none (PLAN.md 2.1); and none is
              made while the moderation waits for a proposal or looks at one */}
          {step.can.group && !paused && (
            <button className="sb-text-action app-tool" type="button" onClick={() => shownAs.current?.group()}>
              <Icon name="plus" />
              <span>{t("group.new")}</span>
            </button>
          )}
        </div>
      </div>
      {/* the wall's content: the notes and groups as a surface or as a list, and the people beside or under it */}
      <div className="app-wall">
        {wall && (mode === "list" ? <WallList {...wall} /> : <Surface {...wall} />)}
        <section className="app-wall__people" aria-labelledby="app-h-people">
          {/* the method the wall runs, with its short description: never its name alone (PLAN-METHODEN.md 2). It
              stands at the head of the people's column, where it takes none of the surface's height: beside the
              surface on a wide window, under it on a phone */}
          {method !== null && (
            <p className="app-wall__method" data-testid="method">
              {t("wall.step.method", { name: method.name, short: method.short })}
            </p>
          )}
          <details className="app-people" open={listed} onToggle={(event) => setListed(event.currentTarget.open)}>
            <summary className="app-people__head">
              <h2 className="sb-list-header" id="app-h-people">
                {t("wall.people")} <span className="sb-list-header__count">{state.participants.length}</span>
              </h2>
              <Icon name="chevron-down" />
            </summary>
            <ul className="sb-list" aria-labelledby="app-h-people">
              {state.participants.map((person) => (
                <Person key={person.id} person={person} you={person.id === state.you} />
              ))}
            </ul>
          </details>
        </section>
      </div>
      <p className="sb-visually-hidden" role="status">
        {said}
      </p>
      {/* revealing asks first: it cannot be taken back, and afterwards everyone sees every note */}
      <Dialog
        id="app-dlg-reveal"
        open={asking === "reveal" && writing && nextReveals}
        title={t("wall.revealTitle")}
        text={[
          total === 0 ? t("wall.revealTextNone") : t("wall.revealText", { count: total }),
          ...(time !== null ? [t("wall.revealClock")] : []),
          t("wall.revealFinal"),
        ].join(" ")}
        onClose={(value) => {
          setAsking(null);
          if (value === "confirm" && nextStep !== null) goStep(nextStep);
        }}
      >
        <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
          {t("common.cancel")}
        </button>
        <button className="sb-secondary-action" value="confirm">
          {t("wall.reveal")}
        </button>
      </Dialog>
      {/* taking an arrangement back once the wall has changed since: what is lost, and that it cannot be taken back */}
      <Dialog
        id="app-dlg-undo"
        open={asking === "undo" && undoable}
        title={t("arrange.undoTitle")}
        text={t("arrange.undoText")}
        onClose={(value) => {
          setAsking(null);
          if (value === "confirm") undo();
        }}
      >
        <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
          {t("common.cancel")}
        </button>
        <button className="sb-danger-action sb-danger-action--outlined" value="confirm">
          {t("arrange.undoConfirm")}
        </button>
      </Dialog>
      <Dialog
        id="app-dlg-erase"
        open={asking === "erase"}
        title={t("wall.eraseTitle")}
        text={[
          t("wall.eraseText"),
          ...(ownNotes > 0 ? [t("wall.eraseNotes", { count: ownNotes })] : []),
          ...(admin ? [t("wall.eraseAdmin")] : []),
          t("wall.eraseFinal"),
        ].join(" ")}
        body={
          admin && adminToken !== undefined ? (
            <CopyKey inline word={t("wall.copyAdminLink")} text={adminLink(location.origin, wallId, adminToken)} />
          ) : undefined
        }
        onClose={(value) => {
          setAsking(null);
          if (value === "confirm") erase();
        }}
      >
        <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
          {t("common.cancel")}
        </button>
        <button className="sb-danger-action sb-danger-action--outlined" value="confirm">
          {t("wall.eraseConfirm")}
        </button>
      </Dialog>
      {/* the moderation's own key: which provider „Ordnen“ asks, and the key for it. Taken or removed, a sentence says
          what „Ordnen“ does from now on */}
      <OwnKeyAsk
        open={asking === "key" && admin && providers.length > 0}
        providers={providers}
        current={own?.provider ?? null}
        onClose={(answer) => {
          setAsking(null);
          if (answer === null) return;
          if (answer.is === "removed") {
            useOwnKey.getState().drop();
            setSaid(t("key.saidRemoved"));
          } else {
            useOwnKey.getState().take(answer.own);
            setSaid(t("key.saidTaken", { provider: providerOf(answer.own.provider).name }));
          }
        }}
      />
      {/* the wall's link as a QR code, large, with the link as text under it: what a team scans from across the room.
          Never the moderation link. Showing, not asking: its actions are secondary, „Schließen“ last */}
      <Dialog
        id="app-dlg-qr"
        open={asking === "qr"}
        title={t("wall.qrTitle")}
        text={t("wall.qrText")}
        body={
          <div className="app-qr-body">
            {asking === "qr" && <QrCode value={link} label={t("wall.qrLabel")} />}
            <p className="app-qr-link" data-testid="qr-link">
              {link}
            </p>
          </div>
        }
        onClose={() => setAsking(null)}
      >
        <CopyKey inline word={t("wall.copyLink")} text={link} />
        <button className="sb-secondary-action" value="close">
          {t("common.close")}
        </button>
      </Dialog>
      <Dialog
        id="app-dlg-delete"
        open={asking === "delete"}
        title={t("wall.deleteTitle")}
        text={t("wall.deleteText", { question })}
        onClose={(value) => {
          setAsking(null);
          if (value === "confirm") deleteWall();
        }}
      >
        <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
          {t("common.cancel")}
        </button>
        <button className="sb-danger-action sb-danger-action--outlined" value="confirm">
          {t("wall.deleteConfirm")}
        </button>
      </Dialog>
    </View>
  );
}
