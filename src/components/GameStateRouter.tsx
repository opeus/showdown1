'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';
import { GameSession } from '@/types/game';

interface GameStateRouterProps {
  gameId: string;
  currentPage: 'lobby' | 'risk' | 'waiting' | 'results';
  gameSession?: GameSession | null;
  playerId?: string;
  isHost?: boolean;
}

export default function GameStateRouter({ 
  gameId, 
  currentPage, 
  gameSession,
  playerId,
  isHost = false
}: GameStateRouterProps) {
  const router = useRouter();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !gameSession || !playerId) return;

    const currentPlayer = gameSession.players.find(p => p.id === playerId);
    if (!currentPlayer) return;

    // Define where each game status should route players
    const getTargetRoute = (): string | null => {
      switch (gameSession.status) {
        case 'lobby':
          // Always go to lobby when game is in lobby state
          if (currentPage !== 'lobby') {
            return isHost ? `/host/${gameId}` : `/game/${gameId}`;
          }
          break;
          
        case 'round':
          // During a round, route based on player state and round phase
          if (gameSession.riskPhase?.active) {
            // Risk submission phase
            if (currentPlayer.gameStatus === 'active') {
              if (!currentPlayer.hasRisked && currentPage !== 'risk') {
                return `/game/${gameId}/risk`;
              } else if (currentPlayer.hasRisked && currentPage === 'risk') {
                return `/game/${gameId}/waiting`;
              }
            }
          } else if (gameSession.riskPhase?.revealed) {
            // Risks have been revealed, should show results
            if (currentPage !== 'results') {
              return `/game/${gameId}/results`;
            }
          }
          break;
          
        case 'active':
          // Between rounds - should be in lobby/results
          if (currentPage === 'risk' || currentPage === 'waiting') {
            return `/game/${gameId}/results`;
          }
          break;
          
        case 'ended':
          // Game ended - redirect to home
          return '/';
      }
      
      return null;
    };

    const targetRoute = getTargetRoute();
    if (targetRoute) {
      console.log(`🎮 GameStateRouter: Redirecting from ${currentPage} to ${targetRoute} (game status: ${gameSession.status})`);
      router.push(targetRoute);
    }

  }, [socket, gameSession, playerId, isHost, gameId, currentPage, router]);

  // Listen for real-time game state changes
  useEffect(() => {
    if (!socket) return;

    const handleRoundStarted = (data: any) => {
      console.log(`🎮 Round ${data.round} started - routing to risk page`);
      if (currentPage !== 'risk') {
        router.push(`/game/${gameId}/risk`);
      }
    };

    const handleRisksRevealed = (data: any) => {
      console.log('🎭 Risks revealed - routing to results');
      if (currentPage !== 'results') {
        router.push(`/game/${gameId}/results`);
      }
    };

    const handleAllRisksIn = () => {
      console.log('✅ All risks submitted - routing to waiting');
      if (currentPage === 'risk') {
        router.push(`/game/${gameId}/waiting`);
      }
    };

    const handleGameEnded = (data: any) => {
      console.log('🏁 Game ended - routing to home');
      // Clear localStorage
      localStorage.removeItem('gameId');
      localStorage.removeItem('playerId');
      localStorage.removeItem('gameCode');
      localStorage.removeItem('playerNickname');
      localStorage.removeItem('hostNickname');
      localStorage.removeItem('isHost');
      
      router.push('/');
    };

    // Set up event listeners
    socket.on('round-started', handleRoundStarted);
    socket.on('risks-revealed', handleRisksRevealed);
    socket.on('all-risks-in', handleAllRisksIn);
    socket.on('game-ended', handleGameEnded);

    return () => {
      socket.off('round-started', handleRoundStarted);
      socket.off('risks-revealed', handleRisksRevealed);
      socket.off('all-risks-in', handleAllRisksIn);
      socket.off('game-ended', handleGameEnded);
    };
  }, [socket, gameId, currentPage, router]);

  // This component doesn't render anything
  return null;
}