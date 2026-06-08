import { z } from "zod";

// ============================================================
// TYPES
// ============================================================

export interface PolymarketSentiment {
  btcBullishProb: number;      // 0-1: xác suất crowd đặt cược BTC tăng
  recessionProb: number;       // 0-1: xác suất recession theo crowd
  btcMarketQuestion?: string;  // tiêu đề market tìm được (để audit)
  recessionMarketQuestion?: string;
  fetchedAt: string;
}

// ============================================================
// ZOD SCHEMAS (Gamma API response)
// ============================================================

// GET /markets?search=<keyword>&active=true
const GammaMarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  slug: z.string().optional(),
  active: z.boolean().optional(),
  closed: z.boolean().optional(),
  endDate: z.string().optional(),
  // outcomePrices: ["0.72","0.28"] — YES outcome is index 0
  outcomePrices: z.array(z.string()).min(2).optional(),
  outcomes: z.array(z.string()).optional(),
});

const GammaMarketsResponseSchema = z.object({
  markets: z.array(GammaMarketSchema),
});

type GammaMarket = z.infer<typeof GammaMarketSchema>;

// ============================================================
// CONFIG
// ============================================================

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const TIMEOUT_MS = 6000;
const MAX_RETRIES = 1;

// Keywords to search for each sentiment signal.
const BTC_KEYWORDS = ["bitcoin", "btc", "price"];
const RECESSION_KEYWORDS = ["recession", "us recession"];

// ============================================================
// FETCH HELPER
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string): Promise<unknown> {
  let lastErr: Error = new Error("Unknown");
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as unknown;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) await sleep(300);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

// ============================================================
// MARKET SEARCH
// ============================================================

async function searchMarkets(keyword: string): Promise<GammaMarket[]> {
  const url = `${GAMMA_BASE}/markets?search=${encodeURIComponent(keyword)}&active=true&limit=10`;
  const raw = await fetchWithRetry(url);

  // Gamma API returns either { markets: [...] } or directly an array.
  let markets: unknown[];
  if (Array.isArray(raw)) {
    markets = raw;
  } else {
    const parsed = GammaMarketsResponseSchema.safeParse(raw);
    markets = parsed.success ? parsed.data.markets : [];
  }

  // Validate each item individually; skip malformed ones.
  const valid: GammaMarket[] = [];
  for (const item of markets) {
    const r = GammaMarketSchema.safeParse(item);
    if (r.success) valid.push(r.data);
  }
  return valid;
}

// ============================================================
// PROBABILITY EXTRACTION
// ============================================================

/**
 * Extract the YES probability from outcomePrices.
 * Polymarket convention: outcomes[0] = "Yes", outcomePrices[0] = its price.
 * Normalizes to [0, 1] and guards against NaN / out-of-range.
 */
function extractYesProb(market: GammaMarket): number | null {
  const prices = market.outcomePrices;
  if (!prices || prices.length < 2) return null;

  const p0 = Number(prices[0]);
  const p1 = Number(prices[1]);
  if (!Number.isFinite(p0) || !Number.isFinite(p1)) return null;

  const total = p0 + p1;
  if (total <= 0) return null;

  // Normalize (handles floating-point drift like 0.71 + 0.30 = 1.01).
  const normalized = p0 / total;
  if (normalized < 0 || normalized > 1) return null;
  return Math.round(normalized * 1000) / 1000; // 3 decimal places
}

// ============================================================
// MARKET SELECTOR
// ============================================================

/**
 * Among candidate markets, pick the best one:
 * - Must have outcomePrices.
 * - Prefer markets with endDate furthest in the future (most relevant).
 * - Filter by keyword relevance in question text.
 */
function selectBestMarket(
  markets: GammaMarket[],
  keywords: string[]
): GammaMarket | null {
  const lower = keywords.map((k) => k.toLowerCase());

  const candidates = markets.filter((m) => {
    if (!m.outcomePrices || m.outcomePrices.length < 2) return false;
    if (m.closed === true) return false;
    const q = m.question.toLowerCase();
    return lower.some((k) => q.includes(k));
  });

  if (candidates.length === 0) return null;

  // Sort by endDate descending (furthest future first); no endDate goes last.
  candidates.sort((a, b) => {
    const da = a.endDate ? new Date(a.endDate).getTime() : 0;
    const db = b.endDate ? new Date(b.endDate).getTime() : 0;
    return db - da;
  });

  return candidates[0];
}

// ============================================================
// MAIN ENTRY
// ============================================================

/**
 * Fetch Polymarket crowd sentiment for BTC bullishness and US recession.
 * Returns null if both signals fail (network down, no matching market).
 * Never throws — safe to call from cron without try-catch.
 */
export async function fetchPolymarketSentiment(): Promise<PolymarketSentiment | null> {
  // Run both searches in parallel.
  const [btcResult, recessionResult] = await Promise.allSettled([
    searchMarkets("bitcoin price"),
    searchMarkets("us recession"),
  ]);

  const btcMarkets = btcResult.status === "fulfilled" ? btcResult.value : [];
  const recessionMarkets = recessionResult.status === "fulfilled" ? recessionResult.value : [];

  const btcMarket = selectBestMarket(btcMarkets, BTC_KEYWORDS);
  const recessionMarket = selectBestMarket(recessionMarkets, RECESSION_KEYWORDS);

  const btcProb = btcMarket ? extractYesProb(btcMarket) : null;
  const recessionProb = recessionMarket ? extractYesProb(recessionMarket) : null;

  // If both failed, return null so callers know data is unavailable.
  if (btcProb === null && recessionProb === null) return null;

  return {
    btcBullishProb: btcProb ?? 0.5,       // 0.5 = neutral fallback
    recessionProb: recessionProb ?? 0.5,
    btcMarketQuestion: btcMarket?.question,
    recessionMarketQuestion: recessionMarket?.question,
    fetchedAt: new Date().toISOString(),
  };
}
