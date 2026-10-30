# jun-hermes — OAuth verification site

Static site for Google OAuth app verification (brand + sensitive-scope review).

- `index.html` — application home page: what the app is, what it does, how Google user data is used.
- `privacy.html` — privacy policy (same domain as home page; discloses access/use/storage/sharing, Limited Use).
- `terms.html` — terms of service.
- `oauth2/callback.html` — OAuth redirect endpoint shown after consent.
- `healthz.json` — liveness endpoint.

## Google Cloud setup this site must line up with

| Console field | Value |
| --- | --- |
| App name | `jun-hermes` (must match the site's name everywhere) |
| Application home page | `https://jun-hermes.qqntt.com/` |
| Privacy policy | `https://jun-hermes.qqntt.com/privacy` |
| Terms of service | `https://jun-hermes.qqntt.com/terms` |
| Authorized domain | `qqntt.com`, verified in Search Console |
| Redirect URI | `https://jun-hermes.qqntt.com/oauth2/callback` (plus the desktop `http://localhost` loopback) |

## Custom domain

Add a `CNAME` file containing the domain, enable HTTPS in the repo's Pages settings, then point
DNS (`CNAME <user>.github.io` for a subdomain, A/AAAA records for the apex).

## Local preview

```bash
bun run build                     # checks the vendored theme, then copies 13 files into dist/
(cd dist && python3 -m http.server 4398)
```

`bun run probe` does the same check without a browser: it serves `dist/` on port 4398 and asks
each registered URL for a 200, a bigface/dark root element and the Bigface tokens.

## Theme

The site is a static shell for the Bigface theme — no Tailwind, no build step, no JavaScript.
Every page says so on its root element:

```html
<html lang="en" data-theme="bigface" data-mode="dark">
```

- `assets/bigface.css` is **vendored**: a byte-for-byte copy of the theme package's generated
  output (`packages/bigface-shadcn-ui/src/themes/bigface.css`). Never edit it here. Change the
  theme in its own package, then copy it again:

  ```bash
  cp packages/bigface-shadcn-ui/src/themes/bigface.css apps/jun-hermes/assets/bigface.css
  ```

- `assets/style.css` is this site's own stylesheet and holds no colours: every value reads a
  `var(--theme-*)` token. `assets/logo.svg` is drawn from the same palette values.

`bun run tokens:check` proves the copy is current, that no colour is hand-written, that all six
pages declare the theme, and that the site still ships exactly one script (the OAuth callback's
own). `bun run build` runs that check first, so a deploy cannot ship stale tokens.
