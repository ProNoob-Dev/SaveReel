import type { Bindings } from "../config";
import { safeFilename, createDownloadLink } from "./sign";
import type { ResolveSuccess } from "./resolver";

export type DownloadItem = {
  kind: "video" | "image";
  href: string;
  filename: string;
  label: string;
  quality?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  source: string;
};

export type PresentedResult = {
  provider: string;
  kind: ResolveSuccess["kind"];
  author?: { username?: string; fullName?: string; avatar?: string };
  caption?: string;
  items: DownloadItem[];
  expiresAt: number;
  warnings: string[];
  fetchedAt: string;
};

function extensionFor(url: string, kind: "video" | "image"): string {
  const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
  const candidate = match?.[1]?.toLowerCase();
  const allowed = kind === "video" ? ["mp4", "mov", "webm"] : ["jpg", "jpeg", "png", "webp", "heic"];
  if (candidate && allowed.includes(candidate)) return candidate === "jpeg" ? "jpg" : candidate;
  return kind === "video" ? "mp4" : "jpg";
}

export async function presentResult(
  result: ResolveSuccess,
  env: Bindings,
  base: string,
  brand: string,
): Promise<PresentedResult> {
  const handle = safeFilename(result.author?.username ?? "instagram");
  let expiresAt = Math.floor(Date.now() / 1000);

  const items: DownloadItem[] = [];
  for (const [index, item] of result.items.entries()) {
    const extension = extensionFor(item.url, item.kind);
    const suffix = result.items.length > 1 ? `-${index + 1}` : "";
    const filename = `${safeFilename(brand)}-${handle}-${safeFilename(item.label)}${suffix}.${extension}`;
    const link = await createDownloadLink({ secret: env.SIGNING_KEY, base, target: item.url, filename });
    expiresAt = Math.max(expiresAt, link.expiresAt);
    items.push({
      kind: item.kind,
      href: link.href,
      filename,
      label: item.label,
      quality: item.quality,
      thumbnail: item.thumbnail,
      width: item.width,
      height: item.height,
      source: item.url,
    });
  }

  return {
    provider: result.provider,
    kind: result.kind,
    author: result.author,
    caption: result.caption,
    items,
    expiresAt,
    warnings: result.warnings,
    fetchedAt: result.fetchedAt,
  };
}
