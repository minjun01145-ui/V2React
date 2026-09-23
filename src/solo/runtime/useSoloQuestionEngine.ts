import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import { useQuestionEngine } from "../../game-engine/question-engine/useQuestionEngine.ts";
import type { AnswerSubmission, BaseQuestion, Evaluator, ProgressSubmission } from "../../game-engine/question-engine/types.ts";
import type { ComboScoringConfig } from "../../game-engine/scoring/combo.ts";
import type { SoloRun } from "../contracts.ts";
import { loadSoloRunProgress, persistSoloRunProgress } from "../persistence/repository.ts";

export function useSoloQuestionEngine<TQuestion extends BaseQuestion, TAnswer, TDetails>(input: {
  readonly run: SoloRun;
  readonly questions: readonly TQuestion[];
  readonly evaluator: Evaluator<TQuestion, TAnswer, TDetails>;
  readonly disabled?: boolean;
  readonly comboScoring?: ComboScoringConfig;
  readonly advanceAfterAnyAnswer?: boolean;
  readonly submitAnswer: (submission: AnswerSubmission<TQuestion, TAnswer, TDetails>) => Promise<GameProgress<TDetails>>;
}) {
  const scope = `${input.run.tenantId}:${input.run.runId}`;
  const [stored, setStored] = useState<{ readonly scope: string; readonly value: unknown; readonly loading: boolean; readonly error: Error | null }>(
    () => ({ scope, value: null, loading: true, error: null }),
  );

  useEffect(() => {
    let active = true;
    setStored({ scope, value: null, loading: true, error: null });
    void loadSoloRunProgress(input.run)
      .then((value) => { if (active) setStored({ scope, value, loading: false, error: null }); })
      .catch((error: unknown) => { if (active) setStored({ scope, value: null, loading: false, error: error instanceof Error ? error : new Error("Solo 진행 상황을 불러오지 못했습니다." ) }); });
    return () => { active = false; };
  }, [input.run, scope]);

  const current = stored.scope === scope ? stored : { scope, value: null, loading: true, error: null };
  const initialProgress = useMemo(() => normalizeProgress<TDetails>(current.value, input.questions.length), [current.value, input.questions.length]);
  const persist = useCallback(async (progress: GameProgress<TDetails>) => {
    await persistSoloRunProgress(input.run, progress);
    return progress;
  }, [input.run]);
  const onSubmit = useCallback((submission: AnswerSubmission<TQuestion, TAnswer, TDetails>) => input.submitAnswer(submission), [input.submitAnswer]);
  const onProgress = useCallback(async (submission: ProgressSubmission<TDetails>) => persist(submission.progress), [persist]);

  const engine = useQuestionEngine({
    questions: input.questions,
    roundId: input.run.runId,
    evaluator: input.evaluator,
    initialProgress,
    progressLoading: current.loading,
    repeatQuestions: false,
    ...(input.disabled === undefined ? {} : { disabled: input.disabled }),
    ...(input.comboScoring === undefined ? {} : { comboScoring: input.comboScoring }),
    ...(input.advanceAfterAnyAnswer === undefined ? {} : { advanceAfterAnyAnswer: input.advanceAfterAnyAnswer }),
    onSubmit,
    onProgress,
  });
  return { ...engine, loading: current.loading, error: current.error };
}
