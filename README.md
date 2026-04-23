# The Insight News — Frontend

Headless Next.js (App Router) frontend for `theinsightnews.co`, sitting in front of a WordPress backend on `cms.theinsightnews.co`. Deployed to Cloudflare Workers via `@opennextjs/cloudflare`.

---

## Architecture

```
 ┌──────────────────────────────┐        ┌─────────────────────────────┐
 │  www.theinsightnews.co       │  ISR   │  cms.theinsightnews.co      │
 │  Next.js on Cloudflare       │ ─────▶ │  WordPress (REST API)       │
 │  Workers (this repo)         │        │                             │
 │                              │        │  + tin-cdn-rewrite plugin   │
 │  ISR cache → Workers KV      │        └─────────────────────────────┘
 │  Edge cache → Cloudflare CDN │
 └──────────────────────────────┘        ┌─────────────────────────────┐
                                         │  files.theinsightnews.co    │
                                 assets  │  /wp-content/uploads/*      │
                                  ────▶  │  (Cloudflare origin rule →  │
                                         │   cms origin)               │
                                         └─────────────────────────────┘
```

Three hosts, one WP install:
- `www.theinsightnews.co` — public site (served by this Worker)
- `cms.theinsightnews.co` — WP admin + REST API (`WP_SITEURL`)
- `files.theinsightnews.co` — CDN subdomain for `/wp-content/uploads/*`

---

## First-time setup

### 1. Dependencies

```bash
pnpm install
npx wrangler login
```

### 2. WordPress side

In `wp-config.php`:

```php
define('WP_SITEURL', 'https://cms.theinsightnews.co');  // admin + REST
define('WP_HOME',    'https://www.theinsightnews.co');  // frontend
```

Install the helper plugin:
1. Copy [wordpress-plugin/tin-cdn-rewrite.php](wordpress-plugin/tin-cdn-rewrite.php) to `wp-content/plugins/` on the WP server.
2. WP Admin → Plugins → activate **"The Insight News — Headless Helpers"**.
3. Settings → Insight Headless → paste the revalidate secret (see step 4 below).

### 3. DNS (Cloudflare dashboard)

| Name   | Type  | Target                       | Proxy    |
|--------|-------|------------------------------|----------|
| `cms`  | A/CNAME | WP origin host             | Proxied  |
| `files`| CNAME | `cms.theinsightnews.co`      | Proxied  |

Then add a **Cloudflare Origin Rule** for `files.theinsightnews.co`:
- If `hostname = files.theinsightnews.co` → Rewrite Host Header → `cms.theinsightnews.co`

### 4. KV namespace for ISR cache

