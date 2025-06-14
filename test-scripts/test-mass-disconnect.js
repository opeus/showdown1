#!/usr/bin/env node

/**
 * Stress test for multiple simultaneous disconnections
 * Tests server's ability to handle many players disconnecting and reconnecting
 * Usage: node test-mass-disconnect.js [server-url] [num-players]
 */

const { io } = require('socket.io-client');

const serverUrl = process.argv[2] || 'https://showdown1-production.up.railway.app';
const numPlayers = parseInt(process.argv[3]) || 5;

console.log(`🎯 Testing MASS DISCONNECT/RECONNECT with ${numPlayers} players on: ${serverUrl}`);

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

function createSocket() {
  return io(serverUrl, {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    timeout: 10000,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
    maxReconnectionAttempts: 8,
  });
}

async function createHost(gameCode, gameId) {
  return new Promise((resolve) => {
    const socket = createSocket();
    const hostId = generatePlayerId();
    
    socket.on('connect', () => {
      socket.emit('create-game', {
        gameId: gameId,
        gameCode: gameCode,
        hostId: hostId,
        hostNickname: 'MassTestHost'
      }, (response) => {
        if (response.success) {
          console.log(`✅ Host created game: ${gameCode}`);
          resolve({ success: true, socket, hostId });
        } else {
          console.log(`❌ Host failed to create game: ${response.error}`);
          resolve({ success: false, error: response.error });
        }
      });
    });

    socket.on('connect_error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
}

async function createPlayer(gameCode, playerIndex) {
  return new Promise((resolve) => {
    const socket = createSocket();
    const playerId = generatePlayerId();
    const nickname = `Player${playerIndex}`;
    
    let disconnectCount = 0;
    let reconnectCount = 0;
    let isReconnecting = false;

    const playerState = {
      socket,
      playerId,
      nickname,
      connected: false,
      joined: false,
      disconnectCount: 0,
      reconnectCount: 0,
      currentGameSession: null
    };

    socket.on('connect', () => {
      console.log(`🟢 ${nickname} connected`);
      playerState.connected = true;
      
      if (!playerState.joined) {
        // Initial join
        socket.emit('join-game', {
          gameCode: gameCode,
          playerId: playerId,
          playerNickname: nickname
        }, (response) => {
          if (response.success) {
            console.log(`✅ ${nickname} joined game`);
            playerState.joined = true;
            playerState.currentGameSession = response.gameSession;
          } else {
            console.log(`❌ ${nickname} failed to join: ${response.error}`);
          }
        });
      } else if (isReconnecting) {
        // Reconnection attempt
        const gameId = `game_${gameCode}`;
        socket.emit('reconnect-player', {
          gameId: gameId,
          playerId: playerId
        }, (response) => {
          if (response.success) {
            console.log(`🔄 ${nickname} successfully reconnected`);
            playerState.reconnectCount++;
            playerState.currentGameSession = response.gameSession;
            isReconnecting = false;
          } else {
            console.log(`❌ ${nickname} failed to reconnect: ${response.error}`);
          }
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔴 ${nickname} disconnected: ${reason}`);
      playerState.connected = false;
      playerState.disconnectCount++;
      isReconnecting = true;
    });

    socket.on('reconnect', () => {
      console.log(`🟡 ${nickname} attempting reconnection...`);
    });

    socket.on('connect_error', (error) => {
      console.log(`❌ ${nickname} connection error: ${error.message}`);
    });

    // Return player state after initial connection
    setTimeout(() => {
      resolve(playerState);
    }, 2000);
  });
}

async function simulateMassDisconnect(players) {
  console.log(`\n💥 Simulating mass disconnect of ${players.length} players...`);
  
  // Disconnect all players simultaneously
  const disconnectPromises = players.map((player, index) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`🚫 Force disconnecting ${player.nickname}...`);
        player.socket.disconnect();
        resolve();
      }, index * 100); // Stagger disconnects slightly
    });
  });

  await Promise.all(disconnectPromises);
  
  console.log('⏳ Waiting for automatic reconnections...');
  
  // Wait and check reconnection status
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  return players.map(player => ({
    nickname: player.nickname,
    connected: player.socket.connected,
    disconnectCount: player.disconnectCount,
    reconnectCount: player.reconnectCount,
    joined: player.joined
  }));
}

async function testMassDisconnect() {
  const gameCode = generateGameCode();
  const gameId = `game_${gameCode}`;
  
  console.log(`\n🎮 Starting mass disconnect test with game: ${gameCode}`);
  
  try {
    // Step 1: Create host
    console.log('\n👑 Step 1: Creating host...');
    const hostResult = await createHost(gameCode, gameId);
    if (!hostResult.success) {
      throw new Error(`Host creation failed: ${hostResult.error}`);
    }

    // Step 2: Create multiple players
    console.log(`\n👥 Step 2: Creating ${numPlayers} players...`);
    const playerPromises = [];
    for (let i = 1; i <= numPlayers; i++) {
      playerPromises.push(createPlayer(gameCode, i));
    }
    
    const players = await Promise.all(playerPromises);
    console.log(`✅ Created ${players.length} players`);

    // Wait for all to settle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Mass disconnect and reconnect
    const reconnectResults = await simulateMassDisconnect(players);

    // Step 4: Analyze results
    console.log('\n📊 MASS DISCONNECT TEST RESULTS:');
    console.log('==================================');
    
    let successfulReconnects = 0;
    let totalDisconnects = 0;
    
    reconnectResults.forEach(result => {
      console.log(`${result.nickname}: ${result.connected ? '🟢' : '🔴'} | Disconnects: ${result.disconnectCount} | Reconnects: ${result.reconnectCount}`);
      totalDisconnects += result.disconnectCount;
      if (result.connected && result.reconnectCount > 0) {
        successfulReconnects++;
      }
    });

    const reconnectRate = (successfulReconnects / players.length) * 100;
    
    console.log(`\n📈 Summary:`);
    console.log(`Players: ${players.length}`);
    console.log(`Total disconnects: ${totalDisconnects}`);
    console.log(`Successful reconnects: ${successfulReconnects}/${players.length}`);
    console.log(`Reconnection rate: ${reconnectRate.toFixed(1)}%`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up connections...');
    players.forEach(player => {
      if (player.socket) {
        player.socket.disconnect();
      }
    });
    
    if (hostResult.socket) {
      hostResult.socket.disconnect();
    }

    if (reconnectRate >= 80) {
      console.log('\n🎉 MASS DISCONNECT TEST PASSED!');
      console.log('💪 Server handled mass disconnections well.');
      return true;
    } else {
      console.log('\n⚠️ MASS DISCONNECT TEST NEEDS IMPROVEMENT');
      console.log(`Reconnection rate ${reconnectRate.toFixed(1)}% is below 80% threshold.`);
      return false;
    }

  } catch (error) {
    console.error('💥 Mass disconnect test error:', error);
    return false;
  }
}

// Run the test
console.log('🚀 Starting mass disconnect stress test...');

testMassDisconnect()
  .then((success) => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test suite error:', error);
    process.exit(1);
  });