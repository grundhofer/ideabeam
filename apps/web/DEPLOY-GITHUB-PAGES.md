# Deploy recipe: GitHub Pages

For a product whose repository may be public, or whose plan has Pages for private repositories. The site itself is
always public. The blueprint ([BLUEPRINT.md](BLUEPRINT.md)) still holds; this adds only what the host needs.

What it cannot do: no preview address per pull request, no response headers (the Content-Security-Policy stays the
`<meta>` of `index.html`), and an address without a file is answered with status 404 (the app shows all the same).

## Address

The app needs the root of a domain: a custom domain (Settings › Pages), or the repository `<account>.github.io`. It
does not run under `/<repository>/`.

## Workflow

Settings › Pages › Source: „GitHub Actions“. Then `.github/workflows/deploy.yml`, with every action pinned by commit
as in `ci.yml`:

```yaml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.pages.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # refused while the imprint is the starter's placeholder
      - run: pnpm release:check
      - run: pnpm build
      # every address without a file gets the app: the routes are real paths
      - run: cp dist/index.html dist/404.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: pages
        uses: actions/deploy-pages@v4
```

`ci` stays the gate: protect `main` so that only a green pull request reaches it.

## Privacy text

Name GitHub (Microsoft) as the host: it sees the IP address of every request.
