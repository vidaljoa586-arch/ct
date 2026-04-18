import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function processWrongQuestion(imageBase64: string, mimeType: string) {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    你是一个全科错题学习助手。你的任务是分析图片中的错题。
    1. 识别图片中的核心题目文本、选项、原答案和解析（如果有）。
    2. 判断题目所属的核心知识点（例如“勾股定理”、“定语从句”）。
    3. 基于该核心知识点，生成3道“举一反三”的变式题。
    4. 每道变式题必须包含：题目内容、标准答案、以及侧重“易错点分析”的详细解析。
    5. 返回格式必须是严格的 JSON。
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
        required: ["content"]
      },
      knowledgePoint: { type: Type.STRING },
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
    required: ["originalQuestion", "knowledgePoint", "similarQuestions"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: "请识别这张图片中的错题，提取知识点并生成3道举一反三的题目。" }
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

export async function regenerateSimilarQuestions(knowledgePoint: string, originalQuestion: any) {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    你是一个全科错题学习助手。基于给定的知识点和原题，重新生成3道不同的“举一反三”变式题。
    每道题包含：题目、答案、侧重易错点的解析。
    返回格式：JSON。
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
    contents: `请基于知识点 '${knowledgePoint}' 和原题 '${originalQuestion.content}' 重新生成3道变式题。`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    }
  });

  return JSON.parse(response.text || "{}");
}
