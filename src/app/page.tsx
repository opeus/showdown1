'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateGameResponse, JoinGameResponse } from '@/types/game';
import { isValidGameCode, isValidNickname } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Create game state
  const [hostNickname, setHostNickname] = useState('');

  // Join game state
  const [gameCode, setGameCode] = useState('');
  const [playerNickname, setPlayerNickname] = useState('');

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isValidNickname(hostNickname)) {
      setError('Nickname must be 2-20 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostNickname: hostNickname.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create game');
      }

      const data: CreateGameResponse = await response.json();
      
      // Store player info in localStorage
      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('gameId', data.gameId);
      localStorage.setItem('isHost', 'true');
      
      // Redirect to host lobby
      router.push(`/host/${data.gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isValidGameCode(gameCode.toUpperCase())) {
      setError('Invalid game code format');
      setLoading(false);
      return;
    }

    if (!isValidNickname(playerNickname)) {
      setError('Nickname must be 2-20 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/games/${gameCode.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: playerNickname.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join game');
      }

      const data: JoinGameResponse = await response.json();
      
      // Store player info in localStorage
      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('gameId', data.gameId);
      localStorage.setItem('isHost', 'false');
      
      // Redirect to player lobby
      router.push(`/game/${data.gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
      <div className="row justify-content-center w-100">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="text-center mb-4">
            <h1 className="showdown-logo" style={{ fontSize: '3rem' }}>SHOWDOWN</h1>
            <p className="text-muted">v1.0 - Multiplayer Lobby</p>
          </div>

          <div className="card">
            <div className="card-header">
              <ul className="nav nav-tabs card-header-tabs" role="tablist">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'create' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create')}
                  >
                    Create Game
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'join' ? 'active' : ''}`}
                    onClick={() => setActiveTab('join')}
                  >
                    Join Game
                  </button>
                </li>
              </ul>
            </div>

            <div className="card-body">
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-circle me-2"></i>
                  {error}
                </div>
              )}

              {activeTab === 'create' && (
                <form onSubmit={handleCreateGame}>
                  <div className="mb-3">
                    <label htmlFor="hostNickname" className="form-label">
                      Your Nickname
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="hostNickname"
                      value={hostNickname}
                      onChange={(e) => setHostNickname(e.target.value)}
                      placeholder="Enter your nickname"
                      required
                      disabled={loading}
                      maxLength={20}
                    />
                    <div className="form-text">
                      You'll be the host and can invite others to join.
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-100"
                    disabled={loading || !hostNickname.trim()}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Creating Game...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus-circle me-2"></i>
                        Create Game
                      </>
                    )}
                  </button>
                </form>
              )}

              {activeTab === 'join' && (
                <form onSubmit={handleJoinGame}>
                  <div className="mb-3">
                    <label htmlFor="gameCode" className="form-label">
                      Game Code
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg text-uppercase"
                      id="gameCode"
                      value={gameCode}
                      onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                      placeholder="PARTY42"
                      required
                      disabled={loading}
                      maxLength={8}
                      style={{ letterSpacing: '0.2em' }}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="playerNickname" className="form-label">
                      Your Nickname
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="playerNickname"
                      value={playerNickname}
                      onChange={(e) => setPlayerNickname(e.target.value)}
                      placeholder="Enter your nickname"
                      required
                      disabled={loading}
                      maxLength={20}
                    />
                    <div className="form-text">
                      Choose a unique nickname for this game.
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-100"
                    disabled={loading || !gameCode.trim() || !playerNickname.trim()}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Joining Game...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Join Game
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="text-center mt-4">
            <small className="text-muted">
              Showdown v1.0 - Multiplayer lobby system
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}