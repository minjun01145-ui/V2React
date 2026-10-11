import { OPTION_COLORS, OPTION_SYMBOLS } from "../model.ts";
import type { GradingKey, PublicQuestion, QuestionResponse } from "../model.ts";
import styles from "./SlideQuestion.module.css";

export default function QuestionResults({ question, grading, responses, participantCount }: { readonly question: PublicQuestion; readonly grading: GradingKey | null; readonly responses: readonly QuestionResponse[]; readonly participantCount: number }) {
  if (question.type === "multiple-choice" || question.type === "ox") {
    const options = question.type === "multiple-choice" ? question.options : ["O", "X"];
    const counts = options.map((option, index) => responses.filter((response) => response.answer === (question.type === "ox" ? option : String(index))).length);
    const maximum = Math.max(1, ...counts);
    return <div className={styles.chart} aria-label="선택지별 제출 인원">{options.map((option, index) => {
      const color = question.type === "ox" ? index === 0 ? "#1368CE" : "#E21B3C" : OPTION_COLORS[index];
      const correct = grading ? "correctOptions" in grading ? grading.correctOptions.includes(index) : grading.answer === option : null;
      return <div className={styles.barColumn} key={index}>
        <b>{counts[index]}</b>
        <div className={styles.barTrack}><div className={styles.bar} data-correct={correct} style={{ height: `${(counts[index] ?? 0) / maximum * 100}%`, backgroundColor: color }} /></div>
        <span className={styles.barLabel} style={{ backgroundColor: color }} aria-label={question.type === "ox" ? option : `${index + 1}번 ${option}`}>{question.type === "ox" ? index === 0 ? "○" : "✕" : OPTION_SYMBOLS[index]}</span>
      </div>;
    })}</div>;
  }
  const correctCount = responses.filter((response) => response.correct).length;
  return <div className={styles.shortResults}>
    <strong>정답: {grading && "answer" in grading ? grading.answer : "—"}</strong>
    <b>정답률 {participantCount ? Math.round(correctCount / participantCount * 100) : 0}%</b>
    <div className={styles.responseList}>{responses.map((response) => <div className={styles.response} data-correct={response.correct} key={response.playerId}>
      <span>{response.displayName}</span><strong>{response.answer}</strong>
      {response.method === "ai" ? <small>AI</small> : response.method === "fallback" ? <small>결정적 대체</small> : response.correct === null ? <small>채점 중…</small> : null}
    </div>)}</div>
  </div>;
}
