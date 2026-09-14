import { findCharacter } from "../../characters/catalog.ts";
import { useCharacterStandFrame } from "../../shared/useCharacterStandFrame.ts";
import type { PlayerAvatar } from "../types.ts";
import styles from "./BattleResultStage.module.css";

export interface BattleResultPlayer {
  readonly nickname: string;
  readonly avatar: PlayerAvatar | null;
}

function Avatar({ player }: { readonly player: BattleResultPlayer }) {
  const character = player.avatar?.kind === "character" ? findCharacter(player.avatar.characterId) : null;
  const frame = useCharacterStandFrame(character?.standFrames ?? null);
  if (frame) return <img src={frame} alt={`${player.nickname} 캐릭터`} draggable={false} />;
  if (player.avatar?.kind === "pokemon") return <img src={player.avatar.spriteUrl} alt={`${player.nickname} 포켓몬`} />;
  return <span aria-label="장착 캐릭터 없음">?</span>;
}

export default function BattleResultStage({ outcome, players }: {
  readonly outcome: "knockout" | "draw";
  readonly players: readonly BattleResultPlayer[];
}) {
  const shown = players.slice(0, outcome === "knockout" ? 2 : 3);
  return <div className={styles.stage} data-outcome={outcome} aria-label={outcome === "knockout" ? "배틀 승패 애니메이션" : "공동 승리 애니메이션"}>
    {shown.map((player, index) => <div className={`${styles.fighter} ${outcome === "knockout" ? index === 0 ? styles.winner : styles.loser : ""}`} key={`${player.nickname}:${index}`}>
      <div className={styles.avatar}><Avatar player={player} /></div><strong>{player.nickname}</strong>
      {outcome === "knockout" && index === 0 ? <i className={styles.bat} aria-hidden="true" /> : null}
    </div>)}
    {outcome === "knockout" ? <span className={styles.impact} aria-hidden="true">BONK!</span> : null}
  </div>;
}
