"use client";

import { useCallback, useRef, useState, memo } from "react";

interface ChatMessage { id: string; role: "user" | "assistant"; content: string; }
type StreamEvent =
  | { type: "phase"; label: string }
  | { type: "intent"; intent: string }
  | { type: "delta"; text: string }
  | { type: "slot_fill"; question: string }
  | { type: "verdict"; text: string; degraded: boolean }
  | { type: "ledger"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const MessageBubble = memo(function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      border: "4px solid #000", background: isUser ? "#000" : "#CCFF00", color: isUser ? "#CCFF00" : "#000",
      padding: "12px 16px", margin: "10px 0", boxShadow: "6px 6px 0 #000", fontWeight: 700,
      whiteSpace: "pre-wrap", alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "85%",
    }}>{msg.content}</div>
  );
});

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<string>("");
  const [streaming, setStreaming] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const pushMessage = useCallback((m: ChatMessage) => { setMessages((prev) => [...prev, m]); }, []);

  const handleEvent = useCallback((evt: StreamEvent) => {
    switch (evt.type) {
      case "phase": setPhase(evt.label); break;
      case "delta": setStreaming((prev) => prev + evt.text); break;
      case "slot_fill": pushMessage({ id: uid(), role: "assistant", content: evt.question }); break;
      case "ledger": pushMessage({ id: uid(), role: "assistant", content: evt.text }); break;
      case "verdict": {
        const tag = evt.degraded ? "⚠️ (hội đồng thiếu người) " : "";
        pushMessage({ id: uid(), role: "assistant", content: tag + evt.text });
        break;
      }
      case "error": pushMessage({ id: uid(), role: "assistant", content: `LỖI: ${evt.message}` }); break;
      case "done": setPhase(""); setStreaming(""); setBusy(false); break;
      default: break;
    }
  }, [pushMessage]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    pushMessage({ id: uid(), role: "user", content: text });
    setInput(""); setBusy(true); setPhase("Đang kết nối...");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }), signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API Lỗi ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (!res.body) throw new Error("No stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try { 
            const evt = JSON.parse(json) as StreamEvent; 
            if (evt.type === "error") throw new Error(evt.message);
            handleEvent(evt); 
          } catch (e) { 
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        handleEvent({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
      }
      setBusy(false); setPhase("");
    }
  }, [input, busy, handleEvent, pushMessage]);

  return (
    <main style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "monospace", padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontWeight: 900, fontSize: 32, textTransform: "uppercase", background: "#000", color: "#CCFF00", padding: "8px 12px", border: "4px solid #000", boxShadow: "8px 8px 0 #CCFF00" }}>
        AI FINANCE COUNCIL
      </h1>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
        {messages.map((m) => (<MessageBubble key={m.id} msg={m} />))}
        {streaming && (
          <div style={{ border: "4px dashed #000", background: "#FFF", padding: "12px 16px", margin: "10px 0", whiteSpace: "pre-wrap", fontWeight: 700 }}>
            {streaming}<span style={{ animation: "blink 1s steps(1) infinite" }}>▌</span>
          </div>
        )}
        {busy && phase && (
          <div style={{ border: "4px solid #000", background: "#FF00AA", color: "#FFF", padding: "10px 14px", margin: "10px 0", fontWeight: 900, textTransform: "uppercase", boxShadow: "6px 6px 0 #000" }}>
            ⏳ {phase}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Hỏi gì đó về tiền của Sếp..." disabled={busy}
          style={{ flex: 1, border: "4px solid #000", padding: "12px 14px", fontFamily: "monospace", fontWeight: 700, outline: "none" }} />
        <button onClick={send} disabled={busy}
          style={{ border: "4px solid #000", background: busy ? "#999" : "#CCFF00", fontWeight: 900, padding: "0 20px", cursor: busy ? "not-allowed" : "pointer", boxShadow: "5px 5px 0 #000", textTransform: "uppercase" }}>
          Gửi
        </button>
      </div>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </main>
  );
}
