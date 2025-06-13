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
    const gameId = generatePlayerId();
    const playerId = generatePlayerId();
    const gameCode = generateGameCode();
    
    // Create host player
    const hostPlayer: Player = {
      id: playerId,
      nickname: hostNickname.trim(),
      isHost: true,
      joinedAt: Date.now(),
      status: 'connected',
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
    };
    
    // Save to KV storage
    await GameStorage.saveGame(gameSession);
    
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