import {
  QUIZ_GAME_SCHEMA_VERSION,
  type QuizGamePlan,
  type QuizGamePlanSummary,
  type QuizGameQuestionSource,
  type QuizGameRound,
  type QuizGameSessionState,
} from "./types.ts";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function requiredText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximum ? text : null;
}

function parseStringConfig(value: unknown): Readonly<Record<string, string>> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 20 || entries.some(([key, item]) => !GAME_ID_PATTERN.test(key) || typeof item !== "string" || item.length > 200)) return null;
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}

export function validateQuizGameName(value: string): string {
  const name = value.trim();
  if (name.length < 2 || name.length > 80) throw new Error("퀴즈 이름은 2~80자로 입력해 주세요.");
  return name;
}

export function validateQuizGameRound(round: QuizGameRound): QuizGameRound {
  if (!ID_PATTERN.test(round.id)) throw new Error("라운드 ID가 올바르지 않습니다.");
  if (!round.title.trim() || round.title.trim().length > 80) throw new Error("라운드 제목은 1~80자로 입력해 주세요.");
  if (!GAME_ID_PATTERN.test(round.gameId)) throw new Error("문제 엔진 ID가 올바르지 않습니다.");
  if (round.source.kind === "stored-set") {
    if (round.source.setId !== null && !ID_PATTERN.test(round.source.setId)) throw new Error("학습 세트 ID가 올바르지 않습니다.");
  } else {
    if (round.source.setType !== "vocabulary" && round.source.setType !== "reading-chunks") throw new Error("직접 출제 세트 타입이 올바르지 않습니다.");
    if (round.source.items.length < 1 || round.source.items.length > 100) throw new Error("직접 출제 문항은 1~100개가 필요합니다.");
    for (const item of round.source.items) {
      if (!ID_PATTERN.test(item.id) || !item.sourceText.trim() || !item.meaning.trim() || item.sourceText.length > 500 || item.meaning.length > 500) throw new Error("직접 출제 문항을 확인해 주세요.");
      if (round.source.setType === "reading-chunks" && item.sourceText.split("/").filter((part) => part.trim()).length < 2) throw new Error("문장만들기 문항은 문장 조각을 /로 2개 이상 나눠 주세요.");
    }
  }
  if (!Number.isInteger(round.durationSeconds) || round.durationSeconds < 10 || round.durationSeconds > 600) {
    throw new Error("라운드 시간은 10~600초로 설정해 주세요.");
  }
  if (!parseStringConfig(round.gameConfig)) throw new Error("문제 엔진 설정이 올바르지 않습니다.");
  return { ...round, title: round.title.trim(), source: round.source.kind === "stored-set" ? { ...round.source } : { ...round.source, items: round.source.items.map((item) => ({ ...item, sourceText: item.sourceText.trim(), meaning: item.meaning.trim() })) }, gameConfig: { ...round.gameConfig } };
}

function parseSource(value: unknown, legacySetId: unknown): QuizGameQuestionSource | null {
  if (!isRecord(value)) {
    const setId = legacySetId === null ? null : requiredText(legacySetId, 128);
    return setId !== null || legacySetId === null ? { kind: "stored-set", setId } : null;
  }
  if (value.kind === "stored-set") {
    const setId = value.setId === null ? null : requiredText(value.setId, 128);
    return setId !== null || value.setId === null ? { kind: "stored-set", setId } : null;
  }
  if (value.kind !== "custom" || (value.setType !== "vocabulary" && value.setType !== "reading-chunks") || !Array.isArray(value.items)) return null;
  const items = value.items.map((item) => {
    if (!isRecord(item)) return null;
    const id = requiredText(item.id, 128);
    const sourceText = requiredText(item.sourceText, 500);
    const meaning = requiredText(item.meaning, 500);
    return id && sourceText && meaning ? { id, sourceText, meaning } : null;
  });
  if (items.some((item) => item === null)) return null;
  return { kind: "custom", setType: value.setType, items: items.filter((item): item is NonNullable<typeof item> => item !== null) };
}

export function validateQuizGameRounds(rounds: readonly QuizGameRound[]): readonly QuizGameRound[] {
  if (rounds.length < 1 || rounds.length > 50) throw new Error("퀴즈에는 1~50개 라운드가 필요합니다.");
  const validated = rounds.map(validateQuizGameRound);
  if (new Set(validated.map((round) => round.id)).size !== validated.length) throw new Error("라운드 ID가 중복되었습니다.");
  return validated;
}

function parseRound(value: unknown): QuizGameRound | null {
  if (!isRecord(value)) return null;
  const id = requiredText(value.id, 128);
  const title = requiredText(value.title, 80);
  const gameId = requiredText(value.gameId, 80);
  const durationSeconds = finiteInteger(value.durationSeconds);
  const gameConfig = parseStringConfig(value.gameConfig);
  const source = parseSource(value.source, value.setId);
  if (!id || !ID_PATTERN.test(id) || !title || !gameId || !GAME_ID_PATTERN.test(gameId) || !source || durationSeconds === null || durationSeconds < 10 || durationSeconds > 600 || !gameConfig) return null;
  try {
    return validateQuizGameRound({ id, title, gameId, source, durationSeconds, gameConfig });
  } catch {
    return null;
  }
}

export function parseQuizGamePlan(id: string, value: unknown): QuizGamePlan | null {
  if (!ID_PATTERN.test(id) || !isRecord(value) || value.schemaVersion !== QUIZ_GAME_SCHEMA_VERSION || !Array.isArray(value.rounds)) return null;
  const name = requiredText(value.name, 80);
  const createdAtMs = finiteInteger(value.createdAtMs);
  const updatedAtMs = finiteInteger(value.updatedAtMs);
  const rounds = value.rounds.map(parseRound);
  if (!name || createdAtMs === null || updatedAtMs === null || rounds.length < 1 || rounds.length > 50 || rounds.some((round) => round === null)) return null;
  const completeRounds = rounds.filter((round): round is QuizGameRound => round !== null);
  if (new Set(completeRounds.map((round) => round.id)).size !== completeRounds.length) return null;
  return { id, name, schemaVersion: QUIZ_GAME_SCHEMA_VERSION, rounds: completeRounds, createdAtMs, updatedAtMs };
}

export function parseQuizGamePlanSummary(id: string, value: unknown): QuizGamePlanSummary | null {
  const plan = parseQuizGamePlan(id, value);
  return plan ? { id: plan.id, name: plan.name, roundCount: plan.rounds.length, updatedAtMs: plan.updatedAtMs } : null;
}

export function parseQuizGameSessionState(value: unknown): QuizGameSessionState | null {
  if (!isRecord(value)) return null;
  const planValue = isRecord(value.plan) ? value.plan : null;
  const planId = planValue ? requiredText(planValue.id, 128) : null;
  const plan = planId ? parseQuizGamePlan(planId, planValue) : null;
  const currentRoundIndex = finiteInteger(value.currentRoundIndex);
  const phase = value.phase;
  const roundIds = Array.isArray(value.roundIds) ? value.roundIds.filter((item): item is string => typeof item === "string" && ID_PATTERN.test(item)) : [];
  if (!plan || currentRoundIndex === null || currentRoundIndex < 0 || currentRoundIndex >= plan.rounds.length || !["answering", "submissions", "leaderboard", "complete"].includes(String(phase)) || roundIds.length !== currentRoundIndex + 1) return null;
  return { plan, currentRoundIndex, phase: phase as QuizGameSessionState["phase"], roundIds };
}
