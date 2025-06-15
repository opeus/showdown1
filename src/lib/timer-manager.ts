export interface GameTimer {
  remaining: number;
  active: boolean;
  type: 'risk' | 'showdown' | 'host-action';
  startTime: number;
  duration: number;
}

export interface TimerCallbacks {
  onTick?: (remaining: number) => void;
  onExpire?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

// Timer durations in seconds
export const TIMER_DURATIONS = {
  RISK_SUBMISSION: 60,      // 60 seconds to submit risk
  SHOWDOWN_PROPOSAL: 45,    // 45 seconds to propose risk
  SHOWDOWN_RESPONSE: 30,    // 30 seconds to match/fold
  HOST_ACTION: 120,         // 2 minutes for host actions
} as const;

export class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private timerStates: Map<string, GameTimer> = new Map();

  /**
   * Start a new timer
   */
  startTimer(
    gameId: string,
    type: GameTimer['type'],
    duration: number,
    callbacks?: TimerCallbacks
  ): GameTimer {
    // Clear any existing timer for this game
    this.clearTimer(gameId);

    const timer: GameTimer = {
      remaining: duration,
      active: true,
      type,
      startTime: Date.now(),
      duration
    };

    this.timerStates.set(gameId, timer);

    // Start countdown
    const interval = setInterval(() => {
      const currentTimer = this.timerStates.get(gameId);
      if (!currentTimer || !currentTimer.active) {
        clearInterval(interval);
        return;
      }

      currentTimer.remaining--;
      
      // Call tick callback
      if (callbacks?.onTick) {
        callbacks.onTick(currentTimer.remaining);
      }

      if (currentTimer.remaining <= 0) {
        clearInterval(interval);
        this.timers.delete(gameId);
        currentTimer.active = false;
        
        // Call expire callback
        if (callbacks?.onExpire) {
          callbacks.onExpire();
        }
      }
    }, 1000);

    this.timers.set(gameId, interval);
    return timer;
  }

  /**
   * Pause a timer
   */
  pauseTimer(gameId: string, callbacks?: TimerCallbacks): boolean {
    const timer = this.timerStates.get(gameId);
    if (!timer || !timer.active) {
      return false;
    }

    timer.active = false;
    
    const interval = this.timers.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.timers.delete(gameId);
    }

    if (callbacks?.onPause) {
      callbacks.onPause();
    }

    return true;
  }

  /**
   * Resume a paused timer
   */
  resumeTimer(gameId: string, callbacks?: TimerCallbacks): boolean {
    const timer = this.timerStates.get(gameId);
    if (!timer || timer.active) {
      return false;
    }

    timer.active = true;

    // Restart countdown from remaining time
    const interval = setInterval(() => {
      const currentTimer = this.timerStates.get(gameId);
      if (!currentTimer || !currentTimer.active) {
        clearInterval(interval);
        return;
      }

      currentTimer.remaining--;
      
      if (callbacks?.onTick) {
        callbacks.onTick(currentTimer.remaining);
      }

      if (currentTimer.remaining <= 0) {
        clearInterval(interval);
        this.timers.delete(gameId);
        currentTimer.active = false;
        
        if (callbacks?.onExpire) {
          callbacks.onExpire();
        }
      }
    }, 1000);

    this.timers.set(gameId, interval);

    if (callbacks?.onResume) {
      callbacks.onResume();
    }

    return true;
  }

  /**
   * Clear a timer
   */
  clearTimer(gameId: string): void {
    const interval = this.timers.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.timers.delete(gameId);
    }
    
    this.timerStates.delete(gameId);
  }

  /**
   * Get current timer state
   */
  getTimer(gameId: string): GameTimer | null {
    return this.timerStates.get(gameId) || null;
  }

  /**
   * Get all active timers
   */
  getActiveTimers(): Map<string, GameTimer> {
    const activeTimers = new Map();
    
    for (const [gameId, timer] of this.timerStates.entries()) {
      if (timer.active) {
        activeTimers.set(gameId, timer);
      }
    }
    
    return activeTimers;
  }

  /**
   * Add time to an existing timer
   */
  addTime(gameId: string, seconds: number): boolean {
    const timer = this.timerStates.get(gameId);
    if (!timer) {
      return false;
    }

    timer.remaining += seconds;
    return true;
  }

  /**
   * Set remaining time
   */
  setRemainingTime(gameId: string, seconds: number): boolean {
    const timer = this.timerStates.get(gameId);
    if (!timer) {
      return false;
    }

    timer.remaining = Math.max(0, seconds);
    return true;
  }

  /**
   * Cleanup - clear all timers
   */
  cleanup(): void {
    for (const interval of this.timers.values()) {
      clearInterval(interval);
    }
    
    this.timers.clear();
    this.timerStates.clear();
  }
}

// Global timer manager instance
export const timerManager = new TimerManager();

// Helper functions for common timer operations
export const startRiskTimer = (gameId: string, callbacks?: TimerCallbacks) => {
  return timerManager.startTimer(gameId, 'risk', TIMER_DURATIONS.RISK_SUBMISSION, callbacks);
};

export const startHostActionTimer = (gameId: string, callbacks?: TimerCallbacks) => {
  return timerManager.startTimer(gameId, 'host-action', TIMER_DURATIONS.HOST_ACTION, callbacks);
};

export const getGameTimer = (gameId: string) => {
  return timerManager.getTimer(gameId);
};