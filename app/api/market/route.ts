import { NextRequest, NextResponse } from "next/server";
import { polygonFetch } from "@/lib/polygon-fetch";

type PolygonSnapshot = {
  ticker?: string;
  day?: {
    c?: number;
  };
  todaysChangePerc?: number;
};

type MarketQuote = {
  ticker: string;
  price: number | null;
  changePercent: number | null;
  error?: string;
};

export async function GET(request: NextRequest) {
  const key = process.env.POLYGON_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing POLYGON_API_KEY", quotes: [] as MarketQuote[] },
      { status: 500 },
    );
  }

  const tickersParam = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({ quotes: [] as MarketQuote[] });
  }

  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickers.join(","))}&apiKey=${encodeURIComponent(key)}`;
  const quotes: MarketQuote[] = [];
  try {
    const res = await polygonFetch(url, 120);
    const json: unknown = await res.json();
    if (!res.ok) {
      const msg =
        typeof json === "object" &&
        json !== null &&
        "message" in json &&
        typeof (json as { message: unknown }).message === "string"
          ? (json as { message: string }).message
          : `HTTP ${res.status}`;
      return NextResponse.json(
        {
          quotes: tickers.map((ticker) => ({
            ticker,
            price: null,
            changePercent: null,
            error: msg,
          })),
        },
        { status: 502 },
      );
    }
    const results =
      typeof json === "object" &&
      json !== null &&
      "results" in json &&
      Array.isArray((json as { results: unknown }).results)
        ? ((json as { results: PolygonSnapshot[] }).results)
        : [];
    const byTicker = new Map(
      results
        .filter((r) => typeof r.ticker === "string")
        .map((r) => [r.ticker as string, r] as const),
    );
    for (const ticker of tickers) {
      const snap = byTicker.get(ticker);
      const price = snap?.day && typeof snap.day.c === "number" ? snap.day.c : null;
      const changePercent =
        typeof snap?.todaysChangePerc === "number" ? snap.todaysChangePerc : null;
      quotes.push(
        price === null && changePercent === null
          ? { ticker, price: null, changePercent: null, error: "No snapshot data" }
          : { ticker, price, changePercent },
      );
    }
  } catch {
    return NextResponse.json(
      {
        quotes: tickers.map((ticker) => ({
          ticker,
          price: null,
          changePercent: null,
          error: "Request failed",
        })),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ quotes });
}
