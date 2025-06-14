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
                } ${player.status === 'disconnected' ? 'opacity-75' : ''}`}
              >
                <div className="d-flex align-items-center">
                  <i
                    className={`bi ${
                      player.status === 'connected' ? 'bi-circle-fill text-success' : 
                      player.status === 'disconnected' ? 'bi-circle text-warning' : 'bi-circle-fill text-secondary'
                    } me-2`}
                    style={{ fontSize: '0.75rem' }}
                    title={`Player is ${player.status}`}
                  ></i>
                  <span className={`${player.id === currentPlayerId ? 'fw-bold' : ''} ${
                    player.status === 'disconnected' ? 'text-muted' : ''
                  }`}>
                    {player.nickname}
                    {player.id === currentPlayerId && ' (You)'}
                  </span>
                  {player.status === 'disconnected' && (
                    <small className="text-muted ms-2">(reconnecting...)</small>
                  )}
                </div>
                <div>
                  {player.isHost && (
                    <span className="badge bg-warning text-dark me-2">Host</span>
                  )}
                  <span
                    className={`badge ${
                      player.status === 'connected' ? 'bg-success' : 'bg-warning'
                    }`}
                  >
                    {player.status === 'connected' ? '🟢 Online' : '🟡 Reconnecting'}
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