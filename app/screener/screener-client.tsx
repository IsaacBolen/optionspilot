"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { AppChrome } from "../components/app-chrome";
import { PromptLibraryModal } from "./prompt-library-modal";

type ScreenerFilter = "all" | "calls" | "puts" | "highIv" | "unusualVol";

type ScreenerRow = {
  ticker: string;
  type: "Call" | "Put";
  strike: number;
  expiration: string;
  ivRank: number;
  volume: number;
  signalScore: number;
  estPremium: number | null;
  premiumRange: string;
  change24h: number | null;
  change1w: number | null;
};

type TradePlan = {
  thesis: string;
  entryTiming: string;
  holdPlan: string;
  targetExit: string;
  stopLoss: string;
  whatKillsThisTrade: string;
  confidenceLevel: "Low" | "Medium" | "High";
  confidenceReason: string;
  warningFlags: string;
};

type LogModalState = {
  row: ScreenerRow;
  tradePlan: TradePlan | null;
} | null;

type StatCard = {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
};

const PLACEHOLDER =
  "e.g. I want a call option expiring in 2-4 weeks, premium under $1.00 per contract, that I can sell when it goes up 50%...";

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

const SCREENER_DEFAULT_MESSAGE =
  "Suggest a handful of liquid US equity options that could fit a balanced bullish-bias book over the next few weeks.";

function change1wClass(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "text-zinc-400";
  return n > 0 ? "text-emerald-400" : "text-red-400";
}

function formatChange1w(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function normalizePickFromApi(raw: unknown): ScreenerRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ticker = String(o.ticker ?? "").trim().toUpperCase();
  const typeRaw = String(o.type ?? "").trim();
  const type = typeRaw === "Put" ? "Put" : "Call";
  const strike = Number(o.strike);
  const expiration = String(o.expiration ?? "").trim();
  const ivRank = Math.round(Number(o.ivRank));
  const volume = Math.round(Number(o.volume));
  const signalScore = Math.round(Number(o.signalScore));
  const estRaw = Number(o.estPremium);
  const estPremium =
    Number.isFinite(estRaw) && estRaw >= 0
      ? Math.round(estRaw * 100) / 100
      : null;
  const pr = String(o.premiumRange ?? "").trim();
  const premiumRange = pr.length > 0 ? pr : "—";
  const c24 = Number(o.change24h);
  const c1w = Number(o.change1w);
  const change24h = Number.isFinite(c24) ? Math.round(c24 * 100) / 100 : null;
  const change1w = Number.isFinite(c1w) ? Math.round(c1w * 100) / 100 : null;
  if (!ticker || !expiration || !Number.isFinite(strike)) return null;
  if (!Number.isFinite(ivRank) || !Number.isFinite(volume)) return null;
  if (!Number.isFinite(signalScore)) return null;
  return {
    ticker,
    type,
    strike,
    expiration,
    ivRank: Math.min(100, Math.max(0, ivRank)),
    volume: Math.max(0, volume),
    signalScore: Math.min(100, Math.max(0, signalScore)),
    estPremium,
    premiumRange,
    change24h,
    change1w,
  };
}

function statsFromPicks(picks: ScreenerRow[]): StatCard[] {
  const n = picks.length;
  if (n === 0) return DEFAULT_STATS;
  const top = picks.reduce((a, b) =>
    b.signalScore > a.signalScore ? b : a,
  );
  const avgIv = Math.round(
    picks.reduce((s, p) => s + p.ivRank, 0) / n,
  );
  return [
    {
      label: "Opportunities Found",
      value: String(n),
      hint: "Matching your criteria",
    },
    {
      label: "Highest Signal",
      value: `${top.ticker} ${top.type}`,
      hint: "Top-ranked setup",
      valueClass: "text-emerald-400",
    },
    {
      label: "Avg IV Rank",
      value: `${avgIv}%`,
      hint: "Across screened names",
    },
  ];
}

function LogTradeModal({
  state,
  onClose,
  onConfirm
}: {
  state: LogModalState;
  onClose: () => void;
  onConfirm: (qty: number, entryPrice: number, platform: string) => Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const [entryPrice, setEntryPrice] = useState(state?.row.estPremium ?? 0);
  const [platform, setPlatform] = useState('Robinhood');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state) {
      setQty(1);
      setEntryPrice(state.row.estPremium ?? 0);
      setPlatform("Robinhood");
      setSaving(false);
      setSaved(false);
    }
  }, [state]);

  if (!state) return null;
  const { row } = state;
  const totalCost = qty * (entryPrice ?? 0) * 100;

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(qty, entryPrice, platform);
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700/80 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Log Trade</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>

        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white">{row.ticker}</span>
            <span className={row.type === 'Call'
              ? 'rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300'
              : 'rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300'
            }>{row.type}</span>
            <span className="text-sm text-zinc-400">${row.strike} · {row.expiration}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Signal Score: {row.signalScore}/100</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Number of Contracts</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Your Entry Price (per share)</label>
            <input
              type="number"
              step={0.01}
              min={0}
              value={entryPrice}
              onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
              className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
            <p className="mt-1 text-xs text-zinc-500">Total cost: ${totalCost.toFixed(0)}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            >
              <option>Robinhood</option>
              <option>Webull</option>
              <option>TD Ameritrade</option>
              <option>Tastytrade</option>
              <option>E*TRADE</option>
              <option>Schwab</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={saving || saved}
          className="mt-6 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {saved ? '✓ Logged to Positions!' : saving ? 'Saving...' : 'Confirm & Log Trade'}
        </button>
      </div>
    </div>
  );
}

