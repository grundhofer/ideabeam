# Methodenkatalog: Texte für die geführten Methoden

Entwurf vom 2026-11-27, Grundlage ist [`recherche-methoden.md`](recherche-methoden.md). Noch nichts davon ist gebaut.
Dieses Dokument liefert die Texte in Deutsch und Englisch: für die Auswahl unter `/neu`, für den Abschnitt auf der
Startseite und für das Feld „Mehr dazu“ jeder Methode.

## Regeln für diese Texte

- **Neutrale Namen, immer mit Beschreibung.** Die Methoden heißen deutsch und beschreibend, nicht nach Marken oder
  englischem Fachjargon. Deshalb steht überall, wo eine Methode gewählt wird (Auswahl unter `/neu`, Startseite),
  neben dem Namen ihre Kurzbeschreibung. Ein Name allein erscheint nirgends.
- **„Auch bekannt als“** nennt einen verbreiteten Namen nur beschreibend, nie als Name einer Vorlage. Riskante Namen
  fehlen ganz (die Methode mit den Denkhüten, RAPID, Value Proposition Canvas, Cynefin, Lean Canvas). Für die mit
  „(Register offen)“ markierten Namen hat niemand in DPMA, EUIPO/TMview oder USPTO gesucht (Recherche, Abschnitt
  Lizenzen): Vor dem Start je Name eine TMview-Suche, sonst die Zeile weglassen.
- **„Belegt“ nennt nur Befunde, die die Recherche mit [V] markiert.** Nichts aus [M]-Quellen, und keine der fünf
  gesperrten Zahlen (Pre-Mortem „+30 %“, Sears/OKR, McKinsey/Design Sprint, Bain „95 %“, Menon/SWOT). Zahlen stehen
  nur dort, wo sie [V] sind, und auch dann sparsam.
- **Evidenzstufen**, so in der App erklärt:

  | Stufe | DE: Bedeutung | EN: label and meaning |
  |---|---|---|
  | Meta-Analyse | Mindestens eine Meta-Analyse stützt den Kern des Ablaufs. | Meta-analysis: at least one meta-analysis supports the core of the method. |
  | Experimente | Kontrollierte Experimente stützen den Kern des Ablaufs. | Experiments: controlled experiments support the core of the method. |
  | Studien | Nur indirekte Belege: Studien aus einem Nachbarfeld oder ohne Vergleichsgruppe. | Studies: indirect evidence only, from a neighbouring field or without a control group. |
  | Praktikerkonsens | Keine Studien mit Vergleich, höchstens Fallberichte; in der Praxis erprobt. | Practitioner consensus: no comparative studies, at most case reports; proven in practice. |
  | umstritten | Die Studien sind gemischt oder ausdrücklich kritisch. | Contested: studies are mixed or explicitly critical. |

  Die Stufe sagt, wie gut der Kern eines Ablaufs belegt ist. Ist die Methode selbst nicht getestet, sagt das der
  Satz unter „Belegt“.
- **Vokabular des Ablaufs.** Modus: allein, zu zweit, Kleingruppe, alle, vorstellen (eine Person oder Gruppe stellt
  vor, die anderen sehen zu). Sichtbarkeit: verdeckt (nur die Person selbst), Gruppe (nur die eigene Zweier- oder
  Kleingruppe), alle, nur Summe (sichtbar ist erst das Ergebnis der Auszählung), ohne Namen (Inhalt für alle, Urheber
  verborgen). EN: alone, in pairs, small group, everyone, presenting; hidden, group, everyone, total only, unnamed.
- **Minuten sind Voreinstellungen.** Die Gesamtdauer ist die Summe der Phasen, gerundet. Die Obergrenze einer Wand
  ist 30 Personen zugleich (`MAX_ONLINE`); größere Gruppen nennt kein Text.
- **Liberating Structures.** 1-2-4-Alle, „Was? Na und? Was nun?“, „Aufhören, was schadet“ und 15-%-Lösungen stammen
  aus Liberating Structures, seit Juni 2026 unter CC BY-SA 4.0 (Recherche, Abschnitt Lizenzen). Die Texte hier sind
  eigene, aber Bearbeitungen stehen unter derselben Lizenz: Diese vier Methodentexte werden unter CC BY-SA 4.0
  veröffentlicht, mit Namensnennung im „Mehr dazu“ und auf der Seite „Über“. Der genaue Wortlaut der Nennung ist vor
  dem Start auf liberatingstructures.com/cc-license abzugleichen (die Recherche nennt „Lipmanowicz & McCandless;
  McCandless & White“). Keine Texte aus alten PDFs mit NC-Lizenz, keine Original-Icons.

---

## Die zwölf Methoden für v1

### 1. Rückblick nach Ziel und Daten

| Feld | Deutsch | English |
|---|---|---|
| Name | Rückblick nach Ziel und Daten | Review against goal and data |
| Auch bekannt als | Retrospektive, After-Action-Review | Retrospective, after-action review |
| Kurzbeschreibung | Ihr vergleicht Ziel und tatsächlichen Verlauf, sucht Gründe für Abweichungen und legt bis zu drei Aktionen fest. | You compare the goal with what actually happened, look for reasons and agree on up to three actions. |
| Wann nutzen | Nach einem Projekt, Sprint oder Vorfall, wenn das Team daraus lernen will. | After a project, sprint or incident, when the team wants to learn from it. |
| Ergebnis | Ziel, Daten und Zeitleiste, Gründe in Gruppen, gewählte Aktionen mit verantwortlicher Person und Termin, Stimmen je Aktion. | Goal, data and timeline, grouped reasons, chosen actions with owner and date, votes per action. |
| Belegt | **Meta-Analyse.** Zwei Meta-Analysen zeigen, dass strukturierte Rückblicke die Leistung verbessern, stärker, wenn sie an Zielen und Daten statt an Erinnerung ausgerichtet sind. | **Meta-analysis.** Two meta-analyses show that structured reviews improve performance, more so when they work from goals and data rather than memory. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 45 Minuten, 3–12 Personen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Einstimmen: Worum geht es, welcher Zeitraum? | Set the stage: what and which period? | alle | alle | 3 |
| 2 | Was sollte passieren? Das Ziel aufschreiben | What was supposed to happen? Write down the goal | allein | verdeckt | 4 |
| 3 | Was ist passiert? Fakten, Zahlen, Zeitleiste | What happened? Facts, numbers, timeline | allein | verdeckt | 6 |
| 4 | Aufdecken | Reveal | alle | alle | 2 |
| 5 | Warum die Abweichung? Gründe bündeln | Why the gap? Group the reasons | Kleingruppe | Gruppe | 10 |
| 6 | Bündel vorstellen | Present the groups | vorstellen | alle | 5 |
| 7 | Aktionen vorschlagen | Propose actions | allein | verdeckt | 4 |
| 8 | Aktionen wählen | Vote on actions | allein | nur Summe | 3 |
| 9 | Bis zu drei Aktionen festlegen, mit Verantwortlichen | Agree on up to three actions, with owners | alle | alle | 5 |
| 10 | Abschluss | Close | alle | alle | 2 |

