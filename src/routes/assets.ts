import { Hono } from "hono";
import type { Bindings } from "../config";
import { LOCALES, brand, origin } from "../config";
import { CSS } from "../assets/styles";
import { APP_JS } from "../assets/client";
import { FONT_FILES } from "../assets/fonts";
import { buildRobots, buildSitemap } from "../lib/seo";

export const assets = new Hono<{ Bindings: Bindings }>();

const staticCache = { "cache-control": "public, max-age=3600, s-maxage=86400" };
const immutableCache = { "cache-control": "public, max-age=31536000, immutable" };

/**
 * CSS and JS are referenced with a content fingerprint (?v=), so their URLs
 * change whenever the code does. That makes a year of immutable caching safe
 * and removes the "hard refresh after deploy" problem entirely.
 */
assets.get("/css/app.css", (c) => c.body(CSS, 200, { ...immutableCache, "content-type": "text/css; charset=utf-8" }));

assets.get("/js/app.js", (c) => c.body(APP_JS, 200, { ...immutableCache, "content-type": "text/javascript; charset=utf-8" }));

/**
 * Fonts live in the bundle as base64 and are decoded once per isolate. A
 * Worker has no asset bucket by design here, and a font CDN would be a third
 * party in the critical path (and in the privacy story).
 */
const decodedFonts = new Map<string, ArrayBuffer>();

assets.get("/fonts/*", (c) => {
  const name = c.req.path.replace(/^\/fonts\//, "");
  const file = FONT_FILES[name];
  if (!file) return c.notFound();

  let bytes = decodedFonts.get(name);
  if (!bytes) {
    const binary = atob(file.base64);
    const buffer = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) buffer[index] = binary.charCodeAt(index);
    bytes = buffer.buffer;
    decodedFonts.set(name, bytes);
  }

  return c.body(bytes, 200, { ...immutableCache, "content-type": file.type });
});

assets.get("/robots.txt", (c) =>
  c.body(buildRobots(origin(c.env, new URL(c.req.url))), 200, {
    "content-type": "text/plain; charset=utf-8",
    ...staticCache,
  }),
);

assets.get("/sitemap.xml", (c) =>
  c.body(buildSitemap(origin(c.env, new URL(c.req.url))), 200, {
    "content-type": "application/xml; charset=utf-8",
    ...staticCache,
  }),
);

assets.get("/manifest.webmanifest", (c) => {
  const base = origin(c.env, new URL(c.req.url));
  const name = brand(c.env);
  return c.body(
    JSON.stringify({
      name: `${name} — Instagram Downloader`,
      short_name: name,
      description: "Download Instagram videos, reels, photos, stories and avatars in their original quality.",
      start_url: `/${LOCALES[0]?.code ?? "en"}`,
      scope: "/",
      display: "standalone",
      background_color: "#f3eee2",
      theme_color: "#f3eee2",
      icons: [
        { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
      ],
      shortcuts: [
        { name: "Video", url: `/${LOCALES[0]?.code ?? "en"}/download-video-instagram` },
        { name: "Reels", url: `/${LOCALES[0]?.code ?? "en"}/instagram-reels-video-download` },
      ],
      id: `${base}/`,
    }),
    200,
    { ...staticCache, "content-type": "application/manifest+json; charset=utf-8" },
  );
});

/**
 * The mark: an ink frame, a vermilion arrow, a baseline. Drawn rather than
 * lettered so it stays legible at 16px and does not depend on a font being
 * installed.
 */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" fill="#f3eee2"/>
<rect x="2" y="2" width="28" height="28" fill="none" stroke="#191712" stroke-width="2.4"/>
<path d="M16 7.5v10.8" stroke="#c0391f" stroke-width="3"/>
<path d="M11 13.2 16 18.2l5-5" fill="none" stroke="#c0391f" stroke-width="3"/>
<path d="M9 24.5h14" stroke="#191712" stroke-width="2.4"/>
</svg>`;

assets.get("/favicon.svg", (c) =>
  c.body(FAVICON, 200, { ...staticCache, "content-type": "image/svg+xml; charset=utf-8" }),
);

assets.get("/og.svg", (c) => {
  const name = brand(c.env)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f3eee2"/>
<rect x="34" y="34" width="1132" height="562" fill="none" stroke="#191712" stroke-width="2"/>
<rect x="46" y="46" width="1108" height="538" fill="none" stroke="#cec3af" stroke-width="1"/>

<text x="78" y="128" font-family="Space Mono, Courier New, monospace" font-size="17" letter-spacing="5" fill="#6c6657">INSTAGRAM DOWNLOADER / NO ACCOUNT / NO APP</text>
<path d="M78 152h1044" stroke="#191712" stroke-width="2"/>

<text x="72" y="356" font-family="Georgia, Times New Roman, serif" font-size="168" letter-spacing="-4" fill="#191712">${name}<tspan fill="#c0391f">.</tspan></text>

<text x="78" y="432" font-family="Georgia, Times New Roman, serif" font-style="italic" font-size="44" fill="#c0391f">Save the post, not the feed.</text>

<path d="M78 482h1044" stroke="#cec3af" stroke-width="1"/>
<text x="78" y="524" font-family="Space Mono, Courier New, monospace" font-size="19" letter-spacing="2" fill="#3b362c">VIDEO · REELS · PHOTOS · STORIES · IGTV · AVATARS · AUDIO</text>
<text x="78" y="556" font-family="Space Mono, Courier New, monospace" font-size="15" letter-spacing="2" fill="#6c6657">ORIGINAL QUALITY · SIGNED LINKS · SAVED TO YOUR DEVICE</text>

<g transform="translate(1002 230)">
  <rect x="0" y="0" width="96" height="96" fill="#fffdf7" stroke="#191712" stroke-width="4"/>
  <path d="M48 22v32" stroke="#c0391f" stroke-width="7"/>
  <path d="M32 40 48 56l16-16" fill="none" stroke="#c0391f" stroke-width="7"/>
  <path d="M26 76h44" stroke="#191712" stroke-width="6"/>
</g>

<rect x="1002" y="346" width="96" height="8" fill="#c0391f"/>
</svg>`;
  return c.body(svg, 200, { ...staticCache, "content-type": "image/svg+xml; charset=utf-8" });
});
