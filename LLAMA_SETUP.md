# Llama Offline Integration Setup

This guide explains how to set up the offline Llama integration for your Ranbidge Solutions chatbot.

## Overview

The chatbot now uses `llama-node` with `llama-cpp` backend to run Llama models locally on your machine, eliminating the need for external API calls.

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **At least 4GB RAM** (8GB+ recommended)
3. **Storage space** for models (1-3GB per model)

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Download a Model

The chatbot needs a GGUF format model file to work. You have two options:

#### Option A: Automatic Download (Recommended)

Run the development server and use the built-in model downloader:

```bash
npm run dev
```

Then visit `http://localhost:3000` and follow the model download prompts.

#### Option B: Manual Download

1. Choose a model from the recommended list below
2. Download it manually
3. Place it in the `models/` directory

### Recommended Models

| Model | Size | Description | Download Link |
|-------|------|-------------|---------------|
| Llama 3.2 1B Instruct | ~670MB | Fast, good for basic conversations | [Download](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf) |
| Llama 3.2 3B Instruct | ~1.9GB | Better reasoning, balanced performance | [Download](https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf) |
| Phi-3 Mini Instruct | ~2.2GB | Microsoft's efficient model | [Download](https://huggingface.co/bartowski/Phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf) |

### 3. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Configuration

### Model Settings

You can adjust model performance by modifying the configuration in `src/services/llama.ts`:

```typescript
this.config = {
  modelPath: this.modelPath,
  enableLogging: false,
  nCtx: 2048,        // Context window size
  seed: 0,
  f16Kv: false,
  logitsAll: false,
  vocabOnly: false,
  useMlock: false,
  embedding: false,
  useMmap: true,
  nGpuLayers: 0,     // Set >0 for GPU acceleration
};
```

### GPU Acceleration

If you have a compatible GPU, set `nGpuLayers` to a higher value:

```typescript
nGpuLayers: 10  // Use 10 GPU layers (adjust based on your GPU memory)
```

## Troubleshooting

### Model Not Found Error

If you see "Model file not found", ensure:

1. The model file is in the `models/` directory
2. The filename matches exactly (including .gguf extension)
3. The file is completely downloaded

### Performance Issues

1. **Reduce context size**: Set `nCtx` to 1024 or lower
2. **Use smaller model**: Try the 1B model instead of 3B
3. **Enable GPU**: Set `nGpuLayers` > 0 if you have a compatible GPU

### Memory Issues

1. Use a smaller model (1B instead of 3B)
2. Close other applications
3. Reduce `nCtx` value

## Model Management

The application includes a model manager that allows you to:

- View downloaded models
- Download new models
- Delete unused models
- Switch between models

Access these features through the chat interface or by importing the `modelManager` service.

## Security Notes

- Models run locally on your machine
- No data is sent to external servers
- All processing happens offline
- Model files are stored in your project directory

## Performance Tips

1. **First Response**: The first response may be slower as the model loads
2. **Subsequent Responses**: Will be faster after initial loading
3. **CPU vs GPU**: CPU-only mode works but is slower than GPU acceleration
4. **Model Size**: Smaller models are faster but less capable

## File Structure

```
project/
├── src/
│   ├── services/
│   │   ├── llama.ts          # Llama integration service
│   │   └── modelManager.ts   # Model download/management
│   └── App.tsx               # Updated to use Llama
├── models/                   # Directory for model files
└── package.json              # Updated dependencies
```

## Switching Back to Gemini

If you need to switch back to the Gemini API:

1. Edit `src/App.tsx`:
   ```typescript
   import { chatWithAssistant } from './services/gemini';
   ```

2. Ensure your `GEMINI_API_KEY` is set in your environment

## Support

For issues with:
- **Llama integration**: Check the troubleshooting section above
- **Model downloads**: Ensure you have sufficient disk space and internet connection
- **Application errors**: Check the browser console for detailed error messages
