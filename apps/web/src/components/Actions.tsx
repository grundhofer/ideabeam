// Actions.tsx: a step that decides (stage M5: „Bis zu drei Aktionen festlegen“ of „Rückblick nach Ziel und Daten“,
// „Plan anpassen“ of „Scheitern vorwegdenken“), in the place of the surface. The actions of the method as a list: the
// notes written in a step that takes actions, in the order of the vote on them where there was one. The moderation
// agrees on an action with „Wer“ and „Bis wann“, free text as the team says it (a name, a date or a word for one),
// and takes it back again; everybody else reads which actions are agreed and with what. Whoever may write adds an
// action at the end. Everything is a field or a button: the keyboard alone does all of it. What is agreed goes into
// the export as task lines (packages/shared, domain/export.ts).
import type { TFunction } from "i18next";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ACTION_DUE_MAX, ACTION_WHO_MAX, NOTE_TEXT_MAX, type Note, type NoteAction } from "@ideabeam/shared";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";

export function ActionsPanel(props: {
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
  const { actions, admin, canWrite, problem, onDismiss, onAgree, onAdd } = props;
  const { t } = useTranslation();
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
        {t("actions.heading")} <span className="sb-list-header__count">{actions.length}</span>
      </h2>
      <p className="app-ballot__left sb-num" role="status">
        {t("actions.agreedCount", { count: agreed, of: actions.length })}
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
        <p className="app-ballot__note">{t("actions.none")}</p>
      ) : (
        <ol className="sb-list app-actions__list" aria-labelledby="app-h-actions">
          {actions.map((note) =>
            admin ? (
              <AgreeRow key={note.id} note={note} onAgree={onAgree} />
            ) : (
              <li key={note.id} className="sb-list-row app-ballot__row" data-action={note.id}>
                <div className="sb-list-row__main">
                  <p className="sb-list-row__title">{note.text}</p>
                  <p className="sb-list-row__meta">
                    {note.action === undefined ? t("actions.open") : agreedLine(t, note.action)}
                  </p>
                </div>
              </li>
            ),
          )}
        </ol>
      )}
      {canWrite && (
        <form className="app-actions__add" noValidate onSubmit={add}>
          <Field id="app-f-action" label={t("actions.add")} help={t("actions.addHelp")}>
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
              {t("actions.addKey")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** What an agreed action says: who and by when, where the team said it. */
function agreedLine(t: TFunction, action: NoteAction): string {
  const parts: string[] = [t("actions.agreed")];
  if (action.who !== "") parts.push(t("actions.whoIs", { who: action.who }));
  if (action.due !== "") parts.push(t("actions.dueIs", { due: action.due }));
  return parts.join(" · ");
}

/** An action as the moderation has it: its text, „Wer“ and „Bis wann“, „Festlegen“ (or „Ändern“), and, once agreed,
 *  „Nicht mehr festlegen“. The fields hold what is typed until it is sent; an action agreed elsewhere shows what was
 *  agreed. */
function AgreeRow(props: { note: Note; onAgree(noteId: string, action: NoteAction | null): void }) {
  const { note, onAgree } = props;
  const { t } = useTranslation();
  const [who, setWho] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const shownWho = who ?? note.action?.who ?? "";
  const shownDue = due ?? note.action?.due ?? "";
  const titleId = `app-action-${note.id}`;
  const agree = (event: FormEvent) => {
    event.preventDefault();
    onAgree(note.id, { who: shownWho.trim().slice(0, ACTION_WHO_MAX), due: shownDue.trim().slice(0, ACTION_DUE_MAX) });
    setWho(null);
    setDue(null);
  };
  return (
    <li className="sb-list-row app-ballot__row app-actions__row" data-action={note.id}>
      <div className="sb-list-row__main">
        <p className="sb-list-row__title" id={titleId}>
          {note.text}
        </p>
        <p className="sb-list-row__meta">
          {note.action === undefined ? t("actions.open") : agreedLine(t, note.action)}
        </p>
        <form className="app-actions__form" aria-labelledby={titleId} noValidate onSubmit={agree}>
          <Field id={`app-f-who-${note.id}`} label={t("actions.who")} optional={t("common.optional")}>
            {(control) => (
              <input
                {...control}
                type="text"
                autoComplete="off"
                maxLength={ACTION_WHO_MAX}
                value={shownWho}
                onChange={(event) => setWho(event.target.value)}
              />
            )}
          </Field>
          <Field id={`app-f-due-${note.id}`} label={t("actions.due")} optional={t("common.optional")}>
            {(control) => (
              <input
                {...control}
                type="text"
                autoComplete="off"
                maxLength={ACTION_DUE_MAX}
                value={shownDue}
                onChange={(event) => setDue(event.target.value)}
              />
            )}
          </Field>
          <div className="app-actions__keys">
            <button className="sb-text-action" type="submit" aria-describedby={titleId}>
              <Icon name="check" />
              {note.action === undefined ? t("actions.agree") : t("actions.change")}
            </button>
            {note.action !== undefined && (
              <button
                className="sb-text-action"
                type="button"
                aria-describedby={titleId}
                onClick={() => {
                  setWho(null);
                  setDue(null);
                  onAgree(note.id, null);
                }}
              >
                {t("actions.unagree")}
              </button>
            )}
          </div>
        </form>
      </div>
    </li>
  );
}
