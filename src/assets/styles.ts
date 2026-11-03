/**
 * The whole stylesheet.
 *
 * Art direction: printed matter, not a SaaS landing page. Warm paper, black ink,
 * one vermilion accent, two rules (hairline and heavy), no gradients, no glass,
 * no glow. Type does the work: Instrument Serif for display, Newsreader for
 * prose, Space Mono for labels and numbers.
 *
 * The only texture is a generated grain overlay at the very end of the cascade;
 * it is a few hundred bytes of inline SVG, not an image request.
 */

export const CSS = String.raw`
@font-face {
  font-family: "Instrument Serif";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/instrument-serif-regular.woff2") format("woff2");
}
@font-face {
  font-family: "Instrument Serif";
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/instrument-serif-italic.woff2") format("woff2");
}
@font-face {
  font-family: "Newsreader";
  font-style: normal;
  font-weight: 200 800;
  font-display: swap;
  src: url("/fonts/newsreader-var.woff2") format("woff2");
}
@font-face {
  font-family: "Space Mono";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/space-mono-regular.woff2") format("woff2");
}

:root {
  --paper: #f3eee2;
  --paper-2: #eae2d1;
  --paper-3: #fffdf7;
  --ink: #191712;
  --ink-2: #3b362c;
  --muted: #6c6657;
  --rule: #cec3af;
  --accent: #c0391f;
  --accent-dark: #8e2814;
  --accent-wash: #efd8ce;
  --ok: #2c6a4a;
  --warn: #8a5a10;
  --max: 1160px;
  --gutter: clamp(18px, 4vw, 40px);
  --font-display: "Instrument Serif", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --font-body: "Newsreader", Georgia, "Times New Roman", serif;
  --font-mono: "Space Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --shadow-block: 7px 7px 0 var(--accent-wash);
  --shadow-card: 6px 6px 0 var(--paper-2);
  color-scheme: light;
}

* { box-sizing: border-box; }

html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 1.0625rem;
  line-height: 1.6;
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}

/* The grain. Fixed, non-interactive, and weak enough to sit under text. */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.55;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)' opacity='0.1'/%3E%3C/svg%3E");
}

::selection {
  background: var(--accent);
  color: var(--paper-3);
}

a {
  color: inherit;
  text-decoration-color: var(--rule);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
a:hover { text-decoration-color: var(--accent); color: var(--accent); }

img { max-width: 100%; display: block; }

button, input, select, textarea { font: inherit; color: inherit; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

h1, h2, h3, h4 {
  font-weight: 400;
  margin: 0;
  text-wrap: balance;
}

p { text-wrap: pretty; }

/* --------------------------------------------------------------- utilities */
.wrap {
  width: 100%;
  max-width: var(--max);
  margin-inline: auto;
  padding-inline: var(--gutter);
}
.wrap-narrow { max-width: 800px; }
.muted { color: var(--muted); }

.mono {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 400;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1.5;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.skip {
  position: absolute;
  left: 12px;
  top: -100px;
  z-index: 10000;
  background: var(--ink);
  color: var(--paper-3);
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
}
.skip:focus { top: 12px; color: var(--paper-3); }

.display-1 {
  font-family: var(--font-display);
  font-size: clamp(3.1rem, 8vw, 6.1rem);
  line-height: 0.9;
  letter-spacing: -0.015em;
}
.display-2 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4.2vw, 3.4rem);
  line-height: 0.98;
  letter-spacing: -0.012em;
}
.display-3 {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 2.6vw, 2.15rem);
  line-height: 1.02;
}

.rule { height: 1px; background: var(--rule); border: 0; margin: 0; }
.rule-double {
  height: 5px;
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--ink);
}

.fleuron { color: var(--accent); flex: 0 0 auto; }

/* ---------------------------------------------------------------- masthead */
.masthead { padding-top: 16px; background: var(--paper); }

.masthead-row {
  display: flex;
  align-items: center;
  gap: clamp(16px, 4vw, 44px);
  padding-bottom: 14px;
}

.wordmark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--ink);
  flex: 0 0 auto;
}
.wordmark:hover { color: var(--ink); text-decoration: none; }
.wordmark-text {
  font-family: var(--font-display);
  font-size: clamp(1.85rem, 3.2vw, 2.45rem);
  line-height: 0.85;
  letter-spacing: -0.01em;
}
.wordmark-dot { color: var(--accent); }
.mark { display: block; }

.masthead-note {
  margin: 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.56rem;
  line-height: 1.7;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.masthead-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: clamp(12px, 2vw, 22px);
}

.masthead-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-block: 2px 0;
}

.tool-nav { display: flex; flex-wrap: wrap; }

.tool-nav a {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 9px 12px;
  color: var(--ink-2);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.tool-nav a:first-child { padding-left: 0; }
.tool-nav a:hover { color: var(--accent); }
.tool-nav a.is-active { color: var(--ink); border-bottom-color: var(--accent); }

.nav-num { color: var(--muted); font-size: 0.52rem; letter-spacing: 0; }

.meta-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}
.meta-nav a { color: var(--ink-2); text-decoration: none; }
.meta-nav a:hover { color: var(--accent); text-decoration: underline; }

/* Menus ---------------------------------------------------------------- */
.menu { position: relative; }
.menu > summary {
  list-style: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid var(--rule);
  background: transparent;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-2);
}
.menu > summary::-webkit-details-marker { display: none; }
.menu > summary::after { content: "▾"; font-size: 0.55rem; color: var(--muted); }
.menu[open] > summary { border-color: var(--ink); background: var(--paper-3); }

.menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 60;
  min-width: 232px;
  max-height: 64vh;
  overflow: auto;
  background: var(--paper-3);
  border: 1.5px solid var(--ink);
  box-shadow: var(--shadow-block);
  padding: 5px;
  display: grid;
  gap: 1px;
}

.menu-panel a,
.menu-panel span {
  display: block;
  padding: 7px 9px;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.04em;
  color: var(--ink-2);
  text-decoration: none;
}
.menu-panel a:hover { background: var(--paper-2); color: var(--accent); }
.menu-panel .is-active { background: var(--ink); color: var(--paper-3); }
.menu-panel .is-active:hover { background: var(--ink); color: var(--paper-3); }
.menu-panel .is-disabled { color: #9a927f; display: flex; justify-content: space-between; gap: 10px; }
.menu-panel .is-disabled em { font-style: normal; font-size: 0.52rem; }

/* ------------------------------------------------------------------- hero */
.hero { padding-block: clamp(34px, 6vw, 76px) clamp(38px, 6vw, 78px); }

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.42fr) minmax(300px, 0.62fr);
  gap: clamp(30px, 5vw, 68px);
  align-items: start;
}

.hero-lead { min-width: 0; }

.h1-kicker {
  display: block;
  margin-bottom: 16px;
  font-family: var(--font-mono);
  font-size: 0.63rem;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.display-1 em { font-style: italic; color: var(--accent); }

.hero-lede {
  max-width: 46ch;
  margin: 20px 0 0;
  font-size: clamp(1.06rem, 1.5vw, 1.24rem);
  line-height: 1.5;
  color: var(--ink-2);
}

.kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 18px;
  color: var(--ink-2);
}
.kicker::before {
  content: "";
  width: 30px;
  height: 1px;
  background: var(--accent);
  flex: 0 0 auto;
}

.hero-meta {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 0.57rem;
  letter-spacing: 0.08em;
}

.hero-aside {
  position: relative;
  border-left: 1px solid var(--rule);
  padding-left: clamp(20px, 2.6vw, 34px);
  padding-top: 34px;
  min-width: 0;
}

/* ----------------------------------------------------------------- search */
.search { margin-top: clamp(24px, 3vw, 34px); max-width: 650px; }

.search-label {
  display: block;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
}

.search-box {
  display: flex;
  align-items: stretch;
  background: var(--paper-3);
  border: 1.5px solid var(--ink);
  box-shadow: var(--shadow-block);
  transition: box-shadow 0.15s ease;
}
.search-box:focus-within { box-shadow: 7px 7px 0 var(--accent); }

.search-box input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 17px 15px;
  font-family: var(--font-body);
  font-size: 1.02rem;
  color: var(--ink);
}
.search-box input::placeholder { color: #9b9381; opacity: 1; }

.search-hint {
  margin: 11px 0 0;
  color: var(--muted);
  font-size: 0.57rem;
  letter-spacing: 0.07em;
}
.search-hint a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--accent); }
.search-hint a:hover { color: var(--accent); }

/* ---------------------------------------------------------------- buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 18px;
  border: 1.5px solid var(--ink);
  background: var(--paper-3);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--ink);
  transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
  line-height: 1.2;
}
.btn:hover { background: var(--paper-2); color: var(--ink); text-decoration: none; }
.btn:active { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ink); }
.btn[disabled] { opacity: 0.55; cursor: progress; }

.btn.primary {
  background: var(--accent);
  border-color: var(--ink);
  color: #fff9f0;
}
.btn.primary:hover { background: var(--accent-dark); color: #fff9f0; }

.btn.ghost {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: var(--muted);
  text-decoration: underline;
  text-decoration-color: var(--rule);
  text-underline-offset: 3px;
  padding-inline: 12px;
}
.btn.ghost:hover { background: transparent; color: var(--accent); }

.search-box .btn { border: 0; box-shadow: none; }
.search-box .btn:active { transform: none; }
.search-box .paste { border-left: 1px dotted var(--rule); }
.search-box .submit { border-left: 1.5px solid var(--ink); }

/* ----------------------------------------------------------------- result */
.result {
  max-width: 690px;
  margin-top: 26px;
  background: var(--paper-3);
  border: 1.5px solid var(--ink);
  box-shadow: var(--shadow-card);
  padding: 16px 18px 14px;
}

.result-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ink);
}
.result h2 {
  font-family: var(--font-display);
  font-size: 1.75rem;
  line-height: 1;
}
.result .muted { margin: 0; font-size: 0.86rem; }

.byline { display: flex; align-items: center; gap: 8px; margin-top: 6px; color: var(--muted); }
.byline .avatar {
  width: 24px;
  height: 24px;
  object-fit: cover;
  border: 1px solid var(--rule);
  flex: 0 0 auto;
  background: var(--paper-2);
}
.byline b { color: var(--ink-2); font-weight: 600; }

.badge {
  font-family: var(--font-mono);
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-2);
  border: 1px solid var(--ink);
  padding: 4px 7px;
  white-space: nowrap;
  background: var(--paper);
}

.caption {
  margin: 11px 0 0;
  font-size: 0.95rem;
  color: var(--ink-2);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-actions {
  display: flex;
  margin-top: 14px;
}
.save-all {
  flex: 1 1 auto;
  justify-content: center;
  padding: 16px 20px;
  font-size: 0.82rem;
  letter-spacing: 0.14em;
  background: var(--accent);
  border-color: var(--ink);
  color: #fff9f0;
  box-shadow: 4px 4px 0 var(--ink);
}
.save-all:hover { background: var(--accent-dark); color: #fff9f0; }
.save-all[disabled] { opacity: 0.55; cursor: progress; }
.save-all::after {
  content: "↓";
  margin-left: 10px;
  display: inline-block;
  animation: saveall-bounce 1s ease-in-out infinite;
}
@keyframes saveall-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}

.items { list-style: none; margin: 6px 0 0; padding: 0; }

.item {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px dotted var(--rule);
}

.item img,
.thumb-fallback {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border: 1px solid var(--rule);
  background: var(--paper-2);
  flex: 0 0 auto;
}
.thumb-fallback {
  display: block;
  background-image: repeating-linear-gradient(-45deg, transparent 0 5px, rgba(25, 23, 18, 0.09) 5px 6px);
}

.item-body { min-width: 0; display: grid; gap: 1px; }
.item-body b { font-size: 0.98rem; font-weight: 600; line-height: 1.25; }
.item-body .muted { font-size: 0.78rem; }

.filename {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  color: var(--muted);
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item .btn { padding: 9px 11px; font-size: 0.56rem; box-shadow: 2px 2px 0 var(--ink); }
.item .btn.ghost { box-shadow: none; padding: 6px 8px; }

.fineprint {
  margin: 11px 0 0;
  font-family: var(--font-mono);
  font-size: 0.55rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--muted);
}

.warnings {
  margin: 9px 0 0;
  padding-left: 16px;
  font-size: 0.82rem;
  color: var(--warn);
}

.alert {
  max-width: 690px;
  margin-top: 22px;
  border: 1.5px solid var(--accent);
  border-left-width: 8px;
  background: var(--accent-wash);
  padding: 13px 15px;
  display: grid;
  gap: 3px;
}
.alert b { font-size: 0.98rem; font-weight: 600; color: var(--accent-dark); }
.alert span { font-size: 0.86rem; color: var(--ink-2); }

/* ----------------------------------------------------------------- ledger */
.ledger {
  max-width: 420px;
  margin-left: auto;
  background: var(--paper-3);
  border: 1.5px solid var(--ink);
  box-shadow: var(--shadow-block);
  padding: 15px 16px 12px;
}

.ledger-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ink);
  color: var(--muted);
  font-size: 0.55rem;
  letter-spacing: 0.11em;
}

.ledger-big {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 13px 0 2px;
}

.ledger-num {
  font-family: var(--font-display);
  font-size: clamp(3.3rem, 4.6vw, 4.5rem);
  line-height: 0.8;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.ledger-label {
  max-width: 7ch;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  line-height: 1.5;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.ledger-rows { margin: 10px 0 0; padding: 0; border-top: 1px solid var(--rule); }
.ledger-rows > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px dotted var(--rule);
}
.ledger-rows dt {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.54rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.ledger-rows dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.ledger-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 46px;
  margin: 14px 0 0;
}
.ledger-bars span {
  flex: 1 1 0;
  min-height: 2px;
  background: var(--accent);
}
.ledger-bars span.is-zero { background: var(--rule); }

.ledger-bar-labels {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 0.5rem;
  letter-spacing: 0.02em;
  color: var(--muted);
  text-align: center;
}
.ledger-bar-labels span { flex: 1 1 0; }

.ledger-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 11px;
  padding-top: 9px;
  border-top: 1px solid var(--ink);
  font-size: 0.52rem;
  letter-spacing: 0.06em;
}
.ledger-note {
  margin: 8px 0 0;
  font-family: var(--font-mono);
  font-size: 0.48rem;
  line-height: 1.6;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.ledger-foot a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--accent); }
.ledger-foot a:hover { color: var(--accent); }
.ledger-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  background: var(--accent);
  margin-right: 5px;
  vertical-align: 1px;
}

.render-cta { margin-top: 14px; }

/* ----------------------------------------------------------------- ticker */
.ticker {
  border-block: 1px solid var(--ink);
  padding: 9px 0;
  overflow: hidden;
}
.ticker-inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px 14px;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-2);
}
.ticker-inner span { display: inline-flex; align-items: center; gap: 10px; }
.ticker-inner i { color: var(--accent); font-style: normal; }

/* ---------------------------------------------------------------- sections */
.section { padding-block: clamp(42px, 6vw, 82px); }
.section-alt { background: var(--paper-2); }

.section-head {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: clamp(16px, 3vw, 32px);
  align-items: start;
  margin-bottom: clamp(22px, 3.5vw, 40px);
  padding-top: 14px;
  border-top: 1.5px solid var(--ink);
}
.section-index {
  margin: 5px 0 0;
  color: var(--accent);
  letter-spacing: 0.1em;
}
.section-head h2 { margin: 0 0 8px; }
.section-lede {
  max-width: 62ch;
  margin: 0;
  color: var(--muted);
  font-size: 1.02rem;
}

/* ------------------------------------------------------------------ index */
.index-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: clamp(26px, 5vw, 76px);
}
.index-row { border-top: 1px solid var(--rule); }

.index-row a {
  display: grid;
  grid-template-columns: 28px 30px minmax(0, 1fr) 18px;
  gap: 12px;
  align-items: start;
  padding: 17px 0 19px;
  text-decoration: none;
  transition: padding 0.15s ease;
}
.index-row a:hover { padding-left: 8px; text-decoration: none; }

.index-num {
  padding-top: 5px;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.index-icon { padding-top: 2px; color: var(--accent); }
.index-icon svg,
.tool-icon-svg { display: block; }
.index-body b {
  display: block;
  font-size: 1.06rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink);
}
.index-row a:hover .index-body b { color: var(--accent); }
.index-desc {
  display: block;
  margin-top: 2px;
  max-width: 48ch;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.45;
}
.index-arrow {
  padding-top: 3px;
  color: var(--muted);
  font-size: 0.9rem;
  transition: transform 0.15s ease, color 0.15s ease;
}
.index-row a:hover .index-arrow { transform: translate(2px, -2px); color: var(--accent); }

/* ------------------------------------------------------------------ steps */
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--rule);
}
.steps li {
  padding: 20px 26px 4px 0;
  border-right: 1px solid var(--rule);
}
.steps li + li { padding-left: 26px; }
.steps li:last-child { border-right: 0; padding-right: 0; }

.step-num {
  display: block;
  margin-bottom: 8px;
  font-family: var(--font-display);
  font-size: 2.7rem;
  line-height: 0.9;
  color: var(--accent);
}
.steps h3 { margin: 0 0 3px; font-size: 1.05rem; font-weight: 600; line-height: 1.3; }
.steps p { margin: 0; color: var(--muted); font-size: 0.94rem; line-height: 1.5; }

.steps.compact { grid-template-columns: 1fr; border-top: 0; }
.steps.compact li {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding: 15px 0;
  border-right: 0;
  border-top: 1px solid var(--rule);
}
.steps.compact li + li { padding-left: 0; }
.steps.compact .step-num { margin: 0; font-size: 1.35rem; line-height: 1.2; }
.steps.compact p { font-size: 1rem; color: var(--ink-2); }

/* ------------------------------------------------------------------ notes */
.notes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--ink);
}
.note-col {
  padding: 18px 28px 0 0;
  border-right: 1px solid var(--rule);
}
.note-col + .note-col { padding-left: 28px; }
.note-col:last-child { border-right: 0; padding-right: 0; }
.note-col h3 {
  margin: 8px 0 7px;
  font-family: var(--font-display);
  font-size: 1.6rem;
  line-height: 1.02;
}
.note-col .mono .fleuron { vertical-align: -1px; margin-right: 4px; }
.note-col p { margin: 0; color: var(--muted); font-size: 0.96rem; line-height: 1.5; }

/* -------------------------------------------------------------------- faq */
.faq-layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: clamp(26px, 5vw, 64px);
  align-items: start;
}
.faq-side h2 { margin: 0 0 10px; }
.faq-side .section-lede { font-size: 1rem; }

.faq { border-top: 1.5px solid var(--ink); }
.faq details { border-bottom: 1px solid var(--rule); padding: 15px 0; }
.faq summary {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 20px;
  cursor: pointer;
  list-style: none;
  font-size: 1.07rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--ink);
}
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after {
  content: "+";
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--accent);
  flex: 0 0 auto;
}
.faq details[open] summary::after { content: "−"; }
.faq details[open] summary { color: var(--accent); }
.faq p { margin: 9px 0 2px; max-width: 68ch; color: var(--ink-2); font-size: 0.98rem; }

/* ------------------------------------------------------------------ pills */
.pill-row {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 16px 0 0;
  padding: 0;
}
.pill {
  display: inline-block;
  padding: 8px 11px;
  border: 1px solid var(--rule);
  background: transparent;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--ink-2);
}
.pill:hover { border-color: var(--ink); background: var(--paper-3); color: var(--accent); text-decoration: none; }

/* ---------------------------------------------------------------- install */
.install {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: clamp(20px, 3vw, 32px);
  border: 1.5px dashed var(--ink);
  background: var(--paper-3);
}
.install h2 { margin: 0 0 5px; }
.install p { margin: 0; max-width: 52ch; color: var(--muted); font-size: 0.98rem; }

/* ---------------------------------------------------------------- tool page */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.breadcrumb a { text-decoration: none; color: var(--muted); }
.breadcrumb a:hover { color: var(--accent); }
.breadcrumb span[aria-hidden] { color: var(--accent); }

.tool-head {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(270px, 0.65fr);
  gap: clamp(26px, 4vw, 56px);
  align-items: end;
}
.tool-head h1 { margin: 0 0 14px; }
.tool-head .hero-lede { margin-top: 0; max-width: 52ch; }

.spec {
  border: 1.5px solid var(--ink);
  background: var(--paper-3);
  box-shadow: var(--shadow-card);
  padding: 14px 16px 10px;
}
.spec-title {
  margin: 0 0 8px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--ink);
  color: var(--muted);
  font-size: 0.56rem;
  letter-spacing: 0.12em;
}
.spec dl { margin: 0; padding: 0; }
.spec dl > div {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px dotted var(--rule);
}
.spec dl > div:last-child { border-bottom: 0; }
.spec dt {
  font-family: var(--font-mono);
  font-size: 0.52rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  padding-top: 1px;
}
.spec dd { margin: 0; font-size: 0.9rem; line-height: 1.35; color: var(--ink-2); }

.spec-note {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--accent);
  font-family: var(--font-mono);
  font-size: 0.53rem;
  letter-spacing: 0.05em;
  line-height: 1.6;
  text-transform: uppercase;
  color: var(--accent-dark);
}

/* ------------------------------------------------------------------- prose */
.prose { max-width: 68ch; }
.prose > p:first-of-type { font-size: 1.12rem; color: var(--ink); }
.prose p { margin: 0 0 15px; color: var(--ink-2); }
.prose h2 {
  margin: 34px 0 9px;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 2.4vw, 2.05rem);
  line-height: 1.05;
}
.prose h3 { margin: 24px 0 7px; font-size: 1.05rem; font-weight: 600; }
.prose ul { margin: 0 0 16px; padding-left: 18px; color: var(--ink-2); }
.prose li { margin: 4px 0; }
.prose a { color: var(--accent-dark); }

.doc-head { padding: clamp(32px, 5vw, 62px) 0 clamp(22px, 3vw, 34px); }
.doc-head h1 { margin: 0 0 14px; }
.doc-head .kicker { margin-bottom: 14px; }
.doc-meta { margin: 0; color: var(--muted); font-size: 0.58rem; letter-spacing: 0.08em; }

.doc { padding-block: clamp(34px, 5vw, 64px) clamp(54px, 7vw, 90px); }
.doc-grid {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: clamp(26px, 5vw, 62px);
  align-items: start;
}
.doc-body { min-width: 0; }

.toc {
  position: sticky;
  top: 22px;
  display: grid;
  gap: 7px;
  padding-top: 10px;
  border-top: 1.5px solid var(--ink);
  font-family: var(--font-mono);
  font-size: 0.57rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.toc strong { color: var(--muted); font-weight: 400; margin-bottom: 3px; }
.toc a { color: var(--ink-2); text-decoration: none; }
.toc a:hover { color: var(--accent); }

/* ------------------------------------------------------------ code & tables */
code, pre, kbd {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0;
}
code.inline {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  padding: 1px 5px;
  white-space: nowrap;
}
pre {
  margin: 0 0 18px;
  padding: 16px 17px;
  overflow-x: auto;
  background: var(--ink);
  color: #f0e8d8;
  border: 1.5px solid var(--ink);
  line-height: 1.65;
  tab-size: 2;
}
pre code { color: inherit; font-size: 0.76rem; }
pre .c { color: #9a927f; }

.endpoint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 11px 0;
  border-top: 1px solid var(--rule);
}
.endpoint:last-of-type { border-bottom: 1px solid var(--rule); }
.endpoint code { font-size: 0.8rem; }

.method {
  font-family: var(--font-mono);
  font-size: 0.52rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 6px;
  background: var(--ink);
  color: var(--paper);
}
.method.post { background: var(--accent); color: #fff9f0; }

.data-table { width: 100%; border-collapse: collapse; margin: 0 0 10px; font-size: 0.9rem; }
.data-table th {
  text-align: left;
  padding: 8px 10px 8px 0;
  border-bottom: 1.5px solid var(--ink);
  font-family: var(--font-mono);
  font-size: 0.55rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.data-table td {
  padding: 9px 12px 9px 0;
  border-bottom: 1px dotted var(--rule);
  vertical-align: top;
  color: var(--ink-2);
}
.data-table td:first-child { white-space: nowrap; }
.data-table b { color: var(--ink); }

.note {
  margin: 24px 0 0;
  padding: 13px 15px;
  border: 1.5px solid var(--ink);
  border-left-width: 8px;
  border-left-color: var(--accent);
  background: var(--paper-3);
  font-size: 0.92rem;
  color: var(--ink-2);
}

/* ---------------------------------------------------------------- stats page */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1.5px solid var(--ink);
  border-bottom: 1px solid var(--ink);
}
.stat { padding: 18px 20px 20px 0; border-right: 1px solid var(--rule); }
.stat + .stat { padding-left: 20px; }
.stat:last-child { border-right: 0; padding-right: 0; }
.stat-label {
  font-family: var(--font-mono);
  font-size: 0.54rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.stat-value {
  margin: 10px 0 5px;
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 4.6vw, 4rem);
  line-height: 0.82;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.stat-sub { font-size: 0.85rem; color: var(--muted); }

.today-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 26px;
  padding: 13px 0;
  border-bottom: 1.5px solid var(--ink);
  font-family: var(--font-mono);
  font-size: 0.57rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}
.today-line b { color: var(--ink); font-weight: 400; }

.bar {
  display: inline-block;
  height: 8px;
  min-width: 2px;
  background: var(--accent);
  vertical-align: middle;
  margin-right: 8px;
}

.json-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid var(--ink);
  background: var(--paper-3);
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--ink);
  box-shadow: 2px 2px 0 var(--ink);
}
.json-pill:hover { background: var(--accent); color: #fff9f0; text-decoration: none; }

.doc-top { padding-top: 18px; }
.doc-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-block: 11px;
}
.doc-top .wordmark-text { font-size: 1.8rem; }
.doc-top .doc-nav {
  display: flex;
  gap: 16px;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.doc-top .doc-nav a { color: var(--ink-2); text-decoration: none; }
.doc-top .doc-nav a:hover { color: var(--accent); }

.doc-foot {
  padding: 16px 0 30px;
  border-top: 1.5px solid var(--ink);
  font-family: var(--font-mono);
  font-size: 0.54rem;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.doc-foot .wrap { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.doc-foot a { color: var(--ink-2); text-decoration: none; }
.doc-foot a:hover { color: var(--accent); text-decoration: underline; }

.bar-track {
  display: inline-block;
  width: 96px;
  height: 8px;
  background: var(--paper-2);
  border: 1px solid var(--rule);
  margin-right: 8px;
  vertical-align: middle;
}
.bar-track .bar { display: block; height: 100%; min-width: 0; margin: 0; border: 0; }

.stack-lg { margin-top: clamp(32px, 5vw, 56px); }

.doc-body h2 {
  margin: 38px 0 12px;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 2.4vw, 2.05rem);
  line-height: 1.05;
}
.doc-body h2:first-child { margin-top: 0; }
.doc-body p { margin: 0 0 14px; color: var(--ink-2); }
.doc-body ul { margin: 0 0 16px; padding-left: 18px; color: var(--ink-2); }
.doc-body li { margin: 4px 0; }
.doc-body a { color: var(--accent-dark); }

/* ------------------------------------------------------------------ footer */
.colophon {
  margin-top: 30px;
  padding-block: clamp(34px, 5vw, 56px) 22px;
  border-top: 1.5px solid var(--ink);
  background: var(--paper-2);
}
.colophon-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: clamp(24px, 5vw, 64px);
}
.colophon h3 {
  margin: 0 0 11px;
  font-family: var(--font-mono);
  font-size: 0.55rem;
  font-weight: 400;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--muted);
}
.colophon ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.colophon a { text-decoration: none; color: var(--ink-2); font-size: 0.9rem; }
.colophon a:hover { color: var(--accent); text-decoration: underline; }
.colophon-brand p { margin: 11px 0 0; max-width: 34ch; color: var(--muted); font-size: 0.9rem; line-height: 1.5; }
.colophon-brand .mono { margin-top: 14px; font-size: 0.52rem; line-height: 1.7; color: var(--muted); max-width: 42ch; }

.colophon-bottom {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 32px;
  padding-top: 13px;
  border-top: 1px solid var(--rule);
  font-family: var(--font-mono);
  font-size: 0.53rem;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.colophon-bottom p { margin: 0; max-width: 66ch; }

/* ------------------------------------------------------------------- toast */
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 70;
  transform: translate(-50%, 16px);
  max-width: min(90vw, 440px);
  padding: 10px 14px;
  background: var(--ink);
  color: var(--paper-3);
  border: 1px solid var(--ink);
  box-shadow: 4px 4px 0 var(--accent);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.toast.is-visible { opacity: 1; transform: translate(-50%, 0); }

/* -------------------------------------------------------------------- 404 */
.not-found { padding-block: clamp(50px, 9vw, 120px); }
.not-found .display-1 { font-size: clamp(6rem, 18vw, 13rem); line-height: 0.8; color: var(--accent); }
.not-found p { max-width: 44ch; color: var(--muted); font-size: 1.05rem; }

/* --------------------------------------------------------------- responsive */
@media (max-width: 1000px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-aside { border-left: 0; padding-left: 0; padding-top: 6px; }
  .ledger { margin-left: 0; }
  .tool-head { grid-template-columns: 1fr; align-items: start; }
  .spec { max-width: 460px; }
  .faq-layout { grid-template-columns: 1fr; }
  .doc-grid { grid-template-columns: 1fr; }
  .toc { position: static; display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .toc strong { width: 100%; }
}

@media (max-width: 1040px) {
  .masthead-note { display: none; }
  .colophon-grid { grid-template-columns: 1fr 1fr; }
  .colophon-brand { grid-column: 1 / -1; }
}

@media (max-width: 860px) {
  .masthead-bar { padding-top: 2px; }
  .tool-nav { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
  .tool-nav::-webkit-scrollbar { display: none; }
  .tool-nav a { padding-block: 8px; }
  .index-list { grid-template-columns: 1fr; }
  .steps { grid-template-columns: 1fr; }
  .steps li { padding: 16px 0; border-right: 0; border-top: 1px solid var(--rule); }
  .steps li + li { padding-left: 0; }
  .steps li:first-child { border-top: 0; }
  .notes { grid-template-columns: 1fr; }
  .note-col { padding: 16px 0; border-right: 0; border-top: 1px solid var(--rule); }
  .note-col + .note-col { padding-left: 0; }
  .note-col:first-child { border-top: 0; }
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat:nth-child(2) { border-right: 0; }
  .stat:nth-child(-n+2) { border-bottom: 1px solid var(--rule); }
  .stat:nth-child(3) { padding-left: 0; }
}

@media (max-width: 720px) {
  .meta-nav { display: none; }
}

@media (max-width: 640px) {
  body { font-size: 1rem; }
  .masthead { padding-top: 12px; }
  .masthead-row { gap: 14px; }
  .display-1 { font-size: clamp(2.9rem, 13vw, 4.4rem); }
  .hero { padding-block: 26px 44px; }
  .hero-lede { margin-top: 16px; }
  .search-box { flex-wrap: wrap; }
  .search-box input { flex: 1 1 100%; border-bottom: 1px dotted var(--rule); padding: 15px 13px; }
  .search-box .paste { flex: 1 1 auto; border-left: 0; }
  .search-box .submit { flex: 2 1 auto; }
  .section-head { grid-template-columns: 1fr; gap: 8px; }
  .section-index { margin: 0; }
  .index-row a { grid-template-columns: 26px 26px minmax(0, 1fr) 14px; gap: 10px; padding: 14px 0 16px; }
  .index-row a:hover { padding-left: 0; }
  .item { grid-template-columns: 48px minmax(0, 1fr); }
  .item img, .thumb-fallback { width: 48px; height: 48px; }
  .item .btn { grid-column: 1 / -1; width: 100%; }
  .item .btn.ghost { grid-column: auto; width: auto; }
  .result { padding: 14px; }
  .install { align-items: flex-start; }
  .install .btn { width: 100%; }
  .colophon-grid { grid-template-columns: 1fr; }
  .colophon-bottom { flex-direction: column; }
  .stat-grid { grid-template-columns: 1fr; }
  .stat, .stat + .stat { padding: 15px 0; border-right: 0; border-bottom: 1px solid var(--rule); }
  .stat:last-child { border-bottom: 0; }
  .ledger { padding: 13px; }
  .doc-top .doc-nav { gap: 10px; }
  .doc-top .doc-nav a:not(:last-child) { display: none; }
  .search-hint { line-height: 1.9; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

@media print {
  body::before, .masthead-actions, .colophon, .toast, .search, .ticker { display: none !important; }
  body { background: #fff; color: #000; font-size: 11pt; }
  a { text-decoration: none; color: #000; }
  .hero, .section { padding-block: 12pt; }
}
`;
