const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = process.env.PORT || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Prisma with fallback
let prisma;
let useInMemory = false;
const inMemoryGames = new Map();

try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  console.log('Prisma initialized successfully');
} catch (error) {
  console.warn('Prisma initialization failed, using in-memory storage:', error.message);
  useInMemory = true;
}

// Socket to game mapping for quick lookups
const socketToGame = new Map();

// In-memory database operations fallback
const dbOperations = {
  async createGame(gameData) {
    if (useInMemory) {
      const gameSession = {
        ...gameData,
        players: [gameData.players.create],
        createdAt: new Date(),
        lastActivity: new Date()
      };
      inMemoryGames.set(gameData.id, gameSession);
      inMemoryGames.set(`code:${gameData.code}`, gameData.id);
      return gameSession;
    } else {
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

  async updatePlayerStatus(playerId, status, socketId = null) {
    if (useInMemory) {
      for (const [gameId, game] of inMemoryGames.entries()) {
        if (typeof game === 'object' && game.players) {
          const player = game.players.find(p => p.id === playerId);
          if (player) {
            player.status = status;
            if (socketId) player.socketId = socketId;
            game.lastActivity = new Date();
            return { game, player };
          }
        }
      }
      return null;
    } else {
      const updateData = { status };
      if (socketId) updateData.socketId = socketId;
      
      const player = await prisma.player.update({
        where: { id: playerId },
        data: updateData
      });
      
      const game = await prisma.gameSession.findUnique({
        where: { id: player.gameSessionId },
        include: { players: true }
      });
      
      return { game, player };
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
        console.log('Creating game:', { gameId, gameCode, hostId, hostNickname, useInMemory });
        
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

        const gameSession = await dbOperations.createGame(gameData);
        console.log('Game created successfully:', gameSession.id);

        socketToGame.set(socket.id, gameId);
        socket.join(gameId);
        
        callback({ success: true, gameSession });
      } catch (error) {
        console.error('Error creating game:', error);
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
    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      
      const gameId = socketToGame.get(socket.id);
      if (gameId) {
        try {
          // Find and update player status
          const player = await prisma.player.findFirst({
            where: { 
              socketId: socket.id,
              gameSessionId: gameId 
            }
          });

          if (player) {
            await prisma.player.update({
              where: { id: player.id },
              data: { status: 'DISCONNECTED' }
            });

            // Update game activity
            await prisma.gameSession.update({
              where: { id: gameId },
              data: { lastActivity: new Date() }
            });

            // Get updated game session
            const updatedGame = await prisma.gameSession.findUnique({
              where: { id: gameId },
              include: { players: true }
            });
            
            // Notify other players
            socket.to(gameId).emit('player-disconnected', {
              playerId: player.id,
              gameSession: updatedGame
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
        
        const player = await prisma.player.findFirst({
          where: { 
            id: playerId,
            gameSessionId: gameId 
          }
        });

        if (player) {
          // Update player status and socket
          await prisma.player.update({
            where: { id: playerId },
            data: { 
              status: 'CONNECTED',
              socketId: socket.id
            }
          });

          // Update game activity
          await prisma.gameSession.update({
            where: { id: gameId },
            data: { lastActivity: new Date() }
          });

          // Get updated game session
          const updatedGame = await prisma.gameSession.findUnique({
            where: { id: gameId },
            include: { players: true }
          });
          
          socketToGame.set(socket.id, gameId);
          socket.join(gameId);
          
          // Notify all players
          io.to(gameId).emit('player-reconnected', {
            playerId,
            gameSession: updatedGame
          });
          
          callback({ success: true, gameSession: updatedGame });
        } else {
          callback({ success: false, error: 'Player not found' });
        }
      } catch (error) {
        console.error('Error reconnecting player:', error);
        callback({ success: false, error: 'Failed to reconnect' });
      }
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log('> Socket.IO server running');
  });
});