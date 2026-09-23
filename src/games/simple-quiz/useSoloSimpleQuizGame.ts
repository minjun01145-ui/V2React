import { useCallback, useMemo } from "react";
import type { AnswerSubmission } from "../../game-engine/question-engine/types.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import type { SoloRun } from "../../solo/contracts.ts";
import { useSoloQuestionEngine } from "../../solo/runtime/useSoloQuestionEngine.ts";
import { submitSoloRunAnswer } from "../../solo/persistence/repository.ts";
import { adaptSimpleQuizSet } from "./adapter.ts";
import { simpleQuizChoiceCountFromConfig } from "./config.ts";
import { evaluateSimpleQuizAnswer, SIMPLE_QUIZ_COMBO_SCORING } from "./model.ts";
import type { LearningSetQuestionSource } from "../../learning-sets/multipleChoiceTypes.ts";
import type { MultipleChoiceAnswer, MultipleChoiceEvaluationDetails, MultipleChoiceQuestion } from "../../game-engine/question-engine/multiple-choice/index.ts";

export function useSoloSimpleQuizGame(run: SoloRun, set: RuntimeLearningSet) {
  const choiceCount = simpleQuizChoiceCountFromConfig(run.gameConfig);
  const questionSet = useMemo(() => adaptSimpleQuizSet(set, run.runId, choiceCount), [choiceCount, run.runId, set]);
  const evaluator = useCallback(evaluateSimpleQuizAnswer, []);
  const submitAnswer = useCallback(async (submission: AnswerSubmission<
    MultipleChoiceQuestion<LearningSetQuestionSource>, MultipleChoiceAnswer, MultipleChoiceEvaluationDetails
  >) => {
    const selectedOption = submission.question.options.find((option) => option.id === submission.answer.optionId);
    if (!selectedOption) throw new Error("선택한 보기를 확인할 수 없습니다.");
    return submitSoloRunAnswer<MultipleChoiceEvaluationDetails>(run, {
      currentIndex: submission.previousProgress.currentIndex,
      questionId: submission.question.id,
      itemId: submission.question.source.itemId,
      selectedOptionId: submission.answer.optionId,
      selectedOptionText: selectedOption.text,
    });
  }, [run]);
  const engine = useSoloQuestionEngine({
    run,
    questions: questionSet.questions,
    evaluator,
    comboScoring: SIMPLE_QUIZ_COMBO_SCORING,
    advanceAfterAnyAnswer: true,
    submitAnswer,
  });
  return { ...engine, choiceCount, setTitle: questionSet.title };
}
