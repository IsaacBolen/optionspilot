import { NextRequest, NextResponse } from "next/server";

type PolygonAggBar = {
  T?: number;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
};

type ChartBar = { t: number; c: number };

export async function GET(request: NextRequest) {
  const key = process.env.POLYGON_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing POLYGON_API_KEY", bars: [] as ChartBar[] },
      { status: 500 },
    );
  }

  const ticker =
    request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!ticker) {
    return NextResponse.json({ bars: [] as ChartBar[] });
  }

  function utcYmd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const fromDate = utcYmd(yesterday);
  const toDate = utcYmd(today);

  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/hour/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=5000&apiKey=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    const json: unknown = await res.json();
    if (!res.ok) {
      const msg =
        typeof json === "object" &&
        json !== null &&
        "message" in json &&
        typeof (json as { message: unknown }).message === "string"
          ? (json as { message: string }).message
          : `HTTP ${res.status}`;
      return NextResponse.json({ error: msg, bars: [] as ChartBar[] }, { status: 502 });
    }
    const results =
      typeof json === "object" &&
      json !== null &&
      "results" in json &&
      Array.isArray((json as { results: unknown }).results)
        ? ((json as { results: PolygonAggBar[] }).results)
        : [];
    const bars: ChartBar[] = results
      .filter((b) => typeof b.T === "number" && typeof b.c === "number")
      .map((b) => ({ t: b.T as number, c: b.c as number }));
    return NextResponse.json({ bars });
  } catch {
    return NextResponse.json(
      { error: "Request failed", bars: [] as ChartBar[] },
      { status: 502 },
    );
  }
}
