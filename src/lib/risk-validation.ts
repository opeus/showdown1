import { Player } from '@/types/game';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface RiskOptions {
  validRisks: number[];
  maxRisk: number;
  minRisk: number;
}

export class RiskValidation {
  /**
   * Calculate maximum risk allowed (25% of current points, rounded down to nearest 5)
   */
  static calculateMaxRisk(playerPoints: number): number {
    const maxAmount = Math.floor(playerPoints * 0.25);
    return Math.floor(maxAmount / 5) * 5;
  }

  /**
   * Get all valid risk amounts for a player
   */
  static calculateValidRisks(playerPoints: number): number[] {
    const maxRisk = this.calculateMaxRisk(playerPoints);
    const risks = [];
    
    // Always allow minimum 5, even if player has less than 20 points
    const startRisk = Math.min(5, Math.floor(playerPoints / 5) * 5);
    
    for (let i = startRisk; i <= maxRisk && i <= playerPoints; i += 5) {
      if (i > 0) {
        risks.push(i);
      }
    }
    
    // Ensure at least one risk option is available
    if (risks.length === 0 && playerPoints >= 5) {
      risks.push(5);
    }
    
    return risks;
  }

  /**
   * Validate a risk submission
   */
  static validateRisk(playerPoints: number, riskAmount: number): ValidationResult {
    // Check basic constraints
    if (riskAmount % 5 !== 0) {
      return { valid: false, error: 'Risk must be multiple of 5' };
    }
    
    if (riskAmount < 5) {
      return { valid: false, error: 'Minimum risk is 5 points' };
    }
    
    if (riskAmount > playerPoints) {
      return { valid: false, error: 'Cannot risk more points than you have' };
    }
    
    const maxRisk = this.calculateMaxRisk(playerPoints);
    if (riskAmount > maxRisk) {
      return { valid: false, error: `Risk exceeds 25% limit (max: ${maxRisk})` };
    }
    
    return { valid: true };
  }

  /**
   * Get risk options for UI display
   */
  static getRiskOptions(playerPoints: number): RiskOptions {
    const validRisks = this.calculateValidRisks(playerPoints);
    const maxRisk = this.calculateMaxRisk(playerPoints);
    
    return {
      validRisks,
      maxRisk,
      minRisk: 5
    };
  }

  /**
   * Validate that a player can participate in risk submission
   */
  static canPlayerRisk(player: Player): ValidationResult {
    if (player.gameStatus !== 'active') {
      return { valid: false, error: 'Player is not active in the game' };
    }
    
    if (player.hasRisked) {
      return { valid: false, error: 'Player has already submitted risk this round' };
    }
    
    if (player.points < 5) {
      return { valid: false, error: 'Player does not have enough points to risk' };
    }
    
    return { valid: true };
  }

  /**
   * Calculate points remaining after risk
   */
  static calculatePointsAfterRisk(currentPoints: number, riskAmount: number): number {
    return Math.max(0, currentPoints - riskAmount);
  }

  /**
   * Determine if player would be "out" after this risk
   */
  static wouldPlayerBeOut(currentPoints: number, riskAmount: number): boolean {
    const pointsAfter = this.calculatePointsAfterRisk(currentPoints, riskAmount);
    return pointsAfter < 5;
  }
}

// Helper functions for common operations
export const getRiskValidation = (playerPoints: number, riskAmount: number) => {
  return RiskValidation.validateRisk(playerPoints, riskAmount);
};

export const getValidRisks = (playerPoints: number) => {
  return RiskValidation.calculateValidRisks(playerPoints);
};

export const getMaxRisk = (playerPoints: number) => {
  return RiskValidation.calculateMaxRisk(playerPoints);
};