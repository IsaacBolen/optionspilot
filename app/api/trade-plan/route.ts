import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TRADE_PLAN_SYSTEM = `You are an expert options trading coach helping a retail 
trader decide whether to take a specific options trade. Be direct, honest, and 
specific. Do not be overly optimistic — if the trade has real risks, say so clearly.

Return ONLY a JSON object with these exact fields:
{
  "thesis": "2-3 sentences on why this specific contract makes sense RIGHT NOW. What is the core directional or volatility bet?",
  "entryTiming": "Should they enter today, wait for a pullback, or wait for a specific condition? Be specific.",
  "holdPlan": "How long to hold this contract ideally? Give a range in days.",
  "targetExit": "At what % premium gain should they seriously consider selling? e.g. 40-60% gain on the premium paid",
  "stopLoss": "At what % loss should they cut and move on? Be specific e.g. 'if premium drops 40% from entry, exit'",
  "whatKillsThisTrade": "2-3 specific things that would invalidate this thesis and mean they should exit early",
  "confidenceLevel": "Low / Medium / High — your honest assessment",
  "confidenceReason": "One sentence explaining the confidence level",
  "warningFlags": "Any red flags about this specific contract — wide spread, low volume, near expiry risk, earnings risk etc. If none, say None."
}
No markdown, no commentary outside the JSON.`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contract, userBudget, userPrompt } = body as {
    contract?: Record<string, unknown>;
    userBudget?: number | null;
    userPrompt?: string;
  };

  if (!contract) {
    return NextResponse.json({ error: "No contract provided" }, { status: 400 });
  }

  const prompt = `Today's date is ${new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
})}. Use this to accurately calculate days to expiration and whether contracts are short-dated, medium-term, or long-dated.\n\nThe trader asked: "${userPrompt ?? "find me a good options trade"}"
Their budget: ${userBudget ? "$" + userBudget : "not specified"}

They are considering this specific contract:
- Ticker: ${contract.ticker}
- Type: ${contract.type}
- Strike: $${contract.strike}
- Expiration: ${contract.expiration}
- Est. Premium: $${contract.estPremium}/share (~$${Math.round(Number(contract.estPremium) * 100)} per contract)
- Bid/Ask Range: ${contract.premiumRange}
- IV Rank: ${contract.ivRank}%
- Volume today: ${contract.volume}
- Signal Score: ${contract.signalScore}/100
- 1W price change on underlying: ${contract.change1w ?? "N/A"}%

Generate a complete trade plan for this specific contract.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: TRADE_PLAN_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const trimmed = text.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1].trim() : trimmed;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in response");
    const plan = JSON.parse(candidate.slice(start, end + 1));

    return NextResponse.json({ plan });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Trade plan failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
