# Etappe 0: Messbericht

Stand: 22.11.2026 · Prototyp: `proto/e0-messung/` (Wegwerf, nicht im Produkt) · Plan: [PLAN.md](../PLAN.md) · Fortsetzung: [messung-0b.md](messung-0b.md)

## Ergebnis in Kürze

1. **Die Qualitätsschwelle reißen alle vier Kandidaten.** Geplant war ARI ≥ 0,5 gegen die Themen des Korpus. Die
   drei kleinen Modelle erreichen 0,06 bis 0,22, EmbeddingGemma 2 rund 0,3. Eine unabhängige Rechnung in Python
   bestätigt die Zahlen und schließt einen Fehler der Messseite aus.
2. **Auch größere Modelle reichen nicht.** 13 weitere Modellfassungen bis 614 MB bleiben auf allen 500 Zetteln
   unter 0,4. Am besten ist `voyage-4-nano` (243 MB) mit 0,35 auf allen 500 Zetteln und 0,45 auf einer einzelnen
   Wand.
3. **Das Verfahren aus dem Plan taugt nicht.** Average Linkage mit Silhouette-Schnitt bildet eine Riesengruppe oder
   zerfällt in über hundert Gruppen. Besser sind k-Means und Community-Erkennung auf dem Nachbarschaftsgraphen.
4. **Die Technik trägt.** Modelle laufen in Chrome und Safari mit Threads und WebGPU. Das Hosting in Teilen unter
   25 MiB funktioniert. Gzip-Teile und ein gekürztes Vokabular drücken den Download der Erstwahl von 150 auf 36 MB.
5. **Nicht gemessen:** Android, iPhone und die volle Safari-Reihe (Abschnitt 6).

Laut Plan (4.4) kommt die Entscheidung damit zu dir zurück. Die Wege stehen in Abschnitt 5.

## 1 Aufbau

- **Messseite:** statische Seite mit einem Web Worker je Konfiguration, transformers.js 4.3.2 mit onnxruntime-web
  1.31.0-dev, alles von `localhost`, kein fremder Host. COOP und COEP sind gesetzt, der HTTP-Cache ist aus.
- **Gerät:** Mac mit Apple M4 Pro, 14 Kerne, 48 GB, macOS 27.0.1. Chrome 157, Safari 27.0.1. Das ist ein schneller
  Rechner. Ein durchschnittlicher Laptop ist langsamer.
- **Korpus:** 500 Zettel, zwei Wände („Einarbeitung“, „Stadtteil-App“) mit je fünf Themen zu 50 Zetteln, halb
  deutsch, halb englisch, 3 bis 25 Wörter, 50 markierte deutsch-englische Paare. Dazu 30 Dubletten, 30
  Beinahe-Dubletten und 60 „schmutzige“ Zettel. Von einem Hilfsagenten von Hand geschrieben, Stichprobe von mir
  gelesen. Datei: [messung/korpus.json](messung/korpus.json).
- **Läufe:** Median aus fünf Läufen, bei den langsamen Modellen aus drei. Stapelgröße 16.
- **Qualität:** aus den gespeicherten Vektoren, einmal in Node (meine Auswertung), einmal unabhängig in Python
  mit onnxruntime ([messung/qualitaet-python.md](messung/qualitaet-python.md)).

## 2 Messwerte

### M1 Download

| Kandidat | Modell | Tokenizer | Laufzeit | Summe roh | Summe als gzip-Teile | bei 20 Mbit/s |
|---|---|---|---|---|---|---|
| MiniLM q8 | 118,3 MB | 17,1 MB | 14,3 MB | 149,7 MB | **78,2 MB** | 31 s |
| MiniLM q8, Vokabular Deutsch und Englisch | 45,8 MB | 4,2 MB | 14,3 MB | 64,3 MB | **36,0 MB** | 14 s |
| MiniLM q8, Vokabular lateinische Schrift | 66,4 MB | 7,8 MB | 14,3 MB | 88,5 MB | 48,5 MB | 19 s |
| granite-97m q8 | 97,9 MB | 25,3 MB | 14,3 MB | 137,5 MB | 72,6 MB | 29 s |
| e5-small q8 | 118,3 MB | 17,1 MB | 14,3 MB | 149,7 MB | 85,8 MB | 34 s |
| EmbeddingGemma 2 q4 (Textteil, WebGPU) | 174,5 MB | 32,2 MB | 26,9 MB | 233,6 MB | 160 MB | 64 s |
| voyage-4-nano q4 (WebGPU) | 243,3 MB | 9,1 MB | 26,9 MB | 279,3 MB | 218 MB | 87 s |

