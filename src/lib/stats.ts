/**
 * Public counters.
 *
 * D1, not KV: counters are a read-modify-write and KV would lose increments
 * under concurrency (and caps writes per key). D1 gives us a real atomic
 * `value = value + excluded.value`, so the numbers on the public page are
 * exact instead of "roughly".
 *
 * What is stored: a number per (scope, metric), where scope is 'total' or a UTC
 * day. No IP, no user agent, no link, no per-visitor row. That is deliberate —
 * the whole point of publishing the counts is that there is nothing sensitive
 * behind them.
 *
 * Every write is wrapped so a stats outage can never break a resolve or a
 * download.
 */

import type { Bindings } from "../config";

export type DayStats = { day: string; resolves: number; downloads: number; bytes: number };

export type StatsSnapshot = {
  available: boolean;
  since: string | null;
  updated_at: string;
  totals: {
    resolves: number;
    downloads: number;
    bytes: number;
    page_views: number;
    api_calls: number;
    videos: number;
    images: number;
  };
  today: { resolves: number; downloads: number; bytes: number; page_views: number; api_calls: number };
  last_7_days: DayStats[];
};

const UPSERT = `INSERT INTO counters (scope, metric, value) VALUES (?1, ?2, ?3)
ON CONFLICT(scope, metric) DO UPDATE SET value = value + excluded.value`;

/** UTC day, so the public totals do not depend on the reader's timezone. */
export function dayOf(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function emptySnapshot(): StatsSnapshot {
  return {
    available: false,
    since: null,
    updated_at: new Date().toISOString(),
    totals: { resolves: 0, downloads: 0, bytes: 0, page_views: 0, api_calls: 0, videos: 0, images: 0 },
    today: { resolves: 0, downloads: 0, bytes: 0, page_views: 0, api_calls: 0 },
    last_7_days: [],
  };
}

/** Fire a counter update. Never throws, never awaited by the response path. */
export async function bump(
  env: Bindings,
  metrics: Record<string, number>,
  day: string = dayOf(),
): Promise<void> {
  const db = env.STATS;
  if (!db) return;

  const entries = Object.entries(metrics)
    .map(([metric, value]) => [metric, Math.round(value)] as const)
    .filter(([, value]) => Number.isFinite(value) && value > 0);
  if (entries.length === 0) return;

  const statements = entries.flatMap(([metric, value]) => [
    db.prepare(UPSERT).bind("total", metric, value),
    db.prepare(UPSERT).bind(day, metric, value),
  ]);

  try {
    await db.batch(statements);
  } catch (error) {
    console.error("stats: write failed", error instanceof Error ? error.message : error);
  }
}

type CounterRow = { scope: string; metric: string; value: number | string };

function toMap(rows: CounterRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.metric, Number(row.value) || 0);
  return out;
}

export async function readStats(env: Bindings): Promise<StatsSnapshot> {
  const db = env.STATS;
  if (!db) return emptySnapshot();

  const today = dayOf();
  const weekStart = dayOf(new Date(Date.now() - 6 * 86_400_000));

  try {
    const [totalsResult, todayResult, weekResult, sinceResult] = await db.batch([
      db.prepare("SELECT scope, metric, value FROM counters WHERE scope = 'total'"),
      db.prepare("SELECT scope, metric, value FROM counters WHERE scope = ?1").bind(today),
      db.prepare("SELECT scope, metric, value FROM counters WHERE scope != 'total' AND scope >= ?1").bind(weekStart),
      db.prepare("SELECT MIN(scope) AS since FROM counters WHERE scope != 'total'"),
    ]);

    const totals = toMap((totalsResult.results ?? []) as CounterRow[]);
    const todayMap = toMap((todayResult.results ?? []) as CounterRow[]);
    const weekRows = (weekResult.results ?? []) as CounterRow[];
    const sinceRow = (sinceResult.results ?? [])[0] as { since?: string } | undefined;

    const byDay = new Map<string, DayStats>();
    for (const row of weekRows) {
      const entry = byDay.get(row.scope) ?? { day: row.scope, resolves: 0, downloads: 0, bytes: 0 };
      const value = Number(row.value) || 0;
      if (row.metric === "resolves") entry.resolves = value;
      else if (row.metric === "downloads") entry.downloads = value;
      else if (row.metric === "bytes") entry.bytes = value;
      byDay.set(row.scope, entry);
    }

    const last7: DayStats[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = dayOf(new Date(Date.now() - i * 86_400_000));
      last7.push(byDay.get(day) ?? { day, resolves: 0, downloads: 0, bytes: 0 });
    }

    return {
      available: true,
      since: sinceRow?.since ?? null,
      updated_at: new Date().toISOString(),
      totals: {
        resolves: totals.get("resolves") ?? 0,
        downloads: totals.get("downloads") ?? 0,
        bytes: totals.get("bytes") ?? 0,
        page_views: totals.get("page_views") ?? 0,
        api_calls: totals.get("api_calls") ?? 0,
        videos: totals.get("download_video") ?? 0,
        images: totals.get("download_image") ?? 0,
      },
      today: {
        resolves: todayMap.get("resolves") ?? 0,
        downloads: todayMap.get("downloads") ?? 0,
        bytes: todayMap.get("bytes") ?? 0,
        page_views: todayMap.get("page_views") ?? 0,
        api_calls: todayMap.get("api_calls") ?? 0,
      },
      last_7_days: last7,
    };
  } catch (error) {
    console.error("stats: read failed", error instanceof Error ? error.message : error);
    return emptySnapshot();
  }
}

/**
 * Home-page copy of the snapshot.
 *
 * The home page is rendered per request (no edge cache) because it carries live
 * counters, so the read has to be cheap. One D1 read per isolate per minute is
 * cheap; one per request is not. A failed read is never cached, so a transient
 * D1 hiccup recovers on the next request.
 */
const SNAPSHOT_TTL_MS = 60_000;
let snapshotCache: { at: number; value: StatsSnapshot } | null = null;

export async function readStatsCached(env: Bindings): Promise<StatsSnapshot> {
  if (!env.STATS) return emptySnapshot();

  const now = Date.now();
  if (snapshotCache && now - snapshotCache.at < SNAPSHOT_TTL_MS && snapshotCache.value.available) {
    return snapshotCache.value;
  }

  const value = await readStats(env);
  if (value.available) snapshotCache = { at: now, value };
  return value;
}

/**
 * Queue counter updates after the response has been sent. `executionCtx` is not
 * available in every invocation (tests, some local runners), hence the fallback.
 */
export function track(c: { env: Bindings; executionCtx?: unknown }, metrics: Record<string, number>): void {
  if (!c.env.STATS) return;

  const ctx = c.executionCtx as { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
  if (ctx && typeof ctx.waitUntil === "function") {
    try {
      ctx.waitUntil(bump(c.env, metrics));
      return;
    } catch {
      /* fall through to a detached write */
    }
  }
  void bump(c.env, metrics);
}
