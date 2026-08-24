import { useCallback, useMemo } from "react";
import { evaluateMultipleChoice } from "../../game-engine/question-engine/multiple-choice/evaluator.ts";
import type { MultipleChoiceAnswer, MultipleChoiceEvaluationDetails } from "../../game-engine/question-engine/multiple-choice/types.ts";
import { usePlayerGameProgress } from "../../game-engine/question-engine/multiplayer/hooks.ts";
import { persistAnswerAttempt, savePlayerProgress } from "../../game-engine/question-engine/multiplayer/repository.ts";
import type { AnswerSubmission, GameProgress } from "../../game-engine/question-engine/types.ts";
import { useQuestionEngine } from "../../game-engine/question-engine/useQuestionEngine.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { adaptVocabularySet } from "./adapter.ts";

export function usePokemonQuiz(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
}) {
  const { roomId, session, player, set } = input;
  const questionSet = useMemo(() => adaptVocabularySet(set, `${session.roundId}:${set.id}:pokemon-quiz`), [session.roundId, set]);
  const progressSubscription = usePlayerGameProgress(roomId, session.roundId, player.id);
  const persistProgress = useCallback((progress: GameProgress<MultipleChoiceEvaluationDetails>) => savePlayerProgress({
    roomId, roundId: session.roundId, gameId: session.gameId, player, progress,
  }), [player, roomId, session.gameId, session.roundId]);
  const persistSubmission = useCallback((submission: AnswerSubmission<
    (typeof questionSet.questions)[number],
    MultipleChoiceAnswer,
    MultipleChoiceEvaluationDetails
  >) => persistAnswerAttempt({
    roomId, roundId: session.roundId, gameId: session.gameId, player, ...submission,
  }), [player, roomId, session.gameId, session.roundId]);
  const evaluator = useCallback((question: (typeof questionSet.questions)[number], answer: MultipleChoiceAnswer) => (
    evaluateMultipleChoice(question, answer, 100)
  ), []);
  const engine = useQuestionEngine({
    questions: questionSet.questions,
    roundId: session.roundId,
    evaluator,
    initialProgress: progressSubscription.value,
    progressLoading: progressSubscription.loading,
    onSubmit: persistSubmission,
    onProgress: persistProgress,
  });
  return { ...engine, title: questionSet.title, loading: progressSubscription.loading, error: progressSubscription.error };
}
