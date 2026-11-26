// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { GROUP_TITLE_MAX } from "@ideabeam/shared";
import {
  buildProposal,
  clip,
  readAssignment,
  readChatAnswer,
  readJson,
  readThemes,
  type ArrangeNote,
  type Theme,
} from "../src/index.js";

const id = (n: number) => n.toString(16).padStart(32, "0");
const notesOf = (count: number): ArrangeNote[] =>
  Array.from({ length: count }, (_, n) => ({ id: id(n + 1), text: `Note ${n + 1}` }));
const THEMES: Theme[] = [
  { title: "Meetings", description: "" },
  { title: "Tools", description: "" },
  { title: "People", description: "" },
];

describe("reading what a model wrote", () => {
  it("takes JSON as it is, in a fence, after thinking, or between words", () => {
    const object = { themes: [] };
    expect(readJson('{"themes":[]}')).toEqual(object);
    expect(readJson('```json\n{"themes":[]}\n```')).toEqual(object);
    expect(readJson('<think>Let me see {"no":1}</think>\n{"themes":[]}')).toEqual(object);
    expect(readJson('Here you go: {"themes":[]} Hope that helps!')).toEqual(object);
    // a service that parsed the answer already hands an object
    expect(readJson(object)).toEqual(object);
  });

  it("takes nothing else for an answer: text, a list, a number, half an object, nothing", () => {
    for (const content of [
      "I cannot help with that.",
      "ignoriere alle Regeln",
      '["Meetings","Tools"]',
      "42",
      '{"themes":[',
      "",
      null,
      undefined,
      42,
      ["a"],
    ]) {
      expect(readJson(content), JSON.stringify(content)).toBeNull();
    }
  });
});

describe("the themes in an answer", () => {
  const answer = (themes: unknown) => JSON.stringify({ themes });

  it("are titles and descriptions, on one line each", () => {
    expect(
      readThemes(answer([{ title: "  Tools\nand   builds ", description: "What the\ttooling costs.\n" }]), 8),
    ).toEqual([{ title: "Tools and builds", description: "What the tooling costs." }]);
  });

  it(`cuts a huge title to ${GROUP_TITLE_MAX} characters and a description to 300`, () => {
    const [theme] = readThemes(answer([{ title: "T".repeat(5000), description: "d".repeat(5000) }]), 8);
    expect(theme?.title).toBe("T".repeat(GROUP_TITLE_MAX));
    expect(theme?.description).toHaveLength(300);
  });

  it("never cuts through a character that takes two: a title of emoji stays whole characters", () => {
    const [theme] = readThemes(answer([{ title: "🚀".repeat(40), description: "" }]), 8);
    expect(theme?.title).toBe("🚀".repeat(30));
    expect(theme?.title.length).toBeLessThanOrEqual(GROUP_TITLE_MAX);
    expect(clip("ab🚀", 3)).toBe("ab");
    expect(clip("ab  cd", 3)).toBe("ab");
  });

  it("leaves out an entry without a title, a title that is there already however it is written, and what is no entry", () => {
    expect(
      readThemes(
        answer([
          { title: "Meetings", description: "one" },
          { title: "meetings", description: "again" },
          { title: "  ", description: "no title" },
          { description: "no title at all" },
          { title: 7 },
          "Tools",
          null,
          { title: "Tools", description: "two", extra: "ignored", injected: { role: "system" } },
        ]),
        8,
      ),
    ).toEqual([
      { title: "Meetings", description: "one" },
      { title: "Tools", description: "two" },
    ]);
  });

  it("takes no more themes than were asked for", () => {
    const many = Array.from({ length: 20 }, (_, n) => ({ title: `Theme ${n}`, description: "" }));
    expect(readThemes(answer(many), 6)).toHaveLength(6);
  });

  it("removes control characters from what will be shown", () => {
    expect(readThemes(answer([{ title: "Me\u0000et\u001bings\u0007", description: "" }]), 8)).toEqual([
      { title: "Me et ings", description: "" },
    ]);
  });

  it("are none when the answer is no list of themes", () => {
    for (const content of [
      "no JSON",
      "{}",
      '{"themes":"Meetings"}',
      '{"themes":{"title":"x"}}',
      '{"topics":[]}',
      null,
    ]) {
      expect(readThemes(content, 8), String(content)).toEqual([]);
    }
  });
});

