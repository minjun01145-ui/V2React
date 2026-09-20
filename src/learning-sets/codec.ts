import { LEARNING_SET_TYPE, type LearningSet, type LearningSetItem, type LearningSetSummary, type LearningSetType } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseType(value: unknown): LearningSetType | null {
  return value === LEARNING_SET_TYPE.VOCABULARY
    || value === LEARNING_SET_TYPE.READING_CHUNKS
    || value === LEARNING_SET_TYPE.FORM_CHANGES
    || value === LEARNING_SET_TYPE.STUDENT_QUESTIONS
    ? value
    : null;
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseLearningSetSummary(id: string, value: unknown): LearningSetSummary | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const type = parseType(value.type);
  if (!id || !name || !type) return null;
  return {
    id,
    name,
    type,
    itemCount: Math.max(0, Math.trunc(finiteNumber(value.itemCount))),
    createdAtMs: finiteNumber(value.createdAtMs),
    updatedAtMs: finiteNumber(value.updatedAtMs),
  };
}

function parseItems(value: unknown, type: LearningSetType): readonly LearningSetItem[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items: LearningSetItem[] = [];
  for (const raw of value.items) {
    if (!isRecord(raw)) return null;
    const id = typeof raw.id === "string" ? raw.id : "";
    const sourceText = typeof raw.sourceText === "string" ? raw.sourceText.trim() : "";
    const meaning = typeof raw.meaning === "string" ? raw.meaning.trim() : "";
    if (!id || !sourceText || !meaning) return null;
    const form2 = typeof raw.form2 === "string" ? raw.form2.trim() : "";
    const form3 = typeof raw.form3 === "string" ? raw.form3.trim() : "";
    if (type === LEARNING_SET_TYPE.FORM_CHANGES && (!form2 || !form3)) return null;
    const authorValue = isRecord(raw.author) ? raw.author : null;
    const author = authorValue
      && typeof authorValue.studentNumber === "string" && authorValue.studentNumber
      && typeof authorValue.displayName === "string" && authorValue.displayName
      && (authorValue.nickname === null || typeof authorValue.nickname === "string")
      ? { studentNumber: authorValue.studentNumber, displayName: authorValue.displayName, nickname: authorValue.nickname }
      : undefined;
    items.push({
      id,
      sourceText,
      meaning,
      ...(type === LEARNING_SET_TYPE.FORM_CHANGES ? { form2, form3 } : {}),
      ...(author ? { author } : {}),
    });
  }
  return items;
}

export function parseLearningSet(id: string, metadata: unknown, content: unknown): LearningSet | null {
  const summary = parseLearningSetSummary(id, metadata);
  const items = summary ? parseItems(content, summary.type) : null;
  if (!summary || !items) return null;
  return { ...summary, itemCount: items.length, items };
}
