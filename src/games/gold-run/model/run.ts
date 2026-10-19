import { O_LANE, X_LANE, trackObjects, type Lane } from "./track.ts";

/*
 * The local runner, advanced in fixed steps by the scene. Pure, so the rules (scoring, lives, gates)
 * are testable without Phaser. The runner always sits at `distance`; the track scrolls towards it.
 */

export const START_SPEED = 13;
const MAX_SPEED = 26;
/** Metres per second gained per second of running. */
const ACCELERATION = 0.12;
export const JUMP_SECONDS = 0.72;
const JUMP_HEIGHT = 1.3;
/** Below this height a barrier still trips the runner. */
const CLEAR_HEIGHT = 0.8;
const STUMBLE_SECONDS = 1.1;
/** A hit or a wrong gate keeps this share of the speed (never below the starting speed). */
const HIT_SLOWDOWN = 0.75;
const DOWN_SECONDS = 2;
export const MAX_LIVES = 3;

export const SCORE = { coin: 10, correct: 100, streakBonus: 25, metre: 1 } as const;

export interface RunState {
  readonly distance: number;
  readonly speed: number;
  readonly lane: Lane;
  /** Seconds since the run started; drives jump and stumble timers. */
  readonly clock: number;
  readonly jumpStartedAt: number | null;
  readonly stumbleUntil: number;
  /** While down after losing every heart, the runner stands still until this clock time. */
  readonly downUntil: number;
  readonly lives: number;
  readonly coins: number;
  readonly correct: number;
  readonly wrong: number;
  readonly streak: number;
  readonly score: number;
  /** Ids of track objects already resolved, so a step never counts one twice. */
  readonly taken: ReadonlySet<string>;
}

/** What happened during one step, for effects and sounds. */
export type RunEvent =
  | { readonly kind: "coin"; readonly lane: Lane }
  | { readonly kind: "hit"; readonly lane: Lane }
  | { readonly kind: "gate"; readonly question: number; readonly correct: boolean; readonly chose: "O" | "X" | null }
  | { readonly kind: "down" }
  | { readonly kind: "up" };

export interface RunInput {
  readonly lane: Lane;
  readonly jump: boolean;
}

export function createRun(): RunState {
  return {
    distance: 0, speed: START_SPEED, lane: 0, clock: 0, jumpStartedAt: null, stumbleUntil: 0, downUntil: 0,
    lives: MAX_LIVES, coins: 0, correct: 0, wrong: 0, streak: 0, score: 0, taken: new Set(),
  };
}

/** Height above the track (metres) at `state.clock`. */
export function jumpHeight(state: Pick<RunState, "clock" | "jumpStartedAt">): number {
  if (state.jumpStartedAt === null) return 0;
  const t = (state.clock - state.jumpStartedAt) / JUMP_SECONDS;
  return t > 0 && t < 1 ? 4 * JUMP_HEIGHT * t * (1 - t) : 0;
}

export const isDown = (state: RunState): boolean => state.clock < state.downUntil;

/** Whether the runner answered `true` (O lane), `false` (X lane) or neither (the middle wall). */
function gateChoice(lane: Lane): boolean | null {
  return lane === O_LANE ? true : lane === X_LANE ? false : null;
}

/**
 * Advances `seconds` of running. `isTrue(question)` tells whether gate `question`'s statement is
 * correct (O). Losing the last heart knocks the runner down; they get up with full hearts at
 * starting speed, keeping their score.
 */
export function stepRun(state: RunState, input: RunInput, seconds: number, seed: string, isTrue: (question: number) => boolean): { state: RunState; events: RunEvent[] } {
  const events: RunEvent[] = [];
  const clock = state.clock + seconds;
  if (clock < state.downUntil) return { state: { ...state, clock }, events };
  let next = state;
  if (state.downUntil > 0) {
    events.push({ kind: "up" });
    next = { ...state, lives: MAX_LIVES, speed: START_SPEED, downUntil: 0 };
  }

  const airborne = next.jumpStartedAt !== null && clock - next.jumpStartedAt < JUMP_SECONDS;
  const jumpStartedAt = input.jump && !airborne ? clock : airborne ? next.jumpStartedAt : null;
  const speed = Math.min(MAX_SPEED, next.speed + ACCELERATION * seconds);
  const distance = next.distance + speed * seconds;
  next = { ...next, clock, speed, distance, lane: input.lane, jumpStartedAt };

  const taken = new Set(next.taken);
  let { lives, coins, correct, wrong, streak, score, stumbleUntil } = next;
  const stumbling = clock < stumbleUntil;
  const height = jumpHeight(next);
  let endSpeed = next.speed;
  const loseHeart = (): void => {
    lives -= 1;
    streak = 0;
    stumbleUntil = clock + STUMBLE_SECONDS;
    endSpeed = Math.max(START_SPEED, endSpeed * HIT_SLOWDOWN);
  };
  for (const object of trackObjects(seed, state.distance, distance)) {
    if (taken.has(object.id)) continue;
    if (object.kind === "coin") {
      if (object.lane !== next.lane || Math.abs(height - object.height) > 1.1) continue;
      taken.add(object.id);
      coins += 1;
      score += SCORE.coin;
      events.push({ kind: "coin", lane: object.lane });
    } else if (object.kind === "barrier") {
      if (object.lane !== next.lane) continue;
      taken.add(object.id);
      if (height >= CLEAR_HEIGHT || stumbling) continue;
      loseHeart();
      events.push({ kind: "hit", lane: object.lane });
    } else {
      taken.add(object.id);
      const chose = gateChoice(next.lane);
      const right = chose !== null && chose === isTrue(object.question);
      if (right) {
        correct += 1;
        streak += 1;
        score += SCORE.correct + SCORE.streakBonus * (streak - 1);
      } else {
        wrong += 1;
        loseHeart();
      }
      events.push({ kind: "gate", question: object.question, correct: right, chose: chose === null ? null : chose ? "O" : "X" });
    }
  }
  // Distance points accrue per whole metre so the score only ever grows in steps.
  score += Math.floor(distance * SCORE.metre) - Math.floor(state.distance * SCORE.metre);
  // Keep the resolved set small: anything well behind the runner can never be hit again.
  if (taken.size > 64) {
    const nearby = new Set(trackObjects(seed, distance - 60, distance + 1).map((object) => object.id));
    for (const id of taken) if (!nearby.has(id)) taken.delete(id);
  }

  let downUntil = next.downUntil;
  if (lives <= 0) {
    downUntil = clock + DOWN_SECONDS;
    events.push({ kind: "down" });
  }
  return { state: { ...next, speed: endSpeed, taken, lives: Math.max(0, lives), coins, correct, wrong, streak, score, stumbleUntil, downUntil }, events };
}
