import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are the official AI assistant of Ranbidge Solutions Private Limited. 
Your responsibilities:
- Answer customer queries about Ranbidge Solutions' services, pricing, products, and support.
- Maintain a professional and helpful tone.
- Keep answers short and clear (maximum 5 sentences).
- Encourage users to contact support for complex issues.
- Never provide false information.
- If unsure, say: "Let me connect you with our support team."
- If the user says "Ranbuu", acknowledge it as your wake command and greet them warmly as the Ranbidge Solutions assistant.
- When suggesting support, you can mention that they can chat on WhatsApp or make a call directly.

CRITICAL: Always respond in plain text suitable for voice output. 
Do not use emojis, markdown formatting (no bold, no italics, no lists), or special characters. 
The output should be a single block of clean text.`;

export async function chatWithAssistant(message: string, history: { role: string, parts: { text: string }[] }[] = [], language: string = 'English') {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const languageInstruction = `CRITICAL: You MUST respond in ${language}.`;
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history,
          { role: "user", parts: [{ text: message }] }
        ],
        config: {
          systemInstruction: `${SYSTEM_INSTRUCTION}\n${languageInstruction}`,
          temperature: 0.7,
          topP: 0.95,
        },
      });

      return response.text || "I apologize, but I am unable to process your request at this time. Let me connect you with our support team.";
    } catch (error: any) {
      console.error(`Gemini API Attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      // If it's the last attempt, don't wait
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  console.error("Gemini API Error after retries:", lastError);
  return "I am experiencing technical difficulties. Let me connect you with our support team.";
}
