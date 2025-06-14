'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameSession } from '@/types/game';
import PlayerList from '@/components/PlayerList';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { useSocket } from '@/contexts/SocketContext';

interface HostLobbyProps {
  params: { gameId: string };
}

export default function HostLobby({ params }: HostLobbyProps) {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');

  useEffect(() => {
    // Get player info from localStorage
    const storedPlayerId = localStorage.getItem('playerId');
    const storedGameId = localStorage.getItem('gameId');
    const storedGameCode = localStorage.getItem('gameCode');
    const hostNickname = localStorage.getItem('hostNickname');
    const isHost = localStorage.getItem('isHost') === 'true';

    if (!storedPlayerId || !storedGameId || !isHost || storedGameId !== params.gameId || !storedGameCode || !hostNickname) {
      router.push('/');
      return;
    }

    setPlayerId(storedPlayerId);

    if (!socket || !connected) {
      return;
    }

    // Create the game on the server
    socket.emit('create-game', {
      gameId: storedGameId,
      gameCode: storedGameCode,
      hostId: storedPlayerId,
      hostNickname: hostNickname
    }, (response: any) => {
      if (response.success) {
        setGameSession(response.gameSession);
        setLoading(false);
      } else {
        setError(response.error || 'Failed to create game');
        setLoading(false);
      }
    });

    // Listen for real-time updates
    socket.on('player-joined', (data) => {
      console.log('Player joined:', data.player);
      setGameSession(data.gameSession);
    });

    socket.on('player-disconnected', (data) => {
      console.log('Player disconnected:', data.playerId);
      setGameSession(data.gameSession);
    });

    socket.on('player-reconnected', (data) => {
      console.log('Player reconnected:', data.playerId);
      setGameSession(data.gameSession);
    });

    // Cleanup
    return () => {
      socket.off('player-joined');
      socket.off('player-disconnected');
      socket.off('player-reconnected');
    };
  }, [socket, connected, params.gameId, router]);

  const copyGameCode = async () => {
    if (gameSession?.code) {
      try {
        await navigator.clipboard.writeText(gameSession.code);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy game code:', err);
      }
    }
  };

  const copyJoinUrl = async () => {
    if (gameSession?.code) {
      const joinUrl = `${window.location.origin}/join?code=${gameSession.code}`;
      try {
        await navigator.clipboard.writeText(joinUrl);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy join URL:', err);
      }
    }
  };

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
            <span className="visually-hidden">Creating game...</span>
          </div>
          <p className="text-muted">Creating your game...</p>
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
                <h5 className="card-title">Unable to Create Game</h5>
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

  const joinUrl = `${window.location.origin}/join?code=${gameSession.code}`;

  return (
    <div className="container-fluid min-vh-100 py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10">
          {/* Header */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h1 className="showdown-logo h2 mb-1">SHOWDOWN</h1>
                  <p className="text-muted mb-0">Host Lobby</p>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="btn btn-outline-secondary"
                >
                  <i className="bi bi-house me-2"></i>
                  Home
                </button>
              </div>
            </div>
          </div>

          <div className="row">
            {/* Game Code & QR Code */}
            <div className="col-12 col-md-6 mb-4">
              <div className="card h-100">
                <div className="card-header">
                  <h6 className="mb-0">
                    <i className="bi bi-qr-code me-2"></i>
                    Share Your Game
                  </h6>
                </div>
                <div className="card-body text-center">
                  <div className="mb-3">
                    <label className="form-label">Game Code</label>
                    <div className="game-code mb-3">{gameSession.code}</div>
                    <button
                      onClick={copyGameCode}
                      className="btn btn-outline-primary btn-sm"
                    >
                      <i className="bi bi-clipboard me-2"></i>
                      Copy Code
                    </button>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">QR Code</label>
                    <div className="d-flex justify-content-center mb-3">
                      <QRCodeDisplay value={joinUrl} size={180} />
                    </div>
                    <button
                      onClick={copyJoinUrl}
                      className="btn btn-outline-success btn-sm"
                    >
                      <i className="bi bi-link-45deg me-2"></i>
                      Copy Join Link
                    </button>
                  </div>

                  <div className="alert alert-info">
                    <small>
                      <i className="bi bi-info-circle me-2"></i>
                      Share the code or QR code with friends to let them join your game!
                    </small>
                  </div>
                </div>
              </div>
            </div>

            {/* Player List */}
            <div className="col-12 col-md-6 mb-4">
              <PlayerList 
                players={gameSession.players} 
                currentPlayerId={playerId}
              />
            </div>
          </div>

          {/* Game Controls */}
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h6 className="mb-0">
                    <i className="bi bi-gear me-2"></i>
                    Game Controls
                  </h6>
                </div>
                <div className="card-body">
                  <div className="alert alert-success mb-3">
                    <i className="bi bi-lightning-charge me-2"></i>
                    <strong>Real-time Updates Active</strong> - Players join instantly!
                    <small className="d-block mt-1 opacity-75">
                      Powered by Socket.IO for true real-time experience
                    </small>
                  </div>

                  <div className="alert alert-warning mb-3">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>Showdown v1.0</strong> - Game mechanics will be added in future versions.
                  </div>
                  
                  <div className="d-grid gap-2 d-md-flex">
                    <button className="btn btn-secondary" disabled>
                      <i className="bi bi-play-circle me-2"></i>
                      Start Game (Coming Soon)
                    </button>
                    <button 
                      onClick={() => router.push('/')}
                      className="btn btn-outline-danger"
                    >
                      <i className="bi bi-x-circle me-2"></i>
                      End Session
                    </button>
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