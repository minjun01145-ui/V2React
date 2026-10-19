import Phaser from "phaser";
import { createRun, isDown, jumpHeight, stepRun, START_SPEED, type RunEvent, type RunState } from "../model/run.ts";
import { nextGate, trackObjects } from "../model/track.ts";
import { playGoldRunSound } from "../sound.ts";
import type { RunControls } from "./controls.ts";
import { paintGate, paintGoldBar, paintHurdle } from "./objectPainter.ts";
import { DRAW_DISTANCE, RUNNER_Z, createView, depthOf, laneX, project, type View } from "./projection.ts";
import { RunEffects } from "./RunEffects.ts";
import { RunnerActor } from "./RunnerActor.ts";
import { paintBackdrop, paintProps, paintTrack } from "./trackPainter.ts";

/* Runs the simulation at a fixed step and draws the chase-camera view of it. */

const STEP = 1 / 60;
const HUD_INTERVAL_MS = 100;
const MAX_SPEED_FOR_LINES = 26;
/** Objects the runner has passed stay drawn this far (metres) behind it, then vanish under the camera. */
const PASSED_VISIBLE = 1.5;

export interface GoldRunHud {
  readonly score: number;
  readonly coins: number;
  readonly lives: number;
  readonly streak: number;
  readonly down: boolean;
  /** The gate ahead: its ordinal in this run and how far away it is (metres). */
  readonly gate: { readonly question: number; readonly metres: number };
}

/** A gate the runner went through; `points` is everything earned since the previous one. */
export interface GateReport {
  readonly question: number;
  readonly chose: boolean | null;
  readonly correct: boolean;
  readonly points: number;
  readonly coins: number;
}

export interface GoldRunSceneSource {
  readonly seed: string;
  readonly playerId: string;
  /** False while saving is blocked, before the round is ready, or after time is up. */
  readonly running: boolean;
  readonly muted: boolean;
  readonly controls: RunControls | null;
  readonly isTrue: (question: number) => boolean;
  readonly onGate: (report: GateReport) => void;
  readonly onHud: (hud: GoldRunHud) => void;
}

export class GoldRunScene extends Phaser.Scene {
  private readonly source: () => GoldRunSceneSource;
  private view!: View;
  private backdrop!: Phaser.GameObjects.Graphics;
  private track!: Phaser.GameObjects.Graphics;
  private props!: Phaser.GameObjects.Graphics;
  private farObjects!: Phaser.GameObjects.Graphics;
  private nearObjects!: Phaser.GameObjects.Graphics;
  private runner!: RunnerActor;
  private effects!: RunEffects;
  private run: RunState = createRun();
  private accumulator = 0;
  private visualLane = 0;
  private lastHudAt = -Infinity;
  private reported = { score: 0, coins: 0 };

  constructor(source: () => GoldRunSceneSource) {
    super("gold-run");
    this.source = source;
  }

