import Phaser from "phaser";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../../game-engine/contracts/gameDefinition.ts";
import { CLIMB_GRAVITY, CLIMB_PLAYER_HEIGHT } from "../../../game-engine/jump-tower/course.ts";
import { resizeScaleConfig } from "../../../game-engine/phaser-kit/scaleConfig.ts";
import BuffHud from "../../../game-engine/platformer-party/BuffHud.tsx";
import { GameEffectLayer } from "../../../game-engine/effects/GameEffectLayer.tsx";
import { createGameAnnouncement, createScoreCelebration } from "../../../game-engine/effects/model.ts";
import { playCorrectChime } from "../../../game-engine/effects/sound.ts";
import { useGameEffectEngine } from "../../../game-engine/effects/useGameEffectEngine.ts";
import type { ActiveBuff } from "../../../game-engine/platformer-party/buffs.ts";
import { clearPlatformerInput, createPlatformerInput } from "../../../game-engine/platformer/movement.ts";
import PlatformerTouchControls from "../../../game-engine/platformer/PlatformerTouchControls.tsx";
import { usePlatformerKeyboard } from "../../../game-engine/platformer/usePlatformerKeyboard.ts";
import { FullscreenToggle, ImmersiveStage } from "../../../game-engine/stage/ImmersiveStage.tsx";
import { TimedResultsOverlay } from "../../../game-engine/timed-game/TimedResultsOverlay.tsx";
import { useTimedGameClock } from "../../../game-engine/timed-game/useTimedGameClock.ts";
import { createLiveClaims, createLiveEventChannel, createLiveMovementEngine, createLiveRecords, type LiveRecord } from "../../../live-world/client.ts";
import { useRoundParticipants } from "../../../multiplayer/hooks.ts";
import { displayLabel } from "../../../multiplayer/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { arenaSpawnPoint } from "../arena.ts";
import { selectArenaMap } from "../maps/index.ts";
import { answerPlatforms, WORD_DEATHMATCH_CHANNEL, wordArena, type WordQuiz } from "./model.ts";
import { useWordQuiz, useWordRoundClock } from "./useWordDeathmatch.ts";
import WordDeathmatchScene from "./WordDeathmatchScene.ts";
import { WordQuestionHud } from "./WordQuestionHud.tsx";
import styles from "./WordDeathmatch.module.css";

