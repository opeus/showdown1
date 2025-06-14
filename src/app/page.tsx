'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreateGameResponse, JoinGameResponse } from '@/types/game';
import { isValidGameCode, isValidNickname, generateGameCode, generatePlayerId } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Create game state
  const [hostNickname, setHostNickname] = useState('');

  // Join game state
  const [gameCode, setGameCode] = useState('');
  const [playerNickname, setPlayerNickname] = useState('');

  // Check URL parameters on mount
  useEffect(() => {
    const code = searchParams.get('code');
    const tab = searchParams.get('tab');
    
    if (code) {
      const cleanCode = code.trim().toUpperCase();
      setGameCode(cleanCode);
      console.log('QR Code detected:', { original: code, cleaned: cleanCode, valid: isValidGameCode(cleanCode) });
    }
    if (tab === 'join') {
      setActiveTab('join');
    }
  }, [searchParams]);

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
      // Generate game data
      const gameCode = generateGameCode();
      const gameId = `game_${gameCode}`;
      const playerId = generatePlayerId();
      
      // Store player info in localStorage
      localStorage.setItem('playerId', playerId);
      localStorage.setItem('gameId', gameId);
      localStorage.setItem('gameCode', gameCode);
      localStorage.setItem('isHost', 'true');
      localStorage.setItem('hostNickname', hostNickname.trim());
      
      // Redirect to host lobby (Socket.IO connection will be established there)
      router.push(`/host/${gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
      setLoading(false);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanGameCode = gameCode.trim().toUpperCase();
    if (!isValidGameCode(cleanGameCode)) {
      setError('Invalid game code format. Must be 8 characters (letters and numbers only)');
      setLoading(false);
      return;
    }

    if (!isValidNickname(playerNickname)) {
      setError('Nickname must be 2-20 characters');
      setLoading(false);
      return;
    }

    try {
      // Generate player data
      const gameId = `game_${cleanGameCode}`;
      const playerId = generatePlayerId();
      
      // Store player info in localStorage
      localStorage.setItem('playerId', playerId);
      localStorage.setItem('gameId', gameId);
      localStorage.setItem('gameCode', cleanGameCode);
      localStorage.setItem('playerNickname', playerNickname.trim());
      localStorage.setItem('isHost', 'false');
      
      // Redirect to player lobby (Socket.IO will handle the actual join)
      router.push(`/game/${gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
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
                      You&apos;ll be the host and can invite others to join.
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