# Deploy recipe: an own server with Caddy

For a product that stays on a server of the owner: static files behind Caddy, copied there by a workflow. The
blueprint ([BLUEPRINT.md](BLUEPRINT.md)) still holds; this adds only what the host needs. No preview address per
pull request.

## Caddyfile

```
app.example.org {
	root * /srv/app
	encode zstd gzip
	# every address without a file gets the app: the routes are real paths
	try_files {path} /index.html
	header {
		Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'"
		Referrer-Policy "no-referrer"
		X-Content-Type-Options "nosniff"
	}
	header /assets/* Cache-Control "public, max-age=31536000, immutable"
	file_server
}
```

Keep the policy the same as the `<meta>` in `index.html`; a browser applies both. Caddy gets the certificate by
itself.

## Workflow

`.github/workflows/deploy.yml`, on a push to `main`, after the same install as in `ci.yml`. The repository secrets:
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY` (a private key that may only write `/srv/app`) and `DEPLOY_KNOWN_HOSTS`
(the server's line of `ssh-keyscan`).

```yaml
      - name: Build, refused while the imprint is the starter's placeholder
        run: pnpm release:check && pnpm build
      - name: Copy dist/ to the server
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
          DEPLOY_KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$DEPLOY_KEY" > ~/.ssh/deploy && chmod 600 ~/.ssh/deploy
          printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts
          rsync -az --delete -e "ssh -i ~/.ssh/deploy" dist/ "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}:/srv/app/"
```

## Privacy text

Name the server's provider as the host, and say how long Caddy's access log is kept.
