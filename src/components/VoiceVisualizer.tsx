import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  micLevel?: number;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isActive, isSpeaking, micLevel = 0 }) => {
  return (
    <div className="relative flex items-center justify-center h-64 w-full">
      {/* Background Glow */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.3, 1] : 1,
          opacity: isActive ? [0.2, 0.4, 0.2] : 0.1,
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-80 h-80 bg-pink-500/10 rounded-full blur-[100px]"
      />

      {/* Mic Level Ring (Outer) */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: 1 + (micLevel * 1.5),
              opacity: 0.1 + (micLevel * 0.5),
              borderColor: micLevel > 0.5 ? 'rgba(236, 72, 153, 0.8)' : 'rgba(236, 72, 153, 0.3)'
            }}
            className="absolute w-48 h-48 border-2 rounded-full transition-colors duration-100"
          />
        )}
      </AnimatePresence>

      {/* Dynamic Pulse Rings */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={isActive ? {
            scale: [1, 2.5],
            opacity: [0.3, 0],
          } : { scale: 1, opacity: 0 }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: i * 0.8,
            ease: "easeOut",
          }}
          className="absolute w-32 h-32 border border-pink-400/20 rounded-full"
        />
      ))}

      {/* Central Pulse Wave */}
      <div className="flex items-center justify-center gap-1.5 h-24">
        {[...Array(15)].map((_, i) => {
          // Calculate height based on either speaking (output) or micLevel (input)
          const multiplier = isSpeaking ? 40 : (isActive ? micLevel * 80 : 0);
          const baseHeight = 6;
          
          return (
            <motion.div
              key={i}
              animate={{
                height: isActive || isSpeaking 
                  ? [baseHeight, Math.max(baseHeight, Math.random() * multiplier + baseHeight), baseHeight] 
                  : baseHeight,
                backgroundColor: isSpeaking ? '#ec4899' : (isActive && micLevel > 0.1 ? '#f472b6' : '#db2777'),
              }}
              transition={{
                duration: 0.2,
                repeat: Infinity,
                delay: i * 0.03,
              }}
              className="w-1.5 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.4)]"
            />
          );
        })}
      </div>
    </div>
  );
};
