// src/lib/agents/council/types.ts

// ============================================================
// 1. PERSONAS
// ============================================================

export type PersonaId =
  | "banker"
  | "lawyer"
  | "wealth_manager"
  | "mogul"
  | "commissar"
  | "psychologist"
  | "architect"
  | "monitor";

export interface PersonaDefinition {
  id: PersonaId;
  name: string;
  systemPrompt: string;
  // Các trường dữ liệu bắt buộc phải có để Persona này có thể đưa ra nhận định (Luật L5)
  requiredData: string[];
}

export interface ExpertOpinion {
  id: PersonaId;
  name: string;
  opinion: string;
}

export interface ExpertFailure {
  id: PersonaId;
  name: string;
  error: string;
}

// ============================================================
// 2. FUNNEL GATES (Luật L4)
// ============================================================

export type TrafficLight = "GREEN" | "YELLOW" | "RED";

export interface GateResult {
  status: TrafficLight;
  reason: string;
  interpretation?: string; // Bổ sung theo chuẩn HF-06B
  metrics: Record<string, any>;
}

export interface FunnelReport {
  liquidity: GateResult;
  recession: GateResult;
  cycle: GateResult;
  fx_capital: GateResult;
  valuation_flow: GateResult; // Bổ sung
  policy_vn: GateResult;
  micro_allocation: GateResult;
}

// ============================================================
// 3. CONTEXT & DATA WRAPPERS
// ============================================================

export interface DataPoint<T> {
  value: T;
  timestamp: string;
  stale: boolean;
}

export interface CouncilContext {
  funnelReport: FunnelReport;
  
  // Anonymized User Snapshot (Luật L2)
  userSnapshot: {
    safeBoxPct: number;
    riskBoxPct: number;
    cryptoPct: number;
    guaranteePct: number; // so với True Net Worth
    debtToIncomePct?: number;
    hasConsumerDebt: boolean;
  };

  // Raw Data Points with Timestamps & Stale flags (Luật L9)
  marketData: Record<string, DataPoint<any>>;
}

// ============================================================
// 4. MONITOR OUTPUT (Luật L6)
// ============================================================

export interface ThreeAnswers {
  greed_or_fear: string; // Tham lam hay sợ hãi?
  loss_probability: string; // Xác suất mất 20%?
  government_actions: string; // Chính phủ đang làm gì?
}

// Bắt buộc Monitor output JSON theo schema này
export interface StructuredVerdict {
  verdict: string;
  traffic_light: TrafficLight;
  confidence: number; // % confidence (0-100)
  opinions?: { name: string; opinion: string }[];
  three_answers: ThreeAnswers;
  key_risk: string;
  dissenting_view: string;
  data_gaps: string[]; // Các mảng dữ liệu bị thiếu ảnh hưởng tới phán quyết
}

export interface DebateResult {
  structuredVerdict: StructuredVerdict;
  rawJson: string; // JSON string thô từ Groq (để debug)
  opinions: ExpertOpinion[];
  failures: ExpertFailure[];
  degraded: boolean;
}
