# IdeaBeam: geführte Methoden (Plan für v0.2)

Stand 27.11.2026. Deine Antworten auf die Fragen in Abschnitt 7 stehen dort; M1 ist freigegeben („Erst M1 und M2“). Grundlage: dein Auftrag vom 27.11.2026 („ein miro mit
bewährten wissenschaftlichen und unternehmerischen konzepten … moderator wählt die agenda und das setup aus einer
großen liste und man arbeitet dann kollaborativ oder einzeln für sich“), die Recherche
[`docs/recherche-methoden.md`](docs/recherche-methoden.md) und der Methodenkatalog
[`docs/methoden-katalog.md`](docs/methoden-katalog.md). Der Plan für v0.1 bleibt [`PLAN.md`](PLAN.md); dieser Plan
ersetzt dort die Zeile „Vorlagen SWOT, Lean Canvas, Pre-Mortem“ in Abschnitt 2.2.

## Kurzfassung

| Frage | Antwort |
|---|---|
| Was wird IdeaBeam? | Ein geführter Workshop-Raum. Die Moderation wählt beim Anlegen eine Methode, später eine Agenda aus mehreren. Die App führt alle durch die Schritte: allein, zu zweit, in Kleingruppen, alle zusammen, vorstellen. Am Ende steht ein Ergebnis, das sich sichern lässt |
| Was ist anders als Miro? | Miro ist eine leere Fläche mit Vorlagen. IdeaBeam setzt die Regeln durch, die gut belegt sind: erst allein, verdeckt bis zum Aufdecken, verdeckt abstimmen. Eine Bewertung der Methoden zeigt es nicht (deine Entscheidung vom 27.11.2026, Abschnitt 7, Frage 5) |
| Was bleibt? | Ohne Konto, Speicherung in der EU, Löschung nach 30 Tagen, die Fläche, die Liste, das Ordnen mit KI, Deutsch und Englisch, `ideabeam.de` |
| Was ist neu? | Ein Ablauf aus Schritten statt der zwei Phasen, verdeckte Abstimmungen und Rangfolgen, Schätzungen in Runden, Paare und Kleingruppen, Entscheidungen und Aufgaben im Ergebnis |
| Wie viele Methoden? | 12 in v1, 7 Kandidaten für v1.1 (Katalog). Dazu die „Freie Wand“ ohne Ablauf |
| Aufwand | 30 Arbeitstage geschätzt, 51 mit Zuschlag, in sieben Etappen (M1 bis M7). Nach M2 ist das Produkt schon mit einer Methode samt Abstimmung nutzbar |
| Kosten | Ein Methodenlauf schreibt 15 bis 60 Zeilen, wenig gegen das Ziehen von Zetteln. Jede Methode bekommt eine Obergrenze im Kostentest |

## 1 Was wir aus der Recherche übernehmen

- **Ablaufregeln sind besser belegt als Methoden mit Markennamen.** Erst jede Person allein, dann gleichzeitig
  aufdecken, strukturiert besprechen, mechanisch zusammenfassen. Mündliches Brainstorming in der Runde ist schlechter
  als schriftliches Sammeln (Meta-Analyse). Sichtbare Zwischenstände verzerren (Experiment). Daraus folgen feste
  Voreinstellungen: Abstimmungen sind verdeckt und gleichzeitig, Ergebnisse erst nach dem Auszählen.
- **Am besten belegt sind Rückblicke**, stärker mit objektiven Daten statt Erinnerung (zwei Meta-Analysen; korrigiert
  am 27.11.2026 nach `docs/belege-pruefung.md`: „mit Ziel“ und „strukturiert“ trägt der Beleg nicht).
- **Populär, aber schwach belegt** sind SWOT, „5 Whys“, offene Punktabstimmung und Canvas-Vorlagen. Sie kommen höchstens
  in v1.1, mit Leitplanken.
- **Die App zeigt keine Bewertung der Methoden** (entschieden am 27.11.2026, Abschnitt 7, Frage 5): keine
  Evidenzstufe, kein Belegsatz, weder auf `/neu` noch auf der Wand, im Export oder auf der Startseite. Die Recherche
  bleibt die Begründung für die Regeln der Abläufe ([`docs/recherche-methoden.md`](docs/recherche-methoden.md),
  [`docs/belege-pruefung.md`](docs/belege-pruefung.md)).
- **Nichts aus der Recherche wird ungeprüft zitiert.** Die Recherche listet Quellen, die nur aus dem Gedächtnis stammen,
  und fünf Zahlen, die nie in der App stehen dürfen. Jede Quelle, die die App nennt, wird vorher am Original geprüft.
- **Methoden sind frei, Namen und Texte nicht.** Alle Texte sind unsere eigenen. Gemieden werden geschützte Namen
  (Six Thinking Hats, RAPID, Value Proposition Canvas, Cynefin als Name). Methoden aus Liberating Structures stehen
  unter CC BY-SA 4.0 und brauchen eine Namensnennung.

## 2 Regel: Jede Methode wird überall kurz umschrieben

Dein Auftrag vom 27.11.2026: Weil die Methoden neutrale deutsche Namen bekommen, steht bei jeder Methode immer eine
kurze Umschreibung, wo sie gewählt oder gezeigt wird.

- **Beim Anlegen (`/neu`):** Jede Zeile zeigt den Namen, darunter immer sichtbar die Kurzbeschreibung (ein Satz,
  höchstens rund 20 Wörter: was man tut und was herauskommt), dann Dauer und Gruppengröße. „Mehr dazu“ klappt auf:
  wann sie passt, die Schritte, was herauskommt, „auch bekannt als“, Namensnennung. Keine Evidenzstufe und kein
  Belegsatz (Abschnitt 7, Frage 5).
  Ein Screenreader liest die Kurzbeschreibung mit dem Namen vor.
- **Auf der Startseite:** ein Abschnitt „Geführte Methoden“ mit einer kurzen Einleitung („erst allein, dann
  gemeinsam“) und allen Methoden als Name und Kurzbeschreibung.
- **Auf der Wand:** Der Kopf nennt die Methode mit ihrer Kurzbeschreibung, jeder Schritt sagt in einem Satz, was jetzt
  zu tun ist.
- **Im Export:** Name und Kurzbeschreibung über den Ergebnissen der Methode.
- **Durchgesetzt durch einen Test:** Jede Methode im Katalog des Codes hat Name und Kurzbeschreibung in beiden
  Sprachen, die Kurzbeschreibung hat höchstens 25 Wörter, und die Startseite und `/neu` zeigen sie für jede Methode.
  Eine Methode ohne Umschreibung lässt sich nicht bauen.

Die Texte für alle 19 Methoden stehen im Katalog, deutsch und englisch, dazu der Entwurf des Startseiten-Abschnitts
und das Muster der Auswahl.

## 3 Die Methoden

Die zwölf für v1, nach Zweck. Kurzbeschreibungen, Schritte und Zeiten im Katalog.

| Zweck | Methoden |
|---|---|
| Ideen sammeln | Still sammeln, bündeln, verdeckt wählen (voreingestellt) · 1-2-4-Alle |
| Entscheiden | Stille Ideenrunde mit Rangfolge · Kriterienbewertung · Schätzen – Diskutieren – Schätzen · Gegenposition prüfen · Entscheidungsprotokoll mit Zustimmungsrunde |
| Planen und Ziele | Ziele mit messbaren Ergebnissen · Annahmen prüfen |
| Rückblick | Rückblick nach Ziel und Daten · Was? Na und? Was nun? |
| Risiken | Scheitern vorwegdenken |

Ohne Ablauf: **Freie Wand** (schreiben und ordnen, wie eine Wand heute ohne verdecktes Schreiben).

Kandidaten für v1.1: Aufhören, was schadet · 15-%-Lösungen · Agenda aus der Runde · Lage in vier Feldern (geführte
SWOT) · Ursachenbaum (statt „5 Whys“) · Vier Zukünfte · Perspektivenrunden.

