import { useCallback } from "react";
import type { GameProgress } from "../../game-engine/progress/index.ts";
import { useQuestionEngine } from "../../game-engine/question-engine/useQuestionEngine.ts";
import type { AnswerSubmission, BaseQuestion, Evaluator, ProgressSubmission } from "../../game-engine/question-engine/types.ts";
import type { ComboScoringConfig } from "../../game-engine/scoring/combo.ts";
import type { SoloRun } from "../contracts.ts";
import { useSoloRunProgress } from "./useSoloRunProgress.ts";

export function useSoloQuestionEngine<TQuestion extends BaseQuestion, TAnswer, TDetails>(input: {
  readonly run: SoloRun;
  readonly questions: readonly TQuestion[];
  readonly evaluator: Evaluator<TQuestion, TAnswer, TDetails>;
  readonly disabled?: boolean;
  readonly comboScoring?: ComboScoringConfig;
  readonly advanceAfterAnyAnswer?: boolean;
  readonly submitAnswer: (submission: AnswerSubmission<TQuestion, TAnswer, TDetails>) => Promise<GameProgress<TDetails>>;
}) {
  const stored = useSoloRunProgress<TDetails>(input.run, input.questions.length);
  const onSubmit = useCallback((submission: AnswerSubmission<TQuestion, TAnswer, TDetails>) => input.submitAnswer(submission), [input.submitAnswer]);
  const onProgress = useCallback(async (submission: ProgressSubmission<TDetails>) => stored.persist(submission.progress), [stored.persist]);

  const engine = useQuestionEngine({
    questions: input.questions,
    roundId: input.run.runId,
    evaluator: input.evaluator,
    initialProgress: stored.progress,
    progressLoading: stored.loading,
    repeatQuestions: false,
    ...(input.disabled === undefined ? {} : { disabled: input.disabled }),
    ...(input.comboScoring === undefined ? {} : { comboScoring: input.comboScoring }),
    ...(input.advanceAfterAnyAnswer === undefined ? {} : { advanceAfterAnyAnswer: input.advanceAfterAnyAnswer }),
    onSubmit,
    onProgress,
  });
  return { ...engine, loading: stored.loading, error: stored.error };
}
