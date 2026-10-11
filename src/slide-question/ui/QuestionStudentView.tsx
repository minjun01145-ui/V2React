import { useState } from "react";
import type { PublicQuestion, QuestionResponse } from "../model.ts";
import QuestionTiles from "./QuestionTiles.tsx";
import styles from "./SlideQuestion.module.css";

export default function QuestionStudentView({ question, response, closed, loading, onSubmit }: { readonly question: PublicQuestion; readonly response: QuestionResponse | null; readonly closed: boolean; readonly loading: boolean; readonly onSubmit: (answer: string) => Promise<void> }) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const submit = async (value: string): Promise<void> => {
    setSubmitting(true); setError("");
    try { await onSubmit(value); setSubmitted(true); }
    catch (value: unknown) { setError(value instanceof Error ? value.message : "답안을 제출하지 못했어요."); }
    finally { setSubmitting(false); }
  };
  if (closed) {
    if (loading || response?.correct === null || submitting) return <div className={styles.outcome} data-result="submitted"><strong>채점 중…</strong></div>;
    return <div className={styles.outcome} data-result={response ? response.correct ? "correct" : "wrong" : "timeout"}><strong>{response ? response.correct ? "정답!" : "오답" : "시간 종료"}</strong>{response?.correct ? <b>+{response.score}</b> : null}</div>;
  }
  if (response || submitted) return <div className={styles.outcome} data-result="submitted"><strong>제출했어요</strong></div>;
  return <section className={styles.student}>
    <h2 className={styles.prompt}>{question.prompt}</h2>
    {question.type === "multiple-choice" || question.type === "ox" ? <QuestionTiles question={question} disabled={loading || submitting} onChoose={(value) => void submit(value)} />
      : <form className={styles.answerForm} onSubmit={(event) => { event.preventDefault(); if (answer.trim()) void submit(answer); }}><input aria-label="답안" value={answer} maxLength={1000} disabled={loading || submitting} onChange={(event) => setAnswer(event.target.value)} /><button disabled={loading || submitting || !answer.trim()}>{submitting ? "제출 중…" : "제출"}</button></form>}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
  </section>;
}
