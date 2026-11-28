// Pairs and small groups (stage M4, PLAN-METHODEN.md 5): „1-2-4-Alle“ end to end, each person in a browser of their
// own, against the Worker behind the build. Four browsers: Anna moderates, Ben, Cem and Dora join at the door. Each
// writes alone; the moderation moves into the pairs, which the app forms at random; each browser says its team and
// its partner, and reads its partner's note and no other pair's, read from its own WebSocket text for text; the
// moderation swaps two people with the keyboard alone; the pairs become one four, which shows exactly the other
// notes; the presenting shows every note to everybody. The rules: packages/shared/test/teams.test.ts; the frames
// on the server: apps/worker/test/teams.test.ts.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { enter, enterTeams, know, makeWall, note, openMore, TEAM_QUESTION, writeNote } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light" });

const WALL_SOCKET = /\/api\/walls\/[0-9a-f]{64}\/ws$/;

/** Every frame the wall's socket of a page received, as it came; the heartbeat left out. Before the page goes on. */
function received(page: Page) {
  const frames: string[] = [];
  page.on("websocket", (socket) => {
    if (!WALL_SOCKET.test(socket.url())) return;
    socket.on("framereceived", (frame) => {
      const text = String(frame.payload);
      if (text !== "pong") frames.push(text);
    });
  });
  return frames;
}

type Person = { name: string; page: Page; frames: string[]; text: string };

/** The note each person writes alone: no name in it, so the export can be read for names. */
const IDEA: Record<string, string> = {
  Anna: "Idee Ahorn",
  Ben: "Idee Birke",
  Cem: "Idee Zypresse",
  Dora: "Idee Douglasie",
};

/** Another person in a browser of their own, joined at the door under a name, on the surface. */
async function another(browser: Browser, address: string, name: string): Promise<Person> {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const frames = received(page);
  await page.goto(address);
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-surface__ground").waitFor();
  return { name, page, frames, text: IDEA[name] as string };
}

const teamLine = (page: Page) => page.locator(".app-state__team");
const stepLine = (page: Page) => page.locator(".app-state__step");

/** The partner a person's page names: „Du bist in Team 2 mit Cem.“ */
async function partnerOf(person: Person): Promise<{ team: string; partner: string }> {
  const line = (await teamLine(person.page).textContent()) ?? "";
  const found = /^Du bist in Team (\d) mit (\w+)\. Sprecht in eurem Videotool im Breakout-Raum \1\.$/.exec(line);
  if (found === null) throw new Error(`${person.name}: ${line}`);
  return { team: found[1] as string, partner: found[2] as string };
}

