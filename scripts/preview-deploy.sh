#!/bin/sh
# SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# preview-deploy.sh: builds the app with its Worker and puts both on Cloudflare as `ideabeam-vorschau`, at that
# Worker's workers.dev address: a preview for trying the product on other devices while it is being built. It is not
# the product's deployment (that is scripts/production-deploy.sh, the Worker `ideabeam` on ideabeam.de).
#
#   CLOUDFLARE_ACCOUNT_ID=<account id> sh scripts/preview-deploy.sh
#
# The preview is the environment `vorschau` of apps/worker/wrangler.jsonc: the build reads it from CLOUDFLARE_ENV
# (the Vite plugin writes the resolved config into dist/, and `wrangler deploy` takes that). It has no route, its own
# Durable Objects, and a budget of its own (1,000 neurons, the owner's decision 27). A deploy with `--name` alone
# would now take the product's settings, its domain included: do not go back to it.
#
# The footer's source link names the commit that was built (VITE_COMMIT_SHA, src/lib/source.ts). The preview may be
# deployed from a tree with changes that are not committed; then the link names the commit they stand on, and the
# script says so.
#
# The whole preview answers `X-Robots-Tag: noindex`: the pages through the header rules the build ships
# (apps/web/static/_headers names every workers.dev address), the API through the Worker. The address is not written
# into this repository: the account's workers.dev subdomain is personal.
#
# After FokusBeam's script of the same name (docs/HERKUNFT.md).
set -eu
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID to the account the product lives in}"
cd "$(dirname "$0")/../apps/web"
VITE_COMMIT_SHA=$(git rev-parse HEAD)
export VITE_COMMIT_SHA
if [ -n "$(git status --porcelain)" ]; then
  echo "preview-deploy: the tree has changes that are not committed; the source link names $VITE_COMMIT_SHA" >&2
fi
CLOUDFLARE_ENV=vorschau pnpm build
# what wrangler is about to deploy is the preview, without a route
node -e 'const c = JSON.parse(require("fs").readFileSync("dist/ideabeam/wrangler.json", "utf8"));
  if (c.name !== "ideabeam-vorschau" || (c.routes ?? []).length) { console.error("preview-deploy: the build is not the preview"); process.exit(1); }'
pnpm exec wrangler deploy
