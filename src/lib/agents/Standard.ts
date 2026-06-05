import { StandardResult, MessageContext } from './types';

const DEEPSEEK_KEYS = [process.env.DEEPSEEK_KEY_1, process.env.DEEPSEEK_KEY_2].filter(Boolean) as string[];
let currentDeepseekIndex = 0;

function getNextDeepseekKey() {
  if (DEEPSEEK_KEYS.length === 0) throw new Error('Missing DEEPSEEK_KEY');
  const key = DEEPSEEK_KEYS[currentDeepseekIndex];
  currentDeepseekIndex = (currentDeepseekIndex + 1) % DEEPSEEK_KEYS.length;
  return key;
}

export async function processStandard(message: string, contextHistory: MessageContext[] = []): Promise<StandardResult> {
  const apiKey = getNextDeepseekKey();
  
  const contextText = contextHistory.length > 0 
    ? `\nLịch sử trò chuyện gần đây:\n` + contextHistory.map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`).join('\n')
    : '';

  const prompt = `Bạn là Agent_Standard chuyên bóc tách giao dịch tài chính chung (Thu nhập, Chi phí, Tiết kiệm, Đầu tư).
GIAO DỊCH NÀY KHÔNG PHẢI LÀ CÔNG NỢ (VAY/TRẢ).

BẢNG QUY ĐỔI SỐ TIỀN (Slang):
- k, nghìn, ngàn, cành, ca -> x 1.000 (Ví dụ: 5 ca = 5000)
- xị, lít -> x 100.000 (Ví dụ: 3 xị = 300000)
- tr, triệu, chai, củ, cu -> x 1.000.000 (Ví dụ: 2 củ = 2000000)
- chục (đứng một mình) -> x 10.000 (Ví dụ: 5 chục = 50000)
- chục củ/triệu -> x 10.000.000 (Ví dụ: 2 chục củ = 20000000)

QUY TẮC BÓC TÁCH:
- phan_loai: Chỉ được chọn 1 trong: "Chi phí", "Thu nhập", "Đầu tư", "Tiết kiệm".
- lv1, lv2: Tự phân loại theo logic kế toán thông thường.
- so_tien: Bắt buộc là SỐ NGUYÊN (Integer). 
  * Lưu ý đặc biệt: Nếu là "Rút tiết kiệm", số tiền phải là SỐ ÂM (ví dụ: -5000000). Các trường hợp khác để số dương.
- ghi_chu: Giữ nguyên văn hoặc tóm tắt ngắn gọn.
- ngay: Trả về YYYY-MM-DD. Nếu không nhắc thời gian thì dùng ngày hôm nay. (Hôm nay là: ${new Date().toISOString().split('T')[0]})
- Nếu không chắc chắn về danh mục, set "danh_muc_confidence": "thap" và liệt kê "alternatives": ["Gợi ý 1", "Gợi ý 2"].

ĐẦU VÀO TỪ USER: "${message}"${contextText}

TRẢ VỀ DUY NHẤT 1 CHUỖI JSON THEO CẤU TRÚC:
{
  "phan_loai": "Chi phí",
  "lv1": "Ăn uống",
  "lv2": "Ăn sáng",
  "so_tien": 50000,
  "ghi_chu": "Ăn phở",
  "ngay": "2026-06-05",
  "danh_muc_confidence": "cao"
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

    if (!res.ok) throw new Error(`DeepSeek API error: ${res.statusText}`);

    const data = await res.json();
    return JSON.parse(data.choices[0].message.content) as StandardResult;
  } catch (error) {
    console.error("Standard Error:", error);
    throw new Error("Failed to process standard transaction");
  }
}
