/**
 * Brand + routing configuration.
 *
 * Renaming the product: change DEFAULT_BRAND / DEFAULT_ORIGIN here, or override
 * with the BRAND_NAME / PUBLIC_ORIGIN vars in wrangler.jsonc. Nothing else in
 * the codebase hardcodes the name.
 */

export type Bindings = {
  BRAND_NAME?: string;
  PUBLIC_ORIGIN?: string;
  SIGNING_KEY?: string;
  IG_SESSIONID?: string;
  IG_USER_AGENT?: string;
  TURNSTILE_SECRET?: string;
  RATE_LIMIT?: KVNamespace;
  MEDIA_CACHE?: KVNamespace;
  /** Aggregate counters for the public stats page. Optional so local dev works without D1. */
  STATS?: D1Database;
};

export const DEFAULT_BRAND = "SaveReel";
export const DEFAULT_ORIGIN = "http://localhost:8787";

/** Locales the router answers on. Add an entry + a file in src/i18n/ to ship one. */
export const LOCALES = [
  { code: "en", label: "English", enabled: true },
  { code: "es", label: "Español", enabled: true },
  { code: "pt", label: "Português", enabled: true },
  { code: "id", label: "Bahasa Indonesia", enabled: true },
  { code: "hi", label: "हिन्दी", enabled: true },
  { code: "ar", label: "العربية", enabled: true },
  { code: "fr", label: "Français", enabled: true },
  { code: "de", label: "Deutsch", enabled: true },
  { code: "it", label: "Italiano", enabled: true },
  { code: "ja", label: "日本語", enabled: true },
  { code: "ko", label: "한국어", enabled: true },
  { code: "ru", label: "Русский", enabled: false },
  { code: "tr", label: "Türkçe", enabled: false },
  { code: "vi", label: "Tiếng Việt", enabled: false },
  { code: "th", label: "ไทย", enabled: false },
  { code: "zh-cn", label: "简体中文", enabled: false },
  { code: "zh-tw", label: "繁體中文", enabled: false },
] as const;

export const DEFAULT_LOCALE = "en";

export type ToolKey =
  | "video"
  | "photo"
  | "reels"
  | "story"
  | "igtv"
  | "avatar"
  | "audio"
  | "private";

export type Tool = {
  key: ToolKey;
  slug: string;
  /** accepts: which Instagram URL shapes this tool will try to resolve */
  accepts: "media" | "profile" | "story";
  nav: string;
  title: string;
  h1: string;
  lede: string;
  placeholder: string;
  steps: [string, string, string];
  faq: { q: string; a: string }[];
};

