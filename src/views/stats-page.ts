/**
 * Public stats page, served at /stats.
 *
 * Plain HTML and the shared stylesheet: no JS, no dictionary, no inline styles
 * beyond the seven bar widths. It only renders counters that /api/v1/stats
 * already exposes, so there is no private number hiding in the page.
 */

import type { StatsSnapshot } from "../lib/stats";
import { formatBytes, formatDate, formatDay, formatInt, formatStamp } from "../lib/format";
import { CSS_URL } from "../lib/version";

export type StatsPageProps = {
  brand: string;
  origin: string;
  snapshot: StatsSnapshot;
};

const MARK = `<svg class="mark" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" fill="none" stroke="#191712" stroke-width="2.2"/><path d="M16 7v11.5" stroke="#c0391f" stroke-width="3"/><path d="M10.8 13.8 16 19l5.2-5.2" fill="none" stroke="#c0391f" stroke-width="3"/><path d="M9 24.6h14" stroke="#191712" stroke-width="2.4"/></svg>`;

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function statsPage(props: StatsPageProps): string {
  const { brand, origin, snapshot } = props;
  const { totals, today, last_7_days: last7 } = snapshot;
  const peak = Math.max(1, ...last7.map((day) => day.downloads));
  const since = snapshot.since ? formatDate(snapshot.since) : null;

  const rows = last7
    .map((day) => {
      const width = Math.max(0, Math.round((day.downloads / peak) * 100));
      return `<tr>
        <td>${esc(formatDay(day.day))}</td>
        <td><span class="bar-track"><span class="bar" style="width:${width}%"></span></span><b>${formatInt(day.downloads)}</b></td>
        <td>${formatInt(day.resolves)}</td>
        <td>${esc(formatBytes(day.bytes))}</td>
      </tr>`;
    })
    .join("");

  const unavailable = !snapshot.available
    ? `<div class="note">Stats storage is not bound on this deployment, so there is nothing to count yet. The API reports <code class="inline">available: false</code> in the meantime.</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brand)} stats · the books, open</title>
<meta name="description" content="Public, aggregate counters for ${esc(brand)}: files downloaded, bytes served and links resolved. No personal data, no per-visitor tracking.">
<link rel="canonical" href="${esc(origin)}/stats">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/json" href="${esc(origin)}/api/v1/stats">
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
      <a href="/api">API</a>
      <a href="/api/v1/stats">JSON</a>
    </nav>
  </div>
  <div class="wrap"><div class="rule-double"></div></div>
</header>

<main>
  <section class="doc-head">
    <div class="wrap">
      <p class="kicker mono">The books, open · since ${esc(since ?? "today")}</p>
      <h1 class="display-1">Every file,<br><em>counted.</em></h1>
      <p class="hero-lede">
        Live totals for this deployment of ${esc(brand)}. The same numbers are at
        <a href="/api/v1/stats">/api/v1/stats</a> — this page is just the readable version.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-label">Files downloaded</div>
          <div class="stat-value">${formatInt(totals.downloads)}</div>
          <div class="stat-sub">${formatInt(totals.videos)} video · ${formatInt(totals.images)} image</div>
        </div>
        <div class="stat">
          <div class="stat-label">Data served</div>
          <div class="stat-value">${esc(formatBytes(totals.bytes))}</div>
          <div class="stat-sub">through the signed proxy</div>
        </div>
        <div class="stat">
          <div class="stat-label">Links resolved</div>
          <div class="stat-value">${formatInt(totals.resolves)}</div>
          <div class="stat-sub">posts, reels and carousels</div>
        </div>
        <div class="stat">
          <div class="stat-label">Page views</div>
          <div class="stat-value">${formatInt(totals.page_views)}</div>
          <div class="stat-sub">${formatInt(totals.api_calls)} API calls</div>
        </div>
      </div>

      <div class="today-line">
        <span>Today (UTC): <b>${formatInt(today.downloads)}</b> downloads</span>
        <span><b>${esc(formatBytes(today.bytes))}</b> served</span>
        <span><b>${formatInt(today.resolves)}</b> links resolved</span>
        <span><b>${formatInt(today.page_views)}</b> page views</span>
        <span><b>${formatInt(today.api_calls)}</b> API calls</span>
      </div>

      <div class="stack-lg">
        <header class="section-head">
          <p class="section-index mono">01</p>
          <div>
            <h2 class="display-2">Last seven days</h2>
            <p class="section-lede">A day starts at 00:00 UTC. Empty days are real zeroes, not missing rows.</p>
          </div>
        </header>

        <table class="data-table">
          <thead><tr><th>Day</th><th>Downloads</th><th>Resolves</th><th>Bytes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <p class="doc-meta">
          Updated ${esc(formatStamp(snapshot.updated_at))}. Cached for up to a minute.
          ${since ? `Counting started ${esc(since)}.` : ""}
        </p>
      </div>

      <div class="note">
        <b>What is stored:</b> one integer per metric per UTC day. No IP addresses, no user agents,
        no links, no referrers and no per-visitor rows. That is why these numbers can be public.
      </div>
      ${unavailable}
    </div>
  </section>
</main>

<footer class="doc-foot">
  <div class="wrap">
    <span>${esc(brand)} · public ledger</span>
    <span><a href="/en">Home</a> · <a href="/api">API</a> · <a href="/api/v1/stats">JSON</a> · <a href="/en/privacy-policy">Privacy</a></span>
  </div>
</footer>

</body>
</html>`;
}
