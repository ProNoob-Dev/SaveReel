# SaveReel

<p align="center">
  <a href="https://workers.cloudflare.com"><img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Hono" src="https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg">
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/savereel"><img alt="Deploy to Cloudflare Workers" src="https://deploy.workers.cloudflare.com/button"></a>
</p>

<p align="center">
  🟢 <strong><a href="https://savereel.genuinetv.workers.dev">Live demo — https://savereel.genuinetv.workers.dev</a></strong>
</p>

> **Run your own Instagram downloader — free, self-hosted, and private.**
> One Cloudflare Worker. No database. No API keys. No vendor accounts.
> Deploy in a single command on Cloudflare's free tier.

## Why people star this

- 🔒 **Private & self-hosted** — your links never pass through a third-party service
- 🆓 **Free to run** — sits on Cloudflare's free tier; no server to manage, no bill
- 🔑 **Zero API keys** — a key-free resolution chain ported from open-source extractors
- ⚡ **One Worker, one deploy** — server-rendered HTML *and* a JSON API in a single bundle
- 🎥 **Every format** — reels, video, photos, stories, highlights, IGTV, avatar, audio
- 🔐 **Safe media proxy** — HMAC-signed, host-checked `/api/dl` downloads; no open proxy
- 🌍 **i18n by design** — routes, hreflang and sitemap scale to new languages automatically

An Instagram media downloader built as a **single Cloudflare Worker**. No database,
no container, no build step beyond Wrangler's own bundling. Server-rendered HTML,
one CSS file, ~300 lines of vanilla JS, and **no third-party API keys** — every
resolution strategy is ported from a maintained open-source extractor.

This is a from-scratch rebuild of the pattern used by `saveinta.com`; the recon
that shaped it is at the bottom.

```bash
npm install
cp .dev.vars.example .dev.vars      # optional, for secrets
npx wrangler dev                    # http://localhost:8787
npx wrangler deploy
```

---

## What it does

| Route | What it returns |
| --- | --- |
| `GET /` | 302 to your `Accept-Language` match, else `/en` |
| `GET /:locale/` | 301 to the canonical path without the trailing slash |
| `GET /EN` or `/FR/...` | 301 to the lowercase form |
| `GET /fr` (known but not shipped) | 302 to the English equivalent; POST returns 303 |
| `GET /:locale` | Home: hero, search, 8 tool cards, how-it-works, FAQ |
| `POST /:locale` | Same page with results rendered server-side (works without JS) |
| `GET /:locale/:tool` | Per-tool landing page with its own copy, steps and FAQ |
| `GET /:locale/:static` | `help`, `about-us`, `terms-of-service`, `privacy-policy`, `contact` |
| `POST /api/search` | `{ ok, result }` — the JSON the client JS uses |
| `GET /api/resolve?q=` | Same, as a GET; add `&fresh=1` to bypass the cache |
| `GET /api/dl?u=&e=&n=&s=` | Signed, host-checked media proxy with `Content-Disposition: attachment` |
| `GET /api/health` | Which providers and secrets are live on this deployment |
| `GET\|POST /api/v1/resolve?url=` | **Public JSON API.** Stable shape, CORS open, no key. The thing to hand to someone else. |
| `GET /api/v1/stats` | Public aggregate counters: downloads, bytes, resolves, page views |
| `GET /stats` | Human version of those counters |
| `GET /api` | HTML reference for that API |
| `GET /openapi.json` | OpenAPI 3.1 spec for the v1 endpoints |
| `GET /sitemap.xml` | Generated from the route table × enabled locales |
| `GET /manifest.webmanifest` | PWA install, no store listing |

Tools: video, photo, reels, story, IGTV, avatar, audio, private.

## Architecture

```
src/
  index.tsx             app wiring, security headers
  config.ts             brand, locales, tool copy, bindings
  routes/
    api.ts              /api/search, /api/resolve, /api/dl, /api/health
    pages.tsx           locale routing, SSR, POST fallback
    assets.ts           css, js, favicon, og, robots, sitemap, manifest
  lib/
    resolver.ts         the provider chain (the actual work)
    ig-parse.ts         pure parsers for every payload shape
    url.ts              link parsing, shortcode → media id, CDN allowlist
    sign.ts             HMAC-signed download links, 30 min TTL
    present.ts          resolver output → signed download cards
    guard.ts            rate limit (memory + optional KV), Turnstile
    seo.ts              sitemap + robots
    stats.ts            D1 counters, read/readStatsCached, track
    format.ts           shared number/date formatting for the ledger
  views/                layout, components, pages, artwork (hono/jsx)
  assets/               CSS, client JS and base64 fonts as String.raw modules
  i18n/                 en.ts + lookup that falls back to English
```

