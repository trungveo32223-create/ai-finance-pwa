import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { routeIntent } from "@/lib/agents/Router";
import { runCouncilDebate } from "@/lib/agents/council/orchestrator";
import { buildContext } from "@/lib/agents/council/context_builder";
import { generateCacheHash, getCachedVerdict, setCachedVerdict } from "@/lib/agents/council/cache";
import { extractVN30Ticker } from "@/lib/agents/council/ticker";
import { processStandard } from "@/lib/agents/Standard";
import { processDebt } from "@/lib/agents/Debt";
import { processQuery } from "@/lib/agents/Query";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type ChatStreamEvent =
  | { type: "phase"; label: string }
  | { type: "intent"; intent: string }
  | { type: "delta"; text: string }
  | { type: "slot_fill"; question: string }
  | { type: "verdict"; text: string; degraded: boolean; structuredData?: any }
  | { type: "ledger"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

interface ChatRequestBody { message: string; history?: any[]; userId?: string; }

export async function POST(req: NextRequest): Promise<Response> {
  let body: ChatRequestBody;
  try { body = (await req.json()) as ChatRequestBody; } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (typeof body.message !== "string" || body.message.trim().length === 0) return new Response("message required", { status: 400 });
  const message = body.message.trim();

  // 1. CHẠY ROUTER (V2)
  const routerResponse = await routeIntent(message, body.history || []);

  // Nhánh 1: Ghi sổ (Standard)
  if (routerResponse.intent === "Standard") {
    const data = await processStandard(message, body.history || []);
    return NextResponse.json({
      action: 'CONFIRM_REQUIRED',
      type: routerResponse.intent,
      data: data
    });
  }

  // Nhánh 1.5: Ghi sổ (Debt)
  if (routerResponse.intent === "Debt") {
    const data = await processDebt(message, routerResponse.sub_type || "Borrow", body.history || []);
    return NextResponse.json({
      action: 'CONFIRM_REQUIRED',
      type: routerResponse.intent,
      data: data
    });
  }

  // Nhánh 2: Truy vấn
  if (routerResponse.intent === "Query") {
    const data = await processQuery(routerResponse);
    return NextResponse.json({
      action: 'REPORT',
      data: data
    });
  }

  // Nhánh 3: Không rõ
  if (routerResponse.intent === "Unclear") {
    return NextResponse.json({
      action: 'UNCLEAR',
      message: routerResponse.message || "Xin lỗi, tôi chưa hiểu ý sếp."
    });
  }

  // Nhánh 4: Macro (Council V2) - LUỒNG STREAM
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent): void => { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); };
      try {
        send({ type: "intent", intent: routerResponse.intent });
        send({ type: "phase", label: "Đang triệu tập Hội đồng 7+1..." });
        
        const context = await buildContext();
        const hasTicker = !!extractVN30Ticker(message);
        let cacheHash = "";
        
        if (!hasTicker) {
          cacheHash = generateCacheHash(message, context);
          const cached = await getCachedVerdict(cacheHash);
          if (cached) {
            console.log("[Cache] HIT ->", message);
            send({ type: "phase", label: "Tìm thấy bản án trong Cache..." });
            send({ type: "verdict", text: cached.structuredVerdict.verdict + "\n\n*(⚡ Trả lời ngay từ Cache hệ thống)*", degraded: cached.degraded, structuredData: cached.structuredVerdict });
            send({ type: "done" });
            controller.close();
            return;
          }
        }

        send({ type: "phase", label: "Đang check 6 cổng Funnel..." });
        const result = await runCouncilDebate(message, context, (progressMsg) => {
          send({ type: "phase", label: progressMsg });
        });
        
        if (!hasTicker) {
          await setCachedVerdict(cacheHash, message, result);
        }
        
        send({ type: "phase", label: "The Judge đang chốt hạ..." });
        send({ type: "verdict", text: result.structuredVerdict.verdict, degraded: result.degraded, structuredData: result.structuredVerdict });
        send({ type: "done" });
        controller.close();
      } catch (err) {
        console.error(err);
        send({ type: "error", message: err instanceof Error ? err.message : "Server error" });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