export function ScreenerClient() {
  const [prompt, setPrompt] = useState("");
  const [screenerFilter, setScreenerFilter] =
    useState<ScreenerFilter>("all");
  const [picksRows, setPicksRows] = useState<ScreenerRow[]>([]);
  const [statCards, setStatCards] = useState<StatCard[]>([
    { label: "Opportunities Found", value: "—", hint: "Run a search to see results" },
    { label: "Highest Signal", value: "—", hint: "Run a search to see results" },
    { label: "Avg IV Rank", value: "—", hint: "Run a search to see results" },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [tradePlan, setTradePlan] = useState<TradePlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [logModal, setLogModal] = useState<LogModalState>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const filteredScreenerRows = useMemo(() => {
    const HIGH_IV_MIN = 75;
    const UNUSUAL_VOL_MIN = 8000;

    const filtered = picksRows.filter((row) => {
      if (screenerFilter === "calls") return row.type === "Call";
      if (screenerFilter === "puts") return row.type === "Put";
      if (screenerFilter === "highIv") return row.ivRank >= HIGH_IV_MIN;
      if (screenerFilter === "unusualVol")
        return row.volume >= UNUSUAL_VOL_MIN;
      return true;
    });
    return [...filtered].sort((a, b) => b.signalScore - a.signalScore);
  }, [picksRows, screenerFilter]);

  const screenerFilters: { id: ScreenerFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "calls", label: "Calls" },
    { id: "puts", label: "Puts" },
    { id: "highIv", label: "High IV" },
    { id: "unusualVol", label: "Unusual Volume" },
  ];

  const runSearch = useCallback(async (message: string) => {
    setIsAnalyzing(true);
    setScanError(null);
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as {
        summary?: string;
        picks?: ScreenerRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Scan failed");
      }
      const rawPicks = Array.isArray(data.picks) ? data.picks : [];
      const picks = rawPicks
        .map(normalizePickFromApi)
        .filter((p): p is ScreenerRow => p !== null);
      if (picks.length === 0) {
        throw new Error(
          data.error ?? "Assistant returned no picks. Try again.",
        );
      }
      const sorted = [...picks].sort((a, b) => b.signalScore - a.signalScore);
      setPicksRows(sorted);
      setStatCards(statsFromPicks(sorted));
    } catch (e) {
      setScanError(
        e instanceof Error ? e.message : "Could not complete the scan.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleRowClick = async (row: ScreenerRow) => {
    const key = `${row.ticker}-${row.strike}-${row.type}-${row.expiration}`;
    if (selectedRow === key) {
      setSelectedRow(null);
      setTradePlan(null);
      return;
    }
    setSelectedRow(key);
    setTradePlan(null);
    setPlanError(null);
    setPlanLoading(true);
    try {
      const res = await fetch("/api/trade-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract: row,
          userPrompt: lastPrompt,
          userBudget: null,
        }),
      });
      const data = await res.json() as { plan?: TradePlan; error?: string };
      if (!res.ok || !data.plan) throw new Error(data.error ?? "Failed to load plan");
      setTradePlan(data.plan);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Could not load trade plan");
    } finally {
      setPlanLoading(false);
    }
  };

  const handleFindTrades = () => {
    setLastPrompt(prompt.trim() || SCREENER_DEFAULT_MESSAGE);
    void runSearch(prompt.trim() || SCREENER_DEFAULT_MESSAGE);
  };

  const handleLogTrade = async (qty: number, entryPrice: number, platform: string) => {
    if (!logModal) return;
    const { row, tradePlan } = logModal;
    await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: row.ticker,
        type: row.type,
        strike: row.strike,
        expiration: row.expiration,
        quantity: qty,
        entry_price: entryPrice,
        platform,
        ai_thesis: tradePlan?.thesis ?? null,
        signal_score: row.signalScore,
      }),
    });
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
                  disabled={isAnalyzing}
                  className="relative z-10 min-h-[140px] w-full resize-y rounded-2xl border border-zinc-700/80 bg-zinc-950/90 px-4 py-3.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-60 sm:text-base"
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

            <div className="mt-5">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => setShowLibrary(true)}
                className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-1.5 text-xs font-medium text-emerald-100/90 transition hover:border-emerald-400/40 hover:bg-emerald-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50"
              >
                Browse prompt library →
              </button>
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

          {scanError && !isAnalyzing && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200/95">
              {scanError}
            </div>
          )}

          <section
            className={`mb-8 grid gap-4 sm:grid-cols-3 ${isAnalyzing ? "pointer-events-none opacity-40" : ""}`}
          >
            {statCards.map((card) => (
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
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                AI-generated picks based on your criteria — real-time data
                coming soon.
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
              {filteredScreenerRows.length === 0 && !isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-sm font-medium text-zinc-400">No results yet</p>
                  <p className="mt-1 text-xs text-zinc-600">Describe the trade you are looking for above and hit Find Trades</p>
                </div>
              ) : (
              <table className="w-full min-w-0 text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-3.5">Ticker</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5 text-right">Strike</th>
                    <th className="px-5 py-3.5">Expiration</th>
                    <th className="px-5 py-3.5 text-right">Volume</th>
                    <th className="px-5 py-3.5 text-right">Est. Premium</th>
                    <th className="px-5 py-3.5 text-right">1W Change</th>
                    <th className="px-5 py-3.5 text-right">Signal Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredScreenerRows.map((row, i) => (
                    <Fragment key={`${row.ticker}-${row.strike}-${row.type}-${i}`}>
                      <tr
                        onClick={() => void handleRowClick(row)}
                        className={`text-zinc-300 transition cursor-pointer ${
                          selectedRow === `${row.ticker}-${row.strike}-${row.type}-${row.expiration}`
                            ? "bg-emerald-500/10 border-l-2 border-l-emerald-400"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-5 py-4 font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span>{row.ticker}</span>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setLogModal({ row, tradePlan: selectedRow === `${row.ticker}-${row.strike}-${row.type}-${row.expiration}` ? tradePlan : null });
                              }}
                              className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 transition text-xs font-bold"
                              title="Log this trade to Positions"
                            >
                              +
                            </button>
                          </div>
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
                          {row.volume.toLocaleString("en-US")}
                        </td>
                        <td className="px-5 py-4 text-right align-top tabular-nums">
                          {row.estPremium != null &&
                          Number.isFinite(row.estPremium) ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-sm text-zinc-200">
                                ${row.estPremium.toFixed(2)}/share
                              </span>
                              <span className="text-[11px] leading-tight text-zinc-400">
                                ~
                                {Math.round(row.estPremium * 100).toLocaleString(
                                  "en-US",
                                  {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                  },
                                )}{" "}
                                per contract
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-500">—</span>
                          )}
                        </td>
                        <td
                          className={`px-5 py-4 text-right tabular-nums font-medium ${change1wClass(row.change1w)}`}
                        >
                          {formatChange1w(row.change1w)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums font-medium text-emerald-400">
                          {row.signalScore}
                        </td>
                      </tr>
                      {selectedRow === `${row.ticker}-${row.strike}-${row.type}-${row.expiration}` && (
                        <tr key={`plan-${row.ticker}-${row.strike}-${i}`}>
                          <td colSpan={8} className="px-5 py-5 bg-zinc-900/80 border-b border-zinc-800/80">
                            {planLoading && (
                              <div className="flex items-center gap-3 text-sm text-emerald-300">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
                                Building your trade plan...
                              </div>
                            )}
                            {planError && (
                              <p className="text-sm text-red-400">{planError}</p>
                            )}
                            {tradePlan && !planLoading && (
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="lg:col-span-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">Trade Thesis</p>
                                  <p className="text-sm text-zinc-200 leading-relaxed">{tradePlan.thesis}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Entry Timing</p>
                                  <p className="text-sm text-zinc-300 leading-relaxed">{tradePlan.entryTiming}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Hold Plan</p>
                                  <p className="text-sm text-zinc-300 leading-relaxed">{tradePlan.holdPlan}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Target Exit</p>
                                  <p className="text-sm text-emerald-300 leading-relaxed font-medium">{tradePlan.targetExit}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Stop Loss</p>
                                  <p className="text-sm text-red-300 leading-relaxed font-medium">{tradePlan.stopLoss}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">What Kills This Trade</p>
                                  <p className="text-sm text-zinc-300 leading-relaxed">{tradePlan.whatKillsThisTrade}</p>
                                </div>
                                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Confidence</p>
                                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                                    tradePlan.confidenceLevel === "High" ? "bg-emerald-500/20 text-emerald-300" :
                                    tradePlan.confidenceLevel === "Medium" ? "bg-amber-500/20 text-amber-300" :
                                    "bg-red-500/20 text-red-300"
                                  }`}>{tradePlan.confidenceLevel}</span>
                                  <p className="mt-2 text-xs text-zinc-400">{tradePlan.confidenceReason}</p>
                                </div>
                                {tradePlan.warningFlags && tradePlan.warningFlags !== "None" && (
                                  <div className="lg:col-span-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">⚠ Warning Flags</p>
                                    <p className="text-sm text-zinc-300 leading-relaxed">{tradePlan.warningFlags}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </section>
        </div>
      </main>
      <LogTradeModal
        state={logModal}
        onClose={() => setLogModal(null)}
        onConfirm={handleLogTrade}
      />
      {showLibrary && (
        <PromptLibraryModal
          onClose={() => setShowLibrary(false)}
          onSelect={(p: string) => setPrompt(p)}
        />
      )}
    </AppChrome>
  );
}
