import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function ocrWrongQuestion(imageBase64: string, mimeType: string) {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    你是一个全科错题学习专家。你的任务是深度分析图片中的错题并进行 OCR 识别。

    1. OCR 识别：识别题目文本、选项、答案及解析。如果题目包含数学公式，请使用标准的 LaTeX 格式（包裹在 $ ... $ 或 $$ ... $$ 中）。
    2. 知识点提取：判断题目核心知识点（如：“一元二次方程根的判别式”、“欧姆定律”）。
    3. 易错点分析：在解析中，必须包含一个名为“易错分析”的部分。请在该部分中使用 Markdown 的 **加粗** 或 \`代码块\` 语法来突出显示“关键词”和“核心误区”。
    4. 返回格式：严格的 JSON。
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      originalQuestion: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          answer: { type: Type.STRING },
          analysis: { type: Type.STRING }
        },
        required: ["content", "answer", "analysis"]
      },
      knowledgePoint: { type: Type.STRING }
    },
    required: ["originalQuestion", "knowledgePoint"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: "请识别这张图片中的错题内容、答案及解析，并提取其核心知识点。" }
        ]
      }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    }
  });

  if (!response.text) {
    throw new Error("AI 响应为空");
  }

  return JSON.parse(response.text);
}

export async function generateSimilarQuestions(knowledgePoint: string, originalQuestion: any) {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    你是一个全科错题学习专家。基于给定的知识点和原题，生成 3 道高质量的变式题。
    要求：
    1. 包含“答案”和“详细解析”。
    2. 解析中必须包含“易错分析”部分，使用 **加粗** 突出关键词。
    3. 支持 LaTeX 数学公式。
    4. 返回格式：JSON。
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      similarQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            answer: { type: Type.STRING },
            analysis: { type: Type.STRING }
          },
          required: ["content", "answer", "analysis"]
        }
      }
    },
    required: ["similarQuestions"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: `请基于知识点 '${knowledgePoint}' 和原题 '${originalQuestion.content}' 生成 3 道变式题。`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    }
  });

  return JSON.parse(response.text || "{}");
}
