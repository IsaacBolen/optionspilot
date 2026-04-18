"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function RobotIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block size-6 shrink-0 ${className ?? ""}`}
      aria-hidden
    >
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
      <path d="M9 17h6" />
      <path d="M12 4v2" />
    </svg>
  );
}

function UserAvatarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block size-5 shrink-0 ${className ?? ""}`}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

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

const MOCK_POSITIONS = [
  {
    ticker: "AAPL",
    type: "Call" as const,
    strike: 185,
    expiration: "May 16, 2025",
    entryPremium: "$2.40",
    currentPremium: "$3.15",
    pnlPct: "+31.3%",
  },
  {
    ticker: "NVDA",
    type: "Put" as const,
    strike: 118,
    expiration: "Apr 25, 2025",
    entryPremium: "$4.10",
    currentPremium: "$3.55",
    pnlPct: "-13.4%",
  },
  {
    ticker: "SPY",
    type: "Call" as const,
    strike: 520,
    expiration: "Jun 20, 2025",
    entryPremium: "$6.80",
    currentPremium: "$7.95",
    pnlPct: "+16.9%",
  },
];

export function DashboardClient({
  initialTab = "overview",
}: {
  initialTab?: "overview" | "screener";
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "screener">(
    initialTab,
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [screenerFilter, setScreenerFilter] =
    useState<ScreenerFilter>("all");

  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
    const dateLabel = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return { greeting, dateLabel };
  }, []);

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[420px] w-[600px] rounded-full bg-emerald-500/12 blur-[100px]" />
        <div className="absolute -right-1/4 bottom-0 h-[380px] w-[520px] rounded-full bg-cyan-500/8 blur-[95px]" />
        <div
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 flex-1 items-center gap-6 lg:gap-10">
            <Link
              href="/"
              className="shrink-0 text-lg font-semibold tracking-tight text-white transition hover:text-emerald-200"
            >
              OptionsPilot
            </Link>
            <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 sm:gap-x-1">
              <Link
                href="/dashboard"
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  activeTab === "overview"
                    ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/25"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-emerald-200/90"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard?tab=screener"
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  activeTab === "screener"
                    ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/25"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-emerald-200/90"
                }`}
              >
                Screener
              </Link>
              <span
                className="cursor-not-allowed select-none rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600"
                title="Coming soon"
              >
                Positions
              </span>
              <span
                className="cursor-not-allowed select-none rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600"
                title="Coming soon"
              >
                AI Chat
              </span>
            </div>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200"
            aria-label="Open profile menu"
          >
            <UserAvatarIcon />
          </button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {greeting}, Isaac
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{dateLabel}</p>
        </div>

        <div
          className="mb-8 flex gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-1 ring-1 ring-inset ring-white/5"
          role="tablist"
          aria-label="Dashboard sections"
        >
          {(
            [
              { id: "overview" as const, label: "Overview" },
              { id: "screener" as const, label: "Screener" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`min-h-10 flex-1 rounded-lg px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                activeTab === tab.id
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                router.replace(
                  tab.id === "screener"
                    ? "/dashboard?tab=screener"
                    : "/dashboard",
                  { scroll: false },
                );
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <>
        <section className="mb-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 shadow-xl shadow-black/30 ring-1 ring-inset ring-white/5 backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
              <RobotIcon />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-white">
                Today&apos;s Briefing
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Markets are digesting overnight flows. Your open AAPL call is
                approaching the first profit target—watch for a pullback to the
                21 EMA. Consider trailing stops on NVDA if implied volatility
                expands. This is placeholder AI-generated commentary for your
                daily overview; connect your data source to personalize this
                briefing.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {(
            [
              {
                label: "Open Positions",
                value: "3",
                hint: "Active contracts",
              },
              {
                label: "Today's P&L",
                value: "+$124",
                hint: "Session mark-to-market",
                valueClass: "text-emerald-400",
              },
              {
                label: "Win Rate",
                value: "67%",
                hint: "Last 30 closed trades",
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
            <h2 className="text-sm font-semibold text-white">Positions</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Mock data for layout preview
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3.5">Ticker</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Strike</th>
                  <th className="px-5 py-3.5">Expiration</th>
                  <th className="px-5 py-3.5 text-right">Entry Premium</th>
                  <th className="px-5 py-3.5 text-right">Current Premium</th>
                  <th className="px-5 py-3.5 text-right">P&amp;L %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_POSITIONS.map((row) => (
                  <tr
                    key={`${row.ticker}-${row.strike}-${row.type}`}
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
                      {row.entryPremium}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {row.currentPremium}
                    </td>
                    <td
                      className={`px-5 py-4 text-right tabular-nums font-medium ${
                        row.pnlPct.startsWith("-")
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {row.pnlPct}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
          </>
        ) : (
          <>
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
                      <th className="px-5 py-3.5 text-right">
                        Signal Score
                      </th>
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
          </>
        )}
      </main>
    </div>
  );
}
