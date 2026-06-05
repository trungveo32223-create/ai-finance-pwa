import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Lấy API Keys từ biến môi trường
const GROQ_KEYS = [process.env.GROQ_KEY_1, process.env.GROQ_KEY_2].filter(Boolean);
const DEEPSEEK_KEYS = [process.env.DEEPSEEK_KEY_1, process.env.DEEPSEEK_KEY_2].filter(Boolean);
const GEMINI_KEYS = [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2].filter(Boolean);

let groqIndex = 0;
let deepseekIndex = 0;

// Hàm xoay vòng API Key (Load Balancing)
const getGroqKey = () => {
  const key = GROQ_KEYS[groqIndex];
  groqIndex = (groqIndex + 1) % GROQ_KEYS.length;
  return key;
};

const getDeepSeekKey = () => {
  const key = DEEPSEEK_KEYS[deepseekIndex];
  deepseekIndex = (deepseekIndex + 1) % DEEPSEEK_KEYS.length;
  return key;
};

// Hàm gọi Groq (Agent_Router)
async function callGroqRouter(text: string) {
  const prompt = `Phân tích câu giao dịch sau và trả về MỘT TỪ DUY NHẤT đại diện cho Intent (Mục đích).
Các Intent hợp lệ:
1. "Standard" (Thu nhập/Chi tiêu thông thường: ăn uống, lương, mua sắm...)
2. "Borrow" (Mình đi vay tiền người khác)
3. "Lend" (Mình cho người khác vay tiền)
4. "Repay" (Mình mang tiền đi trả nợ người ta)
5. "Collect" (Người ta mang tiền đến trả nợ mình)
6. "Query" (Hỏi số dư, tra cứu báo cáo)

Câu giao dịch: "${text}"
Chỉ trả về 1 từ tiếng Anh thuộc list trên, không giải thích.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getGroqKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 10
    })
  });
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// Hàm gọi DeepSeek (Agent_Worker)
async function callDeepSeekWorker(text: string, intent: string) {
  let sysPrompt = "";
  if (intent === "Borrow") {
    sysPrompt = "Nhiệm vụ: Trích xuất số tiền và tên chủ nợ từ câu. Bạn là người đi vay. Output JSON: { \"PhanLoai\": \"Vay\", \"Lv1\": \"Vay\", \"Lv2\": \"Vay\", \"so_tien\": number, \"ma_bp\": \"Tên người\" }";
  } else if (intent === "Lend") {
    sysPrompt = "Nhiệm vụ: Trích xuất số tiền và tên con nợ. Bạn cho người khác vay. Output JSON: { \"PhanLoai\": \"Cho vay\", \"Lv1\": \"Cho vay\", \"Lv2\": \"Cho vay\", \"so_tien\": number, \"ma_bp\": \"Tên người\" }";
  } else {
    sysPrompt = "Nhiệm vụ: Trích xuất số tiền và danh mục. Output JSON: { \"PhanLoai\": \"Chi phí\", \"Lv1\": \"Ăn uống\", \"Lv2\": \"Ăn uống\", \"so_tien\": number, \"ghi_chu\": \"Trích xuất từ câu\" }";
  }

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getDeepSeekKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })
  });
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // 1. Kích hoạt Router (Groq)
    const intent = await callGroqRouter(message);
    console.log("Intent detected:", intent);

    // 2. Kích hoạt Worker tương ứng (DeepSeek)
    let parsedData: any = {};
    if (["Borrow", "Lend", "Standard", "Repay", "Collect"].includes(intent)) {
       parsedData = await callDeepSeekWorker(message, intent);
    } else {
       return NextResponse.json({ reply: "Xin lỗi, em chưa hỗ trợ tính năng tra cứu (Query) ở bản Prototype này." });
    }

    // 3. Ghi vào Supabase
    const { error } = await supabase.from('transactions').insert({
      tx_date: new Date().toISOString().split('T')[0],
      phan_loai: parsedData.PhanLoai || 'Chưa rõ',
      lv1: parsedData.Lv1 || 'Chưa rõ',
      lv2: parsedData.Lv2 || 'Chưa rõ',
      so_tien: parsedData.so_tien || 0,
      ghi_chu: parsedData.ghi_chu || message,
      ma_bp: parsedData.ma_bp || null,
      raw_text: message
    });

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ reply: `❌ Lỗi lưu dữ liệu: ${error.message}` });
    }

    // 4. Trả lời User
    const replyText = `✅ Đã lưu thành công!\n- Loại: ${parsedData.PhanLoai} > ${parsedData.Lv2}\n- Số tiền: ${new Intl.NumberFormat('vi-VN').format(parsedData.so_tien)} VNĐ${parsedData.ma_bp ? `\n- Đối tác: ${parsedData.ma_bp}` : ''}`;
    
    return NextResponse.json({ reply: replyText });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ reply: `❌ Lỗi hệ thống: ${error.message}` }, { status: 500 });
  }
}
