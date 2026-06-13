import { GateResult, CouncilContext, TrafficLight } from "./types";
import { MACRO_THRESHOLDS } from "./thresholds";

export function liquidityGate(ctx: CouncilContext): GateResult {
  const m2 = ctx.marketData["M2SL"];
  const netLiq = ctx.marketData["NET_LIQUIDITY"];
  
  if (!m2 || m2.stale) {
    return { status: "YELLOW", reason: "Thiếu dữ liệu M2", interpretation: "Không có đủ dữ liệu M2SL để kết luận, giữ nguyên trạng thái phòng thủ.", metrics: {} };
  }
  
  const m2Growth = m2.value; // Giả sử M2SL đã là phần trăm YoY
  let status: TrafficLight = "YELLOW";
  let interp = "";

  if (m2Growth > MACRO_THRESHOLDS.M2_YOY_GREEN) {
    status = "GREEN";
    interp = `Thanh khoản nới lỏng (M2 tăng ${m2Growth}%), hỗ trợ tốt cho tài sản rủi ro.`;
  } else if (m2Growth < MACRO_THRESHOLDS.M2_YOY_RED) {
    status = "RED";
    interp = `Thanh khoản co hẹp (M2 giảm ${m2Growth}%), rủi ro giảm giá tài sản.`;
  } else {
    interp = `Thanh khoản ở mức trung bình (M2 tăng ${m2Growth}%).`;
  }

  // Cộng điểm nếu Net Liquidity ổn định (giả định có data)
  if (netLiq && !netLiq.stale && status === "YELLOW") {
    interp += " Net Liquidity có sẵn làm bộ đệm.";
  }

  return { status, reason: "Đánh giá thanh khoản toàn cầu", interpretation: interp, metrics: { m2_yoy: m2Growth } };
}

export function recessionGate(ctx: CouncilContext): GateResult {
  const sahm = ctx.marketData["SAHMREALTIME"];
  const yieldCurve = ctx.marketData["T10Y2Y"];

  if (!sahm || sahm.stale) {
    return { status: "YELLOW", reason: "Thiếu dữ liệu Sahm", interpretation: "Thiếu dữ liệu Sahm Rule, không thể xác nhận trạng thái suy thoái một cách an toàn.", metrics: {} };
  }

  if (sahm.value >= MACRO_THRESHOLDS.SAHM_RULE_RED) {
    return { status: "RED", reason: "Sahm Rule", interpretation: "Suy thoái Mỹ đã bắt đầu (Sahm Rule > 0.5), rủi ro lây lan toàn cầu.", metrics: { sahm: sahm.value } };
  }

  if (yieldCurve && yieldCurve.value < MACRO_THRESHOLDS.YIELD_CURVE_INVERTED) {
    return { status: "YELLOW", reason: "Yield Curve Inverted", interpretation: "Đường cong lợi suất đảo ngược, cảnh báo rủi ro suy thoái trong 6-18 tháng tới.", metrics: { sahm: sahm.value, yield_curve: yieldCurve.value } };
  }

  return { status: "GREEN", reason: "Kinh tế ổn định", interpretation: "Chưa có dấu hiệu suy thoái rõ ràng (Sahm Rule và Yield Curve ổn).", metrics: { sahm: sahm.value } };
}

export function cycleGate(ctx: CouncilContext): GateResult {
  // Logic chu kỳ đơn giản hóa (Merrill Lynch Clock)
  const gdp = ctx.marketData["GDPC1"];
  const cpi = ctx.marketData["CPIAUCSL"];
  
  if (!gdp || !cpi || gdp.stale || cpi.stale) {
    return { status: "YELLOW", reason: "Thiếu data chu kỳ", interpretation: "Thiếu dữ liệu GDP hoặc CPI, không thể xác định pha chu kỳ chính xác.", metrics: {} };
  }

  let phase = "Giao thời";
  if (gdp.value > 0 && cpi.value < 2) phase = "Recovery (Phục hồi)";
  else if (gdp.value > 0 && cpi.value >= 2) phase = "Overheat (Nóng sốt)";
  else if (gdp.value <= 0 && cpi.value >= 2) phase = "Stagflation (Đình lạm)";
  else phase = "Reflation (Giảm phát)";

  return { 
    status: (phase === "Stagflation" || phase === "Overheat") ? "YELLOW" : "GREEN", 
    reason: "Merrill Lynch Clock", 
    interpretation: `Chu kỳ kinh tế Mỹ đang ở pha ${phase}, ảnh hưởng gián tiếp đến chu kỳ xuất khẩu VN.`, 
    metrics: { gdp: gdp.value, cpi: cpi.value } 
  };
}

