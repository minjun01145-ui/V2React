import styles from "./TimedResultsOverlay.module.css";

export interface TimedResultEntry {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

const SHOWN = 10;

/**
 * "시간 종료" results for games that run their own clock boundary: covers the
 * game (which stays mounted underneath, frozen) with the final ranking.
 * `entries` must already be sorted best first.
 */
export function TimedResultsOverlay({ title, unit, entries, selfId, note = "선생님이 다음 활동을 시작할 때까지 기다려 주세요." }: {
  readonly title: string;
  readonly unit: string;
  readonly entries: readonly TimedResultEntry[];
  readonly selfId?: string;
  readonly note?: string;
}) {
  const selfIndex = selfId ? entries.findIndex((entry) => entry.id === selfId) : -1;
  const self = entries[selfIndex];
  const shown = entries.slice(0, SHOWN);
  return <div className={styles.overlay} role="dialog" aria-label="게임 결과">
    <section className={styles.card}>
      <p className={styles.kicker}>시간 종료!</p>
      <h1>{title}</h1>
      {self ? <div className={styles.mine}>
        <span>내 순위</span>
        <strong>{selfIndex + 1}<small>위</small></strong>
        <span>{self.value}{unit}</span>
      </div> : null}
      <ol className={styles.ranking}>
        {shown.map((entry, index) => <li key={entry.id} data-rank={index < 3 ? index + 1 : undefined} data-self={entry.id === selfId}>
          <b>{index + 1}</b><span>{entry.label}</span><em>{entry.value}{unit}</em>
        </li>)}
        {self && selfIndex >= SHOWN ? <li data-self="true" className={styles.selfRow}>
          <b>{selfIndex + 1}</b><span>{self.label}</span><em>{self.value}{unit}</em>
        </li> : null}
      </ol>
      <p className={styles.note}>{note}</p>
    </section>
  </div>;
}
