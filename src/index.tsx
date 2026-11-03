import { Hono } from "hono";
import type { Bindings } from "./config";
import { brand, origin } from "./config";
import { api } from "./routes/api";
import { publicApi } from "./routes/public-api";
import { assets } from "./routes/assets";
import { pages, pickLocale } from "./routes/pages";
import { getDictionary } from "./i18n";
import { NotFoundPage } from "./views/pages";
import { track } from "./lib/stats";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  await next();

  const headers = c.res.headers;
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");

  if (!headers.has("content-security-policy")) {
    headers.set(
      "content-security-policy",
      [
        "default-src 'self'",
        "img-src 'self' https: data:",
        "media-src 'self' https: blob:",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "font-src 'self' data:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  }

  // Page views: HTML 200s only, and never the API/docs surfaces.
  const contentType = c.res.headers.get("content-type") ?? "";
  if (
    c.req.method === "GET" &&
    c.res.status === 200 &&
    contentType.includes("text/html") &&
    !c.req.path.startsWith("/api")
  ) {
    track(c, { page_views: 1 });
  }
});

// Order matters: API and static assets are matched before the /:locale catch-all.
app.route("/", api);
app.route("/", publicApi);
app.route("/", assets);
app.route("/", pages);

app.notFound((c) => {
  const locale = pickLocale(c.req.header("accept-language"));
  return c.html(
    <NotFoundPage
      brand={brand(c.env)}
      origin={origin(c.env, new URL(c.req.url))}
      locale={locale}
      dict={getDictionary(locale)}
    />,
    404,
    { "cache-control": "no-store" },
  );
});

app.onError((error, c) => {
  const wantsJson = c.req.path.startsWith("/api/") || (c.req.header("accept") ?? "").includes("application/json");
  console.error("unhandled", c.req.method, c.req.path, error instanceof Error ? error.stack : error);

  if (wantsJson) {
    return c.json({ ok: false, code: "upstream_error", message: "The Worker threw an unexpected error." }, 500);
  }
  return c.text(`${brand(c.env)} had an internal error. Try again.`, 500);
});

export default app;
