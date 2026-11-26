# Qualitätsmessung in Python (Gegenprobe zum Browserlauf)

Stand 2026-11-22 00:51, 500 Zettel, onnxruntime 1.32.0 mit 4 Threads, Stapel 16. Erzeugt von `tools/eval_quality.py`.

Jede Zelle: **1-NN / 5-NN / k-Means-ARI / Reinheit**. kNN leave-one-out auf Kosinus (Mehrheitsentscheid). k-Means sphärisch, k = wahre Zahl der Themen, k-means++, 10 Neustarts je Lauf (eigene numpy-Umsetzung).
ARI und Reinheit sind das Mittel aus 6 Läufen mit festen Startwerten (12345, 1–5). Der einzelne Lauf mit Startwert 12345 (`ari`, `purity`) und die Streuung (`ari_sd6`, meist 0,02–0,05) stehen im JSON. Unterschiede unter etwa 0,05 im ARI sind Rauschen.
„Mittel der 2 Wände“: jede Wand allein (250 Zettel, 5 Themen), dann gemittelt. „je Sprache zentriert“: Mittelvektor jeder Sprache auf der jeweiligen Menge abgezogen, neu normiert.
Alle ARI-Werte kennen die wahre Clusterzahl k; ein Verfahren, das k selbst wählen muss, liegt darunter.

## Befund

Von Hand eingetragene Lesart der Zahlen vom 22.11.2026 (steht im JSON unter `befund`; die Tabellen darunter erzeugt das Skript).

**A – kein Fehler in der Browser-Pipeline.** MiniLM fp32: Kosinus zwischen Python- und Browser-Vektor 1,000000 (Mittel und Minimum). MiniLM q8: 0,9949 im Mittel, 0,971 im Minimum. Der Rest ist die Rechenweise von q8 in WASM, nicht Tokenizer, Pooling oder Normierung: einmalig von Hand geprüft (nicht Teil des Skripts) – transformers.js 4.3.2 mit nativem onnxruntime-node liefert für alle 500 Zettel dieselben Token-IDs wie die Python-Bibliothek tokenizers und Vektoren mit Kosinus 0,9996 (MiniLM q8), 0,9995 (e5-small q8) und 1,0000 (granite-97m q8) zu Python.

**Nebenbefund: q8 in WASM ist ungenauer als q8 nativ.** Abstand zu fp32 bei MiniLM: nativ 0,9985, Browser 0,9939 (ohne Folgen für die Kennzahlen). Bei granite-97m: nativ 0,997, Browser 0,960 – das kostet dort Qualität (1-NN 0,51 statt 0,57, ARI 0,15 statt 0,20; fp32 liegt bei 0,55 / 0,20). EmbeddingGemma 2 q4 ist in Browser und Python gleich (Kosinus 1,0).

**B – die Browser-Zahlen stimmen.** MiniLM q8 1-NN 0,49 / ARI 0,17; granite-97m (Browser-Vektoren) 0,51 / 0,15; e5-small 0,41 roh, 0,52–0,55 je Sprache zentriert, ARI 0,04–0,12; EmbeddingGemma 2 q4 je Sprache zentriert 0,65 / 0,69 / ARI 0,29 ± 0,03 / Reinheit 0,54 (der Browserlauf hatte 0,31 / 0,57, das liegt in der Streuung). Roh trennt k=2 bei Gemma und e5 die Sprachen vollständig (`lang_ari_k2` = 1,0).

**C – kein Modell erreicht ARI 0,5 ohne Hebel.** Am besten voyage-4-nano (Apache-2.0): je Sprache zentriert ARI 0,35–0,37 auf allen 500 und 0,44–0,47 im Mittel der Wände; die q4-Datei (243 MB) ist so gut wie q8 (422 MB). Danach EmbeddingGemma 2 (0,29–0,31 / 0,34; q8 nicht besser als q4), gte-multilingual-base (0,30 / 0,30) und granite-311m (0,27 / 0,31). bge-m3 (570 MB) kommt nur auf 0,22. Größe hilft hier nicht. Qwen3-Embedding-0.6B q8 ist als q8-Datei beschädigt (einzeln gegen im Stapel eingebettet: Kosinus 0,86); die Zahl sagt nichts über das Modell, eine genauere Datei (q4, 914 MB) wurde wegen der Größengrenze nicht geladen. multilingual-e5-large (562 MB) wurde nicht getestet (Download-Budget; e5-base und e5-small liegen weit hinten).

**D – Hebel (ΔARI gegen dieselbe Spalte, Mittel über 6 Startwerte; Streuung 0,02–0,05).** Zentrieren je Sprache: Gemma +0,15 (alle) / +0,24 (Wände), voyage +0,09 / +0,10, MiniLM +0,02. Mit geratener Sprache (Stoppwort-Heuristik, 99,2 % richtig) dasselbe (±0,02). Frage hinter dem Zettel, nur zusammen mit dem Zentrieren je Sprache: voyage +0,09 / +0,05, Gemma −0,07 / +0,09, MiniLM +0,06 / 0,00; ohne Zentrieren schadet sie (bis −0,24), weil die Frage die Sprache verstärkt. Frage vor dem Zettel: kein Gewinn. PCA auf 16–32 Dimensionen: voyage +0,02 bis +0,08, sonst höchstens +0,03. Nachbarn glätten: +0,02 bis +0,05 und deutlich weniger Streuung. Kein Gewinn oder Schaden: global zentrieren (±0,04), erste Hauptkomponente entfernen (ersetzt bei Gemma das Zentrieren je Sprache, schadet bei voyage −0,12 bis −0,19), Whitening (bis −0,39), Ward (−0,04 bis −0,15), Average Linkage (auf rohen Vektoren ARI 0,00), Spectral (±0,02), Ensemble mit einem schwächeren Modell. Andere Präfixe: Gemma „clustering“ ist am besten oder gleichauf, „sentence similarity“ und „classification“ −0,08 bis −0,14; voyage ohne Präfix ≥ Query-Präfix > Dokument-Präfix; e5 „passage“ deutlich schlechter als „query“.
Beste Kombination (voyage-4-nano, je Sprache zentriert, Frage dahinter, PCA 32, Nachbarn glätten): ARI 0,49 auf allen 500 und 0,52 im Mittel der Wände mit q8, 0,48 / 0,50 mit q4. Vorbehalt: die Hebel wurden auf demselben Korpus ausgesucht, auf dem sie gemessen sind; das ist eher zu günstig.

**E – der Korpus ist schwer, und zwar nicht wegen der zwei Sprachen.** TF-IDF ist fast auf Zufallsniveau (1-NN 0,21–0,28 bei 10 Themen, also Zufall 0,10; ARI 0,00–0,01; auch einsprachig 0,20–0,25): Zettel eines Themas teilen kaum Wörter. Einsprachige Hälften sind nicht leichter als eine gleich große gemischte (voyage: de 0,50 / 0,21, en 0,59 / 0,29, gemischt 0,58 / 0,28 für 1-NN / ARI); die halbe Menge je Thema kostet etwa 0,1 ARI. Von der 1-NN-Trefferquote stammt ein Teil aus den Übersetzungspaaren (97 % bei den 100 Paar-Zetteln, 59 % bei den übrigen). Selbst mit den wahren Themen-Schwerpunkten käme eine Schwerpunkt-Zuordnung nur auf ARI 0,58 (voyage), 0,50 (Gemma), 0,34 (MiniLM) – die Marke 0,5 liegt also nahe an dem, was diese Vektoren überhaupt hergeben; eine lineare Sonde mit Etiketten erreicht 0,83 / 0,78 / 0,64.
30 Nachbar-Fehler von Hand gelesen: etwa 7 sind vertretbare andere Zuordnungen (z. B. FAQ ↔ Kanal für Anfängerfragen, Mentor-Gruppe ↔ Jahrgangs-Chat), etwa 14 hängen an einem gemeinsamen Gegenstand oder Wort (Blumen, Bücher, Schreibtisch, Kopfhörer, Foto, Park) bei anderem Anliegen, etwa 9 sind schlicht daneben (Kosinus unter 0,3, der Zettel hat keinen nahen Nachbarn). 47 der 166 Fehler gehen über die Wandgrenze und entfallen, wenn jede Wand für sich gruppiert wird. Die Etiketten sind nicht zu streng – ein Mensch mit den Themennamen ordnet fast alles richtig zu –, aber sie beschreiben das Anliegen eines Zettels, während die Modelle nach dem genannten Gegenstand gruppieren.

**Nicht geprüft:** ob voyage-4-nano in transformers.js 4.3.2 im Browser lädt und wie schnell es dort ist (nativ, 4 Threads: 18 s für 500 Zettel mit q4, 7,6 s mit q8; EmbeddingGemma 2 q4: 12 s); ob q4/q8 von voyage in WASM dieselben Vektoren liefert wie nativ; alle ARI-Werte kennen die wahre Clusterzahl.

## A Gegenprobe der Browser-Pipeline (MiniLM)

