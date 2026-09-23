import { createHash } from "node:crypto";

export const SIMPLE_QUIZ_RULES_VERSION = "simple-quiz-v2" as const;
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

export interface SimpleQuizAuthoritativeState extends SimpleQuizProgressResult {
  readonly answeredQuestionIds: readonly string[];
  readonly completedQuestionIds: readonly string[];
  readonly lastResult: {
    readonly itemId: string;
    readonly status: "correct" | "incorrect";
    readonly isCorrect: boolean;
    readonly scoreDelta: number;
    readonly feedback: null;
    readonly details: { readonly selectedOptionId: string; readonly correctOptionId: string };
  } | null;
}

export type SoloRunStatus = "active" | "completed" | "abandoned";

export function transitionSoloRunStatus(current: SoloRunStatus, requested: "completed" | "abandoned"): SoloRunStatus {
  if (current === requested) return current;
  if (current === "active") return requested;
  if (current === "completed" && requested === "abandoned") return "completed";
  throw new Error(`Cannot transition Solo run from ${current} to ${requested}.`);
}

export function statusAfterStartingSoloRun(current: SoloRunStatus): SoloRunStatus {
  return current === "active" ? transitionSoloRunStatus(current, "abandoned") : current;
}

export function simpleQuizBestRecordId(studentAccountId: string): string {
  return createHash("sha256").update(studentAccountId).digest("hex");
}

export function matchesSoloStartRequest(value: unknown, expected: {
  readonly ownerUid: string;
  readonly studentAccountId: string;
  readonly tenantId: string;
  readonly gameId: string;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly leaderboardScopeId: string;
  readonly rulesVersion: string;
  readonly gameConfig: Readonly<Record<string, string>>;
  readonly displayLabel: string;
}): boolean {
  if (!isRecord(value) || !isRecord(value.gameConfig)) return false;
  return value.ownerUid === expected.ownerUid
    && value.studentAccountId === expected.studentAccountId
    && value.tenantId === expected.tenantId
    && value.gameId === expected.gameId
    && value.setId === expected.setId
    && value.setFingerprint === expected.setFingerprint
    && value.leaderboardScopeId === expected.leaderboardScopeId
    && value.rulesVersion === expected.rulesVersion
    && value.gameConfig.setId === expected.gameConfig.setId
    && value.gameConfig["choice-count"] === expected.gameConfig["choice-count"]
    && value.gameConfig.timedGameMode === expected.gameConfig.timedGameMode
    && value.displayLabel === expected.displayLabel;
}

export function simpleQuizQuestionId(itemId: string): string {
  return `choice:right-to-left:${itemId}`;
}

export interface SimpleQuizOption {
  readonly id: string;
  readonly text: string;
}

type SimpleQuizSetItem = { readonly id: string; readonly sourceText: string; readonly meaning: string };

export function simpleQuizQuestionOptions(
  items: readonly SimpleQuizSetItem[],
  runId: string,
  setId: string,
  choiceCount: number,
  itemId: string,
): readonly SimpleQuizOption[] {
  const pool = simpleQuizPool(items);
  const candidate = pool.find((item) => item.id === itemId);
  if (!candidate) return [];
  const questionId = simpleQuizQuestionId(itemId);
  const seed = `${runId}:${setId}:simple-quiz`;
  const distractors = shuffleQuiz(simpleQuizDistractors(pool, candidate), `${seed}:${candidate.id}:distractors`)
    .slice(0, choiceCount - 1);
  if (distractors.length !== choiceCount - 1) return [];
  const options: SimpleQuizOption[] = [
    { id: `${questionId}:correct`, text: candidate.sourceText },
    ...distractors.map((distractor, index) => ({ id: `${questionId}:distractor:${index + 1}`, text: distractor.sourceText })),
  ];
  return shuffleQuiz(options, `${seed}:${candidate.id}:options`);
}

export function simpleQuizQuestionOrder(
  items: readonly SimpleQuizSetItem[],
  runId: string,
  setId: string,
  choiceCount: number,
): readonly string[] {
  const pool = simpleQuizPool(items);
  const eligible = pool.filter((item) => simpleQuizDistractors(pool, item).length >= choiceCount - 1);
  const seed = `${runId}:${setId}:simple-quiz`;
  return shuffleQuiz(eligible.map((item) => simpleQuizQuestionId(item.id)), `${seed}:questions`);
}

function simpleQuizPool(items: readonly SimpleQuizSetItem[]): SimpleQuizSetItem[] {
  const answersByPrompt = new Map<string, Set<string>>();
  for (const item of items) {
    const promptKey = normalizedQuizText(item.meaning);
    const answers = answersByPrompt.get(promptKey) ?? new Set<string>();
    answers.add(normalizedQuizText(item.sourceText));
    answersByPrompt.set(promptKey, answers);
  }
  const seenPairs = new Set<string>();
  return items.filter((item) => {
    const promptKey = normalizedQuizText(item.meaning);
    if ((answersByPrompt.get(promptKey)?.size ?? 0) !== 1) return false;
    const signature = `${promptKey}\u0000${normalizedQuizText(item.sourceText)}`;
    if (seenPairs.has(signature)) return false;
    seenPairs.add(signature);
    return true;
  });
}

