import { NextRequest, NextResponse } from 'next/server';
import { GameStorage } from '@/lib/kv';
import { generatePlayerId, isValidGameCode, isValidNickname } from '@/lib/utils';
import { Player, JoinGameResponse } from '@/types/game';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const { nickname } = await request.json();
    
    // Validate input
    if (!code || !isValidGameCode(code)) {
      return NextResponse.json(
        { error: 'Invalid game code format' },
        { status: 400 }
      );
    }
    
    if (!nickname || !isValidNickname(nickname)) {
      return NextResponse.json(
        { error: 'Invalid nickname. Must be 2-20 characters.' },
        { status: 400 }
      );
    }
    
    // For v1.0, we'll accept any valid game code and find the existing game
    // Use a deterministic game ID based on the code
    const gameId = `game_${code}`;
    
    // Create new player
    const playerId = generatePlayerId();
    
    // Create a mock game session with the new player
    const newPlayer: Player = {
      id: playerId,
      nickname: nickname.trim(),
      isHost: false,
      joinedAt: Date.now(),
      status: 'connected',
      points: 100,
      gameStatus: 'active',
      hasRisked: false,
      reentryUsed: false,
      privateCards: [],
    };

    // Try to get existing game data
    let gameSession;
    try {
      const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : 'http://localhost:3000';
        
      const existingResponse = await fetch(`${baseUrl}/api/socket?gameId=${gameId}`);
      if (existingResponse.ok) {
        const existingResult = await existingResponse.json();
        gameSession = existingResult.data;
      }
    } catch (error) {
      console.log('No existing game data found, creating new session');
    }

    // Create or update game session
    if (!gameSession) {
      gameSession = {
        id: gameId,
        code: code,
        status: 'lobby',
        hostId: 'host123',
        players: [
          {
            id: 'host123',
            nickname: 'Host',
            isHost: true,
            joinedAt: Date.now() - 60000,
            status: 'connected',
            points: 100,
            gameStatus: 'active',
            hasRisked: false,
            reentryUsed: false,
            privateCards: [],
          },
          newPlayer
        ],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        pot: 0,
        round: 0,
        communityCards: 0,
        maxCommunityCards: 5,
        gameHistory: [],
      };
    } else {
      // Add player to existing session
      gameSession.players.push(newPlayer);
      gameSession.lastActivity = Date.now();
    }

    // Update real-time system
    try {
      const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
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
      console.error('Failed to update real-time system:', error);
    }
    
    // Return response
    const response: JoinGameResponse = {
      gameId: gameId,
      playerId,
      playerNickname: nickname.trim(),
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error joining game:', error);
    return NextResponse.json(
      { error: 'Failed to join game' },
      { status: 500 }
    );
  }
}