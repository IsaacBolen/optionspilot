"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppChrome } from "../components/app-chrome";

const DEFAULT_BRIEFING =
  "Markets are digesting overnight flows. Your open AAPL call is approaching the first profit target—watch for a pullback to the 21 EMA. Consider trailing stops on NVDA if implied volatility expands. This is placeholder AI-generated commentary for your daily overview; connect your data source to personalize this briefing.";

const CHIPS = [
  "News on my positions",
  "What's moving today?",
  "How are my positions?",
] as const;

const INPUT_PLACEHOLDER =
  'Try: "show me news on PLTR" or ask about markets and your book…';

const DASHBOARD_DEFAULT_MESSAGE =
  "Give a very brief morning-style read on markets and how it might relate to my AAPL, NVDA, and SPY options.";

const DEFAULT_NEWS_TICKERS = "AAPL,NVDA,SPY";

/** Skip false-positive “tickers” from prose */
const TICKER_BLOCKLIST = new Set([
  "THE",
  "AND",
  "FOR",
  "ARE",
  "BUT",
  "NOT",
  "YOU",
  "ALL",
  "CAN",
  "DAY",
  "IPO",
  "EPS",
  "CEO",
  "CFO",
  "USA",
  "FED",
  "GDP",
  "CPI",
]);

const COMPANY_ALIASES: Record<string, string> = {
  palantir: "PLTR",
  apple: "AAPL",
  nvidia: "NVDA",
  microsoft: "MSFT",
  google: "GOOGL",
  alphabet: "GOOGL",
  amazon: "AMZN",
  tesla: "TSLA",
  meta: "META",
  facebook: "META",
  netflix: "NFLX",
  amd: "AMD",
  intel: "INTC",
  "s&p 500": "SPY",
  "s&p500": "SPY",
  sp500: "SPY",
  "spy etf": "SPY",
};

type NewsArticle = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: string;
};

type SentimentLabel = "Bullish" | "Bearish" | "Neutral";

type SentimentState = {
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  summary: string;
};

function formatScopeLabel(tickersCsv: string): string {
  return tickersCsv
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .join(" · ");
}

function extractTickerFromPrompt(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
  for (const [phrase, sym] of Object.entries(COMPANY_ALIASES)) {
    if (lower.includes(phrase)) return sym;
  }

  const dollar = trimmed.match(/\$([A-Za-z]{1,5})\b/);
  if (dollar) return dollar[1].toUpperCase();

  const upperTokens = trimmed.match(/\b[A-Z]{2,5}\b/g);
  if (upperTokens) {
    for (const t of upperTokens) {
      if (!TICKER_BLOCKLIST.has(t)) return t;
    }
  }

  return null;
}

function sentimentStyles(label: SentimentLabel): {
  badge: string;
  ring: string;
} {
  if (label === "Bullish") {
    return {
      badge:
        "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/35",
      ring: "border-emerald-500/25",
    };
  }
  if (label === "Bearish") {
    return {
      badge: "bg-red-500/20 text-red-200 ring-1 ring-red-500/35",
      ring: "border-red-500/25",
    };
  }
  return {
    badge: "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/35",
    ring: "border-amber-500/25",
  };
}

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

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
      className={`block shrink-0 ${className ?? "size-6"}`}
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