| Vergleich | Kosinus Mittel | Kosinus Minimum |
|---|---|---|
| fp32_python_vs_browser_fp32 | 1.000000 | 1.000000 |
| q8_python_vs_browser_q8 | 0.994866 | 0.970882 |
| q8_python_vs_fp32 | 0.998467 | 0.974712 |
| q8_browser_vs_fp32 | 0.993939 | 0.945009 |
| minilm-fp32_batch1_vs_batch16_first64 | 1.000000 | 1.000000 |
| minilm-q8_batch1_vs_batch16_first64 | 0.999355 | 0.998449 |
| control_cls_pooling_vs_browser_fp32 | 0.739909 | 0.341962 |
| granite97: q8_python_vs_browser_q8 | 0.961329 | 0.930493 |
| granite97: q8_python_vs_fp32 | 0.996761 | 0.987457 |
| granite97: q8_browser_vs_fp32 | 0.959903 | 0.922957 |

## B Die Browser-Modelle nachgerechnet

„s für 500“: Sekunden für 500 Zettel mit nativem onnxruntime, 4 Threads (nicht WASM).

| Modell | MB | s für 500 | Kosinus zu Browser (Mittel/Min) | alle 500 roh | alle 500 je Sprache zentriert | Mittel der 2 Wände roh | Mittel der 2 Wände zentriert |
|---|---|---|---|---|---|---|---|
| minilm-q8, Python-Vektoren | 118.3 | 0.71 | 0.9949 / 0.9709 | 0.49 / 0.52 / 0.17 / 0.41 | 0.52 / 0.55 / 0.19 / 0.42 | 0.59 / 0.63 / 0.19 / 0.50 | 0.59 / 0.66 / 0.20 / 0.51 |
| minilm-q8, Browser-Vektoren | | | | 0.49 / 0.52 / 0.15 / 0.40 | 0.52 / 0.55 / 0.17 / 0.40 | 0.56 / 0.63 / 0.19 / 0.50 | 0.58 / 0.64 / 0.20 / 0.50 |
| minilm-fp32, Python-Vektoren | 470.3 | 0.63 | 1.0000 / 1.0000 | 0.49 / 0.52 / 0.16 / 0.40 | 0.52 / 0.54 / 0.18 / 0.42 | 0.59 / 0.63 / 0.21 / 0.52 | 0.60 / 0.66 / 0.20 / 0.50 |
| minilm-fp32, Browser-Vektoren | | | | 0.49 / 0.52 / 0.16 / 0.40 | 0.52 / 0.54 / 0.18 / 0.42 | 0.59 / 0.63 / 0.21 / 0.52 | 0.60 / 0.66 / 0.20 / 0.50 |
| granite97-q8, Python-Vektoren | 97.9 | 0.89 | 0.9613 / 0.9305 | 0.57 / 0.61 / 0.20 / 0.43 | 0.57 / 0.66 / 0.22 / 0.46 | 0.66 / 0.69 / 0.24 / 0.55 | 0.64 / 0.71 / 0.21 / 0.51 |
| granite97-q8, Browser-Vektoren | | | | 0.51 / 0.56 / 0.15 / 0.39 | 0.53 / 0.59 / 0.16 / 0.40 | 0.59 / 0.63 / 0.16 / 0.48 | 0.61 / 0.66 / 0.17 / 0.49 |
| e5small-q8, Python-Vektoren | 118.3 | 0.8 | 0.9965 / 0.9913 | 0.41 / 0.50 / 0.06 / 0.25 | 0.55 / 0.60 / 0.12 / 0.34 | 0.52 / 0.61 / 0.03 / 0.32 | 0.62 / 0.66 / 0.13 / 0.44 |
| e5small-q8, Browser-Vektoren | | | | 0.41 / 0.49 / 0.04 / 0.24 | 0.52 / 0.61 / 0.11 / 0.32 | 0.49 / 0.60 / 0.02 / 0.29 | 0.61 / 0.64 / 0.11 / 0.42 |
| gemma2-q4, Python-Vektoren | 174.5 | 12.07 | 1.0000 / 1.0000 | 0.56 / 0.61 / 0.14 / 0.35 | 0.65 / 0.69 / 0.29 / 0.54 | 0.62 / 0.67 / 0.10 / 0.39 | 0.69 / 0.75 / 0.34 / 0.64 |
| gemma2-q4, Browser-Vektoren | | | | 0.56 / 0.61 / 0.14 / 0.35 | 0.65 / 0.69 / 0.29 / 0.54 | 0.62 / 0.67 / 0.10 / 0.39 | 0.69 / 0.75 / 0.34 / 0.64 |
| granite97 fp32, Python-Vektoren | 390 | | | 0.55 / 0.61 / 0.20 / 0.42 | 0.56 / 0.65 / 0.20 / 0.46 | 0.63 / 0.69 / 0.23 / 0.58 | 0.66 / 0.69 / 0.23 / 0.55 |

## C Größere und andere Modelle

