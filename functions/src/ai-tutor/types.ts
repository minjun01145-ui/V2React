export const AI_TUTOR_GAME_ID = "ai-tutor" as const;

export type AiTutorDirection = "source-to-meaning" | "meaning-to-source";
export type AiTutorSetType = "vocabulary" | "reading-chunks";
export type AiTutorReplyKind = "correct" | "retry" | "help" | "off-topic";

export interface AiTutorTurnInput {
  readonly roomId: string;
  readonly roundId: string;
  readonly itemId: string;
  readonly message: string;
  readonly attemptNumber: number;
  readonly previousFeedback: string | null;
}

export interface AiTutorLearningItem {
  readonly id: string;
  readonly sourceText: string;
  readonly meaning: string;
}

export interface AiTutorRoundContext {
  readonly setType: AiTutorSetType;
  readonly direction: AiTutorDirection;
  readonly item: AiTutorLearningItem;
}

export interface AiTutorReply {
  readonly kind: AiTutorReplyKind;
  readonly isCorrect: boolean;
  readonly feedback: string;
  readonly hint: string | null;
  readonly focus: string | null;
  readonly scoreDelta: number;
}

