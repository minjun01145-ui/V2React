import { useEffect, useRef } from "react";
import { movementAction } from "../input/movementKeys.ts";
import { clearPlatformerInput, type PlatformerInput } from "./movement.ts";

const PUNCH_KEYS = new Set(["Space", "KeyF", "KeyJ"]);
const DROP_KEYS = new Set(["ArrowDown", "KeyS"]);

export interface PlatformerKeyActions {
  readonly punch: () => void;
  /** ↓ / S: drop through the platform underfoot. */
  readonly drop?: () => void;
}

/** Buttons are not typing targets: after clicking one, game keys must keep working. */
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/**
 * Keyboard for the blob platformers: ← → move, ↑/W jump,
 * Space/F/J punch, ↓/S drop, R queues a reset. Held keys are cleared when the
 * window loses focus so nobody keeps running off a ledge.
 */
export function usePlatformerKeyboard(input: PlatformerInput, actions: PlatformerKeyActions, enabled = true): void {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      if (event.code === "KeyR") {
        event.preventDefault();
        if (!event.repeat) input.resetQueued = true;
        return;
      }
      if (PUNCH_KEYS.has(event.code)) {
        event.preventDefault();
        if (!event.repeat) actionsRef.current.punch();
        return;
      }
      if (DROP_KEYS.has(event.code)) {
        event.preventDefault();
        if (!event.repeat) actionsRef.current.drop?.();
        return;
      }
      const action = movementAction(event.code, event.key);
      if (!action) return;
      event.preventDefault();
      if (action === "jump") {
        if (!event.repeat) input.jumpQueued = true;
        return;
      }
      input.held.set(event.code || event.key, action);
    };
    const onKeyUp = (event: KeyboardEvent): void => { input.held.delete(event.code || event.key); };
    const clear = (): void => clearPlatformerInput(input);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      clear();
    };
  }, [enabled, input]);
}
