export interface GameSession {
  id: string;
  code: string;
  status: 'lobby' | 'active' | 'round' | 'showdown' | 'ended';
  hostId: string;
  players: Player[];
  createdAt: number;
  lastActivity: number;
  
  // New gameplay fields
  pot: number;                    // Showdown pot accumulation
  round: number;                  // Current round number
  communityCards: number;         // Number of community cards dealt
  maxCommunityCards: number;      // Usually 5 for poker
  timer?: {
    remaining: number;            // Seconds left
    active: boolean;
    type: 'risk' | 'showdown' | 'host-action';
  };
  riskPhase?: {
    active: boolean;
    submissions: Record<string, number>; // playerId -> risk amount
    revealed: boolean;
  };
  showdownPhase?: {
    active: boolean;
    finalist1Id: string;
    finalist2Id: string;
    proposedRisk?: number;
    proposerId?: string;
    response?: 'pending' | 'matched' | 'folded';
    winnerId?: string;
  };
  gameHistory: GameRound[];       // Record of all rounds
}

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  joinedAt: number;
  status: 'connected' | 'away' | 'disconnected' | 'left';
  
  // New gameplay fields
  points: number;                 // Current points (starts at 100)
  gameStatus: 'active' | 'eliminated' | 'out' | 'finalist';
  currentRisk?: number;           // Current round risk submission
  hasRisked: boolean;            // Has submitted risk this round
  reentryUsed: boolean;          // Has used their one re-entry
  privateCards: string[];        // Their 2 private cards (host only)
}

export interface GameRound {
  round: number;
  risks: Record<string, number>;  // playerId -> risk amount
  eliminated: string[];           // playerIds eliminated this round
  potBefore: number;
  potAfter: number;
  communityCardsDealt: number;
  timestamp: number;
}

// Socket.IO event types
export interface ClientToServerEvents {
  'join-game': (data: { gameId: string; playerId: string }) => void;
  
  // Gameplay events
  'start-round': (data: { gameId: string; round: number }) => void;
  'deal-community-card': (data: { gameId: string }) => void;
  'submit-risk': (data: { gameId: string; playerId: string; amount: number }) => void;
  'reveal-risks': (data: { gameId: string }) => void;
  'declare-winner': (data: { gameId: string; winnerId: string }) => void;
  'reenter-player': (data: { gameId: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  'game-updated': (gameState: GameSession) => void;
  'player-joined': (player: Player) => void;
  'player-left': (playerId: string) => void;
  'error': (error: { message: string; code: string }) => void;
  
  // Gameplay events
  'round-started': (data: { round: number; timer: any }) => void;
  'community-card-dealt': (data: { cardNumber: number; totalCards: number }) => void;
  'risk-submitted': (data: { playerId: string; playerNickname: string }) => void;
  'all-risks-in': (data: { canReveal: boolean }) => void;
  'risks-revealed': (data: { 
    risks: Record<string, number>; 
    eliminated: string[];
    newPot: number;
    round: GameRound;
  }) => void;
  'player-eliminated': (data: { 
    playerId: string; 
    playerNickname: string; 
    eliminationRound: number;
    newStatus: 'eliminated' | 'out';
  }) => void;
  'timer-tick': (data: { remaining: number; type: string }) => void;
  'timer-expired': (data: { action: string }) => void;
  'player-reentered': (data: { 
    playerId: string; 
    playerNickname: string; 
    newPoints: number 
  }) => void;
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