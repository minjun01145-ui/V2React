import type { CanonicalQuestionSet } from "../../game-engine/question-engine/types.ts";

export interface SentenceToken {
  readonly id: string;
  readonly text: string;
  readonly order: number;
}

export interface SentenceQuestion {
  readonly id: string;
  readonly kind: "sequence";
  readonly prompt: string;
  readonly tokens: readonly SentenceToken[];
  readonly expectedTokenIds: readonly string[];
  readonly source: {
    readonly setId: string;
    readonly itemIndex: number;
  };
}

export type SentenceQuestionSet = CanonicalQuestionSet<SentenceQuestion>;

export interface SentenceAnswer {
  readonly tokenIds: readonly string[];
  readonly text: string;
}

export interface SentenceEvaluationDetails {
  readonly selectedCount: number;
  readonly expectedCount: number;
}
