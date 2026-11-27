// SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MethodId, Purpose, StepMode, StepVisibility } from "../domain/method.js";
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
//
// Stage M5: „Rückblick nach Ziel und Daten“, „Scheitern vorwegdenken“, „Stille Ideenrunde mit Rangfolge“ and „Was?
// Na und? Was nun?“, from the catalogue, with these changes. The retrospective's short description and its texts put
// the facts and numbers first and claim nothing about why it works (docs/belege-pruefung.md: what a meta-analysis
// found stronger is working from objective data, not the comparison with a goal). „Pre-Mortem“ and
// „Nominalgruppentechnik“ are left out as „auch bekannt als“: the catalogue marks both „Register offen“, and nobody
// has searched the register yet. The idea round's result names the points and how many ranked an idea, where the
// catalogue says „Streuung“: the app counts no spread per idea. „Was? Na und? Was nun?“ is an adaptation of a
// Liberating Structure and stands under CC BY-SA 4.0, with the same attribution as 1-2-4-Alle; in German its known
// English name is said as „auch bekannt als“. The steps of the four methods carry a sentence of what to do now
// (`hint`), which the wall shows under the step.

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
  /** A name it is widely known by, said as a description, never as the name of a template. */
  aka?: string;
  /** The words of its steps, by their key: the name, and where the method says it, one sentence of what to do now
   *  (`hint`, stage M5), shown on the wall under the step. */
  steps: Readonly<Record<string, { name: string; hint?: string }>>;
}