Dazu kommt transformers.js selbst mit 0,6 MB (0,2 MB gepackt). Die Laufzeit für WebGPU ist die größere
WASM-Datei (26,9 MB, über der Dateigrenze von 25 MiB), für reines WASM reicht die kleine (14,3 MB). Die Zeit bei
20 Mbit/s ist gerechnet, nicht gemessen.

### M2 und M3 Kaltstart und Warmstart (Chrome, lokal, ohne Netz)

Kaltstart heißt hier: leerer Cache, Dateien von `localhost`, bis das Modell bereit ist. Die Übertragung aus M1
kommt im echten Betrieb dazu.

| Konfiguration | Kaltstart | erste Einbettung | Warmstart |
|---|---|---|---|
| MiniLM q8, WASM | 559 ms | 26 ms | 383 ms |
| MiniLM q8 gekürzt (de/en), WASM | 222 ms | 5 ms | 132 ms |
| MiniLM q8 aus gzip-Teilen | 1.069 ms | 6 ms | 328 ms |
| MiniLM fp16, WebGPU | 1.219 ms | 110 ms | 760 ms |
| granite-97m q8, WASM | 840 ms | 28 ms | 423 ms |
| e5-small q8, WASM | 521 ms | 10 ms | 374 ms |
| EmbeddingGemma 2 q4, WASM / WebGPU | 828 / 1.107 ms | 75 / 65 ms | 442 / 778 ms |
| voyage-4-nano q4, WASM / WebGPU | 798 / 1.002 ms | 108 / 240 ms | 240 / 524 ms |

Das Zusammensetzen aus Teilen samt Entpacken und Prüfsumme kostet für 150 MB rund 0,7 s.

### M4 Einbetten (Chrome)

| Konfiguration | 50 Zettel | 200 Zettel | 500 Zettel |
|---|---|---|---|
| MiniLM q8, WASM, 1 Thread | 1,3 s | 5,2 s | 12,5 s |
| MiniLM q8, WASM, 4 Threads | 0,36 s | 1,40 s | 3,39 s |
| MiniLM q8, 4 Threads, nach Länge gestapelt | 0,23 s | 0,92 s | **2,21 s** |
| MiniLM q8 gekürzt (de/en), 4 Threads | 0,36 s | 1,39 s | 3,38 s |
| MiniLM fp16, WebGPU | 0,05 s | 0,17 s | **0,40 s** |
| granite-97m q8, 4 Threads (1 Thread) | 0,44 s | 1,70 s | 4,12 s (15,6 s) |
| e5-small q8, 4 Threads (1 Thread) | 0,39 s | 1,54 s | 3,73 s (14,2 s) |
| EmbeddingGemma 2 q4, WASM 4 Threads | 2,6 s | 10,0 s | 24,7 s |
| EmbeddingGemma 2 q4, WebGPU | 0,26 s | 0,97 s | 2,39 s |
| voyage-4-nano q4, WASM 4 Threads | 3,3 s | 12,4 s | 29,9 s |
| voyage-4-nano q4, WebGPU | 0,37 s | 1,39 s | 3,34 s |

- Stapeln nach Länge spart 35 %. Die Stapelgröße (4, 16, 32) ändert nichts.
- Das gekürzte Vokabular ändert die Rechenzeit nicht, nur Download, Laden und Speicher.
- Die zwei größeren Modelle brauchen WebGPU. Mit WASM sind sie schon auf diesem Rechner zehnmal langsamer.

**Safari:** Die volle Reihe fehlt (Abschnitt 6). Der Probelauf mit 60 kurzen Zetteln lief für alle 13
Konfigurationen durch, mit Threads, WebGPU und Teilen. Richtwerte für 50 Zettel, Safari gegen Chrome: MiniLM WASM
161 gegen 143 ms, MiniLM WebGPU 67 gegen 38 ms, EmbeddingGemma 2 WebGPU 313 gegen 141 ms. Safari meldet 8 statt
14 Kerne.

### M5 Clustern (Chrome, im Worker)

Gemessen für das Verfahren aus dem Plan (Abstände, Average Linkage, Silhouette-Suche):

