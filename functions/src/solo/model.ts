import { createHash } from "node:crypto";

export const SIMPLE_QUIZ_RULES_VERSION = "simple-quiz-v1" as const;
export const SIMPLE_QUIZ_LEADERBOARD_CONFIG_KEYS = ["choice-count", "timedGameMode"] as const;

export interface SimpleQuizProgressResult {
  readonly score: number;
  readonly correctCount: number;
  readonly attemptCount: number;
  readonly combo: number;
}

export interface SimpleQuizBestResult extends SimpleQuizProgressResult {
  readonly displayLabel: string;
  readonly completedAtMs: number;
}

export type SoloRunStatus = "active" | "completed" | "abandoned";

export function transitionSoloRunStatus(current: SoloRunStatus, requested: "completed" | "abandoned"): SoloRunStatus {
  if (current === requested) return current;
  if (current === "active") return requested;
  if (current === "completed" && requested === "abandoned") return "completed";
  throw new Error(`Cannot transition Solo run from ${current} to ${requested}.`);
}

export function isLeaderboardEligible(status: SoloRunStatus): boolean {
  return status === "completed";
}

export function canonicalizeSimpleQuizLeaderboardScope(input: {
  readonly tenantId: string;
  readonly gameId: string;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly gameConfig: Readonly<Record<string, string>>;
  readonly rulesVersion: string;
}): string {
  const gameplayConfig = Object.fromEntries(
    [...SIMPLE_QUIZ_LEADERBOARD_CONFIG_KEYS].sort().map((key) => [key, input.gameConfig[key] ?? ""]),
  );
  return JSON.stringify({
    tenantId: input.tenantId,
    gameId: input.gameId,
    setId: input.setId,
    setFingerprint: input.setFingerprint,
    gameConfig: gameplayConfig,
    rulesVersion: input.rulesVersion,
  });
}

export function simpleQuizLeaderboardScopeId(input: Parameters<typeof canonicalizeSimpleQuizLeaderboardScope>[0]): string {
  return createHash("sha256").update(canonicalizeSimpleQuizLeaderboardScope(input)).digest("hex");
}

export function fingerprintSimpleQuizSet(type: string, items: readonly { readonly id: string; readonly sourceText: string; readonly meaning: string }[]): string {
  const canonical = JSON.stringify({
    type,
    items: items.map((item) => ({ id: item.id, sourceText: item.sourceText.trim(), meaning: item.meaning.trim() })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function isBetterSimpleQuizResult(candidate: SimpleQuizBestResult, current: SimpleQuizBestResult | null): boolean {
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score > current.score;
  if (candidate.correctCount !== current.correctCount) return candidate.correctCount > current.correctCount;
  if (candidate.attemptCount !== current.attemptCount) return candidate.attemptCount < current.attemptCount;
  return candidate.completedAtMs < current.completedAtMs;
}

export function parseSimpleQuizProgress(value: unknown): SimpleQuizProgressResult | null {
  if (!isRecord(value)) return null;
  const score = integer(value.score);
  const correctCount = integer(value.correctCount);
  const attemptCount = integer(value.attemptCount);
  const combo = integer(value.combo);
  if (score === null || correctCount === null || attemptCount === null || combo === null
    || correctCount > attemptCount || combo > correctCount) return null;
  return { score, correctCount, attemptCount, combo };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : null;
}
