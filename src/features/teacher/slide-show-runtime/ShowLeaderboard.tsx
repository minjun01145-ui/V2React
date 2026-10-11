import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "../../../game-engine/timed-game/leaderboard.ts";
import { subscribeRoundProgress } from "../../../multiplayer/game-progress/repository.ts";
import { loadRoundParticipants } from "../../../multiplayer/round-participants/repository.ts";
import type { SlideShowSessionState } from "../../../slide-show/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { createShowLeaderboard } from "../../slide-show-runtime/cumulativeLeaderboard.ts";
import type { LeaderboardRound } from "../../slide-show-runtime/cumulativeLeaderboard.ts";
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
    const rounds: { participants?: LeaderboardRound["participants"]; progress?: LeaderboardRound["progress"] }[] = roundIds.map(() => ({}));
    const publish = (): void => {
      if (!active) return;
      const loaded: LeaderboardRound[] = [];
      for (const round of rounds) {
        if (!round.participants || !round.progress) return;
        loaded.push({ participants: round.participants, progress: round.progress });
      }
      setEntries(createShowLeaderboard(loaded, slideShow.awards));
    };
    const failed = (value: unknown): void => {
      if (active) setError(toErrorMessage(value, "순위를 불러오지 못했습니다."));
    };
    // AI verdicts can arrive after this or a later slide opens its results.
    const unsubscribe = roundIds.map((roundId, index) => {
      const round = rounds[index]!;
      void loadRoundParticipants(roomId, roundId).then((participants) => {
        if (!active) return;
        round.participants = participants;
        publish();
      }).catch(failed);
      return subscribeRoundProgress(roomId, roundId, (progress) => {
        round.progress = progress;
        publish();
      }, failed);
    });
    return () => { active = false; unsubscribe.forEach((stop) => stop()); };
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
