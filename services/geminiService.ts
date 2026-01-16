
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResponse, ErrorCategory, ErrorPriority, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeAccountingError = async (
  description: string,
  base64Image?: string
): Promise<AIAnalysisResponse> => {
  const prompt = `Bạn là một chuyên gia kế toán cao cấp am hiểu hệ thống Microsoft Dynamics 365 và Excel. 
  Hãy phân tích lỗi sau đây và trả về kết quả dưới dạng JSON.
  Mô tả lỗi: ${description}
  
  Yêu cầu:
  1. Phân loại danh mục (Hóa đơn, Thanh toán, Thuế, Sổ cái, Hệ thống, Khác).
  2. Đánh giá mức độ ưu tiên.
  3. Đưa ra gợi ý cách khắc phục cụ thể, ưu tiên các bước thao tác trên phần mềm kế toán hoặc các hàm Excel nếu cần.
  4. Đánh giá tác động tiềm tàng.`;

  const contents: any[] = [{ text: prompt }];
  if (base64Image) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            priority: { type: Type.STRING },
            suggestion: { type: Type.STRING },
            potentialImpact: { type: Type.STRING },
          },
          required: ["category", "priority", "suggestion", "potentialImpact"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      category: Object.values(ErrorCategory).includes(result.category as any) ? result.category as ErrorCategory : ErrorCategory.OTHER,
      priority: Object.values(ErrorPriority).includes(result.priority as any) ? result.priority as ErrorPriority : ErrorPriority.MEDIUM,
      suggestion: result.suggestion,
      potentialImpact: result.potentialImpact
    };
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      category: ErrorCategory.OTHER,
      priority: ErrorPriority.MEDIUM,
      suggestion: "Không thể phân tích tự động. Kiểm tra hệ thống Microsoft ERP.",
      potentialImpact: "Cần rà soát dữ liệu."
    };
  }
};

export const chatWithErrorContext = async (
  errorContext: string,
  history: ChatMessage[],
  newMessage: string
) => {
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `Bạn là trợ lý AI chuyên về kế toán và hệ sinh thái Microsoft (Excel, Dynamics 365, Power BI). 
      Hãy hỗ trợ người dùng giải quyết lỗi dựa trên bối cảnh: ${errorContext}.
      Nếu cần thiết, hãy hướng dẫn họ các hàm Excel (VLOOKUP, XLOOKUP, PivotTable) hoặc các module trong Dynamics 365 để đối chiếu dữ liệu.`,
    },
  });

  const response = await chat.sendMessage({ message: newMessage });
  return response.text;
};
