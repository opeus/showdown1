import { NextRequest, NextResponse } from 'next/server';
import { GameStorage } from '@/lib/kv';
import { isValidGameCode } from '@/lib/utils';
import { GameInfoResponse } from '@/types/game';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    
    if (!code || !isValidGameCode(code)) {
      return NextResponse.json(
        { error: 'Invalid game code format' },
        { status: 400 }
      );
    }
    
    const gameSession = await GameStorage.getGameByCode(code);
    
    if (!gameSession) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Return public game info (no sensitive data)
    const response: GameInfoResponse = {
      id: gameSession.id,
      code: gameSession.code,
      status: gameSession.status,
      playerCount: gameSession.players.length,
      maxPlayers: 8,
      canJoin: gameSession.status === 'lobby' && gameSession.players.length < 8,
      players: gameSession.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        status: p.status,
      })),
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error getting game:', error);
    return NextResponse.json(
      { error: 'Failed to get game info' },
      { status: 500 }
    );
  }
}