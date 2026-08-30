import type { CanonicalQuestionSet } from "../../game-engine/question-engine/types.ts";

export const TYPING_TARGET = Object.freeze({
  SOURCE: "source",
  MEANING: "meaning",
} as const);

export type TypingTarget = (typeof TYPING_TARGET)[keyof typeof TYPING_TARGET];

export interface TypingComparisonOptions {
  readonly ignoreCase?: boolean;
  readonly ignorePunctuation?: boolean;
}

export interface TypingSpeedStats {
  readonly currentCpm: number;
  readonly averageCpm: number;
  readonly bestCpm: number;
  readonly totalValidStrokes: number;
}

export interface TypingQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly targetText: string;
  readonly helperText: string;
  readonly source: {
    readonly setId: string;
    readonly itemIndex: number;
  };
}

export interface TypingAnswer {
  readonly inputText: string;
  readonly speed: TypingSpeedStats;
}

export interface TypingEvaluationDetails extends TypingSpeedStats {
  readonly accuracy: number;
}

export type TypingQuestionSet = CanonicalQuestionSet<TypingQuestion>;
