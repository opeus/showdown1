#!/usr/bin/env node

/**
 * Simple disconnect test to debug reconnection issues
 * Usage: node test-simple-disconnect.js [server-url]
 */

const { io } = require('socket.io-client');

const serverUrl = process.argv[2] || 'https://showdown1-production.up.railway.app';
console.log(`🎯 Testing SIMPLE DISCONNECT on: ${serverUrl}`);

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

async function testSimpleDisconnect() {
  const gameCode = generateGameCode();
  const gameId = `game_${gameCode}`;
  const hostId = generatePlayerId();
  const playerId = generatePlayerId();

  console.log(`\n🎮 Testing with game: ${gameCode}`);
  console.log(`Host ID: ${hostId}`);
  console.log(`Player ID: ${playerId}`);

  try {
    // Step 1: Create host
    console.log('\n👑 Creating host...');
    const hostSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false, // Disable auto-reconnection for test
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
      reconnection: false, // Disable auto-reconnection for test
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

    // Step 3: Disconnect player
    console.log('\n🔌 Disconnecting player...');
    playerSocket.disconnect();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Try to reconnect player using reconnect-player event
    console.log('\n🔄 Testing reconnect-player event...');
    const reconnectSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      reconnectSocket.on('connect', () => {
        console.log('✅ Reconnect socket connected');
        
        console.log('📡 Calling reconnect-player with:', { gameId, playerId });
        reconnectSocket.emit('reconnect-player', {
          gameId: gameId,
          playerId: playerId
        }, (response) => {
          console.log('📨 Reconnect response:', response);
          
          if (response.success) {
            console.log('✅ Player successfully reconnected');
            console.log('🎮 Game session players:', response.gameSession.players.length);
            resolve();
          } else {
            console.log('❌ Reconnect failed:', response.error);
            reject(new Error(response.error));
          }
        });
      });

      reconnectSocket.on('connect_error', (error) => {
        reject(error);
      });

      setTimeout(() => reject(new Error('Reconnect timeout')), 10000);
    });

    console.log('\n🎉 Simple disconnect test PASSED!');

    // Cleanup
    hostSocket.disconnect();
    reconnectSocket.disconnect();

  } catch (error) {
    console.error('\n💥 Simple disconnect test FAILED:', error.message);
    process.exit(1);
  }
}

testSimpleDisconnect().then(() => {
  console.log('✅ Test completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});