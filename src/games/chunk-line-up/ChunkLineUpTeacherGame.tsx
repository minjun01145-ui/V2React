import { useMemo } from "react";
import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useChunkLineUpBoard, useChunkLineUpElevator } from "../../multiplayer/chunk-line-up/hooks.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import ChunkLineUpCanvas from "./ChunkLineUpCanvas.tsx";
import { chunkLineUpRanking } from "./model.ts";
import styles from "./ChunkLineUp.module.css";

export default function ChunkLineUpTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const boardState = useChunkLineUpBoard(roomId, session.roundId, true);
  const elevatorState = useChunkLineUpElevator(roomId, session.roundId);
  const ranking = useMemo(
    () => boardState.value ? chunkLineUpRanking(boardState.value) : [],
    [boardState.value],
  );
  if (boardState.error) return <StatusPanel title="Chunk Line-Up 연결 오류" tone="error">{boardState.error.message}</StatusPanel>;
  if (boardState.loading || !boardState.value) return <StatusPanel title="Chunk Line-Up 준비 중">학생 수에 맞춰 게임판을 만들고 있습니다.</StatusPanel>;
  const board = boardState.value;
  const fixedCount = board.groups.reduce((count, group) => count + group.slots.filter((slot) => slot.fixed).length, 0);
  const filledCount = board.groups.reduce((count, group) => count + group.slots.filter((slot) => Boolean(slot.filledBy)).length, 0);

  return <div className={styles.teacherShell}>
    <div className={styles.teacherHud}>
      <div><strong>Chunk Line-Up</strong><span>{board.groups.length}개 문장 · 완료 {board.completedGroupCount}</span></div>
      <span>채운 슬롯 {filledCount} · 고정 슬롯 {fixedCount}</span>
      <TimedGameStatus session={session} compact />
    </div>
    <ChunkLineUpCanvas
      role="teacher"
      roomId={roomId}
      roundId={session.roundId}
      board={board}
      elevatorState={elevatorState.value}
    />
    {elevatorState.error ? <div className={styles.elevatorError}>엘리베이터 연결 오류 · 발판 경로는 정상 이용 가능</div> : null}
    <div className={styles.teacherRanking}>
      {ranking.slice(0, 8).map((entry, index) => <span key={entry.playerId}>
        <b>{index + 1}</b>{entry.label}<strong>{entry.score}</strong>
      </span>)}
    </div>
  </div>;
}
