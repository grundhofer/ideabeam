# IdeaBeam: Umsetzungsplan

Stand: 23.11.2026 · Status: Etappen 1 bis 4b gebaut und am 24.11.2026 auf dein Wort in `main` übernommen; 4b noch nicht gemessen · Ordner `vibe-ai` · Name „IdeaBeam“ (Namensrecherche steht aus)

Eine Brainstorming-Wand ohne Konto: Raum-Link teilen, alle schreiben Zettel, und eine KI ordnet sie nach
Bedeutung. Die KI rechnet im Gratis-Kontingent von Cloudflare Workers AI, ohne Speicherung und ohne Training. Wer
das nicht will, ordnet im Browser oder mit einem eigenen Schlüssel bei einem Anbieter in der EU. Schwesterprojekt
von RetroBeam.

> **Stand 22.11.2026: Etappe 0 ist gemessen, die Richtung ist neu entschieden.** Im Browser hält kein Modell die
> Qualitätsschwelle. Du hast entschieden: Das Ordnen rechnet bei Cloudflare Workers AI, der Browser ist Reserve,
> ein eigener Schlüssel ist möglich, eine bezahlte Stufe kommt später (7.2, Nr. 8 bis 10). Umgeschrieben sind dafür
> 1.5, 2, 3.2, 3.5, 3.6, 4, 6 und 7. Die Berichte: [docs/messung.md](docs/messung.md),
> [docs/messung-0b.md](docs/messung-0b.md), [docs/ki-anbieter.md](docs/ki-anbieter.md).
>
> Was Etappe 0 im Browser ergab:
>
> - **Gerissen:** Kein Kandidat erreicht ARI ≥ 0,5. Erstwahl MiniLM 0,19, bestes Modell `voyage-4-nano`
>   (243 MB, braucht WebGPU) 0,35 auf 500 Zetteln und 0,45 auf einer einzelnen Wand.
> - **Gestrichen:** Average Linkage mit Silhouette-Schnitt, der Rückfall „nach Stichwörtern ordnen“, Dubletten per
>   Schwelle, Überschriften aus Schlüsselwörtern.
> - **Bestätigt:** Hosting in Teilen unter 25 MiB (4.4), dazu gzip. WASM-Threads und WebGPU in Chrome und Safari.
>   Das gekürzte Vokabular: 36 statt 150 MB Download, halber Speicher. Die neue Reserve braucht es nicht.
> - **Nicht gemessen und zurückgestellt:** Android, iPhone, die volle Safari-Reihe. Sie betreffen nur noch die
>   Reserve im Browser.
>
> **Etappe 1 (Gerüst) ist gebaut,** auf dem Zweig `etappe-1`, lokal: Wand anlegen, beitreten, sehen, wer da ist,
> Moderationslink, löschen, Löschfrist. Alle Prüfungen sind grün. Eine Vorschau läuft auf workers.dev
> (`sh scripts/preview-deploy.sh`). Abgenommen ist die Etappe noch nicht (Abschnitt 6, Etappe 1).
>
> **Etappe 0b (Nachmessung):** Ein starkes Sprachmodell ordnet den Korpus blind mit ARI 0,84 und 0,93. Kleine
> Sprachmodelle bis 1,5 GB bleiben unter 0,11. Bei Cloudflare erreicht `gemma-4-26b-a4b-it` 0,80 und 0,86, in rund
> einer halben Minute und für 187 Neuronen je Wand mit 250 Zetteln.

**Grundlagen dieses Plans**

- RetroBeam gelesen bei Commit `fafe070` (README, PLAN, `docs/02`, `docs/04`, `docs/06`, `apps/web`, `apps/worker`,
  `packages/shared`, `sebaro.product.json`). RetroBeam wurde nicht verändert.
- sebaro: Blueprint `50b9eed` (Kernregeln, Sichten, `design/platforms/webapp.md`, Bauteil „Collaboration“) und der
  Technikplan `templates/webapp-vite/BLUEPRINT.md` aus der Foundry v3.0.0. Beides wurde heute neu veröffentlicht.
- Vier Recherche-Läufe vom 21.11.2026 gegen Originalquellen (Preisseiten, Lizenzdateien, npm, Hugging Face,
  Cloudflare-Doku). Ich habe ihre Ergebnisse nicht ein zweites Mal gegengeprüft. Was dort offen blieb, steht in
  Abschnitt 8.
- **Gemessen ist noch nichts.** Alle Zeiten in diesem Plan sind Zielwerte oder Rechnungen. Die Messung ist Etappe 0.

## Kurzfassung

| Thema | Entscheidung |
|---|---|
| Winkel | KI-Ordnen gratis und ohne Konto, ohne Training und ohne Speicherung. Auf Wunsch ganz im Browser oder beim eigenen Anbieter in der EU. |
| v0.1 | Link teilen → verdeckt schreiben → aufdecken → „Ordnen“ → Gruppen mit Überschriften → Markdown. |
| Canvas | Eigene DOM-Fläche, neu geschrieben nach RetroBeams Muster. Keine Canvas-Bibliothek. |
| Sync | Server-autoritative Befehle mit optimistischem Echo, kein CRDT (wie RetroBeam). |
| Modell | Standard `@cf/google/gemma-4-26b-a4b-it` bei Cloudflare Workers AI: ARI 0,83, 93 % richtig einsortiert. Reserve im Browser `voyage-4-nano`: ARI 0,45, 71 %. |
| Verfahren | Das Sprachmodell findet Themen aus allen Zetteln und ordnet dann in Stapeln zu. Die Moderation sieht den Vorschlag, bevor er gilt. |
| KI-Kosten | 0 $. Das Tagesbudget reicht für rund 65 übliche Wände (60 Zettel, zweimal ordnen). Danach ordnet die Reserve im Browser. |
| Serverkosten | Gratis bis etwa 250 Wände am Tag, 5,30 $ im Monat bei 1.000, rund 50 bis 95 $ bei 10.000. |
| Lizenz | AGPL-3.0-or-later mit CLA, wie RetroBeam. |
| Adresse | Bis zum Start die workers.dev-Adresse. Taugt das Produkt, bekommt es eine eigene Domain. vibe-ai.de bleibt unberührt. |
| Aufwand v0.1 | 22,5 Arbeitstage geschätzt, 38 geplant (×1,7). Etappe 0 ist erledigt. |

---

## 1 Konkurrenzcheck und unser Winkel

Preise wie am 21.11.2026 auf den Anbieterseiten gezeigt (meist USD, Abruf aus den USA).

### 1.1 Mit KI-Clustering

| Produkt | Funktion | Wo die KI läuft | Plan und Preis | Gäste ohne Konto |
|---|---|---|---|---|
| Miro | „Cluster“ nach Stichwort oder Stimmung | Cloud (Miro-Modelle oder Azure OpenAI), Verarbeitung auch außerhalb der gewählten Region | Als einziger im Gratisplan, mit Credits (Seite nennt „limited trial“ und „10 Credits/Monat“). Starter 8 $/Monat, 25 Credits | Bearbeiten nur in Bezahlplänen, gratis nur ansehen, 3 Boards |
| FigJam | Zettel nach Thema sortieren, zusammenfassen | Cloud, Eingaben gehen an OpenAI | Nur Bezahlpläne, Sitz ab 3 $/Monat, 500 Credits | Offene Sitzung 24 h, nur Bezahlpläne, dort **ohne** KI |
| Mural | „Cluster by topic“, Stimmung | Cloud (Azure OpenAI, Stand 2023) | Nicht gratis. Team+ 9,99 $/Monat | Besucher-Link, gratis nur ansehen |
| Lucidspark | „Sort ideas“ | Cloud (Azure OpenAI, AWS Bedrock) | Preis nicht prüfbar | Nur Team und Enterprise |
| Stormboard | „Group by Theme/Sentiment“ | Cloud, Partner ungenannt | Business 8,33 bis 10 $/Monat | Keine Gäste im Gratisplan |
| Klaxoon | „Group by topic“ | Azure OpenAI, in Europa gehostet | Starter 24,90 $/Monat je Gastgeber | Mit Spitznamen, wenn freigeschaltet |
| Microsoft Whiteboard | Copilot „Categorize“ | Cloud, EU Data Boundary | Braucht Copilot-Lizenz, 18 $/Monat | Nicht geprüft |
| Jeda.ai | Cluster nach Thema, Stimmung, Priorität | Cloud-LLMs | „Free / 10 $“ | Nicht geprüft |
| Canva Whiteboards | Sortieren „By topic“ | Nicht prüfbar | Nicht prüfbar | Nicht geprüft |

Retro-Werkzeuge mit KI-Gruppierung: Parabol (Team, 8 $/Monat), TeamRetro (ab 250 $/Jahr), Kollabe (29 $/Monat).
Alle in der Cloud.

### 1.2 Ohne KI-Clustering

Excalidraw und Excalidraw+ (KI nur Text-zu-Diagramm), tldraw.com, Ideaflip, Whimsical, Padlet (KI-Seitenleiste am
6.11.2026 eingestellt), IdeaBoardz. Die beiden in der EU gehosteten Whiteboards **Conceptboard** und **Collaboard**
haben kein Clustering.

### 1.3 Lokal im Browser

Kein kommerzielles Produkt. Drei kleine Einzelnutzer-Experimente: `sticky-insights` (MiniLM über transformers.js,
0 Sterne, MIT), „Semantic Sticky Board“ (Chromes experimentelle Embedder-API), `splat` (nur Suche, GPL-3.0). Keines
ist kollaborativ, keines speichert.

### 1.4 Häufige Klagen über die Großen

Miro blockiert im Gratisplan das vierte Board. Gäste werden trotz Link zur Anmeldung gedrängt. FigJams 24-Stunden-
Grenze gilt als K.-o.-Kriterium. Miro-Credits sind „in zwei Tagen“ verbraucht. Miro speichert in den USA.

### 1.5 Unser Winkel

1. **KI-Ordnen ohne Training und ohne Speicherung, mit Wahl.** Der Standard rechnet bei Cloudflare, dem Dienst, bei
   dem die Wand ohnehin liegt. Wer mehr will, ordnet ganz im Browser oder beim eigenen Anbieter in der EU. Die alte
   Aussage „kein Zetteltext geht an einen KI-Anbieter“ gilt seit dem 22.11.2026 nur noch für „im Browser ordnen“
   (7.2, Nr. 8).
2. **Gratis ohne Credits**, solange das Tageskontingent reicht. Danach ordnet die Reserve im Browser (3.6, 4.2).
3. **Ohne Konto für alle**, auch für die Moderation, ohne 24-Stunden-Grenze.
4. **Geführter Ablauf**: verdeckt schreiben, aufdecken, ordnen. Verdeckt heißt serverseitig erzwungen. Die
   Whiteboards haben das nicht.
5. **Deutsch und Englisch gemischt** auf einer Wand, Speicherung in der EU.

Ehrliche Grenzen: Der Standard rechnet nicht sicher in der EU. Das Tageskontingent ist endlich. Die Reserve im
Browser ordnet deutlich schlechter und lädt einmal rund 220 MB. Die Wand ist kein allgemeines Whiteboard: kein
Zeichnen, keine Formen, keine Verbinder.

---

## 2 Umfang

### 2.1 Schnittlinie v0.1

**Ein Team kommt vom Link zur geordneten, exportierten Wand, und die KI war der Schritt dazwischen.** Alles, was
dafür nicht nötig ist, wartet.

| Bereich | In v0.1 |
|---|---|
| Zugang | Wand anlegen ohne Konto, Link und QR-Code, Name eingeben, Moderationsrecht per Admin-Token und Moderationslink |
| Fläche | Verschieben, Zoomen (Maus, Trackpad, Zwei-Finger, Tastatur), „Alles zeigen“, Zettel anlegen, ändern, löschen, bewegen, Mehrfachauswahl, Gruppen als benannte Rahmen, Listenansicht derselben Wand |
| Ablauf | Schreiben (verdeckt, beim Anlegen abschaltbar) → Aufdecken → Ordnen |
| KI | „Ordnen“ auf Knopfdruck: Vorschlag als Vorschau, „Anwenden“ mit Bewegung, formulierte Überschriften in der Sprache der Wand, „Rückgängig“, von Hand gebaute Gruppen bleiben unberührt. Gerechnet wird bei Cloudflare Workers AI (4.2) |
| Wahl | „Im Browser ordnen“ (nichts geht an einen KI-Dienst) und „Eigener Schlüssel“ für einen Anbieter in der EU (4.4, 4.5) |
| Rückfall | Kontingent aufgebraucht oder Dienst gestört: Reserve im Browser, sonst Ordnen von Hand |
| Vorlage | Brainstorming: eine Frage als Titel, leere Fläche |
| Export | Markdown: Gruppen als Überschriften |
| Grundlagen | Deutsch und Englisch, sebaro, Tastaturbedienung, EU-Speicherung, Löschung nach 30 Tagen, Impressum, Datenschutz, Barrierefreiheit |

### 2.2 v0.2

| Idee | Anmerkung |
|---|---|
| Blind-Voting mit Top-N, Aufgaben | Muster aus RetroBeam |
| Vorlagen SWOT, Lean Canvas, Pre-Mortem | Vorbelegte, feste Gruppen |
| Regler „gröber/feiner“ | Das Modell legt Themen zusammen oder teilt sie. Ein kurzer Aufruf über die Themenliste, ohne die Zettel neu zu lesen |
| Bezahlte Stufe | Ordnen garantiert in der EU, ohne Speicherung. Entschieden: erst nach v0.1 (7.2, Nr. 9) |
| Dubletten finden und stapeln | Per Schwelle auf Einbettungen geht es nicht (Messung). Neu zu prüfen: das Sprachmodell markiert sie beim Zuordnen |
| Ähnliches hervorheben | Braucht Einbettungen, also die Reserve im Browser. Offen, ob es das wert ist |
| Suche nach Bedeutung | Wie oben |
| „Neue Zettel einsortieren“ | Ein Aufruf mit den bestehenden Themen und nur den neuen Zetteln |
| Live-Zeiger | 1 Hz mit Tagesbudget wie RetroBeam |
| Minimap | Erst nötig bei großen Wänden |
| Export PNG und PDF, Ergebnis-Link | Ergebnis-Link ist die Wand nur zum Lesen |
| Austausch mit RetroBeam | Import von RetroBeams JSON-Export (Spalten werden Gruppen), Export im selben Format |

### 2.3 Später

| Idee | Warum später |
|---|---|
| Lücken-Hinweis gegen Vorlage | Braucht Vorlagen mit beschriebenen Feldern |
| Brainwriting 6-3-5 | Eigene Rundenmechanik, kein Flächen-Feature |
| Rechen-Helfer | Ein anderes Gerät im Raum rechnet für die Moderation. Nur noch für die Reserve im Browser von Belang |
| Sprachzettel | whisper-base 77 MB, deutsche Wortfehlerrate laut Whisper-Paper 18 bis 25 %. Erst Prototyp |
| Foto echter Post-its | Handschrift ist bei telefontauglichen Modellgrößen unzuverlässig. Erst Prototyp. Das Foto darf das Gerät nie verlassen |
| Zettel-Farben | Entschieden: v0.1 ohne. Später höchstens eine Kategorie als Zeichen und Wort, passend zu sebaro |

