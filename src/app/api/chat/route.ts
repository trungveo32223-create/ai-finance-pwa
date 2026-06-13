import { NextRequest } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { routeIntent } from "@/lib/agents/Router";
import { runCouncilDebate } from "@/lib/agents/council/orchestrator";
import { buildContext } from "@/lib/agents/council/context_builder";
import { generateCacheHash, getCachedVerdict, setCachedVerdict } from "@/lib/agents/council/cache";
import { extractVN30Ticker } from "@/lib/agents/council/ticker";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type ChatStreamEvent =
  | { type: "phase"; label: string }
  | { type: "intent"; intent: string }
  | { type: "delta"; text: string }
  | { type: "slot_fill"; question: string }
  | { type: "verdict"; text: string; degraded: boolean }
  | { type: "ledger"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

interface ChatRequestBody { message: string; userId?: string; }

function getEnv(name: string): string { 
  const v = process.env[name]; 
  if (!v) throw new Error(`Missing env: ${name}`); 
  return v; 
}

// Hàm giả lập luồng ghi sổ cũ (SoR)
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
        send({ type: "phase", label: "Đang phân loại ý định..." });
        
        // 1. CHẠY ROUTER (V2)
        const routerResponse = await routeIntent(message, []);
        send({ type: "intent", intent: routerResponse.intent });

        // Nhánh 1: Ghi sổ (Standard/Debt)
        if (routerResponse.intent === "Standard" || routerResponse.intent === "Debt") {
          send({ type: "phase", label: "Đang ghi sổ..." });
          send({ type: "ledger", text: await handleLedgerFlow(message) });
          send({ type: "done" });
          controller.close();
          return;
        }

        // Nhánh 2: Truy vấn / Không rõ
        if (routerResponse.intent === "Unclear") {
          send({ type: "verdict", text: routerResponse.message || "Xin lỗi, tôi chưa hiểu ý sếp.", degraded: false });
          send({ type: "done" });
          controller.close();
          return;
        }
        
        if (routerResponse.intent === "Query") {
          send({ type: "verdict", text: "Truy vấn sổ sách đang được nâng cấp, sếp thử lại sau nhé.", degraded: false });
          send({ type: "done" });
          controller.close();
          return;
        }

        // Nhánh 3: Macro (Council V2)
        send({ type: "phase", label: "Đang triệu tập Hội đồng 7+1..." });
        
        // Lấy GROQ_KEY từ môi trường đã bị gỡ bỏ, dùng trực tiếp trong Router
        const context = await buildContext();

        // KẾT HỢP CACHE HF-04 (Bỏ qua cache nếu có mã cổ phiếu VN30)
        const hasTicker = !!extractVN30Ticker(message);
        let cacheHash = "";
        
        if (!hasTicker) {
          cacheHash = generateCacheHash(message, context);
          const cached = await getCachedVerdict(cacheHash);
          if (cached) {
            console.log("[Cache] HIT ->", message);
            send({ type: "phase", label: "Tìm thấy bản án trong Cache..." });
            send({ type: "verdict", text: cached.structuredVerdict.verdict + "\n\n*(⚡ Trả lời ngay từ Cache hệ thống)*", degraded: cached.degraded });
            send({ type: "done" });
            controller.close();
            return;
          }
        }

        send({ type: "phase", label: "Đang check 6 cổng Funnel..." });

        const result = await runCouncilDebate(message, context);
        
        if (!hasTicker) {
          await setCachedVerdict(cacheHash, message, result);
        }
        
        send({ type: "phase", label: "The Judge đang chốt hạ..." });
        send({ type: "verdict", text: result.structuredVerdict.verdict, degraded: result.degraded });
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
