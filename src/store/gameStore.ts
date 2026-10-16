/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, Player } from '../shared/types';

interface ExplosionData {
  id: string;
  x: number;
  y: number;
  color: string;
  startTime: number;
}

interface GameStore {
  socket: Socket | null;
  gameState: GameState | null;
  playerId: string | null;
  spectatingPlayerId: string | null;
  selectedColor: string;
  explosions: ExplosionData[];
  ping: number;
  showDebug: boolean;
  connect: () => void;
  joinGame: () => void;
  sendPlayerState: (data: any) => void;
  sendCollectOrb: (orbId: string) => void;
  setSelectedColor: (color: string) => void;
  addExplosion: (x: number, y: number, color: string) => void;
  setSpectatingPlayerId: (id: string | null) => void;
  cycleSpectator: (direction: number) => void;
  toggleDebug: () => void;
}

export const globalGameState: { current: GameState | null } = { current: null };
let lastUiUpdate = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  gameState: null,
  playerId: null,
  spectatingPlayerId: null,
  selectedColor: '#8be9fd', // Default cyan
  explosions: [],
  ping: 0,
  showDebug: false,
  connect: () => {
    if (get().socket) return;
    
    const socket = io();

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      // Start ping loop
      const pingInterval = setInterval(() => {
        const start = Date.now();
        socket.emit('ping', () => {
          set({ ping: Date.now() - start });
        });
      }, 2000);
      
      socket.on('disconnect', () => clearInterval(pingInterval));
    });

    socket.on('init', (id: string) => {
      set({ playerId: id });
    });

    socket.on('state', (state: GameState) => {
      globalGameState.current = state;
      const now = Date.now();
      if (now - lastUiUpdate > 100) { // Throttle React updates to 10Hz
        set({ gameState: state });
        lastUiUpdate = now;
      }
    });

    set({ socket });
  },
  setSelectedColor: (color) => set({ selectedColor: color }),
  addExplosion: (x, y, color) => {
    const id = Math.random().toString(36).substring(7);
    set(state => ({
      explosions: [...state.explosions, { id, x, y, color, startTime: Date.now() }]
    }));
    // Auto-remove explosion after 2 seconds
    setTimeout(() => {
      set(state => ({
        explosions: state.explosions.filter(e => e.id !== id)
      }));
    }, 2000);
  },
  joinGame: () => {
    const { socket, selectedColor } = get();
    if (socket) {
      socket.emit('join', { color: selectedColor });
      set({ spectatingPlayerId: null });
    }
  },
  sendPlayerState: (data) => {
    const { socket } = get();
    if (socket) {
      socket.emit('update_state', data);
    }
  },
  sendCollectOrb: (orbId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('collect_orb', orbId);
    }
  },
  setSpectatingPlayerId: (id) => set({ spectatingPlayerId: id }),
  cycleSpectator: (direction) => {
    const { gameState, spectatingPlayerId } = get();
    if (!gameState) return;
    
    const alivePlayers = Object.values(gameState.players).filter(p => p.state === 'alive');
    if (alivePlayers.length === 0) {
      set({ spectatingPlayerId: null });
      return;
    }
    
    let currentIndex = alivePlayers.findIndex(p => p.id === spectatingPlayerId);
    if (currentIndex === -1) {
      set({ spectatingPlayerId: alivePlayers[0].id });
    } else {
      let nextIndex = (currentIndex + direction + alivePlayers.length) % alivePlayers.length;
      set({ spectatingPlayerId: alivePlayers[nextIndex].id });
    }
  },
  toggleDebug: () => set(state => ({ showDebug: !state.showDebug })),
}));
