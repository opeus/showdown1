import { GameSession, Player } from '@/types/game';

// For v1.0, we'll use in-memory storage as a fallback
// This will reset on each deployment, but works for demo purposes
// TODO: Fix Upstash Redis authentication in next version
const memoryStore = new Map<string, any>();

// Mock KV interface for compatibility
const kv = {
  async set(key: string, value: any, options?: { ex?: number }) {
    memoryStore.set(key, value);
    if (options?.ex) {
      setTimeout(() => memoryStore.delete(key), options.ex * 1000);
    }
  },
  async get(key: string) {
    return memoryStore.get(key) || null;
  },
  async del(key: string) {
    memoryStore.delete(key);
  }
};

export class GameStorage {
  private static readonly GAME_TTL = 86400; // 24 hours

  /**
   * Save a game session to KV storage
   */
  static async saveGame(gameSession: GameSession): Promise<void> {
    await kv.set(`game:${gameSession.id}`, gameSession, { ex: this.GAME_TTL });
    await kv.set(`code:${gameSession.code}`, gameSession.id, { ex: this.GAME_TTL });
    
    // Update real-time system
    await this.updateRealTimeGame(gameSession);
  }

  /**
   * Update real-time game data
   */
  private static async updateRealTimeGame(gameSession: GameSession): Promise<void> {
    try {
      await fetch('/api/socket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          gameId: gameSession.id,
          data: gameSession,
        }),
      });
    } catch (error) {
      console.error('Failed to update real-time game data:', error);
    }
  }

  /**
   * Get a game session by ID
   */
  static async getGame(gameId: string): Promise<GameSession | null> {
    return await kv.get(`game:${gameId}`);
  }

  /**
   * Get a game session by code
   */
  static async getGameByCode(code: string): Promise<GameSession | null> {
    const gameId = await kv.get(`code:${code}`);
    if (!gameId) return null;
    return this.getGame(gameId as string);
  }

  /**
   * Update a game session
   */
  static async updateGame(gameId: string, updates: Partial<GameSession>): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    const updatedGame = { ...game, ...updates, lastActivity: Date.now() };
    await this.saveGame(updatedGame);
  }

  /**
   * Add a player to a game
   */
  static async addPlayerToGame(gameId: string, player: Player): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    game.players.push(player);
    game.lastActivity = Date.now();
    await this.saveGame(game);
  }

  /**
   * Update player status
   */
  static async updatePlayerStatus(gameId: string, playerId: string, status: Player['status']): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');
    
    player.status = status;
    game.lastActivity = Date.now();
    await this.saveGame(game);
  }

  /**
   * Delete a game session
   */
  static async deleteGame(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (game) {
      await kv.del(`game:${gameId}`);
      await kv.del(`code:${game.code}`);
    }
  }
}