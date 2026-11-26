# Herkunft

Was dieses Repository von anderswo übernommen hat, damit sich eine Korrektur an der Quelle nachziehen lässt.
Wer eine weitere Datei kopiert, trägt sie hier mit Quelle und Commit ein. RetroBeam und FokusBeam werden von
hier aus nie geändert. Gelesen wird dort nur die eingecheckte Historie (`git show <commit>:<pfad>`), nie der
Arbeitsstand.

## Aus FokusBeam, und darüber aus RetroBeam

Quelle: FokusBeam, bis zum 22.11.2026 „Fokusschicht“ (lokales Repository `stack-shift`, noch ohne Remote), Lizenz AGPL-3.0-or-later, derselbe
Rechteinhaber. FokusBeam hat diese Dateien seinerseits aus RetroBeam übernommen (`grundhofer/retrobeam`,
Commit `f77854d`, 2026-11-21) und in seiner eigenen `docs/HERKUNFT.md` festgehalten. Kopierte Quelldateien
behalten ihre SPDX-Zeilen.

Der Plan (Abschnitt 5) nennt RetroBeam als Quelle. Für das Gerüst habe ich FokusBeam genommen, weil es dieselben
Dateien schon an den sebaro-Starter 3.0 und an einen Workspace mit Worker angepasst hat.

### Das Gerüst (Commits `f8fd4b2` und `23e640a` in FokusBeam)

| Datei hier | Quelle in FokusBeam | Übernahme | Geändert |
|---|---|---|---|
| `LICENSE`, `LICENSES/AGPL-3.0-or-later.txt`, `LICENSES/MIT.txt`, `LICENSES/OFL-1.1.txt` | gleichnamig | unverändert | nichts. `LICENSE` ist bytegleich mit RetroBeams |
| `LICENSES/LicenseRef-sebaro-reserved.txt` | gleichnamig | Text | Produktname |
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierignore` | gleichnamig | angepasst | Namen; `proto` ausgenommen |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | gleichnamig | angepasst | Namen |
| `packages/shared/` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/protocol.ts`) | gleichnamig | angepasst | Namen |
| `packages/shared/src/ids.ts`, `test/ids.test.ts` | gleichnamig | erweitert | dazu `WALL_ID_PATTERN` und sein Test |
| `apps/worker/src/ids.ts` | gleichnamig, Stand `HEAD` von `etappe-4` am 2026-11-22 | angepasst | Kommentar nennt Wand und Admin-Token |
| `apps/worker/src/wall-stub.ts` | `apps/worker/src/room-stub.ts`, derselbe Stand | angepasst | Namen (Wand, `WALL_ROOM`, `WallRoom`) |
| `apps/worker/wrangler.jsonc`, `vitest.config.ts`, `tsconfig.json`, `test/env.d.ts`, `test/http.test.ts`, `public/index.html` | gleichnamig | angepasst | Namen |
| `REUSE.toml`, `AGENTS.md`, `README.md` | gleichnamig | Aufbau | Inhalt für IdeaBeam |
| `scripts/preview-deploy.sh` | gleichnamig, Commit `fefa525` | angepasst | Name der Vorschau; seit Etappe 5 die Umgebung `vorschau` (unten) |
| `docs/ANSICHTEN.md`, `docs/sebaro-luecken.md`, dieses Dokument | gleichnamig | Aufbau | Inhalt für IdeaBeam |

### Wände: anlegen, beitreten, wer ist da, löschen, ablaufen (Commit `755b267` in FokusBeam)

| Datei hier | Quelle in FokusBeam | Übernahme | Geändert |
|---|---|---|---|
| `packages/shared/src/protocol.ts` | gleichnamig | angepasst | Wand, Frage, Admin; neu sind `roster.updated` und `MAX_FRAME_BYTES` |
| `packages/shared/src/session-key.ts` | gleichnamig | unverändert | nichts |
| `packages/shared/src/domain/join.ts` | gleichnamig | angepasst | `planJoin` mit `isAdmin` und Rollen; `joinNotice` ist neu |
| `packages/shared/src/domain/names.ts` | gleichnamig | unverändert | zwei Wörter in Kommentaren |
| `packages/shared/src/domain/wall.ts` | `domain/room.ts` | angepasst | Namen; der Fall `roster.updated` ist neu |
| `packages/shared/test/{join,names,protocol,wall}.test.ts` | `{join,names,protocol,room}.test.ts` | angepasst | neue Fälle |
| `apps/worker/src/wall-room.ts` | `shift-room.ts` | angepasst | Namen; Frage statt Raumname; `presence.join` nur beim ersten Socket einer Person |
| `apps/worker/src/index.ts` | gleichnamig | angepasst | Namen, Routen unter `/api/walls` |
| `apps/worker/src/rate-limiter.ts` | gleichnamig | unverändert | nichts |
| `apps/worker/wrangler.jsonc` | gleichnamig | angepasst | `RATE_LIMITER`, `CREATE_LIMITER` (Namensraum 3001), Migration |
| `apps/worker/test/{helpers,http.test,ws.test,retention.test,rate-limiter.test}.ts` | gleichnamig | angepasst | neue Fälle |

