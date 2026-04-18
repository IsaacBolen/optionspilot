import {
  POLYGON_CALL_GAP_MS,
  polygonFetch,
  sleep,
} from "@/lib/polygon-fetch";

type PolygonDayBar = { c?: number };

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchDailyCloses(
  ticker: string,
  key: string,
  fromDate: string,
  toDate: string,
): Promise<number[]> {
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=30&apiKey=${encodeURIComponent(key)}`;
  const res = await polygonFetch(url, 120);
  const json: unknown = await res.json();
  if (!res.ok || typeof json !== "object" || json === null) return [];
  const results =
    "results" in json && Array.isArray((json as { results: unknown }).results)
      ? ((json as { results: PolygonDayBar[] }).results)
      : [];
  return results
    .map((b) => (typeof b.c === "number" ? b.c : NaN))
    .filter((c) => Number.isFinite(c) && c > 0);
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * For each unique ticker, loads ~9 calendar days of daily bars once and sets:
 * - **change1w**: % move from first close to last close in that window.
 * - **change24h**: % move from prior session close to last close (last two bars).
 */
export async function enrichPicksWithPolygonPriceChanges<T extends { ticker: string }>(
  picks: T[],
  polygonKey: string | undefined,
): Promise<Array<T & { change24h: number | null; change1w: number | null }>> {
  if (!polygonKey) {
    return picks.map((p) => ({ ...p, change24h: null, change1w: null }));
  }

  const tickers = [...new Set(picks.map((p) => p.ticker.trim().toUpperCase()))];
  const byTicker = new Map<
    string,
    { change24h: number | null; change1w: number | null }
  >();

  const today = new Date();
  const fromDay = new Date(today);
  fromDay.setUTCDate(fromDay.getUTCDate() - 9);
  const fromStr = utcYmd(fromDay);
  const toStr = utcYmd(today);

  for (let i = 0; i < tickers.length; i++) {
    if (i > 0) await sleep(POLYGON_CALL_GAP_MS);
    const t = tickers[i];
    const closes = await fetchDailyCloses(t, polygonKey, fromStr, toStr);

    let change1w: number | null = null;
    let change24h: number | null = null;

    if (closes.length >= 2) {
      const first = closes[0];
      const last = closes[closes.length - 1];
      if (first > 0) change1w = roundPct(((last - first) / first) * 100);

      const prev = closes[closes.length - 2];
      if (prev > 0) change24h = roundPct(((last - prev) / prev) * 100);
    }

    byTicker.set(t, { change24h, change1w });
  }

  return picks.map((p) => {
    const m = byTicker.get(p.ticker.trim().toUpperCase()) ?? {
      change24h: null,
      change1w: null,
    };
    return { ...p, ...m };
  });
}