export function DashboardClient() {
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [feedTickersCsv, setFeedTickersCsv] =
    useState(DEFAULT_NEWS_TICKERS);
  const [sentiment, setSentiment] = useState<SentimentState | null>(null);
  const [sentimentWarning, setSentimentWarning] = useState<string | null>(
    null,
  );
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [briefingText, setBriefingText] = useState(DEFAULT_BRIEFING);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  const loadNewsFeed = useCallback(async (tickersCsv: string) => {
    setNewsLoading(true);
    setNewsError(null);
    setSentiment(null);
    setSentimentWarning(null);
    setFeedTickersCsv(tickersCsv);

    try {
      const newsRes = await fetch(
        `/api/news?tickers=${encodeURIComponent(tickersCsv)}&limit=10`,
      );
      const newsData = (await newsRes.json()) as {
        articles?: NewsArticle[];
        error?: string;
      };
      if (!newsRes.ok) {
        throw new Error(newsData.error ?? "Failed to load news");
      }
      const articles = Array.isArray(newsData.articles)
        ? newsData.articles.slice(0, 10)
        : [];
      setNewsArticles(articles);

      const tickerArr = tickersCsv
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);

      if (articles.length === 0 || tickerArr.length === 0) {
        setSentiment(null);
        return;
      }

      const sentRes = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: tickerArr,
          headlines: articles.map((a) => ({
            headline: a.headline,
            summary: a.summary,
          })),
        }),
      });
      const sentData = (await sentRes.json()) as {
        sentimentScore?: number;
        sentimentLabel?: SentimentLabel;
        summary?: string;
        error?: string;
      };

      if (!sentRes.ok) {
        setSentimentWarning(
          sentData.error ?? "Could not analyze sentiment for these headlines.",
        );
        setSentiment(null);
        return;
      }

      let label: SentimentLabel = "Neutral";
      if (sentData.sentimentLabel === "Bullish") label = "Bullish";
      else if (sentData.sentimentLabel === "Bearish") label = "Bearish";

      setSentiment({
        sentimentScore: Math.min(
          100,
          Math.max(0, Number(sentData.sentimentScore ?? 50)),
        ),
        sentimentLabel: label,
        summary:
          typeof sentData.summary === "string"
            ? sentData.summary.trim()
            : "",
      });
    } catch (e) {
      setNewsArticles([]);
      setSentiment(null);
      setNewsError(
        e instanceof Error ? e.message : "Could not load the news feed.",
      );
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNewsFeed(DEFAULT_NEWS_TICKERS);
  }, [loadNewsFeed]);

  const fetchBriefing = useCallback(async (userMessage: string) => {
    setIsBriefingLoading(true);
    setBriefingError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context: "dashboard",
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to get briefing");
      }
      if (!data.reply?.trim()) {
        throw new Error("Empty response from assistant");
      }
      setBriefingText(data.reply.trim());
    } catch (e) {
      setBriefingError(
        e instanceof Error ? e.message : "Could not reach the assistant.",
      );
    } finally {
      setIsBriefingLoading(false);
    }
  }, []);

  const handleAsk = () => {
    const trimmed = query.trim();
    const resolvedTicker = extractTickerFromPrompt(trimmed);

    if (resolvedTicker) {
      void loadNewsFeed(resolvedTicker);
      void fetchBriefing(trimmed);
      return;
    }

    void fetchBriefing(trimmed || DASHBOARD_DEFAULT_MESSAGE);
  };

  const handleChip = (chip: (typeof CHIPS)[number]) => {
    setQuery(chip);
    if (chip === "News on my positions") {
      void loadNewsFeed(DEFAULT_NEWS_TICKERS);
    }
    void fetchBriefing(chip);
  };

  const scopeDisplay = useMemo(
    () => formatScopeLabel(feedTickersCsv),
    [feedTickersCsv],
  );

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

  const sentimentUi = sentiment
    ? sentimentStyles(sentiment.sentimentLabel)
    : null;

  return (
    <AppChrome>
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {greeting}, Isaac
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{dateLabel}</p>
        </div>

        <section className="mb-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/5 backdrop-blur-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400/95">
              <RobotIcon className="size-3.5" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              AI Briefing
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={INPUT_PLACEHOLDER}
              disabled={isBriefingLoading}
              className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
              aria-label="Ask the briefing assistant"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAsk();
              }}
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={isBriefingLoading}
              className="shrink-0 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:pointer-events-none disabled:opacity-50"
            >
              Ask
            </button>
          </div>

          <div className="mt-3 min-h-[4.5rem] rounded-r-lg border-l-2 border-emerald-500/45 bg-zinc-950/25 py-2 pl-3.5 pr-1">
            {isBriefingLoading ? (
              <div className="flex items-center gap-2.5 py-1 text-sm text-zinc-500">
                <span
                  className="inline-block size-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400"
                  aria-hidden
                />
                <span>Thinking…</span>
              </div>
            ) : briefingError ? (
              <p className="text-sm leading-relaxed text-red-400/90">
                {briefingError}
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-zinc-400">
                {briefingText}
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={isBriefingLoading}
                onClick={() => handleChip(chip)}
                className="rounded-md border border-zinc-700/70 bg-zinc-950/40 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.07] hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:pointer-events-none disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
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

        <section className="mb-8 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/5 backdrop-blur-sm">
          <div className="border-b border-zinc-800/80 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">News</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {scopeDisplay} · up to 10 headlines (Finnhub, last 30 days)
            </p>

            {!newsLoading && sentiment && sentimentUi && (
              <div
                className={`mt-4 rounded-xl border bg-zinc-950/50 p-4 ${sentimentUi.ring}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ${sentimentUi.badge}`}
                  >
                    {sentiment.sentimentScore}
                  </span>
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${sentimentUi.badge}`}
                  >
                    {sentiment.sentimentLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  {sentiment.summary}
                </p>
              </div>
            )}

            {!newsLoading && sentimentWarning && (
              <p className="mt-3 text-xs text-amber-400/90">{sentimentWarning}</p>
            )}
          </div>

          <ul className="divide-y divide-white/5">
            {newsLoading ? (
              <li className="px-5 py-10 text-center text-sm text-zinc-500">
                Loading headlines and sentiment…
              </li>
            ) : newsError ? (
              <li className="px-5 py-8 text-center text-sm text-red-400/90">
                {newsError}
              </li>
            ) : newsArticles.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-zinc-500">
                No articles in this window. Try another ticker or later.
              </li>
            ) : (
              newsArticles.map((item, i) => (
                <li
                  key={`${item.datetime}-${item.url}-${i}`}
                  className="px-5 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <span className="rounded-md bg-zinc-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      {item.source}
                    </span>
                    <span className="text-[11px] tabular-nums text-zinc-600">
                      {formatTimeAgo(item.datetime)}
                    </span>
                  </div>
                  <a
                    href={item.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-sm font-medium text-white transition hover:text-emerald-200/95"
                  >
                    {item.headline || "Untitled"}
                  </a>
                  {item.summary ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                      {item.summary}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
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
      </main>
    </AppChrome>
  );
}
