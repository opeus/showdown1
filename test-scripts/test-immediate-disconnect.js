#!/usr/bin/env node

/**
 * Test immediate disconnect detection
 * Creates a host and player, then monitors disconnect timing
 */

const { io } = require('socket.io-client');

const serverUrl = process.argv[2] || 'https://showdown1-production.up.railway.app';
console.log(`🎯 Testing IMMEDIATE DISCONNECT DETECTION on: ${serverUrl}`);

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

async function testImmediateDisconnect() {
  const gameCode = generateGameCode();
  const gameId = `game_${gameCode}`;
  const hostId = generatePlayerId();
  const playerId = generatePlayerId();

  console.log(`\n🎮 Testing with game: ${gameCode}`);

  try {
    // Step 1: Create host that monitors disconnect events
    console.log('\n👑 Creating host with event monitoring...');
    const hostSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    let disconnectDetectedTime = null;
    let playerJoinedTime = null;

    // Monitor all events
    hostSocket.on('player-joined', (data) => {
      playerJoinedTime = Date.now();
      console.log(`\n✅ [HOST] Player joined at ${new Date(playerJoinedTime).toISOString()}`);
      console.log(`   Player: ${data.player.nickname}`);
      console.log(`   Total players: ${data.gameSession.players.length}`);
    });

    hostSocket.on('player-disconnected', (data) => {
      disconnectDetectedTime = Date.now();
      console.log(`\n🔴 [HOST] DISCONNECT DETECTED at ${new Date(disconnectDetectedTime).toISOString()}`);
      console.log(`   Player: ${data.playerNickname}`);
      console.log(`   Reason: ${data.reason}`);
      console.log(`   Players remaining: ${data.gameSession.players.filter(p => p.status === 'connected').length}`);
      
      const detectionTime = disconnectDetectedTime - playerDisconnectTime;
      console.log(`\n⏱️  DETECTION TIME: ${detectionTime}ms (${(detectionTime/1000).toFixed(1)} seconds)`);
      
      if (detectionTime < 10000) {
        console.log('✅ FAST DISCONNECT DETECTION - Working correctly!');
      } else {
        console.log('❌ SLOW DISCONNECT DETECTION - Too slow!');
      }
    });

    await new Promise((resolve, reject) => {
      hostSocket.on('connect', () => {
        console.log('✅ Host connected');
        hostSocket.emit('create-game', {
          gameId: gameId,
          gameCode: gameCode,
          hostId: hostId,
          hostNickname: 'DisconnectTestHost'
        }, (response) => {
          if (response.success) {
            console.log('✅ Game created successfully');
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
    });

    await new Promise((resolve, reject) => {
      playerSocket.on('connect', () => {
        console.log('✅ Player connected');
        playerSocket.emit('join-game', {
          gameCode: gameCode,
          playerId: playerId,
          playerNickname: 'DisconnectTestPlayer'
        }, (response) => {
          if (response.success) {
            console.log('✅ Player joined game');
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

    // Wait for join event to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Disconnect player and measure time
    console.log('\n🔌 DISCONNECTING PLAYER NOW...');
    const playerDisconnectTime = Date.now();
    console.log(`   Disconnect initiated at: ${new Date(playerDisconnectTime).toISOString()}`);
    
    // Close the underlying socket transport to simulate network loss
    playerSocket.io.engine.close();

    // Wait for disconnect detection
    console.log('\n⏳ Waiting for host to detect disconnect...');
    
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (disconnectDetectedTime) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 20 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!disconnectDetectedTime) {
          console.log('❌ TIMEOUT: Disconnect was not detected within 20 seconds!');
        }
        resolve();
      }, 20000);
    });

    // Final summary
    console.log('\n📊 TEST SUMMARY:');
    console.log('================');
    if (disconnectDetectedTime) {
      const totalTime = disconnectDetectedTime - playerDisconnectTime;
      console.log(`✅ Disconnect detected in: ${totalTime}ms (${(totalTime/1000).toFixed(1)} seconds)`);
      
      if (totalTime < 7000) {
        console.log('🎉 EXCELLENT - Detection under 7 seconds!');
      } else if (totalTime < 10000) {
        console.log('✅ GOOD - Detection under 10 seconds');
      } else if (totalTime < 15000) {
        console.log('⚠️  ACCEPTABLE - Detection under 15 seconds');
      } else {
        console.log('❌ TOO SLOW - Detection over 15 seconds');
      }
    } else {
      console.log('❌ FAILED - Disconnect was never detected!');
    }

    // Cleanup
    hostSocket.disconnect();
    if (playerSocket.connected) {
      playerSocket.disconnect();
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

testImmediateDisconnect().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test error:', error);
  process.exit(1);
});