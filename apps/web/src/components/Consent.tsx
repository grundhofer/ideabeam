// Consent.tsx: a consent round (stage M6, „Entscheidungsprotokoll mit Zustimmungsrunde“: „Sicher genug, um es
// auszuprobieren?“), in the place of the surface. What the round is about stands first: the notes of the proposal, as
// the wall froze them when the round began. Then one choice of three, „Zustimmung“, „Kann damit leben“, „Einwand“, as
// radio buttons (the arrow keys move the choice), and for an objection its reason, which it needs. Nothing leaves the
// browser before „Abgeben“ (pages/Wall.tsx). After counting: how many gave each answer, and the reasons of the
// objections as text, in an order that says nothing about who gave them; never who answered what (ConsentResults).
import { useTranslation } from "react-i18next";
import { NOTE_TEXT_MAX, type ConsentAnswer, type ConsentResult, type Note, type VoteRound } from "@ideabeam/shared";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";
import { Segmented } from "./Segmented";

/** The draft of a consent: the answer chosen, or none yet, and the reason typed. */
export type Consent = { answer: ConsentAnswer | ""; reason: string };

export function ConsentPanel(props: {
  round: VoteRound;
  consent: Consent;
  notes: readonly Note[];
  problem: string | null;
  onDismiss(): void;
  onChange(consent: Consent): void;
}) {
  const { round, consent, notes, problem, onDismiss, onChange } = props;
  const { t } = useTranslation();
  const proposal = round.options.flatMap((option) => {
    const note = notes.find((one) => one.id === option.id);
    return note === undefined ? [] : [note];
  });
  return (
    <section className="app-ballot app-consent" aria-labelledby="app-h-consent">
      <h2 className="sb-list-header" id="app-h-consent">
        {t("consent.heading")}
      </h2>
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
      <h3 className="app-rank__heading" id="app-h-proposal">
        {t("consent.proposal")}
      </h3>
      {proposal.length === 0 ? (
        <p className="app-ballot__note">{t("consent.noProposal")}</p>
      ) : (
        <ul className="sb-list" aria-labelledby="app-h-proposal">
          {proposal.map((note) => (
            <li key={note.id} className="sb-list-row app-ballot__row">
              <div className="sb-list-row__main">
                <p className="sb-list-row__title">{note.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="app-consent__form">
        <Segmented<ConsentAnswer | "">
          legend={t("consent.question")}
          options={[
            { value: "agree", label: t("consent.agree") },
            { value: "live", label: t("consent.live") },
            { value: "object", label: t("consent.object") },
          ]}
          value={consent.answer}
          onChange={(answer) => onChange({ ...consent, answer })}
        />
        {consent.answer === "object" && (
          <Field id="app-f-objection" label={t("consent.reason")} help={t("consent.reasonHelp")}>
            {(control) => (
              <textarea
                {...control}
                rows={3}
                maxLength={NOTE_TEXT_MAX}
                value={consent.reason}
                onChange={(event) => onChange({ ...consent, reason: event.target.value })}
              />
            )}
          </Field>
        )}
      </div>
    </section>
  );
}

/** A counted consent round: how many gave each answer, and the objections' reasons. `compact`: beside the surface in
 *  the steps after it. */
export function ConsentResults(props: { result: ConsentResult; compact?: boolean }) {
  const { result, compact = false } = props;
  const { t } = useTranslation();
  const heading = compact ? "app-h-consent-side" : "app-h-consent-result";
  const rows: Array<[string, number]> = [
    [t("consent.agree"), result.agree],
    [t("consent.live"), result.live],
    [t("consent.object"), result.object],
  ];
  return (
    <section className={compact ? "app-results app-results--side" : "app-results"} aria-labelledby={heading}>
      <h2 className="sb-list-header" id={heading}>
        {t("consent.result.heading")}
      </h2>
      <p className="app-ballot__note">{t("consent.result.voters", { count: result.voters })}</p>
      <ul className="sb-list app-results__list" aria-labelledby={heading}>
        {rows.map(([word, count]) => (
          <li key={word} className="sb-list-row app-results__row">
            <div className="sb-list-row__main">
              <p className="sb-list-row__title">{word}</p>
            </div>
            <span className="sb-list-row__trail app-results__points sb-num">{count}</span>
          </li>
        ))}
      </ul>
      <h3 className="app-rank__heading" id={`${heading}-objections`}>
        {t("consent.result.objections", { count: result.objections.length })}
      </h3>
      {result.objections.length === 0 ? (
        <p className="app-ballot__note">{t("consent.result.noObjections")}</p>
      ) : (
        <ul className="sb-list" aria-labelledby={`${heading}-objections`}>
          {result.objections.map((reason, at) => (
            <li key={at} className="sb-list-row app-results__row">
              <div className="sb-list-row__main">
                <p className="sb-list-row__title">{reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
