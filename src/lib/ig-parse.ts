/**
 * Instagram payload parsing.
 *
 * Everything here is pure: HTML or JSON in, normalised media out. No fetch, no
 * env, so it can be unit-tested and reasoned about without a network.
 *
 * The shapes are taken from the current open-source extractors rather than
 * guessed:
 *
 *   - yt-dlp `InstagramIE._real_extract` reads `contextJSON` out of the embed
 *     page and falls back to `<script data-sjs>` blobs on the post page
 *     (`_SJS_RE` + `RelayPrefetchedStreamCache` -> `xig_polaris_media`).
 *   - gallery-dl `InstagramRestAPI` reads `video_versions` /
 *     `image_versions2.candidates` from `/api/v1/media/{pk}/info/`.
 *   - both agree on the product media shape, which is also what the logged-out
 *     GraphQL endpoint returns under `if_not_gated_logged_out`.
 *
 * Instagram keeps two legacy aliases alive in the embed (`config_width` /
 * `config_height`, `edge_sidecar_to_children`), so both spellings are handled.
 */

import type { Author, MediaItem } from "./resolver";

export type ParsedMedia = {
  items: MediaItem[];
  author?: Author;
  caption?: string;
  loginWall: boolean;
  /** A video-shaped link produced no video, so the chain should keep trying. */
  partial?: boolean;
};

/** Instagram nests JSON inside JSON, sometimes twice. Unwrap until it parses. */
export function extractEmbedContext(html: string): Record<string, unknown> | null {
  const match = html.match(/"contextJSON":"((?:[^"\\]|\\.)*)"/);
  if (!match?.[1]) return null;

  let payload = match[1];
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const parsed: unknown = JSON.parse(`"${payload}"`);
      if (typeof parsed !== "string") return null;
      payload = parsed;
      const value: unknown = JSON.parse(payload);
      if (value && typeof value === "object") return value as Record<string, unknown>;
      return null;
    } catch {
      // One more level of escaping to strip, or genuinely malformed.
      payload = payload.replace(/\\"/g, '"');
    }
  }
  return null;
}

type CtxNode = {
  __typename?: string;
  is_video?: boolean;
  video_url?: string;
  video_duration?: number;
  video_versions?: { url?: string; width?: number; height?: number; type?: number }[];
  display_url?: string;
  display_resources?: { src?: string; config_width?: number; config_height?: number; width?: number; height?: number }[];
  thumbnail_src?: string;
  dimensions?: { width?: number; height?: number };
  edge_media_to_caption?: { edges?: { node?: { text?: string } }[] };
  edge_sidecar_to_children?: { edges?: { node?: CtxNode }[] };
  owner?: { username?: string; full_name?: string; profile_pic_url?: string };
  product_type?: string;
};