| Vektorlänge | 50 Zettel | 200 Zettel | 500 Zettel |
|---|---|---|---|
| 384 (MiniLM, granite, e5) | 0,5 ms | 6,5 ms | 46 ms |
| 768 (EmbeddingGemma 2) | 0,9 ms | 11,5 ms | 77 ms |
| 1024 (voyage-4-nano) | 1,8 ms | 28,5 ms | 182 ms |

Das Verfahren ist verworfen (Abschnitt 3). k-Means und Louvain habe ich nur in Node gerechnet, nicht im Browser
gestoppt. Die Größenordnung ist dieselbe, weil die Abstandsmatrix den Aufwand bestimmt.

### M6 Überschriften (200 Zettel)

c-TF-IDF selbst kostet unter 2 ms. Das Einbetten der Kandidaten bestimmt die Zeit: 24 ms für 16 Kandidaten bis
0,7 s für 376 Kandidaten (MiniLM, WASM). Die Qualität ist schwach: Die gewählten Überschriften sind Bruchstücke
einzelner Zettel („laptop arrived without“, „drei monaten“, „cash only“), keine Themennamen.

### M7 Speicher (Chrome, nach 500 Zetteln, von außen mit `vmmap` gemessen)

| Konfiguration | Seiten-Prozess, Stand / Spitze | GPU-Prozess, Stand / Spitze |
|---|---|---|
| MiniLM q8, WASM | 773 / 846 MB | Grundlast |
| MiniLM q8 gekürzt (de/en), WASM | **369 / 439 MB** | Grundlast |
| granite-97m q8, WASM | 664 / 725 MB | Grundlast |
| e5-small q8, WASM | 768 / 862 MB | Grundlast |
| MiniLM fp16, WebGPU | 1,6 / 1,9 GB | 555 / 927 MB |
| EmbeddingGemma 2 q4, WASM | 508 / 742 MB | Grundlast |
| EmbeddingGemma 2 q4, WebGPU | 623 / 802 MB | 674 / 912 MB |
| voyage-4-nano q4, WASM | 869 MB / 1,0 GB | Grundlast |
| voyage-4-nano q4, WebGPU | 1,0 / 1,1 GB | 612 / 848 MB |

Die Grundlast des GPU-Prozesses liegt bei 55 bis 60 MB. Ein 118-MB-Modell belegt also rund 0,8 GB. Das gekürzte
Vokabular halbiert das. Die Browser-eigene Messung (`measureUserAgentSpecificMemory`) lief fast immer in die
Zeitüberschreitung und ist nicht verwendet.

### M9 Abweichungen

- MiniLM q8 gegen fp32 im Browser: Kosinus im Mittel 0,994, kleinster Wert 0,945.
- MiniLM fp16 auf WebGPU gegen fp32 auf WASM: 1,000. EmbeddingGemma 2 q4: WASM und WebGPU identisch.
- Browser gegen Python (MiniLM fp32): 1,000000. Die Messseite rechnet richtig.
- granite-97m q8 weicht im Browser stärker von fp32 ab als in nativer Rechnung (0,960 gegen 0,997) und verliert
  dadurch Qualität (nächster Nachbar 0,51 gegen 0,57).
- Das gekürzte Vokabular liefert für alle 680 Texte des Korpus bit-gleiche Vektoren
  ([messung/vokabular.md](messung/vokabular.md)).

## 3 Qualität (M8)

Kennzahlen: **ARI** misst die Übereinstimmung mit den zehn Themen (1 = gleich, 0 = Zufall). **Reinheit** ist der
Anteil der Zettel, die in einer Gruppe liegen, in der ihr Thema die Mehrheit hat. **Nächster Nachbar** ist der
Anteil der Zettel, deren ähnlichster Zettel dasselbe Thema hat.

### 3.1 Modelle

„Je Wand“ ist der Mittelwert der beiden Wände (250 Zettel, 5 Themen), also der Fall einer echten Sitzung. k-Means
mit der wahren Gruppenzahl, Vektoren je Sprache zentriert. Zahlen aus der Python-Gegenprobe.

