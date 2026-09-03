import type { QuizGameRound } from "./types.ts";

export function quizRoundGameConfig(round: QuizGameRound): Readonly<Record<string, unknown>> {
  const sourceConfig: Readonly<Record<string, unknown>> = round.source.kind === "stored-set"
    ? (round.source.setId ? { setId: round.source.setId } : {})
    : {
        quizQuestionSequence: "finite",
        set: {
          id: `quiz-${round.id}`,
          name: round.title,
          type: round.source.setType,
          itemCount: round.source.items.length,
          createdAtMs: 0,
          updatedAtMs: 0,
          items: round.source.items,
        },
      };
  return { ...sourceConfig, ...round.gameConfig, quizRoundDurationMs: round.durationSeconds * 1_000 };
}
