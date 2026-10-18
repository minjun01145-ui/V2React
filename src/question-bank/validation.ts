import { EXAM_CHOICE_COUNT, type ExamQuestionContent } from "./types.ts";

/** Questions arrive from the AI callable and from Firestore; both are checked before use. */
export class QuestionFormatError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new QuestionFormatError("문제 형식이 올바르지 않습니다.");
  return value as Record<string, unknown>;
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new QuestionFormatError("문제 내용이 비었거나 너무 깁니다.");
  return value.trim();
}

export function parseExamQuestion(raw: unknown): ExamQuestionContent {
  const value = record(raw);
  const base = {
    prompt: text(value.prompt, 600),
    context: typeof value.context === "string" && value.context.trim() ? text(value.context, 2000) : null,
    explanation: typeof value.explanation === "string" ? value.explanation.trim().slice(0, 1000) : "",
  };
  if (value.format === "choice") {
    const choices = Array.isArray(value.choices) ? value.choices.map((choice) => text(choice, 300)) : [];
    const correctChoice = value.correctChoice;
    if (choices.length !== EXAM_CHOICE_COUNT || new Set(choices).size !== choices.length) throw new QuestionFormatError("객관식은 서로 다른 선택지 5개가 필요합니다.");
    if (typeof correctChoice !== "number" || !Number.isInteger(correctChoice) || correctChoice < 1 || correctChoice > EXAM_CHOICE_COUNT) throw new QuestionFormatError("객관식 정답 번호가 올바르지 않습니다.");
    return { ...base, format: "choice", choices, correctChoice };
  }
  if (value.format === "written") return { ...base, format: "written", answer: text(value.answer, 600) };
  throw new QuestionFormatError("문제 유형이 올바르지 않습니다.");
}
