export type SlotKey = "cash_balance" | "risk_tolerance";
export type RiskTolerance = "conservative" | "balanced" | "aggressive";
export type MoneyPurpose = "idle" | "earmarked" | "unknown";

export interface UserProfile {
  cash_balance?: number | null;
  risk_tolerance?: RiskTolerance | null;
  money_purpose?: MoneyPurpose | null;
  askedCounts?: Partial<Record<SlotKey, number>>;
}

export type PanicLevel = "none" | "low" | "high";
export interface PanicSignal { level: PanicLevel; matched: string[]; confidence: number; }
export type FlowDecision = "PANIC_REASSURE" | "SLOT_FILL" | "PROCEED_DEBATE";

export interface SlotFillingResult {
  decision: FlowDecision;
  missingFields: SlotKey[];
  followUpQuestion?: string;
  panic: PanicSignal;
  updatedProfile: UserProfile;
}

const MAX_ASK_PER_SLOT = 2;
const REQUIRED_SLOTS: SlotKey[] = ["cash_balance", "risk_tolerance"];
const ADVICE_KEYWORDS = ["nên đầu tư", "đầu tư gì", "bắt đáy", "mua gì", "phân bổ", "all in", "xuống tiền", "có nên mua", "nên mua", "nên bán", "danh mục"];
const PANIC_KEYWORDS = ["sập", "sợ", "hoảng", "bán hết", "bán tháo", "toang", "lỗ nặng", "cháy tài khoản", "mất hết", "cứu", "đu đỉnh"];
const NEGATION_CUES = ["không", "chẳng", "đừng", "khỏi", "ko "];

function normalize(text: string): string { return text.toLowerCase().trim(); }
function containsAny(haystack: string, needles: string[]): string[] { return needles.filter((n) => haystack.includes(n)); }
function getAskedCount(profile: UserProfile, slot: SlotKey): number { return profile.askedCounts?.[slot] ?? 0; }
function incAsked(profile: UserProfile, slot: SlotKey): UserProfile {
  const counts: Partial<Record<SlotKey, number>> = { ...(profile.askedCounts ?? {}) };
  counts[slot] = (counts[slot] ?? 0) + 1;
  return { ...profile, askedCounts: counts };
}

export function detectPanic(message: string): PanicSignal {
  const text = normalize(message);
  const matched = containsAny(text, PANIC_KEYWORDS);
  if (matched.length === 0) return { level: "none", matched, confidence: 0 };
  let effective = matched.length;
  for (const kw of matched) {
    const idx = text.indexOf(kw);
    const prefix = text.slice(Math.max(0, idx - 6), idx);
    if (NEGATION_CUES.some((neg) => prefix.includes(neg))) effective -= 1;
  }
  if (effective <= 0) return { level: "none", matched, confidence: 0.1 };
  const exclam = (message.match(/!/g) ?? []).length;
  const shouting = /[A-ZÀ-Ỹ]{4,}/.test(message);
  const intensity = effective + (exclam > 0 ? 1 : 0) + (shouting ? 1 : 0);
  if (intensity >= 2) return { level: "high", matched, confidence: Math.min(0.5 + 0.15 * intensity, 0.95) };
  return { level: "low", matched, confidence: 0.4 };
}

export function isAdviceIntent(message: string): boolean {
  const text = normalize(message);
  return ADVICE_KEYWORDS.some((k) => text.includes(k));
}

