"use client";

import { useMemo, useState } from "react";

import { AppChrome } from "../components/app-chrome";

type ScreenerFilter = "all" | "calls" | "puts" | "highIv" | "unusualVol";

const MOCK_SCREENER_ROWS = [
  {
    ticker: "TSLA",
    type: "Call" as const,
    strike: 250,
    expiration: "May 2, 2025",
    ivRank: 91,
    volume: 12400,
    signalScore: 94,
  },
  {
    ticker: "NVDA",
    type: "Put" as const,
    strike: 118,
    expiration: "Apr 25, 2025",
    ivRank: 84,
    volume: 9100,
    signalScore: 88,
  },
  {
    ticker: "AAPL",
    type: "Call" as const,
    strike: 195,
    expiration: "May 9, 2025",
    ivRank: 68,
    volume: 4200,
    signalScore: 78,
  },
  {
    ticker: "SPY",
    type: "Call" as const,
    strike: 528,
    expiration: "Jun 20, 2025",
    ivRank: 55,
    volume: 15200,
    signalScore: 72,
  },
  {
    ticker: "AMD",
    type: "Put" as const,
    strike: 112,
    expiration: "May 16, 2025",
    ivRank: 77,
    volume: 6100,
    signalScore: 81,
  },
  {
    ticker: "MSFT",
    type: "Call" as const,
    strike: 415,
    expiration: "Jun 6, 2025",
    ivRank: 49,
    volume: 3800,
    signalScore: 69,
  },
  {
    ticker: "AAPL",
    type: "Put" as const,
    strike: 180,
    expiration: "Apr 18, 2025",
    ivRank: 62,
    volume: 8900,
    signalScore: 75,
  },
] as const;

export function ScreenerClient() {
  const [screenerFilter, setScreenerFilter] =
    useState<ScreenerFilter>("all");

  const filteredScreenerRows = useMemo(() => {
    const HIGH_IV_MIN = 75;
    const UNUSUAL_VOL_MIN = 8000;

    return MOCK_SCREENER_ROWS.filter((row) => {
      if (screenerFilter === "calls") return row.type === "Call";
      if (screenerFilter === "puts") return row.type === "Put";
      if (screenerFilter === "highIv") return row.ivRank >= HIGH_IV_MIN;
      if (screenerFilter === "unusualVol")
        return row.volume >= UNUSUAL_VOL_MIN;
      return true;
    });
  }, [screenerFilter]);

  const screenerFilters: { id: ScreenerFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "calls", label: "Calls" },
    { id: "puts", label: "Puts" },
    { id: "highIv", label: "High IV" },
    { id: "unusualVol", label: "Unusual Volume" },
  ];

  return (
    <AppChrome>
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Options Screener
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Surface high-signal contracts from mock market data
          </p>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {(
            [
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
            ] as const
          ).map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/5 backdrop-blur-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {card.label}
              </p>
              <p
                className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white ${
                  "valueClass" in card ? card.valueClass : ""
                }`}
              >
                {card.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/5 backdrop-blur-sm">
          <div className="border-b border-zinc-800/80 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">
              Options Screener
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Mock signals and liquidity for layout preview
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {screenerFilters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
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
                    key={`${row.ticker}-${row.strike}-${row.type}-${i}`}
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
      </main>
    </AppChrome>
  );
}