## 4 Bauweise

Ausführlich im Architekturvorschlag dieses Plans (Anhang A); hier das, was du wissen musst.

- **Methoden sind Daten im Code** (`packages/shared`): eine Methode ist eine Liste von Schritten oder anderen
  Methoden. Ein Schritt hat einen Typ (schreiben, aufdecken, ordnen, besprechen, abstimmen, Rangfolge, bewerten,
  schätzen, vorstellen, entscheiden, Rollenrunde, Zustimmung), eine Form (allein, zu zweit, Kleingruppe, alle,
  vorstellen), eine Sichtbarkeit (verdeckt, Gruppe, alle, nur Summe), eine vorgeschlagene Dauer und was er erzeugt.
  Eine Methode trägt keine Evidenzstufe (Abschnitt 7, Frage 5).
- **Jede Wand speichert ihren Ablauf** beim Anlegen als feste Kopie. Ein Update der App verschiebt keinen laufenden
  Workshop.
- **Bestehende Wände laufen weiter.** Der heutige Ablauf wird die Methode „Still sammeln, bündeln, verdeckt wählen“
  (ohne Wahl, bis M2), die Wand ohne verdecktes Schreiben die „Freie Wand“. Kein Umzug, keine geschriebene Zeile beim
  Lesen.
- **Sichtbarkeit wird nur weiter, nie enger.** Was gezeigt war, bleibt gezeigt, auch wenn die Moderation zurückgeht.
  Das ist die heutige Regel „Aufdecken nimmt nichts zurück“, allgemein gemacht.
- **Namen bleiben verborgen** (Entscheidung 14): Kein Schritt zeigt, wer was geschrieben hat. In einem Paar ist das
  naturgemäß zu erraten; der Schritt sagt das.
- **Abstimmungen:** Jede Person stimmt im Browser ab und sendet erst mit „Abgeben“. Der Server speichert eine Zeile je
  Person, verrät bis zum Auszählen nur, wie viele abgegeben haben, und nie eine einzelne Stimme. Arten: Punkte mit
  Budget, Auswahl, Rangfolge, Bewertung 1 bis 5 (auch nach Kriterien), Zahl schätzen (Median und Spanne, nie nur der
  Mittelwert), Zustimmung mit Einwand.
- **Paare und Kleingruppen** bleiben auf einer Wand, mit eigenen Bereichen. Die App bildet sie zufällig aus den
  Anwesenden, die Moderation kann tauschen. Gesprochen wird im eigenen Videotool; die Moderation sieht die Teams, um
  die Räume dort gleich zu besetzen.
- **Zeit:** Jeder Schritt kann eine Uhr haben. Ob die App nach Ablauf selbst weitergeht, ist eine Frage an dich
  (Abschnitt 7); gebaut wird es mit dem einen Wecker des Durable Objects, ohne Timer.
- **Die Wand zeigt groß:** Schritt x von y und seinen Namen, die Zeit, was du jetzt tust, deinen Stand („Abgegeben.
  5 von 8 haben gewählt.“), was danach kommt. Die Moderation hat „Weiter“ als Hauptaktion, „Zurück“, „Überspringen“
  und den Ablauf unter „Mehr“.
- **Ergebnis und Export:** je Methode ihre Ergebnisse: Gruppen, Rangfolgen mit Punkten, Schätzungen mit Median und
  Spanne, Zustimmungen und Einwände, Entscheidungen und Aufgaben (wer, bis wann). Keine einzelnen Stimmen, keine
  Namen.

## 5 Etappen

AT = Arbeitstag, mit Zuschlag ×1,7 wie in PLAN.md 6.

| Etappe | Inhalt | AT | ×1,7 |
|---|---|---|---|
| M1 | Methoden-Motor und Umzug des heutigen Ablaufs | 5 | 8,5 |
| M2 | Verdeckte Abstimmung, Rangfolge, Bewertung | 4 | 7 |
| M3 | Schätzen in Runden | 2 | 3,5 |
| M4 | Paare und Kleingruppen | 5 | 8,5 |
| M5 | Methoden, Paket A | 5 | 8,5 |
| M6 | Methoden, Paket B | 6 | 10 |
| M7 | Agenda aus mehreren Methoden, Startseite | 3 | 5 |
| | **Gesamt** | **30** | **51** |

### M1: Methoden-Motor

Methoden als Daten, Ablauf je Wand, Schritt statt Phase, Uhr je Schritt, Sichtbarkeit, die nur weiter wird,
Umzug bestehender Wände, `/neu` mit der Auswahl aus „Still sammeln“ und „Freie Wand“ (mit Kurzbeschreibung), der
Kopf der Wand als Schritt-Anzeige.

Abnahme:
- Alle heutigen Tests bestehen, nur mit „Schritt“ statt „Phase“ im Wortlaut. Bestehende Wände in beiden Zuständen
  zeigen genau dasselbe wie vorher und schreiben beim Lesen keine Zeile.
- Zurückgehen versteckt nichts wieder; ein Test liest dafür die Nachrichten selbst.
- Der Kostentest einer typischen Wand liegt höchstens 5 Zeilen über heute.
- Der Test der Umschreibungs-Regel (Abschnitt 2) besteht.

**Stand M1 (27.11.2026, Branch `methoden-m1`, nicht committet, nicht gemergt):** gebaut.

- Methoden als Daten in `packages/shared` (`domain/method.ts`, `methods/catalogue.ts`, `methods/texts.ts` mit allen
  Texten DE/EN, `domain/agenda.ts` mit Auflösen, Prüfen, Fähigkeiten je Schritt und Sichtbarkeit, `domain/flow.ts` mit
  `step`/`reach` und `decideStep`). Zwei Methoden: „Still sammeln, bündeln, verdeckt wählen“ mit vier Schritten
  (Ideen schreiben, Aufdecken, Bündeln, Ergebnis besprechen; „Frage stellen“ steckt in „Ideen schreiben“, die Wahl
  kommt in M2) und „Freie Wand“ (ein Schritt). Protokoll 7: `admin.step.go`, `step.changed`, `sync` mit Agenda,
  Schritt und Reichweite. Schema 4: die Wand speichert ihre Agenda beim Anlegen (eine Zeile); eine Wand von Schema 3
  wird gelesen, wie sie ist (verdeckt → „Still sammeln“ im Schreibschritt, aufgedeckt → „Freie Wand“), und schreibt
  die neue Form erst mit dem nächsten Schrittwechsel oder Griff an die Uhr (einmal drei Zeilen).
- `/neu` mit der Auswahl nach Katalog (b), die Wand mit Schritt-Kopf, „Weiter: <Schritt>“, „Zurück“ unter „Mehr“,
  Methode mit Kurzbeschreibung oben in der Spalte der Personen (im Stand machte sie die Wand zu hoch) und im
  Export; Datenschutzerklärung 3.1 in beiden Sprachen.
- Tests im letzten vollen Lauf (`CI=1 pnpm checks`): shared 309 (vorher 279), arrange 126, Worker 233 (vorher 226), App
  287 (Vitest), Ende-zu-Ende 316, alle grün, keiner übersprungen. Kostentest der typischen Wand: 397 statt 396 Zeilen (+1, die Zeile der
  Agenda beim Anlegen).
- Nicht geprüft: kein Ende-zu-Ende-Test geht im Browser „Zurück“ (das prüfen Worker-Tests auf Nachrichtenebene);
  Kopf und Auswahl nicht bei 2000 px, nicht bei 200 % auf Englisch angesehen; die Texte der „Freien Wand“ sind von
  M1, nicht aus dem Katalog, und ihre Evidenz („Studien“) ist ein Vorschlag; die Belegsätze nicht neu an den Quellen
  geprüft (beides entfallen: seit 27.11.2026 zeigt die App keine Evidenz, Abschnitt 7, Frage 5); Name und
  Kurzbeschreibung von „Still sammeln“ versprechen bis M2 eine Wahl, die es noch nicht gibt; eine Wand von Schema 3 nur im Testpool von workerd nachgestellt, nie mit einer echten v0.1-Wand.

