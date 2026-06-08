import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { fetchMarketData, MarketData } from "@/lib/crawlers/crypto_stocks";
import { detectCycle, toCycleReportRow } from "@/lib/agents/cycle_detector";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function loadCurrentMacro(supabase: SupabaseClient): Promise<MarketData[]> {
  const { data, error } = await supabase
    .from("market_data")
    .select("indicator_key,indicator_value,recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  const seen = new Set<string>();
  const latest: MarketData[] = [];
  for (const row of data as MarketData[]) {
    if (seen.has(row.indicator_key)) continue;
    seen.add(row.indicator_key);
    latest.push(row);
  }
  return latest;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Optional protection: Vercel Cron secret.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "config error" }, { status: 500 });
  }

  try {
    // 1. Crawl live crypto/stock data and insert.
    const finnhubApiKey = process.env.FINNHUB_API_KEY ?? "";
    const fetched = await fetchMarketData(supabase, { finnhubApiKey });
    if (fetched.length > 0) {
      await supabase.from("market_data").insert(fetched);
    }

    // 2. Load latest snapshot (one row per indicator) and run cycle detection.
    const current = await loadCurrentMacro(supabase);
    const report = detectCycle(current);
    const row = toCycleReportRow(report, current);

    // 3. Persist cycle report.
    const { error: insertError } = await supabase.from("cycle_reports").insert(row);
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ ok: true, inserted: fetched.length, report: row }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "cron failed" }, { status: 500 });
  }
}