### 2. Still sammeln, bündeln, verdeckt wählen

| Feld | Deutsch | English |
|---|---|---|
| Name | Still sammeln, bündeln, verdeckt wählen | Write alone, group, vote in secret |
| Auch bekannt als | Brainwriting mit Punktabfrage | Brainwriting with dot voting |
| Kurzbeschreibung | Alle schreiben Ideen verdeckt, die Ideen werden gebündelt, dann wählt jede Person verdeckt; heraus kommt eine Rangfolge. | Everyone writes ideas in private, the ideas are grouped, then everyone votes in secret; you get a ranking. |
| Wann nutzen | Wenn ihr zu einer offenen Frage viele Ideen braucht und am Ende wissen wollt, welche der Gruppe am wichtigsten sind. | When you need many ideas on an open question and want to know which ones matter most to the group. |
| Ergebnis | Alle Zettel in Gruppen mit Überschriften, Stimmen je Zettel und Gruppe, Rangfolge. | All notes in titled groups, votes per note and group, ranking. |
| Belegt | **Meta-Analyse.** Laut einer Meta-Analyse liefern Gruppen, die mündlich brainstormen, weniger Ideen als dieselben Leute allein; deshalb schreibt hier jede Person für sich. Die Punktwahl selbst ist nicht untersucht; sie läuft verdeckt, weil sichtbare Zwischenstände in einem großen Experiment spätere Bewertungen verzerrten. | **Meta-analysis.** A meta-analysis found that groups brainstorming out loud produce fewer ideas than the same people working alone, so here everyone writes on their own. Dot voting itself has not been studied; votes stay hidden because visible interim results skewed later ratings in a large experiment. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 25 Minuten, 3–30 Personen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Frage stellen | Ask the question | vorstellen | alle | 1 |
| 2 | Ideen schreiben | Write ideas | allein | verdeckt | 7 |
| 3 | Aufdecken | Reveal | alle | alle | 1 |
| 4 | Bündeln (KI-Vorschlag oder von Hand) | Group (AI proposal or by hand) | alle | alle | 6 |
| 5 | Wählen: Stimmen etwa ein Viertel der Gruppen, mindestens 2 | Vote: about a quarter of the groups, at least 2 | allein | nur Summe | 3 |
| 6 | Ergebnis besprechen | Discuss the result | alle | alle | 5 |

### 3. 1-2-4-Alle

| Feld | Deutsch | English |
|---|---|---|
| Name | 1-2-4-Alle (bekannter Name, frei nutzbar mit Nennung) | 1-2-4-All |
| Auch bekannt als | 1-2-4-All (Liberating Structures) | – |
| Kurzbeschreibung | Erst allein, dann zu zweit, dann zu viert denken; jede Vierergruppe bringt ihre stärkste Idee ein. | Think alone, then in pairs, then in fours; each group of four brings its strongest idea. |
| Wann nutzen | Wenn alle in kurzer Zeit zu Wort kommen sollen, auch in großen Runden. | When everyone should contribute in little time, also in large groups. |
| Ergebnis | Je Vierergruppe eine Kernidee, dazu alle Zettel aus den Phasen davor. | One core idea per group of four, plus all notes from the earlier phases. |
| Belegt | **Experimente.** Die Methode selbst ist nicht getestet. Ihr Prinzip schon: In Experimenten wurden Gruppen besser, wenn jede Person zuerst allein schrieb oder antwortete und kleine Gruppen danach darüber sprachen. | **Experiments.** The method itself has not been tested. Its principle has: in experiments, groups did better when everyone first wrote or answered alone and small groups talked it over afterwards. |
| Lizenz | Liberating Structures (Lipmanowicz & McCandless), CC BY-SA 4.0. Dieser Text steht unter derselben Lizenz. | Liberating Structures (Lipmanowicz & McCandless), CC BY-SA 4.0. This text is under the same licence. |

Ablauf, etwa 16 Minuten, 4–30 Personen (geht die Zahl nicht auf, entstehen Dreiergruppen):

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Frage stellen | Ask the question | vorstellen | alle | 1 |
| 2 | Allein nachdenken und notieren | Think and write alone | allein | verdeckt | 1 |
| 3 | Zu zweit austauschen | Share in pairs | zu zweit | Gruppe | 2 |
| 4 | Zu viert: das Wichtigste herausarbeiten | In fours: find what matters most | Kleingruppe | Gruppe | 5 |
| 5 | Jede Vierergruppe stellt eine Kernidee vor | Each group of four presents one core idea | vorstellen | alle | 7 |

### 4. Stille Ideenrunde mit Rangfolge

| Feld | Deutsch | English |
|---|---|---|
| Name | Stille Ideenrunde mit Rangfolge | Silent round with ranking |
| Auch bekannt als | Nominalgruppentechnik (NGT) (Register offen) | Nominal group technique (NGT) (register not checked) |
| Kurzbeschreibung | Alle sammeln still, legen reihum je eine Idee offen, klären sie und ranken verdeckt; heraus kommt eine Rangliste. | Everyone collects ideas silently, shares one per turn, clarifies, and ranks in private; you get a ranked list. |
| Wann nutzen | Wenn eine kleine Gruppe gemeinsam eine Reihenfolge braucht und laute Stimmen nicht den Ausschlag geben sollen. | When a small group needs a shared order and loud voices should not decide it. |
| Ergebnis | Alle Ideen im Wortlaut, die Rangliste aus den Summen, die Streuung je Idee. | All ideas word for word, the ranking from the totals, the spread per idea. |
| Belegt | **Experimente.** In einem Experiment von 1974 schnitt dieser Ablauf klar besser ab als frei diskutierende Gruppen. Neuere Vergleiche fehlen. | **Experiments.** In a 1974 experiment this procedure clearly beat freely discussing groups. More recent comparisons are missing. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 40 Minuten, 4–10 Personen (Voreinstellung des Produkts; die klassische Größe ist nicht nachgeprüft):

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Frage stellen | Ask the question | vorstellen | alle | 2 |
| 2 | Still sammeln | Collect silently | allein | verdeckt | 8 |
| 3 | Reihum aufdecken: eine Idee pro Person und Zug | Reveal in turn: one idea per person per turn | alle | alle | 10 |
| 4 | Klären, ohne zu bewerten | Clarify without judging | alle | alle | 8 |
| 5 | Die fünf wichtigsten ranken | Rank your top five | allein | nur Summe | 5 |
| 6 | Ergebnis ansehen | Look at the result | alle | alle | 5 |

### 5. Schätzen – Diskutieren – Schätzen

