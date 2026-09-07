import type { StudentQuestionConfig, StudentQuestionDraft } from "./types.ts";

const KOREAN_PATTERN = /[\u3131-\u318e\uac00-\ud7a3]/u;

export function parseStudentQuestionConfig(value: unknown): StudentQuestionConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("질문 만들기 설정이 올바르지 않습니다.");
  const input = value as Record<string, unknown>;
  if (!Number.isInteger(input.questionCount) || typeof input.questionCount !== "number" || input.questionCount < 1 || input.questionCount > 5) {
    throw new Error("학생당 질문 수는 1~5개여야 합니다.");
  }
  if (typeof input.englishQuestionsOnly !== "boolean") throw new Error("영어 질문 설정이 올바르지 않습니다.");
  return { questionCount: input.questionCount, englishQuestionsOnly: input.englishQuestionsOnly };
}

export function containsKorean(value: string): boolean {
  return KOREAN_PATTERN.test(value.normalize("NFC"));
}

export function validateStudentQuestions(value: readonly StudentQuestionDraft[], config: StudentQuestionConfig): readonly StudentQuestionDraft[] {
  if (value.length !== config.questionCount) throw new Error(`질문과 모범답안을 정확히 ${config.questionCount}개 작성해 주세요.`);
  return value.map((item) => {
    const question = item.question.trim();
    const referenceAnswer = item.referenceAnswer.trim();
    if (!question || !referenceAnswer) throw new Error("질문과 모범답안을 모두 작성해 주세요.");
    if (question.length > 500 || referenceAnswer.length > 1000) throw new Error("질문 또는 모범답안이 너무 깁니다.");
    if (config.englishQuestionsOnly && containsKorean(question)) throw new Error("질문은 영어로 작성해 주세요. 한글이 포함되어 있습니다.");
    return { question, referenceAnswer };
  });
}
