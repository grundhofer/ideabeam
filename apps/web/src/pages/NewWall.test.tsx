import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CATALOGUE, METHOD_ORDER, methodTexts } from "@ideabeam/shared";
import i18n from "../i18n";
import { useWalls } from "../store/walls";
import { renderApp } from "../test-app";

const WALL = "ab".repeat(32);
const TOKEN = "cd".repeat(16);

afterEach(() => vi.restoreAllMocks());

const submit = () => fireEvent.click(screen.getByRole("button", { name: /Wand anlegen|Noch mal versuchen/ }));
const type = (value: string) => fireEvent.change(screen.getByLabelText("Frage"), { target: { value } });

test("the primary action stays enabled: a press says at the field what is wrong and focuses it", async () => {
  const fetched = vi.spyOn(globalThis, "fetch");
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  submit();
  expect(screen.getByText("Frage fehlt.")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByLabelText("Frage"));

  type("x".repeat(141));
  submit();
  // between the number and its unit stands U+00A0; the query reads it as a space
  expect(screen.getByText("Frage ist zu lang. Höchstens 140 Zeichen.")).toBeTruthy();
  expect(screen.queryByText("Frage fehlt.")).toBeNull();
  expect(fetched).not.toHaveBeenCalled();
});

test("a wall that could not be made says why, keeps the question, and the action offers to try again", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 429 }));
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  type("Was hält uns auf?");
  submit();
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Von hier wurden gerade zu viele Wände angelegt. Deine Frage ist noch da; versuch es in einer Minute noch mal.",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Frage").value).toBe("Was hält uns auf?");
  expect(screen.getByRole("button", { name: "Noch mal versuchen" })).toBeTruthy();
  expect(useWalls.getState().walls).toEqual([]);
  expect(useWalls.getState().adminTokens).toEqual({});
});

test("a wall that was made is known with its admin token, and the app goes to its door", async () => {
  const fetched = vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
    Promise.resolve(
      String(input) === "/api/walls"
        ? new Response(JSON.stringify({ wallId: WALL, adminToken: TOKEN }), { status: 200 })
        : // the wall's view asks for the wall next
          new Response(
            JSON.stringify({ wall: { id: WALL, question: "Was hält uns auf?", createdAt: 1_795_300_000_000 } }),
            { status: 200 },
          ),
    ),
  );
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  type("  Was hält uns auf? ");
  submit();
  await waitFor(() => expect(useWalls.getState().walls).toHaveLength(1));
  // „Still sammeln“ unless another method is chosen
  expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual({
    question: "Was hält uns auf?",
    agenda: { items: [{ methodId: "still-sammeln" }] },
  });
  const [wall] = useWalls.getState().walls;
  expect(wall).toMatchObject({ id: WALL, question: "Was hält uns auf?" });
  // nobody has joined yet: the door asks for the name
  expect(wall?.as).toBeUndefined();
  expect(useWalls.getState().adminTokens).toEqual({ [WALL]: TOKEN });
  expect(await screen.findByRole("heading", { level: 1, name: "Was hält uns auf?" })).toBeTruthy();
  expect(screen.getByRole("form", { name: "Beitreten" })).toBeTruthy();
  // the token went nowhere: the request for the wall names its address alone
  expect(fetched.mock.calls.map(([url]) => String(url))).toEqual(["/api/walls", `/api/walls/${WALL}`]);
});

test("a day whose walls are taken says when it goes on, keeps the question, and the action offers to try again", async () => {
  // 01:00 on this machine's clock, whatever its time zone
  const resetsAt = new Date(2026, 10, 23, 1, 0).getTime();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: "BUDGET_SPENT", resetsAt }), { status: 429 }),
  );
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  type("Was hält uns auf?");
  submit();
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Heute sind alle Wände vergeben. Ab 01:00\u00a0Uhr geht es weiter. Deine Frage ist noch da.",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Frage").value).toBe("Was hält uns auf?");
  expect(screen.getByRole("button", { name: "Noch mal versuchen" })).toBeTruthy();
  expect(useWalls.getState().walls).toEqual([]);
});

test("the method: „Still sammeln“ is chosen at first, „Freie Wand“ is the last choice, and is asked for by its id", async () => {
  const fetched = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ wallId: WALL, adminToken: TOKEN }))));
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  const group = screen.getByRole("group", { name: "Methode" });
  const options = within(group).getAllByRole<HTMLInputElement>("radio");
  expect(options.map((option) => option.value)).toEqual(["still-sammeln", "eins-zwei-vier", "schaetzen", "free"]);
  expect(options.map((option) => option.checked)).toEqual([true, false, false, false]);
  // under headings by purpose
  expect(
    within(group)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(["Ideen sammeln", "Entscheiden", "Ohne festen Ablauf"]);
  fireEvent.click(screen.getByRole("radio", { name: "Freie Wand" }));
  type("Was hält uns auf?");
  submit();
  await waitFor(() => expect(useWalls.getState().walls).toHaveLength(1));
  expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual({
    question: "Was hält uns auf?",
    agenda: { items: [{ methodId: "free" }] },
  });
});

