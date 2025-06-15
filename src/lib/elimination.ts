import { Player, GameRound } from '@/types/game';

export interface EliminationResult {
  type: 'elimination' | 'showdown';
  eliminated: string[];           // Player IDs eliminated
  finalists?: string[];          // For showdown condition
  eliminationReason?: {
    minRisk: number;
    totalEliminated: number;
    potIncrease: number;
  };
  potIncrease: number;           // Amount added to pot
}

export interface PotDistribution {
  winnerGains: number;
  finalPot: number;
}

export class EliminationEngine {
  /**
   * Calculate eliminations based on submitted risks
   */
  static calculateEliminations(
    activePlayers: Player[], 
    risks: Record<string, number>
  ): EliminationResult {
    // Get active players who submitted risks
    const playersWithRisks = activePlayers
      .filter(p => p.gameStatus === 'active' && risks[p.id] !== undefined)
      .map(p => ({ ...p, risk: risks[p.id] }));
    
    console.log('Calculating eliminations for players:', playersWithRisks.map(p => `${p.nickname}: ${p.risk}`));

    if (playersWithRisks.length <= 2) {
      // Showdown condition reached
      console.log('Showdown condition reached with', playersWithRisks.length, 'players');
      return {
        type: 'showdown',
        finalists: playersWithRisks.map(p => p.id),
        eliminated: [],
        potIncrease: 0
      };
    }
    
    // Find minimum risk(s)
    const minRisk = Math.min(...playersWithRisks.map(p => p.risk));
    const lowestRiskPlayers = playersWithRisks.filter(p => p.risk === minRisk);
    
    console.log('Minimum risk:', minRisk);
    console.log('Players with minimum risk:', lowestRiskPlayers.map(p => p.nickname));
    
    // Determine how many to eliminate based on game size
    const eliminationCount = this.calculateEliminationCount(playersWithRisks.length);
    const toEliminate = lowestRiskPlayers.slice(0, eliminationCount);
    
    const potIncrease = toEliminate.reduce((sum, p) => sum + p.risk, 0);
    
    console.log('Eliminating', toEliminate.length, 'players, pot increase:', potIncrease);
    
    return {
      type: 'elimination',
      eliminated: toEliminate.map(p => p.id),
      eliminationReason: {
        minRisk,
        totalEliminated: toEliminate.length,
        potIncrease
      },
      potIncrease
    };
  }

  /**
   * Determine how many players to eliminate based on active player count
   */
  static calculateEliminationCount(activePlayerCount: number): number {
    // Conservative elimination rules for Phase 1
    if (activePlayerCount >= 8) return 2;  // Eliminate 2 in large games
    if (activePlayerCount >= 6) return 2;  // Eliminate 2 in medium games  
    if (activePlayerCount >= 4) return 1;  // Eliminate 1 in smaller games
    return 1;                              // Always eliminate at least 1
  }

  /**
   * Update player status after elimination
   */
  static updatePlayerStatus(player: Player, isEliminated: boolean, riskAmount: number): Player {
    if (!isEliminated) {
      // Player survives - deduct risk from points
      return {
        ...player,
        points: Math.max(0, player.points - riskAmount),
        currentRisk: undefined,
        hasRisked: false,
        gameStatus: player.points - riskAmount < 5 ? 'out' : 'active'
      };
    }
    
    // Player is eliminated
    const newPoints = Math.max(0, player.points - riskAmount);
    
    return {
      ...player,
      points: newPoints,
      gameStatus: newPoints < 5 ? 'out' : 'eliminated',
      currentRisk: undefined,
      hasRisked: false
    };
  }

  /**
   * Apply elimination result to all players
   */
  static applyEliminationToPlayers(
    players: Player[], 
    eliminationResult: EliminationResult,
    risks: Record<string, number>
  ): Player[] {
    return players.map(player => {
      const riskAmount = risks[player.id] || 0;
      const isEliminated = eliminationResult.eliminated.includes(player.id);
      
      // Only update players who participated in the round
      if (player.gameStatus === 'active' && riskAmount > 0) {
        return this.updatePlayerStatus(player, isEliminated, riskAmount);
      }
      
      // Reset risk submission status for next round
      return {
        ...player,
        hasRisked: false,
        currentRisk: undefined
      };
    });
  }

  /**
   * Get active players who can participate in rounds
   */
  static getActivePlayers(players: Player[]): Player[] {
    return players.filter(p => p.gameStatus === 'active');
  }

  /**
   * Get eliminated players (not "out")
   */
  static getEliminatedPlayers(players: Player[]): Player[] {
    return players.filter(p => p.gameStatus === 'eliminated');
  }

  /**
   * Get "out" players (points < 5)
   */
  static getOutPlayers(players: Player[]): Player[] {
    return players.filter(p => p.gameStatus === 'out');
  }

  /**
   * Check if all active players have submitted risks
   */
  static allPlayersRisked(players: Player[], risks: Record<string, number>): boolean {
    const activePlayers = this.getActivePlayers(players);
    return activePlayers.every(player => risks[player.id] !== undefined);
  }

  /**
   * Create a game round record
   */
  static createGameRound(
    roundNumber: number,
    risks: Record<string, number>,
    eliminationResult: EliminationResult,
    potBefore: number,
    communityCards: number
  ): GameRound {
    return {
      round: roundNumber,
      risks,
      eliminated: eliminationResult.eliminated,
      potBefore,
      potAfter: potBefore + eliminationResult.potIncrease,
      communityCardsDealt: communityCards,
      timestamp: Date.now()
    };
  }
}

export class PotManager {
  /**
   * Add eliminated player risks to pot
   */
  static addToPot(currentPot: number, eliminatedRisks: number[]): number {
    const increase = eliminatedRisks.reduce((sum, risk) => sum + risk, 0);
    return currentPot + increase;
  }
  
  /**
   * Calculate pot increase from elimination result
   */
  static calculatePotIncrease(eliminationResult: EliminationResult): number {
    return eliminationResult.potIncrease;
  }
  
  /**
   * Distribute winnings for showdown (winner takes all + opponent's risk)
   */
  static distributeWinnings(pot: number, winnerRisk: number, loserRisk: number): PotDistribution {
    // Winner gets: original pot + opponent's matched risk
    const winnerGains = pot + loserRisk;
    return {
      winnerGains,
      finalPot: 0  // Pot is emptied after showdown
    };
  }
  
  /**
   * Handle fold scenario (proposer wins pot, no risk exchange)
   */
  static handleFold(pot: number): PotDistribution {
    return {
      winnerGains: pot,
      finalPot: 0
    };
  }
}

// Helper functions for common operations
export const calculateEliminations = (players: Player[], risks: Record<string, number>) => {
  const activePlayers = EliminationEngine.getActivePlayers(players);
  return EliminationEngine.calculateEliminations(activePlayers, risks);
};

export const applyEliminations = (players: Player[], eliminationResult: EliminationResult, risks: Record<string, number>) => {
  return EliminationEngine.applyEliminationToPlayers(players, eliminationResult, risks);
};

export const getActivePlayers = (players: Player[]) => {
  return EliminationEngine.getActivePlayers(players);
};

export const allPlayersRisked = (players: Player[], risks: Record<string, number>) => {
  return EliminationEngine.allPlayersRisked(players, risks);
};