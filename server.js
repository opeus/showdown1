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

// Initialize Prisma with fallback
let prisma;
let useInMemory = true; // Default to in-memory for Railway deployment
const inMemoryGames = new Map();

try {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    console.log('DATABASE_URL found, attempting to initialize Prisma...');
    try {
      const { PrismaClient } = require('@prisma/client');
      prisma = new PrismaClient();
      console.log('✅ Prisma initialized successfully');
      useInMemory = false;
    } catch (prismaError) {
      console.warn('❌ Prisma package not available or failed to initialize:', prismaError.message);
      console.log('Falling back to in-memory storage');
      useInMemory = true;
      prisma = null;
    }
  } else {
    console.log('🗄️ No DATABASE_URL found, using in-memory storage');
    prisma = null;
    useInMemory = true;
  }
} catch (error) {
  console.warn('⚠️ Error during database initialization:', error.message);
  useInMemory = true;
  prisma = null;
}

console.log(`Database mode: ${useInMemory ? 'IN-MEMORY' : 'PRISMA'}`);

// Socket to game mapping for quick lookups
const socketToGame = new Map();

// In-memory database operations fallback
const dbOperations = {
  async createGame(gameData) {
    console.log('dbOperations.createGame called with useInMemory:', useInMemory);
    
    if (useInMemory) {
      console.log('Creating game in memory...');
      
      try {
        const gameSession = {
          ...gameData,
          players: [gameData.players.create],
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        console.log('Setting game in memory:', gameData.id);
        inMemoryGames.set(gameData.id, gameSession);
        inMemoryGames.set(`code:${gameData.code}`, gameData.id);
        
        console.log('Game stored in memory successfully');
        console.log('Memory games count:', inMemoryGames.size);
        
        return gameSession;
      } catch (error) {
        console.error('Error in in-memory game creation:', error);
        throw error;
      }
    } else {
      console.log('Creating game in Prisma database...');
      if (!prisma) {
        throw new Error('Prisma client not initialized but useInMemory is false');
      }
      return await prisma.gameSession.create({
        data: gameData,
        include: { players: true }
      });
    }
  },

  async findGameByCode(code) {
    if (useInMemory) {
      const gameId = inMemoryGames.get(`code:${code}`);
      return gameId ? inMemoryGames.get(gameId) : null;
    } else {
      return await prisma.gameSession.findUnique({
        where: { code },
        include: { players: true }
      });
    }
  },

  async addPlayer(gameId, playerData) {
    if (useInMemory) {
      const game = inMemoryGames.get(gameId);
      if (game) {
        const newPlayer = { ...playerData, createdAt: new Date() };
        game.players.push(newPlayer);
        game.lastActivity = new Date();
        return { game, newPlayer };
      }
      return null;
    } else {
      const newPlayer = await prisma.player.create({ data: playerData });
      await prisma.gameSession.update({
        where: { id: gameId },
        data: { lastActivity: new Date() }
      });
      const game = await prisma.gameSession.findUnique({
        where: { id: gameId },
        include: { players: true }
      });
      return { game, newPlayer };
    }
  },

  async updatePlayerStatus(playerIdOrSocketId, status, socketId = null, gameId = null) {
    if (useInMemory) {
      // Handle both playerId and socketId lookups
      for (const [gId, game] of inMemoryGames.entries()) {
        if (typeof game === 'object' && game.players && (!gameId || gId === gameId)) {
          let player;
          
          // Try to find by playerId first, then by socketId
          player = game.players.find(p => p.id === playerIdOrSocketId);
          if (!player) {
            player = game.players.find(p => p.socketId === playerIdOrSocketId);
          }
          
          if (player) {
            player.status = status;
            if (socketId) player.socketId = socketId;
            if (status === 'disconnected') {
              player.disconnectedAt = Date.now();
            } else if (status === 'connected') {
              delete player.disconnectedAt;
            }
            game.lastActivity = new Date();
            return { game, player };
          }
        }
      }
      return null;
    } else {
      const updateData = { status };
      if (socketId) updateData.socketId = socketId;
      
      let player;
      if (gameId) {
        // Find by socketId in specific game
        player = await prisma.player.findFirst({
          where: { 
            socketId: playerIdOrSocketId,
            gameSessionId: gameId 
          }
        });
        if (player) {
          player = await prisma.player.update({
            where: { id: player.id },
            data: updateData
          });
        }
      } else {
        // Find by playerId
        player = await prisma.player.update({
          where: { id: playerIdOrSocketId },
          data: updateData
        });
      }
      
      if (player) {
        const game = await prisma.gameSession.findUnique({
          where: { id: player.gameSessionId },
          include: { players: true }
        });
        return { game, player };
      }
      
      return null;
    }
  },

  async findPlayerByIdAndGame(playerId, gameId) {
    if (useInMemory) {
      const game = inMemoryGames.get(gameId);
      if (game && game.players) {
        const player = game.players.find(p => p.id === playerId);
        return player ? { game, player } : null;
      }
      return null;
    } else {
      const player = await prisma.player.findFirst({
        where: { 
          id: playerId,
          gameSessionId: gameId 
        }
      });
      
      if (player) {
        const game = await prisma.gameSession.findUnique({
          where: { id: gameId },
          include: { players: true }
        });
        return { game, player };
      }
      
      return null;
    }
  },

  async cleanupDisconnectedPlayers() {
    const DISCONNECT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    if (useInMemory) {
      for (const [gameId, game] of inMemoryGames.entries()) {
        if (typeof game === 'object' && game.players) {
          game.players = game.players.filter(player => {
            if (player.status === 'disconnected' && player.disconnectedAt) {
              const disconnectedFor = now - player.disconnectedAt;
              if (disconnectedFor > DISCONNECT_TIMEOUT) {
                console.log(`Removing player ${player.nickname} after ${Math.round(disconnectedFor / 1000)}s disconnect`);
                return false;
              }
            }
            return true;
          });
          
          // Remove empty games
          if (game.players.length === 0) {
            console.log(`Removing empty game ${gameId}`);
            inMemoryGames.delete(gameId);
            inMemoryGames.delete(`code:${game.code}`);
          }
        }
      }
    } else {
      // Prisma cleanup would go here
      // For now, we'll focus on in-memory implementation
    }
  }
};

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://showdown1-production.up.railway.app', process.env.APP_URL].filter(Boolean)
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Host creates a game
    socket.on('create-game', async (data, callback) => {
      try {
        const { gameId, gameCode, hostId, hostNickname } = data;
        console.log('=== CREATE GAME REQUEST ===');
        console.log('Data:', { gameId, gameCode, hostId, hostNickname });
        console.log('Database mode:', useInMemory ? 'IN-MEMORY' : 'PRISMA');
        
        // Validate input data
        if (!gameId || !gameCode || !hostId || !hostNickname) {
          const missingFields = [];
          if (!gameId) missingFields.push('gameId');
          if (!gameCode) missingFields.push('gameCode');
          if (!hostId) missingFields.push('hostId');
          if (!hostNickname) missingFields.push('hostNickname');
          
          const errorMsg = `Missing required fields: ${missingFields.join(', ')}`;
          console.error('Validation error:', errorMsg);
          callback({ success: false, error: errorMsg });
          return;
        }
        
        // Create game session
        const gameData = {
          id: gameId,
          code: gameCode,
          status: useInMemory ? 'lobby' : 'LOBBY',
          hostId: hostId,
          players: {
            create: {
              id: hostId,
              nickname: hostNickname,
              isHost: true,
              status: useInMemory ? 'connected' : 'CONNECTED',
              socketId: socket.id,
              ...(useInMemory ? {} : { gameSessionId: gameId })
            }
          }
        };

        console.log('Calling dbOperations.createGame with:', JSON.stringify(gameData, null, 2));
        
        const gameSession = await dbOperations.createGame(gameData);
        console.log('✅ Game created successfully:', gameSession.id);
        console.log('Game session:', JSON.stringify(gameSession, null, 2));

        socketToGame.set(socket.id, gameId);
        socket.join(gameId);
        
        callback({ success: true, gameSession });
      } catch (error) {
        console.error('❌ Error creating game:', error);
        console.error('Error stack:', error.stack);
        callback({ success: false, error: `Failed to create game: ${error.message}` });
      }
    });

    // Player joins a game
    socket.on('join-game', async (data, callback) => {
      try {
        const { gameCode, playerId, playerNickname } = data;
        console.log('Player joining game:', { gameCode, playerId, playerNickname });
        
        // Find game by code
        const game = await dbOperations.findGameByCode(gameCode);

        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        // Check if nickname is taken
        const nicknameTaken = game.players.some(p => 
          p.nickname.toLowerCase() === playerNickname.toLowerCase()
        );
        
        if (nicknameTaken) {
          callback({ success: false, error: 'Nickname already taken' });
          return;
        }

        // Add player to game
        const playerData = {
          id: playerId,
          nickname: playerNickname,
          isHost: false,
          status: useInMemory ? 'connected' : 'CONNECTED',
          socketId: socket.id,
          ...(useInMemory ? {} : { gameSessionId: game.id })
        };

        const result = await dbOperations.addPlayer(game.id, playerData);
        if (!result) {
          callback({ success: false, error: 'Failed to join game' });
          return;
        }

        const { game: updatedGame, newPlayer } = result;
        
        socketToGame.set(socket.id, game.id);
        socket.join(game.id);

        console.log('Player joined successfully:', playerId);

        // Notify all players in the game
        io.to(game.id).emit('player-joined', {
          player: newPlayer,
          gameSession: updatedGame
        });

        callback({ success: true, gameId: game.id, gameSession: updatedGame });
      } catch (error) {
        console.error('Error joining game:', error);
        callback({ success: false, error: `Failed to join game: ${error.message}` });
      }
    });

    // Host subscribes to game updates
    socket.on('subscribe-host', async (gameId) => {
      try {
        socket.join(gameId);
        socketToGame.set(socket.id, gameId);
        
        const game = await prisma.gameSession.findUnique({
          where: { id: gameId },
          include: { players: true }
        });
        
        if (game) {
          socket.emit('game-update', game);
        }
      } catch (error) {
        console.error('Error subscribing host:', error);
      }
    });

    // Player subscribes to game updates  
    socket.on('subscribe-player', async (gameId) => {
      try {
        socket.join(gameId);
        socketToGame.set(socket.id, gameId);
        
        const game = await prisma.gameSession.findUnique({
          where: { id: gameId },
          include: { players: true }
        });
        
        if (game) {
          socket.emit('game-update', game);
        }
      } catch (error) {
        console.error('Error subscribing player:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      console.log('Client disconnected:', socket.id, 'Reason:', reason);
      
      const gameId = socketToGame.get(socket.id);
      if (gameId) {
        try {
          const result = await dbOperations.updatePlayerStatus(socket.id, 'disconnected', null, gameId);
          
          if (result && result.player) {
            console.log(`Player ${result.player.nickname} disconnected from game ${gameId}`);
            
            // Notify other players with disconnect timestamp
            socket.to(gameId).emit('player-disconnected', {
              playerId: result.player.id,
              playerNickname: result.player.nickname,
              disconnectTime: Date.now(),
              reason: reason,
              gameSession: result.game
            });
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
        socketToGame.delete(socket.id);
      }
    });

    // Handle player reconnection
    socket.on('reconnect-player', async (data, callback) => {
      try {
        const { gameId, playerId } = data;
        console.log(`=== RECONNECT PLAYER REQUEST ===`);
        console.log(`Player ID: ${playerId}`);
        console.log(`Game ID: ${gameId}`);
        console.log(`Socket ID: ${socket.id}`);
        console.log(`Database mode: ${useInMemory ? 'IN-MEMORY' : 'PRISMA'}`);
        
        console.log('🔍 Looking for player in game...');
        const result = await dbOperations.findPlayerByIdAndGame(playerId, gameId);
        console.log('📋 Find result:', result ? { found: true, player: result.player.nickname } : { found: false });
        
        if (result && result.player) {
          const { game, player } = result;
          console.log(`🎮 Found player ${player.nickname} in game with ${game.players.length} total players`);
          
          console.log('🔄 Updating player status...');
          // Update player status and socket
          const updateResult = await dbOperations.updatePlayerStatus(playerId, 'connected', socket.id);
          console.log('📝 Update result:', updateResult ? { updated: true } : { updated: false });
          
          if (updateResult) {
            socketToGame.set(socket.id, gameId);
            socket.join(gameId);
            
            console.log(`✅ Player ${player.nickname} reconnected to game ${gameId}`);
            
            // Notify all players about reconnection
            io.to(gameId).emit('player-reconnected', {
              playerId: playerId,
              playerNickname: player.nickname,
              reconnectTime: Date.now(),
              gameSession: updateResult.game
            });
            
            callback({ success: true, gameSession: updateResult.game });
          } else {
            console.log('❌ Failed to update player status');
            callback({ success: false, error: 'Failed to update player status' });
          }
        } else {
          console.log(`❌ Player ${playerId} not found in game ${gameId} for reconnection`);
          
          // Debug: List all games and players
          if (useInMemory) {
            console.log('🔍 Available games:');
            for (const [key, value] of inMemoryGames.entries()) {
              if (typeof value === 'object' && value.players) {
                console.log(`  Game ${key}: ${value.players.length} players`);
                value.players.forEach(p => {
                  console.log(`    - ${p.id} (${p.nickname}) [${p.status}]`);
                });
              }
            }
          }
          
          callback({ success: false, error: 'Player not found in game' });
        }
      } catch (error) {
        console.error('❌ Error reconnecting player:', error);
        console.error('❌ Error stack:', error.stack);
        callback({ success: false, error: `Failed to reconnect: ${error.message}` });
      }
    });

    // Handle heartbeat to keep connection alive
    socket.on('heartbeat', (data, callback) => {
      callback({ timestamp: Date.now() });
    });
  });

  // Start cleanup interval for disconnected players
  setInterval(() => {
    dbOperations.cleanupDisconnectedPlayers();
  }, 30000); // Check every 30 seconds

  server.listen(port, (err) => {
    if (err) throw err;
    console.log('=================================');
    console.log('🚀 Showdown Server Started');
    console.log(`📍 URL: http://${hostname}:${port}`);
    console.log(`🗄️ Database: ${useInMemory ? 'IN-MEMORY' : 'PRISMA'}`);
    console.log(`🔌 Socket.IO: ENABLED`);
    console.log(`🧹 Player Cleanup: ENABLED (30s interval)`);
    console.log(`⚙️ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('=================================');
  });
});