export interface CatalogueTexts {
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
        steps: {
          estimate1: { name: "Erste Schätzung mit Begründung" },
          feedback: { name: "Rückmeldung: Median, Spannweite, Begründungen" },
          discuss: { name: "Abweichungen besprechen" },
          estimate2: { name: "Neu schätzen" },
          result: { name: "Ergebnis ansehen" },
        },
      },
      rueckblick: {
        name: "Rückblick nach Ziel und Daten",
        short:
          "Ihr stellt Ziel und tatsächlichen Verlauf mit Fakten und Zahlen nebeneinander, sucht Gründe für Abweichungen und legt bis zu drei Aktionen fest.",
        when: "Nach einem Projekt, Sprint oder Vorfall, wenn das Team daraus lernen will und Fakten oder Zahlen dazu hat, etwa Messwerte, Tickets oder eine Zeitleiste.",
        result:
          "Ziel, Fakten und Zahlen, die Gründe der Kleingruppen in Bündeln, Stimmen je Aktion und bis zu drei Aktionen mit Wer und Bis wann.",
        aka: "Retrospektive, After-Action-Review",
        steps: {
          goal: {
            name: "Was sollte passieren? Das Ziel aufschreiben",
            hint: "Schreibt jede und jeder für sich auf, was das Ziel war; die anderen sehen es noch nicht.",
          },
          data: {
            name: "Was ist passiert? Fakten, Zahlen, Zeitleiste",
            hint: "Schreibt Fakten und Zahlen auf, am besten aus Aufzeichnungen statt aus dem Gedächtnis: Messwerte, Termine, was wann geschah.",
          },
          reveal: { name: "Aufdecken", hint: "Ziel und Fakten stehen jetzt für alle da, ohne Namen." },
          reasons: {
            name: "Warum die Abweichung? Gründe in Kleingruppen",
            hint: "Sucht in eurer Kleingruppe Gründe, warum der Verlauf vom Ziel abwich, und schreibt sie auf.",
          },
          present: {
            name: "Gründe vorstellen und bündeln",
            hint: "Jede Kleingruppe stellt ihre Gründe vor; bündelt, was zusammengehört.",
          },
          actions: {
            name: "Aktionen vorschlagen",
            hint: "Schlagt jede und jeder für sich Aktionen vor, die an den Gründen ansetzen; sie bleiben verdeckt bis zum nächsten Schritt.",
          },
          revealActions: {
            name: "Aktionen aufdecken",
            hint: "Alle Vorschläge stehen jetzt da; klärt Fragen, bevor ihr wählt.",
          },
          vote: { name: "Aktionen wählen" },
          decide: {
            name: "Bis zu drei Aktionen festlegen",
            hint: "Die Moderation legt bis zu drei Aktionen fest, jede mit Wer und Bis wann, und spricht dabei zuletzt.",
          },
        },
      },
      scheitern: {
        name: "Scheitern vorwegdenken",
        short:
          "Ihr stellt euch vor, der Plan ist gescheitert, und schreibt verdeckt auf, warum; heraus kommen Risiken und Planänderungen.",
        when: "Bevor ein Plan startet, solange er sich noch leicht ändern lässt.",
        result:
          "Die Gründe ohne Namen, gebündelt zu Risiken, und die beschlossenen Planänderungen mit Wer und Bis wann.",
        steps: {
          plan: {
            name: "Plan vorstellen",
            hint: "Wer den Plan kennt, stellt ihn vor; geschrieben wird im nächsten Schritt.",
          },
          reasons: {
            name: "Gründe aufschreiben",
            hint: "Stellt euch vor: Ein Jahr später ist der Plan gescheitert. Schreibt jede und jeder für sich auf, warum.",
          },
          reveal: {
            name: "Reihum aufdecken",
            hint: "Die Moderation deckt die Gründe einzeln auf, reihum und ohne Namen.",
          },
          risks: {
            name: "Zu Risiken bündeln",
            hint: "Bündelt die Gründe zu Risiken und gebt jedem Bündel einen Namen.",
          },
          adjust: {
            name: "Plan anpassen",
            hint: "Schreibt auf, was ihr am Plan ändert; die Moderation legt jede Änderung mit Wer und Bis wann fest.",
          },
        },
      },
      ideenrunde: {
        name: "Stille Ideenrunde mit Rangfolge",
        short:
          "Alle sammeln still, legen reihum je eine Idee offen, klären sie und ranken verdeckt; heraus kommt eine Rangliste.",
        when: "Wenn eine kleine Gruppe gemeinsam eine Reihenfolge braucht und laute Stimmen nicht den Ausschlag geben sollen.",
        result:
          "Alle Ideen im Wortlaut und die Rangliste aus den Punkten, mit der Zahl der Personen, die eine Idee gerankt haben.",
        steps: {
          collect: {
            name: "Still sammeln",
            hint: "Schreibt still und jede und jeder für sich Ideen zur Frage auf, eine je Zettel.",
          },
          reveal: {
            name: "Reihum aufdecken",
            hint: "Die Moderation deckt die Ideen einzeln auf, reihum und ohne Namen.",
          },
          clarify: {
            name: "Klären, ohne zu bewerten",
            hint: "Fragt nach, was eine Idee meint, ohne sie zu bewerten; gleiche Ideen dürft ihr bündeln.",
          },
          rank: { name: "Die fünf wichtigsten ranken" },
          result: { name: "Ergebnis ansehen" },
        },
      },
      "was-na-und": {
        name: "Was? Na und? Was nun?",
        short: "In drei Runden sammelt ihr Fakten, deutet sie und leitet nächste Schritte ab.",
        when: "Nach einem gemeinsamen Erlebnis, etwa einem Test, Kundentermin oder Ausfall, wenn es noch keine klaren Ziele zum Abgleich gibt.",
        result: "Fakten, Deutungen und nächste Schritte, je Kleingruppe und zusammengeführt.",
        aka: "What, So What, Now What? (Liberating Structures)",
        steps: {
          whatAlone: {
            name: "Was ist passiert? Allein notieren",
            hint: "Notiert für euch, was ihr beobachtet habt: Fakten, noch keine Deutungen.",
          },
          whatGroup: {
            name: "Was ist passiert? In der Kleingruppe",
            hint: "Tauscht in eurer Kleingruppe aus, was ihr beobachtet habt, und haltet fest, was ihr gemeinsam seht.",
          },
          whatPresent: {
            name: "Was ist passiert? Kleingruppen stellen vor",
            hint: "Jede Kleingruppe stellt ihre Fakten vor.",
          },
          soWhatAlone: {
            name: "Was bedeutet das? Allein notieren",
            hint: "Notiert für euch, was die Fakten bedeuten: Muster, Gründe, Überraschungen.",
          },
          soWhatGroup: {
            name: "Was bedeutet das? In der Kleingruppe",
            hint: "Tauscht in eurer Kleingruppe eure Deutungen aus und haltet die wichtigsten fest.",
          },
          soWhatPresent: {
            name: "Was bedeutet das? Kleingruppen stellen vor",
            hint: "Jede Kleingruppe stellt ihre Deutungen vor.",
          },
          nowWhatAlone: {
            name: "Was tun wir jetzt? Allein notieren",
            hint: "Notiert für euch, was ihr als Nächstes tun wollt.",
          },
          nowWhatGroup: {
            name: "Was tun wir jetzt? In der Kleingruppe",
            hint: "Einigt euch in eurer Kleingruppe auf nächste Schritte und haltet sie fest.",
          },
          nowWhatPresent: {
            name: "Was tun wir jetzt? Kleingruppen stellen vor",
            hint: "Jede Kleingruppe stellt ihre nächsten Schritte vor.",
          },
        },
      },
      free: {
        name: "Freie Wand",
        short:
          "Alle schreiben Zettel, die sofort für alle sichtbar sind, und ordnen sie gemeinsam, ohne festen Ablauf.",
        when: "Wenn ihr frei sammeln wollt, ohne Schritte und ohne verdecktes Schreiben, etwa für eine Liste, die nach und nach wächst.",
        result: "Alle Zettel, auf Wunsch in Gruppen mit Überschriften.",
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
        steps: {
          estimate1: { name: "First estimate with a reason" },
          feedback: { name: "Feedback: median, range, reasons" },
          discuss: { name: "Discuss the differences" },
          estimate2: { name: "Estimate again" },
          result: { name: "Look at the result" },
        },
      },
      rueckblick: {
        name: "Review against goal and data",
        short:
          "You set the goal against what happened, with facts and numbers, find reasons for the gaps and agree on up to three actions.",
        when: "After a project, sprint or incident, when the team wants to learn from it and has facts or numbers at hand, such as measurements, tickets or a timeline.",
        result:
          "Goal, facts and numbers, the small groups' reasons in bundles, votes per action and up to three actions with who and by when.",
        aka: "Retrospective, after-action review",
        steps: {
          goal: {
            name: "What was supposed to happen? Write down the goal",
            hint: "Each of you writes down what the goal was; the others do not see it yet.",
          },
          data: {
            name: "What happened? Facts, numbers, timeline",
            hint: "Write down facts and numbers, from records rather than memory where you can: measurements, dates, what happened when.",
          },
          reveal: { name: "Reveal", hint: "Goal and facts are there for everyone now, without names." },
          reasons: {
            name: "Why the gap? Reasons in small groups",
            hint: "In your small group, look for reasons why things went differently from the goal, and write them down.",
          },
          present: {
            name: "Present and bundle the reasons",
            hint: "Each small group presents its reasons; bundle what belongs together.",
          },
          actions: {
            name: "Propose actions",
            hint: "Each of you proposes actions that address the reasons; they stay hidden until the next step.",
          },
          revealActions: {
            name: "Reveal the actions",
            hint: "All proposals are there now; clear up questions before you vote.",
          },
          vote: { name: "Vote on actions" },
          decide: {
            name: "Agree on up to three actions",
            hint: "The moderation agrees on up to three actions, each with who and by when, and speaks last.",
          },
        },
      },
      scheitern: {
        name: "Imagine the failure",
        short: "You imagine the plan has failed and write down in private why; you get risks and changes to the plan.",
        when: "Before a plan starts, while it is still easy to change.",
        result:
          "The reasons without names, grouped into risks, and the agreed changes to the plan with who and by when.",
        steps: {
          plan: {
            name: "Present the plan",
            hint: "Whoever knows the plan presents it; writing comes in the next step.",
          },
          reasons: {
            name: "Write down the reasons",
            hint: "Imagine: a year from now, the plan has failed. Each of you writes down why.",
          },
          reveal: {
            name: "Reveal in turn",
            hint: "The moderation reveals the reasons one at a time, in turn and without names.",
          },
          risks: { name: "Group into risks", hint: "Bundle the reasons into risks and give each bundle a name." },
          adjust: {
            name: "Adjust the plan",
            hint: "Write down what you change in the plan; the moderation agrees on each change with who and by when.",
          },
        },
      },
      ideenrunde: {
        name: "Silent round with ranking",
        short:
          "Everyone collects ideas silently, shares one per turn, clarifies, and ranks in private; you get a ranked list.",
        when: "When a small group needs a shared order and loud voices should not decide it.",
        result: "All ideas word for word and the ranking from the points, with how many people ranked each idea.",
        steps: {
          collect: {
            name: "Collect silently",
            hint: "Each of you writes ideas on the question, silently, one per note.",
          },
          reveal: {
            name: "Reveal in turn",
            hint: "The moderation reveals the ideas one at a time, in turn and without names.",
          },
          clarify: {
            name: "Clarify without judging",
            hint: "Ask what an idea means without judging it; you may bundle ideas that are the same.",
          },
          rank: { name: "Rank your top five" },
          result: { name: "Look at the result" },
        },
      },
      "was-na-und": {
        name: "What? So what? Now what?",
        short: "In three rounds you collect facts, make sense of them and derive next steps.",
        when: "After a shared experience, such as a test, customer meeting or outage, when there is no clear goal to compare against.",
        result: "Facts, interpretations and next steps, per small group and combined.",
        steps: {
          whatAlone: {
            name: "What happened? Note alone",
            hint: "Note for yourself what you observed: facts, no interpretations yet.",
          },
          whatGroup: {
            name: "What happened? In the small group",
            hint: "Share in your small group what you observed, and note what you see together.",
          },
          whatPresent: { name: "What happened? Small groups present", hint: "Each small group presents its facts." },
          soWhatAlone: {
            name: "So what? Note alone",
            hint: "Note for yourself what the facts mean: patterns, reasons, surprises.",
          },
          soWhatGroup: {
            name: "So what? In the small group",
            hint: "Share your interpretations in your small group and note the most important ones.",
          },
          soWhatPresent: {
            name: "So what? Small groups present",
            hint: "Each small group presents its interpretations.",
          },
          nowWhatAlone: { name: "Now what? Note alone", hint: "Note for yourself what you want to do next." },
          nowWhatGroup: {
            name: "Now what? In the small group",
            hint: "Agree on next steps in your small group and note them.",
          },
          nowWhatPresent: {
            name: "Now what? Small groups present",
            hint: "Each small group presents its next steps.",
          },
        },
      },
      free: {
        name: "Free wall",
        short:
          "Everyone writes notes that everyone sees at once, and you arrange them together, with no fixed sequence.",
        when: "When you want to collect freely, without steps or hidden writing, for instance for a list that grows over time.",
        result: "All notes, in titled groups if you like.",
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

/** The sentence of what to do now in a step, where its method says one (stage M5), or null. */
export function stepHint(language: MethodLanguage, methodId: MethodId, key: string): string | null {
  return METHOD_TEXTS[language].methods[methodId].steps[key]?.hint ?? null;
}

/** The name of a step in a language: the method's own word for it. */
export function stepName(language: MethodLanguage, methodId: MethodId, key: string): string {
  return METHOD_TEXTS[language].methods[methodId].steps[key]?.name ?? key;
}
