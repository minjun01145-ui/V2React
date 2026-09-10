import { useEffect, useMemo, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { shuffled } from "../../game-engine/core/random.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import type { SequenceToken } from "../../game-engine/sequence/types.ts";
import { adaptReadingChunksToSequence } from "../../learning-sets/sentenceSequenceAdapter.ts";
import { useCooperativeAssignment } from "../../multiplayer/cooperative/hooks.ts";
import { submitCooperativeSentence } from "../../multiplayer/cooperative/repository.ts";
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
  const assignment = useCooperativeAssignment(roomId, session.roundId, player.id, !clock.expired);
  const questions = useMemo(() => learningSet.set ? adaptReadingChunksToSequence(learningSet.set).questions : [], [learningSet.set]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ readonly correct: boolean; readonly text: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const { showMessage } = usePopup();
  const state = assignment.value;
  const question = state?.status === "active" ? questions[state.currentQuestionIndex] : undefined;
  const tokens = useMemo<SequenceToken[]>(() => question ? shuffled(question.tokens, `${session.roundId}:${state?.generation ?? 0}:${question.id}:tokens`) : [], [question, session.roundId, state?.generation]);

  useEffect(() => { setSelectedIds([]); setFeedback(null); }, [question?.id, state?.generation, state?.isMyTurn]);
  useEffect(() => {
    if (state?.status !== "searching") return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state?.status]);

  if (learningSet.error || assignment.error) return <StatusPanel title="협동 게임 연결 오류" tone="error">{learningSet.error?.message ?? assignment.error?.message}</StatusPanel>;
  if (learningSet.loading || assignment.loading || !state) return <StatusPanel title="조를 편성하고 있어요" tone="waiting">함께 문장을 완성할 친구를 찾고 있습니다.</StatusPanel>;

  if (clock.expired) return <section className={styles.complete}><span>TIME OVER</span><h1>협동 게임 종료!</h1><p>{state.teamName ? `${state.teamName} 조는 ${state.currentQuestionIndex}/${state.questionCount} 문장까지 완성했습니다.` : "선생님이 다음 활동을 준비할 때까지 기다려 주세요."}</p></section>;
  if (state.status === "searching") {
    const elapsed = state.searchStartedAtMs ? now - state.searchStartedAtMs : 0;
    const seconds = Math.max(0, Math.ceil((10_000 - elapsed) / 1_000));
    return <div className={styles.shell}><TimedGameStatus session={session} /><StatusPanel title="새로운 조를 찾고 있어요" tone="waiting">{seconds > 0 ? `다른 친구를 기다리는 중 · ${seconds}초` : "곧 새로운 음식 조가 만들어집니다."}</StatusPanel></div>;
  }
  if (state.status === "completed") return <div className={styles.shell}><TimedGameStatus session={session} /><section className={styles.complete}><span>TEAM COMPLETE</span><h1>축하합니다!</h1><p><strong>{state.teamName}</strong> 조가 모든 문장을 완성했습니다.</p><h2>당신의 조원은</h2><div className={styles.partners}>{state.revealedPartners.map((partner) => <PartnerReveal partner={partner} key={partner.playerId} />)}</div></section></div>;
  if (!question) return <StatusPanel title="문항 정보 오류" tone="error">현재 문항을 찾을 수 없습니다.</StatusPanel>;

  const selectedTokens = selectedIds.map((id) => question.tokens.find((token) => token.id === id)).filter((token): token is SequenceToken => token !== undefined);
  const unusedTokens = tokens.filter((token) => !selectedIds.includes(token.id));
  const submit = async (tokenIds: readonly string[]): Promise<void> => {
    if (submitting || !state.isMyTurn) return;
    setSubmitting(true);
    try {
      const result = await submitCooperativeSentence({ roomId, roundId: session.roundId, submissionId: crypto.randomUUID(), generation: state.generation, questionId: question.id, tokenIds });
      setFeedback({ correct: result.isCorrect, text: result.isCorrect ? "정답! 이제 조원의 차례입니다." : result.eliminated ? "하트가 모두 깨졌어요. 새로운 조를 찾습니다." : "순서가 달라 하트가 하나 줄었습니다. 다시 도전하세요." });
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

  return <div className={styles.shell}>
    <div className={styles.teamBar}><div><span>당신은</span><strong>{state.teamName} 조입니다!</strong></div><Hearts count={state.hearts} /><div><span>PROGRESS</span><strong>{state.currentQuestionIndex + 1} / {state.questionCount}</strong></div></div>
    <TimedGameStatus session={session} compact />
    <div className={styles.turnBanner} data-turn={state.isMyTurn}>{state.isMyTurn ? "당신의 차례입니다!" : "팀원이 문제를 풀고 있습니다…"}</div>
    <LearningCardSurface className={styles.prompt} eyebrow="문장 뜻" marker="협동" tone="warm">{question.prompt}</LearningCardSurface>
    <Card className={!state.isMyTurn ? styles.locked : ""}>
      <p className={styles.label}>우리 조의 문장 <span>{state.isMyTurn ? "마지막 조각을 놓으면 자동 채점됩니다." : "조원의 정답을 기다려 주세요."}</span></p>
      <div className={styles.answerZone}>{selectedTokens.length === 0 ? <span className={styles.placeholder}>{state.isMyTurn ? "아래 조각을 클릭" : "현재 문항을 함께 보고 있어요"}</span> : selectedTokens.map((token, index) => <button type="button" key={token.id} className={`${styles.token} ${styles.selected}`} onClick={() => setSelectedIds((current) => current.filter((id) => id !== token.id))} disabled={!state.isMyTurn || submitting}><span>{index + 1}</span>{token.text}</button>)}</div>
      <div className={styles.tokenBank}>{unusedTokens.map((token) => <button type="button" className={styles.token} key={token.id} onClick={() => select(token.id)} disabled={!state.isMyTurn || submitting}>{token.text}</button>)}</div>
      {feedback ? <div className={feedback.correct ? styles.correct : styles.incorrect}>{feedback.text}</div> : null}
      <Button variant="ghost" onClick={() => setSelectedIds([])} disabled={!state.isMyTurn || submitting || selectedIds.length === 0}>다시 선택</Button>
    </Card>
  </div>;
}
