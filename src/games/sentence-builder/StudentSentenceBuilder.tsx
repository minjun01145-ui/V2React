import { useEffect, useMemo, useState } from "react";
import { shuffled } from "../../game-engine/core/random.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { usePopup } from "../../shared/popup/index.ts";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../shared/ui/Typography.tsx";
import type { SentenceToken } from "./types.ts";
import { useSentenceBuilderGame } from "./useSentenceBuilderGame.ts";
import styles from "./SentenceBuilder.module.css";

interface Props {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: unknown;
}

export default function StudentSentenceBuilder({ roomId, session, player, set }: Props) {
  const engine = useSentenceBuilderGame({ roomId, session, player, set });
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { showMessage } = usePopup();
  const question = engine.currentQuestion;
  const availableTokens = useMemo<SentenceToken[]>(
    () => question ? shuffled(question.tokens, `${session.roundId}:${player.id}:${question.id}:tokens`) : [],
    [player.id, question, session.roundId],
  );

  useEffect(() => setSelectedTokenIds([]), [question?.id]);

  if (engine.loading) return <StatusPanel title="게임 불러오는 중">진행 상황을 연결하고 있습니다.</StatusPanel>;
  if (engine.error) return <StatusPanel title="게임 연결 오류" tone="error">{engine.error.message}</StatusPanel>;
  if (engine.isComplete) {
    return <Card className={styles.complete}><Eyebrow>COMPLETE</Eyebrow><h2>모든 문장을 완성했습니다!</h2><div className={styles.scoreBig}>{engine.progress.score}점</div><Muted>정답 {engine.progress.correctCount}개 · 총 시도 {engine.progress.attemptCount}회</Muted></Card>;
  }
  if (!question) return <StatusPanel title="문제가 없습니다" tone="error">세트에 사용할 수 있는 문항이 없습니다.</StatusPanel>;

  const selectedTokens = selectedTokenIds
    .map((tokenId) => question.tokens.find((token) => token.id === tokenId))
    .filter((token): token is SentenceToken => token !== undefined);
  const unusedTokens = availableTokens.filter((token) => !selectedTokenIds.includes(token.id));
  const lastResult = engine.progress.lastResult?.questionId === question.id ? engine.progress.lastResult : null;

  const selectToken = (tokenId: string): void => {
    if (!submitting && !lastResult?.isCorrect) {
      setSelectedTokenIds((current) => current.includes(tokenId) ? current : [...current, tokenId]);
    }
  };
  const removeToken = (tokenId: string): void => {
    if (!submitting && !lastResult?.isCorrect) setSelectedTokenIds((current) => current.filter((id) => id !== tokenId));
  };
  const checkAnswer = async (): Promise<void> => {
    if (selectedTokenIds.length !== question.tokens.length || submitting) return;
    setSubmitting(true);
    try {
      const result = await engine.submitAnswer({
        tokenIds: selectedTokenIds,
        text: selectedTokens.map((token) => token.text).join(" "),
      });
      if (!result?.isCorrect) setSelectedTokenIds([]);
    } catch (error: unknown) {
      console.error(error);
      await showMessage({ title: "정답을 제출하지 못했어요", message: toErrorMessage(error, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    } finally {
      setSubmitting(false);
    }
  };
  const goNext = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await engine.nextQuestion();
    } finally {
      setSubmitting(false);
    }
  };

  return <div className={styles.game}>
    <div className={styles.topbar}><div><Eyebrow>{engine.setTitle}</Eyebrow><strong>{engine.currentIndex + 1} / {engine.questionCount}</strong></div><div className={styles.scoreChip}>{engine.progress.score}점</div></div>
    <Card className={styles.prompt}><p className={styles.label}>한글에 맞게 영어 조각을 순서대로 선택하세요.</p><h2>{question.prompt}</h2></Card>
    <Card>
      <p className={styles.label}>내 문장</p>
      <div className={styles.answerZone} aria-label="선택한 문장 조각">{selectedTokens.length === 0 ? <span className={styles.placeholder}>아래 조각을 클릭하세요.</span> : selectedTokens.map((token, index) => <button key={token.id} type="button" className={`${styles.token} ${styles.selected}`} onClick={() => removeToken(token.id)}><span>{index + 1}</span>{token.text}</button>)}</div>
      <div className={styles.tokenBank} aria-label="사용 가능한 문장 조각">{unusedTokens.map((token) => <button key={token.id} type="button" className={styles.token} onClick={() => selectToken(token.id)} disabled={submitting || lastResult?.isCorrect}>{token.text}</button>)}</div>
      {lastResult ? <div className={`${styles.feedback} ${lastResult.isCorrect ? styles.correct : styles.incorrect}`} role="status">{lastResult.feedback}</div> : null}
      <div className={styles.actions}>{lastResult?.isCorrect ? <Button onClick={() => void goNext()} disabled={submitting}>다음 문제</Button> : <Button onClick={() => void checkAnswer()} disabled={submitting || selectedTokenIds.length !== question.tokens.length}>정답 확인</Button>}<Button variant="ghost" onClick={() => setSelectedTokenIds([])} disabled={submitting || selectedTokenIds.length === 0 || lastResult?.isCorrect}>다시 선택</Button></div>
    </Card>
  </div>;
}