Für `roster.updated` wurde RetroBeam (`protocol.ts`, `reducer.ts`, `board-room.ts`, Stand `3401467`) nur gelesen,
nichts daraus kopiert.

### Die Ansichten der App (Commit `8fbc7d2` in FokusBeam)

| Datei hier, unter `apps/web/` | Quelle in FokusBeam | Übernahme | Geändert |
|---|---|---|---|
| `src/lib/api.ts`, `api.test.ts` | gleichnamig | angepasst | Namen, Routen |
| `src/lib/input.ts`, `input.test.ts` | `lib/names.ts`, `names.test.ts` | angepasst | umbenannt: Eine Frage ist kein Name |
| `src/lib/socket.ts` | gleichnamig | angepasst | dazu `rejoin()`; still nach einem gewollten Schließen |
| `src/store/walls.ts`, `walls.test.ts` | `store/rooms.ts`, `rooms.test.ts` | angepasst | Admin-Token in eigener Tabelle; folgt anderen Tabs |
| `src/store/wall.ts` | `store/room.ts` | angepasst | Namen. `wall.test.ts` ist neu |
| `src/pages/Start.tsx`, `Walls.tsx`, `NewWall.tsx` mit Test, `Wall.tsx` | `Start.tsx`, `Rooms.tsx`, `NewRoom.tsx` mit Test, `Room.tsx` | angepasst | Frage, Moderation, Moderationslink. `Wall.test.tsx` ist neu |
| `src/components/CopyKey.tsx`, `src/test-socket.ts` | aus `Room.tsx` herausgelöst | neu | – |
| `tests/wall.spec.ts` | `tests/room.spec.ts` | angepasst | dazu Moderationslink und „keine Anfrage an einen fremden Host“ |
| `src/main.tsx`, `main.test.tsx`, `test-setup.ts`, `app.css`, `components/Shell.tsx`, `View.tsx`, `Commands.tsx`, `i18n/de.json`, `en.json`, `tests/app.ts`, `screens.spec.ts`, `keyboard.spec.ts`, `data-safety.spec.ts`, `rules.spec.ts`, `start.spec.ts` | gleichnamig | wie dort geändert | Inhalt für IdeaBeam |

### Der Rahmen und die Startseite (Commit `5ebe858` in FokusBeam, Stand `8dab39f`)

Am 22.11.2026 hat der Inhaber FokusBeams erste Oberfläche abgelehnt, die auf dem Rahmen des sebaro-Starters stand
(Navigation am Rand, Fußzeile vor der Aktionszone, keine Startseite), und FokusBeam danach zurückgestellt: „nimm so
viel wie möglich von fokusbeam für ideabeam“. FokusBeam hatte seinen Rahmen am selben Tag nach RetroBeams Bauart
umgebaut (dort aus RetroBeam `3401467`: `SiteHeader.tsx`, `LanguageSwitch.tsx`, `LandingPage.tsx`, `BoardPage.tsx`).
Diesen Umbau übernimmt IdeaBeam. Die gemeinsamen Dateien waren vor dem Umbau fast gleich: Übernommen ist FokusBeams
Fassung, mit IdeaBeams Namen.

| Datei hier, unter `apps/web/` | Quelle in FokusBeam | Übernahme | Geändert |
|---|---|---|---|
| `src/components/View.tsx` | gleichnamig | angepasst | `wall` statt `room`; ohne den Tab-Titel einer Phase, ohne den Typ `result`, ohne den Verweis auf den Quelltext in der Fußzeile (IdeaBeam hat noch keine Betreiberangaben) |
| `src/components/SiteHeader.tsx` | gleichnamig | angepasst | die Seite „Meine Wände“ |
| `src/components/Shell.tsx`, `More.tsx`, `Segmented.tsx`, `src/store/appearance.ts`, `index.html`, `vite.config.ts` (das Skript `theme-button.js` der Kopie) | gleichnamig | unverändert bis auf die Adresse `/waende` | – |
| `src/main.tsx`, `src/pages/Settings.tsx` | gleichnamig | angepasst | IdeaBeams Routen; ohne den Klang |
| `src/app.css` | gleichnamig | die Regeln der Seite (`app-page`, `app-main`, `app-title`, `app-back`, Kopf, Startseite, Farbton), `app-state` gekürzt | `app-wall-head`, `app-wall` statt `app-room`; ohne alles zu Zielen und Schichtplan |
| `src/pages/Start.tsx` | gleichnamig | der Aufbau der Startseite, das Öffnen einer Antwort, auf die ein Verweis zeigt | alle Texte neu, als Entwurf aus PLAN.md; das Bild zeigt eine geordnete Wand; ohne die Gruppe „Open Source“ |
| `src/pages/Wall.tsx`, die Wand selbst (`OnWall`) | `pages/room/Shift.tsx`, `RoomTools.tsx`, `People.tsx` | Muster: der Stand groß oben, „Link kopieren“ im Kopf, die Werkzeuge der Moderation in „Mehr“ mit einem Toast für den kopierten Link, der Hinweis für eine Wand, auf die noch niemand sonst kam | der Rest der Datei ist unverändert |
| `src/components/CopyKey.tsx` | `CopyKey` in `pages/room/RoomTools.tsx` | die leise Form für den Kopf (`quiet`) | das Bauteil bleibt IdeaBeams |
| `src/main.test.tsx`, `src/pages/Wall.test.tsx`, `tests/app.ts` (`openMore`), `tests/keyboard.spec.ts`, `screens.spec.ts`, `rules.spec.ts`, `data-safety.spec.ts`, `start.spec.ts`, `wall.spec.ts` | die gleichnamigen Tests, `room.spec.ts` | die Anpassungen an den Rahmen | IdeaBeams eigene Abläufe |
| `src/i18n/de.json`, `en.json` | gleichnamig | die Schlüssel `landing.*` in ihrer Form | alle Wörter neu |

