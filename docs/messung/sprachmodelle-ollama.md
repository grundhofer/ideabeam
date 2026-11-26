# Kleines Sprachmodell gruppiert Zettel (Vorprüfung mit Ollama)

Stand 2026-11-22 12:19, Ollama 0.40.6, Apple M4 Pro, 48 GB (nativ über Ollama, nicht im Browser). Erzeugt von `tools/eval_llm.py`. Alles lief lokal, kein Zettel hat den Rechner verlassen.

Je Wand 250 Zettel und 5 Bezugsthemen; jede Zahl ist das **Mittel der zwei Wände**, in Klammern Einarbeitung / Stadtteil-App. „±“ ist die größte Standardabweichung über die Startwerte (nur wo mehrere liefen). Der Startwert ändert die Reihenfolge der Zettel, die Temperatur ist immer 0.
Kontextfenster 4096 Token, Schritt A in Teilen zu 50 Zetteln, Schritt B in Stapeln zu 15 Zetteln, Antwort per JSON-Schema erzwungen. Zettel ohne gültige Antwort zählen als falsch.
Vergleich aus dem Einbettungsbericht (Gruppen bilden mit k-Means, ARI / Reinheit je Wand): MiniLM 0,20 / 0,51 · EmbeddingGemma 2 0,34 / 0,64 · voyage-4-nano 0,45 / 0,71. Die Marke aus dem Plan ist ARI ≥ 0,5.

## Befund

Von Hand eingetragene Lesart der Zahlen vom 22.11.2026 (steht im JSON unter `befund`; die Tabellen darunter erzeugt das Skript). Der Lauf wurde vorzeitig beendet: bis auf granite4:350m hat jedes Modell nur einen Startwert, die Streuung ist also unbekannt; Unterschiede unter etwa 0,1 im ARI sagen nichts.