| Feld | Deutsch | English |
|---|---|---|
| Name | Schätzen – Diskutieren – Schätzen | Estimate – discuss – estimate |
| Auch bekannt als | Mini-Delphi (Register offen) | Mini-Delphi (register not checked) |
| Kurzbeschreibung | Alle schätzen verdeckt, besprechen in Kleingruppen die Abweichungen und schätzen neu; heraus kommt eine Gruppenschätzung mit Streuung. | Everyone estimates in private, small groups discuss the differences, then everyone estimates again; you get a group estimate with its spread. |
| Wann nutzen | Wenn ihr eine Zahl braucht, etwa Aufwand, Termin oder Wahrscheinlichkeit, und das Wissen auf viele Köpfe verteilt ist. | When you need a number, such as effort, date or likelihood, and the knowledge is spread across many people. |
| Ergebnis | Beide Runden mit Median und Spannweite, die Begründungen ohne Namen, die Veränderung zwischen den Runden. | Both rounds with median and range, the reasons without names, the change between rounds. |
| Belegt | **Experimente.** Eine systematische Übersicht fand, dass solche Runden meist genauer sind als der Mittelwert der ersten Schätzungen und als frei diskutierende Gruppen. Fast alle Tests nutzen Aufgaben mit einer richtigen Antwort. | **Experiments.** A systematic review found that such rounds are usually more accurate than the average of first estimates and than freely discussing groups. Almost all tests used tasks with a correct answer. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 25 Minuten, 5–30 Personen in Kleingruppen zu etwa fünf:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Schätzfrage stellen | Ask the estimation question | vorstellen | alle | 2 |
| 2 | Erste Schätzung mit kurzer Begründung | First estimate with a short reason | allein | verdeckt | 4 |
| 3 | Rückmeldung: Median, Spannweite, Begründungen | Feedback: median, range, reasons | alle | nur Summe, Begründungen ohne Namen | 3 |
| 4 | Abweichungen besprechen | Discuss the differences | Kleingruppe | Gruppe | 8 |
| 5 | Neu schätzen | Estimate again | allein | verdeckt | 3 |
| 6 | Ergebnis ansehen | Look at the result | alle | nur Summe | 5 |

### 6. Kriterienbewertung

| Feld | Deutsch | English |
|---|---|---|
| Name | Kriterienbewertung | Rating by criteria |
| Auch bekannt als | Entscheidungsmatrix, Nutzwertanalyse; Schnellvariante: Nutzen und Aufwand | Decision matrix, weighted scoring; quick version: value and effort |
| Kurzbeschreibung | Ihr legt erst Kriterien fest, bewertet dann jede Option je Kriterium verdeckt; heraus kommt eine begründete Rangfolge. | You agree on criteria first, then rate each option on each criterion in private; you get a ranking with reasons. |
| Wann nutzen | Wenn mehrere Optionen auf dem Tisch liegen und die Wahl nachvollziehbar sein soll. | When several options are on the table and the choice should be traceable. |
| Ergebnis | Kriterien, Matrix mit Mittelwert und Streuung je Option und Kriterium, Rangfolge, schriftliche Begründung jeder Abweichung vom Ergebnis. | Criteria, matrix with mean and spread per option and criterion, ranking, written reason for any departure from the result. |
| Belegt | **Studien.** Die Methode selbst ist nicht getestet. In einem Nachbarfeld, der Personalauswahl, sagen strukturierte Interviews mit festen Kriterien den späteren Erfolg im Mittel am besten voraus. | **Studies.** The method itself has not been tested. In a neighbouring field, hiring, structured interviews with fixed criteria predict later performance best on average. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 40 Minuten, 3–12 Personen (Schnellvariante mit nur „Nutzen“ und „Aufwand“: etwa 20 Minuten, Phasen 1 und 2
entfallen):

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Kriterien vorschlagen, bevor Optionen besprochen werden | Propose criteria before discussing options | allein | verdeckt | 3 |
| 2 | Kriterien festlegen | Agree on criteria | alle | alle | 5 |
| 3 | Optionen vorstellen | Present the options | vorstellen | alle | 5 |
| 4 | Jede Option je Kriterium getrennt bewerten (1–5) | Rate each option on each criterion separately (1–5) | allein | verdeckt | 10 |
| 5 | Summe zeigen, gleiche Gewichte | Show the total, equal weights | alle | nur Summe | 2 |
| 6 | Ausreißer und große Streuung besprechen | Discuss outliers and wide spread | alle | alle | 10 |
| 7 | Gesamturteil zuletzt; Abweichung nur mit Begründung | Overall judgement last; departures need a reason | alle | alle | 5 |

### 7. Gegenposition prüfen

| Feld | Deutsch | English |
|---|---|---|
| Name | Gegenposition prüfen | Test the counter-position |
| Auch bekannt als | Advocatus Diaboli, dialektische Prüfung | Devil's advocate, dialectical inquiry |
| Kurzbeschreibung | Eine Gruppe sucht gezielt die Schwächen eines Vorschlags; heraus kommen geprüfte Annahmen und ein verbesserter Vorschlag. | One group deliberately looks for a proposal's weaknesses; you get tested assumptions and a better proposal. |
| Wann nutzen | Vor einer wichtigen Entscheidung, wenn alle schon zustimmen und niemand widersprechen mag. | Before an important decision, when everyone already agrees and nobody wants to object. |
| Ergebnis | Der Vorschlag, seine Annahmen, die Einwände der Gegenposition, was davon hält und was sich ändert. | The proposal, its assumptions, the counter-position's objections, what holds and what changes. |
| Belegt | **Meta-Analyse.** Eine Meta-Analyse fand, dass eine eingebaute Gegenposition zu besseren Empfehlungen führt als eine einfache Expertenempfehlung. Der Ablauf hier ist daraus abgeleitet, nicht selbst getestet. | **Meta-analysis.** A meta-analysis found that a built-in counter-position leads to better recommendations than a plain expert recommendation. The steps here are derived from that, not tested themselves. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 35 Minuten, 4–12 Personen in zwei Untergruppen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Vorschlag vorstellen | Present the proposal | vorstellen | alle | 5 |
| 2 | Eigene Bedenken notieren, bevor die Rollen verteilt werden | Note your own doubts before roles are assigned | allein | verdeckt | 3 |
| 3 | Gruppe A: Schwächen und Gegenannahmen suchen; Gruppe B: Annahmen des Vorschlags aufschreiben | Group A: find weaknesses and counter-assumptions; group B: write down the proposal's assumptions | Kleingruppe | Gruppe | 10 |
| 4 | Gegenposition vorstellen, dazu die notierten Bedenken | Present the counter-position and the noted doubts | vorstellen | alle | 7 |
| 5 | Zusammenführen: Was hält, was ändern wir? | Bring together: what holds, what do we change? | alle | alle | 10 |

### 8. Scheitern vorwegdenken