### 2.4 Bewusst nicht

Zeichnen, Formen, Verbinder, Konten, Datei-Uploads auf den Server. KI-Dienste, die mit den Zetteln trainieren oder
sie speichern.

---

## 3 Canvas, Architektur, Datenmodell, Sync

### 3.1 Canvas-Entscheidung

| | Eigene DOM-Fläche | tldraw 5.6.2 | Excalidraw 0.18.1 | React Flow 13 |
|---|---|---|---|---|
| Lizenz | Kein Konflikt | Proprietär. Produktion braucht einen Schlüssel, die Hobby-Lizenz erzwingt das Wasserzeichen und gilt nur nach Antrag. Die Lizenz verbietet eine übergeordnete Lizenz, die AGPL verlangt das Gesamtwerk | MIT | MIT, Hinweis-Einblendung auf Bitte |
| Größe (gzip) | etwa 0 | 555 KB | 353 KB und mehr, dazu 13 MB Schriften | 88 KB |
| Sync mit Lese-Filter je Empfänger | Eigenes Protokoll, voll filterbar | Vorlage für Durable Objects vorhanden, aber derselbe Diff geht an alle. Kein Lese-Filter | Eigener Sync nötig | Eigenes Protokoll, voll filterbar |
| Barrierefreiheit | DOM-Elemente, selbst zu bauen | Gut dokumentiert | Canvas-gezeichnet, Inhalte für Screenreader kaum erreichbar | Gute Tastaturbedienung |
| sebaro-Optik | Voll | Hoch, aber fremde Oberfläche | Feste Schriftliste, eigene Schrift nicht möglich | Voll |
| Risiko | Aufwand | Lizenz | Kampf gegen das Design | Auf Knoten und Kanten ausgelegt |

**Entscheidung: eigene DOM-Fläche, in vibe-ai neu geschrieben nach RetroBeams Muster.**

- Nur sie erfüllt alles zugleich: AGPL, serverseitig erzwungenes Verbergen, sebaro ohne zweites Designsystem. Der
  sebaro-Technikplan verlangt bei „UI-Bibliothek“ und „zweites Designsystem“ ohnehin deine Freigabe.
- Das Startbudget des Technikplans (250 KB JavaScript gzip) schließt tldraw und Excalidraw praktisch aus.
- RetroBeams `BoardCanvas.tsx` wird nicht ausgebaut, sondern dient als Vorlage. Sein Modell passt nicht: feste Welt
  von 1600 × 1000, Zonen als Spalten, Zettelposition als Bruchteil der Zone. Außerdem darf RetroBeam nicht verändert
  werden.
- Keine Zoom-Bibliothek zum Start. RetroBeams Rad- und Zoom-Rechnung wird übernommen, Zwei-Finger-Zoom kommt dazu.
- **Plan B:** Kosten Auswahl, Tastatur und Minimap in Etappe 2 mehr als das Doppelte der Schätzung, wechselt die
  Fläche auf React Flow. Es rendert DOM-Knoten und lässt Protokoll und Datenmodell unberührt.

„Unendlich“ heißt: keine feste Welt. Koordinaten sind ganze Welteinheiten, praktisch begrenzt auf ±50.000. Eine
Einheit ist 1/16 rem, damit Zettel bei großer Schrift nicht überlappen (sebaro „Collaboration“). Gemessene
Obergrenze: 500 Zettel je Wand.

### 3.2 Architektur

```
Browser (React-SPA, sebaro)
 ├─ Fläche und Liste: zeichnen denselben Zustand
 ├─ „Ordnen“ (nur Moderation, erst nach dem Aufdecken): fragt den Worker, zeigt den Vorschlag als Vorschau
 ├─ Web Worker „Reserve“ (nur auf Wunsch oder wenn das Kontingent leer ist)
 │    transformers.js → Einbettungen → Gruppen; Modell kommt von der eigenen Domain
 ├─ „Eigener Schlüssel“: derselbe Ablauf, aber der Browser fragt den Anbieter der Moderation direkt
 └─ WebSocket (partysocket)
        ▼
Cloudflare Worker (Hono)
 ├─ POST /api/walls              Wand anlegen, Admin-Token prägen (Bremse je IP)
 ├─ GET  /api/walls/:id          Name und Zustand für die Beitrittsseite
 ├─ GET  /api/walls/:id/export   Markdown, durch denselben Sichtfilter
 ├─ GET  /api/walls/:id/ws       WebSocket-Upgrade
 └─ POST /api/walls/:id/arrange  nur mit Admin-Token: Budget prüfen → Zettel aus dem WallRoom lesen →
        │                        Workers AI fragen (Bindung „AI“) → Vorschlag prüfen → zurück an die Moderation
        ▼
WallRoom Durable Object (eines je Wand, SQLite, Jurisdiktion „eu“)
 ├─ WebSocket Hibernation API, Ping/Pong per Auto-Response
 ├─ ein Alarm-Platz: Löschfrist
 └─ kein setTimeout, kein setInterval, keine ausgehenden Aufrufe (auch nicht an die KI: das tut der Worker)
RateLimiter Durable Object (Bremse je IP, Tagesbudgets, neu: Neuronen-Zähler für die KI)
```

Aufteilung wie RetroBeam: `apps/web`, `apps/worker`, `packages/shared` (zod-Protokoll und alle Regeln als reine
Funktionen). Neu ist `packages/arrange`: Prompts bauen, Antworten prüfen, Gruppen für die Reserve bilden und die
Anordnung rechnen, alles als reine Funktionen ohne DOM und ohne Modell. Worker und Browser nutzen dasselbe Paket. Das
hält die KI-Logik in Node testbar und macht sie später für RetroBeams Gruppierphase nutzbar.

**Wer rechnet was**

| Schritt | Standard | „Im Browser ordnen“ | „Eigener Schlüssel“ |
|---|---|---|---|
| Text der Zettel speichern, verbergen, aufdecken | Server | Server | Server |
| Themen finden, Zettel zuordnen, Überschriften | Workers AI, gefragt vom Worker | Browser der Moderation | Anbieter der Moderation, gefragt vom Browser |
| Vorschlag prüfen und als Vorschau zeigen | Worker, dann Browser der Moderation | Browser der Moderation | Browser der Moderation |
| Anordnung rechnen | Browser der Moderation | Browser der Moderation | Browser der Moderation |
| Ergebnis prüfen (Rolle, Phase, Grenzen), speichern, verteilen | Server | Server | Server |
| Bewegung zeichnen | Jeder Browser | Jeder Browser | Jeder Browser |

Alle drei Wege enden in derselben Nachricht `admin.arrange.apply`. Der Server muss nicht wissen, wer gerechnet hat.
Wer später beitritt, bekommt Gruppen und Überschriften vom Server und braucht kein Modell.

**Der Prompt entsteht auf dem Server.** `/arrange` nimmt keinen Text vom Client an. Der Worker liest die Zettel
selbst aus dem WallRoom. Sonst wäre die Route eine offene Gratis-KI für jeden, der eine Wand anlegt.

### 3.3 Datenmodell (SQLite im WallRoom)

```
meta          key, value          Name, Frage, Phase, verdeckt ja/nein, Sprache, Löschfrist,
                                  Schema-Version, laufende Nummer (seq)
participants  id, name, role, session_key, online, demoted, joined_at, last_seen
notes         id, author_id, text, x0, y0, created_at, updated_at
groups        id, title, title_source ('ki' | 'person'), locked, x, y, w, h, ord
layout        k, v                'pos' = JSON { zettelId: [x, y, gruppeId] }
                                  'pos.prev' = Stand vor dem letzten Ordnen (für „Rückgängig“)
votes, actions                    erst v0.2
```

- **Die Lage aller Zettel steht in einem Datensatz.** Auf dem Free-Tier begrenzen die geschriebenen Zeilen zuerst
  (3.6). Ein Zettel anlegen schreibt eine Zeile (`notes` mit `x0, y0`). Jede Bewegung schreibt eine Zeile (`layout`).
  Ordnen von 500 Zetteln schreibt zwei Zeilen statt 500. Der Datensatz bleibt klein: 500 Zettel sind etwa 22 KB.
- Präsenz und Zeiger werden nie gespeichert.
- Grenzen: 500 Zettel, 300 Zeichen je Zettel, 80 Gruppen, Titel 60 Zeichen, Nachricht höchstens 256 KB.
- Löschung per Alarm nach 30 Tagen, verlängerbar und sofort löschbar durch die Moderation. RetroBeam nutzt 90 Tage.
  30 Tage halten den Speicher klein (3.6).

### 3.4 Sync-Protokoll

Wie RetroBeam, weil die Gründe dieselben sind: Zettel haben einen Autor und werden nicht gleichzeitig getippt.
Phasen, Rechte und das Verbergen sind Regeln, die ein CRDT nicht durchsetzt. Für Yjs bestätigt dessen Autor, dass
Teilzugriff auf ein Dokument nicht sicher möglich ist.

- **Optimistisch:** Der Client wendet an, sendet mit `opId`, der Server prüft, vergibt `seq`, speichert, verteilt.
  Antwort ist `ack` oder `reject` mit Grund. Alle Befehle sind absolut und doppelt sendbar.
- **Ein gemeinsamer Reducer** in `packages/shared` für Client und Server.
- **Wiederverbinden** heißt vollständiger, je Empfänger gefilterter Schnappschuss. Kein Wiedergabe-Puffer.
- **Verbergen am Filter:** In der Schreibphase lässt der Server fremde Zettel weg, in Ereignissen, im Schnappschuss
  und im Export. Andere sehen nur Platzhalter ohne Kennung, Autor und Länge. Das Aufdecken nimmt nichts zurück.
- **Eine Bewegung, eine Nachricht:** Ziehen sendet beim Loslassen, nie je Bild.

| Richtung | Nachrichten in v0.1 |
|---|---|
| Client → Server | `join`, `leave`, `resync`, `presence.editing`, `note.create`, `note.update`, `note.delete`, `notes.move` (1 bis 500), `group.create`, `group.update`, `group.delete`, `admin.phase.set`, `admin.arrange.apply`, `admin.arrange.undo`, `admin.role.set`, `admin.wall.keep`, `admin.wall.delete` |
| Server → Client | `sync`, `ack`, `reject`, `presence.*`, `roster.updated`, `note.created`, `note.updated`, `note.deleted`, `notes.moved`, `notes.revealed`, `wall.occupancy`, `group.created`, `group.updated`, `group.deleted`, `arrange.applied`, `arrange.undone`, `phase.changed`, `config.changed`, `wall.deleted`, `error` |

`admin.arrange.apply` trägt das ganze Ergebnis in einer Nachricht: Gruppen mit Titel, Rahmen und Zettel-Kennungen,
dazu alle Positionen und die Angabe `quelle: 'dienst' | 'schluessel' | 'browser'`. Der Server prüft Rolle, Phase, dass jeder Zettel
existiert und höchstens einer Gruppe angehört, und die Grenzen. Für ihn ist es eine Sammelbewegung der Moderation.

### 3.5 Sicherheit und Datenschutz

- Fähigkeits-Links: die Wand-Kennung ist das Teilnehmerrecht, das Admin-Token (128 Bit) das Moderationsrecht. Die
  Kennung vergibt der Durable-Object-Namensraum (64 Hex-Zeichen), so weckt eine erfundene Adresse kein Objekt. Der
  Moderationslink trägt das Token im Fragment. Alles wie RetroBeam.
- Durable Objects in der EU-Jurisdiktion, ab der ersten Wand. Das lässt sich nicht nachrüsten.
- Aufruf-Protokolle des Workers aus (`invocation_logs: false`), kein Analytics, keine Cookies.
- Content-Security-Policy nur für eigene Dateien, erweitert um `'wasm-unsafe-eval'` und `worker-src 'self'`.
  transformers.js lädt ohne Einstellung von Hugging Face und jsDelivr. Beides wird abgeschaltet
  (`allowRemoteModels = false`, eigener `wasmPaths`). Ein Test prüft, dass kein fremder Host angefragt wird.
- **Eine Ausnahme: „Eigener Schlüssel“.** Dann fragt der Browser der Moderation den gewählten Anbieter direkt. Die
  Hosts der Anbieter aus 4.5 stehen dafür in `connect-src`. Das weicht vom Technikplan der Foundry ab („keine
  Anfragen an Dritte“) und wird im Produkt als Abweichung festgehalten. Der Schlüssel bleibt im Browser der
  Moderation und erreicht unseren Server nie.
- COOP und COEP für mehrere WASM-Threads. Es gibt keine fremden Einbettungen, die das stören.
- Bremsen: Anlegen je IP über den RateLimiter, Nachrichten je Socket per Token-Bucket. Ordnen: höchstens sechsmal je
  Wand und Tag, dazu das Tagesbudget in Neuronen (4.2).
- Nur Text. Keine Uploads, damit keine Prüfpflichten für hochgeladene Dateien.
- **Was beim Ordnen mit den Zetteln geschieht**, steht dort, wo die Moderation ordnet, und in der
  Datenschutzerklärung: Cloudflare verarbeitet die Zettel in seinem KI-Dienst, ohne sie zu speichern und ohne damit
  zu trainieren. Das kann außerhalb der EU geschehen. Gespeichert bleibt die Wand in der EU. Ob diese Trennung
  rechtlich trägt, habe ich nicht geprüft (8).

### 3.6 Kosten

Limits und Preise aus der Cloudflare-Doku vom 21.11.2026, die von Workers AI vom 22.11.2026.

**Annahmen je Wand** (v0.1, ohne Zeiger): 8 Personen, 45 Minuten, 60 Zettel, je Person 150 Nachrichten, zweimal
ordnen.

| Größe | Je Wand | Herleitung |
|---|---|---|
| Worker-Anfragen | 27 | Anlegen, 8× Info, 8× Upgrade, Export, 2× Ordnen. Statische Dateien zählen nicht |
| DO-Anfragen | 91 | 8 Verbindungen, 11 Aufrufe, 2 Alarme, 1.200 Nachrichten ÷ 20, je Ordnen 3 (Zettel lesen, Budget reservieren und buchen) |
| DO-Dauer | 3 GB-s | Annahme 20 ms je Nachricht bei 128 MB. Nicht gemessen |
| Zeilen geschrieben | 400 | Zielwert, per Test erzwungen. RetroBeam misst 553 für 40 Zettel. Je Ordnen kommen 3 für die Zähler dazu |
| Zeilen gelesen | 12.000 | RetroBeam misst 10.902 |
| Speicher | 50 KB | Schätzung |
| Neuronen (KI) | 120 | Zweimal ordnen zu je rund 60. Gerechnet aus den Messungen mit 30 und 250 Zetteln (39 und 187 bis 199 Neuronen) |

**Am Tag, gegen das Free-Tier**

