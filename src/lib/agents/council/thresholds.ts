// src/lib/agents/council/thresholds.ts

export const MACRO_THRESHOLDS = {
  // Gate 1: Liquidity
  M2_YOY_GREEN: 5, // > 5%
  M2_YOY_RED: 0,   // < 0%

  // Gate 2: Recession
  SAHM_RULE_RED: 0.5,
  YIELD_CURVE_INVERTED: 0, // DGS10 - DGS2 < 0

  // Gate 3: FX / Capital
  DXY_GREEN: 100, // < 100
  DXY_RED: 108,   // > 108
  USD_VND_RED_PCT: 0.05, // Lệch 5% so với tỷ giá trung tâm

  // Gate 4: Valuation (VN)
  // [STATIC] Nâng cấp thành dynamic khi đủ lịch sử 5 năm để tính độ lệch chuẩn
  VN_PE_CHEAP: 12,
  VN_PE_EXPENSIVE: 18, 

  // Gate 6: Allocation Hard Limits (khi có >= 2 RED gates)
  SAFE_BOX_MIN: 40,
  RISK_BOX_MAX: 5,
  CRYPTO_MAX: 5,
};
