import type { ClimbPlatform, ClimbPlatformKind, ClimbPlatformStyle } from "../../../game-engine/jump-tower/course.ts";

export interface ArenaPusher {
  readonly id: number;
  readonly wall: "left" | "right";
  /** Top edge of the cylinder. */
  readonly y: number;
  readonly height: number;
  /** How far it slides out of the wall at full extension. */
  readonly reach: number;
  readonly periodMs: number;
  /** Shifts the cycle so the two pushers do not move in step. */
  readonly offsetMs: number;
}
export interface LavaHazard {
  readonly kind: "lava";
  readonly left: number;
  readonly right: number;
  readonly y: number;
  readonly color: number;
  readonly glow: number;
}

export interface AttractorHazard {
  readonly kind: "attractor";
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly coreRadius: number;
  readonly acceleration: number;
  readonly color: number;
}

export type ArenaHazard = LavaHazard | AttractorHazard;

export interface ArenaMap {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly ceilingY: number;
  readonly floorY: number;
  readonly safeFloor: boolean;
  readonly gravityMultiplier: number;
  readonly platforms: readonly ClimbPlatform[];
  readonly spawns: readonly { readonly x: number; readonly feetY: number }[];
  readonly pushers: readonly ArenaPusher[];
  readonly hazards: readonly ArenaHazard[];
  readonly theme: {
    readonly backdrop: "cave" | "ocean" | "stars";
    readonly background: number;
    readonly ambient: number;
    readonly ceiling: number;
    readonly edge: number;
    readonly floor: number;
    readonly particles: "embers" | "bubbles" | "stardust";
  };
}

type PlatformRow = readonly [x: number, y: number, width: number, kind?: ClimbPlatformKind, range?: number, periodMs?: number];

/** Compact map data becomes the existing engine's platform format, without a second physics path. */
export function arenaPlatforms(rows: readonly PlatformRow[], top: number, side: number): ClimbPlatform[] {
  const style: ClimbPlatformStyle = { top, side, labelColor: "#ffffff", labelBackground: "#000000" };
  return rows.map(([x, y, width, kind = "step", range = 0, periodMs = 0], index) => ({
    index, floor: 0, x, y, width, kind, range, periodMs, style,
  }));
}
