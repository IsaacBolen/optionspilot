import Anthropic from "@anthropic-ai/sdk";
import {
  buildOccSymbol,
  fetchTradierOptionQuotes,
} from "@/lib/tradier-options";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const REPORT_SYSTEM = `You are an options trading coach. For each open position, write a full "thesis vs reality" update: compare the saved trade thesis (and any targets or risk language in it) to what is happening now—especially premium vs entry, passage of time versus the original hold plan, and whether the thesis conditions are playing out. Factor in signal_score from the input only as context for how strong the entry setup was rated.

CRITICAL OPTIONS PRICING RULES — you must follow these exactly:

1. We are trading PREMIUM MOVEMENT, not waiting for the stock to reach the strike price. The goal is always to sell the contract for more than we paid — we almost never hold to expiration.

2. To estimate how much the premium will move, use delta. For example: if a put has delta of -0.20 and the stock drops $5, the premium increases by approximately $1.00 (0.20 × $5 × 100 shares). A $10 drop would increase the premium by ~$2.00.

3. When setting price targets, reason like this: 'IWM is currently at $X. If it drops to $Y (a $Z move), with delta of approximately [estimate], the premium would move from $A to approximately $B.' Always give a realistic premium target based on the expected stock move, not just a percentage of current premium.

4. Do NOT cap upside targets at 50-100% unless that's genuinely all the move supports. A put going from OTM to ITM can easily 3x-5x in premium. Reason from the actual delta and expected move size.

5. Stop loss should be based on either: (a) the premium decaying to a set dollar amount, OR (b) the underlying breaking a key technical level that invalidates the thesis — whichever comes first.

6. Always state targets in both stock price terms AND premium dollar terms. Example: 'If IWM drops to $275 (from $282), premium should reach approximately $1.80-2.20. If IWM drops to $270, premium could reach $3.00-4.00.'

Return raw JSON only. Do not wrap in markdown code fences. Do not use \`\`\`json. Start your response directly with [ and end with ].

The user message states today's date in ISO form (YYYY-MM-DD). Use it with each position's expiration to reason carefully about calendar time left and time decay (theta): nearer expiry and opposing directional moves matter more for short-dated options.

Output rules:
- original_thesis: short string pulling the key points from ai_thesis (not the full paste unless it is already brief).
- thesis_still_valid: true only if the core trade logic from the thesis still holds given current_price vs entry_price and time remaining.
- thesis_update: concrete commentary on what changed or was confirmed since entry—premium movement, decay vs plan, catalysts or levels mentioned in the thesis.
- original_target_exit / original_stop_loss: extract from ai_thesis when explicit; if only implied, infer briefly and note that you inferred.
- updated_target_exit / updated_stop_loss: revise for current conditions and time left.
- time_remaining_note: compare time left to what the thesis implied for holding horizon (if unstated, say so) and what that implies for decay risk.
- what_to_watch: the 1–2 most important monitors now (levels, events, IV, underlying behavior).
- action: "Hold" | "Consider Selling" | "Sell Now" — include Sell Now or Consider Selling when thesis is broken, decay dominates, or risk/reward no longer favors holding.
- confidence: "High" | "Medium" | "Low".
- reasoning: exactly 2–3 sentences of plain English explaining the recommendation.

Numeric echoes: Use the provided entry_price for entry_price in output. For current_price, echo the provided current_price when it is a number; when current_price is null (no live quote), output null for current_price and null for pnl_percent. When both entry_price and current_price are numbers, set pnl_percent to the percentage gain or loss on premium: round sensibly (e.g. nearest integer) from ((current_price - entry_price) / entry_price) * 100.

Return ONLY a JSON array with one object per input position, in the same order. Each object must have exactly these keys:
{
  "ticker": string,
  "action": "Hold" | "Consider Selling" | "Sell Now",
  "current_price": number | null,
  "entry_price": number,
  "pnl_percent": number | null,
  "original_thesis": string,
  "thesis_still_valid": boolean,
  "thesis_update": string,
  "original_target_exit": string,
  "updated_target_exit": string,
  "original_stop_loss": string,
  "updated_stop_loss": string,
  "time_remaining_note": string,
  "what_to_watch": string,
  "confidence": "High" | "Medium" | "Low",
  "reasoning": string
}

Return only the JSON array with no text before or after.`;

