export interface RoundAttemptRecord {
  readonly id: string;
  readonly attemptId: string;
  readonly gameId: string;
  readonly playerId: string;
  readonly displayName: string;
  readonly itemId: string;
  readonly prompt: string | null;
  readonly isCorrect: boolean;
  readonly scoreDelta: number;
  readonly totalScore: number;
  readonly attemptCount: number;
  readonly createdAtMs: number;
}

export interface RoundProgressRecord {
  readonly id: string;
  readonly gameId: string;
  readonly playerId: string;
  readonly displayName: string;
  readonly currentIndex: number;
  readonly score: number;
  readonly correctCount: number;
  readonly attemptCount: number;
  readonly completedAtMs: number | null;
  readonly updatedAtMs: number;
  readonly revision: number;
}
