export interface MarketData {
  id?: string;
  indicator_key: string;
  indicator_value: number;
  recorded_at?: string;
  stale?: boolean;
}

export type TrafficLight = "GREEN" | "YELLOW" | "RED";
export type RecessionStatus = TrafficLight | "UNKNOWN";
export type CyclePhase = "RECOVERY" | "OVERHEAT" | "STAGFLATION" | "DEFLATION" | "UNKNOWN";
export type VnPolicyStatus = "PENDING";
export type DataQuality = "HIGH" | "PARTIAL" | "LOW";

export interface LiquidityStep {
  status: TrafficLight; reason: string;
  signals: { M2SL: number | null; NET_LIQUIDITY: number | null; NET_LIQUIDITY_PREV: number | null };
}
export interface RecessionStep {
  status: RecessionStatus; reason: string; triggers: string[];
  signals: { T10Y2Y: number | null; SAHMREALTIME: number | null; BAMLH0A0HYM2: number | null };
}
export interface PhaseStep {
  phase: CyclePhase; reason: string; confidence: DataQuality;
  signals: { GDPC1: number | null; GDPC1_PREV: number | null; CPIAUCSL: number | null; CPIAUCSL_PREV: number | null };
}
export interface ExchangeRateStep {
  status: TrafficLight; reason: string;
  signals: { DTWEXBGS: number | null; DTWEXBGS_PREV: number | null; DGS10: number | null; DGS2: number | null };
}
export interface VnPolicyStep { status: VnPolicyStatus; reason: string; }
export interface AssetAllocation { growth: number; safe: number; venture: number; bonds: number; }
export interface AllocationStep { allocation: AssetAllocation; reason: string; }

export interface CycleReport {
  generatedAt: string;
  dataQuality: DataQuality;
  step1_liquidity: LiquidityStep;
  step2_recession: RecessionStep;
  step3_mlClock: PhaseStep;
  step4_exchangeRate: ExchangeRateStep;
  step5_vnPolicy: VnPolicyStep;
  step6_allocation: AllocationStep;
}

const KEYS = {
  M2SL: "M2SL", NET_LIQUIDITY: "NET_LIQUIDITY", T10Y2Y: "T10Y2Y", SAHM: "SAHMREALTIME",
  CREDIT_SPREAD: "BAMLH0A0HYM2", CPI: "CPIAUCSL", GDP: "GDPC1", USD: "DTWEXBGS", DGS10: "DGS10", DGS2: "DGS2",
} as const;

function getValue(data: MarketData[], key: string): number | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  const record = data.find((d: MarketData): boolean => d.indicator_key === key);
  if (!record) return undefined;
  const v = record.indicator_value;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function toSignal(v: number | undefined): number | null { return typeof v === "number" ? v : null; }

type Trend = "UP" | "DOWN" | "FLAT" | "UNKNOWN";
function getTrend(current: number | undefined, previous: number | undefined, epsilon = 0): Trend {
  if (typeof current !== "number" || typeof previous !== "number") return "UNKNOWN";
  const diff = current - previous;
  if (Math.abs(diff) <= epsilon) return "FLAT";
  return diff > 0 ? "UP" : "DOWN";
}

function analyzeLiquidity(current: MarketData[], previous?: MarketData[]): LiquidityStep {
  const m2 = getValue(current, KEYS.M2SL);
  const netNow = getValue(current, KEYS.NET_LIQUIDITY);
  const netPrev = previous ? getValue(previous, KEYS.NET_LIQUIDITY) : undefined;
  const signals = { M2SL: toSignal(m2), NET_LIQUIDITY: toSignal(netNow), NET_LIQUIDITY_PREV: toSignal(netPrev) };
  const netTrend = getTrend(netNow, netPrev);
  if (netTrend === "UNKNOWN" && m2 === undefined) {
    return { status: "YELLOW", reason: "No M2 and no Net Liquidity trend (missing previousData). Neutral.", signals };
  }
  const m2Up = typeof m2 === "number" ? m2 > 0 : null;
  const netUp = netTrend === "UP" ? true : netTrend === "DOWN" ? false : null;
  if (m2Up === true && netUp === true) return { status: "GREEN", reason: "M2 YoY positive AND Net Liquidity rising.", signals };
  if (m2Up === false && netUp === false) return { status: "RED", reason: "M2 YoY negative AND Net Liquidity falling.", signals };
  return { status: "YELLOW", reason: "Mixed/partial liquidity signals.", signals };
}

function analyzeRecession(current: MarketData[]): RecessionStep {
  const yc = getValue(current, KEYS.T10Y2Y);
  const sahm = getValue(current, KEYS.SAHM);
  const cs = getValue(current, KEYS.CREDIT_SPREAD);
  const signals = { T10Y2Y: toSignal(yc), SAHMREALTIME: toSignal(sahm), BAMLH0A0HYM2: toSignal(cs) };
  const triggers: string[] = [];
  if (typeof yc === "number" && yc < 0) triggers.push("T10Y2Y < 0 (inverted)");
  if (typeof sahm === "number" && sahm >= 0.5) triggers.push("Sahm >= 0.5");
  if (typeof cs === "number" && cs >= 3.0) triggers.push("Credit spread >= 3.0");
  if (triggers.length > 0) return { status: "RED", reason: `Recession alarm: ${triggers.join("; ")}.`, triggers, signals };
  const missing: string[] = [];
  if (yc === undefined) missing.push("T10Y2Y");
  if (sahm === undefined) missing.push("SAHMREALTIME");
  if (cs === undefined) missing.push("BAMLH0A0HYM2");
  if (missing.length > 0) return { status: "UNKNOWN", reason: `Cannot confirm safe state; missing: ${missing.join(", ")}.`, triggers, signals };
  return { status: "GREEN", reason: "No recession indicator violated thresholds.", triggers, signals };
}