### M2: Verdeckte Abstimmung

Punkte, Auswahl, Rangfolge, Bewertung; Auszählen; Ergebnis; das Ergebnis im Export. „Still sammeln, bündeln, verdeckt
wählen“ bekommt seine Wahl und ist damit vollständig.

Abnahme:
- Vor dem Auszählen steht in keiner Nachricht an einen Browser eine fremde Stimme oder ein Zwischenstand; ein
  Ende-zu-Ende-Test liest alle Nachrichten.
- Zweimal gesendet bleibt eine Stimme eine. Abstimmen geht ganz ohne Maus.
- Höchstens 15 Zeilen mehr je Abstimmung mit 8 Personen.
- axe ohne Befund in Hell und Dunkel, schmal und breit, bei 200 %.

**Stand M2 (27.11.2026, `84bf14e` auf M1 `8ddb34b`):** gebaut, von dir nicht abgenommen, nicht deployt.

- `packages/shared/src/domain/vote.ts`: Arten Punkte, Auswahl, Rangfolge (Borda über die erfragten Plätze) und
  Bewertung 1 bis 5 (auch je Kriterium, Mittelwert); `optionsFor` (die Gruppen mit Zetteln nach „Bündeln“, dazu
  die Zettel ohne Gruppe, sonst die Zettel; höchstens 80, der Rest gezählt), `limitOf` (Punkte: ein Viertel der
  Optionen, mindestens 2), `checkBallot`, `canonicalBallot` (derselbe Zettel zweimal ist eine Zeile), `tally`
  (geteilte Plätze bei gleichen Punkten), `decideBallot`, `decideCount`. „Still sammeln“ in Version 2 mit dem
  Schritt „Wählen“ (Punkte, verdeckt, `aggregate`) vor „Ergebnis besprechen“; `checkAgenda` prüft, dass eine Wahl
  verdeckt bis zum Auszählen ist und keine Zettel anbietet, die niemand gesehen hat. Ein Wahlschritt erlaubt keine
  Zettel, kein Verschieben, keine Gruppen und kein Löschen (`capabilities.ballot`).
- Worker: Tabelle `ballots` (eine Zeile je Person und Schritt, neu abgeben überschreibt), angelegt mit dem ersten
  Stimmzettel einer Wand; Auszählen schreibt das Ergebnis (`meta 'result:<Schritt>'`) und den Ablauf. Protokoll 8:
  `ballot.cast`, `admin.step.count`, `ballot.stored` (nur an die eigenen Sockets), `votes.count` (nur die Zahl, an
  alle anderen, auch die Moderation), `results.published` (an alle), `sync` mit `votes`, eigenem `ballot`, `voted`,
  `results`; `step.changed` in einen Wahlschritt trägt die Wahl, die Zahl und den eigenen Stimmzettel.
  Stimmzettel zählen gegen die Bremse; Auszählen wird wie ein Schrittwechsel nie gebremst.
- App: die Stimme statt der Fläche (`components/Ballot.tsx`, −/+ als Tasten, „Noch 2 Punkte“, „Abgeben“), danach
  die Rangliste mit Zahlen; der Stand sagt „Abgegeben. 5 von 8 haben abgegeben.“; Hauptaktion der Moderation
  „Auszählen“, dann „Weiter“. In den Schritten danach steht das Ergebnis in der Spalte der Personen. Export: die
  Rangliste mit Punkten und der Zählweise, nie ein Stimmzettel, nie ein Name. Datenschutzerklärung 3.1 und 3.3 in
  beiden Sprachen.
- Abweichungen von `docs/architektur-methoden.md` 3.1: (1) Der Ablauf hält statt `stage` und `options` eine Liste
  `votes` (je Wahlschritt Optionen, Budget, gezählt), damit Zurück und Weiter die Optionen nicht neu einfriert und
  eine gezählte Wahl nicht wieder öffnet. (2) Leere Stimmzettel und Zurückziehen gibt es nicht: Ein Stimmzettel
  braucht mindestens eine Marke, ändern geht durch neu abgeben. (3) Die Tabelle entsteht mit dem ersten Stimmzettel,
  nicht beim Anlegen oder per Migration: Eine Wand, die nie wählt, zahlt sie nicht; das Schema bleibt 4. (4) Ein
  Stimmzettel für einen verlassenen Schritt heißt `STALE`, nach dem Auszählen `PHASE`. (5) Eine Wand von Schema 3
  wird jetzt als „Still sammeln“ Version 2 gelesen, also mit Wahl.
- `CI=1 pnpm checks` grün: 333 Tests im geteilten Paket, 126 in `packages/arrange`, 242 im Worker, 290 in der App,
  324 Ende-zu-Ende, keiner übersprungen.
  Kosten: eine Wahl mit 8 Personen 14 Zeilen (Schritt 1, Stimmzettel 8 + 1 geänderter + Tabelle 2, Auszählen 2);
  die typische Wand bleibt bei 397 Zeilen.
- Nicht geprüft: kein Bildschirmleser, nicht bei 2000 px angesehen; die Stimme kann nur Punkte und Auswahl,
  Rangfolge und Bewertung haben Regeln und Worker, aber keine Oberfläche (keine Methode nutzt sie); die Sätze der
  Anleitung sprechen von Punkten.

### M3: Schätzen in Runden

Zahl schätzen, Median und Spanne, zweite Runde mit dem Ergebnis der ersten, Begründungen ohne Namen. Methode
„Schätzen – Diskutieren – Schätzen“.

Abnahme: Median und Quartile getestet mit gerader, ungerader und einer einzigen Schätzung. Die zweite Runde zeigt nur
die Summe der ersten.

**Stand M3 (27.11.2026, Branch `methoden-m3` auf M2 `1aa7e4c`, nicht committet):** gebaut, von dir nicht abgenommen,
nicht deployt.

- `domain/vote.ts`: Art `estimate` (eine Zahl, Einheit, Grenzen) mit `checkBallot`, `aggregate` (Anzahl, Median,
  erstes und drittes Quartil, kleinste und größte Zahl; Quartile linear zwischen den Schätzungen wie QUARTILE.INC,
  auf sechs Stellen gerundet) und dem Ergebnis `estimateResult`; `voteResultSchema` ist jetzt Rangliste oder
  Zusammenfassung. Methode „Schätzen – Diskutieren – Schätzen“ (`schaetzen`, Zweck „Entscheiden“, Experimente, 5–30
  Personen, 25 Minuten) mit fünf Schritten: erste Schätzung mit Begründung (verdeckt, `noteKind: "reason"`: der
  Schritt nimmt Zettel neben der Schätzung), Rückmeldung (zeigt die Begründungen ohne Namen), Abweichungen
  besprechen, neu schätzen (ohne Zettel), Ergebnis ansehen. Die Einheit gibt die Moderation auf `/neu` an (optional,
  bis 20 Zeichen); sie kommt als `unit` in die Anfrage und in beide Schätzschritte.
- App: `components/Estimate.tsx` statt der Fläche (Zahlenfeld mit Einheit, Enter oder „Abgeben“, in Runde 1 die
  Begründung als eigener Zettel), die zweite Runde zeigt über dem Feld nur die Zusammenfassung der ersten; nach dem
  Auszählen „Ergebnis der Schätzung“ als Beschreibungsliste (Median, mittlere Hälfte, Spanne, Anzahl, ab Runde 2 die
  Veränderung), danach in der Spalte der Personen. Export: beide Runden mit Einheit und Veränderung, die Zettel unter
  „Begründungen“, nie eine einzelne Schätzung. Datenschutzerklärung 3.1 und 3.3 in beiden Sprachen.
