import fs from 'fs';
import path from 'path';
import https from 'https';

interface ModelInfo {
  name: string;
  filename: string;
  url: string;
  size: string;
  description: string;
}

// Recommended lightweight models for offline use
const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    name: "Llama 3.2 1B Instruct",
    filename: "llama-3.2-1b-instruct-q4_0.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    size: "~670MB",
    description: "Small, fast model good for basic conversations"
  },
  {
    name: "Llama 3.2 3B Instruct", 
    filename: "llama-3.2-3b-instruct-q4_0.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    size: "~1.9GB",
    description: "Balanced model with better reasoning capabilities"
  },
  {
    name: "Phi-3 Mini Instruct",
    filename: "phi-3-mini-4k-instruct-q4.gguf", 
    url: "https://huggingface.co/bartowski/Phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf",
    size: "~2.2GB",
    description: "Microsoft's efficient small language model"
  }
];

class ModelManager {
  private modelsDir: string;

  constructor() {
    this.modelsDir = path.resolve(process.cwd(), "models");
    this.ensureModelsDirectory();
  }

  private ensureModelsDirectory(): void {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  public getRecommendedModels(): ModelInfo[] {
    return RECOMMENDED_MODELS;
  }

  public getDownloadedModels(): string[] {
    try {
      return fs.readdirSync(this.modelsDir)
        .filter(file => file.endsWith('.gguf'))
        .map(file => path.parse(file).name);
    } catch (error) {
      console.error('Error reading models directory:', error);
      return [];
    }
  }

  public getModelPath(filename: string): string {
    return path.join(this.modelsDir, filename);
  }

  public async downloadModel(modelInfo: ModelInfo, onProgress?: (progress: number) => void): Promise<string> {
    const modelPath = this.getModelPath(modelInfo.filename);
    
    if (fs.existsSync(modelPath)) {
      console.log(`Model ${modelInfo.filename} already exists`);
      return modelPath;
    }

    console.log(`Downloading ${modelInfo.name}...`);
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(modelPath);
      let downloadedBytes = 0;
      let totalBytes = 0;

      const request = https.get(modelInfo.url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download model: HTTP ${response.statusCode}`));
          return;
        }

        totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (onProgress && totalBytes > 0) {
            onProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`Downloaded ${modelInfo.name} successfully`);
          resolve(modelPath);
        });
      });

      request.on('error', (error) => {
        fs.unlink(modelPath, () => {}); // Delete partial file
        reject(error);
      });

      file.on('error', (error) => {
        fs.unlink(modelPath, () => {}); // Delete partial file
        reject(error);
      });
    });
  }

  public deleteModel(filename: string): boolean {
    const modelPath = this.getModelPath(filename);
    try {
      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
        console.log(`Deleted model: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting model ${filename}:`, error);
      return false;
    }
  }

  public getModelSize(filename: string): string {
    const modelPath = this.getModelPath(filename);
    try {
      if (fs.existsSync(modelPath)) {
        const stats = fs.statSync(modelPath);
        const bytes = stats.size;
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)}MB`;
      }
    } catch (error) {
      console.error(`Error getting model size for ${filename}:`, error);
    }
    return "Unknown";
  }
}

export const modelManager = new ModelManager();
export default modelManager;
