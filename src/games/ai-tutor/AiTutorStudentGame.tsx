import { useState, type FormEvent } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { useAiTutorGame } from "./useAiTutorGame.ts";
import { useAiTutorSet } from "./useAiTutorSet.ts";
import styles from "./AiTutor.module.css";

function AiTutorPlayArea({ roomId, session, player, set }: StudentGameModuleProps & { readonly set: NonNullable<ReturnType<typeof useAiTutorSet>["set"]> }) {
  const game = useAiTutorGame({ roomId, session, player, set });
  const [message, setMessage] = useState("");
  if (game.loading) return <StatusPanel title="AI 문답 준비 중">진행 상황을 연결하고 있습니다.</StatusPanel>;
  if (game.error && !game.currentQuestion) return <StatusPanel title="AI 문답 연결 오류" tone="error">{game.error.message}</StatusPanel>;
  if (!game.currentQuestion) return <StatusPanel title="학습 완료">모든 문제를 마쳤습니다. 총 {game.progress.score}점을 얻었어요!</StatusPanel>;

  const answered = Boolean(game.progress.lastResult?.isCorrect);
  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const submitted = message;
    if (!submitted.trim()) return;
    setMessage("");
    void game.submit(submitted);
  };

  return <main className={styles.game}>
    <header className={styles.topbar}>
      <div><span>AI TUTOR</span><h1>{game.title}</h1></div>
      <div className={styles.metrics}><span>{game.progress.currentIndex + 1} / {game.totalCount}</span><strong>{game.progress.score}점</strong></div>
    </header>
    <Card className={styles.questionCard}>
      <p className={styles.eyebrow}>{game.currentQuestion.promptLabel}</p>
      <h2>{game.currentQuestion.prompt}</h2>
      <p className={styles.guide}>답을 입력하거나, 이 문제에 나온 모르는 단어·문법을 질문해도 됩니다.</p>
    </Card>
    <form className={styles.answerForm} onSubmit={onSubmit}>
      <label htmlFor="ai-tutor-answer">{game.currentQuestion.answerLabel}</label>
      <textarea id="ai-tutor-answer" rows={4} value={message} onChange={(event) => setMessage(event.target.value)} disabled={game.busy || answered} maxLength={1000} placeholder="답 또는 문제와 관련된 질문을 입력하세요" autoFocus />
      <Button type="submit" disabled={game.busy || answered || !message.trim()}>{game.busy ? "AI가 살펴보는 중…" : "답변 보내기"}</Button>
    </form>
    {game.reply ? <section className={styles.feedback} data-kind={game.reply.kind} role="status">
      <strong>{game.reply.kind === "correct" ? "정답이에요!" : game.reply.kind === "retry" ? "조금만 더 생각해 볼까요?" : game.reply.kind === "help" ? "문제 도움말" : "문제와 관련된 내용만"}</strong>
      <p>{game.reply.feedback}</p>
      {game.reply.focus ? <p><b>확인할 부분:</b> {game.reply.focus}</p> : null}
      {game.reply.hint ? <p><b>힌트:</b> {game.reply.hint}</p> : null}
      {game.reply.isCorrect ? <Button onClick={() => void game.goNext()} disabled={game.busy}>다음 문제</Button> : null}
    </section> : answered ? <section className={styles.feedback} data-kind="correct" role="status"><strong>정답으로 인정된 문제예요.</strong><p>다음 문제로 계속 진행하세요.</p><Button onClick={() => void game.goNext()} disabled={game.busy}>다음 문제</Button></section> : null}
    {game.error ? <p className={styles.error} role="alert">{game.error.message}</p> : null}
  </main>;
}

export default function AiTutorStudentGame(props: StudentGameModuleProps) {
  const learningSet = useAiTutorSet(props.session);
  if (learningSet.loading) return <StatusPanel title="학습 세트 불러오는 중">AI 문답 문제를 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택된 학습 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <AiTutorPlayArea {...props} set={learningSet.set} />;
}