| Modell | Datei | MB | Lizenz | Pooling / Präfix | s für 500 | alle 500 roh | alle 500 je Sprache zentriert | Mittel der 2 Wände roh | Mittel der 2 Wände zentriert |
|---|---|---|---|---|---|---|---|---|---|
| gte-base-q8 | onnx-community/gte-multilingual-base onnx/model_quantized.onnx | 340.3 | Apache-2.0 | cls / '' | 2.01 | 0.58 / 0.65 / 0.24 / 0.47 | 0.61 / 0.69 / 0.30 / 0.53 | 0.68 / 0.72 / 0.27 / 0.57 | 0.72 / 0.76 / 0.30 / 0.58 |
| e5base-q8 | Xenova/multilingual-e5-base onnx/model_quantized.onnx | 278.6 | MIT | mean / 'query: ' | 1.91 | 0.48 / 0.56 / 0.06 / 0.26 | 0.60 / 0.63 / 0.16 / 0.37 | 0.57 / 0.65 / 0.02 / 0.30 | 0.64 / 0.71 / 0.14 / 0.44 |
| granite311-q8 | onnx-community/granite-embedding-311m-multilingual-r2-ONNX onnx/model_quantized.onnx | 312.6 | Apache-2.0 | cls / '' | 2.4 | 0.64 / 0.67 / 0.26 / 0.50 | 0.63 / 0.69 / 0.27 / 0.50 | 0.70 / 0.73 / 0.28 / 0.57 | 0.68 / 0.73 / 0.31 / 0.59 |
| arctic-m-v2-q8 | Snowflake/snowflake-arctic-embed-m-v2.0 onnx/model_quantized.onnx | 310.9 | Apache-2.0 | cls / 'query: ' | 2.03 | 0.61 / 0.65 / 0.21 / 0.43 | 0.62 / 0.66 / 0.23 / 0.46 | 0.68 / 0.71 / 0.23 / 0.54 | 0.69 / 0.73 / 0.23 / 0.54 |
| bge-m3-q8 | Xenova/bge-m3 onnx/model_quantized.onnx | 569.7 | MIT | cls / '' | 5.03 | 0.64 / 0.67 / 0.21 / 0.44 | 0.63 / 0.68 / 0.22 / 0.44 | 0.69 / 0.72 / 0.22 / 0.52 | 0.70 / 0.75 / 0.22 / 0.53 |
| voyage4nano-q8 | onnx-community/voyage-4-nano-ONNX onnx/model_quantized.onnx | 421.9 | Apache-2.0 | mean / 'Represent the query for retrieving supporting documents: ' | 7.59 | 0.64 / 0.68 / 0.27 / 0.50 | 0.65 / 0.71 / 0.35 / 0.58 | 0.70 / 0.74 / 0.29 / 0.57 | 0.72 / 0.77 / 0.45 / 0.71 |
| voyage4nano-q4 | onnx-community/voyage-4-nano-ONNX onnx/model_q4.onnx | 243.3 | Apache-2.0 | mean / 'Represent the query for retrieving supporting documents: ' | 18.27 | 0.62 / 0.67 / 0.26 / 0.48 | 0.64 / 0.72 / 0.35 / 0.56 | 0.69 / 0.74 / 0.30 / 0.58 | 0.72 / 0.78 / 0.44 / 0.70 |
| gte-base-q8 (mean, wie ONNX-Karte) | onnx-community/gte-multilingual-base onnx/model_quantized.onnx | 340.3 | Apache-2.0 | mean / '' |  | 0.50 / 0.54 / 0.09 / 0.30 | 0.55 / 0.58 / 0.15 / 0.37 | 0.57 / 0.61 / 0.08 / 0.38 | 0.62 / 0.65 / 0.15 / 0.46 |
| e5base-q8 (passage) | Xenova/multilingual-e5-base onnx/model_quantized.onnx | 278.6 | MIT | mean / 'passage: ' |  | 0.37 / 0.46 / 0.01 / 0.19 | 0.50 / 0.55 / 0.05 / 0.25 | 0.49 / 0.56 / -0.00 / 0.26 | 0.58 / 0.62 / 0.05 / 0.35 |
| arctic-m-v2-q8 (ohne Präfix) | Snowflake/snowflake-arctic-embed-m-v2.0 onnx/model_quantized.onnx | 310.9 | Apache-2.0 | cls / '' |  | 0.62 / 0.63 / 0.19 / 0.41 | 0.63 / 0.69 / 0.20 / 0.42 | 0.67 / 0.70 / 0.25 / 0.55 | 0.71 / 0.73 / 0.24 / 0.54 |
| voyage4nano-q8 (Dokument-Präfix) | onnx-community/voyage-4-nano-ONNX onnx/model_quantized.onnx | 421.9 | Apache-2.0 | mean / 'Represent the document for retrieval: ' |  | 0.62 / 0.68 / 0.20 / 0.43 | 0.67 / 0.71 / 0.30 / 0.52 | 0.69 / 0.73 / 0.32 / 0.60 | 0.72 / 0.79 / 0.39 / 0.65 |
| voyage4nano-q8 (ohne Präfix) | onnx-community/voyage-4-nano-ONNX onnx/model_quantized.onnx | 421.9 | Apache-2.0 | mean / '' |  | 0.61 / 0.68 / 0.28 / 0.51 | 0.67 / 0.75 / 0.37 / 0.59 | 0.68 / 0.76 / 0.37 / 0.64 | 0.73 / 0.80 / 0.47 / 0.73 |
| voyage4nano-q4 (ohne Präfix) | onnx-community/voyage-4-nano-ONNX onnx/model_q4.onnx | 243.3 | Apache-2.0 | mean / '' |  | 0.60 / 0.69 / 0.25 / 0.49 | 0.65 / 0.73 / 0.35 / 0.58 | 0.68 / 0.75 / 0.37 / 0.64 | 0.73 / 0.80 / 0.45 / 0.71 |
| gemma2-q8 | onnx-community/embeddinggemma-2-ONNX onnx/model_quantized.onnx | 314.2 | Apache-2.0 (laut Karte) | out:sentence_embedding / 'task: clustering \| query: ' | 5.17 | 0.57 / 0.60 / 0.13 / 0.35 | 0.65 / 0.72 / 0.31 / 0.55 | 0.64 / 0.68 / 0.09 / 0.39 | 0.71 / 0.77 / 0.34 / 0.63 |
| mpnet-para-q8 | Xenova/paraphrase-multilingual-mpnet-base-v2 onnx/model_quantized.onnx | 278.6 | Apache-2.0 | mean / '' | 1.77 | 0.56 / 0.60 / 0.20 / 0.45 | 0.58 / 0.63 / 0.23 / 0.49 | 0.63 / 0.67 / 0.25 / 0.55 | 0.65 / 0.68 / 0.24 / 0.55 |
| jina-v2-de-q8 | jinaai/jina-embeddings-v2-base-de onnx/model_quantized.onnx | 161.6 | Apache-2.0 | mean / '' | 1.94 | 0.56 / 0.60 / 0.21 / 0.44 | 0.59 / 0.64 / 0.21 / 0.44 | 0.65 / 0.70 / 0.23 / 0.53 | 0.68 / 0.73 / 0.23 / 0.53 |
| qwen3-06b-q8 | onnx-community/Qwen3-Embedding-0.6B-ONNX onnx/model_quantized.onnx | 613.5 | Apache-2.0 | last / 'Instruct: Identify the topic or theme of the given sticky note\nQuery:' | 16.19 | 0.42 / 0.47 / 0.10 / 0.33 | 0.49 / 0.53 / 0.20 / 0.44 | 0.51 / 0.55 / 0.09 / 0.38 | 0.58 / 0.63 / 0.19 / 0.50 |
| gemma2-q8 (sentence similarity) | onnx-community/embeddinggemma-2-ONNX onnx/model_quantized.onnx | 314.2 | Apache-2.0 (laut Karte) | out:sentence_embedding / 'task: sentence similarity \| query: ' |  | 0.57 / 0.61 / 0.18 / 0.41 | 0.59 / 0.65 / 0.19 / 0.42 | 0.65 / 0.71 / 0.21 / 0.51 | 0.65 / 0.72 / 0.20 / 0.50 |
| qwen3-06b-q8 (ohne Anweisung) | onnx-community/Qwen3-Embedding-0.6B-ONNX onnx/model_quantized.onnx | 613.5 | Apache-2.0 | last / '' |  | 0.38 / 0.42 / 0.06 / 0.26 | 0.46 / 0.52 / 0.08 / 0.30 | 0.47 / 0.51 / 0.05 / 0.33 | 0.55 / 0.60 / 0.08 / 0.39 |
| pplx-06b-q4 | perplexity-ai/pplx-embed-v1-0.6b onnx/model_q4.onnx | 399.4 | MIT | mean / '' | 33.31 | 0.58 / 0.68 / 0.18 / 0.41 | 0.62 / 0.70 / 0.21 / 0.45 | 0.64 / 0.73 / 0.19 / 0.51 | 0.69 / 0.76 / 0.25 / 0.56 |
| hs-embed-1-fp32 | hindsight-ai/hs-embed-1 onnx/model.onnx | 152.2 | MIT | mean / '' | 0.43 | 0.53 / 0.59 / 0.21 / 0.45 | 0.55 / 0.61 / 0.22 / 0.46 | 0.61 / 0.68 / 0.25 / 0.56 | 0.63 / 0.71 / 0.26 / 0.56 |

Bestes Modell aus C nach k-Means-ARI (Mittel über 6 Startwerte, alle 500 und Wände gemittelt): **voyage4nano-q8 (ohne Präfix)** (0.4192).

## D Billige Hebel

Sprache geraten (Stoppwort-Heuristik): Trefferquote 0.992, falsch: 4 von 500.

Δ = Änderung gegen die Ausgangslage desselben Modells in derselben Spalte: Δ1-NN / ΔARI (ARI als Mittel über 6 Startwerte; bei 6b ein Lauf).

### minilm-q8

