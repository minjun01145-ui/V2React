import type { Lane } from "../model/track.ts";

/*
 * Keyboard and touch input for the runner: ←/→ (A/D) or a sideways swipe change lanes; ↑, W,
 * Space, an upward swipe or a tap jumps. Listens on the window for keys and on `surface` for touch.
 */

const SWIPE_PX = 28;

export class RunControls {
  lane: Lane = 0;
  private jumpQueued = false;
  private start: { x: number; y: number; id: number } | null = null;
  private readonly surface: HTMLElement;

  constructor(surface: HTMLElement) {
    this.surface = surface;
    window.addEventListener("keydown", this.onKey);
    surface.addEventListener("pointerdown", this.onDown);
    surface.addEventListener("pointerup", this.onUp);
    surface.addEventListener("pointercancel", this.onCancel);
  }

  /** True once per jump request. */
  consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  reset(): void {
    this.lane = 0;
    this.jumpQueued = false;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKey);
    this.surface.removeEventListener("pointerdown", this.onDown);
    this.surface.removeEventListener("pointerup", this.onUp);
    this.surface.removeEventListener("pointercancel", this.onCancel);
  }

  private shift(direction: -1 | 1): void {
    this.lane = Math.max(-1, Math.min(1, this.lane + direction)) as Lane;
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") this.shift(-1);
    else if (key === "arrowright" || key === "d") this.shift(1);
    else if (key === "arrowup" || key === "w" || key === " ") this.jumpQueued = true;
    else return;
    event.preventDefault();
  };

  private readonly onDown = (event: PointerEvent): void => {
    this.start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };

  private readonly onUp = (event: PointerEvent): void => {
    const start = this.start;
    this.start = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) this.shift(dx < 0 ? -1 : 1);
    else if (dy <= -SWIPE_PX || Math.hypot(dx, dy) < SWIPE_PX) this.jumpQueued = true;
  };

  private readonly onCancel = (): void => {
    this.start = null;
  };
}
