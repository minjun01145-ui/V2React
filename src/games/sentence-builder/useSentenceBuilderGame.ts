import { useMemo } from "react";
import { createQuestionDeck } from "../../game-engine/question-engine/questionDeck.ts";
import type { QuestionEngine } from "../../game-engine/question-engine/useQuestionEngine.ts";
import { useMultiplayerQuestionEngine } from "../../game-engine/question-engine/multiplayer/useMultiplayerQuestionEngine.ts";
import { usesFiniteQuestionSequence } from "../../game-engine/question-engine/sessionConfig.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { evaluateSentenceSequence } from "./evaluator.ts";
import { adaptReadingChunksSet } from "./readingChunksAdapter.ts";
import type { SentenceAnswer, SentenceEvaluationDetails, SentenceQuestion } from "./types.ts";

const SENTENCE_COMBO_SCORING = Object.freeze({ bonusPerStep: 20, maximumBonus: 100 });

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
  readonly disabled?: boolean;
}): SentenceBuilderEngine {
  const { roomId, session, player, set, disabled = false } = input;
  const adaptedSet = useMemo(() => adaptReadingChunksSet(set), [set]);
  const questions = useMemo(() => createQuestionDeck(adaptedSet.questions, {
    seed: `${session.roundId}:${adaptedSet.id}:questions`,
    shuffleQuestions: true,
  }), [adaptedSet, session.roundId]);
  const engine = useMultiplayerQuestionEngine({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    questions,
    evaluator: evaluateSentenceSequence,
    repeatQuestions: !usesFiniteQuestionSequence(session.gameConfig),
    disabled,
    comboScoring: SENTENCE_COMBO_SCORING,
  });

  return {
    ...engine,
    setTitle: adaptedSet.title,
  };
}
