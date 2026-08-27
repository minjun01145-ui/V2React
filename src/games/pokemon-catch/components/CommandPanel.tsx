import type { EncounterPhase } from "../types.ts";
import styles from "../PokemonCatch.module.css";

interface Props {
  readonly actionMessage: string;
  readonly hasQuestion: boolean;
  readonly submitting: boolean;
  readonly phase: EncounterPhase;
  readonly usingItem: boolean;
  readonly captureCount: number;
  readonly onOpenQuiz: () => void;
  readonly onOpenItems: () => void;
  readonly onOpenCollection: () => void;
}

export function CommandPanel({ actionMessage, hasQuestion, submitting, phase, usingItem, captureCount, onOpenQuiz, onOpenItems, onOpenCollection }: Props) {
  return <section className={styles.commandPanel}>
    {actionMessage ? <div className={styles.actionMessage}>{actionMessage}</div> : null}
    <div className={styles.commands}>
      <button type="button" onClick={onOpenQuiz} disabled={!hasQuestion || submitting}>문제 풀기<small>무작위 아이템 얻기</small></button>
      <button type="button" className={styles.primaryCommand} onClick={onOpenItems} disabled={phase !== "ready" || usingItem}>아이템 사용하기<small>공 · 스프레이 · 시간 증가</small></button>
    </div>
    <button type="button" className={styles.collectionButton} onClick={onOpenCollection}>내 포획함 <b>{captureCount}</b></button>
  </section>;
}
