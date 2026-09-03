const RELOAD_MARKER = "jurye:deployment-reload";
const RELOAD_COOLDOWN_MS = 30_000;

function recentlyReloaded(now: number): boolean {
  try {
    const previous = Number(window.sessionStorage.getItem(RELOAD_MARKER));
    return Number.isFinite(previous) && now - previous < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function rememberReload(now: number): void {
  try {
    window.sessionStorage.setItem(RELOAD_MARKER, String(now));
  } catch {
    // Recovery must still work when storage is unavailable.
  }
}

/**
 * Vite emits this event when an open page refers to a chunk removed by a newer
 * deployment. Reload once so the page picks up the new HTML and asset graph.
 */
export function installDeploymentRecovery(): void {
  window.addEventListener("vite:preloadError", (event) => {
    const now = Date.now();
    if (recentlyReloaded(now)) return;
    event.preventDefault();
    rememberReload(now);
    window.location.reload();
  });
}
