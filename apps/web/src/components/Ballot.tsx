// Ballot.tsx: a step that votes (PLAN-METHODEN.md 4, stage M2), in the place of the surface. Before counting: the
// options as rows, each with − and + to give it points, the budget that is left („Noch 2 Punkte“); „Abgeben“ is the
// view's primary action in the action zone (pages/Wall.tsx). Everything is a button: no dragging, and the keyboard
// alone does all of it. Nothing leaves the browser before „Abgeben“: the draft is the view's. After counting: the
// result as a ranked list, places and points in numbers, no bars and no colour that says anything (sebaro, KERN).
//
// The options are the ones the wall froze when it entered the step (domain/vote.ts); their words are read from the
// wall as it stands: a group by its title, with the notes in it as a line under it, a note by its text.
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { Group, Note, RankingResult, VoteOption, VoteRound } from "@ideabeam/shared";
import { Icon } from "../sebaro/react/Icon";
import { titleOf } from "./Asks";

/** The draft of a ballot: marks by option (points, or 1 for a choice). */
export type Marks = Readonly<Record<string, number>>;

/** What a vote shows of its options: the words, and for a group the notes in it. */
function wordsOf(
  t: TFunction,
  option: Pick<VoteOption, "id" | "kind">,
  notes: readonly Note[],
  groups: readonly Group[],
): { title: string; meta: string | null } {
  if (option.kind === "note") return { title: notes.find((note) => note.id === option.id)?.text ?? "", meta: null };
  const group = groups.find((one) => one.id === option.id);
  const inside = notes.filter((note) => note.groupId === option.id).map((note) => note.text);
  return {
    title: group === undefined ? t("group.untitled") : titleOf(t, group),
    meta: inside.length === 0 ? null : inside.join(" · "),
  };
}

export function BallotPanel(props: {
  round: VoteRound;
  /** points: each option takes up to `cap`; a choice: each takes one */
  kind: "dots" | "approval";
  cap: number;
  marks: Marks;
  notes: readonly Note[];
  groups: readonly Group[];
  problem: string | null;
  onDismiss(): void;
  onChange(marks: Marks): void;
}) {
  const { round, kind, cap, marks, notes, groups, problem, onDismiss, onChange } = props;
  const { t } = useTranslation();
  const used = Object.values(marks).reduce((sum, value) => sum + value, 0);
  const left = Math.max(0, round.limit - used);
  const unit = kind === "dots" ? "points" : "choices";
  return (
    <section className="app-ballot" aria-labelledby="app-h-ballot">
      <h2 className="sb-list-header" id="app-h-ballot">
        {t(`vote.${unit}.heading`, { count: round.limit })}
      </h2>
      {/* how much is left, said when it changes; the problem of a ballot that was not taken under it */}
      <p className="app-ballot__left sb-num" role="status">
        {left === 0 ? t(`vote.${unit}.none`) : t(`vote.${unit}.left`, { count: left })}
      </p>
      <div className="app-surface__problem" role="alert">
        {problem !== null && (
          <>
            <Icon name="error--filled-16" size={16} />
            <p>{problem}</p>
            <button className="sb-icon-button" type="button" aria-label={t("surface.dismiss")} onClick={onDismiss}>
              <Icon name="close" />
            </button>
          </>
        )}
      </div>
      {round.omitted > 0 && <p className="app-ballot__note">{t("vote.omitted", { count: round.omitted })}</p>}
      {round.options.length === 0 ? (
        <p className="sb-list-end">{t("vote.noOptions")}</p>
      ) : (
        <ul className="sb-list app-ballot__list">
          {round.options.map((option) => {
            const words = wordsOf(t, option, notes, groups);
            const value = marks[option.id] ?? 0;
            const name = words.title;
            const canAdd = left > 0 && value < cap;
            const canTake = value > 0;
            const set = (next: number) => {
              const rest = Object.fromEntries(Object.entries(marks).filter(([id]) => id !== option.id));
              onChange(next === 0 ? rest : { ...rest, [option.id]: next });
            };
            const labelId = `app-opt-${option.id}`;
            return (
              <li key={option.id} className="sb-list-row app-ballot__row">
                <div className="sb-list-row__main">
                  <p className="sb-list-row__title" id={labelId}>
                    {name}
                  </p>
                  {words.meta !== null && <p className="sb-list-row__meta">{words.meta}</p>}
                </div>
                <div className="sb-list-row__trail app-ballot__stepper" role="group" aria-labelledby={labelId}>
                  {/* a key that cannot act stays where it is and in the tab order: aria-disabled, not disabled */}
                  <button
                    className="sb-icon-button"
                    type="button"
                    aria-label={t(`vote.${unit}.less`, { name })}
                    aria-disabled={!canTake || undefined}
                    onClick={() => canTake && set(value - 1)}
                  >
                    <Icon name="minus" />
                  </button>
                  <span className="app-ballot__value sb-num" aria-hidden="true">
                    {value}
                  </span>
                  <span className="sb-visually-hidden">{t(`vote.${unit}.given`, { count: value })}</span>
                  <button
                    className="sb-icon-button"
                    type="button"
                    aria-label={t(`vote.${unit}.more`, { name })}
                    aria-disabled={!canAdd || undefined}
                    onClick={() => canAdd && set(value + 1)}
                  >
                    <Icon name="plus" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A counted vote as a ranked list: the place, the words, the points as a number. `compact`: beside the surface in
 *  the steps after the vote, with a heading of the next level. */
export function Results(props: { result: RankingResult; notes: readonly Note[]; compact?: boolean }) {
  const { result, notes, compact = false } = props;
  const { t } = useTranslation();
  const heading = compact ? "app-h-results-side" : "app-h-results";
  const amount = (points: number, by: number) =>
    result.kind === "score"
      ? by === 0
        ? t("vote.result.unscored")
        : t("vote.result.mean", { value: points })
      : t(result.kind === "approval" ? "vote.result.votes" : "vote.result.points", { count: points });
  return (
    <section className={compact ? "app-results app-results--side" : "app-results"} aria-labelledby={heading}>
      <h2 className="sb-list-header" id={heading}>
        {t("vote.result.heading")}
      </h2>
      <p className="app-ballot__note">{t(`vote.result.how.${result.kind}`, { count: result.limit })}</p>
      <p className="app-ballot__note">{t("vote.result.voters", { count: result.voters })}</p>
      <ol className="sb-list app-results__list">
        {result.rows.map((row) => {
          // the words as they were counted; for a group, the notes in it as the wall holds them now
          const meta =
            row.kind === "group"
              ? notes
                  .filter((note) => note.groupId === row.id)
                  .map((note) => note.text)
                  .join(" · ")
              : "";
          const title = row.label.trim() !== "" ? row.label : t("group.untitled");
          return (
            <li key={row.id} className="sb-list-row app-results__row">
              <span className="sb-list-row__lead app-results__place sb-num">{row.rank}.</span>
              <div className="sb-list-row__main">
                <p className="sb-list-row__title">{title}</p>
                {!compact && meta !== "" && <p className="sb-list-row__meta">{meta}</p>}
              </div>
              <span className="sb-list-row__trail app-results__points sb-num">{amount(row.points, row.by)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
