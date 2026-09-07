import { isRecord } from "../shared/validation.js";
import type { AuthoringHelpInput, AuthoringHelpReply, StudentQuestionConfig, StudentQuestionDraft } from "./types.js";

export class StudentQuestionValidationError extends Error {}
const ID = /^[\p{L}\p{N}._-]{1,128}$/u;
const KOREAN = /[\u3131-\u318e\uac00-\ud7a3]/u;

export function validId(value: unknown, label: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!ID.test(result)) throw new StudentQuestionValidationError(`${label}가 올바르지 않습니다.`);
  return result;
}
export function parseConfig(value: unknown): StudentQuestionConfig {
  if (!isRecord(value) || typeof value.questionCount !== "number" || !Number.isInteger(value.questionCount) || value.questionCount < 1 || value.questionCount > 5 || typeof value.englishQuestionsOnly !== "boolean") {
    throw new StudentQuestionValidationError("질문 만들기 설정이 올바르지 않습니다.");
  }
  return { questionCount: value.questionCount, englishQuestionsOnly: value.englishQuestionsOnly };
}
export function parseQuestions(value: unknown, config: StudentQuestionConfig): readonly StudentQuestionDraft[] {
  if (!Array.isArray(value) || value.length !== config.questionCount) throw new StudentQuestionValidationError(`질문을 정확히 ${config.questionCount}개 제출해야 합니다.`);
  return value.map((raw) => {
    if (!isRecord(raw)) throw new StudentQuestionValidationError("질문 형식이 올바르지 않습니다.");
    const question = typeof raw.question === "string" ? raw.question.trim() : "";
    const referenceAnswer = typeof raw.referenceAnswer === "string" ? raw.referenceAnswer.trim() : "";
    if (!question || !referenceAnswer || question.length > 500 || referenceAnswer.length > 1000) throw new StudentQuestionValidationError("질문과 모범답안을 확인해 주세요.");
    if (config.englishQuestionsOnly && KOREAN.test(question)) throw new StudentQuestionValidationError("질문은 영어로 작성해 주세요. 한글이 포함되어 있습니다.");
    return { question, referenceAnswer };
  });
}
export function parseFinalizeInput(value: unknown): { readonly roomId: string; readonly runId: string; readonly force: boolean } {
  if (!isRecord(value) || typeof value.force !== "boolean") throw new StudentQuestionValidationError("종료 요청 형식이 올바르지 않습니다.");
  return { roomId: validId(value.roomId, "방 ID"), runId: validId(value.runId, "활동 ID"), force: value.force };
}
export function parseHelpInput(value: unknown): AuthoringHelpInput {
  if (!isRecord(value)) throw new StudentQuestionValidationError("AI 도움 요청 형식이 올바르지 않습니다.");
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!message || message.length > 700) throw new StudentQuestionValidationError("도움을 받고 싶은 내용을 700자 이내로 입력해 주세요.");
  if (typeof value.interactionCount !== "number" || !Number.isInteger(value.interactionCount) || value.interactionCount < 1 || value.interactionCount > 20) throw new StudentQuestionValidationError("도움 요청 횟수가 올바르지 않습니다.");
  if (typeof value.helpLevel !== "number" || !Number.isInteger(value.helpLevel) || value.helpLevel < 1 || value.helpLevel > 5) throw new StudentQuestionValidationError("도움 단계가 올바르지 않습니다.");
  return { roomId: validId(value.roomId, "방 ID"), runId: validId(value.runId, "활동 ID"), message, interactionCount: value.interactionCount, helpLevel: value.helpLevel };
}
export function parseHelpReply(text: string, maximumLevel: number): AuthoringHelpReply {
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new StudentQuestionValidationError("AI 도움 응답을 해석하지 못했습니다.");
  let raw: unknown; try { raw = JSON.parse(text.slice(start, end + 1)); } catch { throw new StudentQuestionValidationError("AI 도움 응답을 해석하지 못했습니다."); }
  if (!isRecord(raw) || typeof raw.hint !== "string" || !raw.hint.trim() || typeof raw.helpLevel !== "number" || !Number.isInteger(raw.helpLevel)) throw new StudentQuestionValidationError("AI 도움 응답 형식이 올바르지 않습니다.");
  return { hint: raw.hint.trim().slice(0, 1000), helpLevel: Math.max(1, Math.min(maximumLevel, raw.helpLevel)) };
}
