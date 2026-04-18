"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AppChrome } from "../components/app-chrome";

type ScreenerFilter = "all" | "calls" | "puts" | "highIv" | "unusualVol";

type ScreenerRow = {
  ticker: string;
  type: "Call" | "Put";
  strike: number;
  expiration: string;
  ivRank: number;
  volume: number;
  signalScore: number;
};

type StatCard = {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
};

const PLACEHOLDER =
  "e.g. I want a call option expiring in 2-4 weeks, premium under $1.00 per contract, that I can sell when it goes up 50%...";

const EXAMPLE_PROMPTS = [
  "Calls under $100 expiring this month",
  "High IV puts for premium selling",
  "Bullish plays on tech stocks",
  "Low cost calls with 2-4 week expiry",
] as const;

const DEFAULT_STATS: StatCard[] = [
  {
    label: "Opportunities Found",
    value: "24",
    hint: "Matching your criteria",
  },
  {
    label: "Highest Signal",
    value: "TSLA Call",
    hint: "Top-ranked setup",
    valueClass: "text-emerald-400",
  },
  {
    label: "Avg IV Rank",
    value: "72%",
    hint: "Across screened names",
  },
];

const DEFAULT_ROWS: ScreenerRow[] = [
  {
    ticker: "TSLA",
    type: "Call",
    strike: 250,
    expiration: "May 2, 2025",
    ivRank: 91,
    volume: 12400,
    signalScore: 94,
  },
  {
    ticker: "NVDA",
    type: "Put",
    strike: 118,
    expiration: "Apr 25, 2025",
    ivRank: 84,
    volume: 9100,
    signalScore: 88,
  },
  {
    ticker: "AAPL",
    type: "Call",
    strike: 195,
    expiration: "May 9, 2025",
    ivRank: 68,
    volume: 4200,
    signalScore: 78,
  },
  {
    ticker: "SPY",
    type: "Call",
    strike: 528,
    expiration: "Jun 20, 2025",
    ivRank: 55,
    volume: 15200,
    signalScore: 72,
  },
  {
    ticker: "AMD",
    type: "Put",
    strike: 112,
    expiration: "May 16, 2025",
    ivRank: 77,
    volume: 6100,
    signalScore: 81,
  },
  {
    ticker: "MSFT",
    type: "Call",
    strike: 415,
    expiration: "Jun 6, 2025",
    ivRank: 49,
    volume: 3800,
    signalScore: 69,
  },
  {
    ticker: "AAPL",
    type: "Put",
    strike: 180,
    expiration: "Apr 18, 2025",
    ivRank: 62,
    volume: 8900,
    signalScore: 75,
  },
];

const REFINED_STATS: StatCard[] = [
  {
    label: "Opportunities Found",
    value: "18",
    hint: "AI-ranked for your prompt",
  },
  {
    label: "Highest Signal",
    value: "META Call",
    hint: "Top-ranked setup",
    valueClass: "text-emerald-400",
  },
  {
    label: "Avg IV Rank",
    value: "64%",
    hint: "Across screened names",
  },
];

const REFINED_ROWS: ScreenerRow[] = [
  {
    ticker: "META",
    type: "Call",
    strike: 485,
    expiration: "May 23, 2025",
    ivRank: 58,
    volume: 9800,
    signalScore: 91,
  },
  {
    ticker: "GOOGL",
    type: "Call",
    strike: 165,
    expiration: "May 16, 2025",
    ivRank: 52,
    volume: 7200,
    signalScore: 86,
  },
  {
    ticker: "QQQ",
    type: "Put",
    strike: 445,
    expiration: "Jun 6, 2025",
    ivRank: 71,
    volume: 18400,
    signalScore: 83,
  },
  {
    ticker: "AMZN",
    type: "Call",
    strike: 182,
    expiration: "May 9, 2025",
    ivRank: 61,
    volume: 5600,
    signalScore: 80,
  },
  {
    ticker: "IWM",
    type: "Put",
    strike: 198,
    expiration: "May 30, 2025",
    ivRank: 66,
    volume: 4300,
    signalScore: 76,
  },
  {
    ticker: "SMCI",
    type: "Call",
    strike: 820,
    expiration: "Jun 20, 2025",
    ivRank: 88,
    volume: 11200,
    signalScore: 89,
  },
];

const ANALYSIS_MS = 1500;

