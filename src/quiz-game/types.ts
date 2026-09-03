export const QUIZ_GAME_SCHEMA_VERSION = 1 as const;

export type QuizGamePhase = "answering" | "submissions" | "leaderboard" | "complete";

export type QuizGameQuestionSource =
  | { readonly kind: "stored-set"; readonly setId: string | null }
  | {
      readonly kind: "custom";
      readonly setType: "vocabulary" | "reading-chunks";
      readonly items: readonly QuizGameCustomItem[];
    };

export interface QuizGameCustomItem {
  readonly id: string;
  readonly sourceText: string;
  readonly meaning: string;
}

export interface QuizGameRound {
  readonly id: string;
  readonly title: string;
  readonly gameId: string;
  readonly source: QuizGameQuestionSource;
  readonly durationSeconds: number;
  readonly gameConfig: Readonly<Record<string, string>>;
}

export interface QuizGamePlan {
  readonly id: string;
  readonly name: string;
  readonly schemaVersion: typeof QUIZ_GAME_SCHEMA_VERSION;
  readonly rounds: readonly QuizGameRound[];
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface QuizGamePlanSummary {
  readonly id: string;
  readonly name: string;
  readonly roundCount: number;
  readonly updatedAtMs: number;
}

export interface QuizGameSessionState {
  readonly plan: QuizGamePlan;
  readonly currentRoundIndex: number;
  readonly phase: QuizGamePhase;
  readonly roundIds: readonly string[];
}

export interface SaveQuizGamePlanInput {
  readonly id?: string;
  readonly name: string;
  readonly rounds: readonly QuizGameRound[];
  readonly createdAtMs?: number;
}
