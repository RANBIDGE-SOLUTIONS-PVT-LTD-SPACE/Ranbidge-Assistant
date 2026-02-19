import express from 'express';
import cors from 'cors';
import path from 'path';
import { llamaService } from '../src/services/llama.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    modelLoaded: llamaService.isModelLoaded(),
    modelPath: llamaService.getModelPath()
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message, history = [], language = 'English' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await llamaService.chatWithAssistant(message, history, language);
    
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
});

// Model management endpoints
app.get('/models', async (req, res) => {
  try {
    const { modelManager } = await import('../src/services/modelManager.js');
    const models = modelManager.getRecommendedModels();
    const downloaded = modelManager.getDownloadedModels();
    
    res.json({ 
      recommended: models,
      downloaded: downloaded.map(filename => ({
        filename,
        size: modelManager.getModelSize(filename)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get model info' });
  }
});

app.post('/models/download', async (req, res) => {
  try {
    const { modelUrl, filename } = req.body;
    
    if (!modelUrl || !filename) {
      return res.status(400).json({ error: 'Model URL and filename are required' });
    }

    const { modelManager } = await import('../src/services/modelManager.js');
    
    // Find model info
    const model = modelManager.getRecommendedModels().find(m => m.filename === filename);
    if (!model) {
      return res.status(404).json({ error: 'Model not found in recommended list' });
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Start download
    modelManager.downloadModel(model, (progress) => {
      // Send progress via Server-Sent Events
      res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    }).then((modelPath) => {
      res.write(`data: ${JSON.stringify({ complete: true, modelPath })}\n\n`);
      res.end();
    }).catch((error) => {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download model' });
    }
  }
});

app.delete('/models/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { modelManager } = await import('../src/services/modelManager.js');
    
    const success = modelManager.deleteModel(filename);
    
    if (success) {
      res.json({ message: 'Model deleted successfully' });
    } else {
      res.status(404).json({ error: 'Model not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Llama server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Chat endpoint: http://localhost:${PORT}/chat`);
});
