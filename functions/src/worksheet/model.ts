import { isRecord } from "../shared/validation.js";

export class WorksheetValidationError extends Error {}
export const PRACTICE_KINDS = ["fill-blank", "vocabulary", "sentence-writing", "translation", "correction"] as const;
export type PracticeKind = typeof PRACTICE_KINDS[number];
export interface PracticeSection {
  readonly kind: PracticeKind;
  readonly items: readonly { readonly prompt: string; readonly answer: string }[];
}
export interface WorksheetInput {
  readonly mode: "practice" | "meanings";
  readonly name: string;
  readonly items: readonly { readonly id: string; readonly sourceText: string; readonly meaning: string }[];
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new WorksheetValidationError("학습지 데이터의 문장 또는 정답 형식이 올바르지 않습니다.");
  return value.trim();
}

export function parseWorksheetInput(raw: unknown): WorksheetInput {
  if (!isRecord(raw) || (raw.mode !== "practice" && raw.mode !== "meanings") || !Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > 100) throw new WorksheetValidationError("본문은 1~100개 문장으로 선택해주세요.");
  const items = raw.items.map((item: unknown) => {
    if (!isRecord(item) || typeof item.meaning !== "string" || item.meaning.length > 1000) throw new WorksheetValidationError("본문 문장과 뜻을 확인해주세요.");
    return { id: text(item.id, 100), sourceText: text(item.sourceText, 1000), meaning: item.meaning.trim() };
  });
  if (new Set(items.map(item => item.id)).size !== items.length) throw new WorksheetValidationError("본문 문장 번호가 중복되었습니다.");
  const input: WorksheetInput = { mode: raw.mode, name: text(raw.name, 120), items };
  if (JSON.stringify(input).length > 12000) throw new WorksheetValidationError("본문이 너무 깁니다. 12,000자 이하의 세트를 선택해주세요.");
  return input;
}

export function parseWorksheetJson(reply: string): unknown {
  try { return JSON.parse(reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as unknown; }
  catch { throw new WorksheetValidationError("AI가 올바른 학습지 JSON을 반환하지 않았습니다."); }
}

export function parsePracticeSections(raw: unknown): readonly PracticeSection[] {
  if (!isRecord(raw) || !Array.isArray(raw.sections) || raw.sections.length !== PRACTICE_KINDS.length) throw new WorksheetValidationError("AI 학습지의 문항 유형이 올바르지 않습니다.");
  return raw.sections.map((section: unknown, index): PracticeSection => {
    if (!isRecord(section) || section.kind !== PRACTICE_KINDS[index] || !Array.isArray(section.items) || section.items.length < 1 || section.items.length > 6) throw new WorksheetValidationError("AI 학습지의 문항 구성이 올바르지 않습니다.");
    const items = section.items.map((item: unknown) => {
      if (!isRecord(item)) throw new WorksheetValidationError("AI 문항 형식이 올바르지 않습니다.");
      const prompt = text(item.prompt, 1200);
      const answer = text(item.answer, 1200);
      if ((section.kind === "fill-blank" || section.kind === "vocabulary") && prompt.split("{{blank}}").length !== 2) throw new WorksheetValidationError("AI 빈칸 문항의 빈칸 표시가 올바르지 않습니다.");
      if (section.kind !== "fill-blank" && section.kind !== "vocabulary" && prompt.includes("{{blank}}")) throw new WorksheetValidationError("AI 서술 문항에 빈칸 표시가 포함되었습니다.");
      return { prompt, answer };
    });
    return { kind: section.kind as PracticeKind, items };
  });
}

export function parseMissingMeanings(raw: unknown, items: WorksheetInput["items"]): readonly { readonly id: string; readonly meaning: string }[] {
  const missing = items.filter(item => !item.meaning);
  if (!isRecord(raw) || !Array.isArray(raw.meanings) || raw.meanings.length !== missing.length) throw new WorksheetValidationError("AI가 누락된 뜻을 모두 반환하지 않았습니다.");
  const meanings = raw.meanings.map((entry: unknown) => {
    if (!isRecord(entry)) throw new WorksheetValidationError("AI 뜻 형식이 올바르지 않습니다.");
    return { id: text(entry.id, 100), meaning: text(entry.meaning, 1000) };
  });
  if (new Set(meanings.map(entry => entry.id)).size !== meanings.length || missing.some(item => !meanings.some(entry => entry.id === item.id))) throw new WorksheetValidationError("AI가 반환한 문장 번호가 본문과 다릅니다.");
  return meanings;
}