- Abweichungen: (1) „Schätzfrage stellen“ steckt in der ersten Schätzung, wie „Frage stellen“ in „Ideen schreiben“;
  fünf statt sechs Schritte. (2) „Abweichungen besprechen“ ist bis M4 ein Schritt für alle, nicht in Kleingruppen;
  die Kurzbeschreibung sagt darum „besprechen gemeinsam“ statt „in Kleingruppen“. (3) Kein „Auch bekannt als“:
  „Mini-Delphi“ ist nicht im Register geprüft. (4) Die Schätzschritte sind `aggregate` (nur Summe), nicht
  „verdeckt“: `checkAgenda` verlangt das für jede Abstimmung. (5) Die erste Runde ist ab dem Anlegen offen
  (`initialFlow(agenda)`), weil die Methode mit ihr beginnt. (6) Die Begründungen sind gewöhnliche Zettel ohne
  Spalte `kind`. (7) Die Einheit auf `/neu` steht nicht im Architekturvorschlag; Grenzen (`min`, `max`) gibt es in
  den Regeln, aber keine Methode und keine Oberfläche setzt sie. (8) Keine Uhr in den Schätzschritten (die Uhr gibt
  es nur beim Schreiben); vor „Weiter“ muss die Moderation auszählen, wie in M2.
- `CI=1 pnpm checks` grün: 355 Tests im geteilten Paket, 126 in `packages/arrange`, 247 im Worker, 298 in der App,
  337 Ende-zu-Ende, keiner übersprungen. Kosten: zwei Runden mit 8 Personen 28 Zeilen (Schätzungen 20 samt Tabelle 2
  und Tagesmarke 1, Auszählen 4, Schritte 4), dazu 8 Zeilen für 8 Begründungen.
- Nicht geprüft: kein Bildschirmleser, nicht bei 2000 px angesehen; mit zwei Personen sind kleinste und größte Zahl
  die beiden Schätzungen (die Datenschutzerklärung sagt es); Texte und Belegsatz aus dem Katalog nicht neu an den
  Quellen geprüft.

### M4: Paare und Kleingruppen

Teams bilden (zufällig, durch die Moderation, zusammenlegen, Nachzügler), Sichtbarkeit je Team, Bereiche, die Wahl
eines Teams, Weitergehen nach Ablauf der Zeit. Methode „1-2-4-Alle“.

Abnahme: Ein Team sieht kein fremdes Team (Test auf Nachrichtenebene). Zusammenlegen zeigt genau den Unterschied. Ein
Workshop überlebt den Ruhezustand des Durable Objects mitten im Schritt. Höchstens 60 Zeilen für 8 Personen.

**Stand M4 (27.11.2026, Branch `methoden-m4` auf M3 `78ea465`, nicht committet):** gebaut, von dir nicht abgenommen,
nicht deployt.

- `packages/shared/src/domain/teams.ts` (rein): `formTeams` (Teams von etwa der Schrittgröße aus den Anwesenden,
  zufällig nach einem gespeicherten Startwert, reihum verteilt, nie ein Team aus einer Person, sobald zwei da sind;
  sechs Personen zu viert sind zwei Dreier), `mergeTeams` (je zwei Teams werden eins, ein übriges kommt zum letzten),
  `placeLatecomer` (ins kleinste Team), `checkTeams`/`decideTeamsSet` (dieselben Personen, gleich viele Teams, keins
  leer, keins aus einer Person, wo Paare passen; nur die Moderation, nur im Schritt der Teams, nur für die Revision,
  für die der Tausch gemacht wurde), `enterTeams` (bilden, zusammenlegen oder beim Zurückgehen die Teams des Schritts
  wiederholen), Bereiche (`areaBox`: ein Band unter den ersten Zetteln, je Team Felder, ein Vierer umfasst die Felder
  seiner Paare), `teamViewFor` (die Moderation bekommt die ganze Karte, alle anderen ihr eigenes Team) und
  `teamCounts` für den Export. Sichtbarkeit `team` in `visibility.ts`: Einen Zettel sieht, wer mit seinem Verfasser
  ein Team teilt, in den Teams von jetzt oder in Teams von vorher für die Zettel, die geschrieben wurden, solange
  diese galten; so wird nur weiter, nie enger. `revealedFor(notes, viewer, vorher, nachher)` gibt genau den
  Unterschied. Die Uhr gehört nun auch zu jedem Schritt, der selbst weitergeht; `autoAt`, `nextAlarm`, `decideAuto`,
  `decideAutoSwitch` in `flow.ts`.
- Worker: `meta 'teams'` (eine Zeile je Änderung, mit `seq`), gebildet in der Transaktion des Schrittwechsels aus
  den offenen Sockets mit einem Startwert aus `crypto.getRandomValues`; `admin.teams.set`, `team.changed` (je
  Browser: seine Sicht der Teams, die Zettel, die er ab jetzt sieht, und wie viele ihm verborgen bleiben);
  Nachzügler beim Beitritt; `admin.step.auto`, `auto.changed`. Der eine Wecker steht auf dem früheren von
  Löschtag und Ende der Uhr eines Schritts, der selbst weitergeht; `alarm()` löscht zuerst, wenn der Löschtag da ist,
  geht sonst weiter, wenn die Zeit um ist, und stellt den Wecker neu. Ein Wecker, der zu spät oder doppelt läutet,
  findet nichts fällig. Protokoll 9.
- Methode „1-2-4-Alle“ (`eins-zwei-vier`, „Ideen sammeln“, Experimente, 4–30 Personen, 15 Minuten) mit Texten DE/EN
  aus dem Katalog und der Namensnennung (bei der Methode unter der Kurzbeschreibung auf der Wand, in „Mehr dazu“ auf
  `/neu`, unter „Lizenzen“ und im Export). Wortlaut nach der Fußzeilen-Vorlage auf liberatingstructures.com/cc-license,
  am 27.11.2026 gelesen: „Enthält Inhalte von www.liberatingstructures.com von Keith McCandless, Henri Lipmanowicz und
  Nancy White (Liberating Structures Fieldbook, 2026), lizenziert unter CC BY-SA 4.0.“ Die Seite nennt die
  Namensnennung des Katalogs („Lipmanowicz & McCandless“) nicht mehr allein, sondern mit Nancy White und dem
  Fieldbook von 2026.
- App: Stand mit „Du bist in Team 3 mit Anna und Ben. Sprecht in eurem Videotool im Breakout-Raum 3.“, Satz des
  Stands „Die Teams schreiben für sich: 5 Zettel.“, eigene Sätze für vor den Teams, im Team und beim Vorstellen;
  Bereiche der Teams auf der Fläche (gezeichnet; ein Mitglied sieht im Schritt mit Teams nur den eigenen, die
  Moderation alle; der Beginn des Schritts und „Alles zeigen“ nehmen vom Bereich nur seinen Kopf mit, so bleiben die
  Zettel so groß wie auf einer Wand mit ebenso vielen Zetteln, ein Ende-zu-Ende-Test vergleicht den Zoom), ein neuer
  Zettel kommt in den eigenen Bereich, und beim Bilden der Teams legt die Wand die allein geschriebenen Zettel jeder
  Person in den Bereich ihres Teams (eine Zeile, `layoutIntoAreas`, auch beim Zusammenlegen für Zettel außerhalb des
  Bereichs, etwa nach einem Tausch); der Satz des Stands zählt im Schritt mit Teams das Team, ungebremst: „Euer Team:
  2 Zettel. Ihr seid 2 im Team.“; Überschriften je Team in der Liste; „Mehr“ → „Teams“ (`components/Teams.tsx`): alle Teams mit
  Namen, „Tauschen“ ohne Ziehen; „Mehr“ → „Nach Ablauf auf „Weiter“ warten“. Datenschutzerklärung 3.1 und 3.3 in
  beiden Sprachen (die Zuordnung zu Teams bleibt, solange die Wand besteht).
