import { useCallback, useMemo } from "react";
import type { AnswerSubmission } from "../../game-engine/question-engine/types.ts";
import { useSoloQuestionEngine } from "../../solo/runtime/useSoloQuestionEngine.ts";
import type { SoloRun } from "../../solo/contracts.ts";
import { submitSoloSequenceAnswer } from "../../solo/persistence/repository.ts";
import { adaptReadingChunksSet } from "./readingChunksAdapter.ts";
import { evaluateSentenceSequence } from "./evaluator.ts";
import { SENTENCE_COMBO_SCORING } from "./useSentenceBuilderGame.ts";
import type { SentenceAnswer, SentenceEvaluationDetails, SentenceQuestion } from "./types.ts";

export function useSoloSentenceBuilderGame(run: SoloRun, set: unknown, disabled = false) {
  const questionSet = useMemo(() => adaptReadingChunksSet(set), [set]);
  const evaluator = useCallback(evaluateSentenceSequence, []);
  const submitAnswer = useCallback(async (submission: AnswerSubmission<SentenceQuestion, SentenceAnswer, SentenceEvaluationDetails>) =>
    submitSoloSequenceAnswer<SentenceEvaluationDetails>(run, {
      attemptId: submission.attemptId,
      currentIndex: submission.previousProgress.currentIndex,
      questionId: submission.question.id,
      itemId: submission.question.id,
      tokenIds: submission.answer.tokenIds,
    }), [run]);
  const engine = useSoloQuestionEngine({
    run,
    questions: questionSet.questions,
    evaluator,
    comboScoring: SENTENCE_COMBO_SCORING,
    disabled,
    submitAnswer,
  });
  return { ...engine, setTitle: questionSet.title };
}
