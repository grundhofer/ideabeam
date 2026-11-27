// Estimate.tsx: a step that estimates (PLAN-METHODEN.md 4, stage M3), in the place of the surface. Before counting:
// the number field with the step's unit beside it, and in the first round the short reason under it; „Abgeben“ is
// the view's primary action in the action zone (pages/Wall.tsx), and Enter in the number field does the same. What
// the person stored is said back as the language writes numbers („Gespeichert: 1.200 Tage“), so a misread number is
// seen. In the second round the first round's summary stands above the field, and nothing else of it: never a
// single estimate (the wall never sends one). After counting: the summary as rows of words and numbers, no chart
// and no colour that says anything (sebaro, KERN): median, middle half, range, how many estimated; and from the
// second round on how the median and the middle half moved.
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { estimateNumber, NOTE_TEXT_MAX, type EstimateResult, type EstimateSummary } from "@ideabeam/shared";
import { useLang } from "../i18n";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";

/** A number with the unit, as the language writes it. */
function amount(lang: "de" | "en", value: number, unit: string | null): string {
  const number = estimateNumber(value, lang);
  return unit === null ? number : `${number} ${unit}`;
}

/** The summary of a round as one sentence: what the state and a screen reader say. */
export function summarySentence(
  t: ReturnType<typeof useTranslation>["t"],
  lang: "de" | "en",
  result: EstimateResult,
): string {
  const summary = result.summary;
  if (summary === null) return t("estimate.none");
  return t("estimate.sentence", {
    median: amount(lang, summary.median, result.unit),
    q1: estimateNumber(summary.q1, lang),
    q3: amount(lang, summary.q3, result.unit),
    min: estimateNumber(summary.min, lang),
    max: amount(lang, summary.max, result.unit),
    count: summary.n,
  });
}

export function EstimatePanel(props: {
  /** the step's unit, or null */
  unit: string | null;
  /** what stands in the number field */
  value: string;
  /** the estimate the wall stored for this person in this step, or null */
  stored: number | null;
  /** the reason beside the estimate, or null: this round takes none */
  reason: string | null;
  /** the summaries of the rounds before this one */
  before: readonly EstimateResult[];
  problem: string | null;
  onDismiss(): void;
  onValue(value: string): void;
  onReason(reason: string): void;
  onSubmit(): void;
}) {
  const { unit, value, stored, reason, before, problem, onDismiss, onValue, onReason, onSubmit } = props;
  const { t } = useTranslation();
  const lang = useLang();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <section className="app-ballot app-estimate" aria-labelledby="app-h-estimate">
      <h2 className="sb-list-header" id="app-h-estimate">
        {t("estimate.heading")}
      </h2>
      {before.map((round, n) => (
        <EstimateSummaryRows key={round.step} result={round} round={n + 1} previous={null} level="h3" />
      ))}
      {/* what is stored, said when it changes */}
      <p className="app-ballot__left sb-num" role="status">
        {stored === null ? t("estimate.notYet") : t("estimate.stored", { value: amount(lang, stored, unit) })}
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
      <form className="app-estimate__form" aria-labelledby="app-h-estimate" noValidate onSubmit={submit}>
        <Field id="app-f-estimate" label={t("estimate.field")} help={t("estimate.fieldHelp")}>
          {(control) => (
            <>
              <input
                {...control}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={value}
                onChange={(event) => onValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit(event);
                }}
              />
              {unit !== null && <span className="sb-field__suffix">{unit}</span>}
            </>
          )}
        </Field>
        {reason !== null && (
          <Field
            id="app-f-reason"
            label={t("estimate.reason")}
            optional={t("common.optional")}
            help={t("estimate.reasonHelp")}
          >
            {(control) => (
              <textarea
                {...control}
                rows={3}
                maxLength={NOTE_TEXT_MAX}
                value={reason}
                onChange={(event) => onReason(event.target.value)}
              />
            )}
          </Field>
        )}
      </form>
    </section>
  );
}

/** A counted round as rows: median, middle half, range, and how the median and the middle half moved since the
 *  round before (`previous`). */
export function EstimateSummaryRows(props: {
  result: EstimateResult;
  round: number;
  previous: EstimateSummary | null;
  level: "h2" | "h3";
}) {
  const { result, round, previous, level } = props;
  const { t } = useTranslation();
  const lang = useLang();
  const Heading = level;
  const summary = result.summary;
  const id = `app-h-round-${result.step}`;
  return (
    <section className="app-results app-estimate__round" aria-labelledby={id}>
      <Heading className={level === "h2" ? "sb-list-header" : "app-estimate__heading"} id={id}>
        {t("estimate.round", { n: round })}
      </Heading>
      {summary === null ? (
        <p className="app-ballot__note">{t("estimate.none")}</p>
      ) : (
        <>
          <p className="app-ballot__note">{t("estimate.count", { count: summary.n })}</p>
          <dl className="app-estimate__rows">
            <div className="app-estimate__row">
              <dt>{t("estimate.median")}</dt>
              <dd className="sb-num">{amount(lang, summary.median, result.unit)}</dd>
            </div>
            <div className="app-estimate__row">
              <dt>{t("estimate.middle")}</dt>
              <dd className="sb-num">
                {t("estimate.span", {
                  from: estimateNumber(summary.q1, lang),
                  to: amount(lang, summary.q3, result.unit),
                })}
              </dd>
            </div>
            <div className="app-estimate__row">
              <dt>{t("estimate.range")}</dt>
              <dd className="sb-num">
                {t("estimate.span", {
                  from: estimateNumber(summary.min, lang),
                  to: amount(lang, summary.max, result.unit),
                })}
              </dd>
            </div>
            {previous !== null && (
              <div className="app-estimate__row">
                <dt>{t("estimate.moved", { n: round - 1 })}</dt>
                <dd className="sb-num">
                  {t("estimate.movedValue", {
                    from: estimateNumber(previous.median, lang),
                    to: amount(lang, summary.median, result.unit),
                    widthFrom: estimateNumber(previous.q3 - previous.q1, lang),
                    widthTo: amount(lang, summary.q3 - summary.q1, result.unit),
                  })}
                </dd>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}

/** Every counted round of the wall's estimates, in order: what the step after counting shows, and beside the
 *  surface in the later steps (`compact`). */
export function EstimateResults(props: { results: readonly EstimateResult[]; compact?: boolean }) {
  const { results, compact = false } = props;
  const { t } = useTranslation();
  const heading = compact ? "app-h-estimates-side" : "app-h-estimates";
  return (
    <section
      className={compact ? "app-results app-results--side app-estimate" : "app-results app-estimate"}
      aria-labelledby={heading}
    >
      <h2 className="sb-list-header" id={heading}>
        {t("estimate.resultHeading")}
      </h2>
      {results.map((result, n) => (
        <EstimateSummaryRows
          key={result.step}
          result={result}
          round={n + 1}
          previous={n === 0 ? null : (results[n - 1]?.summary ?? null)}
          level="h3"
        />
      ))}
    </section>
  );
}
