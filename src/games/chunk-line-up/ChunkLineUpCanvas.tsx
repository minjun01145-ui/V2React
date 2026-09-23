import Phaser from "phaser";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from "react";
import { movementAction } from "../../game-engine/input/movementKeys.ts";
import { clearPlatformerInput, createPlatformerInput } from "../../game-engine/platformer/movement.ts";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import {
  createLiveMovementEngine,
  createLiveMovementObserver,
  subscribeLiveServerTimeOffset,
} from "../../live-world/client.ts";
import type {
  ChunkLineUpBoard,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRideInfo,
  ChunkLineUpElevatorState,
} from "../../multiplayer/chunk-line-up/types.ts";
import { createChunkLineUpElevatorState } from "./elevatorModel.ts";
import {
  CHUNK_LINE_UP_CHANNEL_ID,
  CHUNK_LINE_UP_WORLD_HEIGHT,
  CHUNK_LINE_UP_WORLD_WIDTH,
} from "./model.ts";
import ChunkLineUpScene from "./ChunkLineUpScene.ts";
import styles from "./ChunkLineUp.module.css";

export interface ChunkLineUpController {
  readonly rejectSlot: () => void;
  readonly acceptSlot: (completedGroup: boolean) => void;
  readonly predictElevatorRide: (
    elevatorId: ChunkLineUpElevatorId,
    floor: number,
    destinationFloor: number,
  ) => ChunkLineUpElevatorState | null;
  readonly releaseElevatorApproach: () => void;
  readonly dismissElevatorApproach: () => void;
}

interface CommonProps {
  readonly roomId: string;
  readonly roundId: string;
  readonly board: ChunkLineUpBoard;
  readonly elevatorState: ChunkLineUpElevatorState | null;
  readonly onConfirm?: (groupId: string, slotId: string) => void;
}

type Props = CommonProps & (
  | {
      readonly role: "student";
      readonly playerId: string;
      readonly label: string;
      readonly onElevatorApproach: (elevatorId: ChunkLineUpElevatorId, floor: number) => void;
      readonly onElevatorRideChange: (ride: ChunkLineUpElevatorRideInfo | null) => void;
    }
  | {
      readonly role: "teacher";
      readonly playerId?: never;
      readonly label?: never;
      readonly onElevatorApproach?: never;
      readonly onElevatorRideChange?: never;
    }
);

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