Everything is rendered by the Worker. There is no `public/` directory and no
assets binding: `/css/app.css` and `/js/app.js` are served from the bundle, so a
deploy is one command and nothing can drift between "code" and "static files".

Both are referenced with a content fingerprint (`/css/app.css?v=xa99az`) and
served `immutable`, because a redesign otherwise pairs new markup with a
stylesheet the browser cached an hour ago — the classic "everything looks
broken until a hard refresh". Every HTML response is `no-store` for the same
reason: the page always embeds the fingerprint of the code that produced it.

### The resolver chain

Instagram's CDN URLs are not derivable from a shortcode, and Workers cannot run
`yt-dlp`. So `src/lib/resolver.ts` tries five key-free strategies, cheapest first,
and remembers what failed. Nothing here needs an API key or an account.

| # | Provider | Mechanism | Credit |
| --- | --- | --- | --- |
| 1 | `embed` | Reads `contextJSON` out of `/{p\|reel\|tv}/{code}/embed/captioned/` and walks `gql_data.shortcode_media` | yt-dlp `InstagramIE._real_extract` |
| 2 | `page` | Parses the post page's `<script data-sjs>` islands for `xig_polaris_media.if_not_gated_logged_out` | yt-dlp's logged-out fallback |
| 3 | `rest` | `GET /api/v1/media/{pk}/info/`, with a **self-minted** `csrftoken` and `x-ig-www-claim: 0` | gallery-dl `InstagramRestAPI._call` |
| 4 | `graphql` | Bootstraps `lsd` + `csrftoken` from the homepage, then `POST /api/graphql` with `doc_id=27130156389949648` | yt-dlp `_real_initialize` |
| 5 | `session` | `i.instagram.com/api/v1/...` with an optional `IG_SESSIONID` secret. The only path to stories, highlights and private accounts the session follows | yt-dlp / instaloader |

All five normalise into the same shape, because Instagram reuses it: the embed's
`shortcode_media` and the product media returned by GraphQL/REST both carry
`video_versions[]`, `image_versions2.candidates[]` or `display_resources[]`.
`src/lib/ig-parse.ts` handles both spellings (`config_width` vs `width`, legacy
`edge_sidecar_to_children`), picks the largest encode, and emits one card per
distinct video resolution.

Two details make it work in practice:

- **Escaping.** The embed nests JSON inside JSON, so `contextJSON` has to be
  unescaped twice before `JSON.parse`, and CDN URLs can still arrive with `\`
  and `%3D` fragments. `cleanUrl()` strips them; without that the signed proxy
  receives a broken URL and Instagram answers 400.
- **Partial results are not success.** A `reel` link that yields only a
  thumbnail is parked and the chain keeps going. `DMA-mIagjDA`, a
  copyright-blocked reel where the embed exposes no video at all, resolves to a
  real 343 KB MP4 through the `page` provider instead.

Media items are filtered against the CDN allowlist (`*.cdninstagram.com`,
`*.fbcdn.net`, `*.instagram.com`) before they are signed, so a compromised or
spoofed upstream cannot turn `/api/dl` into an open proxy.

### Why the download goes through `/api/dl`

Instagram's CDN serves `video/mp4` inline. On iOS that plays a video instead of
saving it. `/api/dl` re-serves the file with `Content-Disposition: attachment`,
so Safari writes it to Files. It also:

- verifies an HMAC over `(target, expiry)` — it is not an open proxy
- allowlists only Instagram CDN hosts
- forwards `Range` so seeking and resumable downloads work
- passes `cf: { cacheEverything: true }` so repeat downloads hit the edge

### Public API

`/api` is the human reference, `/openapi.json` the machine one. One versioned
endpoint, CORS open, no key:

```bash
curl "https://YOUR-DOMAIN/api/v1/resolve?url=https://www.instagram.com/reel/DNA7Vi9IZWS/"
curl -X POST "https://YOUR-DOMAIN/api/v1/resolve" \
  -H "content-type: application/json" \
  -d '{"url":"https://www.instagram.com/p/C2VFqJMtui4/"}'