export default function WordDeathmatchStudentGame(props: StudentGameModuleProps) {
  const { roomId, session, player } = props;
  const prepared = useWordQuiz(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  if (!session.expectedPlayerIds.includes(player.id)) {
    return <StatusPanel title="다음 게임을 기다려 주세요" tone="waiting">이미 시작된 단어 데스매치에는 중간 참가할 수 없습니다.</StatusPanel>;
  }
  if (prepared.loading || participants.loading) return <StatusPanel title="단어 데스매치 준비 중">단어 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (prepared.error || participants.error) return <StatusPanel title="단어 데스매치 오류" tone="error">{prepared.error?.message ?? participants.error?.message}</StatusPanel>;
  if (!prepared.quiz) return <StatusPanel title="학습 세트 오류" tone="error">단어 세트를 선택해 주세요.</StatusPanel>;
  const labels = new Map(participants.value.map((participant) => [participant.playerId, displayLabel(participant.displayName, participant.nickname)]));
  return <ImmersiveStage>
    <WordArenaStage key={session.roundId} props={props} quiz={prepared.quiz} labels={labels} />
  </ImmersiveStage>;
}

function WordArenaStage({ props, quiz, labels }: {
  readonly props: StudentGameModuleProps;
  readonly quiz: WordQuiz;
  readonly labels: ReadonlyMap<string, string>;
}) {
  const { roomId, session, player } = props;
  const playerId = player.id;
  const label = displayLabel(player.displayName, player.nickname);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<WordDeathmatchScene | null>(null);
  const input = useMemo(createPlatformerInput, []);
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const timed = useTimedGameClock(session);
  const startedAtMs = session.startedAtMs;
  const endsAtMs = startedAtMs !== null && timed.config.durationMs !== null ? startedAtMs + timed.config.durationMs : null;
  const clock = useWordRoundClock(startedAtMs, endsAtMs);
  const [records, setRecords] = useState<readonly LiveRecord[]>([]);
  const [score, setScore] = useState(0);
  const [buffs, setBuffs] = useState<readonly ActiveBuff[]>([]);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const effects = useGameEffectEngine();

  useEffect(() => { stageRef.current?.focus({ preventScroll: true }); }, []);
  const actions = { punch: () => sceneRef.current?.punch(), drop: () => sceneRef.current?.dropDown() };
  usePlatformerKeyboard(input, actions);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || startedAtMs === null) return undefined;
    let active = true;
    const onError = (error: Error): void => { if (active) setConnectionError(error); };
    const scope = { roomId, roundId: session.roundId, channelId: WORD_DEATHMATCH_CHANNEL };
    const base = selectArenaMap(`${roomId}:${session.roundId}`);
    const map = wordArena(base);
    const movement = createLiveMovementEngine(playerId, { sendHz: 12, onError });
    const events = createLiveEventChannel(scope, playerId, (event) => sceneRef.current?.receiveEvent(event), onError);
    const claims = createLiveClaims(scope, playerId, (claim) => sceneRef.current?.receiveClaim(claim), onError);
    // The best record is this player's running total, so a reload resumes it.
    let total = 0;
    let streak = 0;
    const board = createLiveRecords({ ...scope, channelId: `${WORD_DEATHMATCH_CHANNEL}-score` }, playerId, 50, setRecords,
      (best) => { total = Math.max(total, best); setScore(total); }, onError);

    const spawn = arenaSpawnPoint(map, Math.random(), CLIMB_PLAYER_HEIGHT);
    const scene = new WordDeathmatchScene({
      map, quiz, answers: answerPlatforms(base), startedAtMs, endsAtMs,
      localPlayer: { id: playerId, label },
      spawn,
      input,
      nowMs: clock.nowMs,
      publish: (state) => movement.updateLocal(state),
      samplePlayers: () => movement.sampleRemotePlayers(),
      playerLabel: (id) => labelsRef.current.get(id),
      publishEvent: (kind, target, value) => events.publish(kind, target, value),
      claimItem: (id) => claims.claim(id),
      onBuffsChange: setBuffs,
      onAttackPickups: () => undefined,
      onDeath: (victimId, killerId) => {
        const name = (id: string): string => labelsRef.current.get(id) ?? "친구";
        if (victimId === playerId) {
          effects.play(createGameAnnouncement({ tone: "warning", durationMs: 1_400,
            headline: killerId ? `${name(killerId)}에게 당했어요` : "앗, 떨어졌어요!", metric: "2초 후 다시 등장" }));
        } else if (killerId === playerId) {
          effects.play(createGameAnnouncement({ headline: "처치!", metric: name(victimId), durationMs: 1_000 }));
        }
      },
      onRoundScored: (index, correct) => {
        if (!correct) {
          streak = 0;
          const question = quiz.questionAt(index);
          effects.play(createGameAnnouncement({ tone: "warning", headline: "아쉬워요", metric: `정답: ${question.options[question.correctSlot]}`, durationMs: 1_600 }));
          return;
        }
        total += 1;
        streak += 1;
        setScore(total);
        board.submit(total, label);
        playCorrectChime();
        effects.play({ ...createScoreCelebration({ scoreDelta: 1, combo: streak, baseScore: 1 }), metric: "+1개", detail: null, durationMs: 1_400 });
      },
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: host.clientWidth || 960,
      height: host.clientHeight || 620,
      backgroundColor: map.theme.background,
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
      clearPlatformerInput(input);
      sceneRef.current = null;
      game.destroy(true);
      void movement.close();
      void events.close();
      claims.close();
      board.close();
    };
  }, [clock.nowMs, effects.play, endsAtMs, input, label, playerId, quiz, roomId, session.roundId, startedAtMs]);

  const question = clock.round ? quiz.questionAt(clock.round.index) : null;
  const scores = new Map(records.map((record) => [record.playerId, record.score]));
  scores.set(playerId, Math.max(score, scores.get(playerId) ?? 0));
  const results = [...labels].map(([id, name]) => ({ id, label: name, value: scores.get(id) ?? 0 }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "ko-KR"));

  return <div ref={stageRef} className={styles.shell} tabIndex={0} aria-label="단어 데스매치"
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) clearPlatformerInput(input); }}>
    <div ref={hostRef} className={styles.canvasHost} onPointerDown={() => stageRef.current?.focus({ preventScroll: true })} />
    {question && clock.round ? <WordQuestionHud question={question} round={clock.round} /> : null}
    <div className={styles.myScore} aria-label="내 점수"><small>정답</small><strong>{score}</strong></div>
    <div className={styles.actions}><FullscreenToggle target={stageRef} /></div>
    <BuffHud buffs={buffs} />
    <GameEffectLayer effect={effects.activeEffect} />
    {connectionError ? <div className={styles.error}>실시간 연결 오류: {connectionError.message}</div> : null}
    {timed.expired ? <TimedResultsOverlay title="단어 데스매치 결과" unit="개" entries={results} selfId={playerId} /> : null}
    <PlatformerTouchControls input={input} actions={actions} label="단어 데스매치 조작"
      onPress={() => stageRef.current?.focus({ preventScroll: true })} />
  </div>;
}