| Größe | 100 Wände | 1.000 | 10.000 | Limit am Tag | Free reicht bis |
|---|---|---|---|---|---|
| Worker-Anfragen | 2.700 | 27.000 | 270.000 | 100.000 | 3.700 |
| DO-Anfragen | 9.100 | 91.000 | 910.000 | 100.000 | 1.100 |
| DO-Dauer (GB-s) | 300 | 3.000 | 30.000 | 13.000 | 4.300 |
| **Zeilen geschrieben** | 40.000 | 400.000 | 4.000.000 | 100.000 | **250** |
| Zeilen gelesen | 1,2 Mio. | 12 Mio. | 120 Mio. | 5 Mio. | 416 |
| Speicher bei 30 Tagen | 0,15 GB | 1,5 GB | 15 GB | 5 GB gesamt | 3.300 |
| **Neuronen (KI)** | 12.000 | 120.000 | 1,2 Mio. | 10.000, davon 8.000 als Budget | **65** |

**Kosten im Monat**

| Wände am Tag | Plan | Kosten | Woraus |
|---|---|---|---|
| 100 | Free | 0 $ | Alles unter 40 % der Limits, außer der KI: Das Budget deckt 65 der 100 Wände, der Rest ordnet im Browser |
| 1.000 | Paid | 5,30 $ | 5 $ Grundpreis, 0,30 $ DO-Anfragen. KI: 0 $ mit Reserve, oder rund 36 $ für gekaufte Neuronen |
| 10.000 | Paid | rund 93 $ | 5 $ Grundpreis, 70 $ Zeilen, 12,50 $ Dauer, 3,75 $ Anfragen, 2 $ Speicher. KI: 0 $ mit Reserve, oder rund 390 $ |
| 10.000 mit 250 Zeilen je Wand | Paid | rund 48 $ | Zeilen dann 25 $ |

- **KI: 0 $, aber nicht bei jeder Menge.** Das Tagesbudget von 8.000 Neuronen reicht für rund 65 übliche Wände.
  Darüber ordnet die Reserve im Browser. Ihre Dateien sind statisch, also gratis und unbegrenzt. Neuronen zu kaufen
  kostet 0,011 $ je 1.000, das sind rund 36 $ im Monat je 1.000 Wände am Tag. Das ist nicht entschieden (7.3).
- **Die KI ist jetzt die engste Grenze**, vor den geschriebenen Zeilen (250 Wände).
- **Der Aufruf an die KI darf kein Objekt wach halten.** Darum ruft der Worker, nicht der WallRoom (4.3).
- **Die Zeilen sind der Hebel.** Mit 1.500 Zeilen je Wand reichte das Free-Tier nur für 66 Wände am Tag. Darum der
  Lage-Datensatz (3.3) und ein Kostentest wie RetroBeams `cost.test.ts`.
- **Gemessen in Etappe 2: Die 400 Zeilen halten nicht für die Wand, die diese Tabelle annimmt.** Der Kostentest
  spielt 8 Personen, 60 Zettel und 150 Nachrichten je Person durch und zählt 1.228 geschriebene Zeilen, davon 1.061
  für Bewegungen. Ohne Bewegungen sind es 167. Meine Annahme war in sich falsch: Jede Nachricht, die etwas ändert,
  schreibt mindestens eine Zeile, also können 1.200 Nachrichten nicht 400 Zeilen sein. 400 hält eine Wand mit
  höchstens 233 Bewegungen. Entschieden (7.2, Nr. 11): Gespeichert wird wie heute, eine Bremse je Wand begrenzt
  den schlechten Fall, und an echten Wänden wird gezählt. Das Tagesbudget der Vorschau steht auf 25 Wänden, das
  ist auch im schlechten Fall ein Drittel der 100.000 Zeilen des Kontos.
- **Die Limits gelten je Konto.** Im selben Konto teilen sich RetroBeam, IdeaBeam und FokusBeam 100.000 Zeilen
  am Tag. Entschieden: gleiches Konto, ein Tagesbudget je Produkt, Paid ab 50 % Auslastung eines Limits (7.2).
- **Gemessen bei Cloudflare am 22.11.2026,** gegen die Vorschau, mit `scripts/measure-cloudflare.mjs` und
  `scripts/cloudflare-metrics.mjs`: 2.000 Pings einer Verbindung zählten nicht (Cloudflare meldet 4
  Hibernation-Ereignisse und 0 eingehende Nachrichten). Drei Verbindungen standen zusammen rund 14 Minuten offen, das
  Objekt war dabei 0,22 Sekunden wach. Anlegen und drei Beitritte schrieben 23 Zeilen, wie der Kostentest rechnet.
  Eine stille Verbindung blieb zehn Minuten offen. Die Wand wurde in der EU-Jurisdiktion angelegt.
- **Die Dauer hängt an der Hibernation.** Bleibt ein Objekt wach, kostet eine Wand 346 statt 3 GB-s, und das
  Free-Tier reichte für 37 Wände. Seit dem Kompatibilitätsdatum 1.10.2026 hält offene Ein- und Ausgabe ein Objekt
  wach.
- Zeiger kommen in v0.2 nur mit Tagesbudget, wie RetroBeam (1,2 Mio. Nachrichten am Tag).

### 3.7 sebaro, Sprache, Barrierefreiheit

**Vom Auftrag gedeckt, laut Technikplan sonst zu fragen:** eigener Server (Worker und Durable Objects), mehr als ein
paar Megabyte im Browser (Modell-Cache der Reserve), Anfragen an Dritte bei „Eigener Schlüssel“ (3.5). Alle drei
kommen als Abweichung in die Produktdoku.

**Sichten**

| Sicht | Typ | Primäraktion |
|---|---|---|
| Start `/` | `overview` | „Neue Wand“ |
| Meine Wände | `list`, leer: `state-empty` | „Neue Wand“ |
| Neue Wand | `form` | „Wand anlegen“ |
| Beitreten `/w/:id` | `form`, unbekannt: `state-error` | „Beitreten“ |
| **Wand, Fläche** (Kernsicht) | eigene Form aus sebaro-Teilen | Moderation: „Aufdecken“, danach „Ordnen“. Sonst: „Neuer Zettel“ |
| Wand, Liste | `list` | wie Fläche |
| Ergebnis | `result` | „Als Markdown sichern“ |
| Einstellungen, Über | `settings`, `about` | keine |
| Impressum, Datenschutz, Barrierefreiheit | `read` | keine |

Der Rahmen folgt `webapp.md`: Kopfzeile mit Zeichen und Titel, Menü „Mehr“ (Hell oder Dunkel, Farbton, Sprache),
Befehlspalette, Sprunglink, Fußzeile. Für die Fläche gilt das Bauteil „Collaboration“: Grund ohne Raster, Gruppen als
Rahmen ohne Füllung, verdeckte Karte mit Zeichen und Wort, keine Farbe je Person.

**Sprache:** Deutsch und Englisch ab v0.1, jede Zeichenkette aus den Tabellen, Wechsel ohne Neuladen.

**Ist die Fläche per Tastatur bedienbar? Ja, als Abnahmekriterium.**

- Die Fläche ist ein Tab-Stopp. Pfeiltasten springen zum nächsten Zettel in der Richtung, die Ansicht folgt.
- Eingabe bearbeitet, Leertaste wählt aus, Umschalt erweitert die Auswahl.
- Bewegen: ein Bewegen-Modus mit Pfeiltasten in Schritten von 32 Einheiten, und „Mehr“ › „Verschieben nach …“ mit
  den Gruppen als Auswahl. Das ist zugleich der Weg ohne Ziehen (WCAG 2.5.7).
- Zoom mit Plus, Minus und 0 für „Alles zeigen“. Die Tasten stehen einmal in der Beschreibung der Fläche.
- **Die Listenansicht ist der vollwertige zweite Weg:** Gruppen als Überschriften, Zettel als Zeilen, alle Aktionen.
  Sie trägt Screenreader und schmale Bildschirme.
- Bedienelemente eines Zettels liegen außerhalb der gezoomten Welt, damit sie 48 px groß bleiben.
- Ansagen gebündelt: „Geordnet: 7 Gruppen.“ In der Schreibphase nie Inhalt.
- Geprüft wird mit axe, per Tastatur-Ablauf im Ende-zu-Ende-Test und bei 200 % Zoom. Ein Screenreader-Durchgang von
  Hand ist nicht eingeplant und bleibt als „nicht geprüft“ stehen.

**Entschiedene sebaro-Abweichung:** Die Ordnen-Bewegung darf bis 600 ms dauern, gestaffelt, bei reduzierter
Bewegung als Sprung. Kernregel 23 erlaubt 200 ms. Die Ausnahme kommt nach dem Muster `design-exception.md` in die
Produktdoku. Zettel-Farben gibt es in v0.1 nicht, dort gilt die Regel.

### 3.8 Lizenz

Vorschlag: **AGPL-3.0-or-later**, alleiniger Rechteinhaber, CLA für Beiträge, REUSE-Kopfzeilen. Die Begründung aus
RetroBeams `docs/06-legal.md` trägt hier genauso: Schutz gegen geschlossene Klone, kommerzielle Ausnahmelizenz bleibt
möglich.

- Abhängigkeiten nur permissiv. Neu gegenüber RetroBeam: `@huggingface/transformers` (Apache-2.0) und
  `onnxruntime-web` (MIT).
- Mitgeliefert wird nur das Modell der Reserve: `voyage-4-nano`, Apache-2.0 laut Modellkarte. Es liegt als Daten
  neben dem Programm, mit Lizenztext und Eintrag in `REUSE.toml`. Das ist meine Einschätzung, keine Rechtsberatung.
- Das Modell bei Cloudflare wird nicht mitgeliefert. Dafür gelten Cloudflares Bedingungen (docs/ki-anbieter.md).
- Nicht verwendet: Modelle unter CC-BY-NC (Jina v3, v5), Gemma Terms (EmbeddingGemma-300m), `lfm1.0`, Llama-Lizenz.

---

## 4 KI: Quellen, Ablauf, Reserve

Dieser Abschnitt ist am 22.11.2026 neu geschrieben, nach den Messungen und deinen Entscheidungen (7.2, Nr. 8 bis 10).
Der alte Stand steht in der Git-Historie: ein Einbettungsmodell im Browser als einziger Weg, Average Linkage,
Überschriften aus Schlüsselwörtern. Warum er nicht trug, steht in [docs/messung.md](docs/messung.md).

### 4.1 Was die Messungen entschieden haben

Je Wand 250 Zettel in 5 Themen, halb deutsch, halb englisch. ARI 1 heißt wie die Vorlage, 0 heißt Zufall.

| Weg | Modell | ARI | Richtig einsortiert | Bericht |
|---|---|---|---|---|
| Im Browser, jedes Gerät | MiniLM, 36 bis 78 MB | 0,20 | 51 % | messung.md |
| Im Browser, Laptop mit WebGPU | `voyage-4-nano`, 218 MB | 0,45 | 71 % | messung.md |
| Im Browser, Sprachmodell | bis 1,4 GB | höchstens 0,11 | höchstens 44 % | messung-0b.md |
| Cloudflare Workers AI | `@cf/google/gemma-4-26b-a4b-it` | 0,83 | 93 % | messung-0b.md, Abschnitt 7 |
| Cloudflare Workers AI, im Produkt | dasselbe Modell, Rezept nach Abschnitt 4.3 | 0,77 bis 0,95 | 90 bis 98 % | messung-4a.md |
| Obergrenze | starkes Sprachmodell | 0,84 und 0,93 | 93 bis 100 % | messung-0b.md |

- Die Schwelle aus dem ersten Plan war ARI ≥ 0,5. Im Browser hält sie kein Modell. Bei Cloudflare hält sie schon das
  sparsamste.
- **Gestrichen:** Average Linkage mit Silhouette-Schnitt, Überschriften aus Schlüsselwörtern, „nach Stichwörtern
  ordnen“, Dubletten per Schwelle, kleine Sprachmodelle im Browser.
- **Bestätigt, für die Reserve:** Modelldateien in Teilen unter 25 MiB mit gzip, WebGPU in Chrome und Safari.

### 4.2 Quellen und Verteiler

Der Verteiler ist eine geordnete Liste. Er nimmt die erste Quelle, die darf und kann.

| Rang | Quelle | Wann | Richtig einsortiert | Kosten | Wohin die Zettel gehen |
|---|---|---|---|---|---|
| – | „Im Browser ordnen“ | wenn die Moderation es wählt | 71 % | 0 €, einmal 218 MB laden | nirgendwohin |
| 1 | Eigener Schlüssel | wenn einer eingetragen ist | je nach Modell, vorher gemessen | zahlt die Moderation, rund 0,3 Cent je großer Wand | an ihren Anbieter in der EU |
| 2 | Cloudflare Workers AI | Standard | 93 % | 0 € im Tageskontingent | an Cloudflare, ohne Speicherung, nicht sicher in der EU |
| 3 | Reserve im Browser | Kontingent leer oder Dienst gestört, nach Rückfrage | 71 % | 0 €, einmal 218 MB laden | nirgendwohin |
| 4 | Von Hand | immer | – | – | – |

**Budget**

- Cloudflare gibt je Konto 10.000 Neuronen in 24 Stunden gratis. Cloudflare schreibt, das Kontingent werde um
  00:00 UTC zurückgesetzt. Gemessen am 23.11.2026 ist es ein Fenster von 24 Stunden (`docs/messung-4a.md`,
  Abschnitt 9). Das Konto teilen sich alle deine Produkte.
- IdeaBeam bekommt davon 8.000 Neuronen in 24 Stunden. Der Zähler liegt im RateLimiter und zählt wie Cloudflare
  über 24 Stunden (7.2, Nr. 15). Der Worker reserviert vor dem Lauf eine Schätzung (20 Neuronen und eines je
  Zettel) und bucht danach, was die Schnittstelle meldet. Sie nennt den Verbrauch in jeder Antwort
  (`usage.neurons`, geprüft).
- Je Wand höchstens sechs Ordnungen in 24 Stunden.
- **Lehnt Cloudflare selbst ab,** weil das Kontingent des Kontos aufgebraucht ist, sagt die App „Kontingent
  aufgebraucht“ und nennt keine Uhrzeit. Lehnt der eigene Zähler ab, nennt sie die Zeit, ab der der Lauf wieder
  passt.
- **„Kapazität prüfen“ braucht keine eigene Anfrage.** Der Zähler weiß es vorher. Scheitert ein Aufruf trotzdem,
  gilt die Quelle fünf Minuten als gestört.
- **Keine laufenden Kosten, auch nicht aus Versehen.** Auf dem Free-Plan schlagen Aufrufe über dem Kontingent
  einfach fehl. Auf dem Paid-Plan kosten sie 0,011 $ je 1.000 Neuronen. Dann ist das Tagesbudget die einzige Bremse
  und wird vor jedem Aufruf geprüft. Mehr Neuronen zu kaufen ist eine eigene Entscheidung von dir (7.3).

**Ehrlich im Raum**

- Wo gerechnet wird, steht am Knopf, bevor die Moderation ordnet.
- Ist das Budget leer, sagt die App das und nennt die Wege: Reserve im Browser, eigener Schlüssel, von Hand. Sie
  lädt die 218 MB der Reserve nie ungefragt.

### 4.3 Ablauf beim Anbieter

1. **Anfrage.** Die Moderation drückt „Ordnen“. Der Browser ruft `/arrange` mit dem Admin-Token. Der Worker prüft
   Phase, Tagesbudget und die Grenze je Wand.
