import { RouterResponse, MessageContext } from './types';

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
  const apiKey = getNextGroqKey();
  
  // Format context history
  const contextText = contextHistory.length > 0 
    ? `\nLịch sử trò chuyện gần đây:\n` + contextHistory.map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`).join('\n')
    : '';

  const prompt = `
Bạn là Agent_Router trong hệ thống Quản lý tài chính cá nhân. Nhiệm vụ duy nhất của bạn là GÁN NHÃN (Label) cho tin nhắn mới nhất của người dùng.

PHÂN LOẠI NHÃN (Chỉ được chọn 1 trong 4):
1. "Standard": Mọi giao dịch tiền tệ (Thu nhập, Chi phí, Tiết kiệm, Đầu tư) KHÔNG liên quan đến Nợ.
2. "Debt": Các giao dịch liên quan đến Công nợ (Vay, Cho vay, Trả nợ gốc, Thu nợ gốc, Trả lãi, Thu lãi).
3. "Query": Các câu hỏi tra cứu (tổng chi, số dư nợ, báo cáo ngày).
4. "Unclear": Các câu nói mơ hồ, không rõ là vay hay chi tiêu, hoặc không đủ thông tin để đoán. KHÔNG ĐƯỢC ĐOÁN BỪA.

HƯỚNG DẪN ĐỐI VỚI LABEL "Debt":
Bạn phải trả kèm "sub_type" là một trong 6 giá trị: Borrow (mình đi vay), Lend (mình cho vay), RepayPrincipal (mình trả nợ gốc), CollectPrincipal (người ta trả nợ gốc cho mình), RepayInterest (mình trả tiền lãi), CollectInterest (mình thu tiền lãi).
Lưu ý: "Nợ [Tên]" hoặc "Mượn [Tên]" -> Borrow. "Cho [Tên] nợ" hoặc "Cho vay" -> Lend.

HƯỚNG DẪN ĐỐI VỚI LABEL "Query":
Bạn phải bóc tách tham số truy vấn:
- Nếu hỏi nợ: "query_type": "debt", "person": "Tên người".
- Nếu hỏi ngày cụ thể: "query_type": "daily", "date": "today" | "yesterday" | "YYYY-MM-DD"
- Nếu hỏi khoảng thời gian: "query_type": "metric", "period": "this_week" | "this_month" | "last_month"

HƯỚNG DẪN ĐỐI VỚI LABEL "Unclear":
Bạn phải trả kèm "message" là một câu hỏi ngắn gọn gọn để hỏi lại người dùng cho rõ ràng.

VÍ DỤ:
- User: "Ăn phở 50k" -> {"intent": "Standard"}
- User: "Lương tháng 6: 15 triệu" -> {"intent": "Standard"}
- User: "Gửi tiết kiệm 10 triệu" -> {"intent": "Standard"}
- User: "Vay Tùng 2 củ" -> {"intent": "Debt", "sub_type": "Borrow"}
- User: "Cho Sacombank vay 5 triệu" -> {"intent": "Debt", "sub_type": "Lend"}
- User: "Trả Bình 500k" -> {"intent": "Debt", "sub_type": "RepayPrincipal"}
- User: "Nam đưa tao 3 triệu" -> {"intent": "Debt", "sub_type": "CollectPrincipal"}
- User: "Trả lãi cho Tùng 200k" -> {"intent": "Debt", "sub_type": "RepayInterest"}
- User: "Chuyển 500k" -> {"intent": "Unclear", "message": "Sếp chuyển 500k này cho việc gì ạ? Tiêu dùng hay trả nợ?"}
- User: "Nợ Tùng bao nhiêu" -> {"intent": "Query", "query_type": "debt", "person": "Tùng"}
- User: "Tổng chi tháng này" -> {"intent": "Query", "query_type": "metric", "period": "this_month"}

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
      throw new Error(`Groq API error: ${res.statusText}`);
    }

    const data = await res.json();
    return JSON.parse(data.choices[0].message.content) as RouterResponse;
  } catch (error) {
    console.error("Router Error:", error);
    throw new Error("Failed to route intent");
  }
}