### Rechtstexte, Kopfzeilen und Release-Sperre (Stand `2b99df6` in FokusBeam, dort aus Etappe 4)

FokusBeam hat diese Teile aus RetroBeam (`3401467`) und aus dem Rezept des Starters; hier sind es FokusBeams
Fassungen.

| Datei hier, unter `apps/web/` | Quelle in FokusBeam | Übernahme | Geändert |
|---|---|---|---|
| `src/content/operator.ts`, `parts.tsx` | gleichnamig | unverändert (derselbe Betreiber) | nur der Kommentar zur Herkunft |
| `src/content/imprint.de.tsx`, `imprint.en.tsx` | gleichnamig | Text | Wand statt Raum |
| `src/content/privacy.de.tsx`, `privacy.en.tsx` | gleichnamig | Aufbau und die Abschnitte zu Verantwortlichem, Hosting, Protokollen, Browser-Speicher, Rechten und Sonstigem, im Wortlaut wo sie zutreffen | alles zur Wand, zu Zetteln, Gruppen und zum Tageszähler ist neu und gegen IdeaBeams Code geprüft (Stand `e04ab6c`, zuletzt `68a1204`); ohne Ziele, Auschecken, Bilanz und Klang; dazu ein Abschnitt zum Ordnen mit KI, als „noch nicht gebaut“ markiert |
| `src/pages/Legal.tsx` | gleichnamig | unverändert | – |
| `src/lib/source.ts`, `source.test.ts`, der Verweis in der Fußzeile (`components/View.tsx`) | gleichnamig | unverändert | – |
| `scripts/release-check.ts`, `src/release-check.test.ts` | gleichnamig | unverändert | ersetzt die Prüfung des Starters auf das Muster-Impressum |
| `static/_headers`, `static/robots.txt`, `src/headers.test.ts`, ihre Zeilen in `vite.config.ts` und `tests/worker.spec.ts` | gleichnamig | angepasst | `/w/*` statt `/r/*` |
| `src/pages/Wall.tsx`, das robots-Meta-Tag | `pages/Room.tsx` | Muster | – |
| `eslint.config.js`, die Ausnahme für `src/content/` | gleichnamig | unverändert | – |
| `src/pages/Walls.tsx`, das Zeilenmenü „Aus der Liste entfernen“ mit seiner Rückfrage, `app-row-tool` in `app.css`, die zwei Tests am Ende von `tests/wall.spec.ts`, die Screens `waende-menue` und `waende-entfernen` | `pages/Rooms.tsx`, `tests/checkout.spec.ts`, `screens.spec.ts` | angepasst | die Rückfrage nennt die Moderation statt der Leitung und sagt nichts über Ziele |

Aus RetroBeam direkt (Stand `3401467`, zuletzt geändert in `8619b8b`): `apps/web/src/lib/links.ts` und
`links.test.ts` nach `apps/web/src/lib/adminLink.ts` und `adminLink.test.ts`. Die Form des Tokens kommt aus
`adminTokenSchema`, `wallIdOf` ist neu.

Gelöscht ist der Beispielbereich des Starters: `src/lib/entries.ts`, `src/store/entries.ts` mit ihren Tests,
`src/pages/Detail.tsx`, `EntryForm.tsx` mit Test, `List.tsx`, `Overview.tsx`. Jede Starter-Datei, die FokusBeam
angefasst hat, war in 3.0.0 und 3.0.2 bytegleich. Vom Stand 3.0.2 ist also nichts überschrieben.

Neue Abhängigkeiten der App: `partysocket` 1.3.0 und `zod` 4.6.7. `@ideabeam/shared` steht als
Entwicklungs-Abhängigkeit (docs/sebaro-luecken.md, B3).

Die Skripte für Messung und Lasttest auf Cloudflare, aus demselben Stand:

| Datei hier | Quelle in FokusBeam | Übernahme | Geändert |
|---|---|---|---|
| `scripts/cloudflare-metrics.mjs`, `scripts/measure-cloudflare.mjs`, `scripts/load-test.mjs` | gleichnamig, Stand `2b99df6` (zuletzt geändert in `2f99041`, `0d8fd40` und `7b8fb47`) | angepasst | alle drei mit SPDX-Zeilen. `cloudflare-metrics`: dazu `--worker <Name>` und die Namen der Namensräume (Worker, Klasse `WallRoom` oder `RateLimiter`) aus Cloudflares Liste der Namensräume, beim Übernehmen ungeprüft, weil kein Lauf gegen Cloudflare erlaubt war; am 22.11.2026 von der Leitung zum ersten Mal gegen die Vorschau gelaufen (`--worker ideabeam-vorschau`), ohne Fehler, Filter und Namensräume stimmten; die Abfragen an GraphQL unverändert. `measure-cloudflare`: Wand statt Raum, `admin.wall.delete` statt `lead.room.delete`; die Wand wird auch nach einem Fehler gelöscht, über einen neuen Socket mit Admin-Token, wenn der alte zu ist, sonst nennt es ihre Id. `load-test`: das Drehbuch einer Wand ist neu (beitreten, Zettel, eine Gruppe, Bewegungen, Herzschlag alle 30 s, löschen) statt Ziele, Schicht und Phasenenden, gemessen wird die Zeit bis zum `ack` statt der Verspätung des Alarms; die Zahl der Wände folgt dem Tagesbudget (`DAILY_WALLS`, ein Fünftel, mehr als das Budget wird abgelehnt), `BUDGET_SPENT` beendet das Anlegen, Strg-C löscht alle Wände, und es nennt die Ids der Wände, die es nicht löschen konnte |

### Tagesbudget, Zettel, Gruppen, Kostentest (Commits `0c3b5f7`, `5961161`, `fb3426a` in FokusBeam)

| Datei hier | Quelle in FokusBeam | Übernahme | Geändert |
|---|---|---|---|
| `packages/shared/src/domain/budget.ts`, `apps/worker/test/budget.test.ts` | gleichnamig, `0c3b5f7` | angepasst | Wände statt Schichten, 80 am Tag |
| `apps/worker/src/rate-limiter.ts`: `spendDaily`, `usedToday`, `DailyBudget`, `dailyWalls`, Tabelle `daily_budgets` | gleichnamig, `0c3b5f7` | angepasst | ohne `dailyLeft`; das Budget wird beim Anlegen genommen |
| `apps/worker/src/index.ts`: der Block zum Budget | gleichnamig, `0c3b5f7` | angepasst | Status 429 mit `BUDGET_SPENT` und `resetsAt` |
| `apps/worker/.dev.vars` | gleichnamig, `0c3b5f7` | angepasst | `DAILY_WALLS` für lokale Läufe |
| `apps/web/src/lib/api.ts` (die Antwort `spent`), `src/lib/format.ts` (`clock`), `src/pages/NewWall.tsx` (der Satz mit der Uhrzeit), `tests/budget.spec.ts` und ihre Tests | gleichnamig, `0c3b5f7` (`NewRoom.tsx`) | angepasst | Status 429 statt 503; ein Satz, weil nur das Anlegen einer Wand vom Budget nimmt |
| `apps/worker/src/wall-room.ts`: `migrate()`, Tabellen `WITHOUT ROWID` | `shift-room.ts`, `5961161` | Muster | Schema für Zettel, Gruppen, Lage |
| `apps/worker/test/cost.test.ts`: Zähl-Hülle, Zählen der Alarme | gleichnamig, `fb3426a` | Muster | das Drehbuch einer Wand ist neu |
| `apps/worker/test/helpers.ts`: `answer`, `ask` | gleichnamig, `fb3426a` | angepasst | dazu `stubOf` |

Neu und ohne Vorbild: `packages/shared/src/domain/note-size.ts`, `domain/rules.ts`, die Fälle für Zettel, Gruppen
und Lage in `protocol.ts` und `domain/wall.ts`, `apps/worker/test/{notes,groups,seq}.test.ts`. RetroBeam (`3401467`:
`protocol.ts`, `domain/reducer.ts`, `domain/notes.ts`, `board-room.ts`, `test/cost.test.ts`) wurde dafür nur gelesen.

### „Meine Angaben löschen“ (Commits `71cd981` und `97f9e6e` in FokusBeam, gelesen auf `main` bei `3604d6f`)

Die Zettel einer Person, die ihre Angaben löscht, bleiben ohne Namen auf der Wand: Entscheidung K des Inhabers vom
22.11.2026 (PLAN.md 7.3). FokusBeam löschte die Ziele der Person mit.

| Datei hier | Quelle in FokusBeam | Übernahme | Geändert |
|---|---|---|---|
| `apps/worker/src/wall-room.ts`: `handleErase` | `shift-room.ts`, `handleErase` | angepasst | nur die Zeile der Person geht, die Zettel bleiben; das `ack` nennt die Nummer der Wand |
| `packages/shared/src/protocol.ts`: `me.erase`, `participant.removed`, `erased` | gleichnamig | angepasst | `PROTOCOL_VERSION` 3 |
| `packages/shared/src/domain/wall.ts`: die Fälle `participant.removed` und `erased` | `domain/room.ts` | angepasst | die Zettel bleiben |
| `apps/web/src/store/wall.ts`: `erase()`, `erased` | `store/room.ts` | angepasst | Namen |
| `apps/web/src/pages/Wall.tsx`: der Eintrag in „Mehr“, der Dialog `app-dlg-erase`, die Ansicht „Angaben gelöscht“ | `pages/room/RoomTools.tsx`, `pages/Room.tsx` | angepasst | keine Sperre und keine Warnung „einzige Leitung“: Das Moderationsrecht hängt am Token der Wand, darum sagt der Dialog der Moderation, dass sie danach nur mit dem Moderationslink moderiert, und bietet ihn zum Kopieren an (`CopyKey` mit `inline`); wer eigene Zettel hat, liest, wie viele ohne Namen bleiben |
| `apps/worker/test/erase.test.ts`, `apps/web/tests/erase.spec.ts` | `apps/worker/test/checkout.test.ts`, `apps/web/tests/checkout.spec.ts`, ihre Fälle zu „Meine Angaben löschen“ | angepasst | dazu: Die Zettel bleiben, niemand ändert sie mehr, die Moderation löscht sie noch; der kopierte Moderationslink moderiert wieder |