| Hebel | alle 500 roh | alle 500 je Sprache zentriert | Mittel der 2 Wände roh | Mittel der 2 Wände zentriert | Δ alle roh | Δ alle zentriert | Δ Wände roh | Δ Wände zentriert |
|---|---|---|---|---|---|---|---|---|
| 0 Ausgangslage | 0.49 / 0.52 / 0.17 / 0.41 | 0.52 / 0.55 / 0.19 / 0.42 | 0.59 / 0.63 / 0.19 / 0.50 | 0.59 / 0.66 / 0.20 / 0.51 | +0.00 / +0.00 | +0.00 / +0.00 | +0.00 / +0.00 | +0.00 / +0.00 |
| 1a Frage davor: „<Frage>: <Zettel>“ | 0.48 / 0.52 / 0.18 / 0.37 | 0.51 / 0.57 / 0.21 / 0.42 | 0.48 / 0.52 / 0.05 / 0.35 | 0.57 / 0.64 / 0.20 / 0.52 | -0.01 / +0.01 | -0.02 / +0.03 | -0.11 / -0.14 | -0.01 / -0.01 |
| 1b Frage dahinter: „<Zettel> (<Frage>)“ | 0.53 / 0.58 / 0.21 / 0.41 | 0.57 / 0.62 / 0.25 / 0.47 | 0.54 / 0.58 / 0.13 / 0.42 | 0.60 / 0.65 / 0.20 / 0.51 | +0.05 / +0.04 | +0.05 / +0.06 | -0.06 / -0.06 | +0.01 / -0.00 |
| 3a global zentriert (statt je Sprache) | 0.50 / 0.54 / 0.17 / 0.41 | – | 0.57 / 0.65 / 0.19 / 0.50 | – | +0.01 / +0.00 | – | -0.02 / -0.00 | – |
| 3b ohne 1. Hauptkomponente | 0.48 / 0.51 / 0.13 / 0.38 | – | 0.58 / 0.64 / 0.12 / 0.44 | – | -0.01 / -0.04 | – | -0.01 / -0.07 | – |
| 3c je Sprache zentriert, dann ohne 1. Hauptkomponente | – | 0.49 / 0.51 / 0.13 / 0.38 | – | 0.59 / 0.64 / 0.14 / 0.45 | – | -0.04 / -0.05 | – | +0.01 / -0.06 |
| 4 PCA auf 16 Dimensionen | 0.45 / 0.55 / 0.17 / 0.41 | 0.48 / 0.54 / 0.18 / 0.41 | 0.54 / 0.64 / 0.21 / 0.51 | 0.55 / 0.63 / 0.21 / 0.52 | -0.04 / +0.00 | -0.05 / -0.01 | -0.05 / +0.02 | -0.04 / +0.00 |
| 4 PCA auf 32 Dimensionen | 0.49 / 0.54 / 0.18 / 0.42 | 0.49 / 0.55 / 0.17 / 0.41 | 0.58 / 0.63 / 0.20 / 0.50 | 0.57 / 0.65 / 0.22 / 0.52 | -0.00 / +0.01 | -0.03 / -0.02 | -0.02 / +0.01 | -0.01 / +0.01 |
| 4 PCA auf 64 Dimensionen | 0.50 / 0.55 / 0.18 / 0.42 | 0.53 / 0.56 / 0.18 / 0.42 | 0.58 / 0.65 / 0.19 / 0.50 | 0.60 / 0.65 / 0.19 / 0.50 | +0.01 / +0.01 | +0.01 / -0.00 | -0.01 / -0.01 | +0.01 / -0.01 |
| 4w PCA mit Whitening auf 16 Dimensionen | 0.43 / 0.52 / 0.16 / 0.39 | 0.45 / 0.51 / 0.16 / 0.38 | 0.53 / 0.61 / 0.13 / 0.44 | 0.55 / 0.61 / 0.13 / 0.44 | -0.06 / -0.01 | -0.07 / -0.03 | -0.06 / -0.06 | -0.03 / -0.07 |
| 4w PCA mit Whitening auf 32 Dimensionen | 0.46 / 0.53 / 0.12 / 0.35 | 0.46 / 0.52 / 0.12 / 0.36 | 0.56 / 0.60 / 0.06 / 0.37 | 0.56 / 0.59 / 0.06 / 0.36 | -0.02 / -0.05 | -0.06 / -0.06 | -0.03 / -0.13 | -0.03 / -0.15 |
| 5 je GERATENER Sprache zentriert | – | 0.52 / 0.55 / 0.17 / 0.41 | – | 0.59 / 0.66 / 0.20 / 0.50 | – | +0.00 / -0.02 | – | +0.00 / -0.01 |
| 6a Nachbarn glätten (k=10, 50 %) | 0.50 / 0.52 / 0.19 / 0.43 | 0.51 / 0.55 / 0.19 / 0.44 | 0.60 / 0.64 / 0.21 / 0.52 | 0.62 / 0.64 / 0.20 / 0.50 | +0.01 / +0.02 | -0.01 / +0.00 | +0.01 / +0.02 | +0.04 / +0.00 |
| 6a' Nachbarn glätten, zweimal | 0.47 / 0.53 / 0.17 / 0.42 | 0.51 / 0.56 / 0.18 / 0.42 | 0.59 / 0.63 / 0.20 / 0.52 | 0.59 / 0.63 / 0.21 / 0.51 | -0.02 / +0.01 | -0.02 / -0.00 | +0.00 / +0.01 | +0.01 / +0.00 |
| 6b Clusterverfahren ward statt k-Means | – / – / 0.13 / 0.39 | – / – / 0.15 / 0.39 | – / – / 0.11 / 0.42 | – / – / 0.14 / 0.46 | – / -0.04 | – / -0.04 | – / -0.09 | – / -0.06 |
| 6b Clusterverfahren average statt k-Means | – / – / 0.06 / 0.25 | – / – / 0.15 / 0.36 | – / – / 0.01 / 0.26 | – / – / 0.18 / 0.48 | – / -0.11 | – / -0.03 | – / -0.19 | – / -0.02 |
| 6b Clusterverfahren spectral statt k-Means | – / – / 0.18 / 0.42 | – / – / 0.19 / 0.43 | – / – / 0.20 / 0.52 | – / – / 0.19 / 0.51 | – / +0.01 | – / +0.00 | – / +0.01 | – / -0.02 |
| 6c Ensemble mit gemma2-q4 (Vektoren aneinandergehängt) | 0.50 / 0.57 / 0.20 / 0.45 | 0.55 / 0.58 / 0.20 / 0.45 | 0.60 / 0.65 / 0.22 / 0.53 | 0.61 / 0.68 / 0.23 / 0.52 | +0.01 / +0.03 | +0.03 / +0.01 | +0.00 / +0.02 | +0.02 / +0.02 |
| 6d Frage davor + Nachbarn glätten | 0.48 / 0.51 / 0.16 / 0.34 | 0.50 / 0.57 / 0.21 / 0.42 | 0.48 / 0.51 / 0.05 / 0.34 | 0.54 / 0.60 / 0.20 / 0.53 | -0.01 / -0.00 | -0.02 / +0.02 | -0.11 / -0.14 | -0.04 / -0.00 |
| 6e Kombination: PCA 32 + Nachbarn glätten | 0.46 / 0.53 / 0.17 / 0.42 | 0.49 / 0.56 / 0.18 / 0.42 | 0.59 / 0.64 / 0.21 / 0.52 | 0.60 / 0.63 / 0.20 / 0.51 | -0.03 / +0.00 | -0.03 / -0.01 | +0.00 / +0.02 | +0.01 / -0.00 |
| 6f Kombination: Frage dahinter + PCA 32 + Nachbarn glätten | 0.52 / 0.60 / 0.23 / 0.44 | 0.57 / 0.64 / 0.27 / 0.49 | 0.57 / 0.62 / 0.15 / 0.45 | 0.60 / 0.64 / 0.21 / 0.54 | +0.03 / +0.06 | +0.05 / +0.08 | -0.02 / -0.04 | +0.01 / +0.01 |

### gemma2-q4

