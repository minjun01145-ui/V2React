import { ANSWER_STATUS, type AnswerResult } from "../../game-engine/core/types.ts";
import type {
  TypingAnswer,
  TypingComparisonOptions,
  TypingEvaluationDetails,
  TypingQuestion,
  TypingSpeedStats,
} from "./types.ts";

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

const INITIAL_STROKES = Object.freeze(Array.from({ length: 19 }, () => 1));
const MEDIAL_STROKES = Object.freeze([
  1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 1,
]);
const FINAL_STROKES = Object.freeze([
  0, 1, 1, 2, 1, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
]);
const PUNCTUATION_OR_SYMBOL = /[\p{P}\p{S}]/u;

interface TypingComparisonUnit {
  readonly originalIndex: number;
  readonly originalCharacter: string;
  readonly comparisonCharacter: string;
}

export interface TypingComparisonState {
  readonly targetUnits: readonly TypingComparisonUnit[];
  readonly inputUnits: readonly TypingComparisonUnit[];
  readonly matchedUnitCount: number;
  readonly currentPrefixLength: number;
  readonly hasError: boolean;
  readonly isComplete: boolean;
}

export interface TypingProgressDelta {
  readonly currentPrefixLength: number;
  readonly maxPrefixLength: number;
  readonly newlyValidText: string;
  readonly hasError: boolean;
  readonly isComplete: boolean;
}

export interface TypingSpeedTracker {
  readonly addValidStrokes: (strokeCount: number, now?: number) => void;
  readonly addValidText: (text: string, now?: number) => void;
  readonly getCurrentCpm: (now?: number) => number;
  readonly getAverageCpm: (now?: number) => number;
  readonly getStats: (now?: number) => TypingSpeedStats;
  readonly reset: (now?: number) => void;
}

