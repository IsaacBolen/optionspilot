import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const REPORT_SYSTEM = `You are an options trading coach giving a daily situation 
report on a trader's open positions. For each position, compare the original 
trade thesis against current conditions and give a clear, honest recommendation.

Today's date is provided in the prompt. Use it to calculate how much time is 
left until expiration and how urgent any decisions are.

Return ONLY a JSON array where each item has:
{
  "ticker": "NVDA",
  "type": "Call",
  "strike": 205,
  "recommendation": "Hold" | "Consider Selling" | "Sell Now" | "Already Expired",
  "urgency": "Low" | "Medium" | "High",
  "summary": "2-3 sentences explaining what has changed and why you recommend this action",
  "updatedExitTarget": "Updated suggestion for when/where to exit based on current conditions",
  "redFlags": "Any new risks that weren't present when the trade was entered. If none, say None."
}
Be direct and honest. If a thesis is broken, say so clearly. If a trade is 
working perfectly, say that too. No markdown, no commentary outside the JSON array.`;

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
- Entry Price: $${p.entry_price}/share (${p.quantity} contracts = $${Number(p.entry_price) * Number(p.quantity) * 100} total)
- Current Price: ${p.current_price ? "$" + p.current_price : "Unknown"}
- Platform: ${p.platform ?? "Unknown"}
- Signal Score at entry: ${p.signal_score ?? "Unknown"}/100
- Original AI Thesis: ${p.ai_thesis ?? "No thesis recorded"}
- Date entered: ${p.created_at ? new Date(p.created_at as string | number | Date).toLocaleDateString() : "Unknown"}
`,
  )
  .join("\n")}

For each position, analyze whether the original thesis still holds and give your recommendation.`;

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
