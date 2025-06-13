import { Player } from '@/types/game';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
}

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0">Players</h6>
        <span className="badge bg-info">{players.length}/8</span>
      </div>
      <div className="card-body p-0">
        {players.length === 0 ? (
          <div className="p-3 text-center text-muted">
            <i className="bi bi-people-fill fs-4 mb-2 d-block"></i>
            No players yet
          </div>
        ) : (
          <ul className="list-group list-group-flush">
            {players.map((player) => (
              <li
                key={player.id}
                className={`list-group-item player-item d-flex justify-content-between align-items-center ${
                  player.id === currentPlayerId ? 'bg-primary bg-opacity-10' : ''
                }`}
              >
                <div className="d-flex align-items-center">
                  <i
                    className={`bi bi-circle-fill me-2 ${
                      player.status === 'connected'
                        ? 'player-status-connected'
                        : 'player-status-disconnected'
                    }`}
                    style={{ fontSize: '0.5rem' }}
                  ></i>
                  <span className={player.id === currentPlayerId ? 'fw-bold' : ''}>
                    {player.nickname}
                    {player.id === currentPlayerId && ' (You)'}
                  </span>
                </div>
                <div>
                  {player.isHost && (
                    <span className="badge bg-warning text-dark me-2">Host</span>
                  )}
                  <span
                    className={`badge ${
                      player.status === 'connected' ? 'bg-success' : 'bg-secondary'
                    }`}
                  >
                    {player.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}