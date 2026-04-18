import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const MODEL = "claude-sonnet-4-5";

const SENTIMENT_SYSTEM = `You analyze financial news headlines for the given tickers. Return ONLY a valid JSON object with no markdown fences:
{"sentimentScore": <integer 0-100, where 0 is very bearish and 100 is very bullish>,
 "sentimentLabel": "Bullish" | "Bearish" | "Neutral",
 "summary": "<2-3 sentences describing overall sentiment and what is driving it>"}

Choose sentimentLabel consistently with the score: roughly 0-39 Bearish, 40-60 Neutral, 61-100 Bullish unless headlines justify a mixed read—then pick the best single label and explain in summary.`;

type HeadlineInput = {
  headline: string;
  summary?: string | undefined;
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

function normalizeLabel(
  raw: unknown,
): "Bullish" | "Bearish" | "Neutral" {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("bear")) return "Bearish";
  if (s.includes("bull")) return "Bullish";
  return "Neutral";
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

  const { tickers, headlines } = body as {
    tickers?: unknown;
    headlines?: unknown;
  };

  const tickerList = Array.isArray(tickers)
    ? tickers
        .map((t) => String(t).trim().toUpperCase())
        .filter(Boolean)
    : [];

  const headlineList: HeadlineInput[] = Array.isArray(headlines)
    ? headlines.reduce<HeadlineInput[]>((acc, h) => {
        if (typeof h === "string") {
          const headline = h.trim();
          if (headline) acc.push({ headline, summary: undefined });
          return acc;
        }
        if (h && typeof h === "object" && "headline" in h) {
          const o = h as Record<string, unknown>;
          const headline = String(o.headline ?? "").trim();
          if (!headline) return acc;
          acc.push({
            headline,
            summary:
              typeof o.summary === "string" ? o.summary.trim() : undefined,
          });
        }
        return acc;
      }, [])
    : [];

  if (tickerList.length === 0) {
    return NextResponse.json(
      { error: "tickers must be a non-empty array" },
      { status: 400 },
    );
  }

  if (headlineList.length === 0) {
    return NextResponse.json(
      { error: "headlines must be a non-empty array" },
      { status: 400 },
    );
  }

  const headlinesBlock = headlineList
    .slice(0, 30)
    .map((h, i) => {
      const sum = h.summary ? `\n   Summary: ${h.summary}` : "";
      return `${i + 1}. ${h.headline}${sum}`;
    })
    .join("\n");

  const userMessage = `Tickers: ${tickerList.join(", ")}

Headlines (${headlineList.length} items):
${headlinesBlock}`;

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SENTIMENT_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = getTextContent(response);
    if (!rawText) {
      return NextResponse.json(
        { error: "Empty model response" },
        { status: 502 },
      );
    }

    const parsed = extractJsonObject(rawText) as Record<string, unknown>;
    let sentimentScore = Math.round(Number(parsed.sentimentScore));
    if (!Number.isFinite(sentimentScore)) sentimentScore = 50;
    sentimentScore = Math.min(100, Math.max(0, sentimentScore));

    const sentimentLabel = normalizeLabel(parsed.sentimentLabel);
    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim() : "";

    if (!summary) {
      return NextResponse.json(
        { error: "Model returned empty summary" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      sentimentScore,
      sentimentLabel,
      summary,
    });
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : "Sentiment request failed";
    return NextResponse.json({ error: messageText }, { status: 502 });
  }
}
