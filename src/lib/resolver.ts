/**
 * Instagram media resolver.
 *
 * Workers cannot run yt-dlp, so resolution is a chain of plain HTTP strategies,
 * cheapest and least privileged first. Each one is lifted from a maintained
 * open-source extractor rather than guessed:
 *
 *   1. embed    yt-dlp's `contextJSON` scrape of /{p|reel}/{code}/embed/captioned/.
 *               No auth, one small HTML page, richest payload.
 *   2. page     yt-dlp's fallback: parse the post page's <script data-sjs>
 *               islands for `xig_polaris_media`. Same data, different route,
 *               so it survives when the embed endpoint is throttled.
 *   3. rest     gallery-dl's `/api/v1/media/{pk}/info/` call, including its
 *               trick of minting our own csrftoken instead of needing a real
 *               browsing session.
 *   4. graphql  yt-dlp's logged-out GraphQL query: bootstrap an `lsd` token and
 *               csrftoken from the homepage, then POST /api/graphql.
 *   5. session  the private mobile API using an optional IG_SESSIONID secret.
 *               The only path that reaches stories, highlights and private
 *               accounts the session follows.
 *
 * There is deliberately no third-party API provider: everything below is
 * key-free. What that buys and costs is documented in README.md.
 */

import type { Bindings } from "../config";
import {
  extractEmbedContext,
  mediaFromContext,
  mediaFromProduct,
  metaImage,
  productFromPostPage,
  profileFromPage,
  qualityLabel,
  type ParsedMedia,
  type ProductItem,
} from "./ig-parse";
import { isInstagramCdn, parseInstagramUrl, shortcodeToMediaId, type IgTarget } from "./url";

export type ProviderId = "embed" | "page" | "rest" | "graphql" | "web-info" | "session";
export type FailureCode =
  | "invalid_url"
  | "not_found"
  | "private"
  | "login_required"
  | "rate_limited"
  | "unsupported"
  | "upstream_error";

export type MediaItem = {
  kind: "video" | "image";
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  label: string;
  quality?: string;
};

export type Author = { username?: string; fullName?: string; avatar?: string };

export type ResolveSuccess = {
  ok: true;
  provider: ProviderId;
  target: string;
  kind: "media" | "story" | "highlight" | "profile";
  shortcode?: string;
  author?: Author;
  caption?: string;
  items: MediaItem[];
  fetchedAt: string;
  warnings: string[];
};

export type ResolveFailure = {
  ok: false;
  code: FailureCode;
  message: string;
  hint?: string;
  tried: ProviderId[];
};

export type ResolveResult = ResolveSuccess | ResolveFailure;

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229237)";
const IG_APP_ID = "936619743392459";
/** yt-dlp, `_real_initialize` + `api/graphql`, 2026. */
const GRAPHQL_DOC_ID = "27130156389949648";
const GRAPHQL_FRIENDLY = "PolarisLoggedOutDesktopWWWPostRootContentQuery";
const TIMEOUT_MS = 9000;
const CACHE_TTL_SECONDS = 600;

class ProviderError extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// ---------------------------------------------------------------- http helpers

