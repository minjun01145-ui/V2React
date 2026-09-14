import type { LearningSetTableEntry, LearningSetTableSide } from "./model.ts";
import styles from "./LearningSetTable.module.css";

export default function LearningSetTable({ entries, disabled = false, usedItemIds = [], onSelect }: {
  readonly entries: readonly LearningSetTableEntry[];
  readonly disabled?: boolean;
  readonly usedItemIds?: readonly string[];
  readonly onSelect?: (itemId: string, side: LearningSetTableSide) => void;
}) {
  const used = new Set(usedItemIds);
  const sourceLabel = entries[0]?.sourceLabel ?? "영어";
  return <div className={styles.wrap}>
    <table className={styles.table}>
      <thead><tr><th>번호</th><th>{sourceLabel}</th><th>우리말 뜻</th></tr></thead>
      <tbody>{entries.map((entry, index) => <tr key={entry.id}>
        <td>{index + 1}</td>
        <td><button className={styles.cell} type="button" disabled={disabled || used.has(entry.id)} data-used={used.has(entry.id)} onClick={() => onSelect?.(entry.id, "source")}>{entry.source}</button></td>
        <td><button className={styles.cell} type="button" disabled={disabled || used.has(entry.id)} data-used={used.has(entry.id)} onClick={() => onSelect?.(entry.id, "meaning")}>{entry.meaning}</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
