import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';

export function DebugOverlay() {
  const { ping, gameState, showDebug } = useGameStore();
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!showDebug) return;
    
    let frames = 0;
    let lastTime = performance.now();
    
    const updateFps = () => {
      frames++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        setFps(frames);
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(updateFps);
    };
    
    const frameId = requestAnimationFrame(updateFps);
    return () => cancelAnimationFrame(frameId);
  }, [showDebug]);

  if (!showDebug) return null;

  const playerCount = gameState ? Object.keys(gameState.players).length : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-24 left-4 pointer-events-auto font-mono text-[11px] text-white bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl z-50 flex flex-col gap-3 min-w-[140px]"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-1">
        <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Metrics</span>
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-white/60">FPS</span>
          <span className={`font-bold ${fps < 30 ? 'text-red-400' : fps < 55 ? 'text-yellow-400' : 'text-blue-400'}`}>
            {fps}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/60">Latency</span>
          <span className={`font-bold ${ping > 150 ? 'text-red-400' : 'text-green-400'}`}>
            {ping}ms
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/60">Players</span>
          <span className="font-bold text-white">
            {playerCount}
          </span>
        </div>
      </div>

      <div className="pt-2 mt-1 border-t border-white/10 text-[9px] text-white/30 uppercase tracking-tighter">
        Toggle with F3
      </div>
    </motion.div>
  );
}
