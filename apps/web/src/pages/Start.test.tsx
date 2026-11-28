import { screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { METHOD_ORDER, METHOD_TEXTS, methodTexts } from "@ideabeam/shared";
import i18n from "../i18n";
import { renderApp } from "../test-app";

// The rule of PLAN-METHODEN.md 2 on the start (stage M7): the section „Geführte Methoden“ names every method of the
// catalogue, each with its short description, never a name alone, grouped by purpose as on `/neu`; the methods from
// Liberating Structures with the attribution their licence asks for. The other halves: NewWall.test.tsx and
// packages/shared, test/methods.test.ts.
test.each(["de", "en"] as const)(
  "the start lists every method of the catalogue with its short description (%s)",
  async (lang) => {
    await i18n.changeLanguage(lang);
    try {
      renderApp("/");
      const heading = await screen.findByRole("heading", {
        level: 2,
        name: lang === "de" ? "Geführte Methoden" : "Guided methods",
      });
      const section = heading.closest("section") as HTMLElement;
      // the list loads with its part, after the start
      await within(section).findByText(methodTexts(lang, METHOD_ORDER[0] ?? "still-sammeln").short);
      for (const method of METHOD_ORDER) {
        const { name, short } = methodTexts(lang, method);
        const row = section.querySelector(`[data-method="${method}"]`);
        expect(row?.textContent, method).toContain(name);
        expect(row?.textContent, method).toContain(short);
        expect(row?.closest("[hidden]")).toBeNull();
      }
      // by purpose, as on `/neu`
      const purposes = within(section)
        .getAllByRole("heading", { level: 3 })
        .map((one) => one.textContent);
      expect(purposes).toEqual(
        ["collect", "decide", "plan", "review", "risk", "none"].map(
          (purpose) => METHOD_TEXTS[lang].purposes[purpose as keyof (typeof METHOD_TEXTS)["de"]["purposes"]],
        ),
      );
      // the attribution of Liberating Structures, with the methods it is for
      const credit = within(section).getByTestId("landing-attribution").textContent ?? "";
      expect(credit).toContain(methodTexts(lang, "eins-zwei-vier").name);
      expect(credit).toContain(methodTexts(lang, "was-na-und").name);
      expect(credit).toContain("CC BY-SA 4.0");
      // no evidence word (PLAN-METHODEN.md 7, question 5)
      expect(section.textContent).not.toMatch(/Meta-Analyse|Praktikerkonsens|meta-analysis|practitioner consensus/i);
    } finally {
      await i18n.changeLanguage("de");
    }
  },
);
