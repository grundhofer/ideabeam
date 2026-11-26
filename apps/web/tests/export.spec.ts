// „Als Markdown sichern“ and „QR-Code zeigen“ with a real browser, against the Worker behind the build (PLAN.md 2.1,
// 3.2): the file the browser saves after arranging, with the groups as headings; the file while the notes are
// hidden, with one's own notes alone; and the wall's link as a QR code, which is the plain link and never the
// moderation link. The Worker's stand-in arranges (packages/arrange/src/fake.ts): notes that begin with the same word
// go together, the larger group first.
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Download, type Page } from "@playwright/test";
import { qrPath } from "../src/lib/qr";
import { enter, join, openMore, writeNote } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light", viewport: { width: 1440, height: 1000 } });

const EIGHT = [
  "Termine ohne Ergebnis",
  "Werkzeuge, die niemand erklärt hat",
  "Termine, die eine Mail sein könnten",
  "Werkzeuge wechseln jedes halbe Jahr",
  "Termine zur selben Zeit in zwei Teams",
  "Termine ohne Protokoll",
  "Termine am Freitagnachmittag",
  "Werkzeuge: der Build dauert zu lange",
];
const QUESTION = "Was hält uns bei der Arbeit auf?";
const sentence = (page: Page) => page.locator(".app-state__sentence");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
/** axe's findings, each with where it found it. */
const axeFindings = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );

/** The file of a download, as text. */
async function textOf(download: Download): Promise<string> {
  const file = await download.path();
  return readFile(file, "utf8");
}

/** The text under a heading of a Markdown file: its list items, in their order. */
function itemsUnder(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const from = lines.indexOf(`## ${heading}`);
  if (from < 0) return [];
  const items: string[] = [];
  for (const line of lines.slice(from + 1)) {
    if (line.startsWith("## ")) break;
    if (line.startsWith("- ")) items.push(line.slice(2));
  }
  return items;
}

test("after arranging, „Als Markdown sichern“ saves the wall: the question, the groups as headings, no names", async ({
  page,
}) => {
  await enter(page, { hidden: false, notes: EIGHT, others: ["Ben"] });
  await page.getByRole("button", { name: "Ordnen", exact: true }).click();
  await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
  await page.getByRole("button", { name: "Anwenden", exact: true }).click();
  await expect(sentence(page)).toHaveText("8 Zettel in 2 Gruppen. 1 Person ist da.");

  // the result's act stands at the wall's top, under what to do now; the zone keeps „Ordnen“
  const save = page.locator(".app-state").getByRole("button", { name: "Als Markdown sichern" });
  await expect(save).toBeVisible();
  await expect(page.locator(".app-state")).toContainText("Ohne Namen. Die Datei bleibt auf diesem Gerät.");
  await expect(page.locator(".sb-primary-action")).toHaveText("Ordnen");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const [download] = await Promise.all([page.waitForEvent("download"), save.click()]);

  expect(download.suggestedFilename()).toMatch(/^Was-haelt-uns-bei-der-Arbeit-auf-\d{4}-\d{2}-\d{2}\.md$/);
  const text = await textOf(download);
  expect(text.startsWith(`# ${QUESTION}\n\n_IdeaBeam · Stand: `)).toBe(true);
  // the groups as headings, the larger one first as the wall lists it, each with its notes
  expect(text.split("\n").filter((line) => line.startsWith("## "))).toEqual(["## Termine", "## Werkzeuge"]);
  // (in the order they were made, then by id: notes the test wrote in the same millisecond stand in the order of
  // their random ids, so here they are compared as a set; packages/shared/test/export.test.ts holds the order)
  expect(itemsUnder(text, "Termine").sort()).toEqual(EIGHT.filter((one) => one.startsWith("Termine")).sort());
  expect(itemsUnder(text, "Werkzeuge").sort()).toEqual(EIGHT.filter((one) => one.startsWith("Werkzeuge")).sort());
  for (const name of ["Anna", "Ben"]) expect(text).not.toContain(name);
  // a screen reader hears what was saved
  await expect(page.locator("main p.sb-visually-hidden[role=status]")).toHaveText(
    `Gesichert als „${download.suggestedFilename()}“.`,
  );
  // one request went out for it, to the wall's own route, with nothing secret in its address
  const asked = requests.filter((url) => url.includes("/export"));
  expect(asked).toHaveLength(1);
  expect(new URL(asked[0]!).search).toBe("?lang=de");
});

