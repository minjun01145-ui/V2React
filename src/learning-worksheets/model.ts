import type { RuntimeLearningSet } from "../learning-sets/types.ts";
import { examAnswerText, type BankQuestion } from "../question-bank/types.ts";
import { parseAiUsage, type AiUsage } from "../shared/aiUsage.ts";
import type { SentenceRow, WorksheetDocument, WorksheetQuestion } from "../worksheet/types.ts";

export const WORKSHEET_KINDS = {
  reading: "본문 학습지",
  recitation: "본문 연습 학습지",
  practice: "연습문제 학습지",
  exam: "시험 연습문제",
} as const;
export type WorksheetKind = keyof typeof WORKSHEET_KINDS;

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

/** "3학년 5과 Paint a Better…" → "3학년 5과"; sets named without a grade and lesson keep their full name. */
export function lessonLabel(setName: string): string {
  const match = /(\d+\s*학년)\s*(\d+\s*과)/.exec(setName);
  return match ? `${match[1]!.replace(/\s+/g, "")} ${match[2]!.replace(/\s+/g, "")}` : setName.trim();
}

function frame(set: Pick<RuntimeLearningSet, "name">, kind: WorksheetKind): Pick<WorksheetDocument, "title" | "footer"> {
  return { title: `${lessonLabel(set.name)} - ${WORKSHEET_KINDS[kind]}`, footer: `${set.name} · ${WORKSHEET_KINDS[kind]}` };
}

function sentenceRows(set: RuntimeLearningSet, meanings: readonly MissingMeaning[]): SentenceRow[] {
  const byId = new Map(meanings.map((entry) => [entry.id, entry.meaning]));
  return set.items.map((item, index) => ({ number: index + 1, english: item.sourceText, meaning: item.meaning || byId.get(item.id) || "" }));
}

/** The text and its meaning on at most two pages, for memorising. */
export function createReadingWorksheet(set: RuntimeLearningSet, meanings: readonly MissingMeaning[] = []): WorksheetDocument {
  return { ...frame(set, "reading"), fitPages: 2, sections: [{ blocks: [{ type: "sentences", rows: sentenceRows(set, meanings) }] }] };
}

/** Writing practice on the same text: fill in the meanings, then write the English from the meanings. */
export function createRecitationWorksheet(set: RuntimeLearningSet, meanings: readonly MissingMeaning[] = []): WorksheetDocument {
  const rows = sentenceRows(set, meanings);
  return {
    ...frame(set, "recitation"),
    sections: [
      { title: "뜻 쓰기", blocks: [{ type: "sentences", blank: "meaning", rows }] },
      { title: "영어 쓰기", newPage: true, blocks: [{ type: "sentences", blank: "english", rows }] },
    ],
  };
}

function practiceQuestion(kind: PracticeKind, number: number, prompt: string, answer: string): WorksheetQuestion {
  switch (kind) {
    case "fill-blank":
    case "vocabulary": return { number, text: prompt, type: "blank", answerLength: answer.length };
    case "correction": return { number, text: prompt, type: "line", answerLength: answer.length };
    case "sentence-writing":
    case "translation": return { number, text: prompt, type: "written", lines: 2 };
  }
}

/** AI-written questions grouped by type, with the answers on their own page. */
export function createPracticeWorksheet(set: Pick<RuntimeLearningSet, "name">, sections: readonly PracticeSection[]): WorksheetDocument {
  let number = 0;
  const answers: { number: number; answer: string }[] = [];
  return {
    ...frame(set, "practice"),
    sections: [
      ...sections.map((section) => ({
        title: PRACTICE_LABELS[section.kind],
        blocks: [{ type: "questions" as const, questions: section.items.map((item) => {
          number += 1;
          answers.push({ number, answer: item.answer });
          return practiceQuestion(section.kind, number, item.prompt, item.answer);
        }) }],
      })),
      { title: "정답", newPage: true, blocks: [{ type: "answers", entries: answers }] },
    ],
  };
}

/** Saved question-bank questions as an exam paper; answers and explanations follow on their own page. */
export function createExamWorksheet(set: Pick<RuntimeLearningSet, "name">, questions: readonly BankQuestion[]): WorksheetDocument {
  return {
    ...frame(set, "exam"),
    sections: [
      { blocks: [{ type: "questions", questions: questions.map(({ content }, index): WorksheetQuestion => {
        const base = { number: index + 1, text: content.prompt, ...(content.context ? { context: content.context } : {}) };
        return content.format === "choice" ? { ...base, type: "choice", choices: content.choices } : { ...base, type: "written", lines: 2 };
      }) }] },
      { title: "정답 및 해설", newPage: true, blocks: [{ type: "answers", entries: questions.map(({ content }, index) => ({
        number: index + 1, answer: examAnswerText(content), ...(content.explanation ? { note: content.explanation } : {}),
      })) }] },
    ],
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePracticeResult(value: unknown): { readonly sections: readonly PracticeSection[]; readonly usage: AiUsage | null } {
  if (!record(value) || value.mode !== "practice" || !Array.isArray(value.sections) || value.sections.length !== 5) throw new Error("학습지 응답 형식이 올바르지 않습니다.");
  const kinds = Object.keys(PRACTICE_LABELS);
  const sections = value.sections.map((section: unknown, index): PracticeSection => {
    if (!record(section) || section.kind !== kinds[index] || !Array.isArray(section.items) || section.items.length < 1 || section.items.length > 20) throw new Error("학습지 문항 유형이 올바르지 않습니다.");
    const kind = section.kind as PracticeKind;
    const items = section.items.map((item: unknown) => {
      if (!record(item) || typeof item.prompt !== "string" || !item.prompt.trim() || item.prompt.length > 1200 || typeof item.answer !== "string" || !item.answer.trim() || item.answer.length > 1200) throw new Error("학습지 문항 데이터가 올바르지 않습니다.");
      if ((kind === "fill-blank" || kind === "vocabulary") ? item.prompt.split("{{blank}}").length !== 2 : item.prompt.includes("{{blank}}")) throw new Error("학습지 빈칸 표시가 올바르지 않습니다.");
      return { prompt: item.prompt, answer: item.answer };
    });
    return { kind, items };
  });
  return { sections, usage: parseAiUsage(value.usage) };
}

export function parseMeaningsResult(value: unknown, missingIds: readonly string[]): { readonly meanings: readonly MissingMeaning[]; readonly usage: AiUsage | null } {
  if (!record(value) || value.mode !== "meanings" || !Array.isArray(value.meanings) || value.meanings.length !== missingIds.length) throw new Error("누락된 뜻의 응답 형식이 올바르지 않습니다.");
  const meanings = value.meanings.map((entry: unknown) => {
    if (!record(entry) || typeof entry.id !== "string" || typeof entry.meaning !== "string" || !entry.meaning.trim() || entry.meaning.length > 1000) throw new Error("뜻 데이터가 올바르지 않습니다.");
    return { id: entry.id, meaning: entry.meaning };
  });
  if (new Set(meanings.map((entry) => entry.id)).size !== meanings.length || missingIds.some((id) => !meanings.some((entry) => entry.id === id))) throw new Error("뜻의 문장 번호가 본문과 다릅니다.");
  return { meanings, usage: parseAiUsage(value.usage) };
}
