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

// Host absence timers
const hostAbsenceTimers = new Map();
const gameEndTimers = new Map();

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

  // Initialize Socket.IO with aggressive disconnect detection
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://showdown1-production.up.railway.app', process.env.APP_URL].filter(Boolean)
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 5000,        // How long to wait for pong before disconnect (5 seconds)
    pingInterval: 2000,       // How often to ping (every 2 seconds)
    upgradeTimeout: 10000,    // How long to wait for transport upgrade
    allowEIO3: true          // Allow different Socket.IO versions
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id, 'at', new Date().toISOString());
    
    // Store connection info
    let connectionInfo = {
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      gameId: null
    };

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
        
        // Check if game already exists
        const existingGame = await dbOperations.findGameByCode(gameCode);
        if (existingGame) {
          console.log('Game already exists, cannot create duplicate');
          callback({ success: false, error: 'Game already exists' });
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
        connectionInfo.gameId = gameId;
        connectionInfo.lastActivity = Date.now();
        
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

        // Check if this player is already in the game (reconnecting)
        const existingPlayer = game.players.find(p => p.id === playerId);
        
        if (existingPlayer) {
          console.log(`Player ${playerId} already exists, updating socket and status`);
          // Update existing player's socket and status
          const result = await dbOperations.updatePlayerStatus(playerId, 'connected', socket.id);
          if (result) {
            socketToGame.set(socket.id, game.id);
            socket.join(game.id);
            connectionInfo.gameId = game.id;
            connectionInfo.lastActivity = Date.now();

            console.log('Existing player reconnected:', playerId);

            // Notify all players about reconnection
            io.to(game.id).emit('player-reconnected', {
              playerId: playerId,
              playerNickname: existingPlayer.nickname,
              reconnectTime: Date.now(),
              gameSession: result.game
            });

            callback({ success: true, gameId: game.id, gameSession: result.game });
            return;
          }
        }
        
        // Check if nickname is taken by a different player
        const nicknameTaken = game.players.some(p => 
          p.id !== playerId && p.nickname.toLowerCase() === playerNickname.toLowerCase()
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
        connectionInfo.gameId = game.id;
        connectionInfo.lastActivity = Date.now();

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

    // Handle disconnection with immediate notification
    socket.on('disconnect', async (reason) => {
      const disconnectTime = Date.now();
      console.log(`🔴 Client disconnected at ${new Date(disconnectTime).toISOString()}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Reason: ${reason}`);
      
      const gameId = socketToGame.get(socket.id);
      if (gameId) {
        try {
          console.log(`🎮 Player was in game: ${gameId}`);
          const result = await dbOperations.updatePlayerStatus(socket.id, 'disconnected', null, gameId);
          
          if (result && result.player) {
            console.log(`📢 Broadcasting disconnect for player: ${result.player.nickname}`);
            
            // Check if disconnected player is the host
            if (result.player.isHost) {
              console.log(`👑 Host disconnected! Starting absence timer for game ${gameId}`);
              startHostAbsenceTimer(gameId);
            }
            
            // Immediately notify all other players in the game
            const disconnectEvent = {
              playerId: result.player.id,
              playerNickname: result.player.nickname,
              disconnectTime: disconnectTime,
              reason: reason,
              gameSession: result.game
            };
            
            // Use io.to instead of socket.to to ensure all clients get it
            io.to(gameId).emit('player-disconnected', disconnectEvent);
            
            console.log(`✅ Disconnect event sent to room: ${gameId}`);
            console.log(`   Players notified: ${result.game.players.length - 1} others`);
          } else {
            console.log('⚠️ Could not find player for disconnect notification');
          }
        } catch (error) {
          console.error('❌ Error handling disconnect:', error);
        }
        socketToGame.delete(socket.id);
      } else {
        console.log('ℹ️ Disconnected socket was not in any game');
      }
    });

    // Handle host reconnection
    socket.on('reconnect-host', async (data, callback) => {
      try {
        const { gameId, hostId } = data;
        console.log(`=== RECONNECT HOST REQUEST ===`);
        console.log(`Host ID: ${hostId}`);
        console.log(`Game ID: ${gameId}`);
        console.log(`Socket ID: ${socket.id}`);
        
        // Find the existing game
        const game = useInMemory ? inMemoryGames.get(gameId) : 
          await prisma?.gameSession.findUnique({
            where: { id: gameId },
            include: { players: true }
          });
        
        if (game && game.hostId === hostId) {
          console.log(`🎮 Found existing game with ${game.players.length} players`);
          
          // Update host's socket ID and status
          const result = await dbOperations.updatePlayerStatus(hostId, 'connected', socket.id, gameId);
          
          if (result) {
            socketToGame.set(socket.id, gameId);
            socket.join(gameId);
            connectionInfo.gameId = gameId;
            connectionInfo.lastActivity = Date.now();
            
            console.log(`✅ Host ${hostId} reconnected to existing game ${gameId}`);
            
            // Cancel any host absence timers
            cancelHostAbsenceTimer(gameId);
            
            // Notify all players that host is back
            io.to(gameId).emit('player-reconnected', {
              playerId: hostId,
              playerNickname: result.player.nickname,
              reconnectTime: Date.now(),
              gameSession: result.game
            });
            
            callback({ success: true, gameSession: result.game });
            return;
          }
        }
        
        // Check if game exists but has a different host now
        if (game && game.hostId !== hostId) {
          console.log(`🔄 Original host ${hostId} returning but game has new host ${game.hostId}`);
          console.log(`🔍 Game players:`, game.players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, status: p.status })));
          
          // Find the original host player record
          const originalHost = game.players.find(p => p.id === hostId);
          console.log(`👤 Original host found:`, originalHost ? { id: originalHost.id, nickname: originalHost.nickname, isHost: originalHost.isHost, status: originalHost.status } : 'NOT FOUND');
          
          if (originalHost) {
            // Rejoin as regular player
            console.log('📥 Original host rejoining as regular player');
            
            // Update their status and socket
            console.log(`🔧 Updating player status for ${hostId} to connected`);
            const result = await dbOperations.updatePlayerStatus(hostId, 'connected', socket.id, gameId);
            console.log(`🔧 Update result:`, result ? { playerFound: true, playerId: result.player.id, status: result.player.status } : 'UPDATE FAILED');
            
            if (result) {
              socketToGame.set(socket.id, gameId);
              socket.join(gameId);
              connectionInfo.gameId = gameId;
              connectionInfo.lastActivity = Date.now();
              
              // Notify that they're back as a player
              io.to(gameId).emit('player-reconnected', {
                playerId: hostId,
                playerNickname: result.player.nickname,
                reconnectTime: Date.now(),
                gameSession: result.game
              });
              
              // Let them know they're no longer host
              callback({ 
                success: true, 
                gameSession: result.game,
                roleChanged: true,
                message: 'You have rejoined as a player. Someone else is now the host.'
              });
              return;
            }
          }
        }
        
        console.log(`❌ Host ${hostId} not found in game ${gameId} or game doesn't exist`);
        callback({ success: false, error: 'Game not found or you are not the host' });
        
      } catch (error) {
        console.error('❌ Error reconnecting host:', error);
        callback({ success: false, error: `Failed to reconnect: ${error.message}` });
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
            
            // Check if we should resume a paused host absence timer
            const timerData = hostAbsenceTimers.get(gameId);
            if (timerData && timerData.paused && hasMinimumConnectedPlayers(gameId)) {
              resumeHostAbsenceTimer(gameId);
            }
            
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

    // Handle player leaving game voluntarily
    socket.on('leave-game', async (data, callback) => {
      try {
        const { gameId, playerId, reason } = data;
        console.log(`🚪 Player ${playerId} leaving game ${gameId} voluntarily`);
        
        const result = await dbOperations.updatePlayerStatus(playerId, 'left', null, gameId);
        
        if (result && result.player) {
          // Remove player from game completely for voluntary leave
          if (useInMemory) {
            const game = inMemoryGames.get(gameId);
            if (game && game.players) {
              game.players = game.players.filter(p => p.id !== playerId);
              game.lastActivity = new Date();
            }
          }
          
          // Notify other players
          io.to(gameId).emit('player-left', {
            playerId: playerId,
            playerNickname: result.player.nickname,
            reason: reason,
            leftTime: Date.now(),
            gameSession: result.game
          });
          
          console.log(`✅ Player ${result.player.nickname} left game voluntarily`);
        }
        
        socketToGame.delete(socket.id);
        socket.leave(gameId);
        
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('❌ Error handling player leave:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Handle host ending game
    socket.on('end-game', async (data, callback) => {
      try {
        const { gameId, hostId, reason } = data;
        console.log(`🏁 Host ${hostId} ending game ${gameId}`);
        
        // Notify all players that game is ending
        io.to(gameId).emit('game-ended', {
          reason: reason,
          endedBy: hostId,
          endTime: Date.now()
        });
        
        // Clean up game from memory
        if (useInMemory) {
          const game = inMemoryGames.get(gameId);
          if (game) {
            console.log(`🗑️ Removing game ${gameId} from memory`);
            inMemoryGames.delete(gameId);
            inMemoryGames.delete(`code:${game.code}`);
          }
        }
        
        console.log(`✅ Game ${gameId} ended by host`);
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('❌ Error ending game:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Handle volunteer to become host
    socket.on('volunteer-host', async (data, callback) => {
      try {
        const { gameId, playerId } = data;
        console.log(`🙋 Player ${playerId} volunteering to be host for game ${gameId}`);
        
        // Verify game exists and is in volunteer phase
        if (!gameEndTimers.has(gameId)) {
          console.log(`❌ Game ${gameId} not in volunteer phase`);
          callback({ 
            success: false, 
            error: 'Game is not accepting host volunteers',
            reason: 'not-in-volunteer-phase'
          });
          return;
        }
        
        // Quick check - if timer was just cleared by another volunteer, reject immediately
        if (!gameEndTimers.has(gameId)) {
          console.log(`❌ Host already claimed for game ${gameId}`);
          callback({ 
            success: false, 
            error: 'Someone else already became the host',
            reason: 'already-claimed'
          });
          return;
        }
        
        // Find the game and player
        const result = await dbOperations.findPlayerByIdAndGame(playerId, gameId);
        
        if (!result || !result.player) {
          callback({ success: false, error: 'Player not found in game' });
          return;
        }
        
        const { game, player } = result;
        
        // Verify player is connected
        if (player.status !== 'connected') {
          callback({ success: false, error: 'Only connected players can become host' });
          return;
        }
        
        // Cancel the game end timer (CRITICAL SECTION - do this first)
        if (gameEndTimers.has(gameId)) {
          clearInterval(gameEndTimers.get(gameId).interval);
          gameEndTimers.delete(gameId);
          
          console.log(`🏁 ${player.nickname} claimed host, cancelling volunteer timer`);
          
          // Immediately notify all other potential volunteers that position is taken
          socket.to(gameId).emit('host-volunteer-claimed', {
            newHostNickname: player.nickname,
            message: `${player.nickname} is now the host!`
          });
        } else {
          // Another player beat us to it
          console.log(`❌ Race condition: Host already claimed for game ${gameId}`);
          callback({ 
            success: false, 
            error: 'Someone else already became the host',
            reason: 'race-condition'
          });
          return;
        }
        
        // Update game host
        const oldHostId = game.hostId;
        game.hostId = playerId;
        
        // Update player flags
        game.players.forEach(p => {
          p.isHost = p.id === playerId;
        });
        
        // Save changes
        if (useInMemory) {
          game.lastActivity = new Date();
        } else {
          // Update in database
          await prisma.gameSession.update({
            where: { id: gameId },
            data: { hostId: playerId }
          });
          
          // Update players
          await prisma.player.updateMany({
            where: { gameSessionId: gameId },
            data: { isHost: false }
          });
          
          await prisma.player.update({
            where: { id: playerId },
            data: { isHost: true }
          });
        }
        
        console.log(`✅ Host transferred from ${oldHostId} to ${playerId}`);
        
        // Notify all players
        io.to(gameId).emit('host-transferred', {
          newHostId: playerId,
          newHostNickname: player.nickname,
          gameSession: game
        });
        
        callback({ success: true, gameSession: game });
        
      } catch (error) {
        console.error('❌ Error volunteering for host:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Handle player going away (tab switch, app switch)
    socket.on('player-away', async (data) => {
      const { gameId, playerId } = data;
      console.log(`📱 Player ${playerId} went away (tab/app switch)`);
      
      const result = await dbOperations.updatePlayerStatus(playerId, 'away', null, gameId);
      
      if (result) {
        // Notify other players
        io.to(gameId).emit('player-status-changed', {
          playerId: playerId,
          playerNickname: result.player.nickname,
          status: 'away',
          gameSession: result.game
        });
      }
    });
    
    // Handle player becoming active again
    socket.on('player-active', async (data) => {
      const { gameId, playerId } = data;
      console.log(`👀 Player ${playerId} is active again`);
      
      const result = await dbOperations.updatePlayerStatus(playerId, 'connected', null, gameId);
      
      if (result) {
        // Notify other players
        io.to(gameId).emit('player-status-changed', {
          playerId: playerId,
          playerNickname: result.player.nickname,
          status: 'connected',
          gameSession: result.game
        });
      }
    });

    // Handle heartbeat to keep connection alive
    socket.on('heartbeat', (data, callback) => {
      connectionInfo.lastActivity = Date.now();
      callback({ timestamp: Date.now() });
    });
  });

  // Function to check if enough players are connected to continue
  function hasMinimumConnectedPlayers(gameId) {
    const game = useInMemory ? inMemoryGames.get(gameId) : null;
    if (!game) return false;
    
    // Count both connected and away players as "present"
    const presentPlayers = game.players.filter(p => p.status === 'connected' || p.status === 'away');
    const totalPlayers = game.players.length;
    
    // Need at least 1 present player, or 50% if more than 2 players
    if (totalPlayers === 1) return false; // Can't continue with just host gone
    if (totalPlayers === 2) return presentPlayers.length >= 1;
    return presentPlayers.length >= Math.ceil(totalPlayers * 0.5);
  }

  // Function to handle host absence
  async function startHostAbsenceTimer(gameId) {
    console.log(`⏱️ Starting host absence timer for game ${gameId}`);
    
    // Clear any existing timer
    if (hostAbsenceTimers.has(gameId)) {
      clearInterval(hostAbsenceTimers.get(gameId).interval);
    }
    
    // Check if we have minimum players before starting timer
    if (!hasMinimumConnectedPlayers(gameId)) {
      console.log(`⏸️ Pausing host absence timer - not enough connected players`);
      hostAbsenceTimers.set(gameId, { 
        paused: true, 
        secondsRemaining: 60,
        startTime: Date.now() 
      });
      
      // Notify players that timer is paused
      io.to(gameId).emit('host-absence-paused', {
        message: 'Waiting for more players to reconnect before starting host transfer timer'
      });
      return;
    }
    
    let secondsRemaining = 60;
    
    // Notify all players that countdown has started
    io.to(gameId).emit('host-absence-countdown', {
      secondsRemaining,
      phase: 'waiting-for-reconnection'
    });
    
    const interval = setInterval(async () => {
      // Check if we still have enough players to continue
      if (!hasMinimumConnectedPlayers(gameId)) {
        console.log(`⏸️ Pausing timer - not enough connected players`);
        clearInterval(interval);
        hostAbsenceTimers.set(gameId, { 
          paused: true, 
          secondsRemaining,
          startTime: Date.now() 
        });
        
        io.to(gameId).emit('host-absence-paused', {
          message: 'Timer paused - waiting for more players to reconnect'
        });
        return;
      }
      
      secondsRemaining--;
      
      // Update countdown for all players
      io.to(gameId).emit('host-absence-countdown', {
        secondsRemaining,
        phase: 'waiting-for-reconnection'
      });
      
      if (secondsRemaining <= 0) {
        clearInterval(interval);
        hostAbsenceTimers.delete(gameId);
        
        // Start volunteer phase
        startVolunteerPhase(gameId);
      }
    }, 1000);
    
    hostAbsenceTimers.set(gameId, { interval, startTime: Date.now() });
  }
  
  // Function to start volunteer phase
  async function startVolunteerPhase(gameId) {
    console.log(`🙋 Starting volunteer phase for game ${gameId}`);
    
    let secondsRemaining = 60;
    
    // Notify all players to show volunteer modal
    io.to(gameId).emit('host-volunteer-phase', {
      secondsRemaining,
      phase: 'requesting-volunteers'
    });
    
    const interval = setInterval(async () => {
      secondsRemaining--;
      
      // Update countdown
      io.to(gameId).emit('host-volunteer-phase', {
        secondsRemaining,
        phase: 'requesting-volunteers'
      });
      
      if (secondsRemaining <= 0) {
        clearInterval(interval);
        gameEndTimers.delete(gameId);
        
        // End game - no volunteers
        console.log(`🏁 Ending game ${gameId} - no host volunteers`);
        
        io.to(gameId).emit('game-ended', {
          reason: 'no-host-available',
          message: 'Game ended - no one volunteered to be host'
        });
        
        // Clean up game
        if (useInMemory) {
          const game = inMemoryGames.get(gameId);
          if (game) {
            inMemoryGames.delete(gameId);
            inMemoryGames.delete(`code:${game.code}`);
          }
        }
      }
    }, 1000);
    
    gameEndTimers.set(gameId, { interval, startTime: Date.now() });
  }
  
  // Function to resume paused timer when players reconnect
  function resumeHostAbsenceTimer(gameId) {
    const timerData = hostAbsenceTimers.get(gameId);
    if (!timerData || !timerData.paused) return;
    
    console.log(`▶️ Resuming host absence timer for game ${gameId}`);
    
    // Start new timer with remaining time
    let secondsRemaining = timerData.secondsRemaining;
    
    // Notify all players that countdown has resumed
    io.to(gameId).emit('host-absence-countdown', {
      secondsRemaining,
      phase: 'waiting-for-reconnection'
    });
    
    const interval = setInterval(async () => {
      // Check if we still have enough players to continue
      if (!hasMinimumConnectedPlayers(gameId)) {
        console.log(`⏸️ Pausing timer again - not enough connected players`);
        clearInterval(interval);
        hostAbsenceTimers.set(gameId, { 
          paused: true, 
          secondsRemaining,
          startTime: Date.now() 
        });
        
        io.to(gameId).emit('host-absence-paused', {
          message: 'Timer paused - waiting for more players to reconnect'
        });
        return;
      }
      
      secondsRemaining--;
      
      // Update countdown for all players
      io.to(gameId).emit('host-absence-countdown', {
        secondsRemaining,
        phase: 'waiting-for-reconnection'
      });
      
      if (secondsRemaining <= 0) {
        clearInterval(interval);
        hostAbsenceTimers.delete(gameId);
        
        // Start volunteer phase
        startVolunteerPhase(gameId);
      }
    }, 1000);
    
    hostAbsenceTimers.set(gameId, { interval, startTime: Date.now() });
  }

  // Function to cancel host absence timer
  function cancelHostAbsenceTimer(gameId) {
    if (hostAbsenceTimers.has(gameId)) {
      console.log(`✅ Cancelling host absence timer for game ${gameId}`);
      const timerData = hostAbsenceTimers.get(gameId);
      if (timerData.interval) {
        clearInterval(timerData.interval);
      }
      hostAbsenceTimers.delete(gameId);
      
      // Notify players that host is back
      io.to(gameId).emit('host-absence-cancelled', {
        message: 'Host has reconnected'
      });
    }
    
    if (gameEndTimers.has(gameId)) {
      clearInterval(gameEndTimers.get(gameId).interval);
      gameEndTimers.delete(gameId);
    }
  }

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