| Feld | Deutsch | English |
|---|---|---|
| Name | Scheitern vorwegdenken | Imagine the failure |
| Auch bekannt als | Pre-Mortem (Register offen) | Pre-mortem (register not checked) |
| Kurzbeschreibung | Ihr stellt euch vor, der Plan ist gescheitert, und schreibt verdeckt auf, warum; heraus kommen Risiken und Planänderungen. | You imagine the plan has failed and write down in private why; you get risks and changes to the plan. |
| Wann nutzen | Bevor ein Plan startet, solange er sich noch leicht ändern lässt. | Before a plan starts, while it is still easy to change. |
| Ergebnis | Die Gründe ohne Namen, gebündelt zu Risiken, und die beschlossenen Planänderungen. | The reasons without names, grouped into risks, and the agreed changes to the plan. |
| Belegt | **umstritten.** Direkte Tests sind wenige kleine Studien mit gemischtem Ergebnis: einmal weniger Selbstüberschätzung, einmal kein Unterschied, einmal zusätzlich ein stärkerer Hang, Misserfolg anderen zuzuschreiben. | **Contested.** Direct tests are a few small studies with mixed results: once less overconfidence, once no difference, once an added tendency to blame failure on others. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 35 Minuten, 3–12 Personen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Plan vorstellen | Present the plan | vorstellen | alle | 5 |
| 2 | Impuls: „Ein Jahr später. Der Plan ist gescheitert.“ | Prompt: “A year from now. The plan has failed.” | vorstellen | alle | 1 |
| 3 | Gründe aufschreiben | Write down the reasons | allein | verdeckt | 7 |
| 4 | Reihum aufdecken | Reveal in turn | alle | ohne Namen | 8 |
| 5 | Zu Risiken bündeln | Group into risks | alle | ohne Namen | 5 |
| 6 | Plan anpassen | Adjust the plan | alle | alle | 8 |

### 9. Entscheidungsprotokoll mit Zustimmungsrunde

| Feld | Deutsch | English |
|---|---|---|
| Name | Entscheidungsprotokoll mit Zustimmungsrunde | Decision record with consent round |
| Auch bekannt als | – (bekannte Rollenmodelle tragen Markennamen und bleiben ungenannt) | – |
| Kurzbeschreibung | Ihr klärt, wer entscheidet, prüft einen Vorschlag auf Einwände und haltet die Entscheidung mit Prüftermin fest. | You clarify who decides, check a proposal for objections and record the decision with a review date. |
| Wann nutzen | Wenn eine Entscheidung ansteht und unklar ist, wer sie trifft oder ob alle sie mittragen können. | When a decision is due and it is unclear who makes it or whether everyone can live with it. |
| Ergebnis | Frage, Frist, wer entscheidet und wer beiträgt, Vorschlag, Einwände und wie sie eingearbeitet wurden, Entscheidung, Prüftermin. | Question, deadline, who decides and who contributes, proposal, objections and how they were handled, decision, review date. |
| Belegt | **Praktikerkonsens.** Zu Zustimmungsverfahren gibt es nur Fallstudien ohne Vergleichsgruppe. Der Ablauf folgt der Praxis. | **Practitioner consensus.** Consent procedures have only been described in case studies without a control group. The steps follow practice. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 40 Minuten, 3–12 Personen. Wer entscheidet, äußert sich in den Phasen 4 und 5 zuletzt:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Rahmen: Was wird entschieden, bis wann, wer entscheidet, wer trägt bei? | Frame: what is decided, by when, who decides, who contributes? | alle | alle | 5 |
| 2 | Vorschlag vorstellen | Present the proposal | vorstellen | alle | 5 |
| 3 | Verständnisfragen | Questions for understanding | alle | alle | 5 |
| 4 | Reaktionen aufschreiben | Write down reactions | allein | verdeckt | 4 |
| 5 | Einwandrunde: „Sicher genug, um es auszuprobieren?“ | Objection round: “Safe enough to try?” | allein | verdeckt, dann alle | 5 |
| 6 | Einwände einarbeiten | Work in the objections | alle | alle | 10 |
| 7 | Zustimmung festhalten, Prüftermin setzen | Record consent, set a review date | alle | alle | 5 |

### 10. Was? Na und? Was nun?

| Feld | Deutsch | English |
|---|---|---|
| Name | Was? Na und? Was nun? | What? So what? Now what? |
| Auch bekannt als | What, So What, Now What? (Liberating Structures) | Liberating Structures' W³ |
| Kurzbeschreibung | In drei Runden sammelt ihr Fakten, deutet sie und leitet nächste Schritte ab. | In three rounds you collect facts, make sense of them and derive next steps. |
| Wann nutzen | Nach einem gemeinsamen Erlebnis, etwa einem Test, Kundentermin oder Ausfall, wenn es noch keine klaren Ziele zum Abgleich gibt. | After a shared experience, such as a test, customer meeting or outage, when there is no clear goal to compare against. |
| Ergebnis | Fakten, Deutungen und nächste Schritte, je Kleingruppe und zusammengeführt. | Facts, interpretations and next steps, per small group and combined. |
| Belegt | **Praktikerkonsens.** Eine Form des Rückblicks, aber selbst nicht getestet. Ihr fehlt der Abgleich mit einem Ziel, mit dem eine Meta-Analyse stärkere Wirkung von Rückblicken fand. | **Practitioner consensus.** A form of review, but not tested itself. It lacks the comparison with a goal that a meta-analysis linked to stronger effects of reviews. |
| Lizenz | Liberating Structures (Lipmanowicz & McCandless), CC BY-SA 4.0. Dieser Text steht unter derselben Lizenz. | Liberating Structures (Lipmanowicz & McCandless), CC BY-SA 4.0. This text is under the same licence. |

Ablauf, etwa 30 Minuten, 4–30 Personen in Kleingruppen zu 5–7. Die Phasen 2 bis 4 laufen dreimal: „Was ist passiert?“,
„Was bedeutet das?“, „Was tun wir jetzt?“ Die Moderation lässt die Runden nicht überspringen.

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Einführung: Um welches Erlebnis geht es? | Introduction: which experience? | vorstellen | alle | 2 |
| 2 | Runde: allein notieren | Round: note alone | allein | verdeckt | 1 |
| 3 | Runde: in der Kleingruppe austauschen | Round: share in the small group | Kleingruppe | Gruppe | 5 |
| 4 | Runde: Kleingruppen stellen vor | Round: small groups present | vorstellen | alle | 3 |

### 11. Annahmen prüfen

| Feld | Deutsch | English |
|---|---|---|
| Name | Annahmen prüfen | Test your assumptions |
| Auch bekannt als | – | – |
| Kurzbeschreibung | Ihr sammelt die Annahmen hinter einem Vorhaben, findet die riskantesten und plant für sie je einen Test. | You collect the assumptions behind a venture, find the riskiest ones and plan a test for each. |
| Wann nutzen | Bevor ihr Zeit oder Geld in ein neues Produkt, Angebot oder Vorhaben steckt. | Before you put time or money into a new product, offer or venture. |
| Ergebnis | Annahmen je Feld (Kundschaft, Problem, Lösung, Geld, Umsetzung), Matrix aus Risiko und Wissen, die drei riskantesten Annahmen mit Test: was, wie, woran man erkennt, dass sie falsch ist, bis wann. | Assumptions per field (customers, problem, solution, money, delivery), a risk-and-knowledge matrix, the three riskiest assumptions with a test: what, how, how you will know it is wrong, by when. |
| Belegt | **Experimente.** In randomisierten Experimenten änderten Gründerinnen und Gründer, die Annahmen als prüfbare Hypothesen behandelten, häufiger die Richtung und gaben schwache Vorhaben eher auf. Die Vorlage selbst ist nicht getestet. | **Experiments.** In randomised experiments, founders who treated assumptions as testable hypotheses changed direction more often and dropped weak ventures sooner. The template itself has not been tested. |
| Lizenz | eigene Vorlage mit eigenem Layout, keine Nennung nötig | own template and layout, no attribution needed |

