import type { AiTutorDirection, AiTutorQuestion } from "../ai-tutor-engine/types.ts";
import { LEARNING_SET_TYPE, type RuntimeLearningSet } from "./types.ts";

export function adaptLearningSetToAiTutor(set: RuntimeLearningSet, direction: AiTutorDirection): readonly AiTutorQuestion[] {
  if (set.type === LEARNING_SET_TYPE.STUDENT_QUESTIONS) return set.items.map((item) => ({
    id: item.id,
    prompt: item.sourceText,
    referenceAnswer: item.meaning,
    promptLabel: "학생이 만든 질문에 답해 보세요",
    answerLabel: "답 또는 질문과 관련된 도움 요청",
    ...(item.author ? { author: item.author } : {}),
  }));
  const sentence = set.type === LEARNING_SET_TYPE.READING_CHUNKS;
  return set.items.map((item) => direction === "source-to-meaning" ? {
    id: item.id,
    prompt: item.sourceText,
    referenceAnswer: item.meaning,
    promptLabel: sentence ? "이 문장을 해석해 보세요" : "이 단어의 뜻을 써 보세요",
    answerLabel: "한국어로 답하기",
  } : {
    id: item.id,
    prompt: item.meaning,
    referenceAnswer: item.sourceText,
    promptLabel: sentence ? "이 뜻을 영어 문장으로 써 보세요" : "뜻에 맞는 영단어를 써 보세요",
    answerLabel: "영어로 답하기",
  });
}
