'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';
import { getValidRisks, getRiskValidation } from '@/lib/risk-validation';
import GameTimer from '@/components/GameTimer';
import GameStateRouter from '@/components/GameStateRouter';

interface RiskSubmissionPageProps {
  params: { gameId: string };
}

export default function RiskSubmissionPage({ params }: RiskSubmissionPageProps) {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const [gameSession, setGameSession] = useState<any>(null);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [selectedRisk, setSelectedRisk] = useState(5);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(60);

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
        
        // Set timer if active
        if (response.gameSession.timer?.active) {
          setTimeRemaining(response.gameSession.timer.remaining);
        }
        
        setLoading(false);
      } else {
        setError(response.error);
        setLoading(false);
      }
    });

    // Listen for game updates
    socket.on('round-started', (data) => {
      setTimeRemaining(data.timer.remaining);
    });

    socket.on('timer-tick', (data) => {
      setTimeRemaining(data.remaining);
    });

    socket.on('all-risks-in', () => {
      router.push(`/game/${params.gameId}/waiting`);
    });

    return () => {
      socket.off('round-started');
      socket.off('timer-tick');
      socket.off('all-risks-in');
    };
  }, [socket, connected, params.gameId, router]);

  const handleSubmitRisk = () => {
    if (!socket || !currentPlayer || submitting) return;

    // Validate risk
    const validation = getRiskValidation(currentPlayer.points, selectedRisk);
    if (!validation.valid) {
      setError(validation.error || 'Invalid risk amount');
      return;
    }

    setSubmitting(true);
    setError('');

    socket.emit('submit-risk', {
      gameId: params.gameId,
      playerId: currentPlayer.id,
      amount: selectedRisk
    }, (response: any) => {
      setSubmitting(false);
      
      if (response.success) {
        // Navigate to waiting screen
        router.push(`/game/${params.gameId}/waiting`);
      } else {
        setError(response.error);
      }
    });
  };

  const handleRiskChange = (newRisk: number) => {
    if (!currentPlayer) return;
    
    const validRisks = getValidRisks(currentPlayer.points);
    if (validRisks.includes(newRisk)) {
      setSelectedRisk(newRisk);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border spinner-border-lg mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading game...</p>
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
                <h5 className="card-title">Error</h5>
                <p className="card-text text-muted">{error}</p>
                <button
                  onClick={() => router.push(`/game/${params.gameId}`)}
                  className="btn btn-primary"
                >
                  Back to Game
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameSession || !currentPlayer) {
    return null;
  }

  // Check if player has already risked
  if (currentPlayer.hasRisked) {
    router.push(`/game/${params.gameId}/waiting`);
    return null;
  }

  const validRisks = getValidRisks(currentPlayer.points);
  const maxRisk = Math.max(...validRisks);
  const minRisk = Math.min(...validRisks);

  return (
    <>
      <GameStateRouter 
        gameId={params.gameId}
        currentPage="risk"
        gameSession={gameSession}
        playerId={currentPlayer?.id}
        isHost={false}
      />
      
      <div className="container-fluid min-vh-100 py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-6 col-lg-4">
          
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h2 className="h4 mb-0">Risk Round {gameSession.round}</h2>
              <small className="text-muted">Game: {gameSession.code}</small>
            </div>
            <div className="text-end">
              <GameTimer gameId={params.gameId} size="md" showProgress={true} />
            </div>
          </div>

          {/* Pot & Points */}
          <div className="row mb-3">
            <div className="col-6">
              <div className="card">
                <div className="card-body text-center py-2">
                  <div className="h5 mb-0 text-success">💎 {gameSession.pot}</div>
                  <small className="text-muted">Showdown Pot</small>
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="card">
                <div className="card-body text-center py-2">
                  <div className="h5 mb-0 text-info">🎯 {currentPlayer.points}</div>
                  <small className="text-muted">Your Points</small>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Selection */}
          <div className="card mb-3">
            <div className="card-header">
              <h6 className="mb-0">
                <i className="bi bi-target me-2"></i>
                Select Your Risk
              </h6>
            </div>
            <div className="card-body">
              
              {/* Quick Risk Buttons */}
              <div className="d-grid gap-2 mb-3">
                {validRisks.map(risk => (
                  <button
                    key={risk}
                    className={`btn ${selectedRisk === risk ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setSelectedRisk(risk)}
                  >
                    Risk {risk} points
                  </button>
                ))}
              </div>

              {/* Fine Adjustment */}
              <div className="d-flex gap-2 mb-3">
                <button 
                  className="btn btn-secondary flex-fill"
                  onClick={() => handleRiskChange(Math.max(minRisk, selectedRisk - 5))}
                  disabled={selectedRisk <= minRisk}
                >
                  <i className="bi bi-dash"></i>
                </button>
                <div className="flex-fill text-center">
                  <div className="form-control-plaintext text-center fw-bold">
                    {selectedRisk} points
                  </div>
                </div>
                <button 
                  className="btn btn-secondary flex-fill"
                  onClick={() => handleRiskChange(Math.min(maxRisk, selectedRisk + 5))}
                  disabled={selectedRisk >= maxRisk}
                >
                  <i className="bi bi-plus"></i>
                </button>
              </div>

              {/* Submit Button */}
              <button 
                className="btn btn-success w-100 py-2"
                onClick={handleSubmitRisk}
                disabled={submitting || !validRisks.includes(selectedRisk)}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Submit Risk ({selectedRisk} points)
                  </>
                )}
              </button>

              {/* Risk Info */}
              <div className="mt-3 small text-muted">
                <div className="d-flex justify-content-between">
                  <span>Points after risk:</span>
                  <span className="fw-bold">{currentPlayer.points - selectedRisk}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Max risk (25%):</span>
                  <span>{maxRisk}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2"></i>
            <strong>Warning:</strong> The player(s) with the lowest risk will be eliminated!
          </div>

          {/* Player Status */}
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Other Players</h6>
            </div>
            <div className="card-body">
              {gameSession.players
                .filter((p: any) => p.gameStatus === 'active' && p.id !== currentPlayer.id)
                .map((player: any) => (
                  <div key={player.id} className="d-flex justify-content-between align-items-center mb-2">
                    <span>
                      {player.nickname}
                      {player.isHost && <span className="badge bg-warning text-dark ms-2">Host</span>}
                    </span>
                    <span className={`badge ${player.hasRisked ? 'bg-success' : 'bg-secondary'}`}>
                      {player.hasRisked ? '✓ Risked' : 'Waiting...'}
                    </span>
                  </div>
                ))}
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  );
}