function simpleQuizDistractors(pool: readonly SimpleQuizSetItem[], correct: SimpleQuizSetItem): SimpleQuizSetItem[] {
  const correctAnswer = normalizedQuizText(correct.sourceText);
  const seenAnswers = new Set<string>();
  return pool.filter((candidate) => {
    const answerKey = normalizedQuizText(candidate.sourceText);
    if (candidate.id === correct.id || answerKey === correctAnswer || seenAnswers.has(answerKey)) return false;
    seenAnswers.add(answerKey);
    return true;
  });
}

export function emptySimpleQuizAuthoritativeState(): SimpleQuizAuthoritativeState {
  return {
    score: 0,
    correctCount: 0,
    attemptCount: 0,
    combo: 0,
    answeredQuestionIds: [],
    completedQuestionIds: [],
    lastResult: null,
  };
}

export function applySimpleQuizAnswer(
  state: SimpleQuizAuthoritativeState,
  questionId: string,
  selectedOptionId: string,
  correctOptionId: string,
): SimpleQuizAuthoritativeState {
  if (state.answeredQuestionIds.includes(questionId)) throw new Error("Solo 문항은 한 번만 제출할 수 있습니다.");
  const isCorrect = selectedOptionId === correctOptionId;
  const combo = isCorrect ? state.combo + 1 : 0;
  const bonus = Math.min(Math.max(combo - 1, 0) * 20, 100);
  const scoreDelta = isCorrect ? 100 + bonus : 0;
  return {
    score: state.score + scoreDelta,
    correctCount: state.correctCount + Number(isCorrect),
    attemptCount: state.attemptCount + 1,
    combo,
    answeredQuestionIds: [...state.answeredQuestionIds, questionId],
    completedQuestionIds: isCorrect ? [...state.completedQuestionIds, questionId] : state.completedQuestionIds,
    lastResult: {
      itemId: questionId,
      status: isCorrect ? "correct" : "incorrect",
      isCorrect,
      scoreDelta,
      feedback: null,
      details: { selectedOptionId, correctOptionId },
    },
  };
}

export function parseSimpleQuizAuthoritativeState(value: unknown): SimpleQuizAuthoritativeState | null {
  if (!isRecord(value)) return null;
  const progress = parseSimpleQuizProgress(value);
  const answered = stringIds(value.answeredQuestionIds);
  const completed = stringIds(value.completedQuestionIds);
  const rawLast = value.lastResult;
  if (!progress || !answered || !completed || progress.attemptCount !== answered.length
    || progress.correctCount !== completed.length || progress.score < progress.correctCount * 100 || progress.score > progress.correctCount * 200
    || new Set(answered).size !== answered.length || new Set(completed).size !== completed.length
    || completed.some((id) => !answered.includes(id))) return null;
  let lastResult: SimpleQuizAuthoritativeState["lastResult"] = null;
  if (rawLast !== null) {
    if (!isRecord(rawLast) || typeof rawLast.itemId !== "string" || !answered.includes(rawLast.itemId)
      || typeof rawLast.isCorrect !== "boolean" || rawLast.status !== (rawLast.isCorrect ? "correct" : "incorrect")
      || typeof rawLast.scoreDelta !== "number" || !Number.isSafeInteger(rawLast.scoreDelta) || rawLast.scoreDelta < 0
      || !isRecord(rawLast.details) || typeof rawLast.details.selectedOptionId !== "string"
      || typeof rawLast.details.correctOptionId !== "string"
      || rawLast.isCorrect !== completed.includes(rawLast.itemId)
      || rawLast.scoreDelta > 200 || (rawLast.isCorrect && rawLast.scoreDelta < 100)
      || (!rawLast.isCorrect && rawLast.scoreDelta !== 0)) return null;
    lastResult = {
      itemId: rawLast.itemId,
      status: rawLast.isCorrect ? "correct" : "incorrect",
      isCorrect: rawLast.isCorrect,
      scoreDelta: rawLast.scoreDelta,
      feedback: null,
      details: { selectedOptionId: rawLast.details.selectedOptionId, correctOptionId: rawLast.details.correctOptionId },
    };
  }
  return { ...progress, answeredQuestionIds: answered, completedQuestionIds: completed, lastResult };
}

export function simpleQuizProgressForClient(
  state: SimpleQuizAuthoritativeState,
  currentIndex: number,
) {
  return {
    currentIndex,
    score: state.score,
    correctCount: state.correctCount,
    attemptCount: state.attemptCount,
    combo: state.combo,
    completedItemIds: state.completedQuestionIds,
    lastResult: state.lastResult,
    completedAtMs: null,
  } as const;
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
    || correctCount > attemptCount || combo > correctCount || score < correctCount * 100
    || score > correctCount * 200 || attemptCount > 10000) return null;
  return { score, correctCount, attemptCount, combo };
}

function normalizedQuizText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function shuffleQuiz<T>(values: readonly T[], seed: string): T[] {
  const result = [...values];
  let state = hashQuizString(seed) || 0x6d2b79f5;
  const random = (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function hashQuizString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stringIds(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && id.length > 0)
    ? value as string[]
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000 ? value : null;
}
