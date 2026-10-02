import { useEffect, useState, type ReactNode, type RefObject } from "react";
import styles from "./ImmersiveStage.module.css";

/**
 * Lays a game over the whole viewport instead of inside the page card, which
 * platformers need to be playable on small classroom screens.
 */
export function ImmersiveStage({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);
  return <div className={styles.stage}>{children}</div>;
}

function fullscreenSupported(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled === true;
}

/** Toggles real browser fullscreen for `target` (hidden where the API is unavailable, e.g. sandboxed frames). */
export function FullscreenToggle({ target, className }: {
  readonly target: RefObject<HTMLElement | null>;
  readonly className?: string | undefined;
}) {
  const [active, setActive] = useState(() => typeof document !== "undefined" && document.fullscreenElement !== null);
  useEffect(() => {
    const sync = (): void => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (!fullscreenSupported()) return null;

  const toggle = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void target.current?.requestFullscreen().catch(() => undefined);
  };
  return <button
    type="button"
    className={`${styles.fullscreenToggle} ${className ?? ""}`}
    aria-label={active ? "전체화면 끄기" : "전체화면"}
    title={active ? "전체화면 끄기" : "전체화면"}
    onClick={(event) => {
      toggle();
      // Keep keyboard control with the game rather than this button.
      event.currentTarget.blur();
    }}
  >{active ? "⤡" : "⤢"}</button>;
}
