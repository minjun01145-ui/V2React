import Phaser from "phaser";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { hashString } from "../core/random.ts";
import { movementAction } from "../input/movementKeys.ts";
import { resizeScaleConfig } from "../phaser-kit/scaleConfig.ts";
import { clearPlatformerInput, createPlatformerInput } from "../platformer/movement.ts";
import BuffHud from "../platformer-party/BuffHud.tsx";
import type { ActiveBuff } from "../platformer-party/buffs.ts";
import { FullscreenToggle } from "../stage/ImmersiveStage.tsx";
import {
  createLiveClaims,
  createLiveEventChannel,
  createLiveMovementEngine,
  createLiveMovementObserver,
  observeLiveRecords,
  createLiveRecords,
  subscribeLiveServerTimeOffset,
  type LiveRecord,
} from "../../live-world/client.ts";
import { displayLabel, type Player } from "../../multiplayer/types.ts";
import ClimbScene, { type ClimbStanding } from "./ClimbScene.ts";
import { CLIMB_GRAVITY, CLIMB_PLAYER_HEIGHT, CLIMB_WORLD_WIDTH, climbFloorAt, type ClimbCourseSource } from "./course.ts";
import styles from "./JumpTowerGame.module.css";

const LOBBY_SCOPE_ID = "lobby";
const RECORDS_CHANNEL_ID = "climb-records";
const RECORD_BOARD_SIZE = 5;

interface Props {
  readonly roundId?: string;
  readonly channelId?: string;
  readonly seed?: string;
  readonly courseSource?: ClimbCourseSource;
  readonly rules?: import("./ClimbScene.ts").ClimbSceneOptions["rules"];
  readonly initialState?: import("../../live-world/core/types.ts").LiveMovementState;
  readonly initialBest?: number;
  readonly observer?: boolean;
  readonly children?: ReactNode;
  readonly onRecords?: (records: readonly LiveRecord[]) => void;
  readonly onHeight?: (floor: number, best: number) => void;
  readonly roomId: string;
  readonly playerId: string;
  readonly label: string;
  readonly players: readonly Pick<Player, "id" | "displayName" | "nickname">[];
  readonly onExit?: () => void;
}

const TOUCH_ACTIONS = [
  { action: "left", label: "왼쪽", text: "◀" },
  { action: "right", label: "오른쪽", text: "▶" },
  { action: "punch", label: "펀치", text: "✊" },
  { action: "drop", label: "내려가기", text: "▼" },
  { action: "jump", label: "점프", text: "점프" },
] as const;
type TouchAction = (typeof TOUCH_ACTIONS)[number]["action"];

const PUNCH_KEYS = new Set(["Space", "KeyF", "KeyJ"]);
const DROP_KEYS = new Set(["ArrowDown", "KeyS"]);

/** Buttons are not typing targets: after clicking one, game keys must keep working. */
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/** Movement, punches and item claims live in a channel per day so old claims never pile up. */
function dailyChannelId(): string {
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `climb-${day}`;
}

