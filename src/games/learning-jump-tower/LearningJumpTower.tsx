import { useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps, TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import JumpTowerGame from "../../game-engine/jump-tower/JumpTowerGame.tsx";
import type { ClimbSceneOptions } from "../../game-engine/jump-tower/ClimbScene.ts";
import { ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { TimedResultsOverlay } from "../../game-engine/timed-game/TimedResultsOverlay.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import type { LiveRecord } from "../../live-world/client.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import { displayLabel } from "../../multiplayer/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { LEARNING_TOWER_CHANNEL, towerLandingFeedback, type LearningTower, type TowerProgress } from "./model.ts";
import { useLearningTower } from "./useLearningTower.ts";
import styles from "./LearningJumpTower.module.css";

type Props = StudentGameModuleProps | TeacherGameModuleProps;

export default function LearningJumpTower(props: Props) {
  const { roomId, session } = props;
  const prepared = useLearningTower(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  if (props.role === "student" && !session.expectedPlayerIds.includes(props.player.id)) {
    return <StatusPanel title="다음 게임을 기다려 주세요" tone="waiting">이미 시작된 학습 점프타워에는 중간 참가할 수 없습니다.</StatusPanel>;
  }
  if (prepared.loading || participants.loading) return <StatusPanel title="학습 점프타워 준비 중">단어 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (prepared.error || participants.error) return <StatusPanel title="학습 점프타워 오류" tone="error">{prepared.error?.message ?? participants.error?.message}</StatusPanel>;
  if (!prepared.tower) return <StatusPanel title="학습 세트 오류" tone="error">단어 세트를 선택해 주세요.</StatusPanel>;
  const players = participants.value.filter((participant) => session.expectedPlayerIds.includes(participant.playerId))
    .map((participant) => ({ id: participant.playerId, displayName: participant.displayName, nickname: participant.nickname }));
  if (props.role === "student" && !players.some((player) => player.id === props.player.id)) players.push(props.player);
  return <TowerRuntime key={`${session.roundId}:${props.role === "student" ? props.player.id : "teacher"}`} props={props} tower={prepared.tower} players={players} />;
}

function TowerRuntime({ props, tower, players }: {
  readonly props: Props;
  readonly tower: LearningTower;
  readonly players: readonly { readonly id: string; readonly displayName: string; readonly nickname: string | null }[];
}) {
  const { roomId, session } = props;
  const playerId = props.role === "student" ? props.player.id : "teacher";
  const label = props.role === "student" ? displayLabel(props.player.displayName, props.player.nickname) : "교사";
  const storageKey = `v2r:learning-tower:${session.roundId}:${playerId}`;
  const [initialProgress] = useState(() => {
    try { return tower.parseProgress(JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null")); }
    catch { return tower.initialProgress(); }
  });
  const initialState = useMemo(() => tower.respawnState(initialProgress), [tower, initialProgress]);
  const progressRef = useRef(initialProgress);
  const [dead, setDead] = useState(false);
  const [records, setRecords] = useState<readonly LiveRecord[]>([]);
  const clock = useTimedGameClock(session);

  const saveProgress = (progress: TowerProgress): void => {
    progressRef.current = progress;
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(progress)); }
    catch { /* Storage availability must not interrupt play. */ }
  };
  const rules: NonNullable<ClimbSceneOptions["rules"]> = {
    canLand: (platform) => {
      const floor = platform.floor!;
      return floor >= progressRef.current.floor && floor <= progressRef.current.floor + 1;
    },
    onLand: (platform) => {
      const next = tower.land(progressRef.current, platform.index);
      if (!next) return false;
      const feedback = towerLandingFeedback(progressRef.current, next);
      saveProgress(next);
      return feedback ?? true;
    },
    answerFloor: () => progressRef.current.floor % 2 === 0 ? progressRef.current.floor + 1 : null,
    respawnState: () => tower.respawnState(progressRef.current),
    onDeath: setDead,
    isActive: () => session.startedAtMs !== null && Date.now() >= session.startedAtMs
      && (clock.config.durationMs === null || Date.now() < session.startedAtMs + clock.config.durationMs),
    onReset: () => saveProgress({ ...tower.initialProgress(), best: progressRef.current.best }),
  };
  const results = players.map((player) => ({ id: player.id, label: displayLabel(player.displayName, player.nickname),
    value: Math.max(records.find((record) => record.playerId === player.id)?.score ?? 0, player.id === playerId ? progressRef.current.best : 0) }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "ko-KR"));
  const game = <JumpTowerGame
    roomId={roomId} roundId={session.roundId} channelId={LEARNING_TOWER_CHANNEL} seed={session.roundId}
    playerId={playerId} label={label} players={players} courseSource={tower.source}
    initialState={initialState} initialBest={initialProgress.best} observer={props.role === "teacher"}
    rules={rules} onRecords={setRecords}
  >
    <div className={styles.clock}><TimedGameStatus session={session} compact /></div>
    {dead && !clock.expired ? <div className={styles.respawn} role="status">2초 후 다시 시작</div> : null}
    {clock.expired ? <TimedResultsOverlay title="학습 점프타워 결과" unit="층" entries={results}
      {...(props.role === "student" ? { selfId: playerId } : {})} /> : null}
  </JumpTowerGame>;
  return props.role === "teacher" ? <div className={styles.teacherStage}>{game}</div> : <ImmersiveStage>{game}</ImmersiveStage>;
}