**Unter 2 GB reicht es nicht.** Ganzer Ablauf (V1, ARI im Mittel der zwei Wände): granite4:350m 0,00 (-0,00 / 0,00), qwen3:0.6b 0,01 (-0,00 / 0,02), qwen3.5:0.8b 0,05 (0,06 / 0,03), qwen3:1.7b 0,11 (0,08 / 0,15). Das liegt unter dem, was Einbettungen mit k-Means schaffen (0,20 bis 0,45). Die zwei kleinsten Modelle legen fast alles in ein Thema oder verteilen zufällig.
**Mit 4 Mrd. Parametern kommt die Marke in Reichweite, sicher darüber liegt erst das größere Modell.** qwen3:4b (2,5 GB) erreicht 0,44 (0,52 / 0,35), also eine Wand über und eine unter 0,5. gemma4:e4b (9,6 GB auf der Platte, 8 Mrd. Parameter mit Bild- und Tonteil) erreicht 0,62 (0,55 / 0,68) bei Reinheit 0,79 (0,72 / 0,86). Zeit je Wand für A + B: qwen3:4b 143 s (bester Lauf 87 s), gemma4:e4b 95 s (bester Lauf 92 s), nativ auf einem M4 Pro.
**Die Zuordnung ist die Hürde der kleinen Modelle, das Finden der Themen die der größeren.** Mit den wahren Themen (V2) trifft qwen3:0.6b 0,30 (0,23 / 0,37) der Zettel (Zufall wäre 0,20), qwen3:1.7b 0,61 (0,65 / 0,57), qwen3:4b 0,86 (0,84 / 0,87), gemma4:e4b 0,92 (0,92 / 0,93); als ARI 0,26 (0,33 / 0,20), 0,67 (0,65 / 0,69) und 0,82 (0,81 / 0,82). Zwischen V2 und V1 verlieren qwen3:4b und gemma4:e4b rund 0,2 ARI: ihre selbst gefundenen Themen sind brauchbar, aber gröber oder anders geschnitten als die Bezugsthemen.
**Die Mischform (V3) reicht nicht.** Themen vom Modell, Zuordnung über voyage-4-nano zum nächsten Thema: qwen3:1.7b 0,25 (0,20 / 0,29), qwen3:4b 0,34 (0,35 / 0,34), gemma4:e4b 0,38 (0,26 / 0,50). Selbst mit den wahren Themen kommt diese Zuordnung nur auf 0,56; MiniLM liegt überall deutlich darunter. Lässt man danach k-Means ab den Themen weiterlaufen, steigt der Wert (qwen3:1.7b 0,43 (0,41 / 0,46), qwen3:4b 0,45 (0,45 / 0,45), gemma4:e4b 0,54 (0,50 / 0,58), wahre Themen 0,57), aber das ist im Kern wieder k-Means auf den Einbettungen (0,45 ohne Sprachmodell); die Titel passen dann nicht mehr sicher zu den Gruppen.
**Was hielt, was nicht.** Das erzwungene JSON-Schema hat getragen: kein einziger ungültiger oder fehlender Zettel in Schritt B, bei keinem Modell; das Kontextfenster von 4096 Token wurde nie voll (größter Aufruf 1665 Token). Kein Modell hat nach Sprache statt nach Thema gruppiert. Gescheitert sind nur zwei Aufrufe in Schritt A, beide bei granite4:350m: einmal HTTP 500 von Ollama (Variante 4, der Lauf zählt als misslungen), einmal eine an der Längengrenze abgeschnittene Antwort (der Lauf ging mit vier statt fünf Teilen weiter). granite4:350m schrieb Thementitel teils auf Deutsch trotz Anweisung und wiederholte Titel, sodass zwei Läufe weniger als 4 verschiedene Themen hatten; qwen3:0.6b schöpft die Höchstzahl von 8 Themen aus, mit Überschneidungen. Denken einzuschalten bringt nichts und kostet das 12- bis 23-Fache an Zeit (Vorversuche).
**Lesart für das Produkt.** Ein Modell, das im Browser in 1,5 GB passt, gruppiert die Zettel schlechter als die Einbettungen allein. Die kleinste gemessene Größe, die eine Wand über 0,5 bringt, ist 2,5 GB (qwen3:4b), und das mit nur einem Startwert und nur auf einer der zwei Wände.

**Nachtrag vom 22.11.2026, mittags: mittelgroße Modelle.** gemma4:12b (7,6 GB) erreicht im ganzen Ablauf 0,72 (0,73 / 0,72) bei Reinheit 0,89, mistral-small3.2:24b (15,2 GB) 0,64 (0,62 / 0,66) bei Reinheit 0,84; mit den wahren Themen treffen beide 95 von 100 Zetteln. Im Browser laufen sie nicht, sie stehen für die Modellklasse, die KI-Anbieter betreiben. Zwei Nebenläufe mit gemma4:12b stellen den Ablauf auf einem Server nach (Kontextfenster 16384, Themen aus allen 250 Zetteln in einem Aufruf): 0,80 (0,82 / 0,79) mit Stapeln zu 15 und 0,80 (0,85 / 0,75) mit Stapeln zu 50, Reinheit 0,93 und 0,94. Je ein Startwert; die Lesart oben gilt weiter nur für Modelle, die in den Browser passen.

## Modelle

| Ollama-Tag | Größe auf der Platte | Parameter | Quantisierung | Lizenz | Kontext genutzt (möglich) | Denken |
|---|---|---|---|---|---|---|
| qwen3:0.6b | 0,52 GB | 0,75 Mrd. | Q4_K_M | Apache-2.0 | 4096 (40960) | aus |
| granite4:350m | 0,71 GB | 0,35 Mrd. | BF16 | Apache-2.0 | 4096 (32768) | kann das Modell nicht |
| qwen3.5:0.8b | 1,24 GB | 0,85 Mrd. | mxfp8 | Apache-2.0 | 4096 (262144) | aus |
| qwen3:1.7b | 1,36 GB | 2,03 Mrd. | Q4_K_M | Apache-2.0 | 4096 (40960) | aus |
| qwen3:4b | 2,50 GB | 4,02 Mrd. | Q4_K_M | Apache-2.0 | 4096 (262144) | aus |
| gemma4:12b | 7,56 GB | 11,91 Mrd. | Q4_K_M | Apache-2.0 | 4096 (262144) | aus |
| gemma4:e4b | 9,61 GB | 8,00 Mrd. | Q4_K_M | Apache-2.0 | 4096 (131072) | aus |
| mistral-small3.2:24b | 15,18 GB | 24,01 Mrd. | Q4_K_M | Apache-2.0 | 4096 (131072) | kann das Modell nicht |

