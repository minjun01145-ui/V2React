import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { shuffled } from "../../game-engine/core/random.ts";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createGameAnnouncement } from "../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import DeadlineCountdownBar from "../../game-engine/timed-turn/DeadlineCountdownBar.tsx";
import { useDeadlineCountdown } from "../../game-engine/timed-turn/useDeadlineCountdown.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import type { SequenceToken } from "../../game-engine/sequence/types.ts";
import { adaptReadingChunksToSequence } from "../../learning-sets/sentenceSequenceAdapter.ts";
import { useCooperativeAssignment } from "../../multiplayer/cooperative/hooks.ts";
import { expireCooperativeTurn, refreshCooperativeMatch, submitCooperativeSentence } from "../../multiplayer/cooperative/repository.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { usePopup } from "../../shared/popup/index.ts";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { LearningCardSurface } from "../../shared/ui/LearningCard.tsx";
import PartnerReveal from "./PartnerReveal.tsx";
import { useCooperativeSentenceSet } from "./useCooperativeSentenceSet.ts";
import styles from "./CooperativeSentence.module.css";

function Hearts({ count }: { readonly count: number }) { return <span className={styles.hearts} aria-label={`남은 하트 ${count}개`}>{[0, 1].map((index) => <i key={index} data-alive={index < count}>♥</i>)}</span>; }

