import { useCallback, useMemo } from "react";
import { evaluateMultipleChoice } from "../../game-engine/question-engine/multiple-choice/evaluator.ts";
import { CHOICE_DIRECTION, type MultipleChoiceAnswer, type MultipleChoiceEvaluationDetails } from "../../game-engine/question-engine/multiple-choice/types.ts";
import { usePlayerGameProgress } from "../../game-engine/question-engine/multiplayer/hooks.ts";
import { persistAnswerAttempt, savePlayerProgress } from "../../game-engine/question-engine/multiplayer/repository.ts";
import type { AnswerSubmission, GameProgress } from "../../game-engine/question-engine/types.ts";
import { useQuestionEngine } from "../../game-engine/question-engine/useQuestionEngine.ts";
import { adaptLearningSetToMultipleChoice } from "../../learning-sets/multipleChoiceAdapter.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { simpleQuizChoiceCount } from "./config.ts";

const SIMPLE_QUIZ_COMBO_SCORING = Object.freeze({ bonusPerStep: 20, maximumBonus: 100 });

export function useSimpleQuizGame(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
  readonly disabled?: boolean;
}) {
  const { roomId, session, player, set, disabled = false } = input;
  const choiceCount = simpleQuizChoiceCount(session);
  const questionSet = useMemo(() => adaptLearningSetToMultipleChoice(set, {
    choiceCount,
    direction: CHOICE_DIRECTION.RIGHT_TO_LEFT,
    seed: `${session.roundId}:${set.id}:simple-quiz`,
  }), [choiceCount, session.roundId, set]);
  const progressSubscription = usePlayerGameProgress(roomId, session.roundId, player.id);
  type Question = (typeof questionSet.questions)[number];

  const persistProgress = useCallback((progress: GameProgress<MultipleChoiceEvaluationDetails>) => savePlayerProgress({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    progress,
  }), [player, roomId, session.gameId, session.roundId]);

  const persistSubmission = useCallback((submission: AnswerSubmission<Question, MultipleChoiceAnswer, MultipleChoiceEvaluationDetails>) => persistAnswerAttempt({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    ...submission,
  }), [player, roomId, session.gameId, session.roundId]);

  const evaluator = useCallback((question: Question, answer: MultipleChoiceAnswer) => evaluateMultipleChoice(question, answer, 100), []);
  const engine = useQuestionEngine({
    questions: questionSet.questions,
    roundId: session.roundId,
    evaluator,
    initialProgress: progressSubscription.value,
    progressLoading: progressSubscription.loading,
    repeatQuestions: true,
    disabled,
    comboScoring: SIMPLE_QUIZ_COMBO_SCORING,
    advanceAfterAnyAnswer: true,
    onSubmit: persistSubmission,
    onProgress: persistProgress,
  });

  return {
    ...engine,
    setTitle: questionSet.title,
    choiceCount,
    loading: progressSubscription.loading,
    error: progressSubscription.error,
  };
}
