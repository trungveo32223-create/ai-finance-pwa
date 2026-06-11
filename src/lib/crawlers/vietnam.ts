import { z } from "zod";

export interface VietnamMarketData {
  indicator_key: string;
  indicator_value: number;
  recorded_at: string;
  stale: boolean;
  source: string;
}

const TcbsBarSchema = z.object({
  data: z.array(
    z.object({
      close: z.number(),
      volume: z.number().optional(),
    })
  ).min(1),
});

export const VN_KEYS = {
  VNI_PRICE: "VNI_PRICE",
  VNI_VOLUME: "VNI_VOLUME",
  HPG_PRICE: "HPG_PRICE",
  USD_VND: "USD_VND",
  SBV_OVERNIGHT: "SBV_OVERNIGHT",
  BDS_HYPE_INDEX: "BDS_HYPE_INDEX",
} as const;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, maxRetries = 2): Promise<unknown> {
  let lastError = new Error("Unknown error");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      await sleep(500);
    }
  }
  throw lastError;
}

export async function fetchTcbs(ticker: string, isIndex = false): Promise<{ price: number; volume?: number }> {
  const type = isIndex ? "index" : "stock";
  const url = `https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/bars-long-term?ticker=${ticker}&type=${type}&resolution=D&countBack=1`;
  const raw = await fetchWithRetry(url);
  const parsed = TcbsBarSchema.parse(raw);
  const latest = parsed.data[parsed.data.length - 1];
  return { price: latest.close, volume: latest.volume };
}

// Fallback mock nếu API bank khó cào (Sẽ thay bằng crawler xịn sau)
async function fetchUsdVnd(): Promise<number> {
  return 25450; // Ví dụ
}
async function fetchSbvOvernight(): Promise<number> {
  return 4.5; // Ví dụ 4.5%
}

export const VN30_TICKERS = [
  "ACB", "BCM", "BID", "BVH", "CTG", "FPT", "GAS", "GVR", "HDB", "HPG",
  "MBB", "MSN", "MWG", "PLX", "POW", "SAB", "SHB", "SSB", "SSI", "STB",
  "TCB", "TPB", "VCB", "VHM", "VIB", "VIC", "VJC", "VNM", "VPB", "VRE"
];

export async function crawlVietnamData(): Promise<VietnamMarketData[]> {
  const ts = new Date().toISOString();
  const results: VietnamMarketData[] = [];

  const add = (key: string, val: number, source: string) => {
    results.push({ indicator_key: key, indicator_value: val, recorded_at: ts, stale: false, source });
  };

  // 1. Cào Chỉ số VN-Index chung
  try {
    const vni = await fetchTcbs("VNINDEX", true);
    add(VN_KEYS.VNI_PRICE, vni.price, "tcbs");
    if (vni.volume) add(VN_KEYS.VNI_VOLUME, vni.volume, "tcbs");
  } catch (e) { console.error("TCBS VNI error", e); }

  // 2. Cào toàn bộ rổ VN30
  const fetchPromises = VN30_TICKERS.map(async (ticker) => {
    try {
      const data = await fetchTcbs(ticker, false);
      add(`VN30_${ticker}`, data.price, "tcbs");
    } catch (e) {
      console.error(`TCBS ${ticker} error`, e);
    }
  });
  await Promise.allSettled(fetchPromises);

  // 3. Cào Tỷ giá & Lãi suất (Mock tạm thời chờ API thật)
  try { add(VN_KEYS.USD_VND, await fetchUsdVnd(), "sbv_mock"); } catch (e) {}
  try { add(VN_KEYS.SBV_OVERNIGHT, await fetchSbvOvernight(), "sbv_mock"); } catch (e) {}

  return results;
}
