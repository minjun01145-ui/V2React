import { useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { playCorrectChime } from "../../game-engine/effects/sound.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { useChunkLineUpBoard, useChunkLineUpElevator } from "../../multiplayer/chunk-line-up/hooks.ts";
import {
  confirmChunkLineUpSlot,
  reserveChunkLineUpElevatorSeat,
  setChunkLineUpElevatorDestination,
} from "../../multiplayer/chunk-line-up/repository.ts";
import type {
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRideInfo,
  ChunkLineUpElevatorState,
} from "../../multiplayer/chunk-line-up/types.ts";
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
  const [feedback, setFeedback] = useState<"wrong" | "stale" | "connection" | null>(null);
  const [localElevatorState, setLocalElevatorState] = useState<ChunkLineUpElevatorState | null>(null);
  const [elevatorRide, setElevatorRide] = useState<ChunkLineUpElevatorRideInfo | null>(null);
  const [destinationBusy, setDestinationBusy] = useState(false);
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

  const reserveElevator = async (elevatorId: ChunkLineUpElevatorId, floor: number): Promise<void> => {
    if (elevatorBusyRef.current || clock.expired || elevatorState.error) return;
    elevatorBusyRef.current = true;
    try {
      const result = await reserveChunkLineUpElevatorSeat(roomId, session.roundId, elevatorId, floor);
      setLocalElevatorState(result.state);
    } catch (reason: unknown) {
      console.error(reason);
      setFeedback("connection");
      window.setTimeout(() => setFeedback(null), 900);
    } finally {
      elevatorBusyRef.current = false;
    }
  };

  const chooseDestination = async (destinationFloor: number, destinationGroupId: string): Promise<void> => {
    if (!elevatorRide || destinationBusy || clock.expired) return;
    setDestinationBusy(true);
    try {
      const result = await setChunkLineUpElevatorDestination(
        roomId,
        session.roundId,
        elevatorRide.elevatorId,
        destinationFloor,
        destinationGroupId,
      );
      setLocalElevatorState(result.state);
      if (!result.accepted) setFeedback("stale");
    } catch (reason: unknown) {
      console.error(reason);
      setFeedback("connection");
    } finally {
      setDestinationBusy(false);
      window.setTimeout(() => setFeedback(null), 900);
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
      setFeedback("connection");
    } finally {
      busyRef.current = false;
      window.setTimeout(() => setFeedback(null), 650);
    }
  };

  const remoteElevatorState = elevatorState.value;
  const effectiveElevatorState = localElevatorState && (!remoteElevatorState || localElevatorState.revision > remoteElevatorState.revision)
    ? localElevatorState
    : remoteElevatorState;
  const destinationChoices = board.groups
    .map((group, floor) => ({ floor, groupId: group.id, prompt: group.prompt, open: group.slots.some((slot) => !slot.fixed && !slot.filledBy) }))
    .filter((choice) => choice.open && choice.floor !== elevatorRide?.currentFloor);

  return <div className={styles.studentShell}>
    <ChunkLineUpCanvas
      ref={controllerRef}
      role="student"
      roomId={roomId}
      roundId={session.roundId}
      playerId={player.id}
      label={label}
      board={board}
      elevatorState={effectiveElevatorState}
      onConfirm={(groupId, slotId) => void confirm(groupId, slotId)}
      onReserveElevator={(elevatorId, floor) => void reserveElevator(elevatorId, floor)}
      onElevatorRideChange={setElevatorRide}
    />
    <div className={styles.studentHud}>
      <div className={styles.tokenHud}><small>내 청크</small><strong>{assignment.token}</strong></div>
      <div className={styles.scoreHud}><small>점수</small><strong>{assignment.score}</strong></div>
      <TimedGameStatus session={session} compact />
    </div>
    <div className={styles.controlsHint}>← → / A D 이동 · ↑ / W / Space 점프 · S / ↓ / Enter 슬롯 확정</div>
    {elevatorRide && elevatorRide.destinationFloor === null ? <div className={styles.elevatorDestination}>
      <strong>어디로 갈까요?</strong>
      <span>{elevatorRide.elevatorId === "left" ? "왼쪽" : "오른쪽"} 엘리베이터 · 문장 선택</span>
      <div>
        {destinationChoices.map((choice) => <button
          key={choice.floor}
          type="button"
          disabled={destinationBusy}
          onClick={() => void chooseDestination(choice.floor, choice.groupId)}
        >{choice.prompt.replaceAll("/", " ")}</button>)}
      </div>
    </div> : null}
    {feedback ? <div className={feedback === "wrong" ? styles.wrongFeedback : styles.staleFeedback}>
      {feedback === "wrong"
        ? "여긴 아니에요!"
        : feedback === "connection"
          ? "서버 연결 오류 · 잠시 후 다시 시도하세요."
          : "게임판이 바뀌었어요. 새 청크를 확인하세요."}
    </div> : null}
    {elevatorState.error ? <div className={styles.elevatorError}>엘리베이터 연결 오류 · 발판 이용</div> : null}
    {clock.expired ? <div className={styles.expiredBadge}>시간 종료</div> : null}
  </div>;
}
