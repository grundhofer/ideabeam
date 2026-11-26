// SiteHeader.tsx: the head of every page that is no wall: the sign and the name as the way to the start, the
// product's two own words („Meine Wände“, „Einstellungen“), the language as „DE / EN“ and the button „Hell oder
// Dunkel“. It is sebaro's site header, as RetroBeam's pages have it (docs/sebaro-luecken.md): the product has a
// front door like a website, and a wall with a head of its own (View.tsx). The button is the copy's theme-button.js
// (index.html): it switches to the other mode and says so in the status line here.
import { Fragment, useId } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { name } from "../../sebaro.product.json";
import { useChoices } from "./choices";
import { SignTile } from "./SignTile";

export function SiteHeader() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { language } = useChoices();
  const group = useId();
  const here = (to: string) => (pathname === to ? "page" : undefined);

  return (
    <header className="sb-site-header">
      <Link className="sb-lockup" to="/" aria-current={here("/")}>
        <SignTile size={32} />
        <span className="sb-wordmark" translate="no">
          {name}
        </span>
      </Link>
      <div className="sb-site-header__links">
        <nav className="sb-site-nav" aria-label={t("nav.label")}>
          <Link to="/waende" aria-current={here("/waende")}>
            {t("nav.walls")}
          </Link>
          <Link to="/einstellungen" aria-current={here("/einstellungen")}>
            {t("nav.settings")}
          </Link>
        </nav>
        <fieldset className="sb-language-switch sb-language-switch--choice">
          <legend className="sb-visually-hidden">{t("more.language")}</legend>
          {language.map(({ value, label, checked, choose }, index) => (
            <Fragment key={value}>
              {index > 0 && <span aria-hidden="true">/</span>}
              <label className="sb-language-switch__option">
                <input type="radio" name={group} value={value} checked={checked} aria-label={label} onChange={choose} />
                <span lang={value} aria-hidden="true">
                  {value.toUpperCase()}
                </span>
              </label>
            </Fragment>
          ))}
        </fieldset>
      </div>
      <button className="sb-theme-button" type="button">
        {t("more.theme")}
      </button>
      <p className="sb-visually-hidden" role="status" data-sb-theme-status />
    </header>
  );
}