| Hebel | alle 500 roh | alle 500 je Sprache zentriert | Mittel der 2 Wände roh | Mittel der 2 Wände zentriert | Δ alle roh | Δ alle zentriert | Δ Wände roh | Δ Wände zentriert |
|---|---|---|---|---|---|---|---|---|
| 0 Ausgangslage | 0.56 / 0.61 / 0.14 / 0.35 | 0.65 / 0.69 / 0.29 / 0.54 | 0.62 / 0.67 / 0.10 / 0.39 | 0.69 / 0.75 / 0.34 / 0.64 | +0.00 / +0.00 | +0.00 / +0.00 | +0.00 / +0.00 | +0.00 / +0.00 |
| 1a Frage davor: „<Frage>: <Zettel>“ | 0.59 / 0.58 / 0.20 / 0.37 | 0.61 / 0.63 / 0.20 / 0.39 | 0.59 / 0.58 / 0.09 / 0.37 | 0.69 / 0.76 / 0.36 / 0.65 | +0.03 / +0.07 | -0.03 / -0.09 | -0.03 / -0.01 | +0.00 / +0.02 |
| 1b Frage dahinter: „<Zettel> (<Frage>)“ | 0.60 / 0.60 / 0.20 / 0.37 | 0.69 / 0.70 / 0.23 / 0.43 | 0.60 / 0.60 / 0.10 / 0.39 | 0.71 / 0.78 / 0.43 / 0.70 | +0.04 / +0.06 | +0.05 / -0.07 | -0.02 / +0.00 | +0.03 / +0.09 |
| 2 Präfix 'task: sentence similarity \| query: ' | 0.56 / 0.62 / 0.19 / 0.42 | 0.59 / 0.66 / 0.19 / 0.43 | 0.65 / 0.70 / 0.18 / 0.50 | 0.66 / 0.74 / 0.21 / 0.52 | -0.00 / +0.06 | -0.06 / -0.10 | +0.02 / +0.09 | -0.02 / -0.13 |
| 2 Präfix 'task: classification \| query: ' | 0.52 / 0.59 / 0.11 / 0.36 | 0.56 / 0.63 / 0.21 / 0.45 | 0.59 / 0.66 / 0.09 / 0.40 | 0.62 / 0.70 / 0.20 / 0.50 | -0.04 / -0.02 | -0.09 / -0.08 | -0.03 / -0.01 | -0.07 / -0.14 |
| 2 Präfix 'task: search result \| query: ' | 0.58 / 0.63 / 0.18 / 0.42 | 0.63 / 0.70 / 0.30 / 0.54 | 0.65 / 0.71 / 0.11 / 0.42 | 0.70 / 0.76 / 0.36 / 0.65 | +0.02 / +0.04 | -0.01 / +0.00 | +0.02 / +0.02 | +0.01 / +0.02 |
| 2 Präfix 'title: none \| text: ' | 0.56 / 0.64 / 0.12 / 0.34 | 0.65 / 0.70 / 0.29 / 0.53 | 0.65 / 0.68 / 0.10 / 0.42 | 0.71 / 0.76 / 0.35 / 0.64 | +0.00 / -0.01 | +0.00 / +0.00 | +0.03 / +0.01 | +0.02 / +0.01 |
| 2 Präfix '' | 0.54 / 0.59 / 0.08 / 0.29 | 0.62 / 0.69 / 0.26 / 0.51 | 0.59 / 0.66 / 0.04 / 0.34 | 0.67 / 0.75 / 0.26 / 0.56 | -0.03 / -0.05 | -0.02 / -0.03 | -0.03 / -0.05 | -0.02 / -0.08 |
| 3a global zentriert (statt je Sprache) | 0.55 / 0.63 / 0.15 / 0.36 | – | 0.64 / 0.70 / 0.11 / 0.40 | – | -0.01 / +0.01 | – | +0.01 / +0.01 | – |
| 3b ohne 1. Hauptkomponente | 0.65 / 0.69 / 0.29 / 0.53 | – | 0.68 / 0.74 / 0.32 / 0.62 | – | +0.09 / +0.15 | – | +0.06 / +0.22 | – |
| 3c je Sprache zentriert, dann ohne 1. Hauptkomponente | – | 0.62 / 0.68 / 0.19 / 0.45 | – | 0.64 / 0.71 / 0.20 / 0.50 | – | -0.03 / -0.11 | – | -0.04 / -0.14 |
| 4 PCA auf 16 Dimensionen | 0.54 / 0.60 / 0.16 / 0.38 | 0.61 / 0.63 / 0.32 / 0.56 | 0.64 / 0.71 / 0.11 / 0.41 | 0.70 / 0.76 / 0.36 / 0.66 | -0.02 / +0.02 | -0.04 / +0.02 | +0.01 / +0.02 | +0.01 / +0.02 |
| 4 PCA auf 32 Dimensionen | 0.57 / 0.62 / 0.16 / 0.38 | 0.64 / 0.68 / 0.32 / 0.56 | 0.63 / 0.67 / 0.11 / 0.41 | 0.70 / 0.73 / 0.34 / 0.64 | +0.01 / +0.02 | -0.00 / +0.03 | +0.01 / +0.02 | +0.02 / +0.00 |
| 4 PCA auf 64 Dimensionen | 0.56 / 0.62 / 0.16 / 0.38 | 0.64 / 0.68 / 0.31 / 0.56 | 0.61 / 0.70 / 0.10 / 0.40 | 0.69 / 0.74 / 0.34 / 0.64 | +0.00 / +0.02 | -0.01 / +0.02 | -0.01 / +0.01 | +0.01 / -0.00 |
| 4w PCA mit Whitening auf 16 Dimensionen | 0.55 / 0.61 / 0.28 / 0.54 | 0.59 / 0.62 / 0.28 / 0.54 | 0.61 / 0.71 / 0.24 / 0.55 | 0.67 / 0.71 / 0.24 / 0.55 | -0.01 / +0.15 | -0.05 / -0.01 | -0.02 / +0.15 | -0.02 / -0.10 |
| 4w PCA mit Whitening auf 32 Dimensionen | 0.59 / 0.64 / 0.26 / 0.52 | 0.60 / 0.65 / 0.21 / 0.46 | 0.64 / 0.71 / 0.09 / 0.40 | 0.68 / 0.70 / 0.09 / 0.40 | +0.03 / +0.13 | -0.04 / -0.08 | +0.02 / -0.01 | -0.01 / -0.25 |
| 5 je GERATENER Sprache zentriert | – | 0.65 / 0.70 / 0.29 / 0.54 | – | 0.70 / 0.75 / 0.33 / 0.63 | – | +0.00 / -0.00 | – | +0.01 / -0.01 |
| 6a Nachbarn glätten (k=10, 50 %) | 0.58 / 0.59 / 0.15 / 0.37 | 0.65 / 0.68 / 0.34 / 0.59 | 0.62 / 0.67 / 0.12 / 0.41 | 0.68 / 0.73 / 0.35 / 0.64 | +0.01 / +0.01 | +0.00 / +0.05 | +0.00 / +0.02 | -0.01 / +0.02 |
| 6a' Nachbarn glätten, zweimal | 0.59 / 0.62 / 0.16 / 0.38 | 0.62 / 0.66 / 0.33 / 0.58 | 0.63 / 0.70 / 0.13 / 0.42 | 0.68 / 0.72 / 0.35 / 0.64 | +0.02 / +0.02 | -0.03 / +0.04 | +0.01 / +0.03 | -0.01 / +0.01 |
| 6b Clusterverfahren ward statt k-Means | – / – / 0.11 / 0.34 | – / – / 0.23 / 0.51 | – / – / 0.06 / 0.37 | – / – / 0.22 / 0.56 | – / -0.02 | – / -0.06 | – / -0.04 | – / -0.12 |
| 6b Clusterverfahren average statt k-Means | – / – / 0.00 / 0.15 | – / – / 0.23 / 0.42 | – / – / 0.00 / 0.23 | – / – / 0.28 / 0.58 | – / -0.13 | – / -0.06 | – / -0.09 | – / -0.06 |
| 6b Clusterverfahren spectral statt k-Means | – / – / 0.16 / 0.41 | – / – / 0.31 / 0.56 | – / – / 0.11 / 0.40 | – / – / 0.33 / 0.63 | – / +0.02 | – / +0.01 | – / +0.02 | – / -0.01 |
| 6c Ensemble mit minilm-q8 (Vektoren aneinandergehängt) | 0.50 / 0.57 / 0.20 / 0.45 | 0.55 / 0.58 / 0.20 / 0.45 | 0.60 / 0.65 / 0.22 / 0.53 | 0.61 / 0.68 / 0.23 / 0.52 | -0.06 / +0.06 | -0.09 / -0.10 | -0.03 / +0.12 | -0.08 / -0.11 |
| 6c Ensemble mit voyage4nano-q8 (ohne Präfix) (Vektoren aneinandergehängt) | 0.62 / 0.71 / 0.16 / 0.40 | 0.67 / 0.75 / 0.38 / 0.60 | 0.68 / 0.78 / 0.20 / 0.50 | 0.74 / 0.81 / 0.47 / 0.73 | +0.06 / +0.03 | +0.02 / +0.09 | +0.06 / +0.11 | +0.05 / +0.13 |
| 6d Frage davor + Nachbarn glätten | 0.60 / 0.63 / 0.20 / 0.39 | 0.61 / 0.64 / 0.21 / 0.40 | 0.60 / 0.63 / 0.11 / 0.39 | 0.71 / 0.75 / 0.37 / 0.66 | +0.04 / +0.07 | -0.04 / -0.08 | -0.02 / +0.01 | +0.02 / +0.03 |
| 6e Kombination: PCA 32 + Nachbarn glätten | 0.58 / 0.64 / 0.16 / 0.39 | 0.64 / 0.67 / 0.33 / 0.57 | 0.65 / 0.68 / 0.13 / 0.42 | 0.71 / 0.73 / 0.36 / 0.65 | +0.02 / +0.03 | -0.01 / +0.03 | +0.03 / +0.04 | +0.03 / +0.02 |
| 6f Kombination: Frage dahinter + PCA 32 + Nachbarn glätten | 0.64 / 0.68 / 0.24 / 0.41 | 0.65 / 0.71 / 0.24 / 0.44 | 0.64 / 0.68 / 0.14 / 0.42 | 0.73 / 0.77 / 0.43 / 0.69 | +0.08 / +0.10 | +0.01 / -0.05 | +0.01 / +0.04 | +0.04 / +0.09 |

### voyage4nano-q8 (ohne Präfix)

