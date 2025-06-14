#!/usr/bin/env node

/**
 * Complete end-to-end test of Showdown game functionality
 * Tests: Host creates game -> Multiple players join -> Real-time updates
 */

const { io } = require('socket.io-client');

const serverUrl = process.env.SERVER_URL || 'https://showdown1-production.up.railway.app';
console.log(`🎯 Testing FULL GAME functionality on: ${serverUrl}`);

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
    forceNew: true,
  });
}

async function testFullGame() {
  const gameCode = generateGameCode();
  const gameId = `game_${gameCode}`;
  
  console.log(`\n🎮 Starting full game test with code: ${gameCode}`);
  
  const testResults = {
    hostConnection: false,
    gameCreation: false,
    playerConnections: [],
    playerJoins: [],
    realTimeUpdates: [],
    errors: []
  };

  try {
    // Step 1: Host creates game
    console.log('\n👑 Step 1: Host creates game');
    const hostResult = await testHostCreateGame(gameCode, gameId);
    testResults.hostConnection = hostResult.connected;
    testResults.gameCreation = hostResult.created;
    if (hostResult.error) testResults.errors.push(hostResult.error);

    if (!hostResult.created) {
      throw new Error('Host failed to create game');
    }

    // Step 2: Multiple players join
    console.log('\n👥 Step 2: Players join game');
    const playerNames = ['Alice', 'Bob', 'Charlie'];
    
    for (let i = 0; i < playerNames.length; i++) {
      const playerResult = await testPlayerJoinGame(gameCode, playerNames[i], i + 1);
      testResults.playerConnections.push(playerResult.connected);
      testResults.playerJoins.push(playerResult.joined);
      if (playerResult.error) testResults.errors.push(playerResult.error);
      
      // Small delay between joins
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 3: Test real-time updates
    console.log('\n⚡ Step 3: Testing real-time updates');
    await new Promise(resolve => setTimeout(resolve, 2000));

    return testResults;

  } catch (error) {
    testResults.errors.push(error.message);
    return testResults;
  }
}

async function testHostCreateGame(gameCode, gameId) {
  return new Promise((resolve) => {
    const socket = createSocket();
    const hostId = generatePlayerId();
    const result = { connected: false, created: false, error: null };

    socket.on('connect', () => {
      console.log('✅ Host connected');
      result.connected = true;
      
      socket.emit('create-game', {
        gameId: gameId,
        gameCode: gameCode,
        hostId: hostId,
        hostNickname: 'GameHost'
      }, (response) => {
        if (response.success) {
          console.log(`✅ Game created: ${gameCode}`);
          result.created = true;
        } else {
          console.log(`❌ Failed to create game: ${response.error}`);
          result.error = response.error;
        }
        socket.disconnect();
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

async function testPlayerJoinGame(gameCode, playerName, playerNum) {
  return new Promise((resolve) => {
    const socket = createSocket();
    const playerId = generatePlayerId();
    const result = { connected: false, joined: false, error: null };

    socket.on('connect', () => {
      console.log(`✅ Player ${playerNum} (${playerName}) connected`);
      result.connected = true;
      
      socket.emit('join-game', {
        gameCode: gameCode,
        playerId: playerId,
        playerNickname: playerName
      }, (response) => {
        if (response.success) {
          console.log(`✅ ${playerName} joined game (${response.gameSession.players.length} total players)`);
          result.joined = true;
        } else {
          console.log(`❌ ${playerName} failed to join: ${response.error}`);
          result.error = response.error;
        }
        
        // Keep connected for a bit to test real-time updates
        setTimeout(() => {
          socket.disconnect();
          resolve(result);
        }, 3000);
      });
    });

    socket.on('connect_error', (error) => {
      console.log(`❌ Player ${playerNum} connection error:`, error.message);
      result.error = error.message;
      resolve(result);
    });

    socket.on('player-joined', (data) => {
      console.log(`🔄 Real-time update: ${data.player.nickname} joined`);
    });

    setTimeout(() => {
      if (!result.connected) {
        result.error = `Player ${playerNum} connection timeout`;
        socket.disconnect();
        resolve(result);
      }
    }, 10000);
  });
}

// Run the full test
console.log('🚀 Starting comprehensive Showdown game test...');

testFullGame()
  .then((results) => {
    console.log('\n📊 FINAL TEST RESULTS:');
    console.log('=====================================');
    console.log(`Host Connection: ${results.hostConnection ? '✅' : '❌'}`);
    console.log(`Game Creation: ${results.gameCreation ? '✅' : '❌'}`);
    console.log(`Player Connections: ${results.playerConnections.filter(Boolean).length}/${results.playerConnections.length} ✅`);
    console.log(`Player Joins: ${results.playerJoins.filter(Boolean).length}/${results.playerJoins.length} ✅`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    const allPassed = results.hostConnection && 
                     results.gameCreation && 
                     results.playerConnections.every(Boolean) && 
                     results.playerJoins.every(Boolean);

    if (allPassed) {
      console.log('\n🎉 ALL TESTS PASSED! Game is working correctly.');
      process.exit(0);
    } else {
      console.log('\n💥 SOME TESTS FAILED! Check the errors above.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test suite error:', error);
    process.exit(1);
  });