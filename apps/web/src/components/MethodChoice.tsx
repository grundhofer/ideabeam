// MethodChoice.tsx: „Methode“ on `/neu`, the choice of the method a wall runs (docs/methoden-katalog.md, (b)). One
// group of option fields under headings by purpose; the method that is chosen at first leads, „Freie Wand“ stands
// last. Every row shows, in this order: the option field with the method's name as its label; under it, always, its
// short description, which a screen reader reads with the name (`aria-describedby`); a line of facts: the time and the
// group size; and „Mehr dazu“, a key of its own outside the label, so pressing it chooses nothing. „Mehr dazu“ opens
// under the row: when it fits, its steps with their form, visibility and minutes, what comes out, the name it is
// known by, and the attribution its licence asks for (Liberating Structures, CC BY-SA 4.0: „1-2-4-Alle“), with links
// to the source and the licence. No evidence level and no evidence sentence: the owner's decision of 2026-11-27
// (PLAN-METHODEN.md 7, question 5).
// The rule of PLAN-METHODEN.md 2: a method never stands here as a bare name (NewWall.test.tsx holds it).
//
// The words of the methods come from the shared package (packages/shared, methods/texts.ts), the words around them
// from the string tables.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CATALOGUE,
  CC_BY_SA_URL,
  LIBERATING_STRUCTURES_URL,
  METHOD_ORDER,
  METHOD_TEXTS,
  methodAttribution,
  PURPOSES,
  type MethodId,
  type MethodLanguage,
} from "@ideabeam/shared";
import { Icon } from "../sebaro/react/Icon";

type Props = {
  lang: MethodLanguage;
  value: MethodId;
  onChange(method: MethodId): void;
};

const id = (method: MethodId, part: string) => `app-method-${method}-${part}`;

export function MethodChoice({ lang, value, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<MethodId | null>(null);
  const words = METHOD_TEXTS[lang];
  // the purposes in their order, each with its methods in the order of the choice
  const groups = PURPOSES.map((purpose) => ({
    purpose,
    methods: METHOD_ORDER.filter((method) => CATALOGUE[method].purpose === purpose),
  })).filter((group) => group.methods.length > 0);

  return (
    <fieldset className="app-methods">
      <legend className="sb-field__label">{t("new.method")}</legend>
      {groups.map(({ purpose, methods }) => (
        <div key={purpose} className="app-methods__group">
          <h2 className="sb-list-header" id={`app-methods-${purpose}`}>
            {words.purposes[purpose]}
          </h2>
          <ul className="sb-list" aria-labelledby={`app-methods-${purpose}`}>
            {methods.map((method) => {
              const texts = words.methods[method];
              const facts = CATALOGUE[method];
              const more = open === method;
              const attribution = methodAttribution(lang, method);
              return (
                <li key={method} className="app-method" data-method={method}>
                  <label className="sb-radio app-method__choice">
                    <input
                      type="radio"
                      name="app-method"
                      value={method}
                      checked={value === method}
                      onChange={() => onChange(method)}
                      aria-describedby={`${id(method, "short")} ${id(method, "facts")}`}
                    />
                    <span className="app-method__name">{texts.name}</span>
                  </label>
                  <p className="app-method__short" id={id(method, "short")}>
                    {texts.short}
                  </p>
                  <div className="app-method__line">
                    <p className="app-method__facts" id={id(method, "facts")}>
                      <span>
                        {facts.minutes === null ? t("new.noTime") : t("new.minutes", { count: facts.minutes })}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{t("new.people", { min: facts.groupSize[0], max: facts.groupSize[1] })}</span>
                    </p>
                    <button
                      type="button"
                      className="sb-text-action app-method__more"
                      aria-expanded={more}
                      aria-controls={id(method, "more")}
                      onClick={() => setOpen(more ? null : method)}
                    >
                      {t("new.more")}
                      <Icon name={more ? "chevron-up" : "chevron-down"} />
                    </button>
                  </div>
                  <div className="app-method__about" id={id(method, "more")} hidden={!more}>
                    <h3 className="app-method__heading">{t("new.when")}</h3>
                    <p>{texts.when}</p>
                    <h3 className="app-method__heading">{t("new.steps")}</h3>
                    <ol className="app-method__steps">
                      {facts.steps.map((step) => (
                        <li key={step.key}>
                          {t(step.durationSec === null ? "new.stepOpen" : "new.step", {
                            name: texts.steps[step.key]?.name ?? step.key,
                            mode: words.modes[step.mode],
                            visibility: words.visibility[step.visibility],
                            count: Math.round((step.durationSec ?? 0) / 60),
                          })}
                        </li>
                      ))}
                    </ol>
                    <p>
                      {facts.minutes === null
                        ? t("new.totalOpen", { min: facts.groupSize[0], max: facts.groupSize[1] })
                        : t("new.total", { count: facts.minutes, min: facts.groupSize[0], max: facts.groupSize[1] })}
                    </p>
                    <h3 className="app-method__heading">{t("new.result")}</h3>
                    <p>{texts.result}</p>
                    {texts.aka !== undefined && (
                      <>
                        <h3 className="app-method__heading">{t("new.aka")}</h3>
                        <p>{texts.aka}</p>
                      </>
                    )}
                    {attribution !== null && (
                      <>
                        <h3 className="app-method__heading">{t("new.attribution")}</h3>
                        <p>
                          {attribution.credit} {attribution.licence}
                        </p>
                        <p>
                          <a href={LIBERATING_STRUCTURES_URL}>{t("new.source")}</a> ·{" "}
                          <a href={CC_BY_SA_URL}>{t("new.licence")}</a>
                        </p>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </fieldset>
  );
}
