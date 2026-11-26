# Messung Etappe 4a: „Ordnen“ mit dem Code des Produkts

Gemessen am 23.11.2026 mit dem Modell `@cf/google/gemma-4-26b-a4b-it` bei Cloudflare Workers AI. Rohdaten:
[`messung/roh/ordnen-4a.json`](messung/roh/ordnen-4a.json).

**Ergebnis:** Das Rezept, das in Etappe 0b gemessen wurde, war im Produkt zu langsam und schwankte. Nach drei
Änderungen hält das Produkt beide Abnahmewerte, auch gegen die veröffentlichte Vorschau (Abschnitt 7): ARI 0,81
bis 0,91 auf den Testwänden und 10 bis 22 Sekunden für 250 Zettel. Ein Lauf kostet 128 bis 165 Neuronen statt rund
200.

**Zwei Befunde nebenbei** (Abschnitte 8 und 9): Ein Lauf braucht im Worker 8 bis 24 Millisekunden Rechenzeit, der
Gratis-Tarif nennt 10. Und Cloudflares Gratis-Kontingent läuft über 24 Stunden, nicht bis Mitternacht.

## 1 Aufbau

- **Code:** `packages/arrange`, so wie ihn der Worker benutzt: Prompts, Prüfung jeder Antwort, Ablauf mit
  Wiederholung.
- **Schnittstelle:** `/ai/run/<Modell>`, dieselbe, die die Bindung `AI` des Workers erreicht. Sie nimmt die Anfrage
  des Produkts unverändert an und nennt den Verbrauch in jeder Antwort (`usage.neurons`).
- **Weg:** vom Entwicklungsrechner mit der Anmeldung von wrangler. Der Worker war nicht dazwischen. Die Messung
  gegen die veröffentlichte Vorschau steht in Abschnitt 7.
- **Wände:** die zwei Testwände aus `messung/korpus.json`, je 250 erfundene Zettel in fünf Themen, halb deutsch,
  halb englisch. Gemischt wie in `scripts/measure-arrange.mjs`; „Reihenfolge 1 bis 3“ sind drei Mischungen.
- **Kennzahlen:** ARI gegen die Themen des Korpus (1 ist gleich, 0 ist Zufall). „Richtig“ ist der Anteil der Zettel,
  die beim Mehrheitsthema ihrer Gruppe liegen. Ein Zettel ohne Gruppe zählt als eigene Gruppe.

## 2 Das Rezept aus Etappe 0b

Ein Aufruf findet 3 bis 6 Themen, ein zweiter führt sie zu 4 bis 8 zusammen, dann ordnen Stapel zu 50 Zetteln
nebeneinander zu. Die Antwort nennt je Zettel den Titel des Themas.

| Wand | Reihenfolge | ARI | Richtig | Sekunden | Neuronen |
|---|---|---|---|---|---|
| Einarbeitung | 1 | 0,93 | 97 % | 24 | 205 |
| Einarbeitung | 1, wiederholt | 0,71 | 84 % | 33 | 202 |
| Einarbeitung | 2 | 0,68 | 86 % | 67 | 200 |
| Einarbeitung | 3 | 0,75 | 86 % | 50 | 197 |
| Einarbeitung, englische Titel | 1 | 0,86 | 93 % | 46 | 180 |
| Stadtteil | 1 | 0,80 | 92 % | 23 | 192 |
| Stadtteil | 2 | 0,88 | 95 % | 89 | 193 |
| Stadtteil | 3 | 0,69 | 79 % | 64 | 193 |

- **Zu langsam:** Fünf von acht Läufen brauchten mehr als die 45 Sekunden der Abnahme.
- **Schwankend:** Dieselben Zettel in derselben Reihenfolge gaben einmal 0,93 und einmal 0,71. Das Modell
  antwortet trotz Temperatur 0 und festem Startwert nicht jedes Mal gleich. Zwei Läufe lagen knapp unter 0,7.
