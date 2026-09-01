import type { AiTutorReply, AiTutorReplyKind } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const kinds = new Set<AiTutorReplyKind>(["correct", "retry", "help", "off-topic"]);

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseAiTutorReply(value: unknown): AiTutorReply {
  if (!isRecord(value) || typeof value.kind !== "string" || !kinds.has(value.kind as AiTutorReplyKind)) {
    throw new Error("AI 문답 응답 형식이 올바르지 않습니다.");
  }
  const kind = value.kind as AiTutorReplyKind;
  const feedback = typeof value.feedback === "string" ? value.feedback.trim() : "";
  if (!feedback || typeof value.isCorrect !== "boolean" || typeof value.scoreDelta !== "number") {
    throw new Error("AI 문답 응답 내용이 올바르지 않습니다.");
  }
  return {
    kind,
    isCorrect: kind === "correct" && value.isCorrect,
    feedback,
    hint: nullableText(value.hint),
    focus: nullableText(value.focus),
    scoreDelta: kind === "correct" ? Math.max(0, value.scoreDelta) : 0,
  };
}

