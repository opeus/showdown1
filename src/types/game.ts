export interface GameSession {
  id: string;
  code: string;
  status: 'lobby' | 'ended';
  hostId: string;
  players: Player[];
  createdAt: number;
  lastActivity: number;
}

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  joinedAt: number;
  status: 'connected' | 'disconnected' | 'left';
}

// Socket.IO event types
export interface ClientToServerEvents {
  'join-game': (data: { gameId: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  'game-updated': (gameState: GameSession) => void;
  'player-joined': (player: Player) => void;
  'player-left': (playerId: string) => void;
  'error': (error: { message: string; code: string }) => void;
}

// API Response types
export interface CreateGameResponse {
  gameId: string;
  gameCode: string;
  playerId: string;
  joinUrl: string;
}

export interface JoinGameResponse {
  gameId: string;
  playerId: string;
  playerNickname: string;
}

export interface GameInfoResponse {
  id: string;
  code: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  canJoin: boolean;
  players: {
    id: string;
    nickname: string;
    isHost: boolean;
    status: string;
  }[];
}