/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, Bot, Loader2, Phone, Mail, MessageSquare, Volume2, Mic, MicOff, VolumeX, Globe, ChevronDown, X, Headset, Sparkles, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { chatWithAssistant } from './services/llamaClient';
import { ModelManager } from './components/ModelManager';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const LANGUAGES = [
  { name: 'English', code: 'en-US' },
  { name: 'Spanish', code: 'es-ES' },
  { name: 'French', code: 'fr-FR' },
  { name: 'German', code: 'de-DE' },
  { name: 'Chinese', code: 'zh-CN' },
  { name: 'Japanese', code: 'ja-JP' },
  { name: 'Hindi', code: 'hi-IN' },
  { name: 'Telugu', code: 'te-IN' },
];

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: 'Hello. I am your corporate assistant. How may I help you today with our services, pricing, or support?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const [modelReady, setModelReady] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close lang menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = useCallback(async (textOverride?: string) => {
    const textToSubmit = textOverride || input.trim();
    if (!textToSubmit || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSubmit
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    transcriptRef.current = '';
    setIsLoading(true);
    setIsListening(false);
    recognitionRef.current?.stop();

    // Prepare history for API
    const history = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const responseText = await chatWithAssistant(userMessage.text, history, selectedLang.name);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: responseText
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);

    // Auto speak in agent mode or if autoSpeak is on
    if (autoSpeak || mode === 'agent') {
      speak(responseText, assistantMessage.id);
    }
  }, [input, isLoading, messages, selectedLang, autoSpeak, mode]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = selectedLang.code;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setInput(transcript);
        transcriptRef.current = transcript;
      };

      recognitionRef.current.onerror = (event: any) => {
        // Suppress 'no-speech' from console as it's a common timeout
        if (event.error !== 'no-speech') {
          console.error('Speech recognition error:', event.error);
        }
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // Auto-submit if we have a transcript
        if (transcriptRef.current.trim()) {
          handleSubmit(transcriptRef.current);
        }
      };
    }
  }, [selectedLang, handleSubmit]);

  const toggleListening = () => {
    try {
      if (isListening) {
        recognitionRef.current?.stop();
      } else {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          setIsSpeaking(null);
        }
        setInput('');
        transcriptRef.current = '';
        recognitionRef.current?.start();
        setIsListening(true);
      }
    } catch (err) {
      console.warn('Speech recognition toggle error:', err);
      setIsListening(false);
    }
  };

  const speak = useCallback((text: string, id: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedLang.code;
      
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith(selectedLang.code.split('-')[0]));
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setIsSpeaking(id);
      utterance.onend = () => {
        setIsSpeaking(null);
        // Removed auto-restart for manual control as requested
      };
      utterance.onerror = () => setIsSpeaking(null);
      window.speechSynthesis.speak(utterance);
    }
  }, [selectedLang, mode]);

  const handleModeSwitch = (newMode: 'chat' | 'agent') => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
    }
    recognitionRef.current?.stop();
    setIsListening(false);
    setMode(newMode);
    
    if (newMode === 'agent') {
      // Small delay to ensure clean state
      setTimeout(() => toggleListening(), 800);
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3 fixed top-0 left-0 right-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Bot size={18} className="sm:hidden" />
              <Bot size={22} className="hidden sm:block" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-none truncate">Ranbidge Solutions</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
                <span className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-wider truncate">
                  {mode === 'agent' ? 'Ranbuu Active' : 'Official Assistant'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => handleModeSwitch('chat')}
                className={`p-1.5 rounded-md transition-all ${
                  mode === 'chat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Chat Mode"
              >
                <MessageSquare size={16} />
              </button>
              <button
                onClick={() => handleModeSwitch('agent')}
                className={`p-1.5 rounded-md transition-all ${
                  mode === 'agent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Agent Mode"
              >
                <Headset size={16} />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden xs:block" />

            {/* Language Selector */}
            <div className="relative" ref={langMenuRef}>
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-[11px] sm:text-xs font-bold text-slate-700 bg-white"
              >
                <Globe size={14} className="text-slate-400" />
                <span className="hidden sm:inline">{selectedLang.name}</span>
                <span className="sm:hidden">{selectedLang.code.split('-')[0].toUpperCase()}</span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showLangMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="py-1">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSelectedLang(lang);
                            setShowLangMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                            selectedLang.code === lang.code 
                              ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {lang.name}
                          {selectedLang.code === lang.code && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden pt-[61px] flex flex-col">
        <AnimatePresence mode="wait">
          {mode === 'chat' ? (
            <motion.div 
              key="chat-mode"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Chat Area */}
              <main className="flex-1 overflow-y-auto p-3 sm:p-6">
                <div className="max-w-5xl mx-auto space-y-3 sm:space-y-4">
                  <AnimatePresence initial={false}>
                    {messages.map((message) => {
                      const showSupport = message.role === 'assistant' && 
                        (message.text.toLowerCase().includes('support') || 
                         message.text.toLowerCase().includes('contact') ||
                         message.text.toLowerCase().includes('whatsapp') ||
                         message.text.toLowerCase().includes('call'));

                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`flex gap-2 sm:gap-3 max-w-[90%] sm:max-w-[75%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                              message.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <div className={`p-3 sm:p-4 rounded-2xl shadow-sm ${
                                message.role === 'user' 
                                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                              }`}>
                                <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap">
                                  {message.text}
                                </p>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-2">
                                {message.role === 'assistant' && (
                                  <button 
                                    onClick={() => speak(message.text, message.id)}
                                    className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors self-start ml-1 ${
                                      isSpeaking === message.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                  >
                                    <Volume2 size={12} className={isSpeaking === message.id ? 'animate-pulse' : ''} />
                                    {isSpeaking === message.id ? 'Speaking...' : 'Listen'}
                                  </button>
                                )}

                                {showSupport && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 ml-1">
                                    <a 
                                      href="https://wa.me/918247392437" 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                                    >
                                      <MessageCircle size={12} />
                                      WhatsApp
                                    </a>
                                    <a 
                                      href="tel:+918247392437"
                                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
                                    >
                                      <Phone size={12} />
                                      Call
                                    </a>
                                    <a 
                                      href="mailto:ranbidgesolutionspvtltd@gmail.com"
                                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-700 transition-colors"
                                    >
                                      <Mail size={12} />
                                      Email
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="flex gap-3 items-center text-slate-400 ml-11">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm font-medium">Assistant is typing...</span>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </main>

              {/* Input Area */}
              <footer className="bg-white border-t border-slate-200 p-3 sm:p-4">
                <div className="max-w-5xl mx-auto">
                  <div className="flex gap-2">
                    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="relative flex-1 flex items-center">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isListening ? "Listening..." : `Type or speak in ${selectedLang.name}...`}
                        className={`w-full bg-slate-50 border rounded-2xl px-4 py-3 sm:py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm sm:text-[15px] ${
                          isListening ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'
                        }`}
                        disabled={isLoading}
                      />
                      <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-1.5 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                      >
                        <Send size={18} />
                      </button>
                    </form>
                    <button
                      onClick={toggleListening}
                      disabled={isLoading}
                      className={`p-3 sm:p-4 rounded-2xl transition-all shadow-lg ${
                        isListening 
                          ? 'bg-red-500 text-white animate-pulse shadow-red-500/20' 
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-slate-200/20'
                      }`}
                      title={isListening ? "Stop Listening" : "Start Voice Input"}
                    >
                      {isListening ? <MicOff size={20} sm:size={24} /> : <Mic size={20} sm:size={24} />}
                    </button>
                  </div>
                </div>
              </footer>
            </motion.div>
          ) : (
            <motion.div 
              key="agent-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white to-slate-50"
            >
              <div className="max-w-md w-full text-center flex flex-col items-center gap-8 sm:gap-12">
                {/* Agent Visualizer */}
                <div className="relative w-32 h-32 sm:w-40 sm:h-40">
                  <AnimatePresence>
                    {(isListening || isLoading || isSpeaking) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1.5 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 rounded-full bg-indigo-500/10" 
                      />
                    )}
                  </AnimatePresence>
                  <div className={`relative w-full h-full rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border-4 border-white ${
                    isListening ? 'bg-red-500 shadow-red-500/20' : 
                    isLoading ? 'bg-indigo-400 shadow-indigo-400/20' : 
                    isSpeaking ? 'bg-indigo-600 shadow-indigo-600/20' : 'bg-slate-900'
                  }`}>
                    {isLoading ? (
                      <Loader2 size={48} className="text-white animate-spin" />
                    ) : isListening ? (
                      <Mic size={48} className="text-white" />
                    ) : isSpeaking ? (
                      <Volume2 size={48} className="text-white animate-pulse" />
                    ) : (
                      <Headset size={48} className="text-white" />
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                    {isListening ? "I'm Listening..." : 
                     isLoading ? "Thinking..." : 
                     isSpeaking ? "Assistant is Speaking" : "Ready to Talk"}
                  </h2>
                  <p className="text-slate-500 text-sm sm:text-base font-medium">
                    {isListening ? "Go ahead, I'm all ears." : 
                     isLoading ? "Processing your request." : 
                     isSpeaking ? "Please listen to the response." : "Tap the button below to start."}
                  </p>
                </div>

                {/* Transcript Preview */}
                <div className="h-20 flex items-center justify-center w-full">
                  <AnimatePresence mode="wait">
                    {input && (
                      <motion.div 
                        key="transcript"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white border border-slate-200 px-6 py-3 rounded-2xl shadow-sm max-w-full"
                      >
                        <p className="text-slate-600 italic text-sm sm:text-base font-medium">"{input}"</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-4 w-full max-w-[280px]">
                  {isSpeaking ? (
                    <button
                      onClick={() => {
                        window.speechSynthesis.cancel();
                        setIsSpeaking(null);
                      }}
                      className="bg-red-600 text-white w-full py-4 rounded-2xl font-bold text-lg shadow-xl shadow-red-500/30 hover:bg-red-700 transition-all flex items-center justify-center gap-3"
                    >
                      <VolumeX size={20} />
                      Stop Assistant
                    </button>
                  ) : !isListening && !isLoading ? (
                    <button
                      onClick={toggleListening}
                      className="bg-indigo-600 text-white w-full py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                    >
                      <Mic size={20} />
                      Start Listening
                    </button>
                  ) : isListening ? (
                    <button
                      onClick={() => recognitionRef.current?.stop()}
                      className="bg-slate-900 text-white w-full py-4 rounded-2xl font-bold text-lg shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
                    >
                      <MicOff size={20} />
                      Stop Listening
                    </button>
                  ) : (
                    <div className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-bold text-lg flex items-center justify-center gap-3 border border-slate-200">
                      <Loader2 size={20} className="animate-spin" />
                      Processing...
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 py-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Noise Cancellation Active</span>
                  </div>

                  <button
                    onClick={() => handleModeSwitch('chat')}
                    className="mt-2 text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={12} />
                    Exit Agent Mode
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