- **Kein Zettel blieb ohne Gruppe,** kein Aufruf lieferte Unlesbares. Im Lauf mit 89 Sekunden blieben zwei Aufrufe
  60 Sekunden ohne Antwort und wurden wiederholt.

## 3 Wo die Zeit bleibt

- **Geschriebene Token.** Eine Zuordnung mit Titeln schreibt rund 690 Token je Stapel und braucht 14 bis 27
  Sekunden. Das Modell schreibt 40 bis 70 Token je Sekunde.
- **Einzelne Hänger.** Etwa jeder sechste Aufruf brauchte 30 bis 60 Sekunden, während seine Nachbarn nach 10 bis 15
  fertig waren. Ein Lauf ist so langsam wie sein langsamster Aufruf.
- **Der zweite Themen-Aufruf.** Er kostet 4 bis 7 Sekunden und rund 10 Neuronen.

Dazu drei Versuche, jeweils mit denselben Zetteln:

| Wand, Reihenfolge | Titel, zusammengeführt | Buchstabe, zusammengeführt | Buchstabe, ohne Zusammenführen | Buchstabe auf einer Zeile, ohne Zusammenführen |
|---|---|---|---|---|
| Einarbeitung 2 | 0,86 | 0,88 | 0,90 | – |
| Einarbeitung 1 | – | 0,88 | 0,89 | 0,89 |
| Stadtteil 1 | – | 0,80 | 0,87 | 0,84 |
| Stadtteil 3 | – | 0,79 | 0,95 | 0,94 |

- **Der zweite Themen-Aufruf schadet.** Er findet keine anderen Themen, er formuliert die Titel breiter. Mit den
  Themen des ersten Aufrufs ist die Zuordnung auf allen vier Wänden besser.
- **Ein Buchstabe statt des Titels ist gleich gut.** Auf denselben Themen stimmen beide Formen bei 95 % der Zettel
  überein. Die Antwort hat 445 statt 690 Token je Stapel.
- **Auf einer Zeile geschrieben** hat die Antwort 243 Token und kommt nach 5 bis 10 Sekunden. Die Güte bleibt.
- **Gleich 4 bis 8 Themen verlangen** hilft nicht: Das gab sieben Themen und ARI 0,67.

## 4 Das Rezept, wie es gebaut ist

Ein Aufruf findet 3 bis 6 Themen. Dann ordnen Stapel zu 50 Zetteln nebeneinander zu, je Zettel ein Buchstabe, die
Antwort auf einer Zeile. Bleibt ein Aufruf aus, geht dieselbe Anfrage ein zweites Mal hinaus: bei den Themen nach
15 Sekunden, bei der Zuordnung nach 12. Die erste lesbare Antwort zählt. Ein Aufruf gilt nach 30 Sekunden als
gescheitert.

| Wand | Reihenfolge | ARI | Richtig | Sekunden | Neuronen | Aufrufe, davon zweite |
|---|---|---|---|---|---|---|
| Einarbeitung | 1 | 0,94 | 98 % | 16 | 129 | 6, 0 |
| Einarbeitung | 2 | 0,84 | 92 % | 17 | 130 | 6, 0 |
| Einarbeitung, englische Titel | 1 | 0,82 | 91 % | 12 | 126 | 6, 0 |
| Stadtteil | 1 | 0,77 | 90 % | 28 | 179 | 7, 1 |
| Stadtteil | 3 | 0,95 | 98 % | 23 | 178 | 9, 3 |

- Im Lauf mit 28 Sekunden hing der Themen-Aufruf 20 Sekunden. Im Lauf mit 23 Sekunden waren drei Zuordnungen
  langsam.
- Ein zweiter Aufruf kostet Neuronen. Das Produkt rechnet ihn mit dem Verbrauch des Aufrufs an, der ihn überholt
  hat, weil es auf seine Antwort nicht wartet. Ob Cloudflare einen überholten Aufruf voll berechnet, ist nicht
  geprüft.
