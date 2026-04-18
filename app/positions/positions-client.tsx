"use client";

import { useMemo, useState } from "react";

import { AppChrome } from "../components/app-chrome";

type PositionStatus = "Open" | "Closed";
type PositionFilter = "all" | "open" | "closed";

type PositionRow = {
  ticker: string;
  type: "Call" | "Put";
  strike: number;
  expiration: string;
  qty: number;
  entryPrice: number;
  currentPrice: number;
  pnlDollar: number;
  pnlPct: number;
  status: PositionStatus;
};

const MOCK_POSITIONS: PositionRow[] = [
  {
    ticker: "AAPL",
    type: "Call",
    strike: 195,
    expiration: "May 16, 2025",
    qty: 2,
    entryPrice: 2.4,
    currentPrice: 3.85,
    pnlDollar: 290,
    pnlPct: 60.4,
    status: "Open",
  },
  {
    ticker: "TSLA",
    type: "Put",
    strike: 240,
    expiration: "Jun 13, 2025",
    qty: 1,
    entryPrice: 6.1,
    currentPrice: 7.35,
    pnlDollar: 125,
    pnlPct: 20.5,
    status: "Open",
  },
  {
    ticker: "NVDA",
    type: "Call",
    strike: 130,
    expiration: "Jun 20, 2025",
    qty: 4,
    entryPrice: 3.1,
    currentPrice: 4.55,
    pnlDollar: 580,
    pnlPct: 46.8,
    status: "Open",
  },
  {
    ticker: "SPY",
    type: "Put",
    strike: 505,
    expiration: "May 9, 2025",
    qty: 3,
    entryPrice: 4.25,
    currentPrice: 3.05,
    pnlDollar: -360,
    pnlPct: -28.2,
    status: "Open",
  },
  {
    ticker: "AMD",
    type: "Call",
    strike: 118,
    expiration: "Jun 6, 2025",
    qty: 5,
    entryPrice: 1.85,
    currentPrice: 2.45,
    pnlDollar: 300,
    pnlPct: 32.4,
    status: "Open",
  },
  {
    ticker: "NVDA",
    type: "Put",
    strike: 112,
    expiration: "Apr 18, 2025",
    qty: 2,
    entryPrice: 2.9,
    currentPrice: 0,
    pnlDollar: 580,
    pnlPct: 100,
    status: "Closed",
  },
];

function formatMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPrice(n: number) {
  if (n === 0) return "—";
  return `$${n.toFixed(2)}`;
}

export function PositionsClient() {
  const [filter, setFilter] = useState<PositionFilter>("all");

  const rows = useMemo(() => {
    return MOCK_POSITIONS.filter((row) => {
      if (filter === "open") return row.status === "Open";
      if (filter === "closed") return row.status === "Closed";
      return true;
    });
  }, [filter]);

  const filters: { id: PositionFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "closed", label: "Closed" },
  ];

  return (
    <AppChrome>
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Positions
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track and manage your open and closed options trades
          </p>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {(
            [
              {
                label: "Open Positions",
                value: "5",
                hint: "Contracts still active",
              },
              {
                label: "Total P&L",
                value: "+$842",
                hint: "All-time realized + unrealized",
                valueClass: "text-emerald-400",
              },
              {
                label: "Win Rate",
                value: "71%",
                hint: "Closed trades only",
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
              Trade history
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Mock portfolio data for preview
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    filter === f.id
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                      : "border-zinc-700/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3.5">Ticker</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Strike</th>
                  <th className="px-5 py-3.5">Expiration</th>
                  <th className="px-5 py-3.5 text-right">Qty</th>
                  <th className="px-5 py-3.5 text-right">Entry Price</th>
                  <th className="px-5 py-3.5 text-right">Current Price</th>
                  <th className="px-5 py-3.5 text-right">P&amp;L $</th>
                  <th className="px-5 py-3.5 text-right">P&amp;L %</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row, i) => (
                  <tr
                    key={`${row.ticker}-${row.strike}-${row.type}-${row.status}-${i}`}
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
                      {row.qty}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatPrice(row.entryPrice)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatPrice(row.currentPrice)}
                    </td>
                    <td
                      className={`px-5 py-4 text-right tabular-nums font-medium ${
                        row.pnlDollar < 0
                          ? "text-red-400"
                          : row.pnlDollar > 0
                            ? "text-emerald-400"
                            : "text-zinc-400"
                      }`}
                    >
                      {formatMoney(row.pnlDollar)}
                    </td>
                    <td
                      className={`px-5 py-4 text-right tabular-nums font-medium ${
                        row.pnlPct < 0
                          ? "text-red-400"
                          : row.pnlPct > 0
                            ? "text-emerald-400"
                            : "text-zinc-400"
                      }`}
                    >
                      {row.pnlPct > 0 ? "+" : ""}
                      {row.pnlPct.toFixed(1)}%
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          row.status === "Open"
                            ? "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20"
                            : "rounded-md bg-zinc-700/50 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-white/10"
                        }
                      >
                        {row.status}
                      </span>
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
