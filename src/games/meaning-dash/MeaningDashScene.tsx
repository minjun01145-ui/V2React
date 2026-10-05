import Phaser from "phaser";
import { useEffect, useRef } from "react";
import type { LiveRemoteFrame } from "../../live-world/core/types.ts";
import { BlobActor } from "../../game-engine/phaser-kit/BlobActor.ts";
import { Effects } from "../../game-engine/phaser-kit/Effects.ts";
import { ensureSharedTextures, FONT_FAMILY, TEXT_METRICS_SAMPLE } from "../../game-engine/phaser-kit/art.ts";
import { resizeScaleConfig } from "../../game-engine/phaser-kit/scaleConfig.ts";
import { meaningDashGateY, meaningDashGateIndexAtY, meaningDashQuestionForGate, type MeaningDashCourse, type DashImpact } from "./model.ts";
import styles from "./MeaningDash.module.css";

export interface MeaningDashRenderableRunner {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly self?: boolean;
  readonly speed?: number;
}
export function movementFrameToRunner(frame: LiveRemoteFrame, label: string): MeaningDashRenderableRunner {
  return { id: frame.playerId, label, x: frame.x, y: frame.y, speed: frame.vy };
}
interface SceneProps {
  readonly course: MeaningDashCourse;
  readonly runners: readonly MeaningDashRenderableRunner[];
  readonly cameraY: number;
  readonly pixelsPerWorldUnit?: number;
  readonly impact?: DashImpact | null;
  readonly combo?: number;
  readonly active?: boolean;
  readonly onLane?: (lane: 0 | 1 | 2) => void;
}
const COLORS = [0x36d9eb, 0xb59aff, 0xffc766];

