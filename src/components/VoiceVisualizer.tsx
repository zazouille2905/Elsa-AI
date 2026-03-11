import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface VoiceVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isActive, isSpeaking }) => {
  return (
    <div className="relative flex items-center justify-center h-48 w-full">
      {/* Background Glow */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.2, 1] : 1,
          opacity: isActive ? [0.3, 0.6, 0.3] : 0.2,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-64 h-64 bg-pink-500/20 rounded-full blur-3xl"
      />

      {/* Dynamic Pulse Rings */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={isActive ? {
            scale: [1, 2],
            opacity: [0.5, 0],
          } : { scale: 1, opacity: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeOut",
          }}
          className="absolute w-32 h-32 border-2 border-pink-400/30 rounded-full"
        />
      ))}

      {/* Central Pulse Wave */}
      <div className="flex items-end justify-center gap-1 h-12">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              height: isActive || isSpeaking ? [8, Math.random() * 40 + 10, 8] : 8,
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              delay: i * 0.05,
            }}
            className="w-1.5 bg-pink-500 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.8)]"
          />
        ))}
      </div>
    </div>
  );
};
