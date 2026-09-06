import type { RuntimeLearningSet } from "../learning-sets/types.ts";
import type { QuizGameRound } from "./types.ts";

export function quizRoundGameConfig(round: QuizGameRound): Readonly<Record<string, unknown>> {
  if (round.source.kind === "stored-set") {
    const sourceConfig = round.source.setId ? { setId: round.source.setId } : {};
    return { ...sourceConfig, ...round.gameConfig, quizRoundDurationMs: round.durationSeconds * 1_000 };
  }
  const set = {
    id: `quiz-${round.id}`,
    name: round.title,
    type: round.source.setType,
    itemCount: round.source.items.length,
    items: round.source.items,
  } satisfies RuntimeLearningSet;
  return { quizQuestionSequence: "finite", set, ...round.gameConfig, quizRoundDurationMs: round.durationSeconds * 1_000 };
}
