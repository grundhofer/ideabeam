# IdeaBeam: die Web-App

Die App im Browser, gewachsen aus der sebaro-Startvorlage `webapp-vite` 3.0.2. Wie sie gebaut ist, steht im Bauplan
[`BLUEPRINT.md`](BLUEPRINT.md); was am Starter geändert wurde, in [`docs/HERKUNFT.md`](../../docs/HERKUNFT.md). Befehle
und Regeln des ganzen Repositorys: [`AGENTS.md`](../../AGENTS.md).

Anders als im Bauplan hat diese App einen eigenen Server (Entscheidung des Inhabers,
[`docs/sebaro-luecken.md`](../../docs/sebaro-luecken.md)): Das Cloudflare-Plugin in `vite.config.ts` fährt den Worker
aus `../worker` mit, in `pnpm dev`, im Build und in `pnpm preview`.

## Befehle

Aus diesem Ordner, oder von der Wurzel mit `pnpm --filter @ideabeam/web <Befehl>`:

```sh
pnpm dev              # http://localhost:5173, mit Worker und Durable Object im echten workerd
pnpm checks           # Lint, Format, Typen, Kopie, Tests, Build, Playwright
pnpm test             # Vitest (jsdom, ohne Worker)
pnpm build            # dist/client (die App) und dist/ideabeam (der Worker); scheitert über einem Größenbudget
pnpm test:e2e         # Playwright gegen den Build, der Worker läuft mit; mit CI=1 bricht ein belegter Port 4173 den Lauf ab
pnpm format           # Prettier schreibt
pnpm sebaro:build     # nach jeder Änderung an sebaro.product.json
```

## Aufbau

`src/pages/` hält je Route eine Ansicht, `src/components/` den Rahmen, `src/lib/` die Regeln der App, `src/store/`
den Zustand, `src/i18n/` die Wörter, `tests/` die Playwright-Tests. `src/sebaro/` ist die sebaro-Kopie (nie ändern,
ihre README erklärt Bauteile und Prüfungen), `sebaro-product/` schreibt ihr Baukasten. Die Ansichten und ihr Stand
stehen in [`docs/ANSICHTEN.md`](../../docs/ANSICHTEN.md).

Was eine Wand ist und was auf ihr gilt, steht in `packages/shared` und kommt von dort: das Protokoll, die Grenzen
von Frage und Name, der Reducer, der aus den Nachrichten des Workers die Wand im Browser macht. In der App liegen:

- `src/lib/api.ts`, `src/lib/socket.ts`: die zwei Anfragen an den Worker und der Socket einer Wand.
- `src/lib/links.ts`: der Link einer Wand und der Moderationslink. Das Admin-Token steht nur hinter `#`; die App
  nimmt es beim Öffnen aus der Adresse und legt es in den Speicher des Browsers.
- `src/store/walls.ts`: was der Browser über Wände behält (`localStorage`): Adresse, Frage, Name, Sitzungsschlüssel
  und die Admin-Tokens. `src/store/wall.ts`: die Wand, auf der dieser Tab gerade ist; nichts davon wird gespeichert.
  Eine Änderung an Zetteln gilt dort sofort (`send`) und geht an die Wand; lehnt die Wand ab, ist sie zurückgenommen
  und der Grund steht in `rejected`.
- `src/components/Surface.tsx`: die Fläche mit den Zetteln. Ihre Rechnung (Ansicht, Zoom um einen Punkt, „Alles
  zeigen“, nächster Zettel in einer Richtung, freier Platz) steht als reine Funktionen in `src/lib/surface/`.
  Verschieben und Zoomen schreiben eine CSS-Transformation und rendern nichts.
- `src/lib/guide.ts`: der Satz unter dem Stand der Wand, was jetzt zu tun ist, je Rolle.

## Was noch aus der Vorlage ist

- **Impressum und Datenschutz:** Platzhalter unter `legal` in `src/i18n/`. Solange `legal.imprintBody` die
  Beispieladresse enthält, scheitert `pnpm release:check`, mit Absicht.
- **`DEPLOY-*.md`, `SHARE-IMAGE.md`:** Rezepte des Starters für eine App ohne Server. Sie gelten hier nicht
  ([`AGENTS.md`](../../AGENTS.md)).
- **Kopie aktualisieren:** `node src/sebaro/checks/update-copy.mjs` (lokal reicht `gh auth login`), als eigener
  Commit. Die CI fragt einmal in der Woche nach einer neueren Kopie und braucht dafür das Repository-Secret
  `SEBARO_FOUNDRY_TOKEN`.
- **[`CHECKS.md`](CHECKS.md):** was nicht geprüft ist.
