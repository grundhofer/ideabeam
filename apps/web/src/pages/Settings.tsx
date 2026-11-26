// Settings.tsx: „Einstellungen“: the tone, „Bewegung immer reduzieren“ and „Über“. „Hell oder Dunkel“ and the
// language stand in the site's head, and in a wall's „Mehr“ menu with the tone. No action zone: every choice
// applies at once. „Über“ shows the sign
// tile, the name and the version, then the sender with the copy's key mark, where the data lies and the way to
// the licences.
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { version } from "../../package.json";
import { name } from "../../sebaro.product.json";
import { useChoices } from "../components/choices";
import { Segmented } from "../components/Segmented";
import { SignTile } from "../components/SignTile";
import { View } from "../components/View";
import keymark from "../sebaro/brand/inline/keymark-small.svg?raw";
import keymarkDark from "../sebaro/brand/inline/keymark-small.dark.svg?raw";
import { Icon } from "../sebaro/react/Icon";
import { Switch } from "../sebaro/react/Switch";
import { useAppearance } from "../store/appearance";

export default function Settings() {
  const { t } = useTranslation();
  const { reduceMotion, setReduceMotion } = useAppearance();
  const { tone } = useChoices();

  return (
    <View name="einstellungen" type="settings" title={t("settings.title")} noPrimary>
      <div className="sb-container sb-stack sb-stack--group">
        <div className="app-tone">
          <Segmented
            legend={t("more.tone")}
            options={tone.map(({ value, label }) => ({ value, label }))}
            value={tone.find(({ checked }) => checked)?.value ?? "cool"}
            onChange={(value) => tone.find((choice) => choice.value === value)?.choose()}
          />
        </div>
        <Switch
          label={t("settings.motion")}
          help={t("settings.motionHelp")}
          checked={reduceMotion}
          onChange={setReduceMotion}
        />
        <h2 className="sb-type-title" id="app-about-h">
          {t("settings.about")}
        </h2>
      </div>
      {/* the about head, the sender and the rows of a list bring the view's gutter themselves */}
      <section className="sb-stack" aria-labelledby="app-about-h">
        <div className="sb-about-head">
          <SignTile size={64} />
          <div className="sb-about-head__text">
            <h3 className="sb-about-head__name">{name}</h3>
            <p className="sb-about-head__meta">
              {t("settings.version")} <span className="sb-mono">{version}</span>
            </p>
          </div>
        </div>
        <div className="sb-sender">
          <p>{t("settings.sender")}</p>
          <span className="sb-keymark sb-keymark--small" role="img" aria-label={t("settings.senderName")}>
            <span className="sb-keymark__light" dangerouslySetInnerHTML={{ __html: keymark }} />
            <span className="sb-keymark__dark" dangerouslySetInnerHTML={{ __html: keymarkDark }} />
          </span>
        </div>
        <div className="sb-container">
          <dl className="sb-meta-list">
            <div>
              <dt>{t("settings.storage")}</dt>
              <dd>{t("settings.storageValue")}</dd>
            </div>
          </dl>
        </div>
        <ul className="sb-list">
          <li className="sb-list-row">
            <div className="sb-list-row__main">
              <p className="sb-list-row__title">
                <Link className="sb-list-row__link" to="/lizenzen">
                  {t("licences.title")}
                </Link>
              </p>
            </div>
            <span className="sb-list-row__trail">
              <Icon name="chevron-right" />
            </span>
          </li>
        </ul>
      </section>
    </View>
  );
}
