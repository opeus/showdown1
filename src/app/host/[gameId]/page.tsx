'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameSession } from '@/types/game';
import PlayerList from '@/components/PlayerList';
import QRCodeDisplay from '@/components/QRCodeDisplay';

interface HostLobbyProps {
  params: { gameId: string };
}

export default function HostLobby({ params }: HostLobbyProps) {
  const router = useRouter();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');

  useEffect(() => {
    // Get player info from localStorage
    const storedPlayerId = localStorage.getItem('playerId');
    const storedGameId = localStorage.getItem('gameId');
    const isHost = localStorage.getItem('isHost') === 'true';

    if (!storedPlayerId || !storedGameId || !isHost || storedGameId !== params.gameId) {
      router.push('/');
      return;
    }

    setPlayerId(storedPlayerId);
    loadGameSession();
  }, [params.gameId, router]);

  const loadGameSession = async () => {
    try {
      setLoading(true);
      
      // In a real app, we'd have Socket.IO here for real-time updates
      // For now, we'll just fetch the game state
      const response = await fetch(`/api/games/${params.gameId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load game');
      }

      // This would normally come from Socket.IO, but for v1.0 we'll simulate it
      // In the real implementation, we'd have game state from the KV store
      setError('Real-time features coming in next version');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border spinner-border-lg mb-3" role="status">
            <span className="visually-hidden">Loading game...</span>
          </div>
          <p className="text-muted">Loading your game...</p>
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
                <h5 className="card-title">Unable to Load Game</h5>
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

  // Mock game session for demo purposes
  const mockGameSession: GameSession = {
    id: params.gameId,
    code: 'DEMO123',
    status: 'lobby',
    hostId: playerId,
    players: [
      {
        id: playerId,
        nickname: 'Host',
        isHost: true,
        joinedAt: Date.now(),
        status: 'connected',
      }
    ],
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${mockGameSession.code}`;

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
                    <div className="game-code mb-3">{mockGameSession.code}</div>
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
                players={mockGameSession.players} 
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
                  <div className="alert alert-warning">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>Showdown v1.0 Demo</strong> - This version focuses on lobby functionality. 
                    Game mechanics will be added in future versions.
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