- Abweichungen von `docs/architektur-methoden.md` 3.2 und 3.3: (1) Keine Spalten `step` und `team` an den Zetteln:
  Wer einen Zettel sieht, folgt aus seinem Verfasser und den Teams; alle Zettel von „1-2-4-Alle“ zählen ab Schritt 0,
  wie bisher. Das Team eines Zettels für Bereich und Liste ist sein Ort (`areaAt`), nicht eine gespeicherte Angabe; wer
  einen Zettel aus dem Bereich zieht, nimmt ihn aus der Überschrift des Teams. (2) Kein `flow.auto`: Der Zeitpunkt
  ist das Ende der Uhr des Schritts, die Prüfung „noch derselbe“ ergibt sich daraus, dass ein Wechsel die Uhr anhält
  oder neu startet. (3) „Abschaltbar je Schritt“ ist `flow.manual` (eine Liste der Schritte) und `admin.step.auto`,
  nicht im Architekturvorschlag. (4) `formTeams` kennt nur `random` und `merge`, nicht `moderation` und `keep`.
  (5) `team.changed` trägt die neu sichtbaren Zettel und die Zahl der verborgenen mit (eine Nachricht, eine
  Nummer); beim Schrittwechsel stehen die Teams in `step.changed`, die neuen Zettel wie beim Aufdecken in
  `notes.revealed` (jetzt mit `hidden`). (6) Ein übriges Team kommt beim Zusammenlegen zum letzten (ein Sechser),
  statt eines Paars im Schritt zu viert. (7) Ein Tausch läuft über die ganze Liste der Teams, nicht über einzelne
  Personen. (8) „Frage stellen“ steckt im Schreiben, wie in den anderen Methoden: vier statt fünf Schritte, 15 statt
  16 Minuten. (9) Kein „Auch bekannt als“ für 1-2-4-Alle.
- `CI=1 pnpm checks` grün: 379 Tests im geteilten Paket, 126 in `packages/arrange`, 258 im Worker, 300 in der App,
  347 Ende-zu-Ende, keiner übersprungen. Kosten: ein Lauf von 1-2-4-Alle mit 8 Personen 38 Zeilen (Uhr samt Wecker 2,
  24 Zettel und die Tagesmarke 25, drei Schritte durch den Wecker 10 samt dem Umlegen der Zettel in die Bereiche,
  ein Tausch 1); die typische Wand bleibt bei 397.
- Nicht geprüft: kein Bildschirmleser, nicht bei 2000 px angesehen; das selbst Weitergehen nur im Worker-Test mit
  `runDurableObjectAlarm`, nie mit einem echten Wecker im Browser durchgespielt; kein Ende-zu-Ende-Test mit
  ungerader Zahl oder Nachzügler (die prüfen Worker- und Regeltests); Texte und Belegsatz aus dem Katalog nicht neu
  an den Quellen geprüft; die Moderation zählt beim Bilden mit, wenn sie da ist (sie kann sich nur tauschen, nicht
  herausnehmen; so bleibt es vorerst). Auch in einem Team behält sie „Weiter“ und „Mehr“ → „Teams“ mit allen Teams,
  sieht aber wie alle nur die Zettel ihres Teams; `tests/teams.spec.ts` spielt das mit der Moderation in einem Paar; „Schätzen – Diskutieren – Schätzen“ bespricht weiter gemeinsam, nicht in Kleingruppen (nicht
  umgebaut, um laufende Wände nicht zu verschieben).

### M5 und M6: die übrigen Methoden

M5: Rückblick nach Ziel und Daten, Scheitern vorwegdenken, Stille Ideenrunde mit Rangfolge, Was? Na und? Was nun?
M6: Kriterienbewertung, Gegenposition prüfen, Entscheidungsprotokoll mit Zustimmungsrunde, Annahmen prüfen, Ziele mit
messbaren Ergebnissen.

Abnahme je Methode: ein Ende-zu-Ende-Test, ein Export-Test, eine Zeile im Kostentest, ihre Texte in beiden Sprachen.

**Stand M5 (27.11.2026, Branch `methoden-m5` auf `cd154d5`, nicht committet):** gebaut, von dir nicht abgenommen,
nicht deployt.

- Vier Methoden mit Texten DE/EN in `methods/catalogue.ts` und `methods/texts.ts`, jede mit Kurzbeschreibung, Dauer
  und Gruppengröße auf `/neu` (ohne Evidenz) und einem Satz je Schritt, was jetzt zu tun ist (`hint`, auf der Wand
  unter der Zeile des Schritts):
  - „Rückblick nach Ziel und Daten“ (`rueckblick`, Rückblick, 3–12 Personen, 45 Minuten): Ziel und Fakten verdeckt,
    Aufdecken, Gründe in Kleingruppen (zufällig, etwa vier), vorstellen und bündeln, Aktionen verdeckt vorschlagen,
    Aktionen aufdecken, Aktionen wählen (Punkte, nur über die Aktionen), bis zu drei festlegen mit Wer und Bis wann.
    Die Kurzbeschreibung und die Texte stellen Fakten und Zahlen nach vorn und behaupten nicht, dass der Abgleich mit
    dem Ziel die Wirkung macht (`docs/belege-pruefung.md`); der Datenschritt fragt nach Fakten und Zahlen, „am besten
    aus Aufzeichnungen statt aus dem Gedächtnis“.
  - „Scheitern vorwegdenken“ (`scheitern`, Risiken, 3–12 Personen, 35 Minuten): Plan vorstellen (niemand schreibt),
    Gründe verdeckt aufschreiben, reihum aufdecken, zu Risiken bündeln, Plan anpassen (die Änderungen sind Aktionen
    mit Wer und Bis wann).
  - „Stille Ideenrunde mit Rangfolge“ (`ideenrunde`, Entscheiden, 4–10 Personen, 40 Minuten): still sammeln, reihum
    aufdecken, klären ohne zu bewerten, die fünf wichtigsten ranken (Borda), Ergebnis.
  - „Was? Na und? Was nun?“ (`was-na-und`, Rückblick, 4–30 Personen, 30 Minuten, Liberating Structures mit derselben
    Namensnennung wie 1-2-4-Alle): drei Runden aus allein und verdeckt, Kleingruppe (etwa fünf), vorstellen.
- Bausteine in `packages/shared`: **Reihum aufdecken** (`domain/turns.ts`, Schritt mit `turns`): beim ersten Betreten
  friert der Server die verdeckten Zettel in eine Reihenfolge ein (abwechselnd nach Person, die Personen nach einem
  Startwert aus `crypto.getRandomValues`), in `flow.turns`; die Reihenfolge verlässt den Server nie, ein Browser
  erfährt „gezeigt“ und „übrig“. „Nächster Zettel“ (`admin.turn.next`) zeigt allen zugleich genau einen Zettel (eine
  Zeile, ein Frame `turn.shown`). In diesem Schritt wird nicht geschrieben, gelöscht oder gruppiert; der nächste
  Schritt zeigt den Rest. **Runden, die wieder verdecken**: ein Zettel merkt sich den Schritt, in dem er geschrieben
  wurde (`Note.step`), und zählt ab dem Beginn seiner Runde (`writingFrom`); was schon allen gezeigt war, bleibt
  gezeigt (`sightOf` gibt dann eine Sicht je Zettel statt einer Stufe für die Wand). **Teams behalten** (`keep`): die
  Kleingruppen der ersten Runde bleiben, mit neuen Bereichen daneben; schon gezeigte Zettel werden nicht in Bereiche
  gelegt. **Wahl über die Zettel eines Schritts** (`optionsFrom`). **Aktionen**: Zettel eines Schritts mit
  `noteKind: "action"`; in einem Schritt vom Typ `decide` legt die Moderation sie mit „Wer“ und „Bis wann“ fest
  (`note.action`, freier Text bis 60 und 40 Zeichen). `checkAgenda` prüft alle drei neuen Teile. Protokoll 10.
