import { OPTION_COLORS, OPTION_SYMBOLS } from "../model.ts";
import type { GradingKey, PublicQuestion } from "../model.ts";
import styles from "./SlideQuestion.module.css";

export default function QuestionTiles({ question, grading, disabled = false, onChoose }: { readonly question: PublicQuestion; readonly grading?: GradingKey | null; readonly disabled?: boolean; readonly onChoose?: (answer: string) => void }) {
  if (question.type !== "multiple-choice" && question.type !== "ox") return null;
  const options = question.type === "multiple-choice" ? question.options : ["O", "X"];
  return <div className={styles.tiles} data-ox={question.type === "ox"} data-five={options.length === 5}>
    {options.map((option, index) => {
      const color = question.type === "ox" ? index === 0 ? "#1368CE" : "#E21B3C" : OPTION_COLORS[index];
      const correct = grading ? "correctOptions" in grading ? grading.correctOptions.includes(index) : grading.answer === option : null;
      const content = <><span className={styles.symbol}>{question.type === "ox" ? index === 0 ? "○" : "✕" : OPTION_SYMBOLS[index]}</span>{question.type === "multiple-choice" ? <span>{option}</span> : null}{correct ? <span className={styles.check}>✓</span> : null}</>;
      return onChoose ? <button key={index} className={styles.tile} style={{ backgroundColor: color }} disabled={disabled} aria-label={question.type === "ox" ? option : `${index + 1}번 ${option}`} onClick={() => onChoose(question.type === "ox" ? option : String(index))}>{content}</button>
        : <div key={index} className={styles.tile} data-wrong={correct === false} style={{ backgroundColor: color }} aria-label={option}>{content}</div>;
    })}
  </div>;
}
