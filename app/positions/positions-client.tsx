"use client";

import { useEffect, useMemo, useState } from "react";

import { AppChrome } from "../components/app-chrome";

type PositionStatus = "Open" | "Closed";
type PositionFilter = "all" | "open" | "closed";

type PositionRow = {
  id: string;
  ticker: string;
  type: "Call" | "Put";
  strike: number;
  expiration: string;
  quantity: number;
  entry_price: number;
  current_price: number | null;
  exit_price?: number | null;
  status: PositionStatus;
  platform: string | null;
  signal_score: number | null;
  ai_thesis: string | null;
  created_at: string;
};

type CloseModalState = {
  position: PositionRow;
} | null;

function ClosePositionModal({
  state,
  onClose,
  onConfirm,
}: {
  state: CloseModalState;
  onClose: () => void;
  onConfirm: (exitPrice: number, qtySold: number, closedAt: string) => Promise<void>;
}) {
  const [exitPrice, setExitPrice] = useState(0);
  const [qtySold, setQtySold] = useState(state?.position.quantity ?? 1);
  const [closedAt, setClosedAt] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state) {
      setExitPrice(0);
      setQtySold(state.position.quantity);
      setClosedAt(new Date().toISOString().split("T")[0]);
      setSaving(false);
      setSaved(false);
    }
  }, [state]);

  if (!state) return null;
  const { position } = state;
  const pnl = (exitPrice - position.entry_price) * qtySold * 100;
  const pnlPct = position.entry_price > 0
    ? ((exitPrice - position.entry_price) / position.entry_price) * 100
    : 0;

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(exitPrice, qtySold, closedAt);
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
          <h3 className="text-base font-semibold text-white">Close Position</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>

        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white">{position.ticker}</span>
            <span className={position.type === "Call"
              ? "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
              : "rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300"
            }>{position.type}</span>
            <span className="text-sm text-zinc-400">${position.strike} · {position.expiration}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Entry: ${position.entry_price}/share</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Exit Price (per share)</label>
            <input
              type="number"
              step={0.01}
              min={0}
              value={exitPrice}
              onChange={(e) => setExitPrice(parseFloat(e.target.value) || 0)}
              className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Contracts Sold</label>
            <input
              type="number"
              min={1}
              value={qtySold}
              onChange={(e) => setQtySold(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Date Sold</label>
            <input
              type="date"
              value={closedAt}
              onChange={(e) => setClosedAt(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>

          {exitPrice > 0 && (
            <div className={`rounded-xl border p-3 ${pnl >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <p className="text-xs text-zinc-500 mb-1">Estimated P&L</p>
              <p className={`text-lg font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(0)}
                <span className="ml-2 text-sm font-medium">({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || saved || exitPrice <= 0}
          className="mt-6 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {saved ? "✓ Position Closed!" : saving ? "Saving..." : "Confirm Close"}
        </button>
      </div>
    </div>
  );
}

function normalizePositionFromApi(raw: unknown): PositionRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : "";
  if (!id) return null;
  const ticker = String(r.ticker ?? "").trim().toUpperCase();
  if (!ticker) return null;
  const typeRaw = String(r.type ?? "").trim();
  const type: "Call" | "Put" = typeRaw === "Put" ? "Put" : "Call";
  const strike = Number(r.strike);
  if (!Number.isFinite(strike)) return null;
  const expiration = String(r.expiration ?? "").trim();
  if (!expiration) return null;
  const qtyRaw = r.quantity ?? r.qty;
  const quantity = Math.round(Number(qtyRaw));
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  const entry_price = Number(r.entry_price);
  if (!Number.isFinite(entry_price)) return null;
  const cur = r.current_price;
  const current_price =
    cur === null || cur === undefined
      ? null
      : Number.isFinite(Number(cur))
        ? Number(cur)
        : null;
  const status: PositionStatus = r.status === "Closed" ? "Closed" : "Open";
  const platform =
    r.platform === null || r.platform === undefined
      ? null
      : String(r.platform);
  const signal_score =
    r.signal_score === null || r.signal_score === undefined
      ? null
      : Number.isFinite(Number(r.signal_score))
        ? Number(r.signal_score)
        : null;
  const ai_thesis =
    r.ai_thesis === null || r.ai_thesis === undefined
      ? null
      : String(r.ai_thesis);
  const created_at =
    r.created_at != null ? String(r.created_at) : "";
  const ex = r.exit_price;
  const exit_price =
    ex === null || ex === undefined
      ? undefined
      : Number.isFinite(Number(ex))
        ? Number(ex)
        : null;

  return {
    id,
    ticker,
    type,
    strike,
    expiration,
    quantity,
    entry_price,
    current_price,
    exit_price,
    status,
    platform,
    signal_score,
    ai_thesis,
    created_at,
  };
}

type PositionReport = {
  ticker: string;
  type: string;
  strike: number;
  recommendation: "Hold" | "Consider Selling" | "Sell Now" | "Already Expired";
  urgency: "Low" | "Medium" | "High";
  summary: string;
  exitTarget: {
    previousTarget: string;
    currentTarget: string;
    changed: boolean;
    reason: string;
  };
  currentPrice: number | null;
  checkInDates: {
    date: string;
    reason: string;
  }[];
  redFlags: string;
};

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
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<PositionReport[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [closeModal, setCloseModal] = useState<CloseModalState>(null);

  useEffect(() => {
    fetch("/api/positions")
      .then((r) => r.json())
      .then((data: { positions?: unknown[] }) => {
        const list = (data.positions ?? [])
          .map(normalizePositionFromApi)
          .filter((p): p is PositionRow => p !== null);
        setPositions(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    return positions.filter((row) => {
      if (filter === "open") return row.status === "Open";
      if (filter === "closed") return row.status === "Closed";
      return true;
    });
  }, [positions, filter]);

  const openPositions = positions.filter(p => p.status === 'Open').length;
  const totalPnl = positions.reduce((sum, row) => {
    const pnlDollar =
      row.current_price != null
        ? (row.current_price - row.entry_price) * row.quantity * 100
        : 0;
    return sum + pnlDollar;
  }, 0);
  const closedPositions = positions.filter((p) => p.status === "Closed");
  const wins = closedPositions.filter((row) => {
    const pnlDollar =
      row.current_price != null
        ? (row.current_price - row.entry_price) * row.quantity * 100
        : 0;
    return pnlDollar > 0;
  }).length;
  const winRate = closedPositions.length > 0
    ? Math.round((wins / closedPositions.length) * 100)
    : 0;

  const filters: { id: PositionFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "closed", label: "Closed" },
  ];

  const handleSituationReport = async () => {
    const openPositions = positions.filter((p) => p.status === "Open");
    if (openPositions.length === 0) return;
    setReportLoading(true);
    setReportError(null);
    setReportVisible(true);
    try {
      const res = await fetch("/api/positions/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: openPositions }),
      });
      const data = (await res.json()) as {
        report?: PositionReport[];
        error?: string;
      };
      if (!res.ok || !data.report) throw new Error(data.error ?? "Report failed");
      const enrichedReport = data.report.map((item: PositionReport) => {
        const match = openPositions.find(
          (p) => p.ticker === item.ticker && p.strike === item.strike
        );
        return { ...item, currentPrice: match?.current_price ?? null };
      });
      setReport(enrichedReport);

      // Write current prices back to Supabase and update local state
      const prices = (data as { prices?: { id: string; current_price: number | null }[] }).prices ?? [];
      await Promise.all(
        prices
          .filter((p) => p.current_price !== null)
          .map((p) =>
            fetch('/api/positions', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: p.id, current_price: p.current_price }),
            })
          )
      );

      setPositions((prev) =>
        prev.map((pos) => {
          const match = prices.find((p) => p.id === pos.id);
          if (match && match.current_price !== null) {
            return { ...pos, current_price: match.current_price };
          }
          return pos;
        })
      );
    } catch (e) {
      setReportError(
        e instanceof Error ? e.message : "Could not generate report",
      );
    } finally {
      setReportLoading(false);
    }
  };

  const handleClosePosition = async (
    exitPrice: number,
    qtySold: number,
    closedAt: string,
  ) => {
    if (!closeModal) return;
    await fetch("/api/positions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: closeModal.position.id,
        exit_price: exitPrice,
        quantity_sold: qtySold,
        closed_at: closedAt,
      }),
    });
    setPositions((prev) =>
      prev.map((p) =>
        p.id === closeModal.position.id
          ? {
              ...p,
              status: "Closed" as const,
              current_price: exitPrice,
              exit_price: exitPrice,
            }
          : p,
      ),
    );
  };

  const handleDeletePosition = async (id: string) => {
    await fetch("/api/positions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <AppChrome>
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Positions
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Track and manage your open and closed options trades
            </p>
          </div>
          <button
            onClick={handleSituationReport}
            disabled={
              reportLoading ||
              positions.filter((p) => p.status === "Open").length === 0
            }
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {reportLoading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
                Analyzing...
              </>
            ) : (
              <>↻ Daily Situation Report</>
            )}
          </button>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {(
            [
              {
                label: "Open Positions",
                value: String(openPositions),
                hint: "Contracts still active",
              },
              {
                label: "Total P&L",
                value: formatMoney(totalPnl),
                hint: "All-time realized + unrealized",
                valueClass: "text-emerald-400",
              },
              {
                label: "Win Rate",
                value: `${winRate}%`,
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

        {reportVisible && (
          <section className="mb-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden ring-1 ring-inset ring-white/5">
            <div className="border-b border-zinc-800/80 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">AI Situation Report</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Claude&apos;s analysis of each open position based on current conditions
                </p>
              </div>
              <button
                onClick={() => setReportVisible(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              {reportLoading && (
                <div className="flex items-center gap-3 text-sm text-emerald-300 py-4">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
                  Analyzing all open positions...
                </div>
              )}
              {reportError && (
                <p className="text-sm text-red-400 py-4">{reportError}</p>
              )}
              {!reportLoading && report.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {report.map((item, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-4 ${
                        item.recommendation === "Sell Now"
                          ? "border-red-500/30 bg-red-950/20"
                          : item.recommendation === "Consider Selling"
                            ? "border-amber-500/30 bg-amber-950/20"
                            : "border-zinc-700/60 bg-zinc-950/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{item.ticker}</span>
                          <span className="text-xs text-zinc-400">
                            {item.type} ${item.strike}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.recommendation === "Sell Now"
                              ? "bg-red-500/20 text-red-300"
                              : item.recommendation === "Consider Selling"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {item.recommendation}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                        {item.summary}
                      </p>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                            Exit Target
                          </p>
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-xs text-zinc-500">
                              Current: <span className="text-white font-semibold">
                                {item.currentPrice ? `$${item.currentPrice}/share` : "—"}
                              </span>
                            </p>
                            <span className="text-zinc-700">→</span>
                            <p className="text-xs text-zinc-500">
                              Target: <span className="font-semibold text-emerald-300">
                                {item.exitTarget.currentTarget}
                              </span>
                            </p>
                          </div>
                          {item.exitTarget.changed ? (
                            <div className="space-y-0.5">
                              <p className="text-xs text-zinc-500 line-through">{item.exitTarget.previousTarget}</p>
                              <p className="text-xs text-zinc-500 mt-1 italic">{item.exitTarget.reason}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-500 italic">{item.exitTarget.reason}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                            Check-in Dates
                          </p>
                          <div className="space-y-1.5">
                            {item.checkInDates.map((d, j) => (
                              <div key={j} className="flex gap-2">
                                <span className={`text-xs font-semibold shrink-0 ${d.reason.includes("MUST EXIT") ? "text-red-400" : "text-zinc-400"}`}>
                                  {d.date}
                                </span>
                                <span className="text-xs text-zinc-500 leading-relaxed">{d.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {item.redFlags !== "None" && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 mb-0.5">
                              ⚠ Red Flags
                            </p>
                            <p className="text-xs text-zinc-400">{item.redFlags}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

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
            {loading ? (
              <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-400 mr-3" />
                Loading positions...
              </div>
            ) : positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm font-medium text-zinc-400">No positions yet</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Use the Screener to find a trade and hit + to log it here
                </p>
              </div>
            ) : (
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
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((row, i) => {
                    const pnlDollar =
                      row.current_price != null
                        ? (row.current_price - row.entry_price) *
                          row.quantity *
                          100
                        : 0;
                    const pnlPct =
                      row.current_price != null && row.entry_price > 0
                        ? ((row.current_price - row.entry_price) /
                            row.entry_price) *
                          100
                        : 0;
                    return (
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
                          {row.quantity}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums">
                          {formatPrice(row.entry_price)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums">
                          {row.current_price != null
                            ? formatPrice(row.current_price)
                            : "—"}
                        </td>
                        <td
                          className={`px-5 py-4 text-right tabular-nums font-medium ${
                            pnlDollar < 0
                              ? "text-red-400"
                              : pnlDollar > 0
                                ? "text-emerald-400"
                                : "text-zinc-400"
                          }`}
                        >
                          {formatMoney(pnlDollar)}
                        </td>
                        <td
                          className={`px-5 py-4 text-right tabular-nums font-medium ${
                            pnlPct < 0
                              ? "text-red-400"
                              : pnlPct > 0
                                ? "text-emerald-400"
                                : "text-zinc-400"
                          }`}
                        >
                          {pnlPct > 0 ? "+" : ""}
                          {pnlPct.toFixed(1)}%
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
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {row.status === "Open" && (
                              <button
                                type="button"
                                onClick={() => setCloseModal({ position: row })}
                                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
                                title="Close this position"
                              >
                                Close
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDeletePosition(row.id)}
                              className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"
                              title="Delete this position"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
      <ClosePositionModal
        state={closeModal}
        onClose={() => setCloseModal(null)}
        onConfirm={handleClosePosition}
      />
    </AppChrome>
  );
}
