export const STUDENT_QUESTION_ACTIVITY_KIND = "student-question-authoring" as const;

export interface StudentQuestionConfig {
  readonly questionCount: number;
  readonly englishQuestionsOnly: boolean;
}

export interface StudentQuestionActivity {
  readonly kind: typeof STUDENT_QUESTION_ACTIVITY_KIND;
  readonly runId: string;
  readonly phase: "active" | "finalizing";
  readonly config: StudentQuestionConfig;
  readonly expectedPlayerIds: readonly string[];
  readonly resultSetId: string | null;
}

export interface StudentQuestionAuthor {
  readonly studentNumber: string;
  readonly displayName: string;
  readonly nickname: string | null;
}

export interface StudentQuestionDraft {
  readonly question: string;
  readonly referenceAnswer: string;
}

export interface StudentQuestionSubmission {
  readonly playerId: string;
  readonly questions: readonly StudentQuestionDraft[];
  readonly submitted: boolean;
  readonly submittedAtMs: number;
}

export interface LatestStudentQuestionResult {
  readonly runId: string;
  readonly resultSetId: string;
  readonly finalizedAtMs: number;
}