## Ergebnis

V1 = das Modell schlägt Themen vor und ordnet zu. V2 = nur zuordnen, mit den wahren Themen (Decke der Zuordnung). V3 = Themen vom Modell, Zuordnung über Einbettungen (voyage-4-nano q4, je Sprache zentriert, nächstes Thema).
„Stapel“ = 15 Zettel je Aufruf, Themen zuerst, Antwort als JSON mit dem Titel des Themas. „einzeln“ = ein Aufruf je Zettel, Zettel zuerst, dann die Themen, Antwort ein Buchstabe.

| Modell | GB | Themen | V1 ARI Stapel | V1 ARI einzeln | V1 Reinheit Stapel / einzeln | V2 Treffer Stapel / einzeln | V2 ARI Stapel / einzeln | V3 ARI | V3 Reinheit |
|---|---|---|---|---|---|---|---|---|---|
| qwen3:0.6b | 0,52 | 8,0 | 0,01 (-0,00 / 0,02) | – | 0,32 / – | 0,30 / – | 0,03 / – | 0,16 (0,08 / 0,24) | 0,50 |
| granite4:350m | 0,71 | 5,8 | 0,00 (-0,00 / 0,00) ±0,00 | 0,00 (0,00 / 0,01) ±0,01 | 0,26 / 0,26 | 0,24 / 0,20 | 0,00 / 0,00 | 0,15 (0,15 / 0,16) ±0,05 | 0,46 |
| qwen3.5:0.8b | 1,24 | 6,0 | 0,05 (0,06 / 0,03) | – | 0,35 / – | 0,49 / – | 0,14 / – | 0,20 (0,16 / 0,24) | 0,52 |
| qwen3:1.7b | 1,36 | 5,5 | 0,11 (0,08 / 0,15) | 0,16 (0,13 / 0,18) | 0,44 / 0,49 | 0,61 / 0,71 | 0,26 / 0,40 | 0,25 (0,20 / 0,29) | 0,55 |
| qwen3:4b | 2,50 | 7,0 | 0,44 (0,52 / 0,35) | – | 0,73 / – | 0,86 / – | 0,67 / – | 0,34 (0,35 / 0,34) | 0,65 |
| gemma4:12b | 7,56 | 6,5 | 0,72 (0,73 / 0,72) | – | 0,89 / – | 0,95 / – | 0,87 / – | – | – |
| gemma4:e4b | 9,61 | 5,5 | 0,62 (0,55 / 0,68) | – | 0,79 / – | 0,92 / – | 0,82 / – | 0,38 (0,26 / 0,50) | 0,66 |
| mistral-small3.2:24b | 15,18 | 7,0 | 0,64 (0,62 / 0,66) | – | 0,84 / – | 0,95 / – | 0,89 / – | – | – |

## Zeit je Wand (250 Zettel) und Geschwindigkeit

Nativ über Ollama auf dem Mac (Metal), Modell schon geladen. Mittel über die Läufe, in Klammern der beste Einzelwert: der Rechner hatte während der Messung andere Last (Load Average um 25 bei 14 Kernen), die Mittel sind deshalb eher zu langsam. Im Browser mit WebGPU ist trotzdem mit deutlich weniger zu rechnen.

