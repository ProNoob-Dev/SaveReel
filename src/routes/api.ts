import { Hono } from "hono";
import type { Bindings } from "../config";
import { brand } from "../config";
import { resolveInstagram } from "../lib/resolver";
import { presentResult } from "../lib/present";
import { clientIp, rateLimit, verifyTurnstile } from "../lib/guard";
import { verifyDownloadLink } from "../lib/sign";
import { isInstagramCdn } from "../lib/url";
import { track } from "../lib/stats";

export const api = new Hono<{ Bindings: Bindings }>();

const STATUS_BY_CODE: Record<string, number> = {
  invalid_url: 400,
  not_found: 404,
  private: 403,
  login_required: 401,
  rate_limited: 429,
  unsupported: 422,
  upstream_error: 502,
};

async function readInput(request: Request): Promise<{ q: string; token: string | undefined }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      q: typeof body.q === "string" ? body.q : typeof body.url === "string" ? body.url : "",
      token: typeof body.token === "string" ? body.token : typeof body["cf-turnstile-response"] === "string" ? (body["cf-turnstile-response"] as string) : undefined,
    };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return { q: "", token: undefined };
  const token = form.get("token") ?? form.get("cf-turnstile-response");
  return {
    q: String(form.get("q") ?? form.get("url") ?? ""),
    token: typeof token === "string" ? token : undefined,
  };
}

api.post("/api/search", async (c) => {
  const ip = clientIp(c.req.raw);
  const limit = await rateLimit(c.env, `search:${ip}`, 20, 600);
  if (!limit.ok) {
    return c.json(
      {
        ok: false,
        code: "rate_limited",
        message: "Too many searches. Wait a minute and try again.",
        retryAfter: Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)),
      },
      429,
      { "retry-after": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) },
    );
  }

  const { q, token } = await readInput(c.req.raw);
  if (!q.trim()) {
    return c.json({ ok: false, code: "invalid_url", message: "Paste an Instagram link first." }, 400);
  }

  const challenge = await verifyTurnstile(c.env, token, ip);
  if (!challenge.ok) {
    return c.json({ ok: false, code: "unsupported", message: "Verification failed.", detail: challenge.reason }, 403);
  }

  const resolved = await resolveInstagram(q, c.env);
  if (!resolved.ok) {
    return c.json(
      {
        ok: false,
        code: resolved.code,
        message: resolved.message,
        hint: resolved.hint,
        tried: resolved.tried,
      },
      (STATUS_BY_CODE[resolved.code] ?? 500) as 400,
    );
  }

  const presented = await presentResult(resolved, c.env, new URL(c.req.url).origin, brand(c.env));
  track(c, { resolves: 1 });
  return c.json({ ok: true, result: presented }, 200, {
    "cache-control": "no-store",
    "x-provider": resolved.provider,
    "x-ratelimit-remaining": String(limit.remaining),
  });
});

api.get("/api/resolve", async (c) => {
  const q = c.req.query("q") ?? "";
  if (!q) return c.json({ ok: false, code: "invalid_url", message: "Pass ?q=<instagram url>" }, 400);

  const ip = clientIp(c.req.raw);
  const limit = await rateLimit(c.env, `resolve:${ip}`, 20, 600);
  if (!limit.ok) return c.json({ ok: false, code: "rate_limited", message: "Slow down." }, 429);

  const resolved = await resolveInstagram(q, c.env, { fresh: c.req.query("fresh") === "1" });
  if (!resolved.ok) {
    return c.json(resolved, (STATUS_BY_CODE[resolved.code] ?? 500) as 400);
  }
  const presented = await presentResult(resolved, c.env, new URL(c.req.url).origin, brand(c.env));
  track(c, { resolves: 1 });
  return c.json({ ok: true, result: presented });
});

api.get("/api/dl", async (c) => {
  const target = c.req.query("u");
  const expiresAt = Number(c.req.query("e"));
  const signature = c.req.query("s") ?? "";
  const filename = c.req.query("n") ?? "instagram-media";

  if (!target) return c.text("Missing target", 400);
  if (!isInstagramCdn(target)) return c.text("Target host is not allowed", 400);
  if (/\\/.test(target)) return c.text("Malformed target", 400);

  const check = await verifyDownloadLink(c.env.SIGNING_KEY, target, expiresAt, signature);
  if (!check.ok) {
    return c.text(check.reason === "expired" ? "This download link has expired. Run the search again." : "Invalid download link.", 403);
  }

  const headers: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    accept: "*/*",
  };
  const range = c.req.header("range");
  if (range) headers.range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers,
      redirect: "follow",
      cf: { cacheEverything: true, cacheTtl: 3600 },
    });
  } catch {
    return c.text("Could not reach the media host.", 502);
  }

  if (!upstream.ok && upstream.status !== 206) {
    return c.text(`Media host responded ${upstream.status}.`, 502);
  }

  const out = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) out.set("content-type", contentType);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) out.set("content-length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) out.set("content-range", contentRange);
  out.set("accept-ranges", "bytes");
  out.set("cache-control", "private, max-age=600");
  out.set(
    "content-disposition",
    `attachment; filename="${filename.replace(/["\\\r\n]/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  out.set("x-content-type-options", "nosniff");
  out.set("access-control-allow-origin", "*");

  // Count the transfer, not the request: one row per file actually served.
  if (c.req.method !== "HEAD") {
    const kind = (contentType ?? "").startsWith("video/") ? "video" : "image";
    track(c, { downloads: 1, bytes: Number(contentLength ?? 0) || 0, [`download_${kind}`]: 1 });
  }

  return new Response(c.req.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
});

api.get("/api/health", (c) => {
  const env = c.env;
  return c.json({
    ok: true,
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
    turnstile: Boolean(env.TURNSTILE_SECRET?.trim()),
    signingKey: Boolean(env.SIGNING_KEY?.trim()),
  });
});
