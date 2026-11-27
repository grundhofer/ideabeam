// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  CATALOGUE,
  checkAgenda,
  DEFAULT_METHOD,
  METHOD_IDS,
  METHOD_ORDER,
  METHOD_TEXTS,
  agendaOf,
  methodTexts,
  stepName,
  type MethodLanguage,
} from "../src/index.js";

// The rule of PLAN-METHODEN.md 2: wherever a method is chosen or shown, its short description stands with its name.
// A method of the catalogue without its name and short description in both languages does not build; the app's
// test of `/neu` holds the other half (apps/web/src/pages/NewWall.test.tsx: every method shows its description).

const LANGUAGES: MethodLanguage[] = ["de", "en"];
const words = (text: string) => text.trim().split(/\s+/).length;

describe("every method of the catalogue is described, in both languages", () => {
  it("the catalogue and the texts name the same methods, and the choice lists every one of them once", () => {
    expect(Object.keys(CATALOGUE).sort()).toEqual([...METHOD_IDS].sort());
    for (const language of LANGUAGES) {
      expect(Object.keys(METHOD_TEXTS[language].methods).sort(), language).toEqual([...METHOD_IDS].sort());
    }
    expect([...METHOD_ORDER].sort()).toEqual([...METHOD_IDS].sort());
    expect(METHOD_ORDER[0]).toBe(DEFAULT_METHOD);
    // „Freie Wand“ is the choice's last option (docs/methoden-katalog.md, (b))
    expect(METHOD_ORDER.at(-1)).toBe("free");
  });

  for (const id of METHOD_IDS) {
    it(`${id}: a name and a short description of at most 25 words, in German and English`, () => {
      for (const language of LANGUAGES) {
        const texts = methodTexts(language, id);
        expect(texts.name.trim(), `${id} ${language} name`).not.toBe("");
        expect(texts.short.trim(), `${id} ${language} short`).not.toBe("");
        expect(words(texts.short), `${id} ${language}: ${texts.short}`).toBeLessThanOrEqual(25);
        // one sentence
        expect(texts.short.trim().endsWith("."), texts.short).toBe(true);
        expect(texts.short.slice(0, -1), texts.short).not.toMatch(/[.!?]\s/);
        for (const field of ["when", "result", "evidence"] as const) {
          expect(texts[field].trim(), `${id} ${language} ${field}`).not.toBe("");
        }
      }
    });

    it(`${id}: every step has its words in both languages, and nothing else has`, () => {
      const keys = CATALOGUE[id].steps.map((step) => step.key).sort();
      for (const language of LANGUAGES) {
        expect(Object.keys(methodTexts(language, id).steps).sort(), language).toEqual(keys);
        for (const key of keys) expect(stepName(language, id, key).trim(), `${language} ${key}`).not.toBe("");
      }
    });

    it(`${id}: its agenda can run`, () => {
      expect(checkAgenda(agendaOf(id))).toEqual([]);
    });
  }

  it("the words of the evidence levels, the purposes, the forms and the visibilities stand in both languages", () => {
    const [de, en] = [METHOD_TEXTS.de, METHOD_TEXTS.en];
    for (const part of ["evidence", "purposes", "modes", "visibility"] as const) {
      expect(Object.keys(de[part]).sort(), part).toEqual(Object.keys(en[part]).sort());
    }
    for (const level of Object.values({ ...de.evidence, ...en.evidence })) {
      expect(level.label.trim()).not.toBe("");
      expect(level.meaning.trim()).not.toBe("");
    }
  });
});

describe("the methods of stages M1 and M2", () => {
  it("„Still sammeln“ writes hidden first, then reveals, groups, votes in secret with points and discusses", () => {
    const steps = CATALOGUE["still-sammeln"].steps;
    expect(steps.map((step) => step.type)).toEqual(["write", "reveal", "cluster", "vote", "discuss"]);
    expect(steps.map((step) => step.visibility)).toEqual(["hidden", "all", "all", "aggregate", "all"]);
    // the vote of the catalogue: points, a quarter of the options a person and at least two (the default), alone
    expect(steps[3]).toMatchObject({
      mode: "individual",
      output: "ranking",
      vote: { kind: "dots", perPerson: null, maxPerOption: null },
    });
    expect(CATALOGUE["still-sammeln"].version).toBe(2);
    expect(steps.every((step) => step.advance === "moderation")).toBe(true);
    // its minutes are the sum of its steps, rounded up to five
    const seconds = steps.reduce((sum, step) => sum + (step.durationSec ?? 0), 0);
    expect(CATALOGUE["still-sammeln"].minutes).toBe(Math.ceil(seconds / 300) * 5);
  });

  it("„Freie Wand“ is one step in which everything is there for everyone, without a time", () => {
    expect(CATALOGUE.free.steps).toHaveLength(1);
    expect(CATALOGUE.free.steps[0]).toMatchObject({ visibility: "all", durationSec: null });
    expect(CATALOGUE.free.minutes).toBeNull();
  });
});