2. **Zettel holen.** Der Worker liest Kennung und Text aller aufgedeckten Zettel aus dem WallRoom, ohne die in
   gesperrten Gruppen. Der Client schickt keinen Text mit.
3. **Themen finden.** Ein Aufruf mit allen Zetteln: 3 bis 6 Themen, je ein Titel und eine Zeile Beschreibung, in der
   Sprache der Wand. Kleine Wände bekommen weniger Themen, bei 8 Zetteln zwei.
4. **Zuordnen.** Stapel zu 50 Zetteln, nebeneinander. Die Antwortform ist per JSON-Schema vorgegeben: je Zettel
   genau ein Thema aus der Liste, genannt mit seinem Buchstaben, die Antwort auf einer Zeile.
   **Bleibt ein Aufruf aus,** geht dieselbe Anfrage ein zweites Mal hinaus: bei den Themen nach 15 Sekunden, bei
   einem Stapel nach 12. Die erste lesbare Antwort zählt.
5. **Prüfen.** Der Worker prüft jede Antwort gegen die Liste der Zettel und Themen. Was fehlt oder nicht passt,
   bleibt „ohne Gruppe“. Themen ohne Zettel entfallen.
6. **Vorschau.** Der Vorschlag geht nur an die Moderation. Sie sieht Gruppen und Überschriften und wählt „Anwenden“
   oder „Verwerfen“. Gespeichert ist bis dahin nichts.
7. **Anordnen.** Der Browser der Moderation rechnet die Lage: Rahmen nach Größe in Reihen, Zettel im Rahmen in
   Zeilen. Höhen kommen aus einer gemeinsamen Schätzfunktion, damit die Anordnung auf jedem Gerät passt.
8. **Verteilen.** `admin.arrange.apply`, danach gleiten die Zettel auf allen Geräten gestaffelt in höchstens 600 ms
   an ihren Platz. Bei reduzierter Bewegung springen sie. „Rückgängig“ stellt den Stand davor her.

Von Hand angelegte Gruppen sind gesperrt. „Ordnen“ fasst nur an, was nicht in einer gesperrten Gruppe liegt. Eine
von Hand geänderte Überschrift überschreibt die KI nie: Wer eine Gruppe der KI umbenennt, sperrt sie damit (7.2,
Nr. 16). Spätere Läufe lassen sie und ihre Zettel in Ruhe, und „Rückgängig“ lässt sie mit ihren Zetteln stehen.

**Gemessen in Etappe 0b** mit `gemma-4-26b-a4b-it` an den zwei Testwänden, mit einem zweiten Themen-Aufruf und
Titeln als Antwort: 7 Aufrufe, ARI 0,80 und 0,86, kein ungültiger Zettel, 187 Neuronen je Wand.

**Gemessen in Etappe 4a mit dem Code des Produkts** (`docs/messung-4a.md`): Dieses erste Rezept brauchte 23 bis 89
Sekunden und schwankte zwischen ARI 0,68 und 0,93. Drei Änderungen kamen aus der Messung:

- **Kein zweiter Themen-Aufruf.** Er formulierte die Themen nur breiter, und die Zuordnung war mit ihm auf allen
  vier Wänden schlechter.
- **Buchstabe statt Titel, auf einer Zeile.** Gleich gute Zuordnung, 243 statt 690 Token je Stapel.
- **Die zweite Anfrage neben einer langsamen.** Etwa jeder sechste Aufruf hing 30 bis 60 Sekunden.

Damit: 250 Zettel in 12 bis 28 Sekunden, ARI 0,77 bis 0,95, 126 bis 179 Neuronen. 500 Zettel in 11 Sekunden für
252 Neuronen, 12 Zettel in 4 Sekunden für 13. Mit englischen Überschriften 0,82. Eine Wand bekommt höchstens sechs
Themen.

**Solange gerechnet wird,** zeigt die App einen Satz und die verstrichene Zeit. Die Route antwortet einmal, am Ende.
Schritte wie „Themen finden“ und „Zettel zuordnen“ könnte die App nur raten, deshalb zeigt sie keine.

**Ersatzmodell:** `mistral-small-3.1-24b-instruct` (ARI 0,73, 451 Neuronen) oder `gpt-oss-120b` (0,80, 829). Das
Modell ist eine Einstellung, kein fester Wert im Code: Eines der Testmodelle war zwei Tage vor der Messung
abgekündigt.

**Ein Zettel ist Daten, kein Befehl.** Schreibt jemand „ignoriere alle Regeln“ auf einen Zettel, kann das Modell
im schlimmsten Fall schlecht ordnen. Die Antwort muss ins Schema passen, und die Moderation sieht den Vorschlag,
bevor er gilt.

**Der Worker ruft, nicht das Durable Object.** Ein Aufruf an die KI hielte das Objekt eine halbe Minute wach und
vervielfachte die abgerechnete Dauer (3.6).

### 4.4 Reserve: „Im Browser ordnen“

- **Modell:** `voyage-4-nano`, 4-Bit, Apache-2.0. 218 MB in gzip-Teilen von der eigenen Domain, geprüft per
  SHA-256, danach im Browser-Cache. Die Wege dafür sind in Etappe 0 gebaut und gemessen.
- **Nur mit WebGPU.** Gemessen in Chrome auf dem M-Mac: 500 Zettel in 3,3 Sekunden, Speicher rund 1 GB und bis
  0,85 GB Grafikspeicher. Ohne WebGPU wären es 30 Sekunden. Auf Handys ist nichts gemessen. Darum bietet v0.1 die
  Reserve nur an, wo WebGPU da ist und der Speicher reicht. Sonst bleibt „von Hand“.
- **Verfahren:** je Sprache den Mittelwert abziehen, dann Louvain auf dem Graphen der 15 nächsten Nachbarn. Das
  fand in der Messung die Zahl der Gruppen selbst und kam auf ARI 0,45.
- **Überschriften:** der Zettel, der der Mitte der Gruppe am nächsten liegt, gekürzt. Schlüsselwörter haben in der
  Messung nicht getragen.
- **Zweck:** Wer keinen Zetteltext an einen KI-Dienst geben will, wählt diesen Weg von Anfang an. Für alle anderen
  ist er die Reserve.
- Cache: Cache API, `navigator.storage.persist()` wird angefragt. Safari löscht Speicher nach sieben Tagen ohne
  Besuch. Die App zeigt den Zustand ehrlich und lädt neu. In den Einstellungen steht „Modell löschen“.

### 4.5 Eigener Schlüssel

- **Wozu:** Die Moderation ordnet mit ihrem eigenen Anbieter, aus ihrem Vertrag mit ihm, statt mit Cloudflares
  Gratis-Kontingent. Das ist die Möglichkeit für v0.1. Eine bezahlte Stufe von uns kommt später (7.2, Nr. 9).
- **Anbieter:** eine feste Liste, seit deiner Entscheidung vom 23.11.2026 (7.2, Nr. 19): Mistral, OpenAI und
  Anthropic. Sie ist nicht mehr auf Anbieter in der EU beschränkt. Dafür sagt die App je Anbieter am Knopf, wohin
  die Zettel gehen und wie lange sie dort liegen. Je Anbieter ein festes Modell, das vorher auf dem Korpus
  gemessen ist. Keine frei eingebbare Adresse. Die Anbieter in der EU (IONOS, OVHcloud, Scaleway) können später
  als weitere Einträge dazukommen.
- **Der Schlüssel bleibt im Browser der Moderation,** nur für diese Sitzung (7.2, Nr. 21): im Arbeitsspeicher des
  Tabs, nach dem Schließen weg. Er erreicht unseren Server nie. Der Browser fragt den Anbieter direkt, mit denselben Prompts und derselben Prüfung aus
  `packages/arrange`.
- **Voraussetzung:** Der Anbieter muss Anfragen aus dem Browser zulassen (CORS). Wer das nicht tut, fällt aus der
  Liste. **Geprüft am 23.11.2026** mit echten Anfragen ohne Schlüssel, in Chromium und Firefox
  ([docs/ki-anbieter-4b.md](docs/ki-anbieter-4b.md)):

  | Anbieter | Aus dem Browser | Rechnet in | Speicherung | Je Wand (250 Zettel) | Was dagegen spricht |
  |---|---|---|---|---|---|
  | IONOS AI Model Hub | ja | Deutschland | keine | 0,17 Cent | nur Geschäftskunden; ob das Modell die Antwortform per Schema hält, ist nicht belegt |
  | OVHcloud AI Endpoints | ja, über eine Ausnahme | Frankreich | keine | 0,15 Cent | die Freigabe gilt für alle Kopfzeilen pauschal; Browser könnten das für den Schlüssel künftig verweigern |
  | Mistral | ja | EU nur am EU-Endpunkt | 30 Tage, sofern Mistral keine Ausnahme gewährt | rund 0,3 Cent | passt nicht zu „ohne Speicherung“ |
  | Scaleway | offen | Frankreich | keine | rund 0,25 Cent | Fehlerantworten kommen ohne Freigabe; ein falscher Schlüssel sähe aus wie „keine Verbindung“. Klärt nur ein Test mit echtem Schlüssel |

  Kein Modell dieser Anbieter ist auf dem Korpus gemessen. Dafür braucht es je Anbieter einen Schlüssel von dir.

  **Die drei Anbieter der Liste** nach deiner Entscheidung (7.2, Nr. 19), ebenfalls am 23.11.2026 ohne Schlüssel
  getestet ([docs/ki-anbieter-4b-us.md](docs/ki-anbieter-4b-us.md)):

  | Anbieter | Aus dem Browser | Rechnet in | Speicherung | Training mit den Daten | Je Wand (250 Zettel) |
  |---|---|---|---|---|---|
  | Mistral, EU-Endpunkt | ja | EU | 30 Tage, sofern Mistral keine Ausnahme gewährt | abschaltbar; die Voreinstellung für bezahlte Nutzung ist nicht klar belegt | rund 0,3 Cent |
  | OpenAI | ja | kein Ort zugesagt | bis zu 30 Tage | nein, außer man stimmt zu | rund 0,2 Cent mit dem kleinsten Modell |
  | Anthropic | ja, mit einer zusätzlichen Kopfzeile | kein Ort zugesagt, wahlweise nur USA | innerhalb von 30 Tagen gelöscht | nein | rund 0,2 Cent mit dem kleinsten Modell, rund 12 Cent mit dem empfohlenen |

  Die Modelle und Preise stammen von den Seiten der Anbieter. Kein Aufruf mit echtem Schlüssel ist gelaufen, und
  kein Modell ist gemessen. Google Gemini ginge technisch auch, ist aber nicht gebaut: Googles Bedingungen nennen
  die Schnittstelle „nicht für Verbraucher“, verlangen im EWR bezahlte Schlüssel, und mit einem Gratis-Schlüssel
  trainiert Google mit den Daten.
- Der Verbrauch geht auf die Rechnung der Moderation: rund 0,3 Cent für eine Wand mit 250 Zetteln
  ([docs/ki-anbieter.md](docs/ki-anbieter.md)).

### 4.6 Was Etappe 4 noch messen muss

| Was | Warum | Stand nach Etappe 4a (`docs/messung-4a.md`) |
|---|---|---|
| Sehr kleine Wände mit 8 bis 15 Zetteln | Gemessen sind 30 und 250. Der Prompt verlangt 4 bis 8 Themen, das ist für 10 Zettel zu viel | **Gemessen:** 2 bis 4 brauchbare Gruppen in 4 bis 7 Sekunden |
| 500 Zettel in einem Aufruf | Die Grenze der Wand. Gemessen sind 250 | **Gemessen:** geht durch, 11 Sekunden, 252 Neuronen |
| Der schmutzige Satz: Einzelwörter, Tippfehler, Emoji | Bisher nur mit Einbettungen gemessen | **Gemessen:** allein ARI 1,0, gemischt 0,67 |
| Streuung von Lauf zu Lauf | Je Modell gab es einen Lauf | **Gemessen:** Dieselbe Wand gab 0,71 und 0,93. Mit dem gebauten Rezept 0,77 bis 0,95 in fünf Läufen |
| Eine echte Wand | Der Korpus ist erfunden. Lokal auswerten, nichts davon geht an einen Dienst | **Offen:** Es gibt keinen Export einer echten Wand (7.3 G) |
| Rechenzeit des Workers | Der Free-Plan erlaubt 10 ms je Anfrage. Warten auf die KI zählt nicht, das Lesen der Antworten schon | **Gemessen:** 8 bis 24 ms je Lauf, über den 10 ms des Free-Plans. Keine Anfrage scheiterte (7.3 P) |
| Dauer mit Stapeln nebeneinander | 26 Sekunden sind aus Einzelzeiten gerechnet, nicht gemessen | **Gemessen:** 12 bis 28 Sekunden für 250 Zettel |
| Die Modelle für „Eigener Schlüssel“ | Bei IONOS, Scaleway, OVHcloud und Mistral ist nichts gemessen | Gehört zu Etappe 4b |

### 4.7 Rückfall

| Stufe | Wann | Was geschieht |
|---|---|---|
| 1 | Tagesbudget leer, Grenze je Wand erreicht oder Dienst gestört | Die App nennt den Grund und bietet die Stufen 2 bis 4 an. Kein endloser Balken |
| 2 | Ein eigener Schlüssel ist eingetragen | Der Anbieter der Moderation ordnet |
| 3 | WebGPU ist da und der Speicher reicht | Reserve im Browser, nach Rückfrage wegen der 218 MB |
| 4 | Immer | Von Hand gruppieren |

---

## 5 Wiederverwendung aus RetroBeam

**Empfehlung: kopieren, mit Herkunftsnachweis.** Ein gemeinsames Paket müsste aus RetroBeam herausgelöst werden, und
RetroBeam darf jetzt nicht verändert werden. Jede kopierte Datei behält ihre SPDX-Zeile und bekommt einen Eintrag in
`docs/herkunft.md` (Quellpfad, Commit `fafe070`). Beide Projekte gehören demselben Rechteinhaber unter derselben
Lizenz.

Ein geteiltes Paket lohnt, sobald ein drittes Produkt dieselben Teile braucht. Das ist mit FokusBeam absehbar.
Kandidaten: Socket-Klient, Sitzungs- und Admin-Link, RateLimiter, DO-Gerüst, Protokoll-Umschlag, Testhelfer. Das
Herauslösen ist eine eigene Entscheidung, weil es RetroBeam anfasst.

