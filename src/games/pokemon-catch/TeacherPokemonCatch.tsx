import { useMemo } from "react";
import { useRoundAnswers, useRoundProgress } from "../../game-engine/question-engine/multiplayer/hooks.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Card from "../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../shared/ui/Typography.tsx";
import { adaptVocabularySet } from "./adapter.ts";
import styles from "./PokemonCatch.module.css";

export default function TeacherPokemonCatch({ roomId, session, set }: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly set: LearningSet;
}) {
  const adapted = useMemo(() => adaptVocabularySet(set, `${session.roundId}:${set.id}:pokemon-quiz`), [session.roundId, set]);
  const answers = useRoundAnswers(roomId, session.roundId);
  const progress = useRoundProgress(roomId, session.roundId);
  const error = answers.error ?? progress.error;
  if (error) return <StatusPanel title="게임 현황 연결 오류" tone="error">{error.message}</StatusPanel>;
  const correct = answers.value.filter((answer) => answer.isCorrect).length;
  const completed = progress.value.filter((item) => item.currentIndex >= adapted.questions.length).length;
  return <div className={styles.teacherView}>
    <StatusPanel title={set.name} tone="waiting">학생들이 단어 문제를 풀어 몬스터볼을 얻고 FireRed 포켓몬을 잡고 있습니다.</StatusPanel>
    <section className={styles.teacherStats}>
      <div><span>단어</span><strong>{adapted.questions.length}</strong></div>
      <div><span>총 응답</span><strong>{answers.value.length}</strong></div>
      <div><span>정답</span><strong>{correct}</strong></div>
      <div><span>문제 완료</span><strong>{completed}</strong></div>
    </section>
    <Card><Eyebrow>LIVE QUIZ</Eyebrow><h2 className={styles.teacherTitle}>최근 단어 응답</h2>
      {answers.value.length === 0 ? <Muted>아직 제출된 답이 없습니다.</Muted> : <div className={styles.answerFeed}>{answers.value.slice(0, 12).map((answer) => <div key={answer.id}><strong>{answer.displayName}</strong><span>{answer.prompt}</span><b data-correct={answer.isCorrect}>{answer.isCorrect ? "정답" : "오답"}</b><small>{answer.totalScore}점</small></div>)}</div>}
    </Card>
  </div>;
}

