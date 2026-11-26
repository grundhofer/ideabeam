# Etappe 0b: Nachmessung, Zwischenstand

Stand: 22.11.2026 · baut auf [messung.md](messung.md) auf · die Richtung ist entschieden (Abschnitt 7), drei Messungen sind zurückgestellt (Abschnitt 5)

Nach Etappe 0 hast du entschieden: erst nachmessen, ob ein Sprachmodell die Zettel besser ordnet als die
Einbettungsmodelle, dazu echte Wände und Android. Daraus wurde eine neue Richtung: Das Ordnen rechnet bei Cloudflare
Workers AI. Der Plan ist dafür umgeschrieben.

## Ergebnis in Kürze

1. **Der Korpus ist gut lösbar.** Ein starkes Sprachmodell ordnet die beiden Wände blind mit ARI 0,84 und 0,93.
   Die Etiketten sind also nicht zu streng. Die Grenze liegt bei den kleinen Modellen.
2. **Kleine Sprachmodelle helfen nicht.** Modelle bis 1,5 GB ordnen schlechter als die Einbettungen (ARI höchstens
   0,11). Ein 2,5-GB-Modell erreicht 0,44, so viel wie das beste Einbettungsmodell. Erst ein 9,6-GB-Modell kommt
   auf 0,62.
3. **Die Mischform reicht auch nicht.** Themen vom Sprachmodell, Zuordnung per Einbettung: 0,34 bis 0,38. Selbst mit
   den wahren Themen endet die Zuordnung per Einbettung bei 0,56.
4. **Mittelgroße Modelle ordnen gut, laufen aber nur auf einem Server.** `gemma4:12b` erreicht 0,72. Darf es die
   Themen aus allen Zetteln auf einmal bilden, wie es auf einem Server geht, sind es 0,80 bei Reinheit 0,93: gut
   neun von zehn Zetteln liegen richtig. Das ist die Modellklasse, die KI-Anbieter für Bruchteile eines Cents
   betreiben. Dazu passt deine Idee, das Ordnen über Anbieter laufen zu lassen (Abschnitt 6 und
   [ki-anbieter.md](ki-anbieter.md)).
5. **Bei Cloudflare gemessen: ARI 0,83.** Das sparsamste brauchbare Modell dort, `gemma-4-26b-a4b-it`, ordnet die
   Testwände mit 0,80 und 0,86, in rund einer halben Minute, für 187 Neuronen je Wand. Das Gratis-Kontingent reicht
   damit für 54 Wände mit 250 Zetteln am Tag (Abschnitt 7).

## 1 Obergrenze: ein starkes Sprachmodell ordnet blind

Ein Hilfsagent bekam je Wand nur die 250 Zettel ohne Themen und ordnete sie nach eigenem Urteil.

| Wand | Gruppen gebildet | ARI | Reinheit |
|---|---|---|---|
| Einarbeitung | 6 statt 5 | 0,84 | 0,93 |
| Stadtteil-App | 6 statt 5 | 0,93 | 1,00 |

Die Abweichungen sind Feinschnitte: „Erste Aufgaben“ und „Plan, Ziele, Feedback“ getrennt, „Leihen“ und
„Nachbarschaftshilfe“ getrennt.

Einschränkungen:

- Das Modell gehört zur selben Familie wie der Autor des Korpus. Das kann ihm die Aufgabe erleichtert haben.
- Es hat an den Gruppengrößen bemerkt, dass die Vorlage in Blöcken zu 50 gebaut ist, und eine Aufteilung erst
  danach festgelegt. Verschoben hat es deswegen nach eigener Angabe nichts.
- Ein Lauf, kein zweites Modell.

## 2 Lokale Sprachmodelle, klein und mittelgroß

Nativ über Ollama auf dem Mac, nicht im Browser. Ablauf wie später im Produkt: Das Modell schlägt Themen vor
(Zettel in Teilen zu 50, dann zusammenführen) und ordnet die Zettel in Stapeln zu 15 zu. Je Wand 250 Zettel, Werte
sind das Mittel der zwei Wände. Einzelheiten: [messung/sprachmodelle-ollama.md](messung/sprachmodelle-ollama.md).

