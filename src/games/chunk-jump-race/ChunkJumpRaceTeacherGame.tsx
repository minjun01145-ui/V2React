import { useMemo, useRef, useState } from "react";
import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { FullscreenToggle } from "../../game-engine/stage/ImmersiveStage.tsx";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { TimedResultsOverlay } from "../../game-engine/timed-game/TimedResultsOverlay.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import ChunkJumpRaceCanvas, { type ChunkJumpStanding } from "./ChunkJumpRaceCanvas.tsx";
import { useChunkJumpRaceSet } from "./useChunkJumpRaceSet.ts";
import styles from "./ChunkJumpRace.module.css";

export default function ChunkJumpRaceTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const learningSet = useChunkJumpRaceSet(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  const [standings, setStandings] = useState<readonly ChunkJumpStanding[]>([]);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const clock = useTimedGameClock(session);
  const expectedIds = useMemo(() => new Set(session.expectedPlayerIds), [session.expectedPlayerIds]);
  const labels = useMemo(() => new Map(participants.value
    .filter((participant) => expectedIds.has(participant.playerId))
    .map((participant) => [participant.playerId, displayLabel(participant.displayName, participant.nickname)] as const)), [expectedIds, participants.value]);

  if (learningSet.loading || participants.loading) return <StatusPanel title="점프 레이스 중계 준비 중">학습 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택된 끊어읽기 세트를 찾을 수 없습니다."}</StatusPanel>;

  return <div className={styles.teacherShell} ref={shellRef}>
    <main className={styles.teacherMain}>
      <header className={styles.hud}>
        <div className={styles.promptBlock}><strong>끊어읽기 점프 레이스 · 실시간 중계</strong><span>{learningSet.set.name}</span><small>{standings.length}/{expectedIds.size}명 위치 수신</small></div>
        <TimedGameStatus session={session} compact />
        <FullscreenToggle target={shellRef} />
      </header>
      <ChunkJumpRaceCanvas role="teacher" roomId={roomId} roundId={session.roundId} labels={labels} onStandings={setStandings} />
    </main>
    <aside className={styles.ranking}>
      <h3>현재 순위</h3>
      {standings.length === 0 ? <p>학생 위치를 기다리고 있습니다.</p> : standings.map((standing, index) => <div className={styles.rankRow} data-rank={index < 3 ? index + 1 : undefined} key={standing.playerId}>
        <strong>{index + 1}</strong><span>{standing.label}</span><b>{standing.distance}칸</b>
      </div>)}
    </aside>
    {clock.expired ? <TimedResultsOverlay
      title="점프 레이스 최종 순위"
      unit="칸"
      entries={standings.map((standing) => ({ id: standing.playerId, label: standing.label, value: standing.distance }))}
      note="게임을 끝내면 학생들이 대기실로 돌아갑니다."
    /> : null}
  </div>;
}