Ablauf, etwa 50 Minuten, 3–12 Personen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Vorhaben in einem Satz | The venture in one sentence | vorstellen | alle | 3 |
| 2 | Annahmen je Feld sammeln | Collect assumptions per field | allein | verdeckt | 8 |
| 3 | Aufdecken und bündeln | Reveal and group | alle | alle | 7 |
| 4 | Jede Annahme bewerten: Wie schlimm, wenn falsch? Wie gut belegt? | Rate each assumption: how bad if wrong? How well supported? | allein | nur Summe | 6 |
| 5 | Die riskantesten besprechen | Discuss the riskiest | alle | alle | 8 |
| 6 | Je Annahme einen Test entwerfen | Design a test for each assumption | Kleingruppe | Gruppe | 10 |
| 7 | Tests vorstellen | Present the tests | vorstellen | alle | 5 |

### 12. Ziele mit messbaren Ergebnissen

| Feld | Deutsch | English |
|---|---|---|
| Name | Ziele mit messbaren Ergebnissen | Goals with measurable results |
| Auch bekannt als | OKR (Objectives and Key Results) (Register offen) | OKR (objectives and key results) (register not checked) |
| Kurzbeschreibung | Ihr entwerft Ziele verdeckt, wählt bis zu drei und legt für jedes messbare Ergebnisse und Verantwortliche fest. | You draft goals in private, pick up to three and set measurable results and owners for each. |
| Wann nutzen | Am Anfang eines Quartals oder Projekts, wenn das Team gemeinsame Ziele braucht. | At the start of a quarter or project, when the team needs shared goals. |
| Ergebnis | Bis zu drei Ziele, je Ziel 2–4 messbare Ergebnisse mit Ausgangs- und Zielwert, Verantwortliche, Prüftermin. | Up to three goals, each with 2–4 measurable results with start and target value, owners, review date. |
| Belegt | **Praktikerkonsens.** Zu dieser Art von Zielen gibt es nur Fallberichte, keine Vergleichsstudien. | **Practitioner consensus.** This kind of goal setting has only case reports, no comparative studies. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 45 Minuten, 3–15 Personen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Zeitraum und Richtung vorstellen | Present the period and direction | vorstellen | alle | 3 |
| 2 | Ziele entwerfen | Draft goals | allein | verdeckt | 6 |
| 3 | Aufdecken und bündeln | Reveal and group | alle | alle | 6 |
| 4 | Bis zu drei Ziele wählen | Pick up to three goals | allein | nur Summe | 3 |
| 5 | Je Ziel messbare Ergebnisse formulieren | Write measurable results per goal | Kleingruppe | Gruppe | 12 |
| 6 | Vorstellen | Present | vorstellen | alle | 8 |
| 7 | Festlegen, mit Verantwortlichen und Prüftermin | Agree, with owners and review date | alle | alle | 6 |

---

## Kandidaten für v1.1

### 13. Aufhören, was schadet

| Feld | Deutsch | English |
|---|---|---|
| Name | Aufhören, was schadet | Stop what hurts |
| Auch bekannt als | Creative Destruction (Liberating Structures) | Creative Destruction (Liberating Structures) |
| Kurzbeschreibung | Ihr sammelt, wie ihr das schlechteste Ergebnis sicher erreicht, und findet, was ihr davon heute schon tut; heraus kommt eine Stoppliste. | You list how to reliably reach the worst outcome and find what you already do today; you get a stop list. |
| Wann nutzen | Wenn ein Team festgefahren ist und Gewohnheiten loswerden will, die ihm im Weg stehen. | When a team is stuck and wants to drop habits that get in its way. |
| Ergebnis | Wege zum schlechtesten Ergebnis, was davon heute geschieht, was ihr stoppt, erste Schritte. | Ways to the worst outcome, which of them happen today, what you stop, first steps. |
| Belegt | **Praktikerkonsens.** Für diese Methode gibt es keine Studien. Sie beginnt mit Einzelarbeit, ihr Kern ist aber ein Perspektivwechsel, der nicht untersucht ist. | **Practitioner consensus.** There are no studies of this method. It starts with individual work, but its core is a change of perspective that has not been studied. |
| Lizenz | Liberating Structures (Lipmanowicz & McCandless), CC BY-SA 4.0. Dieser Text steht unter derselben Lizenz. | Liberating Structures (Lipmanowicz & McCandless), CC BY-SA 4.0. This text is under the same licence. |

Ablauf, etwa 50 Minuten, 4–30 Personen in Kleingruppen zu 4–7:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Impuls: „Wie erreichen wir sicher das schlechteste Ergebnis?“ | Prompt: “How do we make sure we get the worst outcome?” | vorstellen | alle | 5 |
| 2 | Wege dorthin notieren | Note ways to get there | allein | verdeckt | 3 |
| 3 | In der Kleingruppe sammeln | Collect in the small group | Kleingruppe | Gruppe | 10 |
| 4 | Was davon tun wir heute schon? | Which of these do we do today? | Kleingruppe | Gruppe | 10 |
| 5 | Was hören wir auf? Erster Schritt | What do we stop? First step | Kleingruppe | Gruppe | 10 |
| 6 | Kleingruppen stellen vor | Small groups present | vorstellen | alle | 12 |

### 14. 15-%-Lösungen

| Feld | Deutsch | English |
|---|---|---|
| Name | 15-%-Lösungen | 15% solutions |
| Auch bekannt als | 15% Solutions (Liberating Structures) | Liberating Structures' 15% Solutions |
| Kurzbeschreibung | Jede Person findet, was sie sofort selbst tun kann, ohne Erlaubnis oder Budget, und lässt sich dazu beraten. | Everyone finds what they can do right away on their own, without permission or budget, and gets advice on it. |
| Wann nutzen | Wenn ein Problem groß wirkt und das Team ins Handeln kommen soll. | When a problem feels big and the team needs to start acting. |
| Ergebnis | Je Person ein eigener erster Schritt, mit den Anregungen aus der Beratung. | One first step per person, with the suggestions from the advice round. |
| Belegt | **Praktikerkonsens.** Für diese Methode gibt es keine Studien. | **Practitioner consensus.** There are no studies of this method. |
| Lizenz | Liberating Structures (Lipmanowicz & McCandless), CC BY-SA 4.0. Dieser Text steht unter derselben Lizenz. | Liberating Structures (Lipmanowicz & McCandless), CC BY-SA 4.0. This text is under the same licence. |