- Worker: Schema 5, die Spalten `step` und `action` an den Zetteln, nur bei Wänden, die dieser Build anlegt; eine Wand
  von Schema 3 oder 4 wird nicht umgebaut (kein Schreiben beim Besuch) und bleibt bei Schema 4 ohne die Spalten (ihre
  Methoden brauchen sie nicht). Jede Nachricht über Zettel geht in einer Wand mit Sicht je Zettel durch dieselbe
  Prüfung je Zettel wie in einem Schritt mit Teams. „Ordnen“ ist aus, solange Zettel für jemanden verdeckt sind.
- App: die Rangfolge (`components/Rank.tsx`: wählen, nach oben, nach unten, entfernen, nur Tasten, der Fokus folgt
  der Zeile), die Aktionen (`components/Actions.tsx`: Wer, Bis wann, Festlegen, Neue Aktion), der Schritt „Reihum
  aufdecken“ mit „Nächster Zettel“ als Hauptaktion der Moderation und „Noch 5 Zettel verdeckt.“, ein Schritt zum
  Zuhören ohne „Neuer Zettel“; neue Sätze, was jetzt zu tun ist. Export: Zettel nach dem Schritt, in dem sie
  geschrieben wurden, die festgelegten Aktionen als Aufgaben (`- [ ] … — Wer: …, bis: …`, maskiert), was reihum noch
  verdeckt ist, fehlt mit einem Satz. Datenschutzerklärung 3.1 und 3.3 in beiden Sprachen (Aktionen mit Wer und Bis
  wann, der Schritt eines Zettels, die Reihenfolge, die Kleingruppen über Runden).
- Abweichungen: (1) Rückblick: „Einstimmen“ steckt in der Frage, „Abschluss“ im Festlegen; dafür ein Schritt
  „Aktionen aufdecken“ vor der Wahl, weil der Katalog über verdeckte Aktionen abstimmen lässt und eine Wahl nie
  anbietet, was niemand gesehen hat: neun statt zehn Schritte. (2) Scheitern: der „Impuls“ ist der Satz des
  Schreibschritts; fünf statt sechs Schritte. (3) Ideenrunde: „Frage stellen“ steckt im Sammeln; das Ergebnis zeigt
  Punkte und wie viele die Idee gerankt haben, keine Streuung je Idee (der Ergebnistext sagt das). (4) Was? Na und?
  Was nun?: die „Einführung“ ist die Frage; alle Schritte warten auf „Weiter“ (deine Entscheidung 2: selbst weiter nur
  in kurzen, getakteten Methoden wie 1-2-4-Alle); die dritte Runde schreibt Zettel, keine Aktionen. (5) Kein „Auch
  bekannt als“ für „Pre-Mortem“ und „Nominalgruppentechnik“: beide „Register offen“, niemand hat in TMview gesucht;
  „What, So What, Now What?“ steht nur im Deutschen. (6) Die Spalte `step` (Architektur 1) kommt erst mit Schema 5 und
  nur für neue Wände; Methoden, die nicht wieder verdecken, senden und speichern keinen Schritt (alles zählt ab
  Schritt 0 wie bisher). (7) Höchstens drei Aktionen ist ein Satz, keine Regel. (8) „15. Januar“ steht im Export als
  `15\. Januar` (die Maskierung eines Feldanfangs; die Darstellung ist dieselbe). (9) In `Ballot.tsx` und
  `Estimate.tsx` ist nur ein Typ geändert (`TFunction`): mit den neuen Texten wurde der Typ von i18next zu tief. (10)
  `packages/shared/package.json` sagt jetzt `"sideEffects": ["./src/protocol.ts"]` (dort steht `z.config`): ohne die
  Angabe legte der Bundler mit dem größeren Katalog die Texte der Methoden in die Datei, die der Start lädt, was
  `apps/web/tests/worker.spec.ts` verbietet; mit ihr lädt der Start 174 statt 182 KB (gzip).
- `CI=1 pnpm checks` grün: 405 Tests im geteilten Paket, 126 in `packages/arrange`, 266 im Worker, 301 in der App, 362 Ende-zu-Ende, keiner übersprungen. Kosten mit 8 Personen: Ideenrunde 49 Zeilen (16 Ideen, 16 Mal „Nächster Zettel“,
  8 Rangfolgen), Scheitern 47 (16 Gründe, 16 Mal „Nächster Zettel“, 3 Risiken, 3 festgelegte Änderungen), Rückblick 49
  (24 Zettel, 8 Stimmzettel, 3 festgelegte Aktionen), Was? Na und? Was nun? 45 (30 Zettel in drei Runden); jeder Zettel
  und jedes „Nächster Zettel“ kostet eine Zeile mehr.
- Nicht geprüft: kein Bildschirmleser, nicht bei 2000 px angesehen; kein Ende-zu-Ende-Test mit mehr als einem Team in
  den Kleingruppen (der Worker-Test spielt acht Personen in zwei Teams); im Browser zeigt das Verschieben eines
  fremden, reihum aufgedeckten Zettels sich erst mit der Antwort des Servers (die Regeln des Browsers kennen die
  Reihenfolge nicht); Texte aus dem Katalog nicht neu an den Quellen geprüft (sie behaupten keine Evidenz).

**Stand M6 (28.11.2026, Branch `methoden-m6` auf M5 `1a2b46a`, nicht committet):** gebaut, von dir nicht abgenommen,
nicht deployt.

- Fünf Methoden und die Schnellvariante der Kriterienbewertung als sechste, mit Texten DE/EN in `methods/catalogue.ts`
  und `methods/texts.ts`, jede mit Kurzbeschreibung, Dauer und Gruppengröße auf `/neu` und einem Satz je Schritt:
  - „Kriterienbewertung“ (`kriterien`, Entscheiden, 3–12 Personen, 40 Minuten): Kriterien verdeckt vorschlagen,
    festlegen (aufgedeckt; die Zettel, die beim Bewerten stehen, sind die Kriterien, die ersten fünf in der
    Reihenfolge des Schreibens), Optionen für alle sichtbar schreiben und vorstellen, jede Option je Kriterium von 1
    bis 5 verdeckt bewerten, Unterschiede besprechen, das Gesamturteil festhalten (Entscheidung mit Begründung).
  - „Nutzen und Aufwand“ (`nutzen-aufwand`, Entscheiden, 3–12, 20 Minuten): Optionen, Bewertung nach „Nutzen“ und
    „Geringer Aufwand“, Ergebnis besprechen, Gesamturteil festhalten.
  - „Gegenposition prüfen“ (`gegenposition`, Entscheiden, 4–12, 35 Minuten): Vorschlag vorstellen (niemand schreibt),
    eigene Bedenken verdeckt, zwei Kleingruppen mit Rollen („Gegenposition“: Schwächen und Gegenannahmen;
    „Annahmen“: die Annahmen des Vorschlags), vorstellen, zusammenführen (Entscheidungen mit Begründung).
  - „Entscheidungsprotokoll mit Zustimmungsrunde“ (`entscheidung`, Entscheiden, 3–12, 40 Minuten): Rahmen (niemand
    schreibt), Vorschlag als Zettel für alle, Verständnisfragen, Reaktionen verdeckt, Zustimmungsrunde über die
    Zettel des Vorschlags, Einwände einarbeiten (deckt die Reaktionen auf), Entscheidung mit Begründung, offenen
    Einwänden und Prüftermin festhalten; die Moderation entscheidet und spricht zuletzt.
  - „Annahmen prüfen“ (`annahmen`, Planen und Ziele, 3–12, 45 Minuten): eigene Leinwand aus fünf Feldern
    („Kundschaft“, „Problem“, „Lösung“, „Geld“, „Umsetzung“; drei oben, zwei mittig darunter), Annahmen verdeckt in
    die Felder, aufdecken und bündeln, jede Annahme nach „Schaden, wenn falsch“ und „Wie wenig wir wissen“ bewerten,
    die riskantesten besprechen, Tests in Kleingruppen (etwa drei), Tests vorstellen und mit Wer und Bis wann festlegen.
  - „Ziele mit messbaren Ergebnissen“ (`ziele`, Planen und Ziele, 3–15, 45 Minuten): Zeitraum und Richtung
    vorstellen, Ziele verdeckt, aufdecken und bündeln, bis zu drei wählen (Auswahl), messbare Ergebnisse in
    Kleingruppen, vorstellen, festlegen mit Ziel, Zielwert, Verantwortlichen und Prüftermin.
