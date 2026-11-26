import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { name } from "../sebaro.product.json";
import { ErrorView } from "./components/ErrorView";
import { Shell } from "./components/Shell";
import { useWalls } from "./store/walls";
import { renderApp } from "./test-app";

/** a page's link in the site's head */
const place = (to: string) => document.querySelector<HTMLElement>(`.sb-site-nav a[href="${to}"]`)!;
/** the view type of the view that stands */
const viewType = () => document.querySelector("[data-sb-view]")?.getAttribute("data-sb-view-type");

test("the start says what the product is and leads to a wall; a page opens with the focus on its heading", async () => {
  renderApp("/");
  expect(viewType()).toBe("overview");
  expect(screen.getByRole("heading", { level: 1, name: "Alle schreiben Zettel, eine KI ordnet sie." })).toBeTruthy();
  // the action stands at both ends of the page: the primary one first, outlined at the end
  const open = screen.getAllByRole("link", { name: "Neue Wand" });
  expect(open.map((link) => link.getAttribute("href"))).toEqual(["/neu", "/neu"]);
  expect(open.map((link) => link.className)).toEqual(["sb-primary-action", "sb-secondary-action"]);
  // nothing leads back onto a wall in a browser that was on none
  expect(screen.queryByRole("link", { name: /^Weiter zu/ })).toBeNull();
  fireEvent.click(place("/einstellungen"));
  const heading = await screen.findByRole("heading", { level: 1, name: "Einstellungen" });
  expect(document.activeElement).toBe(heading);
  // the title follows in an effect, a moment after the heading stands
  await waitFor(() => expect(document.title).toBe(`Einstellungen · ${name}`));
  expect(place("/einstellungen").getAttribute("aria-current")).toBe("page");
});

test("a browser that was on a wall finds it again: on the start, and in „Meine Wände“ with the last one first", async () => {
  const { remember } = useWalls.getState();
  remember({ id: "a".repeat(64), question: "Was hält uns auf?", as: "Anna" });
  // a wall this browser made and has not joined yet
  remember({ id: "b".repeat(64), question: "Was feiern wir?" });
  renderApp("/");
  expect(viewType()).toBe("overview");
  expect(screen.getByRole("link", { name: "Weiter zu „Was feiern wir?“" }).getAttribute("href")).toBe(
    `/w/${"b".repeat(64)}`,
  );

  fireEvent.click(place("/waende"));
  expect(await screen.findByRole("heading", { level: 1, name: "Meine Wände" })).toBeTruthy();
  expect(viewType()).toBe("list");
  const rows = [...document.querySelectorAll(".sb-list-row")];
  expect(rows.map((row) => row.querySelector(".sb-list-row__link")?.textContent)).toEqual([
    "Was feiern wir?",
    "Was hält uns auf?",
  ]);
  expect(rows[0]?.querySelector(".sb-list-row__meta")?.textContent).toMatch(/^Angelegt am \d\d\.\d\d\.\d{4}$/);
  expect(rows[1]?.querySelector(".sb-list-row__meta")?.textContent).toMatch(/^Zuletzt am \d\d\.\d\d\.\d{4} als Anna$/);
  expect(rows[1]?.querySelector("a")?.getAttribute("href")).toBe(`/w/${"a".repeat(64)}`);
  expect(place("/waende").getAttribute("aria-current")).toBe("page");
});

test("„Meine Wände“ without a wall says how it fills", async () => {
  renderApp("/waende");
  expect(await screen.findByRole("heading", { level: 1, name: "Meine Wände" })).toBeTruthy();
  expect(viewType()).toBe("state-empty");
  expect(screen.getByText("Noch keine Wände")).toBeTruthy();
});

test("an address that is no wall's says so without asking the server", async () => {
  const fetched = vi.spyOn(globalThis, "fetch");
  renderApp("/w/keine-wand");
  expect(await screen.findByRole("heading", { level: 1, name: "Unbekannte Wand" })).toBeTruthy();
  expect(viewType()).toBe("state-error");
  expect(fetched).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

test("the language in the site's head swaps the words without a reload and stores the choice", async () => {
  renderApp("/");
  fireEvent.click(screen.getByRole("radio", { name: "English" }));
  expect(
    await screen.findByRole("heading", { level: 1, name: "Everyone writes notes, an AI groups them." }),
  ).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "New wall" })).toHaveLength(2);
  expect(document.documentElement.lang).toBe("en");
  expect(localStorage.getItem("sb-lang")).toBe("en");
});

test("an address that leads nowhere shows the not-found view", async () => {
  renderApp("/gibt-es-nicht");
  expect(await screen.findByRole("heading", { level: 1, name: "Unbekannte Adresse" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Zum Start" }).getAttribute("href")).toBe("/");
});

test("a view that fails says so and what to do; the shell stays", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined); // React reports the thrown error there
  const Broken = () => {
    throw new Error("broken on purpose");
  };
  renderApp("/", [
    { element: <Shell />, children: [{ index: true, element: <Broken />, errorElement: <ErrorView /> }] },
  ]);
  expect(await screen.findByRole("heading", { level: 1, name: "Fehler" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Noch mal versuchen" })).toBeTruthy();
  expect(place("/einstellungen")).toBeTruthy();
  vi.restoreAllMocks();
});
