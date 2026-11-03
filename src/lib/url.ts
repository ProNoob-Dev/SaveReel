/**
 * Instagram URL parsing.
 *
 * Accepts every link shape the app produces: post, reel, reels, tv, stories,
 * highlights, bare profile, share/ redirect links, and a bare @username.
 */

export type IgTarget =
  | { kind: "media"; shortcode: string; surface: "p" | "reel" | "tv" }
  | { kind: "story"; username: string; storyId: string }
  | { kind: "highlight"; id: string }
  | { kind: "profile"; username: string }
  | { kind: "share"; url: string };

const ALLOWED_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
  "i.instagram.com",
  "instagr.am",
  "www.instagr.am",
  "l.instagram.com",
]);

const RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "stories",
  "explore",
  "accounts",
  "direct",
  "about",
  "legal",
  "developer",
  "api",
  "emails",
  "web",
  "challenge",
  "session",
]);

const SHORTCODE = /^[A-Za-z0-9_-]{5,32}$/;
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

export function normaliseInput(raw: string): string {
  const value = raw.trim().replace(/^["'<]+|["'>]+$/g, "");
  if (!value) return "";
  if (/^@?[A-Za-z0-9._]{1,30}$/.test(value)) return value.replace(/^@/, "");
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

export function parseInstagramUrl(raw: string): IgTarget | null {
  const value = normaliseInput(raw);
  if (!value) return null;

  // Bare username / @handle
  if (!value.includes("/") && !value.includes(".")) {
    return USERNAME.test(value) ? { kind: "profile", username: value.toLowerCase() } : null;
  }
  if (!/^https?:\/\//i.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase()) && !ALLOWED_HOSTS.has(host)) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts[0] === "share" || host === "l.instagram.com") {
    return { kind: "share", url: url.toString() };
  }

  if (parts[0] === "stories") {
    if (parts[1] === "highlights" && parts[2]) {
      return { kind: "highlight", id: parts[2] };
    }
    const username = parts[1]?.toLowerCase();
    if (username && USERNAME.test(username)) {
      return { kind: "story", username, storyId: parts[2] ?? "" };
    }
    return null;
  }

  if (parts[0] === "p" || parts[0] === "reel" || parts[0] === "reels" || parts[0] === "tv") {
    const shortcode = parts[1];
    if (!shortcode || !SHORTCODE.test(shortcode)) return null;
    const surface = parts[0] === "tv" ? "tv" : parts[0] === "p" ? "p" : "reel";
    return { kind: "media", shortcode, surface };
  }

  // /username/p/CODE and /username/reel/CODE
  if (parts.length >= 3 && (parts[1] === "p" || parts[1] === "reel" || parts[1] === "tv")) {
    const shortcode = parts[2];
    if (!shortcode || !SHORTCODE.test(shortcode)) return null;
    return {
      kind: "media",
      shortcode,
      surface: parts[1] === "tv" ? "tv" : parts[1] === "p" ? "p" : "reel",
    };
  }

  const username = parts[0]?.toLowerCase();
  if (username && USERNAME.test(username) && !RESERVED.has(username)) {
    return { kind: "profile", username };
  }

  return null;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Instagram shortcode -> numeric media pk. Pure base64, no crypto. */
export function shortcodeToMediaId(shortcode: string): string {
  let value = 0n;
  for (const char of shortcode) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return "";
    value = value * 64n + BigInt(digit);
  }
  return value.toString();
}

export function isInstagramCdn(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return (
      host.endsWith(".cdninstagram.com") ||
      host.endsWith(".fbcdn.net") ||
      host === "instagram.com" ||
      host.endsWith(".instagram.com")
    );
  } catch {
    return false;
  }
}

/** Strip query strings Instagram uses for tracking, so cache keys stay stable. */
export function canonicalMediaUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of ["_nc_ht", "_nc_cat", "_nc_sid", "igsh", "igshid", "utm_source", "utm_medium"]) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return raw;
  }
}