export function fxCapitalGate(ctx: CouncilContext): GateResult {
  const tradeWeightedUsd = ctx.marketData["US_TRADE_WEIGHTED_USD"];
  const usdVnd = ctx.marketData["USD_VND_MARKET"];
  
  if (!tradeWeightedUsd || tradeWeightedUsd.stale) {
    return { status: "YELLOW", reason: "Thiếu DXY/Trade-Weighted", interpretation: "Thiếu dữ liệu sức mạnh đồng USD, khó đánh giá rủi ro dòng vốn rút.", metrics: {} };
  }
  
  let status: TrafficLight = "YELLOW";
  let interp = "";

  if (tradeWeightedUsd.value < MACRO_THRESHOLDS.DXY_GREEN) {
    status = "GREEN";
    interp = `USD yếu (Trade-Weighted USD = ${tradeWeightedUsd.value} < 100). Dòng vốn chảy vào EM, chứng khoán VN hưởng lợi.`;
  } else if (tradeWeightedUsd.value > MACRO_THRESHOLDS.DXY_RED) {
    status = "RED";
    interp = `USD mạnh (Trade-Weighted USD = ${tradeWeightedUsd.value} > 108). Áp lực rút vốn, VND yếu, NHNN phải can thiệp, áp lực lên BĐS và chứng khoán VN.`;
  } else {
    interp = `Sức mạnh USD đang ở mức trung bình (Trade-Weighted USD = ${tradeWeightedUsd.value}), dòng vốn ngoại chưa có xu hướng quá rõ.`;
  }

  // Cộng gộp rủi ro tỷ giá VN nếu có data
  if (usdVnd && !usdVnd.stale) {
    if (usdVnd.value > 25500) { // Giả định mức tỷ giá căng thẳng hiện tại
      status = "RED";
      interp += ` Tỷ giá thị trường tự do/VCB đang rất cao (${usdVnd.value} VND/USD), tăng áp lực lên tỷ giá trung tâm.`;
    } else {
      interp += ` Tỷ giá VN hiện tại khá ổn định ở mức ${usdVnd.value}.`;
    }
  } else {
    interp += ` (Thiếu dữ liệu tỷ giá USD/VND cục bộ để đánh giá thêm).`;
  }

  return { status, reason: "Sức mạnh USD và Tỷ giá", interpretation: interp, metrics: { trade_weighted_usd: tradeWeightedUsd.value, usd_vnd: usdVnd?.value } };
}

export function valuationFlowGate(ctx: CouncilContext): GateResult {
  const pe = ctx.marketData["VN_PE"];
  const foreignFlow = ctx.marketData["VN_FOREIGN_NET_FLOW"];
  const liquidity = ctx.marketData["VN_LIQUIDITY"];

  if (!pe || pe.stale) {
    return { status: "YELLOW", reason: "Thiếu P/E", interpretation: "Thiếu dữ liệu định giá P/E của VN-Index. Trạng thái không rõ ràng.", metrics: {} };
  }

  let status: TrafficLight = "YELLOW";
  let interp = "";

  if (pe.value < MACRO_THRESHOLDS.VN_PE_CHEAP) {
    status = "GREEN";
    interp = `VN-Index đang RẺ (P/E = ${pe.value} < 12).`;
  } else if (pe.value > MACRO_THRESHOLDS.VN_PE_EXPENSIVE) {
    status = "RED";
    interp = `VN-Index đang ĐẮT (P/E = ${pe.value} > 18).`;
  } else {
    interp = `VN-Index được định giá HỢP LÝ (P/E = ${pe.value}).`;
  }

  if (foreignFlow && !foreignFlow.stale) {
    if (foreignFlow.value > 0) interp += " Khối ngoại đang mua ròng, hỗ trợ tâm lý.";
    else interp += " Khối ngoại bán ròng tạo áp lực tâm lý.";
  }

  return { status, reason: "Định giá & Dòng tiền", interpretation: interp, metrics: { pe: pe.value, foreign_flow: foreignFlow?.value } };
}

export function policyVnGate(ctx: CouncilContext): GateResult {
  return { status: "GREEN", reason: "Chờ Sprint 2", interpretation: "Chính sách Vĩ mô VN đang ổn định (Chờ data từ Sprint 2 News Analyst).", metrics: {} };
}

export function microAllocationGate(ctx: CouncilContext, gateStatuses: TrafficLight[]): GateResult {
  const snap = ctx.userSnapshot;
  const limits_enforced: string[] = [];
  let status: TrafficLight = "GREEN";
  
  const redCount = gateStatuses.filter(s => s === "RED").length;

  if (redCount >= 2) {
    status = "RED";
    limits_enforced.push(`Có ${redCount} chỉ báo Vĩ mô báo ĐỎ. BẮT BUỘC KÍCH HOẠT PHÒNG THỦ:`);
    if (snap.safeBoxPct < MACRO_THRESHOLDS.SAFE_BOX_MIN) limits_enforced.push(`- Hộp An Toàn (${snap.safeBoxPct}%) PHẢI nâng lên >= ${MACRO_THRESHOLDS.SAFE_BOX_MIN}%.`);
    if (snap.riskBoxPct > MACRO_THRESHOLDS.RISK_BOX_MAX) limits_enforced.push(`- Hộp Mạo Hiểm (${snap.riskBoxPct}%) PHẢI hạ xuống <= ${MACRO_THRESHOLDS.RISK_BOX_MAX}%.`);
    if (snap.cryptoPct > MACRO_THRESHOLDS.CRYPTO_MAX) limits_enforced.push(`- Crypto (${snap.cryptoPct}%) PHẢI hạ xuống <= ${MACRO_THRESHOLDS.CRYPTO_MAX}%.`);
  } else {
    limits_enforced.push(`Môi trường vĩ mô ổn định (chỉ có ${redCount} Đỏ). Phân bổ cá nhân được giữ nguyên theo Profile.`);
  }

  return { status, reason: "Kiểm tra trần phân bổ", interpretation: limits_enforced.join(" "), metrics: { red_gates: redCount } };
}

export function runFullFunnel(ctx: CouncilContext) {
  const liquidity = liquidityGate(ctx);
  const recession = recessionGate(ctx);
  const cycle = cycleGate(ctx);
  const fx_capital = fxCapitalGate(ctx);
  const valuation_flow = valuationFlowGate(ctx);
  const policy_vn = policyVnGate(ctx);
  
  const statuses = [liquidity.status, recession.status, cycle.status, fx_capital.status, valuation_flow.status, policy_vn.status];
  const micro_allocation = microAllocationGate(ctx, statuses);

  return {
    liquidity,
    recession,
    cycle,
    fx_capital,
    valuation_flow,
    policy_vn,
    micro_allocation
  };
}