test("ACCEPTANCE: four browsers through 1-2-4-Alle; a pair never receives another pair's note; a keyboard-only swap; the merge shows the rest", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const annaFrames = received(page);
  const wall = await makeWall(page, TEAM_QUESTION, { agenda: { items: [{ methodId: "eins-zwei-vier" }] } });
  await know(page, [{ id: wall.wallId, question: TEAM_QUESTION, as: "Anna", adminToken: wall.adminToken }]);
  await page.goto(`/w/${wall.wallId}`);
  await page.locator(".app-surface__ground").waitFor();
  const anna: Person = { name: "Anna", page, frames: annaFrames, text: IDEA.Anna as string };
  const people = [anna];
  for (const name of ["Ben", "Cem", "Dora"]) people.push(await another(browser, page.url(), name));

  // the method with its short description and its attribution, on every wall
  await expect(page.getByTestId("method")).toContainText("1-2-4-Alle: Erst allein, dann zu zweit");
  await expect(page.getByTestId("attribution")).toContainText("Liberating Structures Fieldbook, 2026");
  await expect(stepLine(page)).toHaveText(
    "Schritt 1 von 4: Allein nachdenken und notieren · danach Zu zweit austauschen",
  );
  for (const person of people) await writeNote(person.page, person.text);
  // alone: nobody reads anybody else
  for (const person of people) await expect(person.page.locator(".app-note[data-note]")).toHaveCount(1);

  // into the pairs: no question first, the notes go to the partner alone
  const marks = people.map((person) => person.frames.length);
  await page.getByRole("button", { name: "Weiter: Zu zweit austauschen" }).click();
  for (const person of people) await expect(teamLine(person.page)).toBeVisible();
  const pairs = new Map<string, { team: string; partner: string }>();
  for (const person of people) pairs.set(person.name, await partnerOf(person));
  for (const person of people) {
    const { team, partner } = pairs.get(person.name) as { team: string; partner: string };
    // the partner says the same
    expect(pairs.get(partner)).toEqual({ team, partner: person.name });
    await expect(note(person.page, IDEA[partner] as string)).toHaveCount(1);
    await expect(person.page.locator(".app-note[data-note]")).toHaveCount(2);
    // the clock of the step runs, and the step moves on by itself
    await expect(person.page.locator(".app-state__clock")).toHaveText(
      "Noch 2 Minuten in diesem Schritt. Dann geht es von selbst weiter.",
    );
    // the state counts the team, not the wall: its two notes and its two people
    await expect(person.page.locator(".app-state__sentence")).toHaveText("Euer Team: 2 Zettel. Ihr seid 2 im Team.");
    // the team's area on the surface, its own marked
    await expect(person.page.locator(".app-area[data-own]")).toHaveText(`Team ${team} · dein Team`);
  }
  // text for text, from the move on: no frame carries another pair's note
  for (const [n, person] of people.entries()) {
    const { partner } = pairs.get(person.name) as { partner: string };
    const since = person.frames.slice(marks[n]).join("\n");
    for (const other of people) {
      if (other.name === person.name || other.name === partner) continue;
      expect(since, `${person.name} received ${other.name}'s note`).not.toContain(other.text);
    }
  }
  // a note written in the pair lands in the team's area, and only the partner gets it
  const ben = people[1] as Person;
  const benPair = pairs.get("Ben") as { team: string; partner: string };
  await writeNote(ben.page, "Zu zweit: Birke");
  const partnerPage = people.find((person) => person.name === benPair.partner)?.page as Page;
  await expect(note(partnerPage, "Zu zweit: Birke")).toHaveCount(1);
  for (const person of people) {
    if (person.name === "Ben" || person.name === benPair.partner) continue;
    await expect(note(person.page, "Zu zweit: Birke")).toHaveCount(0);
    expect(person.frames.join("\n")).not.toContain("Zu zweit: Birke");
  }

  // the moderation swaps two people, keys alone: „Mehr“, „Teams“, „Tauschen“ at Anna, then at someone in the other team
  await page.locator("[data-sb-web-app-head] [aria-haspopup=menu]").focus();
  await page.keyboard.press("Enter");
  const menu = page.locator("#app-more");
  await menu.waitFor();
  for (let presses = 0; presses < 20; presses++) {
    if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Teams") break;
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");
  const dialog = page.locator("#app-dlg-teams");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".app-teams__team")).toHaveCount(2);
  const annaPair = pairs.get("Anna") as { team: string; partner: string };
  const other = people.find((person) => person.name !== "Anna" && person.name !== annaPair.partner) as Person;
  const focusOn = async (name: string) => {
    for (let presses = 0; presses < 30; presses++) {
      if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === name) return;
      await page.keyboard.press("Tab");
    }
    throw new Error(`the focus never reached „${name}“`);
  };
  await focusOn("Tauschen: Anna");
  await page.keyboard.press("Enter");
  await expect(dialog).toContainText("Mit wem tauscht Anna?");
  await focusOn(`Mit Anna tauschen: ${other.name}`);
  await page.keyboard.press("Enter");
  // Anna's new partner is the partner of the one she swapped with; the focus stays on the key that was pressed
  const otherPartner = (pairs.get(other.name) as { partner: string }).partner;
  await expect(teamLine(page)).toContainText(`mit ${otherPartner}.`);
  await expect(page.locator(":focus")).toHaveText(/Tauschen: /);
  await expect(teamLine(other.page)).toContainText(`mit ${annaPair.partner}.`);
  // Anna keeps her old partner's note and gets her new partner's
  await expect(note(page, IDEA[otherPartner] as string)).toHaveCount(1);
  await expect(note(page, IDEA[annaPair.partner] as string)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // into the fours: the pairs become one team of four, and everybody gets the notes they had not
  await page.getByRole("button", { name: "Weiter: Zu viert: das Wichtigste herausarbeiten" }).click();
  for (const person of people) {
    await expect(teamLine(person.page)).toContainText("Du bist in Team 1 mit ");
    await expect(person.page.locator(".app-note[data-note]")).toHaveCount(5);
  }
  // into the presenting: every note for everybody, and the teams' areas stay on the surface
  await page.getByRole("button", { name: "Weiter: Jede Vierergruppe stellt eine Kernidee vor" }).click();
  await page.getByRole("button", { name: "Aufdecken", exact: true }).click();
  for (const person of people) {
    await expect(stepLine(person.page)).toContainText("Schritt 4 von 4");
    await expect(teamLine(person.page)).toHaveCount(0);
    await expect(person.page.locator(".app-note[data-note]")).toHaveCount(5);
  }
  // the export names how many teams there were, and nobody in them
  const { row } = await openMore(page);
  const [download] = await Promise.all([page.waitForEvent("download"), row("Als Markdown sichern").click()]);
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(await download.path(), "utf8");
  expect(text).toContain(
    "In Teams gearbeitet: Zu zweit austauschen: 2 Teams; Zu viert: das Wichtigste herausarbeiten: 1 Team.",
  );
  for (const name of ["Anna", "Ben", "Cem", "Dora"]) expect(text).not.toContain(name);
  for (const idea of Object.values(IDEA)) expect(text).toContain(idea);
  for (const person of people) await person.page.context().close();
});

