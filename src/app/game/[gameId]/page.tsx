'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameSession } from '@/types/game';
import PlayerList from '@/components/PlayerList';

interface PlayerLobbyProps {
  params: { gameId: string };
}

export default function PlayerLobby({ params }: PlayerLobbyProps) {
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

    if (!storedPlayerId || !storedGameId || isHost || storedGameId !== params.gameId) {
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
      // For now, we'll just simulate the player lobby experience
      setError('Real-time features coming in next version');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border spinner-border-lg mb-3" role="status">
            <span className="visually-hidden">Loading game...</span>
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

  // Mock game session for demo purposes
  const mockGameSession: GameSession = {
    id: params.gameId,
    code: 'DEMO123',
    status: 'lobby',
    hostId: 'host123',
    players: [
      {
        id: 'host123',
        nickname: 'Alice',
        isHost: true,
        joinedAt: Date.now() - 60000,
        status: 'connected',
      },
      {
        id: playerId,
        nickname: 'Player',
        isHost: false,
        joinedAt: Date.now(),
        status: 'connected',
      }
    ],
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

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
                  <p className="text-muted mb-0">Game Lobby • Code: {mockGameSession.code}</p>
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
                    You're in the lobby! The host will start the game when ready.
                  </p>
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>Showdown v1.0 Demo</strong> - Game mechanics coming in future versions
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player List */}
          <div className="row">
            <div className="col-12">
              <PlayerList 
                players={mockGameSession.players} 
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
                        Real-time updates will be available in the next version
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