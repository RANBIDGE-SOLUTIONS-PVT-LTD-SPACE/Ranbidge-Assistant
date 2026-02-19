const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3001';

export interface ChatResponse {
  response: string;
}

export interface ModelInfo {
  name: string;
  filename: string;
  url: string;
  size: string;
  description: string;
}

export interface ModelsResponse {
  recommended: ModelInfo[];
  downloaded: Array<{
    filename: string;
    size: string;
  }>;
}

export interface HealthResponse {
  status: string;
  modelLoaded: boolean;
  modelPath: string;
}

class LlamaClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async chatWithAssistant(
    message: string, 
    history: { role: string; parts: { text: string }[] }[] = [], 
    language: string = 'English'
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history,
          language
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error calling chat API:', error);
      throw error;
    }
  }

  async getHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error checking health:', error);
      throw error;
    }
  }

  async getModels(): Promise<ModelsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting models:', error);
      throw error;
    }
  }

  async downloadModel(
    modelUrl: string, 
    filename: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${this.baseUrl}/models/download?modelUrl=${encodeURIComponent(modelUrl)}&filename=${encodeURIComponent(filename)}`
      );

      let modelPath = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.progress !== undefined) {
            onProgress?.(data.progress);
          }
          
          if (data.complete) {
            modelPath = data.modelPath;
            eventSource.close();
            resolve(modelPath);
          }
          
          if (data.error) {
            eventSource.close();
            reject(new Error(data.error));
          }
        } catch (error) {
          eventSource.close();
          reject(error);
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        reject(new Error('Download failed'));
      };

      // Send POST request to start download
      fetch(`${this.baseUrl}/models/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelUrl, filename })
      }).catch(reject);
    });
  }

  async deleteModel(filename: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/models/${filename}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const llamaClient = new LlamaClient();

// Export the chat function to match the original interface
export async function chatWithAssistant(
  message: string, 
  history: { role: string; parts: { text: string }[] }[] = [], 
  language: string = 'English'
): Promise<string> {
  return llamaClient.chatWithAssistant(message, history, language);
}

export default llamaClient;
