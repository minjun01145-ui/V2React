import { useCallback } from "react";
import type { Player } from "../../../multiplayer/types.ts";
import { usePlayerGameProgress } from "../../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt, persistGameProgress } from "../../../multiplayer/game-progress/repository.ts";
import { normalizeProgress } from "../../progress/index.ts";
import { useQuestionEngine } from "../useQuestionEngine.ts";
import type { AnswerSubmission, BaseQuestion, Evaluator, ProgressSubmission } from "../types.ts";
import type { ComboScoringConfig } from "../../scoring/combo.ts";

export function useMultiplayerQuestionEngine<TQuestion extends BaseQuestion, TAnswer, TDetails>(input: {
  readonly roomId: string;
  readonly roundId: string;
  readonly gameId: string;
  readonly player: Player;
  readonly questions: readonly TQuestion[];
  readonly evaluator: Evaluator<TQuestion, TAnswer, TDetails>;
  readonly repeatQuestions?: boolean;
  readonly disabled?: boolean;
  readonly comboScoring?: ComboScoringConfig;
  readonly advanceAfterAnyAnswer?: boolean;
}) {
  const { roomId, roundId, gameId, player } = input;
  const progressSubscription = usePlayerGameProgress(roomId, roundId, player.id);
  const persistProgress = useCallback(async (submission: ProgressSubmission<TDetails>) => {
    const committed = await persistGameProgress({ roomId, roundId, gameId, player, ...submission });
    return normalizeProgress<TDetails>(committed.progress, input.questions.length);
  }, [gameId, input.questions.length, player, roomId, roundId]);
  const persistSubmission = useCallback(async (submission: AnswerSubmission<TQuestion, TAnswer, TDetails>) => {
    const { question, ...attempt } = submission;
    const committed = await persistGameAttempt({ roomId, roundId, gameId, player, ...attempt, item: question });
    return normalizeProgress<TDetails>(committed.progress, input.questions.length);
  }, [gameId, input.questions.length, player, roomId, roundId]);
  const engine = useQuestionEngine({
    questions: input.questions,
    roundId,
    evaluator: input.evaluator,
    initialProgress: progressSubscription.value,
    progressLoading: progressSubscription.loading,
    ...(input.repeatQuestions === undefined ? {} : { repeatQuestions: input.repeatQuestions }),
    ...(input.disabled === undefined ? {} : { disabled: input.disabled }),
    ...(input.comboScoring === undefined ? {} : { comboScoring: input.comboScoring }),
    ...(input.advanceAfterAnyAnswer === undefined ? {} : { advanceAfterAnyAnswer: input.advanceAfterAnyAnswer }),
    onSubmit: persistSubmission,
    onProgress: persistProgress,
  });
  return { ...engine, loading: progressSubscription.loading, error: progressSubscription.error };
}