| Baustein | Quelle | Wie |
|---|---|---|
| Arbeitsbereich, CI, Deploy, PR-Vorschau | Wurzel, `.github/workflows` | kopieren, anpassen |
| Worker-Routen, Bremsen, `noindex` | `apps/worker/src/index.ts`, `wrangler.jsonc` | kopieren, anpassen |
| RateLimiter mit Tagesbudget | `apps/worker/src/rate-limiter.ts` | 1:1 |
| EU-Stub | `apps/worker/src/board-stub.ts` | 1:1 |
| DO-Gerüst: Hibernation, Anhang, Ping, Token-Bucket, Alarm, Migration, Löschen | `apps/worker/src/board-room.ts` (5.396 Zeilen) | nur Muster. Die Fachlogik ist eine andere |
| Kennungen, Sitzungsschlüssel, Namen, Beitritt | `packages/shared/src/{ids,session-key}.ts`, `domain/{names,join}.ts` | 1:1 |
| Protokoll-Umschlag (`opId`, `ack`, `reject`, `seq`) | `packages/shared/src/protocol.ts` | Muster, neue Nachrichten |
| Sichtfilter, Reducer, Phasen | `domain/{notes,reducer,phases}.ts` | Muster |
| Markdown-Export | `domain/export.ts` | anpassen |
| Socket: Wiederverbinden, Beitritt zuerst, Unbestätigtes erneut senden | `apps/web/src/lib/socket.ts` | 1:1 |
| Sitzung, Admin-Link, Verbindung, API, QR | `apps/web/src/lib/` | 1:1 oder anpassen |
| QR-Code, Teilen, Einladen, Teilnehmerliste, Rechtsseiten, Betreiberdaten | `components/`, `content/` | anpassen, wo der sebaro-Starter nichts Eigenes hat |
| Flächen-Rechnung: Rad und Zoom, Ziehen mit einer Nachricht, Tastenschritte, Platzhalter, Höhenschätzung, freie Stelle suchen | `components/BoardCanvas.tsx` | nur Muster |
| Testhelfer, Kostentest, Hibernation-Test, Symmetrie-Test, a11y-Spec | `apps/worker/test/`, `e2e/` | kopieren, anpassen |
| Datenschutz-Leitfaden, Lizenzdoku, CLA | `docs/05`, `docs/06`, `CLA.md` | anpassen |
| Spaltenlayout, Zonen, Rad, Kudos, ROTI, GIFs, Eisbrecher | | nicht |

**Ein Widerspruch, entschieden:** RetroBeam wurde nachträglich auf sebaro umgebaut (Tailwind über die Token-Brücke,
eigene Hüllen). Der sebaro-Starter v3.0.0 bringt Rahmen, „Mehr“, Einstellungen, „Über“ und die React-Teile fertig
mit. Für `apps/web` gilt der Starter, weil er neuer und der vorgesehene Weg ist. RetroBeams Hüllen werden nur
kopiert, wo dem Starter etwas fehlt. Lücken kommen nach `docs/sebaro-luecken.md`.

---

## 6 Etappen

Ein Arbeitstag (AT) ist ein Tag, an dem Agenten-Sitzungen bauen und du am Ende abnimmst. Die Schätzung ist meine. Als
Maßstab: RetroBeams Fläche wurde an 15 verschiedenen Tagen angefasst.

| Etappe | Inhalt | Schätzung | ×1,7 |
|---|---|---|---|
| 0 | Wegwerf-Prototyp: Modell-Messung. **Erledigt**, samt Nachmessung 0b | 1,5 AT | 2,5 AT |
| 1 | Gerüst: anlegen, beitreten, sehen | 2 AT | 3,5 AT |
| 2 | Fläche und Liste | 6 AT | 10 AT |
| 3 | Ablauf: verdeckt schreiben, aufdecken, Uhr, Bremse je Wand | 4 AT | 7 AT |
| 4a | KI beim Anbieter: Ordnen, Vorschau, Budget | 3,5 AT | 6 AT |
| 4b | Eigener Schlüssel | 1 AT | 1,5 AT |
| 4c | Reserve im Browser | 3 AT | 5 AT |
| 5 | Export, Feinschliff, Start | 2,5 AT | 4,5 AT |
| | **v0.1 gesamt** | **23,5 AT** | **40 AT** |
| | v0.2, grob | 12 AT | 20 AT |

Gegenüber dem ersten Plan sind das 2,5 AT mehr (4 mit Zuschlag): Die KI hat jetzt drei Wege statt einem. 4c lässt
sich nach v0.2 schieben, ohne dass 4a und 4b darunter leiden (7.3, D).

### Etappe 0: Wegwerf-Prototyp für die Messung

Eine statische Seite mit einem Web Worker, ohne Rahmenwerk, ohne Sync, ohne Gestaltung. Sie lädt die vier Kandidaten,
rechnet den Korpus durch und zeigt die Messwerte als JSON.

Abnahme, Stand 22.11.2026:

- `docs/messung.md` enthält M1 bis M9 für den Mac. **Nicht gemessen:** Android, iPhone, die volle Safari-Reihe. Sie
  sind zurückgestellt, weil sie nur noch die Reserve betreffen.
- Die Schwellen sind ausgewertet: Die Zeiten hält der Mac, die Qualität reißt jeder Kandidat im Browser. Der Plan
  kam deshalb zurück zu dir.
- Etappe 0b hat nachgemessen: Sprachmodelle lokal und bei Cloudflare (`docs/messung-0b.md`), dazu die Recherche zu
  Anbietern (`docs/ki-anbieter.md`).
- Der Prototyp liegt auf dem Zweig `proto/e0-messung`. Kein Code daraus geht ins Produkt.

### Etappe 1: Gerüst

Arbeitsbereich aus dem sebaro-Starter und dem Worker. Wand anlegen, beitreten, Teilnehmerliste. WallRoom in der EU.
Vier Testebenen, CI, Vorschau-Deploy. Deutsch und Englisch. Rechtsseiten als Platzhalter. Adresse: workers.dev, im
selben Cloudflare-Konto wie RetroBeam, mit eigenem Tagesbudget.

Abnahme:

- Zwei Browser sehen sich auf der Vorschau-Adresse beitreten.
- Der Hibernation-Test besteht: Objekt entfernen, derselbe Socket arbeitet weiter, Rolle und Zustand sind da.
- Ein Test belegt: keine Anfrage an einen fremden Host.
- Die Prüfungen des Starters sind grün. Die Sprachprüfung schlägt fehl, wenn eine Zeichenkette fehlt.

**Stand 22.11.2026: gebaut auf dem Zweig `etappe-1`, noch nicht abgenommen.**

| Abnahme | Stand |
|---|---|
| Zwei Browser sehen sich auf der Vorschau-Adresse beitreten | **Bereit für deinen Blick.** Die Vorschau `ideabeam-vorschau` läuft seit dem 22.11.2026 auf workers.dev (dein Wort vom selben Tag). Ein Rauchtest gegen die Vorschau hat eine Wand angelegt, zwei Personen über Sockets beitreten lassen und die Wand wieder gelöscht. Zwei echte Browser auf zwei Geräten hat dort noch niemand benutzt. Lokal belegt es ein Ende-zu-Ende-Test mit zwei Browsern |
| Hibernation-Test | Erfüllt: `identity, role and the wall survive the Durable Object being evicted` in `apps/worker/test/ws.test.ts` |
| Keine Anfrage an einen fremden Host | Erfüllt: `no request goes to another origin while a wall is made, joined by a second browser and deleted` in `apps/web/tests/wall.spec.ts` |
| Prüfungen des Starters grün, Sprachprüfung | Erfüllt: `CI=1 pnpm checks` an der Wurzel. Der Test `every language has the same keys` schlägt fehl, wenn eine Zeichenkette in einer Sprache fehlt |

Vier Testebenen: 37 Tests für die geteilten Regeln, 47 für den Worker in echtem workerd, 67 für die App in jsdom,
88 Ende-zu-Ende gegen den Build. Die Ansichten und ihre Zustände stehen in `docs/ANSICHTEN.md`, die Herkunft jeder
übernommenen Datei in `docs/HERKUNFT.md`.

Über den Plan hinaus gebaut, weil es mit dem Muster kam: die Löschfrist von 30 Tagen per Alarm, das sofortige
Löschen durch die Moderation (beides war für Etappe 3 vorgesehen), der Moderationslink und „Meine Wände“.

Anders als geplant:

- **Vorbild war FokusBeam,** das dieselben Dateien aus RetroBeam schon an den sebaro-Starter angepasst hat.
  Gelesen wurde nur die eingecheckte Historie, geändert dort nichts.
- **Die Kennung einer Wand** hat 64 Hex-Zeichen und kommt vom Namensraum (3.5).
- **`participants` hat kein `online` und kein `last_seen`.** Wer da ist, steht in den offenen Sockets und kostet
  keine Zeile.
- **Bis zu 30 Personen zugleich** auf einer Wand, 200 insgesamt. Der Plan nannte keine Zahl.

Noch nicht gebaut:

- **Das Tagesbudget je Produkt.** Die Vorschau läuft ohne. Das Anlegen ist nur je Adresse gebremst (10 in der
  Minute). Das Budget ist der erste Punkt von Etappe 2.
- **Die laufende Nummer `seq`** (3.4). Sie kommt mit dem ersten gespeicherten Befehl in Etappe 2.
- **QR-Code** zum Link (2.1). Er kommt mit Etappe 5.
- **Das Zeichen** ist ein Platzhalter (7.3, H).

Nicht geprüft: ein anderer Browser als Chromium, ein echtes Handy, ein Screenreader, die EU-Bindung in Produktion,
die GitHub-Workflows (damals ohne Remote; seit dem 24.11.2026 laufen sie dort grün). Mehr dazu in `apps/web/CHECKS.md`.

### Etappe 2: Fläche und Liste

Verschieben, Zoomen, Zettel, Mehrfachauswahl, Gruppen, „Alles zeigen“, Listenansicht, Tastatur, optimistische
Befehle, Kostentest.

**Stand 22.11.2026, spät: gebaut auf dem Zweig `etappe-2`, noch nicht abgenommen. Eine Messung fehlt.**

| Abnahme | Stand |
|---|---|
| 500 Zettel: Verschieben und Zoomen auf dem Pixel 5 mit mindestens 30 Bildern je Sekunde | **Erfüllt**, gemessen am 23.11.2026 auf dem Pixel 5 der Fleet: Schieben 88 Bilder je Sekunde, Zoomen 61 bis 67, einen Zettel ziehen 50 bis 52. Mit erzeugten Gesten, nicht mit einem echten Finger. Bericht: `docs/messung/pixel5-flaeche.md` |
| Ende-zu-Ende nur mit Tastatur: Zettel anlegen, bewegen, in eine Gruppe verschieben, mehrere auswählen | Erfüllt: `by keyboard alone: a note is made, moved, moved into a group, and several notes are selected` in `apps/web/tests/groups.spec.ts` |
| axe ohne Befund auf Fläche und Liste, hell und dunkel, schmal und breit, einmal bei 200 % | Erfüllt: acht Tests in `groups.spec.ts`, dazu `wand-gruppen` und `wand-liste` bei 200 % in `screens.spec.ts` |
| Kostentest: eine typische Wand schreibt höchstens 400 Zeilen | **Nicht erfüllt, wie angenommen.** Die Wand aus 3.6 schreibt 1.228 Zeilen. 400 hält sie mit höchstens 233 Bewegungen. Deine Entscheidung steht aus (7.3, J) |
| JavaScript beim Start unter dem Budget des Starters | Erfüllt: 170 von 250 KB |

Tests: 123 für die geteilten Regeln, 110 für den Worker (dazu der eine erwartete Fehlschlag des Kostenziels), 145 für
die App, 171 Ende-zu-Ende.

Gebaut:

- **Server:** Tagesbudget beim Anlegen (die Vorschau läuft mit 25 Wänden am Tag), Zettel, Gruppen, Verschieben mit
  `opId`, `ack`, `reject` und `seq`. `seq` braucht keine Zählerzeile.
- **Fläche:** eine Welt, per CSS-Transform bewegt, kein Neuzeichnen beim Verschieben und Zoomen. Zettel schreiben,
  ändern, löschen, ziehen. Gruppen als Rahmen mit Titel, „Neue Gruppe“ auch um ausgewählte Zettel. Mehrere Zettel
  auswählen. „Verschieben nach …“ als Weg ohne Ziehen.
- **Liste:** der vollwertige zweite Weg. Unter 640 px öffnet eine Wand als Liste.
- **Oben auf der Wand** steht je Rolle und Zustand, was als Nächstes dran ist, und was vom Ablauf noch nicht gebaut
  ist. Das kam aus deiner Frage an die Vorschau.
- **Kein Name auf Zetteln,** eigene Zettel tragen „Deiner“ (7.3, M).
- **Aus FokusBeam übernommen,** von der FokusBeam-Sitzung in einem eigenen Arbeitsbaum: der Rahmen nach RetroBeams
  Bauart, die Startseite, Rechtstexte als Entwurf, Kopfzeilen und `robots.txt`, der Satz zum aufgebrauchten
  Tagesbudget, „Aus der Liste entfernen“, drei Mess-Skripte.

Anders als geplant oder neu entschieden:

- **Das Rad allein verschiebt, Strg oder ⌘ mit dem Rad zoomt,** wie bei RetroBeam.
- **Auf einer Wand liegt die Fußzeile unter dem Fensterrand,** einen Bildlauf entfernt. So bekommt die Fläche rund
  90 px mehr Höhe. Deine Regel war „Fußzeile immer zuletzt“: Sie ist zuletzt, aber nicht im ersten Fenster. Das
  braucht deinen Blick (7.3, N).
- **Mehrere Zettel auswählen geht nur mit Tastatur oder Umschalt-Klick,** nicht per Touch.

Nicht geprüft: ein echtes Handy oder Touch-Gerät, ein Screenreader, ein anderer Browser als Chromium.

### Etappe 3: Ablauf

Verdecktes Schreiben mit Filter in Ereignissen, Schnappschuss und Export. Platzhalter. Aufdecken. Löschfrist per
Alarm. Bremsen.

Dazu seit dem 22.11.2026: eine Uhr für die Schreibphase (Dauer wählen, anhalten, fünf Minuten mehr, die Restzeit
als Satz in ganzen Minuten), die Bremse je Wand (7.2, Nr. 11), „Meine Angaben löschen“ (die Zettel bleiben ohne
Namen) und der Filter je Empfänger auch für die Urheberschaft: Der Server sagt einem Browser nur noch, ob ein
Zettel der eigene ist, nicht mehr, wer ihn schrieb. Die Löschfrist per Alarm steht schon seit Etappe 1.

Abnahme:

- Ende-zu-Ende mit zwei Browsern: A schreibt, in Bs WebSocket-Nachrichten steht As Text bis zum Aufdecken nie. Der
  Test liest die Nachrichten selbst, nicht nur den Bildschirm.
- Symmetrie-Test: Schnappschuss und Ereignisstrom ergeben für jeden Empfänger denselben Zustand.
- Wiederverbinden mitten in der Schreibphase verrät nichts und verliert nichts.
- Der Export vor dem Aufdecken enthält keine fremden Zettel.

**Stand 23.11.2026: gebaut auf dem Zweig `etappe-3`, noch nicht abgenommen.**

| Abnahme | Stand |
|---|---|
| Zwei Browser: A schreibt, in Bs WebSocket-Nachrichten steht As Text bis zum Aufdecken nie | Erfüllt: `while the notes are hidden nothing of A's notes is in B's WebSocket frames: no text, no id, no writer; revealing brings them` in `apps/web/tests/hidden.spec.ts`. Der Test liest die Nachrichten selbst |
| Symmetrie: Schnappschuss und Ereignisstrom ergeben für jeden Empfänger denselben Zustand | Erfüllt: fünf Tests unter „stream and snapshot“ in `apps/worker/test/hidden.test.ts`, auf den Rahmen, die eine Verbindung wirklich bekam. Drei eingebaute Lecks wurden zur Probe erkannt |
| Wiederverbinden mitten in der Schreibphase verrät nichts und verliert nichts | Erfüllt, im Worker und mit zwei Browsern (`a reconnect in the middle of the writing reveals nothing and loses nothing`) |
| Der Export vor dem Aufdecken enthält keine fremden Zettel | Erfüllt für die Funktion, die der Export nutzen wird (`packages/shared/test/visibility.test.ts`). Den Export selbst gibt es erst mit Etappe 5 |