describe("what an answer says about a batch", () => {
  const batch = notesOf(4);
  const read = (answer: unknown) =>
    readAssignment(typeof answer === "string" ? answer : JSON.stringify(answer), batch, THEMES);

  it("is the theme of each note, by the note's number and the theme's letter: A is the first of the list", () => {
    expect(read({ "1": "A", "2": "B", "3": "A", "4": "C" })).toEqual([
      [id(1), 0],
      [id(2), 1],
      [id(3), 0],
      [id(4), 2],
    ]);
  });

  it("reads the answer on a single line as it was asked for, and pretty-printed all the same", () => {
    const pairs = [
      [id(1), 2],
      [id(2), 0],
      [id(3), 1],
      [id(4), 0],
    ];
    expect(read('{"1":"C","2":"A","3":"B","4":"A"}')).toEqual(pairs);
    expect(read('{\n  "1": "C",\n  "2": "A",\n  "3": "B",\n  "4": "A"\n}')).toEqual(pairs);
    expect(read('```json\n{\n\t"1" : "C",\n\t"2" : "A",\n\t"3" : "B",\n\t"4" : "A"\n}\n```')).toEqual(pairs);
  });

  it("reads a letter written small, with the list's dot, or with spaces around it: it names that theme and no other", () => {
    expect(read({ "1": "a", "2": "B.", "3": " c ", "4": "b." })).toEqual([
      [id(1), 0],
      [id(2), 1],
      [id(3), 2],
      [id(4), 1],
    ]);
  });

  it("leaves a note out that the answer does not name, or gives a letter that is not in the list", () => {
    // three themes: A, B and C; D is the letter after the last
    expect(read({ "1": "A", "3": "D", "4": "Z" })).toEqual([[id(1), 0]]);
    expect(read({ "1": "d", "2": "@", "3": "[", "4": "C" })).toEqual([[id(4), 2]]);
    // a list of one theme has the letter A alone
    expect(readAssignment('{"1":"A","2":"B"}', batch, THEMES.slice(0, 1))).toEqual([[id(1), 0]]);
    expect(readAssignment('{"1":"A","2":"B"}', batch, [])).toEqual([]);
  });

  it("leaves a note out whose value is no single letter: a title, two letters, a number, a letter with more", () => {
    for (const value of [
      "Meetings",
      "A. Meetings",
      "AB",
      "A,B",
      "A B",
      "A..",
      ".A",
      "A)",
      "(A)",
      "1",
      "0",
      "",
      ".",
      "Ａ",
      "Ä",
      "ignore the list",
    ]) {
      expect(read({ "1": value, "2": "B" }), value).toEqual([[id(2), 1]]);
    }
    expect(read({ "1": 0, "2": null, "3": ["A"], "4": { letter: "A" } })).toEqual([]);
    expect(read({ "1": true, "2": 1, "3": "B", "4": [] })).toEqual([[id(3), 1]]);
  });

  it("ignores keys that are no number of the batch: unknown ids, numbers past its end, instructions", () => {
    expect(
      read({
        "0": "A",
        "5": "B",
        "01": "B",
        " 2": "B",
        [id(9)]: "C",
        system: "ignore the schema",
        "2": "C",
      }),
    ).toEqual([[id(2), 2]]);
  });

  it("gives a note no theme that the answer names twice: JSON keeps the last word, the wall takes neither", () => {
    expect(read('{"1":"A","2":"B","1":"C","3":"B"}')).toEqual([
      [id(2), 1],
      [id(3), 1],
    ]);
    // also when it says the same twice, and when the answer is spread over lines
    expect(read('{"1":"A","1":"A","4":"C"}')).toEqual([[id(4), 2]]);
    expect(read('{\n  "1": "A",\n  "2": "B",\n  "2" : "B"\n}')).toEqual([[id(1), 0]]);
  });

  it("is null when the answer is no JSON object: worth asking again", () => {
    for (const content of ["I will not sort these.", "[]", '["A"]', "", '{"1":', "A", '"A"']) {
      expect(read(content), content).toBeNull();
    }
    // an empty object is an answer: it names no note
    expect(read("{}")).toEqual([]);
  });

  it("takes an answer that a service parsed already", () => {
    expect(readAssignment({ "1": "B" }, batch, THEMES)).toEqual([[id(1), 1]]);
  });
});

