import Avatar from "../../shared/ui/Avatar.tsx";
import type { PlayerAvatar } from "../types.ts";
import styles from "./BattleResultStage.module.css";

export interface BattleResultPlayer {
  readonly nickname: string;
  readonly avatar: PlayerAvatar | null;
}

export default function BattleResultStage({ outcome, players }: {
  readonly outcome: "knockout" | "draw" | "joint-win";
  readonly players: readonly BattleResultPlayer[];
}) {
  const isKnockout = outcome === "knockout";
  const shown = players.slice(0, isKnockout ? 2 : 3);
  return <div
    className={styles.stage}
    data-outcome={outcome}
    aria-label={isKnockout ? "배틀 승패 애니메이션" : "공동 승리 애니메이션"}
  >
    {shown.map((player, index) => <div
      className={`${styles.fighter} ${isKnockout ? index === 0 ? styles.winner : styles.loser : ""}`}
      key={`${player.nickname}:${index}`}
    >
      <div className={styles.avatar}><Avatar avatar={player.avatar} label={`${player.nickname} 캐릭터`} /></div>
      <strong>{player.nickname}</strong>
      {isKnockout && index === 0 ? <i className={styles.bat} aria-hidden="true" /> : null}
    </div>)}
    {isKnockout ? <span className={styles.impact} aria-hidden="true">BONK!</span> : null}
  </div>;
}
