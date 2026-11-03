/**
 * Public, versioned JSON API.
 *
 * This is the surface you hand to someone else: one endpoint, one stable
 * response shape, CORS open, no key. It reuses the same resolver and signed
 * proxy as the site, so there is nothing to keep in sync.
 *
 * /api/resolve and /api/search still exist for the site's own client script and
 * are deliberately *not* the documented contract: they return the internal
 * presenter shape and can change. /api/v1/* is the promise.
 */

import { Hono, type Context } from "hono";
import type { Bindings } from "../config";
import { brand, origin } from "../config";
import { clientIp, rateLimit } from "../lib/guard";
import { presentResult } from "../lib/present";
import { resolveInstagram, type ResolveFailure } from "../lib/resolver";
import { apiDocsPage } from "../views/api-docs";
import { statsPage } from "../views/stats-page";
import { readStats, track } from "../lib/stats";
import { DOWNLOAD_TTL_SECONDS } from "../lib/sign";

export const publicApi = new Hono<{ Bindings: Bindings }>();

const API_VERSION = "1";
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 600;
const MAX_INPUT = 2048;

const STATUS_BY_CODE: Record<string, number> = {
  invalid_url: 400,
  not_found: 404,
  private: 403,
  login_required: 401,
  rate_limited: 429,
  unsupported: 422,
  upstream_error: 502,
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
  "access-control-expose-headers":
    "x-api-version, x-request-id, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, retry-after",
  "access-control-max-age": "86400",
} as const;

// CORS on every response from this sub-app, including the docs page and errors.
publicApi.use("*", async (c, next) => {
  await next();
  const headers = c.res.headers;
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  headers.set("x-api-version", API_VERSION);
});

type Item = Awaited<ReturnType<typeof presentResult>>["items"][number];

function collectionType(items: Item[]): "video" | "image" | "carousel" | "mixed" {
  if (items.length === 1) return items[0].kind;
  const videos = items.filter((item) => item.kind === "video").length;
  if (videos === items.length) return "video";
  if (videos === 0) return "carousel";
  return "mixed";
}

function toIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function limitHeaders(
  result: { limit: number; remaining: number; resetAt: number },
  retryAfter?: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(Math.max(0, result.remaining)),
    "x-ratelimit-reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (retryAfter !== undefined) headers["retry-after"] = String(retryAfter);
  return headers;
}

type AppContext = Context<{ Bindings: Bindings }>;

async function readRequestBody(c: AppContext): Promise<{ url: string; fresh: boolean }> {
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      url: typeof body.url === "string" ? body.url : typeof body.q === "string" ? body.q : "",
      fresh: body.fresh === true || body.fresh === "1",
    };
  }

  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  return {
    url: String(form.url ?? form.q ?? ""),
    fresh: false,
  };
}

publicApi.options("/api/v1/*", () => new Response(null, { status: 204, headers: CORS }));
publicApi.options("/api/v1", () => new Response(null, { status: 204, headers: CORS }));

