import { isRecord } from "../shared/validation.js";
import type { AiTutorReply, AiTutorReplyKind, AiTutorTurnInput } from "./types.js";

export class AiTutorValidationError extends Error {}

function requiredId(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^[\p{L}\p{N}._-]{1,128}$/u.test(text)) throw new AiTutorValidationError(`${label}가 올바르지 않습니다.`);
  return text;
}

function limitedText(value: unknown, maximum: number, label: string): string {
  const text = typeof value === "string" ? value.normalize("NFKC").trim() : "";
  if (!text || text.length > maximum) throw new AiTutorValidationError(`${label}을(를) 확인해주세요.`);
  return text;
}

export function parseAiTutorTurnInput(value: unknown): AiTutorTurnInput {
  if (!isRecord(value)) throw new AiTutorValidationError("AI 문답 요청 형식이 올바르지 않습니다.");
  const attemptNumber = typeof value.attemptNumber === "number" ? Math.trunc(value.attemptNumber) : 0;
  if (attemptNumber < 1 || attemptNumber > 20) throw new AiTutorValidationError("시도 횟수가 올바르지 않습니다.");
  const previousFeedback = value.previousFeedback == null ? null : limitedText(value.previousFeedback, 600, "이전 피드백");
  const direction = value.direction == null
    ? null
    : value.direction === "source-to-meaning" || value.direction === "meaning-to-source"
      ? value.direction
      : (() => { throw new AiTutorValidationError("문제 방향이 올바르지 않습니다."); })();
  return {
    roomId: requiredId(value.roomId, "대기실 ID"),
    roundId: requiredId(value.roundId, "라운드 ID"),
    itemId: requiredId(value.itemId, "문항 ID"),
    message: limitedText(value.message, 1000, "답변"),
    attemptNumber,
    previousFeedback,
    direction,
  };
}

const kinds = new Set<AiTutorReplyKind>(["correct", "retry", "help", "off-topic"]);

function optionalText(value: unknown, maximum: number): string | null {
  if (value == null) return null;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : null;
}

function extractJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiTutorValidationError("AI가 채점 형식에 맞는 응답을 주지 않았습니다.");
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as unknown;
  } catch {
    throw new AiTutorValidationError("AI 채점 응답을 해석하지 못했습니다.");
  }
}

export function parseAiTutorReply(text: string): AiTutorReply {
  const raw = extractJson(text);
  if (!isRecord(raw) || typeof raw.kind !== "string" || !kinds.has(raw.kind as AiTutorReplyKind)) {
    throw new AiTutorValidationError("AI 채점 결과가 올바르지 않습니다.");
  }
  const kind = raw.kind as AiTutorReplyKind;
  const feedback = typeof raw.feedback === "string" ? raw.feedback.trim().slice(0, 700) : "";
  if (!feedback) throw new AiTutorValidationError("AI 피드백이 비어 있습니다.");
  if (kind === "off-topic") {
    return {
      kind,
      isCorrect: false,
      feedback: "지금 문제와 관련된 답이나 질문만 입력해 주세요.",
      hint: null,
      focus: null,
      scoreDelta: 0,
    };
  }
  return {
    kind,
    isCorrect: kind === "correct",
    feedback,
    hint: kind === "retry" ? optionalText(raw.hint, 400) : null,
    focus: kind === "retry" ? optionalText(raw.focus, 300) : null,
    scoreDelta: kind === "correct" ? 10 : 0,
  };
}
