import { useCallback, useMemo } from "react";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import type { SoloRun } from "../../solo/contracts.ts";
import { useSoloQuestionEngine } from "../../solo/runtime/useSoloQuestionEngine.ts";
import { adaptSimpleQuizSet } from "./adapter.ts";
import { simpleQuizChoiceCountFromConfig } from "./config.ts";
import { evaluateSimpleQuizAnswer, SIMPLE_QUIZ_COMBO_SCORING } from "./model.ts";

export function useSoloSimpleQuizGame(run: SoloRun, set: RuntimeLearningSet) {
  const choiceCount = simpleQuizChoiceCountFromConfig(run.gameConfig);
  const questionSet = useMemo(() => adaptSimpleQuizSet(set, run.runId, choiceCount), [choiceCount, run.runId, set]);
  const evaluator = useCallback(evaluateSimpleQuizAnswer, []);
  const engine = useSoloQuestionEngine({
    run,
    questions: questionSet.questions,
    evaluator,
    comboScoring: SIMPLE_QUIZ_COMBO_SCORING,
    advanceAfterAnyAnswer: true,
  });
  return { ...engine, choiceCount, setTitle: questionSet.title };
}
