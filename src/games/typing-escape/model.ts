import { getNewValidProgress } from "../../game-engine/typing/typingEngine.ts";

export const CHANT = [..."무궁화꽃이피었습니다"];
export const CYCLE_MS = 9_000;
export const HIDE_MS = 280;
export const FINISH = 160;
export interface EscapeProgress {
  distance: number; best: number; question: number; input: string; prefix: number;
  lastInputAt: number; hitCycle: number; stunnedUntil: number; finishedElapsed: number;
}
export function initialProgress(): EscapeProgress {
  return { distance: 0, best: 0, question: 0, input: "", prefix: 0, lastInputAt: 0, hitCycle: -1, stunnedUntil: 0, finishedElapsed: -1 };
}
export function phaseAt(start: number | null, now: number) {
  const elapsed = start === null ? -1 : now - start;
  const cycle = Math.max(0, Math.floor(elapsed / CYCLE_MS));
  const beatMs = 720 - (cycle % 4) * 60;
  const within = Math.max(0, elapsed % CYCLE_MS);
  const watching = elapsed >= 0 && within >= CHANT.length * beatMs;
  return { cycle, beatMs, active: elapsed >= 0, watching,
    syllable: elapsed < 0 ? -1 : Math.min(CHANT.length - 1, Math.floor(within / beatMs)),
    shotAt: (start ?? now) + cycle * CYCLE_MS + CHANT.length * beatMs };
}
export function hiddenAt(state: EscapeProgress, now: number): boolean {
  return now - state.lastInputAt >= HIDE_MS || state.distance >= FINISH || now < state.stunnedUntil;
}
function hit(state: EscapeProgress, cycle: number, now: number): EscapeProgress {
  if (state.hitCycle === cycle || state.distance >= FINISH) return state;
  return { ...state, distance: Math.max(0, state.distance - 15), hitCycle: cycle, stunnedUntil: now + 1_200 };
}
/** Judge the shot at its scheduled timestamp, even after a background-tab timer gap. */
export function advanceEscape(state: EscapeProgress, start: number | null, now: number): EscapeProgress {
  const phase = phaseAt(start, now);
  if (!phase.active || state.distance >= FINISH) return state;
  const previousCycle = phaseAt(start, state.lastInputAt).cycle;
  if (previousCycle < 0 || previousCycle <= state.hitCycle) return state;
  const shotAt = (start ?? now) + previousCycle * CYCLE_MS + CHANT.length * (720 - (previousCycle % 4) * 60);
  return now >= shotAt && state.lastInputAt > shotAt - HIDE_MS && state.lastInputAt <= shotAt
    ? hit(state, previousCycle, now) : state;
}
export function exposeEscape(state: EscapeProgress, start: number | null, now: number): EscapeProgress {
  const current = advanceEscape(state, start, now);
  const phase = phaseAt(start, now);
  if (!phase.active || current.distance >= FINISH || now < current.stunnedUntil) return current;
  const exposed = { ...current, lastInputAt: now };
  return phase.watching ? hit(exposed, phase.cycle, now) : exposed;
}
export function inputEscape(state: EscapeProgress, target: string, value: string, start: number | null, now: number): EscapeProgress {
  const current = advanceEscape(state, start, now);
  const phase = phaseAt(start, now);
  if (!phase.active || current.distance >= FINISH || now < current.stunnedUntil) return current;
  // Even a wrong letter exposes the player; deletion does not earn movement.
  if (value === current.input) return current;
  if (phase.watching) return hit({ ...current, lastInputAt: now }, phase.cycle, now);
  const delta = getNewValidProgress(target, value, current.prefix);
  const distance = Math.min(FINISH, current.distance + [...delta.newlyValidText].length);
  return { ...current, distance, best: Math.max(current.best, distance), lastInputAt: now,
    finishedElapsed: distance >= FINISH ? Math.max(0, Math.floor(now - (start ?? now))) : -1,
    input: delta.isComplete ? "" : value, prefix: delta.isComplete ? 0 : delta.maxPrefixLength,
    question: current.question + (delta.isComplete ? 1 : 0) };
}
/** Finishers rank before other players, then by arrival time (millisecond ties share a place). */
export function escapeScore(state: EscapeProgress): number {
  return state.finishedElapsed >= 0 ? FINISH + 1 + Math.max(0, 900_000 - state.finishedElapsed) : state.best;
}
export function parseProgress(value: unknown): EscapeProgress {
  if (!value || typeof value !== "object") return initialProgress();
  const v = value as Record<string, unknown>;
  const base = initialProgress();
  if (Object.keys(base).some(key => typeof v[key] !== typeof base[key as keyof EscapeProgress])) return base;
  if (Object.entries(v).some(([key, val]) => key !== "input" && (typeof val !== "number" || !Number.isFinite(val)))) return base;
  const p = v as unknown as EscapeProgress;
  if (p.distance < 0 || p.distance > FINISH || p.best < p.distance || p.best > FINISH
    || !Number.isInteger(p.question) || p.question < 0 || p.question > 1_000_000
    || !Number.isInteger(p.prefix) || p.prefix < 0 || p.prefix > 10_000 || p.input.length > 10_000
    || !Number.isInteger(p.finishedElapsed) || p.finishedElapsed < -1
    || (p.distance >= FINISH) !== (p.finishedElapsed >= 0)) return base;
  return { ...base, ...p };
}