async function resolveHandler(c: AppContext) {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  const isPost = c.req.method === "POST";

  track(c, { api_calls: 1 });

  const input = isPost
    ? await readRequestBody(c)
    : { url: c.req.query("url") ?? c.req.query("q") ?? "", fresh: c.req.query("fresh") === "1" };

  if (!input.url.trim()) {
    return c.json(
      {
        ok: false,
        api: API_VERSION,
        error: {
          code: "invalid_url",
          message: "Pass ?url=<instagram link> or a JSON body of {\"url\":\"…\"}.",
          hint: "Example: /api/v1/resolve?url=https://www.instagram.com/p/C2VFqJMtui4/",
        },
        meta: { request_id: requestId, status: 400, took_ms: Date.now() - started },
      },
      400,
      { "cache-control": "no-store" },
    );
  }

  if (input.url.length > MAX_INPUT) {
    return c.json(
      {
        ok: false,
        api: API_VERSION,
        error: { code: "invalid_url", message: `Input is longer than ${MAX_INPUT} characters.`, hint: undefined },
        meta: { request_id: requestId, status: 400, took_ms: Date.now() - started },
      },
      400,
      { "cache-control": "no-store" },
    );
  }

  const ip = clientIp(c.req.raw);
  const limit = await rateLimit(c.env, `v1:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return c.json(
      {
        ok: false,
        api: API_VERSION,
        error: {
          code: "rate_limited",
          message: `Limit is ${limit.limit} requests per ${RATE_WINDOW_SECONDS / 60} minutes.`,
          hint: `Retry in ${retryAfter} seconds.`,
        },
        meta: { request_id: requestId, status: 429, took_ms: Date.now() - started },
      },
      429,
      { ...limitHeaders(limit, retryAfter), "cache-control": "no-store" },
    );
  }

  const resolved = await resolveInstagram(input.url, c.env, { fresh: input.fresh });

  if (!resolved.ok) {
    const failure: ResolveFailure = resolved;
    const status = STATUS_BY_CODE[failure.code] ?? 500;
    return c.json(
      {
        ok: false,
        api: API_VERSION,
        error: { code: failure.code, message: failure.message, hint: failure.hint ?? null },
        meta: {
          request_id: requestId,
          status,
          took_ms: Date.now() - started,
          tried: failure.tried,
        },
      },
      status as 400,
      {
        ...limitHeaders(limit),
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    );
  }

  const presented = await presentResult(resolved, c.env, origin(c.env, new URL(c.req.url)), brand(c.env));

  track(c, { resolves: 1 });

  const body = {
    ok: true,
    api: API_VERSION,
    data: {
      kind: resolved.kind,
      type: collectionType(presented.items),
      shortcode: resolved.shortcode ?? null,
      input: resolved.target,
      provider: resolved.provider,
      author: presented.author
        ? {
            username: presented.author.username ?? null,
            full_name: presented.author.fullName ?? null,
            avatar: presented.author.avatar ?? null,
          }
        : null,
      caption: presented.caption ?? null,
      warnings: presented.warnings,
      media: presented.items.map((item) => ({
        type: item.kind,
        label: item.label,
        quality: item.quality ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
        filename: item.filename,
        download: item.href,
        thumbnail: item.thumbnail ?? null,
        source: item.source,
      })),
      count: presented.items.length,
      expires_at: toIso(presented.expiresAt),
      fetched_at: presented.fetchedAt,
    },
    meta: {
      request_id: requestId,
      provider: resolved.provider,
      took_ms: Date.now() - started,
      rate_limit: {
        limit: limit.limit,
        remaining: Math.max(0, limit.remaining),
        reset_at: toIso(limit.resetAt / 1000),
      },
    },
  };

  return c.json(body, 200, {
    ...limitHeaders(limit),
    // Signed links are deterministic for a given expiry, so a short shared cache
    // is safe. `fresh=1` must never be cached.
    "cache-control": input.fresh ? "no-store" : "public, max-age=60",
    "x-request-id": requestId,
    "x-provider": resolved.provider,
  });
}

publicApi.get("/api/v1/resolve", resolveHandler);
publicApi.post("/api/v1/resolve", resolveHandler);

publicApi.get("/api/v1/health", (c) => {
  const env = c.env;
  return c.json(
    {
      ok: true,
      api: API_VERSION,
      brand: brand(env),
      time: new Date().toISOString(),
      providers: {
        embed: true,
        page: true,
        rest: true,
        graphql: true,
        "web-info": true,
        session: Boolean(env.IG_SESSIONID?.trim()),
      },
      stories: Boolean(env.IG_SESSIONID?.trim()),
      signing_key: Boolean(env.SIGNING_KEY?.trim()),
    },
    200,
    { "cache-control": "no-store" },
  );
});

publicApi.get("/api/v1", (c) =>
  c.json({
    ok: true,
    api: API_VERSION,
    name: `${brand(c.env)} API`,
    docs: `${origin(c.env, new URL(c.req.url))}/api`,
    openapi: `${origin(c.env, new URL(c.req.url))}/openapi.json`,
    endpoints: {
      resolve: "GET|POST /api/v1/resolve?url=<instagram link>",
      stats: "GET /api/v1/stats",
      health: "GET /api/v1/health",
    },
    rate_limit: { requests: RATE_LIMIT, window_seconds: RATE_WINDOW_SECONDS },
    link_ttl_seconds: DOWNLOAD_TTL_SECONDS,
  }),
);

// Public counters. Aggregates only, 60 second edge cache.
publicApi.get("/api/v1/stats", async (c) => {
  const snapshot = await readStats(c.env);
  return c.json({ ok: true, api: API_VERSION, data: snapshot }, 200, {
    "cache-control": "public, max-age=60",
  });
});

publicApi.get("/stats", async (c) => {
  const snapshot = await readStats(c.env);
  return c.html(
    statsPage({
      brand: brand(c.env),
      origin: origin(c.env, new URL(c.req.url)),
      snapshot,
    }),
    200,
    // HTML carries the asset fingerprint; never serve it from cache.
    { "cache-control": "no-store" },
  );
});

function openapiDocument(base: string, name: string) {
  const errorSchema = {
    type: "object",
    properties: {
      ok: { type: "boolean", const: false },
      api: { type: "string" },
      error: {
        type: "object",
        properties: {
          code: {
            type: "string",
            enum: [
              "invalid_url",
              "not_found",
              "private",
              "login_required",
              "rate_limited",
              "unsupported",
              "upstream_error",
            ],
          },
          message: { type: "string" },
          hint: { type: ["string", "null"] },
        },
        required: ["code", "message"],
      },
      meta: {
        type: "object",
        properties: {
          request_id: { type: "string" },
          status: { type: "integer" },
          took_ms: { type: "integer" },
          tried: { type: "array", items: { type: "string" } },
        },
      },
    },
  };

  const mediaItem = {
    type: "object",
    required: ["type", "label", "filename", "download", "source"],
    properties: {
      type: { type: "string", enum: ["video", "image"] },
      label: { type: "string" },
      quality: { type: ["string", "null"], example: "1080x1920 HD" },
      width: { type: ["integer", "null"] },
      height: { type: ["integer", "null"] },
      filename: { type: "string" },
      download: { type: "string", format: "uri", description: "Signed URL, valid until data.expires_at." },
      thumbnail: { type: ["string", "null"], format: "uri" },
      source: { type: "string", format: "uri", description: "Raw Instagram CDN URL. May expire." },
    },
  };

  const success = {
    type: "object",
    properties: {
      ok: { type: "boolean", const: true },
      api: { type: "string" },
      data: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["media", "story", "highlight", "profile"] },
          type: { type: "string", enum: ["video", "image", "carousel", "mixed"] },
          shortcode: { type: ["string", "null"] },
          input: { type: "string" },
          provider: { type: "string" },
          author: {
            type: ["object", "null"],
            properties: {
              username: { type: ["string", "null"] },
              full_name: { type: ["string", "null"] },
              avatar: { type: ["string", "null"] },
            },
          },
          caption: { type: ["string", "null"] },
          warnings: { type: "array", items: { type: "string" } },
          media: { type: "array", items: mediaItem },
          count: { type: "integer" },
          expires_at: { type: "string", format: "date-time" },
          fetched_at: { type: "string", format: "date-time" },
        },
      },
      meta: {
        type: "object",
        properties: {
          request_id: { type: "string" },
          provider: { type: "string" },
          took_ms: { type: "integer" },
          rate_limit: {
            type: "object",
            properties: {
              limit: { type: "integer" },
              remaining: { type: "integer" },
              reset_at: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: `${name} API`,
      version: API_VERSION,
      description:
        "Turn a public Instagram link into signed, direct download URLs. No API key. Public posts only; stories and private accounts require an Instagram session that this API does not expose.",
      license: { name: "All rights reserved" },
    },
    servers: [{ url: base }],
    paths: {
      "/api/v1/resolve": {
        get: {
          operationId: "resolveGet",
          summary: "Resolve an Instagram link",
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string", maxLength: MAX_INPUT },
              example: "https://www.instagram.com/reel/DNA7Vi9IZWS/",
            },
            {
              name: "fresh",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["1"] },
              description: "Bypass the 10 minute resolve cache.",
            },
          ],
          responses: {
            "200": {
              description: "Resolved",
              content: { "application/json": { schema: success } },
            },
            "400": { description: "invalid_url", content: { "application/json": { schema: errorSchema } } },
            "401": { description: "login_required", content: { "application/json": { schema: errorSchema } } },
            "403": { description: "private", content: { "application/json": { schema: errorSchema } } },
            "404": { description: "not_found", content: { "application/json": { schema: errorSchema } } },
            "429": { description: "rate_limited", content: { "application/json": { schema: errorSchema } } },
            "502": { description: "upstream_error", content: { "application/json": { schema: errorSchema } } },
          },
        },
        post: {
          operationId: "resolvePost",
          summary: "Resolve an Instagram link (JSON body)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string", maxLength: MAX_INPUT },
                    fresh: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Resolved", content: { "application/json": { schema: success } } },
            "400": { description: "invalid_url", content: { "application/json": { schema: errorSchema } } },
            "429": { description: "rate_limited", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/v1/health": {
        get: {
          operationId: "health",
          summary: "Deployment status",
          responses: { "200": { description: "OK" } },
        },
      },
      "/api/v1/stats": {
        get: {
          operationId: "stats",
          summary: "Public aggregate counters",
          description:
            "Totals since the first counted event, today's counters and the last seven days. No per-visitor data.",
          responses: { "200": { description: "Counters" } },
        },
      },
    },
    components: {
      schemas: { ResolveSuccess: success, Error: errorSchema, MediaItem: mediaItem },
    },
  };
}

publicApi.get("/openapi.json", (c) =>
  c.json(openapiDocument(origin(c.env, new URL(c.req.url)), brand(c.env)), 200, {
    "cache-control": "public, max-age=300",
  }),
);

publicApi.get("/api", (c) =>
  c.html(
    apiDocsPage({
      brand: brand(c.env),
      origin: origin(c.env, new URL(c.req.url)),
      version: API_VERSION,
      limit: RATE_LIMIT,
      windowMinutes: RATE_WINDOW_SECONDS / 60,
      ttlMinutes: DOWNLOAD_TTL_SECONDS / 60,
    }),
    200,
    // HTML carries the asset fingerprint; never serve it from cache.
    { "cache-control": "no-store" },
  ),
);

publicApi.get("/api/", (c) => c.redirect("/api", 301));
