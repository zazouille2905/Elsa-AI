/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Linkedin, Mail, Info, Languages } from 'lucide-react';
import { VoiceVisualizer } from './components/VoiceVisualizer';

// --- ELSA'S KNOWLEDGE BASE ---
const ELSA_KNOWLEDGE = `
Identity: Elsa Planes, Marketing & Communication specialist.
Current Status: Seeking CDD/CDI from late 2026.
Education: 
- Master’s in Marketing Grande Consommation at ESCE Paris (Expected graduation 2026).
- 6 months Erasmus at UEM Madrid (2023).
- Baccalauréat with honors (2021) from Lycée Jean-Paul Vernant.

Experience:
- Polyworks Europa (Apprenticeship since Oct 2025): Digital strategy, LinkedIn SEO/ROI, Content creation, Video production for trade shows in France and Italy, CSR support.
- Stellantis (2024-2025): Assistant Press Attaché. Media relations, press releases, media coverage analysis.
- Agence Marketing Bespoke (2023): Assistant Project Manager (6-month internship). 360° marketing projects, freelance coordination, benchmarking.
- Paris 2024 Olympics: Cashier at fan zones (Trocadéro, Roland Garros).
- Riviera Fuga, Paris (Since May 2024): Restaurant hostess.
- Fédération Rooftop (2021-2023): Head of Sponsoring & Logistics.

Skills:
- AI Tools: ChatGPT, Gemini, Copilot.
- Creative: Canva.
- Office: Excel, Word, PowerPoint.
- Languages: French (Native), English (Bilingual), Italian (Advanced), Spanish (Beginner).

Interests: Dance, Rugby, Motorsport, Fashion/Trends, Events, Music.

Contact:
- Email: elsa.planes@free.fr
- LinkedIn: @elsa-planes
- Phone: 07.68.64.45.60

Rules:
1. Introduction: Always start with: "I am Elsa assistant, how can I help you? / Je suis l'assistant d'Elsa, comment puis-je vous aider ?"
2. Persona: Professional, sleek, and proactive.
3. Capabilities: Answer any question about Elsa's professional background, skills, and availability using the provided data.
4. If a question is unknown, politely direct the user to contact Elsa via LinkedIn or email (elsa.planes@free.fr).
5. Language: Fully bilingual (English/French). Always reply in the language used by the user.
`;