class DashScene extends Phaser.Scene {
  private road!: Phaser.GameObjects.Graphics;
  private effects!: Effects;
  private actors = new Map<string, BlobActor>();
  private gates: Phaser.GameObjects.Text[] = [];
  private lastImpact = -1;
  private lastTrail = 0;
  private hitAt = -Infinity;
  private visualCameraY = 0;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  constructor(private read: () => SceneProps) { super("meaning-dash"); }
  create() {
    ensureSharedTextures(this);
    this.road = this.add.graphics();
    this.effects = new Effects(this);
    for (let i = 0; i < 3; i++) this.gates.push(this.add.text(0, 0, "", {
      fontFamily: FONT_FAMILY, fontSize: "14px", fontStyle: "bold", color: "#e7f7ff",
      resolution: 2, testString: TEXT_METRICS_SAMPLE,
    }).setOrigin(.5).setDepth(3));
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.read().onLane?.(Phaser.Math.Clamp(Math.floor(pointer.x / this.scale.width * 3), 0, 2) as 0 | 1 | 2);
    });
  }
  override update(time: number, delta: number) {
    const state = this.read();
    const impact = state.impact;
    const newImpact = impact && impact.gateIndex !== this.lastImpact;
    if (newImpact && impact.correct) this.hitAt = time;
    const hitAge = time - this.hitAt;
    // Brief visual hit-stop only: judging and steering continue without delay.
    if (this.reducedMotion || hitAge > 75) {
      this.visualCameraY = hitAge < 350
        ? Phaser.Math.Linear(this.visualCameraY, state.cameraY, Math.min(1, delta / 45))
        : state.cameraY;
    }
    const w = this.scale.width, h = this.scale.height;
    const left = w * .08, laneWidth = w * .84 / 3;
    const laneX = (x: number) => w / 2 + x * laneWidth;
    const scale = Math.min(state.pixelsPerWorldUnit ?? 54, (h - 100) / 7);
    const feet = h - 55;
    const screenY = (y: number) => feet - (y - this.visualCameraY) * scale;
    const boost = (state.combo ?? 0) >= 5;
    const g = this.road.clear();
    g.fillStyle(boost ? 0x211442 : 0x0b182d).fillRect(0, 0, w, h);
    // Side lights and buildings scroll more slowly than the road.
    for (let i = 0; i < 12; i++) {
      const y = ((i * 83 + this.visualCameraY * scale * .5) % (h + 100)) - 50;
      for (const x of [w * .025, w * .975]) {
        g.fillStyle(0x243963).fillRoundedRect(x - 9, y, 18, 42, 5);
        g.fillStyle(boost ? 0xffafdf : 0x57dceb, .7).fillRect(x - 3, y + 8, 6, 18);
      }
    }
    for (let lane = 0; lane < 3; lane++) {
      const x = left + lane * laneWidth;
      const selected = state.runners.some(r => r.self && Math.round(r.x) === lane - 1);
      g.fillStyle(selected ? 0x253951 : 0x15253c).fillRect(x + 3, 0, laneWidth - 6, h);
      g.lineStyle(selected ? 3 : 1, COLORS[lane]!, selected ? .65 : .15).lineBetween(x + 3, 0, x + 3, h);
      for (let y = (this.visualCameraY * scale) % 70 - 70; y < h; y += 70) {
        g.fillStyle(COLORS[lane]!, boost ? .35 : .16).fillRect(x + laneWidth / 2 - 2, y, 4, 24);
      }
    }
    g.lineStyle(3, boost ? 0xf0a6ff : 0x5ee7f2, .85).lineBetween(left, 0, left, h).lineBetween(w - left, 0, w - left, h);
    const nextGate = Math.max(0, meaningDashGateIndexAtY(state.cameraY) + 1);
    // Gates mark the exact feet crossing used by the answer judge.
    for (let offset = 0; offset < 3; offset++) {
      const gate = nextGate + offset;
      const y = screenY(meaningDashGateY(gate));
      const label = this.gates[offset]!;
      label.setVisible(y > 12 && y < h);
      if (y < -40 || y > h + 40) continue;
      for (let lane = 0; lane < 3; lane++) {
        const x = left + lane * laneWidth + 8;
        g.fillStyle(COLORS[lane]!, .12).fillRoundedRect(x, y - 28, laneWidth - 16, 40, 8);
        g.lineStyle(3, COLORS[lane]!, .95).lineBetween(x, y, x + laneWidth - 16, y);
        g.fillStyle(COLORS[lane]!).fillCircle(x, y, 4).fillCircle(x + laneWidth - 16, y, 4);
      }
      const number = String(gate + 1).padStart(2, "0");
      label.setText(state.onLane ? number : `${number} · ${meaningDashQuestionForGate(state.course, gate).prompt}`)
        .setWordWrapWidth(w * .7).setPosition(w / 2, y - 17);
    }
    const ids = new Set(state.runners.map(r => r.id));
    for (const [id, actor] of this.actors) if (!ids.has(id)) { actor.destroy(); this.actors.delete(id); }
    const self = state.runners.find(r => r.self);
    for (const runner of state.runners) {
      let actor = this.actors.get(runner.id);
      if (!actor) { actor = new BlobActor(this, runner.id, !!runner.self); this.actors.set(runner.id, actor); }
      const y = screenY(runner.y), x = laneX(runner.x);
      const moving = state.active !== false && (runner.speed ?? 2) > 0;
      const jump = runner.self && !this.reducedMotion && hitAge >= 75 && hitAge < 650
        ? Math.sin((hitAge - 75) / 575 * Math.PI) : 0;
      const flip = jump > 0 && (impact?.combo ?? 0) % 5 === 0;
      actor.update({ x, feetY: y - jump * (flip ? 88 : 48), groundY: y,
        vx: moving ? 160 + (runner.speed ?? 2) * 30 : 0, vy: jump > 0 ? -100 : 0,
        alpha: runner.self ? 1 : .75 }, time, this.reducedMotion ? 0 : delta);
      actor.container.setScale(runner.self ? 1.3 + jump * .18 : 1)
        .setAngle(flip ? (hitAge - 75) / 575 * 360 : jump * -12)
        .setDepth(runner.self ? 22 : 18).setVisible(y > -70 && y < h + 60);
      actor.setTag(`${runner.self ? "▼ " : ""}${runner.label}`);
      actor.tag.setVisible(!flip && (!!runner.self || !self || Math.abs(runner.y - self.y) > 1.2 || Math.abs(runner.x - self.x) > .5));
      if (runner.self && boost && moving && !this.reducedMotion && time - this.lastTrail > 55) {
        this.effects.sparkle(x, y); this.lastTrail = time;
      }
    }
    if (newImpact) {
      this.lastImpact = impact.gateIndex;
      const x = laneX(impact.lane - 1), y = feet - 24;
      const actor = self ? this.actors.get(self.id) : null;
      if (impact.correct) {
        actor?.squash(time);
        if (!this.reducedMotion) {
          this.burstGate(x, y, laneWidth, impact);
        }
        this.effects.floatText(x, y - 36, `+${impact.points}`, "#16724d", 27);
      } else {
        if (!this.reducedMotion) { actor?.recoil(time, 1); this.effects.wrong(x, y); this.cameras.main.shake(130, .003); }
        else actor?.flash(0xff8080);
      }
    }
  }

  private burstGate(x: number, y: number, laneWidth: number, impact: DashImpact): void {
    const w = this.scale.width, h = this.scale.height;
    const milestone = impact.combo % 5 === 0;
    const color = milestone ? 0xffd56a : COLORS[impact.lane]!;
    this.effects.pickup(x, y);
    this.cameras.main.shake(milestone ? 150 : 85, milestone ? .004 : .002);

    // A luminous lane punch reaches forward from the broken gate.
    const beam = this.add.rectangle(x, y, laneWidth - 14, h, color, .34).setOrigin(.5, 1).setDepth(4);
    this.tweens.add({ targets: beam, scaleX: .12, alpha: 0, duration: 420, ease: "Cubic.Out", onComplete: () => beam.destroy() });
    for (let ringIndex = 0; ringIndex < (milestone ? 3 : 2); ringIndex++) {
      const ring = this.add.circle(x, y, 14).setStrokeStyle(ringIndex ? 3 : 7, ringIndex ? color : 0xffffff).setDepth(25);
      this.tweens.add({ targets: ring, scale: milestone ? 9 : 6, alpha: 0, delay: ringIndex * 65,
        duration: 470, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    }
    // Large pieces make the selected gate visibly shatter, rather than disappear.
    for (let i = 0; i < 12; i++) {
      const startX = x + (i / 11 - .5) * (laneWidth - 16);
      const shard = this.add.rectangle(startX, y, laneWidth / 12, i % 2 ? 14 : 24, i % 3 ? color : 0xffffff).setDepth(24);
      this.tweens.add({ targets: shard, x: startX + (i - 5.5) * 22, y: y - 40 - Math.sin(i * 2.4) * 85,
        angle: (i - 5.5) * 65, scale: .15, alpha: 0, duration: 580, ease: "Cubic.Out", onComplete: () => shard.destroy() });
    }
    // Collectible stars fan out, then zip into the score side of the HUD.
    for (let i = 0; i < (milestone ? 12 : 6); i++) {
      const star = this.add.star(x, y, 5, 4, milestone ? 12 : 9, 0xffd75e).setStrokeStyle(2, 0xfff8cb).setDepth(32);
      this.tweens.add({ targets: star, x: x + Math.cos(i * 2.4) * 65, y: y - 45 - (i % 3) * 22,
        angle: i * 40, duration: 230, ease: "Back.Out", onComplete: () => {
          this.tweens.add({ targets: star, x: w / 2, y: -15, scale: .25, alpha: .2, delay: i * 25,
            duration: 380, ease: "Cubic.In", onComplete: () => star.destroy() });
        } });
    }
    const words = ["NICE!", "GREAT!", "SUPER!", "AMAZING!"];
    const label = this.add.text(w / 2, h * .36, milestone ? `${impact.combo} COMBO!` : words[(impact.combo - 1) % words.length]!, {
      fontFamily: FONT_FAMILY, fontSize: `${Math.min(milestone ? 42 : 32, w / 9)}px`, fontStyle: "900",
      color: milestone ? "#ffdd78" : "#d4fff1", stroke: "#182742", strokeThickness: 6, resolution: 2,
    }).setOrigin(.5).setDepth(40).setScale(.2).setAngle(-8);
    this.tweens.add({ targets: label, scale: 1.15, angle: 3, duration: 220, ease: "Back.Out" });
    this.tweens.add({ targets: label, y: h * .29, alpha: 0, scale: .9, delay: 530, duration: 240, onComplete: () => label.destroy() });
    if (milestone) {
      this.effects.celebrate(w * .1, w * .9, h * .65, "");
      for (let i = 0; i < 14; i++) {
        const streak = this.add.rectangle((i + .5) / 14 * w, -70 - (i % 4) * 35, 2 + i % 3, 50, color, .65).setDepth(6);
        this.tweens.add({ targets: streak, y: h + 70, alpha: 0, duration: 420 + (i % 4) * 60, onComplete: () => streak.destroy() });
      }
    }
  }
}

export default function MeaningDashScene(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, backgroundColor: "#0b182d",
      scale: resizeScaleConfig(), scene: new DashScene(() => latest.current), audio: { noAudio: true }, banner: false });
    return () => game.destroy(true);
  }, []);
  return <div ref={host} className={styles.track} role="img" aria-label="세 갈래 네온 트랙을 달리는 점프 게임 캐릭터" />;
}