function analyzePhase(current: MarketData[], previous?: MarketData[]): PhaseStep {
  const gdpNow = getValue(current, KEYS.GDP);
  const gdpPrev = previous ? getValue(previous, KEYS.GDP) : undefined;
  const cpiNow = getValue(current, KEYS.CPI);
  const cpiPrev = previous ? getValue(previous, KEYS.CPI) : undefined;
  const signals = { GDPC1: toSignal(gdpNow), GDPC1_PREV: toSignal(gdpPrev), CPIAUCSL: toSignal(cpiNow), CPIAUCSL_PREV: toSignal(cpiPrev) };
  const gdpTrend = getTrend(gdpNow, gdpPrev);
  const cpiTrend = getTrend(cpiNow, cpiPrev);
  if (gdpTrend === "UNKNOWN" || cpiTrend === "UNKNOWN") {
    return { phase: "UNKNOWN", reason: "Cannot derive GDP/CPI trend (missing previousData).", confidence: "LOW", signals };
  }
  const growthPositive = gdpTrend === "UP" || gdpTrend === "FLAT";
  const inflationRising = cpiTrend === "UP";
  let phase: CyclePhase;
  if (growthPositive && !inflationRising) phase = "RECOVERY";
  else if (growthPositive && inflationRising) phase = "OVERHEAT";
  else if (!growthPositive && inflationRising) phase = "STAGFLATION";
  else phase = "DEFLATION";
  return { phase, reason: `GDP trend ${gdpTrend}, CPI trend ${cpiTrend} → ${phase}.`, confidence: "HIGH", signals };
}

const RATE_SPREAD_HIGH = 1.0;
function analyzeExchangeRate(current: MarketData[], previous?: MarketData[]): ExchangeRateStep {
  const usdNow = getValue(current, KEYS.USD);
  const usdPrev = previous ? getValue(previous, KEYS.USD) : undefined;
  const dgs10 = getValue(current, KEYS.DGS10);
  const dgs2 = getValue(current, KEYS.DGS2);
  const signals = { DTWEXBGS: toSignal(usdNow), DTWEXBGS_PREV: toSignal(usdPrev), DGS10: toSignal(dgs10), DGS2: toSignal(dgs2) };
  if (usdNow === undefined && (dgs10 === undefined || dgs2 === undefined)) {
    return { status: "YELLOW", reason: "Insufficient FX/rate data.", signals };
  }
  const usdUp = getTrend(usdNow, usdPrev) === "UP";
  const spread = typeof dgs10 === "number" && typeof dgs2 === "number" ? dgs10 - dgs2 : undefined;
  const spreadHigh = typeof spread === "number" && spread >= RATE_SPREAD_HIGH;
  if (usdUp && spreadHigh) return { status: "RED", reason: "USD strengthening AND wide spread → high EM pressure.", signals };
  if (usdUp || spreadHigh) return { status: "YELLOW", reason: "One pressure factor active → moderate EM pressure.", signals };
  return { status: "GREEN", reason: "USD stable and spread contained → low EM pressure.", signals };
}

function analyzeVnPolicy(): VnPolicyStep { return { status: "PENDING", reason: "VN policy data not yet integrated." }; }

function allocateAssets(phase: CyclePhase): AllocationStep {
  switch (phase) {
    case "RECOVERY": return { allocation: { growth: 55, safe: 35, venture: 10, bonds: 0 }, reason: "Recovery allocation." };
    case "OVERHEAT": return { allocation: { growth: 30, safe: 60, venture: 10, bonds: 0 }, reason: "Overheat allocation." };
    case "STAGFLATION": return { allocation: { growth: 20, safe: 80, venture: 0, bonds: 0 }, reason: "Stagflation: defensive cash/gold." };
    case "DEFLATION": return { allocation: { growth: 0, safe: 40, venture: 0, bonds: 60 }, reason: "Deflation: 40% cash + 60% bonds." };
    case "UNKNOWN":
    default: return { allocation: { growth: 25, safe: 65, venture: 10, bonds: 0 }, reason: "Unknown phase → conservative neutral fallback." };
  }
}

export function detectCycle(currentData: MarketData[], previousData?: MarketData[]): CycleReport {
  const current = Array.isArray(currentData) ? currentData : [];
  const previous = Array.isArray(previousData) ? previousData : undefined;
  const step3 = analyzePhase(current, previous);
  return {
    generatedAt: new Date().toISOString(),
    dataQuality: current.length === 0 ? "LOW" : step3.confidence,
    step1_liquidity: analyzeLiquidity(current, previous),
    step2_recession: analyzeRecession(current),
    step3_mlClock: step3,
    step4_exchangeRate: analyzeExchangeRate(current, previous),
    step5_vnPolicy: analyzeVnPolicy(),
    step6_allocation: allocateAssets(step3.phase),
  };
}

export interface CycleReportRow {
  date: string;
  liquidity_status: TrafficLight;
  recession_status: RecessionStatus;
  ml_clock_phase: CyclePhase;
  allocation_json: AssetAllocation;
  raw_data_snapshot: MarketData[];
}
export function toCycleReportRow(report: CycleReport, snapshot: MarketData[]): CycleReportRow {
  return {
    date: report.generatedAt.slice(0, 10),
    liquidity_status: report.step1_liquidity.status,
    recession_status: report.step2_recession.status,
    ml_clock_phase: report.step3_mlClock.phase,
    allocation_json: report.step6_allocation.allocation,
    raw_data_snapshot: snapshot,
  };
}
