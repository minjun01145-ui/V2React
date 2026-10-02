/** Server timestamp includes a separate countdown; legacy milliseconds already include it. */
export function resolveSessionStartedAtMs(startedAt: unknown, legacyStartedAtMs: unknown, startDelayMs: unknown = 0): number | null {
  const delay = typeof startDelayMs === "number" && Number.isFinite(startDelayMs) && startDelayMs >= 0 ? startDelayMs : 0;
  if (typeof startedAt === "object" && startedAt !== null && "toMillis" in startedAt) {
    const toMillis = (startedAt as { readonly toMillis?: unknown }).toMillis;
    if (typeof toMillis === "function") {
      try {
        const milliseconds: unknown = toMillis.call(startedAt);
        if (typeof milliseconds === "number" && Number.isFinite(milliseconds)) return milliseconds + delay;
      } catch {
        // Malformed timestamps can still fall back to a valid legacy field.
      }
    }
  }
  return typeof legacyStartedAtMs === "number" && Number.isFinite(legacyStartedAtMs)
    ? legacyStartedAtMs
    : null;
}
