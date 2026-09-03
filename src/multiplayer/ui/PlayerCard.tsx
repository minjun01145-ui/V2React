import type { Player } from "../types.ts";
import { displayLabel } from "../types.ts";
import { findCharacter } from "../../characters/catalog.ts";
import Card from "../../shared/ui/Card.tsx";
import styles from "./PlayerCard.module.css";

interface Props {
  readonly player: Player;
  readonly isSelf?: boolean;
  readonly showStudentNumber?: boolean;
}

export default function PlayerCard({ player, isSelf = false, showStudentNumber = false }: Props) {
  const character = player.avatar?.kind === "character" ? findCharacter(player.avatar.characterId) : null;
  return (
    <Card className={styles.card}>
      <div className={styles.avatar} data-empty={character || player.avatar?.kind === "pokemon" ? undefined : "true"}>
        {character ? character.standFrames.map((source, index) => (
          <img className={styles.characterFrame} src={source} alt={index === 0 ? `${character.name} 캐릭터` : ""} aria-hidden={index === 0 ? undefined : true} key={source} />
        )) : null}
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
      </div>
      <div className={styles.meta}>
        <span className={styles.nickname}>{displayLabel(player.displayName, player.nickname)}</span>
        {showStudentNumber ? <span className={styles.studentNumber}>{player.studentNumber}</span> : null}
        {isSelf ? <span className={styles.selfBadge}>나</span> : null}
      </div>
    </Card>
  );
}
