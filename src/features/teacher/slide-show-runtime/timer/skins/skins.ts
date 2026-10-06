export const TIMER_SKINS = [
  { id: "normal", label: "일반" },
  { id: "glow", label: "글로우" },
  { id: "hourglass", label: "모래시계" },
  { id: "apple", label: "사과" },
] as const;

export type TimerSkin = (typeof TIMER_SKINS)[number]["id"];

export function isTimerSkin(value: unknown): value is TimerSkin {
  return TIMER_SKINS.some((skin) => skin.id === value);
}

/** The hourglass deliberately hides the remaining time; the class only sees sand running out. */
export function showsRemainingTime(skin: TimerSkin): boolean {
  return skin !== "hourglass";
}

/** Share of the set time already used, from 0 (just set) to 1 (finished). */
export function elapsedFraction(remainingSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingSeconds / durationSeconds));
}

/** Number of bites taken out of the apple, from none at the start to all of them at the end. */
export function appleBites(fraction: number, totalBites: number): number {
  return fraction >= 1 ? totalBites : Math.min(totalBites - 1, Math.floor(fraction * totalBites));
}
