/**
 * Original vector artwork.
 *
 * No stock photography and no borrowed icon set: these are drawn here, in the
 * same two inks as the rest of the page. A downloader site does not need a
 * photo of a phone — it needs a mark that reads at 16px and a set of line icons
 * that stay legible at 24px.
 */

import type { Child } from "hono/jsx";

const ACCENT = "#c0391f";
const INK = "#191712";

/** The stamp: an ink frame around a vermilion download arrow. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg class="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="29" height="29" fill="none" stroke={INK} stroke-width="2.2" />
      <path d="M16 7v11.5" stroke={ACCENT} stroke-width="3" stroke-linecap="square" />
      <path
        d="M10.8 13.8 16 19l5.2-5.2"
        fill="none"
        stroke={ACCENT}
        stroke-width="3"
        stroke-linecap="square"
        stroke-linejoin="miter"
      />
      <path d="M9 24.6h14" stroke={INK} stroke-width="2.4" stroke-linecap="square" />
    </svg>
  );
}

export function ToolIcon({ name, size = 24 }: { name: string; size?: number }) {
  let body: Child = null;

  switch (name) {
    case "video":
      body = (
        <>
          <rect x="3" y="5.5" width="18" height="13" />
          <path d="M10.4 9.3 15 12l-4.6 2.7z" />
        </>
      );
      break;
    case "photo":
      body = (
        <>
          <rect x="3" y="4.5" width="18" height="15" />
          <circle cx="8.4" cy="9.4" r="1.5" />
          <path d="m4 17 4.6-4.6 3.4 3.4 3.2-3.2L20 18" />
        </>
      );
      break;
    case "reels":
      body = (
        <>
          <rect x="4.5" y="3.5" width="15" height="17" />
          <path d="M4.5 8.4h15M4.5 15.6h15" />
          <path d="m10.6 10.4 3.4 1.6-3.4 1.6z" />
        </>
      );
      break;
    case "story":
      body = (
        <>
          <circle cx="12" cy="12" r="4.4" />
          <path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M5.9 5.9 7.5 7.5M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5 5.9 18.1" />
        </>
      );
      break;
    case "igtv":
      body = (
        <>
          <rect x="2.5" y="6" width="19" height="12" />
          <path d="M10.2 9.6 14.8 12l-4.6 2.4z" />
        </>
      );
      break;
    case "avatar":
      body = (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="9.6" r="2.6" />
          <path d="M6.2 18.2c1.4-2 3.4-3 5.8-3s4.4 1 5.8 3" />
        </>
      );
      break;
    case "audio":
      body = (
        <>
          <path d="M3 12h1.4M7 8.4v7.2M10.6 5.4v13.2M14.2 9v6M17.8 6.4v11.2M21.4 11v2" />
        </>
      );
      break;
    case "private":
      body = (
        <>
          <rect x="4.5" y="10" width="15" height="10.5" />
          <path d="M8 10V7.6a4 4 0 0 1 8 0V10" />
          <path d="M12 14v2.4" />
        </>
      );
      break;
    default:
      body = <rect x="4" y="4" width="16" height="16" />;
  }

  return (
    <svg
      class="tool-icon-svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="square"
      stroke-linejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}

/** A printer's asterisk, used as a section separator. */
export function Fleuron({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="fleuron">
      <path
        d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3 5.3 18.7"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linecap="square"
      />
    </svg>
  );
}

/** The corner registration marks used on the stats page and the OG card. */
export function RegistrationMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" focusable="false" class="reg-mark">
      <circle cx="9" cy="9" r="5.5" fill="none" stroke={INK} stroke-width="1.2" />
      <path d="M9 0v18M0 9h18" stroke={INK} stroke-width="1.2" />
    </svg>
  );
}