const SCORE_SYSTEM = `You are scoring current trade quality for open options positions.

Return ONLY a JSON array. Do not use markdown or code fences.
Each item must have exactly:
{"id":"...","current_signal_score":75,"score_reasoning":"One or two sentences"}

Scoring rules:
- current_signal_score is an integer from 0 to 100.
- score_reasoning should be concise and reference price progress vs entry.
- Include exactly one item per provided position id.`;

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

  // Build OCC symbols and fetch live option premiums from Tradier
  const debugSymbols = positions.map((p) => {
    const occSymbol = buildOccSymbol(
      String(p.ticker ?? ""),
      String(p.expiration ?? ""),
      (p.type as "Call" | "Put") ?? "Call",
      Number(p.strike),
    );
    return {
      id: String(p.id ?? ""),
      ticker: String(p.ticker ?? ""),
      strike: Number(p.strike),
      type: String(p.type ?? ""),
      expiration: String(p.expiration ?? ""),
      occSymbol,
    };
  });

  const occSymbols = positions.map((p) => {
    const optionType = String(p.type ?? "");
    const strikePrice = p.strike;

    const occSymbol = buildOccSymbol(
      String(p.ticker ?? ""),
      String(p.expiration ?? ""),
      (p.type as "Call" | "Put") ?? "Call",
      Number(p.strike),
    );
    return occSymbol;
  });

  let livePrice = new Map<string, number>();
  if (process.env.TRADIER_API_KEY) {
    livePrice = await fetchTradierOptionQuotes(
      occSymbols,
      process.env.TRADIER_API_KEY,
    );
  }

  const reportDateIso = new Date().toISOString().split("T")[0];

  const positionsForReport = positions.map((p, i) => {
    const occSymbol = occSymbols[i];
    const live = livePrice.get(occSymbol);
    const currentPrice =
      live !== undefined && Number.isFinite(live) && live > 0 ? live : null;

    return {
      ticker: String(p.ticker ?? "").trim().toUpperCase(),
      type: String(p.type ?? ""),
      strike: Number(p.strike),
      expiration: String(p.expiration ?? ""),
      entry_price: Number(p.entry_price),
      current_price: currentPrice,
      ai_thesis: String(p.ai_thesis ?? ""),
      signal_score: p.signal_score ?? null,
    };
  });

  const prompt = `Today's date is ${reportDateIso} (ISO YYYY-MM-DD). Reason carefully about time decay relative to each position's expiration given this date.

Perform a full thesis-vs-reality situation update for each position below. Contract identity, entry premium, saved thesis text, and original signal score are inputs. current_price is the live option premium from Tradier when present; when null, no usable quote was available—inference should lean on thesis, time to expiration, and signal_score.

Positions (JSON array, preserve order):
${JSON.stringify(positionsForReport, null, 2)}

Return only the JSON array in the exact schema from your system instructions—one object per position in the same order.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: REPORT_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const withoutLeadingFence = text
      .replace(/^\s*```json\s*/i, "")
      .replace(/^\s*```\s*/i, "");
    const withoutFences = withoutLeadingFence.replace(/\s*```\s*$/i, "");
    const trimmed = withoutFences.trim();
    let report: unknown[] = [];
    try {
      const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fence ? fence[1].trim() : trimmed;
      const start = candidate.indexOf("[");
      const end = candidate.lastIndexOf("]");
      if (start === -1 || end === -1) {
        throw new Error("No JSON array in report section");
      }
      report = JSON.parse(candidate.slice(start, end + 1)) as unknown[];
    } catch (reportErr) {
      console.error("[positions/report] Failed parsing report JSON:", reportErr);
      report = [];
    }

    let positionUpdates: Array<{
      id: string;
      current_signal_score: number;
      score_reasoning?: string;
    }> = [];
    try {
      const scoringPayload = positions.map((p, i) => {
        const occSymbol = occSymbols[i];
        const current = livePrice.get(occSymbol) ?? null;
        return {
          id: String(p.id ?? ""),
          ticker: String(p.ticker ?? ""),
          original_signal_score: p.signal_score ?? null,
          entry_price: Number(p.entry_price),
          current_price: current,
        };
      });

      const scoringPrompt = `Score these positions and return only a JSON array:
${JSON.stringify(scoringPayload, null, 2)}`;

      const scoringResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SCORE_SYSTEM,
        messages: [{ role: "user", content: scoringPrompt }],
      });

      const scoringText = scoringResponse.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      const scoringNoLead = scoringText
        .replace(/^\s*```json\s*/i, "")
        .replace(/^\s*```\s*/i, "");
      const scoringTrimmed = scoringNoLead.replace(/\s*```\s*$/i, "").trim();
      const scoringFence = scoringTrimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const scoringCandidate = scoringFence
        ? scoringFence[1].trim()
        : scoringTrimmed;
      const scoreStart = scoringCandidate.indexOf("[");
      const scoreEnd = scoringCandidate.lastIndexOf("]");
      if (scoreStart !== -1 && scoreEnd !== -1) {
        positionUpdates = JSON.parse(
          scoringCandidate.slice(scoreStart, scoreEnd + 1)
        ) as Array<{
          id: string;
          current_signal_score: number;
          score_reasoning?: string;
        }>;
      }
    } catch (positionErr) {
      console.error(
        "[positions/report] Failed parsing position_updates JSON:",
        positionErr
      );
      positionUpdates = [];
    }

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

    return NextResponse.json({
      report,
      prices: pricesOut,
      priceUpdates,
      positionUpdates,
      debugSymbols,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
