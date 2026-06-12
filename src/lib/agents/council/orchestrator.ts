// src/lib/agents/council/orchestrator.ts
import { 
  CouncilContext, 
  ExpertOpinion, 
  ExpertFailure, 
  DebateResult, 
  StructuredVerdict,
  PersonaDefinition
} from "./types";
import { COUNCIL_ROSTER, MONITOR_PROMPT } from "./personas";

const DEFAULTS = {
  model: "llama-3.3-70b-versatile",
  baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  expertTimeoutMs: 6000,
  judgeTimeoutMs: 8000,
};

function parseGroqResponse(raw: any): string {
  if (raw?.choices?.[0]?.message?.content) {
    return raw.choices[0].message.content.trim();
  }
  throw new Error("Malformed Groq response");
}

async function callGroq(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  maxTokens: number,
  isJson: boolean = false
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: any = {
      model: DEFAULTS.model,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
    if (isJson) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(DEFAULTS.baseUrl, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
    return parseGroqResponse(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

// Serialize context để gửi cho các Persona
function serializeContext(query: string, ctx: CouncilContext, personaRequiredData: string[]): string {
  const parts: string[] = [`USER QUESTION: ${query}`];
  
  // Kiểm tra requiredData (Luật L5)
  const missingData: string[] = [];
  for (const key of personaRequiredData) {
    const dataPoint = ctx.marketData[key];
    if (!dataPoint) {
      missingData.push(key);
    } else {
      parts.push(`DATA [${key}]: ${dataPoint.value} (stale: ${dataPoint.stale})`);
    }
  }

  if (missingData.length > 0) {
    parts.push(`CẢNH BÁO: BẠN BỊ THIẾU DỮ LIỆU BẮT BUỘC SAU: ${missingData.join(", ")}. BẠN PHẢI ABSTAIN (NO_DATA).`);
  }

  parts.push(`FUNNEL REPORT SUMMARY:
- Liquidity: ${ctx.funnelReport.liquidity.status}
- Recession: ${ctx.funnelReport.recession.status}
- Cycle: ${ctx.funnelReport.cycle.status}
- Policy VN: ${ctx.funnelReport.policy_vn.status}
- Micro/Allocation: ${ctx.funnelReport.micro_allocation.status} (${ctx.funnelReport.micro_allocation.reason})
  `);

  return parts.join("\n");
}

export async function runCouncilDebate(
  query: string,
  context: CouncilContext,
  groqKey: string
): Promise<DebateResult> {
  
  // Lọc Persona theo Short-circuit (Quy tắc 5.1.3: Nếu Liquidity/Recession RED -> Chỉ gọi phòng thủ)
  let activePersonas: PersonaDefinition[] = [...COUNCIL_ROSTER];
  
  const isRedAlert = context.funnelReport.liquidity.status === "RED" || context.funnelReport.recession.status === "RED";
  if (isRedAlert) {
    const defenseRoles = ["wealth_manager", "banker", "lawyer", "psychologist"];
    activePersonas = activePersonas.filter(p => defenseRoles.includes(p.id));
  }

  // Chạy song song các chuyên gia
  const settled = await Promise.allSettled(
    activePersonas.map((persona) => {
      const userPrompt = serializeContext(query, context, persona.requiredData);
      return callGroq(groqKey, persona.systemPrompt, userPrompt, DEFAULTS.expertTimeoutMs, 150)
        .then((opinion): ExpertOpinion => ({
          id: persona.id,
          name: persona.name,
          opinion,
        }));
    })
  );

  const opinions: ExpertOpinion[] = [];
  const failures: ExpertFailure[] = [];

  settled.forEach((result, idx) => {
    const expert = activePersonas[idx];
    if (result.status === "fulfilled") {
      opinions.push(result.value);
    } else {
      failures.push({
        id: expert.id,
        name: expert.name,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  // Gửi cho Monitor tổng hợp
  const monitorUserPrompt = `USER QUESTION: ${query}

FUNNEL GATES STATUS:
- Liquidity: ${context.funnelReport.liquidity.status}
- Recession: ${context.funnelReport.recession.status}
- Allocation Constraint: ${context.funnelReport.micro_allocation.status} - ${context.funnelReport.micro_allocation.reason}

EXPERT OPINIONS (${opinions.length} available):
${opinions.map((o) => `- ${o.name}: ${o.opinion}`).join("\n")}

FAILURES: ${failures.length > 0 ? failures.map(f => f.name).join(", ") : "None"}

Please output strict JSON according to the schema.`;

  let rawJson = "";
  let structuredVerdict: StructuredVerdict;
  
  try {
    rawJson = await callGroq(groqKey, MONITOR_PROMPT, monitorUserPrompt, DEFAULTS.judgeTimeoutMs, 800, true);
    structuredVerdict = JSON.parse(rawJson);
    
    // Ép cứng Disclaimer (Luật L1 / Test S1-07)
    const disclaimer = "\n\n(⚠ Đây là thông tin phân tích thị trường dựa trên AI, tuyệt đối không phải là lời khuyên tư vấn đầu tư.)";
    if (!structuredVerdict.verdict.includes("tư vấn đầu tư")) {
      structuredVerdict.verdict += disclaimer;
    }
  } catch (err) {
    console.error("Monitor Error:", err);
    // Fallback nếu Monitor sụp đổ
    let failDebug = "";
    if (process.env.NODE_ENV !== "production" && failures.length > 0) {
      failDebug = `\n[DEBUG] ${failures.map(f => `${f.name}: ${f.error}`).join(" | ")}`;
      console.error("[DEBUG FAILURES]", failDebug);
    }
    
    structuredVerdict = {
      verdict: "Hội đồng cố vấn hiện không khả dụng. Mặc định giữ thế phòng thủ: tránh mở vị thế rủi ro mới, bảo toàn vốn, và thử lại sau." + failDebug,
      traffic_light: "YELLOW",
      confidence: 0,
      three_answers: {
        greed_or_fear: "Không xác định",
        loss_probability: "Không xác định",
        government_actions: "Không xác định"
      },
      key_risk: "Monitor Service Error",
      dissenting_view: "None",
      data_gaps: ["Monitor crashed"]
    };
  }

  return {
    structuredVerdict,
    rawJson,
    opinions,
    failures,
    degraded: failures.length > 0
  };
}
