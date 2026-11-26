// main.tsx: the entry. The routes with their error boundary; once the app has painted, the start ends.
import { lazy, StrictMode, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import "./i18n";
import { ErrorView } from "./components/ErrorView";
import { Shell } from "./components/Shell";
import { adoptKeySwitch } from "./lib/key-switch";
import { adoptAdminLink } from "./lib/links";
import { endStart, holdStart } from "./lib/start";
import StartPage from "./pages/Start";
import { useOwnKey } from "./store/key";
import { useWalls } from "./store/walls";

// what the start does not need is loaded when its route opens
const Walls = lazy(() => import("./pages/Walls"));
const NewWall = lazy(() => import("./pages/NewWall"));
const Wall = lazy(() => import("./pages/Wall"));
const Settings = lazy(() => import("./pages/Settings"));
const Licences = lazy(() => import("./pages/Licences"));
const Legal = lazy(() => import("./pages/Legal"));
const NotFound = lazy(() => import("./pages/NotFound"));

// A new view is one line here and a <View> in src/pages/.
const views: RouteObject[] = [
  { index: true, element: <StartPage /> },
  { path: "waende", element: <Walls /> },
  { path: "neu", element: <NewWall /> },
  // a wall: its address is the capability, /w/ and the id its namespace minted
  { path: "w/:id", element: <Wall /> },
  { path: "einstellungen", element: <Settings /> },
  { path: "lizenzen", element: <Licences /> },
  { path: "impressum", element: <Legal page="imprint" /> },
  { path: "datenschutz", element: <Legal page="privacy" /> },
  { path: "barrierefreiheit", element: <Legal page="accessibility" /> },
  { path: "*", element: <NotFound /> },
];

// every route has an error boundary: a view that fails leaves the shell standing
export const routes: RouteObject[] = [
  {
    element: <Shell />,
    errorElement: <ErrorView />,
    children: views.map((view) => ({ ...view, errorElement: <ErrorView /> })),
  },
];

/** Ends the start once the app, or the error view that stands for a failed one, has painted. */
function Start({ children }: { children: ReactNode }) {
  useEffect(endStart, []);
  return children;
}

const root = document.getElementById("app");
if (root) {
  // A moderation link carries the admin token behind `#`. It is stored and taken out of the address here, before
  // the router reads the address and before anything is drawn; and again when only the fragment changes, which
  // loads nothing (the link pasted over the address of the wall it belongs to). The same for the switch that offers
  // the providers of „Eigener Schlüssel“ whose model is not measured yet (lib/key-switch.ts).
  const adopt = () => {
    adoptAdminLink(useWalls.getState().keepToken);
    adoptKeySwitch(useOwnKey.getState().unlock);
  };
  adopt();
  window.addEventListener("hashchange", adopt);
  holdStart();
  createRoot(root).render(
    <StrictMode>
      <Start>
        <RouterProvider router={createBrowserRouter(routes)} />
      </Start>
    </StrictMode>,
  );
}
