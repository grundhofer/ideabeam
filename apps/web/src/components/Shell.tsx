// Shell.tsx: what stands around every view: the skip link, the view the address names, and the command palette.
// Each view brings its own head and footer (View.tsx).
import { Suspense, useLayoutEffect, useRef, type MouseEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router";
import { Commands } from "./Commands";

// what the command palette offers as places: the start and the two pages the site's head names
const PLACES = [
  { to: "/", title: "nav.start" },
  { to: "/waende", title: "walls.title" },
  { to: "/einstellungen", title: "settings.title" },
] as const;

/** The part of the view an address names behind `#` (a section of the privacy notice), or null: the address names
 *  none, or the view has no such part. */
function partNamed(hash: string): HTMLElement | null {
  try {
    const id = decodeURIComponent(hash.replace(/^#/, ""));
    return id === "" ? null : document.getElementById(id);
  } catch {
    // no name a browser could have written
    return null;
  }
}

/** A new view has arrived: its heading takes the focus, so keyboard and screen reader start where the content
 *  starts. Not on the first load (`shownRef` starts as the address the shell started with), where the focus
 *  belongs to the browser. It stands beside the view inside its Suspense, so it runs once a view that had to be
 *  loaded is there; a layout effect: the focus moves in the same step in which the heading appears, not a moment
 *  after it.
 *
 *  An address that names a part of the view (`/datenschutz#ordnen`, the line under „Ordnen“ leads there) shows
 *  that part, as a page that was loaded would. The browser does that by itself only for a part that is there when
 *  it looks, and a view that has to be loaded is not: so it is done here, on the first load too. */
function Arrival({ shownRef }: { shownRef: RefObject<string> }) {
  const { pathname, hash } = useLocation();
  const first = useRef(true);
  useLayoutEffect(() => {
    const onLoad = first.current;
    first.current = false;
    if (shownRef.current === pathname) {
      if (onLoad) partNamed(hash)?.scrollIntoView();
      return;
    }
    shownRef.current = pathname;
    document.querySelector<HTMLElement>("[data-sb-view] h1")?.focus();
    // the new view starts at the part its address names, else at its top, as a page that was loaded would
    const part = partNamed(hash);
    if (part !== null) part.scrollIntoView();
    else window.scrollTo(0, 0);
    // a new view, not a new part of the one that stands: within a view the browser follows the address itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, shownRef]);
  return null;
}

export function Shell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const shown = useRef(pathname);

  // the skip link moves the focus and leaves the address as it is
  const skip = (event: MouseEvent) => {
    event.preventDefault();
    document.getElementById("inhalt")?.focus();
  };

  return (
    <>
      <a className="sb-skip-link" href="#inhalt" onClick={skip}>
        {t("app.skip")}
      </a>
      <Suspense>
        <Outlet />
        <Arrival shownRef={shown} />
      </Suspense>
      <Commands places={PLACES.map(({ to, title }) => ({ to, label: t(title) }))} />
    </>
  );
}
