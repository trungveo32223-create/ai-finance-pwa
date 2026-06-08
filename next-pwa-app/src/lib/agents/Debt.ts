import { DebtResult, DebtSubType, MessageContext } from './types';

const DEEPSEEK_KEYS = [process.env.DEEPSEEK_KEY_1, process.env.DEEPSEEK_KEY_2].filter(Boolean) as string[];
let currentDeepseekIndex = 0;

function getNextDeepseekKey() {
  if (DEEPSEEK_KEYS.length === 0) throw new Error('Missing DEEPSEEK_KEY');
  const key = DEEPSEEK_KEYS[currentDeepseekIndex];
  currentDeepseekIndex = (currentDeepseekIndex + 1) % DEEPSEEK_KEYS.length;
  return key;
}

export async function processDebt(message: string, sub_type: DebtSubType, contextHistory: MessageContext[] = []): Promise<DebtResult> {
  const apiKey = getNextDeepseekKey();
  
  const contextText = contextHistory.length > 0 
    ? `\nLịch sử trò chuyện gần đây:\n` + contextHistory.map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`).join('\n')
    : '';

  const prompt = `Bạn là Agent_Debt chuyên bóc tách giao dịch CÔNG NỢ (Gốc và Lãi).
Loại giao dịch hiện tại đã được Router xác định là: ${sub_type}
Ý nghĩa:
- Borrow: Mình đi vay.
- Lend: Mình cho vay.
- RepayPrincipal: Mình trả nợ gốc.
- CollectPrincipal: Thu nợ gốc.
- RepayInterest: Trả tiền lãi.
- CollectInterest: Thu tiền lãi.

BẢNG QUY ĐỔI SỐ TIỀN (Slang):
- k, nghìn, ngàn, cành, ca -> x 1.000 (Ví dụ: 5 ca = 5000)
- xị, lít -> x 100.000 (Ví dụ: 3 xị = 300000)
- tr, triệu, chai, củ, cu -> x 1.000.000 (Ví dụ: 2 củ = 2000000)
- chục (đứng một mình) -> x 10.000 (Ví dụ: 5 chục = 50000)
- chục củ/triệu -> x 10.000.000 (Ví dụ: 2 chục củ = 20000000)

QUY TẮC BÓC TÁCH:
- ma_bp: Bắt buộc phải trích xuất được TÊN NGƯỜI / TỔ CHỨC. Nếu KHÔNG tìm thấy tên, trả về JSON với key "error": "MissingPartner". TUYỆT ĐỐI KHÔNG trả "ma_bp": "" hoặc "-".
- so_tien: Bắt buộc là SỐ NGUYÊN (Integer). Nếu không tìm thấy số tiền, trả về JSON với key "error": "MissingAmount".
- ghi_chu: Giữ nguyên văn hoặc tóm tắt ngắn.
- ngay: Trả về YYYY-MM-DD. (Hôm nay là: ${new Date().toISOString().split('T')[0]})

ĐẦU VÀO TỪ USER: "${message}"${contextText}

TRẢ VỀ DUY NHẤT 1 CHUỖI JSON THEO CẤU TRÚC:
{
  "sub_type": "${sub_type}",
  "ma_bp": "Tùng",
  "so_tien": 500000,
  "ghi_chu": "Vay tiền",
  "ngay": "2026-06-05"
}

HOẶC NẾU LỖI:
{
  "error": "MissingPartner"
}`;

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) throw new Error("Hệ thống AI đang quá tải (DeepSeek), vui lòng thử lại sau.");

    const data = await res.json();
    try {
      return JSON.parse(data.choices[0].message.content) as DebtResult;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      throw new Error("Dữ liệu AI trả về bị lỗi định dạng (Debt).");
    }
  } catch (error: any) {
    console.error("Debt Error:", error);
    if (error.message && (error.message.includes("Hệ thống AI") || error.message.includes("Dữ liệu AI"))) {
      throw error;
    }
    throw new Error("Hệ thống AI đang quá tải, vui lòng thử lại sau.");
  }
}
