/**
 * Number and date formatting shared by the views.
 *
 * Kept deliberately locale-pinned: the public counters have to say the same
 * thing to everyone, so they are formatted as en-US and dated in UTC rather
 * than following the reader's machine locale.
 */

export function formatInt(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "0";
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

/** 2026-10-26 -> 26 Oct 2026 */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** 2026-10-26 -> Mon 26 Oct */
export function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** Single letter for the seven-day bar chart. */
export function dayInitial(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "·";
  return new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" }).format(date);
}

/** 2026-10-26T14:02:11.000Z -> 14:02 UTC */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().slice(11, 16)} UTC`;
}

/** 2026-10-26T14:02:11.000Z -> 2026-10-26 14:02 UTC */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
