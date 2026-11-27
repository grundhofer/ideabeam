// View.tsx: the frame of every view. A page is, from top to bottom: its head, its content, its action zone, and the
// footer with „Impressum“ and „Datenschutz“, which is always the last thing on the page and at the bottom of the
// window when the content is short. The action zone stands right above the footer, never under it; while a long page
// scrolls it stays at the window's bottom edge (sebaro's bottom block).
//
// Two heads. Every page that is no wall has the site's head (SiteHeader.tsx) and its content in one column of
// reading width in the middle, like RetroBeam's pages. A wall has a head of its own: the sign and the name as the
// way to the start, the wall's name as the title, and „Mehr“ with „Hell oder Dunkel“, „Farbton“ and the language.
// There is no navigation at the edge: the product has two places beside its start, and the site's head names them.
//
// The frame is FokusBeam's, built there on 2026-11-22 after the owner's word on that product's first interface
// (docs/HERKUNFT.md, docs/sebaro-luecken.md).
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { name as product } from "../../sebaro.product.json";
import { REPO_URL } from "../content/operator";
import { sourceUrl } from "../lib/source";
import { Icon } from "../sebaro/react/Icon";
import type { MenuEntry } from "../sebaro/react/Menu";
import { Toast } from "../sebaro/react/Toast";
import { useToast } from "../store/toast";
import { More } from "./More";
import { SignTile } from "./SignTile";
import { SiteHeader } from "./SiteHeader";

// „GitHub“ in the footer: the source of the version that is running (lib/source.ts)
const source = sourceUrl(REPO_URL, import.meta.env.VITE_COMMIT_SHA);

type Props = {
  /** the name of the view (data-sb-view) */
  name: string;
  /** its view type, a key of the Blueprint's design/views.md: the copy's check of a view reads it */
  type:
    | "overview"
    | "list"
    | "detail"
    | "form"
    | "tool"
    | "result"
    | "settings"
    | "about"
    | "state-empty"
    | "state-loading"
    | "state-error";
  /** the title: of the document and the view's first heading, a short noun */
  title: string;
  /** what the tab says where that is more than the title: a wall while its clock runs names the time left first */
  tab?: string;
  /** where the view's „Zurück“ leads, a line at the top of its content. A wall shows none: the sign and the name
   *  in its head lead to the start */
  back?: string;
  /** the view has no primary action, on purpose */
  noPrimary?: boolean;
  /** the wall's own head instead of the site's */
  wall?: boolean;
  /** in a wall's head, before „Mehr“: the wall's one visible tool */
  tools?: ReactNode;
  /** the wall's own entries of „Mehr“: `first` before the choices of appearance, `last` (what deletes) after them */
  more?: { first?: MenuEntry[]; last?: MenuEntry[] };
  /** the content takes the page's whole width (the sections of the start, the surface of a wall) instead of one
   *  column of reading width */
  wide?: boolean;
  /** the view writes its first heading itself (the claim of the start); `title` then names the tab alone */
  ownHeading?: boolean;
  /** the action zone (ActionZone of the copy): the state sentence and the one primary action */
  zone?: ReactNode;
  /** the content */
  children: ReactNode;
};

export function View(props: Props) {
  const { name, type, title, tab, back, noPrimary, wall, tools, more, wide, ownHeading, zone, children } = props;
  const { t } = useTranslation();
  const toast = useToast();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = t("app.title", { view: tab ?? title });
  }, [t, title, tab]);

  // The zone stays at the window's bottom edge while the page scrolls. A field that takes the focus must stop above
  // it: the page's scroll padding is the zone's height, measured, so it holds with a second line and at large text.
  const hasZone = zone !== undefined && zone !== null && zone !== false;
  useEffect(() => {
    const block = root.current?.querySelector<HTMLElement>(".sb-bottom-block");
    if (!block) return;
    const page = document.documentElement;
    const observer = new ResizeObserver(() =>
      page.style.setProperty("--sb-bottom-block-size", `${block.getBoundingClientRect().height}px`),
    );
    observer.observe(block);
    return () => {
      observer.disconnect();
      page.style.removeProperty("--sb-bottom-block-size");
    };
  }, [hasZone, name]);

  const heading = `app-view-${name}`;
  const under = back !== undefined && !wall;

  return (
    <div
      ref={root}
      className={wall ? "sb-view sb-view--wide app-page app-page--wall" : "sb-view app-page"}
      data-sb-view={name}
      data-sb-view-type={type}
      data-sb-primary-expected={noPrimary ? "0" : undefined}
    >
      {wall ? (
        <header className="sb-top-bar app-wall-head" data-sb-web-app-head>
          <Link className="sb-lockup" to="/">
            <SignTile size={32} />
            <span className="sb-wordmark" translate="no">
              {product}
            </span>
          </Link>
          <div className="sb-top-bar__heading">
            <div className="sb-top-bar__text">
              <h1 className="sb-top-bar__title" id={heading} tabIndex={-1}>
                {title}
              </h1>
            </div>
          </div>
          <div className="sb-top-bar__actions">
            {tools}
            <More first={more?.first} last={more?.last} />
          </div>
        </header>
      ) : (
        <SiteHeader />
      )}
      <main
        className={wide ? "app-main app-main--wide" : "app-main"}
        id="inhalt"
        aria-labelledby={ownHeading ? undefined : heading}
        tabIndex={-1}
      >
        {under && (
          <p className="app-back">
            <Link to={back}>
              <Icon name="arrow-left--16" size={16} />
              {t("common.back")}
            </Link>
          </p>
        )}
        {!wall && !ownHeading && (
          <h1 className="app-title" id={heading} tabIndex={-1}>
            {title}
          </h1>
        )}
        <div className="sb-view__content">{children}</div>
        {zone}
        <div className="app-toast-place">
          <Toast id="app-toast" message={toast.message} undoWord={t("common.undo")} onHide={toast.hide} />
        </div>
      </main>
      {/* „Impressum“, „Datenschutz“ and „Barrierefreiheit“ always; „GitHub“ with the external-link icon once the
          product's repository is public (under the AGPL always, with the title „Quelltext“) */}
      <footer className="sb-site-footer">
        <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
        <ul className="sb-site-footer__links">
          <li>
            <Link to="/impressum">{t("legal.imprint")}</Link>
          </li>
          <li>
            <Link to="/datenschutz">{t("legal.privacy")}</Link>
          </li>
          <li>
            <Link to="/barrierefreiheit">{t("legal.accessibility")}</Link>
          </li>
          {source !== null && (
            <li>
              <a href={source} target="_blank" rel="noreferrer" title={t("footer.source")}>
                {t("footer.github")}
                <Icon name="external-link--16" size={16} />
              </a>
            </li>
          )}
        </ul>
      </footer>
    </div>
  );
}