| Modell | Download (gzip) | nächster Nachbar, alle 500 | ARI alle 500 | ARI je Wand | Reinheit je Wand |
|---|---|---|---|---|---|
| MiniLM q8 | 78 MB | 0,52 | 0,19 | 0,20 | 0,51 |
| granite-97m q8 | 73 MB | 0,57 | 0,22 | 0,21 | 0,51 |
| e5-small q8 | 86 MB | 0,55 | 0,12 | 0,13 | 0,44 |
| EmbeddingGemma 2 q4 | 160 MB | 0,65 | 0,29 | 0,34 | 0,64 |
| **voyage-4-nano q4** | 218 MB | 0,65 | **0,35** | **0,45** | **0,71** |
| gte-multilingual-base q8 (340 MB roh) | – | 0,61 | 0,30 | 0,30 | 0,58 |
| granite-311m q8 (313 MB roh) | – | 0,63 | 0,27 | 0,31 | 0,59 |
| bge-m3 q8 (570 MB roh) | – | 0,63 | 0,22 | 0,22 | 0,53 |

Weitere sieben Modelle stehen in der Gegenprobe. Keines ist besser als voyage-4-nano.

### 3.2 Bezugspunkte

| Bezugspunkt | Wert |
|---|---|
| Nur Wörter zählen (TF-IDF), ARI | 0,00 bis 0,01 |
| Obergrenze: Zuordnung zu den wahren Gruppenschwerpunkten, ARI | voyage 0,58 · Gemma 0,50 · MiniLM 0,34 |
| voyage-4-nano mit allen Kniffen (Sprach-Zentrierung, Frage angehängt, PCA, Glättung), ARI | 0,48 bis 0,50 |

Der letzte Wert ist geschönt, weil die Kniffe auf demselben Korpus ausgesucht wurden.

### 3.3 Verfahren

Je Wand, aus meiner Auswertung. MiniLM roh, die beiden anderen je Sprache zentriert:

| Verfahren | MiniLM | EmbeddingGemma 2 | voyage-4-nano |
|---|---|---|---|
| Average Linkage, wahre Gruppenzahl, ARI | 0,00 bis 0,01 | 0,00 | 0,00 |
| k-Means, wahre Gruppenzahl, ARI | 0,12 bis 0,28 | 0,31 bis 0,33 | 0,36 bis 0,52 |
| Louvain auf 15 Nachbarn, Auflösung 1: Gruppen | 6 | 5 bis 6 | 6 |
| … ARI | 0,13 bis 0,26 | 0,29 bis 0,39 | 0,45 bis 0,46 |
| … Reinheit | 0,46 bis 0,56 | 0,58 bis 0,70 | 0,71 bis 0,73 |
| … markierte deutsch-englische Paare in derselben Gruppe | 72 bis 80 % | 88 % | 92 bis 96 % |
| Drei Startzettel je Gruppe vorgeben, Rest zuordnen: Treffer | 46 bis 49 % | 57 bis 64 % | 60 bis 65 % |

- **Average Linkage** legt fast alles in eine Gruppe. Die Silhouette wählt dann den gröbsten oder den feinsten
  Schnitt, je nach Lauf. Winzige Zahlenunterschiede kippen das Ergebnis.
- **Louvain** findet die Gruppenzahl selbst (6 statt 5) und hat mit der Auflösung einen natürlichen Regler für
  „gröber/feiner“.
- **Die Sprache:** EmbeddingGemma 2 trennt roh zuerst Deutsch von Englisch. Zieht man je Sprache den Mittelwert
  ab, verdoppelt sich die Qualität (ARI 0,14 auf 0,29). Eine einfache Spracherkennung per Stoppwörtern reicht
  dafür (99,2 % richtig). MiniLM hat das Problem nicht.

### 3.4 Dubletten

Keine Ähnlichkeitsschwelle trennt Dubletten von Beinahe-Dubletten, bei keinem Modell. MiniLM bei 0,85: 11 von 30
Dubletten gefunden, 6 von 30 Beinahe-Dubletten fälschlich gemeldet. EmbeddingGemma 2 bei 0,95: 17 gefunden, 17
falsch. Die Modelle sehen „Laptop kam zu spät“ und „Laptop war kaputt“ als gleich an.

### 3.5 Wie schwer ist der Korpus?

- Die Themen einer Wand liegen nah beieinander, wie in einer echten Sitzung. Die Zettel enthalten absichtlich
  kaum Wörter aus dem Themennamen. Echte Wände wiederholen vermutlich mehr Stichwörter. Das macht den Korpus eher
  zu schwer als zu leicht.
- Von 30 gelesenen Fehlern des besten Modells waren etwa 7 vertretbare andere Zuordnungen, 14 „gleicher
  Gegenstand, anderes Anliegen“ und 9 klare Fehlgriffe. Die Etiketten ordnen nach Anliegen, die Modelle nach dem
  genannten Gegenstand.
