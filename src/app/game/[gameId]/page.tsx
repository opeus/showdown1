'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameSession } from '@/types/game';
import PlayerList from '@/components/PlayerList';
import { useSocket } from '@/contexts/SocketContext';

interface PlayerLobbyProps {
  params: { gameId: string };
}

export default function PlayerLobby({ params }: PlayerLobbyProps) {
  const router = useRouter();
  const { socket, connected, connectionStatus } = useSocket();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');

  useEffect(() => {
    // Get player info from localStorage
    const storedPlayerId = localStorage.getItem('playerId');
    const storedGameId = localStorage.getItem('gameId');
    const storedGameCode = localStorage.getItem('gameCode');
    const playerNickname = localStorage.getItem('playerNickname');
    const isHost = localStorage.getItem('isHost') === 'true';

    if (!storedPlayerId || !storedGameId || isHost || storedGameId !== params.gameId || !storedGameCode || !playerNickname) {
      router.push('/');
      return;
    }

    setPlayerId(storedPlayerId);

    if (!socket || !connected) {
      return;
    }

    // Join the game
    socket.emit('join-game', {
      gameCode: storedGameCode,
      playerId: storedPlayerId,
      playerNickname: playerNickname
    }, (response: any) => {
      if (response.success) {
        setGameSession(response.gameSession);
        setLoading(false);
      } else {
        setError(response.error || 'Failed to join game');
        setLoading(false);
      }
    });

    // Listen for real-time updates
    socket.on('player-joined', (data) => {
      console.log('✅ Another player joined:', data.player.nickname);
      setGameSession(data.gameSession);
    });

    socket.on('player-disconnected', (data) => {
      console.log('❌ Player disconnected:', data.playerNickname, 'Reason:', data.reason);
      setGameSession(data.gameSession);
    });

    socket.on('player-reconnected', (data) => {
      console.log('🔄 Player reconnected:', data.playerNickname);
      setGameSession(data.gameSession);
    });

    socket.on('game-update', (updatedGameSession) => {
      console.log('🎮 Game session updated');
      setGameSession(updatedGameSession);
    });

    // Cleanup
    return () => {
      socket.off('player-joined');
      socket.off('player-disconnected');
      socket.off('player-reconnected');
      socket.off('game-update');
    };
  }, [socket, connected, params.gameId, router]);

  if (!connected) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border spinner-border-lg mb-3" role="status">
            <span className="visually-hidden">Connecting...</span>
          </div>
          <p className="text-muted">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border spinner-border-lg mb-3" role="status">
            <span className="visually-hidden">Joining game...</span>
          </div>
          <p className="text-muted">Joining game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
        <div className="row justify-content-center">
          <div className="col-12 col-md-6">
            <div className="card">
              <div className="card-body text-center">
                <i className="bi bi-exclamation-triangle text-warning fs-1 mb-3"></i>
                <h5 className="card-title">Unable to Join Game</h5>
                <p className="card-text text-muted">{error}</p>
                <button
                  onClick={() => router.push('/')}
                  className="btn btn-primary"
                >
                  <i className="bi bi-house me-2"></i>
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameSession) {
    return null;
  }

  return (
    <div className="container-fluid min-vh-100 py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-8">
          {/* Header */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h1 className="showdown-logo h2 mb-1">SHOWDOWN</h1>
                  <p className="text-muted mb-0">Game Lobby • Code: {gameSession.code}</p>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="btn btn-outline-secondary"
                >
                  <i className="bi bi-box-arrow-left me-2"></i>
                  Leave
                </button>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-body text-center">
                  <i className="bi bi-clock-history text-warning fs-1 mb-3"></i>
                  <h5>Waiting for Host</h5>
                  <p className="text-muted mb-3">
                    You&apos;re in the lobby! The host will start the game when ready.
                  </p>
                  <div className="alert alert-success">
                    <i className="bi bi-lightning-charge me-2"></i>
                    <strong>Real-time Connection Active</strong> - Updates appear instantly!
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player List */}
          <div className="row">
            <div className="col-12">
              <PlayerList 
                players={gameSession.players} 
                currentPlayerId={playerId}
              />
            </div>
          </div>

          {/* Connection Status */}
          <div className="row mt-4">
            <div className="col-12">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-wifi text-success me-3 fs-4"></i>
                    <div>
                      <h6 className="mb-1">Connected to Game</h6>
                      <small className="text-muted">
                        Powered by Socket.IO for instant updates
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}