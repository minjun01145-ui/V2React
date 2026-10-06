import { useCallback, useEffect, useRef, useState } from "react";
import { createAnswerResult } from "../../game-engine/core/answerResult.ts";
import { applyResultToProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { LiveEvent } from "../../live-world/client.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { createAttemptQueue, type AttemptQueue } from "./attemptQueue.ts";
import type { SkatingFx } from "./fx.ts";
import { skatingSteer, type SkatingInput } from "./input.ts";
import {
  skatingGateX,
  skatingQuestionForGate,
  skatingReward,
  type SkatingCourse,
  type SkatingImpact,
  type SkatingLane,
} from "./model.ts";
import { chooseSkatingPunchTarget, CRASH_EVENT, PUNCH_COOLDOWN_MS, PUNCH_EVENT, skatingPunchShove } from "./sim/punch.ts";
import { SkaterSimulation, type SkaterSnapshot } from "./sim/SkaterSimulation.ts";
import type { SkatingLiveWorld } from "./useSkatingLiveWorld.ts";

export interface SkatingDetails {
  readonly gateIndex: number;
  readonly selectedLane: number;
  readonly correctLane: number;
}

export interface SkatingHud {
  readonly distance: number;
  readonly rank: number;
  readonly racers: number;
  readonly speedUps: number;
  readonly boostLeftMs: number;
  readonly respawnLeftMs: number;
  readonly countdown: number;
}

const COUNTDOWN_MS = 3_000;
const HUD_INTERVAL_MS = 100;
const EMPTY_HUD: SkatingHud = { distance: 0, rank: 1, racers: 1, speedUps: 0, boostLeftMs: 0, respawnLeftMs: 0, countdown: 0 };

/** Where a returning student restarts: just past the last gate they answered. */
export function skatingResumeX(progress: GameProgress<SkatingDetails>): number {
  return progress.currentIndex > 0 ? skatingGateX(progress.currentIndex - 1) + 0.15 : 0;
}

/**
 * The local student's game loop: steps the simulation, judges gates, saves
 * attempts, sends punches and positions, and reports HUD numbers. Visuals and
 * sound only listen to `fx`.
 */
export function useSkatingRunner(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly course: SkatingCourse;
  /** Progress saved before this page loaded; the skater resumes after its last gate. */
  readonly initialProgress: GameProgress<SkatingDetails>;
  readonly controls: SkatingInput;
  readonly fx: SkatingFx;
  readonly live: SkatingLiveWorld;
}) {
  const { roomId, session, player, course, initialProgress, controls, fx, live } = input;
  const [progress, setProgress] = useState(initialProgress);
  const [impact, setImpact] = useState<SkatingImpact | null>(null);
  const [hud, setHud] = useState<SkatingHud>(EMPTY_HUD);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [started, setStarted] = useState(false);
  const progressRef = useRef(initialProgress);
  const [simulation] = useState(() => new SkaterSimulation(session.roundId, skatingResumeX(initialProgress)));
  const snapshotRef = useRef<SkaterSnapshot>(simulation.snapshot(Date.now()));
  const startAtRef = useRef<number | null>(null);
  const punchReadyAtRef = useRef(0);
  const queueRef = useRef<AttemptQueue | null>(null);

  useEffect(() => {
    const queue = createAttemptQueue(setSaveError);
    queueRef.current = queue;
    return () => queue.close();
  }, []);

  const answerGate = useCallback((gateIndex: number, lane: SkatingLane, nowMs: number): void => {
    const question = skatingQuestionForGate(course, gateIndex);
    const correct = lane === question.correctLane;
    const previous = progressRef.current;
    const reward = skatingReward(correct, previous.combo);
    const itemId = `meaning-dash-gate-${gateIndex}`;
    const details: SkatingDetails = { gateIndex, selectedLane: lane, correctLane: question.correctLane };
    const result = createAnswerResult({
      isCorrect: correct,
      scoreDelta: reward.points,
      feedback: correct ? "정답!" : `정답: ${question.choices[question.correctLane]}`,
      details,
    });
    const next: GameProgress<SkatingDetails> = {
      ...applyResultToProgress(previous, itemId, result),
      currentIndex: gateIndex + 1,
      combo: reward.combo,
    };
    progressRef.current = next;
    setProgress(next);
    setImpact({ gateIndex, correct, lane, prompt: question.prompt, answer: question.choices[question.correctLane],
      combo: reward.combo, points: reward.points });
    fx.emit({ type: "gate", gateIndex, lane, correct, combo: reward.combo, points: reward.points });
    if (!correct) {
      simulation.crash(nowMs);
      fx.emit({ type: "crash", playerId: player.id });
      live.publishEvent(CRASH_EVENT, "", 0);
    }
    queueRef.current?.enqueue({
      roomId,
      roundId: session.roundId,
      gameId: session.gameId,
      player,
      attemptId: `meaning-dash-${gateIndex}`,
      item: { id: itemId, prompt: question.prompt },
      answer: details,
      result,
      previousProgress: previous,
      progress: next,
    });
  }, [course, fx, live, player, roomId, session.gameId, session.roundId, simulation]);

  const throwPunch = useCallback((nowMs: number): void => {
    const self = snapshotRef.current;
    if (nowMs < punchReadyAtRef.current || self.respawnAtMs !== null) return;
    punchReadyAtRef.current = nowMs + PUNCH_COOLDOWN_MS;
    const hit = chooseSkatingPunchTarget(self, live.sample());
    const direction = hit?.direction ?? (self.y > 0 ? -1 : 1);
    live.publishEvent(PUNCH_EVENT, hit?.target.playerId ?? "", direction);
    fx.emit({ type: "punch", attackerId: player.id, targetId: hit?.target.playerId ?? null, direction });
  }, [fx, live, player.id]);

  /** Punches and crashes from other skaters, delivered by the live channel. */
  const receiveEvent = useCallback((event: LiveEvent): void => {
    if (event.kind === CRASH_EVENT) {
      fx.emit({ type: "crash", playerId: event.playerId });
      return;
    }
    if (event.kind !== PUNCH_EVENT) return;
    const direction = event.value < 0 ? -1 : 1;
    const targetId = event.target || null;
    fx.emit({ type: "punch", attackerId: event.playerId, targetId, direction });
    if (targetId === player.id) simulation.shove(skatingPunchShove(event.value));
  }, [fx, player.id, simulation]);

  useEffect(() => {
    let frame = 0;
    let lastAt = performance.now();
    let lastHudAt = 0;
    let lastTick = 0;
    const loop = (now: number): void => {
      frame = requestAnimationFrame(loop);
      const seconds = Math.min(Math.max((now - lastAt) / 1_000, 0), 0.05);
      lastAt = now;
      const startAt = startAtRef.current;
      if (startAt === null || document.hidden) return;
      const nowMs = Date.now();
      const countdownLeft = startAt - now;
      if (countdownLeft > 0) {
        const count = Math.ceil(countdownLeft / 1_000);
        if (count !== lastTick) { lastTick = count; fx.emit({ type: "tick", count }); }
        setHud((current) => current.countdown === count ? current : { ...current, countdown: count });
        return;
      }

      if (controls.punchQueued) {
        controls.punchQueued = false;
        throwPunch(nowMs);
      }
      const events = simulation.step(nowMs, seconds, skatingSteer(controls), queueRef.current?.blocked ?? false);
      for (const event of events) {
        if (event.type === "gate") {
          if (event.gateIndex >= progressRef.current.currentIndex) answerGate(event.gateIndex, event.lane, nowMs);
        } else if (event.type === "item") {
          fx.emit({ type: "item", kind: event.item.kind, itemId: event.item.id });
        } else if (event.type === "respawn") {
          fx.emit({ type: "respawn", playerId: player.id });
        } else {
          fx.emit({ type: "bump" });
        }
      }
      const snapshot = simulation.snapshot(nowMs);
      snapshotRef.current = snapshot;
      live.publish({ x: snapshot.x, y: snapshot.y, vx: snapshot.vx, vy: snapshot.vy });

      if (now - lastHudAt >= HUD_INTERVAL_MS) {
        lastHudAt = now;
        const others = live.sample();
        setHud({
          distance: Math.floor(snapshot.x * 10),
          rank: 1 + others.filter((other) => other.x > snapshot.x).length,
          racers: others.length + 1,
          speedUps: snapshot.buffs.speedUps,
          boostLeftMs: Math.max(0, snapshot.buffs.boostUntilMs - nowMs),
          respawnLeftMs: snapshot.respawnAtMs === null ? 0 : Math.max(0, snapshot.respawnAtMs - nowMs),
          countdown: 0,
        });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [answerGate, controls, fx, live, player.id, simulation, throwPunch]);

  const start = useCallback((): void => {
    if (startAtRef.current !== null) return;
    startAtRef.current = performance.now() + COUNTDOWN_MS;
    setStarted(true);
  }, []);

  return {
    started,
    progress,
    impact,
    hud,
    saveError,
    /** Read by the scene every frame. */
    snapshotRef,
    hasCollected: (itemId: number) => simulation.hasCollected(itemId),
    receiveEvent,
    start,
  };
}
