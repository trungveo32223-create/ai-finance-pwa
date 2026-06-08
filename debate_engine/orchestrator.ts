import { EXPERTS, JUDGE_SYSTEM_PROMPT, ExpertId } from "./prompts";

// ============================================================
// TYPES
// ============================================================

export interface CycleReportContext {
  liquidity_status?: string;
  recession_status?: string;
  ml_clock_phase?: string;
  allocation?: Record<string, number>;
}

export interface PanicSignalLike {
  level: "none" | "low" | "high";
  confidence: number;
}

export interface PolymarketSentimentContext {
  btcBullishProb: number;
  recessionProb: number;
  btcMarketQuestion?: string;
  recessionMarketQuestion?: string;
}

export interface DebateContext {
  cycleReport?: CycleReportContext;
  fearGreedIndex?: number | null;
  marketSnapshot?: Record<string, number>;
  panic?: PanicSignalLike;
  polymarketSentiment?: PolymarketSentimentContext | null; // MỚI
}

export interface ExpertOpinion { id: ExpertId; name: string; opinion: string; }
export interface ExpertFailure { id: ExpertId; name: string; error: string; }
export interface DebateResult {
  verdict: string;
  opinions: ExpertOpinion[];
  failures: ExpertFailure[];
  degraded: boolean;
}

interface GroqConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  expertTimeoutMs?: number;
  judgeTimeoutMs?: number;
}

const DEFAULTS = {
  model: "llama-3.3-70b-versatile",
  baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  expertTimeoutMs: 6000,
  judgeTimeoutMs: 8000,
} as const;

// ============================================================
// GROQ RESPONSE VALIDATION
// ============================================================

interface GroqResponse {
  choices: Array<{ message: { content: string } }>;
}

function parseGroqResponse(raw: unknown): string {
  if (
    typeof raw === "object" && raw !== null &&
    "choices" in raw &&
    Array.isArray((raw as GroqResponse).choices) &&
    (raw as GroqResponse).choices.length > 0
  ) {
    const content = (raw as GroqResponse).choices[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) return content.trim();
  }
  throw new Error("Malformed Groq response");
}

// ============================================================
// GROQ CALL
// ============================================================

async function callGroq(
  cfg: Required<Pick<GroqConfig, "apiKey" | "model" | "baseUrl">>,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  maxTokens: number
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(cfg.baseUrl, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
    return parseGroqResponse((await res.json()) as unknown);
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// CONTEXT SERIALIZATION — cập nhật để include Polymarket
// ============================================================

function serializeContext(query: string, ctx: DebateContext): string {
  const parts: string[] = [`USER QUESTION: ${query}`];

  if (ctx.cycleReport) {
    const c = ctx.cycleReport;
    parts.push(
      `MACRO: liquidity=${c.liquidity_status ?? "n/a"}, ` +
      `recession=${c.recession_status ?? "n/a"}, ` +
      `phase=${c.ml_clock_phase ?? "n/a"}.`
    );
  }

  if (typeof ctx.fearGreedIndex === "number") {
    parts.push(`FEAR_GREED_INDEX: ${ctx.fearGreedIndex} (0=extreme fear, 100=extreme greed).`);
  }

  // Polymarket crowd probabilities — MỚI
  if (ctx.polymarketSentiment) {
    const pm = ctx.polymarketSentiment;
    const btcPct = Math.round(pm.btcBullishProb * 100);
    const recPct = Math.round(pm.recessionProb * 100);
    parts.push(
      `POLYMARKET_CROWD: ` +
      `BTC_bullish_prob=${btcPct}% (market: "${pm.btcMarketQuestion ?? "n/a"}"), ` +
      `US_recession_prob=${recPct}% (market: "${pm.recessionMarketQuestion ?? "n/a"}"). ` +
      `These are real-money crowd predictions, not surveys.`
    );
  }

  if (ctx.panic && ctx.panic.level !== "none") {
    parts.push(`PANIC_SIGNAL: level=${ctx.panic.level}, confidence=${ctx.panic.confidence}.`);
  }

  if (ctx.marketSnapshot) {
    const kv = Object.entries(ctx.marketSnapshot).map(([k, v]) => `${k}=${v}`).join(", ");
    if (kv) parts.push(`SNAPSHOT: ${kv}.`);
  }

  return parts.join("\n");
}

// ============================================================
// MAIN ENTRY
// ============================================================

export async function runDebate(
  query: string,
  context: DebateContext,
  config: GroqConfig
): Promise<DebateResult> {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new Error("runDebate: query must be a non-empty string");
  }

  const cfg = {
    apiKey: config.apiKey,
    model: config.model ?? DEFAULTS.model,
    baseUrl: config.baseUrl ?? DEFAULTS.baseUrl,
    expertTimeoutMs: config.expertTimeoutMs ?? DEFAULTS.expertTimeoutMs,
    judgeTimeoutMs: config.judgeTimeoutMs ?? DEFAULTS.judgeTimeoutMs,
  };

  const userPrompt = serializeContext(query, context);

  const settled = await Promise.allSettled(
    EXPERTS.map((expert) =>
      callGroq(cfg, expert.systemPrompt, userPrompt, cfg.expertTimeoutMs, 140)
        .then((opinion): ExpertOpinion => ({ id: expert.id, name: expert.name, opinion }))
    )
  );

  const opinions: ExpertOpinion[] = [];
  const failures: ExpertFailure[] = [];
  settled.forEach((result, idx) => {
    const expert = EXPERTS[idx];
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

  if (opinions.length === 0) {
    return {
      verdict:
        "Hội đồng cố vấn hiện không khả dụng. Mặc định giữ thế phòng thủ: " +
        "tránh mở vị thế rủi ro mới, bảo toàn vốn, và thử lại sau.",
      opinions,
      failures,
      degraded: true,
    };
  }

  const judgeUser =
    `${userPrompt}\n\nEXPERT OPINIONS (${opinions.length}/6 available):\n` +
    opinions.map((o) => `- ${o.name}: ${o.opinion}`).join("\n") +
    (failures.length > 0
      ? `\n\nNOTE: ${failures.length} expert(s) unavailable: ${failures.map((f) => f.name).join(", ")}.`
      : "");

  let verdict: string;
  try {
    verdict = await callGroq(cfg, JUDGE_SYSTEM_PROMPT, judgeUser, cfg.judgeTimeoutMs, 700);
  } catch (err) {
    verdict =
      "The Judge không thể tổng hợp. Ý kiến chuyên gia hiện có:\n" +
      opinions.map((o) => `• ${o.name}: ${o.opinion}`).join("\n") +
      `\n\n(Lý do: ${err instanceof Error ? err.message : String(err)})`;
  }

  return { verdict, opinions, failures, degraded: failures.length > 0 };
}
