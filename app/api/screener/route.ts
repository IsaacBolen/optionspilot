import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { enrichPicksWithPolygonPriceChanges } from "@/lib/enrich-screener-picks";
import {
  fetchTradierExpirations,
  fetchTradierOptionChain,
  type TradierChainOption,
} from "@/lib/tradier-options";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const POLYGON_KEY = process.env.POLYGON_API_KEY;

// ── Step 1: Claude extracts intent ─────────────────────────────────────────
const INTENT_SYSTEM = `You are a trading assistant. Extract the user's options screening intent and return ONLY a JSON object with these fields:
- tickers: array of 3-4 stock tickers to scan (liquid US names or ETFs that fit the request; vary names—do not only mega-caps if small caps fit better)
- optionType: "call", "put", or "both"
- maxDaysToExpiry: number (e.g. 30 for "this month", 45 for "next few weeks", 60 for "2 months")
- minDaysToExpiry: number (e.g. 7 minimum to avoid same-week expiry)
- maxBudgetPerContract: number or null — maximum TOTAL dollars to enter one option contract at the bid (100 shares × bid in dollars). Example: "under $200" → 200. If the user gives no budget, null.
- maxStrike: number or null
- minStrike: number or null
No markdown, no commentary, just the JSON object.`;

// ── Step 2: Claude ranks Tradier contracts ─────────────────────────────────
const RANKER_SYSTEM = `You are an options analyst. The user described a trade. Below is REAL options data from Tradier (sandbox): each row is one contract with symbol (OCC), underlying, strike, expiration_date (YYYY-MM-DD), option_type (call/put), bid, ask, last, volume, open_interest, implied_volatility (decimal, e.g. 0.35), delta.

Return ONLY a JSON object:
{
  "summary": "2-3 sentences on why these picks have edge",
  "picks": [
    {
      "symbol": "AAPL260516C00195000",
      "signalScore": 78,
      "ivRank": 65
    }
  ]
}
Rules:
- Every pick MUST copy "symbol" exactly from the input list — no invented symbols.
- Pick 5-7 contracts. Rank best first by profit potential vs risk.
- signalScore: integer 0-100
- ivRank: integer 0-100 (you may infer from implied_volatility × 100, capped 0-100)
No markdown, no commentary outside the JSON.`;

