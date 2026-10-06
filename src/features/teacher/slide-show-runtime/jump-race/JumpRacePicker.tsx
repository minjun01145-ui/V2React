import { useEffect, useMemo, useState } from "react";
import type { Player } from "../../../../multiplayer/types.ts";
import { JUMP_RACE_GOAL_FLOOR, rankJumpRace, type JumpRaceRecord } from "../../../../student-picker/jump-race/model.ts";
import { endJumpRace, observeJumpRaceRecords, startJumpRace } from "../../../../student-picker/jump-race/repository.ts";
import { useJumpRace } from "../../../../student-picker/jump-race/useJumpRace.ts";
import { toErrorMessage } from "../../../../shared/errors/errorMessage.ts";
import Button from "../../../../shared/ui/Button.tsx";
import styles from "./JumpRacePicker.module.css";

/**
 * Teacher side of the jump-tower picker: start the race, watch the class line up by who reaches
 * the goal floor first, and end it. The last line-up stays on screen after the race ends.
 */
export default function JumpRacePicker({ roomId, showRunId, players }: { readonly roomId: string; readonly showRunId: string; readonly players: readonly Player[] }) {
  const race = useJumpRace(roomId, showRunId);
  const [records, setRecords] = useState<readonly JumpRaceRecord[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const playerCount = players.length;

  useEffect(() => {
    if (!race) return undefined;
    setRecords([]);
    return observeJumpRaceRecords(roomId, race, playerCount, setRecords, (cause) => setError(toErrorMessage(cause, "점프타워 기록을 받지 못했습니다.")));
  }, [roomId, race?.raceId, playerCount]);

  const standings = useMemo(() => rankJumpRace(players, records, race?.goalFloor ?? JUMP_RACE_GOAL_FLOOR), [players, records, race?.goalFloor]);
  const finishedCount = standings.filter((standing) => standing.finished).length;

  const run = async (action: () => Promise<void>, fallback: string): Promise<void> => {
    setWorking(true);
    setError("");
    try { await action(); }
    catch (cause: unknown) { setError(toErrorMessage(cause, fallback)); }
    finally { setWorking(false); }
  };

  return <section className={styles.panel} aria-label="점프타워 뽑기">
    <div className={styles.actions}>
      {race
        ? <Button variant="danger" onClick={() => void run(() => endJumpRace(roomId), "점프타워를 끝내지 못했습니다.")} disabled={working}>점프타워 끝내기</Button>
        : <Button onClick={() => void run(() => startJumpRace(roomId, showRunId), "점프타워를 시작하지 못했습니다.")} disabled={working || players.length === 0}>{players.length === 0 ? "학생 접속 대기 중" : records.length > 0 ? "새로 시작" : "점프타워 시작"}</Button>}
      {race ? <span className={styles.progress}>🏁 {race.goalFloor}층 도착 {finishedCount}/{players.length}명</span> : null}
    </div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {race || records.length > 0 ? <ol className={styles.standings} aria-label="도착 순서">
      {standings.map((standing) => <li key={standing.player.id} data-finished={standing.finished}>
        <b>{standing.rank}</b>
        <span className={styles.name}>{standing.player.studentNumber}번 {standing.player.displayName}</span>
        <span className={styles.floor}>{standing.finished ? "🏁 도착" : `${standing.floor}층`}</span>
      </li>)}
    </ol> : null}
  </section>;
}
