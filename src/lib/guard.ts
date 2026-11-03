import type { Bindings } from "../config";

/**
 * Abuse control for /api/search.
 *
 * Two layers: a per-isolate in-memory bucket (free, catches bursts) and an
 * optional KV bucket (cross-isolate, survives deploys). Turnstile is used when
 * TURNSTILE_SECRET is set, and skipped when it is not so local dev stays easy.
 */

type Bucket = { count: number; resetAt: number };

const memory = new Map<string, Bucket>();
const MEMORY_LIMIT = 5000;

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number; limit: number };

export async function rateLimit(
  env: Bindings,
  key: string,
  limit = 20,
  windowSeconds = 600,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (env.RATE_LIMIT) {
    try {
      const stored = await env.RATE_LIMIT.get<Bucket>(key, "json");
      if (!stored || stored.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs };
        await env.RATE_LIMIT.put(key, JSON.stringify(fresh), { expirationTtl: windowSeconds });
        return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt, limit };
      }
      if (stored.count >= limit) {
        return { ok: false, remaining: 0, resetAt: stored.resetAt, limit };
      }
      const next = { count: stored.count + 1, resetAt: stored.resetAt };
      await env.RATE_LIMIT.put(key, JSON.stringify(next), {
        expirationTtl: Math.max(60, Math.ceil((stored.resetAt - now) / 1000)),
      });
      return { ok: true, remaining: limit - next.count, resetAt: next.resetAt, limit };
    } catch {
      /* fall through to memory */
    }
  }

  if (memory.size > MEMORY_LIMIT) memory.clear();
  const bucket = memory.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    memory.set(key, fresh);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt, limit };
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt, limit };
  }
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt, limit };
}

export async function verifyTurnstile(
  env: Bindings,
  token: string | undefined,
  remoteIp: string,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = env.TURNSTILE_SECRET?.trim();
  if (!secret) return { ok: true };
  if (!token) return { ok: false, reason: "missing_token" };

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(6000),
    });
    const payload = (await response.json().catch(() => null)) as { success?: boolean; "error-codes"?: string[] } | null;
    if (payload?.success) return { ok: true };
    return { ok: false, reason: payload?.["error-codes"]?.join(",") ?? "rejected" };
  } catch {
    return { ok: false, reason: "verify_unreachable" };
  }
}
