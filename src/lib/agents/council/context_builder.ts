// src/lib/agents/council/context_builder.ts
import { supabase } from "../../supabase";
import { CouncilContext, DataPoint, FunnelReport } from "./types";
import { runFullFunnel } from "./funnel";
import { COUNCIL_ROSTER } from "./personas";

// Giả lập user snapshot mặc định nếu không có dữ liệu thật (tránh lỗi)
const DEFAULT_USER_SNAPSHOT = {
  safeBoxPct: 25,
  riskBoxPct: 10,
  cryptoPct: 2,
  guaranteePct: 0,
  hasConsumerDebt: false
};

/**
 * Hàm lấy dữ liệu thô từ bảng market_data và bọc vào DataPoint (L9)
 */
async function fetchMarketData(): Promise<Record<string, DataPoint<any>>> {
  const { data, error } = await supabase
    .from('market_data')
    .select('indicator_key, indicator_value, recorded_at')
    .order('recorded_at', { ascending: false });

  if (error || !data) {
    console.error("Error fetching market data:", error);
    return {};
  }

  const result: Record<string, DataPoint<any>> = {};
  
  // Lọc lấy giá trị mới nhất cho mỗi indicator_key
  const seen = new Set<string>();
  for (const row of data) {
    if (!seen.has(row.indicator_key)) {
      seen.add(row.indicator_key);
      
      const isStale = (new Date().getTime() - new Date(row.recorded_at).getTime()) > 24 * 60 * 60 * 1000; // > 24h
      
      result[row.indicator_key] = {
        value: row.indicator_value,
        timestamp: row.recorded_at,
        stale: isStale
      };
    }
  }

  // ĐK1: Verify Data Gaps (Hợp đồng giữa Crawler và Builder)
  const allKeysInDb = Array.from(seen);
  console.log("=== [VERIFY DB] CÁC INDICATOR_KEY CÓ TRONG DB ===");
  console.log(allKeysInDb.join(", ") || "KHÔNG CÓ DATA NÀO!");

  const allRequired = Array.from(new Set(COUNCIL_ROSTER.flatMap(p => p.requiredData)));
  const missingKeys = allRequired.filter(key => !seen.has(key));
  if (missingKeys.length > 0) {
    console.warn("=== [CẢNH BÁO] THIẾU DATA TRONG DB SO VỚI YÊU CẦU CỦA HỘI ĐỒNG ===");
    console.warn("Thiếu các key sau:", missingKeys.join(", "));
  } else {
    console.log("=== [OK] TẤT CẢ REQUIRED DATA ĐỀU ĐÃ CÓ MẶT TẠI DB ===");
  }

  return result;
}

export async function buildContext(userSnapshot?: any): Promise<CouncilContext> {
  const marketData = await fetchMarketData();
  
  // Nếu có truyền vào userSnapshot thì dùng, nếu không dùng default
  const snap = userSnapshot || DEFAULT_USER_SNAPSHOT;

  // Khởi tạo context thô để chạy Funnel
  const preliminaryContext: CouncilContext = {
    funnelReport: {} as FunnelReport, // Sẽ được cập nhật ngay sau đây
    userSnapshot: snap,
    marketData: marketData
  };

  // L4: FUNNEL CHẠY TRƯỚC MỌI LLM CALL
  const report = runFullFunnel(preliminaryContext);
  preliminaryContext.funnelReport = report;

  return preliminaryContext;
}