| Hebel | alle 500 roh | alle 500 je Sprache zentriert | Mittel der 2 Wände roh | Mittel der 2 Wände zentriert | Δ alle roh | Δ alle zentriert | Δ Wände roh | Δ Wände zentriert |
|---|---|---|---|---|---|---|---|---|
| 0 Ausgangslage | 0.61 / 0.68 / 0.28 / 0.51 | 0.67 / 0.75 / 0.37 / 0.59 | 0.68 / 0.76 / 0.37 / 0.64 | 0.73 / 0.80 / 0.47 / 0.73 | +0.00 / +0.00 | +0.00 / +0.00 | +0.00 / +0.00 | +0.00 / +0.00 |
| 1a Frage davor: „<Frage>: <Zettel>“ | 0.61 / 0.63 / 0.21 / 0.39 | 0.66 / 0.73 / 0.33 / 0.53 | 0.61 / 0.63 / 0.12 / 0.41 | 0.70 / 0.77 / 0.49 / 0.72 | +0.00 / -0.07 | -0.00 / -0.04 | -0.07 / -0.25 | -0.03 / +0.02 |
| 1b Frage dahinter: „<Zettel> (<Frage>)“ | 0.62 / 0.69 / 0.22 / 0.41 | 0.70 / 0.78 / 0.46 / 0.65 | 0.62 / 0.69 / 0.14 / 0.43 | 0.71 / 0.82 / 0.52 / 0.75 | +0.01 / -0.06 | +0.03 / +0.09 | -0.06 / -0.23 | -0.02 / +0.05 |
| 2 Präfix 'Represent the query for retrieving supporting documents: ' | 0.64 / 0.68 / 0.27 / 0.50 | 0.65 / 0.71 / 0.35 / 0.58 | 0.70 / 0.74 / 0.29 / 0.57 | 0.72 / 0.77 / 0.45 / 0.71 | +0.03 / -0.01 | -0.02 / -0.02 | +0.02 / -0.08 | -0.01 / -0.02 |
| 2 Präfix 'Represent the document for retrieval: ' | 0.62 / 0.68 / 0.20 / 0.43 | 0.67 / 0.71 / 0.30 / 0.52 | 0.69 / 0.73 / 0.32 / 0.60 | 0.72 / 0.79 / 0.39 / 0.65 | +0.01 / -0.08 | +0.00 / -0.07 | +0.01 / -0.05 | -0.01 / -0.08 |
| 3a global zentriert (statt je Sprache) | 0.64 / 0.72 / 0.31 / 0.53 | – | 0.71 / 0.78 / 0.41 / 0.67 | – | +0.03 / +0.02 | – | +0.04 / +0.04 | – |
| 3b ohne 1. Hauptkomponente | 0.61 / 0.69 / 0.17 / 0.40 | – | 0.67 / 0.73 / 0.18 / 0.49 | – | +0.01 / -0.12 | – | -0.00 / -0.19 | – |
| 3c je Sprache zentriert, dann ohne 1. Hauptkomponente | – | 0.64 / 0.71 / 0.24 / 0.48 | – | 0.69 / 0.76 / 0.17 / 0.47 | – | -0.03 / -0.13 | – | -0.04 / -0.30 |
| 4 PCA auf 16 Dimensionen | 0.63 / 0.68 / 0.33 / 0.57 | 0.67 / 0.72 / 0.43 / 0.66 | 0.72 / 0.79 / 0.44 / 0.69 | 0.75 / 0.80 / 0.49 / 0.74 | +0.02 / +0.04 | +0.00 / +0.06 | +0.05 / +0.07 | +0.02 / +0.02 |
| 4 PCA auf 32 Dimensionen | 0.63 / 0.72 / 0.34 / 0.58 | 0.67 / 0.74 / 0.40 / 0.63 | 0.73 / 0.80 / 0.45 / 0.70 | 0.74 / 0.81 / 0.52 / 0.77 | +0.02 / +0.06 | -0.00 / +0.03 | +0.05 / +0.08 | +0.01 / +0.05 |
| 4 PCA auf 64 Dimensionen | 0.66 / 0.71 / 0.32 / 0.55 | 0.68 / 0.74 / 0.39 / 0.61 | 0.71 / 0.79 / 0.45 / 0.70 | 0.73 / 0.80 / 0.47 / 0.73 | +0.06 / +0.04 | +0.01 / +0.02 | +0.03 / +0.08 | +0.00 / +0.01 |
| 4w PCA mit Whitening auf 16 Dimensionen | 0.64 / 0.67 / 0.34 / 0.58 | 0.65 / 0.69 / 0.36 / 0.59 | 0.69 / 0.75 / 0.39 / 0.66 | 0.69 / 0.78 / 0.28 / 0.57 | +0.03 / +0.06 | -0.02 / -0.01 | +0.01 / +0.02 | -0.04 / -0.19 |
| 4w PCA mit Whitening auf 32 Dimensionen | 0.59 / 0.69 / 0.25 / 0.50 | 0.61 / 0.71 / 0.23 / 0.46 | 0.69 / 0.75 / 0.12 / 0.43 | 0.69 / 0.73 / 0.08 / 0.39 | -0.02 / -0.03 | -0.06 / -0.14 | +0.01 / -0.25 | -0.04 / -0.39 |
| 5 je GERATENER Sprache zentriert | – | 0.66 / 0.74 / 0.38 / 0.60 | – | 0.73 / 0.81 / 0.47 / 0.72 | – | -0.00 / +0.01 | – | +0.00 / +0.00 |
| 6a Nachbarn glätten (k=10, 50 %) | 0.65 / 0.71 / 0.38 / 0.61 | 0.67 / 0.73 / 0.39 / 0.62 | 0.72 / 0.78 / 0.50 / 0.74 | 0.77 / 0.80 / 0.48 / 0.74 | +0.04 / +0.10 | +0.00 / +0.02 | +0.04 / +0.13 | +0.04 / +0.02 |
| 6a' Nachbarn glätten, zweimal | 0.67 / 0.71 / 0.38 / 0.60 | 0.67 / 0.75 / 0.39 / 0.61 | 0.72 / 0.78 / 0.48 / 0.74 | 0.77 / 0.81 / 0.47 / 0.72 | +0.06 / +0.10 | +0.01 / +0.02 | +0.05 / +0.11 | +0.04 / -0.00 |
| 6b Clusterverfahren ward statt k-Means | – / – / 0.28 / 0.52 | – / – / 0.31 / 0.56 | – / – / 0.24 / 0.53 | – / – / 0.32 / 0.61 | – / -0.01 | – / -0.06 | – / -0.13 | – / -0.15 |
| 6b Clusterverfahren average statt k-Means | – / – / 0.00 / 0.14 | – / – / 0.25 / 0.40 | – / – / 0.00 / 0.22 | – / – / 0.32 / 0.59 | – / -0.28 | – / -0.12 | – / -0.37 | – / -0.15 |
| 6b Clusterverfahren spectral statt k-Means | – / – / 0.35 / 0.59 | – / – / 0.36 / 0.59 | – / – / 0.43 / 0.70 | – / – / 0.45 / 0.71 | – / +0.07 | – / -0.01 | – / +0.06 | – / -0.02 |
| 6c Ensemble mit gemma2-q4 (Vektoren aneinandergehängt) | 0.62 / 0.71 / 0.16 / 0.40 | 0.67 / 0.75 / 0.38 / 0.60 | 0.68 / 0.78 / 0.20 / 0.50 | 0.74 / 0.81 / 0.47 / 0.73 | +0.01 / -0.12 | +0.00 / +0.01 | +0.01 / -0.17 | +0.01 / +0.00 |
| 6c Ensemble mit minilm-q8 (Vektoren aneinandergehängt) | 0.59 / 0.63 / 0.26 / 0.50 | 0.61 / 0.65 / 0.27 / 0.52 | 0.67 / 0.73 / 0.29 / 0.59 | 0.67 / 0.73 / 0.30 / 0.60 | -0.02 / -0.02 | -0.06 / -0.10 | -0.01 / -0.08 | -0.06 / -0.17 |
| 6d Frage davor + Nachbarn glätten | 0.62 / 0.65 / 0.23 / 0.42 | 0.68 / 0.70 / 0.35 / 0.57 | 0.62 / 0.65 / 0.13 / 0.42 | 0.74 / 0.78 / 0.46 / 0.69 | +0.02 / -0.05 | +0.02 / -0.02 | -0.05 / -0.24 | +0.01 / -0.01 |
| 6e Kombination: PCA 32 + Nachbarn glätten | 0.64 / 0.69 / 0.34 / 0.56 | 0.68 / 0.72 / 0.44 / 0.68 | 0.75 / 0.77 / 0.46 / 0.73 | 0.75 / 0.80 / 0.49 / 0.74 | +0.03 / +0.05 | +0.01 / +0.07 | +0.07 / +0.09 | +0.02 / +0.02 |
| 6f Kombination: Frage dahinter + PCA 32 + Nachbarn glätten | 0.68 / 0.74 / 0.26 / 0.44 | 0.72 / 0.77 / 0.49 / 0.69 | 0.68 / 0.74 / 0.19 / 0.47 | 0.77 / 0.79 / 0.52 / 0.75 | +0.07 / -0.02 | +0.05 / +0.12 | +0.00 / -0.18 | +0.04 / +0.05 |

### voyage4nano-q4 (ohne Präfix)

