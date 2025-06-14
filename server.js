const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Prisma
const prisma = new PrismaClient();

// Socket to game mapping for quick lookups
const socketToGame = new Map();

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
        ? process.env.APP_URL 
        : 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Host creates a game
    socket.on('create-game', async (data, callback) => {
      try {
        const { gameId, gameCode, hostId, hostNickname } = data;
        
        // Create game session in database
        const gameSession = await prisma.gameSession.create({
          data: {
            id: gameId,
            code: gameCode,
            status: 'LOBBY',
            hostId: hostId,
            players: {
              create: {
                id: hostId,
                nickname: hostNickname,
                isHost: true,
                status: 'CONNECTED',
                socketId: socket.id
              }
            }
          },
          include: {
            players: true
          }
        });

        socketToGame.set(socket.id, gameId);
        socket.join(gameId);
        
        callback({ success: true, gameSession });
      } catch (error) {
        console.error('Error creating game:', error);
        callback({ success: false, error: 'Failed to create game' });
      }
    });

    // Player joins a game
    socket.on('join-game', async (data, callback) => {
      try {
        const { gameCode, playerId, playerNickname } = data;
        
        // Find game by code
        const game = await prisma.gameSession.findUnique({
          where: { code: gameCode },
          include: { players: true }
        });

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
        const newPlayer = await prisma.player.create({
          data: {
            id: playerId,
            nickname: playerNickname,
            isHost: false,
            status: 'CONNECTED',
            socketId: socket.id,
            gameSessionId: game.id
          }
        });

        // Update game activity
        await prisma.gameSession.update({
          where: { id: game.id },
          data: { lastActivity: new Date() }
        });

        // Get updated game session
        const updatedGame = await prisma.gameSession.findUnique({
          where: { id: game.id },
          include: { players: true }
        });
        
        socketToGame.set(socket.id, game.id);
        socket.join(game.id);

        // Notify all players in the game
        io.to(game.id).emit('player-joined', {
          player: newPlayer,
          gameSession: updatedGame
        });

        callback({ success: true, gameId: game.id, gameSession: updatedGame });
      } catch (error) {
        console.error('Error joining game:', error);
        callback({ success: false, error: 'Failed to join game' });
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