Tests: 188 für die geteilten Regeln, 156 für den Worker, 173 für die App, 219 Ende-zu-Ende. Nichts ist als
erwarteter Fehlschlag markiert.

Gebaut:

- **Phasen:** Eine Wand beginnt verdeckt, außer es wurde beim Anlegen abgeschaltet. Solange verdeckt geschrieben
  wird, bekommt jeder Browser nur die eigenen Zettel und eine Zahl für die der anderen, auch die Moderation.
  Aufdecken ist Sache der Moderation und lässt sich nicht zurücknehmen. Gruppen gibt es erst danach.
- **Kein Name verlässt den Server.** Ein Zettel trägt für seinen Empfänger nur noch „deiner oder nicht“.
- **Die Uhr** ist reine Daten: das Ende oder die Restzeit, dazu eine Revision. Kein Timer, kein Alarm, keine Zeile,
  wenn die Zeit abläuft. Die Moderation stellt 1 bis 60 Minuten, hält an, setzt fort, gibt fünf Minuten mehr. Alle
  lesen die Restzeit in ganzen Minuten, auf der Wand und im Titel des Tabs. Ist die Zeit um, ist nichts gesperrt.
- **Die Bremse je Wand:** 1.500 gespeicherte Änderungen am UTC-Tag, gezählt über die Nummer, mit der der Tag
  begann (eine Zeile am Tag). Danach sagt die Wand, ab wann es weitergeht.
- **Der Kostentest hält die Entscheidung** (7.2, Nr. 11): Die übliche Wand mit 200 Bewegungen schreibt 374 Zeilen,
  die stark bewegte 1.230.
- **„Meine Angaben löschen“** (von der FokusBeam-Sitzung): Die Wand vergisst die Person, ihre Zettel bleiben ohne
  Namen.
- **Mehrere Zettel per Touch auswählen** („Auswählen“ in den Werkzeugen der Fläche).

Anders als geplant:

- **Verdeckte Zettel der anderen sind eine Zeile mit der Zahl,** nicht eine Karte je Zettel. Der Server nennt
  weder Orte noch Längen.
- **Die Bremse zählt Änderungen, nicht Zeilen.** Ein Löschen schreibt zwei Zeilen und zählt einmal. Im
  schlechtesten Fall sind es rund 2.250 Zeilen am Tag statt 1.500.
- **In der Schreibphase kann auch die Moderation keine fremden Zettel löschen,** weil sie sie nicht bekommt.

Nicht geprüft: ein echtes Handy oder Touch-Gerät, ein Screenreader, ein anderer Browser als Chromium. Der Satz der
Bremse ist mit einer nachgestellten Antwort des Servers geprüft, kein Test hat 1.500 Änderungen geschrieben. Kein
Test hat eine echte Minute gewartet.

### Etappe 4a: KI beim Anbieter

Route `/arrange`, Bindung an Workers AI, Prompts und Prüfung in `packages/arrange`, Tagesbudget und Grenze je Wand,
Vorschau, „Anwenden“, Anordnen, Bewegung, „Rückgängig“, Überschriften in der Sprache der Wand, der Hinweis, wo
gerechnet wird. Dazu die Messungen aus 4.6.

Abnahme:

- Auf den zwei Testwänden erreicht das Produkt ARI ≥ 0,7 und ordnet 250 Zettel in höchstens 45 Sekunden.
- Die Messungen aus 4.6 sind gelaufen und stehen in `docs/`. Was nicht messbar war, steht namentlich drin.
- `/arrange` nimmt keinen Zetteltext vom Client an und antwortet ohne Admin-Token mit einer Ablehnung. Tests
  belegen beides.
- Ist das Tagesbudget leer, ruft der Worker die KI nicht mehr. Ein Test belegt es mit einem Budget von null.
- Der WallRoom ruft die KI nie. Der Hibernation-Test besteht weiter.
- Ein Zettel mit einem eingeschleusten Befehl ändert weder die Antwortform noch andere Wände.
- „Rückgängig“ stellt jede Position genau wieder her. Gesperrte Gruppen bleiben beim Ordnen unverändert.
- Bei reduzierter Bewegung springen die Zettel.
- Der Kostentest zählt die Ordnungen mit: höchstens 400 Zeilen je Wand.

**Stand 23.11.2026: gebaut, von dir nicht abgenommen.** Zweig `etappe-4a`, die Vorschau läuft damit.
`CI=1 pnpm checks` ist grün: 248 Tests im geteilten Paket, 98 in `packages/arrange`, 220 im Worker, 218 in der App,
258 Ende-zu-Ende. Nichts ist übersprungen. Deine Entscheidungen vom 23.11. zum Zähler und zum Umbenennen (7.2,
Nr. 15 und 16) sind eingebaut.

Gebaut:

- **Die Route `/arrange`:** nur mit dem Admin-Token im Kopf der Anfrage, nur nach dem Aufdecken. Der Worker liest
  die Zettel selbst aus der Wand und fragt Workers AI. Der WallRoom ruft nie hinaus.
- **Das Rezept nach der Messung** (4.3): ein Themen-Aufruf, Zuordnung mit Buchstaben auf einer Zeile, eine zweite
  Anfrage neben einer langsamen. Jede Antwort wird gegen Zettel und Themen geprüft.
- **Das Budget:** 8.000 Neuronen und sechs Läufe je Wand, beides in 24 Stunden, im RateLimiter. Vor dem Lauf wird
  eine Schätzung reserviert, danach der Verbrauch gebucht. Bei Budget null wird die KI nicht gerufen. Eine
  Ablehnung nennt den Zeitpunkt, ab dem der Lauf wieder passt.
- **Anwenden und Rückgängig:** eine Nachricht für eine ganze Anordnung. Nur der letzte Lauf lässt sich
  zurücknehmen, dann aber genau. Von Hand angelegte Gruppen bleiben unberührt.
- **Die Oberfläche:** „Ordnen“ ist nach dem Aufdecken die Hauptaktion der Moderation, auf der Fläche und in der
  Liste. Am Knopf steht, wo gerechnet wird, mit Link zur Datenschutzerklärung. Der Vorschlag steht als Vorschau auf
  der Wand, nur im Browser der Moderation. „Anwenden“ ordnet für alle, „Verwerfen“ lässt die Wand, wie sie war.
- **„Rückgängig“** wirkt direkt nach dem Ordnen sofort. Hat sich die Wand seitdem geändert, fragt es vorher und
  sagt, was verloren geht. Später steht es unter „Mehr“.
- **Für jedes Ende ohne Vorschlag ein Satz:** zu wenige Zettel, Budget leer, Läufe der Wand verbraucht, keine
  brauchbare Antwort, keine Verbindung, keine Antwort nach zwei Minuten.
- **Kein lokaler Lauf und kein Test erreicht Cloudflares KI.** Lokal antwortet ein Ersatz, der Zettel nach ihrem
  ersten Wort gruppiert.
- **Die Datenschutzerklärung** beschreibt das Ordnen als Stand (Abschnitt 3.4, von der FokusBeam-Sitzung).

| Abnahmepunkt | Stand |
|---|---|
| ARI ≥ 0,7 auf den zwei Testwänden, 250 Zettel in höchstens 45 Sekunden | **Erfüllt**, gegen die Vorschau gemessen: ARI 0,81 bis 0,91, 10 bis 22 Sekunden (`docs/messung-4a.md`, Abschnitt 7) |
| Die Messungen aus 4.6 sind gelaufen und stehen in `docs/` | **Erfüllt bis auf eine:** Eine echte Wand fehlt, es gibt keinen Export (7.3 G). Die Modelle für den eigenen Schlüssel gehören zu 4b |
| `/arrange` nimmt keinen Zetteltext vom Client und lehnt ohne Admin-Token ab | **Erfüllt**, zwei Tests im Worker |
| Bei Budget null ruft der Worker die KI nicht | **Erfüllt**, ein Test |
| Der WallRoom ruft die KI nie, der Hibernation-Test besteht | **Erfüllt.** Auf der Vorschau waren die Wände während neun Läufen zusammen 4,4 Sekunden wach |
| Ein eingeschleuster Befehl ändert weder die Antwortform noch andere Wände | **Erfüllt**, Tests im Paket und im Worker. Gegen das echte Modell ist kein Angriff versucht |
| „Rückgängig“ stellt jede Position genau wieder her, gesperrte Gruppen bleiben unverändert | **Erfüllt**, im Worker und Ende-zu-Ende in zwei Browsern |
| Bei reduzierter Bewegung springen die Zettel | **Erfüllt**, Ende-zu-Ende für die Einstellung des Systems und die der App |
| Der Kostentest zählt die Ordnungen mit: höchstens 400 Zeilen je Wand | **Erfüllt, knapp:** 396 Zeilen |

Abweichungen vom Plan, alle aus der Messung oder dem Bau:

- **Höchstens sechs Themen** statt vier bis acht (4.3).
- **Keine Schritte „Themen finden“ und „Zettel zuordnen“** in der Anzeige, sondern ein Satz und die Sekunden (4.3).
- **„Fünf Minuten gestört“ nach einem Fehlschlag** (4.2) ist nicht gebaut. Es gehört zum Verteiler, der mit der
  zweiten Quelle kommt (4b).
- **Bei leerem Budget nennt die App nur „von Hand“.** Eigener Schlüssel und Reserve sind noch nicht gebaut.

Nicht geprüft:

- **Der ganze Weg im Browser gegen die echte KI ist einmal gelaufen,** mit 14 Zetteln in Chromium: Vorschau nach 7
  Sekunden, „Anwenden“, „Rückgängig“. Mit einer großen Wand, in der Liste und auf einem Handy ist er nur mit dem
  lokalen Ersatz gelaufen.
- **Die Rechenzeit unter Last.** Ein Lauf braucht 8 bis 24 ms, der Free-Plan nennt 10 (7.3 P).
- **Das Gleiten mit 250 oder 500 Zetteln** auf einem langsamen Gerät. Getestet ist es mit 8.
- Ein echtes Handy, ein Screenreader, ein anderer Browser als Chromium.
- Ob ein Lauf nach „Abbrechen“ wirklich zählt, wenn der Browser die Anfrage beendet.

### Etappe 4b: Eigener Schlüssel

Einstellung an der Wand, feste Anbieterliste, direkter Aufruf aus dem Browser, Abweichung von der
Content-Security-Policy, je Anbieter eine Messung auf dem Korpus.

Abnahme:

- Für jeden Anbieter der Liste ist geprüft, dass er Anfragen aus dem Browser zulässt. Wer es nicht tut, steht nicht
  in der Liste. Bleibt keiner, kommt die Frage zurück zu dir.
- Der Schlüssel taucht in keiner Anfrage an unseren Server auf. Ein Test liest die Anfragen selbst.
- Je Anbieter steht die gemessene Güte in `docs/`. Unter ARI 0,7 kommt kein Modell in die Liste.

**Stand 23.11.2026: gebaut, nicht gemessen, von dir nicht abgenommen.** Zweig `etappe-4b`. `CI=1 pnpm checks` ist
grün: 265 Tests im geteilten Paket, 126 in `packages/arrange`, 220 im Worker, 275 in der App, 293 Ende-zu-Ende.

- **Anbieter:** Mistral (EU-Endpunkt), OpenAI, Anthropic (über Anthropics eigene Bibliothek, Modell als
  Einstellung, voreingestellt Opus 5.5). Der Schlüssel liegt nur im Arbeitsspeicher des Tabs.
- **Unter „Mehr“** wählt die Moderation den Anbieter, liest je Anbieter eine Zeile (wo, wie lange gespeichert,
  Training, Kosten je Wand) und trägt den Schlüssel ein. Mit Schlüssel fragt „Ordnen“ den Anbieter direkt aus dem
  Browser; Vorschau, „Anwenden“ und „Rückgängig“ bleiben gleich.
- **Kein Anbieter ist gemessen, deshalb wird keiner angeboten.** Mit `#eigener-schluessel` hinter der Adresse einer
  Wand zeigt ein Tab sie trotzdem, jeweils mit dem Hinweis „noch nicht gemessen“. So kannst du deinen eigenen
  Schlüssel ausprobieren.
- **Messen:** `scripts/measure-key.mjs <anbieter>` mit dem Schlüssel in einer Umgebungsvariable.

| Abnahmepunkt | Stand |
|---|---|
| Jeder Anbieter der Liste lässt Anfragen aus dem Browser zu | Für die Vorabfrage und Fehlerantworten geprüft, eine erfolgreiche Antwort noch nicht gesehen |
| Der Schlüssel taucht in keiner Anfrage an unseren Server auf | **Erfüllt**, ein Ende-zu-Ende-Test liest alle Anfragen, Socket-Nachrichten und den Browser-Speicher |
| Je Anbieter die gemessene Güte, nichts unter ARI 0,7 | **Offen**, es fehlen Schlüssel (7.3 T). Bis dahin bietet die App keinen Anbieter an |

Nicht geprüft: kein Aufruf mit echtem Schlüssel bei irgendeinem Anbieter; nur Chromium; die
Datenschutzerklärung beschreibt diesen Weg noch nicht.

### Etappe 4c: Reserve im Browser

Modell in Teilen von der eigenen Domain, Web Worker, Einbetten, Louvain, Überschrift aus dem mittleren Zettel,
Prüfung auf WebGPU und Speicher, Rückfrage vor dem Laden.

Abnahme:

- Auf den Testwänden erreicht die Reserve die Qualität aus Etappe 0 (ARI 0,45) und ordnet 500 Zettel in Chrome auf
  dem Mac in höchstens 10 Sekunden nach dem Laden.
- Kein fremder Host, auch nicht beim Modell. Nach dem ersten Laden ordnet die Reserve ohne Netz zum Modell.
- Der Server sieht keine Einbettung. Ein Protokolltest belegt es.
- Ohne WebGPU oder mit zu wenig Speicher wird die Reserve nicht angeboten, und nichts stürzt ab. Geprüft auf dem
  Galaxy S8 über die Fleet.
- Die 218 MB lädt die App nur nach Zustimmung.

### Etappe 5: Export, Feinschliff, Start

Markdown-Export, Ergebnis-Sicht, Startseite, Rechtstexte, Barrierefreiheits-Erklärung, Budgets, Produktion. Davor
liegt deine Entscheidung, ob das Produkt eine eigene Domain bekommt, samt Namensrecherche für „IdeaBeam“.

Abnahme:

- Die Adresse steht fest, bevor der erste öffentliche Link entsteht. Raum-Links und Moderationsrechte hängen an
  ihr, ein späterer Umzug bricht sie.

