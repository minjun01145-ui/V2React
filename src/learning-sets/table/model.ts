import type { LearningSetItem, LearningSetType } from "../types.ts";

export type LearningSetTableSide = "source" | "meaning";

export interface LearningSetTableEntry {
  readonly id: string;
  readonly source: string;
  readonly meaning: string;
  readonly sourceLabel: string;
}

export function learningSetTableEntries(type: LearningSetType, items: readonly LearningSetItem[]): readonly LearningSetTableEntry[] {
  const sourceLabel = type === "reading-chunks" ? "영어 문장" : "영단어";
  return items.map((item) => ({
    id: item.id,
    source: item.sourceText.replaceAll("/", " ").replace(/\s+/g, " ").trim(),
    meaning: item.meaning.trim(),
    sourceLabel,
  }));
}

export function battleQuestionFromSelection(entry: LearningSetTableEntry, selectedSide: LearningSetTableSide) {
  return selectedSide === "source"
    ? { prompt: entry.meaning, answer: entry.source, direction: "meaning-to-source" as const }
    : { prompt: entry.source, answer: entry.meaning, direction: "source-to-meaning" as const };
}