type ScreenerPick = {
  ticker: string;
  type: "Call" | "Put";
  strike: number;
  expiration: string;
  ivRank: number;
  volume: number;
  signalScore: number;
  estPremium: number | null;
  premiumRange: string;
  change24h: number | null;
  change1w: number | null;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  return JSON.parse(candidate.slice(start, end + 1));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function utcMidnight(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function daysToExpiration(ymd: string, from: Date): number {
  const exp = new Date(`${ymd}T12:00:00.000Z`);
  if (Number.isNaN(exp.getTime())) return NaN;
  const ms = exp.getTime() - utcMidnight(from).getTime();
  return Math.floor(ms / 86400000);
}

function pickExpirationsInWindow(
  dates: string[],
  minDays: number,
  maxDays: number,
  limit: number,
): string[] {
  const today = utcMidnight(new Date());
  const inWin = dates
    .map((d) => ({ d, days: daysToExpiration(d, today) }))
    .filter(
      ({ days }) =>
        Number.isFinite(days) && days >= minDays && days <= maxDays,
    )
    .sort((a, b) => a.days - b.days);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { d } of inWin) {
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
    if (out.length >= limit) break;
  }
  return out;
}

function formatExpirationHuman(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function filterByOptionType(
  rows: TradierChainOption[],
  optionType: string,
): TradierChainOption[] {
  const o = optionType.toLowerCase();
  if (o === "call") return rows.filter((r) => r.option_type === "call");
  if (o === "put") return rows.filter((r) => r.option_type === "put");
  return rows;
}

function filterByBudget(
  rows: TradierChainOption[],
  maxBudgetPerContract: number | null,
): TradierChainOption[] {
  if (maxBudgetPerContract == null || !Number.isFinite(maxBudgetPerContract)) {
    return rows;
  }
  const cap = maxBudgetPerContract;
  return rows.filter((r) => {
    const bid = Number(r.bid);
    if (!Number.isFinite(bid) || bid < 0) return false;
    return bid * 100 <= cap;
  });
}

function scoreLiquidity(c: TradierChainOption): number {
  return c.open_interest + c.volume * 2;
}

function normalizeRankedPick(
  raw: unknown,
  bySymbol: Map<string, TradierChainOption>,
): ScreenerPick | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const symbol = String(o.symbol ?? "").trim();
  const c = bySymbol.get(symbol);
  if (!c) return null;

  const signalScore = Math.min(
    100,
    Math.max(0, Math.round(Number(o.signalScore))),
  );
  let ivRank = Math.round(Number(o.ivRank));
  if (!Number.isFinite(ivRank)) {
    const iv = c.implied_volatility;
    ivRank =
      iv != null && Number.isFinite(iv)
        ? Math.min(100, Math.max(0, Math.round(iv * 100)))
        : 0;
  } else {
    ivRank = Math.min(100, Math.max(0, ivRank));
  }

  const bid = Number.isFinite(c.bid) ? c.bid : 0;
  const ask = Number.isFinite(c.ask) ? c.ask : bid;
  const mid = (bid + ask) / 2;
  const estPremium = Math.round(mid * 100) / 100;
  const premiumRange = `$${bid.toFixed(2)} - $${ask.toFixed(2)}`;

  return {
    ticker: c.underlying,
    type: c.option_type === "put" ? "Put" : "Call",
    strike: c.strike,
    expiration: formatExpirationHuman(c.expiration_date),
    ivRank,
    volume: c.volume,
    signalScore,
    estPremium,
    premiumRange,
    change24h: null,
    change1w: null,
  };
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Missing ANTHROPIC_API_KEY" },
      { status: 500 },
    );
  }
  const tradierKey = process.env.TRADIER_API_KEY;
  if (!tradierKey) {
    return NextResponse.json(
      { error: "Missing TRADIER_API_KEY" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message } = body as { message?: string };
  const userPrompt =
    (message ?? "").trim() ||
    "Find liquid bullish options plays expiring in the next 3-4 weeks";

  try {
    const intentResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: INTENT_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const intentText = intentResponse.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const intent = extractJson(intentText) as {
      tickers?: string[];
      optionType?: string;
      maxDaysToExpiry?: number;
      minDaysToExpiry?: number;
      maxBudgetPerContract?: number | null;
      maxStrike?: number | null;
      minStrike?: number | null;
    };

    const tickers = (intent.tickers ?? [])
      .map((t) => String(t).trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 4);
    const optionType = (intent.optionType ?? "both").toLowerCase();
    const minDays = Number(intent.minDaysToExpiry ?? 7);
    const maxDays = Number(intent.maxDaysToExpiry ?? 45);
    const maxBudgetRaw = intent.maxBudgetPerContract;
    const maxBudgetPerContract =
      maxBudgetRaw == null
        ? null
        : Number.isFinite(Number(maxBudgetRaw))
          ? Number(maxBudgetRaw)
          : null;
    const minStrike =
      intent.minStrike != null && Number.isFinite(Number(intent.minStrike))
        ? Number(intent.minStrike)
        : null;
    const maxStrike =
      intent.maxStrike != null && Number.isFinite(Number(intent.maxStrike))
        ? Number(intent.maxStrike)
        : null;

    if (tickers.length === 0) {
      return NextResponse.json(
        { error: "Intent extraction returned no tickers." },
        { status: 400 },
      );
    }

    const allContracts: TradierChainOption[] = [];
    let firstTradierCall = true;
    const beforeTradierCall = async () => {
      if (firstTradierCall) {
        firstTradierCall = false;
        return;
      }
      await sleep(300);
    };

    for (const ticker of tickers) {
      await beforeTradierCall();
      const expirations = await fetchTradierExpirations(ticker, tradierKey);
      const picked = pickExpirationsInWindow(
        expirations,
        minDays,
        maxDays,
        4,
      );

      for (const exp of picked) {
        await beforeTradierCall();
        const chain = await fetchTradierOptionChain(ticker, exp, tradierKey);
        let rows = filterByOptionType(chain, optionType);
        if (minStrike != null) {
          rows = rows.filter((r) => r.strike >= minStrike);
        }
        if (maxStrike != null) {
          rows = rows.filter((r) => r.strike <= maxStrike);
        }
        rows = filterByBudget(rows, maxBudgetPerContract);
        rows.sort((a, b) => scoreLiquidity(b) - scoreLiquidity(a));
        allContracts.push(...rows.slice(0, 35));
      }
    }

    const uniqueBySymbol = new Map<string, TradierChainOption>();
    for (const c of allContracts) {
      if (!uniqueBySymbol.has(c.symbol)) uniqueBySymbol.set(c.symbol, c);
    }
    const deduped = [...uniqueBySymbol.values()].sort(
      (a, b) => scoreLiquidity(b) - scoreLiquidity(a),
    );
    const forModel = deduped.slice(0, 90);

    if (forModel.length === 0) {
      return NextResponse.json(
        {
          error:
            "No contracts matched your filters (expiry window, option type, strike range, or budget vs bid×100). Broaden criteria or raise budget.",
        },
        { status: 404 },
      );
    }

    const rankPrompt = `User asked: "${userPrompt}"

Constraints used: minDays=${minDays}, maxDays=${maxDays}, optionType=${optionType}, maxBudgetPerContract=${maxBudgetPerContract ?? "none"} (total $ at bid × 100).

Tradier contracts (JSON):
${JSON.stringify(forModel, null, 2)}

Pick the best 5-7 by symbol and return the JSON.`;

    const rankResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: RANKER_SYSTEM,
      messages: [{ role: "user", content: rankPrompt }],
    });

    const rankText = rankResponse.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const ranked = extractJson(rankText) as Record<string, unknown>;
    const summary =
      typeof ranked.summary === "string" ? ranked.summary.trim() : "";
    const bySymbol = new Map(deduped.map((c) => [c.symbol, c]));
    const picksNormalized = (Array.isArray(ranked.picks) ? ranked.picks : [])
      .map((p) => normalizeRankedPick(p, bySymbol))
      .filter((p): p is ScreenerPick => p !== null)
      .slice(0, 7);

    if (!summary || picksNormalized.length < 3) {
      return NextResponse.json(
        { error: "Could not rank contracts. Try again." },
        { status: 502 },
      );
    }

    const picks = await enrichPicksWithPolygonPriceChanges(
      picksNormalized,
      POLYGON_KEY,
    );

    return NextResponse.json({ summary, picks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Screener failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