| Modell | Schritt A (6 Aufrufe) | Schritt B Stapel (17 Aufrufe) | A + B Stapel | Schritt B einzeln (250 Aufrufe) | A + B einzeln | Ausgabe-Token/s (A / B Stapel) | Laden |
|---|---|---|---|---|---|---|---|
| qwen3:0.6b | 6 s (6) | 10 s (10) | 17 s (16) | – | – | 247 / 268 (269) | 0,0 s |
| granite4:350m | 9 s (5) | 14 s (10) | 23 s (15) | 34 s (32) | 43 s | 172 / 177 (221) | 1,0 s |
| qwen3.5:0.8b | 7 s (6) | 17 s (16) | 24 s (23) | – | – | 177 / 180 (180) | 1,0 s |
| qwen3:1.7b | 14 s (12) | 26 s (23) | 40 s (36) | 50 s (44) | 64 s | 111 / 122 (134) | 0,0 s |
| qwen3:4b | 52 s (33) | 91 s (53) | 143 s (87) | – | – | 46 / 40 (57) | 2,1 s |
| gemma4:12b | 75 s (74) | 148 s (146) | 223 s (220) | – | – | 26 / 27 (28) | 4,3 s |
| gemma4:e4b | 31 s (30) | 65 s (61) | 95 s (92) | – | – | 59 / 55 (58) | 3,0 s |
| mistral-small3.2:24b | 119 s (119) | 195 s (188) | 313 s (307) | – | – | 16 / 16 (16) | 7,8 s |

## Variante 3 im Einzelnen (Themen vom Modell, Zuordnung über Einbettungen)

Jede Zelle: ARI, Mittel der zwei Wände. „roh“ = nächstes Thema nach Kosinus; „zentriert“ = vorher je Sprache den Mittelvektor abgezogen; „+ k-Means“ = danach k-Means, gestartet bei den Themen.

| Themen von | MiniLM roh | MiniLM zentriert | MiniLM + k-Means | voyage roh | voyage zentriert | voyage + k-Means |
|---|---|---|---|---|---|---|
| qwen3:0.6b | 0,10 (0,06 / 0,14) | 0,11 (0,06 / 0,17) | 0,21 (0,14 / 0,28) | 0,14 (0,06 / 0,23) | 0,16 (0,08 / 0,24) | 0,31 (0,27 / 0,35) |
| granite4:350m | 0,09 (0,09 / 0,09) | 0,09 (0,09 / 0,10) | 0,17 (0,15 / 0,18) | 0,12 (0,09 / 0,15) | 0,15 (0,15 / 0,16) | 0,31 (0,30 / 0,33) |
| qwen3.5:0.8b | 0,09 (0,08 / 0,10) | 0,11 (0,07 / 0,15) | 0,17 (0,12 / 0,22) | 0,19 (0,16 / 0,23) | 0,20 (0,16 / 0,24) | 0,37 (0,39 / 0,35) |
| qwen3:1.7b | 0,11 (0,08 / 0,14) | 0,11 (0,07 / 0,15) | 0,23 (0,16 / 0,30) | 0,20 (0,15 / 0,25) | 0,25 (0,20 / 0,29) | 0,43 (0,41 / 0,46) |
| qwen3:4b | 0,15 (0,13 / 0,17) | 0,17 (0,19 / 0,15) | 0,27 (0,23 / 0,30) | 0,29 (0,29 / 0,28) | 0,34 (0,35 / 0,34) | 0,45 (0,45 / 0,45) |
| gemma4:12b | – | – | – | – | – | – |
| gemma4:e4b | 0,20 (0,16 / 0,23) | 0,21 (0,17 / 0,24) | 0,26 (0,18 / 0,34) | 0,39 (0,24 / 0,54) | 0,38 (0,26 / 0,50) | 0,54 (0,50 / 0,58) |
| mistral-small3.2:24b | – | – | – | – | – | – |
| **wahre Themen** (Decke) | 0,29 (0,22 / 0,35) | 0,30 (0,23 / 0,36) | 0,36 (0,26 / 0,46) | 0,52 (0,44 / 0,61) | 0,56 (0,49 / 0,64) | 0,57 (0,50 / 0,63) |

