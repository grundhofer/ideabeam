// Score.tsx: a step that scores (stage M6, „Kriterienbewertung“, „Nutzen und Aufwand“, „Annahmen prüfen“), in the
// place of the surface. The score vote has stood in the rules and the Worker since stage M2 (domain/vote.ts: 1 to 5 for
// an option, once or once per criterion, the mean); this is its panel. Each option is a group of fields, one select per
// criterion with „–“ and 1 to 5: the keyboard alone does all of it (Tab from field to field, the arrow keys or the
// first letter choose), nothing is dragged. An option is scored when every one of its criteria has a number; „–“
// takes a number back. Nothing leaves the browser before „Abgeben“ (pages/Wall.tsx): the draft is the view's. After
// counting: the result as a table, the mean per criterion and the total for every option, the place and how many scored
// it, never a single score (ScoreResults).
import { useTranslation } from "react-i18next";
import { SCORE_MAX, SCORE_MIN, type Group, type Note, type RankingResult, type VoteRound } from "@ideabeam/shared";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";
import { wordsOf } from "./Ballot";

/** The draft of a score: by option, a number or nothing for each criterion. */
export type Scores = Readonly<Record<string, ReadonlyArray<number | null>>>;

const NUMBERS = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, at) => SCORE_MIN + at);

/** Whether every criterion of an option has a number. */
export function scored(row: ReadonlyArray<number | null> | undefined, width: number): boolean {
  return row !== undefined && row.length === width && row.every((value) => value !== null);
}

/** Whether some but not every criterion of an option has a number: such an option cannot be sent. */
export function halfScored(row: ReadonlyArray<number | null> | undefined): boolean {
  return row !== undefined && row.some((value) => value !== null) && row.some((value) => value === null);
}

export function ScorePanel(props: {
  round: VoteRound;
  /** the words of the criteria; none: one score for an option */
  criteria: readonly string[];
  scores: Scores;
  notes: readonly Note[];
  groups: readonly Group[];
  problem: string | null;
  onDismiss(): void;
  onChange(scores: Scores): void;
}) {
  const { round, criteria, scores, notes, groups, problem, onDismiss, onChange } = props;
  const { t } = useTranslation();
  const width = Math.max(1, criteria.length);
  const done = round.options.filter((option) => scored(scores[option.id], width)).length;
  const set = (id: string, at: number, value: number | null) => {
    const row = [...(scores[id] ?? Array.from({ length: width }, () => null))];
    row[at] = value;
    const rest = Object.fromEntries(Object.entries(scores).filter(([other]) => other !== id));
    onChange(row.every((one) => one === null) ? rest : { ...rest, [id]: row });
  };
  return (
    <section className="app-ballot app-score" aria-labelledby="app-h-score">
      <h2 className="sb-list-header" id="app-h-score">
        {criteria.length === 0 ? t("score.heading") : t("score.headingCriteria", { count: criteria.length })}
      </h2>
      <p className="app-ballot__left sb-num" role="status">
        {t("score.done", { count: done, of: round.options.length })}
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
      <p className="app-ballot__note">{t("score.scale")}</p>
      {round.criteriaOmitted !== undefined && (
        <p className="app-ballot__note">{t("score.omittedCriteria", { count: round.criteriaOmitted })}</p>
      )}
      {round.omitted > 0 && <p className="app-ballot__note">{t("vote.omitted", { count: round.omitted })}</p>}
      {round.options.length === 0 ? (
        <p className="sb-list-end">{t("vote.noOptions")}</p>
      ) : (
        <ul className="sb-list app-ballot__list">
          {round.options.map((option, n) => {
            const words = wordsOf(t, option, notes, groups);
            const row = scores[option.id];
            return (
              <li key={option.id} className="sb-list-row app-ballot__row app-score__row">
                <fieldset className="app-score__option">
                  {/* the option names the group of its fields; the line under it is what the eye reads */}
                  <legend className="sb-visually-hidden">{words.title}</legend>
                  <div className="sb-list-row__main">
                    <p className="sb-list-row__title" aria-hidden="true">
                      {words.title}
                    </p>
                    {words.meta !== null && <p className="sb-list-row__meta">{words.meta}</p>}
                    <p className="sb-list-row__meta">
                      {scored(row, width)
                        ? t("score.rowDone")
                        : halfScored(row)
                          ? t("score.rowHalf")
                          : t("score.rowOpen")}
                    </p>
                  </div>
                  <div className="app-score__fields">
                    {Array.from({ length: width }, (_, at) => {
                      const id = `app-f-score-${n + 1}-${at + 1}`;
                      const value = row?.[at] ?? null;
                      return (
                        <Field key={at} id={id} label={criteria[at] ?? t("score.single")} frame="sb-select">
                          {(control) => (
                            <>
                              <select
                                {...control}
                                value={value === null ? "" : String(value)}
                                onChange={(event) =>
                                  set(option.id, at, event.target.value === "" ? null : Number(event.target.value))
                                }
                              >
                                <option value="">{t("score.none")}</option>
                                {NUMBERS.map((number) => (
                                  <option key={number} value={String(number)}>
                                    {number}
                                  </option>
                                ))}
                              </select>
                              <Icon name="chevron-down" />
                            </>
                          )}
                        </Field>
                      );
                    })}
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A number of a mean as the language writes it: „3,5“, „3.5“. */
function mean(lang: string, value: number): string {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 }).format(value);
}

/** A counted score with criteria as a table: place, option, the mean per criterion, the total and how many scored it.
 *  Never a single score. `compact`: beside the surface in the steps after the vote, with a heading of its own. */
export function ScoreResults(props: { result: RankingResult; criteria: readonly string[]; compact?: boolean }) {
  const { result, criteria, compact = false } = props;
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const heading = compact ? "app-h-score-side" : "app-h-score-result";
  return (
    <section className={compact ? "app-results app-results--side" : "app-results"} aria-labelledby={heading}>
      <h2 className="sb-list-header" id={heading}>
        {t("score.result.heading")}
      </h2>
      <p className="app-ballot__note">{t("score.result.how")}</p>
      <p className="app-ballot__note">{t("vote.result.voters", { count: result.voters })}</p>
      <div className="sb-table-wrap" role="region" tabIndex={0} aria-labelledby={heading}>
        <table className="sb-table app-score__table">
          <thead>
            <tr>
              <th scope="col">{t("score.result.place")}</th>
              <th scope="col">{t("score.result.option")}</th>
              {criteria.map((criterion, at) => (
                <th scope="col" key={at}>
                  {criterion}
                </th>
              ))}
              <th scope="col">{t("score.result.total")}</th>
              <th scope="col">{t("score.result.by")}</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id}>
                <td className="sb-num">{row.rank}.</td>
                <th scope="row">{row.label.trim() !== "" ? row.label : t("group.untitled")}</th>
                {criteria.map((_, at) => (
                  <td className="sb-num" key={at}>
                    {row.by === 0 ? "–" : mean(lang, row.scores?.[at] ?? 0)}
                  </td>
                ))}
                <td className="sb-num">{row.by === 0 ? "–" : mean(lang, row.points)}</td>
                <td className="sb-num">{row.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
