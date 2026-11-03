/**
 * Signed download links.
 *
 * Media CDs URLs are long-lived-ish but should not be handed out raw: an
 * unsigned proxy is an open proxy. Every /api/dl link carries an HMAC of
 * (target, expiry) so only links we minted can be fetched.
 */

const FALLBACK_KEY = "savereel-dev-key-do-not-use-in-production";

export const DOWNLOAD_TTL_SECONDS = 30 * 60;

function toBase64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signPayload(secret: string | undefined, payload: string): Promise<string> {
  const key = await hmacKey(secret?.trim() || FALLBACK_KEY);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(signature);
}

export type SignedLink = { href: string; expiresAt: number };

export async function createDownloadLink(options: {
  secret: string | undefined;
  base: string;
  target: string;
  filename: string;
  ttlSeconds?: number;
}): Promise<SignedLink> {
  const ttl = options.ttlSeconds ?? DOWNLOAD_TTL_SECONDS;
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const signature = await signPayload(options.secret, `${options.target}|${expiresAt}`);

  const url = new URL("/api/dl", options.base);
  url.searchParams.set("u", options.target);
  url.searchParams.set("e", String(expiresAt));
  url.searchParams.set("n", options.filename);
  url.searchParams.set("s", signature);

  return { href: url.toString(), expiresAt };
}

export async function verifyDownloadLink(
  secret: string | undefined,
  target: string,
  expiresAt: number,
  signature: string,
): Promise<{ ok: true } | { ok: false; reason: "expired" | "bad_signature" }> {
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  const expected = await signPayload(secret, `${target}|${expiresAt}`);
  if (expected.length !== signature.length) return { ok: false, reason: "bad_signature" };

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0 ? { ok: true } : { ok: false, reason: "bad_signature" };
}

export function safeFilename(input: string): string {
  const cleaned = input
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "instagram-media";
}
