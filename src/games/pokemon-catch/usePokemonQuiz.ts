import { useCallback, useMemo } from "react";
import { evaluateMultipleChoice, type MultipleChoiceAnswer } from "../../game-engine/question-engine/multiple-choice/index.ts";
import { useMultiplayerQuestionEngine } from "../../game-engine/question-engine/multiplayer/useMultiplayerQuestionEngine.ts";
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
  const evaluator = useCallback((question: (typeof questionSet.questions)[number], answer: MultipleChoiceAnswer) => (
    evaluateMultipleChoice(question, answer, 100)
  ), []);
  const engine = useMultiplayerQuestionEngine({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    questions: questionSet.questions,
    evaluator,
  });
  return { ...engine, title: questionSet.title };
}