/** The zoom the surface shows now: the scale of its world. */
const zoomOf = (page: Page) =>
  page
    .locator(".app-surface__world")
    .first()
    .evaluate((world: HTMLElement) => Number(/scale\(([\d.]+)\)/.exec(world.style.transform)?.[1] ?? Number.NaN));

test("a team member sees their team's area at a readable zoom: no smaller than a wall with as many notes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page, { hidden: false, notes: ["Weniger Termine", "Mehr Pausen"] });
  await page.getByRole("button", { name: "Alles zeigen", exact: true }).click();
  const plain = await zoomOf(page);

  await enterTeams(page);
  // the partner's note written alone lies in the team's area; with one of one's own, two notes
  await writeNote(page, "Zu zweit: ein Pate reicht");
  await expect(page.locator(".app-note[data-note]")).toHaveCount(2);
  // a member is shown their own team's area alone
  await expect(page.locator(".app-area")).toHaveCount(1);
  await page.getByRole("button", { name: "Alles zeigen", exact: true }).click();
  expect(await zoomOf(page)).toBeGreaterThanOrEqual(plain);
  await expect(page.locator(".app-state__sentence")).toHaveText("Euer Team: 2 Zettel. Ihr seid 2 im Team.");
});

/** Where the team areas lie in the surface's frame: the top of the first from the left, in pixels from the frame's
 *  top; whether every area's heading lies whole inside the frame (a member is shown one area, the moderation all). */
const firstArea = (page: Page) =>
  page.locator(".app-surface__frame").evaluate((frame: HTMLElement) => {
    const outer = frame.getBoundingClientRect();
    const areas = [...frame.querySelectorAll<HTMLElement>(".app-area")].sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    );
    const area = areas[0];
    if (area === undefined) return null;
    const inside = (head: DOMRect) =>
      head.left >= outer.left && head.right <= outer.right && head.top >= outer.top && head.bottom <= outer.bottom;
    return {
      top: area.getBoundingClientRect().top - outer.top,
      headIn: areas.every((one) => inside(one.querySelector(".app-area__head")!.getBoundingClientRect())),
    };
  });

test("in a step of teams the view starts at the top of the areas with their headings in view; a member's at a readable zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 2000, height: 1200 });
  await enter(page, { hidden: false, notes: ["Weniger Termine", "Mehr Pausen"] });
  await page.getByRole("button", { name: "Alles zeigen", exact: true }).click();
  const plain = await zoomOf(page);
  // the margin of „Alles zeigen“ (lib/surface/view.ts, MARGIN: 24 units of 1/16 rem, 24 px at the default size), and
  // a pixel for rounding
  const margin = 25;

  for (const admin of [false, true]) {
    await enterTeams(page, { admin });
    await expect(page.locator(".app-area")).toHaveCount(admin ? 2 : 1);
    // the look when the team is formed, then „Alles zeigen“
    for (const fitted of [false, true]) {
      if (fitted) await page.getByRole("button", { name: "Alles zeigen", exact: true }).click();
      await expect.poll(async () => (await firstArea(page))?.headIn).toBe(true);
      const area = (await firstArea(page))!;
      expect(area.top).toBeGreaterThanOrEqual(0);
      expect(area.top).toBeLessThanOrEqual(margin);
      // a member's own area at the readable zoom; the moderation's every area across, all its headings in view
      if (!admin) expect(await zoomOf(page)).toBeGreaterThanOrEqual(plain);
    }
  }
});