Ablauf, etwa 27 Minuten, 4–30 Personen, zu zweit oder zu dritt:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Impuls: „Was kannst du selbst sofort tun?“ | Prompt: “What can you do yourself, right now?” | vorstellen | alle | 1 |
| 2 | Eigene Schritte notieren | Note your own steps | allein | verdeckt | 5 |
| 3 | Zu zweit oder zu dritt teilen | Share in pairs or threes | zu zweit | Gruppe | 8 |
| 4 | Einander beraten: Fragen und Anregungen | Advise each other: questions and suggestions | zu zweit | Gruppe | 11 |
| 5 | Einige teilen mit allen | Some share with everyone | vorstellen | alle | 2 |

### 15. Agenda aus der Runde

| Feld | Deutsch | English |
|---|---|---|
| Name | Agenda aus der Runde | Agenda from the room |
| Auch bekannt als | Lean Coffee | Lean Coffee |
| Kurzbeschreibung | Alle schlagen Themen vor, wählen verdeckt, und ihr besprecht sie der Reihe nach mit fester Zeit je Thema. | Everyone suggests topics, votes in secret, and you discuss them in order with a fixed time per topic. |
| Wann nutzen | Für ein Treffen ohne feste Tagesordnung, wenn die Runde selbst bestimmen soll, worüber sie spricht. | For a meeting without a fixed agenda, when the group should decide what to talk about. |
| Ergebnis | Themen mit Stimmen, die Reihenfolge, Stand je Thema (offen, läuft, erledigt) und die Notizen zu jedem besprochenen Thema. | Topics with votes, the order, status per topic (open, in progress, done) and the notes for each discussed topic. |
| Belegt | **Praktikerkonsens.** Für diese Methode gibt es keine Studien. Die Stimmen bleiben bis zur Auszählung verdeckt. | **Practitioner consensus.** There are no studies of this method. Votes stay hidden until the count. |
| Lizenz | Lean Coffee: Jim Benson und Jeremy Lightsmith, „Share freely with attribution“ (leancoffee.org). | Lean Coffee: Jim Benson and Jeremy Lightsmith, “share freely with attribution” (leancoffee.org). |

Ablauf, etwa 45 Minuten, 3–10 Personen. Die Zeit je Thema (Voreinstellung 7 Minuten) ist eine Annahme des Produkts,
nicht aus einer Quelle:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Themen notieren | Note topics | allein | verdeckt | 4 |
| 2 | Aufdecken, jedes Thema in 1–2 Sätzen vorstellen | Reveal, present each topic in 1–2 sentences | vorstellen | alle | 6 |
| 3 | Zwei Stimmen, auch beide auf ein Thema | Two votes, both may go to one topic | allein | nur Summe | 2 |
| 4 | Themen der Reihe nach besprechen, mit fester Zeit je Thema | Discuss topics in order, fixed time per topic | alle | alle | 30 |
| 5 | Abschluss | Close | alle | alle | 3 |

### 16. Lage in vier Feldern

| Feld | Deutsch | English |
|---|---|---|
| Name | Lage in vier Feldern | Four-field situation review |
| Auch bekannt als | SWOT-Analyse, hier in geführter Fassung (Register offen) | SWOT analysis, guided version (register not checked) |
| Kurzbeschreibung | Ihr füllt Stärken, Schwächen, Chancen und Risiken, prüft jeden Eintrag auf Belege und leitet Maßnahmen ab. | You fill in strengths, weaknesses, opportunities and threats, check each entry for evidence and derive actions. |
| Wann nutzen | Wenn eure Organisation oder ein Team eine SWOT erwartet; diese Fassung zwingt zu Belegen und einer Auswahl. | When your organisation or team expects a SWOT; this version forces evidence and a choice. |
| Ergebnis | Die vier Felder mit Belegstatus je Eintrag, höchstens drei Einträge je Feld, Maßnahmen aus den Kombinationen der Felder. | The four fields with evidence status per entry, at most three entries per field, actions from combining the fields. |
| Belegt | **umstritten.** Ein Jahrzehnt Forschung lieferte keinen messbaren Erfolgsnachweis für die SWOT-Analyse. Diese Fassung verlangt deshalb Belege, eine Auswahl und Maßnahmen. | **Contested.** A decade of research produced no measurable proof that SWOT analysis works. This version therefore asks for evidence, a choice and actions. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 45 Minuten, 3–15 Personen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Gegenstand und Zeitraum vorstellen | Present the subject and period | vorstellen | alle | 3 |
| 2 | Die vier Felder füllen | Fill in the four fields | allein | verdeckt | 8 |
| 3 | Aufdecken und bündeln | Reveal and group | alle | alle | 6 |
| 4 | Belege prüfen: „Woran sehen wir das?“ Einträge ohne Beleg werden markiert | Check evidence: “How do we know?” Entries without evidence are marked | Kleingruppe je Feld | Gruppe | 10 |
| 5 | Je Feld höchstens drei wählen | Pick at most three per field | allein | nur Summe | 4 |
| 6 | Felder kombinieren: Stärke und Chance, Schwäche und Risiko … → Maßnahmen | Combine fields: strength and opportunity, weakness and threat … → actions | Kleingruppe | Gruppe | 10 |
| 7 | Maßnahmen festlegen | Agree on actions | alle | alle | 6 |

### 17. Ursachenbaum

| Feld | Deutsch | English |
|---|---|---|
| Name | Ursachenbaum | Cause tree |
| Auch bekannt als | – (ersetzt die Kette aus fünf Warum-Fragen) | – (replaces the five-whys chain) |
| Kurzbeschreibung | Ihr verzweigt ein Problem in mögliche Ursachen, prüft jedes Glied auf Belege und wählt Ansatzpunkte. | You branch a problem into possible causes, check each link for evidence and choose where to act. |
| Wann nutzen | Wenn ein Problem wiederkehrt und ihr wissen wollt, woran es liegt, bevor ihr Maßnahmen beschließt. | When a problem keeps coming back and you want to know why before deciding on actions. |
| Ergebnis | Der Baum mit Status je Ursache (belegt, vermutet, widerlegt), die gewählten Ansatzpunkte mit Maßnahmen und wie ihr die Wirkung prüft. | The tree with a status per cause (supported, assumed, ruled out), the chosen points of action with measures and how you will check the effect. |
| Belegt | **Praktikerkonsens.** Der Baum selbst ist nicht getestet. Er ersetzt die einfache Kette aus fünf Warum-Fragen, die eine begutachtete Kritik als zu grob für Ursachenanalysen einstuft. | **Practitioner consensus.** The tree itself has not been tested. It replaces the simple five-whys chain, which a peer-reviewed critique judges too crude for root-cause analysis. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 40 Minuten, 3–10 Personen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Problem genau beschreiben: was, wann, wo, wie oft | Describe the problem: what, when, where, how often | alle | alle | 5 |
| 2 | Mögliche Ursachen notieren | Note possible causes | allein | verdeckt | 5 |
| 3 | Aufdecken und zu Hauptzweigen bündeln | Reveal and group into main branches | alle | alle | 5 |
| 4 | Je Zweig weiterfragen: „Warum?“ Mehrere Antworten sind erlaubt | Ask “why?” along each branch; several answers allowed | Kleingruppe | Gruppe | 10 |
| 5 | Jedes Glied prüfen: belegt, vermutet oder widerlegt? | Check each link: supported, assumed or ruled out? | alle | alle | 8 |
| 6 | Ansatzpunkte wählen | Choose points of action | allein | nur Summe | 3 |
| 7 | Maßnahmen festlegen: Ändert sie die Ursache oder nur einen Hinweis? | Agree on measures: does it change the cause or only add a warning? | alle | alle | 5 |

