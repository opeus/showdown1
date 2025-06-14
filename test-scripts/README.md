# Showdown Test Scripts

This directory contains comprehensive test scripts to validate the Showdown game functionality.

## Setup

```bash
cd test-scripts
npm install
```

## Test Scripts

### 1. Host Test (`test-host.js`)
Tests host creating a game:
```bash
npm run test:host
# or
node test-host.js [server-url]
```

### 2. Player Test (`test-player.js`)
Tests player joining an existing game:
```bash
npm run test:player
# or
node test-player.js [server-url] [game-code] [nickname]
```

### 3. Full Game Test (`test-full-game.js`)
Complete end-to-end test with multiple players:
```bash
npm run test:full
# or for local testing:
npm run test:local
# or for Railway testing:
npm run test:railway
```

## What the Tests Validate

### Host Test
- ✅ Socket.IO connection to server
- ✅ Game creation functionality
- ✅ Host player registration
- ✅ Game session data structure

### Player Test
- ✅ Socket.IO connection to server
- ✅ Game joining functionality
- ✅ Nickname validation
- ✅ Player registration in existing game

### Full Game Test
- ✅ Host creates game
- ✅ Multiple players join sequentially
- ✅ Real-time updates when players join
- ✅ Socket.IO event handling
- ✅ Game state persistence

## Expected Output

### Successful Test
```
🎯 Testing FULL GAME functionality on: https://showdown1-production.up.railway.app
🎮 Starting full game test with code: ABC12345

👑 Step 1: Host creates game
✅ Host connected
✅ Game created: ABC12345

👥 Step 2: Players join game
✅ Player 1 (Alice) connected
✅ Alice joined game (2 total players)
✅ Player 2 (Bob) connected
✅ Bob joined game (3 total players)
✅ Player 3 (Charlie) connected
✅ Charlie joined game (4 total players)

📊 FINAL TEST RESULTS:
=====================================
Host Connection: ✅
Game Creation: ✅
Player Connections: 3/3 ✅
Player Joins: 3/3 ✅

🎉 ALL TESTS PASSED! Game is working correctly.
```

### Failed Test
The tests will show specific error messages and exit with code 1 if any functionality fails.

## Usage Examples

```bash
# Test against Railway deployment
node test-full-game.js

# Test against local development server
SERVER_URL=http://localhost:3000 node test-full-game.js

# Test specific game code as player
node test-player.js https://showdown1-production.up.railway.app DEMO1234 MyNickname

# Test host functionality only
node test-host.js https://showdown1-production.up.railway.app
```

## Troubleshooting

If tests fail, check:
1. Server is running and accessible
2. Socket.IO is properly configured
3. CORS settings allow your test environment
4. Database connectivity (if using Prisma)
5. Network connectivity to the server

The test scripts include detailed logging to help diagnose issues.