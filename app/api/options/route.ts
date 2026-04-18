import { NextRequest, NextResponse } from "next/server";

import { fetchTradierOptionChain } from "@/lib/tradier-options";

export type OptionsContractResponse = {
  symbol: string;
  strike: number;
  bid: number;
  ask: number;
  last: number | null;
  volume: number;
  open_interest: number;
  implied_volatility: number | null;
  delta: number | null;
  expiration_date: string;
  option_type: "call" | "put";
};

export async function GET(request: NextRequest) {
  const key = process.env.TRADIER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing TRADIER_API_KEY", contracts: [] as OptionsContractResponse[] },
      { status: 500 },
    );
  }

  const ticker =
    request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  const expiration =
    request.nextUrl.searchParams.get("expiration")?.trim() ?? "";
  const optionTypeRaw =
    request.nextUrl.searchParams.get("optionType")?.trim().toLowerCase() ??
    "both";

  if (!ticker || !expiration) {
    return NextResponse.json(
      {
        error: "Missing ticker or expiration (YYYY-MM-DD)",
        contracts: [] as OptionsContractResponse[],
      },
      { status: 400 },
    );
  }

  const chain = await fetchTradierOptionChain(ticker, expiration, key);

  const filtered =
    optionTypeRaw === "call"
      ? chain.filter((c) => c.option_type === "call")
      : optionTypeRaw === "put"
        ? chain.filter((c) => c.option_type === "put")
        : chain;

  const contracts: OptionsContractResponse[] = filtered.map((c) => ({
    symbol: c.symbol,
    strike: c.strike,
    bid: c.bid,
    ask: c.ask,
    last: c.last,
    volume: c.volume,
    open_interest: c.open_interest,
    implied_volatility: c.implied_volatility,
    delta: c.delta,
    expiration_date: c.expiration_date,
    option_type: c.option_type,
  }));

  return NextResponse.json({ contracts });
}
