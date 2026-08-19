import { useMemo } from "react";
import { useRoundAnswers, useRoundProgress } from "../../game-engine/question-engine/multiplayer/hooks.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Card from "../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../shared/ui/Typography.tsx";
import { adaptReadingChunksSet } from "./readingChunksAdapter.ts";
import styles from "./SentenceBuilder.module.css";

interface Props {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly set: unknown;
}

export default function TeacherSentenceBuilder({ roomId, session, set }: Props) {
  const adaptedSet = useMemo(() => adaptReadingChunksSet(set), [set]);
  const answers = useRoundAnswers(roomId, session.roundId);
  const progress = useRoundProgress(roomId, session.roundId);
  const correctAnswers = answers.value.filter((answer) => answer.isCorrect).length;
  const finishedPlayers = progress.value.filter((item) => item.currentIndex >= adaptedSet.questions.length).length;
  const connectionError = answers.error ?? progress.error;
  if (connectionError) return <StatusPanel title="게임 현황 연결 오류" tone="error">{connectionError.message}</StatusPanel>;

  const stats = [
    { label: "문항", value: adaptedSet.questions.length },
    { label: "응답", value: answers.value.length },
    { label: "정답 응답", value: correctAnswers },
    { label: "완료 학생", value: finishedPlayers },
  ] as const;

  return <div>
    <StatusPanel title={adaptedSet.title} tone="waiting">학생들이 각자 문장 조각을 올바른 순서로 맞추고 있습니다.</StatusPanel>
    <section className={styles.statGrid}>{stats.map((stat) => <div className={styles.stat} key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</section>
    <Card><div className={styles.heading}><div><Eyebrow>LIVE ANSWERS</Eyebrow><h2>최근 응답</h2></div></div>
      {answers.value.length === 0 ? <Muted>아직 제출된 답이 없습니다.</Muted> : <div className={styles.feed}>{answers.value.slice(0, 12).map((answer) => <div className={styles.feedRow} key={answer.id}><strong>{answer.displayName}</strong><span>{answer.prompt}</span><b className={answer.isCorrect ? styles.ok : styles.no}>{answer.isCorrect ? "정답" : "오답"}</b><small>{answer.totalScore}점</small></div>)}</div>}
    </Card>
  </div>;
}