test("before revealing, the file holds one's own notes and how many of the others' are left out", async ({ page }) => {
  const wall = await enter(page);
  const ben = await join(wall.wallId, "Ben");
  await ben.write("Bens geheimer Zettel");
  await ben.write("Noch einer von Ben", 256, 0);
  await writeNote(page, "Annas Zettel");
  await expect(sentence(page)).toContainText("Verdecktes Schreiben: 3 Zettel.");

  const { row } = await openMore(page);
  const [download] = await Promise.all([page.waitForEvent("download"), row("Als Markdown sichern").click()]);
  const text = await textOf(download);
  expect(itemsUnder(text, "Deine Zettel")).toEqual(["Annas Zettel"]);
  expect(text).toContain("_Die Zettel sind noch verdeckt: Hier stehen nur deine. 2 Zettel der anderen fehlen._");
  expect(text).not.toContain("Ben");
  // while the notes are hidden the wall is no result yet: no key at its top
  await expect(page.locator(".app-state").getByRole("button", { name: "Als Markdown sichern" })).toHaveCount(0);
  await ben.leave();
});

test("„QR-Code zeigen“ shows the wall's link as a code and as text, never the moderation link", async ({ page }) => {
  const wall = await enter(page, { hidden: false, others: ["Ben"] });
  const link = `${new URL(page.url()).origin}/w/${wall.wallId}`;
  const { row } = await openMore(page);
  await row("QR-Code zeigen").click();
  const dialog = page.locator("#app-dlg-qr");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "QR-Code der Wand" })).toBeVisible();
  const code = dialog.getByRole("img", { name: "QR-Code mit dem Link der Wand" });
  await expect(code).toBeVisible();
  await expect(dialog.getByTestId("qr-link")).toHaveText(link);
  // the code is the plain link: the same modules as the link encoded here, not those of the moderation link
  const drawn = await code.locator("path").getAttribute("d");
  expect(drawn).toBe(qrPath(link).path);
  expect(drawn).not.toBe(qrPath(`${link}#admin=${wall.adminToken}`).path);
  expect(await dialog.textContent()).not.toContain(wall.adminToken);
  // large enough to scan from across a room, and dark on light also in dark mode
  const box = await code.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(320);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await code.locator("rect").evaluate((el) => getComputedStyle(el).fill)).toBe("rgb(255, 255, 255)");
  // „Schließen“ puts it away
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(dialog).toBeHidden();
});

for (const width of [390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`the QR dialog and the arranged wall with its key pass axe, ${colorScheme} at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.emulateMedia({ colorScheme });
      await enter(page, { hidden: false, notes: EIGHT, others: ["Ben"] });
      await page.getByRole("button", { name: "Ordnen", exact: true }).click();
      await expect(sentence(page)).toHaveText("Vorschlag der KI: 2 Gruppen. Nur du siehst ihn.");
      await page.getByRole("button", { name: "Anwenden", exact: true }).click();
      await expect(page.locator(".app-state").getByRole("button", { name: "Als Markdown sichern" })).toBeVisible();
      expect(await axeFindings(page)).toEqual([]);

      const { row } = await openMore(page);
      await row("QR-Code zeigen").click();
      await expect(page.locator("#app-dlg-qr").getByTestId("qr-code")).toBeVisible();
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      expect(await axeFindings(page)).toEqual([]);
      // the page does not scroll sideways
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}
