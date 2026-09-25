import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SentenceBuilderEngine } from "./useSentenceBuilderGame.ts";
import { shuffled } from "../../game-engine/core/random.ts";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createScoreCelebration } from "../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import { formatClock } from "../../game-engine/timed-game/clock.ts";
import type { SentenceToken } from "./types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { usePopup } from "../../shared/popup/index.ts";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { LearningCardSurface } from "../../shared/ui/LearningCard.tsx";
import styles from "./SentenceBuilder.module.css";

export default function SentenceBuilderPlay({
  engine,
  roundId,
  playerId,
  disabled = false,
  embedded = false,
  advanceRequestId = 0,
  onQuestionComplete,
  onAdvanced,
  clockExpired = false,
  remainingMs = null,
  onFinish,
  onExit,
}: {
  readonly engine: SentenceBuilderEngine;
  readonly roundId: string;
  readonly playerId: string;
  readonly disabled?: boolean;
  readonly embedded?: boolean;
  readonly advanceRequestId?: number;
  readonly onQuestionComplete?: (completionId: string) => void;
  readonly onAdvanced?: () => void;
  readonly clockExpired?: boolean;
  readonly remainingMs?: number | null;
  readonly onFinish?: () => Promise<void>;
  readonly onExit?: () => Promise<void>;
}) {
  const effects = useGameEffectEngine();
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [finishError, setFinishError] = useState("");
  const autoAdvancedResultRef = useRef<string | null>(null);
  const reportedCompletionRef = useRef<string | null>(null);
  const advanceRequestRef = useRef(advanceRequestId);
  const automaticFinishStartedRef = useRef(false);
  const { showMessage } = usePopup();
  const question = engine.currentQuestion;
  const lastResult = question && engine.progress.lastResult?.itemId === question.id ? engine.progress.lastResult : null;
  const questionCycle = Math.floor(engine.progress.correctCount / Math.max(engine.questionCount, 1));
  const availableTokens = useMemo<SentenceToken[]>(
    () => question ? shuffled(question.tokens, `${roundId}:${playerId}:${question.id}:${questionCycle}:tokens`) : [],
    [playerId, question, questionCycle, roundId],
  );

  useEffect(() => setSelectedTokenIds([]), [question?.id, questionCycle]);

  const goNext = useCallback(async (): Promise<boolean> => {
    if (submitting) return false;
    setSubmitting(true);
    try {
      return await engine.nextQuestion();
    } catch (error: unknown) {
      console.error(error);
      await showMessage({ title: "다음 문제로 이동하지 못했어요", message: toErrorMessage(error, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [engine.nextQuestion, showMessage, submitting]);

  useEffect(() => {
    if (!lastResult?.isCorrect || submitting || onQuestionComplete) return;
    const resultKey = `${roundId}:${lastResult.itemId}:${engine.progress.correctCount}`;
    if (autoAdvancedResultRef.current === resultKey) return;
    autoAdvancedResultRef.current = resultKey;
    void goNext();
  }, [engine.progress.correctCount, goNext, lastResult, onQuestionComplete, roundId, submitting]);

  useEffect(() => {
    if (!lastResult?.isCorrect || !onQuestionComplete) return;
    const completionId = `${roundId}:${lastResult.itemId}:${engine.progress.correctCount}`;
    if (reportedCompletionRef.current === completionId) return;
    reportedCompletionRef.current = completionId;
    onQuestionComplete(completionId);
  }, [engine.progress.correctCount, lastResult, onQuestionComplete, roundId]);

  useEffect(() => {
    if (advanceRequestRef.current === advanceRequestId) return;
    advanceRequestRef.current = advanceRequestId;
    if (!lastResult?.isCorrect) return;
    void goNext().then((advanced) => { if (advanced) onAdvanced?.(); });
  }, [advanceRequestId, goNext, lastResult, onAdvanced]);

  useEffect(() => {
    if (!onFinish || finishing || exiting || submitting || engine.loading || automaticFinishStartedRef.current
      || (!clockExpired && !engine.isComplete)) return;
    automaticFinishStartedRef.current = true;
    setFinishing(true);
    void onFinish().catch(async (error: unknown) => {
      console.error(error);
      setFinishError(error instanceof Error ? error.message : "결과를 저장하지 못했습니다.");
      setFinishing(false);
      await showMessage({ title: "결과를 저장하지 못했어요", message: toErrorMessage(error, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    });
  }, [clockExpired, engine.isComplete, engine.loading, exiting, finishing, onFinish, showMessage, submitting]);

  const finish = async (): Promise<void> => {
    if (!onFinish || finishing || exiting || submitting) return;
    setFinishing(true);
    setFinishError("");
    try { await onFinish(); }
    catch (error: unknown) {
      console.error(error);
      setFinishError(error instanceof Error ? error.message : "결과를 저장하지 못했습니다.");
      setFinishing(false);
      await showMessage({ title: "결과를 저장하지 못했어요", message: toErrorMessage(error, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    }
  };
  const exit = async (): Promise<void> => {
    if (!onExit || exiting || finishing) return;
    setExiting(true);
    try { await onExit(); }
    catch (error: unknown) {
      setExiting(false);
      await showMessage({ title: "게임을 종료하지 못했어요", message: toErrorMessage(error, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    }
  };

  if (engine.loading) return <StatusPanel title="게임 불러오는 중">진행 상황을 연결하고 있습니다.</StatusPanel>;
  if (engine.error) return <StatusPanel title="게임 연결 오류" tone="error">{engine.error.message}</StatusPanel>;
  if (!question) return engine.isComplete || clockExpired
    ? <StatusPanel title="결과를 정리하고 있어요">
        문장 만들기 결과를 저장하고 있습니다.
        {finishError ? <p role="alert">{finishError}</p> : null}
        {finishError && onFinish ? <Button onClick={() => void finish()} disabled={finishing}>{finishing ? "결과 저장 중…" : "결과 저장 다시 시도"}</Button> : null}
        {finishError && onExit ? <Button variant="ghost" onClick={() => void exit()} disabled={exiting}>{exiting ? "종료 중…" : "대기실로 돌아가기"}</Button> : null}
      </StatusPanel>
    : <StatusPanel title="문제가 없습니다" tone="error">세트에 사용할 수 있는 문항이 없습니다.</StatusPanel>;

  const selectedTokens = selectedTokenIds
    .map((tokenId) => question.tokens.find((token) => token.id === tokenId))
    .filter((token): token is SentenceToken => token !== undefined);
  const unusedTokens = availableTokens.filter((token) => !selectedTokenIds.includes(token.id));

  const submitSelection = async (tokenIds: readonly string[]): Promise<void> => {
    if (tokenIds.length !== question.tokens.length || submitting || clockExpired || finishing || exiting) return;
    setSubmitting(true);
    try {
      const answerTokens = tokenIds
        .map((tokenId) => question.tokens.find((token) => token.id === tokenId))
        .filter((token): token is SentenceToken => token !== undefined);
      const result = await engine.submitAnswer({
        tokenIds,
        text: answerTokens.map((token) => token.text).join(" "),
      });
      if (result?.isCorrect) {
        effects.play(createScoreCelebration({
          scoreDelta: result.scoreDelta,
          combo: engine.progress.combo + 1,
        }));
      } else if (result) {
        setSelectedTokenIds([]);
      }
    } catch (error: unknown) {
      console.error(error);
      await showMessage({ title: "정답을 제출하지 못했어요", message: toErrorMessage(error, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    } finally {
      setSubmitting(false);
    }
  };
  const selectToken = (tokenId: string): void => {
    if (submitting || clockExpired || lastResult?.isCorrect || selectedTokenIds.includes(tokenId)) return;
    const nextTokenIds = [...selectedTokenIds, tokenId];
    setSelectedTokenIds(nextTokenIds);
    if (nextTokenIds.length === question.tokens.length) void submitSelection(nextTokenIds);
  };
  const removeToken = (tokenId: string): void => {
    if (!submitting && !clockExpired && !lastResult?.isCorrect) setSelectedTokenIds((current) => current.filter((id) => id !== tokenId));
  };
  const isDisabled = disabled || clockExpired || finishing || exiting;

  return <div className={`${styles.game} ${embedded ? styles.embedded : ""}`}>
    <GameEffectLayer effect={effects.activeEffect} />
    <div className={styles.topbar}>
      <div><strong>{engine.currentIndex + 1} / {engine.questionCount}</strong>{remainingMs !== null ? <small> · 남은 시간 {formatClock(remainingMs)}</small> : null}</div>
      <div className={styles.topbarStats}>
        {onExit ? <Button variant="ghost" onClick={() => void exit()} disabled={finishing || exiting || submitting}>{exiting ? "종료 중…" : "그만하기"}</Button> : null}
        {onFinish ? <Button variant="ghost" onClick={() => void finish()} disabled={finishing || exiting || submitting}>{finishing ? "결과 저장 중…" : "게임 마치기"}</Button> : null}
        <div className={styles.comboChip}>{engine.progress.combo} COMBO</div><div className={styles.scoreChip}>{engine.progress.score}점</div>
      </div>
    </div>
    <LearningCardSurface className={styles.prompt} eyebrow="문장 뜻" marker="문장" tone="warm">{question.prompt}</LearningCardSurface>
    <Card>
      <p className={styles.label}>내 문장 <span>마지막 조각을 놓으면 자동으로 채점됩니다.</span></p>
      <div className={styles.answerZone} aria-label="선택한 문장 조각">{selectedTokens.length === 0 ? <span className={styles.placeholder}>아래 조각을 클릭</span> : selectedTokens.map((token, index) => <button key={token.id} type="button" className={`${styles.token} ${styles.selected}`} onClick={() => removeToken(token.id)}><span>{index + 1}</span>{token.text}</button>)}</div>
      <div className={styles.tokenBank} aria-label="사용 가능한 문장 조각">{unusedTokens.map((token) => <button key={token.id} type="button" className={styles.token} onClick={() => selectToken(token.id)} disabled={isDisabled || submitting || lastResult?.isCorrect}>{token.text}</button>)}</div>
      {lastResult ? <div className={`${styles.feedback} ${lastResult.isCorrect ? styles.correct : styles.incorrect}`} role="status">{lastResult.feedback}</div> : null}
      {finishError ? <div className={styles.feedback} role="alert">{finishError}</div> : null}
      <div className={styles.actions}>{lastResult?.isCorrect && !onQuestionComplete ? <Button onClick={() => void goNext()} disabled={isDisabled || submitting}>다음 문제</Button> : null}<Button variant="ghost" onClick={() => setSelectedTokenIds([])} disabled={isDisabled || submitting || selectedTokenIds.length === 0 || lastResult?.isCorrect}>다시 선택</Button></div>
    </Card>
  </div>;
}
