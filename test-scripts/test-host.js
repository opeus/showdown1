#!/usr/bin/env node

/**
 * Test script to simulate host creating a game
 * Usage: node test-host.js [server-url]
 */

const { io } = require('socket.io-client');

const serverUrl = process.argv[2] || 'https://showdown1-production.up.railway.app';
console.log(`🎯 Testing HOST functionality on: ${serverUrl}`);

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

async function testHost() {
  return new Promise((resolve, reject) => {
    console.log('\n📡 Connecting to Socket.IO server...');
    
    const socket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
    });

    const gameCode = generateGameCode();
    const gameId = `game_${gameCode}`;
    const hostId = generatePlayerId();
    const hostNickname = 'TestHost';

    let testResults = {
      connection: false,
      gameCreation: false,
      gameSession: null,
      errors: []
    };

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      testResults.connection = true;
      
      console.log('\n🎮 Creating game...');
      console.log(`Game Code: ${gameCode}`);
      console.log(`Host Nickname: ${hostNickname}`);
      
      socket.emit('create-game', {
        gameId: gameId,
        gameCode: gameCode,
        hostId: hostId,
        hostNickname: hostNickname
      }, (response) => {
        if (response.success) {
          console.log('✅ Game created successfully!');
          console.log(`Game ID: ${response.gameSession.id}`);
          console.log(`Players: ${response.gameSession.players.length}`);
          console.log(`Host: ${response.gameSession.players[0].nickname}`);
          
          testResults.gameCreation = true;
          testResults.gameSession = response.gameSession;
          
          // Wait a bit for any additional events
          setTimeout(() => {
            console.log('\n📊 Test Results:');
            console.log(`Connection: ${testResults.connection ? '✅' : '❌'}`);
            console.log(`Game Creation: ${testResults.gameCreation ? '✅' : '❌'}`);
            if (testResults.errors.length > 0) {
              console.log('❌ Errors:', testResults.errors);
            }
            
            socket.disconnect();
            resolve(testResults);
          }, 2000);
        } else {
          console.log('❌ Failed to create game:', response.error);
          testResults.errors.push(response.error);
          socket.disconnect();
          resolve(testResults);
        }
      });
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Connection error:', error.message);
      testResults.errors.push(`Connection error: ${error.message}`);
      resolve(testResults);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
    });

    socket.on('player-joined', (data) => {
      console.log('👤 Player joined:', data.player.nickname);
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!testResults.connection) {
        console.log('⏱️ Connection timeout');
        testResults.errors.push('Connection timeout');
        socket.disconnect();
        resolve(testResults);
      }
    }, 15000);
  });
}

// Run the test
testHost()
  .then((results) => {
    console.log('\n🏁 Test completed');
    if (results.connection && results.gameCreation) {
      console.log('🎉 HOST TEST PASSED');
      process.exit(0);
    } else {
      console.log('💥 HOST TEST FAILED');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test error:', error);
    process.exit(1);
  });