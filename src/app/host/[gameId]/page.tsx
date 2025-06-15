'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameSession } from '@/types/game';
import PlayerList from '@/components/PlayerList';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { useSocket } from '@/contexts/SocketContext';
import Toast from '@/components/Toast';
import DebugPanel from '@/components/DebugPanel';
import GameTimer from '@/components/GameTimer';
import GameStateRouter from '@/components/GameStateRouter';

interface HostLobbyProps {
  params: { gameId: string };
}

export default function HostLobby({ params }: HostLobbyProps) {
  const router = useRouter();
  const { socket, connected, connectionStatus } = useSocket();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' | 'info' } | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    addDebugLog('HOST PAGE: useEffect triggered');
    console.log('🎮 HOST PAGE: useEffect triggered');
    console.log('🎮 HOST PAGE: socket:', !!socket);
    console.log('🎮 HOST PAGE: connected:', connected);
    console.log('🎮 HOST PAGE: connectionStatus:', connectionStatus);
    
    // Get player info from localStorage
    const storedPlayerId = localStorage.getItem('playerId');
    const storedGameId = localStorage.getItem('gameId');
    const storedGameCode = localStorage.getItem('gameCode');
    const hostNickname = localStorage.getItem('hostNickname');
    const isHost = localStorage.getItem('isHost') === 'true';

    addDebugLog(`localStorage: playerId=${!!storedPlayerId}, gameId=${!!storedGameId}, isHost=${isHost}`);

    if (!storedPlayerId || !storedGameId || !isHost || storedGameId !== params.gameId || !storedGameCode || !hostNickname) {
      addDebugLog('VALIDATION FAILED: Missing required data, redirecting to home');
      router.push('/');
      return;
    }

    setPlayerId(storedPlayerId);

    if (!socket || (!connected && connectionStatus === 'disconnected')) {
      addDebugLog('Socket not ready, waiting...');
      return;
    }

    addDebugLog('Attempting reconnect-host...');
    
    socket.emit('reconnect-host', {
      gameId: storedGameId,
      hostId: storedPlayerId
    }, (response: any) => {
      addDebugLog(`reconnect-host response: success=${response.success}, roleChanged=${response.roleChanged}`);
      
      if (response.success) {
        // Check if role changed (no longer host)
        if (response.roleChanged) {
          addDebugLog('ROLE CHANGED: No longer host, redirecting to player page');
          
          // Update localStorage
          localStorage.setItem('isHost', 'false');
          
          // Show toast and redirect
          setToast({ message: response.message, type: 'info' });
          setLoading(false);
          
          addDebugLog('Starting 2s redirect timer to player page');
          setTimeout(() => {
            addDebugLog('Redirecting to player page now');
            window.location.href = `/game/${params.gameId}`;
          }, 2000);
          return;
        }
        
        addDebugLog('Reconnected successfully as host');
        setGameSession(response.gameSession);
        setLoading(false);
      } else {
        addDebugLog(`Reconnect failed: ${response.error}, trying create-game`);
        // Reconnect failed, try creating fresh game
        socket.emit('create-game', {
          gameId: storedGameId,
          gameCode: storedGameCode,
          hostId: storedPlayerId,
          hostNickname: hostNickname
        }, (createResponse: any) => {
          console.log('🎮 HOST PAGE: Create game response:', createResponse);
          if (createResponse.success) {
            console.log('🎮 HOST PAGE: New game created successfully!');
            setGameSession(createResponse.gameSession);
            setLoading(false);
          } else {
            console.log('🎮 HOST PAGE: Game creation failed:', createResponse.error);
            setError(createResponse.error || 'Failed to create game');
            setLoading(false);
          }
        });
      }
    });

    // Listen for real-time updates
    socket.on('player-joined', (data) => {
      console.log('✅ Player joined:', data.player.nickname);
      setGameSession(data.gameSession);
    });

    socket.on('player-disconnected', (data) => {
      console.log('❌ PLAYER DISCONNECTED EVENT RECEIVED');
      console.log('   Player:', data.playerNickname);
      console.log('   Reason:', data.reason);
      console.log('   Time:', new Date(data.disconnectTime).toISOString());
      console.log('   Game players:', data.gameSession.players.map((p: any) => 
        `${p.nickname} (${p.status})`
      ).join(', '));
      
      setGameSession(data.gameSession);
    });

    socket.on('player-reconnected', (data) => {
      console.log('🔄 Player reconnected:', data.playerNickname);
      setGameSession(data.gameSession);
    });

    socket.on('player-status-changed', (data) => {
      console.log(`🔄 Player status changed: ${data.playerNickname} is now ${data.status}`);
      setGameSession(data.gameSession);
    });

    // Handle game session updates
    socket.on('game-update', (updatedGameSession) => {
      console.log('🎮 Game session updated');
      setGameSession(updatedGameSession);
    });

    socket.on('player-left', (data) => {
      console.log('🚪 Player left game:', data.playerNickname, 'Reason:', data.reason);
      setGameSession(data.gameSession);
    });

    // Gameplay event listeners
    socket.on('round-started', (data) => {
      console.log(`🎮 Round ${data.round} started`);
      setToast({ message: `Round ${data.round} started!`, type: 'success' });
    });

    socket.on('community-card-dealt', (data) => {
      console.log(`🃏 Community card ${data.cardNumber} dealt`);
    });

    socket.on('risk-submitted', (data) => {
      console.log(`💰 ${data.playerNickname} submitted their risk`);
      setToast({ message: `${data.playerNickname} submitted their risk`, type: 'info' });
    });

    socket.on('all-risks-in', () => {
      console.log('🎯 All players have submitted risks');
      setToast({ message: 'All players have submitted risks - ready to reveal!', type: 'warning' });
    });

    socket.on('risks-revealed', (data) => {
      console.log('🎭 Risks revealed:', data);
      setToast({ message: `${data.eliminated.length} player(s) eliminated!`, type: 'success' });
    });

    // Cleanup
    return () => {
      socket.off('player-joined');
      socket.off('player-disconnected');
      socket.off('player-reconnected');
      socket.off('player-status-changed');
      socket.off('player-left');
      socket.off('game-update');
      socket.off('round-started');
      socket.off('community-card-dealt');
      socket.off('risk-submitted');
      socket.off('all-risks-in');
      socket.off('risks-revealed');
    };
  }, [socket, connected, connectionStatus, params.gameId, router]);

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

  if (!connected && connectionStatus === 'disconnected') {
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
    <>
      <GameStateRouter 
        gameId={params.gameId}
        currentPage="lobby"
        gameSession={gameSession}
        playerId={playerId}
        isHost={true}
      />
      
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
                  {/* Game Status Info */}
                  <div className="row mb-3">
                    <div className="col-2 text-center">
                      <div className="h5 mb-0 text-info">{gameSession.round}</div>
                      <small className="text-muted">Round</small>
                    </div>
                    <div className="col-2 text-center">
                      <div className="h5 mb-0 text-success">💎 {gameSession.pot}</div>
                      <small className="text-muted">Pot</small>
                    </div>
                    <div className="col-2 text-center">
                      <div className="h5 mb-0 text-warning">{gameSession.communityCards}/5</div>
                      <small className="text-muted">Cards</small>
                    </div>
                    <div className="col-2 text-center">
                      <div className="h5 mb-0 text-primary">{gameSession.players.filter(p => p.gameStatus === 'active').length}</div>
                      <small className="text-muted">Active</small>
                    </div>
                    <div className="col-4 text-center">
                      <GameTimer gameId={gameSession.id} size="sm" showProgress={false} />
                    </div>
                  </div>

                  {/* Card Management */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <h6>Private Cards</h6>
                      <p className="small text-muted">Deal 2 cards to each player (face down)</p>
                      <button 
                        className="btn btn-info w-100"
                        onClick={() => {
                          // In Phase 1, this is just UI - cards are managed physically
                          setToast({ message: 'Deal 2 private cards to each player', type: 'info' });
                        }}
                      >
                        <i className="bi bi-card-heading me-2"></i>
                        Deal Private Cards
                      </button>
                    </div>
                    <div className="col-md-6">
                      <h6>Community Cards ({gameSession.communityCards}/5)</h6>
                      <p className="small text-muted">Deal face-up community cards</p>
                      <button 
                        className="btn btn-success w-100"
                        disabled={gameSession.communityCards >= 5}
                        onClick={() => {
                          if (socket && connected) {
                            socket.emit('deal-community-card', {
                              gameId: gameSession.id
                            }, (response: any) => {
                              if (response.success) {
                                setToast({ message: `Community card ${response.gameSession.communityCards} dealt!`, type: 'success' });
                              } else {
                                setToast({ message: response.error, type: 'danger' });
                              }
                            });
                          }
                        }}
                      >
                        <i className="bi bi-plus-circle me-2"></i>
                        Deal Community Card
                      </button>
                    </div>
                  </div>

                  {/* Round Management */}
                  {gameSession.status === 'lobby' && (
                    <div className="d-grid gap-2 mb-3">
                      <button 
                        className="btn btn-primary btn-lg"
                        disabled={gameSession.players.filter(p => p.gameStatus === 'active').length < 2}
                        onClick={() => {
                          if (socket && connected) {
                            const nextRound = gameSession.round + 1;
                            socket.emit('start-round', {
                              gameId: gameSession.id,
                              round: nextRound
                            }, (response: any) => {
                              if (response.success) {
                                setToast({ message: `Round ${nextRound} started!`, type: 'success' });
                              } else {
                                setToast({ message: response.error, type: 'danger' });
                              }
                            });
                          }
                        }}
                      >
                        <i className="bi bi-play-circle me-2"></i>
                        Start Round {gameSession.round + 1}
                      </button>
                      {gameSession.players.filter(p => p.gameStatus === 'active').length < 2 && (
                        <small className="text-muted text-center">Need at least 2 active players to start</small>
                      )}
                    </div>
                  )}

                  {gameSession.status === 'round' && gameSession.riskPhase?.active && (
                    <div className="alert alert-info mb-3">
                      <i className="bi bi-clock me-2"></i>
                      <strong>Round {gameSession.round} in progress</strong> - Players are submitting risks
                      <div className="mt-2">
                        {gameSession.players.filter(p => p.gameStatus === 'active').map(player => (
                          <span key={player.id} className={`badge me-1 ${player.hasRisked ? 'bg-success' : 'bg-secondary'}`}>
                            {player.nickname}: {player.hasRisked ? '✓' : '⏳'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {gameSession.status === 'round' && Object.keys(gameSession.riskPhase?.submissions || {}).length === gameSession.players.filter(p => p.gameStatus === 'active').length && !gameSession.riskPhase?.revealed && (
                    <div className="d-grid gap-2 mb-3">
                      <button 
                        className="btn btn-danger btn-lg"
                        onClick={() => {
                          if (socket && connected) {
                            socket.emit('reveal-risks', {
                              gameId: gameSession.id
                            }, (response: any) => {
                              if (response.success) {
                                setToast({ message: 'Risks revealed! Check results.', type: 'success' });
                              } else {
                                setToast({ message: response.error, type: 'danger' });
                              }
                            });
                          }
                        }}
                      >
                        <i className="bi bi-eye me-2"></i>
                        Reveal Risks & Eliminate Players
                      </button>
                    </div>
                  )}

                  {gameSession.status === 'active' && gameSession.round > 0 && (
                    <div className="d-grid gap-2 mb-3">
                      <button 
                        className="btn btn-primary"
                        disabled={gameSession.players.filter(p => p.gameStatus === 'active').length < 2}
                        onClick={() => {
                          if (socket && connected) {
                            const nextRound = gameSession.round + 1;
                            socket.emit('start-round', {
                              gameId: gameSession.id,
                              round: nextRound
                            }, (response: any) => {
                              if (response.success) {
                                setToast({ message: `Round ${nextRound} started!`, type: 'success' });
                              } else {
                                setToast({ message: response.error, type: 'danger' });
                              }
                            });
                          }
                        }}
                      >
                        <i className="bi bi-arrow-right-circle me-2"></i>
                        Start Next Round
                      </button>
                    </div>
                  )}

                  <hr />
                  
                  <div className="d-grid gap-2 d-md-flex">
                    <button 
                      className="btn btn-outline-secondary"
                      onClick={() => router.push(`/game/${gameSession.id}/results`)}
                    >
                      <i className="bi bi-list-ol me-2"></i>
                      View Results
                    </button>
                    <button 
                      onClick={() => {
                        if (socket && connected) {
                          // Emit end game event before navigating
                          socket.emit('end-game', {
                            gameId: localStorage.getItem('gameId'),
                            hostId: localStorage.getItem('playerId'),
                            reason: 'host_ended'
                          });
                        }
                        // Clear localStorage and navigate
                        localStorage.removeItem('gameId');
                        localStorage.removeItem('playerId');
                        localStorage.removeItem('gameCode');
                        localStorage.removeItem('hostNickname');
                        localStorage.removeItem('isHost');
                        router.push('/');
                      }}
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
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <DebugPanel
        title="Host Page Debug"
        data={{
          connected,
          connectionStatus,
          loading,
          error,
          gameSession: gameSession ? `${gameSession.players.length} players` : 'none',
          localStorage_isHost: localStorage.getItem('isHost'),
          localStorage_playerId: localStorage.getItem('playerId')?.slice(-4) || 'none'
        }}
        logs={debugLogs}
      />
    </>
  );
}