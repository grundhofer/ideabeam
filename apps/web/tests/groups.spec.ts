// Groups, the selection and the list of a wall, against the Worker behind the build: a group is a named frame that
// everyone sees, makes, renames, moves, resizes and deletes; a note belongs to the frame it lies in; several notes
// are selected and moved as one; „Verschieben nach …“ moves without dragging; the list shows the same wall as
// headings and rows and changes it the same way; and all of it goes by keyboard alone.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { enter, frame, frameOf, ground, GROUPS, lookAt, note, NOTES, placeOf, QUESTION, row } from "./app";

test.use({ reducedMotion: "reduce", colorScheme: "light", viewport: { width: 1440, height: 1000 } });

/** The state sentence at the top of the wall. */
const sentence = (page: Page) => page.locator(".app-state__sentence");
/** What the surface or the list last said to a screen reader about the person's own doing. */
const said = (page: Page) => page.locator(".sb-view__content > p[role=status]");
const tool = (page: Page, name: string) =>
  page.locator(".app-surface__tools").getByRole("button", { name, exact: true });
/** „Neue Gruppe“ in the wall's bar. */
const newGroup = (page: Page) => page.getByRole("button", { name: "Neue Gruppe", exact: true });
/** The field a note is written in, on the surface. */
const field = (page: Page) => page.getByRole("textbox", { name: "Text des Zettels" });
/** The field a group's title is written in, on the surface and in the list. */
const titleField = (page: Page) => page.getByRole("textbox", { name: /^Titel der Gruppe/ });
const world = (page: Page) => page.locator(".app-surface__ground > .app-surface__world");
/** The view as the world's transform says it: where the world's origin lies in the frame, and its zoom. */
const viewOf = (page: Page) =>
  world(page).evaluate((el) => {
    const { a, e, f } = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: e, y: f, zoom: a };
  });
/** The notes the surface holds as selected: the picked ones, or else the current one. */
const selected = (page: Page) => page.locator('.app-note[aria-selected="true"]');
/** The note or the group the keys are on. */
const active = (page: Page) =>
  ground(page).evaluate((el) => {
    const id = el.getAttribute("aria-activedescendant");
    return id === null ? null : (document.getElementById(id)?.textContent ?? null);
  });
/** The switch between the surface and the list. */
const viewSwitch = (page: Page, name: "Fläche" | "Liste") => page.getByRole("radio", { name, exact: true });
/** A heading of the list with its count: „Werkzeuge 2“. */
const headings = (page: Page) => page.locator(".app-list h2.sb-list-header");

/** Every frame the page's wall socket sends from now on, parsed. */
function sent(page: Page) {
  const frames: Array<{ type: string; [key: string]: unknown }> = [];
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => {
      if (frame.payload !== "ping") frames.push(JSON.parse(String(frame.payload)));
    }),
  );
  return frames;
}
type Move = { noteId: string; x: number; y: number; groupId: string | null };
const movesOf = (frame: { [key: string]: unknown } | undefined) => (frame?.moves ?? []) as Move[];

