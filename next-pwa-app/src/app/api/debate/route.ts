import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { runDebate, DebateContext, CycleReportContext } from "@/lib/agents/debate_engine/orchestrator";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DebateRequestBody { query: string; userId?: string; }
interface CycleReportRow {
  date: string; liquidity_status: string | null; recession_status: string | null; ml_clock_phase: string | null; allocation_json: Record<string, number> | null;
}
interface MarketDataRow { indicator_key: string; indicator_value: number; }

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}
function getServiceClient(): SupabaseClient {
  return createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

async function loadLatestCycleReport(supabase: SupabaseClient): Promise<CycleReportContext | undefined> {
  const { data, error } = await supabase
    .from("cycle_reports")
    .select("date,liquidity_status,recession_status,ml_clock_phase,allocation_json")
    .order("date", { ascending: false }).limit(1);
  if (error || !data || data.length === 0) return undefined;
  const row = data[0] as CycleReportRow;
  return {
    liquidity_status: row.liquidity_status ?? undefined,
    recession_status: row.recession_status ?? undefined,
    ml_clock_phase: row.ml_clock_phase ?? undefined,
    allocation: row.allocation_json ?? undefined,
  };
}

const SNAPSHOT_KEYS = ["BTC_USD", "ETH_USD", "SPY", "VIX"] as const;
const FNG_KEY = "CRYPTO_FNG";

async function loadMarketSnapshot(supabase: SupabaseClient): Promise<{ snapshot: Record<string, number>; fng: number | null }> {
  const keys = [...SNAPSHOT_KEYS, FNG_KEY];
  const { data, error } = await supabase
    .from("market_data").select("indicator_key,indicator_value").in("indicator_key", keys).order("recorded_at", { ascending: false });
  const snapshot: Record<string, number> = {};
  let fng: number | null = null;
  if (error || !data) return { snapshot, fng };
  const seen = new Set<string>();
  for (const raw of data as MarketDataRow[]) {
    if (seen.has(raw.indicator_key)) continue;
    if (!Number.isFinite(raw.indicator_value)) continue;
    seen.add(raw.indicator_key);
    if (raw.indicator_key === FNG_KEY) fng = raw.indicator_value;
    else snapshot[raw.indicator_key] = raw.indicator_value;
  }
  return { snapshot, fng };
}

async function persistChat(supabase: SupabaseClient, userId: string | undefined, query: string, verdict: string): Promise<boolean> {
  try {
    const base = { intent: "debate", user_id: userId ?? null };
    const { error } = await supabase.from("chat_history").insert([
      { ...base, role: "user", content: query },
      { ...base, role: "assistant", content: verdict },
    ]);
    return !error;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: DebateRequestBody;
  try { body = (await req.json()) as DebateRequestBody; } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (typeof body.query !== "string" || body.query.trim().length === 0) {
    return NextResponse.json({ error: "Field 'query' is required and must be a non-empty string" }, { status: 400 });
  }
  const query = body.query.trim();

  let supabase: SupabaseClient; let groqApiKey: string;
  try { supabase = getServiceClient(); groqApiKey = getEnv("GROQ_API_KEY"); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Server misconfiguration" }, { status: 500 }); }

  const [cycleReport, market] = await Promise.all([loadLatestCycleReport(supabase), loadMarketSnapshot(supabase)]);
  const context: DebateContext = { cycleReport, fearGreedIndex: market.fng, marketSnapshot: market.snapshot };

  try {
    const result = await runDebate(query, context, { apiKey: groqApiKey });
    const persisted = await persistChat(supabase, body.userId, query, result.verdict);
    return NextResponse.json({
      verdict: result.verdict, opinions: result.opinions, failures: result.failures, degraded: result.degraded, persisted,
      contextUsed: { hasCycleReport: Boolean(cycleReport), fearGreedIndex: market.fng, snapshotKeys: Object.keys(market.snapshot) },
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "Debate engine failed", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
