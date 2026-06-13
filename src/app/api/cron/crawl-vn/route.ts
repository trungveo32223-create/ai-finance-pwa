import { NextResponse } from "next/server";
import { crawlVietnamData } from "@/lib/crawlers/vietnam";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Bảo mật Cron (chỉ cho phép Vercel gọi)
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vnData = await crawlVietnamData();

    if (vnData.length === 0) {
      return NextResponse.json({ error: "No data fetched" }, { status: 500 });
    }

    // Insert vào bảng market_data (upsert hoặc insert)
    const { error } = await supabaseAdmin.from("market_data").upsert(
      vnData.map(d => ({
        indicator_key: d.indicator_key,
        indicator_value: d.indicator_value,
        recorded_at: d.recorded_at,
        is_stale: d.stale, 
        source: d.source,
      })),
      { onConflict: "indicator_key" }
    );

    if (error) {
      console.error("Supabase insert error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: vnData.length, data: vnData });
  } catch (error: any) {
    console.error("VN Crawl Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