### 18. Vier Zukünfte

| Feld | Deutsch | English |
|---|---|---|
| Name | Vier Zukünfte | Four futures |
| Auch bekannt als | Szenario-Matrix, Szenarioplanung | Scenario matrix, scenario planning |
| Kurzbeschreibung | Ihr wählt zwei große Unsicherheiten, beschreibt die vier Zukünfte, die sich daraus ergeben, und sucht, was in allen trägt. | You pick two major uncertainties, describe the four futures they create and look for what works in all of them. |
| Wann nutzen | Wenn ihr langfristig plant und die Zukunft sich nicht vorhersagen lässt. | When you plan long term and the future cannot be predicted. |
| Ergebnis | Die gesammelten Einflüsse mit Bewertung, die zwei Achsen, vier beschriebene Zukünfte, Schritte, die in allen vier sinnvoll sind. | The collected factors with ratings, the two axes, four described futures, steps that make sense in all four. |
| Belegt | **umstritten.** Es gibt wenige Experimente mit gemischtem Ergebnis. Eine Auswertung von 52 Evaluationen fand wenig überzeugende Belege für den oft behaupteten großen Nutzen. | **Contested.** There are few experiments, with mixed results. A review of 52 evaluations found little convincing evidence for the large benefits often claimed. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 60 Minuten, 4–20 Personen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Frage und Zeithorizont vorstellen | Present the question and time horizon | vorstellen | alle | 3 |
| 2 | Einflüsse notieren | Note factors | allein | verdeckt | 6 |
| 3 | Aufdecken und bündeln | Reveal and group | alle | alle | 6 |
| 4 | Bewerten: Wie unsicher? Wie stark die Wirkung? | Rate: how uncertain? How strong the effect? | allein | nur Summe | 4 |
| 5 | Zwei Achsen wählen | Choose two axes | alle | alle | 5 |
| 6 | Je Feld eine Zukunft beschreiben | Describe one future per field | Kleingruppe | Gruppe | 15 |
| 7 | Zukünfte vorstellen | Present the futures | vorstellen | alle | 10 |
| 8 | Was hilft in allen vier? | What helps in all four? | alle | alle | 8 |

### 19. Perspektivenrunden

| Feld | Deutsch | English |
|---|---|---|
| Name | Perspektivenrunden | Perspective rounds |
| Auch bekannt als | – | – |
| Kurzbeschreibung | Kleingruppen sehen einen Vorschlag nacheinander aus der Sicht verschiedener Betroffener und ergänzen, was die Gruppe davor schrieb. | Small groups look at a proposal from the view of different stakeholders in turn and add to what the previous group wrote. |
| Wann nutzen | Wenn ein Vorschlag viele betrifft und ihr blinde Flecken finden wollt, bevor ihr entscheidet. | When a proposal affects many people and you want to find blind spots before deciding. |
| Ergebnis | Je Perspektive die Notizen aller Gruppen, die Folgerungen für den Vorschlag. | Per perspective the notes of all groups, the conclusions for the proposal. |
| Belegt | **Praktikerkonsens.** Für diesen Ablauf gibt es keine Studien. | **Practitioner consensus.** There are no studies of this procedure. |
| Lizenz | keine Nennung nötig | no attribution needed |

Ablauf, etwa 40 Minuten, 6–30 Personen in 3–5 Kleingruppen. Die Perspektiven sind betroffene Gruppen, die die
Moderation benennt (etwa Kundschaft, Betrieb, Finanzen, Neue im Team), keine festen Denkrollen:

| # | Phase (DE) | Phase (EN) | Modus | Sichtbarkeit | Min. |
|---|---|---|---|---|---|
| 1 | Vorschlag vorstellen | Present the proposal | vorstellen | alle | 4 |
| 2 | Perspektiven festlegen | Agree on the perspectives | alle | alle | 3 |
| 3 | Jede Kleingruppe notiert aus ihrer ersten Perspektive | Each small group writes from its first perspective | Kleingruppe | Gruppe | 6 |
| 4 | Wechsel: nächste Perspektive, Notizen der Vorgruppe lesen und ergänzen (wiederholt, je 5 Min.) | Rotate: next perspective, read and add to the previous group's notes (repeated, 5 min each) | Kleingruppe | Gruppe | 15 |
| 5 | Je Perspektive vorstellen | Present per perspective | vorstellen | alle | 8 |
| 6 | Folgerungen für den Vorschlag | Conclusions for the proposal | alle | alle | 6 |

---

## (a) Abschnitt für die Startseite

Entwurf; die Schlüssel kämen unter `landing.methods` in `de.json` und `en.json`. Der Abschnitt nennt nur die zwölf
Methoden von v1. Jede steht mit ihrer Kurzbeschreibung da, nie als bloßer Name.

**Deutsch**

> ## Geführte Methoden
>
> Eine Methode gibt der Wand einen Ablauf: Phasen mit Zeit, wer mit wem arbeitet und was wann sichtbar wird. Bevor
> diskutiert wird, schreibt jede Person allein und verdeckt; so lenkt die erste Meinung im Raum nicht alle anderen.
> Bei jeder Methode steht, wie gut sie belegt ist.
>
> - **Rückblick nach Ziel und Daten:** Ihr vergleicht Ziel und tatsächlichen Verlauf, sucht Gründe für Abweichungen und legt bis zu drei Aktionen fest.
> - **Still sammeln, bündeln, verdeckt wählen:** Alle schreiben Ideen verdeckt, die Ideen werden gebündelt, dann wählt jede Person verdeckt; heraus kommt eine Rangfolge.
> - **1-2-4-Alle:** Erst allein, dann zu zweit, dann zu viert denken; jede Vierergruppe bringt ihre stärkste Idee ein.
> - **Stille Ideenrunde mit Rangfolge:** Alle sammeln still, legen reihum je eine Idee offen, klären sie und ranken verdeckt; heraus kommt eine Rangliste.
> - **Schätzen – Diskutieren – Schätzen:** Alle schätzen verdeckt, besprechen in Kleingruppen die Abweichungen und schätzen neu; heraus kommt eine Gruppenschätzung mit Streuung.
> - **Kriterienbewertung:** Ihr legt erst Kriterien fest, bewertet dann jede Option je Kriterium verdeckt; heraus kommt eine begründete Rangfolge.
> - **Gegenposition prüfen:** Eine Gruppe sucht gezielt die Schwächen eines Vorschlags; heraus kommen geprüfte Annahmen und ein verbesserter Vorschlag.
> - **Scheitern vorwegdenken:** Ihr stellt euch vor, der Plan ist gescheitert, und schreibt verdeckt auf, warum; heraus kommen Risiken und Planänderungen.
> - **Entscheidungsprotokoll mit Zustimmungsrunde:** Ihr klärt, wer entscheidet, prüft einen Vorschlag auf Einwände und haltet die Entscheidung mit Prüftermin fest.
> - **Was? Na und? Was nun?:** In drei Runden sammelt ihr Fakten, deutet sie und leitet nächste Schritte ab.
> - **Annahmen prüfen:** Ihr sammelt die Annahmen hinter einem Vorhaben, findet die riskantesten und plant für sie je einen Test.
> - **Ziele mit messbaren Ergebnissen:** Ihr entwerft Ziele verdeckt, wählt bis zu drei und legt für jedes messbare Ergebnisse und Verantwortliche fest.
>
> 1-2-4-Alle und „Was? Na und? Was nun?“ nach Liberating Structures, CC BY-SA 4.0.