function num(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

export function qualityLabel(width?: number, height?: number): string | undefined {
  const shortest = Math.min(width ?? 0, height ?? 0);
  if (!shortest) return undefined;
  if (shortest >= 1080) return "HD";
  if (shortest >= 720) return "SD";
  return "Low";
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

/** Largest entry of a display_resources-style array, either schema. */
export function largestResource(
  resources: { src?: string; config_width?: number; config_height?: number; width?: number; height?: number }[] | undefined,
): { url?: string; width?: number; height?: number } {
  const ranked: { url: string; width?: number; height?: number }[] = [];
  for (const entry of resources ?? []) {
    if (!entry.src) continue;
    ranked.push({
      url: entry.src,
      width: num(entry.config_width ?? entry.width),
      height: num(entry.config_height ?? entry.height),
    });
  }
  ranked.sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
  return ranked[0] ?? {};
}

/** One contextJSON / GraphQL media node -> download cards. */
function itemsFromContextNode(node: CtxNode, slide?: number): { items: MediaItem[]; blocked: boolean } {
  const prefix = slide ? `Slide ${slide}` : "";
  const width = num(node.dimensions?.width);
  const height = num(node.dimensions?.height);

  const versions = (node.video_versions ?? [])
    .filter((version) => Boolean(version.url))
    .map((version) => ({ url: version.url as string, width: num(version.width), height: num(version.height) }))
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));

  // Instagram publishes several encodes of the same reel. Offer them as
  // separate cards, de-duplicated by pixel height, highest first.
  const seenHeights = new Set<number>();
  const videoItems: MediaItem[] = [];
  for (const version of versions) {
    const key = version.height ?? version.width ?? 0;
    if (seenHeights.has(key)) continue;
    seenHeights.add(key);
    const label = version.height ? `${version.height}p` : "MP4";
    videoItems.push({
      kind: "video",
      url: version.url,
      thumbnail: node.display_url ?? node.thumbnail_src,
      width: version.width ?? width,
      height: version.height ?? height,
      label: prefix ? `${prefix} · Video (${label})` : `Video (${label})`,
      quality: qualityLabel(version.width, version.height),
    });
    if (videoItems.length >= 3) break;
  }

  if (videoItems.length === 0 && node.video_url) {
    videoItems.push({
      kind: "video",
      url: node.video_url,
      thumbnail: node.display_url ?? node.thumbnail_src,
      width,
      height,
      label: prefix ? `${prefix} · Video` : "Video",
      quality:
        node.video_duration && num(node.video_duration)
          ? `${Math.round(num(node.video_duration) as number)}s · ${qualityLabel(width, height) ?? "MP4"}`
          : qualityLabel(width, height),
    });
  }

  if (videoItems.length > 0) return { items: videoItems, blocked: false };

  if (node.is_video === true) return { items: [], blocked: true };

  const best = largestResource(node.display_resources);
  const imageUrl = best.url ?? node.display_url;
  if (!imageUrl) return { items: [], blocked: false };

  return {
    items: [
      {
        kind: "image",
        url: imageUrl,
        thumbnail: best.url ?? imageUrl,
        width: best.width ?? width,
        height: best.height ?? height,
        label: prefix || "Photo",
        quality: "JPG",
      },
    ],
    blocked: false,
  };
}

/** `contextJSON.gql_data.shortcode_media` -> normalised media. */
export function mediaFromContext(context: Record<string, unknown>): ParsedMedia | null {
  const gql = context.gql_data as Record<string, unknown> | undefined;
  const media = (gql?.shortcode_media ?? gql?.xdt_shortcode_media) as CtxNode | undefined;
  if (!media) return null;

  const children = media.edge_sidecar_to_children?.edges ?? [];
  const items: MediaItem[] = [];
  let blocked = false;

  if (children.length > 0) {
    children.forEach((edge, index) => {
      if (!edge.node) return;
      const parsed = itemsFromContextNode(edge.node, index + 1);
      blocked = blocked || parsed.blocked;
      items.push(...parsed.items);
    });
  } else {
    const parsed = itemsFromContextNode(media);
    blocked = parsed.blocked;
    items.push(...parsed.items);
  }

  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text?.trim();

  return {
    items: dedupe(items, (item) => `${item.kind}:${item.url.split("?")[0]}`),
    author: media.owner?.username
      ? {
          username: media.owner.username,
          fullName: media.owner.full_name,
          avatar: media.owner.profile_pic_url,
        }
      : undefined,
    caption: caption || undefined,
    loginWall: false,
    partial: blocked,
  };
}

// ---------------------------------------------------------- product media
// The shape shared by the logged-out GraphQL query, the mobile REST API and
// the logged-in `/media/{pk}/info/` endpoint.

export type ProductItem = {
  pk?: string;
  id?: string;
  media_type?: number;
  video_url?: string;
  video_duration?: number;
  video_versions?: { url?: string; width?: number; height?: number; type?: number }[];
  image_versions2?: { candidates?: { url?: string; width?: number; height?: number }[] };
  carousel_media?: ProductItem[];
  user?: { username?: string; full_name?: string; profile_pic_url?: string };
  caption?: { text?: string } | null;
};

