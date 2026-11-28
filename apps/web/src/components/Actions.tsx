// Actions.tsx: a step that decides (stage M5: „Bis zu drei Aktionen festlegen“ of „Rückblick nach Ziel und Daten“,
// „Plan anpassen“ of „Scheitern vorwegdenken“), in the place of the surface. The actions of the method as a list: the
// notes written in a step that takes actions, in the order of the vote on them where there was one. The moderation
// agrees on an action with „Wer“ and „Bis wann“, free text as the team says it (a name, a date or a word for one),
// and takes it back again; everybody else reads which actions are agreed and with what. Whoever may write adds an
// action at the end. Everything is a field or a button: the keyboard alone does all of it. What is agreed goes into
// the export as task lines (packages/shared, domain/export.ts).
//
// Stage M6: the same panel records decisions and measurable results (`kind`). A decision („Gesamturteil festhalten“,
// „Zusammenführen“, „Entscheidung festhalten“) with its reasons, the objections still open and a review date; who
// decided is the moderation, which the row says. A measurable result („Festlegen, mit Verantwortlichen und
// Prüftermin“) with the goal it belongs to (one of the goals the vote chose), its target, who answers for it and the
// review date. Each kind shows its own fields and its own words; what is recorded goes into the export.
import type { TFunction } from "i18next";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ACTION_DUE_MAX,
  ACTION_WHO_MAX,
  NOTE_TEXT_MAX,
  RECORD_TARGET_MAX,
  RECORD_TEXT_MAX,
  type Note,
  type NoteAction,
  type RecordKind,
} from "@ideabeam/shared";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";

/** A goal a measurable result may belong to: an option the vote on the goals chose, with its words. */
export type Goal = { id: string; label: string };

