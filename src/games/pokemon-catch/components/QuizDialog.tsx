import type { ReactNode } from "react";
import type { PokemonItemId } from "../../../student-data/pokemon-catch/types.ts";
import { itemDefinition } from "../itemRules.ts";
import styles from "../PokemonCatch.module.css";

interface Props {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly reward: PokemonItemId | null;
  readonly feedback: string;
  readonly submitting: boolean;
  readonly onClose: () => void;
  readonly onMore: () => void;
  readonly onStop: () => void;
}

export function QuizDialog({ title, description, children, reward, feedback, submitting, onClose, onMore, onStop }: Props) {
  return <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={title}><section className={`${styles.quizCard} ${styles.quizWorkspace}`}>
    <button type="button" className={styles.closeButton} onClick={onClose} disabled={submitting} aria-label="닫기">×</button>
    <span className={styles.quizStep}>ITEM QUIZ</span>
    <p>{description}</p><h2>{title}</h2>
    <div className={styles.quizModule}>{children}</div>
    {reward ? <div className={styles.rewardCard}><strong>{itemDefinition(reward).name}</strong><span>가방에 저장되었습니다.</span></div> : null}
    {feedback ? <div className={styles.quizFeedback} data-correct={Boolean(reward)}>{feedback}</div> : null}
    {reward ? <div className={styles.rewardActions}>
      <button type="button" className={styles.continueButton} onClick={onMore} disabled={submitting}>문제 더 풀기</button>
      <button type="button" className={styles.stopButton} onClick={onStop} disabled={submitting}>문제 그만 풀기</button>
    </div> : null}
  </section></div>;
}
