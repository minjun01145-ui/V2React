import { findCharacter } from '../characters/catalog.ts';
import type { Player } from '../multiplayer/types.ts';
import { useCharacterStandFrame } from '../shared/useCharacterStandFrame.ts';
import styles from './RollerAvatar.module.css';

export default function RollerAvatar({ player, label, bouncing }: {
  readonly player: Player | undefined;
  readonly label: string;
  readonly bouncing: boolean;
}) {
  const character = player?.avatar?.kind === "character" ? findCharacter(player.avatar.characterId) : null;
  const characterFrame = useCharacterStandFrame(character?.standFrames ?? null);
  return (
    <div className={styles.roller} data-bouncing={bouncing ? "true" : undefined}>
      <div className={styles.avatar} data-empty={characterFrame || player?.avatar?.kind === "pokemon" ? undefined : "true"}>
        {characterFrame ? <img src={characterFrame} alt={`${character?.name ?? label} 캐릭터`} draggable={false} /> : null}
        {player?.avatar?.kind === "pokemon" ? <img src={player.avatar.spriteUrl} alt={`${player.avatar.name} 포켓몬`} /> : null}
        {!characterFrame && player?.avatar?.kind !== "pokemon" ? <span aria-hidden="true">{label.slice(0, 1)}</span> : null}
      </div>
      <strong>{label}</strong>
    </div>
  );
}

