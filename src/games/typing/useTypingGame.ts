import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createQuestionDeck } from "../../game-engine/question-engine/questionDeck.ts";
import { useMultiplayerQuestionEngine } from "../../game-engine/question-engine/multiplayer/useMultiplayerQuestionEngine.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { publishTypingLiveMetric } from "../../multiplayer/live-metrics/repository.ts";
import { adaptLearningSetToTyping } from "./typingAdapter.ts";
import { typingGameOptions } from "./config.ts";
import {
  calculateCurrentAccuracy,
  createTypingSpeedTracker,
  evaluateTypingAnswer,
  getNewValidProgress,
  getTypingComparisonState,
} from "./typingEngine.ts";
import type { TypingEvaluationDetails, TypingQuestion, TypingSpeedStats } from "./types.ts";

export function useTypingGame(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: unknown;
  readonly disabled?: boolean;
}) {
  const { roomId, session, player, set, disabled = false } = input;
  const options = useMemo(() => typingGameOptions(session), [session]);
  const adaptedSet = useMemo(() => adaptLearningSetToTyping(set, options.target), [options.target, set]);
  const questions = useMemo(() => createQuestionDeck(adaptedSet.questions, {
    seed: `${session.roundId}:${adaptedSet.id}:typing`,
    shuffleQuestions: true,
  }), [adaptedSet, session.roundId]);
  const evaluator = useCallback(
    (question: TypingQuestion, answer: { readonly inputText: string; readonly speed: TypingSpeedStats }) => (
      evaluateTypingAnswer(question, answer, options)
    ),
    [options],
  );
  const engine = useMultiplayerQuestionEngine<TypingQuestion, {
    readonly inputText: string;
    readonly speed: TypingSpeedStats;
  }, TypingEvaluationDetails>({
    roomId,
    roundId: session.roundId,
    gameId: session.gameId,
    player,
    questions,
    evaluator,
    repeatQuestions: true,
    disabled,
  });
  const tracker = useMemo(() => createTypingSpeedTracker(), [player.id, session.roundId]);
  const [inputText, setInputText] = useState("");
  const [speed, setSpeed] = useState<TypingSpeedStats>(() => tracker.getStats());
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<Error | null>(null);
  const maximumPrefixRef = useRef(0);
  const submittedQuestionRef = useRef<string | null>(null);
  const question = engine.currentQuestion;

  const resetPromptInput = useCallback((): void => {
    maximumPrefixRef.current = 0;
    submittedQuestionRef.current = null;
    setInputText("");
    setSubmissionError(null);
  }, []);

  useEffect(() => resetPromptInput(), [question?.id, resetPromptInput, session.roundId]);
  useEffect(() => {
    let active = true;
    let publishing = false;
    let pending: TypingSpeedStats | null = null;
    const publish = (stats: TypingSpeedStats): void => {
      pending = stats;
      if (publishing) return;
      publishing = true;
      const drain = async (): Promise<void> => {
        while (active && pending) {
          const values = pending;
          pending = null;
          try {
            await publishTypingLiveMetric({ roomId, roundId: session.roundId, gameId: session.gameId, player, values });
          } catch (error) {
            console.error("타수 실시간 동기화 실패", error);
          }
        }
        publishing = false;
      };
      void drain();
    };
    const sample = (): void => {
      const stats = tracker.getStats();
      setSpeed(stats);
      publish(stats);
    };
    sample();
    const intervalId = window.setInterval(sample, 1_000);
    return () => {
      active = false;
      pending = null;
      window.clearInterval(intervalId);
    };
  }, [player, roomId, session.gameId, session.roundId, tracker]);

  const submitCompletedAnswer = useCallback(async (answerText: string, answerSpeed?: TypingSpeedStats): Promise<void> => {
    if (!question || disabled || submittedQuestionRef.current === question.id) return;
    submittedQuestionRef.current = question.id;
    setSubmitting(true);
    setSubmissionError(null);
    try {
      const result = await engine.submitAnswer({ inputText: answerText, speed: answerSpeed ?? tracker.getStats() });
      if (!result) submittedQuestionRef.current = null;
    } catch (value: unknown) {
      submittedQuestionRef.current = null;
      setSubmissionError(value instanceof Error ? value : new Error("결과를 저장하지 못했습니다."));
    } finally {
      setSubmitting(false);
    }
  }, [disabled, engine, question, tracker]);

  const updateInput = useCallback((nextInput: string): void => {
    if (!question || disabled || submitting) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const progress = getNewValidProgress(
      question.targetText,
      nextInput,
      maximumPrefixRef.current,
      options,
    );
    maximumPrefixRef.current = progress.maxPrefixLength;
    if (progress.newlyValidText) tracker.addValidText(progress.newlyValidText, now);
    const nextSpeed = tracker.getStats(now);
    setInputText(nextInput);
    setSpeed(nextSpeed);
    setSubmissionError(null);
    if (progress.isComplete) void submitCompletedAnswer(nextInput, nextSpeed);
  }, [disabled, options, question, submitCompletedAnswer, submitting, tracker]);

  const goNext = useCallback(async (): Promise<boolean> => {
    const moved = await engine.nextQuestion();
    if (moved) resetPromptInput();
    return moved;
  }, [engine, resetPromptInput]);

  const comparison = useMemo(
    () => getTypingComparisonState(question?.targetText ?? "", inputText, options),
    [inputText, options, question?.targetText],
  );
  const accuracy = useMemo(
    () => calculateCurrentAccuracy(question?.targetText ?? "", inputText, options),
    [inputText, options, question?.targetText],
  );

  return {
    ...engine,
    setTitle: adaptedSet.title,
    options,
    inputText,
    speed,
    accuracy,
    comparison,
    submitting,
    submissionError,
    updateInput,
    retrySubmission: () => submitCompletedAnswer(inputText),
    goNext,
  };
}
