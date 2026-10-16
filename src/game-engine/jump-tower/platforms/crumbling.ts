export const CRUMBLE_WARNING_MS = 650;
export const CRUMBLE_HIDDEN_MS = 1100;
/** At most one collapse per platform in a shared four-second window. */
export const CRUMBLE_WINDOW_MS = 4000;

export function crumbleClaimId(index: number, nowMs: number): string {
  return `b${index}-${Math.floor(nowMs / CRUMBLE_WINDOW_MS)}`;
}

export function crumbleClaimIndex(id: string): number | null {
  const match = /^b(\d+)-\d+$/.exec(id);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isSafeInteger(index) && index > 0 ? index : null;
}

/** A persisted claim's server timestamp also reaches late joiners and concurrent landings. */
export function crumblePhase(touchedAt: number | undefined, nowMs: number): "solid" | "warning" | "hidden" {
  if (touchedAt === undefined || nowMs < touchedAt || nowMs >= touchedAt + CRUMBLE_WARNING_MS + CRUMBLE_HIDDEN_MS) return "solid";
  return nowMs < touchedAt + CRUMBLE_WARNING_MS ? "warning" : "hidden";
}