- Bausteine in `packages/shared`: **Bewertung mit Kriterien** (`vote.ts`): die Kriterien sind die eigenen Schlüssel
  des Schritts (Wörter in `texts.ts`, `criteria`) oder Zettel bestimmter Schritte (`Step.criteriaFrom`, `criteriaOf`):
  deren Texte friert der Server beim Betreten in die Runde ein (`VoteRound.criteria`, `criteriaOmitted`), die Breite
  eines Stimmzettels folgt daraus (`scoreWidth`), das Ergebnis trägt sie mit (`RankingResult.criteria`). **Optionen
  aus mehreren Schritten** (`optionsFrom` als Liste, `optionsSteps`). **Zustimmungsrunde** (Abstimmungsart `consent`,
  Schritttyp `consent`): je Person „Zustimmung“, „Kann damit leben“ oder „Einwand“ mit Begründung (Pflicht beim
  Einwand, sonst keine); das Ergebnis zählt die Antworten und nennt die Begründungen alphabetisch, ohne Kennung
  (`ConsentResult`). **Rollen** (`TeamSettings.roles`, `roleTeamCount`, `roleOf`): so viele Teams wie Rollen, mehr
  erst über sieben je Team, Team n bekommt die Rolle n. **Entscheidungen und messbare Ergebnisse**: Zettel der Art
  `decision` und `result`, die die Moderation in einem Schritt vom Typ `decide` festhält, mit demselben Befehl wie
  Aktionen (`note.action`) und eigenen Feldern (`why`, `open`, `due`; `who`, `target`, `goal`, `due`), die die
  Regeln je Art prüfen. **Feste Felder** (`Method.fields`, `fieldBoxes`). `checkAgenda` prüft `criteriaFrom`
  (`criteriaShape`), Rollen nur bei zufälliger Bildung und Entscheidungen und Ergebnisse wie Aktionen. Protokoll 11.
- Worker: die festen Felder beim Anlegen (fünf Gruppen, Titel in der Sprache aus der Anfrage, `language` im Eintrag
  der Agenda, Vorgabe Deutsch); die Kriterien aus Zetteln beim Betreten der Bewertung; Optionen aus mehreren
  Schritten. Sonst nichts Neues: Stimmzettel, Auszählen, Teams und `note.action` laufen über die Wege von M2 bis M5.
- App: die Bewertung (`components/Score.tsx`: je Option eine Gruppe mit einem Auswahlfeld je Kriterium, „–“ und 1
  bis 5, nur Tasten; das Ergebnis als Tabelle mit Mittelwerten je Kriterium und Gesamt, nie eine einzelne Bewertung),
  die Zustimmungsrunde (`components/Consent.tsx`: der Vorschlag, drei Antworten als Segmented Control, das Feld der
  Begründung; das Ergebnis mit Zahlen und Einwänden), Entscheidungen und messbare Ergebnisse in `Actions.tsx` (je Art
  eigene Felder und Wörter), die Rolle des Teams im Stand („Eure Rolle: Gegenposition. …“) und an den Bereichen
  („Team 1 · Gegenposition“), neue Sätze, was zu tun ist. `/neu` schickt bei „Annahmen prüfen“ die Sprache mit. Export:
  Bewertung als Markdown-Tabelle, Zustimmungsrunde, Entscheidungen mit „Entschieden von: der Moderation“ und ihren
  Feldern, messbare Ergebnisse als verschachtelte Liste unter ihrem Ziel, die Zettel eines Schritts mit Rollen je Team
  und Rolle; keine Namen, keine einzelnen Stimmzettel. Datenschutzerklärung 3.1 und 3.3 in beiden Sprachen.
- Aus der Durchsicht von M5: der Schritt der Rangfolge heißt jetzt „Die wichtigsten ranken“ / „Rank the most
  important“, weil das Feld bei weniger Optionen weniger als fünf Plätze anbietet.
- Abweichungen: (1) Die Schnellvariante ist eine eigene Methode („Nutzen und Aufwand“), kein Schalter auf `/neu`: So
  steht sie mit eigener Dauer und Kurzbeschreibung in der Auswahl, und die Anfrage braucht kein neues Feld. (2)
  Kriterienbewertung: „Summe zeigen“ ist das Auszählen der Bewertung, sechs statt sieben Schritte; das Ergebnis zeigt
  keine Streuung (bei wenigen Personen verriete sie einzelne Bewertungen), der Ergebnistext sagt das. „Kriterien
  festlegen“ heißt Zettel löschen, zusammenfassen und umformulieren; gewertet werden die ersten fünf. (3) „Geringer
  Aufwand“ statt „Aufwand“ und „Wie wenig wir wissen“ statt „Wie gut belegt?“: So heißt 5 auf beiden Achsen dasselbe
  (gut bzw. riskant), und der Mittelwert bei gleichen Gewichten ordnet richtig; die zwei Achsen stehen als Spalten der
  Tabelle, nicht als Raster. (4) Annahmen prüfen: „Vorhaben in einem Satz“ ist die Frage der Wand, sechs statt sieben
  Schritte, 45 statt 50 Minuten; die Felder sind gewöhnliche Gruppen (umbenennbar, löschbar). (5) Gegenposition: in der
  Rollenrunde sieht jedes Team die Bedenken seiner Mitglieder (Sichtbarkeit wird nur weiter); unter vier Personen
  entsteht nur ein Team mit der ersten Rolle. (6) Entscheidungsprotokoll: Kurzbeschreibung und „Wann nutzen“ sagen,
  dass die Moderation den Rahmen nennt und entscheidet (v1), statt „Ihr klärt, wer entscheidet“; Frist und „wer trägt
  bei“ werden gesagt, nicht gespeichert, das Protokoll hat den Prüftermin. (7) Entscheidung und Ergebnis liegen in der
  Spalte `action` des Zettels (Schema 5) mit eigenen Feldern; kein neuer Befehl, keine neue Spalte. (8) Ziele: kein
  „Auch bekannt als“ (Register offen, der Name wird nie benutzt); das Ziel eines Ergebnisses wählt die Moderation
  beim Festlegen aus den gewählten Zielen (die Plätze 1 bis 3 mit Stimmen), ein Ergebnis wird nicht beim Schreiben an
  ein Ziel gehängt. (9) Die Bewertung nutzt Auswahlfelder statt Tasten oder Segmented Control (das ist für zwei bis
  vier Optionen). (10) `keepsSteps` gilt jetzt auch für Zettelarten außer Ideen und Begründungen und für Schritte mit
  `optionsFrom` oder `criteriaFrom`. (11) Im Kostentest steht die Hilfsfunktion `run` jetzt auf Modulebene, für M5
  und M6 gemeinsam, unverändert.
- `CI=1 pnpm checks` grün: 446 Tests im geteilten Paket, 126 in `packages/arrange`, 277 im Worker, 302 in der App,
  385 Ende-zu-Ende, keiner übersprungen.
