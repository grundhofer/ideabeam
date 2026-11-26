// OwnKeyAsk.tsx: „Eigener KI-Schlüssel“, the moderation's dialog for its own key (PLAN.md 4.5): which provider
// „Ordnen“ asks, with what each provider does with the notes, and the key for it. An input dialog after sebaro's
// part „Dialog“; that it also carries a choice is this product's deviation (docs/sebaro-luecken.md).
//
// The key is typed into a password field and read from it once, when „Übernehmen“ is pressed: it is never the value
// of a state here, never shown again, and gone with the field when the dialog closes. What is kept is kept by
// store/key.ts, in this tab's memory alone.
import { useEffect, useState, type KeyboardEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { centsPerWall, modelOf, type Provider, type ProviderId } from "@ideabeam/arrange";
import { useLang, type Lang } from "../i18n";
import { num } from "../lib/format";
import { Dialog } from "../sebaro/react/Dialog";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";
import { keyFault, type OwnKey } from "../store/key";

/** What a provider does with the notes, as the words after „… an Mistral:“: where it computes, how long it keeps
 *  them, whether it trains on them. The facts are the provider's own statements (packages/arrange, providers.ts);
 *  the sentence says whose word a statement is. */
export function providerFacts(t: TFunction, { name: provider, facts }: Provider): string {
  return t("key.facts", {
    place: t(`key.place.${facts.place}`, { provider }),
    kept: t(facts.keptLongerWhenFlagged ? "key.keptLonger" : "key.kept", { days: facts.keptDays }),
    training: t(`key.training.${facts.training}`, { provider }),
  });
}

/** What a wall of 250 notes costs at a provider, in US cents, as a round number: an estimate from its price list
 *  has no more than two digits that mean something. (Rounded by hand: 0.225 is a hair less than itself as a
 *  machine holds it, and would round down.) */
export function providerCents(lang: Lang, provider: Provider): string {
  const cents = centsPerWall(modelOf(provider));
  if (!(cents > 0)) return num(lang, 0);
  const scale = 10 ** (1 - Math.floor(Math.log10(cents)));
  return num(lang, Math.round(cents * scale + 1e-9) / scale);
}

const DIALOG = "app-dlg-key";
const FIELD = "app-f-key";
const CHOICE = "app-key-provider";

type Props = {
  open: boolean;
  /** the providers on offer (packages/arrange, `offered`) */
  providers: ReadonlyArray<Provider>;
  /** the provider a key is set for, or null: none is set */
  current: ProviderId | null;
  /** a key was taken, the key was removed, or null: the dialog was put away */
  onClose(answer: { is: "taken"; own: OwnKey } | { is: "removed" } | null): void;
};

/** „Eigener KI-Schlüssel“: the providers as radio rows, each with what it does with the notes and what a wall
 *  costs there (the chosen provider's line shows); the field for the key; then „Abbrechen“ and „Übernehmen“. With
 *  a key set, a line says for which provider, and „Schlüssel entfernen“ stands beside it. It opens on the provider
 *  that is chosen. */
export function OwnKeyAsk({ open, providers, current, onClose }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  // the provider picked in the dialog while it is open; before that the one a key is set for, else the first
  const [picked, setPicked] = useState<ProviderId | null>(null);
  const [fault, setFault] = useState<"missing" | "malformed">();
  const chosen = providers.find((provider) => provider.id === (picked ?? current)) ?? providers[0];
  const holder = providers.find((provider) => provider.id === current);

  // The dialog of the copy opens on its first action. Here the choice comes first: the focus goes to the chosen
  // row, where the arrow keys change it (this effect runs after the dialog's own).
  useEffect(() => {
    if (open) document.querySelector<HTMLInputElement>(`#${DIALOG} input:checked`)?.focus();
  }, [open]);
  // In a low window the dialog's body scrolls. The focus brings the field into view; the sentence that says what is
  // wrong with it stands under the field and has to be in view too.
  useEffect(() => {
    if (fault !== undefined) document.getElementById(`${FIELD}-error`)?.scrollIntoView({ block: "nearest" });
  }, [fault]);

  const field = () => document.querySelector<HTMLInputElement>(`#${FIELD}`);
  // Enter in a form presses its first button, which is „Abbrechen“: on the choice and in the field it means
  // „Übernehmen“.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    document.querySelector<HTMLButtonElement>(`#${DIALOG} button[value="take"]`)?.click();
  };

  if (chosen === undefined) return null;
  const label = t("key.field");
  return (
    <Dialog
      id={DIALOG}
      open={open}
      title={t("key.title")}
      text={t("key.text")}
      // the form is there while the dialog is: each time it opens with an empty field
      body={
        open && (
          <div className="app-key" onKeyDown={onKeyDown}>
            {holder !== undefined && (
              <p className="app-key__set">
                <span>{t("key.set", { provider: holder.name })}</span>
                <button className="sb-text-action" value="remove">
                  {t("key.remove")}
                </button>
              </p>
            )}
            <fieldset className="app-choice">
              <legend className="app-choice__legend">{t("key.provider")}</legend>
              {providers.map((provider) => (
                <label className="sb-radio" key={provider.id}>
                  <input
                    type="radio"
                    name={CHOICE}
                    value={provider.id}
                    checked={provider.id === chosen.id}
                    aria-describedby={`${CHOICE}-${provider.id}`}
                    onChange={() => setPicked(provider.id)}
                  />
                  <span>{provider.name}</span>
                </label>
              ))}
              {/* What each provider does with the notes and what a wall costs there. The chosen one's line shows,
                  under the rows, so the rows keep their places; every row is described by its own line, shown or
                  not, so a screen reader hears it with the row */}
              {providers.map((provider) => (
                <p
                  className="app-choice__note"
                  id={`${CHOICE}-${provider.id}`}
                  key={provider.id}
                  hidden={provider.id !== chosen.id}
                >
                  {t("key.line", { facts: providerFacts(t, provider), cents: providerCents(lang, provider) })}
                  {!provider.measured && <> {t("key.unmeasured", { provider: provider.name })}</>}
                </p>
              ))}
            </fieldset>
            <Field
              id={FIELD}
              label={label}
              help={holder === undefined ? undefined : t("key.replaces")}
              error={
                fault === "missing"
                  ? t("common.missing", { label })
                  : fault === "malformed"
                    ? t("key.malformed")
                    : undefined
              }
            >
              {(control) => (
                <input
                  {...control}
                  type="password"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  // (not `required`: the browser's own check would then hold back every action of the dialog's
                  // form, „Abbrechen“ and „Schlüssel entfernen“ among them, while the field is empty)
                  aria-required="true"
                  onInput={() => setFault(undefined)}
                />
              )}
            </Field>
            <p className="app-key__page">
              <a href={chosen.keyPage} target="_blank" rel="noreferrer">
                {t("key.page", { provider: chosen.name })}
                <Icon name="external-link--16" size={16} />
              </a>
            </p>
          </div>
        )
      }
      onClose={(value) => {
        const key = (field()?.value ?? "").trim();
        const taken = value === "take" && keyFault(key) === undefined;
        setPicked(null);
        setFault(undefined);
        onClose(
          taken ? { is: "taken", own: { provider: chosen.id, key } } : value === "remove" ? { is: "removed" } : null,
        );
      }}
    >
      <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
        {t("common.cancel")}
      </button>
      {/* the key and, right after it, where what it takes goes (sebaro core rule 16) */}
      <div className="sb-dialog__action">
        <button
          className="sb-secondary-action"
          value="take"
          onClick={(event) => {
            const found = keyFault(field()?.value ?? "");
            if (found === undefined) return;
            // the dialog stays, and the field says what is wrong with what it holds
            event.preventDefault();
            setFault(found);
            field()?.focus();
          }}
        >
          {t("key.take")}
        </button>
        {/* (while the dialog is open: closed, its markup stays in the page, and the wall has hints of its own) */}
        {open && <p className="sb-action-hint">{t("key.stays")}</p>}
      </div>
    </Dialog>
  );
}
