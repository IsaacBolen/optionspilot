import { NextRequest, NextResponse } from "next/server";

type FinnhubArticle = {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
};

/** Finnhub company-news uses unix time in seconds; guard ms timestamps. */
function toUnixMs(value: number): number {
  return value > 1_000_000_000_000 ? value : value * 1000;
}

type NewsArticle = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: string;
};

export async function GET(request: NextRequest) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return NextResponse.json(
      { error: "Missing FINNHUB_API_KEY", articles: [] as NewsArticle[] },
      { status: 500 },
    );
  }

  const tickersParam = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({ articles: [] as NewsArticle[] });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  let limit = Number.parseInt(limitParam ?? "10", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 10;
  limit = Math.min(Math.max(limit, 1), 10);

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const perTicker = await Promise.all(
    tickers.map(async (symbol) => {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${encodeURIComponent(token)}`;
      try {
        const res = await fetch(url, { next: { revalidate: 120 } });
        if (!res.ok) return [] as FinnhubArticle[];
        const json: unknown = await res.json();
        return Array.isArray(json) ? (json as FinnhubArticle[]) : [];
      } catch {
        return [] as FinnhubArticle[];
      }
    }),
  );

  const merged = perTicker.flat();
  const seen = new Set<string>();
  const articles: NewsArticle[] = [];

  for (const row of merged) {
    const dedupeKey =
      row.id != null
        ? `id:${row.id}`
        : row.url
          ? `url:${row.url}`
          : row.headline
            ? `h:${row.headline}`
            : null;
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const headline = row.headline?.trim() ?? "";
    const url = row.url?.trim() ?? "";
    if (!headline && !url) continue;

    const unix = typeof row.datetime === "number" ? row.datetime : 0;
    const ms = unix ? toUnixMs(unix) : Date.now();

    articles.push({
      headline,
      summary: row.summary?.trim() ?? "",
      source: row.source?.trim() || "Unknown",
      url,
      datetime: new Date(ms).toISOString(),
    });
  }

  articles.sort(
    (a, b) =>
      new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
  );

  const capped =
    limit >= articles.length ? articles : articles.slice(0, limit);

  return NextResponse.json({ articles: capped });
}
