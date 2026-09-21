import Phaser from "phaser";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import { createLiveMovementEngine, createLiveMovementObserver } from "../../live-world/client.ts";
import { CHUNK_JUMP_CHANNEL_ID } from "./model.ts";
import ChunkJumpRaceScene, { chunkJumpDistanceFromX, chunkJumpLandedState } from "./ChunkJumpRaceScene.ts";
import styles from "./ChunkJumpRace.module.css";

export interface ChunkJumpStanding {
  readonly playerId: string;
  readonly label: string;
  readonly x: number;
  readonly distance: number;
}

export interface ChunkJumpRaceController {
  readonly jumpForward: () => boolean;
  readonly fallBack: (targetDistance: number) => boolean;
}

interface CommonProps {
  readonly roomId: string;
  readonly roundId: string;
  readonly labels: ReadonlyMap<string, string>;
  readonly onSettled?: (kind: "correct" | "wrong", distance: number) => void;
  readonly onStandings?: (standings: readonly ChunkJumpStanding[]) => void;
}

type Props = CommonProps & (
  | { readonly role: "student"; readonly playerId: string; readonly label: string; readonly initialDistance: number }
  | { readonly role: "teacher"; readonly playerId?: never; readonly label?: never }
);

function standingsFromFrames(
  frames: readonly LiveRemoteFrame[],
  labels: ReadonlyMap<string, string>,
  local: { readonly playerId: string; readonly label: string; readonly state: LiveMovementState } | null,
): readonly ChunkJumpStanding[] {
  const rows: ChunkJumpStanding[] = frames.flatMap((frame) => {
    const label = labels.get(frame.playerId);
    return label ? [{ playerId: frame.playerId, label, x: frame.x, distance: chunkJumpDistanceFromX(frame.x) }] : [];
  });
  if (local) rows.push({ playerId: local.playerId, label: local.label, x: local.state.x, distance: chunkJumpDistanceFromX(local.state.x) });
  return rows.sort((left, right) => right.x - left.x || left.label.localeCompare(right.label));
}

const ChunkJumpRaceCanvas = forwardRef<ChunkJumpRaceController, Props>(function ChunkJumpRaceCanvas(props, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ChunkJumpRaceScene | null>(null);
  const labelsRef = useRef(props.labels);
  const settledRef = useRef(props.onSettled);
  const standingsRef = useRef(props.onStandings);
  const initialDistance = props.role === "student" ? props.initialDistance : 0;
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  labelsRef.current = props.labels;
  settledRef.current = props.onSettled;
  standingsRef.current = props.onStandings;

  useImperativeHandle(ref, () => ({
    jumpForward: () => sceneRef.current?.jumpForward() ?? false,
    fallBack: (targetDistance) => sceneRef.current?.fallBack(targetDistance) ?? false,
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    setConnectionError(null);
    let active = true;
    let samplePlayers: () => readonly LiveRemoteFrame[] = () => [];
    let publish: (state: LiveMovementState) => void = () => undefined;
    let closeLive: () => Promise<void> = async () => undefined;

    const onError = (error: Error): void => { if (active) setConnectionError(error); };
    if (props.role === "student") {
      const live = createLiveMovementEngine(props.playerId, { sendHz: 10, onError });
      samplePlayers = () => live.sampleRemotePlayers();
      publish = (state) => live.updateLocal(state);
      closeLive = () => live.close();
      void live.connect(
        { roomId: props.roomId, roundId: props.roundId, channelId: CHUNK_JUMP_CHANNEL_ID },
        chunkJumpLandedState(initialDistance),
      ).catch((reason: unknown) => onError(reason instanceof Error ? reason : new Error("실시간 레이스 연결에 실패했습니다.")));
    } else {
      const live = createLiveMovementObserver({ onError });
      samplePlayers = () => live.samplePlayers();
      closeLive = () => live.close();
      void live.connect({ roomId: props.roomId, roundId: props.roundId, channelId: CHUNK_JUMP_CHANNEL_ID })
        .catch((reason: unknown) => onError(reason instanceof Error ? reason : new Error("실시간 레이스 중계 연결에 실패했습니다.")));
    }

    const scene = new ChunkJumpRaceScene({
      mode: props.role,
      ...(props.role === "student" ? { localPlayer: { id: props.playerId, label: props.label } } : {}),
      ...(props.role === "student" ? { initialDistance } : {}),
      publish,
      samplePlayers,
      playerLabel: (playerId) => labelsRef.current.get(playerId),
      onSettled: (kind, distance) => settledRef.current?.(kind, distance),
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: host.clientHeight > 0 ? Math.round(420 * host.clientWidth / host.clientHeight) : 960,
      height: 420,
      backgroundColor: "#dff6ff",
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false },
      input: { keyboard: false },
      audio: { noAudio: true },
      scene,
    });
    const resize = new ResizeObserver(() => {
      if (game.isBooted && host.clientHeight > 0) game.scale.resize(Math.round(420 * host.clientWidth / host.clientHeight), 420);
    });
    resize.observe(host);

    const rankingTimer = window.setInterval(() => {
      const localState = props.role === "student" ? scene.getLocalState() : null;
      standingsRef.current?.(standingsFromFrames(
        samplePlayers(),
        labelsRef.current,
        props.role === "student" && localState ? { playerId: props.playerId, label: props.label, state: localState } : null,
      ));
    }, 250);

    return () => {
      active = false;
      window.clearInterval(rankingTimer);
      resize.disconnect();
      sceneRef.current = null;
      game.destroy(true);
      void closeLive();
    };
  }, [initialDistance, props.label, props.playerId, props.role, props.roomId, props.roundId]);

  return <div className={styles.canvasWrap}>
    {connectionError ? <div className={styles.connectionError}>실시간 연결 오류: {connectionError.message}</div> : null}
    <div ref={hostRef} className={`${styles.canvasHost} ${props.role === "student" ? styles.studentCanvasHost : styles.teacherCanvasHost}`} />
  </div>;
});

export default ChunkJumpRaceCanvas;
