// Licences.tsx: „Lizenzen“, a sub-view of „Über“: what the app ships of others, each with its version and licence.
// The list is made from the dependencies when Vite runs (vite.config.ts); the texts stand in /licences.txt.
import { useTranslation } from "react-i18next";
import licences from "virtual:licences";
import { View } from "../components/View";

export default function Licences() {
  const { t } = useTranslation();
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
      </div>
    </View>
  );
}
