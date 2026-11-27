// NewWall.tsx: „Neue Wand“: make a wall and go to its door. A wall has no name: the question it asks is its title,
// and the one field here. Under it stands the choice of the method the wall runs (components/MethodChoice.tsx,
// PLAN-METHODEN.md): „Still sammeln, bündeln, verdeckt wählen“ unless another is chosen, every method with its short
// description, „Freie Wand“ last. The primary action stays enabled: its press says at the field what is wrong and moves
// the focus there. While the wall is made the action shows its own progress; a failure stands as a sentence right
// before it and the field keeps its value: also when the day's walls are taken, where the sentence names the time
// it goes on. Leaving with a question typed asks first. A method that estimates („Schätzen – Diskutieren – Schätzen“,
// stage M3) asks for the unit of its number under the choice, as an optional field: „Tage“, „€“, „%“.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker, useNavigate } from "react-router";
import { CATALOGUE, DEFAULT_METHOD, UNIT_MAX, type MethodId } from "@ideabeam/shared";
import { MethodChoice } from "../components/MethodChoice";
import { View } from "../components/View";
import { useLang } from "../i18n";
import { createWall, type Made } from "../lib/api";
import { clock } from "../lib/format";
import { checkText, QUESTION_MAX, tidy, type TextFault } from "../lib/input";
import { Dialog } from "../sebaro/react/Dialog";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";
import { useWalls } from "../store/walls";

const FIELD = "app-f-question";
const UNIT_FIELD = "app-f-unit";

export default function NewWall() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lang = useLang();
  const [question, setQuestion] = useState("");
  // the best supported method is how a wall starts; another one, „Freie Wand“ among them, is asked for
  const [method, setMethod] = useState<MethodId>(DEFAULT_METHOD);
  // the unit of a method that estimates; empty: a bare number
  const [unit, setUnit] = useState("");
  const estimates = CATALOGUE[method].steps.some((step) => step.vote?.kind === "estimate");
  const [fault, setFault] = useState<TextFault>();
  const [unitFault, setUnitFault] = useState<TextFault>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Exclude<Made, { ok: true }> | null>(null);
  const [asking, setAsking] = useState(false);
  const done = useRef(false);

  const dirty = question.trim() !== "";
  // every way out of the form with a question typed (a link, „Abbrechen“, Back, Forward) is held back and asks.
  // `asking` is set at once; the router's own state follows a moment later, and the question shows when both agree
  const blocker = useBlocker(() => {
    const unsaved = dirty && !done.current;
    if (unsaved) setAsking(true);
    return unsaved;
  });

  // closing or reloading the page with a question typed: the browser's own question, whose text cannot be changed
  useEffect(() => {
    const ask = (event: BeforeUnloadEvent) => {
      if (dirty && !done.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = checkText(question, QUESTION_MAX);
    setFault(found);
    if (found) {
      document.getElementById(FIELD)?.focus();
      return;
    }
    const unitFound = estimates && tidy(unit) !== "" ? checkText(unit, UNIT_MAX) : undefined;
    setUnitFault(unitFound);
    if (unitFound) {
      document.getElementById(UNIT_FIELD)?.focus();
      return;
    }
    setBusy(true);
    setFailure(null);
    const made = await createWall(tidy(question), method, estimates && tidy(unit) !== "" ? tidy(unit) : undefined);
    setBusy(false);
    if (!made.ok) {
      setFailure(made);
      return;
    }
    // this browser made the wall: it knows it from now on and keeps its admin token. At the wall's door it gives
    // its name, and joins as the moderation
    done.current = true;
    const { remember, keepToken } = useWalls.getState();
    remember({ id: made.wall.wallId, question: tidy(question) });
    keepToken(made.wall.wallId, made.wall.adminToken);
    void navigate(`/w/${made.wall.wallId}`);
  };

  const onAnswer = (value: string) => {
    setAsking(false);
    if (blocker.state !== "blocked") return;
    if (value === "discard") blocker.proceed();
    else blocker.reset();
  };

  const label = t("new.question");
  const error =
    fault === "missing"
      ? t("common.missing", { label })
      : fault === "tooLong"
        ? t("common.tooLong", { label, max: QUESTION_MAX })
        : undefined;
  const title = t("new.title");

  return (
    <View name="neu" type="form" title={title} back="/">
      <div className="sb-container">
        <form className="sb-form-grid" id="app-form" aria-label={title} noValidate onSubmit={(e) => void onSubmit(e)}>
          {/* the question is the form: its field takes the whole width, so more of a long one shows */}
          <div className="sb-form-grid__wide">
            <Field id={FIELD} label={label} help={t("new.questionHelp")} error={error}>
              {(control) => (
                <input
                  {...control}
                  type="text"
                  autoComplete="off"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="sb-form-grid__wide">
            <MethodChoice lang={lang} value={method} onChange={setMethod} />
          </div>
          {estimates && (
            <div className="sb-form-grid__wide">
              <Field
                id={UNIT_FIELD}
                label={t("new.unit")}
                optional={t("common.optional")}
                help={t("new.unitHelp")}
                error={
                  unitFault === "tooLong" ? t("common.tooLong", { label: t("new.unit"), max: UNIT_MAX }) : undefined
                }
              >
                {(control) => (
                  <input
                    {...control}
                    type="text"
                    autoComplete="off"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value.replace(/[\p{Cc}\u2028\u2029]/gu, ""))}
                  />
                )}
              </Field>
            </div>
          )}
          <div className="sb-form-grid__actions">
            {/* the reason of a failure: a line of its own in the actions' row, right before them */}
            <p className="sb-form-grid__message" role="alert">
              {failure && (
                <>
                  <Icon name="error--filled-16" size={16} />
                  {failure.why === "spent"
                    ? t("new.spent", { time: clock(lang, failure.resetsAt) })
                    : t(failure.why === "limited" ? "new.limited" : "new.failed")}
                </>
              )}
            </p>
            <button className="sb-secondary-action" type="button" onClick={() => void navigate("/")}>
              {t("common.cancel")}
            </button>
            <button
              className="sb-primary-action"
              type="submit"
              aria-busy={busy || undefined}
              data-sb-progress={busy ? "indeterminate" : undefined}
            >
              <span className="sb-primary-action__label">
                {t(busy ? "new.making" : failure ? "common.retry" : "new.submit")}
              </span>
              <i className="sb-primary-action__bar" aria-hidden="true" />
            </button>
          </div>
          <p className="sb-action-hint sb-form-grid__wide">{t("common.toServer")}</p>
        </form>
      </div>
      <Dialog
        id="app-dlg-unsaved"
        open={asking && blocker.state === "blocked"}
        title={t("new.unsavedTitle")}
        text={t("new.unsavedText")}
        onClose={onAnswer}
      >
        <button className="sb-secondary-action" value="cancel">
          {t("common.cancel")}
        </button>
        <button className="sb-danger-action sb-danger-action--outlined" value="discard">
          {t("common.discard")}
        </button>
      </Dialog>
    </View>
  );
}