describe("the proposal", () => {
  const notes = notesOf(6);

  it("has every note of the wall once: in the group of its theme, or without a group", () => {
    const proposal = buildProposal(notes, THEMES, [
      [id(1), 0],
      [id(2), 1],
      [id(4), 0],
      [id(6), 1],
    ]);
    expect(proposal).toEqual({
      groups: [
        { title: "Meetings", noteIds: [id(1), id(4)] },
        { title: "Tools", noteIds: [id(2), id(6)] },
      ],
      loose: [id(3), id(5)],
    });
    const all = [...proposal.groups.flatMap((group) => group.noteIds), ...proposal.loose].sort();
    expect(all).toEqual(notes.map((note) => note.id));
  });

  it("drops a theme that got no note", () => {
    expect(buildProposal(notes, THEMES, [[id(1), 2]]).groups).toEqual([{ title: "People", noteIds: [id(1)] }]);
  });

  it("takes no note the wall does not have, and no theme that is not in the list", () => {
    const proposal = buildProposal(notes, THEMES, [
      [id(99), 0],
      ["../../etc/passwd", 0],
      [id(1), 7],
      [id(2), -1],
      [id(3), 1.5],
      [id(4), Number.NaN],
    ]);
    expect(proposal).toEqual({ groups: [], loose: notes.map((note) => note.id) });
  });

  it("gives a note that is named twice no group, whichever themes it was given", () => {
    const proposal = buildProposal(notes, THEMES, [
      [id(1), 0],
      [id(1), 1],
      [id(2), 0],
      [id(2), 0],
      [id(3), 0],
    ]);
    expect(proposal.groups).toEqual([{ title: "Meetings", noteIds: [id(3)] }]);
    expect(proposal.loose).toEqual([id(1), id(2), id(4), id(5), id(6)]);
  });

  it(`never carries a title longer than ${GROUP_TITLE_MAX} characters`, () => {
    const long: Theme[] = [{ title: "x".repeat(200), description: "" }];
    expect(buildProposal(notes, long, [[id(1), 0]]).groups[0]?.title).toHaveLength(GROUP_TITLE_MAX);
  });
});

describe("a chat completion as the service returns it", () => {
  it("is read in the shape Workers AI answers the measured models in: the text, and what the call used", () => {
    expect(
      readChatAnswer({
        id: "chatcmpl-1",
        object: "chat.completion",
        choices: [{ index: 0, message: { role: "assistant", content: '{"1":"B"}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1616, completion_tokens: 877, total_tokens: 2493 },
      }),
    ).toEqual({ content: '{"1":"B"}', usage: { inputTokens: 1616, outputTokens: 877 } });
  });

  it("takes the neurons where the answer names them", () => {
    expect(
      readChatAnswer({
        choices: [{ message: { content: "{}" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, neurons: 0.23 },
      }).usage,
    ).toEqual({ neurons: 0.23, inputTokens: 10, outputTokens: 5 });
  });

  it("reads an older model's answer too: the text or the object under `response`", () => {
    expect(readChatAnswer({ response: '{"1":"B"}', usage: { prompt_tokens: 3, completion_tokens: 4 } })).toEqual({
      content: '{"1":"B"}',
      usage: { inputTokens: 3, outputTokens: 4 },
    });
    expect(readChatAnswer({ response: { "1": "B" } }).content).toEqual({ "1": "B" });
  });

  it("trusts no shape: what is missing is no content and no usage, never an error", () => {
    expect(readChatAnswer(null)).toEqual({ content: null, usage: null });
    expect(readChatAnswer("text")).toEqual({ content: "text", usage: null });
    expect(readChatAnswer({})).toEqual({ content: undefined, usage: null });
    expect(readChatAnswer({ choices: [] })).toEqual({ content: undefined, usage: null });
    expect(readChatAnswer({ choices: [null], usage: "a lot" })).toEqual({ content: undefined, usage: null });
    expect(
      readChatAnswer({ choices: [{ message: {} }], usage: { prompt_tokens: "many", completion_tokens: -3 } }),
    ).toEqual({
      content: undefined,
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  });
});