export default function CooperativeSentenceStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const learningSet = useCooperativeSentenceSet(session);
  const clock = useTimedGameClock(session);
  const assignment = useCooperativeAssignment(roomId, session.roundId, player.id);
  const questions = useMemo(() => learningSet.set ? adaptReadingChunksToSequence(learningSet.set).questions : [], [learningSet.set]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ readonly correct: boolean; readonly text: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [acknowledgedEliminationKey, setAcknowledgedEliminationKey] = useState<string | null>(null);
  const [timeoutRetry, setTimeoutRetry] = useState(0);
  const eliminationNoticeRef = useRef<string | null>(null);
  const hardModeRevisionRef = useRef(0);
  const turnEffectKeyRef = useRef<string | null>(null);
  const timeoutKeyRef = useRef<string | null>(null);
  const effects = useGameEffectEngine();
  const { showMessage } = usePopup();
  const state = assignment.value;
  const eliminationKey = state?.status === "searching" && state.generation > 0 && state.searchStartedAtMs !== null
    ? `${state.generation}:${state.searchStartedAtMs}`
    : null;
  const question = state?.status === "active" ? questions[state.currentQuestionIndex] : undefined;
  const enforcedTurnDeadline = state?.status === "active" && state.hardMode ? state.turnDeadlineAtMs : null;
  const turnCountdown = useDeadlineCountdown(enforcedTurnDeadline, 5_000);
  const tokens = useMemo<SequenceToken[]>(() => question ? shuffled(question.tokens, `${session.roundId}:${state?.generation ?? 0}:${question.id}:tokens`) : [], [question, session.roundId, state?.generation]);

  useEffect(() => { setSelectedIds([]); setFeedback(null); }, [question?.id, state?.generation, state?.isMyTurn]);
  useEffect(() => { setSelectedIds([]); }, [state?.turnDeadlineAtMs]);
  useEffect(() => {
    if (state?.status !== "searching") return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state?.status]);
  useEffect(() => {
    if (!eliminationKey || acknowledgedEliminationKey === eliminationKey || eliminationNoticeRef.current === eliminationKey) return;
    eliminationNoticeRef.current = eliminationKey;
    void showMessage({
      title: "하트가 다 닳아서 탈락했습니다.",
      message: "새로운 조를 찾습니다.",
      tone: "error",
      blurBackground: true,
    }).finally(() => setAcknowledgedEliminationKey(eliminationKey));
  }, [acknowledgedEliminationKey, eliminationKey, showMessage]);
  useEffect(() => {
    if (clock.expired || state?.status !== "searching") return undefined;
    if (eliminationKey && acknowledgedEliminationKey !== eliminationKey) return undefined;
    const refresh = (): void => { void refreshCooperativeMatch(roomId, session.roundId).catch(console.error); };
    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, [acknowledgedEliminationKey, clock.expired, eliminationKey, roomId, session.roundId, state?.status]);
  useEffect(() => {
    if (!state) return;
    const turnKey = state.status === "active" && state.isMyTurn ? `${state.generation}:${state.currentQuestionIndex}` : null;
    if (state.hardMode && state.hardModeRevision > hardModeRevisionRef.current) {
      hardModeRevisionRef.current = state.hardModeRevision;
      turnEffectKeyRef.current = turnKey;
      effects.play(createGameAnnouncement({ headline: "선생님이 빡센모드를 활성화함!!!", metric: "문장당 5초", detail: "시간이 지나면 오답으로 처리됩니다.", tone: "warning", durationMs: 2_000 }));
      return;
    }
    if (turnKey && !state.hardMode && turnEffectKeyRef.current !== turnKey) {
      turnEffectKeyRef.current = turnKey;
      effects.play(createGameAnnouncement({ headline: "당신의 차례입니다!", metric: state.hardMode ? "5초 안에 완성!" : "문장을 완성하세요", tone: state.hardMode ? "warning" : "info" }));
    }
  }, [effects.play, state]);
  useEffect(() => {
    if (!state || !turnCountdown?.expired || enforcedTurnDeadline === null || clock.expired) return;
    const timeoutKey = `${state.generation}:${enforcedTurnDeadline}`;
    if (timeoutKeyRef.current === timeoutKey) return;
    timeoutKeyRef.current = timeoutKey;
    void expireCooperativeTurn({ roomId, roundId: session.roundId, generation: state.generation, deadlineAtMs: enforcedTurnDeadline })
      .then((result) => { if (result.applied && !result.eliminated) setFeedback({ correct: false, text: "시간 초과! 하트가 하나 줄었습니다. 다시 도전하세요." }); })
      .catch((reason: unknown) => {
        console.error(reason);
        window.setTimeout(() => { timeoutKeyRef.current = null; setTimeoutRetry((value) => value + 1); }, 750);
      });
  }, [clock.expired, enforcedTurnDeadline, roomId, session.roundId, state, timeoutRetry, turnCountdown?.expired]);

  if (learningSet.error || assignment.error) return <StatusPanel title="커플 게임 연결 오류" tone="error">{learningSet.error?.message ?? assignment.error?.message}</StatusPanel>;
  if (learningSet.loading || assignment.loading || !state) return <StatusPanel title="조를 편성하고 있어요" tone="waiting">함께 문장을 완성할 친구를 찾고 있습니다.</StatusPanel>;

  if (clock.expired) return <><GameEffectLayer effect={effects.activeEffect} /><section className={styles.complete}><h1>커플 게임 종료!</h1><p>{state.teamName ? `${state.teamName} 조는 ${state.currentQuestionIndex}/${state.questionCount} 문장까지 완성했습니다.` : "선생님이 다음 활동을 준비할 때까지 기다려 주세요."}</p></section></>;
  if (state.status === "searching") {
    if (eliminationKey && acknowledgedEliminationKey !== eliminationKey) {
      return <div className={styles.shell}><GameEffectLayer effect={effects.activeEffect} /><TimedGameStatus session={session} /><StatusPanel title="하트가 다 닳아서 탈락했습니다." tone="error">새로운 조를 찾습니다.</StatusPanel></div>;
    }
    const elapsed = state.searchStartedAtMs ? now - state.searchStartedAtMs : 0;
    const seconds = Math.max(0, Math.ceil((10_000 - elapsed) / 1_000));
    return <div className={styles.shell}><GameEffectLayer effect={effects.activeEffect} /><TimedGameStatus session={session} /><StatusPanel title="새로운 조를 찾고 있어요" tone="waiting">{seconds > 0 ? `다른 친구를 기다리는 중 · ${seconds}초` : "곧 새로운 음식 조가 만들어집니다."}</StatusPanel></div>;
  }
  if (state.status === "completed") return <div className={styles.shell}><GameEffectLayer effect={effects.activeEffect} /><TimedGameStatus session={session} /><section className={styles.complete}><h1>축하합니다!</h1><p><strong>{state.teamName}</strong> 조가 모든 문장을 완성했습니다.</p><h2>당신의 조원은</h2><div className={styles.partners}>{state.revealedPartners.map((partner) => <PartnerReveal partner={partner} key={partner.playerId} />)}</div></section></div>;
  if (!question) return <StatusPanel title="문항 정보 오류" tone="error">현재 문항을 찾을 수 없습니다.</StatusPanel>;

  const selectedTokens = selectedIds.map((id) => question.tokens.find((token) => token.id === id)).filter((token): token is SequenceToken => token !== undefined);
  const unusedTokens = tokens.filter((token) => !selectedIds.includes(token.id));
  const submit = async (tokenIds: readonly string[]): Promise<void> => {
    if (submitting || !state.isMyTurn) return;
    setSubmitting(true);
    try {
      const result = await submitCooperativeSentence({ roomId, roundId: session.roundId, submissionId: crypto.randomUUID(), generation: state.generation, questionId: question.id, tokenIds });
      if (!result.eliminated) setFeedback({ correct: result.isCorrect, text: result.isCorrect ? "정답! 이제 조원의 차례입니다." : result.timedOut ? "시간 초과! 하트가 하나 줄었습니다. 다시 도전하세요." : "순서가 달라 하트가 하나 줄었습니다. 다시 도전하세요." });
      if (!result.isCorrect && !result.eliminated) setSelectedIds([]);
    } catch (reason: unknown) {
      await showMessage({ title: "답안을 제출하지 못했어요", message: toErrorMessage(reason, "조 상태를 다시 확인해 주세요."), tone: "error", blurBackground: false });
    } finally { setSubmitting(false); }
  };
  const select = (id: string): void => {
    if (!state.isMyTurn || submitting || selectedIds.includes(id)) return;
    const next = [...selectedIds, id];
    setSelectedIds(next);
    if (next.length === question.tokens.length) void submit(next);
  };

  return <div className={styles.shell} data-my-turn={state.isMyTurn} data-hard-mode={state.hardMode}>
    <GameEffectLayer effect={effects.activeEffect} />
    <div className={styles.teamBar}><div><span>당신은</span><strong>{state.teamName} 조입니다!</strong></div><Hearts count={state.hearts} /><div><span>진행</span><strong>{state.currentQuestionIndex + 1} / {state.questionCount}</strong></div></div>
    <TimedGameStatus session={session} compact />
    {state.hardMode && state.isMyTurn && state.turnDeadlineAtMs !== null ? <DeadlineCountdownBar deadlineAtMs={state.turnDeadlineAtMs} durationMs={5_000} label="문장 제한시간" /> : null}
    <div className={styles.turnBanner} data-turn={state.isMyTurn}>{state.isMyTurn ? "당신의 차례입니다!" : "팀원이 문제를 풀고 있습니다…"}</div>
    <LearningCardSurface className={styles.prompt} eyebrow="문장 뜻" marker="커플" tone="warm">{question.prompt}</LearningCardSurface>
    <Card className={`${!state.isMyTurn ? styles.locked : ""} ${state.isMyTurn ? styles.activeTurnCard : ""}`}>
      <p className={styles.label}>우리 조의 문장 <span>{state.isMyTurn ? "마지막 조각을 놓으면 자동 채점됩니다." : "조원의 정답을 기다려 주세요."}</span></p>
      <div className={styles.answerZone}>{selectedTokens.length === 0 ? <span className={styles.placeholder}>{state.isMyTurn ? "아래 조각을 클릭" : "현재 문항을 함께 보고 있어요"}</span> : selectedTokens.map((token, index) => <button type="button" key={token.id} className={`${styles.token} ${styles.selected}`} onClick={() => setSelectedIds((current) => current.filter((id) => id !== token.id))} disabled={!state.isMyTurn || submitting}><span>{index + 1}</span>{token.text}</button>)}</div>
      <div className={styles.tokenBank}>{unusedTokens.map((token) => <button type="button" className={styles.token} key={token.id} onClick={() => select(token.id)} disabled={!state.isMyTurn || submitting || turnCountdown?.expired}>{token.text}</button>)}</div>
      {feedback ? <div className={feedback.correct ? styles.correct : styles.incorrect}>{feedback.text}</div> : null}
      <Button variant="ghost" onClick={() => setSelectedIds([])} disabled={!state.isMyTurn || submitting || selectedIds.length === 0}>다시 선택</Button>
    </Card>
  </div>;
}