async function igFetch(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  return fetch(url, {
    ...init,
    redirect: init.redirect ?? "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": DESKTOP_UA,
      "accept-language": "en-US,en;q=0.9",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

function looksLikeLoginWall(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  return (
    body.includes('"require_login":true') ||
    body.includes("accounts/login") ||
    body.includes('id="loginForm"') ||
    body.includes("You must log in to continue")
  );
}

async function jsonBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return null;
  return response.json().catch(() => null);
}

function randomToken(length = 32): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

/**
 * gallery-dl mints its own csrftoken and sends `x-ig-www-claim: 0`, which is
 * accepted by the anonymous REST API. No cookie jar, no login.
 */
function anonymousHeaders(csrf: string, referer = "https://www.instagram.com/"): Record<string, string> {
  return {
    "user-agent": DESKTOP_UA,
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "x-ig-app-id": IG_APP_ID,
    "x-asbd-id": "129477",
    "x-ig-www-claim": "0",
    "x-csrftoken": csrf,
    "x-requested-with": "XMLHttpRequest",
    origin: "https://www.instagram.com",
    referer,
    cookie: `csrftoken=${csrf}`,
  };
}

/** Escaped payloads can leave stray backslashes behind; URLs never contain them. */
function cleanUrl(raw: string): string {
  return raw.replace(/\\+/g, "").trim();
}

function decodeEntities(input: string): string {
  let out = input.replace(/\\+"/g, '"').replace(/\\+\//g, "/");
  for (let pass = 0; pass < 2; pass += 1) {
    out = out.replace(/\\+u([0-9a-fA-F]{4})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  }
  return out
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function unescapeJsonString(input: string): string {
  return input
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanUrl(decodeEntities(match[1]));
  }
  return undefined;
}

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

// ------------------------------------------------------------- embed provider

/**
 * Regex fallback for embeds that carry no `contextJSON` (older markup, or a
 * partial render). Kept because it is the only thing that works when Instagram
 * trims the payload.
 */
export function parseEmbedFallback(html: string): ParsedMedia {
  const text = decodeEntities(html);

  const videoUrls = dedupe(
    [
      ...text.matchAll(/"video_url":"(https:[^"]+)"/g),
      ...text.matchAll(/<video[^>]+src="([^"]+)"/g),
      ...text.matchAll(/<meta[^>]+property="og:video"[^>]+content="([^"]+)"/g),
      ...text.matchAll(/<meta[^>]+content="([^"]+)"[^>]+property="og:video"/g),
    ].map((match) => cleanUrl(match[1])),
    (url) => url.split("?")[0],
  );

  const imageUrls = dedupe(
    [
      ...text.matchAll(/"display_url":"(https:[^"]+)"/g),
      ...text.matchAll(/"thumbnail_src":"(https:[^"]+)"/g),
      ...text.matchAll(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/g),
    ].map((match) => cleanUrl(match[1])),
    (url) => url.split("?")[0],
  );

  const width = Number(firstMatch(text, [/"dimensions":\{"height":\d+,"width":(\d+)/]) ?? 0) || undefined;
  const height = Number(firstMatch(text, [/"dimensions":\{"height":(\d+)/]) ?? 0) || undefined;
  const duration = Number(firstMatch(text, [/"video_duration":([\d.]+)/]) ?? 0) || undefined;

  const username = firstMatch(text, [
    /"owner":\{"id":"\d+","username":"([^"]+)"/,
    /"owner":\{"username":"([^"]+)"/,
    /<meta[^>]+property="og:title"[^>]+content="([^" ]+) on Instagram/,
  ]);
  const caption = firstMatch(text, [
    /"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"([\s\S]{0,4000}?)"\}\}\]/,
    /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/,
  ]);

  const items: MediaItem[] = [];
  const carousel = /"edge_sidecar_to_children"/.test(text) || /"media_type":8/.test(text);

  videoUrls.forEach((url, index) => {
    items.push({
      kind: "video",
      url,
      thumbnail: imageUrls[index] ?? imageUrls[0],
      width,
      height,
      label: videoUrls.length > 1 ? `Video ${index + 1}` : "Video",
      quality: duration ? `${duration}s · ${qualityLabel(width, height) ?? "MP4"}` : qualityLabel(width, height),
    });
  });

  if (videoUrls.length === 0) {
    const chosen = carousel ? imageUrls : imageUrls.slice(0, 1);
    chosen.forEach((url, index) => {
      items.push({
        kind: "image",
        url,
        thumbnail: url,
        width: chosen.length > 1 ? undefined : width,
        height: chosen.length > 1 ? undefined : height,
        label: chosen.length > 1 ? `Slide ${index + 1}` : "Photo",
        quality: "JPG",
      });
    });
  }

  return {
    items: dedupe(items, (item) => `${item.kind}:${item.url.split("?")[0]}`),
    author: username ? { username } : undefined,
    caption: caption ? unescapeJsonString(caption).trim() : undefined,
    loginWall: false,
  };
}

