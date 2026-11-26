#!/bin/sh
# SPDX-FileCopyrightText: 2026 Sebastian Grundhöfer
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# production-deploy.sh: builds the app with its Worker from a committed state of `main` (or a tag) and puts both on
# Cloudflare as the product, the Worker `ideabeam` on its custom domain ideabeam.de (the top level of
# apps/worker/wrangler.jsonc; the preview is the environment `vorschau`, scripts/preview-deploy.sh).
#
#   CLOUDFLARE_ACCOUNT_ID=<account id> sh scripts/production-deploy.sh
#
# Nothing is deployed without the owner's word (AGENTS.md). Before the first run the owner has bought ideabeam.de and
# put its zone into the same Cloudflare account (the custom domain attaches only to a zone of that account), and set
# www.ideabeam.de to redirect to ideabeam.de in the zone (a redirect rule, as RetroBeam does: one origin, because
# every capability of the app lives in localStorage).
#
# It refuses, before anything is built or sent:
#   - while the tree has changes, tracked or untracked (what runs must be a commit, for the source link),
#   - while HEAD is neither the branch `main` checked out nor exactly at a tag,
#   - while the commit is in no branch of a remote this clone knows (the footer's source link would lead nowhere;
#     the link goes to REPO_URL, which must be the public repository that holds this commit),
#   - while `pnpm --filter @ideabeam/web release:check` fails: a legal fact in apps/web/src/content/operator.ts is a
#     placeholder. Today it refuses here, on purpose (PLAN.md, stage 5),
#   - after the build, when the built app's header rules are not apps/web/static/_headers byte for byte, when the
#     commit is not in the built app, or when the built Worker is not `ideabeam` with the route ideabeam.de.
# The script never writes apps/web/static/_headers or the built copy of it, and prints no token and no account id
# (wrangler's own output names the Worker's addresses).
#
# Afterwards: `node scripts/smoke.mjs https://ideabeam.de` (two browsers, one of the day's walls, deleted again).
set -eu
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID to the account the product lives in}"
cd "$(dirname "$0")/.."
refuse() {
  echo "production-deploy: refused: $1" >&2
  exit 1
}

[ -z "$(git status --porcelain)" ] || refuse "the tree has changes that are not committed"
commit=$(git rev-parse HEAD)
branch=$(git symbolic-ref --quiet --short HEAD || true)
tag=$(git tag --points-at HEAD | head -n 1)
if [ "$branch" != "main" ] && [ -z "$tag" ]; then
  refuse "HEAD is neither the branch main nor a tag (${branch:-detached})"
fi
[ -n "$(git branch -r --contains "$commit")" ] || refuse "commit $commit is in no remote branch: push it first"

pnpm --filter @ideabeam/web release:check || refuse "release:check failed (placeholders in src/content/operator.ts)"

cd apps/web
# the product: the top level of the config, never an environment
env -u CLOUDFLARE_ENV VITE_COMMIT_SHA="$commit" pnpm build

cmp -s static/_headers dist/client/_headers || refuse "the built header rules are not static/_headers"
grep -rqF "$commit" dist/client/assets || refuse "the commit is not in the built app (VITE_COMMIT_SHA)"
node -e 'const c = JSON.parse(require("fs").readFileSync("dist/ideabeam/wrangler.json", "utf8"));
  const domain = (c.routes ?? []).some((r) => r.pattern === "ideabeam.de" && r.custom_domain === true);
  if (c.name !== "ideabeam" || !domain || c.vars?.DAILY_NEURONS !== "8000") process.exit(1);' ||
  refuse "the built Worker is not ideabeam on ideabeam.de with 8,000 neurons"

echo "production-deploy: deploying ideabeam at $commit${tag:+ ($tag)}"
pnpm exec wrangler deploy
