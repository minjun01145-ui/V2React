import type { WorksheetBlock, WorksheetDocument, WorksheetQuestion, WorksheetSection } from "./types.ts";

/** Saved worksheets come back from Firestore; anything that would not render is rejected. */
export class WorksheetFormatError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new WorksheetFormatError("저장된 학습지 형식이 올바르지 않습니다.");
  return value as Record<string, unknown>;
}
function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new WorksheetFormatError("저장된 학습지 형식이 올바르지 않습니다.");
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new WorksheetFormatError("저장된 학습지 형식이 올바르지 않습니다.");
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10_000) throw new WorksheetFormatError("저장된 학습지 형식이 올바르지 않습니다.");
  return value;
}

function question(raw: unknown): WorksheetQuestion {
  const value = record(raw);
  const base = { number: count(value.number), text: text(value.text), ...(typeof value.context === "string" && value.context ? { context: value.context } : {}) };
  switch (value.type) {
    case "choice": return { ...base, type: "choice", choices: list(value.choices).map(text) };
    case "blank": return { ...base, type: "blank", answerLength: count(value.answerLength) };
    case "line": return { ...base, type: "line", answerLength: count(value.answerLength) };
    case "written": return { ...base, type: "written", lines: Math.min(6, Math.max(1, count(value.lines))) };
    default: throw new WorksheetFormatError("저장된 학습지 문항 형식이 올바르지 않습니다.");
  }
}

function block(raw: unknown): WorksheetBlock {
  const value = record(raw);
  switch (value.type) {
    case "sentences": {
      const rows = list(value.rows).map((row) => {
        const entry = record(row);
        return { number: count(entry.number), english: text(entry.english), meaning: text(entry.meaning) };
      });
      return value.blank === "english" || value.blank === "meaning" ? { type: "sentences", blank: value.blank, rows } : { type: "sentences", rows };
    }
    case "questions": return { type: "questions", questions: list(value.questions).map(question) };
    case "notice": return { type: "notice", text: text(value.text) };
    case "answers": return { type: "answers", entries: list(value.entries).map((entry) => {
      const item = record(entry);
      return { number: count(item.number), answer: text(item.answer), ...(typeof item.note === "string" && item.note ? { note: item.note } : {}) };
    }) };
    default: throw new WorksheetFormatError("저장된 학습지 블록 형식이 올바르지 않습니다.");
  }
}

function section(raw: unknown): WorksheetSection {
  const value = record(raw);
  return {
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(value.newPage === true ? { newPage: true } : {}),
    blocks: list(value.blocks).map(block),
  };
}

export function parseWorksheetDocument(raw: unknown): WorksheetDocument {
  const value = record(raw);
  return {
    title: text(value.title),
    footer: text(value.footer),
    ...(typeof value.fitPages === "number" && value.fitPages >= 1 && value.fitPages <= 10 ? { fitPages: Math.trunc(value.fitPages) } : {}),
    sections: list(value.sections).map(section),
  };
}
