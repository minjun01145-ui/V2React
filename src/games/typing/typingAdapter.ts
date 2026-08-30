import { validateCanonicalQuestionSet } from "../../game-engine/question-engine/canonicalQuestionSet.ts";
import { LEARNING_SET_TYPE } from "../../learning-sets/types.ts";
import { cleanTypingPrompt } from "./typingEngine.ts";
import { TYPING_TARGET, type TypingQuestion, type TypingQuestionSet, type TypingTarget } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}이(가) 없습니다.`);
  return value.trim();
}

export function adaptLearningSetToTyping(set: unknown, target: TypingTarget): TypingQuestionSet {
  if (!isRecord(set)) throw new Error("학습 세트 데이터가 올바른 객체가 아닙니다.");
  const setType = set.type;
  if (setType !== LEARNING_SET_TYPE.VOCABULARY && setType !== LEARNING_SET_TYPE.READING_CHUNKS) {
    throw new Error("타자게임은 단어 또는 끊어읽기 세트만 사용할 수 있습니다.");
  }
  if (!Array.isArray(set.items)) throw new Error("학습 세트에 items 배열이 필요합니다.");
  const setId = requiredText(set.id, "세트 ID");
  const questions: TypingQuestion[] = [];
  set.items.forEach((rawItem, itemIndex) => {
    if (!isRecord(rawItem)) throw new Error(`${itemIndex + 1}번 학습 항목이 올바르지 않습니다.`);
    const id = requiredText(rawItem.id, `${itemIndex + 1}번 항목 ID`);
    const sourceText = requiredText(rawItem.sourceText, `${itemIndex + 1}번 sourceText`);
    const meaning = requiredText(rawItem.meaning, `${itemIndex + 1}번 meaning`);
    const targetText = cleanTypingPrompt(target === TYPING_TARGET.MEANING ? meaning : sourceText);
    const helperText = cleanTypingPrompt(target === TYPING_TARGET.MEANING ? sourceText : meaning);
    if (!targetText) return;
    questions.push({
      id,
      prompt: targetText,
      targetText,
      helperText,
      source: { setId, itemIndex },
    });
  });
  return validateCanonicalQuestionSet({
    id: setId,
    title: requiredText(set.name, "세트 이름"),
    type: setType,
    questions,
  });
}
