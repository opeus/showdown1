#!/usr/bin/env node

/**
 * Test script to simulate player disconnections and reconnections
 * Usage: node test-disconnect.js [server-url]
 */

const { io } = require('socket.io-client');

const serverUrl = process.argv[2] || 'https://showdown1-production.up.railway.app';
console.log(`🎯 Testing DISCONNECT/RECONNECT functionality on: ${serverUrl}`);

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
    reconnectionDelay: 1000,
    reconnectionDelayMax: 3000,
    maxReconnectionAttempts: 5,
  });
}

async function testDisconnectReconnect() {
  const gameCode = generateGameCode();
  const gameId = `game_${gameCode}`;
  
  console.log(`\n🎮 Starting disconnect/reconnect test with game: ${gameCode}`);
  
  const testResults = {
    hostConnection: false,
    gameCreation: false,
    playerConnection: false,
    playerJoin: false,
    disconnectionDetected: false,
    reconnectionSuccessful: false,
    gameStatePreserved: false,
    errors: []
  };

  try {
    // Step 1: Host creates game
    console.log('\n👑 Step 1: Host creates game');
    const hostResult = await createHost(gameCode, gameId);
    testResults.hostConnection = hostResult.connected;
    testResults.gameCreation = hostResult.created;
    if (hostResult.error) testResults.errors.push(hostResult.error);

    if (!hostResult.created) {
      throw new Error('Host failed to create game');
    }

    // Step 2: Player joins game
    console.log('\n👥 Step 2: Player joins game');
    const playerResult = await createPlayer(gameCode);
    testResults.playerConnection = playerResult.connected;
    testResults.playerJoin = playerResult.joined;
    if (playerResult.error) testResults.errors.push(playerResult.error);

    if (!playerResult.joined) {
      throw new Error('Player failed to join game');
    }

    // Step 3: Simulate disconnect and test reconnection
    console.log('\n🔌 Step 3: Simulating player disconnect and reconnection...');
    const disconnectResult = await simulateDisconnect(playerResult.socket, gameCode, playerResult.playerId);
    testResults.disconnectionDetected = disconnectResult.disconnectDetected;
    testResults.reconnectionSuccessful = disconnectResult.reconnectionSuccessful;
    testResults.gameStatePreserved = disconnectResult.gameStatePreserved;
    if (disconnectResult.error) testResults.errors.push(disconnectResult.error);

    return testResults;

  } catch (error) {
    testResults.errors.push(error.message);
    return testResults;
  }
}

async function createHost(gameCode, gameId) {
  return new Promise((resolve) => {
    const socket = createSocket();
    const hostId = generatePlayerId();
    const result = { connected: false, created: false, error: null, socket: null };

    socket.on('connect', () => {
      console.log('✅ Host connected');
      result.connected = true;
      
      socket.emit('create-game', {
        gameId: gameId,
        gameCode: gameCode,
        hostId: hostId,
        hostNickname: 'DisconnectTestHost'
      }, (response) => {
        if (response.success) {
          console.log(`✅ Game created: ${gameCode}`);
          result.created = true;
          result.socket = socket;
        } else {
          console.log(`❌ Failed to create game: ${response.error}`);
          result.error = response.error;
          socket.disconnect();
        }
        resolve(result);
      });
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Host connection error:', error.message);
      result.error = error.message;
      resolve(result);
    });

    setTimeout(() => {
      if (!result.connected) {
        result.error = 'Host connection timeout';
        socket.disconnect();
        resolve(result);
      }
    }, 10000);
  });
}

async function createPlayer(gameCode) {
  return new Promise((resolve) => {
    const socket = createSocket();
    const playerId = generatePlayerId();
    const result = { connected: false, joined: false, error: null, socket: null, playerId: null };

    socket.on('connect', () => {
      console.log('✅ Player connected');
      result.connected = true;
      
      socket.emit('join-game', {
        gameCode: gameCode,
        playerId: playerId,
        playerNickname: 'DisconnectTestPlayer'
      }, (response) => {
        if (response.success) {
          console.log(`✅ Player joined game`);
          result.joined = true;
          result.socket = socket;
          result.playerId = playerId;
        } else {
          console.log(`❌ Player failed to join: ${response.error}`);
          result.error = response.error;
          socket.disconnect();
        }
        resolve(result);
      });
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Player connection error:', error.message);
      result.error = error.message;
      resolve(result);
    });

    setTimeout(() => {
      if (!result.connected) {
        result.error = 'Player connection timeout';
        socket.disconnect();
        resolve(result);
      }
    }, 10000);
  });
}