export function extractCashBalance(message: string): number | undefined {
  const text = normalize(message).replace(/[,.](?=\d{3})/g, "");
  const tyMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(tỷ|ty)/);
  if (tyMatch) { const n = Number(tyMatch[1].replace(",", ".")); if (Number.isFinite(n)) return n * 1_000_000_000; }
  const trMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(triệu|trieu|tr)\b/);
  if (trMatch) { const n = Number(trMatch[1].replace(",", ".")); if (Number.isFinite(n)) return n * 1_000_000; }
  const rawMatch = text.match(/\b(\d{6,})\b/);
  if (rawMatch) { const n = Number(rawMatch[1]); if (Number.isFinite(n)) return n; }
  return undefined;
}
export function extractMoneyPurpose(message: string): MoneyPurpose | undefined {
  const text = normalize(message);
  if (/(nhàn rỗi|nhan roi|tiền dư|rảnh|để lâu|dài hạn)/.test(text)) return "idle";
  if (/(xây nhà|xay nha|cưới|cuoi|học phí|hoc phi|sắp dùng|cần gấp|ngắn hạn|mua nhà)/.test(text)) return "earmarked";
  return undefined;
}
export function extractRiskTolerance(message: string): RiskTolerance | undefined {
  const text = normalize(message);
  if (/(mạo hiểm|liều|all in|đánh lớn|aggressive|x10|gồng lãi)/.test(text)) return "aggressive";
  if (/(an toàn|thận trọng|sợ rủi ro|bảo toàn|conservative|giữ vốn)/.test(text)) return "conservative";
  if (/(cân bằng|vừa phải|balanced|trung bình)/.test(text)) return "balanced";
  return undefined;
}

function applyExtractions(profile: UserProfile, message: string): UserProfile {
  let updated: UserProfile = { ...profile };
  if (updated.cash_balance === undefined || updated.cash_balance === null) {
    const cash = extractCashBalance(message);
    if (typeof cash === "number") updated = { ...updated, cash_balance: cash };
  }
  const purpose = extractMoneyPurpose(message);
  if (purpose && (updated.money_purpose === undefined || updated.money_purpose === null)) updated = { ...updated, money_purpose: purpose };
  if (updated.risk_tolerance === undefined || updated.risk_tolerance === null) {
    const risk = extractRiskTolerance(message);
    if (risk) updated = { ...updated, risk_tolerance: risk };
  }
  if (updated.money_purpose === "earmarked") updated = { ...updated, risk_tolerance: "conservative" };
  return updated;
}

function isSlotFilled(profile: UserProfile, slot: SlotKey): boolean {
  if (slot === "cash_balance") return typeof profile.cash_balance === "number" && profile.cash_balance > 0;
  return profile.risk_tolerance === "conservative" || profile.risk_tolerance === "balanced" || profile.risk_tolerance === "aggressive";
}
function computeMissing(profile: UserProfile): SlotKey[] { return REQUIRED_SLOTS.filter((slot) => !isSlotFilled(profile, slot)); }

function buildQuestion(slot: SlotKey): string {
  if (slot === "cash_balance") return "Trước khi tư vấn, em cần rõ vài thông tin: Sếp định dành bao nhiêu vốn cho nhịp này? Và tiền này là tiền nhàn rỗi hay tiền sắp dùng (xây nhà, cưới hỏi, học phí)?";
  return "Khẩu vị rủi ro của Sếp thế nào ạ: an toàn (giữ vốn là chính), cân bằng, hay mạo hiểm (chấp nhận biến động mạnh để tìm lợi nhuận cao)?";
}

export function evaluateFlow(message: string, profile: UserProfile): SlotFillingResult {
  const safeProfile: UserProfile = profile && typeof profile === "object" ? profile : {};
  const updatedProfile = applyExtractions(safeProfile, message);
  const panic = detectPanic(message);
  if (panic.level === "high") return { decision: "PANIC_REASSURE", missingFields: computeMissing(updatedProfile), panic, updatedProfile };
  if (!isAdviceIntent(message)) return { decision: "PROCEED_DEBATE", missingFields: [], panic, updatedProfile };
  const missing = computeMissing(updatedProfile);
  if (missing.length === 0) return { decision: "PROCEED_DEBATE", missingFields: [], panic, updatedProfile };
  const nextSlot = missing[0];
  if (getAskedCount(updatedProfile, nextSlot) >= MAX_ASK_PER_SLOT) {
    const filledProfile: UserProfile = {
      ...updatedProfile,
      cash_balance: typeof updatedProfile.cash_balance === "number" && updatedProfile.cash_balance > 0 ? updatedProfile.cash_balance : 0,
      risk_tolerance: updatedProfile.risk_tolerance ?? "conservative",
    };
    return { decision: "PROCEED_DEBATE", missingFields: missing, panic, updatedProfile: filledProfile };
  }
  return { decision: "SLOT_FILL", missingFields: missing, followUpQuestion: buildQuestion(nextSlot), panic, updatedProfile: incAsked(updatedProfile, nextSlot) };
}
