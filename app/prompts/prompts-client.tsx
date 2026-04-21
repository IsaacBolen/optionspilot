"use client";

import { useState } from "react";
import { AppChrome } from "../components/app-chrome";

type Prompt = {
  title: string;
  why: string;
  prompt: string;
};

type Category = {
  id: string;
  label: string;
  prompts: Prompt[];
};

const CATEGORIES: Category[] = [
  {
    id: "budget",
    label: "Budget",
    prompts: [
      {
        title: "Under $100 starter",
        why: "At this budget SPY and QQQ are almost always out of range. These tickers give you real contract options without blowing the budget on one trade.",
        prompt:
          "I have $75 to spend. Show me the best calls on PLTR, AMD, or COIN expiring in 2–3 weeks where the total contract cost is under $75. I want contracts where the premium has a realistic chance of going up 50–80% so I can sell for profit. Prioritize liquidity and momentum. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "$300 swing trade",
        why: "Mid-range budget where QQQ becomes accessible. Avoids SPY which is usually still too expensive for quality strikes at this level.",
        prompt:
          "I have $300 to spend. Show me the best calls on QQQ, NVDA, TSLA, or PLTR expiring in 2–3 weeks. I want contracts where the premium has a realistic chance of going up 40–60% so I can sell for profit. Prioritize momentum and signal score. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "$700 higher conviction",
        why: "At this budget SPY and full mega-cap access becomes realistic. Slightly longer expiry reduces theta risk when deploying more capital.",
        prompt:
          "I have $700 to spend. Show me the best calls on SPY, QQQ, NVDA, AAPL, or MSFT expiring in 3–4 weeks. I want contracts where the premium has a realistic chance of going up 40–60% so I can sell for profit. Prioritize high open interest and momentum. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
    ],
  },
  {
    id: "timeframe",
    label: "Timeframe",
    prompts: [
      {
        title: "Short — 1 week",
        why: "Very short dated means high gamma but fast time decay. Sticking to ETFs and mid-price names reduces the risk of getting burned by a slow move.",
        prompt:
          "I have $300 to spend. Show me the best calls on QQQ, PLTR, or AMD expiring in exactly 1 week. I want contracts where the premium has a realistic chance of going up 50–80% so I can sell for profit. Prioritize volume and momentum. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "Sweet spot — 2–3 weeks",
        why: "The verified best-performing timeframe in this app. Enough time for the thesis to develop without paying for too much premium.",
        prompt:
          "I have $500 to spend. Show me the best calls on SPY, QQQ, NVDA, or PLTR expiring in 2–3 weeks. I want contracts where the premium has a realistic chance of going up 40–60% so I can sell for profit. Prioritize momentum and liquidity. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "Patient — 4–5 weeks",
        why: "More time for the thesis to play out and lower daily theta burn. Open interest matters more here since you will almost certainly need to exit before expiry.",
        prompt:
          "I have $500 to spend. Show me the best calls on SPY, QQQ, NVDA, AAPL, or MSFT expiring in 4–5 weeks. I want contracts where the premium has a realistic chance of going up 40–60% so I can sell for profit. Prioritize open interest and signal score. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
    ],
  },
  {
    id: "strategy",
    label: "Strategy",
    prompts: [
      {
        title: "Momentum chase",
        why: "Follow strong price action into high-beta names. Higher exit target reflects the faster moves these stocks can make.",
        prompt:
          "I have $400 to spend. Show me the best calls on NVDA, TSLA, META, or PLTR expiring in 2–3 weeks. I want contracts where the premium has a realistic chance of going up 50–80% so I can sell for profit. Prioritize momentum and volume. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "High probability",
        why: "Lower exit target means higher win rate. ETFs only for consistency. Signal score and open interest over raw momentum.",
        prompt:
          "I have $500 to spend. Show me the best calls on QQQ or SPY expiring in 3–4 weeks. I want contracts where the premium has a realistic chance of going up 30–40% so I can sell for profit. Prioritize high signal score and high open interest. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "Bearish put play",
        why: "Same structure as call prompts so the AI extracts intent consistently. You are buying puts to sell them higher when the stock drops.",
        prompt:
          "I have $400 to spend. Show me the best puts on QQQ, NVDA, or TSLA expiring in 2–3 weeks. I want contracts where the premium has a realistic chance of going up 40–60% so I can sell for profit. Prioritize momentum and signal score. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "Speculative lottery",
        why: "Small premium, high volatility names, aggressive exit target. Low probability but maximum upside if the stock makes a big move.",
        prompt:
          "I have $150 to spend. Show me the best calls on PLTR, COIN, MSTR, or AMD expiring in 2–3 weeks where the total contract cost is under $50. I want contracts where the premium has a realistic chance of going up 100–200% so I can sell for profit. Prioritize momentum and volume. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
    ],
  },
  {
    id: "instrument",
    label: "Instrument",
    prompts: [
      {
        title: "Broad market ETFs",
        why: "QQQ, IWM, DIA — tightest spreads and most liquid options market. Best for clean entries and exits.",
        prompt:
          "I have $400 to spend. Show me the best calls on QQQ, IWM, or DIA expiring in 2–3 weeks. I want contracts where the premium has a realistic chance of going up 40–60% so I can sell for profit. Prioritize liquidity and signal score. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "Mega-cap tech",
        why: "NVDA, AAPL, MSFT, META, GOOGL — high volume, strong trends, reliable options liquidity.",
        prompt:
          "I have $500 to spend. Show me the best calls on NVDA, AAPL, MSFT, META, or GOOGL expiring in 2–3 weeks. I want contracts where the premium has a realistic chance of going up 40–60% so I can sell for profit. Prioritize momentum and signal score. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
      {
        title: "Speculative high-flyers",
        why: "PLTR, AMD, MSTR, COIN — volatile names with bigger premium swings. Higher exit target reflects the extra risk.",
        prompt:
          "I have $300 to spend. Show me the best calls on PLTR, AMD, MSTR, or COIN expiring in 2–3 weeks. I want contracts where the premium has a realistic chance of going up 60–100% so I can sell for profit. Prioritize momentum and volume. If my budget is too small for quality contracts on these tickers, tell me which tickers are more realistic and show me those instead.",
      },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        copied
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
          : "border-zinc-700/60 bg-zinc-950/60 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-300"
      }`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function PromptsClient() {
  const [activeTab, setActiveTab] = useState("budget");

  const activeCategory = CATEGORIES.find((c) => c.id === activeTab)!;

  return (
    <AppChrome>
      <main className="relative z-10 mx-auto max-w-4xl px-6 py-8 sm:py-10">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/90">
            Prompt library
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Find the right prompt for your trade
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Each prompt is structured to give the AI exactly what it needs — budget, tickers, timeframe, and exit goal. Copy one, paste it into the screener, and adjust any details before running.
          </p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 shadow-sm ring-1 ring-inset ring-white/5 backdrop-blur-sm">

          {/* Tabs */}
          <div className="flex border-b border-zinc-800/80 px-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`px-4 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === cat.id
                    ? "border-emerald-400 text-emerald-300"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Prompt list */}
          <div className="divide-y divide-zinc-800/60">
            {activeCategory.prompts.map((p) => (
              <div key={p.title} className="p-6">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h2 className="text-sm font-semibold text-white">{p.title}</h2>
                  <CopyButton text={p.prompt} />
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                  {p.why}
                </p>
                <div className="rounded-xl border border-zinc-700/40 bg-zinc-950/60 px-4 py-3 border-l-2 border-l-emerald-500/40">
                  <p className="text-sm text-zinc-300 leading-relaxed italic">
                    {p.prompt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          More advanced prompts coming soon
        </p>
      </main>
    </AppChrome>
  );
}
