'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gameCode, setGameCode] = useState('');

  useEffect(() => {
    // Get game code from URL parameter
    const code = searchParams.get('code');
    if (code) {
      setGameCode(code.toUpperCase());
    }
  }, [searchParams]);

  const handleJoinClick = () => {
    // Redirect to home page with the join tab active and code pre-filled
    const url = new URL('/', window.location.origin);
    if (gameCode) {
      url.searchParams.set('code', gameCode);
      url.searchParams.set('tab', 'join');
    }
    router.push(url.toString());
  };

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center">
      <div className="row justify-content-center w-100">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="text-center mb-4">
            <h1 className="showdown-logo" style={{ fontSize: '3rem' }}>SHOWDOWN</h1>
            <p className="text-muted">v1.0 - Join Game</p>
          </div>

          <div className="card">
            <div className="card-header text-center">
              <h5 className="mb-0">Join Game</h5>
            </div>
            <div className="card-body text-center">
              {gameCode ? (
                <>
                  <i className="bi bi-qr-code-scan text-success fs-1 mb-3"></i>
                  <h6 className="mb-3">Game Found!</h6>
                  <div className="game-code mb-3">{gameCode}</div>
                  <p className="text-muted mb-4">
                    You're about to join this game. Click below to continue.
                  </p>
                  <button
                    onClick={handleJoinClick}
                    className="btn btn-primary btn-lg w-100"
                  >
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Join Game {gameCode}
                  </button>
                </>
              ) : (
                <>
                  <i className="bi bi-search text-warning fs-1 mb-3"></i>
                  <h6 className="mb-3">No Game Code</h6>
                  <p className="text-muted mb-4">
                    This link doesn't contain a valid game code. Please use the join form instead.
                  </p>
                  <button
                    onClick={() => router.push('/')}
                    className="btn btn-primary btn-lg w-100"
                  >
                    <i className="bi bi-house me-2"></i>
                    Go to Home Page
                  </button>
                </>
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