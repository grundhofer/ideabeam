# Belegprüfung der Methodensätze

Stand 2026-11-27. Geprüft wurden alle 19 „Belegt“-Zeilen aus [`methoden-katalog.md`](methoden-katalog.md) und die
vier `evidence`-Sätze in `packages/shared/src/methods/texts.ts` (DE und EN). Drei davon stimmen wörtlich mit dem
Katalog überein (Still sammeln, 1-2-4-Alle, Schätzen). Der vierte, „Freie Wand“, steht nur im Code (Stufe `studies`
in `catalogue.ts`) und fehlt im Katalog.

**Wie geprüft wurde.** Für jede Quelle wurde das Original gesucht: Abstract über Europe PMC, OpenAlex oder Semantic
Scholar (alle mit DOI), Volltext, wenn frei (EEA-Bericht, SJDM-Poster 2021, Wilder 2022). Verlagsseiten von
Elsevier, AOM, BMJ und PubMed waren für automatische Abrufe gesperrt (403 oder Cookie-Sperre). Wo nur ein
Abstract-Spiegel oder eine Suchzusammenfassung zu sehen war, steht das in der Zeile. **Volltexte hinter Paywall
wurden nicht gelesen**, Zahlen und Moderatoren stammen also aus Abstracts.

**Urteile:** bestätigt · bestätigt mit Einschränkung · nicht bestätigt · nicht prüfbar.

**Kurz:** 20 Methodensätze. 8 sind bestätigt und können bleiben. 12 müssen geändert werden, davon 4 wegen einer
falschen Aussage (Rückblick, „Was? Na und? Was nun?“, Scheitern vorwegdenken, Annahmen prüfen) und 8 wegen
ungenauer Wörter. Kein Satz ist ganz unprüfbar; vier Teilquellen konnten nur aus zweiter Hand gesehen werden
(Paulus & Yang 2000, SJDM-Poster 2020, Hill & Westbrook 1997, Van de Ven & Delbecq 1974 nur gekürztes Abstract).

---

## 1. Rückblick nach Ziel und Daten (Meta-Analyse)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Zwei Meta-Analysen zeigen, dass strukturierte Rückblicke die Leistung verbessern. | Tannenbaum & Cerasoli (2013), „Do team and individual debriefs enhance performance? A meta-analysis“, *Human Factors* 55(1), 231–245, [doi:10.1177/0018720812448394](https://doi.org/10.1177/0018720812448394): 46 Stichproben, N = 2.136, d = .67, rund 25 % besser als Kontrolle. Keiser & Arthur (2021), „A meta-analysis of the effectiveness of the after-action review (or debrief) and factors that influence its effectiveness“, *J. Applied Psychology* 106(7), 1007–1032, [doi:10.1037/apl0000821](https://doi.org/10.1037/apl0000821): 61 Studien, d = 0,79. | bestätigt mit Einschränkung | „strukturierte“ streichen: Struktur wirkt laut Tannenbaum nur „potenziell“, laut Keiser & Arthur nur im Militär, nicht im Gesundheitswesen. Keiser & Arthur messen überwiegend Trainingskriterien. |
| … stärker, wenn sie an **Zielen** ausgerichtet sind … | dieselben | **nicht bestätigt** | „Alignment“ heißt in beiden Arbeiten, dass der Rückblick zur Ebene passt (Einzelne oder Team, Fokus und Messebene gleich). Mit Zielen hat das nichts zu tun. Der Satzteil fällt weg. |
| … und an **Daten statt an Erinnerung**. | Keiser & Arthur 2021: „objective performance review media“ trägt durchgängig zur Wirkung bei. | bestätigt | bleibt |
| Stufe „Meta-Analyse“ | | passt | |

Neu DE: „Zwei Meta-Analysen zeigen, dass Rückblicke die Leistung verbessern, stärker, wenn sie mit objektiven Daten
wie Aufzeichnungen oder Messwerten arbeiten statt mit der Erinnerung.“
Neu EN: “Two meta-analyses show that reviews improve performance, more so when they work from objective data such as
recordings or measurements rather than memory.”