async function viaEmbed(target: IgTarget): Promise<ParsedMedia> {
  if (target.kind !== "media") throw new ProviderError("unsupported", "Embed only handles posts");

  const surface = target.surface === "tv" ? "tv" : target.surface;
  const response = await igFetch(`https://www.instagram.com/${surface}/${target.shortcode}/embed/captioned/`, {
    headers: { "sec-fetch-dest": "iframe", "sec-fetch-mode": "navigate" },
  });

  if (response.status === 404) throw new ProviderError("not_found", "That post does not exist or was deleted.");
  if (response.status === 429) throw new ProviderError("rate_limited", "Instagram is rate limiting us. Try again in a minute.");

  const body = await response.text();

  // Structured first: exact dimensions, every video encode, real carousel order.
  const context = extractEmbedContext(body);
  const structured = context ? mediaFromContext(context) : null;
  if (structured && structured.items.length > 0) {
    return withSurfacePartial(structured, target.surface);
  }

  const fallback = parseEmbedFallback(body);
  if (fallback.items.length === 0) {
    throw looksLikeLoginWall(response.status, body)
      ? new ProviderError("login_required", "Instagram served a login wall for this post.", "Set IG_SESSIONID to authenticate.")
      : new ProviderError("not_found", "That post is not public, or it no longer exists.");
  }
  // Carry the "video expected, none found" signal from the structured pass into
  // the regex result, so a /p/ link to a video still falls through to `page`.
  return withSurfacePartial({ ...fallback, partial: structured?.partial }, target.surface);
}

function hasVideo(media: ParsedMedia): boolean {
  return media.items.some((item) => item.kind === "video");
}

/**
 * A video-shaped link that yields only stills is not a success. This also
 * covers `/p/<code>/` links to video posts: the embed may drop `video_url`
 * while the post page still has it, so keep the chain moving.
 */
function withSurfacePartial(parsed: ParsedMedia, surface: string): ParsedMedia {
  return { ...parsed, partial: Boolean(parsed.partial) || (surface !== "p" && !hasVideo(parsed)) };
}

// -------------------------------------------------------------- page provider

/** yt-dlp's fallback: the post page itself, parsed from its data-sjs islands. */
async function viaPostPage(target: IgTarget): Promise<ParsedMedia> {
  if (target.kind !== "media") throw new ProviderError("unsupported", "Page parsing only handles posts");

  const surface = target.surface === "tv" ? "tv" : target.surface;
  const response = await igFetch(`https://www.instagram.com/${surface}/${target.shortcode}/`, {
    headers: { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "sec-fetch-site": "none" },
  });

  if (response.status === 404) throw new ProviderError("not_found", "That post does not exist or was deleted.");
  if (response.status === 429) throw new ProviderError("rate_limited", "Instagram rate limited the post page.");

  const body = await response.text();
  const product = productFromPostPage(body);
  if (!product) {
    throw looksLikeLoginWall(response.status, body)
      ? new ProviderError("login_required", "The post page was replaced by a login wall.")
      : new ProviderError("not_found", "The post page carried no media.");
  }

  const parsed = mediaFromProduct(product);
  if (!parsed) throw new ProviderError("not_found", "The post page carried no downloadable assets.");
  return withSurfacePartial(parsed, target.surface);
}

// -------------------------------------------------------------- rest provider

/** gallery-dl's anonymous REST read: `/api/v1/media/{pk}/info/`. */
async function viaRest(target: IgTarget, csrf: string): Promise<ParsedMedia> {
  if (target.kind !== "media") throw new ProviderError("unsupported", "REST only handles posts");

  const mediaId = shortcodeToMediaId(target.shortcode);
  if (!mediaId) throw new ProviderError("invalid_url", "That shortcode could not be decoded.");

  const response = await igFetch(
    `https://www.instagram.com/api/v1/media/${mediaId}/info/`,
    { headers: anonymousHeaders(csrf, `https://www.instagram.com/${target.surface}/${target.shortcode}/`) },
    12000,
  );

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError("login_required", "Instagram refused the anonymous media API.", "Set IG_SESSIONID to authenticate.");
  }
  if (response.status === 404) throw new ProviderError("not_found", "That post does not exist or was deleted.");

  const payload = (await jsonBody(response)) as { items?: ProductItem[] } | null;
  if (!payload) {
    throw new ProviderError(
      "login_required",
      "Instagram answered the media API with a web page instead of JSON.",
      "This is the datacenter-IP block; a session or a residential egress fixes it.",
    );
  }

  const first = payload.items?.[0];
  if (!first) throw new ProviderError("not_found", "The media API returned no items.");

  const parsed = mediaFromProduct(first);
  if (!parsed || parsed.items.length === 0) throw new ProviderError("not_found", "The media API returned no assets.");
  return withSurfacePartial(parsed, target.surface);
}

