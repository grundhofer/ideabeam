import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
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
  // hidden writing is on unless it is switched off
  expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual({
    question: "Was hält uns auf?",
    hidden: true,
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

test("„Verdeckt schreiben“ is a choice that is on; switched off, the wall is made without hidden writing", async () => {
  const fetched = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ wallId: WALL, adminToken: TOKEN }))));
  renderApp("/neu");
  await screen.findByRole("heading", { level: 1, name: "Neue Wand" });
  const hidden = screen.getByRole("switch", { name: "Verdeckt schreiben" });
  expect(hidden.getAttribute("aria-checked")).toBe("true");
  // the sentence under it says what the choice means, both ways
  expect(document.getElementById(hidden.getAttribute("aria-describedby")!)?.textContent).toBe(
    "Alle schreiben für sich, und niemand liest mit, bis die Moderation aufdeckt. Ausgeschaltet sehen alle jeden Zettel sofort.",
  );
  fireEvent.click(hidden);
  expect(hidden.getAttribute("aria-checked")).toBe("false");
  type("Was hält uns auf?");
  submit();
  await waitFor(() => expect(useWalls.getState().walls).toHaveLength(1));
  expect(JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))).toEqual({
    question: "Was hält uns auf?",
    hidden: false,
  });
});
