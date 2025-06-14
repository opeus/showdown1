#!/usr/bin/env node

/**
 * Test to check game state during disconnect/reconnect process
 * Usage: node test-game-state.js [server-url]
 */

const { io } = require('socket.io-client');

const serverUrl = process.argv[2] || 'https://showdown1-production.up.railway.app';
console.log(`🎯 Testing GAME STATE during disconnect on: ${serverUrl}`);

function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substr(2, 9);
}

async function testGameState() {
  const gameCode = generateGameCode();
  const gameId = `game_${gameCode}`;
  const hostId = generatePlayerId();
  const playerId = generatePlayerId();

  console.log(`\n🎮 Testing with game: ${gameCode}`);

  try {
    // Step 1: Create host and track events
    console.log('\n👑 Creating host...');
    const hostSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
    });

    let gameState = null;

    // Listen for all game events on host
    hostSocket.on('player-joined', (data) => {
      console.log('📢 Host received: player-joined', data.player.nickname);
      gameState = data.gameSession;
    });

    hostSocket.on('player-disconnected', (data) => {
      console.log('📢 Host received: player-disconnected', data.playerNickname, 'Reason:', data.reason);
      gameState = data.gameSession;
      console.log('📊 Game state after disconnect:', {
        playersCount: gameState.players.length,
        playersStatus: gameState.players.map(p => ({ 
          name: p.nickname, 
          status: p.status, 
          disconnectedAt: p.disconnectedAt 
        }))
      });
    });

    hostSocket.on('player-reconnected', (data) => {
      console.log('📢 Host received: player-reconnected', data.playerNickname);
      gameState = data.gameSession;
      console.log('📊 Game state after reconnect:', {
        playersCount: gameState.players.length,
        playersStatus: gameState.players.map(p => ({ 
          name: p.nickname, 
          status: p.status 
        }))
      });
    });

    await new Promise((resolve, reject) => {
      hostSocket.on('connect', () => {
        console.log('✅ Host connected');
        hostSocket.emit('create-game', {
          gameId: gameId,
          gameCode: gameCode,
          hostId: hostId,
          hostNickname: 'TestHost'
        }, (response) => {
          if (response.success) {
            console.log('✅ Game created');
            gameState = response.gameSession;
            resolve();
          } else {
            reject(new Error(response.error));
          }
        });
      });

      hostSocket.on('connect_error', (error) => {
        reject(error);
      });

      setTimeout(() => reject(new Error('Host timeout')), 10000);
    });

    // Step 2: Create player
    console.log('\n👥 Creating player...');
    const playerSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      playerSocket.on('connect', () => {
        console.log('✅ Player connected');
        playerSocket.emit('join-game', {
          gameCode: gameCode,
          playerId: playerId,
          playerNickname: 'TestPlayer'
        }, (response) => {
          if (response.success) {
            console.log('✅ Player joined');
            resolve();
          } else {
            reject(new Error(response.error));
          }
        });
      });

      playerSocket.on('connect_error', (error) => {
        reject(error);
      });

      setTimeout(() => reject(new Error('Player timeout')), 10000);
    });

    // Wait for player-joined event
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n📊 Game state after player joined:', {
      playersCount: gameState.players.length,
      playersStatus: gameState.players.map(p => ({ 
        name: p.nickname, 
        status: p.status,
        id: p.id,
        socketId: p.socketId
      }))
    });

    // Step 3: Disconnect player and observe
    console.log('\n🔌 Disconnecting player...');
    playerSocket.disconnect();
    
    // Wait for disconnect event
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Try reconnect (this should now work if disconnect was processed correctly)
    console.log('\n🔄 Attempting reconnection...');
    
    // Check what happens when we try to reconnect
    const reconnectSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      reconnectSocket.on('connect', () => {
        console.log('✅ Reconnect socket connected');
        
        console.log('📡 Sending reconnect-player request...');
        reconnectSocket.emit('reconnect-player', {
          gameId: gameId,
          playerId: playerId
        }, (response) => {
          console.log('📨 Reconnect response:', response);
          
          if (response.success) {
            console.log('✅ Reconnection successful');
          } else {
            console.log('❌ Reconnection failed:', response.error);
          }
          resolve();
        });
      });

      reconnectSocket.on('connect_error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        console.log('⏰ Reconnect attempt timed out');
        resolve();
      }, 10000);
    });

    // Final game state
    console.log('\n📊 Final game state:', {
      playersCount: gameState ? gameState.players.length : 'unknown',
      playersStatus: gameState ? gameState.players.map(p => ({ 
        name: p.nickname, 
        status: p.status,
        disconnectedAt: p.disconnectedAt 
      })) : 'unknown'
    });

    // Cleanup
    hostSocket.disconnect();
    reconnectSocket.disconnect();

    console.log('\n✅ Game state test completed');

  } catch (error) {
    console.error('\n💥 Game state test failed:', error.message);
    process.exit(1);
  }
}

testGameState().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});