## 2. Still sammeln, bündeln, verdeckt wählen (Meta-Analyse) — auch in `texts.ts`

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Gruppen, die mündlich brainstormen, liefern weniger Ideen als **dieselben Leute** allein. | Mullen, Johnson & Salas (1991), „Productivity loss in brainstorming groups: A meta-analytic integration“, *Basic and Applied Social Psychology* 12(1), 3–23, [doi:10.1207/s15324834basp1201_1](https://doi.org/10.1207/s15324834basp1201_1): weniger produktiv als Nominalgruppen, „in terms of both quantity and quality“; Verlust größer bei größeren Gruppen. | bestätigt mit Einschränkung | Verglichen wurden **gleich viele** Einzelpersonen (Nominalgruppen), nicht dieselben Leute. Qualität kann dazu: „weniger und nicht bessere Ideen“. |
| Die Punktwahl selbst ist nicht untersucht. | Recherche: nur Praktikerquellen ([NN/g](https://www.nngroup.com/articles/dot-voting/), [18F](https://guides.18f.org/methods/discover/dot-voting/)). | bestätigt (Fehlen, keine Gegenbelege gefunden) | bleibt |
| Sichtbare Zwischenstände verzerrten in einem großen Experiment spätere Bewertungen. | Muchnik, Aral & Taylor (2013), „Social influence bias: A randomized experiment“, *Science* 341, 647–651, [doi:10.1126/science.1240466](https://doi.org/10.1126/science.1240466): großes randomisiertes Experiment auf einer Nachrichtenseite; frühere Bewertungen verzerrten spätere, positive Herdeneffekte. | bestätigt | „Feldexperiment“ ist genauer; sonst bleibt es. |
| Stufe „Meta-Analyse“ | | passt (Kern = allein schreiben) | |

Neu DE: „Laut einer Meta-Analyse liefern Gruppen, die mündlich brainstormen, weniger und nicht bessere Ideen als
gleich viele Leute, die allein schreiben; deshalb schreibt hier jede Person für sich. Die Punktwahl selbst ist nicht
untersucht; sie läuft verdeckt, weil in einem großen Feldexperiment sichtbare frühere Bewertungen die späteren
verzerrten.“
Neu EN: “A meta-analysis found that groups brainstorming out loud produce fewer and no better ideas than the same
number of people working alone, so here everyone writes on their own. Dot voting itself has not been studied; votes
stay hidden because in a large field experiment, visible earlier ratings skewed later ones.”

## 3. 1-2-4-Alle (Experimente) — auch in `texts.ts`

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Die Methode selbst ist nicht getestet. | Recherche, keine Studie gefunden. | bestätigt (Fehlen) | bleibt |
| In Experimenten wurden Gruppen besser, wenn jede Person zuerst allein schrieb oder antwortete und kleine Gruppen danach darüber sprachen. | Navajas, Niella, Garbulsky, Bahrami & Sigman (2018), „Aggregated knowledge from a small number of debates outperforms the wisdom of large crowds“, *Nature Human Behaviour* 2, 126–132, [doi:10.1038/s41562-017-0273-4](https://doi.org/10.1038/s41562-017-0273-4) ([arXiv:1703.00045](https://arxiv.org/abs/1703.00045)): 5.180 Zuschauer einer Live-Veranstaltung, erst privat, dann Fünfergruppen; der Mittelwert weniger Gruppenantworten schlug die Einzelantworten. Dazu Mullen et al. 1991 (allein vor Gruppe). Paulus & Yang (2000), *OBHDP* 82(1), 76–87, [doi:10.1006/obhd.2000.2888](https://doi.org/10.1006/obhd.2000.2888): kein Abstract abrufbar. | bestätigt | bleibt. Der Satz trägt auch ohne Paulus & Yang. |
| Stufe „Experimente“ | | passt | |

## 4. Stille Ideenrunde mit Rangfolge (Experimente)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| In einem Experiment von 1974 schnitt dieser Ablauf **klar besser ab** als frei diskutierende Gruppen. | Van de Ven & Delbecq (1974), „The effectiveness of nominal, Delphi, and interacting group decision making processes“, *Academy of Management Journal* 17(4), 605–621, [doi:10.5465/255641](https://doi.org/10.5465/255641). Abstract (OpenAlex, gekürzt): verglichen wurden **Zahl der Ideen und Zufriedenheit**; auf einer Faktenfindungsaufgabe waren Nominal- und Delphi-Gruppen gleich gut und beide besser als interagierende Gruppen. | bestätigt mit Einschränkung | „besser“ heißt hier: mehr Ideen (und Zufriedenheit), nicht bessere Entscheidungen. Das muss im Satz stehen. |
| Neuere Vergleiche fehlen. | Recherche: „Eine moderne Meta-Analyse zu NGT fehlt.“ | nicht bestätigt in dieser Schärfe | Es gibt spätere Vergleiche (z. B. Van de Ven & Delbecq 1977 in *Management Science*, [doi:10.1287/mnsc.23.6.595](https://doi.org/10.1287/mnsc.23.6.595), nicht gelesen). Belegbar ist nur: Die Befunde sind alt, eine neuere Meta-Analyse kennen wir nicht. |
| Stufe „Experimente“ | ein Experiment | passt knapp | |

Neu DE: „In einem Experiment von 1974 fanden Gruppen mit diesem Ablauf mehr Ideen als frei diskutierende Gruppen. Die
Befunde sind alt; eine neuere Meta-Analyse kennen wir nicht.“
Neu EN: “In a 1974 experiment, groups using this procedure came up with more ideas than freely discussing groups. The
findings are old; we know of no recent meta-analysis.”

## 5. Schätzen – Diskutieren – Schätzen (Experimente) — auch in `texts.ts`

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Eine systematische Übersicht fand, dass **solche Runden** meist genauer sind als der Mittelwert der ersten Schätzungen und als frei diskutierende Gruppen. | Rowe & Wright (1999), „The Delphi technique as a forecasting tool: issues and analysis“, *International Journal of Forecasting* 15(4), 353–375, [doi:10.1016/S0169-2070(99)00018-7](https://doi.org/10.1016/S0169-2070(99)00018-7). Abstract nur über Suchzusammenfassung gesehen: Delphi besser als statistische Gruppen 12:2 (2 unentschieden), besser als interagierende Gruppen 5:1 (2 unentschieden). | bestätigt mit Einschränkung | Richtung und „meist“ stimmen. Aber Delphi ist **anonyme** Rückmeldung **ohne** Gespräch. Diese Methode hat ein Gespräch; dafür ist Navajas et al. 2018 (siehe 3) der passende Beleg. „solche Runden“ also genauer fassen. |
| Fast alle Tests nutzen Aufgaben mit einer richtigen Antwort. | Rowe & Wright; Navajas (Schätzfragen) | bestätigt | bleibt |
| Stufe „Experimente“ | | passt | |

Neu DE: „Eine systematische Übersicht fand, dass Schätzrunden mit anonymer Rückmeldung meist genauer sind als der
Mittelwert der ersten Schätzungen und als frei diskutierende Gruppen. Ein großes Experiment fand Ähnliches für kurze
Gespräche in Fünfergruppen. Fast alle Tests nutzen Aufgaben mit einer richtigen Antwort.“
Neu EN: “A systematic review found that estimation rounds with anonymous feedback are usually more accurate than the
average of first estimates and than freely discussing groups. A large experiment found something similar for short
talks in groups of five. Almost all tests used tasks with a correct answer.”

## 6. Kriterienbewertung (Studien)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Die Methode selbst ist nicht getestet. | Recherche | bestätigt (Fehlen) | bleibt |
| In der Personalauswahl sagen strukturierte Interviews mit festen Kriterien den späteren Erfolg im Mittel am besten voraus. | Sackett, Zhang, Berry & Lievens (2022), „Revisiting meta-analytic estimates of validity in personnel selection: Addressing systematic overcorrection for restriction of range“, *J. Applied Psychology* 107(11), 2040–2068, [doi:10.1037/apl0000994](https://doi.org/10.1037/apl0000994): „Structured interviews emerged as the top-ranked selection procedure.“ | bestätigt | bleibt. Wenn gewünscht genauer: „die spätere Leistung im Beruf“ statt „den späteren Erfolg“ (optional). |
| Stufe „Studien“ | Meta-Analyse aus Nachbarfeld = indirekt | passt | |

## 7. Gegenposition prüfen (Meta-Analyse)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Eine Meta-Analyse fand, dass eine eingebaute Gegenposition zu besseren Empfehlungen führt als eine einfache Expertenempfehlung. | Schwenk (1990), „Effects of devil's advocacy and dialectical inquiry on decision making: A meta-analysis“, *OBHDP* 47(1), 161–176, [doi:10.1016/0749-5978(90)90051-A](https://doi.org/10.1016/0749-5978(90)90051-A). Abstract nur über einen Datenbankspiegel gesehen (Verlag 403): „the DA is more effective than the E approach in general“; dialektische Prüfung war bei schlecht strukturierten Aufgaben nicht besser als der Expertenansatz. | bestätigt (Abstract aus zweiter Hand) | bleibt. Der Satz meint richtigerweise den Advocatus Diaboli, nicht die dialektische Prüfung. |
| Der Ablauf ist daraus abgeleitet, nicht selbst getestet. | | bestätigt | bleibt |
| Stufe „Meta-Analyse“ | | passt | |

## 8. Scheitern vorwegdenken (umstritten)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Direkte Tests sind **wenige kleine Studien** mit gemischtem Ergebnis. | Keysor, Wojtyna & Veinott, SJDM-Poster 2020, [PDF](https://dlab.sauder.ubc.ca/sjdm/presentations/2020-Poster-Elizabeth-premortem-confidence-brainstorming.pdf). Gandhi, Duke & Schweitzer, „Problems with premortems: Self-serving attribution bias in a popular debiasing strategy“, SJDM-Poster 2021, [PDF](https://dlab.sauder.ubc.ca/sjdm/presentations/2021-Poster-Gandhi-Linnea-debiasing-premortem-selfserving~.pdf) (über das Internet Archive gelesen): drei vorregistrierte Studien plus Pilot, **N = 2.345**, MTurk und Prolific, Einzelpersonen. | **nicht bestätigt** (Teil) | „klein“ stimmt für 2021 nicht. Richtig ist: nur Konferenzposter, nicht begutachtet. |
| … einmal weniger Selbstüberschätzung, einmal kein Unterschied … | Poster 2020: Server nicht erreichbar, nur Suchauszüge: Experiment 1 senkte die Zuversicht, Experiment 2 ohne signifikante Unterschiede. | nicht prüfbar (nur aus zweiter Hand) | darf bleiben, Vorbehalt notiert; vor Veröffentlichung das Poster einmal öffnen. |
| … einmal zusätzlich ein stärkerer Hang, Misserfolg **anderen** zuzuschreiben. | Poster 2021: weniger Selbstüberschätzung, aber mehr Gründe „outside of their control (e.g., the weather, bad luck)“. | bestätigt mit Einschränkung | Nicht „anderen“, sondern „Umständen außerhalb der eigenen Kontrolle“. |
| Stufe „umstritten“ | | passt | |

Neu DE: „Direkte Tests gibt es nur als Konferenzposter, mit gemischtem Ergebnis: einmal weniger Selbstüberschätzung,
einmal kein Unterschied. Eine größere Online-Studienreihe fand weniger Selbstüberschätzung, aber auch, dass die Leute
mögliches Scheitern stärker auf Umstände außerhalb ihrer Kontrolle schoben.“
Neu EN: “Direct tests exist only as conference posters, with mixed results: once less overconfidence, once no
difference. A larger online series of studies found less overconfidence, but also that people blamed possible failure
more on circumstances outside their control.”

## 9. Entscheidungsprotokoll mit Zustimmungsrunde (Praktikerkonsens)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Zu Zustimmungsverfahren gibt es nur Fallstudien ohne Vergleichsgruppe. | Wilder (2022), „Does sociocracy support student voice? Student perceptions of a student council using sociocracy in a public school“, *Holistic Education Review* 2(2), [PDF](https://her.journals.publicknowledgeproject.org/index.php/her/article/download/2307/2303/7474): qualitative Interviewstudie, 10 Schülerinnen und Schüler, eine Schule, keine Vergleichsgruppe; Autorin bei Sociocracy For All. | bestätigt | bleibt. Das „nur“ ist eine Aussage über das Fehlen, gestützt auf die Recherche, nicht auf eine Übersichtsarbeit. |
| Stufe „Praktikerkonsens“ | | passt | |

## 10. Was? Na und? Was nun? (Praktikerkonsens)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Eine Form des Rückblicks, aber selbst nicht getestet. | Recherche | bestätigt (Fehlen) | bleibt |
| Ihr fehlt der **Abgleich mit einem Ziel**, mit dem eine Meta-Analyse stärkere Wirkung von Rückblicken fand. | Keiser & Arthur 2021 (siehe 1) | **nicht bestätigt** | Die Meta-Analyse nennt Passung zur Ebene (Einzelne/Team) und objektive Daten, keine Ziele. Belegbar ist der Daten-Teil. |
| Stufe „Praktikerkonsens“ | | passt | |

Neu DE: „Eine Form des Rückblicks, aber selbst nicht getestet. Sie arbeitet mit dem, was die Leute erinnern; eine
Meta-Analyse fand stärkere Wirkung, wenn Rückblicke objektive Daten nutzen.“
Neu EN: “A form of review, but not tested itself. It works from what people remember; a meta-analysis found stronger
effects when reviews use objective data.”

## 11. Annahmen prüfen (Experimente)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| In randomisierten Experimenten änderten Gründerinnen und Gründer, die Annahmen als prüfbare Hypothesen behandelten, häufiger die Richtung … | Camuffo, Cordova, Gambardella & Spina (2020), „A scientific approach to entrepreneurial decision making: Evidence from a randomized control trial“, *Management Science* 66(2), 564–586, [doi:10.1287/mnsc.2018.3249](https://doi.org/10.1287/mnsc.2018.3249): 116 italienische Start-ups; „more likely to pivot“. | bestätigt | bleibt |
| … und gaben schwache Vorhaben **eher** auf (EN: „sooner“). | Camuffo 2020: „**not more likely to drop out** than the control group in the early stages“. Camuffo, Gambardella, Messinese, Novelli, Paolucci & Spina (2024), „A scientific approach to entrepreneurial decision-making: Large-scale replication and extension“, *Strategic Management Journal* 45(6), [doi:10.1002/smj.3580](https://doi.org/10.1002/smj.3580): vier RCTs, 759 Firmen, „positive impact on idea termination“; Richtungswechsel nur nichtlinear (wenige statt keine oder ständige). | **nicht bestätigt** für die Studie von 2020; bestätigt erst durch die Wiederholung 2024 | Beide Befunde getrennt nennen. „schwach“ und „sooner“ (Zeitpunkt) sind nicht belegt. |
| Die Vorlage selbst ist nicht getestet. | | bestätigt | bleibt |
| Stufe „Experimente“ | fünf RCTs | passt | |

Neu DE: „In randomisierten Experimenten mit jungen Firmen wechselten Gründerinnen und Gründer, die Annahmen als
prüfbare Hypothesen behandelten, häufiger die Richtung; in einer großen Wiederholung gaben sie Ideen häufiger auf. Die
Vorlage selbst ist nicht getestet.“
Neu EN: “In randomised experiments with young firms, founders who treated assumptions as testable hypotheses changed
direction more often; in a large replication they dropped ideas more often. The template itself has not been tested.”

## 12. Ziele mit messbaren Ergebnissen (Praktikerkonsens)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Zu dieser Art von Zielen gibt es **nur Fallberichte**, keine Vergleichsstudien. | Butler, Zimmermann & Bird (2023), „Objectives and Key Results in software teams: Challenges, opportunities and impact on development“, [arXiv:2311.00236](https://arxiv.org/abs/2311.00236): 47 Interviews und eine Befragung mit 512 Antworten in einer Firma, ohne Vergleichsgruppe. | bestätigt mit Einschränkung | „keine Vergleichsstudien“ stimmt; „nur Fallberichte“ untertreibt, es gibt auch Befragungen. |
| Stufe „Praktikerkonsens“ | | passt | |

Neu DE: „Zu dieser Art von Zielen gibt es nur Fallstudien und Befragungen, keine Vergleichsstudien.“
Neu EN: “This kind of goal setting has only case studies and surveys, no comparative studies.”

## 13. Aufhören, was schadet · 14. 15-%-Lösungen · 15. Agenda aus der Runde (Praktikerkonsens)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Für diese Methode gibt es keine Studien (13: Perspektivwechsel nicht untersucht). | Recherche; eigene Suche nach Studien zu Creative Destruction, 15 % Solutions und Lean Coffee ergab nur Praxis- und Werbetexte (z. B. [Liberating Structures](https://www.liberatingstructures.com/7-15-solutions/), [Lipmanowicz & McCandless, Plexus](https://plexusinstitute.org/wp-content/uploads/2017/08/Liberating_Structures_Lipmanowicz_and_McCandless.pdf)). | bestätigt (Fehlen) | bleiben. „Die Stimmen bleiben bis zur Auszählung verdeckt“ (15) ist eine Produktaussage, kein Beleg; darf bleiben. |
| Stufe „Praktikerkonsens“ | | passt | |

## 16. Lage in vier Feldern (umstritten)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| **Ein Jahrzehnt Forschung** lieferte keinen messbaren Erfolgsnachweis für die SWOT-Analyse. | Helms & Nixon (2010), „Exploring SWOT analysis – where are we now? A review of academic research from the last decade“, *Journal of Strategy and Management* 3(3), 215–251, [doi:10.1108/17554251011064837](https://doi.org/10.1108/17554251011064837): „past research continues to lack quantifiable findings on the success of the SWOT analysis“. | bestätigt mit Einschränkung | Es ist **eine Übersicht** über begutachtete Wirtschaftsartikel, nicht „ein Jahrzehnt Forschung“ als Ganzes. Und die Übersicht urteilt insgesamt **wohlwollend** („Research supports SWOT analysis as a tool for planning purposes“). |
| Stufe „umstritten“ | Kritisch ist nur Hill & Westbrook (1997), „SWOT analysis: It's time for a product recall“, *Long Range Planning* 30(1), 46–52, [doi:10.1016/S0024-6301(96)00095-7](https://doi.org/10.1016/S0024-6301(96)00095-7) — [M], kein Abstract abrufbar, Stichprobe in Sekundärquellen 20 oder 50 Firmen. | nicht prüfbar | Entscheidung nötig, siehe unten. |

**Entscheidung zur Stufe.** Empfehlung: **„Praktikerkonsens“**, solange Hill & Westbrook nicht am Volltext geprüft
ist. Pro: Die einzige geprüfte Quelle sagt „keine messbaren Belege“, nicht „schädlich“; das ist genau die Definition
von Praktikerkonsens. Contra: Nutzer erwarten bei SWOT eine Warnung, und „umstritten“ gibt sie. Alternative: Hill &
Westbrook (Paywall) besorgen und lesen; bestätigt sich die Kritik, bleibt „umstritten“.

Neu DE: „Eine Übersicht über zehn Jahre Forschung fand keine messbaren Belege, dass die SWOT-Analyse zum Erfolg
beiträgt. Diese Fassung verlangt deshalb Belege, eine Auswahl und Maßnahmen.“
Neu EN: “A review of ten years of research found no measurable evidence that SWOT analysis contributes to success.
This version therefore asks for evidence, a choice and actions.”

## 17. Ursachenbaum (Praktikerkonsens)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Der Baum selbst ist nicht getestet. | Recherche | bestätigt (Fehlen) | bleibt |
| Eine **begutachtete** Kritik stuft die Kette aus fünf Warum-Fragen als zu grob für Ursachenanalysen ein. | Card (2017), „The problem with ‘5 whys’“, *BMJ Quality & Safety* 26(8), 671–677, [doi:10.1136/bmjqs-2016-005849](https://doi.org/10.1136/bmjqs-2016-005849): „so grossly oversimplifies the process of problem exploration that it should not be used at all“ (über Suchauszug und PSNet, Verlag 403). | bestätigt mit Einschränkung | Inhalt stimmt (Kontext: Gesundheitswesen). Ob die Reihe „The problem with…“ begutachtet wird, ließ sich nicht prüfen. „begutachtete“ ersetzen. |
| Stufe „Praktikerkonsens“ | | passt | |

Neu DE: „Der Baum selbst ist nicht getestet. Er ersetzt die einfache Kette aus fünf Warum-Fragen, die eine Fachkritik
in einer Zeitschrift für Patientensicherheit als zu grob für Ursachenanalysen einstuft.“
Neu EN: “The tree itself has not been tested. It replaces the simple five-whys chain, which a critique in a patient
safety journal judges too crude for root-cause analysis.”

## 18. Vier Zukünfte (umstritten)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Es gibt wenige Experimente mit gemischtem Ergebnis. | Phadnis, Caplice, Sheffi & Singh (2015), „Effect of scenario planning on field experts' judgment of long-range investment decisions“, *Strategic Management Journal* 36(9), 1401–1411, [doi:10.1002/smj.2293](https://doi.org/10.1002/smj.2293): drei Feldexperimente mit Fachleuten; Szenarien änderten die Zuversicht insgesamt nicht, verschoben aber Urteile je nach Szenario. EEA-Bericht: Laborexperimente mit Studierenden. | bestätigt | bleibt |
| Eine Auswertung von **52 Evaluationen** fand wenig überzeugende Belege für den oft behaupteten großen Nutzen. | EEA (2009), *Looking back on looking forward: a review of evaluative scenario literature*, Technical report 3/2009, [PDF](https://www.eea.europa.eu/en/analysis/publications/looking-back-on-looking-forward-a-review-of-evaluative-scenario-literature/looking-back-on-looking-forward-a-review-of-evaluative-scenario-literature/@@download/file) (Volltext gelesen): „little compelling evidence to support the significant claims often made“; Grundlage sind „52 sources“ (Artikel, Bücher, Arbeitspapiere, Berichte). | bestätigt mit Einschränkung | „52 Evaluationen“ → „52 Arbeiten“. Der Bericht sagt auch, die wenige Forschung deute auf Nutzen für robuste Entscheidungen hin; „umstritten“ passt deshalb. |
| Stufe „umstritten“ | | passt | |

Neu DE: „Es gibt wenige Experimente mit gemischtem Ergebnis. Eine Übersicht über 52 Arbeiten fand wenig überzeugende
Belege für den oft behaupteten großen Nutzen.“
Neu EN: “There are few experiments, with mixed results. A review of 52 studies and reports found little compelling
evidence for the large benefits often claimed.”

## 19. Perspektivenrunden (Praktikerkonsens)

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| Für diesen Ablauf gibt es keine Studien. | Recherche. Die kleinen Experimente zu „Six Thinking Hats“ (Vernon & Hocking) betreffen einen anderen Ablauf (Denkhüte, nicht Betroffenen-Perspektiven) und zählen hier nicht. | bestätigt (Fehlen) | bleibt |
| Stufe „Praktikerkonsens“ | | passt | |

## 20. Freie Wand (Studien) — nur in `texts.ts`

| Behauptung | Quelle | Urteil | Vorschlag |
|---|---|---|---|
| In Experimenten übertraf elektronisches Brainstorming, bei dem alle mitlesen, mündliche Runden **ab einer mittleren Gruppengröße**. | Gallupe, Dennis, Cooper, Valacich, Bastianutti & Nunamaker (1992), „Electronic brainstorming and group size“, *Academy of Management Journal* 35(2), 350–369, [doi:10.5465/256377](https://doi.org/10.5465/256377): zwei Experimente mit Gruppen aus 2, 4, 6 und 6, 12 Personen; in größeren Gruppen elektronisch mehr und bessere Ideen, in kleinen kaum Unterschied (Abstract gekürzt plus Suchzusammenfassung). | bestätigt mit Einschränkung | „ab einer mittleren Gruppengröße“ ist unscharf; belegt ist „in größeren Gruppen“. Hinweis: Dort waren Beiträge anonym. |
| Diese Form selbst ist nicht untersucht. | | bestätigt | bleibt |
| Stufe „Studien“ | Experimente zu einer Nachbarform = indirekt | passt | |

Neu DE: „In Experimenten übertraf elektronisches Brainstorming, bei dem alle mitlesen, mündliche Runden in größeren
Gruppen; in kleinen Gruppen gab es kaum Unterschiede. Diese Form selbst ist nicht untersucht.“
Neu EN: “In experiments, electronic brainstorming, where everyone reads along, beat spoken rounds in larger groups; in
small groups there was little difference. This form itself has not been studied.”

---

## Änderungen in `packages/shared/src/methods/texts.ts`

Nur die drei Sätze, die im Code stehen und sich ändern. `eins-zwei-vier` bleibt.

**`still-sammeln`, DE**
- alt: „Laut einer Meta-Analyse liefern Gruppen, die mündlich brainstormen, weniger Ideen als dieselben Leute allein; deshalb schreibt hier jede Person für sich. Die Punktwahl selbst ist nicht untersucht; sie läuft verdeckt, weil sichtbare Zwischenstände in einem großen Experiment spätere Bewertungen verzerrten.“
- neu: „Laut einer Meta-Analyse liefern Gruppen, die mündlich brainstormen, weniger und nicht bessere Ideen als gleich viele Leute, die allein schreiben; deshalb schreibt hier jede Person für sich. Die Punktwahl selbst ist nicht untersucht; sie läuft verdeckt, weil in einem großen Feldexperiment sichtbare frühere Bewertungen die späteren verzerrten.“

**`still-sammeln`, EN**
- alt: “A meta-analysis found that groups brainstorming out loud produce fewer ideas than the same people working alone, so here everyone writes on their own. Dot voting itself has not been studied; votes stay hidden because visible interim results skewed later ratings in a large experiment.”
- neu: “A meta-analysis found that groups brainstorming out loud produce fewer and no better ideas than the same number of people working alone, so here everyone writes on their own. Dot voting itself has not been studied; votes stay hidden because in a large field experiment, visible earlier ratings skewed later ones.”

**`schaetzen`, DE**
- alt: „Eine systematische Übersicht fand, dass solche Runden meist genauer sind als der Mittelwert der ersten Schätzungen und als frei diskutierende Gruppen. Fast alle Tests nutzen Aufgaben mit einer richtigen Antwort.“
- neu: „Eine systematische Übersicht fand, dass Schätzrunden mit anonymer Rückmeldung meist genauer sind als der Mittelwert der ersten Schätzungen und als frei diskutierende Gruppen. Ein großes Experiment fand Ähnliches für kurze Gespräche in Fünfergruppen. Fast alle Tests nutzen Aufgaben mit einer richtigen Antwort.“

**`schaetzen`, EN**
- alt: “A systematic review found that such rounds are usually more accurate than the average of first estimates and than freely discussing groups. Almost all tests used tasks with a correct answer.”
- neu: “A systematic review found that estimation rounds with anonymous feedback are usually more accurate than the average of first estimates and than freely discussing groups. A large experiment found something similar for short talks in groups of five. Almost all tests used tasks with a correct answer.”

**`free`, DE**
- alt: „In Experimenten übertraf elektronisches Brainstorming, bei dem alle mitlesen, mündliche Runden ab einer mittleren Gruppengröße. Diese Form selbst ist nicht untersucht.“
- neu: „In Experimenten übertraf elektronisches Brainstorming, bei dem alle mitlesen, mündliche Runden in größeren Gruppen; in kleinen Gruppen gab es kaum Unterschiede. Diese Form selbst ist nicht untersucht.“

**`free`, EN**
- alt: “In experiments, electronic brainstorming, where everyone reads along, beat spoken rounds from medium group sizes on. This form itself has not been studied.”
- neu: “In experiments, electronic brainstorming, where everyone reads along, beat spoken rounds in larger groups; in small groups there was little difference. This form itself has not been studied.”

## Änderungen in `docs/methoden-katalog.md` (Zeile „Belegt“, Stufenwort bleibt, außer bei 16)

| # | Alt (DE) → Neu (DE) | Alt (EN) → Neu (EN) |
|---|---|---|
| 1 | „Zwei Meta-Analysen zeigen, dass strukturierte Rückblicke die Leistung verbessern, stärker, wenn sie an Zielen und Daten statt an Erinnerung ausgerichtet sind.“ → „Zwei Meta-Analysen zeigen, dass Rückblicke die Leistung verbessern, stärker, wenn sie mit objektiven Daten wie Aufzeichnungen oder Messwerten arbeiten statt mit der Erinnerung.“ | “Two meta-analyses show that structured reviews improve performance, more so when they work from goals and data rather than memory.” → “Two meta-analyses show that reviews improve performance, more so when they work from objective data such as recordings or measurements rather than memory.” |
| 2 | wie `texts.ts`, `still-sammeln` DE | wie `texts.ts`, `still-sammeln` EN |
| 4 | „In einem Experiment von 1974 schnitt dieser Ablauf klar besser ab als frei diskutierende Gruppen. Neuere Vergleiche fehlen.“ → „In einem Experiment von 1974 fanden Gruppen mit diesem Ablauf mehr Ideen als frei diskutierende Gruppen. Die Befunde sind alt; eine neuere Meta-Analyse kennen wir nicht.“ | “In a 1974 experiment this procedure clearly beat freely discussing groups. More recent comparisons are missing.” → “In a 1974 experiment, groups using this procedure came up with more ideas than freely discussing groups. The findings are old; we know of no recent meta-analysis.” |
| 5 | wie `texts.ts`, `schaetzen` DE | wie `texts.ts`, `schaetzen` EN |
| 8 | „Direkte Tests sind wenige kleine Studien mit gemischtem Ergebnis: einmal weniger Selbstüberschätzung, einmal kein Unterschied, einmal zusätzlich ein stärkerer Hang, Misserfolg anderen zuzuschreiben.“ → „Direkte Tests gibt es nur als Konferenzposter, mit gemischtem Ergebnis: einmal weniger Selbstüberschätzung, einmal kein Unterschied. Eine größere Online-Studienreihe fand weniger Selbstüberschätzung, aber auch, dass die Leute mögliches Scheitern stärker auf Umstände außerhalb ihrer Kontrolle schoben.“ | “Direct tests are a few small studies with mixed results: once less overconfidence, once no difference, once an added tendency to blame failure on others.” → “Direct tests exist only as conference posters, with mixed results: once less overconfidence, once no difference. A larger online series of studies found less overconfidence, but also that people blamed possible failure more on circumstances outside their control.” |
| 10 | „Eine Form des Rückblicks, aber selbst nicht getestet. Ihr fehlt der Abgleich mit einem Ziel, mit dem eine Meta-Analyse stärkere Wirkung von Rückblicken fand.“ → „Eine Form des Rückblicks, aber selbst nicht getestet. Sie arbeitet mit dem, was die Leute erinnern; eine Meta-Analyse fand stärkere Wirkung, wenn Rückblicke objektive Daten nutzen.“ | “A form of review, but not tested itself. It lacks the comparison with a goal that a meta-analysis linked to stronger effects of reviews.” → “A form of review, but not tested itself. It works from what people remember; a meta-analysis found stronger effects when reviews use objective data.” |
| 11 | „In randomisierten Experimenten änderten Gründerinnen und Gründer, die Annahmen als prüfbare Hypothesen behandelten, häufiger die Richtung und gaben schwache Vorhaben eher auf. Die Vorlage selbst ist nicht getestet.“ → „In randomisierten Experimenten mit jungen Firmen wechselten Gründerinnen und Gründer, die Annahmen als prüfbare Hypothesen behandelten, häufiger die Richtung; in einer großen Wiederholung gaben sie Ideen häufiger auf. Die Vorlage selbst ist nicht getestet.“ | “In randomised experiments, founders who treated assumptions as testable hypotheses changed direction more often and dropped weak ventures sooner. The template itself has not been tested.” → “In randomised experiments with young firms, founders who treated assumptions as testable hypotheses changed direction more often; in a large replication they dropped ideas more often. The template itself has not been tested.” |
| 12 | „Zu dieser Art von Zielen gibt es nur Fallberichte, keine Vergleichsstudien.“ → „Zu dieser Art von Zielen gibt es nur Fallstudien und Befragungen, keine Vergleichsstudien.“ | “This kind of goal setting has only case reports, no comparative studies.” → “This kind of goal setting has only case studies and surveys, no comparative studies.” |
| 16 | Stufe „umstritten“ → „Praktikerkonsens“ (Empfehlung, Entscheidung offen). „Ein Jahrzehnt Forschung lieferte keinen messbaren Erfolgsnachweis für die SWOT-Analyse. Diese Fassung …“ → „Eine Übersicht über zehn Jahre Forschung fand keine messbaren Belege, dass die SWOT-Analyse zum Erfolg beiträgt. Diese Fassung verlangt deshalb Belege, eine Auswahl und Maßnahmen.“ | “Contested.” → “Practitioner consensus.” (if decided). “A decade of research produced no measurable proof that SWOT analysis works. This version …” → “A review of ten years of research found no measurable evidence that SWOT analysis contributes to success. This version therefore asks for evidence, a choice and actions.” |
| 17 | „… die eine begutachtete Kritik als zu grob für Ursachenanalysen einstuft.“ → „… die eine Fachkritik in einer Zeitschrift für Patientensicherheit als zu grob für Ursachenanalysen einstuft.“ | “… which a peer-reviewed critique judges too crude for root-cause analysis.” → “… which a critique in a patient safety journal judges too crude for root-cause analysis.” |
| 18 | „Eine Auswertung von 52 Evaluationen fand …“ → „Eine Übersicht über 52 Arbeiten fand …“ | “A review of 52 evaluations found little convincing evidence …” → “A review of 52 studies and reports found little compelling evidence …” |
| neu | Der Katalog hat keinen Eintrag für „Freie Wand“; ihr Satz steht nur im Code. Wenn der Katalog die Quelle aller Texte sein soll, den neuen Satz aus 20 dort ergänzen. | |

## Was offen bleibt

- **Vor Veröffentlichung noch am Original öffnen:** SJDM-Poster 2020 (Server war nicht erreichbar), Van de Ven &
  Delbecq 1974 (nur gekürztes Abstract), Schwenk 1990 und Rowe & Wright 1999 (Abstract nur aus zweiter Hand), Hill &
  Westbrook 1997 (für die Stufe bei 16).
- **Die Recherche hat einen Fehler an der Quelle:** In `recherche-methoden.md` (Abschnitt „Rückblicke …“ und
  Gestaltungsregel 3) und in den Notizen `evidenz-business-frameworks.md` steht, die Wirkung steige, wenn der
  Rückblick „an konkreten Zielen ausgerichtet“ sei. Keiser & Arthur meinen mit „alignment“ die Passung zur Ebene
  (Einzelne oder Team). Das sollte dort korrigiert werden, sonst wandert der Fehler in neue Texte. Ebenso ist das
  Jahr jetzt geklärt: Keiser & Arthur 2021, JAP 106(7), 1007–1032 (2022 ist eine zweite Arbeit in *J. Business and
  Psychology*).
- **Aussagen über das Fehlen von Studien** („keine Studien“, „nur Fallstudien“) beruhen auf der Recherche und einer
  kurzen eigenen Suche, nicht auf einer Übersichtsarbeit. Wer es vorsichtiger will, schreibt „Wir kennen keine
  Studien“; das wäre eine Stiländerung für alle Praktikerkonsens-Sätze und ist hier nicht vorgeschlagen.
