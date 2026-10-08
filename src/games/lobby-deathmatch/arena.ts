import type { ClimbCourseSource, ClimbPlatform } from "../../game-engine/jump-tower/course.ts";

/**
 * The one-screen deathmatch arena. Platforms reuse the jump tower's platform
 * kinds (static steps, sideways movers, spring pads), so the tower's course
 * view draws and collides them. Pushers (cylinders sliding out of the side
 * walls) are the only new gadget. Lava fills everything below y = 0, and
 * every moving part follows the shared server clock so all screens agree.
 */
export const ARENA_WIDTH = 960;
/** World height shown on screen, from the lava up. */
export const ARENA_VIEW_HEIGHT = 600;
export const ARENA_LAVA_Y = 0;
export const DEATHMATCH_RESPAWN_MS = 2_000;

export const ARENA_PLATFORMS: readonly ClimbPlatform[] = [
  { index: 0, floor: 0, kind: "step", x: 40, y: -170, width: 190, range: 0, periodMs: 0 },
  { index: 1, floor: 0, kind: "step", x: 730, y: -170, width: 190, range: 0, periodMs: 0 },
  { index: 2, floor: 0, kind: "moving", x: 395, y: -110, width: 170, range: 170, periodMs: 4_600 },
  { index: 3, floor: 0, kind: "step", x: 380, y: -270, width: 200, range: 0, periodMs: 0 },
  { index: 4, floor: 0, kind: "step", x: 100, y: -340, width: 160, range: 0, periodMs: 0 },
  { index: 5, floor: 0, kind: "step", x: 700, y: -340, width: 160, range: 0, periodMs: 0 },
  { index: 6, floor: 0, kind: "moving", x: 410, y: -430, width: 140, range: 210, periodMs: 6_200 },
  // A spring just above the lava: a last chance to bounce back into the fight.
  { index: 7, floor: 0, kind: "pad", x: 445, y: -36, width: 70, range: 0, periodMs: 0 },
];

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

/** Each sweeps across a side ledge just above its surface, shoving whoever stands there towards the lava. */
export const ARENA_PUSHERS: readonly ArenaPusher[] = [
  { id: 0, wall: "left", y: -214, height: 40, reach: 250, periodMs: 7_000, offsetMs: 0 },
  { id: 1, wall: "right", y: -384, height: 40, reach: 290, periodMs: 7_000, offsetMs: 3_500 },
];

export const ARENA_GADGET_COUNT = ARENA_PLATFORMS.length + ARENA_PUSHERS.length;

/** Rest in the wall, slide out slowly, hold, slide back: eased so the push builds up and never snaps. */
export function pusherExtension(pusher: ArenaPusher, nowMs: number): number {
  const phase = (((nowMs + pusher.offsetMs) % pusher.periodMs) + pusher.periodMs) % pusher.periodMs / pusher.periodMs;
  const ease = (t: number): number => t * t * (3 - 2 * t);
  let amount: number;
  if (phase < 0.35) amount = 0;
  else if (phase < 0.6) amount = ease((phase - 0.35) / 0.25);
  else if (phase < 0.8) amount = 1;
  else amount = 1 - ease((phase - 0.8) / 0.2);
  return amount * pusher.reach;
}

/** Horizontal span of a pusher at `nowMs`, wall included. */
export function pusherSpan(pusher: ArenaPusher, nowMs: number): { readonly left: number; readonly right: number } {
  const extension = pusherExtension(pusher, nowMs);
  return pusher.wall === "left"
    ? { left: -40, right: extension }
    : { left: ARENA_WIDTH - extension, right: ARENA_WIDTH + 40 };
}

/** Respawn on platforms no pusher sweeps, so nobody appears inside a cylinder; feet just above the surface. */
const SPAWN_PLATFORMS = [3, 4] as const;

export function arenaSpawnPoint(roll: number, bodyHeight: number): { readonly x: number; readonly y: number } {
  const index = SPAWN_PLATFORMS[Math.floor(Math.abs(roll) * SPAWN_PLATFORMS.length) % SPAWN_PLATFORMS.length]!;
  const platform = ARENA_PLATFORMS[index]!;
  return { x: platform.x + platform.width / 2, y: platform.y - bodyHeight / 2 - 4 };
}

/** Feet touching the lava is death. */
export function isInLava(feetY: number): boolean {
  return feetY >= ARENA_LAVA_Y + 4;
}

/** The arena as a jump-tower course: every platform lives on "floor" 0 and there are no party items. */
export const ARENA_COURSE: ClimbCourseSource = {
  platformsAt: (floor) => floor === 0 ? ARENA_PLATFORMS : [],
  itemsAt: () => [],
  kindOf: () => null,
};
