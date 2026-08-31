import { useRoundAttempts, useRoundProgress } from "../../multiplayer/game-progress/hooks.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import { learningSetTypeLabel } from "../../learning-sets/types.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Card from "../../shared/ui/Card.tsx";
import { Muted } from "../../shared/ui/Typography.tsx";
import styles from "./PokemonCatch.module.css";

export default function TeacherPokemonCatch({ roomId, session, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly set: LearningSet;
}) {
  const answers = useRoundAttempts(roomId, session.roundId);
  const progress = useRoundProgress(roomId, session.roundId);
  const error = answers.error ?? progress.error;
  if (error) return <StatusPanel title="게임 현황 연결 오류" tone="error">{error.message}</StatusPanel>;
  const correct = answers.value.filter((answer) => answer.isCorrect).length;
  const completed = progress.value.reduce((total, item) => total + item.correctCount, 0);
  return <div className={styles.teacherView}>
    <StatusPanel title={set.name} tone="waiting">포켓몬 잡기 진행 중</StatusPanel>
    <section className={styles.teacherStats}>
      <div><span>{learningSetTypeLabel(set.type)} 항목</span><strong>{set.items.length}</strong></div>
      <div><span>총 응답</span><strong>{answers.value.length}</strong></div>
      <div><span>정답</span><strong>{correct}</strong></div>
      <div><span>완료한 세트·문장</span><strong>{completed}</strong></div>
    </section>
    <Card><h2 className={styles.teacherTitle}>최근 퀴즈 응답</h2>
      {answers.value.length === 0 ? <Muted>아직 제출된 답이 없습니다.</Muted> : <div className={styles.answerFeed}>{answers.value.slice(0, 12).map((answer) => <div key={answer.id}><strong>{answer.displayName}</strong><span>{answer.prompt}</span><b data-correct={answer.isCorrect}>{answer.isCorrect ? "정답" : "오답"}</b><small>{answer.totalScore}점</small></div>)}</div>}
    </Card>
  </div>;
}

