import type { RuntimeLearningSet } from "../learning-sets/types.ts";
import type { WorksheetDocument } from "../worksheet/types.ts";

export const PRACTICE_LABELS = {
  "fill-blank": "빈칸 채우기",
  vocabulary: "단어 및 표현 쓰기",
  "sentence-writing": "문장 쓰기",
  translation: "해석하기",
  correction: "틀린 부분 찾아 바르게 고치기",
} as const;
export type PracticeKind = keyof typeof PRACTICE_LABELS;
export interface PracticeSection {
  readonly kind: PracticeKind;
  readonly items: readonly { readonly prompt: string; readonly answer: string }[];
}
export interface MissingMeaning { readonly id: string; readonly meaning: string }

export function createReadingWorksheet(set: RuntimeLearningSet, meanings: readonly MissingMeaning[] = []): WorksheetDocument {
  const byId = new Map(meanings.map(entry => [entry.id, entry.meaning]));
  const rows = set.items.map((item, index) => ({ number: index + 1, english: item.sourceText, meaning: item.meaning || byId.get(item.id) || "" }));
  return {
    title: "본문 학습지", subtitle: set.name, kind: "본문 학습지",
    sections: [
      { title: "본문 익히기", blocks: [{ type: "sentences", rows }] },
      { title: "뜻만 보고 영어 쓰기", newPage: true, blocks: [{ type: "sentences", writing: true, rows }] },
    ],
  };
}

export function createPracticeWorksheet(setName: string, sections: readonly PracticeSection[]): WorksheetDocument {
  let number = 0;
  const answers: { number: number; answer: string }[] = [];
  return {
    title: "연습문제 학습지", subtitle: setName, kind: "연습문제 학습지",
    sections: [
      ...sections.map(section => ({
        title: PRACTICE_LABELS[section.kind],
        blocks: [{ type: "questions" as const, questions: section.items.map(item => {
          const current = ++number;
          answers.push({ number: current, answer: item.answer });
          return section.kind === "fill-blank" || section.kind === "vocabulary"
            ? { number: current, text: item.prompt, type: "blank" as const, answerLength: item.answer.length }
            : { number: current, text: item.prompt, type: "written" as const, lines: 3 as const };
        }) }],
      })),
      { title: "정답", newPage: true, blocks: [{ type: "answers", entries: answers }] },
    ],
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePracticeResult(value: unknown): { readonly sections: readonly PracticeSection[]; readonly latencyMs: number } {
  if (!record(value) || value.mode !== "practice" || !Array.isArray(value.sections) || value.sections.length !== 5 || typeof value.latencyMs !== "number" || !Number.isFinite(value.latencyMs)) throw new Error("학습지 응답 형식이 올바르지 않습니다.");
  const kinds = Object.keys(PRACTICE_LABELS);
  const sections = value.sections.map((section: unknown, index): PracticeSection => {
    if (!record(section) || section.kind !== kinds[index] || !Array.isArray(section.items) || section.items.length < 1 || section.items.length > 6) throw new Error("학습지 문항 유형이 올바르지 않습니다.");
    const kind = section.kind as PracticeKind;
    const items = section.items.map((item: unknown) => {
      if (!record(item) || typeof item.prompt !== "string" || !item.prompt.trim() || item.prompt.length > 1200 || typeof item.answer !== "string" || !item.answer.trim() || item.answer.length > 1200) throw new Error("학습지 문항 데이터가 올바르지 않습니다.");
      if ((kind === "fill-blank" || kind === "vocabulary") ? item.prompt.split("{{blank}}").length !== 2 : item.prompt.includes("{{blank}}")) throw new Error("학습지 빈칸 표시가 올바르지 않습니다.");
      return { prompt: item.prompt, answer: item.answer };
    });
    return { kind, items };
  });
  return { sections, latencyMs: value.latencyMs };
}

export function parseMeaningsResult(value: unknown, missingIds: readonly string[]): readonly MissingMeaning[] {
  if (!record(value) || value.mode !== "meanings" || !Array.isArray(value.meanings) || value.meanings.length !== missingIds.length) throw new Error("누락된 뜻의 응답 형식이 올바르지 않습니다.");
  const meanings = value.meanings.map((entry: unknown) => {
    if (!record(entry) || typeof entry.id !== "string" || typeof entry.meaning !== "string" || !entry.meaning.trim() || entry.meaning.length > 1000) throw new Error("뜻 데이터가 올바르지 않습니다.");
    return { id: entry.id, meaning: entry.meaning };
  });
  if (new Set(meanings.map(entry => entry.id)).size !== meanings.length || missingIds.some(id => !meanings.some(entry => entry.id === id))) throw new Error("뜻의 문장 번호가 본문과 다릅니다.");
  return meanings;
}
