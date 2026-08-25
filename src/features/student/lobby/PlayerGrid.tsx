import type { Player } from "../../../multiplayer/types.ts";
import PlayerCard from "./PlayerCard.tsx";
import gridStyles from "./PlayerGrid.module.css";

interface Props {
  readonly players: readonly Player[];
  readonly selfStudentNumber: string;
}

export default function PlayerGrid({ players, selfStudentNumber }: Props) {
  if (players.length === 0) {
    return <p className={gridStyles.empty}>아직 대기 중인 학생이 없어요.</p>;
  }
  return (
    <ul className={gridStyles.grid} aria-label="대기 중인 학생">
      {players.map((player) => (
        <li key={player.id} className={gridStyles.cell}>
          <PlayerCard player={player} isSelf={player.studentNumber === selfStudentNumber} />
        </li>
      ))}
    </ul>
  );
}