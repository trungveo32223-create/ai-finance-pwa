// src/lib/agents/council/funnel.ts
import { GateResult, CouncilContext, TrafficLight } from "./types";

// L4: FUNNEL LÀ CODE, KHÔNG PHẢI PROMPT

export function liquidityGate(ctx: CouncilContext): GateResult {
  const m2 = ctx.marketData["US_M2SL"];
  if (!m2 || m2.stale) {
    return { status: "YELLOW", reason: "Thiếu dữ liệu M2SL hoặc dữ liệu cũ. Giữ nguyên trạng thái phòng thủ.", metrics: {} };
  }
  // Giả lập logic: Nếu M2SL tăng -> GREEN, giảm -> RED. Trong thực tế sẽ tính derivative.
  const isGrowing = m2.value > 0; // Giả sử value là tốc độ tăng trưởng
  return {
    status: isGrowing ? "GREEN" : "RED",
    reason: isGrowing ? "Thanh khoản toàn cầu đang mở rộng." : "Thanh khoản toàn cầu đang thu hẹp.",
    metrics: { m2_growth: m2.value }
  };
}

export function recessionGate(ctx: CouncilContext): GateResult {
  const sahm = ctx.marketData["US_SAHMREALTIME"];
  if (!sahm || sahm.stale) {
    return { status: "YELLOW", reason: "Thiếu dữ liệu Sahm Rule. Không xác nhận suy thoái.", metrics: {} };
  }
  const isRecession = sahm.value >= 0.5;
  return {
    status: isRecession ? "RED" : "GREEN",
    reason: isRecession ? "Sahm Rule kích hoạt (>=0.5), rủi ro suy thoái cao." : "Sahm Rule chưa kích hoạt, kinh tế ổn định.",
    metrics: { sahm_value: sahm.value }
  };
}

export function cycleGate(ctx: CouncilContext): GateResult {
  // Logic chu kỳ (tổng hợp từ nhiều yếu tố, có thể hardcode tạm trả về YELLOW nếu không đủ data)
  return { status: "YELLOW", reason: "Chu kỳ đang ở pha giao thời (Mid-late cycle).", metrics: {} };
}

export function fxCapitalGate(ctx: CouncilContext): GateResult {
  const dxy = ctx.marketData["US_DXY"];
  const usdVnd = ctx.marketData["VN_USDVND"];
  if (!dxy || !usdVnd || usdVnd.stale) {
    return { status: "YELLOW", reason: "Thiếu dữ liệu tỷ giá DXY hoặc USD/VND.", metrics: {} };
  }
  
  // Logic: USD/VND tăng mạnh (ví dụ > 25500) là rủi ro tỷ giá cho VN
  if (usdVnd.value >= 25500) {
    return { status: "RED", reason: "Áp lực tỷ giá USD/VND rất cao, rủi ro khối ngoại rút ròng.", metrics: { usd_vnd: usdVnd.value } };
  }
  return { status: "GREEN", reason: "Tỷ giá USD/VND ổn định.", metrics: { usd_vnd: usdVnd.value } };
}

export function policyVnGate(ctx: CouncilContext): GateResult {
  const policyScore = ctx.marketData["VN_POLICY_SCORE"]; // Điểm 0-5
  if (!policyScore || policyScore.stale) {
    return { status: "YELLOW", reason: "Thiếu dữ liệu chính sách VN.", metrics: {} };
  }
  
  if (policyScore.value >= 3) {
    return { status: "RED", reason: "Chính sách VN đang có dấu hiệu siết chặt mạnh (>=3/5).", metrics: { score: policyScore.value } };
  } else if (policyScore.value === 2) {
    return { status: "YELLOW", reason: "Chính sách VN có dấu hiệu siết nhẹ.", metrics: { score: policyScore.value } };
  }
  return { status: "GREEN", reason: "Chính sách VN nới lỏng hoặc trung tính.", metrics: { score: policyScore.value } };
}

export function microAllocationGate(ctx: CouncilContext): GateResult {
  const snap = ctx.userSnapshot;
  const limits_enforced: string[] = [];
  let status: TrafficLight = "GREEN";
  
  // L7: HARD ALLOCATION LIMITS
  let safePct = snap.safeBoxPct;
  let riskPct = snap.riskBoxPct;
  let cryptoPct = snap.cryptoPct;
  let guaranteePct = snap.guaranteePct;

  if (cryptoPct > 5) {
    status = "RED";
    limits_enforced.push(`CẢNH BÁO: Crypto (${cryptoPct}%) vượt trần an toàn 5%. Bắt buộc giảm tỷ trọng.`);
  }
  if (safePct < 20) {
    status = "RED";
    limits_enforced.push(`CẢNH BÁO: Hộp An Toàn (${safePct}%) dưới mức tối thiểu 20%. Bắt buộc tăng phòng thủ.`);
  }
  if (riskPct > 15) {
    status = "RED";
    limits_enforced.push(`CẢNH BÁO: Hộp Mạo Hiểm (${riskPct}%) vượt trần tối đa 15%. Bắt buộc chốt lời/cắt lỗ.`);
  }
  if (guaranteePct > 10) {
    status = "RED";
    limits_enforced.push(`CẢNH BÁO: Tỷ trọng bảo lãnh (${guaranteePct}%) vượt trần 10% True Net Worth. Nguy hiểm vốn.`);
  }

  if (limits_enforced.length === 0) {
    return { status: "GREEN", reason: "Phân bổ danh mục cá nhân tuân thủ tuyệt đối chuẩn rủi ro hệ thống.", metrics: snap };
  } else {
    return { status: "RED", reason: limits_enforced.join(" "), metrics: snap };
  }
}

export function runFullFunnel(ctx: CouncilContext) {
  return {
    liquidity: liquidityGate(ctx),
    recession: recessionGate(ctx),
    cycle: cycleGate(ctx),
    fx_capital: fxCapitalGate(ctx),
    policy_vn: policyVnGate(ctx),
    micro_allocation: microAllocationGate(ctx)
  };
}
