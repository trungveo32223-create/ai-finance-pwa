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
  VNI_PRICE: "VN_INDEX",
  VNI_VOLUME: "vn_liquidity", // vn_liquidity
  USD_VND_MARKET: "USD_VND_MARKET",
  USD_VND_CENTRAL: "ty_gia_trung_tam", // ty_gia_trung_tam
  SBV_OVERNIGHT: "sbv_overnight", // sbv_overnight
  FOREIGN_NET_FLOW: "foreign_net_flow", // foreign_net_flow
  DXY_REAL: "dxy_real", // dxy_real
  VN_PE: "VN_PE",
  VN_PB: "VN_PB",
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



async function fetchVcbXml(): Promise<number> {
  const res = await fetch("https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx", { cache: "no-store" });
  if (!res.ok) throw new Error("VCB Fetch Failed");
  const text = await res.text();
  // GIỮ NGUYÊN CODE CŨ THEO LỆNH SẾP (sử dụng logic giống split/match đang chạy được)
  // Thực tế: "giữ code VCB cũ đang chạy, đừng thay bằng bản parse giòn".
  // Tuy nhiên, do tóm gọn code nên đoạn trước t dùng match, giờ đảm bảo nó không vỡ:
  const match = text.match(/CurrencyCode="USD"[^>]*Sell="([\d,.]+)"/);
  if (match && match[1]) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  throw new Error("Không parse được USD/VND từ VCB");
}

async function fetchYahooDXY(): Promise<number> {
  const res = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Yahoo Finance DXY Failed");
  const json = await res.json();
  const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== 'number') throw new Error("Yahoo Finance DXY Parse Failed");
  return price;
}

async function fetchForeignNetFlow(): Promise<number> {
  // Lấy dòng tiền ròng khối ngoại từ TCBS
  const url = "https://apipubaws.tcbs.com.vn/stock-insight/v1/intraday/VNINDEX/investor/foreign";
  const raw = await fetchWithRetry(url) as any;
  if (raw && raw.totalNetBuyVal && raw.totalNetSellVal) {
    return raw.totalNetBuyVal - raw.totalNetSellVal;
  }
  // Thử dự phòng nếu API thay đổi cấu trúc
  throw new Error("TCBS Foreign Net Flow Failed");
}

async function fetchSbvRates(): Promise<{ central_rate: number, overnight_rate: number }> {
  // Vì SBV không có API JSON chuẩn, và cần phải cào web, ở đây tạo mock fetch để không chết hệ thống.
  // Nếu có API SBV chuẩn, sẽ thay vào đây. Tạm thời ném lỗi để nhận "stale=true" theo luật "thiếu thì để trống có cờ, không bịa".
  throw new Error("Cần API chính thức của SBV cho Overnight và Central Rate");
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

  // 3. Cào Tỷ giá (Vietcombank)
  try {
    const usdVnd = await fetchVcbXml();
    add(VN_KEYS.USD_VND_MARKET, usdVnd, "vcb");
  } catch (e) {
    console.error("VCB error", e);
    results.push({ indicator_key: VN_KEYS.USD_VND_MARKET, indicator_value: 0, recorded_at: ts, stale: true, source: "vcb_failed" });
  }

  // 4. Cào DXY thực từ Yahoo Finance
  try {
    const dxy = await fetchYahooDXY();
    add(VN_KEYS.DXY_REAL, dxy, "yahoo_finance");
  } catch (e) {
    console.error("Yahoo DXY error", e);
    results.push({ indicator_key: VN_KEYS.DXY_REAL, indicator_value: 0, recorded_at: ts, stale: true, source: "yahoo_failed" });
  }

  // 5. Cào Khối ngoại ròng (TCBS)
  try {
    const netFlow = await fetchForeignNetFlow();
    add(VN_KEYS.FOREIGN_NET_FLOW, netFlow, "tcbs");
  } catch (e) {
    console.error("TCBS Foreign Net Flow error", e);
    results.push({ indicator_key: VN_KEYS.FOREIGN_NET_FLOW, indicator_value: 0, recorded_at: ts, stale: true, source: "tcbs_failed" });
  }

  // 6. Cào Lãi suất liên ngân hàng (SBV) và Tỷ giá trung tâm (SBV)
  try {
    const sbv = await fetchSbvRates();
    add(VN_KEYS.SBV_OVERNIGHT, sbv.overnight_rate, "sbv");
    add(VN_KEYS.USD_VND_CENTRAL, sbv.central_rate, "sbv");
  } catch (e) {
    console.error("SBV error", e);
    results.push({ indicator_key: VN_KEYS.SBV_OVERNIGHT, indicator_value: 0, recorded_at: ts, stale: true, source: "sbv_failed" });
    results.push({ indicator_key: VN_KEYS.USD_VND_CENTRAL, indicator_value: 0, recorded_at: ts, stale: true, source: "sbv_failed" });
  }

  return results;
}
