import { useEffect, type RefObject } from "react";
import type { SkatingSteer } from "./sim/physics.ts";

/** Held steering sources (keys, touch buttons, stage halves) plus a queued punch. */
export interface SkatingInput {
  readonly held: Map<string, -1 | 1>;
  punchQueued: boolean;
}

export function createSkatingInput(): SkatingInput {
  return { held: new Map(), punchQueued: false };
}

export function skatingSteer(input: SkatingInput): SkatingSteer {
  let total = 0;
  for (const direction of input.held.values()) total += direction;
  return total < 0 ? -1 : total > 0 ? 1 : 0;
}

const UP_KEYS = new Set(["ArrowUp", "KeyW"]);
const DOWN_KEYS = new Set(["ArrowDown", "KeyS"]);
const PUNCH_KEYS = new Set(["Space", "KeyF", "KeyJ"]);

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/** Physical key codes, so steering also works while a Korean input method is selected. */
export function useSkatingKeyboard(input: SkatingInput, onFirstInput: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      const direction = UP_KEYS.has(event.code) ? -1 : DOWN_KEYS.has(event.code) ? 1 : 0;
      if (direction !== 0) {
        event.preventDefault();
        input.held.set(event.code, direction);
        onFirstInput();
      } else if (PUNCH_KEYS.has(event.code)) {
        event.preventDefault();
        if (!event.repeat) input.punchQueued = true;
        onFirstInput();
      }
    };
    const onKeyUp = (event: KeyboardEvent): void => { input.held.delete(event.code); };
    const clear = (): void => input.held.clear();
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
  }, [input, onFirstInput]);
}

/** Touch or mouse held on the rink: the upper half steers up, the lower half down. */
export function useSkatingPointer(element: RefObject<HTMLElement | null>, input: SkatingInput, onFirstInput: () => void): void {
  useEffect(() => {
    const target = element.current;
    if (!target) return undefined;
    const steer = (event: PointerEvent): void => {
      const rect = target.getBoundingClientRect();
      input.held.set(`pointer:${event.pointerId}`, event.clientY < rect.top + rect.height / 2 ? -1 : 1);
    };
    const onDown = (event: PointerEvent): void => {
      target.setPointerCapture(event.pointerId);
      steer(event);
      onFirstInput();
    };
    const onMove = (event: PointerEvent): void => {
      if (input.held.has(`pointer:${event.pointerId}`)) steer(event);
    };
    const onUp = (event: PointerEvent): void => { input.held.delete(`pointer:${event.pointerId}`); };
    target.addEventListener("pointerdown", onDown);
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
    return () => {
      target.removeEventListener("pointerdown", onDown);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
  }, [element, input, onFirstInput]);
}
