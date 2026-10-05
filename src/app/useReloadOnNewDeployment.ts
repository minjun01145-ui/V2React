import { useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 30_000;

function loadedEntry(): string | null {
  return document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? null;
}

/** A deployment changes the hashed entry script named by the (uncached) page HTML. */
async function deployedEntry(): Promise<string | null> {
  const response = await fetch(window.location.pathname, { cache: "no-store" });
  if (!response.ok) return null;
  const source = /<script\b[^>]*type="module"[^>]*\bsrc="([^"]+)"/.exec(await response.text())?.[1];
  return source ? new URL(source, response.url).href : null;
}

/**
 * A deployment deletes the previous game chunks, so a page opened before it
 * fails only when the next game starts, and the whole class then reloads at
 * once. Reload early instead, while the student is idle on the lobby.
 */
export function useReloadOnNewDeployment(safeToReload: boolean): void {
  const outdated = useRef(false);
  const safe = useRef(safeToReload);
  safe.current = safeToReload;

  useEffect(() => {
    if (safeToReload && outdated.current) window.location.reload();
  }, [safeToReload]);

  useEffect(() => {
    const loaded = loadedEntry();
    if (!loaded) return undefined;
    let active = true;
    const check = async (): Promise<void> => {
      if (outdated.current) return;
      try {
        const deployed = await deployedEntry();
        if (!active || !deployed || deployed === loaded) return;
        outdated.current = true;
        if (safe.current) window.location.reload();
      } catch {
        // Offline or blocked: the next check tries again.
      }
    };
    const onVisible = (): void => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
