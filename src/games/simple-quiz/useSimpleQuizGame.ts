import { useCallback, useMemo } from "react";
import { useMultiplayerQuestionEngine } from "../../game-engine/question-engine/multiplayer/useMultiplayerQuestionEngine.ts";
import { usesFiniteQuestionSequence } from "../../game-engine/question-engine/sessionConfig.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { adaptSimpleQuizSet } from "./adapter.ts";
import { simpleQuizChoiceCount } from "./config.ts";
import { evaluateSimpleQuizAnswer, SIMPLE_QUIZ_COMBO_SCORING } from "./model.ts";

export function useSimpleQuizGame(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: RuntimeLearningSet;
  readonly disabled?: boolean;
}) {
  const { roomId, session, player, set, disabled = false } = input;
  const choiceCount = simpleQuizChoiceCount(session);
  const questionSet = useMemo(() => adaptSimpleQuizSet(set, session.roundId, choiceCount), [choiceCount, session.roundId, set]);

  const evaluator = useCallback(evaluateSimpleQuizAnswer, []);
  const engine = useMultiplayerQuestionEngine({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    questions: questionSet.questions,
    evaluator,
    repeatQuestions: !usesFiniteQuestionSequence(session.gameConfig),
    disabled,
    comboScoring: SIMPLE_QUIZ_COMBO_SCORING,
    advanceAfterAnyAnswer: true,
  });

  return {
    ...engine,
    setTitle: questionSet.title,
    choiceCount,
  };
}
