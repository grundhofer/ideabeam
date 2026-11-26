# Recipe: the share image of the start page

For a product at a public address: one 1200 × 630 image and the `og:` tags of the start page. An app with one shell
needs no other; a private tool needs none. The copy's README (`src/sebaro/README.md`, section *Share images*) is the
reference; this is the short way for this starter.

1. Add the pack to the copy: `node src/sebaro/checks/update-copy.mjs --packs <the packs of the copy>,share-images`.
2. `og-pages.json` beside `package.json`, with the product's id, name and address:

   ```json
   {
     "$schema": "./src/sebaro/brand/og/pages.schema.json",
     "site": { "product": "<id>", "name": "<name>", "origin": "https://<host>" },
     "pages": [{ "id": "start", "url": "/", "type": "website", "title": "<name>" }]
   }
   ```

3. Draw it: `node src/sebaro/product/render.mjs share sebaro-product --pages og-pages.json --out public/og --head og-head`.
   Vite copies `public/` into `dist/`.
4. Paste the tags of `og-head/start.head.html` into the `<head>` of `index.html`. Commit `public/og/` and
   `og-pages.json`, not `og-head/`.

Run step 3 again when the name or the sign changes.
