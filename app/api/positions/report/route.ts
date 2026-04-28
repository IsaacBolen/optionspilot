import Anthropic from "@anthropic-ai/sdk";
import {
  fetchTradierOptionQuotes,
  buildOccSymbol,
} from "@/lib/tradier-options";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TRADIER_KEY = process.env.TRADIER_API_KEY;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const REPORT_SYSTEM = `You are an options trading coach giving a daily situation report on a trader's open positions. For each position, analyze the original thesis against current market conditions and give a concrete, actionable recommendation.

Today's date is provided in the prompt. Use it to calculate exact days until expiration and to generate specific calendar dates for check-ins.

MOST IMPORTANT RULE — ALWAYS CHECK CURRENT P&L FIRST:
Before doing anything else, look at the current P&L percentage provided for each position. This is the most important input.
- If current P&L is already at or above 40%: The trader has already hit their minimum target. Lead your summary with this fact. Make the case for taking profit now vs holding for more. Be direct — "You are already up X% which meets your minimum target."
- If current P&L is already at or above 60%: The trader has exceeded their target. Strongly recommend considering a sell. The risk of giving back gains outweighs chasing more upside. Recommend "Consider Selling" or "Sell Now" unless there is an exceptionally strong reason to hold.
- If current P&L is between 20-40%: Good progress. Hold but tighten your mental stop. Do not let a winner turn into a loser.
- If current P&L is below 20%: Position has not moved meaningfully yet. Evaluate whether the thesis is still intact and whether there is enough time left.
- If current P&L is negative: Assess whether the thesis is broken or just needs more time. Flag urgency based on days remaining.

CRITICAL RULES FOR EXIT TARGETS:
- Always calculate the baseline exit target from the actual entry price. Example: entry $2.05, targeting 50% gain = exit at $3.08/share ($308/contract).
- Then reason about whether current conditions justify revising that target up or down.
- If the target has changed from what the original thesis implied, show the previous target and the new target and explain why in one sentence.
- If nothing material has changed, say: "No change — target remains $X.XX/share ($XXX/contract). Thesis intact."
- Always include both the per-share price AND the per-contract dollar amount in parentheses.
- If the trader is already past the minimum target, also show what the current profit is in dollar terms so they can see exactly what they would be locking in.

CRITICAL RULES FOR CHECK-IN DATES:
- Provide exactly 3 specific calendar dates (e.g. "April 24") with a one-line reason for each.
- Always include a must-exit date set to 3 days before expiration to avoid theta decay acceleration. Label it clearly as "MUST EXIT by".
- The other 2 dates should be tied to real upcoming events: Fed meetings, earnings, economic data releases, or key technical levels. If no known events, use logical time-based checkpoints.
- Never use vague language like "next week" or "soon". Always use specific dates.

Return ONLY a JSON array where each item has exactly this shape:
{
  "ticker": "NVDA",
  "type": "Call",
  "strike": 205,
  "recommendation": "Hold" | "Consider Selling" | "Sell Now" | "Already Expired",
  "urgency": "Low" | "Medium" | "High",
  "summary": "2-3 sentences. ALWAYS start by stating the current P&L percentage and whether it has hit the minimum target. Then give your recommendation reasoning.",
  "exitTarget": {
    "previousTarget": "$3.08/share ($308/contract)",
    "currentTarget": "$3.50/share ($350/contract)",
    "changed": true,
    "reason": "Already past minimum 40% target — locking in $105/contract profit now is a valid decision vs holding for more."
  },
  "checkInDates": [
    { "date": "April 24", "reason": "Fed speaker at 2pm EST — could move QQQ and tech names significantly." },
    { "date": "April 29", "reason": "Halfway to expiry — reassess if position has not moved at least 20%." },
    { "date": "May 5", "reason": "MUST EXIT by this date — 3 days before May 8 expiry to avoid theta decay acceleration." }
  ],
  "redFlags": "Any new risks that were not present when the trade was entered. If none say None."
}

No markdown, no commentary outside the JSON array.
---
REQUIRED: You MUST end your entire response with this exact block. No exceptions. Do not skip this even if data is incomplete. Use empty string for unknown values but always include every position id listed below:

<position_updates>
[
  {"id": "POSITION_ID_HERE", "current_signal_score": 75, "score_reasoning": "One or two sentences with no apostrophes or quotes"},
  ...one entry per position...
]
</position_updates>
---`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { positions } = body as {
    positions?: Array<Record<string, unknown>>;
  };

  if (!positions || positions.length === 0) {
    return NextResponse.json({ error: "No positions provided" }, { status: 400 });
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Build OCC symbols and fetch live option premiums from Tradier
  const occSymbols = positions.map((p, i) => {
    const optionType = String(p.type ?? "");
    const strikePrice = p.strike;
    console.log("[positions/report] Position field check", {
      index: i,
      id: String(p.id ?? ""),
      ticker: String(p.ticker ?? ""),
      type: optionType,
      strike: strikePrice,
      expiration: String(p.expiration ?? ""),
    });

    const occSymbol = buildOccSymbol(
      String(p.ticker ?? ""),
      String(p.expiration ?? ""),
      (p.type as "Call" | "Put") ?? "Call",
      Number(p.strike),
    );
    console.log("[positions/report] Built OCC symbol", {
      index: i,
      id: String(p.id ?? ""),
      symbol: occSymbol,
    });
    return occSymbol;
  });

  const livePrice = new Map<string, number>();
  if (TRADIER_KEY) {
    const quoteMaps = await Promise.all(
      occSymbols.map(async (symbol, i) => {
        const quoteMap = await fetchTradierOptionQuotes([symbol], TRADIER_KEY);
        console.log("[positions/report] Tradier quote map result", {
          index: i,
          id: String(positions[i]?.id ?? ""),
          symbol,
          entries: Array.from(quoteMap.entries()),
        });
        return quoteMap;
      })
    );
    for (const quoteMap of quoteMaps) {
      for (const [symbol, price] of quoteMap.entries()) {
        livePrice.set(symbol, price);
      }
    }
  }

  const positionIds = positions.map((p) => String(p.id ?? "")).filter(Boolean);

  const prompt = `Today is ${today}.

Here are the trader's open positions with their original AI trade plans:

${positions
  .map((p, i) => {
    const entryPrice = Number(p.entry_price);
    const ticker = String(p.ticker ?? "").trim().toUpperCase();
    const occSymbol = occSymbols[i];
    const liveCurrentPrice = livePrice.get(occSymbol) ?? null;
    const currentPrice = liveCurrentPrice ?? (p.current_price ? Number(p.current_price) : null);
    const hasCurrent = currentPrice !== null && Number.isFinite(currentPrice) && currentPrice > 0;
    const pnlPct = hasCurrent && entryPrice > 0
      ? Math.round(((currentPrice - entryPrice) / entryPrice) * 100)
      : null;
    const pnlDollar = hasCurrent
      ? Math.round((currentPrice - entryPrice) * Number(p.quantity) * 100)
      : null;
    const daysToExpiry = p.expiration
      ? Math.ceil(
          (new Date(p.expiration as string).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    return `
Position ${i + 1}:
- ID: ${String(p.id ?? "")}
- Ticker: ${ticker}
- Option Type: ${String(p.type ?? "Unknown")}
- Strike Price: $${Number(p.strike)}
- Expiration: ${String(p.expiration ?? "Unknown")}
- OCC Symbol: ${occSymbol}
- Entry Price: $${p.entry_price}/share (${p.quantity} contract(s) = $${entryPrice * Number(p.quantity) * 100} total cost)
- Current Option Premium (live from Tradier): ${hasCurrent ? "$" + currentPrice.toFixed(2) + "/share" : "Not available — Tradier may not have a quote yet"}
- Current P&L Percent: ${pnlPct !== null ? pnlPct + "%" : "Unknown"}
- Current P&L: ${pnlPct !== null ? pnlPct + "% (" + (pnlDollar! >= 0 ? "+" : "") + "$" + pnlDollar + " total)" : "Unknown"}
- Has hit 40% minimum target: ${pnlPct !== null ? (pnlPct >= 40 ? "YES — already at or past minimum exit target" : "No — not yet at 40% minimum") : "Unknown"}
- Has hit 60% maximum target: ${pnlPct !== null ? (pnlPct >= 60 ? "YES — already exceeded maximum target, strongly consider selling" : "No") : "Unknown"}
- Days until expiration: ${daysToExpiry ?? "Unknown"}
- Original Signal Score: ${p.signal_score ?? "Unknown"}/100
- Original AI Thesis: ${p.ai_thesis ?? "No thesis recorded"}
- Date entered: ${p.created_at ? new Date(p.created_at as string | number | Date).toLocaleDateString() : "Unknown"}
`;
  })
  .join("\n")}

For each position:
1. Calculate the baseline exit target from the entry price (assume 40-60% gain target unless the original thesis specified otherwise)
2. Use the live Tradier option premium to assess current P&L and whether the trader should act now
3. If no live price is available, reason from time remaining, thesis strength, and signal score
4. Provide 3 specific check-in dates anchored to real calendar events or expiry math
5. Give your honest recommendation

Position IDs that MUST be included in <position_updates>:
${positionIds.map((id) => `- ${id}`).join("\n")}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: REPORT_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    console.log("[positions/report] Raw Claude response text:", text);

    const trimmed = text.trim();
    const positionUpdatesRegex = /<position_updates>([\s\S]*?)<\/position_updates>/i;
    console.log(
      "[positions/report] position_updates extraction regex:",
      positionUpdatesRegex.toString()
    );
    const positionUpdatesMatch = trimmed.match(
      positionUpdatesRegex
    );
    let positionUpdates: Array<{
      id: string;
      current_signal_score: number;
      score_reasoning?: string;
    }> = [];
    if (positionUpdatesMatch) {
      const rawPositionUpdates = positionUpdatesMatch[1].trim();
      // Normalize single-quoted values to double-quoted JSON strings.
      const sanitizedPositionUpdates = rawPositionUpdates.replace(
        /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
        (_, value: string) => `"${value.replace(/"/g, '\\"')}"`
      );
      try {
        positionUpdates = JSON.parse(sanitizedPositionUpdates);
      } catch {
        console.error("Failed to parse <position_updates> block:", rawPositionUpdates);
        positionUpdates = [];
      }
    }

    const reportCandidate = positionUpdatesMatch
      ? trimmed.replace(positionUpdatesMatch[0], "").trim()
      : trimmed;
    const fence = reportCandidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1].trim() : reportCandidate;
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("No JSON array in response");
    const report = JSON.parse(candidate.slice(start, end + 1));

    const pricesOut = positions.map((p, i) => {
      const occSymbol = occSymbols[i];
      const live = livePrice.get(occSymbol) ?? null;
      return {
        id: String(p.id),
        current_price: live,
      };
    });

    const priceUpdates = positions
      .map((p, i) => ({
        id: p.id,
        current_price: livePrice.get(occSymbols[i]) ?? null,
      }))
      .filter((u) => u.current_price !== null);

    return NextResponse.json({ report, prices: pricesOut, priceUpdates, positionUpdates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
