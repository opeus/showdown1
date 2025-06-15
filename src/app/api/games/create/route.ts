import { NextRequest, NextResponse } from 'next/server';
import { GameStorage } from '@/lib/kv';
import { generateGameCode, generatePlayerId, isValidNickname } from '@/lib/utils';
import { GameSession, Player, CreateGameResponse } from '@/types/game';

export async function POST(request: NextRequest) {
  try {
    const { hostNickname } = await request.json();
    
    // Validate input
    if (!hostNickname || !isValidNickname(hostNickname)) {
      return NextResponse.json(
        { error: 'Invalid nickname. Must be 2-20 characters.' },
        { status: 400 }
      );
    }
    
    // Generate IDs
    const gameCode = generateGameCode();
    const gameId = `game_${gameCode}`; // Use deterministic game ID based on code
    const playerId = generatePlayerId();
    
    // Create host player
    const hostPlayer: Player = {
      id: playerId,
      nickname: hostNickname.trim(),
      isHost: true,
      joinedAt: Date.now(),
      status: 'connected',
      points: 100,
      gameStatus: 'active',
      hasRisked: false,
      reentryUsed: false,
      privateCards: [],
    };
    
    // Create game session
    const gameSession: GameSession = {
      id: gameId,
      code: gameCode,
      status: 'lobby',
      hostId: playerId,
      players: [hostPlayer],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      pot: 0,
      round: 0,
      communityCards: 0,
      maxCommunityCards: 5,
      gameHistory: [],
    };
    
    // Save to KV storage
    await GameStorage.saveGame(gameSession);

    // Initialize real-time system
    try {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://showdown1-daniel-obriens-projects.vercel.app'
        : 'http://localhost:3000';
      
      await fetch(`${baseUrl}/api/socket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          gameId: gameId,
          data: gameSession,
        }),
      });
    } catch (error) {
      console.error('Failed to initialize real-time system:', error);
    }
    
    // Return response
    const response: CreateGameResponse = {
      gameId,
      gameCode,
      playerId,
      joinUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join?code=${gameCode}`
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 500 }
    );
  }
}