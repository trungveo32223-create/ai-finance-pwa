import { GoogleGenAI, Type, Schema } from '@google/genai';
import { z } from 'zod';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY_1 || '' });

// Schema chuẩn của Zod dùng để parse cuối cùng (Chống hallucination tuyệt đối)
export const NewsAnalysisZodSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  impacted_entities: z.array(z.string()),
  summary: z.string(),
});

export type NewsAnalysisResult = z.infer<typeof NewsAnalysisZodSchema>;

// Định nghĩa Schema bằng chuẩn Type của Google GenAI để ép mô hình trả về đúng cấu trúc
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sentiment: {
      type: Type.STRING,
      description: "Đánh giá mức độ tích cực hay tiêu cực của tin tức đối với nền kinh tế hoặc thị trường. Phải là một trong: positive, negative, neutral.",
    },
    impacted_entities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sách các ngành, lĩnh vực hoặc tổ chức bị ảnh hưởng chính (VD: Ngân hàng, Bất động sản, Xuất khẩu, Fed, SBV).",
    },
    summary: {
      type: Type.STRING,
      description: "Tóm tắt cốt lõi của bài báo trong đúng 1 câu duy nhất mang tính hành động hoặc phân tích.",
    },
  },
  required: ["sentiment", "impacted_entities", "summary"],
};

export async function extractNewsLogicWithGemini(title: string, rawContent: string): Promise<NewsAnalysisResult | null> {
  if (!process.env.GEMINI_KEY_1) {
    console.warn("Missing GEMINI_KEY_1");
    return null;
  }

  const prompt = `
Bạn là một chuyên gia phân tích vĩ mô (Macro Analyst). Hãy đọc tiêu đề và nội dung bài báo tài chính sau đây.
Nhiệm vụ của bạn là bóc tách thông tin và phân loại Sentiment.

Tiêu đề: ${title}
Nội dung: ${rawContent}

Chỉ trả về JSON theo đúng schema được yêu cầu. Không thêm văn bản nào khác ngoài JSON.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1, // Nhiệt độ thấp để đảm bảo tính logic và nhất quán
      }
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini");
    }

    const rawJson = JSON.parse(response.text);
    
    // Gate an toàn cuối cùng: Pass qua Zod để đảm bảo kiểu dữ liệu chuẩn 100%
    const validatedData = NewsAnalysisZodSchema.safeParse(rawJson);
    
    if (!validatedData.success) {
      console.error("Gemini trả về sai cấu trúc Zod:", validatedData.error);
      return null;
    }

    return validatedData.data;
  } catch (error) {
    console.error("Lỗi khi chạy Gemini Extractor:", error);
    return null;
  }
}
