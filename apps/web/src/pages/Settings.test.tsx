import { act, fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { version } from "../../package.json";
import { name } from "../../sebaro.product.json";
import i18n from "../i18n";
import { renderApp } from "../test-app";

test("„Über“ shows the tile, the name, the version and the sender, in German and in English", async () => {
  renderApp("/einstellungen");
  expect(await screen.findByRole("heading", { level: 3, name })).toBeTruthy();
  expect(document.querySelector(".sb-about-head > .sb-sign-tile.sb-sign-tile--64 > svg")).toBeTruthy();
  expect(document.querySelector(".sb-about-head__meta")?.textContent).toBe(`Version ${version}`);
  expect(screen.getByText("Ein Werkzeug von").closest(".sb-sender")).toBeTruthy();
  expect(document.querySelector('.sb-sender > .sb-keymark[role="img"]')?.getAttribute("aria-label")).toBe("sebaro");
  await act(() => i18n.changeLanguage("en"));
  expect(screen.getByRole("heading", { level: 2, name: "About" })).toBeTruthy();
  expect(screen.getByText("A tool by")).toBeTruthy();
});

test("„Lizenzen“ lists what the dependencies and the copy bring, each with its licence", async () => {
  renderApp("/einstellungen");
  fireEvent.click(await screen.findByRole("link", { name: "Lizenzen" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Lizenzen" })).toBeTruthy();
  const rows = [...document.querySelectorAll(".sb-list-row")].map((row) => row.textContent);
  expect(rows).toContainEqual(expect.stringMatching(/^react\d+\.\d+\.\d+ · MIT$/));
  expect(rows).toContain("sebaro Sans, sebaro MonoOFL-1.1");
});
