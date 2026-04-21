"use client";

import { useState } from "react";

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
        why: "SPY, QQQ, IWM — tightest spreads and most liquid options market. Best for clean entries and exits.",
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

export function PromptLibraryModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (prompt: string) => void;
}) {
  const [activeTab, setActiveTab] = useState("budget");

  const activeCategory = CATEGORIES.find((c) => c.id === activeTab)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-zinc-800/80 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">Prompt library</h3>
            <p className="mt-1 text-xs text-zinc-500">Click any prompt to load it into the screener — review before running</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xl leading-none mt-0.5"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800/80 px-6 shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-4 py-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === cat.id
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Prompt cards */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-3">
          {activeCategory.prompts.map((p) => (
            <button
              key={p.title}
              onClick={() => {
                onSelect(p.prompt);
                onClose();
              }}
              className="text-left rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-4 hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] transition group"
            >
              <p className="text-sm font-semibold text-white mb-1 group-hover:text-emerald-300 transition">
                {p.title}
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                {p.why}
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-emerald-500/40 pl-3 italic">
                {p.prompt}
              </p>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 shrink-0">
          <p className="text-xs text-zinc-600">More advanced prompts coming soon</p>
        </div>
      </div>
    </div>
  );
}
