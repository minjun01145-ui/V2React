import { useMemo } from "react";
import { useRoundAnswers, useRoundProgress } from "../../game-engine/question-engine/multiplayer/hooks.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Card from "../../shared/ui/Card.tsx";
import { Muted } from "../../shared/ui/Typography.tsx";
import { matchingPairs } from "./engine.ts";
import styles from "./MatchingGame.module.css";

export default function MatchingTeacherGame({ roomId, session, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly set: LearningSet;
}) {
  const pairCount = useMemo(() => matchingPairs(set).length, [set]);
  const answers = useRoundAnswers(roomId, session.roundId);
  const progress = useRoundProgress(roomId, session.roundId);
  const error = answers.error ?? progress.error;
  if (error) return <StatusPanel title="게임 현황 연결 오류" tone="error">{error.message}</StatusPanel>;
  const correct = answers.value.filter((answer) => answer.isCorrect).length;
  const completed = progress.value.filter((item) => item.currentIndex >= pairCount).length;

  return <div className={styles.teacherView}>
    <StatusPanel title={set.name} tone="waiting">짝맞추기 진행 중</StatusPanel>
    <section className={styles.teacherStats}>
      <div><span>전체 짝</span><strong>{pairCount}</strong></div>
      <div><span>시도</span><strong>{answers.value.length}</strong></div>
      <div><span>찾은 짝</span><strong>{correct}</strong></div>
      <div><span>완료 학생</span><strong>{completed}</strong></div>
    </section>
    <Card><h2 className={styles.teacherTitle}>최근 매칭</h2>
      {answers.value.length === 0 ? <Muted>아직 선택 기록이 없습니다.</Muted> : <div className={styles.answerFeed}>
        {answers.value.slice(0, 12).map((answer) => <div key={answer.id}>
          <strong>{answer.displayName}</strong><span>{answer.prompt}</span>
          <b data-correct={answer.isCorrect}>{answer.isCorrect ? "정답" : "다시 시도"}</b><small>{answer.totalScore}점</small>
        </div>)}
      </div>}
    </Card>
  </div>;
}