- Die Schätzung vor dem Lauf (20 Neuronen und eines je Zettel, hier 270) liegt über allen gemessenen Läufen.

## 5 Kleine Wände, schmutzige Zettel, 500 Zettel

Mit dem gebauten Rezept, in Klammern das Rezept aus Etappe 0b.

| Was | Zettel | Gruppen | ARI | Richtig | Sekunden | Neuronen |
|---|---|---|---|---|---|---|
| Kleine Wand | 8 | 2 | 0,40 (0,40) | 63 % | 5 (11) | 9 (16) |
| Kleine Wand | 12 | 4 | 0,75 (0,66) | 83 % | 4 (16) | 13 (24) |
| Kleine Wand | 15 | 4 | 0,68 (0,45) | 80 % | 7 (15) | 16 (26) |
| Nur schmutzige Zettel | 30 | 5 | 1,00 (1,00) | 100 % | 11 (22) | 19 (36) |
| Einarbeitung mit schmutzigen Zetteln | 280 | 5 | 0,67 (0,72) | 79 % | 15 (38) | 143 (221) |
| Beide Wände zusammen | 500 | 5 | 0,32 (0,34) | 47 % | 11 (50) | 252 (386) |

- **Kleine Wände:** Die Gruppen sind brauchbar, der ARI sagt hier wenig. Acht Zettel aus fünf Themen des Korpus
  lassen sich nicht in fünf Gruppen legen. Das Produkt verlangt für kleine Wände weniger Themen (bei 8 Zetteln 2,
  bei 12 bis zu 4).
- **Schmutzige Zettel** (Einzelwörter, Tippfehler, Emoji) werden so gut einsortiert wie die übrigen: allein ARI
  1,0, gemischt 0,67 für die schmutzigen und 0,67 für alle. Der gemischte Lauf liegt knapp unter 0,7, weil das
  Modell dort zwei Themen des Korpus zu einem zusammenzog.
- **500 Zettel** gehen in einem Aufruf durch, ohne Fehler. Der ARI ist nicht vergleichbar: Die Wand mischt zwei
  Wände mit zehn Themen unter einer Frage, und das Produkt bildet höchstens sechs Themen. Eine der fünf Gruppen
  hat 222 Zettel.

## 6 Was nicht gemessen ist

- **Eine echte Wand.** Der Korpus ist erfunden. Ein Export einer echten Wand liegt nicht vor.
- **Mehr als sechs Themen.** Ob eine Wand mit acht echten Themen gut geordnet wird, zeigt der Korpus nicht.
- **Wie oft ein Lauf unter 0,7 fällt.** Fünf Läufe mit dem gebauten Rezept auf den sauberen Wänden lagen bei 0,77
  bis 0,95, der Lauf mit schmutzigen Zetteln bei 0,67. Für eine Verteilung sind das zu wenige.
- **Die Modelle für „Eigener Schlüssel“.** Das gehört zu Etappe 4b.
- **Die Ersatzmodelle** mit dem gebauten Rezept.

## 7 Gegen die Vorschau

Mit `scripts/measure-arrange.mjs` gegen den veröffentlichten Worker (Stand `abe081c`): Das Skript legt eine Wand an,
schreibt die Zettel über den Socket, ruft die Route `/arrange` und löscht die Wand. Rohdaten:
[`messung/roh/ordnen-4a-vorschau.json`](messung/roh/ordnen-4a-vorschau.json).

| Wand | Zettel | ARI | Richtig | Sekunden | Neuronen | Aufrufe |
|---|---|---|---|---|---|---|
| Einarbeitung, Lauf 1 | 250 | 0,81 | 92 % | 15 | 132 | 6 |
| Einarbeitung, Lauf 2 | 250 | 0,87 | 96 % | 22 | 165 | 8 |
| Stadtteil, Lauf 1 | 250 | 0,89 | 95 % | 22 | 132 | 6 |
| Stadtteil, Lauf 2 | 250 | 0,91 | 96 % | 11 | 132 | 6 |
| Stadtteil, englische Titel | 250 | 0,91 | 96 % | 10 | 128 | 6 |
| Stadtteil mit schmutzigen Zetteln | 280 | 0,82 | 93 % | 12 | 140 | 7 |
| Einarbeitung, kleine Wand | 12 | 0,59 | 75 % | 5 | 13 | 2 |
| Beide Wände zusammen | 500 | 0,34 | 51 % | 17 | 253 | 11 |

