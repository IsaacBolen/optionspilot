import { NextRequest, NextResponse } from "next/server";

type PolygonPrevBar = {
  T?: number;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
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

  const quotes = await Promise.all(
    tickers.map(async (ticker): Promise<MarketQuote> => {
      const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${encodeURIComponent(key)}`;
      try {
        const res = await fetch(url, { next: { revalidate: 120 } });
        const json: unknown = await res.json();
        if (!res.ok) {
          const msg =
            typeof json === "object" &&
            json !== null &&
            "message" in json &&
            typeof (json as { message: unknown }).message === "string"
              ? (json as { message: string }).message
              : `HTTP ${res.status}`;
          return { ticker, price: null, changePercent: null, error: msg };
        }
        const results =
          typeof json === "object" &&
          json !== null &&
          "results" in json &&
          Array.isArray((json as { results: unknown }).results)
            ? ((json as { results: PolygonPrevBar[] }).results)
            : [];
        const bar = results[0];
        if (!bar || typeof bar.c !== "number") {
          return {
            ticker,
            price: null,
            changePercent: null,
            error: "No aggregate data",
          };
        }
        const o = typeof bar.o === "number" ? bar.o : bar.c;
        const c = bar.c;
        const changePercent =
          o !== 0 && Number.isFinite(o) && Number.isFinite(c)
            ? ((c - o) / o) * 100
            : null;
        return { ticker, price: c, changePercent };
      } catch {
        return {
          ticker,
          price: null,
          changePercent: null,
          error: "Request failed",
        };
      }
    }),
  );

  return NextResponse.json({ quotes });
}
