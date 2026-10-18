import { isRecord } from "../shared/validation.js";

/** Generated questions use the same shape as the client question bank (src/question-bank/types.ts). */
export class ExamQuestionValidationError extends Error {}

const CHOICE_COUNT = 5;
const MAX_COUNT = 10;

export type ExamQuestion = {
  readonly prompt: string;
  readonly context: string | null;
  readonly explanation: string;
} & (
  | { readonly format: "choice"; readonly choices: readonly string[]; readonly correctChoice: number }
  | { readonly format: "written"; readonly answer: string }
);

export interface ExamGenerationInput {
  readonly name: string;
  readonly items: readonly { readonly sourceText: string; readonly meaning: string }[];
  readonly count: number;
  /** Prompts of questions already saved for this set. */
  readonly avoid: readonly string[];
}

function text(value: unknown, maximum: number, message: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new ExamQuestionValidationError(message);
  return value.trim();
}

export function parseExamGenerationInput(raw: unknown): ExamGenerationInput {
  if (!isRecord(raw) || !Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > 100) throw new ExamQuestionValidationError("본문은 1~100개 문장으로 선택해주세요.");
  const items = raw.items.map((item: unknown) => {
    if (!isRecord(item) || typeof item.meaning !== "string" || item.meaning.length > 1000) throw new ExamQuestionValidationError("본문 문장과 뜻을 확인해주세요.");
    return { sourceText: text(item.sourceText, 1000, "본문 문장을 확인해주세요."), meaning: item.meaning.trim() };
  });
  const count = typeof raw.count === "number" && Number.isInteger(raw.count) ? raw.count : 0;
  if (count < 1 || count > MAX_COUNT) throw new ExamQuestionValidationError(`한 번에 1~${MAX_COUNT}문제를 만들 수 있습니다.`);
  const avoid = Array.isArray(raw.avoid) ? raw.avoid.filter((entry): entry is string => typeof entry === "string").slice(0, 40).map((entry) => entry.slice(0, 200)) : [];
  const input = { name: text(raw.name, 120, "세트 이름을 확인해주세요."), items, count, avoid };
  if (JSON.stringify(input).length > 16000) throw new ExamQuestionValidationError("본문이 너무 깁니다.");
  return input;
}

export function parseExamQuestion(raw: unknown): ExamQuestion {
  if (!isRecord(raw)) throw new ExamQuestionValidationError("AI 문제 형식이 올바르지 않습니다.");
  const base = {
    prompt: text(raw.prompt, 600, "AI 문제의 지시문이 올바르지 않습니다."),
    context: typeof raw.context === "string" && raw.context.trim() ? text(raw.context, 2000, "AI 문제의 지문이 너무 깁니다.") : null,
    explanation: typeof raw.explanation === "string" ? raw.explanation.trim().slice(0, 1000) : "",
  };
  if (raw.format === "choice") {
    const choices = Array.isArray(raw.choices) ? raw.choices.map((choice) => text(choice, 300, "AI 선택지가 올바르지 않습니다.")) : [];
    if (choices.length !== CHOICE_COUNT || new Set(choices).size !== CHOICE_COUNT) throw new ExamQuestionValidationError("AI 객관식 문제의 선택지가 5개가 아닙니다.");
    const correctChoice = raw.answer;
    if (typeof correctChoice !== "number" || !Number.isInteger(correctChoice) || correctChoice < 1 || correctChoice > CHOICE_COUNT) throw new ExamQuestionValidationError("AI 객관식 정답 번호가 올바르지 않습니다.");
    return { ...base, format: "choice", choices, correctChoice };
  }
  if (raw.format === "written") return { ...base, format: "written", answer: text(raw.answer, 600, "AI 서술형 정답이 올바르지 않습니다.") };
  throw new ExamQuestionValidationError("AI 문제 유형이 올바르지 않습니다.");
}

/** The AI may return a few broken questions; keep the valid ones, but fail when none survive. */
export function parseExamQuestions(raw: unknown): readonly ExamQuestion[] {
  if (!isRecord(raw) || !Array.isArray(raw.questions)) throw new ExamQuestionValidationError("AI가 문제 목록을 반환하지 않았습니다.");
  const questions = raw.questions.flatMap((question) => {
    try { return [parseExamQuestion(question)]; } catch { return []; }
  });
  if (!questions.length) throw new ExamQuestionValidationError("AI가 올바른 문제를 만들지 못했습니다. 다시 시도해주세요.");
  return questions;
}
