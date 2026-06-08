import { NextRequest } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { runDebate, DebateContext } from "@/lib/agents/debate_engine/orchestrator";
import { evaluateFlow, UserProfile, PanicSignal } from "@/lib/agents/slot_filling";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type ChatIntent = "standard_debt" | "macro_advice" | "unknown";
type ChatStreamEvent =
  | { type: "phase"; label: string }
  | { type: "intent"; intent: ChatIntent }
  | { type: "delta"; text: string }
  | { type: "slot_fill"; question: string }
  | { type: "verdict"; text: string; degraded: boolean }
  | { type: "ledger"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

interface ChatRequestBody { message: string; userId?: string; }
interface CycleReportRow { liquidity_status: string | null; recession_status: string | null; ml_clock_phase: string | null; allocation_json: Record<string, number> | null; }
interface MarketDataRow { indicator_key: string; indicator_value: number; }
interface ProfileRow {
  cash_balance: number | null; risk_tolerance: UserProfile["risk_tolerance"]; money_purpose: UserProfile["money_purpose"]; asked_counts: UserProfile["askedCounts"] | null;
}

function getEnv(name: string): string { const v = process.env[name]; if (!v) throw new Error(`Missing env: ${name}`); return v; }
function getClient(): SupabaseClient {
  return createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

const MACRO_KEYWORDS = ["đầu tư", "bắt đáy", "mua gì", "phân bổ", "danh mục", "vĩ mô", "chu kỳ", "lãi suất", "btc", "chứng khoán", "all in"];
const DEBT_KEYWORDS = ["nợ", "vay", "trả góp", "chi", "thu", "lương", "ghi sổ", "tiêu"];
function detectIntent(message: string): ChatIntent {
  const t = message.toLowerCase();
  if (MACRO_KEYWORDS.some((k) => t.includes(k))) return "macro_advice";
  if (DEBT_KEYWORDS.some((k) => t.includes(k))) return "standard_debt";
  return "unknown";
}

async function loadProfile(supabase: SupabaseClient, userId: string | undefined): Promise<UserProfile> {
  if (!userId) return {};
  const { data, error } = await supabase.from("user_profiles").select("cash_balance,risk_tolerance,money_purpose,asked_counts").eq("user_id", userId).limit(1);
  if (error || !data || data.length === 0) return {};
  const row = data[0] as ProfileRow;
  return { cash_balance: row.cash_balance, risk_tolerance: row.risk_tolerance, money_purpose: row.money_purpose, askedCounts: row.asked_counts ?? {} };
}
async function saveProfile(supabase: SupabaseClient, userId: string | undefined, profile: UserProfile): Promise<void> {
  if (!userId) return;
  try {
    await supabase.from("user_profiles").upsert({
      user_id: userId, cash_balance: profile.cash_balance ?? null, risk_tolerance: profile.risk_tolerance ?? null,
      money_purpose: profile.money_purpose ?? null, asked_counts: profile.askedCounts ?? {},
    }, { onConflict: "user_id" });
  } catch { /* non-fatal */ }
}

async function loadMacroContext(supabase: SupabaseClient): Promise<DebateContext> {
  const [reportRes, marketRes] = await Promise.all([
    supabase.from("cycle_reports").select("liquidity_status,recession_status,ml_clock_phase,allocation_json").order("date", { ascending: false }).limit(1),
    supabase.from("market_data").select("indicator_key,indicator_value").in("indicator_key", ["BTC_USD", "ETH_USD", "SPY", "VIX", "CRYPTO_FNG"]).order("recorded_at", { ascending: false }),
  ]);
  let cycleReport: DebateContext["cycleReport"];
  if (!reportRes.error && reportRes.data && reportRes.data.length > 0) {
    const r = reportRes.data[0] as CycleReportRow;
    cycleReport = { liquidity_status: r.liquidity_status ?? undefined, recession_status: r.recession_status ?? undefined, ml_clock_phase: r.ml_clock_phase ?? undefined, allocation: r.allocation_json ?? undefined };
  }
  const snapshot: Record<string, number> = {};
  let fng: number | null = null;
  if (!marketRes.error && marketRes.data) {
    const seen = new Set<string>();
    for (const raw of marketRes.data as MarketDataRow[]) {
      if (seen.has(raw.indicator_key)) continue;
      if (!Number.isFinite(raw.indicator_value)) continue;
      seen.add(raw.indicator_key);
      if (raw.indicator_key === "CRYPTO_FNG") fng = raw.indicator_value;
      else snapshot[raw.indicator_key] = raw.indicator_value;
    }
  }
  return { cycleReport, fearGreedIndex: fng, marketSnapshot: snapshot };
}

async function handleLedgerFlow(message: string): Promise<string> {
  return `Đã ghi nhận giao dịch: "${message}". (Luồng ghi sổ Phase 0).`;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: ChatRequestBody;
  try { body = (await req.json()) as ChatRequestBody; } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (typeof body.message !== "string" || body.message.trim().length === 0) return new Response("message required", { status: 400 });
  const message = body.message.trim();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent): void => { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
      try {
        const supabase = getClient();
        const intent = detectIntent(message);
        send({ type: "intent", intent });

        if (intent === "standard_debt") {
          send({ type: "phase", label: "Đang ghi sổ..." });
          send({ type: "ledger", text: await handleLedgerFlow(message) });
          send({ type: "done" });
          controller.close();
          return;
        }

        const profile = await loadProfile(supabase, body.userId);
        const flow = evaluateFlow(message, profile);
        await saveProfile(supabase, body.userId, flow.updatedProfile);

        if (flow.decision === "SLOT_FILL" && flow.followUpQuestion) {
          send({ type: "slot_fill", question: flow.followUpQuestion });
          send({ type: "done" });
          controller.close();
          return;
        }

        send({ type: "phase", label: "Đang triệu tập 7 chuyên gia..." });
        const context = await loadMacroContext(supabase);
        const ctxWithPanic: DebateContext & { panic?: PanicSignal } = { ...context, panic: flow.panic };
        send({ type: "phase", label: "Macro Economist đang soi FRED..." });
        send({ type: "phase", label: "Risk Manager đang kiểm tra Sahm Rule..." });

        const result = await runDebate(message, ctxWithPanic, { apiKey: getEnv("GROQ_API_KEY") });
        send({ type: "phase", label: "The Judge đang chốt hạ..." });
        send({ type: "verdict", text: result.verdict, degraded: result.degraded });
        send({ type: "done" });
        controller.close();
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Server error" });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