export const TOOLS: Tool[] = [
  {
    key: "video",
    slug: "download-video-instagram",
    accepts: "media",
    nav: "Video",
    title: "Download Instagram Videos in HD",
    h1: "Instagram Video Downloader",
    lede: "Paste a post or reel link and get the original MP4 — no app, no login, no watermark.",
    placeholder: "https://www.instagram.com/p/...",
    steps: [
      "Open the post in Instagram and tap ••• → Copy link.",
      "Paste it above and press Download.",
      "Pick the quality you want and save the file.",
    ],
    faq: [
      {
        q: "What quality do I get?",
        a: "Whatever Instagram serves publicly: usually 720p for feed videos and up to 1080p for reels, plus a lower-bitrate fallback when the higher one is region-locked.",
      },
      {
        q: "Does it work on iPhone?",
        a: "Yes. The download link is served with an attachment header, so Safari saves it to Files instead of opening the player. From Files you can move it into Photos.",
      },
    ],
  },
  {
    key: "photo",
    slug: "instagram-photo-download",
    accepts: "media",
    nav: "Photo",
    title: "Download Instagram Photos at Full Resolution",
    h1: "Instagram Photo Downloader",
    lede: "Get the full-size image, including every slide of a carousel.",
    placeholder: "https://www.instagram.com/p/...",
    steps: [
      "Copy the link of the post that holds the photo.",
      "Paste the link and press Download.",
      "Each slide is listed separately — save the ones you want.",
    ],
    faq: [
      {
        q: "Why are there several images?",
        a: "Carousel posts are returned slide by slide, in the original order, at the highest resolution Instagram publishes for each one.",
      },
      {
        q: "Is the image compressed?",
        a: "It is exactly the file Instagram's own CDN serves. There is no extra re-encoding on our side.",
      },
    ],
  },
  {
    key: "reels",
    slug: "instagram-reels-video-download",
    accepts: "media",
    nav: "Reels",
    title: "Download Instagram Reels Without a Watermark",
    h1: "Instagram Reels Downloader",
    lede: "Reels come back as clean MP4 files, with the audio track intact.",
    placeholder: "https://www.instagram.com/reel/...",
    steps: [
      "Tap ••• on the reel and choose Copy link.",
      "Paste the link above.",
      "Download the MP4 and it plays anywhere.",
    ],
    faq: [
      {
        q: "Is there a watermark?",
        a: "No. Reels downloaded from the public CDN carry no overlay; the only badge is the author's own on-screen text if they added one.",
      },
      {
        q: "Do audio-only reels work?",
        a: "Yes. A music-only reel resolves to the same MP4 with the track inside; the Audio tool can strip it to WAV in your browser.",
      },
    ],
  },
  {
    key: "story",
    slug: "instagram-story-download",
    accepts: "story",
    nav: "Story",
    title: "Download Instagram Stories and Highlights",
    h1: "Instagram Story Downloader",
    lede: "Stories sit behind a login wall. This tool uses an optional session cookie, so set one up before you rely on it.",
    placeholder: "https://www.instagram.com/stories/username/1234567890",
    steps: [
      "Copy the story link, or just the username.",
      "Paste it above and press Download.",
      "Every frame of that user's current stories is listed.",
    ],
    faq: [
      {
        q: "Why does it ask for a session?",
        a: "Instagram only exposes stories to an authenticated viewer. Without an IG_SESSIONID secret configured on the Worker, story requests are rejected by Instagram itself, not by us.",
      },
      {
        q: "Do highlights work?",
        a: "Yes, pasting a highlight link resolves the same way. Public accounts are the reliable case; private accounts only work when the session account follows them.",
      },
    ],
  },
  {
    key: "igtv",
    slug: "igtv-video-download",
    accepts: "media",
    nav: "IGTV",
    title: "Download IGTV Videos",
    h1: "IGTV Video Downloader",
    lede: "Long-form Instagram video, saved as a single MP4.",
    placeholder: "https://www.instagram.com/tv/...",
    steps: [
      "Copy the IGTV post link.",
      "Paste it above.",
      "Save the file before the signed link expires.",
    ],
    faq: [
      {
        q: "How long do the links last?",
        a: "Download links are signed for 30 minutes. After that, run the search again — the CDN URLs rotate anyway.",
      },
    ],
  },
  {
    key: "avatar",
    slug: "instagram-profile-picture-download",
    accepts: "profile",
    nav: "Avatar",
    title: "Download Instagram Profile Pictures in Full Size",
    h1: "Instagram Profile Picture Downloader",
    lede: "The HD avatar, not the 150px thumbnail the app shows you.",
    placeholder: "https://www.instagram.com/username",
    steps: [
      "Copy the profile URL or type the username.",
      "Paste it above.",
      "Download the full-size avatar.",
    ],
    faq: [
      {
        q: "Why is the avatar sometimes small?",
        a: "Instagram returns the HD version only for accounts that still have one cached. When it doesn't, the largest published variant is served and the dimensions are shown on the card.",
      },
    ],
  },
  {
    key: "audio",
    slug: "instagram-audio-download",
    accepts: "media",
    nav: "Audio",
    title: "Extract Audio From Instagram Videos",
    h1: "Instagram Audio Downloader",
    lede: "Paste a reel and get a WAV of its audio track, decoded in your browser.",
    placeholder: "https://www.instagram.com/reel/...",
    steps: [
      "Paste the reel or video link.",
      "Resolve it, then press Extract audio.",
      "The WAV is written locally — the file never leaves your device.",
    ],
    faq: [
      {
        q: "How is the audio extracted?",
        a: "The MP4 is fetched by your browser and decoded with the Web Audio API, then written as a WAV. No server-side transcoding, so nothing is uploaded.",
      },
      {
        q: "Why WAV and not MP3?",
        a: "MP3 needs a licensed encoder. WAV is lossless and needs none. Convert to MP3 locally afterwards if you need the smaller file.",
      },
    ],
  },
  {
    key: "private",
    slug: "download-private-instagram",
    accepts: "media",
    nav: "Private",
    title: "Download From Private Instagram Accounts",
    h1: "Private Instagram Downloader",
    lede: "Only works for accounts the configured session follows. No tool can bypass a private account you don't have access to.",
    placeholder: "https://www.instagram.com/p/...",
    steps: [
      "Set IG_SESSIONID on the Worker with an account that follows the target.",
      "Paste the post link.",
      "Resolve it — the session is used only for this request.",
    ],
    faq: [
      {
        q: "Can this unlock any private account?",
        a: "No. It uses a real logged-in account's own permissions. If that account can't see the post in the Instagram app, this tool can't see it either.",
      },
      {
        q: "Is my session stored?",
        a: "Only as a Worker secret. It is never written to a database, never logged, and never sent to the browser.",
      },
    ],
  },
];

export const TOOL_BY_SLUG = new Map(TOOLS.map((t) => [t.slug, t]));
export const TOOL_BY_KEY = new Map(TOOLS.map((t) => [t.key, t]));

export type StaticPage = {
  slug: string;
  nav?: string;
  title: string;
  h1: string;
};

export const STATIC_PAGES: StaticPage[] = [
  { slug: "help", nav: "Help", title: "Help and FAQ", h1: "Help" },
  { slug: "about-us", title: "About", h1: "About this tool" },
  { slug: "terms-of-service", title: "Terms of Service", h1: "Terms of Service" },
  { slug: "privacy-policy", title: "Privacy Policy", h1: "Privacy Policy" },
  { slug: "contact", title: "Contact", h1: "Contact" },
];

export const STATIC_BY_SLUG = new Map(STATIC_PAGES.map((p) => [p.slug, p]));

export function brand(env: Bindings): string {
  return env.BRAND_NAME?.trim() || DEFAULT_BRAND;
}

export function origin(env: Bindings, url: URL): string {
  const configured = env.PUBLIC_ORIGIN?.trim();
  if (configured && configured.startsWith("http")) return configured.replace(/\/$/, "");
  return url.origin;
}
