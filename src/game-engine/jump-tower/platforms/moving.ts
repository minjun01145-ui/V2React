/** Shared server time, never scene uptime, controls the entire movement phase. */
export function movingPlatformX(platform: { readonly x: number; readonly range: number; readonly periodMs: number }, nowMs: number): number {
  return platform.x + Math.sin((nowMs / platform.periodMs) * Math.PI * 2) * platform.range;
}
