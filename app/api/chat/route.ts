import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { enrichPicksWithPolygonPriceChanges } from "@/lib/enrich-screener-picks";

/** Dashboard news headline sentiment is handled separately by `app/api/sentiment/route.ts`. */

const DASHBOARD_SYSTEM = `You are an AI trading assistant for OptionsPilot. The user is asking about market news, their positions (AAPL call $185 strike, NVDA put $118 strike, SPY call $520 strike), or general trading questions. Keep responses concise, 2-3 sentences max, conversational and helpful.`;

const SCREENER_SYSTEM = `You are an expert options trader and analyst for OptionsPilot. Your job is to find real, profitable options opportunities based on what the user asks for.

CRITICAL RULES:
1. CONTRACT COST: When a user states a maximum budget (e.g. "under $100", "less than $150 each"), the TOTAL contract cost (estPremium × 100) MUST be at or below that number. "Under $100" means estPremium must be $1.00 or less. NEVER return a pick that violates the user's budget. If you cannot find quality picks within budget, choose lower-priced stocks or ETFs with lower premiums.

2. PROFITABILITY FOCUS: Rank picks by realistic profit potential. Consider: momentum (is the stock trending?), upcoming catalysts (earnings, product launches), IV rank (high IV = expensive premiums, low IV = cheap to buy), and time decay risk.

3. TICKER SELECTION: Do not default to only AAPL, NVDA, SPY, TSLA. Think broadly — consider mid-cap stocks, sector ETFs, or any ticker where the setup genuinely fits the user's criteria. For low-budget requests, consider lower-priced stocks like F, SOFI, PLTR, BAC, AMD at lower strikes, or far OTM options on larger names.

4. REALISM: Strikes should be realistic relative to where the stock actually trades. Expirations must be after today (April 18, 2026).

5. RESPONSE FORMAT: Return ONLY a JSON object with "summary" (2-3 sentences explaining your picks and why they have profit potential) and "picks" array. Each pick must have: ticker, type ("Call" or "Put"), strike (number), expiration (human readable date), ivRank (0-100 integer), volume (integer), signalScore (0-100 integer), estPremium (number in dollars per share — must satisfy budget constraint), premiumRange (string like "$0.75 - $1.25").

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

function getTextContent(response: Anthropic.Messages.Message): string {
  const parts: string[] = [];
  for (const block of response.content) {
    if (block.type === "text") {
      parts.push(block.text);
    }
  }
  return parts.join("").trim();
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function normalizePick(raw: unknown): ScreenerPick | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ticker = String(o.ticker ?? "").trim().toUpperCase();
  const typeRaw = String(o.type ?? "").trim();
  const type = typeRaw === "Put" ? "Put" : "Call";
  const strike = Number(o.strike);
  const expiration = String(o.expiration ?? "").trim();
  const ivRank = Math.round(Number(o.ivRank));
  const volume = Math.round(Number(o.volume));
  const signalScore = Math.round(Number(o.signalScore));
  const estRaw = Number(o.estPremium);
  const estPremium =
    Number.isFinite(estRaw) && estRaw >= 0
      ? Math.round(estRaw * 100) / 100
      : null;
  const pr = String(o.premiumRange ?? "").trim();
  const premiumRange = pr.length > 0 ? pr : "—";
  if (!ticker || !expiration || !Number.isFinite(strike)) return null;
  if (!Number.isFinite(ivRank) || !Number.isFinite(volume)) return null;
  if (!Number.isFinite(signalScore)) return null;
  return {
    ticker,
    type,
    strike,
    expiration,
    ivRank: Math.min(100, Math.max(0, ivRank)),
    volume: Math.max(0, volume),
    signalScore: Math.min(100, Math.max(0, signalScore)),
    estPremium,
    premiumRange,
    change24h: null,
    change1w: null,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ANTHROPIC_API_KEY" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
  }

  const { message, context } = body as {
    message?: unknown;
    context?: unknown;
  };

  const msg =
    typeof message === "string" ? message.trim() : "";
  const ctx = context === "screener" ? "screener" : "dashboard";

  const anthropic = new Anthropic({ apiKey });

  const model = "claude-sonnet-4-5";

  try {
    if (ctx === "dashboard") {
      const userText =
        msg ||
        "Give a very brief morning-style read on markets and how it might relate to my AAPL, NVDA, and SPY options.";

      const response = await anthropic.messages.create({
        model,
        max_tokens: 400,
        system: DASHBOARD_SYSTEM,
        messages: [{ role: "user", content: userText }],
      });

      const reply = getTextContent(response);
      if (!reply) {
        return NextResponse.json(
          { error: "Empty model response" },
          { status: 502 },
        );
      }
      return NextResponse.json({ reply });
    }

    const userText =
      msg ||
      "Suggest a handful of liquid US equity options that could fit a balanced bullish-bias book over the next few weeks.";

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: SCREENER_SYSTEM,
      messages: [{ role: "user", content: userText }],
    });

    const rawText = getTextContent(response);
    if (!rawText) {
      return NextResponse.json(
        { error: "Empty model response" },
        { status: 502 },
      );
    }

    const parsed = extractJsonObject(rawText) as Record<string, unknown>;
    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const picksRaw = parsed.picks;
    const picksList = Array.isArray(picksRaw) ? picksRaw : [];
    const picksNormalized = picksList
      .map(normalizePick)
      .filter((p): p is ScreenerPick => p !== null)
      .slice(0, 7);

    if (!summary || picksNormalized.length < 3) {
      return NextResponse.json(
        {
          error:
            "Model returned unusable screener JSON (need summary and at least 3 valid picks).",
        },
        { status: 502 },
      );
    }

    const picks = await enrichPicksWithPolygonPriceChanges(
      picksNormalized,
      process.env.POLYGON_API_KEY,
    );

    return NextResponse.json({ summary, picks });
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : "Anthropic request failed";
    return NextResponse.json({ error: messageText }, { status: 502 });
  }
}
