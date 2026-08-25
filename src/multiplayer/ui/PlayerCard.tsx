import type { Player } from "../types.ts";
import { displayLabel } from "../types.ts";
import Card from "../../shared/ui/Card.tsx";
import styles from "./PlayerCard.module.css";

interface Props {
  readonly player: Player;
  readonly isSelf?: boolean;
  readonly showStudentNumber?: boolean;
}

/**
 * 단일 학생 카드. 포획한 포켓몬 아바타 기능이 추가되면 avatarUrl prop으로 이미지를 채운다.
 * 지금은 avatar 영역을 빈 placeholder로 둔다.
 */
export default function PlayerCard({ player, isSelf = false, showStudentNumber = false }: Props) {
  return (
    <Card className={styles.card}>
      <div className={styles.avatar} aria-hidden="true" data-empty="true" />
      <div className={styles.meta}>
        <span className={styles.nickname}>{displayLabel(player.displayName, player.nickname)}</span>
        {showStudentNumber ? <span className={styles.studentNumber}>{player.studentNumber}</span> : null}
        {isSelf ? <span className={styles.selfBadge}>나</span> : null}
      </div>
    </Card>
  );
}