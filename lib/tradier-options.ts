const TRADIER_SANDBOX = "https://sandbox.tradier.com/v1";

export type TradierChainOption = {
  symbol: string;
  underlying: string;
  strike: number;
  bid: number;
  ask: number;
  last: number | null;
  volume: number;
  open_interest: number;
  implied_volatility: number | null;
  delta: number | null;
  expiration_date: string;
  option_type: "call" | "put";
};

function tradierHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}

function asStringArray(dates: unknown): string[] {
  if (dates == null) return [];
  if (Array.isArray(dates)) return dates.map(String);
  if (typeof dates === "string" && dates.trim()) return [dates.trim()];
  return [];
}

/** GET /markets/options/expirations */
export async function fetchTradierExpirations(
  symbol: string,
  apiKey: string,
): Promise<string[]> {
  const url = `${TRADIER_SANDBOX}/markets/options/expirations?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: tradierHeaders(apiKey), next: { revalidate: 0 } });
  const json: unknown = await res.json();
  if (!res.ok) return [];
  if (typeof json !== "object" || json === null) return [];
  const exp = (json as { expirations?: { date?: unknown } }).expirations?.date;
  return asStringArray(exp);
}

function asOptionArray(raw: unknown): Record<string, unknown>[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw === "object") return [raw as Record<string, unknown>];
  return [];
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeChainOption(
  row: Record<string, unknown>,
  underlying: string,
): TradierChainOption | null {
  const symbol = String(row.symbol ?? "").trim();
  const strike = num(row.strike);
  if (!symbol || !Number.isFinite(strike)) return null;
  const bid = num(row.bid);
  const ask = num(row.ask);
  const lastRaw = row.last;
  const last =
    lastRaw == null || lastRaw === ""
      ? null
      : Number.isFinite(num(lastRaw))
        ? num(lastRaw)
        : null;
  const vol = Math.max(0, Math.round(num(row.volume)));
  const oi = Math.max(0, Math.round(num(row.open_interest)));
  const exp = String(row.expiration_date ?? "").trim();
  const ot = String(row.option_type ?? "").toLowerCase();
  const option_type = ot === "put" ? "put" : "call";
  const greeks =
    typeof row.greeks === "object" && row.greeks !== null
      ? (row.greeks as Record<string, unknown>)
      : {};
  const deltaRaw = num(greeks.delta);
  const delta = Number.isFinite(deltaRaw) ? deltaRaw : null;
  const ivRaw = num(greeks.mid_iv);
  const implied_volatility = Number.isFinite(ivRaw) ? ivRaw : null;
  return {
    symbol,
    underlying: String(row.root_symbol ?? row.underlying ?? underlying)
      .trim()
      .toUpperCase() || underlying.toUpperCase(),
    strike,
    bid: Number.isFinite(bid) ? bid : 0,
    ask: Number.isFinite(ask) ? ask : 0,
    last,
    volume: Number.isFinite(vol) ? vol : 0,
    open_interest: Number.isFinite(oi) ? oi : 0,
    implied_volatility,
    delta,
    expiration_date: exp,
    option_type,
  };
}

/** GET /markets/options/chains?greeks=true */
export async function fetchTradierOptionChain(
  symbol: string,
  expiration: string,
  apiKey: string,
): Promise<TradierChainOption[]> {
  const url = `${TRADIER_SANDBOX}/markets/options/chains?symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(expiration)}&greeks=true`;
  const res = await fetch(url, { headers: tradierHeaders(apiKey), next: { revalidate: 0 } });
  const json: unknown = await res.json();
  if (!res.ok) return [];
  if (typeof json !== "object" || json === null) return [];
  const opt = (json as { options?: { option?: unknown } }).options?.option;
  const rows = asOptionArray(opt);
  const out: TradierChainOption[] = [];
  for (const row of rows) {
    const n = normalizeChainOption(row, symbol);
    if (n) out.push(n);
  }
  return out;
}

/** GET /markets/options/quotes — fetch current bid/ask for specific option symbols */
export async function fetchTradierOptionQuotes(
  symbols: string[],
  apiKey: string,
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (symbols.length === 0) return prices;

  const symbolList = symbols.join(",");
  const url = `${TRADIER_SANDBOX}/markets/options/quotes?symbols=${encodeURIComponent(symbolList)}&greeks=false`;
  const res = await fetch(url, {
    headers: tradierHeaders(apiKey),
    next: { revalidate: 0 },
  });
  if (!res.ok) return prices;

  const json = await res.json() as {
    quotes?: {
      quote?: unknown;
    };
  };

  const raw = json.quotes?.quote;
  const rows: Record<string, unknown>[] = Array.isArray(raw)
    ? raw
    : raw != null
      ? [raw as Record<string, unknown>]
      : [];

  for (const row of rows) {
    const symbol = String(row.symbol ?? "").trim();
    const bid = Number(row.bid);
    const ask = Number(row.ask);
    if (!symbol) continue;
    if (Number.isFinite(bid) && Number.isFinite(ask) && (bid > 0 || ask > 0)) {
      const mid = Math.round(((bid + ask) / 2) * 100) / 100;
      prices.set(symbol, mid);
    }
  }

  return prices;
}

/** Build an OCC option symbol from position fields */
export function buildOccSymbol(
  ticker: string,
  expiration: string,
  type: "Call" | "Put",
  strike: number,
): string {
  // OCC format: ROOT + YYMMDD + C/P + 8-digit strike (price × 1000, zero-padded)
  const root = ticker.trim().toUpperCase().padEnd(6, " ").slice(0, 6).replace(/ /g, "");
  const date = expiration.replace(/-/g, "").slice(2); // YYMMDD from YYYY-MM-DD
  const cp = type === "Put" ? "P" : "C";
  const strikeStr = Math.round(strike * 1000)
    .toString()
    .padStart(8, "0");
  return `${root}${date}${cp}${strikeStr}`;
}
