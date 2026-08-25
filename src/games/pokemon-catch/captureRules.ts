export function captureChance(captureRate: number, modifiers: {
  readonly ballMultiplier?: number;
  readonly statusMultiplier?: number;
} = {}): number {
  const boundedRate = Math.floor(Math.min(Math.max(captureRate, 0), 255));
  const ballMultiplier = Math.max(modifiers.ballMultiplier ?? 1, 0);
  const statusMultiplier = Math.max(modifiers.statusMultiplier ?? 1, 0);
  // This game presents a full-HP Pokémon. FireRed applies ball power, then the
  // full-HP 1/3 factor, followed by the sleep/status modifier.
  const modifiedRate = Math.floor(Math.floor(boundedRate * ballMultiplier) / 3 * statusMultiplier);
  if (modifiedRate <= 0) return 0;
  if (modifiedRate > 254) return 1;
  const firstRoot = Math.floor(Math.sqrt(Math.floor(16_711_680 / modifiedRate)));
  const secondRoot = Math.floor(Math.sqrt(firstRoot));
  const shakeThreshold = Math.floor(1_048_560 / secondRoot);
  const shakeChance = Math.min(shakeThreshold, 65_536) / 65_536;
  // The success animation is reached after all four internal shake checks pass.
  return shakeChance ** 4;
}

export function didCapture(chance: number, roll: number): boolean {
  return roll >= 0 && roll < Math.min(Math.max(chance, 0), 1);
}