```

```jsonc
{
  "ok": true,
  "api": "1",
  "data": {
    "kind": "media",            // media | story | highlight | profile
    "type": "video",            // video | image | carousel | mixed
    "shortcode": "DNA7Vi9IZWS",
    "provider": "embed",        // which strategy won
    "author": { "username": "…", "full_name": null, "avatar": "https://…" },
    "caption": "…",
    "warnings": [],
    "media": [
      {
        "type": "video",
        "label": "Video",
        "quality": "1080x1920 HD",
        "width": 1080, "height": 1920,
        "filename": "SaveReel-uscurrencygov-Video.mp4",
        "download": "https://…/api/dl?u=…&e=…&n=…&s=…",  // signed, attachment
        "thumbnail": "https://…",
        "source": "https://…cdninstagram.com/…mp4"        // raw, expires
      }
    ],
    "count": 1,
    "expires_at": "…",
    "fetched_at": "…"
  },
  "meta": { "request_id": "…", "provider": "embed", "took_ms": 1168, "rate_limit": { } }
}
```

Errors keep the same envelope — `{ ok: false, error: { code, message, hint }, meta: { status } }`
— with `400 invalid_url`, `401 login_required`, `403 private`, `404 not_found`,
`422 unsupported`, `429 rate_limited`, `502 upstream_error`.

30 requests / 10 min / IP, `x-ratelimit-*` headers on every response, signed
links valid 30 min, `?fresh=1` bypasses the 10 minute resolve cache. The
unversioned `/api/resolve` and `/api/search` are the site's own endpoints; the
v1 contract is the only one that promises not to change.

### Public counters

`/stats` and `/api/v1/stats` publish, for the whole deployment:

- **files downloaded** — counted when `/api/dl` actually serves a body, split video/image
- **bytes served** — the `content-length` of each served file
- **links resolved** — successful resolutions, from the site or the API
- **page views** and **API calls**

Storage is D1 (`migrations/0001_counters.sql`), one row per `(scope, metric)`
where scope is `total` or a UTC day. Increments are atomic
(`value = value + excluded.value`), so the numbers are exact rather than
approximate. Writes go through `waitUntil`, so counting never delays a response
and a stats failure can never break a resolve.

What is **not** stored: IPs, user agents, links, referrers, or any per-visitor
row. The public page only renders what `/api/v1/stats` already returns.

The home page carries the same ledger beside the search box, so the numbers are
visible without visiting `/stats`. That one page is rendered `no-store` and read
through `readStatsCached` (one D1 read per isolate per minute); a small script
repaints the figures from `/api/v1/stats` every 60 seconds without reloading.
Every other page is still edge-cached.

### Design and assets

The visual system is printed matter rather than SaaS: warm paper, black ink, one
vermilion accent, hairline rules, hard offset shadows, no gradients or glass.

- **Type**: Instrument Serif (display), Newsreader (body), Space Mono (labels and
  numbers). All three are self-hosted as latin-subset WOFF2 in
  `src/assets/fonts.ts` (base64), served from `/fonts/*` with immutable caching.
  No font CDN sits in the critical path or the privacy story. Licences: SIL OFL 1.1.
- **Artwork**: `src/views/artwork.tsx` draws the mark, the eight tool icons, the
  fleuron and the registration marks as inline SVG. There is no stock photography,
  borrowed icon set or remote image request anywhere in the interface.
- **Texture**: the paper grain is a generated `feTurbulence` SVG data URI in the
  stylesheet, a few hundred bytes with no extra request.
- **OG card and favicon** are generated SVG in `src/routes/assets.ts`, so they
  follow `BRAND_NAME` instead of shipping a static brand image.

### What the parsers actually return

Measured through this Worker on 2026-10-26:

| Link | Before (regex scrape) | After (structured) |
| --- | --- | --- |
| `p/C2VFqJMtui4` | 1 image, 224 KB | **5 slides**, each 1440×1440 at full size |
| `reel/DNA7Vi9IZWS` | MP4, no dimensions | MP4, **1080×1920, HD, 37 s** |
| `reel/DdkLuM4HymN` | 2 videos + a duplicate thumbnail | 2 videos, correctly labelled `Slide 1`/`Slide 2` |
| `reel/DMA-mIagjDA` | thumbnail only, "not exposed" warning | **343 KB MP4 via the `page` provider** |

Author avatar now comes from `owner.profile_pic_url` and is shown next to the
byline.

### Abuse control

- 20 searches / 10 min / IP. In-memory per isolate; add a `RATE_LIMIT` KV binding
  for cross-isolate counting (see `wrangler.jsonc`).
- Turnstile enforced only when `TURNSTILE_SECRET` is set, so local dev needs no keys.
- CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, `Permissions-Policy` on every response.

## Configuration

| Var / secret | Required | Effect |
| --- | --- | --- |
| `BRAND_NAME` | no | Site name. Defaults to `SaveReel`. |
| `PUBLIC_ORIGIN` | yes in prod | Canonical URLs, sitemap, OG tags, and the base of signed links. Overrides the request origin, so set it to `https://your.domain`. |
| `SIGNING_KEY` | yes in prod | HMAC key for download links. 32+ random bytes. Rotating invalidates live links. |
| `IG_SESSIONID` | no | Enables stories, highlights, private accounts, and profile/avatar lookups from datacenter IPs. Use a throwaway account. |
| `IG_USER_AGENT` | no | Mobile UA override if the session starts getting 401s. |
| `TURNSTILE_SECRET` | no | Turns on Turnstile for `/api/search`. |
| `RATE_LIMIT` (KV) | no | Cross-isolate rate limiting. |
| `STATS` (D1) | yes | Aggregate counters for `/stats` and `/api/v1/stats`. Without it both report `available: false`. |

```bash
npx wrangler secret put SIGNING_KEY
npx wrangler secret put IG_SESSIONID    # optional
```

There is no `RAPIDAPI_KEY` and no vendor account to create. If you later add a
paid resolver, put it behind an env var *and* keep it last — the chain already
degrades gracefully.

## Deploy runbook

```bash
npx wrangler login
npx wrangler d1 create savereel-stats       # once; copy database_id into wrangler.jsonc
npx wrangler d1 execute savereel-stats --remote --file=migrations/0001_counters.sql
npx wrangler secret put SIGNING_KEY         # openssl rand -base64 32
npx wrangler deploy
```

`PUBLIC_ORIGIN` is unset on purpose: `origin()` falls back to the request origin, so
the Worker is already correct on `*.workers.dev` and on any custom domain, with no
rebuild. Set it only if the canonical host must differ from the host serving traffic.

Custom domain: add to `wrangler.jsonc`

```jsonc
"routes": [{ "pattern": "your.domain", "custom_domain": true }]
```

Then verify:

```bash
curl https://your.domain/api/health
curl "https://your.domain/api/resolve?fresh=1&q=https://www.instagram.com/p/<code>/"
```

## Known limits (read before shipping)

- **Cloudflare's egress is a datacenter IP, and Instagram knows it.** The HTML
  routes (`embed`, `page`) work from Workers; the JSON APIs (`rest`, `graphql`)
  are refused with `login_required`, an HTML shell, or
  `{"message":"Please wait a few minutes before you try again."}`. That is why
  the chain starts with HTML. Measured directly:

  | Probe | Result from this machine / Worker egress |
  | --- | --- |
  | `/{p\|reel}/{code}/embed/captioned/` | 200, real payload (via Worker) |
  | `/{code}/` post page `data-sjs` | 200, real `xig_polaris_media` (via Worker) |
  | `/api/v1/media/{pk}/info/` | 403 `login_required` on `i.`/`b.i.`, HTML shell on `www` |
  | `POST /api/graphql` (`lsd` + csrf) | 200, but an HTML shell instead of JSON |
  | `/api/v1/users/web_profile_info/` | 401 `{"message":"Please wait a few minutes…"}` |
  | `?__a=1&__d=dis` | 201 with an empty body, or a 404 login page |
  | `/username/embed/` | 503 KB login shell, never an avatar |

- **Profile pictures therefore need `IG_SESSIONID`.** The `web-info` and `page`
  providers are implemented correctly and work from a residential IP, but a
  bare `@username` cannot be turned into an avatar from a datacenter without a
  session. Post links still show the author's avatar, because it rides along in
  the embed.
- **Stories, highlights and private accounts need `IG_SESSIONID`.** Instagram's
  rule, enforced before any code of ours runs.
- **TLS fingerprinting matters.** The same embed URL returned a login shell to
  Node's `fetch` and a full payload to `workerd` within a minute of each other.
  Hand-rolled header sets are not a substitute for a real browser fingerprint.
- **Audio is extracted client-side** (Web Audio → WAV) because Workers have no
  transcoder. Safari and Chrome handle AAC-in-MP4; Firefox may refuse the decode,
  in which case the UI says to download the video instead. No MP3 — that needs a
  licensed encoder.
- **OG image is SVG.** Facebook and Twitter do not render SVG previews. Swap
  `/og.svg` for a PNG before you care about social cards.
- **Cache is per-colo** (`caches.default`, 10 min). Two regions may resolve the
  same link twice.

## Reverse-engineering notes

### Open-source extractors read (`/re/igsrc`)

Files pulled from GitHub `master` on 2026-10-26 and read for mechanism, not copied:

- `yt-dlp/yt_dlp/extractor/instagram.py` — `_real_initialize` gets `lsd` from
  `<script id="__eqmc">` (`{"l": "..."}`) and falls back to the
  `["LSD",[],{"token":"..."}]` array; `_real_extract` posts to
  `https://www.instagram.com/api/graphql` with `X-FB-LSD`, `X-CSRFToken`,
  `X-IG-App-ID: 936619743392459`, friendly name
  `PolarisLoggedOutDesktopWWWPostRootContentQuery`, `doc_id=27130156389949648`,
  and reads `data.xig_polaris_media.if_not_gated_logged_out`; when that is
  empty it re-parses the post page's `<script data-sjs>` blobs for
  `RelayPrefetchedStreamCache → __bbox → result → data → xig_polaris_media`.
- `gallery-dl/gallery_dl/extractor/instagram.py` — mints its own 32-char
  `csrftoken` instead of needing a real session, sends
  `X-IG-WWW-Claim: 0`, `X-ASBD-ID: 129477`, `X-Requested-With:
  XMLHttpRequest`, and reads `/api/v1/media/{id_from_shortcode}/info/`.
- `instaloader/instaloader/instaloader.py` — confirmed the mobile
  `i.instagram.com/api/v1/media/{pk}/info/` shape and the
  `story`/`reels_media` endpoints used by the session provider.

### What did **not** survive contact with reality

Every anonymous JSON endpoint those projects use is IP-gated. Porting them was
still worth it: `rest` and `graphql` cost one request each, are correct when the
egress is clean (self-hosted, residential, or a future Cloudflare feature), and
their failures now carry accurate messages instead of a generic 502.

### The original site

Recorded because it drove the design. "seen" = observed in a response.

- Cloudflare-fronted, server-rendered HTML + jQuery 3.4.1, no SPA. *(seen)*
- 31 locales × 8 routes, generated into `sitemap.xml`. *(seen)*
- Search is `POST /api/ajaxSearch` with
  `{k_exp, k_token, q, t, lang, v:"v2", cftoken, html}`; a live probe returned
  `{"status":"ok","p":"instagram","mess":"No support"}`. *(seen)*
- Results come back as an HTML fragment or a script string injected into
  `#js-result`, not as JSON. This rebuild changes that: clean JSON,
  server-rendered fallback, no `eval`. *(seen, then deliberately not copied)*
- Their download handoff uses a second origin, `download.i-4-cdn.xyz`. *(seen)*
- Turnstile, Rocket Loader and AdSense (`ca-pub-…`) are on the page. *(seen)*
- Their extraction logic is server-side and never exposed. *(unknown)*

## Renaming

Change `DEFAULT_BRAND` in `src/config.ts` or set `BRAND_NAME`, then set
`PUBLIC_ORIGIN`. Nothing else hardcodes the name. Copy lives in
`src/config.ts` (tool copy) and `src/views/pages.tsx` (legal pages).

## Adding a language

1. `cp src/i18n/en.ts src/i18n/es.ts`, translate the values.
2. Register it in `src/i18n/index.ts`.
3. Flip `enabled: true` for that code in `LOCALES` (`src/config.ts`).

Routes, `hreflang`, the language menu and the sitemap pick it up automatically.

## Legal

Not affiliated with Instagram or Meta. Only download content you own or have
permission to use. The brand, copy and code here are original; the resolution
techniques are reimplemented from the GPL/Unlicense projects credited above,
which is why no code was copied verbatim.

## License

Released under the [MIT License](LICENSE). © 2026 SaveReel contributors.

---

If SaveReel saved you a hassle, consider leaving a ⭐ — it genuinely helps others find it.
