import type { Child } from "hono/jsx";
import { LOCALES, DEFAULT_LOCALE, TOOLS } from "../config";
import type { Dictionary } from "../i18n/en";
import { Mark } from "./artwork";
import { CSS_URL, JS_URL } from "../lib/version";

export type LayoutProps = {
  brand: string;
  origin: string;
  locale: string;
  title: string;
  description: string;
  path: string;
  dict: Dictionary;
  noindex?: boolean;
  active?: string;
  jsonLd?: Record<string, unknown>[];
  children: Child;
};

function Wordmark({ brand, href }: { brand: string; href?: string }) {
  const inner = (
    <>
      <Mark size={28} />
      <span class="wordmark-text">
        {brand}
        <span class="wordmark-dot">.</span>
      </span>
    </>
  );
  return href ? (
    <a class="wordmark" href={href} aria-label={brand}>
      {inner}
    </a>
  ) : (
    <span class="wordmark">{inner}</span>
  );
}

function LocaleMenu({ locale, dict }: { locale: string; dict: Dictionary }) {
  return (
    <details class="menu locale-menu">
      <summary aria-label={dict.nav.language}>
        {LOCALES.find((item) => item.code === locale)?.label ?? locale}
      </summary>
      <div class="menu-panel">
        {LOCALES.map((item) =>
          item.enabled ? (
            <a href={`/${item.code}`} class={item.code === locale ? "is-active" : ""}>
              {item.label}
            </a>
          ) : (
            <span class="is-disabled">
              {item.label} <em>{dict.nav.more}</em>
            </span>
          ),
        )}
      </div>
    </details>
  );
}

function Header({ brand, locale, dict, active }: { brand: string; locale: string; dict: Dictionary; active?: string }) {
  return (
    <header class="masthead">
      <div class="wrap masthead-row">
        <Wordmark brand={brand} href={`/${locale}`} />
        <p class="masthead-note">
          Instagram media, saved
          <br />
          No account · no app
        </p>
        <div class="masthead-actions">
          <nav class="meta-nav" aria-label={dict.nav.help}>
            <a href="/stats">{dict.stats.full}</a>
            <a href="/api">API</a>
            <a href={`/${locale}/help`}>{dict.nav.help}</a>
          </nav>
          <LocaleMenu locale={locale} dict={dict} />
        </div>
      </div>

      <div class="wrap">
        <div class="rule-double" role="presentation" />
      </div>

      <div class="wrap masthead-bar">
        <nav class="tool-nav" aria-label={dict.nav.tools}>
          {TOOLS.map((tool, index) => (
            <a href={`/${locale}/${tool.slug}`} class={active === tool.key ? "is-active" : ""}>
              <span class="nav-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              {tool.nav}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Footer({ brand, locale, dict }: { brand: string; locale: string; dict: Dictionary }) {
  return (
    <footer class="colophon">
      <div class="wrap colophon-grid">
        <div class="colophon-brand">
          <Wordmark brand={brand} href={`/${locale}`} />
          <p>{dict.footer.tagline}</p>
          <p class="mono">{dict.footer.colophon}</p>
        </div>
        <div>
          <h3>{dict.footer.index}</h3>
          <ul>
            {TOOLS.map((tool) => (
              <li>
                <a href={`/${locale}/${tool.slug}`}>{tool.title}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{dict.footer.elsewhere}</h3>
          <ul>
            <li><a href={`/${locale}/help`}>{dict.nav.help}</a></li>
            <li><a href="/stats">{dict.stats.full}</a></li>
            <li><a href="/api">API</a></li>
            <li><a href="/api/v1/stats">Stats JSON</a></li>
            <li><a href={`/${locale}/about-us`}>About</a></li>
            <li><a href={`/${locale}/contact`}>Contact</a></li>
            <li><a href={`/${locale}/terms-of-service`}>Terms of Service</a></li>
            <li><a href={`/${locale}/privacy-policy`}>Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      <div class="wrap colophon-bottom">
        <p>{dict.footer.disclaimer}</p>
        <p>
          © {new Date().getFullYear()} {brand}. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}

export function Layout(props: LayoutProps) {
  const { brand, origin, locale, title, description, path, dict, noindex, active, jsonLd, children } = props;
  const canonical = `${origin}/${locale}${path}`;
  const enabled = LOCALES.filter((item) => item.enabled);

  return (
    <html lang={locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"} />
        <link rel="canonical" href={canonical} />
        {enabled.map((item) => (
          <link rel="alternate" hreflang={item.code} href={`${origin}/${item.code}${path}`} />
        ))}
        <link rel="alternate" hreflang="x-default" href={`${origin}/${DEFAULT_LOCALE}${path}`} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={brand} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={`${origin}/og.svg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${origin}/og.svg`} />
        <meta name="theme-color" content="#f3eee2" />
        <meta name="color-scheme" content="light" />

        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preload" href="/fonts/instrument-serif-regular.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        <link rel="preload" href="/fonts/newsreader-var.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        <link rel="stylesheet" href={CSS_URL} />

        {jsonLd?.map((block) => (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
        ))}
      </head>
      <body id="top">
        <a class="skip" href="#main">
          Skip to content
        </a>
        <Header brand={brand} locale={locale} dict={dict} active={active} />
        <main id="main">{children}</main>
        <Footer brand={brand} locale={locale} dict={dict} />
        <div id="toast" class="toast" role="status" aria-live="polite" />
        <script
          id="app-config"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              tool: active ?? "video",
              locale,
              strings: {
                ready: dict.result.ready,
                expires: dict.result.expires,
                author: dict.result.author,
                audio: dict.result.audio,
                audioBusy: dict.result.audioBusy,
                submit: dict.hero.submit,
                save: dict.result.save,
                busy: dict.hero.submitBusy,
                paste: dict.hero.paste,
                clear: dict.hero.clear,
                invalid_url: dict.errors.invalid_url,
                not_found: dict.errors.not_found,
                private: dict.errors.private,
                login_required: dict.errors.login_required,
                rate_limited: dict.errors.rate_limited,
                unsupported: dict.errors.unsupported,
                upstream_error: dict.errors.upstream_error,
                network: dict.errors.network,
                turnstile: dict.errors.turnstile,
              },
            }),
          }}
        />
        <script src={JS_URL} defer />
      </body>
    </html>
  );
}
