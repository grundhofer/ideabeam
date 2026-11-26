# IdeaBeam

Eine Brainstorming-Wand ohne Konto: Jemand legt eine Wand an, teilt den Link, alle treten mit einem Anzeigenamen bei
und schreiben Zettel, und eine KI ordnet die Zettel nach Bedeutung. Ohne Analyse-Skripte, die Wand liegt in der EU.

**Stand:** Etappen 1 bis 3 von v0.1 sind gebaut und warten auf die Abnahme: Wand anlegen und beitreten, die Fläche
mit Zetteln und Gruppen, die Listenansicht, verdecktes Schreiben mit Aufdecken und Uhr. Das Ordnen durch die KI
beginnt mit Etappe 4a. Eine Vorschau läuft.

- [`PLAN.md`](PLAN.md): Konkurrenz, Umfang, Architektur, KI, Etappen mit Abnahme, Risiken, Entscheidungen.
- [`AGENTS.md`](AGENTS.md): Befehle, Aufbau und die Regeln dieses Repositorys.
- [`docs/`](docs/): Ansichten, Herkunft kopierter Dateien, sebaro-Lücken, die Messberichte.

```sh
pnpm install
pnpm dev        # App, Worker und Durable Object in einem Prozess: http://localhost:5173
pnpm checks     # alles, was die CI prüft (außer dem Audit)
```

Gebraucht werden Node 22, pnpm und Python 3.10.

Ein Geschwister von RetroBeam und FokusBeam, in der Gestaltung von sebaro. Lizenz: AGPL-3.0-or-later
([`LICENSE`](LICENSE)); die sebaro-Kopie ist MIT, ihre Schriften OFL-1.1, Zeichen und Icons des Produkts sind
vorbehalten ([`REUSE.toml`](REUSE.toml)).
