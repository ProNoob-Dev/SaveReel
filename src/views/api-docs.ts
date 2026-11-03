/**
 * HTML reference for the public API, served at /api.
 *
 * Plain HTML with the shared stylesheet: it has no interactive state, needs no
 * dictionary, and must stay readable to someone who is just going to `curl` it.
 * No inline script, so the global CSP stays strict.
 */

import { CSS_URL } from "../lib/version";

export type ApiDocsProps = {
  brand: string;
  origin: string;
  version: string;
  limit: number;
  windowMinutes: number;
  ttlMinutes: number;
};

const MARK = `<svg class="mark" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" fill="none" stroke="#191712" stroke-width="2.2"/><path d="M16 7v11.5" stroke="#c0391f" stroke-width="3"/><path d="M10.8 13.8 16 19l5.2-5.2" fill="none" stroke="#c0391f" stroke-width="3"/><path d="M9 24.6h14" stroke="#191712" stroke-width="2.4"/></svg>`;

export function apiDocsPage(props: ApiDocsProps): string {
  const { brand, origin, version, limit, windowMinutes, ttlMinutes } = props;

  const sample = JSON.stringify(
    {
      ok: true,
      api: version,
      data: {
        kind: "media",
        type: "video",
        shortcode: "DNA7Vi9IZWS",
        provider: "embed",
        author: { username: "uscurrencygov", full_name: null, avatar: "https://…cdninstagram.com/…jpg" },
        caption: "The Cash Assist mobile app has a …",
        warnings: [],
        media: [
          {
            type: "video",
            label: "Video",
            quality: "1080x1920 HD",
            width: 1080,
            height: 1920,
            filename: `${brand}-uscurrencygov-Video.mp4`,
            download: `${origin}/api/dl?u=…&e=1793032229&n=…&s=…`,
            thumbnail: "https://…cdninstagram.com/…jpg",
            source: "https://…cdninstagram.com/…mp4",
          },
        ],
        expires_at: "2026-10-26T16:30:29.000Z",
        fetched_at: "2026-10-26T16:00:29.434Z",
      },
      meta: {
        request_id: "0f9c2a1e-…",
        provider: "embed",
        took_ms: 1168,
        rate_limit: { limit, remaining: limit - 1, reset_at: "2026-10-26T16:10:00.000Z" },
      },
    },
    null,
    2,
  );

  const curlGet = `curl "${origin}/api/v1/resolve?url=https://www.instagram.com/reel/DNA7Vi9IZWS/"`;
  const curlPost = `curl -X POST "${origin}/api/v1/resolve" \\
  -H "content-type: application/json" \\
  -d '{"url":"https://www.instagram.com/p/C2VFqJMtui4/"}'`;
  const jsExample = `const res = await fetch(
  "${origin}/api/v1/resolve?url=" +
    encodeURIComponent("https://www.instagram.com/reel/DNA7Vi9IZWS/"),
);
const { ok, data, error } = await res.json();
if (ok) {
  for (const file of data.media) {
    // signed, host-checked, Content-Disposition: attachment
    console.log(file.filename, file.download);
  }
}`;

  const esc = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brand)} API · v${version}</title>
<meta name="description" content="One HTTP endpoint that turns an Instagram link into signed, direct download links. JSON in, JSON out, no API key.">
<link rel="canonical" href="${esc(origin)}/api">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/json" href="${esc(origin)}/openapi.json">
<meta name="theme-color" content="#f3eee2">
<meta name="color-scheme" content="light">
<meta name="robots" content="index,follow">
<link rel="preload" href="/fonts/instrument-serif-regular.woff2" as="font" type="font/woff2" crossorigin="anonymous">
<link rel="preload" href="/fonts/newsreader-var.woff2" as="font" type="font/woff2" crossorigin="anonymous">
<link rel="stylesheet" href="${CSS_URL}">
</head>
<body>

<header class="doc-top">
  <div class="wrap doc-top-row">
    <a class="wordmark" href="/en" aria-label="${esc(brand)}">${MARK}<span class="wordmark-text">${esc(brand)}<span class="wordmark-dot">.</span></span></a>
    <nav class="doc-nav" aria-label="Site">
      <a href="/en">Home</a>
      <a href="/stats">Stats</a>
      <a href="/openapi.json">OpenAPI</a>
    </nav>
  </div>
  <div class="wrap"><div class="rule-double"></div></div>
</header>

