export type QuestionType = "multiple-choice" | "ox" | "short-answer" | "ai-short-answer";
export type PublicQuestion =
  | { readonly type: "multiple-choice"; readonly prompt: string; readonly doublePoints: boolean; readonly options: readonly string[] }
  | { readonly type: "ox" | "short-answer" | "ai-short-answer"; readonly prompt: string; readonly doublePoints: boolean };
export type GradingKey = { readonly correctOptions: readonly number[] } | { readonly answer: string };
export interface QuestionSource { readonly kind: "slide-question"; readonly question: PublicQuestion; readonly grading?: GradingKey }
export const OPTION_COLORS = ["#E21B3C", "#1368CE", "#D89E00", "#26890C", "#864CBF"] as const;
export const OPTION_SYMBOLS = ["▲", "◆", "●", "■", "★"] as const;
export function newQuestion(type: QuestionType = "multiple-choice"): QuestionSource {
  return { kind: "slide-question", question: type === "multiple-choice" ? { type, prompt: "", doublePoints: false, options: ["", ""] } : { type, prompt: "", doublePoints: false }, grading: type === "multiple-choice" ? { correctOptions: [0] } : { answer: type === "ox" ? "O" : "" } };
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export function parseQuestion(value: unknown): PublicQuestion | null {
  if (!record(value) || typeof value.prompt !== "string" || !value.prompt.trim() || value.prompt.length > 1000 || typeof value.doublePoints !== "boolean") return null;
  const common = { prompt: value.prompt.trim(), doublePoints: value.doublePoints };
  if (value.type === "multiple-choice") {
    if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 5 || value.options.some((option) => typeof option !== "string" || !option.trim() || option.length > 500)) return null;
    return { type: value.type, ...common, options: value.options.map((option: string) => option.trim()) };
  }
  return value.type === "ox" || value.type === "short-answer" || value.type === "ai-short-answer" ? { type: value.type, ...common } : null;
}
export function parseGrading(question: PublicQuestion, value: unknown): GradingKey | null {
  if (!record(value)) return null;
  if (question.type === "multiple-choice") {
    if (!Array.isArray(value.correctOptions) || value.correctOptions.length < 1 || value.correctOptions.length > question.options.length || new Set(value.correctOptions).size !== value.correctOptions.length || value.correctOptions.some((index) => !Number.isInteger(index) || index < 0 || index >= question.options.length)) return null;
    return { correctOptions: value.correctOptions as number[] };
  }
  if (typeof value.answer !== "string" || !value.answer.trim() || value.answer.length > 500 || (question.type === "ox" && value.answer !== "O" && value.answer !== "X")) return null;
  return { answer: value.answer.trim() };
}
export function validateQuestionSource(source: QuestionSource, requireGrading = true): QuestionSource {
  const question = parseQuestion(source.question);
  if (!question) throw new Error("문제와 선택지(2~5개)를 입력해 주세요.");
  const grading = parseGrading(question, source.grading);
  if ((requireGrading || source.grading !== undefined) && !grading) throw new Error("정답을 한 개 이상 지정해 주세요.");
  return grading ? { kind: "slide-question", question, grading } : { kind: "slide-question", question };
}
export function publicQuestionSource(source: QuestionSource): QuestionSource { return { kind: "slide-question", question: source.question }; }
export type JudgementMethod = "deterministic" | "ai" | "fallback";
export interface QuestionResponse { readonly playerId: string; readonly displayName: string; readonly answer: string; readonly submittedAtMs: number; readonly correct: boolean | null; readonly method: JudgementMethod | null; readonly score: number }
export function parseQuestionResponse(value: unknown): QuestionResponse | null {
  if (!record(value) || typeof value.playerId !== "string" || typeof value.displayName !== "string" || typeof value.answer !== "string" || typeof value.submittedAtMs !== "number" || !Number.isFinite(value.submittedAtMs) || (value.correct !== null && typeof value.correct !== "boolean") || (value.method !== null && value.method !== "deterministic" && value.method !== "ai" && value.method !== "fallback") || !Number.isInteger(value.score) || (value.score as number) < 0 || (value.score as number) > 2000) return null;
  return { playerId: value.playerId, displayName: value.displayName, answer: value.answer, submittedAtMs: value.submittedAtMs, correct: value.correct, method: value.method, score: value.score as number };
}