function itemsFromProductItem(item: ProductItem, prefix = ""): MediaItem[] {
  if (item.carousel_media?.length) {
    return item.carousel_media.flatMap((child, index) =>
      itemsFromProductItem(child, prefix ? `${prefix} · ${index + 1}` : `Slide ${index + 1}`),
    );
  }

  const image = largestResource(
    item.image_versions2?.candidates?.map((candidate) => ({
      src: candidate.url,
      width: candidate.width,
      height: candidate.height,
    })),
  );

  const versions = (item.video_versions ?? [])
    .filter((version) => Boolean(version.url))
    .map((version) => ({ url: version.url as string, width: num(version.width), height: num(version.height) }))
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));

  const isVideo = item.media_type === 2 || versions.length > 0 || Boolean(item.video_url);

  if (isVideo) {
    const seen = new Set<number>();
    const out: MediaItem[] = [];
    for (const version of versions) {
      const key = version.height ?? version.width ?? 0;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: "video",
        url: version.url,
        thumbnail: image.url,
        width: version.width,
        height: version.height,
        label: prefix
          ? `${prefix} · Video${version.height ? ` (${version.height}p)` : ""}`
          : `Video${version.height ? ` (${version.height}p)` : ""}`,
        quality: qualityLabel(version.width, version.height),
      });
      if (out.length >= 3) break;
    }
    if (out.length === 0 && item.video_url) {
      out.push({
        kind: "video",
        url: item.video_url,
        thumbnail: image.url,
        width: image.width,
        height: image.height,
        label: prefix ? `${prefix} · Video` : "Video",
        quality: item.video_duration
          ? `${Math.round(item.video_duration)}s · ${qualityLabel(image.width, image.height) ?? "MP4"}`
          : qualityLabel(image.width, image.height),
      });
    }
    return out;
  }

  if (!image.url) return [];
  return [
    {
      kind: "image",
      url: image.url,
      thumbnail: image.url,
      width: image.width,
      height: image.height,
      label: prefix || "Photo",
      quality: "JPG",
    },
  ];
}

/** `xig_polaris_media.if_not_gated_logged_out` or `items[0]` from the REST API. */
export function mediaFromProduct(product: ProductItem | undefined): ParsedMedia | null {
  if (!product) return null;
  const items = dedupe(
    itemsFromProductItem(product),
    (item) => `${item.kind}:${item.url.split("?")[0]}`,
  );
  return {
    items,
    author: product.user?.username
      ? { username: product.user.username, fullName: product.user.full_name, avatar: product.user.profile_pic_url }
      : undefined,
    caption: product.caption?.text?.trim() || undefined,
    loginWall: false,
    partial: items.length === 0,
  };
}

// ---------------------------------------------------------------- sjs blobs
// The logged-out web app ships its data as <script data-sjs>{json}</script>
// islands. yt-dlp walks require -> __bbox -> result -> data -> xig_polaris_media;
// a generic key search is the same thing without depending on array indexes.

export function sjsBlobs(html: string): unknown[] {
  const out: unknown[] = [];
  const pattern = /<script\b[^>]*\bdata-sjs\b[^>]*>(\{.+?\})<\/script>/gs;
  for (const match of html.matchAll(pattern)) {
    try {
      out.push(JSON.parse(match[1]));
    } catch {
      /* one malformed island should not stop the walk */
    }
  }
  return out;
}

function walkFor(value: unknown, isMatch: (node: Record<string, unknown>) => boolean, depth = 0): Record<string, unknown> | null {
  if (depth > 14 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const hit = walkFor(entry, isMatch, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if (isMatch(record)) return record;
  for (const entry of Object.values(record)) {
    const hit = walkFor(entry, isMatch, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** Post page -> product media, or null when the page is a login shell. */
export function productFromPostPage(html: string): ProductItem | null {
  for (const blob of sjsBlobs(html)) {
    const media = walkFor(blob, (node) => "xig_polaris_media" in node);
    if (!media) continue;
    const polaris = media.xig_polaris_media as Record<string, unknown> | undefined;
    const product = (polaris?.if_not_gated_logged_out ?? polaris) as ProductItem | undefined;
    if (product) return product;
  }
  return null;
}

/** Profile page -> avatar, or null when the page is a login shell. */
export function profileFromPage(html: string): { username?: string; fullName?: string; avatar?: string } | null {
  for (const blob of sjsBlobs(html)) {
    const user = walkFor(blob, (node) => "profile_pic_url_hd" in node || "profile_pic_url" in node);
    if (!user) continue;
    const avatar = (user.profile_pic_url_hd ?? user.profile_pic_url) as string | undefined;
    if (!avatar) continue;
    return {
      username: typeof user.username === "string" ? user.username : undefined,
      fullName: typeof user.full_name === "string" ? user.full_name : undefined,
      avatar,
    };
  }
  return null;
}

/** Meta tags survive on some error pages where the islands do not. */
export function metaImage(html: string): string | undefined {
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match?.[1];
}