**English**

> ## Guided methods
>
> A method gives the wall a sequence: timed phases, who works with whom, and what becomes visible when. Before
> anyone discusses, everyone writes alone and in private, so the first opinion in the room does not steer the rest.
> Each method says how well it is supported by evidence.
>
> - **Review against goal and data:** You compare the goal with what actually happened, look for reasons and agree on up to three actions.
> - **Write alone, group, vote in secret:** Everyone writes ideas in private, the ideas are grouped, then everyone votes in secret; you get a ranking.
> - **1-2-4-All:** Think alone, then in pairs, then in fours; each group of four brings its strongest idea.
> - **Silent round with ranking:** Everyone collects ideas silently, shares one per turn, clarifies, and ranks in private; you get a ranked list.
> - **Estimate – discuss – estimate:** Everyone estimates in private, small groups discuss the differences, then everyone estimates again; you get a group estimate with its spread.
> - **Rating by criteria:** You agree on criteria first, then rate each option on each criterion in private; you get a ranking with reasons.
> - **Test the counter-position:** One group deliberately looks for a proposal's weaknesses; you get tested assumptions and a better proposal.
> - **Imagine the failure:** You imagine the plan has failed and write down in private why; you get risks and changes to the plan.
> - **Decision record with consent round:** You clarify who decides, check a proposal for objections and record the decision with a review date.
> - **What? So what? Now what?:** In three rounds you collect facts, make sense of them and derive next steps.
> - **Test your assumptions:** You collect the assumptions behind a venture, find the riskiest ones and plan a test for each.
> - **Goals with measurable results:** You draft goals in private, pick up to three and set measurable results and owners for each.
>
> 1-2-4-All and “What? So what? Now what?” after Liberating Structures, CC BY-SA 4.0.

---

## (b) Auswahl unter `/neu`

**Aufbau.** Unter der Frage der Wand steht „Methode“ als eine Gruppe von Optionsfeldern (`radiogroup`).
Voreingestellt ist „Still sammeln, bündeln, verdeckt wählen“: Das ist der heutige Weg (verdeckt schreiben,
aufdecken, ordnen), um die verdeckte Wahl ergänzt, und die am besten belegte Grundform (PLAN-METHODEN.md). Die
Methoden stehen nach Zweck gegliedert, jede Gruppe mit einer Überschrift. Die letzte Option ist „Freie Wand:
schreiben und ordnen, ohne festen Ablauf“, der Weg für alle, die heute die Wand ohne verdecktes Schreiben anlegen.

**Gruppen und Reihenfolge** (v1; die Kandidaten für v1.1 in Klammern, an ihrer späteren Stelle):

| Gruppe (DE) | Group (EN) | Methoden |
|---|---|---|
| Ideen sammeln | Collect ideas | Still sammeln, bündeln, verdeckt wählen · 1-2-4-Alle (· 15-%-Lösungen · Agenda aus der Runde) |
| Entscheiden | Decide | Stille Ideenrunde mit Rangfolge · Kriterienbewertung · Schätzen – Diskutieren – Schätzen · Gegenposition prüfen · Entscheidungsprotokoll mit Zustimmungsrunde (· Perspektivenrunden) |
| Planen und Ziele | Plans and goals | Ziele mit messbaren Ergebnissen · Annahmen prüfen (· Lage in vier Feldern · Vier Zukünfte) |
| Rückblick | Review | Rückblick nach Ziel und Daten · Was? Na und? Was nun? (· Ursachenbaum) |
| Risiken | Risks | Scheitern vorwegdenken (· Aufhören, was schadet) |

In v1 hat „Risiken“ nur eine Methode. Das ist so gewollt, bis „Aufhören, was schadet“ dazukommt.

**Eine Zeile** zeigt, in dieser Reihenfolge:

1. das Optionsfeld mit dem Namen als Beschriftung (fett);
2. die Kurzbeschreibung darunter, immer sichtbar, Teil der Beschriftung (`aria-describedby`), damit ein
   Screenreader sie mit dem Namen vorliest;
3. eine Zeile mit Fakten: Dauer („≈ 25 Min.“ / “≈ 25 min”), Gruppengröße („3–30 Personen“ / “3–30 people”) und die
   Evidenzstufe als Marke mit Text (nie nur Farbe): „Meta-Analyse“, „Experimente“, „Studien“, „Praktikerkonsens“,
   „umstritten“;
4. rechts oder darunter die Schaltfläche „Mehr dazu“ / “More”. Sie steht außerhalb der Beschriftung des
   Optionsfelds, damit ein Klick darauf die Methode nicht wählt (eigener Knopf mit `aria-expanded` und
   `aria-controls`, kein `<details>` innerhalb des `<label>`).

Beispiel:

```
( ) Still sammeln, bündeln, verdeckt wählen
    Alle schreiben Ideen verdeckt, die Ideen werden gebündelt, dann wählt jede
    Person verdeckt; heraus kommt eine Rangfolge.
    ≈ 25 Min. · 3–30 Personen · [Meta-Analyse]                      Mehr dazu ▾
```

**„Mehr dazu“** klappt unter der Zeile auf und zeigt:

- **Wann nutzen:** der Satz aus dem Katalog.
- **Ablauf:** eine nummerierte Liste, je Phase eine Zeile: Name der Phase, dann Modus, Sichtbarkeit und Minuten,
  etwa „2. Ideen schreiben · allein, verdeckt · 7 Min.“; darunter „Gesamt etwa 25 Minuten, 3–30 Personen“.
- **Belegt:** die Stufe und der Satz aus dem Katalog.
- **Auch bekannt als:** nur wenn vorhanden.
- **Namensnennung:** nur wenn nötig (Liberating Structures, Lean Coffee), mit Link zur Quelle.
- Ein Link „Was die Stufen bedeuten“ zur Erklärung der fünf Stufen (Tabelle oben) auf einer eigenen Seite oder in
  einem Dialog.

Die Texte von „Mehr dazu“ lädt die Seite mit der Auswahl, nicht die Wand. Die Beschreibung einer gewählten Methode
erscheint auf der Wand noch einmal kurz (Name und Kurzbeschreibung) und mit der aktuellen Phase.