### Die Fläche (RetroBeam, `apps/web/src/components/BoardCanvas.tsx`, Stand `3401467`, zuletzt geändert in `e889be2`)

Nur als Muster gelesen, nichts wörtlich kopiert. Übernommen ist die Mechanik in `apps/web/src/components/Surface.tsx`
und `src/lib/surface/`: das nicht-passive Rad (Strg oder ⌘ mit Rad zoomt um den Zeiger, das Rad allein verschiebt),
die Umrechnung nach `deltaMode`, Zoom um einen Punkt mit dem Schritt 1,25 und die Formel für „Alles zeigen“, die
Schwelle von 4 px vor dem Ziehen, eine Nachricht beim Loslassen, der Tastenschritt von 32 Einheiten, die Suche nach
einer freien Stelle und die Tasten des Schreibfelds. Nicht übernommen: die Ansicht als React-Zustand, die feste
Welt, die Zonen.

### Verdecktes Schreiben, die Uhr, die Bremse je Wand (Etappe 3, Server)

Nur als Muster gelesen, nichts wörtlich kopiert:

| Was hier | Quelle | Übernommen | Nicht übernommen |
|---|---|---|---|
| `packages/shared/src/domain/clock.ts` mit Test | FokusBeam `a784eed`: `packages/shared/src/domain/shift.ts`, `test/shift.test.ts` | Enden als Daten, Steuerungen mit Revision, Minuten aufgerundet | die Folge von Phasen |
| Die Uhr in `apps/worker/src/wall-room.ts`, `test/clock.test.ts` | FokusBeam `5961161`: `apps/worker/src/shift-room.ts`, `test/shift.test.ts` | `STALE` für eine Steuerung zu einer anderen Revision, `serverNow` im Ereignis | der Alarm für Fristen, `TEST_HOOKS` |
| `apps/worker/test/hidden.test.ts` | RetroBeam `3401467`: `apps/worker/test/symmetry.test.ts` | neu verbinden, jeden Rahmen vor dem Schnappschuss falten, vergleichen | – |

Neu und ohne Vorbild: `packages/shared/src/domain/visibility.ts` (wer was sieht, auch für den späteren Export), die
Bremse je Wand in `domain/budget.ts`, `apps/worker/test/brake.test.ts`.

In der App folgt `apps/web/src/lib/clock.ts` dem Muster von FokusBeam (`a08fce4`: `apps/web/src/lib/shift.ts`): die
Restzeit in ganzen Minuten, gezählt aus dem Ende und dem Abstand zur Zeit des Servers, im Zustand und im Titel des
Tabs. Neu geschrieben, nichts kopiert.

**Eine Abweichung vom Plan:** Die Kennung einer Wand ist die Kennung, die ihr Durable-Object-Namensraum vergibt
(64 Hex-Zeichen), nicht eine eigene Zufallszahl mit 128 Bit wie bei RetroBeam. So lehnt der Worker eine erfundene
Adresse ab, ohne ein Objekt zu wecken oder anzulegen. Das stammt aus FokusBeam.

Abhängigkeiten stehen auf denselben Versionen wie in FokusBeam und RetroBeam: `hono` 4.13.19, `zod` 4.6.7,
`wrangler` 4.164.0, `@cloudflare/vite-plugin` 1.70.0, `@cloudflare/vitest-pool-workers` 0.23.0, `vitest`
4.1.12 im Worker.

## Aus dem Mess-Prototyp der Etappe 0 („Ordnen“, Etappe 4a)

Quelle: der Zweig `proto/e0-messung` dieses Repositorys (Stand `a3986c5`), `proto/e0-messung/tools/eval_llm.py` und
`tools/eval_cf.py`. Der Code des Prototyps ist Python und geht nicht ins Produkt. Übernommen ist, was gemessen
wurde, neu geschrieben in TypeScript:

