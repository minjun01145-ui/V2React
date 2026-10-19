import { createSeededRandom } from "../../../game-engine/core/random.ts";

/*
 * The course every runner in a round shares: the same seed gives the same coins, barriers and answer
 * gates, so scores are comparable. Distances are metres ahead of the start; lanes are -1, 0 and 1.
 */

export type Lane = -1 | 0 | 1;
export const LANES: readonly Lane[] = [-1, 0, 1];

/** One stretch of track; every third block ends in an answer gate. */
export const BLOCK_LENGTH = 40;
const GATE_EVERY = 3;
/** Where in its block a gate stands. */
const GATE_OFFSET = 32;
/** Clear run-up after the start before anything appears. */
const START_CLEAR = 30;

/** O gate on the left lane, X gate on the right, a wall in the middle. */
export const O_LANE: Lane = -1;
export const X_LANE: Lane = 1;

export type TrackObject =
  | { readonly kind: "coin"; readonly id: string; readonly at: number; readonly lane: Lane; readonly height: number }
  | { readonly kind: "barrier"; readonly id: string; readonly at: number; readonly lane: Lane }
  | { readonly kind: "gate"; readonly id: string; readonly at: number; readonly question: number };

const blockCache = new Map<string, readonly TrackObject[]>();

function coinRow(prefix: string, start: number, lane: Lane, count: number, arcOver: number | null): TrackObject[] {
  return Array.from({ length: count }, (_, index) => {
    const at = start + index * 3;
    // Coins over a barrier rise in an arc, so a jump collects them.
    const height = arcOver === null ? 0 : Math.max(0, 1.15 - Math.abs(at - arcOver) * 0.2);
    return { kind: "coin" as const, id: `${prefix}c${index}`, at, lane, height };
  });
}

/** Objects of block `index`, deterministic for `seed`. */
export function trackBlock(seed: string, index: number): readonly TrackObject[] {
  const key = `${seed}:${index}`;
  const cached = blockCache.get(key);
  if (cached) return cached;
  const random = createSeededRandom(`gold-run:${key}`);
  const start = index * BLOCK_LENGTH;
  const pickLane = (): Lane => LANES[Math.floor(random() * 3)]!;
  const objects: TrackObject[] = [];
  const isGateBlock = index % GATE_EVERY === GATE_EVERY - 1;
  const usable = isGateBlock ? GATE_OFFSET - 10 : BLOCK_LENGTH;
  if (start + usable > START_CLEAR) {
    // A barrier in one or two lanes, never all three, with a coin row in a free lane.
    const blocked = new Set<Lane>([pickLane()]);
    if (random() < 0.35) blocked.add(pickLane());
    const barrierAt = start + 8 + Math.floor(random() * Math.max(1, usable - 16));
    for (const lane of blocked) objects.push({ kind: "barrier", id: `b${index}${lane}`, at: barrierAt, lane });
    const coinLane = random() < 0.4 ? [...blocked][0]! : LANES.find((lane) => !blocked.has(lane)) ?? 0;
    objects.push(...coinRow(`k${index}`, barrierAt - 6, coinLane, 5, blocked.has(coinLane) ? barrierAt : null));
  }
  if (isGateBlock) objects.push({ kind: "gate", id: `g${index}`, at: start + GATE_OFFSET, question: Math.floor(index / GATE_EVERY) });
  blockCache.set(key, objects);
  if (blockCache.size > 400) blockCache.delete(blockCache.keys().next().value!);
  return objects;
}

/** Everything between `from` and `to` metres, nearest first. */
export function trackObjects(seed: string, from: number, to: number): TrackObject[] {
  const objects: TrackObject[] = [];
  for (let block = Math.max(0, Math.floor(from / BLOCK_LENGTH)); block * BLOCK_LENGTH <= to; block += 1) {
    for (const object of trackBlock(seed, block)) if (object.at > from && object.at <= to) objects.push(object);
  }
  return objects.sort((left, right) => left.at - right.at);
}

/** The next gate at or beyond `distance`. */
export function nextGate(seed: string, distance: number): Extract<TrackObject, { kind: "gate" }> {
  const gateLength = BLOCK_LENGTH * GATE_EVERY;
  const index = Math.max(0, Math.ceil((distance - (GATE_EVERY - 1) * BLOCK_LENGTH - GATE_OFFSET) / gateLength));
  const block = index * GATE_EVERY + GATE_EVERY - 1;
  return trackBlock(seed, block).find((object) => object.kind === "gate") as Extract<TrackObject, { kind: "gate" }>;
}
