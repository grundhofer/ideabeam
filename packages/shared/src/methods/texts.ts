// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Evidence, MethodId, Purpose, StepMode, StepVisibility } from "../domain/method.js";
import { CATALOGUE } from "./catalogue.js";

// The words of the methods, in German and English (docs/methoden-katalog.md). They stand here, in the shared
// package, and not in the app's string tables: the Worker writes the export, which names the wall's method with its
// short description (PLAN-METHODEN.md 2), and the app shows the same words on `/neu` and on the wall. The app loads
// them with those two views, never at its start (apps/web/tests/worker.spec.ts reads the built files for it).
//
// The rule of PLAN-METHODEN.md 2: wherever a method is chosen or shown, its short description stands with its name.
// So every method has both in both languages, and the short description is one sentence of at most 25 words
// (test/methods.test.ts). A step's words are keyed by its method and its key (`Step.key`).
//
// „Still sammeln, bündeln, verdeckt wählen“: the catalogue's texts, word for word; its steps without „Frage stellen“
// (part of „Ideen schreiben“, methods/catalogue.ts), its vote („Wählen“) since stage M2. „Freie Wand“: the catalogue names it
// and has no texts for it; these are the stage's own, for the owner to read. „Schätzen – Diskutieren – Schätzen“
// (stage M3): the catalogue's texts, but for two things. Its short description says „gemeinsam“ where the
// catalogue says „in Kleingruppen“, since the discussion is a step for everyone until stage M4 brings small groups;
// and it has no „auch bekannt als“: nobody searched the register for „Mini-Delphi“, and the catalogue's rule leaves
// such a line out until somebody has. „1-2-4-Alle“ (stage M4): the catalogue's texts, its steps without „Frage
// stellen“ (part of the writing). Its „auch bekannt als“ is left out too: the name it is known by is its own, and the
// attribution names Liberating Structures. These texts are an adaptation of a Liberating Structure and stand under
// CC BY-SA 4.0 (docs/methoden-katalog.md, „Liberating Structures“); the attribution's words (`attribution` below) follow the
// footer template of liberatingstructures.com/cc-license, read on 2026-11-27.

/** Where the attribution of a Liberating Structure leads: the source, and the licence. */
export const LIBERATING_STRUCTURES_URL = "https://www.liberatingstructures.com";
export const CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

export type MethodLanguage = "de" | "en";

export interface MethodTexts {
  name: string;
  /** One sentence, at most 25 words: what one does and what comes out. Shown wherever the method is. */
  short: string;
  /** When it fits. */
  when: string;
  /** What comes out. */
  result: string;
  /** The sentence under the evidence word: what supports the method, from findings the research verified. */
  evidence: string;
  /** A name it is widely known by, said as a description, never as the name of a template. */
  aka?: string;
  /** The words of its steps, by their key. */
  steps: Readonly<Record<string, { name: string }>>;
}

export interface CatalogueTexts {
  /** The five evidence levels: the word, and what it means. */
  evidence: Readonly<Record<Evidence, { label: string; meaning: string }>>;
  /** The headings of the choice on `/neu`. */
  purposes: Readonly<Record<Purpose, string>>;
  /** How a step is worked, and what is seen in it, as the steps of „Mehr dazu“ name them. */
  modes: Readonly<Record<StepMode, string>>;
  visibility: Readonly<Record<StepVisibility, string>>;
  methods: Readonly<Record<MethodId, MethodTexts>>;
  /** The attribution a method's licence asks for (`Method.attribution`): one sentence, and that the method's own
   *  texts stand under the same licence. */
  attribution: Readonly<Record<"liberatingStructures", { credit: string; licence: string }>>;
}

