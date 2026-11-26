// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { arrange, fakeAsk, type ArrangeNote, type ArrangeStep, type Ask } from "../src/index.js";

// The stand-in for the model that local runs and end-to-end tests ask (fake.ts). It reads the prompts the real
// model gets, so these tests hold it to them: a run through the real procedure with the stand-in behind it.

const id = (n: number) => n.toString(16).padStart(32, "0");
const notes = (texts: string[]): ArrangeNote[] => texts.map((text, n) => ({ id: id(n + 1), text }));
const run = (list: ArrangeNote[]) => arrange({ question: "Was hält uns auf?", notes: list, language: "de" }, fakeAsk);

describe("the stand-in for the model", () => {
  it("puts the notes together that begin with the same word, the largest group first", async () => {
    const wall = notes([
      "Team braucht Pausen",
      "Technik: der Build dauert",
      "Technik: CI ist rot",
      "team will Fokuszeit",
      "Technik, immer wieder",
      "Kunden warten",
      "Team: zu viele Termine",
      "Kunden fragen nach",
      "TECHNIK ist alt",
    ]);
    const result = await run(wall);
    if (!result.ok) throw new Error("no proposal");
    expect(result.proposal).toEqual({
      groups: [
        { title: "Technik", noteIds: [id(2), id(3), id(5), id(9)] },
        { title: "Team", noteIds: [id(1), id(4), id(7)] },
        { title: "Kunden", noteIds: [id(6), id(8)] },
      ],
      loose: [],
    });
  });

  it("with fewer themes than first words, the notes of the other words join the last theme", async () => {
    // eight notes are asked for two themes
    const wall = notes(["Team a", "Team b", "Team c", "Technik a", "Technik b", "Kunden a", "Kunden b", "Lager a"]);
    const result = await run(wall);
    if (!result.ok) throw new Error("no proposal");
    expect(result.proposal.groups).toEqual([
      { title: "Team", noteIds: [id(1), id(2), id(3)] },
      { title: "Technik", noteIds: [id(4), id(5), id(6), id(7), id(8)] },
    ]);
  });

  it("keeps to the number of themes the request asks for: more words than themes, the rest joins the last", async () => {
    const wall = notes(Array.from({ length: 12 }, (_, n) => `${"abcdefghijkl"[n]}wort und mehr`));
    const result = await run(wall);
    if (!result.ok) throw new Error("no proposal");
    // twelve notes: two to four themes
    expect(result.proposal.groups).toHaveLength(4);
    expect(result.proposal.groups.map((group) => group.noteIds.length)).toEqual([1, 1, 1, 9]);
    expect(result.proposal.loose).toEqual([]);
  });

  it("names six themes at most, however many first words a large wall has", async () => {
    // sixty notes that begin with eight words
    const words: Array<[string, number]> = [
      ["Alpha", 14],
      ["Beta", 12],
      ["Gamma", 10],
      ["Delta", 8],
      ["Epsilon", 6],
      ["Zeta", 5],
      ["Eta", 3],
      ["Theta", 2],
    ];
    const wall = notes(
      words.flatMap(([word, count]) => Array.from({ length: count }, (_, n) => `${word} Zettel ${n}`)),
    );
    const result = await run(wall);
    if (!result.ok) throw new Error("no proposal");
    expect(result.themes.map((theme) => theme.title)).toEqual(["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"]);
    // the notes of the two words that got no theme joined the last one
    expect(result.proposal.groups.map((group) => [group.title, group.noteIds.length])).toEqual([
      ["Alpha", 14],
      ["Beta", 12],
      ["Gamma", 10],
      ["Delta", 8],
      ["Epsilon", 6],
      ["Zeta", 5 + 3 + 2],
    ]);
    expect(result.proposal.groups[5]?.noteIds).toEqual(wall.slice(50).map((note) => note.id));
    expect(result.proposal.loose).toEqual([]);
  });

  it("names a second theme when every note begins with the same word: a run needs two", async () => {
    const result = await run(notes(Array.from({ length: 6 }, (_, n) => `Immer dasselbe ${n}`)));
    if (!result.ok) throw new Error("no proposal");
    expect(result.proposal.groups).toEqual([{ title: "Immer", noteIds: [1, 2, 3, 4, 5, 6].map(id) }]);
    expect(result.themes.map((theme) => theme.title)).toEqual(["Immer", "Theme 2"]);
  });

  it("answers the same every time, and says what its calls would have cost", async () => {
    const wall = notes(Array.from({ length: 60 }, (_, n) => `${["Alpha", "Beta", "Gamma"][n % 3]} Zettel ${n}`));
    const [first, second] = [await run(wall), await run(wall)];
    expect(second).toEqual(first);
    // the themes and two batches
    expect(first.usage).toMatchObject({ calls: 3, failed: 0, hedged: 0 });
    expect(first.usage.neurons).toBeGreaterThan(5);
    expect(first.usage.neurons).toBeLessThan(arrangeEstimateFor(60));
  });

  it("answers the two kinds of request a run makes, each in the shape the model is asked for: the assignment by letter, on a single line", async () => {
    const said: Array<[ArrangeStep, string]> = [];
    const listening: Ask = async (request, step) => {
      const answer = await fakeAsk(request, step);
      said.push([step, String(answer.content)]);
      return answer;
    };
    const wall = notes(["Team a", "Technik b", "Team c", "Technik d", "Team e", "Lager f", "Team g"]);
    const result = await arrange({ question: "Was hält uns auf?", notes: wall, language: "de" }, listening);
    expect(result.ok).toBe(true);
    expect(said).toEqual([
      [
        "themes",
        '{"themes":[{"title":"Team","description":"Notes that begin with \\"team\\"."},' +
          '{"title":"Technik","description":"Notes that begin with \\"technik\\"."}]}',
      ],
      ["assign", '{"1":"A","2":"B","3":"A","4":"B","5":"A","6":"B","7":"A"}'],
    ]);
  });

  it("answers at once: a run is over without waiting for a timer or for anything outside", async () => {
    const wall = notes(Array.from({ length: 120 }, (_, n) => `${["Alpha", "Beta", "Gamma"][n % 3]} Zettel ${n}`));
    let usage = null;
    void run(wall).then((result) => (usage = result.usage));
    // nothing but the turns of promises that are over already
    for (let turn = 0; turn < 100 && usage === null; turn++) await Promise.resolve();
    expect(usage).toMatchObject({ calls: 4, failed: 0, hedged: 0 });
  });

  it("copes with notes that begin with no word at all", async () => {
    const result = await run(notes(["🚀🚀🚀", "???", "Doku fehlt", "Doku veraltet", "…", "Doku???"]));
    if (!result.ok) throw new Error("no proposal");
    expect(result.proposal.groups[0]).toEqual({ title: "Doku", noteIds: [id(3), id(4), id(6)] });
    expect([...result.proposal.groups.flatMap((group) => group.noteIds), ...result.proposal.loose]).toHaveLength(6);
  });
});

/** The product's estimate for a run, as packages/shared states it: 20 neurons and one a note. */
const arrangeEstimateFor = (count: number) => 20 + count;