| Was hier | Aus dem Prototyp | Geändert |
|---|---|---|
| `packages/arrange/src/prompts.ts` | der Wortlaut der Prompts (`SYS_A`, der deutsche Ersatzsatz, `SYS_B`, `ASK_CHUNK`, `ASK_ASSIGN["letter"]`), die Themenliste mit Buchstaben, beide JSON-Schemata, die Token-Grenze 700, Stapel zu 50 | Die Zahl der Themen hängt an der Zahl der Zettel: ab 18 Zetteln die gemessenen 3 bis 6, darunter weniger. Kein Aufruf, der die Themen zusammenführt (`ASK_MERGE` ist nicht übernommen). Die Zuordnung verlangt die Antwort zusätzlich auf einer Zeile, ihre Token-Grenze ist `40 + 10·n` |
| `packages/arrange/src/model.ts` | die Preise je Modell, die Zusätze gegen langes Nachdenken, 1.500 Token Reserve | nur die drei Modelle, die der Plan nennt |
| `packages/arrange/src/answers.ts` | JSON auch mit Zaun oder Vorrede lesen, Themen säubern, ein Buchstabe außerhalb der Liste ist ungültig | jede Antwort wird gegen Zettel und Themen geprüft, doppelte Schlüssel zählen nicht, ein Buchstabe gilt auch klein oder mit Punkt |
| `scripts/measure-arrange.mjs` | ARI, Reinheit und „ohne Gruppe als eigene Gruppe“ wie in der Messung | spricht mit dem veröffentlichten Worker statt mit dem Modell |

Neu und ohne Vorbild: der Ablauf mit Wiederholung und dem zweiten Aufruf neben einem langsamen in
`packages/arrange/src/run.ts`, die Anordnung in `layout.ts`,
der Ersatz für lokale Läufe in `fake.ts`, die Route in `apps/worker/src/arrange.ts`, das Budget in Neuronen in
`packages/shared/src/domain/budget.ts`, Anwenden und Rückgängig in `domain/arrange.ts`.

Am 23.11.2026 mit zwölf erfundenen Zetteln geprüft: Die Schnittstelle, die die Bindung `AI` erreicht (`/ai/run/`),
nimmt die Anfrage des Produkts unverändert an, antwortet in der Form von OpenAI (`choices`, `usage`) und nennt den
Verbrauch selbst (`usage.neurons`). Drei Aufrufe, 20,6 Neuronen.

## „Eigener Schlüssel“ (Etappe 4b): eine neue Abhängigkeit, sonst ohne Vorbild

Kein Code ist übernommen. Was die Anbieter annehmen und antworten, steht in den zwei Recherchen vom 23.11.2026,
[`ki-anbieter-4b.md`](ki-anbieter-4b.md) (Mistral, Abschnitt 3.4) und [`ki-anbieter-4b-us.md`](ki-anbieter-4b-us.md)
(OpenAI 3.1, Anthropic 3.2, die Änderungen an den Anfragen in Abschnitt 4); daraus sind die Einträge in
`packages/arrange/src/providers.ts` und die Anfragen in `provider-calls.ts` geschrieben. Die Prompts, der Ablauf und
die Prüfung der Antworten sind die von Etappe 4a, unverändert.

**Neue Abhängigkeit der App:** `@anthropic-ai/sdk` 1.13.0 (Apache-2.0), Anthropics eigener Client für TypeScript,
aus der npm-Registry. Über ihn fragt der Browser der Moderation Anthropic (`apps/web/src/lib/key-anthropic.ts`);
eine handgeschriebene Anfrage war ausdrücklich nicht gewollt. Er kommt in einen eigenen Teil der App, der nur
geladen wird, wenn mit einem Schlüssel für Anthropic geordnet wird (387 kB, 83 kB gzip). Mit ihm kommen in die
Lizenzliste von „Über“:

| Paket | Version | Lizenz | Wozu der Client es braucht |
|---|---|---|---|
| `@anthropic-ai/sdk` | 1.13.0 | Apache-2.0 | der Client |
| `@opentelemetry/api` | 1.9.1 | Apache-2.0 | Ablaufverfolgung; im Produkt abgeschaltet (`openTelemetry: false`) |
| `json-schema-to-ts` | 3.1.1 | MIT | Typen für Schemata |
| `ts-algebra` | 2.0.0 | MIT | über `json-schema-to-ts` |
| `@babel/runtime` | 7.29.14 | MIT | über `json-schema-to-ts` |
| `standardwebhooks` | 1.3.0 | MIT (ohne Lizenztext im Paket: Der Standardtext steht ein) | Prüfung von Webhooks; das Produkt nutzt sie nicht |
| `@stablelib/base64` | 1.0.1 | MIT | über `standardwebhooks` |
| `fast-sha256` | 1.3.0 | **Unlicense** | über `standardwebhooks` |

**„Unlicense“ stand nicht auf der Liste der Lizenzen, die die App ausliefern darf** (`vite.config.ts`: „ask the
owner before the dependency stays“). Sie ist ein Verzicht auf alle Rechte ohne Bedingung und steht jetzt auf der
Liste, damit der Build steht. **Der Inhaber hat das noch nicht bestätigt.** Der Client bringt außerdem eine
optionale Peer-Abhängigkeit auf `zod` mit, die die vorhandene Version 4.6.7 erfüllt; sein zod-Helfer wird nicht
benutzt (er lädt die klassische Bauform, die ESLint ablehnt), und `tests/worker.spec.ts` findet sie weiter in keiner
gebauten Datei.