export function ScreenerClient() {
  const [prompt, setPrompt] = useState("");
  const [screenerFilter, setScreenerFilter] =
    useState<ScreenerFilter>("all");
  const [refinedResultsActive, setRefinedResultsActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const stats = refinedResultsActive ? REFINED_STATS : DEFAULT_STATS;
  const baseRows = refinedResultsActive ? REFINED_ROWS : DEFAULT_ROWS;

  const filteredScreenerRows = useMemo(() => {
    const HIGH_IV_MIN = 75;
    const UNUSUAL_VOL_MIN = 8000;

    return baseRows.filter((row) => {
      if (screenerFilter === "calls") return row.type === "Call";
      if (screenerFilter === "puts") return row.type === "Put";
      if (screenerFilter === "highIv") return row.ivRank >= HIGH_IV_MIN;
      if (screenerFilter === "unusualVol")
        return row.volume >= UNUSUAL_VOL_MIN;
      return true;
    });
  }, [baseRows, screenerFilter]);

  const screenerFilters: { id: ScreenerFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "calls", label: "Calls" },
    { id: "puts", label: "Puts" },
    { id: "highIv", label: "High IV" },
    { id: "unusualVol", label: "Unusual Volume" },
  ];

  const runSearch = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsAnalyzing(true);
    timeoutRef.current = setTimeout(() => {
      setIsAnalyzing(false);
      setRefinedResultsActive((prev) => !prev);
      timeoutRef.current = null;
    }, ANALYSIS_MS);
  }, []);

  const handleFindTrades = () => {
    runSearch();
  };

  const handleExampleChip = (text: string) => {
    setPrompt(text);
    runSearch();
  };

  return (
    <AppChrome>
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <section className="relative mb-10 overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-zinc-950 p-6 shadow-[0_0_80px_-20px_rgba(16,185,129,0.35)] ring-1 ring-inset ring-white/[0.06] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/90">
              AI-powered scan
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              What trade are you looking for?
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Describe your thesis, timeframe, and risk budget—OptionsPilot
              will surface contracts that fit.
            </p>

            <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-stretch">
              <div className="relative min-h-[140px] flex-1 rounded-2xl p-[1px] shadow-[0_0_48px_-8px_rgba(16,185,129,0.45)]">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400/25 via-emerald-500/10 to-transparent opacity-80" />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={5}
                  className="relative z-10 min-h-[140px] w-full resize-y rounded-2xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 sm:text-base"
                  aria-label="Describe the trade you are looking for"
                />
              </div>

              <div className="flex shrink-0 flex-col justify-end lg:w-44">
                <button
                  type="button"
                  onClick={handleFindTrades}
                  disabled={isAnalyzing}
                  className="h-12 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 shadow-[0_0_32px_rgba(16,185,129,0.45)] transition hover:bg-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 disabled:pointer-events-none disabled:opacity-60 lg:h-full lg:min-h-[140px] lg:py-4"
                >
                  {isAnalyzing ? "Scanning…" : "Find Trades"}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => handleExampleChip(chip)}
                  className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3.5 py-1.5 text-left text-xs font-medium text-emerald-100/90 transition hover:border-emerald-400/40 hover:bg-emerald-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50 sm:text-sm"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="relative mb-8">
          {isAnalyzing && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-500/20 bg-zinc-950/85 px-6 py-16 backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
              <p className="text-sm font-medium text-emerald-200/95">
                Analyzing market conditions...
              </p>
            </div>
          )}

          <section
            className={`mb-8 grid gap-4 sm:grid-cols-3 ${isAnalyzing ? "pointer-events-none opacity-40" : ""}`}
          >
            {stats.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/5 backdrop-blur-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {card.label}
                </p>
                <p
                  className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white ${
                    card.valueClass ?? ""
                  }`}
                >
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
              </div>
            ))}
          </section>

          <section
            className={`overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/5 backdrop-blur-sm ${isAnalyzing ? "pointer-events-none opacity-40" : ""}`}
          >
            <div className="border-b border-zinc-800/80 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">AI Picks</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Mock signals and liquidity for layout preview
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {screenerFilters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={isAnalyzing}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50 ${
                      screenerFilter === f.id
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                        : "border-zinc-700/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                    }`}
                    onClick={() => setScreenerFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-3.5">Ticker</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5 text-right">Strike</th>
                    <th className="px-5 py-3.5">Expiration</th>
                    <th className="px-5 py-3.5 text-right">IV Rank</th>
                    <th className="px-5 py-3.5 text-right">Volume</th>
                    <th className="px-5 py-3.5 text-right">Signal Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredScreenerRows.map((row, i) => (
                    <tr
                      key={`${row.ticker}-${row.strike}-${row.type}-${i}-${refinedResultsActive ? "r" : "d"}`}
                      className="text-zinc-300 transition hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4 font-medium text-white">
                        {row.ticker}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={
                            row.type === "Call"
                              ? "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
                              : "rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300"
                          }
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-zinc-200">
                        ${row.strike}
                      </td>
                      <td className="px-5 py-4 tabular-nums text-zinc-400">
                        {row.expiration}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {row.ivRank}%
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {row.volume.toLocaleString("en-US")}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-medium text-emerald-400">
                        {row.signalScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </AppChrome>
  );
}