- **Die Abnahme der Etappe hält:** ARI mindestens 0,7 auf beiden Testwänden, 250 Zettel in höchstens 45 Sekunden.
- Die schmutzigen Zettel allein kamen im gemischten Lauf auf ARI 0,84.
- Die Antworten kamen vom Modell, nicht vom Ersatz für lokale Läufe: Die Route nennt das Modell in jeder Antwort.
- **Das Durable Object wartet nicht mit.** In den zehn Minuten der Messung waren alle Wände zusammen 4,4 Sekunden
  wach, bei neun Läufen mit zusammen rund zwei Minuten Wartezeit auf die KI. Der Zähler schrieb 24 Zeilen.
- **Im Browser:** Ein Durchgang mit einem echten Browser (Chromium, 1440 Pixel) gegen die Vorschau, mit 14
  Zetteln: Der Vorschlag der KI stand nach 7 Sekunden als Vorschau mit drei Gruppen, „Anwenden“ ordnete die Wand,
  „Rückgängig“ nahm es zurück, ohne Fehler in der Konsole. Ein erster Versuch war an Abschnitt 9 gescheitert, am
  aufgebrauchten Kontingent. Die App meldete das mit dem Satz für eine ausgebliebene Antwort.

## 8 Rechenzeit des Workers

Aus Cloudflares Zahlen für die Anfragen der Messung (`workersInvocationsAdaptive`):

| Anfrage | Rechenzeit |
|---|---|
| Eine Wand anlegen | rund 5 ms |
| „Ordnen“, 250 bis 280 Zettel | 8 bis 13 ms, einmal 24 ms |
| „Ordnen“, 500 Zettel | 17,5 ms |

- Der Gratis-Tarif nennt 10 ms je Anfrage. Cloudflare schreibt dazu, es gebe Spielraum für Anfragen, die die Grenze
  selten überschreiten, und beendet einen Worker, der sie „beständig“ erreicht (Seite „Limits“, Stand 19.11.2026).
  Zahlen dazu nennt Cloudflare nicht.
- **Keine der 45 Anfragen ist gescheitert.** Ob das unter Last so bleibt, ist nicht gemessen.
- Das Warten auf die KI zählt nicht mit.

### Woher die Rechenzeit kommt

Du hast am 23.11.2026 entschieden, die Ursache zu suchen (PLAN.md 7.2, Nr. 17). Dazu liefen einzelne Anfragen an
die Vorschau, zeitlich getrennt, sodass Cloudflares Zahlen je Anfrage lesbar sind.

| Anfrage | Rechenzeit |
|---|---|
| „Ordnen“ mit 12 Zetteln, erste Anfrage nach einer Pause | 12,3 ms |
| dieselbe Anfrage, fünfmal direkt danach auf derselben Verbindung | 4,0 bis 5,7 ms |
| „Ordnen“ mit 250 und mit 500 Zetteln, je nach einer Pause | 16,7 und 13,4 ms |
| Abgelehnt, weil die Wand ihre Läufe verbraucht hat (keine KI), direkt danach | 2,2 ms |
| dieselbe Ablehnung nach einer Pause, auf neuer Verbindung | 6,1 und 12,0 ms |
| Abgelehnt, weil die Wand zu wenige Zettel hat (keine KI), nach einer Pause | 2,4 und 4,9 ms |

- **Es liegt nicht an der KI und nicht an der Größe der Wand.** Eine Anfrage, die die KI gar nicht ruft, kostet
  nach einer Pause genauso 12 ms. Dieselbe Anfrage kostet 2 bis 6 ms, wenn kurz vorher schon eine da war.