export function ActionsPanel(props: {
  /** what the step records: actions (stage M5), decisions or measurable results (stage M6) */
  kind?: RecordKind;
  /** the goals a result may belong to (`kind: "result"`) */
  goals?: readonly Goal[];
  actions: readonly Note[];
  /** this person moderates: agrees on actions */
  admin: boolean;
  /** a new action may be written in the step */
  canWrite: boolean;
  problem: string | null;
  onDismiss(): void;
  onAgree(noteId: string, action: NoteAction | null): void;
  onAdd(text: string): void;
}) {
  const { kind = "action", goals = [], actions, admin, canWrite, problem, onDismiss, onAgree, onAdd } = props;
  const { t } = useTranslation();
  const words = kind === "action" ? "actions" : kind === "decision" ? "records.decision" : "records.result";
  const [text, setText] = useState("");
  const agreed = actions.filter((note) => note.action !== undefined).length;
  const add = (event: FormEvent) => {
    event.preventDefault();
    const tidy = text.trim().slice(0, NOTE_TEXT_MAX);
    if (tidy === "") return;
    onAdd(tidy);
    setText("");
  };
  return (
    <section className="app-ballot app-actions" aria-labelledby="app-h-actions">
      <h2 className="sb-list-header" id="app-h-actions">
        {t(`${words}.heading`)} <span className="sb-list-header__count">{actions.length}</span>
      </h2>
      <p className="app-ballot__left sb-num" role="status">
        {t(`${words}.agreedCount`, { count: agreed, of: actions.length })}
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
      {actions.length === 0 ? (
        <p className="app-ballot__note">{t(`${words}.none`)}</p>
      ) : (
        <ol className="sb-list app-actions__list" aria-labelledby="app-h-actions">
          {actions.map((note) =>
            admin ? (
              <AgreeRow key={note.id} kind={kind} goals={goals} note={note} onAgree={onAgree} />
            ) : (
              <li key={note.id} className="sb-list-row app-ballot__row" data-action={note.id}>
                <div className="sb-list-row__main">
                  <p className="sb-list-row__title">{note.text}</p>
                  <p className="sb-list-row__meta">
                    {note.action === undefined ? t(`${words}.open`) : agreedLine(t, kind, goals, note.action)}
                  </p>
                </div>
              </li>
            ),
          )}
        </ol>
      )}
      {canWrite && (
        <form className="app-actions__add" noValidate onSubmit={add}>
          <Field id="app-f-action" label={t(`${words}.add`)} help={t("actions.addHelp")}>
            {(control) => (
              <textarea
                {...control}
                rows={2}
                maxLength={NOTE_TEXT_MAX}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            )}
          </Field>
          <div>
            <button className="sb-secondary-action" type="submit">
              <Icon name="plus" />
              {t(`${words}.addKey`)}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** What an agreed action says: who and by when, where the team said it. A decision (stage M6): who decided, its
 *  reasons, the objections still open and the review date; a measurable result: its goal, target, owner and review
 *  date. */
function agreedLine(t: TFunction, kind: RecordKind, goals: readonly Goal[], action: NoteAction): string {
  if (kind === "decision") {
    const parts: string[] = [t("records.decision.agreed"), t("records.decision.by")];
    if (action.why) parts.push(t("records.decision.whyIs", { why: action.why }));
    if (action.open) parts.push(t("records.decision.openIs", { open: action.open }));
    if (action.due !== "") parts.push(t("records.decision.dueIs", { due: action.due }));
    return parts.join(" · ");
  }
  if (kind === "result") {
    const parts: string[] = [t("records.result.agreed")];
    const goal = goals.find((one) => one.id === action.goal);
    if (goal !== undefined) parts.push(t("records.result.goalIs", { goal: goal.label }));
    if (action.target) parts.push(t("records.result.targetIs", { target: action.target }));
    if (action.who !== "") parts.push(t("records.result.whoIs", { who: action.who }));
    if (action.due !== "") parts.push(t("records.result.dueIs", { due: action.due }));
    return parts.join(" · ");
  }
  const parts: string[] = [t("actions.agreed")];
  if (action.who !== "") parts.push(t("actions.whoIs", { who: action.who }));
  if (action.due !== "") parts.push(t("actions.dueIs", { due: action.due }));
  return parts.join(" · ");
}

/** A text of a field as one line: what a record holds (no line breaks), trimmed and cut to its length. */
const line = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

/** An action as the moderation has it: its text, „Wer“ and „Bis wann“, „Festlegen“ (or „Ändern“), and, once agreed,
 *  „Nicht mehr festlegen“. The fields hold what is typed until it is sent; an action agreed elsewhere shows what was
 *  agreed. A decision and a measurable result (stage M6) in the same way, each with its own fields. */
function AgreeRow(props: {
  kind: RecordKind;
  goals: readonly Goal[];
  note: Note;
  onAgree(noteId: string, action: NoteAction | null): void;
}) {
  const { kind, goals, note, onAgree } = props;
  const { t } = useTranslation();
  // what is typed, by field; null: untouched, the field shows what was recorded
  const [typed, setTyped] = useState<Partial<Record<"who" | "due" | "why" | "open" | "target" | "goal", string>>>({});
  const shown = (field: "who" | "due" | "why" | "open" | "target" | "goal") =>
    typed[field] ?? note.action?.[field] ?? "";
  const type = (field: "who" | "due" | "why" | "open" | "target" | "goal") => (value: string) =>
    setTyped((now) => ({ ...now, [field]: value }));
  const titleId = `app-action-${note.id}`;
  const words = kind === "action" ? "actions" : kind === "decision" ? "records.decision" : "records.result";
  const agree = (event: FormEvent) => {
    event.preventDefault();
    const goal = shown("goal");
    const record: NoteAction =
      kind === "decision"
        ? {
            who: "",
            due: line(shown("due"), ACTION_DUE_MAX),
            ...(line(shown("why"), RECORD_TEXT_MAX) === "" ? {} : { why: line(shown("why"), RECORD_TEXT_MAX) }),
            ...(line(shown("open"), RECORD_TEXT_MAX) === "" ? {} : { open: line(shown("open"), RECORD_TEXT_MAX) }),
          }
        : kind === "result"
          ? {
              who: line(shown("who"), ACTION_WHO_MAX),
              due: line(shown("due"), ACTION_DUE_MAX),
              ...(line(shown("target"), RECORD_TARGET_MAX) === ""
                ? {}
                : { target: line(shown("target"), RECORD_TARGET_MAX) }),
              ...(goals.some((one) => one.id === goal) ? { goal } : {}),
            }
          : { who: line(shown("who"), ACTION_WHO_MAX), due: line(shown("due"), ACTION_DUE_MAX) };
    onAgree(note.id, record);
    setTyped({});
  };
  const input = (field: "who" | "due" | "target", label: string, max: number) => (
    <Field id={`app-f-${field}-${note.id}`} label={label} optional={t("common.optional")}>
      {(control) => (
        <input
          {...control}
          type="text"
          autoComplete="off"
          maxLength={max}
          value={shown(field)}
          onChange={(event) => type(field)(event.target.value)}
        />
      )}
    </Field>
  );
  const area = (field: "why" | "open", label: string) => (
    <Field id={`app-f-${field}-${note.id}`} label={label} optional={t("common.optional")}>
      {(control) => (
        <textarea
          {...control}
          rows={2}
          maxLength={RECORD_TEXT_MAX}
          value={shown(field)}
          onChange={(event) => type(field)(event.target.value)}
        />
      )}
    </Field>
  );
  return (
    <li className="sb-list-row app-ballot__row app-actions__row" data-action={note.id}>
      <div className="sb-list-row__main">
        <p className="sb-list-row__title" id={titleId}>
          {note.text}
        </p>
        <p className="sb-list-row__meta">
          {note.action === undefined ? t(`${words}.open`) : agreedLine(t, kind, goals, note.action)}
        </p>
        <form className="app-actions__form" aria-labelledby={titleId} noValidate onSubmit={agree}>
          {kind === "decision" ? (
            <>
              {area("why", t("records.decision.why"))}
              {area("open", t("records.decision.openObjections"))}
              {input("due", t("records.decision.due"), ACTION_DUE_MAX)}
            </>
          ) : kind === "result" ? (
            <>
              <Field id={`app-f-goal-${note.id}`} label={t("records.result.goal")} frame="sb-select">
                {(control) => (
                  <>
                    <select {...control} value={shown("goal")} onChange={(event) => type("goal")(event.target.value)}>
                      <option value="">{t("records.result.noGoal")}</option>
                      {goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.label}
                        </option>
                      ))}
                    </select>
                    <Icon name="chevron-down" />
                  </>
                )}
              </Field>
              {input("target", t("records.result.target"), RECORD_TARGET_MAX)}
              {input("who", t("records.result.who"), ACTION_WHO_MAX)}
              {input("due", t("records.result.due"), ACTION_DUE_MAX)}
            </>
          ) : (
            <>
              {input("who", t("actions.who"), ACTION_WHO_MAX)}
              {input("due", t("actions.due"), ACTION_DUE_MAX)}
            </>
          )}
          <div className="app-actions__keys">
            <button className="sb-text-action" type="submit" aria-describedby={titleId}>
              <Icon name="check" />
              {note.action === undefined ? t(`${words}.agree`) : t("actions.change")}
            </button>
            {note.action !== undefined && (
              <button
                className="sb-text-action"
                type="button"
                aria-describedby={titleId}
                onClick={() => {
                  setTyped({});
                  onAgree(note.id, null);
                }}
              >
                {t(`${words}.unagree`)}
              </button>
            )}
          </div>
        </form>
      </div>
    </li>
  );
}