| Modell | Größe | Themen gefunden | ARI (Einarbeitung / Stadtteil) | Reinheit | Treffer bei vorgegebenen wahren Themen | Zeit je Wand |
|---|---|---|---|---|---|---|
| granite4:350m | 0,7 GB | 5,8 | 0,00 | 0,26 | 24 % | 23 s |
| qwen3:0.6b | 0,5 GB | 8,0 | 0,01 (0,00 / 0,02) | 0,32 | 30 % | 17 s |
| qwen3.5:0.8b | 1,2 GB | 6,0 | 0,05 (0,06 / 0,03) | 0,35 | 49 % | 24 s |
| qwen3:1.7b | 1,4 GB | 5,5 | 0,11 (0,08 / 0,15) | 0,44 | 61 % | 40 s |
| qwen3:4b | 2,5 GB | 7,0 | 0,44 (0,52 / 0,35) | 0,73 | 86 % | 143 s |
| gemma4:e4b | 9,6 GB | 5,5 | 0,62 (0,55 / 0,68) | 0,79 | 92 % | 95 s |
| gemma4:12b | 7,6 GB | 6,5 | **0,72** (0,73 / 0,72) | 0,89 | 95 % | 223 s |
| mistral-small3.2:24b | 15,2 GB | 7,0 | 0,64 (0,62 / 0,66) | 0,84 | 95 % | 313 s |

Alle Modelle stehen unter Apache-2.0. Es gab keine ungültigen Antworten und keine Trennung nach Sprache. Das
kleinste Modell legt fast alles in ein Thema.

Die zwei mittelgroßen Modelle ordnen bei vorgegebenen Themen 95 von 100 Zetteln richtig zu. Was ihnen zur
Obergrenze fehlt, ist das Finden der Themen: Sie schneiden feiner oder anders als der Korpus. `mistral-small3.2`
bildet für die Einarbeitungswand acht Themen statt fünf, darunter „Onboarding Process“ neben „Practical
Onboarding“. Das größere Modell ist hier nicht das bessere.

Einschränkungen:

- Ein Lauf je Modell (außer beim kleinsten). Unterschiede unter etwa 0,1 sagen wenig.
- Die Zeiten sind unter starker Fremdlast gemessen und gelten für native Ausführung. Im Browser ist mit mehr zu
  rechnen.
- Nicht gelaufen: `gemma4:e2b`, `phi4-mini`.
- Der Hilfsagent hat einen eigenen Lauf mit `pkill -f "tools/eval_llm.py"` beendet. Das trifft Prozesse nach Namen
  auf dem ganzen Rechner. Es deutet nichts darauf, dass ein fremder Prozess so hieß, belegt ist es nicht.

## 3 Mischform: Themen vom Sprachmodell, Zuordnung per Einbettung

| Themen von | Zuordnung mit voyage-4-nano, ARI | mit MiniLM, ARI |
|---|---|---|
| qwen3:1.7b | 0,25 | – |
| qwen3:4b | 0,34 | – |
| gemma4:e4b | 0,38 | – |
| den wahren Themen (Obergrenze) | 0,56 | 0,30 |

Die Zuordnung per Einbettung ist das schwache Glied, nicht das Benennen der Themen.

## 4 Gesamtbild

Je Wand (250 Zettel, 5 Themen), gegen die Themen des Korpus:

| Ansatz | Größe | Wo es läuft | ARI | Reinheit |
|---|---|---|---|---|
| Wörter zählen | – | überall | 0,00 | – |
| Kleine Sprachmodelle | 0,5 bis 1,4 GB | Laptop mit WebGPU | 0,01 bis 0,11 | 0,32 bis 0,44 |
| MiniLM (Einbettung) | 78 MB, gekürzt 36 MB | voraussichtlich überall | 0,20 | 0,51 |
| EmbeddingGemma 2 (Einbettung) | 160 MB | Laptop mit WebGPU | 0,34 | 0,64 |
| qwen3:4b (Sprachmodell) | 2,5 GB | Laptop mit WebGPU, ungeprüft | 0,44 | 0,73 |
| voyage-4-nano (Einbettung) | 218 MB | Laptop mit WebGPU | 0,45 | 0,71 |
| gemma4:e4b (Sprachmodell) | 9,6 GB | nur außerhalb des Browsers | 0,62 | 0,79 |
| mistral-small3.2:24b (Sprachmodell) | 15,2 GB | Server | 0,64 | 0,84 |
| gemma4:12b (Sprachmodell) | 7,6 GB | Server | 0,72 | 0,89 |
| gemma4:12b, Themen aus allen Zetteln auf einmal (Abschnitt 6) | 7,6 GB | Server | 0,80 | 0,93 |
| **`gemma-4-26b-a4b-it` bei Cloudflare (Abschnitt 7)** | – | Cloudflare Workers AI | **0,83** | 0,93 |
| Starkes Sprachmodell | – | Cloud | 0,84 bis 0,93 | 0,93 bis 1,00 |

