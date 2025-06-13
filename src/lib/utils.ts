/**
 * Generate a random 8-character game code
 */
export function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a unique player ID
 */
export function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Validate game code format
 */
export function isValidGameCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}

/**
 * Validate nickname
 */
export function isValidNickname(nickname: string): boolean {
  return nickname.trim().length >= 2 && nickname.trim().length <= 20;
}