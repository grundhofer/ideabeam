// LandingMethods.tsx: the methods on the start (stage M7, docs/methoden-katalog.md (a)): every method of the
// catalogue by name and, always with it, its short description (PLAN-METHODEN.md 2: a method never stands as a bare
// name), grouped by purpose as on `/neu`; under the methods from Liberating Structures the attribution their licence
// asks for, with the links to the source and the licence. No evidence level and no evidence sentence (PLAN-METHODEN.md
// 7, question 5). The words of the methods stand in the shared package and are loaded with this part alone, never at
// the app's start (pages/Start.tsx loads it with `lazy`; tests/worker.spec.ts reads the start's files for them).
import { useTranslation } from "react-i18next";
import {
  CATALOGUE,
  CC_BY_SA_URL,
  LIBERATING_STRUCTURES_URL,
  METHOD_ORDER,
  METHOD_TEXTS,
  methodAttribution,
  PURPOSES,
  type MethodLanguage,
} from "@ideabeam/shared";

export default function LandingMethods({ lang }: { lang: MethodLanguage }) {
  const { t } = useTranslation();
  const words = METHOD_TEXTS[lang];
  const groups = PURPOSES.map((purpose) => ({
    purpose,
    methods: METHOD_ORDER.filter((method) => CATALOGUE[method].purpose === purpose),
  })).filter((group) => group.methods.length > 0);
  const attributed = METHOD_ORDER.filter((method) => CATALOGUE[method].attribution !== undefined);
  const attribution = attributed[0] === undefined ? null : methodAttribution(lang, attributed[0]);
  return (
    <div className="app-landing-methods">
      <div className="app-landing-grid app-landing-grid--two">
        {groups.map(({ purpose, methods }) => (
          <section className="sb-stack" key={purpose} aria-labelledby={`app-h-methods-${purpose}`}>
            <h3 id={`app-h-methods-${purpose}`}>{words.purposes[purpose]}</h3>
            <ul className="app-landing-methods__list">
              {methods.map((method) => (
                <li key={method} data-method={method}>
                  <p className="app-landing-methods__name">{words.methods[method].name}</p>
                  <p className="app-landing-methods__short">{words.methods[method].short}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {attribution !== null && (
        <p className="app-muted app-measure app-landing-methods__credit" data-testid="landing-attribution">
          {t("landing.methods.attribution", {
            methods: new Intl.ListFormat(lang, { type: "conjunction" }).format(
              attributed.map((method) => words.methods[method].name),
            ),
            credit: attribution.credit,
          })}{" "}
          <a href={LIBERATING_STRUCTURES_URL}>{t("new.source")}</a> · <a href={CC_BY_SA_URL}>{t("new.licence")}</a>
        </p>
      )}
    </div>
  );
}
