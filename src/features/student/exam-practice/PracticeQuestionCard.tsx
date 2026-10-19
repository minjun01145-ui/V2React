import type { PracticeResponse } from "../../../question-bank/grading.ts";
import { CHOICE_MARKS, type ExamQuestionContent } from "../../../question-bank/types.ts";
import InlineText from "../../../worksheet/ui/InlineText.tsx";
import Button from "../../../shared/ui/Button.tsx";
import styles from "./ExamPractice.module.css";

/**
 * One question to solve. Before grading the student picks or types an answer; after grading the
 * card shows whether it was right, the correct answer and the explanation.
 */
export default function PracticeQuestionCard({ number, content, response, onResponse, result, onAcceptWritten }: {
  readonly number: number;
  readonly content: ExamQuestionContent;
  readonly response: PracticeResponse | undefined;
  readonly onResponse: (response: PracticeResponse) => void;
  /** null before grading. */
  readonly result: "correct" | "wrong" | null;
  /** For a written answer marked wrong only by wording: the student can count it as right. */
  readonly onAcceptWritten?: (() => void) | undefined;
}) {
  const graded = result !== null;
  return <article className={styles.question} data-result={result ?? undefined}>
    <header className={styles.questionHead}>
      <b>{number}</b>
      <p><InlineText text={content.prompt} /></p>
      {graded ? <strong className={styles.mark}>{result === "correct" ? "정답" : "오답"}</strong> : null}
    </header>
    {content.context ? <div className={styles.context}><InlineText text={content.context} /></div> : null}
    {content.format === "choice"
      ? <ol className={styles.choices}>{content.choices.map((choice, index) => {
        const value = index + 1;
        const picked = response?.format === "choice" && response.choice === value;
        return <li key={index}>
          <button type="button" className={styles.choice} aria-pressed={picked} disabled={graded}
            data-correct={graded && value === content.correctChoice ? "true" : undefined}
            onClick={() => onResponse({ format: "choice", choice: value })}>
            <span>{CHOICE_MARKS[index]}</span> <InlineText text={choice} />
          </button>
        </li>;
      })}</ol>
      : <input className={styles.written} aria-label={`${number}번 답`} maxLength={600} disabled={graded}
        value={response?.format === "written" ? response.text : ""} onChange={(event) => onResponse({ format: "written", text: event.target.value })} />}
    {graded ? <div className={styles.feedback}>
      {content.format === "written" ? <p><b>정답</b> <InlineText text={content.answer} /></p> : <p><b>정답</b> {CHOICE_MARKS[content.correctChoice - 1]}</p>}
      {content.explanation ? <p className={styles.explanation}>{content.explanation}</p> : null}
      {onAcceptWritten ? <Button variant="ghost" size="sm" onClick={onAcceptWritten}>내 답도 맞아요</Button> : null}
    </div> : null}
  </article>;
}
