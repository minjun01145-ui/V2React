import Phaser from "phaser";
import { useEffect, useMemo, useRef, useState } from "react";
import { CLIMB_GRAVITY, CLIMB_PLAYER_HEIGHT } from "../../game-engine/jump-tower/course.ts";
import { resizeScaleConfig } from "../../game-engine/phaser-kit/scaleConfig.ts";
import { clearPlatformerInput, createPlatformerInput } from "../../game-engine/platformer/movement.ts";
import PlatformerTouchControls from "../../game-engine/platformer/PlatformerTouchControls.tsx";
import { usePlatformerKeyboard } from "../../game-engine/platformer/usePlatformerKeyboard.ts";
import { FullscreenToggle, ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import {
  createLiveEventChannel,
  createLiveMovementEngine,
  createLiveRecords,
  subscribeLiveServerTimeOffset,
  type LiveRecord,
} from "../../live-world/client.ts";
import { dailyChannelId } from "../../live-world/dailyChannel.ts";
import { displayLabel, type Player } from "../../multiplayer/types.ts";
import { arenaSpawnPoint } from "./arena.ts";
import DeathmatchScene from "./DeathmatchScene.ts";
import { deathmatchScoreboard } from "./scoreboard.ts";
import styles from "./LobbyDeathmatch.module.css";

const LOBBY_SCOPE_ID = "lobby";
const SCOREBOARD_SIZE = 5;
const FEED_SIZE = 4;
const FEED_MS = 5_000;

interface Props {
  readonly roomId: string;
  readonly playerId: string;
  readonly label: string;
  readonly players: readonly Player[];
  readonly onExit: () => void;
}

interface FeedEntry {
  readonly id: number;
  readonly killer: string | null;
  readonly victim: string;
  readonly self: boolean;
}

/**
 * Lobby deathmatch: everyone in the room on one screen, punching each other
 * into the lava. Kills and deaths are counted per day on two record boards.
 */
export default function LobbyDeathmatch(props: Props) {
  return <ImmersiveStage><DeathmatchStage {...props} /></ImmersiveStage>;
}

function DeathmatchStage({ roomId, playerId, label, players, onExit }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<DeathmatchScene | null>(null);
  const input = useMemo(createPlatformerInput, []);
  const labelsRef = useRef(new Map<string, string>());
  labelsRef.current = new Map(players.map((player) => [player.id, displayLabel(player.displayName, player.nickname)]));
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [kills, setKills] = useState<readonly LiveRecord[]>([]);
  const [deaths, setDeaths] = useState<readonly LiveRecord[]>([]);
  const [own, setOwn] = useState({ kills: 0, deaths: 0 });
  const [feed, setFeed] = useState<readonly FeedEntry[]>([]);

  useEffect(() => { stageRef.current?.focus({ preventScroll: true }); }, []);
  const actions = { punch: () => sceneRef.current?.punch(), drop: () => sceneRef.current?.dropDown() };
  usePlatformerKeyboard(input, actions);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let active = true;
    const onError = (error: Error): void => { if (active) setConnectionError(error); };
    const channelId = dailyChannelId("deathmatch");
    const scope = { roomId, roundId: LOBBY_SCOPE_ID, channelId };
    let serverOffsetMs = 0;
    const unsubscribeClock = subscribeLiveServerTimeOffset((offset) => { serverOffsetMs = offset; }, onError);
    const movement = createLiveMovementEngine(playerId, { sendHz: 12, onError });
    const events = createLiveEventChannel(scope, playerId, (event) => sceneRef.current?.receiveEvent(event), onError);

    // Counters only ever go up, which is exactly what the record boards allow.
    const counts = { kills: 0, deaths: 0 };
    const killBoard = createLiveRecords({ ...scope, channelId: `${channelId}-kills` }, playerId, SCOREBOARD_SIZE * 2, setKills,
      (score) => { counts.kills = Math.max(counts.kills, score); setOwn({ ...counts }); }, onError);
    const deathBoard = createLiveRecords({ ...scope, channelId: `${channelId}-deaths` }, playerId, 50, setDeaths,
      (score) => { counts.deaths = Math.max(counts.deaths, score); setOwn({ ...counts }); }, onError);

    let feedId = 0;
    const onDeath = (victimId: string, killerId: string | null): void => {
      if (victimId === playerId) {
        counts.deaths += 1;
        deathBoard.submit(counts.deaths, label);
      }
      if (killerId === playerId) {
        counts.kills += 1;
        killBoard.submit(counts.kills, label);
      }
      setOwn({ ...counts });
      const name = (id: string): string => id === playerId ? label : labelsRef.current.get(id) ?? "학생";
      const entry: FeedEntry = { id: (feedId += 1), killer: killerId ? name(killerId) : null, victim: name(victimId),
        self: victimId === playerId || killerId === playerId };
      setFeed((current) => [entry, ...current].slice(0, FEED_SIZE));
      window.setTimeout(() => { if (active) setFeed((current) => current.filter((item) => item.id !== entry.id)); }, FEED_MS);
    };

    const spawn = arenaSpawnPoint(Math.random(), CLIMB_PLAYER_HEIGHT);
    const scene = new DeathmatchScene({
      localPlayer: { id: playerId, label },
      spawn,
      input,
      nowMs: () => Date.now() + serverOffsetMs,
      publish: (state) => movement.updateLocal(state),
      samplePlayers: () => movement.sampleRemotePlayers(),
      playerLabel: (id) => labelsRef.current.get(id),
      publishEvent: (kind, target, value) => events.publish(kind, target, value),
      onDeath,
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: host.clientWidth || 960,
      height: host.clientHeight || 620,
      backgroundColor: "#1e1b4b",
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: CLIMB_GRAVITY }, debug: false } },
      scale: resizeScaleConfig(),
      render: { antialias: true, pixelArt: false },
      input: { keyboard: false },
      audio: { noAudio: true },
      scene,
    });
    void movement.connect(scope, { x: spawn.x, y: spawn.y, vx: 0, vy: 0 }).catch((reason: unknown) => {
      onError(reason instanceof Error ? reason : new Error("실시간 이동 연결에 실패했습니다."));
    });

    return () => {
      active = false;
      unsubscribeClock();
      clearPlatformerInput(input);
      sceneRef.current = null;
      game.destroy(true);
      void movement.close();
      void events.close();
      killBoard.close();
      deathBoard.close();
    };
  }, [input, label, playerId, roomId]);

  const scoreboard = deathmatchScoreboard(kills, deaths).filter((row) => row.kills > 0 || row.playerId === playerId).slice(0, SCOREBOARD_SIZE);

  return <div
    ref={stageRef}
    className={styles.shell}
    tabIndex={0}
    aria-label="데스매치"
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) clearPlatformerInput(input);
    }}
  >
    <div ref={hostRef} className={styles.canvasHost} onPointerDown={() => stageRef.current?.focus({ preventScroll: true })} />
    <div className={styles.hud}>
      <div className={styles.myScore} aria-label="내 기록">
        <span><small>킬</small><strong>{own.kills}</strong></span>
        <span><small>데스</small><strong>{own.deaths}</strong></span>
      </div>
      <section className={styles.board} aria-label="오늘 킬 순위">
        <h2>오늘 킬 순위</h2>
        {scoreboard.length === 0 ? <p>아직 기록이 없어요</p> : <ol>
          {scoreboard.map((row, index) => <li key={row.playerId} data-self={row.playerId === playerId}>
            <b>{index + 1}</b><span>{row.label}</span><em>{row.kills}킬 {row.deaths}데스</em>
          </li>)}
        </ol>}
      </section>
      <div className={styles.actions}>
        <FullscreenToggle target={stageRef} />
        <button type="button" className={styles.exitButton} onClick={onExit}>대기실로</button>
      </div>
    </div>
    <ol className={styles.feed} aria-live="polite">
      {feed.map((entry) => <li key={entry.id} data-self={entry.self}>
        {entry.killer ? <><b>{entry.killer}</b> ✊ </> : null}<span>{entry.victim}</span> 🌋
      </li>)}
    </ol>
    {connectionError ? <div className={styles.error}>실시간 연결 오류: {connectionError.message}</div> : null}
    <div className={styles.controlsHint}>
      <kbd>← →</kbd> 이동 <kbd>↑</kbd> 점프(2단) <kbd>Space</kbd> 펀치 <kbd>↓</kbd> 내려가기
    </div>
    <PlatformerTouchControls input={input} actions={actions} label="데스매치 조작"
      onPress={() => stageRef.current?.focus({ preventScroll: true })} />
  </div>;
}