/** Presses Tab until the element has the focus (at most 60 presses). */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${String(target)}`);
}

/** The arrow key that leads from one place to another: along the axis they lie further apart on. */
function arrowTo(from: { x: number; y: number }, to: { x: number; y: number }) {
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "ArrowRight" : "ArrowLeft";
  return dy > 0 ? "ArrowDown" : "ArrowUp";
}

/** Whether a note's middle lies inside a frame: the rule a note belongs to a group by. */
const holds = (frame: { x: number; y: number; w: number; h: number }, at: { x: number; y: number }, height = 104) => {
  const [x, y] = [at.x + 120, at.y + height / 2];
  return x >= frame.x && x < frame.x + frame.w && y >= frame.y && y < frame.y + frame.h;
};

/** Drags from the middle of an element by a distance on the screen, in several steps as a hand does; with Shift
 *  held when asked. */
async function dragBy(page: Page, target: Locator, dx: number, dy: number) {
  const box = (await target.boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) await page.mouse.move(from.x + (dx * step) / 8, from.y + (dy * step) / 8);
  await page.mouse.up();
}

/** Drags an element so that its middle comes to lie on a point of the screen. */
async function dragOnto(page: Page, target: Locator, to: { x: number; y: number }) {
  const box = (await target.boundingBox())!;
  await dragBy(page, target, to.x - (box.x + box.width / 2), to.y - (box.y + box.height / 2));
}

/** Another person, in a browser of their own, on the wall under a name; as its surface, or as its list. */
async function another(browser: Browser, address: string, name: string, view: "surface" | "list" = "surface") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto("/");
  await lookAt(page, view);
  await page.goto(address);
  await page.fill("#app-f-as", name);
  await page.locator('#app-form button[type="submit"]').click();
  await page.locator(".app-surface__ground, .app-list").waitFor();
  return page;
}

test("by keyboard alone: a note is made, moved, moved into a group, and several notes are selected", async ({
  page,
}) => {
  await enter(page, { hidden: false });
  const frames = sent(page);
  await page.reload();
  await ground(page).waitFor();
  const of = (type: string) => frames.filter((frame) => frame.type === type);

  // a group first: „Neue Gruppe“ in the wall's bar opens the field for its title, Enter makes the group
  await tabTo(page, newGroup(page));
  await page.keyboard.press("Enter");
  await expect(titleField(page)).toBeFocused();
  await page.keyboard.type("Werkzeuge");
  await page.keyboard.press("Enter");
  await expect(frame(page, "Werkzeuge")).toHaveCount(1);
  await expect(said(page)).toHaveText("Gruppe angelegt.");
  // the surface has the focus now, with the group as the current thing
  await expect(ground(page)).toBeFocused();
  await expect(ground(page)).toHaveAttribute(
    "aria-activedescendant",
    (await frame(page, "Werkzeuge").getAttribute("id"))!,
  );
  expect(of("group.create")).toHaveLength(1);
  expect(of("group.create")[0]).toMatchObject({ title: "Werkzeuge" });
  const group = String(of("group.create")[0]!.groupId);
  const box = await frameOf(frame(page, "Werkzeuge"));
  await expect(sentence(page)).toHaveText("Noch keine Zettel, 1 leere Gruppe. 1 Person ist da.");

  // made: N opens a field at a free place, Enter saves. A place the surface chooses lies outside every frame
  for (const text of ["Fokuszeit", "Mehr Pausen", "Weniger Termine"]) {
    await page.keyboard.press("n");
    await expect(field(page)).toBeFocused();
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    await expect(note(page, text)).toHaveCount(1);
    expect(holds(box, await placeOf(note(page, text)))).toBe(false);
  }
  await expect(ground(page)).toBeFocused();
  await expect(selected(page)).toHaveText("Weniger Termine Deiner");
  await expect(sentence(page)).toHaveText("3 Zettel und 1 leere Gruppe. 1 Person ist da.");
  expect(of("notes.move")).toHaveLength(0);

  // moved: M starts the move mode, the arrow keys step by 32 units, Enter ends it: one frame tells the wall
  const before = await placeOf(note(page, "Weniger Termine"));
  await page.keyboard.press("m");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect(of("notes.move")).toHaveLength(0);
  await page.keyboard.press("Enter");
  await expect(said(page)).toHaveText("Zettel abgelegt.");
  await expect.poll(() => of("notes.move").length).toBe(1);
  expect(movesOf(of("notes.move")[0])).toMatchObject([{ x: before.x + 64, y: before.y, groupId: null }]);

  // moved into a group: V asks where to, with the wall's groups as a choice. It opens on where the note lies now,
  // the arrow keys change the choice, Enter moves
  await page.keyboard.press("v");
  const dialog = page.locator("#app-dlg-move");
  await expect(dialog).toContainText("Wohin soll der Zettel?");
  await expect(dialog.getByRole("radio", { name: "Keine Gruppe" })).toBeFocused();
  await expect(dialog.getByRole("radio", { name: "Keine Gruppe" })).toBeChecked();
  await page.keyboard.press("ArrowUp");
  await expect(dialog.getByRole("radio", { name: "Werkzeuge" })).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(said(page)).toHaveText("Zettel nach „Werkzeuge“ verschoben.");
  await expect(ground(page)).toBeFocused();
  await expect.poll(() => of("notes.move").length).toBe(2);
  // a free place inside the frame: under its title, at its edge
  expect(movesOf(of("notes.move")[1])).toEqual([
    { noteId: expect.any(String), x: box.x + 16, y: box.y + 40, groupId: group },
  ]);
  expect(holds(box, await placeOf(note(page, "Weniger Termine")))).toBe(true);
  await expect(sentence(page)).toHaveText("3 Zettel, 1 davon in 1 Gruppe. 1 Person ist da.");
  // a screen reader hears the group with the note
  await expect(selected(page)).toHaveText("Weniger Termine Deiner in „Werkzeuge“");

  // several are selected: the space bar picks the current note, the arrow keys go on without dropping it, and
  // Shift with an arrow key takes the next one in too
  const [inGroup, first, second] = [
    await placeOf(note(page, "Weniger Termine")),
    await placeOf(note(page, "Fokuszeit")),
    await placeOf(note(page, "Mehr Pausen")),
  ];
  await page.keyboard.press(arrowTo(inGroup, first));
  await expect.poll(() => active(page)).toBe("Fokuszeit Deiner");
  await page.keyboard.press("Space");
  await expect(said(page)).toHaveText("1 Zettel ausgewählt");
  await expect(note(page, "Fokuszeit")).toHaveAttribute("data-picked", "");
  await page.keyboard.press(`Shift+${arrowTo(first, second)}`);
  await expect.poll(() => active(page)).toBe("Mehr Pausen Deiner");
  await expect(said(page)).toHaveText("2 Zettel ausgewählt");
  await expect(selected(page)).toHaveText(["Fokuszeit Deiner", "Mehr Pausen Deiner"]);
  // the count stands among the tools, where the selection's tools are
  await expect(page.locator(".app-surface__count")).toHaveText("2 Zettel ausgewählt");

  // the selection moves as one in the move mode: one frame for both notes
  await page.keyboard.press("m");
  await expect(page.locator("#app-surface-keys")).toHaveText(
    "Bewegen: Die Pfeiltasten bewegen die 2 Zettel. Eingabe legt sie ab, Esc bricht ab.",
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(said(page)).toHaveText("2 Zettel abgelegt.");
  await expect.poll(() => of("notes.move").length).toBe(3);
  expect(movesOf(of("notes.move")[2]).map(({ x, y, groupId }) => ({ x, y, groupId }))).toEqual([
    { x: first.x, y: first.y + 32, groupId: null },
    { x: second.x, y: second.y + 32, groupId: null },
  ]);

  // and into the group, both at once: one frame, and one sentence says it
  await page.keyboard.press("v");
  await expect(dialog).toContainText("Wohin sollen die 2 Zettel?");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(said(page)).toHaveText("2 Zettel nach „Werkzeuge“ verschoben.");
  await expect.poll(() => of("notes.move").length).toBe(4);
  expect(movesOf(of("notes.move")[3]).map((move) => move.groupId)).toEqual([group, group]);
  for (const text of ["Fokuszeit", "Mehr Pausen", "Weniger Termine"])
    expect(holds(box, await placeOf(note(page, text)))).toBe(true);
  await expect(sentence(page)).toHaveText("3 Zettel in 1 Gruppe. 1 Person ist da.");
  // Escape puts the selection away; the note the keys are on stays the current one
  await page.keyboard.press("Escape");
  await expect(said(page)).toHaveText("Auswahl aufgehoben.");
  await expect(page.locator(".app-surface__count")).toHaveCount(0);
  await expect(selected(page)).toHaveText("Mehr Pausen Deiner in „Werkzeuge“");
  // the group never had to grow, and nothing but the keyboard was used: the wall has it all after a reload
  expect(of("group.update")).toHaveLength(0);
  await page.reload();
  await expect(sentence(page)).toHaveText("3 Zettel in 1 Gruppe. 1 Person ist da.");
  await expect(page.locator(".app-note")).toHaveCount(3);
});

test("a group by keyboard: G goes to it, M moves it with its notes, Shift resizes it, Enter renames, Entf deletes", async ({
  page,
}) => {
  await enter(page, { hidden: false, groups: GROUPS.slice(0, 2), notes: NOTES.slice(0, 2) });
  const frames = sent(page);
  await page.reload();
  await expect(page.locator(".app-note")).toHaveCount(7);
  const of = (type: string) => frames.filter((frame) => frame.type === type);
  await ground(page).focus();

  // G: the first group, then the next, and round again; Shift and G goes back
  await page.keyboard.press("g");
  await expect.poll(() => active(page)).toBe("Abstimmung");
  // a screen reader hears the group with how many notes lie in it
  await expect(ground(page).getByRole("option", { name: /^Gruppe „Abstimmung“, 3\sZettel$/ })).toHaveCount(1);
  await page.keyboard.press("g");
  await expect.poll(() => active(page)).toBe("Werkzeuge");
  await page.keyboard.press("g");
  await expect.poll(() => active(page)).toBe("Abstimmung");
  await page.keyboard.press("Shift+G");
  await expect.poll(() => active(page)).toBe("Werkzeuge");
  // the group's tools stand in the row above the ground
  await expect(tool(page, "Umbenennen")).toBeVisible();
  await expect(tool(page, "Gruppe löschen")).toBeVisible();
  // from a group the arrow down leads into it, to its first note; and G from a note to its own group
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => active(page)).toBe("Der Build dauert zu lange in „Werkzeuge“");
  await page.keyboard.press("g");
  await expect.poll(() => active(page)).toBe("Werkzeuge");

  // M moves the group, its notes go with it; with Shift the arrow keys change its size. One `group.update` and
  // one `notes.move` say it all
  const before = await frameOf(frame(page, "Werkzeuge"));
  const inside = await placeOf(note(page, "Der Build dauert zu lange"));
  await page.keyboard.press("m");
  await expect(page.locator("#app-surface-keys")).toHaveText(
    "Bewegen: Die Pfeiltasten bewegen die Gruppe mit ihren Zetteln, mit Umschalt ändern sie ihre Größe. Eingabe legt sie ab, Esc bricht ab.",
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  expect(await frameOf(frame(page, "Werkzeuge"))).toEqual({
    x: before.x,
    y: before.y + 64,
    w: before.w + 32,
    h: before.h + 32,
  });
  expect(of("group.update")).toHaveLength(0);
  await page.keyboard.press("Enter");
  await expect(said(page)).toHaveText("Gruppe abgelegt.");
  await expect.poll(() => of("group.update").length).toBe(1);
  expect(of("group.update")[0]).toMatchObject({ y: before.y + 64, w: before.w + 32, h: before.h + 32 });
  expect(of("group.update")[0]).not.toHaveProperty("x");
  await expect.poll(() => of("notes.move").length).toBe(1);
  expect(movesOf(of("notes.move")[0])).toHaveLength(2);
  expect(await placeOf(note(page, "Der Build dauert zu lange"))).toEqual({ x: inside.x, y: inside.y + 64 });
  // Escape takes a move back, and tells the wall nothing
  await page.keyboard.press("m");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(said(page)).toHaveText("Bewegen abgebrochen. Alles liegt wieder, wo es war.");
  expect((await frameOf(frame(page, "Werkzeuge"))).x).toBe(before.x);
  expect(of("group.update")).toHaveLength(1);

  // Enter opens the group's title; Enter saves it
  await page.keyboard.press("Enter");
  await expect(titleField(page)).toHaveValue("Werkzeuge");
  await page.keyboard.type(" und Technik");
  await page.keyboard.press("Enter");
  await expect(frame(page, "Werkzeuge und Technik")).toHaveCount(1);
  await expect(ground(page)).toBeFocused();
  expect(of("group.update")[1]).toMatchObject({ title: "Werkzeuge und Technik" });

  // Entf asks, and says what becomes of the notes; the dialog opens on „Abbrechen“
  await page.keyboard.press("Delete");
  const dialog = page.locator("#app-dlg-group");
  await expect(dialog).toContainText(
    "„Werkzeuge und Technik“ wird für alle gelöscht. Die 2 Zettel darin bleiben auf der Wand, ohne Gruppe. Das lässt sich nicht rückgängig machen.",
  );
  await expect(dialog.locator('button[value="cancel"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(frame(page, "Werkzeuge und Technik")).toHaveCount(0);
  await expect(said(page)).toHaveText("Gruppe gelöscht. Ihre 2 Zettel liegen jetzt ohne Gruppe.");
  await expect(ground(page)).toBeFocused();
  await expect(page.locator(".app-note")).toHaveCount(7);
  await expect(sentence(page)).toHaveText("7 Zettel, 3 davon in 1 Gruppe. 1 Person ist da.");
});

test("a note dropped inside a frame belongs to that group, dropped outside to none; everyone sees it", async ({
  page,
  browser,
}) => {
  await enter(page, { hidden: false, groups: GROUPS, notes: ["Fokuszeit am Vormittag"] });
  const frames = sent(page);
  await page.reload();
  await expect(page.locator(".app-note")).toHaveCount(7);
  const moves = () => frames.filter((frame) => frame.type === "notes.move");
  // Clara looks at the same wall as a list
  const clara = await another(browser, page.url(), "Clara", "list");
  await expect(headings(clara)).toHaveText(["Abstimmung 3", "Werkzeuge 2", "Ohne Titel 1", "Ohne Gruppe 1"]);

  // dragged onto the frame „Werkzeuge“: while the note hangs over it, the frame carries the mark of a target; let
  // go, one frame tells the wall, with the place and the group
  const target = (await frame(page, "Werkzeuge").boundingBox())!;
  const from = (await note(page, "Fokuszeit am Vormittag").boundingBox())!;
  const [start, end] = [
    { x: from.x + from.width / 2, y: from.y + from.height / 2 },
    { x: target.x + target.width / 2, y: target.y + target.height * 0.75 },
  ];
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y - 10);
  await expect(page.locator(".app-group[data-target]")).toHaveCount(0);
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await expect(page.locator(".app-group[data-target]")).toHaveText("Werkzeuge");
  expect(moves()).toHaveLength(0);
  await page.mouse.up();
  await expect.poll(() => moves().length).toBe(1);
  const [into] = movesOf(moves()[0]);
  expect(holds(await frameOf(frame(page, "Werkzeuge")), into!)).toBe(true);
  await expect(said(page)).toHaveText("Zettel nach „Werkzeuge“ verschoben.");
  await expect(headings(clara)).toHaveText(["Abstimmung 3", "Werkzeuge 3", "Ohne Titel 1"]);
  await expect(row(clara, "Fokuszeit am Vormittag")).toHaveCount(1);
  await expect(sentence(clara)).toHaveText("7 Zettel in 3 Gruppen. 2 Personen sind da.");
  // the frame the note would land in carried the mark of a target while the drag lasted, and no longer does
  await expect(page.locator(".app-group[data-target]")).toHaveCount(0);

  // dragged from one frame into another: it belongs to the other one
  const other = (await frame(page, "Ohne Titel").boundingBox())!;
  await dragOnto(page, note(page, "Fokuszeit am Vormittag"), {
    x: other.x + other.width / 2,
    y: other.y + other.height * 0.75,
  });
  await expect(said(page)).toHaveText("Zettel nach „Ohne Titel“ verschoben.");
  await expect(headings(clara)).toHaveText(["Abstimmung 3", "Werkzeuge 2", "Ohne Titel 2"]);

  // dragged out again, under the frames: no group
  await dragBy(page, note(page, "Fokuszeit am Vormittag"), 0, other.height * 0.6);
  await expect.poll(() => moves().length).toBe(3);
  expect(movesOf(moves()[2])[0]!.groupId).toBeNull();
  await expect(said(page)).toHaveText("Der Zettel liegt jetzt ohne Gruppe.");
  await expect(headings(clara)).toHaveText(["Abstimmung 3", "Werkzeuge 2", "Ohne Titel 1", "Ohne Gruppe 1"]);
  await expect(sentence(clara)).toHaveText("7 Zettel, 6 davon in 3 Gruppen. 2 Personen sind da.");
  // a move inside a frame stays in its group, and nothing is said about groups
  await dragBy(page, note(page, "Der Build dauert zu lange"), 6, 6);
  await expect.poll(() => moves().length).toBe(4);
  expect(movesOf(moves()[3])[0]!.groupId).not.toBeNull();
  await expect(said(page)).toHaveText("Der Zettel liegt jetzt ohne Gruppe.");
  await clara.context().close();
});

test("a group is made, named, moved with its notes, resized and deleted with the pointer; everyone sees it", async ({
  page,
  browser,
}) => {
  await enter(page, { hidden: false, notes: ["Weniger Termine", "Mehr Pausen"] });
  const frames = sent(page);
  await page.reload();
  await expect(page.locator(".app-note")).toHaveCount(2);
  const of = (type: string) => frames.filter((frame) => frame.type === type);
  const clara = await another(browser, page.url(), "Clara");

  // „Neue Gruppe“: a frame at a free place in view, with the field for its title; Escape leaves it without a group
  await newGroup(page).click();
  await expect(titleField(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".app-group[data-group]")).toHaveCount(0);
  expect(of("group.create")).toHaveLength(0);
  await newGroup(page).click();
  await page.keyboard.type("Abstimmung");
  // „Sichern“ in the row of tools does what Enter does
  await tool(page, "Sichern").click();
  await expect(frame(page, "Abstimmung")).toHaveCount(1);
  await expect(frame(clara, "Abstimmung")).toHaveCount(1);
  const made = await frameOf(frame(page, "Abstimmung"));
  expect(await frameOf(frame(clara, "Abstimmung"))).toEqual(made);
  // it covers no note: the place was free
  for (const text of ["Weniger Termine", "Mehr Pausen"])
    expect(holds(made, await placeOf(note(page, text)))).toBe(false);
  // a title may stay empty: the frame says so, quietly
  await newGroup(page).click();
  await page.keyboard.press("Enter");
  await expect(frame(page, "Ohne Titel")).toHaveCount(1);
  expect(of("group.create")[1]).toMatchObject({ title: "" });

  // a double click on its head opens the title: named now
  await frame(page, "Ohne Titel").locator(".app-group__head").dblclick();
  await expect(titleField(page)).toHaveValue("");
  await page.keyboard.type("Werkzeuge");
  await page.keyboard.press("Enter");
  await expect(frame(clara, "Werkzeuge")).toHaveCount(1);
  expect(of("group.update").at(-1)).toMatchObject({ title: "Werkzeuge" });

  // everything in view, as a wall opens: the frames and the notes
  await ground(page).focus();
  await page.keyboard.press("0");
  // a note goes into the frame „Abstimmung“ with „Verschieben nach …“ in its tools
  await note(page, "Weniger Termine").click();
  await tool(page, "Verschieben nach …").click();
  const dialog = page.locator("#app-dlg-move");
  await expect(dialog.getByRole("radio")).toHaveCount(3);
  await dialog.getByRole("radio", { name: "Abstimmung" }).check();
  await dialog.getByRole("button", { name: "Verschieben", exact: true }).click();
  await expect(said(page)).toHaveText("Zettel nach „Abstimmung“ verschoben.");
  expect(await placeOf(note(page, "Weniger Termine"))).toEqual({ x: made.x + 16, y: made.y + 40 });

  // the frame is moved by its head, down by about 96 units (a pointer lands on whole pixels, the world is drawn
  // smaller): its note goes with it, the same distance. One `group.update`, one `notes.move`
  const updates = of("group.update").length;
  const moves = of("notes.move").length;
  const { zoom } = await viewOf(page);
  await dragBy(page, frame(page, "Abstimmung").locator(".app-group__head"), 0, 96 * zoom);
  await expect.poll(() => of("group.update").length).toBe(updates + 1);
  const moved = await frameOf(frame(page, "Abstimmung"));
  const down = moved.y - made.y;
  expect(Math.abs(down - 96)).toBeLessThanOrEqual(1);
  expect(moved).toEqual({ ...made, y: made.y + down });
  expect(of("group.update").at(-1)).toMatchObject({ y: moved.y });
  expect(of("group.update").at(-1)).not.toHaveProperty("w");
  await expect.poll(() => of("notes.move").length).toBe(moves + 1);
  expect(movesOf(of("notes.move").at(-1))).toEqual([
    { noteId: expect.any(String), x: made.x + 16, y: made.y + 40 + down, groupId: expect.any(String) },
  ]);
  await expect.poll(() => frameOf(frame(clara, "Abstimmung"))).toEqual(moved);
  await expect.poll(() => placeOf(note(clara, "Weniger Termine"))).toEqual({ x: made.x + 16, y: made.y + 40 + down });

  // the current group carries a handle at its far corner, 48 px large at every zoom: it changes the frame's size.
  // Made so narrow that it no longer holds its note's middle, the frame lets the note go
  // (the frame went down, perhaps out of the view: everything is shown again first)
  await ground(page).focus();
  await page.keyboard.press("0");
  const fitted = (await viewOf(page)).zoom;
  const handle = page.locator(".app-surface__handle");
  await expect(handle).toBeInViewport({ ratio: 0.5 });
  const grip = (await handle.boundingBox())!;
  expect(grip.width).toBeGreaterThanOrEqual(48);
  expect(grip.height).toBeGreaterThanOrEqual(48);
  await dragBy(page, handle, -400 * fitted, 0);
  await expect.poll(() => of("group.update").length).toBe(updates + 2);
  const narrow = await frameOf(frame(page, "Abstimmung"));
  expect(Math.abs(narrow.w - (made.w - 400))).toBeLessThanOrEqual(1);
  expect(of("group.update").at(-1)).toMatchObject({ w: narrow.w });
  expect(of("group.update").at(-1)).not.toHaveProperty("x");
  await expect.poll(() => of("notes.move").length).toBe(moves + 2);
  expect(movesOf(of("notes.move").at(-1))[0]!.groupId).toBeNull();
  await expect(sentence(clara)).toHaveText("2 Zettel und 2 leere Gruppen. 2 Personen sind da.");
  // made wider again, it takes the note without a group back in
  await dragBy(page, handle, 400 * fitted, 0);
  await expect(sentence(clara)).toHaveText("2 Zettel, 1 davon in 2 Gruppen. 2 Personen sind da.");

  // deleted, after the question: the frame goes, its note stays
  await tool(page, "Gruppe löschen").click();
  const ask = page.locator("#app-dlg-group");
  await expect(ask).toContainText(
    "„Abstimmung“ wird für alle gelöscht. Der Zettel darin bleibt auf der Wand, ohne Gruppe.",
  );
  await ask.locator('button[value="confirm"]').click();
  await expect(frame(clara, "Abstimmung")).toHaveCount(0);
  await expect(note(clara, "Weniger Termine")).toHaveCount(1);
  await expect(sentence(clara)).toHaveText("2 Zettel und 1 leere Gruppe. 2 Personen sind da.");
  // an empty group says so in its question
  await frame(page, "Werkzeuge").locator(".app-group__head").click();
  await tool(page, "Gruppe löschen").click();
  await expect(ask).toContainText("„Werkzeuge“ wird für alle gelöscht. Es liegen keine Zettel darin.");
  await ask.locator('button[value="cancel"]').click();
  await expect(frame(page, "Werkzeuge")).toHaveCount(1);
  // and when it goes, the sentence speaks of no notes
  await tool(page, "Gruppe löschen").click();
  await ask.locator('button[value="confirm"]').click();
  await expect(said(page)).toHaveText("Gruppe gelöscht.");
  await expect(sentence(clara)).toHaveText("2 Zettel. 2 Personen sind da.");
  await clara.context().close();
});

test("a note written inside a frame belongs to that group from the start; one the surface places lies outside", async ({
  page,
}) => {
  await enter(page, { hidden: false, groups: [{ title: "Leer", notes: [] }] });
  const frames = sent(page);
  await page.reload();
  await frame(page, "Leer").waitFor();
  const of = (type: string) => frames.filter((frame) => frame.type === type);
  // a double click on the ground inside the frame: the field stands there, and the note it makes is the group's
  const box = (await frame(page, "Leer").boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height * 0.6);
  await expect(field(page)).toBeFocused();
  await page.keyboard.type("Mittendrin");
  await page.keyboard.press("Enter");
  await expect(sentence(page)).toHaveText("1 Zettel in 1 Gruppe. 1 Person ist da.");
  expect(holds(await frameOf(frame(page, "Leer")), await placeOf(note(page, "Mittendrin")))).toBe(true);
  // a note is made without a group: a second frame says which one it lies in
  expect(of("note.create")).toHaveLength(1);
  await expect.poll(() => of("notes.move").length).toBe(1);
  expect(movesOf(of("notes.move")[0])).toMatchObject([
    { noteId: of("note.create")[0]!.noteId, groupId: expect.any(String) },
  ]);
  // „Neuer Zettel“ chooses the place itself: outside every frame, and nothing more is said about groups
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await page.keyboard.type("Draußen");
  await page.keyboard.press("Enter");
  await expect(sentence(page)).toHaveText("2 Zettel, 1 davon in 1 Gruppe. 1 Person ist da.");
  expect(holds(await frameOf(frame(page, "Leer")), await placeOf(note(page, "Draußen")))).toBe(false);
  expect(of("notes.move")).toHaveLength(1);
});

test("several notes are selected with Shift and a press; a drag moves them as one, „Neue Gruppe“ frames them", async ({
  page,
}) => {
  await enter(page, { hidden: false, notes: NOTES.slice(0, 3) });
  const frames = sent(page);
  await page.reload();
  await expect(page.locator(".app-note")).toHaveCount(3);
  const of = (type: string) => frames.filter((frame) => frame.type === type);
  const [one, two, three] = [note(page, "Weniger Termine"), note(page, "Entscheidungen"), note(page, "Zwei Ticket")];

  // a press makes a note the current one; Shift and a press on another takes that one in too
  await one.click();
  await expect(selected(page)).toHaveCount(1);
  await expect(page.locator(".app-surface__count")).toHaveCount(0);
  await two.click({ modifiers: ["Shift"] });
  await expect(selected(page)).toHaveCount(2);
  await expect(page.locator(".app-surface__count")).toHaveText("2 Zettel ausgewählt");
  await expect(page.locator(".app-note[data-picked]")).toHaveCount(2);
  // Shift and a press on a picked note takes it out again
  await three.click({ modifiers: ["Shift"] });
  await expect(page.locator(".app-surface__count")).toHaveText("3 Zettel ausgewählt");
  await three.click({ modifiers: ["Shift"] });
  await expect(page.locator(".app-surface__count")).toHaveText("2 Zettel ausgewählt");

  // one of the picked notes is dragged: both go, the same distance, in one frame
  const before = [await placeOf(one), await placeOf(two), await placeOf(three)];
  const { zoom } = await viewOf(page);
  await dragBy(page, two, 64 * zoom, 96 * zoom);
  await expect.poll(() => of("notes.move").length).toBe(1);
  // (from left to right: two notes made in the same millisecond stand in the order of their ids)
  expect(
    movesOf(of("notes.move")[0])
      .map(({ x, y }) => ({ x, y }))
      .sort((a, b) => a.x - b.x),
  ).toEqual([
    { x: before[0]!.x + 64, y: before[0]!.y + 96 },
    { x: before[1]!.x + 64, y: before[1]!.y + 96 },
  ]);
  expect(await placeOf(three)).toEqual(before[2]);
  // they are still selected: „Neue Gruppe“ draws its frame around them
  await expect(page.locator(".app-surface__count")).toHaveText("2 Zettel ausgewählt");
  await newGroup(page).click();
  await page.keyboard.type("Abstimmung");
  await page.keyboard.press("Enter");
  await expect(said(page)).toHaveText("Gruppe um 2 Zettel angelegt.");
  const made = await frameOf(frame(page, "Abstimmung"));
  expect(holds(made, await placeOf(one))).toBe(true);
  expect(holds(made, await placeOf(two))).toBe(true);
  expect(holds(made, await placeOf(three))).toBe(false);
  expect(of("group.create")).toHaveLength(1);
  await expect.poll(() => of("notes.move").length).toBe(2);
  expect(movesOf(of("notes.move")[1]).map((move) => move.groupId)).toEqual([
    of("group.create")[0]!.groupId,
    of("group.create")[0]!.groupId,
  ]);
  await expect(sentence(page)).toHaveText("3 Zettel, 2 davon in 1 Gruppe. 1 Person ist da.");
  // the selection is over: the new group is the current thing
  await expect(page.locator(".app-surface__count")).toHaveCount(0);

  // a selection is put away with its tool, or with a press on the bare ground
  await one.click();
  await two.click({ modifiers: ["Shift"] });
  await tool(page, "Auswahl aufheben").click();
  await expect(page.locator(".app-note[data-picked]")).toHaveCount(0);
  await expect(said(page)).toHaveText("Auswahl aufgehoben.");
  // „Verschieben nach …“ takes a selection out of its group, to free places outside every frame
  await one.click();
  await two.click({ modifiers: ["Shift"] });
  await tool(page, "Verschieben nach …").click();
  const dialog = page.locator("#app-dlg-move");
  await expect(dialog.getByRole("radio", { name: "Abstimmung" })).toBeChecked();
  await dialog.getByRole("radio", { name: "Keine Gruppe" }).check();
  await dialog.getByRole("button", { name: "Verschieben", exact: true }).click();
  await expect(said(page)).toHaveText("2 Zettel liegen jetzt ohne Gruppe.");
  expect(holds(made, await placeOf(one))).toBe(false);
  expect(holds(made, await placeOf(two))).toBe(false);
  await expect(sentence(page)).toHaveText("3 Zettel und 1 leere Gruppe. 1 Person ist da.");
});

test("„Auswählen“ selects several notes without Shift, as a finger does: a tap picks, a tap takes out, a drag moves all", async ({
  browser,
}) => {
  // a tablet: a touch screen, which has no Shift, and room for the surface
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1024, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/");
  await enter(page, { hidden: false, notes: NOTES.slice(0, 3) });
  const frames = sent(page);
  await page.reload();
  await expect(page.locator(".app-note")).toHaveCount(3);
  const of = (type: string) => frames.filter((frame) => frame.type === type);
  const [one, two, three] = [note(page, "Weniger Termine"), note(page, "Entscheidungen"), note(page, "Zwei Ticket")];
  const choose = tool(page, "Auswählen");

  // without it a tap makes a note the current one, and the next tap another: one finger selects one note
  await one.tap();
  await two.tap();
  await expect(selected(page)).toHaveCount(1);
  await expect(page.locator(".app-note[data-picked]")).toHaveCount(0);

  // „Auswählen“ is switched on, and says so: every tap on a note takes it into the selection
  await expect(choose).toHaveAttribute("aria-pressed", "false");
  await choose.tap();
  await expect(choose).toHaveAttribute("aria-pressed", "true");
  await expect(said(page)).toHaveText("Auswählen ist an: Ein Druck auf einen Zettel wählt ihn aus oder wieder ab.");
  await one.tap();
  await expect(said(page)).toHaveText("1 Zettel ausgewählt");
  await two.tap();
  await three.tap();
  await expect(page.locator(".app-surface__count")).toHaveText("3 Zettel ausgewählt");
  // a tap on a picked note takes it out again, and two taps open no field
  await three.tap();
  await expect(page.locator(".app-surface__count")).toHaveText("2 Zettel ausgewählt");
  await expect(page.locator(".app-note[data-picked]")).toHaveCount(2);
  await expect(field(page)).toHaveCount(0);
  await expect(page.locator(".app-surface__problem")).toBeEmpty();

  // one of the picked notes is dragged: both go the same distance, in one frame, and stay selected
  const before = [await placeOf(one), await placeOf(two), await placeOf(three)];
  const { zoom } = await viewOf(page);
  await dragBy(page, two, 64 * zoom, 96 * zoom);
  await expect.poll(() => of("notes.move").length).toBe(1);
  expect(movesOf(of("notes.move")[0])).toHaveLength(2);
  expect(await placeOf(one)).toEqual({ x: before[0]!.x + 64, y: before[0]!.y + 96 });
  expect(await placeOf(two)).toEqual({ x: before[1]!.x + 64, y: before[1]!.y + 96 });
  expect(await placeOf(three)).toEqual(before[2]);
  await expect(page.locator(".app-surface__count")).toHaveText("2 Zettel ausgewählt");

  // „Auswahl aufheben“ puts the selection away, and „Auswählen“ with it: a tap selects one note again
  await tool(page, "Auswahl aufheben").tap();
  await expect(page.locator(".app-note[data-picked]")).toHaveCount(0);
  await expect(choose).toHaveAttribute("aria-pressed", "false");
  await three.tap();
  await expect(selected(page)).toHaveCount(1);
  await expect(page.locator(".app-note[data-picked]")).toHaveCount(0);
  await context.close();
});

test("„Alles zeigen“ shows the frames too; a full group grows for a note that is moved into it", async ({ page }) => {
  // a group with four short notes is full: two beside each other, twice
  const full = { title: "Voll", notes: ["Eins", "Zwei", "Drei", "Vier"] };
  await enter(page, { hidden: false, groups: [full, { title: "Leer", notes: [] }], notes: ["Fünf"] });
  const frames = sent(page);
  await page.reload();
  await expect(page.locator(".app-note")).toHaveCount(5);
  // the wall opens with every note and every frame in view, the empty one too
  await expect(frame(page, "Leer")).toBeInViewport({ ratio: 0.99 });
  await expect(frame(page, "Voll")).toBeInViewport({ ratio: 0.99 });
  await expect(note(page, "Fünf")).toBeInViewport({ ratio: 0.99 });
  // zoomed in on the middle, the frames leave the view; 0 brings all of it back
  await ground(page).focus();
  for (let n = 0; n < 6; n++) await page.keyboard.press("+");
  await expect(frame(page, "Leer")).not.toBeInViewport({ ratio: 0.99 });
  await page.keyboard.press("0");
  await expect(frame(page, "Leer")).toBeInViewport({ ratio: 0.99 });
  await expect(frame(page, "Voll")).toBeInViewport({ ratio: 0.99 });

  const before = await frameOf(frame(page, "Voll"));
  await note(page, "Fünf").click();
  await tool(page, "Verschieben nach …").click();
  await page.locator("#app-dlg-move").getByRole("radio", { name: "Voll" }).check();
  await page.locator("#app-dlg-move").getByRole("button", { name: "Verschieben", exact: true }).click();
  await expect(said(page)).toHaveText("Zettel nach „Voll“ verschoben.");
  const after = await frameOf(frame(page, "Voll"));
  expect(after.h).toBeGreaterThan(before.h);
  expect({ x: after.x, y: after.y, w: after.w }).toEqual({ x: before.x, y: before.y, w: before.w });
  const at = await placeOf(note(page, "Fünf"));
  expect(holds(after, at)).toBe(true);
  // it covers none of the four that lay there
  for (const text of full.notes) {
    const other = await placeOf(note(page, text));
    expect(Math.abs(other.x - at.x) >= 240 || Math.abs(other.y - at.y) >= 104).toBe(true);
  }
  // the frame grew in one `group.update`, the note went in one `notes.move`
  expect(frames.filter((frame) => frame.type === "group.update")).toHaveLength(1);
  expect(frames.filter((frame) => frame.type === "notes.move")).toHaveLength(1);
});

test("the list shows the same wall: groups as headings, notes as rows; every action of the surface is there", async ({
  page,
  browser,
}) => {
  await enter(page, { hidden: false, groups: GROUPS, notes: ["Fokuszeit am Vormittag"], view: "list" });
  await expect(page.locator(".app-surface")).toHaveCount(0);
  await expect(headings(page)).toHaveText(["Abstimmung 3", "Werkzeuge 2", "Ohne Titel 1", "Ohne Gruppe 1"]);
  await expect(page.locator(".app-list__row")).toHaveCount(7);
  // the wall's question stays the page's one heading, and the view is a list for the copy's check
  await expect(page.locator("h1:visible")).toHaveText([QUESTION]);
  await expect(page.locator('[data-sb-view="wand"]')).toHaveAttribute("data-sb-view-type", "list");
  // Clara looks at the surface
  const clara = await another(browser, page.url(), "Clara");
  const menu = (text: string) => row(page, text).getByRole("button", { name: `Mehr zu „${text}“` });
  const item = (name: string) => page.getByRole("menuitem", { name, exact: true });

  // a new note: the wall's primary action opens a field under the notes without a group; Enter saves
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  const text = page.getByRole("textbox", { name: "Text des Zettels" });
  await expect(text).toBeFocused();
  await text.fill("Weniger Termine");
  await page.keyboard.press("Enter");
  await expect(headings(page)).toHaveText(["Abstimmung 3", "Werkzeuge 2", "Ohne Titel 1", "Ohne Gruppe 2"]);
  await expect(menu("Weniger Termine")).toBeFocused();
  // nobody sees who wrote a note: the list names no Ben, who wrote the others. Anna's own note says that it is hers
  await expect(page.locator(".app-list")).not.toContainText("Ben");
  await expect(page.locator(".app-list__own")).toHaveCount(1);
  await expect(row(page, "Weniger Termine").locator(".app-list__own")).toHaveText("Deiner");
  await expect(row(page, "Weniger Termine").locator(".app-list__own")).toBeVisible();
  await expect(row(page, "Mehr Pausen").locator(".app-list__own")).toHaveCount(0);
  // on the surface it lies in no frame, and covers no note
  await expect(note(clara, "Weniger Termine")).toHaveCount(1);
  const at = await placeOf(note(clara, "Weniger Termine"));
  for (const title of ["Abstimmung", "Werkzeuge", "Ohne Titel"])
    expect(holds(await frameOf(frame(clara, title)), at)).toBe(false);
  const near = await placeOf(note(clara, "Fokuszeit am Vormittag"));
  expect(Math.abs(near.x - at.x) >= 240 || Math.abs(near.y - at.y) >= 104).toBe(true);
  // Escape leaves the field without a note, and the focus is back on the action
  await page.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(text).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Neuer Zettel", exact: true })).toBeFocused();

  // its text: only its writer's. Anna wrote „Weniger Termine“, Ben the others
  await menu("Weniger Termine").click();
  await expect(item("Bearbeiten")).toBeVisible();
  await item("Bearbeiten").click();
  await expect(text).toHaveValue("Weniger Termine");
  await text.fill("Weniger Termine ohne Ergebnis");
  await page.getByRole("button", { name: "Sichern", exact: true }).click();
  await expect(note(clara, "Weniger Termine ohne Ergebnis")).toHaveCount(1);
  await expect(menu("Weniger Termine ohne Ergebnis")).toBeFocused();

  // „Verschieben nach …“: the row stands under the group's heading, and on the surface the note lies in the frame
  await menu("Weniger Termine ohne Ergebnis").click();
  await item("Verschieben nach …").click();
  const dialog = page.locator("#app-dlg-move");
  await expect(dialog.getByRole("radio", { name: "Keine Gruppe" })).toBeChecked();
  await dialog.getByRole("radio", { name: "Werkzeuge" }).check();
  await dialog.getByRole("button", { name: "Verschieben", exact: true }).click();
  await expect(said(page)).toHaveText("Zettel nach „Werkzeuge“ verschoben.");
  await expect(headings(page)).toHaveText(["Abstimmung 3", "Werkzeuge 3", "Ohne Titel 1", "Ohne Gruppe 1"]);
  await expect(menu("Weniger Termine ohne Ergebnis")).toBeFocused();
  await expect
    .poll(async () =>
      holds(await frameOf(frame(clara, "Werkzeuge")), await placeOf(note(clara, "Weniger Termine ohne Ergebnis"))),
    )
    .toBe(true);
  // somebody else's note: no „Bearbeiten“; the moderation may delete it, after the question
  await menu("Mehr Pausen").click();
  await expect(item("Bearbeiten")).toHaveCount(0);
  await item("Löschen").click();
  await expect(page.locator("#app-dlg-note")).toContainText("„Mehr Pausen“ wird für alle gelöscht.");
  await page.locator('#app-dlg-note button[value="confirm"]').click();
  await expect(note(clara, "Mehr Pausen")).toHaveCount(0);
  // the group it stood in is empty now, and says so
  await expect(headings(page)).toHaveText(["Abstimmung 3", "Werkzeuge 3", "Ohne Titel 0", "Ohne Gruppe 1"]);
  await expect(page.locator(".app-list")).toContainText("Noch keine Zettel in dieser Gruppe.");

  // a new group: the wall's second action opens a field for its title; on the surface its frame covers nothing
  await newGroup(page).click();
  await expect(titleField(page)).toBeFocused();
  await titleField(page).fill("Fokus");
  await page.keyboard.press("Enter");
  await expect(headings(page)).toHaveText(["Abstimmung 3", "Werkzeuge 3", "Ohne Titel 0", "Fokus 0", "Ohne Gruppe 1"]);
  await expect(frame(clara, "Fokus")).toHaveCount(1);
  const made = await frameOf(frame(clara, "Fokus"));
  for (const title of ["Abstimmung", "Werkzeuge", "Ohne Titel"]) {
    const other = await frameOf(frame(clara, title));
    expect(made.x >= other.x + other.w || other.x >= made.x + made.w || made.y >= other.y + other.h).toBe(true);
  }
  // a group's menu: its title, and its end
  await page.getByRole("button", { name: "Mehr zu „Ohne Titel“" }).click();
  await item("Umbenennen").click();
  await titleField(page).fill("Pausen");
  await page.keyboard.press("Enter");
  await expect(frame(clara, "Pausen")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Mehr zu „Pausen“" })).toBeFocused();
  await page.getByRole("button", { name: "Mehr zu „Werkzeuge“" }).click();
  await item("Gruppe löschen").click();
  await expect(page.locator("#app-dlg-group")).toContainText("Die 3 Zettel darin bleiben auf der Wand, ohne Gruppe.");
  await page.locator('#app-dlg-group button[value="confirm"]').click();
  await expect(headings(page)).toHaveText(["Abstimmung 3", "Pausen 0", "Fokus 0", "Ohne Gruppe 4"]);
  await expect(frame(clara, "Werkzeuge")).toHaveCount(0);
  await expect(clara.locator(".app-note")).toHaveCount(7);
  await expect(sentence(clara)).toHaveText("7 Zettel, 3 davon in 3 Gruppen. 2 Personen sind da.");
  // what Clara does on the surface shows in the list
  await clara.getByRole("button", { name: "Neuer Zettel", exact: true }).click();
  await clara.getByRole("textbox", { name: "Text des Zettels" }).fill("Mehr Pausen am Nachmittag");
  await clara.keyboard.press("Enter");
  await expect(row(page, "Mehr Pausen am Nachmittag")).toHaveCount(1);
  await clara.context().close();
});

test("the list by keyboard: a group's title, a row's menu and „Verschieben nach …“", async ({ page }) => {
  await enter(page, { hidden: false, groups: GROUPS.slice(0, 2), notes: ["Fokuszeit am Vormittag"], view: "list" });
  // a group's title: its menu, „Umbenennen“, the field; Escape leaves it as it was, Enter saves
  await tabTo(page, page.getByRole("button", { name: "Mehr zu „Abstimmung“" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Umbenennen", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(titleField(page)).toBeFocused();
  await expect(titleField(page)).toHaveValue("Abstimmung");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Mehr zu „Abstimmung“" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type(" im Team");
  await page.keyboard.press("Enter");
  await expect(headings(page)).toHaveText(["Abstimmung im Team 3", "Werkzeuge 2", "Ohne Gruppe 1"]);
  await expect(page.getByRole("button", { name: "Mehr zu „Abstimmung im Team“" })).toBeFocused();

  // a row's menu: „Verschieben nach …“ opens on where the note stands, the arrow keys choose, Enter moves
  const more = page.getByRole("button", { name: "Mehr zu „Fokuszeit am Vormittag“" });
  await tabTo(page, more);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Verschieben nach …", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.locator("#app-dlg-move");
  await expect(dialog.getByRole("radio", { name: "Keine Gruppe" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(said(page)).toHaveText("Zettel nach „Werkzeuge“ verschoben.");
  await expect(headings(page)).toHaveText(["Abstimmung im Team 3", "Werkzeuge 3"]);
  // the row is another element under another heading: its menu has the focus again
  await expect(more).toBeFocused();
  // Escape puts the question away and changes nothing
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("radio", { name: "Werkzeuge" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(headings(page)).toHaveText(["Abstimmung im Team 3", "Werkzeuge 3"]);
  await expect(more).toBeFocused();
});

test("writing in the list leaves the page where it stood, or as near to it as keeps the new row in view", async ({
  browser,
}) => {
  // a phone on which a short list fits the window, and the field of a new note under it does not: the field with its
  // label and its two actions is three rows high
  const context = await browser.newContext({ viewport: { width: 390, height: 760 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await enter(page, { hidden: false, view: "list" });
  const scrolled = () => page.evaluate(() => window.scrollY);
  const newNote = page.getByRole("button", { name: "Neuer Zettel", exact: true });
  const head = page.locator("[data-sb-web-app-head]");

  // a short list: the page moves to show the field, and is back when the note is saved; the wall's head is in view
  await newNote.click();
  await expect(field(page)).toBeFocused();
  expect(await scrolled()).toBeGreaterThan(0);
  await page.keyboard.type("Weniger Termine");
  await page.keyboard.press("Enter");
  await expect(row(page, "Weniger Termine")).toHaveCount(1);
  expect(await scrolled()).toBe(0);
  await expect(head).toBeInViewport({ ratio: 1 });
  // and so when the field is left without a note
  await newNote.click();
  await expect(field(page)).toBeFocused();
  expect(await scrolled()).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(field(page)).toHaveCount(0);
  expect(await scrolled()).toBe(0);

  // A long list: the new row stands at its end, where the zone would cover it with the page back. The page goes
  // back only as far as leaves the row in view: its menu, which has the focus, stands right above the zone
  for (const text of NOTES.slice(1, 6)) {
    await newNote.click();
    await field(page).fill(text);
    await page.keyboard.press("Enter");
    await expect(page.locator(".app-list__row")).toHaveCount(NOTES.indexOf(text) + 1);
  }
  expect(await scrolled()).toBeGreaterThan(0);
  const last = page
    .locator(".app-list__row")
    .last()
    .getByRole("button", { name: /^Mehr zu „/ });
  await expect(last).toBeFocused();
  const [menu, zone] = [(await last.boundingBox())!, (await page.locator(".sb-bottom-block").boundingBox())!];
  expect(menu.y).toBeGreaterThanOrEqual(0);
  expect(menu.y + menu.height).toBeLessThanOrEqual(zone.y + 1);
  // and no further: the menu stands right above the zone, not somewhere up the window
  expect(zone.y - (menu.y + menu.height)).toBeLessThan(48);
  await context.close();
});

test("a phone opens a wall as its list, a wide window as its surface; the choice is remembered", async ({
  browser,
}) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await phone.newPage();
  await page.goto("/");
  const { wallId } = await enter(page, { hidden: false, groups: GROUPS, notes: NOTES.slice(0, 2), view: null });
  // nothing was chosen: on a phone the wall is its list
  await expect(page.locator(".app-list")).toBeVisible();
  await expect(page.locator(".app-surface")).toHaveCount(0);
  await expect(viewSwitch(page, "Liste")).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("ideabeam-view"))).toBeNull();
  // the surface is one press away, and the choice holds from then on
  await viewSwitch(page, "Fläche").check({ force: true });
  await expect(page.locator(".app-surface")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ideabeam-view"))).toBe("surface");
  await page.reload();
  await expect(page.locator(".app-surface")).toBeVisible();
  await expect(page.locator(".app-note")).toHaveCount(8);
  await phone.close();

  // a wide window opens the surface; the list chosen there is the choice for the next wall too
  const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desk = await wide.newPage();
  await desk.goto(`/w/${wallId}`);
  await desk.fill("#app-f-as", "Clara");
  await desk.locator('#app-form button[type="submit"]').click();
  await expect(desk.locator(".app-surface")).toBeVisible();
  await expect(viewSwitch(desk, "Fläche")).toBeChecked();
  await viewSwitch(desk, "Liste").check({ force: true });
  await expect(desk.locator(".app-list")).toBeVisible();
  expect(await desk.evaluate(() => localStorage.getItem("ideabeam-view"))).toBe("list");
  await desk.reload();
  await expect(desk.locator(".app-list")).toBeVisible();
  await expect(row(desk, "Weniger Termine")).toHaveCount(1);
  await expect(desk.locator(".app-surface")).toHaveCount(0);
  await wide.close();
});

// The acceptance of stage 2: axe without findings on the surface and on the list, light and dark, narrow and wide.
// tests/screens.spec.ts checks light at 390 px and dark at 1440 px with everything else it looks at, and both views
// once at 200 %; here are the two pairings it leaves out, and its two again, on a wall with groups.
for (const scheme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    for (const view of ["surface", "list"] as const) {
      test(`axe: the ${view} of a wall with groups, ${scheme} at ${width} px`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width, height: width < 640 ? 844 : 900 },
          colorScheme: scheme,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        await page.goto("/");
        await enter(page, { hidden: false, groups: GROUPS, notes: NOTES.slice(0, 3), view });
        await page.evaluate(() => document.fonts.ready.then(() => true));
        if (view === "surface") {
          // with a note picked and the group's tools in the row: what a selection looks like
          await ground(page).focus();
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("Space");
          await expect(page.locator(".app-note[data-picked]")).toHaveCount(1);
        }
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
          .analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
        await context.close();
      });
    }
  }
}
