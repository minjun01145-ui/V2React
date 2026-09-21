export interface PlatformerInput {
  readonly held: Map<string, "left" | "right">;
  jumpQueued: boolean;
  resetQueued: boolean;
}

export function createPlatformerInput(): PlatformerInput {
  return { held: new Map(), jumpQueued: false, resetQueued: false };
}

export function clearPlatformerInput(input: PlatformerInput): void {
  input.held.clear();
  input.jumpQueued = false;
  input.resetQueued = false;
}

export interface JumpState {
  used: number;
  lastGroundAt: number;
  bufferedUntil: number;
}

export function createJumpState(): JumpState {
  return { used: 0, lastGroundAt: -Infinity, bufferedUntil: -Infinity };
}

/** Only jump eligibility lives here; Phaser owns integration and collisions. */
export function takeJump(state: JumpState, grounded: boolean, pressed: boolean, nowMs: number): number | null {
  if (grounded) {
    state.used = 0;
    state.lastGroundAt = nowMs;
  }
  if (pressed) state.bufferedUntil = nowMs + 120;
  // Walking off an edge leaves one air jump after a short coyote-time window.
  if (!grounded && state.used === 0 && nowMs - state.lastGroundAt > 100) state.used = 1;
  if (nowMs > state.bufferedUntil || state.used >= 2) return null;
  state.used += 1;
  state.bufferedUntil = -Infinity;
  return state.used === 1 ? -550 : -520;
}
