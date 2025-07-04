'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameSession } from '@/types/game';
import PlayerList from '@/components/PlayerList';
import { useSocket } from '@/contexts/SocketContext';
import HostDisconnectBanner from '@/components/HostDisconnectBanner';
import HostVolunteerModal from '@/components/HostVolunteerModal';
import Toast from '@/components/Toast';
import DebugPanel from '@/components/DebugPanel';
import GameStateRouter from '@/components/GameStateRouter';

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
  const [hostAbsenceCountdown, setHostAbsenceCountdown] = useState<number>(0);
  const [showHostAbsenceBanner, setShowHostAbsenceBanner] = useState(false);
  const [hostVolunteerCountdown, setHostVolunteerCountdown] = useState<number>(0);
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [isVolunteering, setIsVolunteering] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'danger' | 'info' } | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    addDebugLog('PLAYER PAGE: useEffect triggered');
    
    // Get player info from localStorage
    const storedPlayerId = localStorage.getItem('playerId');
    const storedGameId = localStorage.getItem('gameId');
    const storedGameCode = localStorage.getItem('gameCode');
    const playerNickname = localStorage.getItem('playerNickname');
    const isHost = localStorage.getItem('isHost') === 'true';
    
    addDebugLog(`localStorage: playerId=${!!storedPlayerId}, gameId=${!!storedGameId}, isHost=${isHost}`);

    if (!storedPlayerId || !storedGameId || storedGameId !== params.gameId || !storedGameCode || !playerNickname) {
      addDebugLog('VALIDATION FAILED: Missing required data, redirecting to home');
      router.push('/');
      return;
    }
    
    // If they're marked as host, redirect to host page instead
    if (isHost) {
      addDebugLog('REDIRECTING: Still marked as host, going to host page');
      router.push(`/host/${params.gameId}`);
      return;
    }

    setPlayerId(storedPlayerId);

    if (!socket || (!connected && connectionStatus === 'disconnected')) {
      addDebugLog('Socket not ready, waiting...');
      return;
    }

    addDebugLog('Attempting reconnect-player...');
    // Try to reconnect first (in case this is a reconnection), then fall back to join-game
    socket.emit('reconnect-player', {
      gameId: storedGameId,
      playerId: storedPlayerId
    }, (response: any) => {
      addDebugLog(`reconnect-player response: success=${response.success}`);
      if (response.success) {
        addDebugLog('✅ Player reconnected successfully');
        setGameSession(response.gameSession);
        setLoading(false);
      } else {
        addDebugLog(`Reconnect failed: ${response.error}, trying join-game`);
        // Reconnect failed, try fresh join
        socket.emit('join-game', {
          gameCode: storedGameCode,
          playerId: storedPlayerId,
          playerNickname: playerNickname
        }, (joinResponse: any) => {
          if (joinResponse.success) {
            setGameSession(joinResponse.gameSession);
            setLoading(false);
          } else {
            setError(joinResponse.error || 'Failed to join game');
            setLoading(false);
          }
        });
      }
    });

    // Listen for real-time updates
    socket.on('player-joined', (data) => {
      console.log('✅ Another player joined:', data.player.nickname);
      setGameSession(data.gameSession);
    });

    socket.on('player-disconnected', (data) => {
      console.log('❌ PLAYER DISCONNECTED EVENT RECEIVED IN PLAYER VIEW');
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

    socket.on('game-update', (updatedGameSession) => {
      console.log('🎮 Game session updated');
      setGameSession(updatedGameSession);
    });

    socket.on('player-left', (data) => {
      console.log('🚪 Player left game:', data.playerNickname, 'Reason:', data.reason);
      setGameSession(data.gameSession);
    });

    socket.on('game-ended', (data) => {
      console.log('🏁 Game ended:', data.reason);
      if (data.reason === 'no-host-available') {
        setToast({ message: 'Game ended - no one volunteered to be host', type: 'warning' });
      } else {
        setToast({ message: 'Game ended by host', type: 'info' });
      }
      // Delay redirect to show toast
      setTimeout(() => {
        localStorage.removeItem('gameId');
        localStorage.removeItem('playerId');
        localStorage.removeItem('gameCode');
        localStorage.removeItem('playerNickname');
        localStorage.removeItem('isHost');
        router.push('/');
      }, 2000);
    });

    // Gameplay navigation events are now handled by GameStateRouter component

    // Host absence events
    socket.on('host-absence-countdown', (data) => {
      console.log('⏱️ Host absence countdown:', data);
      setHostAbsenceCountdown(data.secondsRemaining);
      setShowHostAbsenceBanner(true);
    });

    socket.on('host-absence-cancelled', (data) => {
      console.log('✅ Host absence cancelled:', data.message);
      setShowHostAbsenceBanner(false);
      setHostAbsenceCountdown(0);
    });

    socket.on('host-volunteer-phase', (data) => {
      console.log('🙋 Host volunteer phase:', data);
      setShowHostAbsenceBanner(false);
      setHostVolunteerCountdown(data.secondsRemaining);
      setShowVolunteerModal(true);
    });

    socket.on('host-absence-paused', (data) => {
      console.log('⏸️ Host absence timer paused:', data.message);
      setShowHostAbsenceBanner(false);
      setToast({ message: data.message, type: 'warning' });
    });

    socket.on('host-volunteer-claimed', (data) => {
      console.log('🏁 Host position claimed by someone else:', data.newHostNickname);
      setShowVolunteerModal(false);
      setIsVolunteering(false);
      setToast({ message: data.message, type: 'info' });
    });

    socket.on('host-transferred', (data) => {
      console.log('👑 Host transferred to:', data.newHostNickname);
      setShowVolunteerModal(false);
      setIsVolunteering(false);
      setGameSession(data.gameSession);
      
      // Update localStorage if we became the host
      if (data.newHostId === playerId) {
        localStorage.setItem('isHost', 'true');
        // Update gameCode and hostNickname for host page
        const gameCode = localStorage.getItem('gameCode') || '';
        localStorage.setItem('gameCode', gameCode);
        localStorage.setItem('hostNickname', localStorage.getItem('playerNickname') || '');
        
        setToast({ message: 'You are now the host!', type: 'success' });
        
        // Small delay to show toast before redirect
        setTimeout(() => {
          window.location.href = `/host/${params.gameId}`;
        }, 1000);
      } else {
        setToast({ message: `${data.newHostNickname} is now the host!`, type: 'info' });
      }
    });

    // Cleanup
    return () => {
      socket.off('player-joined');
      socket.off('player-disconnected');
      socket.off('player-reconnected');
      socket.off('player-status-changed');
      socket.off('player-left');
      socket.off('game-ended');
      socket.off('game-update');
      socket.off('host-absence-countdown');
      socket.off('host-absence-cancelled');
      socket.off('host-absence-paused');
      socket.off('host-volunteer-phase');
      socket.off('host-volunteer-claimed');
      socket.off('host-transferred');
    };
  }, [socket, connected, connectionStatus, params.gameId, router, playerId]);

  const handleVolunteerHost = () => {
    if (!socket || !connected || isVolunteering) return;
    
    setIsVolunteering(true);
    socket.emit('volunteer-host', {
      gameId: params.gameId,
      playerId: playerId
    }, (response: any) => {
      if (!response.success) {
        console.error('Failed to volunteer:', response.error, response.reason);
        setIsVolunteering(false);
        
        if (response.reason === 'already-claimed' || response.reason === 'race-condition') {
          // Someone else got it first
          setShowVolunteerModal(false);
          setToast({ message: 'Someone else already became the host!', type: 'info' });
        } else if (response.reason === 'not-in-volunteer-phase') {
          // Volunteer phase ended
          setShowVolunteerModal(false);
          setToast({ message: 'Host volunteer period has ended', type: 'warning' });
        } else {
          // Other error
          setToast({ message: response.error, type: 'danger' });
        }
      }
      // Success case is handled by host-transferred event
    });
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
    <>
      <GameStateRouter 
        gameId={params.gameId}
        currentPage="lobby"
        gameSession={gameSession}
        playerId={playerId}
        isHost={false}
      />
      
      <HostDisconnectBanner 
        visible={showHostAbsenceBanner}
        secondsRemaining={hostAbsenceCountdown}
      />
      
      <HostVolunteerModal
        visible={showVolunteerModal}
        secondsRemaining={hostVolunteerCountdown}
        onVolunteer={handleVolunteerHost}
        isVolunteering={isVolunteering}
      />
      
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
                  onClick={() => {
                    if (socket && connected) {
                      // Emit leave event before navigating
                      socket.emit('leave-game', {
                        gameId: localStorage.getItem('gameId'),
                        playerId: localStorage.getItem('playerId'),
                        reason: 'voluntary'
                      });
                    }
                    // Clear localStorage and navigate
                    localStorage.removeItem('gameId');
                    localStorage.removeItem('playerId');
                    localStorage.removeItem('gameCode');
                    localStorage.removeItem('playerNickname');
                    localStorage.removeItem('isHost');
                    router.push('/');
                  }}
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
    
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)}
      />
    )}
    
    <DebugPanel
      title="Player Page Debug"
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