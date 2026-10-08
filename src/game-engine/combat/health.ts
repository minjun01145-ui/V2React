/** Starting and maximum health for a fighter. */
export const DEFAULT_MAX_HEALTH = 200;

/**
 * Health for every fighter in a match, as this client knows it. Each client
 * applies the same hit events, so every screen shows the same bars; the
 * victim's own client is the one that acts on reaching zero.
 */
export class HealthBook {
  private readonly health = new Map<string, number>();
  readonly max: number;

  constructor(max = DEFAULT_MAX_HEALTH) {
    this.max = max;
  }

  get(playerId: string): number {
    return this.health.get(playerId) ?? this.max;
  }

  ratio(playerId: string): number {
    return this.get(playerId) / this.max;
  }

  /** Subtracts `amount` (never below zero) and returns the health left. */
  damage(playerId: string, amount: number): number {
    const left = Math.max(0, this.get(playerId) - Math.max(0, amount));
    this.health.set(playerId, left);
    return left;
  }

  /** Back to full, e.g. after a respawn. */
  reset(playerId: string): void {
    this.health.delete(playerId);
  }
}
