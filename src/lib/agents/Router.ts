import { RouterResponse, MessageContext } from './types';
import { extractVN30Ticker } from './council/ticker';

// Danh sách các key Groq (Xoay vòng để chống rate limit)
const GROQ_KEYS = [process.env.GROQ_KEY_1, process.env.GROQ_KEY_2].filter(Boolean) as string[];
let currentGroqIndex = 0;

function getNextGroqKey() {
  if (GROQ_KEYS.length === 0) throw new Error('Missing GROQ_KEY');
  const key = GROQ_KEYS[currentGroqIndex];
  currentGroqIndex = (currentGroqIndex + 1) % GROQ_KEYS.length;
  return key;
}

export async function routeIntent(message: string, contextHistory: MessageContext[] = []): Promise<RouterResponse> {
  // 1. CHẠY REGEX TRƯỚC LLM CALL (L9, Sprint 1.7)
  const tickerMatched = extractVN30Ticker(message);
  
  const apiKey = getNextGroqKey();
  
  // Format context history
  const contextText = contextHistory.length > 0 
    ? `\nLịch sử trò chuyện gần đây:\n` + contextHistory.map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`).join('\n')
    : '';

  const prompt = `
Bạn là Agent_Router trong hệ thống Quản lý tài chính cá nhân. Nhiệm vụ duy nhất của bạn là GÁN NHÃN (Label) cho tin nhắn mới nhất của người dùng.

PHÂN LOẠI NHÃN (Chỉ được chọn 1 trong 5):
1. "Standard": Mọi giao dịch tiền tệ (Thu nhập, Chi phí, Tiết kiệm, Đầu tư) KHÔNG liên quan đến Nợ.
2. "Debt": Các giao dịch liên quan đến Công nợ (Vay, Cho vay, Trả nợ gốc, Thu nợ gốc, Trả lãi, Thu lãi).
3. "Query": Các câu hỏi tra cứu số dư cá nhân (tổng chi, số dư nợ, báo cáo ngày).
4. "Macro": Các câu hỏi nhờ tư vấn đầu tư, phân tích thị trường, mã cổ phiếu, chứng khoán, vĩ mô.
5. "Unclear": Các câu nói mơ hồ, không rõ là vay hay chi tiêu. KHÔNG ĐƯỢC ĐOÁN BỪA.

HƯỚNG DẪN ĐỐI VỚI LABEL "Debt":
Bạn phải trả kèm "sub_type" là một trong 6 giá trị: Borrow (mình đi vay), Lend (mình cho vay), RepayPrincipal (mình trả nợ gốc), CollectPrincipal (người ta trả nợ gốc cho mình), RepayInterest (mình trả tiền lãi), CollectInterest (mình thu tiền lãi).
Lưu ý: "Nợ [Tên]" hoặc "Mượn [Tên]" -> Borrow. "Cho [Tên] nợ" hoặc "Cho vay" -> Lend.

HƯỚNG DẪN ĐỐI VỚI LABEL "Query":
Bạn phải bóc tách tham số truy vấn:
- Nếu hỏi nợ: "query_type": "debt", "person": "Tên người".
- Nếu hỏi ngày cụ thể: "query_type": "daily", "date": "today" | "yesterday" | "YYYY-MM-DD"
- Nếu hỏi khoảng thời gian: "query_type": "metric", "period": "this_week" | "this_month" | "last_month"

HƯỚNG DẪN ĐỐI VỚI LABEL "Macro":
Bạn phải trả kèm "ticker" nếu user hỏi về 1 mã cụ thể. Nếu không, ticker là null.
(Gợi ý hệ thống: Mã VN30 đã được nhận diện trước: ${tickerMatched || "Không có"})

HƯỚNG DẪN ĐỐI VỚI LABEL "Unclear":
Bạn phải trả kèm "message" là một câu hỏi ngắn gọn gọn để hỏi lại người dùng cho rõ ràng. 
CHÚ Ý QUAN TRỌNG: Hãy đọc kỹ "Lịch sử trò chuyện gần đây" (nếu có).

VÍ DỤ:
- User: "Ăn phở 50k" -> {"intent": "Standard"}
- User: "Vay Tùng 2 củ" -> {"intent": "Debt", "sub_type": "Borrow"}
- User: "Tổng chi tháng này" -> {"intent": "Query", "query_type": "metric", "period": "this_month"}
- User: "Đánh giá FPT" -> {"intent": "Macro", "ticker": "FPT"}
- User: "Thị trường hnay thế nào" -> {"intent": "Macro", "ticker": null}

ĐẦU VÀO MỚI NHẤT TỪ USER: "${message}"${contextText}

TRẢ VỀ DUY NHẤT 1 CHUỖI JSON ĐÚNG ĐỊNH DẠNG. KHÔNG GIẢI THÍCH GÌ THÊM.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      throw new Error("Hệ thống AI đang quá tải (Groq), vui lòng thử lại sau.");
    }

    const data = await res.json();
    try {
      return JSON.parse(data.choices[0].message.content) as RouterResponse;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      throw new Error("Dữ liệu AI trả về bị lỗi định dạng (Router).");
    }
  } catch (error: any) {
    console.error("Router Error:", error);
    if (error.message && (error.message.includes("Hệ thống AI") || error.message.includes("Dữ liệu AI"))) {
      throw error;
    }
    throw new Error("Hệ thống AI đang quá tải, vui lòng thử lại sau.");
  }
}
