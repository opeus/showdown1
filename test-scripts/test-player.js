#!/usr/bin/env node

/**
 * Test script to simulate player joining a game
 * Usage: node test-player.js [server-url] [game-code] [nickname]
 */

const { io } = require('socket.io-client');

const serverUrl = process.argv[2] || 'https://showdown1-production.up.railway.app';
const gameCode = process.argv[3] || 'DEMO1234';
const playerNickname = process.argv[4] || 'TestPlayer';

console.log(`🎯 Testing PLAYER functionality on: ${serverUrl}`);
console.log(`🎮 Joining game: ${gameCode} as "${playerNickname}"`);

function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substr(2, 9);
}

async function testPlayer() {
  return new Promise((resolve, reject) => {
    console.log('\n📡 Connecting to Socket.IO server...');
    
    const socket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
    });

    const playerId = generatePlayerId();

    let testResults = {
      connection: false,
      gameJoin: false,
      gameSession: null,
      errors: []
    };

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      testResults.connection = true;
      
      console.log('\n🚪 Joining game...');
      console.log(`Player ID: ${playerId}`);
      
      socket.emit('join-game', {
        gameCode: gameCode,
        playerId: playerId,
        playerNickname: playerNickname
      }, (response) => {
        if (response.success) {
          console.log('✅ Joined game successfully!');
          console.log(`Game ID: ${response.gameId}`);
          console.log(`Players in game: ${response.gameSession.players.length}`);
          response.gameSession.players.forEach((player, i) => {
            console.log(`  ${i + 1}. ${player.nickname} ${player.isHost ? '(Host)' : ''}`);
          });
          
          testResults.gameJoin = true;
          testResults.gameSession = response.gameSession;
          
          // Wait for any additional events
          setTimeout(() => {
            console.log('\n📊 Test Results:');
            console.log(`Connection: ${testResults.connection ? '✅' : '❌'}`);
            console.log(`Game Join: ${testResults.gameJoin ? '✅' : '❌'}`);
            if (testResults.errors.length > 0) {
              console.log('❌ Errors:', testResults.errors);
            }
            
            socket.disconnect();
            resolve(testResults);
          }, 2000);
        } else {
          console.log('❌ Failed to join game:', response.error);
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
      console.log('👤 Another player joined:', data.player.nickname);
    });

    socket.on('player-disconnected', (data) => {
      console.log('👋 Player disconnected:', data.playerId);
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
testPlayer()
  .then((results) => {
    console.log('\n🏁 Test completed');
    if (results.connection && results.gameJoin) {
      console.log('🎉 PLAYER TEST PASSED');
      process.exit(0);
    } else {
      console.log('💥 PLAYER TEST FAILED');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Test error:', error);
    process.exit(1);
  });