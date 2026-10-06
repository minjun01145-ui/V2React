import { useState } from "react";
import JumpTowerGame from "../../../../game-engine/jump-tower/JumpTowerGame.tsx";
import type { LiveRecord } from "../../../../live-world/client.ts";
import { usePlayers } from "../../../../multiplayer/hooks.ts";
import { displayLabel, type Player } from "../../../../multiplayer/types.ts";
import { jumpRaceScope, rankJumpRace, type JumpRace } from "../../../../student-picker/jump-race/model.ts";
import styles from "./JumpRaceStage.module.css";

/** The student's view of a jump-tower picker race: the shared tower plus the goal and their finish place. */
export default function JumpRaceStage({ roomId, player, race }: { readonly roomId: string; readonly player: Player; readonly race: JumpRace }) {
  const { activePlayers } = usePlayers(roomId);
  const [best, setBest] = useState(0);
  const [records, setRecords] = useState<readonly LiveRecord[]>([]);
  const scope = jumpRaceScope(roomId, race);
  const finished = best >= race.goalFloor;
  const place = finished
    ? rankJumpRace(activePlayers, records.map((record) => ({ playerId: record.playerId, floor: record.score, reachedAtMs: record.reachedAtMs })), race.goalFloor)
      .find((standing) => standing.player.id === player.id && standing.finished)?.rank ?? null
    : null;

  return <div className={styles.stage}>
    <JumpTowerGame
      key={race.raceId}
      roomId={roomId}
      playerId={player.id}
      label={displayLabel(player.displayName, player.nickname)}
      players={activePlayers}
      roundId={scope.roundId}
      channelId={scope.channelId}
      seed={race.raceId}
      recordLimit={race.goalFloor}
      onHeight={(_, nextBest) => setBest(nextBest)}
      onRecords={setRecords}
    >
      <div className={styles.goal} data-finished={finished}>
        {finished ? <strong>🏁 {race.goalFloor}층 도착!{place ? ` ${place}등` : ""}</strong> : <strong>🏁 {race.goalFloor}층까지 먼저 올라가기 · {Math.min(best, race.goalFloor)}층</strong>}
      </div>
    </JumpTowerGame>
  </div>;
}
