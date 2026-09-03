import { didCapture } from "./captureRules.ts";

export const CAPTURE_SHAKE_INTERVAL_MS = 900;
export const CAPTURE_REVEAL_DELAY_MS = 650;

export interface CaptureAnimationPlan {
  readonly captured: boolean;
  readonly shakeCount: 1 | 2 | 3;
  readonly durationMs: number;
}

function boundedRoll(roll: number): number {
  return Math.min(Math.max(Number.isFinite(roll) ? roll : 0, 0), 1 - Number.EPSILON);
}

export function captureAnimationPlan(chance: number, captureRoll: number, shakeRoll: number): CaptureAnimationPlan {
  const captured = didCapture(chance, captureRoll);
  const shakeCount = captured ? 3 : (1 + Math.floor(boundedRoll(shakeRoll) * 3)) as 1 | 2 | 3;
  return {
    captured,
    shakeCount,
    durationMs: shakeCount * CAPTURE_SHAKE_INTERVAL_MS + CAPTURE_REVEAL_DELAY_MS,
  };
}