| Hebel | alle 500 roh | alle 500 je Sprache zentriert | Mittel der 2 Wände roh | Mittel der 2 Wände zentriert | Δ alle roh | Δ alle zentriert | Δ Wände roh | Δ Wände zentriert |
|---|---|---|---|---|---|---|---|---|
| 0 Ausgangslage | 0.60 / 0.69 / 0.25 / 0.49 | 0.65 / 0.73 / 0.35 / 0.58 | 0.68 / 0.75 / 0.37 / 0.64 | 0.73 / 0.80 / 0.45 / 0.71 | +0.00 / +0.00 | +0.00 / +0.00 | +0.00 / +0.00 | +0.00 / +0.00 |
| 1a Frage davor: „<Frage>: <Zettel>“ | 0.59 / 0.64 / 0.21 / 0.40 | 0.66 / 0.72 / 0.32 / 0.53 | 0.59 / 0.64 / 0.12 / 0.41 | 0.72 / 0.78 / 0.46 / 0.70 | -0.02 / -0.04 | +0.01 / -0.04 | -0.09 / -0.26 | -0.01 / +0.01 |
| 1b Frage dahinter: „<Zettel> (<Frage>)“ | 0.63 / 0.66 / 0.22 / 0.40 | 0.69 / 0.77 / 0.45 / 0.66 | 0.63 / 0.66 / 0.14 / 0.42 | 0.73 / 0.80 / 0.47 / 0.72 | +0.03 / -0.03 | +0.04 / +0.10 | -0.05 / -0.24 | +0.00 / +0.02 |
| 2 Präfix 'Represent the query for retrieving supporting documents: ' | 0.62 / 0.67 / 0.26 / 0.48 | 0.64 / 0.72 / 0.35 / 0.56 | 0.69 / 0.74 / 0.30 / 0.58 | 0.72 / 0.78 / 0.44 / 0.70 | +0.02 / +0.01 | -0.01 / -0.00 | +0.01 / -0.08 | -0.01 / -0.00 |
| 2 Präfix 'Represent the document for retrieval: ' | 0.62 / 0.67 / 0.23 / 0.45 | 0.65 / 0.71 / 0.28 / 0.50 | 0.69 / 0.72 / 0.22 / 0.51 | 0.72 / 0.77 / 0.35 / 0.63 | +0.01 / -0.03 | -0.00 / -0.07 | +0.01 / -0.15 | -0.01 / -0.09 |
| 3a global zentriert (statt je Sprache) | 0.63 / 0.71 / 0.30 / 0.51 | – | 0.70 / 0.79 / 0.41 / 0.68 | – | +0.03 / +0.04 | – | +0.02 / +0.04 | – |
| 3b ohne 1. Hauptkomponente | 0.61 / 0.69 / 0.17 / 0.41 | – | 0.66 / 0.74 / 0.16 / 0.47 | – | +0.01 / -0.09 | – | -0.02 / -0.21 | – |
| 3c je Sprache zentriert, dann ohne 1. Hauptkomponente | – | 0.62 / 0.70 / 0.23 / 0.47 | – | 0.70 / 0.75 / 0.18 / 0.48 | – | -0.03 / -0.12 | – | -0.03 / -0.27 |
| 4 PCA auf 16 Dimensionen | 0.59 / 0.68 / 0.31 / 0.54 | 0.66 / 0.70 / 0.42 / 0.65 | 0.72 / 0.78 / 0.49 / 0.73 | 0.74 / 0.79 / 0.49 / 0.74 | -0.01 / +0.05 | +0.00 / +0.07 | +0.04 / +0.11 | +0.01 / +0.04 |
| 4 PCA auf 32 Dimensionen | 0.61 / 0.71 / 0.34 / 0.57 | 0.67 / 0.73 / 0.39 / 0.62 | 0.73 / 0.78 / 0.45 / 0.71 | 0.73 / 0.80 / 0.50 / 0.75 | +0.01 / +0.08 | +0.01 / +0.04 | +0.05 / +0.08 | +0.00 / +0.05 |
| 4 PCA auf 64 Dimensionen | 0.67 / 0.71 / 0.33 / 0.56 | 0.66 / 0.72 / 0.37 / 0.60 | 0.71 / 0.78 / 0.46 / 0.71 | 0.74 / 0.81 / 0.45 / 0.71 | +0.06 / +0.08 | +0.01 / +0.02 | +0.03 / +0.08 | +0.01 / +0.00 |
| 4w PCA mit Whitening auf 16 Dimensionen | 0.60 / 0.66 / 0.36 / 0.60 | 0.66 / 0.69 / 0.37 / 0.61 | 0.69 / 0.73 / 0.29 / 0.58 | 0.70 / 0.75 / 0.30 / 0.59 | -0.01 / +0.11 | +0.00 / +0.02 | +0.01 / -0.08 | -0.03 / -0.15 |
| 4w PCA mit Whitening auf 32 Dimensionen | 0.58 / 0.69 / 0.26 / 0.51 | 0.62 / 0.71 / 0.27 / 0.50 | 0.67 / 0.73 / 0.11 / 0.41 | 0.70 / 0.72 / 0.12 / 0.43 | -0.03 / +0.01 | -0.03 / -0.09 | -0.01 / -0.27 | -0.03 / -0.33 |
| 5 je GERATENER Sprache zentriert | – | 0.66 / 0.74 / 0.35 / 0.57 | – | 0.73 / 0.80 / 0.47 / 0.72 | – | +0.00 / -0.00 | – | +0.00 / +0.02 |
| 6a Nachbarn glätten (k=10, 50 %) | 0.67 / 0.70 / 0.36 / 0.59 | 0.69 / 0.73 / 0.39 / 0.62 | 0.75 / 0.79 / 0.46 / 0.72 | 0.77 / 0.81 / 0.48 / 0.74 | +0.07 / +0.11 | +0.04 / +0.04 | +0.07 / +0.08 | +0.04 / +0.03 |
| 6a' Nachbarn glätten, zweimal | 0.65 / 0.70 / 0.37 / 0.61 | 0.69 / 0.73 / 0.38 / 0.61 | 0.74 / 0.77 / 0.43 / 0.71 | 0.79 / 0.80 / 0.48 / 0.73 | +0.05 / +0.12 | +0.03 / +0.03 | +0.06 / +0.06 | +0.06 / +0.03 |
| 6b Clusterverfahren ward statt k-Means | – / – / 0.27 / 0.52 | – / – / 0.28 / 0.51 | – / – / 0.30 / 0.61 | – / – / 0.32 / 0.60 | – / +0.02 | – / -0.07 | – / -0.07 | – / -0.13 |
| 6b Clusterverfahren average statt k-Means | – / – / 0.00 / 0.13 | – / – / 0.31 / 0.50 | – / – / 0.00 / 0.23 | – / – / 0.39 / 0.66 | – / -0.25 | – / -0.04 | – / -0.37 | – / -0.06 |
| 6b Clusterverfahren spectral statt k-Means | – / – / 0.34 / 0.59 | – / – / 0.35 / 0.60 | – / – / 0.42 / 0.69 | – / – / 0.46 / 0.73 | – / +0.09 | – / +0.00 | – / +0.04 | – / +0.02 |
| 6d Frage davor + Nachbarn glätten | 0.64 / 0.66 / 0.22 / 0.42 | 0.69 / 0.71 / 0.33 / 0.54 | 0.64 / 0.66 / 0.13 / 0.42 | 0.76 / 0.77 / 0.45 / 0.68 | +0.04 / -0.03 | +0.04 / -0.02 | -0.04 / -0.24 | +0.03 / +0.01 |
| 6e Kombination: PCA 32 + Nachbarn glätten | 0.63 / 0.70 / 0.35 / 0.58 | 0.65 / 0.71 / 0.40 / 0.63 | 0.73 / 0.75 / 0.45 / 0.72 | 0.76 / 0.78 / 0.47 / 0.73 | +0.03 / +0.09 | -0.00 / +0.05 | +0.05 / +0.08 | +0.03 / +0.02 |
| 6f Kombination: Frage dahinter + PCA 32 + Nachbarn glätten | 0.67 / 0.73 / 0.26 / 0.45 | 0.69 / 0.75 / 0.48 / 0.69 | 0.70 / 0.74 / 0.18 / 0.46 | 0.78 / 0.80 / 0.50 / 0.74 | +0.07 / +0.00 | +0.04 / +0.12 | +0.02 / -0.19 | +0.05 / +0.05 |

## E Wie schwer ist der Korpus?

### Lexikalische Grundlinie (TF-IDF)

| Merkmale | Anzahl | alle 500 roh | alle 500 je Sprache zentriert | Mittel der 2 Wände roh | Mittel der 2 Wände zentriert |
|---|---|---|---|---|---|
| Wort 1–2-Gramme | 6007 | 0.21 / 0.24 / 0.00 / 0.17 | 0.21 / 0.23 / 0.00 / 0.18 | 0.34 / 0.35 / -0.00 / 0.26 | 0.33 / 0.35 / 0.01 / 0.28 |
| Zeichen 3–5-Gramme (char_wb) | 16725 | 0.26 / 0.28 / 0.00 / 0.18 | 0.28 / 0.31 / 0.01 / 0.19 | 0.36 / 0.37 / 0.00 / 0.27 | 0.36 / 0.40 / 0.01 / 0.29 |
| beides aneinandergehängt | 22732 | 0.24 / 0.28 / 0.00 / 0.17 | 0.24 / 0.29 / 0.01 / 0.19 | 0.33 / 0.37 / 0.00 / 0.27 | 0.34 / 0.39 / 0.00 / 0.27 |

### Eine Sprache allein (250 Zettel, 10 Themen, 25 je Thema)

Die gemischte Kontrolle hat dieselbe Größe (25 je Thema, beide Sprachen, je Sprache zentriert).

