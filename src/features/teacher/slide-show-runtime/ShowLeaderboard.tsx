import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "../../../game-engine/timed-game/leaderboard.ts";
import { loadRoundProgress } from "../../../multiplayer/game-progress/repository.ts";
import { loadRoundParticipants } from "../../../multiplayer/round-participants/repository.ts";
import type { SlideShowSessionState } from "../../../slide-show/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { createShowLeaderboard } from "../../slide-show-runtime/cumulativeLeaderboard.ts";
import styles from "./ShowLeaderboard.module.css";

/** Ranking over the whole show: the run's participants, every engine round, and teacher awards. */
export default function ShowLeaderboard({ roomId, slideShow }: { readonly roomId: string; readonly slideShow: SlideShowSessionState }) {
  const [entries, setEntries] = useState<readonly LeaderboardEntry[] | null>(null);
  const [error, setError] = useState("");
  const roundIds = [slideShow.runId, ...slideShow.scoredRoundIds];
  const scope = `${roundIds.join(":")}|${JSON.stringify(slideShow.awards)}|${slideShow.engine?.phase ?? ""}`;
  useEffect(() => {
    let active = true;
    setError("");
    void Promise.all(roundIds.map(async (roundId) => {
      const [participants, progress] = await Promise.all([loadRoundParticipants(roomId, roundId), loadRoundProgress(roomId, roundId)]);
      return { participants, progress };
    })).then((rounds) => {
      if (active) setEntries(createShowLeaderboard(rounds, slideShow.awards));
    }).catch((value: unknown) => { if (active) setError(toErrorMessage(value, "순위를 불러오지 못했습니다.")); });
    return () => { active = false; };
    // `scope` captures every input that can change the ranking.
  }, [roomId, scope]);

  if (error) return <StatusPanel title="순위 오류" tone="error">{error}</StatusPanel>;
  if (!entries) return <StatusPanel title="순위를 계산하는 중" tone="waiting">잠시만 기다려 주세요.</StatusPanel>;
  return <ol className={styles.board}>
    {entries.length === 0 ? <li className={styles.empty}>아직 참가자가 없어요</li> : entries.map((entry) => (
      <li key={entry.playerId} data-rank={entry.rank <= 3 ? entry.rank : undefined}>
        <b>{entry.rank}</b>
        <strong>{entry.displayName}</strong>
        <em>{entry.score.toLocaleString("ko-KR")}점</em>
      </li>
    ))}
  </ol>;
}
