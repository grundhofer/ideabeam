// Licences.tsx: „Lizenzen“, a sub-view of „Über“: what the app ships of others, each with its version and licence.
// The list is made from the dependencies when Vite runs (vite.config.ts); the texts stand in /licences.txt. Below it the
// methods whose licence asks for an attribution (Liberating Structures, CC BY-SA 4.0), each with it.
import { useTranslation } from "react-i18next";
import licences from "virtual:licences";
import {
  CATALOGUE,
  CC_BY_SA_URL,
  LIBERATING_STRUCTURES_URL,
  METHOD_ORDER,
  methodAttribution,
  methodTexts,
} from "@ideabeam/shared";
import { useLang } from "../i18n";
import { View } from "../components/View";

export default function Licences() {
  const { t } = useTranslation();
  const lang = useLang();
  const attributed = METHOD_ORDER.filter((method) => CATALOGUE[method].attribution !== undefined);
  return (
    <View name="lizenzen" type="about" title={t("licences.title")} back="/einstellungen" noPrimary>
      <div className="sb-container">
        <p>{t("licences.text")}</p>
      </div>
      <ul className="sb-list">
        {licences.map(({ name, version, licence }) => (
          <li key={name} className="sb-list-row">
            <div className="sb-list-row__main">
              <p className="sb-list-row__title" translate="no">
                {name}
              </p>
              <p className="sb-list-row__meta">
                {version && <span className="sb-mono">{version}</span>}
                {version && " · "}
                {licence}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="sb-container">
        <p>
          <a href="/licences.txt">{t("licences.texts")}</a>
        </p>
        {attributed.length > 0 && (
          <>
            <h2 className="sb-list-header" id="app-h-methods">
              {t("licences.methods")}
            </h2>
            <p>{t("licences.methodsText")}</p>
            <ul className="sb-list" aria-labelledby="app-h-methods">
              {attributed.map((method) => {
                const words = methodAttribution(lang, method);
                return (
                  <li key={method} className="sb-list-row">
                    <div className="sb-list-row__main">
                      <p className="sb-list-row__title">{methodTexts(lang, method).name}</p>
                      <p className="sb-list-row__meta">
                        {words?.credit} {words?.licence}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p>
              <a href={LIBERATING_STRUCTURES_URL}>{t("new.source")}</a> · <a href={CC_BY_SA_URL}>{t("new.licence")}</a>
            </p>
          </>
        )}
      </div>
    </View>
  );
}