- Kosten mit 8 Personen: Kriterienbewertung 32 Zeilen (8 Kriterien, 4 Optionen, 8 Bewertungen, 1 Entscheidung), Nutzen
  und Aufwand 24, Gegenposition 27 (8 Bedenken, 6 Zettel in den Teams, 3 Entscheidungen), Entscheidungsprotokoll 30
  (8 Reaktionen, 8 Antworten, 1 Entscheidung), Annahmen prüfen 49 und 5 für die Felder beim Anlegen, zusammen 54 (16
  Annahmen, je Person eine Bewegung in die Felder, 8 Bewertungen, 3 Tests), Ziele 44 (8 Ziele, 3 Bündel, 8 Stimmzettel,
  6 Ergebnisse). Jeder Zettel, jede Bewegung und jedes Festhalten kostet eine Zeile mehr: Wer in „Annahmen prüfen“ jede
  Annahme einzeln in ihr Feld schiebt (so arbeitet „Verschieben nach …“ in der Liste), zahlt 8 Zeilen mehr, 62, knapp
  über 60.
- Nicht geprüft: kein Bildschirmleser, nicht bei 2000 px angesehen; Rollenzeile und die Felder auf der Fläche in
  keinem eigenen Bildschirm der axe-Prüfung (die Ende-zu-Ende-Tests lesen sie); eine Bewertung mit vielen Optionen auf
  dem Handy (je Option bis zu fünf Auswahlfelder); die Felder der Entscheidungen und Ergebnisse ohne Maus; Texte aus
  dem Katalog nicht neu an den Quellen geprüft (sie behaupten keine Evidenz).

### M7: Agenda und Startseite

Mehrere Methoden hintereinander auf einer Wand (anhängen, entfernen, verschieben ohne Ziehen), Schritte ändern, die
noch nicht erreicht sind. Der Abschnitt „Geführte Methoden“ auf der Startseite (Name und Kurzbeschreibung, keine
Evidenz). Die Namensnennung für Liberating Structures bei der Methode und unter „Über“. Datenschutzerklärung und
Barrierefreiheits-Erklärung angepasst.

Abnahme: Eine Agenda aus drei Methoden läuft durch. Was eine Methode erzeugt, kommt in der nächsten an.

## 6 Risiken

| Risiko | Gegenmittel |
|---|---|
| Die Wand wird überladen: jeder Schritttyp ist eine eigene Ansicht | Eine Hauptaktion je Schritt, der Kopf als einzige Wahrheit, Abstimmen als eigene Ansicht statt auf der Fläche |
| Zeilen im Gratisplan | Jede Methode mit Obergrenze im Kostentest. Bremse und Tagesbudget bleiben |
| Barrierefreiheit | Plus/Minus statt Ziehen beim Punkten, Schrittwechsel und „Zeit um“ werden angesagt, Fokus springt nie, während jemand schreibt |
| Rund 300 Texte je Sprache | Texte im geteilten Paket mit Gleichstands-Test DE/EN, nachgeladen, damit der Start nicht schwerer wird |
| Ungeprüfte Belege in der App | Entfällt: Seit dem 27.11.2026 zeigt die App keine Belege (Abschnitt 7, Frage 5). Die Regeln der Abläufe stützen sich auf die geprüfte Recherche |
| Marken | Vor dem Bau von M5 eine Suche in TMview für die Namen mit „Register offen“ im Katalog |

## 7 Fragen an dich

Jede mit Empfehlung zuerst. **Entschieden am 27.11.2026:** 1, 2, 5 und 8 von dir, jeweils wie empfohlen (IdeaBeam
bleibt; die Moderation drückt „Weiter“; Evidenz als Wort mit einem Satz; erst M1 und M2). Frage 5 hast du am
27.11.2026 neu entschieden: ganz weglassen. 3, 4, 6 und 7 sowie die
Einzelheiten in Anhang A gelten nach der Empfehlung, solange du nichts anderes sagst.

1. **Name.** Bleibt es IdeaBeam?
   - *Behalten (empfohlen).* Pro: Domain, Repo und Startseite sind da; „Idee“ passt zu Workshops. Contra: Der Name
     klingt nach Ideensammeln, nicht nach Entscheiden.
   - Neuer Name. Pro: passt zum größeren Anspruch. Contra: neue Domain, neue Recherche, Links brechen.
2. **Geht die App nach Ablauf der Zeit selbst weiter?**
   - *Nein, die Moderation drückt „Weiter“; nur in kurzen, getakteten Methoden wie 1-2-4-Alle automatisch
     (empfohlen).* Pro: Niemand wird mitten im Satz abgeschnitten. Contra: ein Klick mehr.
   - Immer automatisch. Pro: strenge Zeit. Contra: Überraschungen.
3. **Sollen alle sehen, wie viele schon abgestimmt haben („5 von 8“)?**
   - *Ja, nur die Zahl (empfohlen).* Pro: Alle wissen, wann es fertig ist. Contra: leichter Druck auf die Langsamen.
   - Nein. Pro: kein Druck. Contra: Die Moderation rät, wann sie auszählt.
4. **Wer bildet Paare und Teams?**
   - *Die App zufällig, die Moderation kann tauschen (empfohlen).* Pro: schnell und fair. Contra: Freunde landen
     getrennt.
   - Nur die Moderation. Pro: Kontrolle. Contra: langsam bei 20 Leuten.
5. **Evidenz anzeigen?** **Entschieden am 27.11.2026: ganz weglassen.** Keine Evidenzstufe („Meta-Analyse“,
   „Experimente“, „Studien“, „Praktikerkonsens“, „umstritten“) und kein Belegsatz, nirgends: nicht auf `/neu`, nicht
   auf der Wand, nicht im Export, nicht auf der Startseite, nicht im Datenmodell der Methoden. Die belegten Regeln
   (erst allein, verdeckt bis zum Aufdecken, verdeckt abstimmen) bleiben in den Abläufen; die Kurzbeschreibung jeder
   Methode (Abschnitt 2) bleibt. Die erste Antwort (wie empfohlen, als Wort mit Satz) ist damit aufgehoben.
   - *Ja, als Wort („Meta-Analyse“, „Experimente“, „Studien“, „Praktikerkonsens“, „umstritten“) mit einem Satz,
     jede Quelle vorher geprüft (empfohlen).* Pro: Das macht sonst niemand. Contra: Manche Methoden sehen schwach aus,
     und das Prüfen kostet Zeit.
   - Nein. Pro: weniger Text. Contra: Das Besondere geht verloren.
6. **Namensnennung für Liberating Structures** („1-2-4-Alle“, „Was? Na und? Was nun?“): Die Lizenz verlangt eine
   sichtbare Nennung.
   - *Annehmen, Nennung bei der Methode und unter „Über“ (empfohlen).* Pro: Wer Workshops kennt, erkennt die Methoden.
     Contra: eine Zeile mehr in der Oberfläche.
   - Eigene Namen. Pro: keine Nennung. Contra: weniger wiedererkennbar.
7. **Eine Methode je Wand zuerst, die Agenda aus mehreren Methoden erst in M7?**
   - *Ja (empfohlen).* Pro: früher nutzbar, kleinere Oberfläche. Contra: Ein langer Workshop braucht bis M7 mehrere
     Wände.
   - Agenda von Anfang an. Pro: der volle Gedanke sofort. Contra: rund 3 AT später nutzbar, mehr Risiko in M1.
8. **Reihenfolge der Arbeit.** Die offenen Punkte von v0.1 (Messung des eigenen Schlüssels, Reserve im Browser 4c)
   warten, bis M2 fertig ist?
   - *Ja (empfohlen).* Pro: Die neue Richtung bekommt die Kraft. Contra: Der eigene Schlüssel bleibt länger
     unsichtbar.
   - Erst v0.1 fertig. Pro: nichts bleibt halb. Contra: Die neue Richtung beginnt Wochen später.

## Anhang A: Architekturvorschlag

Der vollständige Vorschlag mit Datenmodell, Nachrichten, Speicher, Kosten und den Einzelfragen steht in
[`docs/architektur-methoden.md`](docs/architektur-methoden.md) (27.11.2026). Er ist die Grundlage für M1 und wird
beim Start von M1 gegen den Code geprüft, der dann gilt.
