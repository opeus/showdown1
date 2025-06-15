'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';
import GameStateRouter from '@/components/GameStateRouter';

interface ResultsPageProps {
  params: { gameId: string };
}

export default function ResultsPage({ params }: ResultsPageProps) {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const [gameSession, setGameSession] = useState<any>(null);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [lastRound, setLastRound] = useState<any>(null);
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
        
        // Get the most recent round from history
        if (response.gameSession.gameHistory.length > 0) {
          const recent = response.gameSession.gameHistory[response.gameSession.gameHistory.length - 1];
          setLastRound(recent);
        }
        
        setLoading(false);
      } else {
        router.push(`/game/${params.gameId}`);
      }
    });

    // Listen for new round starting
    socket.on('round-started', () => {
      router.push(`/game/${params.gameId}/risk`);
    });

    return () => {
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
          <p className="text-muted">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!gameSession || !currentPlayer || !lastRound) {
    return null;
  }

  const wasEliminated = lastRound.eliminated.includes(currentPlayer.id);
  const isOut = currentPlayer.gameStatus === 'out';
  const isEliminated = currentPlayer.gameStatus === 'eliminated';

  return (
    <>
      <GameStateRouter 
        gameId={params.gameId}
        currentPage="results"
        gameSession={gameSession}
        playerId={currentPlayer?.id}
        isHost={false}
      />
      
      <div className="container-fluid min-vh-100 py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          
          {/* Header */}
          <div className="text-center mb-4">
            <h2 className="h3">Round {lastRound.round} Results</h2>
            <p className="text-muted">Game: {gameSession.code}</p>
          </div>

          {/* Your Status */}
          {wasEliminated && (
            <div className={`alert ${isOut ? 'alert-danger' : 'alert-warning'} text-center mb-4`}>
              <i className={`bi ${isOut ? 'bi-x-circle' : 'bi-exclamation-triangle'} fs-1 mb-2`}></i>
              <h4>{isOut ? 'You\'re Out!' : 'You\'re Eliminated!'}</h4>
              <p className="mb-0">
                You risked the lowest amount ({lastRound.risks[currentPlayer.id]} points)
                {isOut && ' and now have less than 5 points.'}
              </p>
            </div>
          )}

          {/* Pot Update */}
          <div className="card mb-4">
            <div className="card-body text-center">
              <h5>Showdown Pot Updated</h5>
              <div className="row">
                <div className="col-4">
                  <div className="h4 text-muted">💎 {lastRound.potBefore}</div>
                  <small>Before</small>
                </div>
                <div className="col-4">
                  <i className="bi bi-arrow-right text-success fs-1"></i>
                </div>
                <div className="col-4">
                  <div className="h4 text-success">💎 {lastRound.potAfter}</div>
                  <small>After</small>
                </div>
              </div>
              <p className="text-muted mt-2">
                +{lastRound.potAfter - lastRound.potBefore} points added from eliminated players
              </p>
            </div>
          </div>

          {/* Risks Revealed */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">
                <i className="bi bi-eye me-2"></i>
                Risks Revealed
              </h6>
            </div>
            <div className="card-body">
              {Object.entries(lastRound.risks)
                .sort((a, b) => (a[1] as number) - (b[1] as number))
                .map(([playerId, risk]) => {
                  const player = gameSession.players.find((p: any) => p.id === playerId);
                  const wasEliminatedInRound = lastRound.eliminated.includes(playerId);
                  
                  return (
                    <div 
                      key={playerId} 
                      className={`d-flex justify-content-between align-items-center p-2 mb-2 rounded ${
                        wasEliminatedInRound ? 'bg-danger-subtle border border-danger-subtle' : 'bg-light-subtle'
                      }`}
                    >
                      <div>
                        <strong>{player?.nickname || 'Unknown'}</strong>
                        {playerId === currentPlayer.id && <span className="badge bg-primary ms-2">You</span>}
                        {player?.isHost && <span className="badge bg-warning text-dark ms-2">Host</span>}
                        {wasEliminatedInRound && <span className="badge bg-danger ms-2">Eliminated</span>}
                      </div>
                      <div className="text-end">
                        <div className="fw-bold">{risk as number} points</div>
                        <small className="text-muted">Points left: {player?.points || 0}</small>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Current Scoreboard */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">
                <i className="bi bi-trophy me-2"></i>
                Current Standings
              </h6>
            </div>
            <div className="card-body">
              {gameSession.players
                .filter((p: any) => p.gameStatus === 'active')
                .sort((a: any, b: any) => b.points - a.points)
                .map((player: any, index: number) => (
                  <div key={player.id} className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <span className="badge bg-secondary me-2">#{index + 1}</span>
                      <strong>{player.nickname}</strong>
                      {player.id === currentPlayer.id && <span className="badge bg-primary ms-2">You</span>}
                      {player.isHost && <span className="badge bg-warning text-dark ms-2">Host</span>}
                    </div>
                    <div className="text-end">
                      <div className="fw-bold text-success">{player.points} points</div>
                    </div>
                  </div>
                ))}
              
              {/* Show eliminated/out players */}
              {gameSession.players.filter((p: any) => p.gameStatus !== 'active').length > 0 && (
                <>
                  <hr />
                  <h6 className="text-muted mb-2">Eliminated/Out Players</h6>
                  {gameSession.players
                    .filter((p: any) => p.gameStatus !== 'active')
                    .map((player: any) => (
                      <div key={player.id} className="d-flex justify-content-between align-items-center mb-1 opacity-75">
                        <div>
                          <strong>{player.nickname}</strong>
                          {player.id === currentPlayer.id && <span className="badge bg-primary ms-2">You</span>}
                          <span className={`badge ms-2 ${player.gameStatus === 'out' ? 'bg-danger' : 'bg-secondary'}`}>
                            {player.gameStatus === 'out' ? 'Out' : 'Eliminated'}
                          </span>
                        </div>
                        <div className="text-muted">{player.points} points</div>
                      </div>
                    ))}
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="text-center">
            {currentPlayer.gameStatus === 'active' ? (
              <div className="alert alert-info">
                <i className="bi bi-clock me-2"></i>
                Waiting for host to start the next round...
              </div>
            ) : (
              <div className="alert alert-secondary">
                <i className="bi bi-eye me-2"></i>
                You can spectate the remaining rounds.
              </div>
            )}
            
            <button
              onClick={() => router.push(`/game/${params.gameId}`)}
              className="btn btn-outline-primary"
            >
              <i className="bi bi-arrow-left me-2"></i>
              Back to Lobby
            </button>
          </div>

        </div>
      </div>
    </div>
    </>
  );
}