Einbetten von 250 Zetteln, nativ mit 4 Threads: minilm 0,6 s, voyage 7,5 s.

## Variante 4: Themen aus einer Stichprobe von 60 Zetteln (ein Aufruf, kein Zusammenführen)

| Modell | Themen | ARI mit Zuordnung durch das Modell | Reinheit | ARI mit Zuordnung über voyage (zentriert) | Zeit je Wand |
|---|---|---|---|---|---|
| granite4:350m | 4,7 | 0,00 (0,00 / -0,00) ±0,00 | 0,22 (0,26 / 0,18) | 0,12 (0,10 / 0,14) | 15 s |
| qwen3:1.7b | 7,0 | 0,09 (0,11 / 0,07) | 0,41 (0,42 / 0,40) | 0,19 (0,11 / 0,27) | 25 s |

## Was schiefging

Anteil der Zettel ohne gültige Antwort, abgeschnittene Antworten (Längengrenze), gescheiterte Aufrufe, größter Aufruf in Token (Eingabe + Ausgabe), ARI der Gruppen gegen die Sprache der Zettel (nahe 0 = keine Trennung nach Sprache).

| Modell | ungültig V1 Stapel | ungültig V1 einzeln | ungültig V2 | abgeschnitten | Fehler | Zusammenführen gescheitert | größter Aufruf | ARI gegen Sprache | fremde Schrift in Themen | Läufe mit weniger als 4 Themen |
|---|---|---|---|---|---|---|---|---|---|---|
| qwen3:0.6b | 0,000 | – | 0,000 | 0 | 0 | 0 | 1306 | -0,00 | 0 | 0 von 2 |
| granite4:350m | 0,000 | 0,000 | 0,000 | 1 | 2 | 0 | 1665 | -0,00 | 0 | 2 von 12 |
| qwen3.5:0.8b | 0,000 | – | 0,000 | 0 | 0 | 0 | 1191 | 0,00 | 0 | 0 von 2 |
| qwen3:1.7b | 0,000 | 0,000 | 0,000 | 0 | 0 | 0 | 1439 | 0,00 | 0 | 0 von 4 |
| qwen3:4b | 0,000 | – | 0,000 | 0 | 0 | 0 | 1371 | 0,00 | 0 | 0 von 2 |
| gemma4:12b | 0,000 | – | 0,000 | 0 | 0 | 0 | 1265 | -0,00 | 0 | 0 von 2 |
| gemma4:e4b | 0,000 | – | 0,000 | 0 | 0 | 0 | 1285 | -0,00 | 0 | 0 von 2 |
| mistral-small3.2:24b | 0,000 | – | 0,000 | 0 | 0 | 0 | 1253 | -0,00 | 0 | 0 von 2 |

## Nebenläufe (andere Einstellungen)

| Lauf | Einstellung | V1 ARI Stapel | V2 Treffer Stapel | V2 ARI Stapel | V2 Treffer einzeln | ungültig V2 | Zeit B je Wand (Stapel) | Zeit B je Wand (einzeln) | Token/s |
|---|---|---|---|---|---|---|---|---|---|
| gemma4:12b [Themen in einem Aufruf] | Antwort als Titel, Stapel 15, Teile 250, Kontext 16384, Denken aus | 0,80 (0,82 / 0,79) | – | – | – | – | 158 s | – s | 24 |
| gemma4:12b [Themen in einem Aufruf, Stapel 50] | Antwort als Titel, Stapel 50, Teile 250, Kontext 16384, Denken aus | 0,80 (0,85 / 0,75) | – | – | – | – | 136 s | – s | 26 |

## Vorversuche zur Bauart (von Hand eingetragen)

