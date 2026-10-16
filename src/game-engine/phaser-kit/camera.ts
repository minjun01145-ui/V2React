/** Keep the original character scale, regardless of how wide the world grows. */
export function characterCameraZoom(width: number, height: number, viewWidth: number, viewHeight: number): number {
  return Math.max(0.3, Math.min(2, width / viewWidth, height / viewHeight));
}

/** Frame-rate independent horizontal following, clamped in world coordinates. */
export function followCameraX(current: number, target: number, visibleWidth: number, worldWidth: number, deltaMs: number): number {
  const half = Math.min(visibleWidth, worldWidth) / 2;
  const right = worldWidth - half;
  const destination = Math.max(half, Math.min(right, target));
  const next = current + (destination - current) * (1 - Math.exp(-deltaMs / 140));
  return Math.max(half, Math.min(right, next));
}
