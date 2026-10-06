import { createSeededRandom } from "../../game-engine/core/random.ts";
import { getTypingComparisonState, isIgnoredTypingCharacter, normalizeTypingCharacter } from "../../game-engine/typing/typingEngine.ts";
import type { TypingComparisonOptions } from "../../game-engine/typing/types.ts";

export const CHANT = [..."무궁화꽃이피었습니다"];
export const CYCLE_MS = 6_400;
export const HIDE_MS = 140;
export const FINISH = 100;
export const STEP = 8;
/** Completing a word or sentence leaps the runner this far forward. */
export const WORD_JUMP = FINISH / 2;
export const JUMP_MS = 900;
export const ESCAPE_POINTS = 100;
export const RESPAWN_MS = 1_200;
/** A shot runner lies where they fell for a 3-2-1 countdown before restarting. */
export const DEATH_MS = 3_000;

export interface EscapeProgress {
  distance: number; question: number; input: string; strokes: number;
  lastInputAt: number; hitCycle: number; stunnedUntil: number; escapedUntil: number;
  completedUntil: number; escapes: number; hits: number;
}
export function initialProgress(): EscapeProgress {
  return { distance: 0, question: 0, input: "", strokes: 0, lastInputAt: 0,
    hitCycle: -1, stunnedUntil: 0, escapedUntil: 0, completedUntil: 0, escapes: 0, hits: 0 };
}