- Ein Autor, ein Etikettierer, 500 Zettel: Die Zahlen sind ein Anhalt, kein Urteil über echte Wände.

## 4 Schwellen und Entscheidungen

### 4.1 Schwellen aus dem Plan (Erstwahl MiniLM q8)

| Schwelle | Mac | Android | iPhone |
|---|---|---|---|
| Kaltstart ≤ 60 s (Mac) / 90 s | gehalten: 31 s Übertragung gerechnet, 1 s Laden gemessen | nicht geprüft | nicht geprüft |
| 200 Zettel ≤ 5 s (Mac) / 30 s | gehalten: 1,4 s. Mit einem Thread 5,2 s, knapp gerissen | nicht geprüft | nicht geprüft |
| 500 clustern ≤ 0,3 s (Mac) / 1 s | gehalten: 46 ms | nicht geprüft | nicht geprüft |
| ARI ≥ 0,5 | **gerissen: 0,19** | gilt geräteunabhängig | gilt geräteunabhängig |
| ≥ 70 % der zweisprachigen Paare zusammen (die 50 markierten Paare) | gehalten mit Louvain: 72 bis 80 % | | |

Die Nachrücker reißen die ARI-Schwelle ebenfalls: granite 0,22, e5 0,12, EmbeddingGemma 2 0,29.

### 4.2 Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Modell | **Offen.** Kein Kandidat genügt | Abschnitt 3. Bestes gemessenes Modell: voyage-4-nano q4, danach EmbeddingGemma 2 q4 |
| Quantisierung | q8 für die kleinen Modelle auf WASM, q4 für die großen, fp16 nur auf WebGPU | q8 weicht kaum ab (0,994). fp16 ist exakt, verdoppelt aber Download und Speicher |
| Backends | Kleine Modelle: WASM mit Threads. Große Modelle: nur WebGPU | Mit WASM brauchen die großen 25 bis 30 s für 500 Zettel, auf dem schnellsten Gerät |
| Hosting | Gzip-Teile unter 25 MiB mit Manifest und Prüfsumme, eigener Cache | In Chrome und Safari geprüft. Halbiert den Download, kostet 0,7 s |
| Vokabular kürzen | Trägt technisch. Variante „lateinische Schrift“ ohne Wortliste bevorzugt | Variante de/en ist kleiner, hängt aber an einer Wortliste unter CC-BY-SA und verändert Texte mit unbekannten Wortteilen |
| Dubletten-Schwelle | Keine. Dubletten nur als Vorschlag, nie automatisch | Abschnitt 3.4 |
| Verfahren | Average Linkage und Silhouette gestrichen. Louvain auf dem Nachbarschaftsgraphen, Auflösung als Regler | Abschnitt 3.3 |
| Sprach-Zentrierung | Pflicht bei EmbeddingGemma 2 und voyage, per Stoppwort-Erkennung | Abschnitt 3.3 |
| Stapeln | Zettel vor dem Einbetten nach Länge sortieren | 35 % schneller |
| Rückfall „nach Stichwörtern ordnen“ | Gestrichen | TF-IDF trifft die Themen nicht (ARI 0) |
| Überschriften aus Schlüsselwörtern | So nicht brauchbar | Abschnitt M6 |

## 5 Was das für den Plan heißt

Der Kern des Plans war ein Knopf „Ordnen“, der Zettel selbstständig in sinnvolle Gruppen legt, mit einem kleinen
Modell, das auch auf dem Handy läuft. Das hält die Messung nicht:

- Mit dem kleinen Modell liegt etwa jeder zweite Zettel in einer Gruppe, die von einem anderen Thema bestimmt
  wird.
- Mit dem besten Modell sind es drei von vier richtig. Es braucht 218 MB Download, WebGPU und rund 1 GB
  Arbeitsspeicher plus Grafikspeicher. Das ist ein Werkzeug für den Laptop der Moderation, nicht fürs Handy.
- Selbst „Mensch gibt drei Zettel je Gruppe vor, KI sortiert den Rest“ trifft nur zu zwei Dritteln.

### Wege

