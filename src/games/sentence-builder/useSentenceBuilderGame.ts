import { useCallback, useMemo } from "react";
import { createQuestionDeck } from "../../game-engine/question-engine/questionDeck.ts";
import { useQuestionEngine, type QuestionEngine } from "../../game-engine/question-engine/useQuestionEngine.ts";
import { usePlayerGameProgress } from "../../game-engine/question-engine/multiplayer/hooks.ts";
import { persistAnswerAttempt, savePlayerProgress } from "../../game-engine/question-engine/multiplayer/repository.ts";
import type { AnswerSubmission, GameProgress } from "../../game-engine/question-engine/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { evaluateSentenceSequence } from "./evaluator.ts";
import { adaptReadingChunksSet } from "./readingChunksAdapter.ts";
import type { SentenceAnswer, SentenceEvaluationDetails, SentenceQuestion } from "./types.ts";

export type SentenceBuilderEngine = QuestionEngine<SentenceQuestion, SentenceAnswer, SentenceEvaluationDetails> & {
  readonly setTitle: string;
  readonly loading: boolean;
  readonly error: Error | null;
};

export function useSentenceBuilderGame(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: unknown;
}): SentenceBuilderEngine {
  const { roomId, session, player, set } = input;
  const adaptedSet = useMemo(() => adaptReadingChunksSet(set), [set]);
  const questions = useMemo(() => createQuestionDeck(adaptedSet.questions, {
    seed: `${session.roundId}:${adaptedSet.id}:questions`,
    shuffleQuestions: true,
  }), [adaptedSet, session.roundId]);
  const progressSubscription = usePlayerGameProgress(roomId, session.roundId, player.id);

  const persistProgress = useCallback((progress: GameProgress<SentenceEvaluationDetails>) => savePlayerProgress({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    progress,
  }), [player, roomId, session.gameId, session.roundId]);

  const persistSubmission = useCallback((submission: AnswerSubmission<SentenceQuestion, SentenceAnswer, SentenceEvaluationDetails>) => persistAnswerAttempt({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    ...submission,
  }), [player, roomId, session.gameId, session.roundId]);

  const engine = useQuestionEngine({
    questions,
    roundId: session.roundId,
    evaluator: evaluateSentenceSequence,
    initialProgress: progressSubscription.value,
    progressLoading: progressSubscription.loading,
    onSubmit: persistSubmission,
    onProgress: persistProgress,
  });

  return {
    ...engine,
    setTitle: adaptedSet.title,
    loading: progressSubscription.loading,
    error: progressSubscription.error,
  };
}
