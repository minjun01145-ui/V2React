import { useCallback, useMemo } from "react";
import { evaluateMultipleChoice, type MultipleChoiceAnswer } from "../../game-engine/question-engine/multiple-choice/index.ts";
import { useMultiplayerQuestionEngine } from "../../game-engine/question-engine/multiplayer/useMultiplayerQuestionEngine.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { adaptSimpleQuizSet } from "./adapter.ts";
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
  const questionSet = useMemo(() => adaptSimpleQuizSet(set, session.roundId, choiceCount), [choiceCount, session.roundId, set]);
  type Question = (typeof questionSet.questions)[number];

  const evaluator = useCallback((question: Question, answer: MultipleChoiceAnswer) => evaluateMultipleChoice(question, answer, 100), []);
  const engine = useMultiplayerQuestionEngine({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    questions: questionSet.questions,
    evaluator,
    repeatQuestions: true,
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