| Modell | Menge | roh | zentriert |
|---|---|---|---|
| voyage4nano-q8 (ohne Präfix) | de | 0.49 / 0.60 / 0.20 / 0.46 | 0.50 / 0.60 / 0.21 / 0.43 |
| voyage4nano-q8 (ohne Präfix) | en | 0.55 / 0.67 / 0.25 / 0.47 | 0.59 / 0.68 / 0.29 / 0.53 |
| voyage4nano-q8 (ohne Präfix) | gemischt (Kontrolle, Mittel aus 5 Ziehungen) | – | 0.58 / 0.68 / 0.28 / 0.50 |
| gemma2-q4 | de | 0.52 / 0.56 / 0.19 / 0.43 | 0.52 / 0.61 / 0.21 / 0.46 |
| gemma2-q4 | en | 0.57 / 0.63 / 0.23 / 0.46 | 0.58 / 0.65 / 0.28 / 0.52 |
| gemma2-q4 | gemischt (Kontrolle, Mittel aus 5 Ziehungen) | – | 0.59 / 0.66 / 0.26 / 0.50 |
| minilm-q8 | de | 0.34 / 0.40 / 0.13 / 0.37 | 0.33 / 0.42 / 0.12 / 0.34 |
| minilm-q8 | en | 0.45 / 0.51 / 0.16 / 0.40 | 0.48 / 0.54 / 0.15 / 0.39 |
| minilm-q8 | gemischt (Kontrolle, Mittel aus 5 Ziehungen) | – | 0.45 / 0.51 / 0.15 / 0.39 |
| TF-IDF Wort+Zeichen | de | 0.25 / 0.31 / 0.01 / 0.21 | 0.24 / 0.32 / 0.02 / 0.22 |
| TF-IDF Wort+Zeichen | en | 0.20 / 0.22 / 0.01 / 0.21 | 0.23 / 0.23 / 0.01 / 0.22 |

### Bezugspunkte mit Etiketten (je Sprache zentriert)

Nächster wahrer Themen-Schwerpunkt (leave-one-out): das wäre k-Means, wenn es die wahren Schwerpunkte fände. Lineare Sonde: 10-fach kreuzvalidiert.

| Vektoren | alle 500: Schwerpunkt-Trefferquote / ARI dieser Zuordnung / Sonde | Mittel der 2 Wände: Schwerpunkt-Trefferquote / ARI / Sonde |
|---|---|---|
| voyage4nano-q8 (ohne Präfix) | 0.78 / 0.58 / 0.83 | 0.84 / 0.63 / 0.86 |
| gemma2-q4 | 0.73 / 0.50 / 0.78 | 0.79 / 0.55 / 0.84 |
| minilm-q8 | 0.62 / 0.34 / 0.64 | 0.70 / 0.39 / 0.72 |
| TF-IDF Wort+Zeichen | 0.36 / 0.11 / 0.34 | 0.44 / 0.12 / 0.44 |

Übersetzungspaare (voyage4nano-q8 (ohne Präfix), alle 500, je Sprache zentriert): 100 Zettel haben einen Paarpartner; ihre 1-NN-Trefferquote ist 0.97, die der übrigen 0.59; bei 92% der Paar-Zettel ist der Partner der nächste Nachbar.

### Fehler beim nächsten Nachbarn (voyage4nano-q8 (ohne Präfix), je Sprache zentriert)

166 von 500 Zetteln haben einen nächsten Nachbarn aus einem anderen Thema; davon 47 über die Wandgrenze, 64 mit Nachbar in der anderen Sprache.

Häufigste Verwechslungen: onboarding/team ↔ stadtteil/events (12); onboarding/access ↔ onboarding/firsttasks (12); stadtteil/events ↔ stadtteil/shops (11); onboarding/access ↔ onboarding/docs (10); onboarding/firsttasks ↔ onboarding/mentoring (10); stadtteil/sharing ↔ stadtteil/shops (10); stadtteil/events ↔ stadtteil/mobility (9); onboarding/mentoring ↔ onboarding/team (9); onboarding/access ↔ onboarding/team (7); stadtteil/issues ↔ stadtteil/sharing (6); onboarding/mentoring ↔ stadtteil/sharing (6); onboarding/docs ↔ onboarding/team (6)

| Zettel | Thema | nächster Nachbar | dessen Thema | cos |
|---|---|---|---|---|
| check-ins faded after week three | onboarding/mentoring | the schedule stopped after week one, then silence | onboarding/firsttasks | 0.427 |
| Welche Baustelle sperrt gerade welche Straße? | stadtteil/mobility | Leerstand in der Hauptstraße, was kommt da rein? | stadtteil/shops | 0.422 |
| Tauschregal für Kinderkleidung | stadtteil/sharing | Kinderprogramm nach Alter filtern | stadtteil/events | 0.342 |
| people who start in the same month could share a mentor and meet as a small group every fortnight | onboarding/mentoring | group chat for everyone who joined in the same quarter | onboarding/team | 0.409 |
| My account was cloned from a colleague's, so I could suddenly see salary folders I really shouldn't have | onboarding/access | folder names on the shared drive make no sense to outsiders | onboarding/docs | 0.349 |
| Zweiter Monitor fehlt | onboarding/access | no runbook for outages | onboarding/docs | 0.287 |
| Bitte ein FAQ mit den Fragen, die wirklich jeder stellt | onboarding/docs | Kanal für Anfängerfragen, in dem garantiert jemand antwortet | onboarding/mentoring | 0.506 |
| Bei der Stadt anrufen bringt nichts, da geht nie einer ran | stadtteil/issues | All the social calls are at six in the evening my time, so I've been to exactly none of them | onboarding/team | 0.35 |
| cheat sheet for my desk | onboarding/docs | Proper chair and desk, please | onboarding/access | 0.397 |
| Am dritten Tag sollte ich allein einen Fehler in der Abrechnung suchen, ohne das System je gesehen zu haben | onboarding/firsttasks | Rechte kamen scheibchenweise, jeden Tag eine neue Fehlermeldung | onboarding/access | 0.416 |
| Rückmeldung, wenn der Schaden behoben ist, wäre ein Traum | stadtteil/issues | What happens when a borrowed item comes back broken? | stadtteil/sharing | 0.353 |
| train strike alerts | stadtteil/mobility | Where are old training recordings? | onboarding/docs | 0.234 |
| The council's own form has fourteen mandatory fields and wants my date of birth, please don't copy that | stadtteil/issues | Hilfe beim Ausfüllen von Formularen und Anträgen anbieten | stadtteil/sharing | 0.327 |
| Nachtbus am Wochenende | stadtteil/mobility | Laternenumzug: Route und Uhrzeit | stadtteil/events | 0.448 |
| My goals were copied from the previous hire, who had a completely different role, and nobody noticed for weeks | onboarding/firsttasks | Wer eine Stelle übernimmt, sollte die Rechte des Vorgängers einfach erben können, statt alles einzeln neu zu beantragen | onboarding/access | 0.395 |
| Blumenladen liefert jetzt auch | stadtteil/shops | Wer gießt meine Blumen, wenn ich im Urlaub bin? | stadtteil/sharing | 0.442 |
| skip-level chat after two months | onboarding/mentoring | Zwei Wochen nur lesen ist zu lang | onboarding/firsttasks | 0.321 |
| Die Konzertplakate an der Litfaßsäule liest keiner mehr, und der Schaukasten vom Bürgerverein zeigt noch das Programm von Ostern | stadtteil/events | Viele Wirte haben nach dem Umbau der Straße Gäste verloren, eine Aktionswoche mit allen zusammen könnte helfen | stadtteil/shops | 0.275 |
| photos after the festival | stadtteil/events | Foto machen, Standort dazu, abschicken, fertig | stadtteil/issues | 0.384 |
| Ich hätte mir jemanden gewünscht, der regelmäßig von sich aus fragt, wie es läuft, statt darauf zu warten, dass ich mich melde | onboarding/mentoring | Bei uns im Haus wohnen viele Alleinstehende, eine Funktion für kurzes Nachfragen, ob alles in Ordnung ist, wäre schön | stadtteil/sharing | 0.42 |
| Drucker einrichten war Glückssache | onboarding/access | Pfand oder Kaution für teure Geräte, sonst traut sich keiner, die gute Kamera oder den Beamer herzugeben | stadtteil/sharing | 0.232 |
| Wo gibt's noch Schuster? | stadtteil/shops | Who do I even talk to if I want to put on a small gig in the square next summer? | stadtteil/events | 0.18 |
| Bücherschrank digital: sehen, was gerade drinsteht | stadtteil/sharing | Der Buchhändler bestellt alles bis morgen, das weiß nur keiner | stadtteil/shops | 0.519 |
| Kinoabend im Park wiederholen! | stadtteil/events | park and ride info | stadtteil/mobility | 0.433 |
| Headset wäre nett gewesen | onboarding/access | An Bürotagen sitzt jeder mit Kopfhörern da, keiner redet | onboarding/team | 0.349 |
| Kleine Willkommenskarte am Platz | onboarding/team | Stempelkarte fürs ganze Viertel statt zehn einzelner im Portemonnaie | stadtteil/shops | 0.381 |
| Pub quiz every other Thursday | stadtteil/events | pubs showing the football | stadtteil/shops | 0.289 |
| Einmal alle Stationen durchlaufen: Support, Vertrieb, Entwicklung, je ein Tag | onboarding/firsttasks | Mitfahrgelegenheit zur Arbeit, täglich dieselbe Strecke | stadtteil/mobility | 0.296 |
| once a year publish the numbers, how many things were flagged, how many got fixed and how long it took | stadtteil/issues | Doku einmal im Quartal aufräumen und Altes löschen | onboarding/docs | 0.284 |
| show when the church hall is free to hire | stadtteil/events | show me where there's a free space to park right now | stadtteil/mobility | 0.312 |

