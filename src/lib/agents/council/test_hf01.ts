import { runCouncilDebate } from "./orchestrator";
import { buildContext } from "./context_builder";

async function main() {
  process.env.NODE_ENV = "development"; // Ép để in debug
  const groqKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY_1 || process.env.GROQ_KEY_2 || "missing_key";
  console.log("Using Groq Key:", groqKey.slice(0, 5) + "...");
  const ctx = await buildContext();
  const debate = await runCouncilDebate("Thị trường bây giờ thế nào?", ctx, groqKey);
  console.log("\n--- VERDICT ---");
  console.log(debate.structuredVerdict.verdict);
}

main().catch(console.error);