const ChunkLineUpCanvas = forwardRef<ChunkLineUpController, Props>(function ChunkLineUpCanvas(props, ref) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ChunkLineUpScene | null>(null);
  const inputRef = useRef(createPlatformerInput());
  const boardRef = useRef(props.board);
  const elevatorRef = useRef(props.elevatorState);
  const confirmRef = useRef(props.onConfirm);
  const elevatorApproachRef = useRef(props.role === "student" ? props.onElevatorApproach : undefined);
  const elevatorRideChangeRef = useRef(props.role === "student" ? props.onElevatorRideChange : undefined);
  const serverOffsetRef = useRef(0);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  boardRef.current = props.board;
  elevatorRef.current = props.elevatorState;
  confirmRef.current = props.onConfirm;
  elevatorApproachRef.current = props.role === "student" ? props.onElevatorApproach : undefined;
  elevatorRideChangeRef.current = props.role === "student" ? props.onElevatorRideChange : undefined;

  useImperativeHandle(ref, () => ({
    rejectSlot: () => sceneRef.current?.showWrong(),
    acceptSlot: (completedGroup) => sceneRef.current?.showCorrect(completedGroup),
    predictElevatorRide: (elevatorId, floor, destinationFloor) => {
      const scene = sceneRef.current;
      const current = elevatorRef.current ?? createChunkLineUpElevatorState(boardRef.current.groups.length, Date.now() + serverOffsetRef.current);
      return scene?.predictElevatorRide(current, elevatorId, floor, destinationFloor) ?? null;
    },
    releaseElevatorApproach: () => sceneRef.current?.releaseElevatorApproach(),
    dismissElevatorApproach: () => sceneRef.current?.dismissElevatorApproach(),
  }), []);

  useEffect(() => {
    sceneRef.current?.setBoard(props.board);
  }, [props.board]);

  useEffect(() => {
    if (props.role !== "student") return undefined;
    shellRef.current?.focus({ preventScroll: true });
    const input = inputRef.current;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      if (event.code === "KeyR") {
        event.preventDefault();
        if (!event.repeat) input.resetQueued = true;
        return;
      }
      if (event.code === "Enter" || event.code === "KeyS" || event.code === "ArrowDown") {
        event.preventDefault();
        if (!event.repeat) sceneRef.current?.confirmNearestSlot();
        return;
      }
      const action = movementAction(event.code, event.key);
      if (!action) return;
      event.preventDefault();
      if (action === "jump") {
        if (!event.repeat) input.jumpQueued = true;
        return;
      }
      input.held.set(event.code || event.key, action);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      input.held.delete(event.code || event.key);
    };
    const clear = (): void => clearPlatformerInput(input);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      clear();
    };
  }, [props.role]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let active = true;
    let samplePlayers: () => readonly LiveRemoteFrame[] = () => [];
    let publish: (state: LiveMovementState) => void = () => undefined;
    let closeLive: () => Promise<void> = async () => undefined;
    setConnectionError(null);
    const onError = (error: Error): void => { if (active) setConnectionError(error); };
    const unsubscribeClock = subscribeLiveServerTimeOffset(
      (offsetMs) => { serverOffsetRef.current = offsetMs; },
      onError,
    );
    const initialState: LiveMovementState = {
      x: CHUNK_LINE_UP_WORLD_WIDTH * 0.62,
      y: 34,
      vx: 0,
      vy: 0,
    };

    if (props.role === "student") {
      const live = createLiveMovementEngine(props.playerId, { sendHz: 10, onError });
      samplePlayers = () => live.sampleRemotePlayers();
      publish = (state) => live.updateLocal(state);
      closeLive = () => live.close();
      void live.connect(
        { roomId: props.roomId, roundId: props.roundId, channelId: CHUNK_LINE_UP_CHANNEL_ID },
        initialState,
      ).catch((reason: unknown) => onError(reason instanceof Error ? reason : new Error("실시간 이동 연결에 실패했습니다.")));
    } else {
      const live = createLiveMovementObserver({ onError });
      samplePlayers = () => live.samplePlayers();
      closeLive = () => live.close();
      void live.connect({ roomId: props.roomId, roundId: props.roundId, channelId: CHUNK_LINE_UP_CHANNEL_ID })
        .catch((reason: unknown) => onError(reason instanceof Error ? reason : new Error("실시간 중계 연결에 실패했습니다.")));
    }

    const scene = new ChunkLineUpScene({
      mode: props.role,
      ...(props.role === "student" ? {
        input: inputRef.current,
        localPlayer: { id: props.playerId, label: props.label },
        initialState,
      } : {}),
      publish,
      samplePlayers,
      playerLabel: (playerId) => boardRef.current.assignments[playerId]?.label,
      playerToken: (playerId) => boardRef.current.assignments[playerId]?.token,
      onConfirm: (groupId, slotId) => confirmRef.current?.(groupId, slotId),
      elevatorState: () => elevatorRef.current,
      nowMs: () => Date.now() + serverOffsetRef.current,
      onElevatorApproach: (elevatorId, floor) => elevatorApproachRef.current?.(elevatorId, floor),
      onElevatorRideChange: (ride) => elevatorRideChangeRef.current?.(ride),
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: CHUNK_LINE_UP_WORLD_WIDTH,
      height: CHUNK_LINE_UP_WORLD_HEIGHT,
      backgroundColor: "#dff4f7",
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 1450 }, debug: false },
      },
      scale: { mode: Phaser.Scale.RESIZE },
      render: { antialias: true, pixelArt: false },
      input: { keyboard: false },
      audio: { noAudio: true },
      scene,
    });
    scene.setBoard(boardRef.current);

    return () => {
      active = false;
      unsubscribeClock();
      clearPlatformerInput(inputRef.current);
      sceneRef.current = null;
      game.destroy(true);
      void closeLive();
    };
  }, [props.label, props.playerId, props.role, props.roomId, props.roundId]);

  const press = (event: PointerEvent<HTMLButtonElement>, action: "left" | "right" | "jump" | "confirm"): void => {
    if (props.role !== "student") return;
    event.preventDefault();
    shellRef.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (action === "confirm") {
      sceneRef.current?.confirmNearestSlot();
      return;
    }
    if (action === "jump") inputRef.current.jumpQueued = true;
    else inputRef.current.held.set(`pointer-${event.pointerId}`, action);
  };
  const release = (event: PointerEvent<HTMLButtonElement>): void => {
    inputRef.current.held.delete(`pointer-${event.pointerId}`);
  };

  return <div
    ref={shellRef}
    className={styles.canvasWrap}
    tabIndex={props.role === "student" ? 0 : undefined}
    onBlur={(event) => {
      if (props.role === "student" && !event.currentTarget.contains(event.relatedTarget)) clearPlatformerInput(inputRef.current);
    }}
  >
    {connectionError ? <div className={styles.connectionError}>실시간 연결 오류: {connectionError.message}</div> : null}
    <div ref={hostRef} className={styles.canvasHost} onPointerDown={() => shellRef.current?.focus({ preventScroll: true })} />
    {props.role === "student" ? <div className={styles.touchControls} aria-label="Chunk Line-Up 조작">
      {(["left", "right", "jump", "confirm"] as const).map((action) => <button
        type="button"
        key={action}
        aria-label={action}
        onPointerDown={(event) => press(event, action)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >{action === "left" ? "←" : action === "right" ? "→" : action === "jump" ? "↑" : "확정"}</button>)}
    </div> : null}
  </div>;
});

export default ChunkLineUpCanvas;
