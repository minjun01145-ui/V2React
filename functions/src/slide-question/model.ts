export type PublicQuestion =
  | { readonly type: "multiple-choice"; readonly prompt: string; readonly doublePoints: boolean; readonly options: readonly string[] }
  | { readonly type: "ox" | "short-answer" | "ai-short-answer"; readonly prompt: string; readonly doublePoints: boolean };
export type GradingKey = { readonly correctOptions: readonly number[] } | { readonly answer: string };
export interface QuestionSource { readonly kind: "slide-question"; readonly question: PublicQuestion; readonly grading?: GradingKey }
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
export function normalizeShortAnswer(value: string): string { return value.trim().replace(/\s+/gu, " ").toLowerCase(); }
export function normalizeAiAnswer(value: string): string { return value.normalize("NFC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "").normalize("NFC"); }
export type JudgementMethod = "deterministic" | "ai" | "fallback";
export async function gradeQuestion(question: PublicQuestion, grading: GradingKey, answer: string, ai: (reference: string, answer: string) => Promise<boolean>): Promise<{ correct: boolean; method: JudgementMethod }> {
  if (question.type === "multiple-choice") return { correct: "correctOptions" in grading && grading.correctOptions.includes(Number(answer)), method: "deterministic" };
  if (!("answer" in grading)) throw new Error("정답 형식이 올바르지 않습니다.");
  const correct = question.type === "ai-short-answer" ? normalizeAiAnswer(grading.answer) === normalizeAiAnswer(answer) : normalizeShortAnswer(grading.answer) === normalizeShortAnswer(answer);
  if (question.type !== "ai-short-answer" || correct) return { correct, method: "deterministic" };
  try { return { correct: await ai(grading.answer, answer), method: "ai" }; }
  catch { return { correct, method: "fallback" }; }
}
export function questionScore(correct: boolean, elapsedMs: number, durationMs: number, doublePoints: boolean): number {
  return correct ? Math.round(1000 * (1 - Math.min(durationMs, Math.max(0, elapsedMs)) / durationMs / 2)) * (doublePoints ? 2 : 1) : 0;
}
