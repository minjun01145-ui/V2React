import { ANSWER_STATUS, type AnswerResult } from "./types.ts";

interface CreateAnswerResultInput<TDetails> {
  readonly isCorrect: boolean;
  readonly scoreDelta?: number;
  readonly feedback?: string | null;
  readonly details?: TDetails | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createAnswerResult<TDetails = unknown>({
  isCorrect,
  scoreDelta = 0,
  feedback = null,
  details = null,
}: CreateAnswerResultInput<TDetails>): Readonly<AnswerResult<TDetails>> {
  if (!Number.isFinite(scoreDelta)) throw new TypeError("scoreDelta must be a finite number");
  return Object.freeze({
    status: isCorrect ? ANSWER_STATUS.CORRECT : ANSWER_STATUS.INCORRECT,
    isCorrect,
    scoreDelta,
    feedback,
    details,
  });
}

export function assertAnswerResult<TDetails = unknown>(result: unknown): AnswerResult<TDetails> {
  if (!isRecord(result) || typeof result.isCorrect !== "boolean") {
    throw new TypeError("Evaluator must return createAnswerResult(...) compatible data.");
  }
  const scoreDelta = result.scoreDelta;
  if (typeof scoreDelta !== "number" || !Number.isFinite(scoreDelta)) {
    throw new TypeError("Answer result scoreDelta must be finite.");
  }
  const feedback = result.feedback == null ? null : String(result.feedback);
  return {
    status: result.isCorrect ? ANSWER_STATUS.CORRECT : ANSWER_STATUS.INCORRECT,
    isCorrect: result.isCorrect,
    scoreDelta,
    feedback,
    details: (result.details ?? null) as TDetails | null,
  };
}

export function normalizeComparableText(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function evaluateExactText(actual: unknown, expected: unknown, options: { readonly points?: number } = {}): AnswerResult<null> {
  const points = options.points ?? 100;
  const isCorrect = normalizeComparableText(actual) === normalizeComparableText(expected);
  return createAnswerResult({
    isCorrect,
    scoreDelta: isCorrect ? points : 0,
    feedback: isCorrect ? "정답입니다!" : "다시 시도해보세요.",
    details: null,
  });
}