| Weg | Was | Dafür | Dagegen |
|---|---|---|---|
| **A: Nachmessen, dann entscheiden** (empfohlen) | Etappe 0b: (1) ein lokales Sprachmodell statt Einbettungen prüfen, das Themen vorschlägt und Zettel zuordnet: Chromes eingebaute Prompt-API und ein WebGPU-Modell. (2) Dieselbe Messung auf ein bis zwei echten Wänden. (3) Android über die Fleet für die verbleibenden Kandidaten | Der einzige ungeprüfte lokale Weg mit Aussicht auf gute Gruppen. Echte Daten zeigen, ob der Korpus zu streng ist. Kostet etwa 1,5 AT (×1,7: 2,5), noch vor jedem Produktcode | Ausgang offen. Sprachmodelle sind groß (0,6 bis 1,4 GB) oder nur in Desktop-Chrome vorhanden |
| B: Mit Einbettungen weiter, KI als Vorschlag | voyage-4-nano oder EmbeddingGemma 2 auf dem Laptop der Moderation. Der Knopf heißt „Gruppen vorschlagen“, die Moderation korrigiert | Sofort baubar. Drei von vier Zetteln stimmen, zweisprachige Paare finden sich zu über 90 % | Kein „Wow“. Moderation vom Handy fällt weg. Die Aussage gegen Miro wird schwächer |
| C: Kleines Modell überall, nur Hilfen | MiniLM gekürzt (36 MB): ähnliche Zettel zeigen, Paare finden, Suche. Kein Ordnen-Knopf | Läuft voraussichtlich auch auf Handys | Die KI ist dann nicht mehr der Kern. Das widerspricht deiner Vorgabe |
| D: Parken | Projekt ruhen lassen, bis lokale Modelle besser sind | Kein weiterer Aufwand | Kein Produkt |

Cloud-KI würde das Problem lösen, ist aber durch die Vorgabe „keine laufenden KI-Kosten“ ausgeschlossen.

**Meine Empfehlung ist A.** Die Messung zeigt, dass Einbettungen allein den Kern nicht tragen. Ob ein lokales
Sprachmodell es besser kann, ist eine Vermutung, keine Messung. Sie zu prüfen kostet wenig und verhindert, dass
Wochen in eine Fläche fließen, deren Hauptfunktion enttäuscht.

## 6 Nicht gemessen

| Was | Warum | Wie es weitergeht |
|---|---|---|
| Android (Pixel 5, Galaxy S20 FE, Galaxy S8) | Die Messung lief nachts, die Fleet wird laut Absprache nur tagsüber belegt | Ein Lauf tagsüber über `adb reverse`, die Messseite ist vorbereitet (Satz `phone`) |
| iPhone | Braucht die Messseite auf einer workers.dev-Adresse. Den Deploy musst du auslösen, `wrangler deploy` aus einer Sitzung wurde in einem Schwesterprojekt abgelehnt | `tools/build-deploy.sh`, dann `wrangler deploy` mit der Konto-Kennung des persönlichen Kontos. Die Seite setzt nach einem Absturz mit der nächsten Konfiguration fort |
| Safari, volle Reihe | Der Bildschirm war gesperrt, Safari hält verdeckte Seiten an | `tools/run-safari.sh mac-safari full 2400 "&fresh=1"` bei entsperrtem Bildschirm, rund 10 Minuten |
| Kaltstart über ein echtes Netz | Lokal gemessen, Übertragung gerechnet | Ergibt sich mit dem Deploy |
| Speicher in Safari und auf Handys | `vmmap` greift nur am Mac auf Chrome | Android über `dumpsys meminfo` |
| Safari-Cache über sieben Tage | Dauert sieben Tage | Im Betrieb beobachten |
| voyage-4-nano mit Sprach-Zentrierung im Browser auf anderen Geräten | Nur auf diesem Mac gelaufen | Mit Etappe 0b |
| k-Means und Louvain im Browser gestoppt | Nur in Node gerechnet | Mit der Wahl des Verfahrens |
| Lokale Sprachmodelle | Nicht Teil der vier Kandidaten | Weg A |
| Echte Wände | Der Korpus ist erzeugt | Weg A |

## 7 Dateien

- [messung/korpus.json](messung/korpus.json): der Testkorpus.
- [messung/qualitaet-python.md](messung/qualitaet-python.md): Gegenprobe, 17 Modelle, Kniffe, Korpus-Härte.
- [messung/vokabular.md](messung/vokabular.md): das gekürzte Vokabular.
- `messung/roh/`: Rohdaten der Läufe (Chrome zweimal, Safari-Probelauf, Auswertung, Speicher).
- `proto/e0-messung/`: der Prototyp. Messseite in `public/`, Werkzeuge in `tools/`. Modelle und Abhängigkeiten
  sind nicht eingecheckt.
