# Deploy recipe: Cloudflare Pages

For a product that wants a preview address per pull request and its policy as a response header, also from a
private repository. The blueprint ([BLUEPRINT.md](BLUEPRINT.md)) still holds; this adds only what the host needs.

## Project

Create a Pages project from the repository (Workers & Pages › Create › Pages › Connect to Git):

- build command `pnpm release:check && pnpm build`, output directory `dist`, environment variable `NODE_VERSION` =
  `22`. `release:check` refuses the build, also of a preview, while the imprint is the starter's placeholder;
- production branch `main`. Every other branch and pull request gets its own preview address by itself.

The build needs nothing but Node: `src/sebaro/` and `sebaro-product/` are in the repository. A path without a file
is answered with `index.html` as long as `dist/` holds no `404.html`.

## Headers

Vite copies `public/` into `dist/` as it is. `public/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

Keep the policy the same as the `<meta>` in `index.html`; a browser applies both. `frame-ancestors` works only as a
header.

## Keep off

Cloudflare Web Analytics and every other feature that adds a script to the page: the policy would block it, and the
app loads nothing from other servers.

## Privacy text

Name Cloudflare as the host: it sees the IP address of every request.