// The shared start timestamp seeds voice, animation and judgement on every client.
export function chantForCycle(start: number, cycle: number) {
  const random = createSeededRandom(`${start}:${cycle}:escape`);
  const patterns = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [0, 1, 2, 3, 4, 5, 5, 5, 6, 7, 8, 9],
    [0, 0, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9],
  ];
  const pattern = patterns[Math.floor(random() * patterns.length)]!;
  const style = Math.floor(random() * 4);
  const total = 2_400 + Math.floor(random() * 2_450);
  const weights = pattern.map((_, index) => {
    if (style === 0) return index < 3 ? 3 + random() * 3 : 0.8 + random();
    if (style === 1) return index === 5 || index === 8 ? 6 + random() * 3 : 1 + random();
    if (style === 2) return index < pattern.length - 4 ? 2 + random() * 4 : 0.7 + random() * 0.3;
    return 1 + random() * 5;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let at = 0;
  const beats = pattern.map((syllable, index) => {
    const duration = 100 + Math.floor((total - pattern.length * 100) * weights[index]! / sum);
    const beat = { syllable, at, duration };
    at += duration;
    return beat;
  });
  return { beats, shotOffset: at + 160 };
}

export function phaseAt(start: number | null, now: number) {
  const elapsed = start === null ? -1 : now - start;
  const cycle = Math.max(0, Math.floor(elapsed / CYCLE_MS));
  const plan = chantForCycle(start ?? 0, cycle);
  const within = Math.max(0, elapsed % CYCLE_MS);
  let beat = 0;
  for (let i = 1; i < plan.beats.length && within >= plan.beats[i]!.at; i++) beat = i;
  const current = plan.beats[beat]!;
  return { cycle, beat, active: elapsed >= 0, watching: elapsed >= 0 && within >= plan.shotOffset,
    syllable: elapsed < 0 ? -1 : current.syllable, beatMs: current.duration,
    text: elapsed < 0 ? "" : plan.beats.slice(0, beat + 1).map(item => CHANT[item.syllable]).join(""),
    shotAt: (start ?? now) + cycle * CYCLE_MS + plan.shotOffset };
}

export function hiddenAt(state: EscapeProgress, now: number): boolean {
  return now - state.lastInputAt >= HIDE_MS || now < state.stunnedUntil;
}
// A shot erases the half-typed answer; the runner returns to the start once the countdown ends.
function hit(state: EscapeProgress, cycle: number, now: number): EscapeProgress {
  if (state.hitCycle === cycle) return state;
  return { ...state, input: "", strokes: 0, hits: state.hits + 1, hitCycle: cycle, stunnedUntil: now + DEATH_MS };
}
/** Resolve the last movement's shot even if the tab slept through the entire red phase. */
export function advanceEscape(state: EscapeProgress, start: number | null, now: number): EscapeProgress {
  if (state.stunnedUntil && now >= state.stunnedUntil) state = { ...state, distance: 0, stunnedUntil: 0, lastInputAt: 0 };
  if (start === null || now < start || state.lastInputAt < start) return state;
  const previous = phaseAt(start, state.lastInputAt);
  return now >= previous.shotAt && state.lastInputAt > previous.shotAt - HIDE_MS
    ? hit(state, previous.cycle, now) : state;
}
export function exposeEscape(state: EscapeProgress, start: number | null, now: number): EscapeProgress {
  const current = advanceEscape(state, start, now);
  const phase = phaseAt(start, now);
  if (!phase.active || now < current.stunnedUntil) return current;
  const exposed = { ...current, lastInputAt: now };
  return phase.watching ? hit(exposed, phase.cycle, now) : exposed;
}

const INITIALS = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const VOWELS = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅗㅏ", "ㅗㅐ", "ㅗㅣ", "ㅛ", "ㅜ", "ㅜㅓ", "ㅜㅔ", "ㅜㅣ", "ㅠ", "ㅡ", "ㅡㅣ", "ㅣ"];
const FINALS = ["", "ㄱ", "ㄲ", "ㄱㅅ", "ㄴ", "ㄴㅈ", "ㄴㅎ", "ㄷ", "ㄹ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ", "ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅁ", "ㅂ", "ㅂㅅ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
function typingKeys(text: string, options: TypingComparisonOptions): string[] {
  return [...text.normalize("NFC")].flatMap(character => {
    const syllable = character.charCodeAt(0) - 0xac00;
    if (syllable >= 0 && syllable < 11_172) return [...(INITIALS[Math.floor(syllable / 588)]! + VOWELS[Math.floor(syllable % 588 / 28)]! + FINALS[syllable % 28]!)];
    const vowel = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".indexOf(character);
    if (vowel >= 0) return [...VOWELS[vowel]!];
    const code = character.charCodeAt(0);
    if (code >= 0x3131 && code <= 0x318e) return [character];
    return isIgnoredTypingCharacter(character, options) ? [] : [normalizeTypingCharacter(character, options)];
  });
}
export function escapeTypingState(target: string, value: string, options: TypingComparisonOptions = {}) {
  const expected = typingKeys(target, options);
  const actual = typingKeys(value, options);
  let strokes = 0;
  while (strokes < actual.length && actual[strokes] === expected[strokes]) strokes++;
  const comparison = getTypingComparisonState(target, value, options);
  return { strokes, hasError: actual.length > strokes, isComplete: comparison.isComplete,
    prefix: comparison.currentPrefixLength };
}

export function inputEscape(state: EscapeProgress, target: string, value: string, start: number | null, now: number,
  composing = false, options: TypingComparisonOptions = {}): EscapeProgress {
  const current = advanceEscape(state, start, now);
  const phase = phaseAt(start, now);
  if (!phase.active || now < current.stunnedUntil || !target) return current;
  // Erasing is not running: it never exposes the runner, even while the guard watches.
  if (typingKeys(value, options).length < typingKeys(current.input, options).length) return { ...current, input: value };
  if (phase.watching) return value === current.input ? current : hit({ ...current, lastInputAt: now }, phase.cycle, now);
  const typing = escapeTypingState(target, value, options);
  const delta = Math.max(0, typing.strokes - current.strokes);
  const complete = typing.isComplete && !composing;
  if (value === current.input && !complete) return current;
  const distance = current.distance + delta * STEP + (complete ? WORD_JUMP : 0);
  // Escaping starts the next lap at once so typing never stalls; the escaping
  // keystroke itself cannot get the new runner caught.
  const escaped = distance >= FINISH;
  return { ...current, distance: escaped ? 0 : distance,
    lastInputAt: escaped ? 0 : value === current.input ? current.lastInputAt : now,
    escapes: current.escapes + (escaped ? 1 : 0), escapedUntil: escaped ? now + RESPAWN_MS : current.escapedUntil,
    completedUntil: complete ? now + JUMP_MS : current.completedUntil,
    input: complete ? "" : value, strokes: complete ? 0 : Math.max(current.strokes, typing.strokes),
    question: current.question + (complete ? 1 : 0) };
}
export function escapeScore(state: EscapeProgress): number { return state.escapes * ESCAPE_POINTS; }

export function parseProgress(value: unknown): EscapeProgress {
  if (!value || typeof value !== "object") return initialProgress();
  const v = value as Record<string, unknown>;
  const base = initialProgress();
  for (const key of Object.keys(base) as (keyof EscapeProgress)[]) {
    if (key === "input") { if (typeof v[key] !== "string" || v[key].length > 10_000) return base; }
    else if (typeof v[key] !== "number" || !Number.isSafeInteger(v[key]) || v[key] < (key === "hitCycle" ? -1 : 0)) return base;
  }
  const p = v as unknown as EscapeProgress;
  if (p.distance >= FINISH || p.strokes > 30_000 || p.question > 1_000_000 || p.escapes > 1_000_000 || p.hits > 1_000_000) return base;
  return Object.fromEntries(Object.keys(base).map(key => [key, v[key]])) as unknown as EscapeProgress;
}
