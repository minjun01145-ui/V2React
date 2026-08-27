export const LEARNING_SET_TYPE = Object.freeze({
  VOCABULARY: "vocabulary",
  READING_CHUNKS: "reading-chunks",
} as const);

export type LearningSetType = typeof LEARNING_SET_TYPE[keyof typeof LEARNING_SET_TYPE];

export function isLearningSetType(value: string): value is LearningSetType {
  return Object.values(LEARNING_SET_TYPE).some((type) => type === value);
}

export interface LearningSetItem {
  readonly id: string;
  readonly sourceText: string;
  readonly meaning: string;
}

export interface LearningSetSummary {
  readonly id: string;
  readonly name: string;
  readonly type: LearningSetType;
  readonly itemCount: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface LearningSet extends LearningSetSummary {
  readonly items: readonly LearningSetItem[];
}

export interface SaveLearningSetInput {
  readonly id?: string;
  readonly name: string;
  readonly type: LearningSetType;
  readonly items: readonly LearningSetItem[];
  readonly createdAtMs?: number;
}

export function learningSetTypeLabel(type: LearningSetType): string {
  return type === LEARNING_SET_TYPE.READING_CHUNKS ? "끊어읽기" : "단어";
}
