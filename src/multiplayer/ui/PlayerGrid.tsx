import type { Player } from "../types.ts";
import { Muted } from "../../shared/ui/Typography.tsx";
import PlayerCard from "./PlayerCard.tsx";
import styles from "./PlayerGrid.module.css";

interface Props {
  readonly players: readonly Player[];
  readonly selfStudentNumber?: string;
  readonly showStudentNumber?: boolean;
  readonly emptyMessage?: string;
}

/**
 * 학생 목록 격자. 학생/교사 대기실 모두 사용한다.
 * 교사용은 selfStudentNumber를 생략해 본인 표시를 끈다.
 */
export default function PlayerGrid({
  players,
  selfStudentNumber,
  showStudentNumber = false,
  emptyMessage = "아직 대기 중인 학생이 없어요.",
}: Props) {
  if (players.length === 0) {
    return <Muted>{emptyMessage}</Muted>;
  }
  return (
    <ul className={styles.grid} aria-label="대기 중인 학생">
      {players.map((player) => (
        <li key={player.id} className={styles.cell}>
          <PlayerCard
            player={player}
            isSelf={Boolean(selfStudentNumber) && player.studentNumber === selfStudentNumber}
            showStudentNumber={showStudentNumber}
          />
        </li>
      ))}
    </ul>
  );
}