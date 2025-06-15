'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';
import GameStateRouter from '@/components/GameStateRouter';

interface WaitingPageProps {
  params: { gameId: string };
}

export default function WaitingPage({ params }: WaitingPageProps) {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const [gameSession, setGameSession] = useState<any>(null);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get player info from localStorage
    const playerId = localStorage.getItem('playerId');
    const gameId = localStorage.getItem('gameId');
    
    if (!playerId || !gameId || gameId !== params.gameId) {
      router.push('/');
      return;
    }

    if (!socket || !connected) {
      return;
    }

    // Join game room and get current state
    socket.emit('join-game', { gameId, playerId }, (response: any) => {
      if (response.success) {
        setGameSession(response.gameSession);
        const player = response.gameSession.players.find((p: any) => p.id === playerId);
        setCurrentPlayer(player);
        setLoading(false);
      } else {
        router.push(`/game/${params.gameId}`);
      }
    });

    // Listen for game events
    socket.on('risk-submitted', (data) => {
      // Update UI to show another player submitted
      console.log(`${data.playerNickname} submitted their risk`);
    });

    socket.on('risks-revealed', (data) => {
      // Navigate to results page
      router.push(`/game/${params.gameId}/results`);
    });

    socket.on('round-started', () => {
      // New round started, go back to risk page
      router.push(`/game/${params.gameId}/risk`);
    });

    return () => {
      socket.off('risk-submitted');
      socket.off('risks-revealed'); 
      socket.off('round-started');
    };
  }, [socket, connected, params.gameId, router]);

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border spinner-border-lg mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!gameSession || !currentPlayer) {
    return null;
  }

  const activePlayers = gameSession.players.filter((p: any) => p.gameStatus === 'active');
  const submittedCount = activePlayers.filter((p: any) => p.hasRisked).length;
  const totalActive = activePlayers.length;

  return (
    <>
      <GameStateRouter 
        gameId={params.gameId}
        currentPage="waiting"
        gameSession={gameSession}
        playerId={currentPlayer?.id}
        isHost={false}
      />
      
      <div className="container-fluid min-vh-100 py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-6 col-lg-4">
          
          {/* Header */}
          <div className="text-center mb-4">
            <h2 className="h3">Risk Submitted!</h2>
            <p className="text-muted">Round {gameSession.round} • Game: {gameSession.code}</p>
          </div>

          {/* Your Risk Display */}
          <div className="card mb-4">
            <div className="card-body text-center">
              <i className="bi bi-check-circle-fill text-success fs-1 mb-3"></i>
              <h4>You Risked: <span className="text-info">{currentPlayer.currentRisk}</span> points</h4>
              <p className="text-muted mb-3">
                Points remaining: <strong>{currentPlayer.points - (currentPlayer.currentRisk || 0)}</strong>
              </p>
              <div className="alert alert-info">
                <small>
                  <i className="bi bi-info-circle me-2"></i>
                  Waiting for other players and host to reveal risks...
                </small>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">
                <i className="bi bi-people me-2"></i>
                Player Progress ({submittedCount}/{totalActive})
              </h6>
            </div>
            <div className="card-body">
              <div className="progress mb-3">
                <div 
                  className="progress-bar bg-success" 
                  role="progressbar" 
                  style={{ width: `${(submittedCount / totalActive) * 100}%` }}
                ></div>
              </div>
              
              {activePlayers.map((player: any) => (
                <div key={player.id} className="d-flex justify-content-between align-items-center mb-2">
                  <span>
                    {player.nickname}
                    {player.id === currentPlayer.id && <span className="badge bg-primary ms-2">You</span>}
                    {player.isHost && <span className="badge bg-warning text-dark ms-2">Host</span>}
                  </span>
                  <span className={`badge ${player.hasRisked ? 'bg-success' : 'bg-secondary'}`}>
                    {player.hasRisked ? (
                      <>
                        <i className="bi bi-check me-1"></i>
                        Risked
                      </>
                    ) : (
                      <>
                        <i className="bi bi-clock me-1"></i>
                        Waiting...
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Game Info */}
          <div className="card">
            <div className="card-body">
              <div className="row text-center">
                <div className="col-4">
                  <div className="h5 mb-0 text-success">💎 {gameSession.pot}</div>
                  <small className="text-muted">Pot</small>
                </div>
                <div className="col-4">
                  <div className="h5 mb-0 text-info">{gameSession.round}</div>
                  <small className="text-muted">Round</small>
                </div>
                <div className="col-4">
                  <div className="h5 mb-0 text-warning">{gameSession.communityCards}/5</div>
                  <small className="text-muted">Cards</small>
                </div>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="alert alert-warning mt-4">
            <i className="bi bi-lightbulb me-2"></i>
            <strong>Tip:</strong> The player(s) with the lowest risk will be eliminated and their risk added to the pot!
          </div>

        </div>
      </div>
    </div>
    </>
  );
}