- **Teuer ist der Start eines frischen Workers.** Nach einer Pause landet eine Anfrage oft auf einer Maschine, auf
  der der Worker noch nicht läuft. Er wird dann geladen, und Cloudflare rechnet das der Anfrage an. Beim
  Veröffentlichen meldet Cloudflare für diesen Worker 10 ms Startzeit.
- **Den Start macht die Prüf-Bibliothek zod teuer.** Auf dem Entwicklungsrechner gemessen, je dreimal: zod in der
  üblichen Bauform lädt in 9 bis 10 ms, die Schemas des Protokolls dazu in 2 bis 3 ms, Hono in 1 ms. Dieselben
  Schemas mit der sparsamen Bauform `zod/mini` laden zusammen in 2,2 bis 2,9 ms, und der Code schrumpft von 454 KB
  auf 26 KB (verkleinert, ohne die eigenen Schemas des Produkts).
- **Was daraus folgte:** Das Protokoll steht seit dem 23.11.2026 auf `zod/mini`. Der eigene Code des Ordnens
  kostet für 250 Zettel 0,8 ms warm und 2,7 ms kalt, daran liegt es nicht.

### Nach dem Umbau auf `zod/mini`

| Was | Vorher | Nachher |
|---|---|---|
| Startzeit des Workers, wie Cloudflare sie beim Veröffentlichen meldet | 12 ms | 5 ms |
| Größe des Workers | 340 KiB | 217 KiB |
| JavaScript der App beim Start, gzip | 177 KB | 160 KB |
| Geteiltes Paket laden, auf dem Entwicklungsrechner | 13 bis 16 ms | 4 bis 5 ms |

Die Anfragen selbst, wieder einzeln und je nach einer Pause von 75 Sekunden, je ein Lauf:

| Anfrage | Vorher | Nachher |
|---|---|---|
| Abgelehnt, zu wenige Zettel (keine KI) | 2,4 ms | 3,3 ms |
| „Ordnen“ mit 12 Zetteln | 12,3 ms | 10,4 ms |
| „Ordnen“ mit 250 Zetteln | 16,7 ms | 23,9 ms |
| „Ordnen“ mit 500 Zetteln | 13,4 ms | 23,2 ms |

- **Das Ziel ist nicht erreicht.** Die Startzeit ist gefallen, aber eine „Ordnen“-Anfrage nach einer Pause kostet
  weiter 10 bis 24 ms. Der Start erklärt die Rechenzeit also höchstens zum Teil.
- **Die Werte streuen stark.** Dieselbe Art Anfrage lag über alle Messungen zwischen 8 und 24 ms. Ein Lauf je Zeile
  reicht nicht, um vorher und nachher zu vergleichen.
- **Ein Profil des Workers auf dem Entwicklungsrechner** (workerd, erste Anfrage für 250 Zettel, mit dem Ersatz statt
  der KI): Der eigene Code für Prompts, Prüfung und Ablauf braucht zusammen unter 2 ms. Einzeln fallen auf: die
  erste Prüfsumme (SHA-256) mit 1,4 ms und der erste Treffer im Router mit 1,3 ms.
- **Was offen bleibt:** Lokal lässt sich Cloudflares Anbindung an die KI nicht messen, dort antwortet der Ersatz.
  Übrig sind zwei Erklärungen: die Anbindung selbst, oder viele kleine Erstkosten auf einem frischen Worker, die
  auf Cloudflares Rechnern länger dauern als hier. Trennen lässt sich das mit einem Versuch auf der Vorschau, bei
  dem der Ersatz statt der KI antwortet, und mit mehr Läufen je Anfrage.
- **Die weiteren Versuche stehen aus:** Die Messungen dieses Tages haben das Tagesbudget der Vorschau von 25 Wänden
  aufgebraucht. Neue Wände gibt es dort erst wieder ab 00:00 UTC.

