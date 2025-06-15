const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = process.env.PORT || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Simple in-memory storage - no database needed
const inMemoryGames = new Map();
const socketToGame = new Map();
const hostAbsenceTimers = new Map();
const gameEndTimers = new Map();

console.log('🗄️ Using in-memory storage (no database required)');

// Simple in-memory operations
const dbOperations = {
  async createGame(gameData) {
    console.log('Creating game in memory:', gameData.id);
    
    const gameSession = {
      ...gameData,
      players: [gameData.players.create],
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    inMemoryGames.set(gameData.id, gameSession);
    inMemoryGames.set(`code:${gameData.code}`, gameData.id);
    
    console.log('✅ Game stored in memory. Total games:', inMemoryGames.size / 2);
    return gameSession;
  },

  async findGameByCode(code) {
    const gameId = inMemoryGames.get(`code:${code}`);
    return gameId ? inMemoryGames.get(gameId) : null;
  },

  async findGameById(gameId) {
    return inMemoryGames.get(gameId) || null;
  },

  async addPlayer(gameId, playerData) {
    const game = inMemoryGames.get(gameId);
    if (game) {
      const newPlayer = { ...playerData, createdAt: new Date() };
      game.players.push(newPlayer);
      game.lastActivity = new Date();
      return { game, newPlayer };
    }
    return null;
  },

  async updatePlayerStatus(playerId, status, socketId = null, gameId = null) {
    if (gameId) {
      const game = inMemoryGames.get(gameId);
      if (game) {
        const player = game.players.find(p => p.id === playerId);
        if (player) {
          player.status = status;
          if (socketId !== null) player.socketId = socketId;
          game.lastActivity = new Date();
          return { game, player };
        }
      }
    } else {
      // Search all games
      for (const [id, game] of inMemoryGames) {
        if (!id.startsWith('code:')) {
          const player = game.players.find(p => p.id === playerId);
          if (player) {
            player.status = status;
            if (socketId !== null) player.socketId = socketId;
            game.lastActivity = new Date();
            return { game, player };
          }
        }
      }
    }
    return null;
  },

  async findPlayerByIdAndGame(playerId, gameId) {
    const game = inMemoryGames.get(gameId);
    if (game && game.players) {
      const player = game.players.find(p => p.id === playerId);
      return player ? { game, player } : null;
    }
    return null;
  }
};