Was das heißt:

- **Im Browser, ohne Kosten, auf jedem Gerät:** höchstens jeder zweite Zettel richtig.
- **Im Browser am Laptop:** drei von vier Zetteln richtig, mit 218 MB Download. Ein Sprachmodell gleicher Güte
  bräuchte 2,5 GB.
- **Auf einem Server, mittelgroßes Modell:** rund neun von zehn Zetteln richtig. Bei einem Anbieter in der EU kostet
  das etwa 0,3 Cent je Wand mit 250 Zetteln, bei Cloudflare ist ein Tageskontingent gratis
  ([ki-anbieter.md](ki-anbieter.md)).
- **Am besten** ordnet ein großes Modell. Der Abstand zum mittelgroßen ist kleiner als der vom Browser zum Server.

## 5 Noch offen in Etappe 0b

| Was | Stand |
|---|---|
| Echte Wand | Offen. Es fehlt der Pfad zu einem Export von dir. Ausgewertet wird lokal |
| Android über die Fleet, iPhone, Safari in voller Reihe | Zurückgestellt. Sie betreffen nur noch die Reserve im Browser, und die wird nur mit WebGPU angeboten |
| Chromes eingebautes Modell (Prompt-API) | Nicht gemessen und nicht mehr nötig. Es bräuchte 22 GB freien Plattenplatz |
| `gemma4:e2b` im Browser | Nicht gemessen und nicht mehr nötig |
| Modelle bei Cloudflare | Gemessen, Abschnitt 7 |
| Modelle bei IONOS, Scaleway, OVHcloud, Mistral | Nicht gemessen. Nötig für „Eigener Schlüssel“, Etappe 4b |

## 6 Nachtrag: Ordnen auf einem Server

Auf einem Server gilt die Grenze des Browsers nicht: Das Modell kann alle 250 Zettel in einem Aufruf lesen. Das
habe ich lokal mit `gemma4:12b` nachgestellt, Kontextfenster 16.384 statt 4.096 Token.

| Ablauf | Aufrufe je Wand | ARI (Einarbeitung / Stadtteil) | Reinheit | Token je Wand, Eingabe / Ausgabe | Zeit je Wand, lokal |
|---|---|---|---|---|---|
| Wie im Browser: Themen aus Teilen zu 50, Zuordnen in Stapeln zu 15 | 23 | 0,72 (0,73 / 0,72) | 0,89 | 13.500 / 4.400 | 223 s |
| Themen aus allen Zetteln auf einmal, Stapel zu 15 | 19 | 0,80 (0,82 / 0,79) | 0,93 | 12.200 / 3.400 | 198 s |
| Themen aus allen Zetteln auf einmal, Stapel zu 50 | 7 | **0,80** (0,85 / 0,75) | 0,94 | 9.700 / 3.400 | 178 s |

- **Die Themen auf einmal zu bilden hilft.** Beide Wände liegen in beiden Läufen bei 0,75 oder darüber. Das Modell
  findet sechs Themen statt fünf, die sich fast mit denen des Korpus decken.
- **Größere Stapel schaden nicht** und sparen ein Viertel der Token und zwei Drittel der Aufrufe.
- **Damit liegt ein 7,6-GB-Modell nahe an der Obergrenze** aus Abschnitt 1 (0,84 und 0,93).

Einschränkungen:

- Ein Lauf je Zeile. Unterschiede unter etwa 0,1 sagen wenig. Dass alle vier Werte der neuen Abläufe über denen des
  alten liegen, ist ein Hinweis, kein Beweis.
- Gemessen ist ein lokales Modell mit 4-Bit-Gewichten. Die Modelle, die Anbieter betreiben, sind andere
  (`gemma-4-26b-a4b-it`, `gpt-oss-20b`, Mistral Small). Ihre Güte ist nicht gemessen.
- Die Zeiten sind lokal und unter Fremdlast. Bei einem Anbieter ist mit deutlich weniger zu rechnen, gemessen ist es
  nicht.
- `mistral-small3.2:24b` ist nur im ersten Ablauf gelaufen.

Was die Anbieter erlauben und kosten, steht in [ki-anbieter.md](ki-anbieter.md).

## 7 Bei Cloudflare gemessen