- Die sebaro-Regel „fertig“: Prüfungen grün, jede Sicht in Hell und Dunkel, schmal und breit angesehen, und
  `CHECKS.md` nennt, was nicht geprüft wurde.
- Die Datenschutzerklärung nennt Host, Speicherort, Löschfrist und was beim Ordnen geschieht: wer die Zettel
  verarbeitet, dass nichts gespeichert und nicht trainiert wird, und dass es außerhalb der EU geschehen kann. Die
  Texte hat jemand vom Fach gelesen, bevor die Wand öffentlich wird.
- `release:check` besteht: kein Muster-Impressum.
- Rauchtest auf der Produktionsadresse mit zwei Browsern.

**Stand 25.11.2026: gebaut bis auf den Start, nichts deployt, von dir nicht abgenommen.** Zweig `etappe-5`.
`CI=1 pnpm checks` ist grün (mit Schritt C): 279 Tests im geteilten Paket, 126 in `packages/arrange`, 226 im Worker,
280 in der App, 315 Ende-zu-Ende. Nichts ist übersprungen.

Gebaut:

- **Schritt A (`d3cc22a`): Export und Ergebnis.** „Als Markdown sichern“ über den Sichtfilter der Wand: vor dem
  Aufdecken nur die eigenen Zettel und wie viele fehlen, keine Namen. Die Ergebnis-Sicht nach dem Ordnen, der
  QR-Code zum Link der Wand (nie zum Moderationslink).
- **Schritt B (`e77a588`): Rechtstexte und Startseite.** Die Barrierefreiheits-Erklärung in beiden Sprachen, die
  Datenschutzerklärung gegen den Code gelesen, die Startseite sagt, was v0.1 kann. `release:check` liest auch die
  Texte selbst. Seit dem 26.11. sind alle Angaben des Betreibers gefüllt (7.2, Nr. 32), und `release:check` besteht.
- **Schritt C (der Commit nach `bb4f7ac`): Produktion vorbereitet, nichts deployt.**
  - `apps/worker/wrangler.jsonc`: Die oberste Ebene ist das Produkt, der Worker `ideabeam` auf der eigenen Domain
    `ideabeam.de` (`custom_domain`), mit 8.000 Neuronen und 25 Wänden am Tag. Die Vorschau ist die Umgebung
    `vorschau`: derselbe Worker-Name `ideabeam-vorschau` wie bisher, ohne Route, mit 1.000 Neuronen (7.2, Nr. 27),
    wirksam erst mit ihrem nächsten Deploy. Wie bei RetroBeam: www wird in der Zone auf die Domain umgeleitet, keine
    zweite Domain, denn Sitzung und Moderationsrecht liegen im `localStorage` einer Adresse. `workers_dev` bleibt an,
    damit ein Fehler beim Anhängen der Domain das Produkt nicht unerreichbar macht.
  - Zwei Worker-Namen haben zwei getrennte Durable-Object-Namensräume: Die Wände der Vorschau ziehen nicht ins
    Produkt um, das Produkt startet leer.
  - `scripts/production-deploy.sh`: lehnt ab bei Änderungen im Arbeitsbaum, wenn HEAD weder `main` noch ein Tag ist,
    wenn der Commit in keinem Zweig eines Remotes liegt, und solange `release:check` scheitert (heute also immer).
    Baut mit `VITE_COMMIT_SHA` und prüft danach, dass `_headers` unverändert gebaut ist, dass der Commit in der App
    steht und dass der gebaute Worker `ideabeam` auf `ideabeam.de` mit 8.000 Neuronen ist. Erst dann
    `wrangler deploy`.
  - `scripts/preview-deploy.sh` baut jetzt die Umgebung `vorschau` und setzt `VITE_COMMIT_SHA`.
  - `scripts/smoke.mjs`: der Rauchtest mit zwei Browsern (Chromium und Firefox): Wand anlegen, zwei Namen,
    verdeckt schreiben, die andere Seite sieht nichts, aufdecken, beide sehen alles, Markdown sichern, Wand löschen.
    „Ordnen“ nur mit `--ordnen`. Eine Wand des Tages, rund 35 Zeilen, druckt kein Token. Lokal mit `--selftest`
    gegen `vite preview` grün, mit und ohne `--ordnen`. Nicht Teil von `pnpm checks` (`apps/web/CHECKS.md`).

Offen für den Start, und wer es tun muss:

| Was | Wer |
|---|---|
| `ideabeam.de` kaufen und die Zone ins persönliche Cloudflare-Konto legen (dasselbe Konto wie RetroBeam). Dazu www auf die Domain umleiten (Weiterleitungsregel der Zone, wie bei RetroBeam) | Du |
| Die Rechtstexte mit einem Generator-Dienst abgleichen (7.2, Nr. 29), dann `NOTICE_REVIEWED` in `operator.ts`. Eine Liste der Punkte, die ein Generator nicht kennt (KI, eigener Schlüssel, Export), lege ich dir auf Wunsch vor | Du |
| Die Cloudflare-Einstellungen der Zone im Dashboard prüfen (kein Web-Analytics-Beacon, keine Bot-Cookies, keine Challenges), dann `CLOUDFLARE_SETTINGS_CHECKED` | Du |
| Das Repository öffentlich, mit einem einzigen Commit ohne Vorgeschichte (7.2, Nr. 28), dann `REPO_URL`. Der Deploy muss von genau diesem Commit kommen, denn die Fußzeile verlinkt ihn. Ich lese den Stand durch und bereite den Commit vor; Push und Freischalten auf dein Wort | Ich bereite vor, du gibst das Wort |
| Das Zeichen des Produkts: Der Platzhalter bleibt zum Start (7.2, Nr. 30) | Erledigt |
| Dein Wort zum Deploy, dann `production-deploy.sh` und der Rauchtest auf `https://ideabeam.de`; die Vorschau danach einmal neu deployen (1.000 Neuronen) | Du gibst das Wort, ich führe aus |
| Die Vorschau bekommt 5 Wände am Tag, das Produkt behält 25 (7.2, Nr. 32) | Erledigt in der Konfiguration, wirksam mit dem nächsten Deploy der Vorschau |

| Abnahmepunkt | Stand |
|---|---|
| Die Adresse steht fest, bevor der erste öffentliche Link entsteht | **Entschieden, nicht gekauft:** `ideabeam.de` (7.2, Nr. 25), so in der Konfiguration. Öffentliche Links gibt es bisher nur zur Vorschau |
| Die sebaro-Regel „fertig“ | **Teilweise:** Prüfungen grün, jede Sicht in Hell und Dunkel, schmal und breit durch `tests/screens.spec.ts`; `CHECKS.md` nennt, was nicht geprüft ist. Von dir angesehen ist Etappe 5 nicht |
| Die Datenschutzerklärung nennt Host, Speicherort, Löschfrist und das Ordnen; jemand vom Fach hat sie gelesen | **Geschrieben, nicht gelesen.** Abgleich mit einem Generator durch dich (7.2, Nr. 29) |
| `release:check` besteht | **Erfüllt** am 26.11.2026 |
| Rauchtest auf der Produktionsadresse mit zwei Browsern | **Offen:** Skript gebaut und lokal grün, die Produktion gibt es noch nicht |

Nicht geprüft: alles bei Cloudflare. Ob die eigene Domain anhängt, ob die Vorschau als Umgebung ihre Wände behält
(gleicher Worker-Name, also dieselben Durable Objects), ob www umleitet. Die Deploy-Skripte liefen nur bis zu ihren
Ablehnungen, nie bis `wrangler deploy`. Mehr in `apps/web/CHECKS.md`.

---

## 7 Risiken und offene Fragen

### 7.1 Risiken

| Nr. | Risiko | Gegenmittel |
|---|---|---|
| R1 | **Die Gruppen taugen nicht.** Gemessen ist das Gegenteil (ARI 0,83), aber an einem erfundenen Korpus und mit einem Lauf je Modell | Messungen aus 4.6 in Etappe 4a, darunter eine echte Wand. Vorschau, „Rückgängig“ und Handarbeit sind gleichwertige Wege |
| R2 | **Die Reserve läuft nicht überall.** Sie braucht WebGPU und rund 1 GB Speicher, auf Handys ist nichts gemessen | Nur anbieten, wo beides da ist. Sonst von Hand oder eigener Schlüssel |
| R3 | **218 MB für die Reserve** | Laden nur nach Zustimmung, Hinweis auf WLAN, ehrlicher Ladezustand |
| R4 | **Free-Tier:** geschriebene Zeilen, und das Konto teilt sich die Limits | Lage-Datensatz, Kostentest, Tagesbudget je Produkt, Wechsel auf Paid ab 50 % |
| R5 | **Die eigene Fläche kostet mehr als gedacht** | Plan B React Flow, harte Grenze: kein Zeichnen |
| R6 | **Hibernation bricht**, die Dauer steigt auf das Hundertfache | Kein Timer, kein ausgehender Aufruf, Test in Etappe 1, Blick auf die Abrechnung nach dem ersten Betrieb |
| R7 | **Verborgenes sickert durch**: Schnappschuss, Export, Fehlercodes | RetroBeams Symmetrie-Test als Muster, Test auf Nachrichtenebene |
| R8 | **WebGPU liefert andere Zahlen** (Reserve) | Probe mit drei Sätzen gegen bekannte Vektoren, sonst keine Reserve auf diesem Gerät |
| R9 | **sebaro ist im Umbau**: Foundry v3.0.0 ist von heute | Release festhalten, Lücken notieren |
| R10 | **Missbrauch** anonymer Wände als Ablage oder für Spam | Bremse je IP, nur Text, Grenzen, Löschfrist |
| R11 | **Name und Marke** ungeprüft, Domain offen | Recherche für „IdeaBeam“ und Verfügbarkeit einer Domain vor Etappe 5 |
| R12 | **Synthetischer Korpus** misst an echten Sitzungen vorbei | In Etappe 4a mit einer echten, freigegebenen Wand nachmessen, lokal |
| R13 | **Abhängigkeit vom Gratis-Angebot.** Cloudflare kann Kontingent, Preise und Modelle ändern. Eines der Testmodelle wurde zwei Tage vor der Messung abgekündigt | Modell als Einstellung, ein zweites gemessenes Modell als Ersatz, Quellenliste, Reserve im Browser |
| R14 | **Das Budget reicht nicht.** 8.000 Neuronen sind rund 65 übliche Wände am Tag | Grenze je Wand, Reserve, eigener Schlüssel. Neuronen kaufen ist deine Entscheidung (7.3, E) |
| R15 | **Die KI-Route wird ausgenutzt**, als Gratis-KI oder um das Budget zu leeren | Prompt entsteht auf dem Server, Admin-Token nötig, Grenze je Wand, Bremse beim Anlegen je IP, Tagesbudget als harte Kostengrenze |
| R16 | **Datenschutz-Aussage.** Beim Standard wird nicht sicher in der EU gerechnet | Klarer Hinweis am Knopf, „Im Browser ordnen“ und eigener Schlüssel als Wege, Prüfung der Texte vor dem Start (7.3, F) |
| R17 | **Kein Anbieter lässt Aufrufe aus dem Browser zu**, dann trägt „Eigener Schlüssel“ so nicht | Prüfung zu Beginn von 4b. Sonst zurück zu dir |

### 7.2 Fragen und deine Entscheidungen (21. und 22.11.2026)

