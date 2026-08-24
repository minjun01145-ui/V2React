import { LEARNING_SET_TYPE, type LearningSet, type LearningSetItem, type LearningSetSummary, type LearningSetType } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseType(value: unknown): LearningSetType | null {
  return value === LEARNING_SET_TYPE.VOCABULARY || value === LEARNING_SET_TYPE.READING_CHUNKS ? value : null;
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

function parseItems(value: unknown): readonly LearningSetItem[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items: LearningSetItem[] = [];
  for (const raw of value.items) {
    if (!isRecord(raw)) return null;
    const id = typeof raw.id === "string" ? raw.id : "";
    const sourceText = typeof raw.sourceText === "string" ? raw.sourceText.trim() : "";
    const meaning = typeof raw.meaning === "string" ? raw.meaning.trim() : "";
    if (!id || !sourceText || !meaning) return null;
    items.push({ id, sourceText, meaning });
  }
  return items;
}

export function parseLearningSet(id: string, metadata: unknown, content: unknown): LearningSet | null {
  const summary = parseLearningSetSummary(id, metadata);
  const items = parseItems(content);
  if (!summary || !items) return null;
  return { ...summary, itemCount: items.length, items };
}
