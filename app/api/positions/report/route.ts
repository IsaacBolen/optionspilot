import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const REPORT_SYSTEM = `You are an options trading coach giving a daily situation report on a trader's open positions. For each position, analyze the original thesis against current market conditions and give a concrete, actionable recommendation.

Today's date is provided in the prompt. Use it to calculate exact days until expiration and to generate specific calendar dates for check-ins.

CRITICAL RULES FOR EXIT TARGETS:
- Always calculate the baseline exit target from the actual entry price. Example: entry $2.05, targeting 50% gain = exit at $3.08/share ($308/contract).
- Then reason about whether current conditions justify revising that target up or down.
- If the target has changed from what the original thesis implied, show the previous target and the new target and explain why in one sentence.
- If nothing material has changed, say: "No change — target remains $X.XX/share ($XXX/contract). Thesis intact."
- Always include both the per-share price AND the per-contract dollar amount in parentheses.

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
  "summary": "2-3 sentences explaining current conditions and why you recommend this action. Be direct — if the thesis is broken say so, if it is working say that too.",
  "exitTarget": {
    "previousTarget": "$3.08/share ($308/contract)",
    "currentTarget": "$3.50/share ($350/contract)",
    "changed": true,
    "reason": "NVDA momentum has strengthened since entry — raising target to capture more upside before expiry."
  },
  "checkInDates": [
    { "date": "April 24", "reason": "Fed speaker at 2pm EST — could move QQQ and tech names significantly." },
    { "date": "April 29", "reason": "Halfway to expiry — reassess if position has not moved at least 20%." },
    { "date": "May 5", "reason": "MUST EXIT by this date — 3 days before May 8 expiry to avoid theta decay acceleration." }
  ],
  "redFlags": "Any new risks that were not present when the trade was entered. If none say None."
}

No markdown, no commentary outside the JSON array.`;

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

  const prompt = `Today is ${today}.

Here are the trader's open positions with their original AI trade plans:

${positions
  .map(
    (p, i) => `
Position ${i + 1}:
- Ticker: ${p.ticker} ${p.type} $${p.strike} expiring ${p.expiration}
- Entry Price: $${p.entry_price}/share (${p.quantity} contract(s) = $${Number(p.entry_price) * Number(p.quantity) * 100} total cost)
- Current Price: ${p.current_price ? "$" + p.current_price + "/share" : "Unknown — assume unchanged from entry for target calculations"}
- Signal Score at entry: ${p.signal_score ?? "Unknown"}/100
- Original AI Thesis: ${p.ai_thesis ?? "No thesis recorded"}
- Date entered: ${p.created_at ? new Date(p.created_at as string | number | Date).toLocaleDateString() : "Unknown"}
- Days until expiration: ${p.expiration ? Math.ceil((new Date(p.expiration as string).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : "Unknown"}
`,
  )
  .join("\n")}

For each position:
1. Calculate the baseline exit target from the entry price (assume 40-60% gain target unless the original thesis specified otherwise)
2. Reason about whether current market conditions justify revising that target up or down
3. Provide 3 specific check-in dates anchored to real calendar events or expiry math
4. Give your honest recommendation`;

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

    const trimmed = text.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1].trim() : trimmed;
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("No JSON array in response");
    const report = JSON.parse(candidate.slice(start, end + 1));

    return NextResponse.json({ report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
