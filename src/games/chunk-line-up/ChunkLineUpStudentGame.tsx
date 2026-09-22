import { useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { playCorrectChime } from "../../game-engine/effects/sound.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { useChunkLineUpBoard, useChunkLineUpElevator } from "../../multiplayer/chunk-line-up/hooks.ts";
import { confirmChunkLineUpSlot, reserveChunkLineUpElevatorSeat } from "../../multiplayer/chunk-line-up/repository.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import ChunkLineUpCanvas, { type ChunkLineUpController } from "./ChunkLineUpCanvas.tsx";
import styles from "./ChunkLineUp.module.css";

export default function ChunkLineUpStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const boardState = useChunkLineUpBoard(roomId, session.roundId, session.expectedPlayerIds[0] === player.id);
  const elevatorState = useChunkLineUpElevator(roomId, session.roundId);
  const controllerRef = useRef<ChunkLineUpController | null>(null);
  const busyRef = useRef(false);
  const elevatorBusyRef = useRef(false);
  const [feedback, setFeedback] = useState<"wrong" | "stale" | null>(null);
  const clock = useTimedGameClock(session);

  if (!session.expectedPlayerIds.includes(player.id)) {
    return <StatusPanel title="다음 게임을 기다려 주세요" tone="waiting">이미 시작된 Chunk Line-Up에는 중간 참가할 수 없습니다.</StatusPanel>;
  }
  if (boardState.error) return <StatusPanel title="Chunk Line-Up 연결 오류" tone="error">{boardState.error.message}</StatusPanel>;
  if (boardState.loading || !boardState.value) return <StatusPanel title="Chunk Line-Up 준비 중">학생 수에 맞춰 문장과 청크를 배정하고 있습니다.</StatusPanel>;

  const board = boardState.value;
  const assignment = board.assignments[player.id];
  if (!assignment) return <StatusPanel title="청크 배정 대기 중" tone="waiting">현재 청크를 배정하고 있습니다.</StatusPanel>;
  const label = displayLabel(player.displayName, player.nickname);

  const reserveElevator = async (): Promise<void> => {
    if (elevatorBusyRef.current || clock.expired || elevatorState.error) return;
    elevatorBusyRef.current = true;
    try {
      await reserveChunkLineUpElevatorSeat(roomId, session.roundId);
    } catch (reason: unknown) {
      console.error(reason);
    } finally {
      elevatorBusyRef.current = false;
    }
  };

  const confirm = async (groupId: string, slotId: string): Promise<void> => {
    if (busyRef.current || clock.expired) return;
    const current = boardState.value;
    const own = current?.assignments[player.id];
    if (!current || !own) return;
    busyRef.current = true;
    setFeedback(null);
    try {
      const result = await confirmChunkLineUpSlot({
        roomId,
        roundId: session.roundId,
        operationId: crypto.randomUUID(),
        revision: current.revision,
        groupId,
        slotId,
      });
      if (result.accepted) {
        playCorrectChime();
        controllerRef.current?.acceptSlot(result.completedGroup);
        return;
      }
      if (result.reason === "wrong") {
        setFeedback("wrong");
        controllerRef.current?.rejectSlot();
      } else if (result.reason === "stale") {
        setFeedback("stale");
      }
    } catch (reason: unknown) {
      console.error(reason);
      setFeedback("stale");
    } finally {
      busyRef.current = false;
      window.setTimeout(() => setFeedback(null), 650);
    }
  };

  return <div className={styles.studentShell}>
    <ChunkLineUpCanvas
      ref={controllerRef}
      role="student"
      roomId={roomId}
      roundId={session.roundId}
      playerId={player.id}
      label={label}
      board={board}
      elevatorState={elevatorState.value}
      startedAtMs={session.startedAtMs}
      onConfirm={(groupId, slotId) => void confirm(groupId, slotId)}
      onReserveElevator={() => void reserveElevator()}
    />
    <div className={styles.studentHud}>
      <div className={styles.tokenHud}><small>내 청크</small><strong>{assignment.token}</strong></div>
      <div className={styles.scoreHud}><small>점수</small><strong>{assignment.score}</strong></div>
      <TimedGameStatus session={session} compact />
    </div>
    <div className={styles.controlsHint}>← → / A D 이동 · ↑ / W / Space 점프 · S / ↓ / Enter 슬롯 확정</div>
    {feedback ? <div className={feedback === "wrong" ? styles.wrongFeedback : styles.staleFeedback}>
      {feedback === "wrong" ? "여긴 아니에요!" : "다른 친구가 먼저 채웠어요. 새 청크를 확인하세요."}
    </div> : null}
    {elevatorState.error ? <div className={styles.elevatorError}>엘리베이터 연결 오류 · 발판 이용</div> : null}
    {clock.expired ? <div className={styles.expiredBadge}>시간 종료</div> : null}
  </div>;
}
