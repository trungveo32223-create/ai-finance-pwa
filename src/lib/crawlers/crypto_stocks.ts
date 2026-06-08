import { z } from "zod";

export interface MarketData {
  id?: string;
  indicator_key: string;
  indicator_value: number;
  recorded_at?: string;
  stale?: boolean;
}

export interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{
            data: MarketData[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
}

export const CRYPTO_STOCK_KEYS = {
  BTC: "BTC_USD",
  ETH: "ETH_USD",
  FNG: "CRYPTO_FNG",
  SPY: "SPY",
  VIX: "VIX",
} as const;

const BinanceTickerSchema = z.object({ symbol: z.string(), price: z.string() });
const FngSchema = z.object({
  data: z.array(z.object({ value: z.string(), value_classification: z.string().optional() })).min(1),
});
const FinnhubQuoteSchema = z.object({ c: z.number() });

interface CrawlerConfig {
  finnhubApiKey: string;
  binanceBaseUrl?: string;
  fngUrl?: string;
  finnhubBaseUrl?: string;
  perAttemptTimeoutMs?: number;
  maxRetries?: number;
}

const DEFAULTS = {
  binanceBaseUrl: "https://api.binance.com",
  fngUrl: "https://api.alternative.me/fng/?limit=1",
  finnhubBaseUrl: "https://finnhub.io/api/v1",
  perAttemptTimeoutMs: 5000,
  maxRetries: 2,
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isNonRetryableStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

async function fetchWithRetry(
  url: string, timeoutMs: number, maxRetries: number, headers?: Record<string, string>
): Promise<unknown> {
  let lastError: Error = new Error("Unknown fetch error");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers, cache: "no-store" });
      if (!res.ok) {
        if (isNonRetryableStatus(res.status)) throw new Error(`Non-retryable HTTP ${res.status} for ${url}`);
        throw new Error(`Retryable HTTP ${res.status} for ${url}`);
      }
      return (await res.json()) as unknown;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.startsWith("Non-retryable")) break;
      if (attempt < maxRetries) await sleep(250 * Math.pow(2, attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function getStaleFallback(supabase: SupabaseLike, indicatorKey: string): Promise<MarketData | null> {
  try {
    const { data, error } = await supabase
      .from("market_data")
      .select("id,indicator_key,indicator_value,recorded_at,stale")
      .eq("indicator_key", indicatorKey)
      .order("recorded_at", { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const last = data[0];
    if (!Number.isFinite(last.indicator_value)) return null;
    return { indicator_key: indicatorKey, indicator_value: last.indicator_value, recorded_at: new Date().toISOString(), stale: true };
  } catch {
    return null;
  }
}

function freshPoint(indicatorKey: string, value: number): MarketData {
  return { indicator_key: indicatorKey, indicator_value: value, recorded_at: new Date().toISOString(), stale: false };
}

async function fetchBinanceSymbol(baseUrl: string, symbol: string, t: number, r: number): Promise<number> {
  const raw = await fetchWithRetry(`${baseUrl}/api/v3/ticker/price?symbol=${symbol}`, t, r);
  const parsed = BinanceTickerSchema.parse(raw);
  const price = Number(parsed.price);
  if (!Number.isFinite(price)) throw new Error(`Binance non-finite price for ${symbol}`);
  return price;
}
async function fetchFng(url: string, t: number, r: number): Promise<number> {
  const raw = await fetchWithRetry(url, t, r);
  const parsed = FngSchema.parse(raw);
  const value = Number(parsed.data[0].value);
  if (!Number.isFinite(value)) throw new Error("FNG non-finite value");
  return value;
}
async function fetchFinnhubQuote(baseUrl: string, symbol: string, apiKey: string, t: number, r: number): Promise<number> {
  const raw = await fetchWithRetry(`${baseUrl}/quote?symbol=${symbol}&token=${apiKey}`, t, r);
  const parsed = FinnhubQuoteSchema.parse(raw);
  if (!Number.isFinite(parsed.c) || parsed.c === 0) throw new Error(`Finnhub no valid price for ${symbol}`);
  return parsed.c;
}

async function resolveIndicator(
  supabase: SupabaseLike, indicatorKey: string, liveFetch: () => Promise<number>
): Promise<MarketData | null> {
  try {
    return freshPoint(indicatorKey, await liveFetch());
  } catch {
    return getStaleFallback(supabase, indicatorKey);
  }
}

export async function fetchMarketData(supabase: SupabaseLike, config: CrawlerConfig): Promise<MarketData[]> {
  const cfg = {
    binanceBaseUrl: config.binanceBaseUrl ?? DEFAULTS.binanceBaseUrl,
    fngUrl: config.fngUrl ?? DEFAULTS.fngUrl,
    finnhubBaseUrl: config.finnhubBaseUrl ?? DEFAULTS.finnhubBaseUrl,
    perAttemptTimeoutMs: config.perAttemptTimeoutMs ?? DEFAULTS.perAttemptTimeoutMs,
    maxRetries: config.maxRetries ?? DEFAULTS.maxRetries,
    finnhubApiKey: config.finnhubApiKey,
  };
  const t = cfg.perAttemptTimeoutMs, r = cfg.maxRetries;

  const cryptoTasks: Array<Promise<MarketData | null>> = [
    resolveIndicator(supabase, CRYPTO_STOCK_KEYS.BTC, () => fetchBinanceSymbol(cfg.binanceBaseUrl, "BTCUSDT", t, r)),
    resolveIndicator(supabase, CRYPTO_STOCK_KEYS.ETH, () => fetchBinanceSymbol(cfg.binanceBaseUrl, "ETHUSDT", t, r)),
    resolveIndicator(supabase, CRYPTO_STOCK_KEYS.FNG, () => fetchFng(cfg.fngUrl, t, r)),
  ];

  const stockGroup: Promise<Array<MarketData | null>> = (async () => {
    const spy = await resolveIndicator(supabase, CRYPTO_STOCK_KEYS.SPY, () => fetchFinnhubQuote(cfg.finnhubBaseUrl, "SPY", cfg.finnhubApiKey, t, r));
    const vix = await resolveIndicator(supabase, CRYPTO_STOCK_KEYS.VIX, () => fetchFinnhubQuote(cfg.finnhubBaseUrl, "^VIX", cfg.finnhubApiKey, t, r));
    return [spy, vix];
  })();

  const settled = await Promise.allSettled([Promise.allSettled(cryptoTasks), stockGroup]);
  const results: MarketData[] = [];
  if (settled[0].status === "fulfilled") {
    for (const item of settled[0].value) if (item.status === "fulfilled" && item.value) results.push(item.value);
  }
  if (settled[1].status === "fulfilled") {
    for (const item of settled[1].value) if (item) results.push(item);
  }
  return results;
}
