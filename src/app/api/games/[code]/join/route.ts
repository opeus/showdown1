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
    
    // Get game
    const gameSession = await GameStorage.getGameByCode(code);
    
    if (!gameSession) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Check if game can accept players
    if (gameSession.status !== 'lobby') {
      return NextResponse.json(
        { error: 'Game is no longer accepting players' },
        { status: 400 }
      );
    }
    
    if (gameSession.players.length >= 8) {
      return NextResponse.json(
        { error: 'Game is full (8/8 players)' },
        { status: 400 }
      );
    }
    
    // Check if nickname is already taken
    const nicknameExists = gameSession.players.some(
      p => p.nickname.toLowerCase() === nickname.trim().toLowerCase()
    );
    
    if (nicknameExists) {
      return NextResponse.json(
        { error: `Nickname "${nickname.trim()}" is already taken. Please choose another.` },
        { status: 400 }
      );
    }
    
    // Create new player
    const playerId = generatePlayerId();
    const newPlayer: Player = {
      id: playerId,
      nickname: nickname.trim(),
      isHost: false,
      joinedAt: Date.now(),
      status: 'connected',
    };
    
    // Add player to game
    await GameStorage.addPlayerToGame(gameSession.id, newPlayer);
    
    // Return response
    const response: JoinGameResponse = {
      gameId: gameSession.id,
      playerId,
      playerNickname: newPlayer.nickname,
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