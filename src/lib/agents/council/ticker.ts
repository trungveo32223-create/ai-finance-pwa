// src/lib/agents/council/ticker.ts
import { fetchTcbs, VN30_TICKERS } from "../../crawlers/vietnam";
import { supabase } from "../../supabase";
import { DataPoint } from "./types";

// L9: GIÁ LIVE KHÔNG ĐƯỢC BỊA

/**
 * Trích xuất mã VN30 từ câu hỏi user (regex deterministic chạy trước LLM)
 */
export function extractVN30Ticker(query: string): string | null {
  const upperQuery = query.toUpperCase();
  // Tìm từ khoá là 1 trong 30 mã VN30, yêu cầu đứng độc lập hoặc có ranh giới từ hợp lý
  for (const ticker of VN30_TICKERS) {
    const regex = new RegExp(`\\b${ticker}\\b`);
    if (regex.test(upperQuery)) {
      return ticker;
    }
  }
  return null;
}

/**
 * Lấy giá fallback từ Supabase DB
 */
async function getFallbackPriceFromDB(ticker: string): Promise<DataPoint<number>> {
  const { data, error } = await supabase
    .from('market_data')
    .select('value, created_at')
    .eq('indicator_key', `VN30_${ticker}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`DB Fallback failed for VN30_${ticker}`);
  }

  return {
    value: data.value,
    timestamp: data.created_at,
    stale: true // Bất cứ giá nào từ DB fallback trong luồng Live Fetch đều đánh cờ stale
  };
}

/**
 * Hàm Dynamic Fetch giá live với timeout 4s
 */
export async function fetchLiveTicker(ticker: string): Promise<DataPoint<number>> {
  if (!VN30_TICKERS.includes(ticker)) {
    throw new Error("Ticker not in whitelist VN30");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // Timeout 4s

  try {
    // Tái sử dụng hàm fetchTcbs đã có sẵn từ vietnam.ts
    const liveData = await Promise.race([
      fetchTcbs(ticker, false),
      new Promise<never>((_, reject) => 
        controller.signal.addEventListener('abort', () => reject(new Error('Timeout')))
      )
    ]);
    clearTimeout(timeoutId);

    return {
      value: liveData.price,
      timestamp: new Date().toISOString(),
      stale: false
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`Live fetch failed/timeout for ${ticker}. Falling back to DB...`);
    
    // Fallback giá DB kèm stale flag (L9)
    try {
      return await getFallbackPriceFromDB(ticker);
    } catch (fallbackErr) {
      throw new Error(`Failed to fetch live and fallback data for ${ticker}`);
    }
  }
}
