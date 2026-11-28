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
//
// Stage M6: „Kriterienbewertung“, „Nutzen und Aufwand“ (the catalogue's quick variant of it, as a method of its own),
// „Gegenposition prüfen“, „Entscheidungsprotokoll mit Zustimmungsrunde“, „Annahmen prüfen“ and „Ziele mit messbaren
// Ergebnissen“, from the catalogue, with these changes. Where the catalogue's result names a spread of the scores, ours
// names the means alone: the app shows no spread. The decision record's short description and its „wann nutzen“ say
// that the moderation sets the frame and decides (in v1 it always does: PLAN-METHODEN.md 7), where the catalogue says
// „Ihr klärt, wer entscheidet“. „Annahmen prüfen“ is a canvas of our own: its five fields, their names and their
// layout are ours, and it names no other canvas. „Ziele mit messbaren Ergebnissen“ has no „auch bekannt als“: the name
// it is widely known by is marked „Register offen“ in the catalogue, and the method is never called by it. A score's
// criteria that are the step's own (`criteria`), the roles of a step's teams (`roles`, with what each team does) and
// the fields a wall begins with (`fields`) stand with their method.

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
  /** The words of the criteria a score of the method names itself (stage M6), by their key. */
  criteria?: Readonly<Record<string, string>>;
  /** The roles of the teams of a step (stage M6, `TeamSettings.roles`): the name, and what the team does. */
  roles?: Readonly<Record<string, { name: string; hint: string }>>;
  /** The titles of the fields a wall of the method begins with (stage M6, `Method.fields`). */
  fields?: Readonly<Record<string, string>>;
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
          rank: { name: "Die wichtigsten ranken" },
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
      kriterien: {
        name: "Kriterienbewertung",
        short:
          "Ihr legt erst Kriterien fest, bewertet dann jede Option je Kriterium verdeckt; heraus kommt eine begründete Rangfolge.",
        when: "Wenn mehrere Optionen auf dem Tisch liegen und die Wahl nachvollziehbar sein soll.",
        result:
          "Die Kriterien, eine Tabelle mit dem Mittelwert je Option und Kriterium und dem Gesamtwert, die Rangfolge und das Gesamturteil mit Begründung.",
        aka: "Entscheidungsmatrix, Nutzwertanalyse",
        steps: {
          criteria: {
            name: "Kriterien vorschlagen",
            hint: "Schreibt jede und jeder für sich Kriterien auf, an denen ihr die Optionen messen wollt, eines je Zettel; über die Optionen sprecht ihr noch nicht.",
          },
          agree: {
            name: "Kriterien festlegen",
            hint: "Einigt euch auf höchstens fünf Kriterien und formuliert sie so, dass mehr besser ist, etwa „Geringe Kosten“; löscht oder fasst den Rest zusammen. Bewertet werden die ersten fünf Zettel.",
          },
          options: {
            name: "Optionen vorstellen",
            hint: "Wer eine Option einbringt, schreibt sie auf einen Zettel und stellt sie kurz vor; alle sehen sie sofort.",
          },
          score: {
            name: "Jede Option je Kriterium bewerten",
            hint: "Gebt jeder Option für jedes Kriterium 1 bis 5, 5 ist am besten; niemand sieht eure Bewertung, alle sehen nur die Mittelwerte, wenn ausgezählt ist.",
          },
          discuss: {
            name: "Unterschiede besprechen",
            hint: "Sprecht darüber, wo ihr weit auseinanderliegt und warum; einzelne Bewertungen zeigt die App nicht, wer mag, sagt seine.",
          },
          decide: {
            name: "Gesamturteil festhalten",
            hint: "Schreibt das Gesamturteil auf; weicht es von der Rangfolge ab, braucht es eine Begründung. Die Moderation hält es fest und spricht zuletzt.",
          },
        },
      },
      "nutzen-aufwand": {
        name: "Nutzen und Aufwand",
        short:
          "Ihr sammelt Optionen und bewertet jede verdeckt nach Nutzen und Aufwand; heraus kommt eine Rangfolge mit beiden Werten.",
        when: "Wenn es schnell gehen soll und Nutzen und Aufwand die Wahl entscheiden, etwa bei den nächsten Aufgaben eines Teams.",
        result:
          "Eine Tabelle mit dem Mittelwert für Nutzen und für geringen Aufwand je Option, die Rangfolge und das Gesamturteil mit Begründung.",
        aka: "Schnellvariante der Kriterienbewertung",
        steps: {
          options: {
            name: "Optionen vorstellen",
            hint: "Wer eine Option einbringt, schreibt sie auf einen Zettel und stellt sie kurz vor; alle sehen sie sofort.",
          },
          score: {
            name: "Nutzen und Aufwand bewerten",
            hint: "Gebt jeder Option 1 bis 5 für den Nutzen und 1 bis 5 dafür, wie gering der Aufwand ist; 5 ist jeweils am besten.",
          },
          discuss: {
            name: "Ergebnis besprechen",
            hint: "Sprecht über das Ergebnis und darüber, wo ihr weit auseinanderliegt; einzelne Bewertungen zeigt die App nicht.",
          },
          decide: {
            name: "Gesamturteil festhalten",
            hint: "Schreibt das Gesamturteil auf; weicht es von der Rangfolge ab, braucht es eine Begründung. Die Moderation hält es fest und spricht zuletzt.",
          },
        },
        criteria: { value: "Nutzen", ease: "Geringer Aufwand" },
      },
      gegenposition: {
        name: "Gegenposition prüfen",
        short:
          "Eine Gruppe sucht gezielt die Schwächen eines Vorschlags; heraus kommen geprüfte Annahmen und ein verbesserter Vorschlag.",
        when: "Vor einer wichtigen Entscheidung, wenn alle schon zustimmen und niemand widersprechen mag.",
        result: "Der Vorschlag, seine Annahmen, die Einwände der Gegenposition, was davon hält und was sich ändert.",
        aka: "Advocatus Diaboli, dialektische Prüfung",
        steps: {
          proposal: {
            name: "Vorschlag vorstellen",
            hint: "Wer den Vorschlag macht, stellt ihn vor; geschrieben wird im nächsten Schritt.",
          },
          doubts: {
            name: "Eigene Bedenken notieren",
            hint: "Schreibt jede und jeder für sich eure Bedenken auf, bevor die Rollen verteilt werden; im nächsten Schritt sieht sie eure Kleingruppe.",
          },
          roles: {
            name: "Rollen: Schwächen suchen, Annahmen aufschreiben",
            hint: "Arbeitet in eurer Kleingruppe nach eurer Rolle; sie steht oben bei eurem Team.",
          },
          present: {
            name: "Gegenposition vorstellen",
            hint: "Die Gruppe der Gegenposition stellt Schwächen und Gegenannahmen vor, die andere die Annahmen; alle Zettel und Bedenken stehen jetzt für alle da.",
          },
          decide: {
            name: "Zusammenführen: Was hält, was ändern wir?",
            hint: "Schreibt auf, was vom Vorschlag hält und was sich ändert; die Moderation hält jede Entscheidung mit Begründung fest und spricht zuletzt.",
          },
        },
        roles: {
          against: {
            name: "Gegenposition",
            hint: "Sucht die Schwächen des Vorschlags und Annahmen, die dagegen sprechen.",
          },
          assumptions: { name: "Annahmen", hint: "Schreibt die Annahmen auf, auf denen der Vorschlag beruht." },
        },
      },
      entscheidung: {
        name: "Entscheidungsprotokoll mit Zustimmungsrunde",
        short:
          "Die Moderation nennt den Rahmen, ihr prüft einen Vorschlag auf Einwände, und sie hält die Entscheidung mit Prüftermin fest.",
        when: "Wenn eine Entscheidung ansteht und ihr prüfen wollt, ob alle sie mittragen können, bevor die Moderation sie trifft.",
        result:
          "Der Vorschlag, die Antworten der Zustimmungsrunde mit den Einwänden, die Entscheidung mit Begründung, offenen Einwänden und Prüftermin; entschieden hat die Moderation.",
        steps: {
          frame: {
            name: "Rahmen: Was wird entschieden, bis wann?",
            hint: "Die Moderation sagt, was entschieden wird, bis wann und wer beiträgt; entscheiden wird sie selbst, nach der Zustimmungsrunde.",
          },
          proposal: {
            name: "Vorschlag vorstellen",
            hint: "Wer den Vorschlag macht, schreibt ihn auf einen oder wenige Zettel und stellt ihn vor; die Zustimmungsrunde fragt nach genau diesen Zetteln.",
          },
          questions: {
            name: "Verständnisfragen",
            hint: "Fragt nach, was der Vorschlag meint; Bedenken und Einwände kommen in den nächsten Schritten.",
          },
          reactions: {
            name: "Reaktionen aufschreiben",
            hint: "Schreibt jede und jeder für sich auf, wie ihr den Vorschlag seht; die Zettel bleiben verdeckt bis nach der Zustimmungsrunde.",
          },
          consent: {
            name: "Zustimmungsrunde: Sicher genug, um es auszuprobieren?",
            hint: "Antwortet verdeckt: Zustimmung, Kann damit leben oder Einwand mit Begründung; alle sehen nur das Ergebnis, wenn ausgezählt ist.",
          },
          objections: {
            name: "Einwände einarbeiten",
            hint: "Die Einwände und eure Reaktionen stehen jetzt für alle da; ändert den Vorschlag, bis die Einwände ausgeräumt sind oder klar ist, welche offen bleiben.",
          },
          record: {
            name: "Entscheidung festhalten, Prüftermin setzen",
            hint: "Schreibt die Entscheidung auf, wie sie gilt; die Moderation hält sie mit Begründung, offenen Einwänden und Prüftermin fest und spricht zuletzt.",
          },
        },
      },
      annahmen: {
        name: "Annahmen prüfen",
        short:
          "Ihr sammelt die Annahmen hinter einem Vorhaben, findet die riskantesten und plant für sie je einen Test.",
        when: "Bevor ihr Zeit oder Geld in ein neues Produkt, Angebot oder Vorhaben steckt.",
        result:
          "Die Annahmen in fünf Feldern, ihre Bewertung nach Schaden und Unwissen mit den riskantesten zuerst, und die Tests mit Wer und Bis wann.",
        steps: {
          collect: {
            name: "Annahmen je Feld sammeln",
            hint: "Das Vorhaben ist die Frage der Wand. Schreibt jede Annahme auf einen eigenen Zettel und legt ihn in das passende Feld; die anderen sehen ihn noch nicht.",
          },
          reveal: {
            name: "Aufdecken und bündeln",
            hint: "Lest alle Annahmen; fasst Doppeltes zusammen und verschiebt eine Annahme in ein anderes Feld, wo sie besser passt.",
          },
          rate: {
            name: "Jede Annahme bewerten",
            hint: "Gebt jeder Annahme 1 bis 5: wie schlimm es wäre, wenn sie falsch ist, und wie wenig ihr darüber wisst; 5 heißt jeweils riskant.",
          },
          discuss: {
            name: "Die riskantesten besprechen",
            hint: "Oben in der Tabelle stehen die riskantesten Annahmen; besprecht, welche ihr zuerst prüfen wollt.",
          },
          tests: {
            name: "Je Annahme einen Test entwerfen",
            hint: "Wählt in eurer Kleingruppe eine der riskantesten Annahmen und schreibt einen Test: was ihr prüft, wie und woran ihr erkennt, dass die Annahme falsch ist.",
          },
          present: {
            name: "Tests vorstellen und festlegen",
            hint: "Jede Kleingruppe stellt ihren Test vor; die Moderation legt jeden mit Wer und Bis wann fest.",
          },
        },
        criteria: { harm: "Schaden, wenn falsch", unknown: "Wie wenig wir wissen" },
        fields: {
          customers: "Kundschaft",
          problem: "Problem",
          solution: "Lösung",
          money: "Geld",
          delivery: "Umsetzung",
        },
      },
      ziele: {
        name: "Ziele mit messbaren Ergebnissen",
        short:
          "Ihr entwerft Ziele verdeckt, wählt bis zu drei und legt für jedes messbare Ergebnisse und Verantwortliche fest.",
        when: "Am Anfang eines Quartals oder Projekts, wenn das Team gemeinsame Ziele braucht.",
        result: "Bis zu drei Ziele, je Ziel messbare Ergebnisse mit Zielwert, Verantwortlichen und Prüftermin.",
        steps: {
          period: {
            name: "Zeitraum und Richtung vorstellen",
            hint: "Die Moderation sagt, für welchen Zeitraum die Ziele gelten und wohin es gehen soll; geschrieben wird im nächsten Schritt.",
          },
          goals: {
            name: "Ziele entwerfen",
            hint: "Schreibt jede und jeder für sich Ziele auf, eines je Zettel: was ihr erreichen wollt, noch ohne Zahlen.",
          },
          cluster: {
            name: "Aufdecken und bündeln",
            hint: "Bündelt gleiche Ziele und gebt jedem Bündel einen Namen; gewählt wird über die Bündel und die einzelnen Zettel.",
          },
          pick: {
            name: "Bis zu drei Ziele wählen",
            hint: "Wählt verdeckt bis zu drei Ziele; alle sehen nur das Ergebnis, wenn ausgezählt ist.",
          },
          results: {
            name: "Je Ziel messbare Ergebnisse formulieren",
            hint: "Nehmt euch in eurer Kleingruppe eines der gewählten Ziele vor und schreibt zwei bis vier messbare Ergebnisse dazu, jedes mit Ausgangs- und Zielwert, etwa „Antwortzeit von 3 auf 1 Tag“.",
          },
          present: {
            name: "Vorstellen",
            hint: "Jede Kleingruppe stellt ihre Ergebnisse vor; fehlende könnt ihr noch ergänzen.",
          },
          agree: {
            name: "Festlegen, mit Verantwortlichen und Prüftermin",
            hint: "Die Moderation legt jedes Ergebnis fest: zu welchem Ziel es gehört, den Zielwert, wer es verantwortet und wann ihr es prüft.",
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
          rank: { name: "Rank the most important" },
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
      kriterien: {
        name: "Rating by criteria",
        short:
          "You agree on criteria first, then rate each option on each criterion in private; you get a ranking with reasons.",
        when: "When several options are on the table and the choice should be traceable.",
        result:
          "The criteria, a table with the mean per option and criterion and the overall value, the ranking and the overall judgement with its reasons.",
        aka: "Decision matrix, weighted scoring",
        steps: {
          criteria: {
            name: "Propose criteria",
            hint: "Each of you writes down criteria to measure the options by, one per note; do not talk about the options yet.",
          },
          agree: {
            name: "Agree on criteria",
            hint: "Agree on at most five criteria and phrase them so that more is better, such as “Low cost”; delete or merge the rest. The first five notes are rated.",
          },
          options: {
            name: "Present the options",
            hint: "Whoever brings an option writes it on a note and presents it briefly; everyone sees it at once.",
          },
          score: {
            name: "Rate each option on each criterion",
            hint: "Give each option 1 to 5 on every criterion, 5 is best; nobody sees your scores, everyone sees only the means once counted.",
          },
          discuss: {
            name: "Discuss the differences",
            hint: "Talk about where you lie far apart, and why; the app shows no single score, but anyone may say their own.",
          },
          decide: {
            name: "Record the overall judgement",
            hint: "Write down the overall judgement; if it departs from the ranking, it needs a reason. The moderation records it and speaks last.",
          },
        },
      },
      "nutzen-aufwand": {
        name: "Value and effort",
        short: "You collect options and rate each in private on value and effort; you get a ranking with both values.",
        when: "When it has to be quick and value and effort decide the choice, such as a team's next tasks.",
        result:
          "A table with the mean for value and for low effort per option, the ranking and the overall judgement with its reasons.",
        aka: "Quick version of rating by criteria",
        steps: {
          options: {
            name: "Present the options",
            hint: "Whoever brings an option writes it on a note and presents it briefly; everyone sees it at once.",
          },
          score: {
            name: "Rate value and effort",
            hint: "Give each option 1 to 5 for its value and 1 to 5 for how low its effort is; 5 is best on both.",
          },
          discuss: {
            name: "Discuss the result",
            hint: "Talk about the result and where you lie far apart; the app shows no single score.",
          },
          decide: {
            name: "Record the overall judgement",
            hint: "Write down the overall judgement; if it departs from the ranking, it needs a reason. The moderation records it and speaks last.",
          },
        },
        criteria: { value: "Value", ease: "Low effort" },
      },
      gegenposition: {
        name: "Test the counter-position",
        short:
          "One group deliberately looks for a proposal's weaknesses; you get tested assumptions and a better proposal.",
        when: "Before an important decision, when everyone already agrees and nobody wants to object.",
        result: "The proposal, its assumptions, the counter-position's objections, what holds and what changes.",
        aka: "Devil's advocate, dialectical inquiry",
        steps: {
          proposal: {
            name: "Present the proposal",
            hint: "Whoever makes the proposal presents it; writing comes in the next step.",
          },
          doubts: {
            name: "Note your own doubts",
            hint: "Each of you writes down your doubts before the roles are given out; in the next step your small group sees them.",
          },
          roles: {
            name: "Roles: find weaknesses, write down assumptions",
            hint: "Work in your small group by your role; it stands at the top with your team.",
          },
          present: {
            name: "Present the counter-position",
            hint: "The counter-position group presents weaknesses and counter-assumptions, the other group the assumptions; every note and doubt is there for everyone now.",
          },
          decide: {
            name: "Bring together: what holds, what do we change?",
            hint: "Write down what of the proposal holds and what changes; the moderation records each decision with its reasons and speaks last.",
          },
        },
        roles: {
          against: {
            name: "Counter-position",
            hint: "Look for the proposal's weaknesses and for assumptions that speak against it.",
          },
          assumptions: { name: "Assumptions", hint: "Write down the assumptions the proposal rests on." },
        },
      },
      entscheidung: {
        name: "Decision record with consent round",
        short:
          "The moderation sets the frame, you check a proposal for objections, and it records the decision with a review date.",
        when: "When a decision is due and you want to check whether everyone can live with it before the moderation makes it.",
        result:
          "The proposal, the answers of the consent round with the objections, the decision with its reasons, open objections and review date; the moderation decided.",
        steps: {
          frame: {
            name: "Frame: what is decided, by when?",
            hint: "The moderation says what is decided, by when and who contributes; it decides itself, after the consent round.",
          },
          proposal: {
            name: "Present the proposal",
            hint: "Whoever makes the proposal writes it on one or a few notes and presents it; the consent round asks about exactly these notes.",
          },
          questions: {
            name: "Questions for understanding",
            hint: "Ask what the proposal means; doubts and objections come in the next steps.",
          },
          reactions: {
            name: "Write down reactions",
            hint: "Each of you writes down how you see the proposal; the notes stay hidden until after the consent round.",
          },
          consent: {
            name: "Consent round: safe enough to try?",
            hint: "Answer in private: agree, can live with it, or object with a reason; everyone sees only the result once counted.",
          },
          objections: {
            name: "Work in the objections",
            hint: "The objections and your reactions are there for everyone now; change the proposal until the objections are resolved or it is clear which stay open.",
          },
          record: {
            name: "Record the decision, set a review date",
            hint: "Write down the decision as it stands; the moderation records it with its reasons, open objections and review date, and speaks last.",
          },
        },
      },
      annahmen: {
        name: "Test your assumptions",
        short: "You collect the assumptions behind a venture, find the riskiest ones and plan a test for each.",
        when: "Before you put time or money into a new product, offer or venture.",
        result:
          "The assumptions in five fields, their rating by harm and by how little is known with the riskiest first, and the tests with who and by when.",
        steps: {
          collect: {
            name: "Collect assumptions per field",
            hint: "The venture is the wall's question. Write each assumption on a note of its own and put it in the field it belongs to; the others do not see it yet.",
          },
          reveal: {
            name: "Reveal and group",
            hint: "Read all assumptions; merge what is double and move an assumption to another field where it fits better.",
          },
          rate: {
            name: "Rate each assumption",
            hint: "Give each assumption 1 to 5: how bad it would be if it is wrong, and how little you know about it; 5 means risky on both.",
          },
          discuss: {
            name: "Discuss the riskiest",
            hint: "The riskiest assumptions stand at the top of the table; discuss which ones you want to test first.",
          },
          tests: {
            name: "Design a test for each assumption",
            hint: "In your small group, pick one of the riskiest assumptions and write a test: what you check, how, and how you will know the assumption is wrong.",
          },
          present: {
            name: "Present and agree on the tests",
            hint: "Each small group presents its test; the moderation agrees on each with who and by when.",
          },
        },
        criteria: { harm: "Harm if wrong", unknown: "How little we know" },
        fields: {
          customers: "Customers",
          problem: "Problem",
          solution: "Solution",
          money: "Money",
          delivery: "Delivery",
        },
      },
      ziele: {
        name: "Goals with measurable results",
        short: "You draft goals in private, pick up to three and set measurable results and owners for each.",
        when: "At the start of a quarter or project, when the team needs shared goals.",
        result: "Up to three goals, each with measurable results with a target, an owner and a review date.",
        steps: {
          period: {
            name: "Present the period and direction",
            hint: "The moderation says which period the goals are for and where to head; writing comes in the next step.",
          },
          goals: {
            name: "Draft goals",
            hint: "Each of you writes down goals, one per note: what you want to achieve, no numbers yet.",
          },
          cluster: {
            name: "Reveal and group",
            hint: "Bundle goals that are the same and name each bundle; the vote is over the bundles and the single notes.",
          },
          pick: {
            name: "Pick up to three goals",
            hint: "Choose up to three goals in private; everyone sees only the result once counted.",
          },
          results: {
            name: "Write measurable results per goal",
            hint: "In your small group, take one of the chosen goals and write two to four measurable results for it, each with a start and a target value, such as “reply time from 3 days to 1”.",
          },
          present: {
            name: "Present",
            hint: "Each small group presents its results; you can still add missing ones.",
          },
          agree: {
            name: "Agree, with owners and review date",
            hint: "The moderation agrees on each result: which goal it belongs to, its target, who owns it and when you check it.",
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

/** The words of a criterion of a score that names its own (stage M6), or the key where the method says none. */
export function criterionName(language: MethodLanguage, methodId: MethodId, key: string): string {
  return METHOD_TEXTS[language].methods[methodId].criteria?.[key] ?? key;
}

/** The name of a team's role and what the team does (stage M6), or null. */
export function roleTexts(
  language: MethodLanguage,
  methodId: MethodId,
  key: string,
): { name: string; hint: string } | null {
  return METHOD_TEXTS[language].methods[methodId].roles?.[key] ?? null;
}

/** The title of a fixed field (stage M6), or the key where the method says none. */
export function fieldName(language: MethodLanguage, methodId: MethodId, key: string): string {
  return METHOD_TEXTS[language].methods[methodId].fields?.[key] ?? key;
}

/** The name of a step in a language: the method's own word for it. */
export function stepName(language: MethodLanguage, methodId: MethodId, key: string): string {
  return METHOD_TEXTS[language].methods[methodId].steps[key]?.name ?? key;
}
