import React, { useState, useEffect } from 'react';
import { Download, Trash2, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { llamaClient, ModelInfo } from '../services/llamaClient';

interface ModelManagerProps {
  onModelReady: () => void;
}

export const ModelManager: React.FC<ModelManagerProps> = ({ onModelReady }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    loadModels();
    checkHealth();
  }, []);

  const loadModels = async () => {
    try {
      const response = await llamaClient.getModels();
      setModels(response.recommended);
      setDownloadedModels(response.downloaded.map(m => m.filename));
    } catch (err) {
      setError('Failed to load models');
      console.error(err);
    }
  };

  const checkHealth = async () => {
    try {
      const healthData = await llamaClient.getHealth();
      setHealth(healthData);
      if (healthData.modelLoaded) {
        onModelReady();
      }
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  const downloadModel = async (model: ModelInfo) => {
    setDownloading(model.filename);
    setDownloadProgress(0);
    setError('');

    try {
      await llamaClient.downloadModel(model.url, model.filename, (progress) => {
        setDownloadProgress(progress);
      });
      
      await loadModels();
      await checkHealth();
      onModelReady();
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloading('');
      setDownloadProgress(0);
    }
  };

  const deleteModel = async (filename: string) => {
    try {
      await llamaClient.deleteModel(filename);
      await loadModels();
      await checkHealth();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  if (health?.modelLoaded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Model Ready</span>
        </div>
        <p className="text-green-600 text-sm mt-1">
          Offline Llama model is loaded and ready to use.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Model Setup</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {models.map((model) => {
          const isDownloaded = downloadedModels.includes(model.filename);
          const isCurrentlyDownloading = downloading === model.filename;

          return (
            <div key={model.filename} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{model.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>Size: {model.size}</span>
                    {isDownloaded && (
                      <span className="text-green-600 font-medium">✓ Downloaded</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {isDownloaded ? (
                    <button
                      onClick={() => deleteModel(model.filename)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete model"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => downloadModel(model)}
                      disabled={isCurrentlyDownloading}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isCurrentlyDownloading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{downloadProgress}%</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              
              {isCurrentlyDownloading && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Getting Started</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Download one of the recommended models above</li>
          <li>Wait for the download to complete</li>
          <li>The model will load automatically and be ready to use</li>
        </ol>
        <p className="text-xs text-blue-700 mt-2">
          Models are stored locally and work completely offline.
        </p>
      </div>
    </div>
  );
};
