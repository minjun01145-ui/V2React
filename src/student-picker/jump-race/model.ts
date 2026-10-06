import type { LiveWorldScope } from "../../live-world/core/types.ts";

/**
 * Jump-tower picker race: during a slide show every student climbs the same jump tower and the
 * class is lined up by who reaches the goal floor first. How the line-up is used is up to the teacher.
 */
export const JUMP_RACE_GOAL_FLOOR = 100;

export interface JumpRace {
  readonly raceId: string;
  /** The slide show run that started it, so a leftover race never shows up in a later show. */
  readonly showRunId: string;
  readonly goalFloor: number;
  readonly startedAtMs: number;
}

export interface JumpRaceRecord {
  readonly playerId: string;
  readonly floor: number;
  readonly reachedAtMs: number | null;
}

export interface JumpRaceStanding<P> {
  readonly rank: number;
  readonly player: P;
  readonly floor: number;
  readonly finished: boolean;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function parseJumpRace(value: unknown): JumpRace | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { raceId, showRunId, goalFloor, startedAtMs } = value as Record<string, unknown>;
  if (typeof raceId !== "string" || !ID_PATTERN.test(raceId) || typeof showRunId !== "string" || !ID_PATTERN.test(showRunId)) return null;
  if (typeof goalFloor !== "number" || !Number.isInteger(goalFloor) || goalFloor < 1 || goalFloor > 1_000) return null;
  if (typeof startedAtMs !== "number" || !Number.isFinite(startedAtMs)) return null;
  return { raceId, showRunId, goalFloor, startedAtMs };
}

/** Each race has its own live-world channel: its own players, items and records. */
export function jumpRaceScope(roomId: string, race: Pick<JumpRace, "raceId">): LiveWorldScope {
  return { roomId, roundId: `jump-race-${race.raceId}`, channelId: "race" };
}

/**
 * Lines up every player: those who reached the goal first come first, then everyone else by
 * height (earlier first on a tie). Records never exceed the goal, so a finisher's time stays put.
 */
export function rankJumpRace<P extends { readonly id: string }>(players: readonly P[], records: readonly JumpRaceRecord[], goalFloor: number): JumpRaceStanding<P>[] {
  const byPlayer = new Map(records.map((record) => [record.playerId, record]));
  return players
    .map((player, order) => {
      const record = byPlayer.get(player.id);
      const floor = Math.min(goalFloor, record?.floor ?? 0);
      return { player, floor, reachedAtMs: record?.reachedAtMs ?? Infinity, order };
    })
    .sort((a, b) => b.floor - a.floor || a.reachedAtMs - b.reachedAtMs || a.order - b.order)
    .map(({ player, floor }, index) => ({ rank: index + 1, player, floor, finished: floor >= goalFloor }));
}
