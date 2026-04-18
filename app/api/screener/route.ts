import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const POLYGON_KEY = process.env.POLYGON_API_KEY!;

// ── Step 1: Claude extracts intent from the user's prompt ──────────────────
const INTENT_SYSTEM = `You are a trading assistant. Extract the user's options screening intent and return ONLY a JSON object with these fields:
- tickers: array of 3-4 stock tickers to scan (pick well-known liquid names that match the request, e.g. AAPL, TSLA, SPY, NVDA, AMD, MSFT, QQQ)
- optionType: "call", "put", or "both"
- maxDaysToExpiry: number (e.g. 30 for "this month", 45 for "next few weeks", 60 for "2 months")
- minDaysToExpiry: number (e.g. 7 minimum to avoid same-week expiry)
- maxStrike: number or null
- minStrike: number or null
No markdown, no commentary, just the JSON object.`;

// ── Step 2: Claude ranks real contracts ───────────────────────────────────
const RANKER_SYSTEM = `You are an options analyst. The user described a trade and you have real options contracts from Polygon.io. 
Score and select the best 5-7 contracts. Return ONLY a JSON object:
{
  "summary": "one sentence describing what you found",
  "picks": [
    {
      "ticker": "AAPL",
      "type": "Call",
      "strike": 195,
      "expiration": "May 16, 2025",
      "ivRank": 65,
      "volume": 4200,
      "signalScore": 78
    }
  ]
}
Rules:
- type must be exactly "Call" or "Put"
- strike is a number
- ivRank: estimate 0-100 based on implied_volatility from the data (multiply by 100 if it's a decimal like 0.65)
- volume: use the real volume from the data
- signalScore: your 0-100 ranking of this contract's opportunity quality
- expiration: human-readable like "May 16, 2025"
No markdown, no commentary, just the JSON object.`;

type ScreenerPick = {
  ticker: string;
  type: "Call" | "Put";
  strike: number;
  expiration: string;
  ivRank: number;
  volume: number;
  signalScore: number;
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

function normalizePick(raw: unknown): ScreenerPick | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ticker = String(o.ticker ?? "").trim().toUpperCase();
  const type = String(o.type ?? "").trim() === "Put" ? "Put" : "Call";
  const strike = Number(o.strike);
  const expiration = String(o.expiration ?? "").trim();
  const ivRank = Math.min(100, Math.max(0, Math.round(Number(o.ivRank))));
  const volume = Math.max(0, Math.round(Number(o.volume)));
  const signalScore = Math.min(100, Math.max(0, Math.round(Number(o.signalScore))));
  if (!ticker || !expiration || !Number.isFinite(strike)) return null;
  return { ticker, type, strike, expiration, ivRank, volume, signalScore };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Fetch real options from Polygon.io ────────────────────────────────────
async function fetchOptionsForTicker(
  ticker: string,
  optionType: string,
  minDays: number,
  maxDays: number
): Promise<object[]> {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + minDays);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + maxDays);

  const minExp = minDate.toISOString().split("T")[0];
  const maxExp = maxDate.toISOString().split("T")[0];

  const contractType = optionType === "both" ? "" : `&contract_type=${optionType}`;

  const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?expiration_date.gte=${minExp}&expiration_date.lte=${maxExp}${contractType}&limit=20&apiKey=${POLYGON_KEY}`;

  console.log("Polygon URL:", url);
  const res = await fetch(url);
  const json = await res.json();
  console.log("Polygon response:", JSON.stringify(json).slice(0, 500));
  if (!res.ok) return [];
  return json.results ?? [];
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }
  if (!POLYGON_KEY) {
    return NextResponse.json({ error: "Missing POLYGON_API_KEY" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message } = body as { message?: string };
  const userPrompt = (message ?? "").trim() ||
    "Find liquid bullish options plays expiring in the next 3-4 weeks";

  try {
    // ── Step 1: Extract intent ───────────────────────────────────────────
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
      tickers: string[];
      optionType: string;
      maxDaysToExpiry: number;
      minDaysToExpiry: number;
    };

    const tickers = (intent.tickers ?? []).slice(0, 4);
    const optionType = intent.optionType ?? "both";
    const minDays = intent.minDaysToExpiry ?? 7;
    const maxDays = intent.maxDaysToExpiry ?? 45;

    // ── Step 2: Fetch real options from Polygon ──────────────────────────
    const allContracts: object[] = [];
    for (const ticker of tickers) {
      const contracts = await fetchOptionsForTicker(ticker, optionType, minDays, maxDays);
      allContracts.push(...contracts);
      await sleep(250); // stay under free tier rate limit
    }

    if (allContracts.length === 0) {
      return NextResponse.json(
        { error: "No options contracts found for those tickers. Try different names or a wider date range." },
        { status: 404 }
      );
    }

    // ── Step 3: Claude ranks the real contracts ──────────────────────────
    const rankPrompt = `User asked: "${userPrompt}"

Real options contracts from Polygon.io:
${JSON.stringify(allContracts.slice(0, 40), null, 2)}

Pick the best 5-7 contracts and return the JSON.`;

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
    const summary = typeof ranked.summary === "string" ? ranked.summary.trim() : "";
    const picks = (Array.isArray(ranked.picks) ? ranked.picks : [])
      .map(normalizePick)
      .filter((p): p is ScreenerPick => p !== null)
      .slice(0, 7);

    if (!summary || picks.length < 3) {
      return NextResponse.json(
        { error: "Could not rank contracts. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ summary, picks });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Screener failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}