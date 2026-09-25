import { useEffect, useState, type FormEvent } from "react";
import type { AiTutorQuestion, AiTutorReply } from "../../../ai-tutor-engine/types.ts";
import styles from "../PokemonCatch.module.css";

export function PokemonAiQuizView({ question, questionKey, disabled = false, busy, reply, error, onSubmit }: {
  readonly question: AiTutorQuestion | null;
  readonly questionKey: string;
  readonly disabled?: boolean;
  readonly busy: boolean;
  readonly reply: AiTutorReply | null;
  readonly error: string;
  readonly onSubmit: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(""), [questionKey]);

  if (!question) return <p className={styles.quizFeedback}>출제할 학습 문제가 없습니다.</p>;
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!message.trim() || busy || disabled || reply?.isCorrect) return;
    void onSubmit(message);
  };

  return <div className={styles.aiQuiz}>
    <section className={styles.aiQuestion}>
      <span>{question.promptLabel}</span>
      <strong>{question.prompt}</strong>
      <small>{question.answerLabel} · AI가 표현의 의미까지 살펴봅니다.</small>
    </section>
    <form onSubmit={submit}>
      <textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy || disabled || Boolean(reply?.isCorrect)} maxLength={1000} placeholder="답을 입력하세요" autoFocus />
      <button type="submit" disabled={busy || disabled || !message.trim() || Boolean(reply?.isCorrect)}>{busy ? "AI가 채점하는 중…" : "답 확인하기"}</button>
    </form>
    {reply ? <div className={styles.aiReply} data-kind={reply.kind} role="status">
      <strong>{reply.isCorrect ? "정답이에요!" : reply.kind === "retry" ? "조금 더 생각해 보세요" : reply.kind === "help" ? "AI 도움말" : "문제에 집중해 주세요"}</strong>
      <p>{reply.feedback}</p>
      {reply.focus ? <small>확인할 부분: {reply.focus}</small> : null}
      {reply.hint ? <small>힌트: {reply.hint}</small> : null}
    </div> : null}
    {error ? <p className={styles.quizFeedback} role="alert">{error}</p> : null}
  </div>;
}