Neu und ohne Vorbild: die Anbieterliste und die Anfragen je Anbieter (`packages/arrange/src/providers.ts`,
`provider-calls.ts`), der Lauf im Browser (`apps/web/src/lib/key-run.ts`, `key-anthropic.ts`), der Speicher des
Schlüssels (`store/key.ts`), der Schalter (`lib/key-switch.ts`, nach dem Muster des Moderationslinks in
`lib/links.ts`), der Dialog (`components/OwnKeyAsk.tsx`) und `scripts/measure-key.mjs`, das Ordnen-Maß daraus wie in
`scripts/measure-arrange.mjs`.

## Export und QR-Code (Etappe 5): aus RetroBeam

Quelle: RetroBeam (`grundhofer/retrobeam`), gelesen am 2026-11-25 auf `HEAD` = `a5e3249` mit `git show`, nie im
Arbeitsstand. Lizenz AGPL-3.0-or-later, derselbe Rechteinhaber.

| Datei hier | Quelle in RetroBeam | Übernahme | Geändert |
|---|---|---|---|
| `packages/shared/src/domain/export.ts`, `test/export.test.ts` | `packages/shared/src/domain/export.ts`, zuletzt geändert in `47b8806` | Muster: der Titel, die Zeile in Kursiv mit dem Datum, eine Überschrift je Spalte mit den Zetteln als Listenpunkten, ein Zeilenumbruch im Zettel wird ein Leerzeichen, der Dateiname aus dem Titel in Buchstaben, Ziffern und Bindestrichen | neu geschrieben: der Sichtfilter des Schnappschusses (`notesFor`) statt eines Exports, den die Route vorher formt; keine Namen und keine Option dafür; Gruppen statt Spalten, in der Reihenfolge der Liste, Zettel ohne Gruppe unter eigener Überschrift; jedes Zeichen, das in Markdown etwas bedeutet, wird maskiert (RetroBeam maskiert in Markdown nichts); die festen Wörter deutsch oder englisch; der Tag im Dateinamen; ohne CSV, JSON, HTML, PDF und Zusammenfassung |
| `apps/web/src/lib/qr.ts` | `apps/web/src/lib/qr.ts`, zuletzt geändert in `8619b8b` | der Code: `uqr` mit Fehlerkorrektur M und vier Modulen Rand, ein Pfad aus waagerechten Läufen | ohne SPDX-Zeilen (`apps/web` trägt keine), Kommentare |
| `apps/web/src/components/QrCode.tsx` | `apps/web/src/components/QrCode.tsx`, zuletzt geändert in `07c0b18` | der Ablauf: Kodierer per `import()`, Platzhalter gleicher Größe, Satz, wenn die Datei nicht lädt, SVG mit `crispEdges` und `data-theme="light"` | ohne die kleine Form mit Pixeln je Modul und ohne Tailwind: Klassen in `app.css`; die Farben über Klassen statt `style` |

Die Abhängigkeit `uqr` steht auf der Version, die RetroBeams Lockfile auflöst: 0.1.3 (MIT). Neu und ohne Vorbild: die
Route `GET /api/walls/:id/export` mit dem Sitzungsschlüssel in der Kopfzeile (`apps/worker/src/index.ts`,
`WallRoom.exportFor()`, `test/export.test.ts`), das Sichern im Browser aus einem Blob (`apps/web/src/lib/download.ts`)
und der Dialog „QR-Code zeigen“.

### Barrierefreiheits-Erklärung (Etappe 5, Schritt B)

Quelle wie oben: RetroBeam, `HEAD` = `a5e3249`, gelesen am 2026-11-25 mit `git show`.

| Datei hier, unter `apps/web/` | Quelle in RetroBeam | Übernahme | Geändert |
|---|---|---|---|
| `src/content/accessibility.de.tsx`, `accessibility.en.tsx` | `apps/web/src/content/accessibility.de.tsx`, `accessibility.en.tsx` | der Aufbau (was das Produkt ist, wie man es benutzt, Anforderungen und Prüfstand mit den vier Zustandswörtern, automatische und offene Prüfungen, bekannte Einschränkungen, Rückmeldung), die Sätze zu bewussten Abweichungen, zu 400 % und zu den Abständen, im Wortlaut wo sie zutreffen | alles über das Produkt ist neu und gegen IdeaBeams Tests und `CHECKS.md` geschrieben; „teilweise vereinbar“ statt „erreicht das Ziel nicht“ (IdeaBeam kennt keinen Verstoß, hat aber vieles nicht geprüft); ohne die Absätze zu EN 301 549 (hier nicht nachgelesen); statt RetroBeams neutralem Satz zum BFSG die Ausnahme nach Angabe des Betreibers (§ 3 Abs. 3 BFSG, 26.11.2026), deshalb ohne den Abschnitt zur zuständigen Behörde und ohne die Angaben der Marktüberwachungsstelle (MLBF), die bis dahin übernommen waren; ohne SPDX-Zeilen |
| `STATEMENT_DATE` in `src/content/operator.ts` | `ACCESSIBILITY_DATE` in `apps/web/src/content/operator.ts` | Muster | `STATEMENT_DATE` ist ein Datum, kein Platzhalter: der Tag, an dem die Erklärung gegen die Prüfungen geschrieben wurde |
| der dritte Link der Fußzeile (`src/components/View.tsx`) | `apps/web/src/components/LegalFooter.tsx` | Muster: „Barrierefreiheit“ nach „Impressum“ und „Datenschutz“ | eine Adresse für beide Sprachen (`/barrierefreiheit`), wie Impressum und Datenschutz hier; RetroBeam hat je Sprache eine |