export default function JumpTowerGame({ roomId, playerId, label, players, onExit, roundId, channelId, seed, courseSource, rules, initialState: savedState, initialBest = 0, observer = false, children, onRecords, onHeight }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ClimbScene | null>(null);
  const callbacksRef = useRef({ onRecords, onHeight, rules });
  callbacksRef.current = { onRecords, onHeight, rules };
  const inputRef = useRef(createPlatformerInput());
  const labelsRef = useRef(new Map<string, string>());
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [height, setHeight] = useState({ floor: savedState ? climbFloorAt(savedState.y + CLIMB_PLAYER_HEIGHT / 2) : 0, best: initialBest });
  const [standings, setStandings] = useState<readonly ClimbStanding[]>([]);
  const [buffs, setBuffs] = useState<readonly ActiveBuff[]>([]);
  const [records, setRecords] = useState<readonly LiveRecord[]>([]);
  const [ownRecord, setOwnRecord] = useState(0);

  labelsRef.current = new Map(players.map((player) => [player.id, displayLabel(player.displayName, player.nickname)]));

  useEffect(() => {
    if (observer) return;
    stageRef.current?.focus({ preventScroll: true });
    const input = inputRef.current;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      if (event.code === "KeyR") {
        event.preventDefault();
        if (!event.repeat) input.resetQueued = true;
        return;
      }
      if (PUNCH_KEYS.has(event.code)) {
        event.preventDefault();
        if (!event.repeat) sceneRef.current?.punch();
        return;
      }
      if (DROP_KEYS.has(event.code)) {
        event.preventDefault();
        if (!event.repeat) sceneRef.current?.dropDown();
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
    const onKeyUp = (event: KeyboardEvent): void => { input.held.delete(event.code || event.key); };
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
  }, [observer]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    setConnectionError(null);
    let active = true;
    const onError = (error: Error): void => { if (active) setConnectionError(error); };
    let serverOffsetMs = 0;
    const unsubscribeClock = subscribeLiveServerTimeOffset((offset) => { serverOffsetMs = offset; }, onError);
    const scope = { roomId, roundId: roundId ?? LOBBY_SCOPE_ID, channelId: channelId ?? dailyChannelId() };
    const spread = (hashString(playerId) % 400) - 200;
    const initialState = savedState ?? { x: CLIMB_WORLD_WIDTH / 2 + spread, y: -CLIMB_PLAYER_HEIGHT / 2, vx: 0, vy: 0 };

    const movement = observer ? null : createLiveMovementEngine(playerId, { sendHz: 10, onError });
    const watching = observer ? createLiveMovementObserver({ onError }) : null;
    const events = createLiveEventChannel(scope, observer ? null : playerId, (event) => sceneRef.current?.receiveEvent(event), onError);
    const claims = createLiveClaims(scope, observer ? null : playerId, (claim) => sceneRef.current?.receiveClaim(claim), onError);
    // All-time bests persist per room, unlike the daily live channel above.
    const recordScope = { roomId, roundId: roundId ?? LOBBY_SCOPE_ID, channelId: channelId ? `${channelId}-records` : RECORDS_CHANNEL_ID };
    const reportRecords = (next: readonly LiveRecord[]): void => { setRecords(next); callbacksRef.current.onRecords?.(next); };
    const stopRecords = observer ? observeLiveRecords(recordScope, Math.max(1, players.length), reportRecords, onError) : null;
    const records = observer ? null : createLiveRecords(
      recordScope,
      playerId,
      roundId ? Math.max(1, players.length) : RECORD_BOARD_SIZE,
      reportRecords,
      setOwnRecord,
      onError,
    );
    const scene = new ClimbScene({
      seed: seed ?? roomId,
      mode: observer ? "teacher" : "student",
      courseSource,
      rules: rules ? {
        canLand: (platform) => callbacksRef.current.rules!.canLand(platform),
        onLand: (platform) => callbacksRef.current.rules!.onLand(platform),
        answerFloor: () => callbacksRef.current.rules!.answerFloor?.() ?? null,
        respawnState: () => callbacksRef.current.rules!.respawnState(),
        onDeath: (dead) => callbacksRef.current.rules!.onDeath(dead),
        isActive: () => callbacksRef.current.rules!.isActive(),
        onReset: () => callbacksRef.current.rules!.onReset(),
      } : undefined,
      input: inputRef.current,
      localPlayer: { id: playerId, label },
      initialState,
      initialBest,
      nowMs: () => Date.now() + serverOffsetMs,
      publish: (state) => movement?.updateLocal(state),
      samplePlayers: () => movement?.sampleRemotePlayers() ?? watching?.samplePlayers() ?? [],
      playerLabel: (id) => labelsRef.current.get(id),
      publishEvent: (kind, target, value) => events.publish(kind, target, value),
      claimItem: (id) => claims.claim(id),
      onBuffsChange: setBuffs,
      onHeight: (floor, best) => {
        setHeight({ floor, best });
        records?.submit(best, label);
        callbacksRef.current.onHeight?.(floor, best);
      },
      onStandings: setStandings,
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: host.clientWidth || 960,
      height: host.clientHeight || 620,
      backgroundColor: "#8fd3ff",
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: CLIMB_GRAVITY }, debug: false } },
      scale: resizeScaleConfig(),
      render: { antialias: true, pixelArt: false },
      input: { keyboard: false },
      audio: { noAudio: true },
      scene,
    });
    if (roundId) records?.submit(0, label);
    void (movement ? movement.connect(scope, initialState) : watching!.connect(scope)).catch((reason: unknown) => {
      onError(reason instanceof Error ? reason : new Error("실시간 이동 연결에 실패했습니다."));
    });

    return () => {
      active = false;
      unsubscribeClock();
      clearPlatformerInput(inputRef.current);
      sceneRef.current = null;
      game.destroy(true);
      void movement?.close();
      void watching?.close();
      stopRecords?.();
      void events.close();
      claims.close();
      records?.close();
    };
  }, [label, playerId, roomId, roundId, channelId, seed, courseSource, savedState, initialBest, observer]);

  const press = (event: PointerEvent<HTMLButtonElement>, action: TouchAction): void => {
    event.preventDefault();
    stageRef.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (action === "punch") sceneRef.current?.punch();
    else if (action === "drop") sceneRef.current?.dropDown();
    else if (action === "jump") inputRef.current.jumpQueued = true;
    else inputRef.current.held.set(`pointer-${event.pointerId}`, action);
  };
  const release = (event: PointerEvent<HTMLButtonElement>): void => {
    inputRef.current.held.delete(`pointer-${event.pointerId}`);
  };

  return <>
    <div
      ref={stageRef}
      className={styles.shell}
      tabIndex={0}
      aria-label={roundId ? "학습 점프타워" : "점프 타워"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) clearPlatformerInput(inputRef.current);
      }}
    >
      <div ref={hostRef} className={styles.canvasHost} onPointerDown={() => stageRef.current?.focus({ preventScroll: true })} />
      <div className={styles.hud}>
        {!observer ? <div className={styles.heightCard}>
          <small>지금</small>
          <strong>{height.floor}<span>층</span></strong>
          <em>최고 {height.best}층</em>
        </div> : null}
        {standings.length > 0 ? <section className={styles.standings} aria-label="지금 순위">
          <h2>지금 순위</h2>
          <ol>
            {standings.slice(0, 5).map((standing, index) => <li key={standing.playerId} data-self={standing.self}>
              <b>{index + 1}</b>{standing.label}<span>{standing.floor}층</span>
            </li>)}
          </ol>
        </section> : null}
        <div className={styles.hudRight}>
          <div className={styles.hudActions}>
            <FullscreenToggle target={stageRef} />
            {onExit ? <button type="button" className={styles.exitButton} onClick={onExit}>대기실로</button> : null}
          </div>
          <section className={styles.records} aria-label={roundId ? "최고층 순위" : "역대 순위"}>
            <h2>{roundId ? "최고층 순위" : "🏆 역대 순위"}</h2>
            {records.length === 0
              ? <p>아직 기록이 없어요</p>
              : <ol>
                {records.filter((record) => !roundId || labelsRef.current.has(record.playerId)).slice(0, 5).map((record, index) => <li key={record.playerId} data-self={record.playerId === playerId}>
                  <b>{index + 1}</b>{record.label}<span>{record.score}층</span>
                </li>)}
              </ol>}
            {!observer ? <small>내 최고 {Math.max(ownRecord, height.best)}층</small> : null}
          </section>
        </div>
      </div>
      <BuffHud buffs={buffs} />
      {connectionError ? <div className={styles.error}>실시간 연결 오류: {connectionError.message}</div> : null}
      {!roundId && !observer ? <div className={styles.controlsHint}>
        <kbd>← →</kbd> 이동 <kbd>↑</kbd> 점프(2단) <kbd>Space</kbd> 펀치 <kbd>↓</kbd> 내려가기 <kbd>R</kbd> 처음으로
      </div> : null}
      {!observer ? <div className={styles.touchControls} aria-label="점프 타워 조작">
        {TOUCH_ACTIONS.map(({ action, label: actionLabel, text }) => <button
          type="button"
          key={action}
          aria-label={actionLabel}
          className={action === "left" || action === "right" ? undefined : styles.touchPrimary}
          onPointerDown={(event) => press(event, action)}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
        >{text}</button>)}
      </div> : null}
      {children}
    </div>
  </>;
}
