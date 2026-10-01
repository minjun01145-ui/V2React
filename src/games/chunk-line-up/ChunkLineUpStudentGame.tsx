import { useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { playCorrectChime } from "../../game-engine/effects/sound.ts";
import { FullscreenToggle, ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { TimedResultsOverlay } from "../../game-engine/timed-game/TimedResultsOverlay.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { useChunkLineUpBoard, useChunkLineUpElevator } from "../../multiplayer/chunk-line-up/hooks.ts";
import {
  boardChunkLineUpElevatorRide,
  confirmChunkLineUpSlot,
} from "../../multiplayer/chunk-line-up/repository.ts";
import type {
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRideInfo,
  ChunkLineUpElevatorState,
} from "../../multiplayer/chunk-line-up/types.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import ChunkLineUpCanvas, { type ChunkLineUpController } from "./ChunkLineUpCanvas.tsx";
import BuffHud from "../../game-engine/platformer-party/BuffHud.tsx";
import ChunkLineUpFloorGuide from "./ChunkLineUpFloorGuide.tsx";
import type { ActiveBuff } from "../../game-engine/platformer-party/buffs.ts";
import { chunkLineUpFloorLabel } from "./layout.ts";
import { chunkLineUpRanking } from "./model.ts";
import styles from "./ChunkLineUp.module.css";

export default function ChunkLineUpStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const boardState = useChunkLineUpBoard(roomId, session.roundId, session.expectedPlayerIds[0] === player.id);
  const elevatorState = useChunkLineUpElevator(roomId, session.roundId);
  const controllerRef = useRef<ChunkLineUpController | null>(null);
  const busyRef = useRef(false);
  const [feedback, setFeedback] = useState<"wrong" | "stale" | "connection" | "checking" | "expired" | null>(null);
  const [buffs, setBuffs] = useState<readonly ActiveBuff[]>([]);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [localElevatorState, setLocalElevatorState] = useState<ChunkLineUpElevatorState | null>(null);
  const [elevatorRide, setElevatorRide] = useState<ChunkLineUpElevatorRideInfo | null>(null);
  const [destinationBusy, setDestinationBusy] = useState(false);
  const [currentFloor, setCurrentFloor] = useState(-1);
  const clock = useTimedGameClock(session);

  if (!session.expectedPlayerIds.includes(player.id)) {
    return <StatusPanel title="다음 게임을 기다려 주세요" tone="waiting">이미 시작된 끊어읽기 줄 세우기에는 중간 참가할 수 없습니다.</StatusPanel>;
  }
  if (boardState.error) return <StatusPanel title="끊어읽기 줄 세우기 연결 오류" tone="error">{boardState.error.message}</StatusPanel>;
  if (boardState.loading || !boardState.value) return <StatusPanel title="끊어읽기 줄 세우기 준비 중">학생 수에 맞춰 문장과 청크를 배정하고 있습니다.</StatusPanel>;

  const board = boardState.value;
  const assignment = board.assignments[player.id];
  if (!assignment) return <StatusPanel title="청크 배정 대기 중" tone="waiting">현재 청크를 배정하고 있습니다.</StatusPanel>;
  const label = displayLabel(player.displayName, player.nickname);
  const cardState = assignment.token ? "carrying" : assignment.attachedGroupId ? "attached" : "waiting";

  const chooseDestination = async (destinationFloor: number, destinationGroupId: string): Promise<void> => {
    if (!elevatorRide || destinationBusy || clock.expired) return;
    setDestinationBusy(true);
    const ride = elevatorRide;
    const predicted = controllerRef.current?.predictElevatorRide(ride.elevatorId, ride.currentFloor, destinationFloor);
    if (predicted) setLocalElevatorState(predicted);
    try {
      const result = await boardChunkLineUpElevatorRide(
        roomId,
        session.roundId,
        ride.elevatorId,
        ride.currentFloor,
        destinationFloor,
        destinationGroupId,
      );
      if (result.accepted) {
        setLocalElevatorState(result.state);
      } else {
        setLocalElevatorState(null);
        setElevatorRide(null);
        controllerRef.current?.releaseElevatorApproach();
        setFeedback("stale");
      }
    } catch (reason: unknown) {
      console.error(reason);
      setLocalElevatorState(null);
      setElevatorRide(null);
      controllerRef.current?.releaseElevatorApproach();
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
    setFeedback("checking");
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
        setFeedback(null);
        playCorrectChime();
        controllerRef.current?.acceptSlot(result.completedGroup);
        return;
      }
      if (result.reason === "wrong") {
        setFeedback("wrong");
        controllerRef.current?.rejectSlot();
      } else {
        // "stale" and "expired" both need visible feedback; a silent no-op felt like a broken key.
        setFeedback(result.reason);
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
    || (destinationBusy && localElevatorState)
    ? localElevatorState
    : remoteElevatorState;
  const destinationChoices = board.groups
    .map((group, floor) => ({ floor, groupId: group.id, prompt: group.prompt, open: group.slots.some((slot) => !slot.fixed && !slot.filledBy) }))
    .filter((choice) => choice.open && choice.floor !== elevatorRide?.currentFloor);

  return <ImmersiveStage><div className={styles.studentShell} ref={shellRef}>
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
      onElevatorApproach={(elevatorId, floor) => setElevatorRide({ elevatorId, currentFloor: floor, destinationFloor: null, boarded: false })}
      onElevatorRideChange={setElevatorRide}
      onFloorChange={setCurrentFloor}
      onBuffsChange={setBuffs}
      frozen={clock.expired}
    />
    <BuffHud buffs={buffs} />
    <ChunkLineUpFloorGuide board={board} currentFloor={currentFloor} />
    <div className={styles.studentHud}>
      <div className={styles.tokenHud} data-state={cardState}>
        <small>{cardState === "carrying" ? "내 청크" : cardState === "attached" ? "놓기 성공!" : "카드 대기"}</small>
        <strong>{cardState === "carrying"
          ? assignment.token
          : cardState === "attached"
            ? "문장이 완성되면 새 카드!"
            : "친구들이 문장을 완성하면 받아요"}</strong>
      </div>
      <div className={styles.scoreHud}><small>점수</small><strong>{assignment.score}</strong></div>
      <TimedGameStatus session={session} compact />
      <FullscreenToggle target={shellRef} className={styles.fullscreenButton} />
    </div>
    <div className={styles.controlsHint}>
      <kbd>← →</kbd> 이동 <kbd>↑</kbd> 점프(2단) <kbd>Space</kbd> 펀치 <kbd>↓</kbd> 놓기 · 엘리베이터 부르기 <kbd>R</kbd> 로비로
    </div>
    {elevatorRide && elevatorRide.destinationFloor === null ? <div className={styles.elevatorDestination}>
      <strong>몇 층으로 갈까요?</strong>
      <span>{elevatorRide.elevatorId === "left" ? "왼쪽" : "오른쪽"} 엘리베이터 · 빈칸이 남은 층</span>
      <div>
        {destinationChoices.map((choice) => <button
          key={choice.floor}
          type="button"
          disabled={destinationBusy}
          onClick={() => void chooseDestination(choice.floor, choice.groupId)}
        ><b>{chunkLineUpFloorLabel(choice.floor, board.groups.length)}</b> {choice.prompt.replaceAll("/", " ")}</button>)}
      </div>
      <button type="button" className={styles.elevatorCancel} onClick={() => {
        controllerRef.current?.releaseElevatorApproach();
        setElevatorRide(null);
      }}>닫기</button>
    </div> : null}
    {destinationBusy ? <div className={styles.elevatorPending}>목적지 확인 중 · 잠시만 기다려 주세요</div> : null}
    {!destinationBusy && elevatorRide && elevatorRide.destinationFloor !== null && !elevatorRide.boarded
      ? <div className={styles.elevatorPending}>
        엘리베이터가 오고 있어요 · 문 앞에서 기다리세요 → {chunkLineUpFloorLabel(elevatorRide.destinationFloor, board.groups.length)}
      </div>
      : null}
    {feedback ? <div className={feedback === "wrong" ? styles.wrongFeedback : feedback === "checking" ? styles.checkingFeedback : styles.staleFeedback}>
      {feedback === "wrong"
        ? "여긴 아니에요!"
        : feedback === "checking"
          ? "슬롯 확인 중…"
        : feedback === "connection"
          ? "서버 연결 오류 · 잠시 후 다시 시도하세요."
        : feedback === "expired"
          ? "시간이 끝났어요."
          : "게임판이 바뀌었어요. 새 청크를 확인하세요."}
    </div> : null}
    {elevatorState.error ? <div className={styles.elevatorError}>엘리베이터 연결 오류 · 발판 이용</div> : null}
    {clock.expired ? <TimedResultsOverlay
      title="끊어읽기 줄 세우기 결과"
      unit="점"
      entries={chunkLineUpRanking(board).map((entry) => ({ id: entry.playerId, label: entry.label, value: entry.score }))}
      selfId={player.id}
    /> : null}
  </div></ImmersiveStage>;
}