export const METHOD_TEXTS: Readonly<Record<MethodLanguage, CatalogueTexts>> = {
  de: {
    evidence: {
      metaAnalysis: {
        label: "Meta-Analyse",
        meaning: "Mindestens eine Meta-Analyse stützt den Kern des Ablaufs.",
      },
      experiments: {
        label: "Experimente",
        meaning: "Kontrollierte Experimente stützen den Kern des Ablaufs.",
      },
      studies: {
        label: "Studien",
        meaning: "Nur indirekte Belege: Studien aus einem Nachbarfeld oder ohne Vergleichsgruppe.",
      },
      practice: {
        label: "Praktikerkonsens",
        meaning: "Keine Studien mit Vergleich, höchstens Fallberichte; in der Praxis erprobt.",
      },
      disputed: {
        label: "umstritten",
        meaning: "Die Studien sind gemischt oder ausdrücklich kritisch.",
      },
    },
    purposes: {
      collect: "Ideen sammeln",
      decide: "Entscheiden",
      plan: "Planen und Ziele",
      review: "Rückblick",
      risk: "Risiken",
      none: "Ohne festen Ablauf",
    },
    modes: {
      individual: "allein",
      pair: "zu zweit",
      group: "Kleingruppe",
      plenary: "alle",
      presentation: "vorstellen",
    },
    visibility: {
      hidden: "verdeckt",
      team: "Gruppe",
      all: "alle",
      aggregate: "nur Summe",
      anonymous: "ohne Namen",
    },
    methods: {
      "still-sammeln": {
        name: "Still sammeln, bündeln, verdeckt wählen",
        short:
          "Alle schreiben Ideen verdeckt, die Ideen werden gebündelt, dann wählt jede Person verdeckt; heraus kommt eine Rangfolge.",
        when: "Wenn ihr zu einer offenen Frage viele Ideen braucht und am Ende wissen wollt, welche der Gruppe am wichtigsten sind.",
        result: "Alle Zettel in Gruppen mit Überschriften, Stimmen je Zettel und Gruppe, Rangfolge.",
        evidence:
          "Laut einer Meta-Analyse liefern Gruppen, die mündlich brainstormen, weniger Ideen als dieselben Leute allein; deshalb schreibt hier jede Person für sich. Die Punktwahl selbst ist nicht untersucht; sie läuft verdeckt, weil sichtbare Zwischenstände in einem großen Experiment spätere Bewertungen verzerrten.",
        aka: "Brainwriting mit Punktabfrage",
        steps: {
          write: { name: "Ideen schreiben" },
          reveal: { name: "Aufdecken" },
          cluster: { name: "Bündeln" },
          vote: { name: "Wählen" },
          discuss: { name: "Ergebnis besprechen" },
        },
      },
      "eins-zwei-vier": {
        name: "1-2-4-Alle",
        short: "Erst allein, dann zu zweit, dann zu viert denken; jede Vierergruppe bringt ihre stärkste Idee ein.",
        when: "Wenn alle in kurzer Zeit zu Wort kommen sollen, auch in großen Runden.",
        result: "Je Vierergruppe eine Kernidee, dazu alle Zettel aus den Phasen davor.",
        evidence:
          "Die Methode selbst ist nicht getestet. Ihr Prinzip schon: In Experimenten wurden Gruppen besser, wenn jede Person zuerst allein schrieb oder antwortete und kleine Gruppen danach darüber sprachen.",
        steps: {
          alone: { name: "Allein nachdenken und notieren" },
          pairs: { name: "Zu zweit austauschen" },
          fours: { name: "Zu viert: das Wichtigste herausarbeiten" },
          present: { name: "Jede Vierergruppe stellt eine Kernidee vor" },
        },
      },
      schaetzen: {
        name: "Schätzen – Diskutieren – Schätzen",
        short:
          "Alle schätzen verdeckt, besprechen gemeinsam die Abweichungen und schätzen neu; heraus kommt eine Gruppenschätzung mit Streuung.",
        when: "Wenn ihr eine Zahl braucht, etwa Aufwand, Termin oder Wahrscheinlichkeit, und das Wissen auf viele Köpfe verteilt ist.",
        result:
          "Beide Runden mit Median und Spannweite, die Begründungen ohne Namen, die Veränderung zwischen den Runden.",
        evidence:
          "Eine systematische Übersicht fand, dass solche Runden meist genauer sind als der Mittelwert der ersten Schätzungen und als frei diskutierende Gruppen. Fast alle Tests nutzen Aufgaben mit einer richtigen Antwort.",
        steps: {
          estimate1: { name: "Erste Schätzung mit Begründung" },
          feedback: { name: "Rückmeldung: Median, Spannweite, Begründungen" },
          discuss: { name: "Abweichungen besprechen" },
          estimate2: { name: "Neu schätzen" },
          result: { name: "Ergebnis ansehen" },
        },
      },
      free: {
        name: "Freie Wand",
        short:
          "Alle schreiben Zettel, die sofort für alle sichtbar sind, und ordnen sie gemeinsam, ohne festen Ablauf.",
        when: "Wenn ihr frei sammeln wollt, ohne Schritte und ohne verdecktes Schreiben, etwa für eine Liste, die nach und nach wächst.",
        result: "Alle Zettel, auf Wunsch in Gruppen mit Überschriften.",
        evidence:
          "In Experimenten übertraf elektronisches Brainstorming, bei dem alle mitlesen, mündliche Runden ab einer mittleren Gruppengröße. Diese Form selbst ist nicht untersucht.",
        steps: {
          wall: { name: "Schreiben und ordnen" },
        },
      },
    },
    attribution: {
      liberatingStructures: {
        credit:
          "Enthält Inhalte von www.liberatingstructures.com von Keith McCandless, Henri Lipmanowicz und Nancy White (Liberating Structures Fieldbook, 2026), lizenziert unter CC BY-SA 4.0.",
        licence: "Unser Text zu dieser Methode steht unter derselben Lizenz.",
      },
    },
  },
  en: {
    evidence: {
      metaAnalysis: {
        label: "Meta-analysis",
        meaning: "At least one meta-analysis supports the core of the method.",
      },
      experiments: {
        label: "Experiments",
        meaning: "Controlled experiments support the core of the method.",
      },
      studies: {
        label: "Studies",
        meaning: "Indirect evidence only, from a neighbouring field or without a control group.",
      },
      practice: {
        label: "Practitioner consensus",
        meaning: "No comparative studies, at most case reports; proven in practice.",
      },
      disputed: {
        label: "Contested",
        meaning: "Studies are mixed or explicitly critical.",
      },
    },
    purposes: {
      collect: "Collect ideas",
      decide: "Decide",
      plan: "Plans and goals",
      review: "Review",
      risk: "Risks",
      none: "No fixed sequence",
    },
    modes: {
      individual: "alone",
      pair: "in pairs",
      group: "small group",
      plenary: "everyone",
      presentation: "presenting",
    },
    visibility: {
      hidden: "hidden",
      team: "group",
      all: "everyone",
      aggregate: "total only",
      anonymous: "unnamed",
    },
    methods: {
      "still-sammeln": {
        name: "Write alone, group, vote in secret",
        short:
          "Everyone writes ideas in private, the ideas are grouped, then everyone votes in secret; you get a ranking.",
        when: "When you need many ideas on an open question and want to know which ones matter most to the group.",
        result: "All notes in titled groups, votes per note and group, ranking.",
        evidence:
          "A meta-analysis found that groups brainstorming out loud produce fewer ideas than the same people working alone, so here everyone writes on their own. Dot voting itself has not been studied; votes stay hidden because visible interim results skewed later ratings in a large experiment.",
        aka: "Brainwriting with dot voting",
        steps: {
          write: { name: "Write ideas" },
          reveal: { name: "Reveal" },
          cluster: { name: "Group" },
          vote: { name: "Vote" },
          discuss: { name: "Discuss the result" },
        },
      },
      "eins-zwei-vier": {
        name: "1-2-4-All",
        short: "Think alone, then in pairs, then in fours; each group of four brings its strongest idea.",
        when: "When everyone should contribute in little time, also in large groups.",
        result: "One core idea per group of four, plus all notes from the earlier phases.",
        evidence:
          "The method itself has not been tested. Its principle has: in experiments, groups did better when everyone first wrote or answered alone and small groups talked it over afterwards.",
        steps: {
          alone: { name: "Think and write alone" },
          pairs: { name: "Share in pairs" },
          fours: { name: "In fours: find what matters most" },
          present: { name: "Each group of four presents one core idea" },
        },
      },
      schaetzen: {
        name: "Estimate – discuss – estimate",
        short:
          "Everyone estimates in private, you discuss the differences together, then everyone estimates again; you get a group estimate with its spread.",
        when: "When you need a number, such as effort, date or likelihood, and the knowledge is spread across many people.",
        result: "Both rounds with median and range, the reasons without names, the change between rounds.",
        evidence:
          "A systematic review found that such rounds are usually more accurate than the average of first estimates and than freely discussing groups. Almost all tests used tasks with a correct answer.",
        steps: {
          estimate1: { name: "First estimate with a reason" },
          feedback: { name: "Feedback: median, range, reasons" },
          discuss: { name: "Discuss the differences" },
          estimate2: { name: "Estimate again" },
          result: { name: "Look at the result" },
        },
      },
      free: {
        name: "Free wall",
        short:
          "Everyone writes notes that everyone sees at once, and you arrange them together, with no fixed sequence.",
        when: "When you want to collect freely, without steps or hidden writing, for instance for a list that grows over time.",
        result: "All notes, in titled groups if you like.",
        evidence:
          "In experiments, electronic brainstorming, where everyone reads along, beat spoken rounds from medium group sizes on. This form itself has not been studied.",
        steps: {
          wall: { name: "Write and arrange" },
        },
      },
    },
    attribution: {
      liberatingStructures: {
        credit:
          "Includes content from www.liberatingstructures.com by Keith McCandless, Henri Lipmanowicz and Nancy White (Liberating Structures Fieldbook, 2026), licensed under CC BY-SA 4.0.",
        licence: "Our text on this method is under the same licence.",
      },
    },
  },
};

/** The words of a method in a language. */
export function methodTexts(language: MethodLanguage, methodId: MethodId): MethodTexts {
  return METHOD_TEXTS[language].methods[methodId];
}

/** The attribution a method needs, or null: its licence asks for none. */
export function methodAttribution(
  language: MethodLanguage,
  methodId: MethodId,
): { credit: string; licence: string } | null {
  const kind = CATALOGUE[methodId].attribution;
  return kind === undefined ? null : METHOD_TEXTS[language].attribution[kind];
}

/** The name of a step in a language: the method's own word for it. */
export function stepName(language: MethodLanguage, methodId: MethodId, key: string): string {
  return METHOD_TEXTS[language].methods[methodId].steps[key]?.name ?? key;
}