### Produktion und Vorschau (Etappe 5, Schritt C)

Quelle: RetroBeam, `HEAD` = `4e6cd18` (die Konfiguration zuletzt geändert in `1ff2fda`), gelesen am 2026-11-25 mit
`git show`.

| Datei hier | Quelle in RetroBeam | Übernahme | Geändert |
|---|---|---|---|
| `apps/worker/wrangler.jsonc`: `routes`, `workers_dev`, `env.vorschau` | `apps/worker/wrangler.jsonc`: `routes`, `workers_dev`, `env.preview` | Muster: eine eigene Domain als `custom_domain`, www als Weiterleitung der Zone statt einer zweiten Domain, `workers_dev` bleibt an, die Vorschau als benannte Umgebung mit leerem `routes` und wiederholten Bindungen und Variablen | `ideabeam.de`; die Umgebung heißt `vorschau`, damit der Worker weiter `ideabeam-vorschau` heißt und seine Wände behält; dazu `ai` und die Budgets der Vorschau |
| `scripts/production-deploy.sh` | `.github/workflows/deploy.yml`, Job `production` | Muster: Rechtstexte prüfen, mit `VITE_COMMIT_SHA` bauen, `wrangler deploy` aus `apps/web` | ein Skript statt eines Workflows (nichts wird ohne das Wort des Inhabers deployt); weigert sich zusätzlich bei Änderungen, außerhalb von `main` oder einem Tag, bei einem Commit ohne Remote, und prüft nach dem Bau Kopfzeilen, Commit und Ziel |
| `scripts/preview-deploy.sh` | derselbe Workflow, Job `preview` | Muster: `CLOUDFLARE_ENV` beim Bau, `VITE_COMMIT_SHA` | weiter `wrangler deploy` statt `versions upload` |

## Aus dem sebaro-Starter

Quelle: `sebaro-template-webapp-vite.tar.gz` aus dem Release `v3.0.2` von `grundhofer/sebaro-foundry`
(2026-11-22), SHA-256 `c79d98d9ed40f6cc3424903260e545f6fd599d292d3ea2b3618a4c9539bfc71a`, entpackt nach `apps/web` und als eigener Commit unverändert eingecheckt.

Am Starter geändert:

| Datei | Änderung | Warum |
|---|---|---|
| `apps/web/package.json` | Name, Beschreibung, Lizenz; `sebaro:lint` prüft `dist/client`; `@cloudflare/vite-plugin` und `wrangler` als Entwicklungs-Abhängigkeiten | Produkt, eigener Server |
| `apps/web/vite.config.ts` | Cloudflare-Plugin (außer unter Vitest); das Plugin `sebaro` gilt nur für die Umgebung `client` | Worker neben der App; sonst landen Icons und Skripte der Kopie im Worker-Ordner |
| `apps/web/scripts/budget.ts` | misst `dist/client` | der Build hat zwei Ordner |
| `apps/web/.gitignore`, `.prettierignore`, `eslint.config.js` | `.wrangler` ausgenommen; ESLint lehnt einen Import von `zod` außer `zod/mini` ab | Ausgabe von wrangler und Plugin; die übliche Bauform von zod verdreifacht die Startzeit des Workers (`docs/messung-4a.md`, Abschnitt 8) |
| `apps/web/sebaro.product.json` | Kennung, Name, Kachelgruppe, vorläufiges Zeichen | Produkt |
| `apps/web/sebaro-product/` | vom Baukasten der Kopie geschrieben | folgt aus der Produktdatei |
| `apps/web/tests/worker.spec.ts` | neu | der Worker hinter dem Build |
| `.github/` | aus `apps/web` an die Wurzel verschoben, Pfade und Schritte für den Workspace | ein Repository, drei Pakete |
| `pnpm-lock.yaml` | aus `apps/web` an die Wurzel verschoben und für den Workspace neu aufgelöst | Workspace |

Die Prüfungen des Starters liefen zum ersten Mal nach diesen Änderungen, nicht davor, wie seine README es will:
`pnpm checks` an der Wurzel war dann grün (13 Tests für Worker und geteiltes Paket, 58 Ende-zu-Ende-Tests).

## Nicht geprüft

- **Kein Aufruf an einen der drei Anbieter mit einem echten Schlüssel.** Ob Mistral, OpenAI und Anthropic die
  Anfragen aus Etappe 4b so annehmen, wie die Recherchen es lesen, zeigt erst die Messung.
- `reuse lint` lief nie: Das Werkzeug ist nicht installiert. `REUSE.toml` ist nach dem Muster der Geschwister
  geschrieben.
- Der Workflow `ci` lief am 24.11.2026 zum ersten Mal auf GitHub, grün. Nie gelaufen ist der wöchentliche Schritt, der
  nach einer neueren sebaro-Kopie fragt: Ihm fehlt im Repository das Geheimnis `SEBARO_FOUNDRY_TOKEN`.
