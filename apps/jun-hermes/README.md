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
python3 -m http.server 8080
```