test("1-2-4-Alle names Liberating Structures in „Mehr dazu“, with the licence and links (stage M4)", async () => {
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  const row = screen.getByRole("radio", { name: "1-2-4-Alle" }).closest("li") as HTMLElement;
  expect(within(row).getByText(/Erst allein, dann zu zweit, dann zu viert denken/)).toBeTruthy();
  fireEvent.click(within(row).getByRole("button", { name: /Mehr dazu/ }));
  expect(within(row).getByRole("heading", { name: "Namensnennung" })).toBeTruthy();
  expect(within(row).getByText(/Keith McCandless, Henri Lipmanowicz und Nancy White/).textContent).toContain(
    "CC BY-SA 4.0",
  );
  expect(
    within(row)
      .getByRole("link", { name: /liberatingstructures\.com/ })
      .getAttribute("href"),
  ).toBe("https://www.liberatingstructures.com");
  expect(
    within(row)
      .getByRole("link", { name: /CC BY-SA 4\.0/ })
      .getAttribute("href"),
  ).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
  // its steps with their form and visibility
  expect(within(row).getByText(/Zu zweit austauschen · zu zweit, Gruppe · 2/)).toBeTruthy();
});

test("a method that estimates asks for its unit, optional, and sends it with the method (stage M3)", async () => {
  const fetched = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ wallId: WALL, adminToken: TOKEN }))));
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  // no unit for a method that does not estimate
  expect(screen.queryByLabelText(/Einheit der Schätzung/)).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "Schätzen – Diskutieren – Schätzen" }));
  const unit = screen.getByLabelText<HTMLInputElement>(/Einheit der Schätzung/);
  fireEvent.change(unit, { target: { value: "x".repeat(21) } });
  type("Wie viele Tage braucht der Umzug?");
  submit();
  expect(screen.getByText("Einheit der Schätzung ist zu lang. Höchstens 20 Zeichen.")).toBeTruthy();
  expect(document.activeElement).toBe(unit);
  expect(fetched).not.toHaveBeenCalled();
  fireEvent.change(unit, { target: { value: " Tage " } });
  submit();
  await waitFor(() => expect(useWalls.getState().walls).toHaveLength(1));
  expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual({
    question: "Wie viele Tage braucht der Umzug?",
    agenda: { items: [{ methodId: "schaetzen", unit: "Tage" }] },
  });
});

test("the unit left empty: the method alone is asked for", async () => {
  const fetched = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ wallId: WALL, adminToken: TOKEN }))));
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  fireEvent.click(screen.getByRole("radio", { name: "Schätzen – Diskutieren – Schätzen" }));
  type("Wie wahrscheinlich ist ein Start im März?");
  submit();
  await waitFor(() => expect(useWalls.getState().walls).toHaveLength(1));
  expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual({
    question: "Wie wahrscheinlich ist ein Start im März?",
    agenda: { items: [{ methodId: "schaetzen" }] },
  });
});

// The rule of PLAN-METHODEN.md 2: wherever a method is chosen, its short description stands with its name, always
// visible, and a screen reader reads it with the name. The other half: packages/shared, test/methods.test.ts.
test.each(["de", "en"] as const)(
  "every method of the catalogue shows its short description on `/neu` (%s)",
  async (lang) => {
    await i18n.changeLanguage(lang);
    try {
      renderApp("/neu");
      await screen.findByRole("heading", { level: 1, name: lang === "de" ? "Neue Wand" : "New wall" });
      for (const method of METHOD_ORDER) {
        const { name, short } = methodTexts(lang, method);
        const option = screen.getByRole("radio", { name });
        // always visible: no part of „Mehr dazu“, nothing hidden
        const description = screen.getByText(short);
        expect(description.closest("[hidden]")).toBeNull();
        expect(option.getAttribute("aria-describedby")?.split(" ")).toContain(description.id);
        // the facts: the time and the group size, no evidence level (PLAN-METHODEN.md 7, question 5)
        const facts = document.getElementById(`app-method-${method}-facts`)?.textContent ?? "";
        expect(facts).toContain(`${CATALOGUE[method].groupSize[0]}–${CATALOGUE[method].groupSize[1]}`);
      }
    } finally {
      await i18n.changeLanguage("de");
    }
  },
);

test("„Mehr dazu“ is a key of its own: it opens the steps and the result, and chooses nothing", async () => {
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  const free = screen.getByRole<HTMLInputElement>("radio", { name: "Freie Wand" });
  const more = document.querySelector<HTMLButtonElement>('[data-method="still-sammeln"] .app-method__more')!;
  expect(more.getAttribute("aria-expanded")).toBe("false");
  const about = document.getElementById(more.getAttribute("aria-controls")!)!;
  expect(about.hidden).toBe(true);
  fireEvent.click(more);
  expect(more.getAttribute("aria-expanded")).toBe("true");
  expect(about.hidden).toBe(false);
  expect([...about.querySelectorAll("ol > li")].map((step) => step.textContent)).toEqual([
    "Ideen schreiben · allein, verdeckt · 7\u00a0Min.",
    "Aufdecken · alle, alle · 1\u00a0Min.",
    "Bündeln · alle, alle · 6\u00a0Min.",
    "Wählen · allein, nur Summe · 3\u00a0Min.",
    "Ergebnis besprechen · alle, alle · 5\u00a0Min.",
  ]);
  expect(about.textContent).toContain(methodTexts("de", "still-sammeln").result);
  // the method that was chosen stays chosen
  expect(screen.getByRole<HTMLInputElement>("radio", { name: "Still sammeln, bündeln, verdeckt wählen" }).checked).toBe(
    true,
  );
  expect(free.checked).toBe(false);
});
