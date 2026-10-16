/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Trophy, Volume2, VolumeX, Eye, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { audioManager } from '../utils/audioManager';
import { useState, useEffect } from 'react';
import { DebugOverlay } from './DebugOverlay';

export function UI() {
  const { 
    gameState, playerId, joinGame, socket, selectedColor, setSelectedColor,
    spectatingPlayerId, setSpectatingPlayerId, cycleSpectator, ping, toggleDebug
  } = useGameStore();
  const [isMuted, setIsMuted] = useState(audioManager.getMuted());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const COLORS = [
    '#ff7eb3', // vibrant pink
    '#ffb86c', // vibrant orange
    '#f1fa8c', // vibrant yellow
    '#50fa7b', // vibrant green
    '#8be9fd', // vibrant blue
    '#bd93f9', // vibrant purple
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        toggleDebug();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDebug]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => setConnectionStatus('connected');
    const onDisconnect = () => setConnectionStatus('connecting');
    const onError = () => setConnectionStatus('error');

    if (socket.connected) setConnectionStatus('connected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
    };
  }, [socket]);

  const player = playerId && gameState ? gameState.players[playerId] : null;
  const isAlive = player?.state === 'alive';
  const isDead = player?.state === 'dead';

  const spectatingPlayer = spectatingPlayerId && gameState ? gameState.players[spectatingPlayerId] : null;

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleJoin = () => {
    audioManager.init();
    joinGame();
  };

  const toggleMute = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  };

  const startSpectating = () => {
    if (!gameState) return;
    const alivePlayers = Object.values(gameState.players).filter(p => p.state === 'alive');
    if (alivePlayers.length > 0) {
      setSpectatingPlayerId(alivePlayers[0].id);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 overflow-hidden">
      <DebugOverlay />
      
      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto relative">
        <div className="flex flex-col gap-2 z-10">
          <h1 className="text-3xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
            NEON.SNAKE
          </h1>
          {isAlive && (
            <div className="flex flex-col gap-1">
              <div className="text-xl font-mono text-white/80 font-bold">
                Length: {Math.floor(player.score)}
              </div>
              <div className="flex gap-2">
                {player.activeEffects?.speedBoost && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded italic tracking-tighter"
                    style={{ boxShadow: '0 0 10px #ffffff' }}
                  >
                    SPEED BOOST
                  </motion.div>
                )}
                {player.activeEffects?.invincible && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded italic tracking-tighter"
                    style={{ boxShadow: '0 0 10px #f1fa8c' }}
                  >
                    INVINCIBLE
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {spectatingPlayerId && spectatingPlayer && !isAlive && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                <Eye size={12} /> Spectating
              </div>
              <div className="text-xl font-bold" style={{ color: spectatingPlayer.color }}>
                {spectatingPlayer.name}
              </div>
              <div className="text-sm font-mono text-white/60">
                Length: {Math.floor(spectatingPlayer.score)}
              </div>
            </div>
          )}
        </div>
        
        {/* Controls Hint */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 flex gap-2 opacity-80 pointer-events-none hidden sm:flex">
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">A</span>
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">D</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Turn</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">SPACE</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Boost</span>
          </div>
        </div>

        <div className="flex gap-2 z-10">
          <button
            onClick={toggleDebug}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-bold transition-colors"
            title="Toggle Debug (F3)"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={toggleMute}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-bold transition-colors"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-bold transition-colors"
          >
            <ExternalLink size={16} />
            <span>New Tab</span>
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      {gameState && gameState.leaderboard.length > 0 && (
        <div className="absolute top-20 right-4 w-64 bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 pointer-events-auto shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <div className="flex items-center gap-2 mb-4 text-white/80 font-semibold border-b border-white/5 pb-2">
            <Trophy size={18} className="text-yellow-400" />
            <h2 className="tracking-widest text-xs font-black">LEADERBOARD</h2>
          </div>
          <div className="flex flex-col gap-2">
            {gameState.leaderboard.map((entry, i) => (
              <div key={entry.id} className={`flex justify-between items-center text-sm ${entry.id === playerId ? 'bg-white/10 -mx-2 px-2 py-1 rounded-lg border border-white/10' : ''}`}>
                <div className="flex items-center gap-2 truncate">
                  <span className="text-white/20 w-4 font-mono text-[10px]">{i + 1}</span>
                  <span style={{ color: entry.color, textShadow: `0 0 8px ${entry.color}44` }} className="font-bold truncate max-w-[120px]">
                    {entry.name}
                  </span>
                </div>
                <span className="font-mono text-white/80 font-bold">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spectator Controls */}
      {spectatingPlayerId && !isAlive && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
          <button onClick={() => cycleSpectator(-1)} className="text-white hover:text-blue-400 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="text-xs font-bold text-white uppercase tracking-widest w-32 text-center">
            Spectating Mode
          </div>
          <button onClick={() => cycleSpectator(1)} className="text-white hover:text-blue-400 transition-colors">
            <ChevronRight size={24} />
          </button>
        </div>
      )}

      {/* Menus */}
      <AnimatePresence>
        {(!player || isDead) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-zinc-900/90 p-8 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full flex flex-col items-center gap-6">
              {isDead && (
                <div className="text-center">
                  <h2 className="text-4xl font-black text-red-500 mb-2">YOU DIED</h2>
                  <p className="text-white/60">Final Length: {Math.floor(player.score)}</p>
                </div>
              )}
              
              {!isDead && (
                <div className="text-center">
                  <h2 className="text-3xl font-black text-white mb-2">JOIN ARENA</h2>
                  <p className="text-white/60 text-sm">Steer with A/D or Left/Right. Space to boost.</p>
                </div>
              )}

              <div className="flex flex-col items-center gap-3 w-full">
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Select Neon Glow</span>
                <div className="flex gap-3">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor === color ? 'border-white scale-125' : 'border-transparent opacity-50 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color, boxShadow: selectedColor === color ? `0 0 15px ${color}` : 'none' }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={handleJoin}
                  disabled={connectionStatus !== 'connected'}
                  className={`w-full py-4 font-bold rounded-xl transition-colors active:scale-95 ${
                    connectionStatus === 'connected' 
                      ? 'bg-white text-black hover:bg-gray-200' 
                      : 'bg-white/10 text-white/50 cursor-not-allowed'
                  }`}
                >
                  {connectionStatus === 'connecting' ? 'CONNECTING...' : 
                   connectionStatus === 'error' ? 'CONNECTION ERROR' :
                   isDead ? 'RESPAWN' : 'PLAY'}
                </button>
                
                {isDead && (
                  <button
                    onClick={startSpectating}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-colors"
                  >
                    SPECTATE SURVIVORS
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
