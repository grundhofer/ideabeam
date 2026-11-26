# Die Fläche auf dem Pixel 5: 500 Zettel schieben und zoomen

Gemessen am 23.11.2026. Abnahmepunkt aus Etappe 2 (PLAN.md, Abschnitt 6): Mit 500 Zetteln laufen Schieben und
Zoomen auf dem Pixel 5 mit mindestens 30 Bildern pro Sekunde.

**Ergebnis: erfüllt.** Schieben läuft mit 88 Bildern pro Sekunde, Zoomen mit 61 bis 67, einen Zettel ziehen mit 50
bis 52. Rohdaten: [`roh/pixel5-flaeche.json`](roh/pixel5-flaeche.json).

## Aufbau

- **Gerät:** Pixel 5 („redfin“) an der Fleet, Android 14, Chrome 153. Fenster 392 × 721 CSS-Pixel, die Fläche
  darin 359 × 224. Der Bildschirm kann 90 Hz.
- **Stand:** die Vorschau mit Etappe 3 (`83a3a6e`).
- **Wände:** eine mit 500 Zetteln in einem Block, eine mit 500 Zetteln in 40 Gruppen, beide mit
  `scripts/seed-wall.mjs` gefüllt und danach gelöscht.
- **Gesten:** über das DevTools-Protokoll von Chrome, per adb. Schieben mit zwei Fingern als einzelne
  Berührungsereignisse, rund 60 je Sekunde. Zoomen und Ziehen mit den Gesten, die Chrome selbst erzeugt
  (`Input.synthesizePinchGesture`, `Input.synthesizeScrollGesture`).
- **Bildzeiten:** in der Seite gezählt, ein Eintrag je `requestAnimationFrame`. Jede Messung dauert 8 bis 11
  Sekunden.
- **Kontrolle:** Vor und nach jeder Messung liest das Werkzeug die Lage aller Zettel. So steht fest, ob eine Geste
  die Fläche bewegt hat oder einen Zettel.

## Zahlen

| Wand | Zoom | Geste | Zettel im Bild | Bilder/s | Median | 95 % | 99 % | längstes Bild |
|---|---|---|---|---|---|---|---|---|
| Block | 0,05 (alles) | Schieben, zwei Finger | 376 bis 498 | 88 | 11 ms | 11 ms | 22 ms | 45 ms |
| Block | 0,05 bis 0,31 | Zoomen | 498, dann 30 bis 196 | 67 | 11 ms | 22 ms | 56 ms | 89 ms |
| Block | 0,24 | Schieben, zwei Finger | 42 bis 49 | 88 | 11 ms | 11 ms | 22 ms | 44 ms |
| Block | 0,24 bis 0,78 | Zoomen | 9 bis 49 | 66 | 11 ms | 22 ms | 45 ms | 67 ms |
| Block | 0,24 | einen Zettel ziehen | 49 | 50 | 17 ms | 50 ms | 67 ms | 67 ms |
| Block | 0,91 | Schieben, zwei Finger | 6 bis 9 | 88 | 11 ms | 11 ms | 22 ms | 33 ms |
| Block | 0,91 | einen Zettel ziehen | 9 | 52 | 17 ms | 50 ms | 56 ms | 134 ms |
| 40 Gruppen | 0,24 | Schieben, zwei Finger | 32 bis 39 | 88 | 11 ms | 11 ms | 22 ms | 33 ms |
| 40 Gruppen | 0,24 bis 2 | Zoomen | 2 bis 39 | 61 | 11 ms | 56 ms | 89 ms | 156 ms |

Ein Durchgang mit einem Finger auf freiem Grund, während alle 500 Zettel im Bild lagen, kam auf 60 Bilder pro
Sekunde (95 %: 45 ms). In diesem Durchgang ist die Last des Messwerkzeugs mitgezählt, siehe unten.

## Was die Zahlen nicht sagen

- **Kein echter Finger.** Die Gesten sind erzeugt. Eine Hand auf dem Glas hat niemand geprüft.
- **Das Messwerkzeug kostet selbst Bilder.** Vor jedem Ziehen sucht es in der Seite einen Startpunkt und zählt die
  Zettel im Bild. Das läuft im selben Thread wie die App. Die Zeilen „einen Zettel ziehen“ und der Durchgang mit
  einem Finger sind deshalb schlechter, als die App allein wäre. Beim Schieben mit zwei Fingern fällt das kaum an.
- **Eine ganze Gruppe ziehen** ist geprüft, aber nicht gemessen: Die Gruppe wandert mit ihren 12 Zetteln. Eine
  Bildrate dazu gibt es nicht.
- **Kalt gemessen:** Gerät am Ladekabel, kein Dauerlauf, kein Energiesparmodus.

## Nebenbei gesehen

1. **Die Aktionsleiste überdeckt den unteren Rand der Fläche.** Auf dem Handy liegt die klebende Leiste mit „Neuer
   Zettel“ über den unteren rund 44 Pixeln der Fläche, solange die Seite nicht gescrollt ist.
2. **„Alles zeigen“ zeigt auf dem Handy nicht immer alles.** Die kleinste Zoomstufe ist 0,05. Eine Wand mit 40
   Gruppen nebeneinander ist dann noch 1.600 Pixel breit, die Fläche 359. Gezeigt wird die Mitte. Liegt ein
   einzelner Zettel weit abseits, kann die Mitte leer sein.
3. **Nach dem Zoomen meldete das Werkzeug auf der Gruppen-Wand drei veränderte Zettel.** Auf der Block-Wand ist das
   in zwei Messungen nicht passiert. Ungeklärt. Der Code der Fläche bricht ein begonnenes Ziehen ab, sobald ein
   zweiter Finger aufsetzt, und sendet dann nichts. Das Werkzeug vergleicht die Zettel der Reihe nach: Drei
   zusätzliche Elemente im Dokument hätten dasselbe Ergebnis gegeben, etwa ein Schreibfeld nach einem Doppeltipp
   auf freien Grund. Welche der beiden Erklärungen stimmt, ist nicht nachgeprüft.
4. **Alle 540 Elemente bleiben im Dokument,** auch außerhalb des Bildes. Für 500 Zettel reicht das, wie die Zahlen
   zeigen.
5. **Ein Hänger gehörte dem Werkzeug, nicht der App:** Nach einem Seitenwechsel über das DevTools-Protokoll kamen
   keine Berührungen mehr an. Nach einem normalen Öffnen der Wand verschob eine Wischgeste des Systems
   (`adb shell input swipe`) die Fläche um genau die gewischte Strecke.

## Was es die Vorschau gekostet hat

Drei Wände vom Tagesbudget (eine davon für eine verworfene erste Runde), rund 1.700 geschriebene Zeilen. Die erste
Runde ist verworfen, weil ihre Wischgesten Zettel statt der Fläche verschoben hatten.
