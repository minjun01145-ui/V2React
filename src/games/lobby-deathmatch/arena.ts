import type { ClimbCourseSource } from "../../game-engine/jump-tower/course.ts";
import type { ArenaMap, ArenaPusher } from "./maps/types.ts";

export const ARENA_WIDTH = 2_880;
/** Reference viewport, not world width: wider maps must never shrink the characters. */
export const ARENA_VIEW_WIDTH = 960;
export const ARENA_VIEW_HEIGHT = 600;
export const DEATHMATCH_RESPAWN_MS = 2_000;


/** Each sweeps across a side ledge just above its surface, shoving whoever stands there towards the lava. */
export const ARENA_PUSHERS: readonly ArenaPusher[] = [
  { id: 0, wall: "left", y: -214, height: 40, reach: 250, periodMs: 7_000, offsetMs: 0 },
  { id: 1, wall: "right", y: -384, height: 40, reach: 290, periodMs: 7_000, offsetMs: 3_500 },
];

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
export function pusherSpan(pusher: ArenaPusher, nowMs: number, width: number): { readonly left: number; readonly right: number } {
  const extension = pusherExtension(pusher, nowMs);
  return pusher.wall === "left"
    ? { left: -40, right: extension }
    : { left: width - extension, right: width + 40 };
}

/** Declared safe ledges span the entire map; the roll only chooses among them. */
export function arenaSpawnPoint(map: ArenaMap, roll: number, bodyHeight: number): { readonly x: number; readonly y: number } {
  const point = map.spawns[Math.floor(Math.abs(roll) * map.spawns.length) % map.spawns.length]!;
  return { x: point.x, y: point.feetY - bodyHeight / 2 - 4 };
}

export function arenaCourse(map: ArenaMap): ClimbCourseSource {
  return {
    platformsAt: (floor) => floor === 0 ? map.platforms : [],
    itemsAt: () => [],
    kindOf: () => null,
  };
}
