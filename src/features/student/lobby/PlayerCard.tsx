import type { Player } from "../../../multiplayer/types.ts";
import Card from "../../../shared/ui/Card.tsx";
import { displayLabel } from "./nickname.ts";
import playerCardStyles from "./PlayerCard.module.css";

interface Props {
  readonly player: Player;
  readonly isSelf: boolean;
}

/**
 * 단일 학생 카드. 포획한 포켓몬 아바타 기능이 추가되면 avatarUrl prop으로 이미지를 채운다.
 * 지금은 avatar 영역을 빈 placeholder로 둔다.
 */
export default function PlayerCard({ player, isSelf }: Props) {
  return (
    <Card className={playerCardStyles.card}>
      <div className={playerCardStyles.avatar} aria-hidden="true" data-empty="true" />
      <div className={playerCardStyles.meta}>
        <span className={playerCardStyles.nickname}>{displayLabel(player.displayName, player.nickname)}</span>
        {isSelf ? <span className={playerCardStyles.selfBadge}>나</span> : null}
      </div>
    </Card>
  );
}