  create(): void {
    this.backdrop = this.add.graphics().setDepth(0);
    this.track = this.add.graphics().setDepth(1);
    this.props = this.add.graphics().setDepth(2);
    this.farObjects = this.add.graphics().setDepth(3);
    this.nearObjects = this.add.graphics().setDepth(12);
    this.runner = new RunnerActor(this, this.source().playerId);
    this.runner.setDepth(10);
    this.effects = new RunEffects(this);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  override update(_time: number, deltaMs: number): void {
    const source = this.source();
    const seconds = Math.min(deltaMs / 1000, 0.1);
    if (source.running) {
      this.accumulator += seconds;
      while (this.accumulator >= STEP) {
        this.accumulator -= STEP;
        const jump = source.controls?.consumeJump() ?? false;
        const result = stepRun(this.run, { lane: source.controls?.lane ?? 0, jump }, STEP, source.seed, source.isTrue);
        if (jump && result.state.jumpStartedAt === result.state.clock) this.playSound(source, "jump");
        this.run = result.state;
        for (const event of result.events) this.handle(event, source);
      }
    } else {
      // Drop input made while paused so the runner does not lurch when play resumes.
      source.controls?.consumeJump();
    }
    this.visualLane += (this.run.lane - this.visualLane) * Math.min(1, seconds * 14);
    this.draw(source, seconds);
    if (this.time.now - this.lastHudAt >= HUD_INTERVAL_MS) {
      this.lastHudAt = this.time.now;
      const gate = nextGate(source.seed, this.run.distance);
      source.onHud({ score: this.run.score, coins: this.run.coins, lives: this.run.lives, streak: this.run.streak,
        down: isDown(this.run), gate: { question: gate.question, metres: Math.max(0, gate.at - this.run.distance) } });
    }
  }

  private layout(): void {
    this.view = createView(this.scale.width, this.scale.height);
    paintBackdrop(this.backdrop, this.view);
  }

  private runnerScreen(): { x: number; y: number; groundY: number; scale: number } {
    const ground = project(this.view, laneX(this.visualLane), RUNNER_Z);
    const feet = project(this.view, laneX(this.visualLane), RUNNER_Z, jumpHeight(this.run));
    // The body is about 1.15 m tall; the actor is drawn 92 px tall.
    return { x: ground.x, y: feet.y, groundY: ground.y, scale: ground.scale * 1.15 / 92 };
  }

  private handle(event: RunEvent, source: GoldRunSceneSource): void {
    const at = this.runnerScreen();
    if (event.kind === "coin") {
      this.effects.sparkle(at.x, at.y - 70 * at.scale, 60 * at.scale);
      this.playSound(source, "coin", 1 + Math.min(this.run.streak, 8) * 0.03);
    } else if (event.kind === "hit") {
      this.effects.hit();
      this.playSound(source, "hit");
    } else if (event.kind === "gate") {
      const points = this.run.score - this.reported.score;
      const coins = this.run.coins - this.reported.coins;
      this.reported = { score: this.run.score, coins: this.run.coins };
      this.effects.burst(event.correct);
      this.effects.popup(at.x, at.y - 130 * at.scale, event.correct ? `정답 +${points}` : "오답", event.correct ? "#86efac" : "#fca5a5", true);
      this.playSound(source, event.correct ? "correct" : "wrong");
      source.onGate({ question: event.question, chose: event.chose === null ? null : event.chose === "O", correct: event.correct, points, coins });
    } else if (event.kind === "down") {
      this.playSound(source, "down");
      source.controls?.reset();
    }
  }

  private playSound(source: GoldRunSceneSource, sound: Parameters<typeof playGoldRunSound>[0], pitch?: number): void {
    if (!source.muted) playGoldRunSound(sound, pitch);
  }

  private draw(source: GoldRunSceneSource, seconds: number): void {
    const { view, run } = this;
    const time = this.time.now;
    paintTrack(this.track, view, run.distance);
    paintProps(this.props, view, run.distance, time);
    this.farObjects.clear();
    this.nearObjects.clear();
    const objects = trackObjects(source.seed, run.distance - PASSED_VISIBLE, run.distance - RUNNER_Z + DRAW_DISTANCE);
    for (let index = objects.length - 1; index >= 0; index -= 1) {
      const object = objects[index]!;
      const z = depthOf(object.at, run.distance);
      const graphics = z < RUNNER_Z ? this.nearObjects : this.farObjects;
      if (object.kind === "coin") {
        if (!run.taken.has(object.id)) paintGoldBar(graphics, view, object.lane, z, object.height, time / 260 + object.at * 0.4);
      } else if (object.kind === "barrier") paintHurdle(graphics, view, object.lane, z);
      else paintGate(graphics, view, z, Math.sin(time / 240) * 0.5 + 0.5);
    }
    const at = this.runnerScreen();
    const down = isDown(run);
    const airborne = jumpHeight(run) > 0;
    this.runner.update({ x: at.x, feetY: at.y, groundY: at.groundY, scale: at.scale,
      cadence: source.running && !down ? 2.2 * run.speed / START_SPEED : 0, lean: this.run.lane - this.visualLane,
      airborne, stumbling: run.clock < run.stumbleUntil, down }, seconds);
    const intensity = source.running && !down ? (run.speed - START_SPEED) / (MAX_SPEED_FOR_LINES - START_SPEED) : 0;
    this.effects.speedLines(view.width, view.height, view.horizonY, intensity, time);
  }
}
