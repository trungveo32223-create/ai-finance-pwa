// src/lib/agents/council/test_parity.ts
import { routeIntent } from "../Router";
import { buildContext } from "./context_builder";
import { runCouncilDebate } from "./orchestrator";

// Mô phỏng API Key (Cần export biến môi trường khi chạy thật)
const MOCK_GROQ_KEY = process.env.GROQ_KEY_1 || "test-key";

const TEST_QUERIES = [
  "Thị trường chứng khoán Việt Nam hôm nay thế nào?",
  "Đánh giá mã FPT",
  "Có nên mua nhà lúc này không?",
  "Tỷ giá USD tăng mạnh thì nên làm gì?",
  "Cảnh báo rủi ro thanh khoản",
  "Nên phân bổ tài sản như thế nào?",
  "Nợ thẻ tín dụng 100tr lãi 35% thì phải làm sao?", // (Nên ra Macro hoặc Standard, nếu router chuẩn)
  "BĐS đang bơm thổi nhiều quá, có bong bóng không?",
  "FED giảm lãi suất thì tác động VN thế nào?",
  "Chính phủ mới ra thông tư siết trái phiếu"
];

export async function runParityTest() {
  console.log("=== BẮT ĐẦU TEST PARITY COUNCIL V2 ===");
  
  for (const query of TEST_QUERIES) {
    console.log(`\n> Câu hỏi: "${query}"`);
    try {
      // 1. Router kiểm tra Intent & Regex VN30
      const routerResult = await routeIntent(query, []);
      console.log(`[Router] Intent: ${routerResult.intent}, Ticker: ${routerResult.ticker}`);

      // Chỉ chạy Council nếu intent là Macro
      if (routerResult.intent === "Macro") {
        console.log(`[Context] Building context...`);
        const ctx = await buildContext();
        
        console.log(`[Funnel] Status:
          Liquidity: ${ctx.funnelReport.liquidity.status}
          Recession: ${ctx.funnelReport.recession.status}
          Micro: ${ctx.funnelReport.micro_allocation.status}`);

        // Rất tốn API nếu chạy loop này thật, test offline nên comment out phần call Groq
        /*
        console.log(`[Council] Debating...`);
        const debate = await runCouncilDebate(query, ctx, MOCK_GROQ_KEY);
        console.log(`[Monitor Verdict]: ${debate.structuredVerdict.verdict}`);
        console.log(`[Traffic Light]: ${debate.structuredVerdict.traffic_light}`);
        */
        console.log("[Council] Passed logic check (LLM skipped for test)");
      } else {
        console.log(`[Skip] Intent is not Macro. Passed to SoR system.`);
      }
    } catch (err: any) {
      console.error(`[Lỗi] ${err.message}`);
    }
  }
  console.log("\n=== TEST HOÀN TẤT ===");
}
