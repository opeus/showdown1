'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';

export default function TestDisconnectPage() {
  const { socket, connected, connectionStatus } = useSocket();
  const [gameCode] = useState(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  });
  const [events, setEvents] = useState<string[]>([]);
  const [role, setRole] = useState<'none' | 'host' | 'player'>('none');
  const [gameCreated, setGameCreated] = useState(false);
  const [playerJoined, setPlayerJoined] = useState(false);

  const addEvent = (event: string) => {
    const timestamp = new Date().toISOString();
    setEvents(prev => [`[${timestamp}] ${event}`, ...prev]);
  };

  useEffect(() => {
    if (!socket) return;

    // Listen for all events
    socket.on('player-joined', (data) => {
      addEvent(`✅ PLAYER JOINED: ${data.player.nickname}`);
    });

    socket.on('player-disconnected', (data) => {
      addEvent(`🔴 PLAYER DISCONNECTED: ${data.playerNickname} - ${data.reason}`);
    });

    socket.on('player-reconnected', (data) => {
      addEvent(`🔄 PLAYER RECONNECTED: ${data.playerNickname}`);
    });

    socket.on('game-update', (data) => {
      addEvent(`🎮 GAME UPDATE`);
    });

    return () => {
      socket.off('player-joined');
      socket.off('player-disconnected');
      socket.off('player-reconnected');
      socket.off('game-update');
    };
  }, [socket]);

  const createHost = () => {
    if (!socket || !connected) return;

    const gameId = `game_${gameCode}`;
    const hostId = `host_${Math.random().toString(36).substr(2, 9)}`;

    addEvent(`Creating game as host...`);

    socket.emit('create-game', {
      gameId,
      gameCode,
      hostId,
      hostNickname: 'TestHost'
    }, (response: any) => {
      if (response.success) {
        addEvent(`✅ Game created: ${gameCode}`);
        setRole('host');
        setGameCreated(true);
      } else {
        addEvent(`❌ Failed to create game: ${response.error}`);
      }
    });
  };

  const joinAsPlayer = () => {
    if (!socket || !connected) return;

    const playerId = `player_${Math.random().toString(36).substr(2, 9)}`;

    addEvent(`Joining game as player...`);

    socket.emit('join-game', {
      gameCode,
      playerId,
      playerNickname: 'TestPlayer'
    }, (response: any) => {
      if (response.success) {
        addEvent(`✅ Joined game: ${gameCode}`);
        setRole('player');
        setPlayerJoined(true);
      } else {
        addEvent(`❌ Failed to join: ${response.error}`);
      }
    });
  };

  const forceDisconnect = () => {
    if (!socket) return;
    addEvent(`🔌 Forcing disconnect...`);
    socket.disconnect();
  };

  const reconnect = () => {
    if (!socket) return;
    addEvent(`🔄 Attempting reconnection...`);
    socket.connect();
  };

  return (
    <div className="container-fluid min-vh-100 py-4">
      <div className="row">
        <div className="col-12">
          <h1>Disconnect Detection Test</h1>
          <p className="text-muted">Use this page to test disconnect detection in real-time</p>

          <div className="card mb-3">
            <div className="card-body">
              <h5>Connection Status</h5>
              <div>Socket Connected: {connected ? '✅' : '❌'}</div>
              <div>Status: {connectionStatus}</div>
              <div>Game Code: <strong>{gameCode}</strong></div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h5>Test Controls</h5>
              
              {role === 'none' && (
                <div>
                  <button 
                    className="btn btn-primary me-2"
                    onClick={createHost}
                    disabled={!connected}
                  >
                    Create as Host
                  </button>
                  <button 
                    className="btn btn-success"
                    onClick={joinAsPlayer}
                    disabled={!connected || !gameCreated}
                  >
                    Join as Player
                  </button>
                  <p className="text-muted mt-2">
                    1. First click "Create as Host" in one browser/tab<br/>
                    2. Then click "Join as Player" in another browser/tab<br/>
                    3. Turn off WiFi/cellular on the player device<br/>
                    4. Watch the host screen for disconnect notification
                  </p>
                </div>
              )}

              {role !== 'none' && (
                <div>
                  <p>Role: <strong>{role.toUpperCase()}</strong></p>
                  <button 
                    className="btn btn-danger me-2"
                    onClick={forceDisconnect}
                    disabled={!connected}
                  >
                    Force Disconnect
                  </button>
                  <button 
                    className="btn btn-warning"
                    onClick={reconnect}
                    disabled={connected}
                  >
                    Reconnect
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h5>Event Log</h5>
              <div style={{ maxHeight: '400px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.9em' }}>
                {events.length === 0 ? (
                  <p className="text-muted">No events yet...</p>
                ) : (
                  events.map((event, index) => (
                    <div key={index} className="mb-1">
                      {event}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}