import type { Player } from '../multiplayer/types.ts';
import Avatar from '../shared/ui/Avatar.tsx';
import styles from './RollerAvatar.module.css';

export default function RollerAvatar({ player, label, bouncing }: {
  readonly player: Player | undefined;
  readonly label: string;
  readonly bouncing: boolean;
}) {
  return (
    <div className={styles.roller} data-bouncing={bouncing ? "true" : undefined}>
      <div className={styles.avatar} data-empty={player?.avatar ? undefined : "true"}>
        {player?.avatar ? <Avatar avatar={player.avatar} label={`${label} 캐릭터`} /> : <span aria-hidden="true">{label.slice(0, 1)}</span>}
      </div>
      <strong>{label}</strong>
    </div>
  );
}