Kleine Versuche vor dem Hauptlauf, um die Bauart von Schritt B festzulegen. Alle mit den wahren Themen, Startwert 1, Denken aus, Trefferquote Einarbeitung / Stadtteil-App. Sie liefen auf demselben Korpus, auf dem gemessen wird; die Wahl der Bauart ist deshalb eher zu günstig.

**Antwortform und Stapelgröße (alle 250 Zettel je Wand, Themen zuerst):**

| Bauart | qwen3:0.6b | qwen3:1.7b |
|---|---|---|
| Titel als Antwort, Stapel 15 (Hauptlauf) | 0,23 / 0,37 | 0,65 / 0,57 |
| Buchstabe als Antwort, Stapel 15 | 0,48 / 0,38 | 0,63 / 0,56 |
| Titel, Stapel 5 | 0,26 / 0,32 | 0,60 / 0,50 |
| Titel, Stapel 1 | 0,20 / 0,26 | 0,68 / 0,61 |
| Buchstabe, Stapel 1 | 0,24 / 0,20 | 0,49 / 0,61 |

qwen3:0.6b legt in dieser Bauart fast alles in ein Thema (bis zu 100 % der Zettel in einer Gruppe). Antwortform und Stapelgröße ändern das nicht.

**Ein Zettel je Aufruf, Reihenfolge im Prompt (die ersten 100 Zettel je Wand, Antwort ein Buchstabe):**

| Reihenfolge | qwen3:0.6b | qwen3:1.7b | qwen3:4b |
|---|---|---|---|
| Zettel zuerst, dann die Themen (Bauart „einzeln“) | 0,59 / 0,59 | 0,66 / 0,81 | 0,74 / 0,69 |
| Themen zuerst, dann der Zettel | 0,60 / 0,39 | 0,45 / 0,69 | 0,72 / 0,77 |

Für die zwei kleinsten Modelle ist „Zettel zuerst“ deutlich besser; dafür lässt sich der Anfang des Prompts nicht zwischenspeichern (rund 160 Eingabe-Token je Zettel, 40.000 je Wand). Zeit für 100 Zettel: 10–13 s (0.6b), 17–19 s (1.7b), 40–44 s (4b), mit Themen zuerst etwa die Hälfte.

**Denken an oder aus (ein Zettel je Aufruf, Zettel zuerst, die ersten 40 Zettel je Wand):**

| Modell | Denken aus | Denken an | Ausgabe-Token für 80 Zettel aus / an | Zeit für 80 Zettel aus / an |
|---|---|---|---|---|
| qwen3:0.6b | 0,68 / 0,57 | 0,62 / 0,68 | 820 / 34.755 | 23 s / 281 s |
| qwen3:1.7b | 0,62 / 0,85 | 0,62 / 0,80 | 638 / 43.029 | 15 s / 349 s |

Denken bringt hier nichts Messbares (bei 40 Zetteln je Wand ist ein Unterschied von 0,1 Rauschen), kostet aber das 40- bis 70-Fache an Ausgabe-Token und das 12- bis 23-Fache an Zeit. Das Abschalten schadet also nicht erkennbar. Mit der Frage der Wand im Prompt war qwen3:0.6b nicht besser (0,60 / 0,47).

## Themen des besten kleinen Modells (bis 3 GB): qwen3:4b

V1 ARI im Mittel 0,44. Vorschläge mit Startwert 1:

**onboarding**

- Onboarding Process Clarity: Unclear expectations, missing documentation, and lack of structured guidance during initial weeks.
- Technical Setup and Access: Difficulties in accessing systems, tools, and environments for new hires.
- Communication and Social Integration: Challenges in team communication, social interactions, and building relationships with colleagues.
- Feedback and Support Mechanisms: Insufficient or delayed feedback, lack of mentorship, and inadequate support systems.
- Documentation and Knowledge Management: Poorly structured documentation, outdated information, and gaps in knowledge sharing.
- Managerial Support and Clarity: Unclear expectations, inconsistent support from managers, and lack of structured planning.

**stadtteil**

