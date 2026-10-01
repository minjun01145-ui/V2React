import Phaser from "phaser";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { hashString } from "../../game-engine/core/random.ts";
import { movementAction } from "../../game-engine/input/movementKeys.ts";
import { pauseWhileBackgroundFrame } from "../../game-engine/phaser-kit/backgroundPause.ts";
import { resizeScaleConfig } from "../../game-engine/phaser-kit/scaleConfig.ts";
import { clearPlatformerInput, createPlatformerInput } from "../../game-engine/platformer/movement.ts";
import BuffHud from "../../game-engine/platformer-party/BuffHud.tsx";
import type { ActiveBuff } from "../../game-engine/platformer-party/buffs.ts";
import { FullscreenToggle, ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import {
  createLiveClaims,
  createLiveEventChannel,
  createLiveMovementEngine,
  createLiveRecords,
  subscribeLiveServerTimeOffset,
  type LiveRecord,
} from "../../live-world/client.ts";
import { displayLabel, type Player } from "../../multiplayer/types.ts";
import ClimbScene, { type ClimbStanding } from "./ClimbScene.ts";
import { CLIMB_GRAVITY, CLIMB_PLAYER_HEIGHT, CLIMB_WORLD_WIDTH } from "./course.ts";
import styles from "./LobbyPlatformer.module.css";

const LOBBY_SCOPE_ID = "lobby";
const RECORDS_CHANNEL_ID = "climb-records";
const RECORD_BOARD_SIZE = 5;

interface Props {
  readonly roomId: string;
  readonly playerId: string;
  readonly label: string;
  readonly players: readonly Player[];
  readonly onExit: () => void;
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

export default function LobbyPlatformer({ roomId, playerId, label, players, onExit }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ClimbScene | null>(null);
  const inputRef = useRef(createPlatformerInput());
  const labelsRef = useRef(new Map<string, string>());
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [height, setHeight] = useState({ floor: 0, best: 0 });
  const [standings, setStandings] = useState<readonly ClimbStanding[]>([]);
  const [buffs, setBuffs] = useState<readonly ActiveBuff[]>([]);
  const [records, setRecords] = useState<readonly LiveRecord[]>([]);
  const [ownRecord, setOwnRecord] = useState(0);

  labelsRef.current = new Map(players.map((player) => [player.id, displayLabel(player.displayName, player.nickname)]));

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    setConnectionError(null);
    let active = true;
    const onError = (error: Error): void => { if (active) setConnectionError(error); };
    let serverOffsetMs = 0;
    const unsubscribeClock = subscribeLiveServerTimeOffset((offset) => { serverOffsetMs = offset; }, onError);
    const scope = { roomId, roundId: LOBBY_SCOPE_ID, channelId: dailyChannelId() };
    const spread = (hashString(playerId) % 400) - 200;
    const initialState = { x: CLIMB_WORLD_WIDTH / 2 + spread, y: -CLIMB_PLAYER_HEIGHT / 2, vx: 0, vy: 0 };

    const live = createLiveMovementEngine(playerId, { sendHz: 10, onError });
    const events = createLiveEventChannel(scope, playerId, (event) => sceneRef.current?.receiveEvent(event), onError);
    const claims = createLiveClaims(scope, playerId, (claim) => sceneRef.current?.receiveClaim(claim), onError);
    // All-time bests persist per room, unlike the daily live channel above.
    const records = createLiveRecords(
      { roomId, roundId: LOBBY_SCOPE_ID, channelId: RECORDS_CHANNEL_ID },
      playerId,
      RECORD_BOARD_SIZE,
      setRecords,
      setOwnRecord,
      onError,
    );
    const scene = new ClimbScene({
      seed: roomId,
      input: inputRef.current,
      localPlayer: { id: playerId, label },
      initialState,
      nowMs: () => Date.now() + serverOffsetMs,
      publish: (state) => live.updateLocal(state),
      samplePlayers: () => live.sampleRemotePlayers(),
      playerLabel: (id) => labelsRef.current.get(id),
      publishEvent: (kind, target, value) => events.publish(kind, target, value),
      claimItem: (id) => claims.claim(id),
      onBuffsChange: setBuffs,
      onHeight: (floor, best) => {
        setHeight({ floor, best });
        records.submit(best, label);
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
    const stopBackgroundPause = pauseWhileBackgroundFrame(game);
    void live.connect(scope, initialState).catch((reason: unknown) => {
      onError(reason instanceof Error ? reason : new Error("실시간 이동 연결에 실패했습니다."));
    });

    return () => {
      active = false;
      unsubscribeClock();
      clearPlatformerInput(inputRef.current);
      sceneRef.current = null;
      stopBackgroundPause();
      game.destroy(true);
      void live.close();
      void events.close();
      claims.close();
      records.close();
    };
  }, [label, playerId, roomId]);

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

  return <ImmersiveStage>
    <div
      ref={stageRef}
      className={styles.shell}
      tabIndex={0}
      aria-label="점프 타워"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) clearPlatformerInput(inputRef.current);
      }}
    >
      <div ref={hostRef} className={styles.canvasHost} onPointerDown={() => stageRef.current?.focus({ preventScroll: true })} />
      <div className={styles.hud}>
        <div className={styles.heightCard}>
          <small>지금</small>
          <strong>{height.floor}<span>층</span></strong>
          <em>최고 {height.best}층</em>
        </div>
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
            <button type="button" className={styles.exitButton} onClick={onExit}>대기실로</button>
          </div>
          <section className={styles.records} aria-label="역대 순위">
            <h2>🏆 역대 순위</h2>
            {records.length === 0
              ? <p>아직 기록이 없어요</p>
              : <ol>
                {records.map((record, index) => <li key={record.playerId} data-self={record.playerId === playerId}>
                  <b>{index + 1}</b>{record.label}<span>{record.score}층</span>
                </li>)}
              </ol>}
            <small>내 최고 {Math.max(ownRecord, height.best)}층</small>
          </section>
        </div>
      </div>
      <BuffHud buffs={buffs} />
      {connectionError ? <div className={styles.error}>실시간 연결 오류: {connectionError.message}</div> : null}
      <div className={styles.controlsHint}>
        <kbd>← →</kbd> 이동 <kbd>↑</kbd> 점프(2단) <kbd>Space</kbd> 펀치 <kbd>↓</kbd> 내려가기 <kbd>R</kbd> 처음으로
      </div>
      <div className={styles.touchControls} aria-label="점프 타워 조작">
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
      </div>
    </div>
  </ImmersiveStage>;
}
