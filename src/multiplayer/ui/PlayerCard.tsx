import type { Player } from "../types.ts";
import { displayLabel } from "../types.ts";
import Avatar from "../../shared/ui/Avatar.tsx";
import Card from "../../shared/ui/Card.tsx";
import styles from "./PlayerCard.module.css";

interface Props {
  readonly player: Player;
  readonly size?: "regular" | "large";
  readonly isSelf?: boolean;
  readonly showStudentNumber?: boolean;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly actionPending?: boolean;
  readonly actionLabel?: string;
}

export default function PlayerCard({
  player,
  size = "regular",
  isSelf = false,
  showStudentNumber = false,
  onClick,
  disabled = false,
  actionPending = false,
  actionLabel,
}: Props) {
  const interactiveProps = onClick
    ? { as: "button" as const, className: `${styles.card} ${styles.interactive}`, onClick, disabled, "aria-label": actionLabel }
    : { className: styles.card };
  return (
    <Card {...interactiveProps} data-size={size}>
      <span className={styles.avatar} data-empty={player.avatar ? undefined : "true"}>
        {player.avatar ? <Avatar avatar={player.avatar} label={`${displayLabel(player.displayName, player.nickname)} 캐릭터`} /> : null}
      </span>
      <span className={styles.meta}>
        <span className={styles.nicknameRow}>
          {player.nicknameGrade ? <span className={styles.gradeBadge} data-grade={player.nicknameGrade}>{player.nicknameGrade}</span> : null}
          <span className={styles.nickname}>{displayLabel(player.displayName, player.nickname)}</span>
        </span>
        {showStudentNumber ? <span className={styles.studentNumber}>{player.studentNumber}</span> : null}
        {isSelf ? <span className={styles.selfBadge}>나</span> : null}
        {onClick ? <span className={styles.actionHint}>{actionPending ? "처리 중…" : "클릭하여 강퇴"}</span> : null}
      </span>
    </Card>
  );
}
