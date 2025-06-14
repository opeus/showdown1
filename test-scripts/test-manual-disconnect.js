#!/usr/bin/env node

/**
 * Test reconnect functionality by manually marking player as disconnected
 * Usage: node test-manual-disconnect.js [server-url]
 */

const { io } = require('socket.io-client');

const serverUrl = process.argv[2] || 'https://showdown1-production.up.railway.app';
console.log(`🎯 Testing MANUAL DISCONNECT on: ${serverUrl}`);

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

async function testManualDisconnect() {
  const gameCode = generateGameCode();
  const gameId = `game_${gameCode}`;
  const hostId = generatePlayerId();
  const playerId = generatePlayerId();

  console.log(`\n🎮 Testing with game: ${gameCode}`);
  console.log(`Player ID: ${playerId}`);

  try {
    // Step 1: Create host
    console.log('\n👑 Creating host...');
    const hostSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
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
      reconnection: false,
    });

    let playerSocketId;

    await new Promise((resolve, reject) => {
      playerSocket.on('connect', () => {
        console.log('✅ Player connected');
        playerSocketId = playerSocket.id;
        console.log('📋 Player socket ID:', playerSocketId);
        
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

    // Step 3: Manually trigger disconnect event by simulating server behavior
    console.log('\n🔧 Manually simulating disconnect process...');
    
    // Try to create a third socket to send a custom event that will mark the player as disconnected
    const adminSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      adminSocket.on('connect', () => {
        console.log('✅ Admin socket connected');
        
        // Instead of trying to manually disconnect, let's try a different approach:
        // Let's just close the player socket cleanly and then try to reconnect
        console.log('🔌 Closing player socket...');
        playerSocket.close();
        
        // Wait a moment for the server to process the disconnect
        setTimeout(() => {
          console.log('⏰ Waited for disconnect processing');
          resolve();
        }, 2000);
      });

      adminSocket.on('connect_error', (error) => {
        reject(error);
      });

      setTimeout(() => reject(new Error('Admin timeout')), 10000);
    });

    // Step 4: Try to reconnect with a new socket
    console.log('\n🔄 Testing reconnect-player with new socket...');
    
    const reconnectSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      reconnectSocket.on('connect', () => {
        console.log('✅ Reconnect socket connected');
        console.log('📋 New socket ID:', reconnectSocket.id);
        
        console.log('📡 Sending reconnect-player request...');
        reconnectSocket.emit('reconnect-player', {
          gameId: gameId,
          playerId: playerId
        }, (response) => {
          console.log('📨 Reconnect response:', response);
          
          if (response.success) {
            console.log('✅ Reconnection successful!');
            console.log('🎮 Players in game:', response.gameSession.players.length);
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

    // Cleanup
    hostSocket.disconnect();
    adminSocket.disconnect();
    reconnectSocket.disconnect();

    console.log('\n✅ Manual disconnect test completed');

  } catch (error) {
    console.error('\n💥 Manual disconnect test failed:', error.message);
    process.exit(1);
  }
}

testManualDisconnect().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});