function nowMilliseconds(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function cleanTypingPrompt(text: unknown): string {
  return String(text ?? "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTypingCharacter(
  character: unknown,
  options: TypingComparisonOptions = {},
): string {
  let normalized = String(character ?? "").normalize("NFKC")
    .replace(/[“”„‟«»]/g, "\"")
    .replace(/[‘’‚‛`´]/g, "'")
    .replace(/[‐-‒–—―−]/g, "-")
    .replace(/…/g, ".");
  if (options.ignoreCase) normalized = normalized.toLocaleLowerCase();
  return normalized;
}

function isIgnoredTypingCharacter(character: string, options: TypingComparisonOptions): boolean {
  if (!options.ignorePunctuation || /[ \t\n\r]/.test(character)) return false;
  return PUNCTUATION_OR_SYMBOL.test(character);
}

function buildTypingComparisonUnits(text: unknown, options: TypingComparisonOptions): TypingComparisonUnit[] {
  const originalText = String(text ?? "");
  const units: TypingComparisonUnit[] = [];
  let originalIndex = 0;
  for (const character of originalText) {
    if (!isIgnoredTypingCharacter(character, options)) {
      units.push({
        originalIndex,
        originalCharacter: character,
        comparisonCharacter: normalizeTypingCharacter(character, options),
      });
    }
    originalIndex += character.length;
  }
  return units;
}

export function getTypingComparisonState(
  targetText: unknown,
  inputText: unknown,
  options: TypingComparisonOptions = {},
): TypingComparisonState {
  const target = String(targetText ?? "");
  const targetUnits = buildTypingComparisonUnits(target, options);
  const inputUnits = buildTypingComparisonUnits(inputText, options);
  const compareLength = Math.min(targetUnits.length, inputUnits.length);
  let matchedUnitCount = 0;
  while (
    matchedUnitCount < compareLength
    && targetUnits[matchedUnitCount]?.comparisonCharacter === inputUnits[matchedUnitCount]?.comparisonCharacter
  ) matchedUnitCount += 1;

  return {
    targetUnits,
    inputUnits,
    matchedUnitCount,
    currentPrefixLength: matchedUnitCount >= targetUnits.length
      ? target.length
      : (targetUnits[matchedUnitCount]?.originalIndex ?? target.length),
    hasError: inputUnits.length > matchedUnitCount,
    isComplete: matchedUnitCount === targetUnits.length && inputUnits.length === targetUnits.length,
  };
}

function removeIgnoredCharacters(text: string, options: TypingComparisonOptions): string {
  return buildTypingComparisonUnits(text, options).map((unit) => unit.originalCharacter).join("");
}

export function countTypingStrokes(text: unknown): number {
  let total = 0;
  for (const character of String(text ?? "")) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      const syllableIndex = code - HANGUL_BASE;
      const initialIndex = Math.floor(syllableIndex / 588);
      const medialIndex = Math.floor((syllableIndex % 588) / 28);
      const finalIndex = syllableIndex % 28;
      total += (INITIAL_STROKES[initialIndex] ?? 0)
        + (MEDIAL_STROKES[medialIndex] ?? 0)
        + (FINAL_STROKES[finalIndex] ?? 0);
    } else if (code >= 0x3131 && code <= 0x318e) {
      total += 1;
    } else if (character !== "\n" && character !== "\r") {
      total += 1;
    }
  }
  return total;
}

export function getNewValidProgress(
  targetText: unknown,
  inputText: unknown,
  previousMaxPrefixLength = 0,
  options: TypingComparisonOptions = {},
): TypingProgressDelta {
  const target = String(targetText ?? "");
  const comparison = getTypingComparisonState(target, inputText, options);
  const safePreviousMaximum = Math.max(0, Math.min(target.length, previousMaxPrefixLength));
  const maxPrefixLength = Math.max(safePreviousMaximum, comparison.currentPrefixLength);
  const rawNewlyValidText = maxPrefixLength > safePreviousMaximum
    ? target.slice(safePreviousMaximum, maxPrefixLength)
    : "";
  return {
    currentPrefixLength: comparison.currentPrefixLength,
    maxPrefixLength,
    newlyValidText: removeIgnoredCharacters(rawNewlyValidText, options),
    hasError: comparison.hasError,
    isComplete: comparison.isComplete,
  };
}

export function calculateCurrentAccuracy(
  targetText: unknown,
  inputText: unknown,
  options: TypingComparisonOptions = {},
): number {
  const comparison = getTypingComparisonState(targetText, inputText, options);
  if (comparison.inputUnits.length === 0) return 100;
  const validTargetText = comparison.targetUnits.slice(0, comparison.matchedUnitCount)
    .map((unit) => unit.originalCharacter).join("");
  const comparableInputText = comparison.inputUnits.map((unit) => unit.originalCharacter).join("");
  const inputStrokes = countTypingStrokes(comparableInputText);
  if (inputStrokes <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((countTypingStrokes(validTargetText) / inputStrokes) * 100)));
}

export function createTypingSpeedTracker({
  windowMs = 30_000,
  minimumSampleMs = 5_000,
}: {
  readonly windowMs?: number;
  readonly minimumSampleMs?: number;
} = {}): TypingSpeedTracker {
  const safeWindowMs = Math.max(1, Number.isFinite(windowMs) ? windowMs : 30_000);
  const safeMinimumSampleMs = Math.max(1, Number.isFinite(minimumSampleMs) ? minimumSampleMs : 5_000);
  let startedAt = nowMilliseconds();
  let totalValidStrokes = 0;
  let bestCpm = 0;
  const strokeEvents: { time: number; count: number }[] = [];

  const removeOldEvents = (now: number): void => {
    const oldestAllowedTime = now - safeWindowMs;
    while ((strokeEvents[0]?.time ?? oldestAllowedTime) < oldestAllowedTime) strokeEvents.shift();
  };
  const addValidStrokes = (strokeCount: number, now = nowMilliseconds()): void => {
    const safeCount = Math.max(0, Number(strokeCount) || 0);
    if (safeCount === 0) return;
    strokeEvents.push({ time: now, count: safeCount });
    totalValidStrokes += safeCount;
  };
  const getCurrentCpm = (now = nowMilliseconds()): number => {
    removeOldEvents(now);
    const windowStrokeCount = strokeEvents.reduce((sum, event) => sum + event.count, 0);
    const actualElapsedMs = Math.min(Math.max(0, now - startedAt), safeWindowMs);
    const calculationMs = Math.max(actualElapsedMs, safeMinimumSampleMs);
    if (windowStrokeCount === 0) return 0;
    const cpm = Math.round(windowStrokeCount / (calculationMs / 60_000));
    bestCpm = Math.max(bestCpm, cpm);
    return cpm;
  };
  const getAverageCpm = (now = nowMilliseconds()): number => totalValidStrokes === 0
    ? 0
    : Math.round(totalValidStrokes / (Math.max(safeMinimumSampleMs, now - startedAt) / 60_000));
  const getStats = (now = nowMilliseconds()): TypingSpeedStats => ({
    currentCpm: getCurrentCpm(now),
    averageCpm: getAverageCpm(now),
    bestCpm,
    totalValidStrokes,
  });
  const reset = (now = nowMilliseconds()): void => {
    startedAt = now;
    totalValidStrokes = 0;
    bestCpm = 0;
    strokeEvents.length = 0;
  };
  return {
    addValidStrokes,
    addValidText: (text, now) => addValidStrokes(countTypingStrokes(text), now),
    getCurrentCpm,
    getAverageCpm,
    getStats,
    reset,
  };
}

export function isTypingAnswerComplete(
  targetText: unknown,
  inputText: unknown,
  options: TypingComparisonOptions = {},
): boolean {
  return getTypingComparisonState(targetText, inputText, options).isComplete;
}

export function evaluateTypingAnswer(
  question: TypingQuestion,
  answer: TypingAnswer,
  options: TypingComparisonOptions = {},
): AnswerResult<TypingEvaluationDetails> {
  const isCorrect = isTypingAnswerComplete(question.targetText, answer.inputText, options);
  return {
    status: isCorrect ? ANSWER_STATUS.CORRECT : ANSWER_STATUS.INCORRECT,
    isCorrect,
    scoreDelta: 0,
    feedback: isCorrect ? "문장을 정확하게 입력했어요!" : "문장을 다시 확인해 주세요.",
    details: {
      accuracy: calculateCurrentAccuracy(question.targetText, answer.inputText, options),
      ...answer.speed,
    },
  };
}