| Nr. | Frage | Empfehlung | Deine Entscheidung |
|---|---|---|---|
| 1 | **Adresse.** vibe-ai.de ist heute eine Inhaltsseite aus dem mycelium-Netz mit Zugriffsmessung. Wo läuft die Wand? | Auf vibe-ai.de selbst, die Artikel ziehen um | „besorgen eine domain wenn es cool ist“. So gelesen: eigene Domain, sobald das Produkt taugt. Bis dahin workers.dev, vibe-ai.de bleibt unberührt |
| 2 | **Name und Kennung.** | „IdeaBeam“ | „IdeaBeam“ |
| 3 | **Schnitt v0.1.** Ohne Voting, Aufgaben, Zeiger, Minimap und weitere Vorlagen | So lassen | So lassen |
| 4 | **Messgeräte.** Die Fleet hat Android, aber kein iPhone | Fleet tagsüber, dazu einmal dein iPhone | Fleet tagsüber, dazu einmal dein iPhone |
| 5 | **Cloudflare-Konto.** Die Limits gelten je Konto | Gleiches Konto wie RetroBeam, Paid bei Bedarf | Gleiches Konto, Tagesbudget je Produkt, Paid (5 $ im Monat), sobald ein Limit an einem Tag über 50 % liegt |
| 6 | **Zettel-Farben.** sebaro erlaubt keine farbige Fläche hinter Text und keine Farbe je Person | v0.1 ohne Farben | v0.1 ohne Farben |
| 7 | **Ordnen-Bewegung.** sebaro erlaubt 200 ms | Ausnahme: bis 600 ms | Ausnahme: bis 600 ms, gestaffelt, bei reduzierter Bewegung Sprung |
| 8 | **Wo die KI rechnet** (22.11.). Im Browser ordnet kein Modell gut genug. Deine Idee: über KI-Anbieter | Cloudflare gratis, Browser als Reserve | Cloudflare gratis, Browser als Reserve |
| 9 | **Bezahlte Stufe** (22.11.): Ordnen garantiert in der EU, ohne Speicherung, ohne Training | Später, nach v0.1 | „lass 2. als möglichkeit einbauen und später zusätzlich 1“. So gelesen und von dir bestätigt: „Eigener Schlüssel“ ab v0.1, die bezahlte Stufe später |
| 10 | **Messen bei Cloudflare** (22.11.) mit dem erfundenen Korpus über dein privates Konto, im Gratis-Kontingent | Ja | Ja |
| 11 | **Was eine Bewegung kostet** (22.11.). Eine stark bewegte Wand schreibt 1.228 Zeilen statt 400 | Speichern wie heute, dazu eine Bremse je Wand, und an echten Wänden zählen | Speichern wie heute, mit Bremse je Wand in Etappe 3 |
| 12 | **Fußzeile auf der Wand** (22.11.). Sie liegt unter dem Fensterrand, damit die Fläche höher wird | So lassen | So lassen |
| 13 | **Uhr für die Schreibphase** (22.11.) | Ohne Uhr starten | Mit Uhr |
| 14 | **Zettel beim Löschen der eigenen Angaben** und **Namen auf Zetteln** (22.11., über die FokusBeam-Sitzung gemeldet) | Zettel bleiben ohne Namen; niemand sieht, wer einen Zettel schrieb | So entschieden. Eigene Zettel tragen „Deiner“ |
| 15 | **Zähler für das KI-Budget** (23.11.). Cloudflares Kontingent läuft über 24 Stunden, der Zähler des Produkts über den Kalendertag | Umstellen auf 24 Stunden; Cloudflares Ablehnung heißt in der App „Kontingent aufgebraucht“ | Umstellen |
| 16 | **Umbenannte KI-Gruppe** (23.11.). Bisher nahm das nächste „Ordnen“ ihre Zettel wieder mit | Umbenennen sperrt die Gruppe wie eine von Hand angelegte | Umbenennen sperrt |
| 17 | **Rechenzeit des Workers** (23.11.): 8 bis 24 ms je „Ordnen“, der Free-Plan nennt 10 | Beobachten | Ursache suchen und unter 10 ms drücken |
| 18 | **Nach Etappe 4a** (23.11.) | Etappe 4b bauen | Etappe 4b bauen. Zuerst klären, ob die Anbieter Anfragen aus dem Browser zulassen |
| 19 | **Anbieter für den eigenen Schlüssel** (23.11.). Getestet war, dass IONOS, OVHcloud und Mistral Anfragen aus dem Browser zulassen | IONOS und OVHcloud | „Mistral, warum nicht ein openai oder anthropic oder so api key? das wäre doch in ordnung wenn es für die user okay ist.“ Also: Mistral, OpenAI und Anthropic, nicht mehr nur Anbieter in der EU. Die App sagt je Anbieter, wohin die Zettel gehen und wie lange sie dort liegen |
| 20 | **Schlüssel zum Messen** (23.11.). Konten bei den Anbietern kannst nur du anlegen | Erst bauen, Schlüssel später | Erst bauen, Schlüssel später. Die Anbieter bleiben in der App unsichtbar, bis gemessen ist |
| 21 | **Wo der Schlüssel der Moderation liegt** (23.11.) | Nur für diese Sitzung | Nur für diese Sitzung |
| 22 | **`main` und Remote** (24.11.). Etappen 1 bis 4b in `main` übernehmen, privates GitHub-Repository anlegen und pushen | – | „mach beides“ |
| 23 | **Lizenz „Unlicense“** (25.11.) für `fast-sha256` unter Anthropics Bibliothek erlauben (7.3 V) | Bestätigen | „erstmal in Ordnung“ |
| 24 | **`uqr` für den QR-Code** (25.11.), MIT, ohne eigene Abhängigkeiten, wie in RetroBeam | Erlauben | Erlauben |
| 25 | **Adresse zum Start** (25.11.). ideabeam.de ist laut DENIC frei, .com und .eu sind vergeben; der Name ist nur per Websuche geprüft, nicht im Markenregister | ideabeam.de kaufen | ideabeam.de kaufen. Kaufen kann nur der Inhaber |
| 26 | **Rechenzeit des Workers** (25.11., 7.3 U): Median 8,8 ms, 5 von 12 Läufen über 10 ms, keiner gescheitert | Hinnehmen, beobachten | Hinnehmen, beobachten |
| 27 | **KI-Budget der Vorschau** (25.11., 7.3 R) | Vorschau auf 1.000 Neuronen, sobald das Produkt läuft | Vorschau auf 1.000 |
| 28 | **Quellcode zum Start** (25.11.). Die AGPL verlangt den Quellcode für alle, die eine laufende Instanz nutzen | Das Repository öffentlich machen | „repo öffentlich machen, aber die history auf einen commit reduzieren“. Beim Start: ein Commit ohne Vorgeschichte mit dem Stand von `main`, vorher durchgelesen, gepusht nur auf das Wort des Inhabers; die bisherige Historie bleibt lokal. Vorschlag: als Autor die Noreply-Adresse von GitHub statt der privaten |
| 29 | **Wer liest die Rechtstexte** (25.11., 7.3 F) | – | „Generator-Dienst abgleichen“. Der Inhaber gleicht ab: Ein Generator braucht die Angaben des Betreibers, und die gibt keine Sitzung an fremde Dienste |
| 30 | **Zeichen des Produkts** (25.11., 7.3 H) | Platzhalter behalten | Platzhalter behalten |
| 31 | **Barrierefreiheit** (26.11.) | – | „wir sind von der barrierefreiheit ausgenommen, da wir unter die ausnahmen fallen“. Die Erklärung sagt das als Angabe des Betreibers, ohne Grund, bleibt freiwillig stehen und nennt keine Marktüberwachungsstelle |
| 32 | **Der Start** (26.11.): Domain, Zone, Rechtstexte, Repository, Deploy | – | „mach du den ganzen scheiß für mich, ich logge dich auch ein, sowohl in netcup als auch cloudflare.“ `ideabeam.de` hat der Inhaber bei netcup gekauft. Die Rechtstexte hat die führende Sitzung mit den Punkten eines Generators abgeglichen; die Vorschau bekommt 5 Wände am Tag (der Vorschlag aus dem Stand von Etappe 5) |
| 33 | **Öffentliches Repository** (26.11.), Umsetzung von Nr. 28 | – | Das private Repository öffentlich zu schalten, hätte die alte Historie nicht entfernt: Die Pull Requests von Dependabot halten alte Commits auf GitHub fest. Deshalb wird es zu `ideabeam-archiv` (privat), und `grundhofer/ideabeam` entsteht neu, öffentlich, mit einem Commit; Autor ist die Noreply-Adresse von GitHub |

### 7.3 Noch offen

| Nr. | Was | Wann |
|---|---|---|
| A | Welche Domain, und ob sie gekauft wird. Naheliegend ist eine zum Namen passende. Verfügbarkeit ist ungeprüft | Entschieden am 25.11.2026: ideabeam.de (7.2, Nr. 25). Gekauft ist sie noch nicht |
| B | Namens- und Markenrecherche für „IdeaBeam“ | Vor Etappe 5 |
| C | Dein Startzeichen für Etappe 1 | Gegeben am 22.11.2026 |
| D | Bleibt die Reserve im Browser (4c, 5 AT mit Zuschlag) in v0.1, oder rückt sie nach v0.2? Ohne sie heißt „Budget leer“: von Hand oder eigener Schlüssel | Vor Etappe 4 |
| E | Kaufst du Neuronen, wenn das Tagesbudget nicht reicht, und bis zu welchem Betrag im Monat? | Wenn das Budget an mehreren Tagen leer läuft |
| F | Wer liest die Datenschutztexte, vor allem den Satz zum Ordnen außerhalb der EU? | Entschieden am 25.11.2026: mit einem Generator-Dienst abgleichen, durch den Inhaber (7.2, Nr. 29) |
| G | Der Pfad zu einem Export einer echten Wand, zum lokalen Nachmessen | Vor Etappe 4a |
| H | Das Zeichen des Produkts. Gebaut ist ein Platzhalter. Ich lege dir Skizzen vor | Entschieden am 25.11.2026: Der Platzhalter bleibt zum Start (7.2, Nr. 30) |
| I | Dein Wort für eine Vorschau auf workers.dev | Gegeben am 22.11.2026. Die Vorschau läuft |
| J | Was eine Bewegung kostet (3.6) | Entschieden am 22.11.2026 (7.2, Nr. 11) |
| K | „Meine Angaben löschen“: Was geschieht mit den Zetteln einer Person, die ihre Angaben von der Wand löscht? Vorschlag: Die Zettel bleiben ohne Namen, und der Dialog sagt das wörtlich. Wer sie weghaben will, löscht sie vorher selbst. Bis dahin verweist die Datenschutzerklärung auf den Betreiber | **Entschieden am 22.11.2026, so wie vorgeschlagen.** Du hast es der FokusBeam-Sitzung gesagt („mach beides nach empfehlung“), sie hat es mir gemeldet. Gebaut am 22.11.2026 von der FokusBeam-Sitzung: „Meine Angaben löschen“ in „Mehr“ auf der Wand |
| L | Bekommt die Schreibphase eine Uhr? | Entschieden am 22.11.2026: ja (7.2, Nr. 13) |
| M | Soll sichtbar sein, wer einen Zettel geschrieben hat? Heute erfährt es nur, wer ein Vorleseprogramm nutzt („von Anna“), Sehende nicht. Das soll eine bewusste Entscheidung sein: allen zeigen oder niemandem sagen. Sie hängt am verdeckten Schreiben | **Entschieden am 22.11.2026: niemandem.** Kein Name auf einem Zettel, auch nicht für Vorleseprogramme. Den eigenen Zettel erkennt man als „Deiner“. Du hast es der FokusBeam-Sitzung gesagt, sie hat es mir gemeldet. Folge für Etappe 3: Der Server schickt die Kennung der schreibenden Person heute noch an alle Browser. Mit dem Filter je Empfänger soll er nur noch sagen, ob ein Zettel der eigene ist |
| N | Fußzeile auf der Wand unter dem Fensterrand | Entschieden am 22.11.2026: so lassen (7.2, Nr. 12) |
| O | Eine Gruppe der KI, die jemand umbenannt hat: Soll Umbenennen sie sperren wie eine von Hand angelegte? | Entschieden am 23.11.2026: ja (7.2, Nr. 16) |
| P | Die Rechenzeit des Workers je „Ordnen“ liegt bei 8 bis 24 ms, der Free-Plan nennt 10 ms | Entschieden am 23.11.2026: Ursache suchen (7.2, Nr. 17) |
| Q | Cloudflares Kontingent läuft über 24 Stunden, der Zähler des Produkts über den UTC-Tag | Entschieden am 23.11.2026: umstellen (7.2, Nr. 15) |
| R | Vorschau und Produkt haben je einen eigenen Zähler mit 8.000 Neuronen, das Konto gibt 10.000. Vorschlag: Die Vorschau bekommt 1.000, sobald das Produkt läuft | Entschieden am 25.11.2026: Die Vorschau bekommt 1.000 (7.2, Nr. 27), umgesetzt mit dem Einrichten des Produkts |
| S | Welches Modell bei Anthropic? Das empfohlene (Opus 5.5) kostet rund 12 Cent je Wand, das kleinste (Haiku 5.5) rund 0,2 Cent. Gebaut ist das Modell als Einstellung, voreingestellt das empfohlene | Mit der Messung, sobald ein Schlüssel da ist |
| T | Schlüssel für Mistral, OpenAI und Anthropic zum Messen (7.2, Nr. 20). Ohne Messung bleibt ein Anbieter in der App unsichtbar | Vor der Abnahme von 4b. Stand 25.11.2026: Ein Schlüssel kommt später |
| V | Eine Bibliothek unter Anthropics Bibliothek (`fast-sha256`) steht unter „Unlicense“, einer Freigabe ohne Bedingungen. Die Liste der erlaubten Lizenzen kannte sie nicht und ist um sie ergänzt | Entschieden am 25.11.2026: bestätigt (7.2, Nr. 23) |
| U | Die Rechenzeit des Workers je „Ordnen“ nach dem Umbau auf `zod/mini` (7.2, Nr. 17), gemessen in 12 Läufen: Median 8,8 ms, fünf über 10 ms, keiner gescheitert. Der Weg ohne KI bleibt unter 10 ms; der Rest liegt an Cloudflares Anbindung an die KI (`docs/messung-4a.md`, Abschnitt 8). Hinnehmen und beobachten, oder Workers Paid? | Entschieden am 25.11.2026: hinnehmen und beobachten (7.2, Nr. 26) |

---

## 8 Nicht geprüft

- **Gemessen ist nur der Mac.** Android, iPhone und die volle Safari-Reihe fehlen. Das Zusammensetzen der
  Modelldateien ist in Chrome gemessen, in Safari nur im Kurztest gelaufen.
- **Bei Cloudflare:** ein Lauf je Modell auf zwei erfundenen Wänden. Was fehlt, steht in 4.6. Die 26 Sekunden sind
  aus Einzelzeiten gerechnet. Der Verbrauch ist aus den Antworten gelesen, nicht aus der Abrechnung.
- **Die Recherche zu den Anbietern** ist ein Durchgang. Ein zweites Mal gelesen habe ich nur Cloudflares Seiten und
  Googles Regel für den EWR.
- **Recht:** ob Ordnen außerhalb der EU zur Zusage „Speicherung in der EU“ passt, und was eine bezahlte Stufe an
  Pflichten auslöst.
- Ob IONOS, Scaleway, OVHcloud und Mistral Anfragen aus dem Browser zulassen.
- Die Rechenzeit des Workers je `/arrange` ist gemessen (8 bis 24 ms). Ungeprüft ist, wie der Free-Plan das unter
  Last behandelt.
- Die echte Laufzeit je Nachricht im Durable Object und damit die abgerechnete Dauer.
- Ob R2 ein Zahlungsmittel verlangt. Ob der Speicher je Objekt im Free-Tier 1 oder 10 GB ist (die Doku
  widerspricht sich). Geklärt ist seit dem 22.11.2026: Auto-Response-Pings zählen nicht als Anfrage (3.6).
- Preise von Lucidspark und Canva, der Preis einer tldraw-Lizenz, die Credits je Cluster-Aktion bei Miro.
- Namens- und Markenrecherche für „IdeaBeam“, Verfügbarkeit einer passenden Domain.
- Ich habe RetroBeams `board-room.ts` (5.396 Zeilen) nur in der Gliederung gelesen, nicht Zeile für Zeile.
- Ein Screenreader-Durchgang von Hand ist nicht eingeplant.

## 9 Quellen (Auswahl)

KI-Anbieter: Preise, Limits, Bedingungen und die entscheidenden Sätze stehen mit Adressen in
[docs/ki-anbieter.md](docs/ki-anbieter.md), Abschnitt 5.

Konkurrenz

- https://miro.com/pricing/ · https://help.miro.com/hc/en-us/articles/28781881506834
- https://www.figma.com/pricing/ · https://help.figma.com/hc/en-us/articles/18711926790423
- https://www.mural.co/pricing · https://www.mural.co/ai
- https://help.lucid.co/hc/en-us/articles/31463501699476
- https://help.stormboard.com/en/articles/11492874-what-is-stormai
- https://help.klaxoon.com/hc/en-us/articles/32681241088146-Group-Items-by-Topic-With-AI
- https://support.microsoft.com/en-US/whiteboard/organize-your-ideas-with-copilot-in-whiteboard
- https://conceptboard.com/pricing/ · https://collaboard.app/pricing
- https://github.com/vmorais17/sticky-insights · https://github.com/ianarawjo/splat

Canvas und Sync

- https://github.com/tldraw/tldraw/blob/main/LICENSE.md · https://tldraw.dev/community/license
- https://github.com/tldraw/tldraw/blob/v5.6.2/packages/sync-core/src/lib/TLSyncRoom.ts
- https://github.com/excalidraw/excalidraw/issues/5759 · https://plus.excalidraw.com/docs/sdk/excalidraw/faq
- https://reactflow.dev/learn/advanced-use/accessibility
- https://discuss.yjs.dev/t/generate-an-inverse-update/2765
- https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

Modelle und Laufzeit

- https://github.com/huggingface/transformers.js/releases · https://huggingface.co/docs/transformers.js/api/env
- https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2
- https://huggingface.co/ibm-granite/granite-embedding-97m-multilingual-r2
- https://huggingface.co/Xenova/multilingual-e5-small
- https://huggingface.co/onnx-community/embeddinggemma-2-ONNX
- https://huggingface.co/sentence-transformers/static-similarity-mrl-multilingual-v1
- https://github.com/embeddings-benchmark/results
- https://sbert.net/examples/sentence_transformer/applications/clustering/README.html
- https://maartengr.github.io/BERTopic/getting_started/ctfidf/ctfidf.html
- https://webkit.org/blog/14403/updates-to-storage-policy/
- https://developer.chrome.com/docs/ai/summarizer-api

Cloudflare

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/durable-objects/reference/data-location/
- https://developers.cloudflare.com/r2/pricing/
