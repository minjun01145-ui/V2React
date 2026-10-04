import { useState } from "react";
import { displayLabel, type Player } from "../../../multiplayer/types.ts";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import Button from "../../../shared/ui/Button.tsx";
import styles from "./AwardPanel.module.css";

const AMOUNTS = ["10", "50", "100", "-10"] as const;
type Amount = typeof AMOUNTS[number];

/** Pick an amount, then tap students (or everyone) to hand out show points. */
export default function AwardPanel({ players, awards, disabled, onAward }: {
  readonly players: readonly Player[];
  readonly awards: Readonly<Record<string, number>>;
  readonly disabled: boolean;
  readonly onAward: (playerIds: readonly string[], points: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState<Amount>("10");
  const points = Number(amount);
  return <section className={styles.panel} aria-label="점수 주기">
    <div className={styles.header}>
      <SegmentedControl ariaLabel="줄 점수" value={amount} onChange={setAmount} options={AMOUNTS.map((id) => ({ id, label: Number(id) > 0 ? `+${id}` : id }))} />
      <Button variant="accent" size="sm" onClick={() => void onAward(players.map((player) => player.id), points)} disabled={disabled || players.length === 0}>모두 {points > 0 ? `+${points}` : points}</Button>
    </div>
    <div className={styles.players}>
      {players.length === 0 ? <p className={styles.empty}>접속한 학생이 없어요</p> : players.map((player) => (
        <button type="button" className={styles.player} key={player.id} disabled={disabled} onClick={() => void onAward([player.id], points)}>
          <strong>{displayLabel(player.displayName, player.nickname)}</strong>
          <span>{(awards[player.id] ?? 0).toLocaleString("ko-KR")}</span>
        </button>
      ))}
    </div>
  </section>;
}