Mit deinem Okay vom 22.11.2026 über dein privates Cloudflare-Konto, im Gratis-Kontingent. Den Rechner verlassen
haben nur die erfundenen Zettel des Testkorpus. Ablauf wie die dritte Zeile in Abschnitt 6: Themen aus allen
Zetteln in einem Aufruf, Zuordnen in Stapeln zu 50, sieben Aufrufe je Wand. Einzelheiten und die gefundenen Themen:
[messung/sprachmodelle-cloudflare.md](messung/sprachmodelle-cloudflare.md).

| Modell bei Workers AI | ARI (Einarbeitung / Stadtteil) | Reinheit | Neuronen je Wand | Ordnungen am Tag gratis | Zeit je Wand, Stapel nebeneinander |
|---|---|---|---|---|---|
| **`gemma-4-26b-a4b-it`** | **0,83** (0,80 / 0,86) | 0,93 | 187 | 54 | 26 s |
| `gpt-oss-120b` | 0,80 (0,84 / 0,75) | 0,92 | 829 | 12 | 49 s |
| `mistral-small-3.1-24b-instruct` | 0,73 (0,81 / 0,64) | 0,88 | 451 | 22 | 31 s |
| `glm-4.7-flash` | 0,69 (0,75 / 0,64) | 0,88 | 157 | 64 | 131 s |
| `gpt-oss-20b` | 0,59 (0,74 / 0,43) | 0,82 | 259 | 39 | 13 s |

Zwei Zusatzläufe mit `gemma-4-26b-a4b-it`:

| Lauf | ARI (Einarbeitung / Stadtteil) | Reinheit | Neuronen | Zeit |
|---|---|---|---|---|
| Überschriften auf Deutsch, 250 Zettel | 0,85 (0,75 / 0,95) | 0,92 | 199 | 31 s |
| Kleine Wand: die ersten 30 Zettel, Überschriften auf Deutsch | 0,83 (0,71 / 0,94) | 0,93 | 39 | 20 s |

Was das heißt:

- **`gemma-4-26b-a4b-it` ist die Wahl.** Es ordnet am besten und ist das zweitbilligste. Das teurere `gpt-oss-120b`
  ist nicht besser, das billigere `glm-4.7-flash` ist schlechter und fünfmal langsamer.
- **Ersatz, falls das Modell wegfällt:** `mistral-small-3.1-24b-instruct` oder `gpt-oss-120b`. Beide kosten das
  Zweieinhalb- bis Viereinhalbfache an Neuronen.
- **Deutsche Überschriften kosten keine Güte.** Beispiele: „Nachbarschaftshilfe und Austausch“, „Mängel- und
  Schadensmeldung“, „Wissensmanagement und Dokumentation“.
- **Kleine Wände gehen genauso gut** und kosten 39 Neuronen. Aus beiden Punkten gerechnet braucht eine Wand mit
  60 Zetteln rund 60 Neuronen je Ordnen.
- **Kein einziger Zettel blieb ohne gültige Antwort**, außer einem bei `gpt-oss-20b`. Die Antwortform per
  JSON-Schema hat bei allen fünf Modellen getragen.
- **Die Schnittstelle meldet den Verbrauch in jeder Antwort** (`usage.neurons`). Ein eigener Zähler kann also genau
  buchen.

Einschränkungen:

- Ein Lauf je Zeile, zwei Wände. `gemma-4-26b-a4b-it` lag in sechs von sechs Wand-Läufen bei 0,71 oder darüber. Die
  Streuung von Lauf zu Lauf ist trotzdem nicht gemessen.
- Die Zeit „nebeneinander“ ist gerechnet: die zwei Aufrufe für die Themen nacheinander, dazu der längste Stapel.
  Gemessen sind die Aufrufe nacheinander (76 Sekunden bei `gemma-4-26b-a4b-it`).
- `qwen3-30b-a3b-fp8` stand am 22.11. noch in der Preisliste, die Schnittstelle meldete es aber als am 20.11.
  abgekündigt. Modelle fallen dort also kurzfristig weg.
- Verbraucht wurden 4.276 Neuronen, laut den Antworten der Schnittstelle. Ein abgebrochener Lauf mit wenigen
  Aufrufen fehlt in der Summe. Geschätzt hatte ich 4.000. In die Abrechnung habe ich nicht geschaut.
- Nicht gemessen: 500 Zettel in einem Aufruf, der schmutzige Satz (Einzelwörter, Tippfehler, Emoji), eine echte
  Wand, die Rechenzeit im Worker.