<main>
  <section class="doc-head">
    <div class="wrap">
      <p class="kicker mono">Public API · v${esc(version)} · no key</p>
      <h1 class="display-1">One endpoint.<br><em>Real files.</em></h1>
      <p class="hero-lede">
        Send a public Instagram link, get JSON back: author, caption, and one signed
        download URL per photo or video. No key, no account, no SDK — just HTTPS.
      </p>
      <p class="render-cta"><a class="json-pill" href="/openapi.json">OpenAPI 3.1 spec ↗</a></p>
    </div>
  </section>

  <section class="section">
    <div class="wrap doc-grid">
      <aside class="toc" aria-label="On this page">
        <strong>On this page</strong>
        <a href="#endpoints">Endpoints</a>
        <a href="#try">Try it</a>
        <a href="#browser">From a browser</a>
        <a href="#response">Response</a>
        <a href="#fields">Fields</a>
        <a href="#errors">Errors</a>
        <a href="#stats">Public stats</a>
        <a href="#limits">Limits</a>
        <a href="#spec">OpenAPI</a>
      </aside>

      <div class="doc-body">
        <h2 id="endpoints">Endpoints</h2>
        <div class="endpoint">
          <span class="method">GET</span>
          <code>/api/v1/resolve?url=&lt;instagram-url&gt;</code>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <code>/api/v1/resolve</code>
          <span class="mono muted">body: <code class="inline">{"url":"…"}</code></span>
        </div>
        <div class="endpoint">
          <span class="method">GET</span>
          <code>/api/v1/stats</code>
          <span class="mono muted">public counters · <a href="/stats">visual version</a></span>
        </div>
        <div class="endpoint">
          <span class="method">GET</span>
          <code>/api/v1/health</code>
        </div>
        <div class="endpoint">
          <span class="method">GET</span>
          <code>/openapi.json</code>
        </div>

        <h2 id="try">Try it</h2>
        <pre>${esc(curlGet)}</pre>
        <pre>${esc(curlPost)}</pre>

        <h2 id="browser">From a browser or app</h2>
        <p>
          CORS is open (<code class="inline">Access-Control-Allow-Origin: *</code>), so you can call it
          from any origin. Plain <code class="inline">fetch</code>, no credentials required.
        </p>
        <pre>${esc(jsExample)}</pre>

        <h2 id="response">Response</h2>
        <pre>${esc(sample)}</pre>

        <h2 id="fields">Fields</h2>
        <table class="data-table">
          <thead><tr><th>Field</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>data.type</code></td><td><code>video</code>, <code>image</code>, <code>carousel</code> or <code>mixed</code>.</td></tr>
            <tr><td><code>data.media[].download</code></td><td>Signed URL. Serves the file with <code>Content-Disposition: attachment</code>, so mobile browsers save instead of play.</td></tr>
            <tr><td><code>data.media[].source</code></td><td>The raw Instagram CDN URL, for reference. It expires and may refuse hotlinking.</td></tr>
            <tr><td><code>data.media[].quality</code></td><td><code>HD</code>/<code>SD</code>/<code>Low</code> plus duration for video, when Instagram reports it.</td></tr>
            <tr><td><code>data.expires_at</code></td><td>When every signed link in the response stops working (${ttlMinutes} minutes).</td></tr>
            <tr><td><code>meta.rate_limit</code></td><td>Your remaining requests in the current window.</td></tr>
          </tbody>
        </table>

        <h2 id="errors">Errors</h2>
        <p>
          Errors use the same envelope with <code class="inline">ok: false</code> and an HTTP status that matches the code.
        </p>
        <pre>${esc(
          JSON.stringify(
            {
              ok: false,
              api: version,
              error: {
                code: "not_found",
                message: "That post is not public, or it no longer exists.",
                hint: null,
              },
              meta: { request_id: "0f9c2a1e-…", status: 404, took_ms: 2198 },
            },
            null,
            2,
          ),
        )}</pre>
        <table class="data-table">
          <thead><tr><th>Status</th><th>Code</th><th>What to do</th></tr></thead>
          <tbody>
            <tr><td>400</td><td><code>invalid_url</code></td><td>Not an Instagram link, or missing <code>url</code>.</td></tr>
            <tr><td>401</td><td><code>login_required</code></td><td>Stories, highlights or private accounts. Public posts do not need this.</td></tr>
            <tr><td>403</td><td><code>private</code></td><td>The account or post is private.</td></tr>
            <tr><td>404</td><td><code>not_found</code></td><td>Deleted, renamed, or Instagram returned no media.</td></tr>
            <tr><td>422</td><td><code>unsupported</code></td><td>Right link type, wrong endpoint (for example a profile URL).</td></tr>
            <tr><td>429</td><td><code>rate_limited</code></td><td>Wait for the <code>retry-after</code> header, then retry.</td></tr>
            <tr><td>502</td><td><code>upstream_error</code></td><td>Instagram changed its markup or is unreachable. Retry once.</td></tr>
          </tbody>
        </table>

        <h2 id="stats">Public stats</h2>
        <p>
          Aggregate counters for this deployment: files downloaded, bytes served, links resolved,
          page views. The same numbers as the <a href="/stats">stats page</a>, and no personal data
          behind them.
        </p>
        <pre>curl "${esc(origin)}/api/v1/stats"</pre>

        <h2 id="limits">Limits and fair use</h2>
        <ul>
          <li>${limit} requests per ${windowMinutes} minutes per IP. Cached for 10 minutes; add <code class="inline">?fresh=1</code> to force a re-resolve.</li>
          <li>Signed download links live for ${ttlMinutes} minutes. Ask again for fresh ones.</li>
          <li>Public posts only. Stories, highlights and private accounts need an authenticated Instagram session, which this deployment does not expose.</li>
          <li>Do not hammer it. Instagram throttles the upstream, and a runaway client makes it slower for everyone.</li>
        </ul>

        <div class="note">
          Not affiliated with Instagram or Meta. Only download content you own or have permission to use.
          The operator of this deployment can disable or rate-limit the API at any time.
        </div>

        <h2 id="spec">Machine-readable spec</h2>
        <p>
          OpenAPI 3.1 at <a href="/openapi.json">/openapi.json</a> — drop it into Postman, Insomnia,
          or a code generator.
        </p>
      </div>
    </div>
  </section>
</main>

<footer class="doc-foot">
  <div class="wrap">
    <span>${esc(brand)} API v${esc(version)}</span>
    <span><a href="/en">${esc(brand)}</a> · <a href="/stats">Stats</a> · <a href="/openapi.json">OpenAPI</a> · <a href="/en/privacy-policy">Privacy</a></span>
  </div>
</footer>

</body>
</html>`;
}