async function simulateDisconnect(playerSocket, gameCode, playerId) {
  return new Promise((resolve) => {
    const result = {
      disconnectDetected: false,
      reconnectionSuccessful: false,
      gameStatePreserved: false,
      error: null
    };

    let disconnectDetected = false;
    let reconnectionAttempted = false;

    // Listen for disconnect detection
    playerSocket.on('disconnect', (reason) => {
      console.log('🔌 Player disconnected:', reason);
      disconnectDetected = true;
      result.disconnectDetected = true;
    });

    // Listen for reconnection
    playerSocket.on('reconnect', () => {
      console.log('🔄 Player reconnected automatically');
      
      if (!reconnectionAttempted) {
        reconnectionAttempted = true;
        
        // Try to rejoin the game
        const gameId = `game_${gameCode}`;
        playerSocket.emit('reconnect-player', {
          gameId: gameId,
          playerId: playerId
        }, (response) => {
          if (response.success) {
            console.log('✅ Player successfully rejoined game after reconnection');
            result.reconnectionSuccessful = true;
            result.gameStatePreserved = response.gameSession && response.gameSession.players.length > 0;
            
            setTimeout(() => {
              playerSocket.disconnect();
              resolve(result);
            }, 1000);
          } else {
            console.log('❌ Failed to rejoin game:', response.error);
            result.error = response.error;
            resolve(result);
          }
        });
      }
    });

    playerSocket.on('reconnect_failed', () => {
      console.log('💥 Reconnection failed');
      result.error = 'Reconnection failed';
      resolve(result);
    });

    // Force disconnect to simulate network issue
    console.log('🚫 Forcing player disconnect...');
    playerSocket.disconnect();
    
    // Give some time for disconnect detection
    setTimeout(() => {
      if (!disconnectDetected) {
        result.error = 'Disconnect not detected within timeout';
        resolve(result);
      }
    }, 5000);

    // Overall timeout
    setTimeout(() => {
      if (!result.reconnectionSuccessful && !result.error) {
        result.error = 'Reconnection timeout';
        resolve(result);
      }
    }, 15000);
  });
}

// Run the test
console.log('🚀 Starting disconnect/reconnect test...');

testDisconnectReconnect()
  .then((results) => {
    console.log('\n📊 DISCONNECT/RECONNECT TEST RESULTS:');
    console.log('=========================================');
    console.log(`Host Connection: ${results.hostConnection ? '✅' : '❌'}`);
    console.log(`Game Creation: ${results.gameCreation ? '✅' : '❌'}`);
    console.log(`Player Connection: ${results.playerConnection ? '✅' : '❌'}`);
    console.log(`Player Join: ${results.playerJoin ? '✅' : '❌'}`);
    console.log(`Disconnection Detected: ${results.disconnectionDetected ? '✅' : '❌'}`);
    console.log(`Reconnection Successful: ${results.reconnectionSuccessful ? '✅' : '❌'}`);
    console.log(`Game State Preserved: ${results.gameStatePreserved ? '✅' : '❌'}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    const allPassed = results.hostConnection && 
                     results.gameCreation && 
                     results.playerConnection && 
                     results.playerJoin &&
                     results.disconnectionDetected &&
                     results.reconnectionSuccessful &&
                     results.gameStatePreserved;

    if (allPassed) {
      console.log('\n🎉 ALL DISCONNECT/RECONNECT TESTS PASSED!');
      console.log('💪 Network resilience is working correctly.');
      process.exit(0);
    } else {
      console.log('\n💥 SOME DISCONNECT/RECONNECT TESTS FAILED!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test suite error:', error);
    process.exit(1);
  });