### Messreihe in der Nacht zum 24.11.2026

18 einzelne Anfragen gegen die Vorschau (Stand mit `zod/mini`), jede nach 80 Sekunden Pause auf neuer Verbindung:

| Anfrage | Anzahl | Rechenzeit, sortiert | Median | über 10 ms |
|---|---|---|---|---|
| „Ordnen“ mit 12 Zetteln, mit der KI | 12 | 5,7 · 7,1 · 7,4 · 7,9 · 8,1 · 8,3 · 9,4 · 11,3 · 12,1 · 12,3 · 12,4 · 15,6 ms | 8,8 ms | 5 von 12 |
| Abgelehnt, weil die Wand ihre Läufe verbraucht hat (keine KI) | 6 | 1,9 · 3,0 · 4,2 · 4,8 · 6,2 · 7,1 ms | 4,5 ms | 0 von 6 |

- **Keine Anfrage ist gescheitert.** Cloudflare hat keine abgebrochen.
- **Der Weg ohne KI bleibt jetzt unter 10 ms.** Vor dem Umbau kostete eine solche Ablehnung nach einer Pause bis zu
  12 ms.
- **Ein Lauf mit der KI kostet im Median gut 4 ms mehr** und liegt in fünf von zwölf Fällen über 10 ms. Der eigene
  Code dafür braucht unter 2 ms (Profil oben). Der Rest entfällt auf den Aufruf über Cloudflares Anbindung an die
  KI und auf das Lesen ihrer Antworten; das lässt sich vom Produkt aus nicht weiter drücken, ohne die Anbindung zu
  umgehen.
- **Einschätzung:** Cloudflare duldet seltene Überschreitungen. Ein Lauf ist eine seltene Anfrage (höchstens sechs je
  Wand in 24 Stunden). Die Fehlerzahl gehört bei jeder Messung angesehen.

## 9 Das Kontingent läuft über 24 Stunden

Nach rund 6.400 Neuronen an diesem Tag lehnte Cloudflare jeden weiteren Aufruf ab: „you have used up your daily free
allocation of 10,000 neurons“ (Fehler 4006). Cloudflares eigene Zählung (`aiInferenceAdaptiveGroups`):

| Stunde (UTC) | Aufrufe | Neuronen |
|---|---|---|
| 22.11., 13 Uhr | 115 | 4.339 |
| 23.11., 9 Uhr | 175 | 4.159 |
| 23.11., 10 Uhr | 60 | 1.192 |
| 23.11., 11 Uhr | 54 | 1.039 |

- Am 23.11. allein waren es 6.390. Mit den 4.339 vom Vortag sind es 10.729 in 24 Stunden.
- Das passt zu einem Fenster von 24 Stunden und nicht zu einem Zurücksetzen um 00:00 UTC, wie Cloudflare es
  beschreibt. **Bestätigt:** Ein Test rief das Modell alle zehn Minuten. Bis 13:26 UTC lehnte Cloudflare ab, um
  13:36 UTC ging der Aufruf wieder: 24 Stunden nach dem Verbrauch vom Vortag, der in der Stunde ab 13 Uhr UTC lag.
- Die Zahlen, die der Dienst je Antwort nennt (`usage.neurons`), stimmen mit Cloudflares Zählung überein: Die Summe
  dieser Messung und Cloudflares 6.390 liegen beieinander.
- **Was das für das Produkt heißt:** Sein eigener Zähler setzt um 00:00 UTC zurück und nennt diese Uhrzeit. Läuft
  Cloudflares Fenster über 24 Stunden, kann das Produkt nach Mitternacht Läufe durchlassen, die Cloudflare
  ablehnt. Die App sagt dann „keine brauchbare Antwort“ statt „Kontingent aufgebraucht“. Kosten entstehen im
  Gratis-Tarif nicht.

## 10 Verbrauch

Alle Messungen dieses Berichts zusammen: rund 6.400 Neuronen nach Cloudflares Zählung.
