import { LLM } from "llama-node";
import { LLamaCpp } from "llama-node/dist/llm/llama-cpp.js";
import path from "path";
import fs from "fs";

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

interface LlamaConfig {
  modelPath: string;
  enableLogging: boolean;
  nCtx: number;
  seed: number;
  f16Kv: boolean;
  logitsAll: boolean;
  vocabOnly: boolean;
  useMlock: boolean;
  embedding: boolean;
  useMmap: boolean;
  nGpuLayers: number;
}

class LlamaService {
  private llama: LLM | null = null;
  private modelLoaded = false;
  private config: LlamaConfig;
  private modelPath: string;

  constructor() {
    // Default model path - can be overridden
    this.modelPath = path.resolve(process.cwd(), "models", "llama-model.gguf");
    
    this.config = {
      modelPath: this.modelPath,
      enableLogging: false,
      nCtx: 2048,
      seed: 0,
      f16Kv: false,
      logitsAll: false,
      vocabOnly: false,
      useMlock: false,
      embedding: false,
      useMmap: true,
      nGpuLayers: 0, // Set to 0 for CPU-only, increase for GPU acceleration
    };

    this.initializeLlama();
  }

  private async initializeLlama() {
    try {
      this.llama = new LLM(LLamaCpp);
      
      // Check if model file exists
      if (!fs.existsSync(this.modelPath)) {
        console.warn(`Model file not found at ${this.modelPath}. Please download a GGUF model file.`);
        return;
      }

      await this.llama.load(this.config);
      this.modelLoaded = true;
      console.log("Llama model loaded successfully");
    } catch (error) {
      console.error("Failed to initialize Llama:", error);
      this.modelLoaded = false;
    }
  }

  public async chatWithAssistant(
    message: string, 
    history: { role: string; parts: { text: string }[] }[] = [], 
    language: string = 'English'
  ): Promise<string> {
    if (!this.modelLoaded || !this.llama) {
      return "I am currently initializing. Please wait a moment or ensure you have downloaded the required model file.";
    }

    try {
      // Build conversation history
      let conversation = SYSTEM_INSTRUCTION + "\n\n";
      conversation += `CRITICAL: You MUST respond in ${language}.\n\n`;
      
      // Add history
      history.forEach((item) => {
        if (item.role === "user") {
          conversation += `USER: ${item.parts[0].text}\n`;
        } else if (item.role === "assistant") {
          conversation += `ASSISTANT: ${item.parts[0].text}\n`;
        }
      });
      
      // Add current message
      conversation += `USER: ${message}\nASSISTANT:`;

      return new Promise((resolve, reject) => {
        let response = "";
        
        this.llama!.createCompletion({
          nThreads: 4,
          nTokPredict: 512, // Limit response length
          topK: 40,
          topP: 0.9,
          temp: 0.7,
          repeatPenalty: 1.1,
          prompt: conversation,
        }, (chunk) => {
          if (chunk.token) {
            response += chunk.token;
          }
        }).then(() => {
          // Clean up the response
          response = response.trim();
          
          // Stop at common completion markers
          const stopMarkers = ["USER:", "ASSISTANT:", "\n\n"];
          for (const marker of stopMarkers) {
            const index = response.indexOf(marker);
            if (index !== -1) {
              response = response.substring(0, index).trim();
            }
          }
          
          resolve(response || "I apologize, but I couldn't generate a response. Let me connect you with our support team.");
        }).catch((error) => {
          console.error("Llama generation error:", error);
          reject(error);
        });
      });
    } catch (error) {
      console.error("Error in Llama chat:", error);
      return "I am experiencing technical difficulties. Let me connect you with our support team.";
    }
  }

  public isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  public getModelPath(): string {
    return this.modelPath;
  }

  public setModelPath(modelPath: string): void {
    this.modelPath = modelPath;
    this.config.modelPath = modelPath;
    this.modelLoaded = false;
    this.initializeLlama(); // Reinitialize with new model path
  }
}

// Singleton instance
const llamaService = new LlamaService();

export async function chatWithAssistant(
  message: string, 
  history: { role: string; parts: { text: string }[] }[] = [], 
  language: string = 'English'
): Promise<string> {
  return llamaService.chatWithAssistant(message, history, language);
}

export { llamaService };
export default llamaService;
