import { Hono } from "hono";
import type { HonoRequest } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import type { Bindings } from "../config";
import {
  LOCALES,
  DEFAULT_LOCALE,
  STATIC_BY_SLUG,
  TOOL_BY_SLUG,
  brand,
  origin,
} from "../config";
import { getDictionary, isLocaleReady } from "../i18n";
import { resolveInstagram } from "../lib/resolver";
import { presentResult } from "../lib/present";
import { readStats, readStatsCached, track } from "../lib/stats";
import { HomePage, StaticView, ToolPage } from "../views/pages";

export const pages = new Hono<{ Bindings: Bindings }>();

pages.use("*", trimTrailingSlash());

type LocaleGate =
  | { locale: string }
  | { redirect: string; status: 301 | 302 | 303 }
  | { missing: true };

/** Case-corrects /EN -> /en and sends not-yet-shipped locales to English. */
function gateLocale(input: string, suffix: string, method = "GET"): LocaleGate {
  const lower = input.toLowerCase();

  if (input !== lower && LOCALES.some((item) => item.code === lower)) {
    return { redirect: `/${lower}${suffix}`, status: 301 };
  }
  if (isLocaleReady(input)) return { locale: input };
  if (LOCALES.some((item) => item.code === input)) {
    return { redirect: `/${DEFAULT_LOCALE}${suffix}`, status: method === "GET" ? 302 : 303 };
  }
  return { missing: true };
}

export function pickLocale(header: string | undefined): string {
  if (!header) return DEFAULT_LOCALE;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const item of wanted) {
    const exact = LOCALES.find((locale) => locale.enabled && locale.code === item.tag);
    if (exact) return exact.code;
    const base = item.tag.split("-")[0];
    const partial = LOCALES.find((locale) => locale.enabled && locale.code === base);
    if (partial) return partial.code;
  }
  return DEFAULT_LOCALE;
}

function stylesFor(locale: string): Record<string, string> {
  // Rendered per request (live ledger, "last updated", asset fingerprint), so
  // never let a browser or edge reuse the HTML with a newer stylesheet.
  return {
    "content-language": locale,
    "cache-control": "no-store",
  };
}

pages.get("/", (c) => c.redirect(`/${pickLocale(c.req.header("accept-language"))}`, 302));

async function readQuery(req: HonoRequest): Promise<string> {
  try {
    const body = await req.parseBody();
    const value = body.q ?? body.url;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

pages.post("/:locale", async (c) => {
  const gate = gateLocale(c.req.param("locale"), "", "POST");
  if ("redirect" in gate) return c.redirect(gate.redirect, gate.status);
  if ("missing" in gate) return c.notFound();

  const locale = gate.locale;
  const dict = getDictionary(locale);
  const query = await readQuery(c.req);
  const resolved = await resolveInstagram(query, c.env);
  const presented = resolved.ok
    ? await presentResult(resolved, c.env, origin(c.env, new URL(c.req.url)), brand(c.env))
    : undefined;
  // Same rule as the JSON API: a link only counts once it actually resolved.
  if (resolved.ok) track(c, { resolves: 1 });
  const stats = await readStats(c.env);

  c.header("cache-control", "no-store");
  return c.html(
    <HomePage
      brand={brand(c.env)}
      origin={origin(c.env, new URL(c.req.url))}
      locale={locale}
      dict={dict}
      query={query}
      result={presented}
      stats={stats}
      error={resolved.ok ? undefined : { message: resolved.message, hint: resolved.hint }}
    />,
  );
});

pages.get("/:locale", async (c) => {
  const gate = gateLocale(c.req.param("locale"), "");
  if ("redirect" in gate) return c.redirect(gate.redirect, gate.status);
  if ("missing" in gate) return c.notFound();

  const locale = gate.locale;
  const dict = getDictionary(locale);
  const stats = await readStatsCached(c.env);

  // Not edge-cached on purpose: the ledger on the page has to be the same
  // numbers /api/v1/stats is reporting right now.
  return c.html(
    <HomePage
      brand={brand(c.env)}
      origin={origin(c.env, new URL(c.req.url))}
      locale={locale}
      dict={dict}
      stats={stats}
    />,
    200,
    { "content-language": locale, vary: "Accept-Language, Cookie", "cache-control": "no-store" },
  );
});

pages.post("/:locale/:slug", async (c) => {
  const slug = c.req.param("slug");
  const tool = TOOL_BY_SLUG.get(slug);
  if (!tool) return c.notFound();

  const gate = gateLocale(c.req.param("locale"), `/${slug}`, "POST");
  if ("redirect" in gate) return c.redirect(gate.redirect, gate.status);
  if ("missing" in gate) return c.notFound();

  const locale = gate.locale;
  const dict = getDictionary(locale);
  const query = await readQuery(c.req);
  const resolved = await resolveInstagram(query, c.env);
  const presented = resolved.ok
    ? await presentResult(resolved, c.env, origin(c.env, new URL(c.req.url)), brand(c.env))
    : undefined;
  if (resolved.ok) track(c, { resolves: 1 });

  c.header("cache-control", "no-store");
  return c.html(
    <ToolPage
      brand={brand(c.env)}
      origin={origin(c.env, new URL(c.req.url))}
      locale={locale}
      dict={dict}
      tool={tool}
      query={query}
      result={presented}
      error={resolved.ok ? undefined : { message: resolved.message, hint: resolved.hint }}
    />,
  );
});

pages.get("/:locale/:slug", (c) => {
  const slug = c.req.param("slug");
  const gate = gateLocale(c.req.param("locale"), `/${slug}`);
  if ("redirect" in gate) return c.redirect(gate.redirect, gate.status);
  if ("missing" in gate) return c.notFound();

  const locale = gate.locale;
  const dict = getDictionary(locale);
  const base = {
    brand: brand(c.env),
    origin: origin(c.env, new URL(c.req.url)),
    locale,
    dict,
  };

  const tool = TOOL_BY_SLUG.get(slug);
  if (tool) return c.html(<ToolPage {...base} tool={tool} />, 200, stylesFor(locale));

  if (STATIC_BY_SLUG.has(slug)) return c.html(<StaticView {...base} slug={slug} />, 200, stylesFor(locale));

  return c.notFound();
});