const SYSTEM_INSTRUCTION = `You are Zaza, a dedicated personal AI assistant for Elsa Planes. 
${ELSA_KNOWLEDGE}
You are interacting via a low-latency voice API. Keep your responses concise and conversational.
`;

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  // Helper to convert ArrayBuffer to Base64 safely
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Initialize Audio Context
  const initAudio = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  // Play audio chunks
  const playNextChunk = useCallback(() => {
    if (audioQueue.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const chunk = audioQueue.current.shift()!;
    
    const buffer = audioContextRef.current.createBuffer(1, chunk.length, 16000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < chunk.length; i++) {
      channelData[i] = chunk[i] / 32768;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextChunk();
    };
    source.start();
  }, []);

  const stopSession = () => {
    setIsActive(false);
    setIsSpeaking(false);
    setMicLevel(0);
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    audioQueue.current = [];
    isPlayingRef.current = false;
  };

  const startSession = async () => {
    try {
      setError(null);
      await initAudio();

      // Request Microphone early to catch permission errors
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            console.log("Zaza session active");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const binaryString = atob(part.inlineData.data);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const int16Array = new Int16Array(bytes.buffer);
                  audioQueue.current.push(int16Array);
                  if (!isPlayingRef.current) playNextChunk();
                }
              }
            }
            
            if (message.serverContent?.interrupted) {
              audioQueue.current = [];
              isPlayingRef.current = false;
              setIsSpeaking(false);
              if (audioContextRef.current) {
                // Optional: stop current playback if needed
              }
            }
          },
          onerror: (err) => {
            console.error("Zaza Connection Error:", err);
            setError("Connection lost. Please try again.");
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        }
      });

      sessionRef.current = session;

      // Setup Audio Processing
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current || !isActive) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setMicLevel(Math.min(1, rms * 5)); // Boost for visibility

        // Convert to Int16 for Gemini
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
        }
        
        const base64Data = arrayBufferToBase64(int16Data.buffer);
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      processor.connect(audioContextRef.current!.destination);
      processorRef.current = processor;

    } catch (err: any) {
      console.error("Zaza Startup Error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Microphone access denied. Please enable it in your browser.");
      } else {
        setError("Could not start Zaza. Check your connection.");
      }
      stopSession();
    }
  };

  const toggleSession = () => {
    if (isActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0508] text-pink-50 font-sans selection:bg-pink-500/30 overflow-hidden flex flex-col">
      {/* Background Aesthetic */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-900/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-8 flex justify-between items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          <h1 className="text-2xl font-light tracking-widest uppercase text-pink-200">
            Zaza <span className="text-pink-500 font-medium">AI</span>
          </h1>
          <p className="text-[10px] tracking-[0.3em] uppercase opacity-50 text-pink-300">
            Assistant for Elsa Planes
          </p>
        </motion.div>

        <div className="flex gap-4">
          <a href="mailto:elsa.planes@free.fr" className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-pink-500/20 transition-colors">
            <Mail size={18} className="text-pink-300" />
          </a>
          <a href="https://linkedin.com/in/elsa-planes" target="_blank" rel="noreferrer" className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-pink-500/20 transition-colors">
            <Linkedin size={18} className="text-pink-300" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-8">
          
          {/* Visualizer Area */}
          <div className="relative">
            <VoiceVisualizer isActive={isActive} isSpeaking={isSpeaking} micLevel={micLevel} />
            
            <AnimatePresence>
              {!isActive && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <p className="text-pink-200/60 text-sm font-light italic px-8">
                    "I am Elsa assistant, how can I help you? / Je suis l'assistant d'Elsa, comment puis-je vous aider ?"
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Interaction Button */}
          <div className="flex flex-col items-center gap-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleSession}
              className={`relative group w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 ${
                isActive 
                  ? 'bg-pink-600 shadow-[0_0_50px_rgba(219,39,119,0.5)]' 
                  : 'bg-white/5 border border-white/10 hover:border-pink-500/50'
              }`}
            >
              <div className={`absolute inset-0 rounded-full bg-pink-500 opacity-0 group-hover:opacity-10 transition-opacity ${isActive ? 'animate-pulse opacity-20' : ''}`} />
              {isActive ? (
                <MicOff size={36} className="text-white" />
              ) : (
                <Mic size={36} className="text-pink-400 group-hover:text-pink-300" />
              )}
            </motion.button>

            <div className="space-y-3">
              <p className={`text-xs uppercase tracking-[0.2em] transition-colors duration-300 ${isActive ? 'text-pink-400 font-bold' : 'text-pink-200/40'}`}>
                {isActive ? 'Zaza is listening...' : 'Tap the mic to talk to Zaza'}
              </p>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] text-red-400 bg-red-400/10 px-4 py-2 rounded-xl border border-red-400/20 max-w-xs mx-auto"
                >
                  {error}
                </motion.p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info / Glassmorphism Card */}
      <footer className="relative z-10 p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto backdrop-blur-2xl bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col md:flex-row gap-6 items-center shadow-2xl"
        >
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-pink-500/30 flex-shrink-0 relative group">
            <img 
              src="https://picsum.photos/seed/elsa/200/200" 
              alt="Elsa Planes" 
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-pink-500/10 group-hover:bg-transparent transition-colors" />
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-pink-100 font-medium text-lg">Elsa Planes</h3>
            <p className="text-xs text-pink-400/80 mb-3 font-light tracking-wide">Marketing & Communication Specialist</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <span className="text-[9px] px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 uppercase tracking-wider">ESCE Paris 2026</span>
              <span className="text-[9px] px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 uppercase tracking-wider">Bilingual EN/FR</span>
              <span className="text-[9px] px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 uppercase tracking-wider">Seeking CDI/CDD</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-[10px] text-pink-400/60 uppercase tracking-[0.2em] font-medium">
              <Languages size={14} />
              <span>FR / EN / IT</span>
            </div>
          </div>
        </motion.div>
        
        <p className="text-center mt-8 text-[8px] uppercase tracking-[0.5em] text-pink-500/20">
          Futuristic Voice Interface • Powered by Gemini Live
        </p>
      </footer>
    </div>
  );
}
