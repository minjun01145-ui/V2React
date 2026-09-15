import { isRecord } from "../shared/validation.js";
import { POKEMON_CATCH_GAME_ID, type AiTutorDirection, type AiTutorLearningItem, type AiTutorRoundContext, type AiTutorSetType } from "./types.js";
import { AiTutorValidationError } from "./validation.js";

function setType(value: unknown): AiTutorSetType | null {
  return value === "vocabulary" || value === "reading-chunks" || value === "student-questions" ? value : null;
}

function parseItem(value: unknown): AiTutorLearningItem | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const sourceText = typeof value.sourceText === "string" ? value.sourceText.trim() : "";
  const meaning = typeof value.meaning === "string" ? value.meaning.trim() : "";
  const author = isRecord(value.author) && typeof value.author.studentNumber === "string" && typeof value.author.displayName === "string"
    ? { studentNumber: value.author.studentNumber, displayName: value.author.displayName, nickname: typeof value.author.nickname === "string" ? value.author.nickname : null }
    : null;
  return id && sourceText && meaning ? { id, sourceText, meaning, ...(author ? { author } : {}) } : null;
}

// 직접 출제와 저장된 세트 모두 같은 문항 검증과 채점 방향을 사용한다.
export function resolveAiTutorRoundContext(input: {
  readonly setType: unknown;
  readonly items: unknown;
  readonly itemId: string;
  readonly gameId: string;
  readonly configuredDirection: unknown;
  readonly requestedDirection: AiTutorDirection | null;
}): AiTutorRoundContext {
  const type = setType(input.setType);
  const items = Array.isArray(input.items) ? input.items : [];
  const item = items.map(parseItem).find((candidate) => candidate?.id === input.itemId) ?? null;
  if (!type || !item) throw new AiTutorValidationError("선택한 학습 세트의 문항을 찾을 수 없습니다.");
  const direction = type === "student-questions" ? "source-to-meaning" : input.gameId === POKEMON_CATCH_GAME_ID
    ? input.requestedDirection ?? "source-to-meaning"
    : input.configuredDirection === "meaning-to-source" ? "meaning-to-source" : "source-to-meaning";
  return { setType: type, direction, item };
}