// ----------------------------------------------------------- graphql provider

type Bootstrap = { lsd: string; csrf: string; at: number };
let bootstrap: Bootstrap | null = null;

/** yt-dlp `_real_initialize`: pull the lsd token and csrftoken from the homepage. */
async function webBootstrap(): Promise<Bootstrap> {
  if (bootstrap && Date.now() - bootstrap.at < CACHE_TTL_SECONDS * 1000) return bootstrap;

  const response = await igFetch("https://www.instagram.com/", {
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  const html = await response.text();

  let lsd = "";
  const eqmc = html.match(/<script\b[^>]*\bid="__eqmc"[^>]*>(\{.*?\})<\/script>/s);
  if (eqmc) {
    try {
      const parsed = JSON.parse(eqmc[1]) as { l?: string };
      if (typeof parsed.l === "string") lsd = parsed.l;
    } catch {
      /* fall through to the LSD array */
    }
  }
  if (!lsd) {
    lsd = html.match(/\["LSD",\[\],\{"token":"([^"]+)"/)?.[1] ?? "";
  }

  const cookie = response.headers.get("set-cookie") ?? "";
  const csrf = cookie.match(/csrftoken=([^;]+)/)?.[1] ?? randomToken();

  bootstrap = { lsd, csrf, at: Date.now() };
  return bootstrap;
}

async function viaGraphql(target: IgTarget): Promise<ParsedMedia> {
  if (target.kind !== "media") throw new ProviderError("unsupported", "GraphQL only handles posts");

  const mediaId = shortcodeToMediaId(target.shortcode);
  if (!mediaId) throw new ProviderError("invalid_url", "That shortcode could not be decoded.");

  const { lsd, csrf } = await webBootstrap();

  const response = await igFetch(
    "https://www.instagram.com/api/graphql",
    {
      method: "POST",
      headers: {
        ...anonymousHeaders(csrf, `https://www.instagram.com/p/${target.shortcode}/`),
        "content-type": "application/x-www-form-urlencoded",
        "x-fb-friendly-name": GRAPHQL_FRIENDLY,
        "x-fb-lsd": lsd,
      },
      body: new URLSearchParams({
        lsd,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: GRAPHQL_FRIENDLY,
        server_timestamps: "true",
        variables: JSON.stringify({ media_id: mediaId }),
        doc_id: GRAPHQL_DOC_ID,
      }).toString(),
    },
    12000,
  );

  if (response.status === 429) throw new ProviderError("rate_limited", "Instagram rate limited the GraphQL endpoint.");

  const payload = (await jsonBody(response)) as
    | { data?: { xig_polaris_media?: Record<string, unknown> }; errors?: { message?: string }[] }
    | null;

  if (!payload) {
    throw new ProviderError(
      "login_required",
      "Instagram answered GraphQL with a web page instead of JSON.",
      "Logged-out GraphQL is refused for datacenter IPs.",
    );
  }

  const media = payload.data?.xig_polaris_media;
  const product = (media?.if_not_gated_logged_out ?? media) as ProductItem | undefined;
  if (!product) {
    const reason = payload.errors?.[0]?.message;
    throw new ProviderError(
      "not_found",
      reason ? `GraphQL said: ${reason}` : "GraphQL returned no media for that post.",
    );
  }

  const parsed = mediaFromProduct(product);
  if (!parsed || parsed.items.length === 0) throw new ProviderError("not_found", "GraphQL returned no assets.");
  return withSurfacePartial(parsed, target.surface);
}

// ------------------------------------------------------------ profile lookups

type WebProfileUser = {
  id?: string;
  username?: string;
  full_name?: string;
  profile_pic_url?: string;
  profile_pic_url_hd?: string;
  is_private?: boolean;
};

/** gallery-dl / instaloader's profile read, with the anonymous header set. */
async function fetchWebProfile(username: string, csrf: string, sessionId?: string): Promise<WebProfileUser> {
  const headers = anonymousHeaders(csrf, `https://www.instagram.com/${username}/`);
  if (sessionId) headers.cookie = `csrftoken=${csrf}; sessionid=${sessionId}`;

  const response = await igFetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    { headers },
  );

  if (response.status === 404) throw new ProviderError("not_found", `No Instagram account named @${username}.`);
  if (response.status === 429) throw new ProviderError("rate_limited", "Instagram rate limited profile lookups.");

  const payload = (await jsonBody(response)) as { data?: { user?: WebProfileUser }; message?: string } | null;
  if (!payload) {
    throw new ProviderError(
      "login_required",
      "Instagram answered the profile API with a web page instead of JSON.",
      "Anonymous profile lookups are blocked for datacenter IPs; set IG_SESSIONID.",
    );
  }

  const user = payload.data?.user;
  if (!user) {
    const message = payload.message ?? "";
    if (/wait a few minutes|require_login|rate.?limit/i.test(message)) {
      throw new ProviderError(
        "rate_limited",
        "Instagram is throttling anonymous profile lookups from this IP.",
        "Set IG_SESSIONID, or try again in a few minutes.",
      );
    }
    throw new ProviderError("not_found", message || "Instagram returned no profile for that username.");
  }
  return user;
}

function avatarResult(user: WebProfileUser, fallbackName?: string): ParsedMedia {
  const avatar = user.profile_pic_url_hd ?? user.profile_pic_url;
  if (!avatar) throw new ProviderError("not_found", "That profile has no avatar.");
  return {
    items: [{ kind: "image", url: avatar, thumbnail: avatar, label: "Profile picture", quality: "HD" }],
    author: {
      username: user.username ?? fallbackName,
      fullName: user.full_name,
      avatar,
    },
    loginWall: false,
  };
}

/** Last anonymous resort: the profile page's own data islands. */
async function viaProfilePage(username: string): Promise<ParsedMedia> {
  const response = await igFetch(`https://www.instagram.com/${username}/`, {
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  const body = await response.text();
  const profile = profileFromPage(body);
  const avatar = profile?.avatar ?? metaImage(body);

  if (!avatar) {
    throw looksLikeLoginWall(response.status, body)
      ? new ProviderError("login_required", "The profile page was replaced by a login wall.")
      : new ProviderError("not_found", `No avatar found on @${username}'s page.`);
  }

  return avatarResult({ username: profile?.username ?? username, full_name: profile?.fullName, profile_pic_url: avatar });
}

// --------------------------------------------------------------- session provider

function sessionHeaders(env: Bindings): Record<string, string> {
  return {
    "x-ig-app-id": IG_APP_ID,
    "user-agent": env.IG_USER_AGENT?.trim() || MOBILE_UA,
    accept: "*/*",
    "accept-language": "en-US",
    cookie: `sessionid=${env.IG_SESSIONID?.trim()}`,
  };
}

async function sessionJson(url: string, env: Bindings): Promise<unknown> {
  const response = await igFetch(url, { headers: sessionHeaders(env) }, 12000);
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError("login_required", "The configured IG_SESSIONID is expired or was rejected.");
  }
  if (response.status === 429) throw new ProviderError("rate_limited", "Instagram rate limited the session.");
  if (!response.ok) throw new ProviderError("upstream_error", `Session API responded ${response.status}.`);
  return jsonBody(response);
}

async function viaSession(target: IgTarget, env: Bindings): Promise<ParsedMedia> {
  if (!env.IG_SESSIONID?.trim()) {
    throw new ProviderError(
      "login_required",
      "This link needs an authenticated Instagram session.",
      "Set the IG_SESSIONID secret to enable stories, highlights and private accounts.",
    );
  }

  if (target.kind === "media") {
    const mediaId = shortcodeToMediaId(target.shortcode);
    if (!mediaId) throw new ProviderError("invalid_url", "That shortcode could not be decoded.");

    const payload = (await sessionJson(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, env)) as {
      items?: ProductItem[];
    } | null;

    const first = payload?.items?.[0];
    if (!first) throw new ProviderError("not_found", "The session API returned no media.");
    const parsed = mediaFromProduct(first);
    if (!parsed || parsed.items.length === 0) throw new ProviderError("not_found", "Media had no assets.");
    return parsed;
  }

  if (target.kind === "highlight") {
    const payload = (await sessionJson(
      `https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=highlight:${encodeURIComponent(target.id)}`,
      env,
    )) as { reels?: Record<string, { items?: ProductItem[]; user?: ProductItem["user"] }> } | null;

    const reel = payload?.reels?.[`highlight:${target.id}`];
    const items = (reel?.items ?? []).flatMap((item, index) => {
      const parsed = mediaFromProduct({ ...item, carousel_media: undefined });
      return (parsed?.items ?? []).map((entry) => ({
        ...entry,
        label: `Story ${index + 1}${parsed && parsed.items.length > 1 ? ` · ${entry.label}` : ""}`,
      }));
    });
    if (items.length === 0) throw new ProviderError("not_found", "That highlight has no visible items.");
    return {
      items,
      author: reel?.user
        ? { username: reel.user.username, fullName: reel.user.full_name, avatar: reel.user.profile_pic_url }
        : undefined,
      loginWall: false,
    };
  }

  if (target.kind === "story") {
    const profile = await fetchWebProfile(target.username, randomToken(), env.IG_SESSIONID);
    if (!profile.id) throw new ProviderError("not_found", "Could not resolve that username to an id.");

    const payload = (await sessionJson(`https://i.instagram.com/api/v1/feed/user/${profile.id}/reel_media/`, env)) as {
      items?: ProductItem[];
    } | null;

    let items = (payload?.items ?? []).flatMap((item, index) => {
      const parsed = mediaFromProduct({ ...item, carousel_media: undefined });
      return (parsed?.items ?? []).map((entry) => ({ ...entry, label: `Story ${index + 1}` }));
    });

    if (target.storyId && items.length > 0) {
      const match = (payload?.items ?? []).find((item) => (item.pk ?? item.id) === target.storyId);
      if (match) {
        const parsed = mediaFromProduct({ ...match, carousel_media: undefined });
        items = (parsed?.items ?? []).map((entry) => ({ ...entry, label: "Story" }));
      }
    }
    if (items.length === 0) throw new ProviderError("not_found", `@${target.username} has no active stories right now.`);

    return {
      items,
      author: { username: profile.username, fullName: profile.full_name, avatar: profile.profile_pic_url_hd },
      loginWall: false,
    };
  }

  if (target.kind === "profile") {
    const profile = await fetchWebProfile(target.username, randomToken(), env.IG_SESSIONID);
    return avatarResult(profile, target.username);
  }

  throw new ProviderError("unsupported", "Session provider cannot handle that link.");
}

// --------------------------------------------------------------------- chain

// Workers only expose the default cache, not named caches.
async function readCache(key: string): Promise<ResolveSuccess | null> {
  try {
    const hit = await caches.default.match(new Request(key, { method: "GET" }));
    if (!hit) return null;
    return (await hit.json()) as ResolveSuccess;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: ResolveSuccess): Promise<void> {
  try {
    await caches.default.put(
      new Request(key, { method: "GET" }),
      new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json", "cache-control": `max-age=${CACHE_TTL_SECONDS}` },
      }),
    );
  } catch {
    /* cache is best-effort */
  }
}

async function followShareLink(rawUrl: string): Promise<string> {
  try {
    const response = await igFetch(rawUrl, { redirect: "follow" }, 8000);
    return response.url || rawUrl;
  } catch {
    return rawUrl;
  }
}

export async function resolveInstagram(
  rawInput: string,
  env: Bindings,
  options: { fresh?: boolean } = {},
): Promise<ResolveResult> {
  let target = parseInstagramUrl(rawInput);
  if (!target) {
    return {
      ok: false,
      code: "invalid_url",
      message: "That does not look like an Instagram link.",
      hint: "Try https://www.instagram.com/p/... or just a username.",
      tried: [],
    };
  }

  if (target.kind === "share") {
    const reparsed = parseInstagramUrl(await followShareLink(target.url));
    if (!reparsed || reparsed.kind === "share") {
      return { ok: false, code: "unsupported", message: "That share link did not resolve to a post.", tried: [] };
    }
    target = reparsed;
  }

  const cacheKey = `https://media-cache.savereel.internal/${encodeURIComponent(
    JSON.stringify({ target, session: Boolean(env.IG_SESSIONID) }),
  )}`;
  const cached = options.fresh ? null : await readCache(cacheKey);
  if (cached) return cached;

  const tried: ProviderId[] = [];
  let lastError: ProviderError | null = null;
  let meaningfulError: ProviderError | null = null;
  let fallback: ParsedMedia | null = null;
  let fallbackProvider: ProviderId | null = null;
  let providerId: ProviderId | null = null;
  let usedFallback = false;
  let hardMiss = false;
  const warnings: string[] = [];
  const csrf = randomToken();

  const run = async (provider: ProviderId, fn: () => Promise<ParsedMedia>): Promise<ParsedMedia | null> => {
    tried.push(provider);
    try {
      const value = await fn();
      if (value.partial) {
        if (!fallback) {
          fallback = value;
          fallbackProvider = provider;
        }
        return null;
      }
      providerId = provider;
      return value;
    } catch (error) {
      lastError =
        error instanceof ProviderError
          ? error
          : new ProviderError("upstream_error", error instanceof Error ? error.message : "Unknown provider failure.");
      if (lastError.code === "not_found") hardMiss = true;
      if (!meaningfulError && lastError.code !== "unsupported") meaningfulError = lastError;
      return null;
    }
  };

  let result: ParsedMedia | null = null;

  if (target.kind === "media") {
    const mediaTarget = target as Extract<IgTarget, { kind: "media" }>;
    result = await run("embed", () => viaEmbed(mediaTarget));
    if (!result) result = await run("page", () => viaPostPage(mediaTarget));
    // Some older posts 404 on /reel/<code>/ but still render on /p/<code>/. That
    // is not hypothetical: reel/DMA-mIagjDA returns only a thumbnail on the
    // reel surface and a real MP4 on the post surface. One extra request, only
    // after the first page attempt failed.
    if (!result && mediaTarget.surface !== "p") {
      result = await run("page", () => viaPostPage({ ...mediaTarget, surface: "p" }));
    }
    // A 404 from the HTML routes means the post is gone or private; the JSON
    // APIs would only repeat that, so skip them and go straight to the session.
    if (!result && !hardMiss) {
      result = await run("rest", () => viaRest(mediaTarget, csrf));
      if (!result) result = await run("graphql", () => viaGraphql(mediaTarget));
    }
    if (!result) result = await run("session", () => viaSession(target, env));
  } else if (target.kind === "story" || target.kind === "highlight") {
    if (!env.IG_SESSIONID?.trim()) {
      return {
        ok: false,
        code: "login_required",
        message: "Stories and highlights need an authenticated Instagram session.",
        hint: "Set the IG_SESSIONID secret to enable them.",
        tried: [],
      };
    }
    result = await run("session", () => viaSession(target, env));
  } else {
    result = await run("web-info", async () => avatarResult(await fetchWebProfile(target.username, csrf)));
    if (!result) result = await run("page", () => viaProfilePage(target.username));
    if (!result) result = await run("session", () => viaSession(target, env));
  }

  if (!result && fallback) {
    result = fallback;
    providerId = fallbackProvider;
    usedFallback = true;
    warnings.push("Instagram did not expose a video file for this link, so the thumbnail is shown instead.");
  }

  if (!result) {
    const failure = meaningfulError ?? lastError ?? new ProviderError("upstream_error", "Every resolver failed.");
    return { ok: false, code: failure.code, message: failure.message, hint: failure.hint, tried: [...new Set(tried)] };
  }

  if (result.items.length === 0) {
    return { ok: false, code: "not_found", message: "Resolved, but found no downloadable files.", tried: [...new Set(tried)] };
  }

  // Last line of defence: never hand a non-Instagram URL to the signed proxy,
  // or the download endpoint becomes an open proxy.
  const items = result.items.filter((item) => isInstagramCdn(item.url));
  if (items.length === 0) {
    return {
      ok: false,
      code: "upstream_error",
      message: "Resolved, but the CDN host was not recognised.",
      hint: "Instagram may have changed its media host. Open an issue with the link.",
      tried,
    };
  }

  const success: ResolveSuccess = {
    ok: true,
    provider: providerId ?? tried[tried.length - 1] ?? "embed",
    target: rawInput.trim(),
    kind: target.kind,
    shortcode: target.kind === "media" ? target.shortcode : undefined,
    author: result.author,
    caption: result.caption,
    items: items.map((item) => ({ ...item, url: cleanUrl(item.url) })),
    fetchedAt: new Date().toISOString(),
    warnings,
  };

  if (!options.fresh && !usedFallback) await writeCache(cacheKey, success);
  return success;
}