Create a dedicated namespace (don't share with other sites — keys will collide):

```bash
npx wrangler kv namespace create tin-fe-isr
npx wrangler kv namespace create tin-fe-isr --preview
```

Paste the returned `id` / `preview_id` into the `kv_namespaces` entry in [wrangler.jsonc](wrangler.jsonc). The `binding` must stay `NEXT_INC_CACHE_KV` (OpenNext looks for this exact name).

### 5. Worker secrets

Set each secret via `wrangler secret put <NAME>` — you'll be prompted to paste the value.

| Secret                      | Required | What it does |
|-----------------------------|----------|--------------|
| `REVALIDATE_SECRET`         | **yes**  | Shared secret for `POST /api/revalidate`. Must match the value you paste into the WP plugin settings. Generate with `openssl rand -hex 32`. |
| `CLOUDFLARE_ZONE_ID`        | optional | Zone ID of `theinsightnews.co`. Needed to purge the Cloudflare edge cache when `/api/revalidate` is called. Find it: Cloudflare dashboard → domain → Overview (right sidebar). |
| `CLOUDFLARE_PURGE_TOKEN`    | optional | API token with `Zone → Cache Purge → Purge` permission scoped to this zone. Create at: My Profile → API Tokens → Create Token → Custom token. |
| `PURGE_BASE_URL`            | optional | Base URL used when purging Cloudflare cache. Defaults to `SITE.url` in [lib/site.js](lib/site.js). Set this if the public host differs (e.g. `https://www.theinsightnews.co` while `SITE.url` is apex). |

Without the Cloudflare secrets the revalidate endpoint still works — it just skips the CF purge step (KV is still cleared).

### 6. Custom domain

After the first successful `pnpm deploy`:
1. Cloudflare dashboard → Workers & Pages → `theinsightnews-fe` → Settings → Domains & Routes → Add Custom Domain.
2. Add `www.theinsightnews.co` (and/or apex `theinsightnews.co`).
3. Cloudflare creates the DNS record automatically if the zone is managed here.

⚠️ Before cutover, make sure WP is fully accessible at `cms.theinsightnews.co` and the admin/REST API work there — once you point `www.` at the Worker, the old WP frontend on `www.` is gone.

---

## Day-to-day

```bash
pnpm dev          # Next.js dev server (port 3000). No bindings.
pnpm preview      # Build with OpenNext + run in workerd locally with bindings.
pnpm deploy       # Build + publish to Cloudflare Workers.
pnpm cf-typegen   # Regenerate Cloudflare env types to cloudflare-env.d.ts.
```

### Clearing cache

**Auto** — the WP plugin fires `POST /api/revalidate` on every post save, invalidating:
- `/` (homepage)
- `/<slug>` (the post)
- `/category/<slug>` for every category the post is in (layout-type, covers pagination)
- `/tag/<slug>` for every tag (layout-type, covers pagination)

Plus, if CF secrets are configured, the same URLs are purged from Cloudflare's edge cache.

**Manual (per post)** — click the "Clear cache" button in the Publish metabox on any post edit screen.

**Manual (arbitrary paths)** — POST directly:

```bash
curl -X POST https://www.theinsightnews.co/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"paths":["/","/about"],"layoutPaths":["/category/politics"]}'
```

**Nuclear — wipe all of KV:**

```bash
# list keys, bulk delete
npx wrangler kv key list \
  --namespace-id <id-from-wrangler.jsonc> \
  --remote | jq '[.[].name]' > keys.json

npx wrangler kv bulk delete \
  --namespace-id <id> \
  --remote keys.json
```

---

## Image sizing

We deploy without Cloudflare Images, so the browser fetches original WP-served images directly. To save bandwidth, components request the appropriate WP-generated size via `pickImage(post, size)` in [lib/api.js](lib/api.js):

| Component                          | WP size        |
|------------------------------------|----------------|
| HeroSlider, HeroCard, DarkFeature  | `large`        |
| NewsCard (md default) / MagCard    | `medium_large` |
| NewsCard (sm)                      | `medium`       |
| RowCard (sidebar), DarkRow         | `thumbnail`    |
| Single post hero                   | `full`         |

`pickImage` falls back through neighbouring sizes if the exact one isn't present.

---

## Analytics & cookies

- Google Analytics ID is set in `SITE.gaId` in [lib/site.js](lib/site.js). Only loads when `NODE_ENV === 'production'`.
- Cookie default is **opt-out**: analytics is on by default. If the user opens the cookie panel and toggles Analytics off, `window['ga-disable-<id>']` is flipped and the scripts unmount.

---

## Legacy URLs

- `/post/<slug>` → `/<slug>` (permanent redirect in [next.config.mjs](next.config.mjs)).
- Changed WP slugs → resolved via `resolveOldSlug()` in [lib/api.js](lib/api.js), which piggybacks on WP's built-in `wp_old_slug_redirect`. No DB lookup required.

---

## Troubleshooting

| Symptom                                              | Check |
|------------------------------------------------------|-------|
| Post edits don't show up on FE                       | Did the plugin fire? Check WP Site Health / `error_log` for `tin_revalidate_paths` errors. Is `REVALIDATE_SECRET` the same on both sides? |
| Clear-cache button returns 401                       | Secret in WP Settings → Insight Headless doesn't match the Worker secret. |
| Images 404 / load from `cms.` instead of `files.`    | Plugin deactivated? Check the CDN origin rule on Cloudflare. |
| `pnpm preview` fails with KV binding error           | Missing `preview_id` in `wrangler.jsonc`. Create with `wrangler kv namespace create tin-fe-isr --preview`. |
| Deploy says "binding NEXT_INC_CACHE_KV not found"    | `binding` name in `wrangler.jsonc` must be exactly `NEXT_INC_CACHE_KV` — OpenNext reads this specific name. |
| Cloudflare purge silently skipped                    | `CLOUDFLARE_ZONE_ID` + `CLOUDFLARE_PURGE_TOKEN` not set, or `PURGE_BASE_URL` mismatches the cached host. |

---

## Files worth knowing

- [wrangler.jsonc](wrangler.jsonc) — Worker config, KV binding, routes
- [open-next.config.ts](open-next.config.ts) — OpenNext adapter config (ISR cache driver)
- [next.config.mjs](next.config.mjs) — images, redirects, dev proxy for bindings
- [lib/api.js](lib/api.js) — all WP fetch + data normalization + `pickImage` + `resolveOldSlug`
- [lib/site.js](lib/site.js) — canonical site config (name, URL, GA ID, OG image)
- [app/api/revalidate/route.js](app/api/revalidate/route.js) — on-demand cache flush (KV + Cloudflare edge)
- [wordpress-plugin/tin-cdn-rewrite.php](wordpress-plugin/tin-cdn-rewrite.php) — WP plugin: CDN rewrite + auto-revalidate + manual clear + frontend-aware admin links
