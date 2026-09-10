import type { CanonicalQuestionSet } from "../question-engine/types.ts";

export interface SequenceToken { readonly id: string; readonly text: string; readonly order: number; }
export interface SequenceQuestion {
  readonly id: string;
  readonly kind: "sequence";
  readonly prompt: string;
  readonly tokens: readonly SequenceToken[];
  readonly expectedTokenIds: readonly string[];
  readonly source: { readonly setId: string; readonly itemIndex: number };
}
export type SequenceQuestionSet = CanonicalQuestionSet<SequenceQuestion>;
export interface SequenceAnswer { readonly tokenIds: readonly string[]; readonly text: string; }
export interface SequenceEvaluationDetails { readonly selectedCount: number; readonly expectedCount: number; }