- Community Events & Activities: Organizing and sharing local events, gatherings, and recurring activities for social connection.
- Local Services & Resources: Finding and sharing practical services like shops, bakeries, and community resources within the neighborhood.
- Accessibility & Inclusion: Ensuring equitable access to services, public spaces, and support for vulnerable groups like seniors and disabled residents.
- Infrastructure & Maintenance: Tracking and reporting issues with public infrastructure, safety, and timely repairs for community well-being.
- Community Safety & Trust: Addressing safety concerns, secure transactions, and building trust in shared resources and neighborhood interactions.
- Local Economy & Support: Promoting local businesses, discounts, and economic opportunities through community-driven initiatives.
- Resource Sharing & Collaboration: Enabling neighbors to share tools, equipment, and mutual aid to reduce costs and foster community bonds.
- Information & Communication: Providing reliable, real-time updates on local services, events, and community needs to bridge communication gaps.

## Themen des besten Modells insgesamt: gemma4:12b

V1 ARI im Mittel 0,72. Vorschläge mit Startwert 1:

**onboarding**

- Technical Setup & Infrastructure: Hardware provisioning, software permissions, account access, and environment configuration.
- Documentation & Knowledge Management: Centralized wikis, updated manuals, architectural overviews, and clear technical instructions.
- Mentorship & Peer Support: Buddy systems, dedicated mentors, peer pairing, and accessible points of contact.
- Social Integration & Culture: Team bonding, inclusive culture, social events, and building connections across locations.
- Structured Onboarding & Planning: Clear roadmaps, defined goals, task progression, and structured feedback loops.
- Role Clarity & Communication: Defined expectations, internal norms, reporting lines, and effective communication channels.

**stadtteil**

- Local Commerce & Services: Information on local shops, restaurants, business hours, inventory, and exclusive neighborhood deals.
- Community Support & Mutual Aid: Peer-to-peer assistance, skill swapping, volunteering, childcare, and neighborly help.
- Sharing & Neighborhood Economy: Platforms for lending items, sharing produce, carpooling, and trading goods or services.
- Infrastructure & Public Reporting: Reporting issues like potholes, litter, and broken street furniture to local authorities.
- Mobility & Public Transport: Real-time transit data, parking rules, bike paths, and navigation tools.
- Events & Community Culture: Information on local festivals, workshops, sports clubs, and community gatherings.
- Information & Notifications: Alerts, reminders, status updates, and personalized content for the neighborhood.

## Nicht gemessen

- Der Lauf wurde auf Bitte des Auftraggebers vorzeitig beendet. Deshalb haben qwen3:0.6b, qwen3.5:0.8b, qwen3:4b und gemma4:e4b nur EINEN Startwert und keine Einzelzuordnung und keine Variante 4 im Hauptlauf; „±“ fehlt dort. Drei Startwerte gibt es nur für granite4:350m.
- Die Zeile qwen3:1.7b stammt aus dem Probelauf (gleiche Prompts und Einstellungen, 1 Startwert).
- Nicht gelaufen: phi4-mini, gemma4:e2b (4,6 GB, über der Grenze von 3 GB), granite4:micro, qwen3.5:2b. smollm3 gibt es in der Ollama-Bibliothek nicht. gemma4:12b und mistral-small3.2:24b sind am 22.11.2026 mittags nachgelaufen, je ein Startwert, nur ganzer Ablauf und wahre Themen.
- Zeiten: der Rechner hatte andere Last (Load Average um 25). Im Browser (WebGPU) wurde nichts gemessen.
- Die Bauart von Schritt B wurde auf demselben Korpus ausgesucht (siehe Vorversuche). Die Prompts für Schritt A wurden nicht nachgebessert.

## Geladene und wieder gelöschte Modelle

`granite4:350m`, `qwen3:0.6b`, `qwen3.5:0.8b`, `qwen3:1.7b`, `qwen3:4b`, `phi4-mini (geladen, aber nicht mehr gemessen)`
