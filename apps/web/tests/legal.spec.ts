// The three legal texts: „Impressum“, „Datenschutz“ and „Barrierefreiheit“. The footer of every kind of page links
// all three; the accessibility statement renders in German and in English with its date, the draft's notice while
// operator.ts holds a placeholder, and the operator's contact for reporting a barrier; and the three texts pass axe
// light and dark at 390 and 1440 px in both languages. tests/screens.spec.ts checks them with everything else it
// looks at (light at 390 px, dark at 1440 px, German); here are the pairings and the language it leaves out, as the
// statement says they are checked.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { enter } from "./app";
import { collectCut, sidewaysScroll } from "./sebaro-checks";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const LEGAL = { "/impressum": "imprint", "/datenschutz": "privacy", "/barrierefreiheit": "accessibility" } as const;
const FOOTER = { de: ["Impressum", "Datenschutz", "Barrierefreiheit"], en: ["Imprint", "Privacy", "Accessibility"] };
const heading = (page: Page) => page.locator("[data-sb-view] h1");
const footerLinks = (page: Page) => page.locator(".sb-site-footer__links a[href^='/']");

async function inEnglish(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("sb-lang", "en"));
}

test("the footer of every kind of page links the three legal texts, and each link opens its page", async ({ page }) => {
  await page.goto("/");
  const { wallId } = await enter(page, { hidden: false, notes: ["Weniger Termine"] });
  // the start, a list, a form, a wall, its door for a wall that does not exist, settings, an about page, the legal
  // texts themselves and an unknown address
  for (const path of [
    "/",
    "/waende",
    "/neu",
    `/w/${wallId}`,
    "/w/keine-wand",
    "/einstellungen",
    "/lizenzen",
    ...Object.keys(LEGAL),
    "/gibt-es-nicht",
  ]) {
    await page.goto(path);
    await expect(heading(page)).not.toHaveCount(0);
    await expect(footerLinks(page), path).toHaveText(FOOTER.de);
    expect(await footerLinks(page).evaluateAll((links) => links.map((a) => a.getAttribute("href"))), path).toEqual([
      "/impressum",
      "/datenschutz",
      "/barrierefreiheit",
    ]);
  }
  // from a wall, whose footer lies under the window's edge, the link still leads to the statement
  await page.goto(`/w/${wallId}`);
  await page.locator('.sb-site-footer a[href="/barrierefreiheit"]').click();
  await expect(page).toHaveURL(/\/barrierefreiheit$/);
  await expect(heading(page)).toHaveText("Barrierefreiheit");
  await expect(heading(page)).toBeFocused();

  // in English the same three, in the same order and at the same addresses
  await page.evaluate(() => localStorage.setItem("sb-lang", "en"));
  await page.goto("/neu");
  await expect(footerLinks(page)).toHaveText(FOOTER.en);
});

test("the accessibility statement in German: its date, the draft's notice, the checks and how to report a barrier", async ({
  page,
}) => {
  await page.goto("/barrierefreiheit");
  await expect(heading(page)).toHaveText("Barrierefreiheit");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator('[data-sb-view="accessibility"]')).toHaveCount(1);
  const text = page.locator(".sb-prose");
  await expect(text.locator("p").first()).toHaveText(/^Stand: \d{1,2}\.\d{1,2}\.\d{4}$/);
  // operator.ts is filled for the launch: no draft's notice, and the statement holds no placeholder
  await expect(page.locator(".sb-callout--warning")).toHaveCount(0);
  await expect(text.locator("mark")).toHaveCount(0);
  await expect(text.locator("h2")).toHaveText([
    "Was IdeaBeam ist",
    "So benutzt du IdeaBeam",
    "Anforderungen und Prüfstand",
    "Bekannte Einschränkungen",
    "Barrieren melden",
  ]);
  // no conformance is claimed: the target, „teilweise“, and checks that never ran stand as „offen“
  await expect(text).toContainText("WCAG) 2.2");
  await expect(text).toContainText("teilweise vereinbar");
  await expect(text).toContainText(
    "Screenreader, zum Beispiel VoiceOver, NVDA oder TalkBack, auf der Fläche und in der Liste: offen.",
  );
  // the operator's exception from the BFSG, and the statement published all the same
  await expect(text).toContainText("Nach Angabe des Betreibers fällt IdeaBeam unter eine Ausnahme");
  await expect(text).toContainText("Diese Erklärung wird freiwillig veröffentlicht");
  await expect(text).not.toContainText("Marktüberwachung");
  // the way to report a barrier is the operator's contact from operator.ts
  await expect(text).toContainText("info@sebaro-ventures.de");
});

test("the accessibility statement in English: the same page, its own language", async ({ page }) => {
  await inEnglish(page);
  await page.goto("/barrierefreiheit");
  await expect(heading(page)).toHaveText("Accessibility");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const text = page.locator(".sb-prose");
  await expect(text.locator("p").first()).toHaveText(/^As of \d{4}-\d{2}-\d{2}$/);
  await expect(page.locator(".sb-callout--warning")).toHaveCount(0);
  await expect(text.locator("h2")).toHaveText([
    "What IdeaBeam is",
    "How to use IdeaBeam",
    "Requirements and checks",
    "Known limitations",
    "Reporting barriers",
  ]);
  await expect(text).toContainText("partially conformant");
  await expect(text).toContainText("info@sebaro-ventures.de");
  await expect(text).toContainText("According to its operator, IdeaBeam falls under an exception");
  await expect(text).not.toContainText("Market surveillance");
  // the act's German name is marked as German
  await expect(text.locator('span[lang="de"]').filter({ hasText: "Barrierefreiheitsstärkungsgesetz" })).toHaveCount(1);
});

// axe, sideways scrolling and cut text for the three legal texts, in the four pairings of light and dark, 390 and
// 1440 px, in both languages
for (const lang of ["de", "en"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    for (const width of [390, 1440]) {
      test(`axe: the legal texts in ${lang}, ${scheme} at ${width} px`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width, height: width < 640 ? 844 : 900 },
          colorScheme: scheme,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const problems: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") problems.push(m.text());
        });
        if (lang === "en") await inEnglish(page);
        for (const [path, name] of Object.entries(LEGAL)) {
          await page.goto(path);
          await expect(page.locator(`[data-sb-view="${name}"]`)).toHaveCount(1);
          await expect(page.locator("html")).toHaveAttribute("lang", lang);
          await page.evaluate(() => document.fonts.ready.then(() => true));
          expect(await page.evaluate(sidewaysScroll), path).toBeLessThanOrEqual(1);
          expect(await page.evaluate(collectCut), path).toEqual([]);
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
            .analyze();
          expect(
            axe.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
          ).toEqual([]);
        }
        expect(problems, "console errors").toEqual([]);
        await context.close();
      });
    }
  }
}
