import type { Player } from "../types.ts";
import { displayLabel } from "../types.ts";
import { findCharacter } from "../../characters/catalog.ts";
import { useCharacterStandFrame } from "../../shared/useCharacterStandFrame.ts";
import Card from "../../shared/ui/Card.tsx";
import styles from "./PlayerCard.module.css";

interface Props {
  readonly player: Player;
  readonly isSelf?: boolean;
  readonly showStudentNumber?: boolean;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly actionPending?: boolean;
  readonly actionLabel?: string;
}

export default function PlayerCard({
  player,
  isSelf = false,
  showStudentNumber = false,
  onClick,
  disabled = false,
  actionPending = false,
  actionLabel,
}: Props) {
  const character = player.avatar?.kind === "character" ? findCharacter(player.avatar.characterId) : null;
  const characterFrame = useCharacterStandFrame(character?.standFrames ?? null);
  const interactiveProps = onClick
    ? { as: "button" as const, className: `${styles.card} ${styles.interactive}`, onClick, disabled, "aria-label": actionLabel }
    : { className: styles.card };
  return (
    <Card {...interactiveProps}>
      <span className={styles.avatar} data-empty={character || player.avatar?.kind === "pokemon" ? undefined : "true"}>
        {character && characterFrame ? <img className={styles.characterFrame} src={characterFrame} alt={`${character.name} 캐릭터`} decoding="async" draggable={false} /> : null}
        {player.avatar?.kind === "pokemon" ? (
          <img
            className={styles.pokemon}
            src={player.avatar.spriteUrl}
            alt={`${player.avatar.name} 포켓몬`}
            onError={(event) => {
              const fallback = player.avatar?.kind === "pokemon" ? player.avatar.fallbackSpriteUrl : null;
              if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
            }}
          />
        ) : null}
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
