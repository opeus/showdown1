import { NextRequest, NextResponse } from 'next/server';

// For Vercel deployment, we'll use a different approach
// Socket.IO doesn't work well with Vercel's serverless functions
// Instead, we'll implement a polling-based real-time system

let gameSubscriptions = new Map<string, Set<string>>();
let gameData = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const { action, gameId, data } = await req.json();

    switch (action) {
      case 'subscribe':
        if (!gameSubscriptions.has(gameId)) {
          gameSubscriptions.set(gameId, new Set());
        }
        gameSubscriptions.get(gameId)!.add(data.playerId);
        return NextResponse.json({ success: true });

      case 'unsubscribe':
        if (gameSubscriptions.has(gameId)) {
          gameSubscriptions.get(gameId)!.delete(data.playerId);
        }
        return NextResponse.json({ success: true });

      case 'update':
        gameData.set(gameId, data);
        console.log(`Updated game ${gameId} with ${data.players?.length || 0} players`);
        return NextResponse.json({ success: true });

      case 'poll':
        const currentData = gameData.get(gameId);
        return NextResponse.json({ data: currentData });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Socket route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const gameId = url.searchParams.get('gameId');
  
  if (!gameId) {
    return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
  }

  const currentData = gameData.get(gameId);
  console.log(`GET request for game ${gameId}, found:`, currentData ? 'data exists' : 'no data');
  return NextResponse.json({ data: currentData || null });
}