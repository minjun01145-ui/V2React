export type AiTutorDirection = "source-to-meaning" | "meaning-to-source";
export type AiTutorReplyKind = "correct" | "retry" | "help" | "off-topic";

export interface AiTutorQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly referenceAnswer: string;
  readonly promptLabel: string;
  readonly answerLabel: string;
}

export interface AiTutorTurnInput {
  readonly roomId: string;
  readonly roundId: string;
  readonly itemId: string;
  readonly message: string;
  readonly attemptNumber: number;
  readonly previousFeedback: string | null;
}

export interface AiTutorReply {
  readonly kind: AiTutorReplyKind;
  readonly isCorrect: boolean;
  readonly feedback: string;
  readonly hint: string | null;
  readonly focus: string | null;
  readonly scoreDelta: number;
}

export interface AiTutorEvaluationDetails {
  readonly kind: AiTutorReplyKind;
  readonly focus: string | null;
  readonly hint: string | null;
}

