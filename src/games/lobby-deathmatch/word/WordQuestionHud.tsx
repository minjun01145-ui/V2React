import { ANSWER_STYLES, type WordQuestion, type WordRound } from "./model.ts";
import styles from "./WordDeathmatch.module.css";

export function WordQuestionHud({ question, round }: { readonly question: WordQuestion; readonly round: WordRound }) {
  const revealed = round.phase === "reveal";
  return <div className={styles.question} aria-live="polite">
    <div className={styles.promptRow}>
      <strong className={styles.prompt}>{question.prompt}</strong>
      {revealed ? null : <span className={styles.seconds} data-urgent={round.remainingMs <= 5_000}>{Math.ceil(round.remainingMs / 1_000)}</span>}
    </div>
    <div className={styles.options}>
      {question.options.map((option, slot) => <span key={slot} className={styles.option}
        style={{ background: `#${ANSWER_STYLES[slot as 0 | 1].side.toString(16).padStart(6, "0")}` }}
        data-result={revealed ? slot === question.correctSlot ? "correct" : "wrong" : undefined}>
        {revealed && slot === question.correctSlot ? "✓ " : null}{option}
      </span>)}
    </div>
  </div>;
}
