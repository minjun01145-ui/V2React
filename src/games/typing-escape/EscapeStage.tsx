import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { BlobActor } from "../../game-engine/phaser-kit/BlobActor.ts";
import { FONT_FAMILY, TEXT_METRICS_SAMPLE } from "../../game-engine/phaser-kit/art.ts";
import { FINISH } from "./model.ts";
import styles from "./TypingEscape.module.css";

export interface EscapeRunner { id: string; label: string; distance: number; escapes: number; hits: number; hidden: boolean; hit: boolean }
export interface EscapeStageState { runners: readonly EscapeRunner[]; selfId: string | null; watching: boolean; cycle: number; active: boolean }
const INK = 0x192a31;
const START_X = 112;
const EXIT_X = 1015;
const textStyle = { fontFamily: FONT_FAMILY, fontStyle: "300", color: "#fff6d9", resolution: 2, testString: TEXT_METRICS_SAMPLE };
interface Actor {
  id: string; character: BlobActor; bin: Phaser.GameObjects.Image; lid: Phaser.GameObjects.Image;
  tag: Phaser.GameObjects.Text; shadow: Phaser.GameObjects.Ellipse;
  x: number; y: number; distance: number; hits: number; escapes: number; stepAt: number;
}

class EscapeScene extends Phaser.Scene {
  private readonly read: () => EscapeStageState;
  private actors = new Map<string, Actor>();
  private guard!: Phaser.GameObjects.Image;
  private gun!: Phaser.GameObjects.Image;
  private spotlight!: Phaser.GameObjects.Graphics;
  private lamp!: Phaser.GameObjects.Arc;
  private wasWatching = false;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  constructor(read: () => EscapeStageState) { super("escape"); this.read = read; }

  private texture(key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    draw(g); g.generateTexture(key, width, height); g.destroy();
  }
  create() {
    const g = this.add.graphics();
    g.fillStyle(0x9dbfb3).fillRect(0, 0, 1120, 560);
    g.fillStyle(0xf5df9b).fillCircle(948, 54, 34);
    // Factory silhouettes and a watchtower behind the yard.
    g.fillStyle(0x688e85).fillRect(120, 76, 194, 61).fillRect(260, 55, 15, 50).fillRect(807, 69, 177, 63);
    g.fillStyle(0x507b72).fillRect(42, 28, 59, 113).fillRect(26, 22, 91, 12).fillRect(44, 4, 56, 23);
    g.fillStyle(0xd9dfb8).fillRect(53, 38, 35, 22);
    g.lineStyle(4, INK).lineBetween(70, 37, 70, 59);
    for (let x = 140; x < 306; x += 30) g.fillStyle(0x405f5b).fillRect(x, 90, 14, 19);
    for (let x = 827; x < 979; x += 30) g.fillStyle(0x405f5b).fillRect(x, 85, 14, 19);
    // Long brick wall, with offset courses rather than a flat coloured lane.
    g.fillStyle(0x465f55).fillRect(0, 129, 1120, 231);
    for (let row = 0; row < 9; row++) {
      for (let col = -1; col < 17; col++) {
        const x = col * 72 + (row % 2) * 36;
        const y = 139 + row * 24;
        g.fillStyle((row + col) % 3 === 0 ? 0xc6bd8e : 0xb2ad83).fillRect(x + 3, y + 2, 66, 20);
        g.fillStyle(0xd6cd9a).fillRect(x + 3, y + 2, 66, 3);
      }
    }
    g.fillStyle(0xe3d6a0).fillRect(0, 128, 1120, 10);
    g.lineStyle(2, 0x344d49);
    for (let x = 0; x < 1120; x += 33) g.strokeCircle(x, 115, 15);
    g.lineBetween(0, 110, 1120, 110).lineBetween(0, 121, 1120, 121);
    // Drain at the start, open gate at the end.
    g.fillStyle(INK).fillRect(33, 231, 48, 121);
    g.fillStyle(0x75867b).fillRect(37, 236, 40, 116);
    for (let x = 43; x < 77; x += 10) g.fillStyle(INK).fillRect(x, 240, 4, 112);
    g.fillStyle(INK).fillRect(1026, 141, 72, 212);
    g.fillStyle(0x415d53).fillRect(1033, 151, 58, 201);
    g.fillStyle(0xb4d2a0).fillRect(1040, 170, 45, 177);
    g.fillStyle(INK).fillRect(1018, 132, 88, 21);
    this.add.text(1062, 140, "EXIT", { ...textStyle, fontSize: "14px", color: "#dcf99d" }).setOrigin(.5);
    this.add.text(38, 203, "START", { ...textStyle, fontSize: "13px", color: "#223b35" }).setAngle(-90);
    for (let y = 162; y < 348; y += 24) g.fillStyle(0xf5efcf).fillRect(998, y, 10, 12);
    this.spotlight = this.add.graphics().setDepth(5);
    // Foreground wall separates the guard from the runners.
    g.fillStyle(INK).fillRect(0, 358, 1120, 7);
    g.fillStyle(0x827e63).fillRect(0, 365, 1120, 70);
    for (let x = -30; x < 1120; x += 100) {
      g.fillStyle(0xaaa37a).fillRect(x + 3, 368, 94, 25);
      g.fillStyle(0x95916d).fillRect(x + 43, 396, 94, 34);
    }
    g.fillStyle(0xc8bf8c).fillRect(0, 355, 1120, 11);
    g.fillStyle(0x698072).fillRect(0, 435, 1120, 125);
    g.fillStyle(0x587365).fillRect(0, 525, 1120, 35);
    for (let i = 0; i < 33; i++) {
      const x = (i * 107 + 43) % 1120; const y = 449 + (i * 37) % 98;
      g.fillStyle(0x8e9b78).fillRect(x, y, 13, 3).fillRect(x + 3, y - 3, 3, 3);
    }
    this.add.text(38, 388, "구역 04", { ...textStyle, fontSize: "24px", color: "#353f35" });
    this.add.text(910, 386, "출구 →", { ...textStyle, fontSize: "27px", color: "#353f35" });
    // Warning lamp and concrete pedestals.
    g.fillStyle(INK).fillRect(908, 440, 18, 83).fillRect(890, 517, 56, 10);
    g.fillStyle(0x40574c).fillRect(897, 440, 42, 35);
    this.lamp = this.add.circle(918, 456, 11, 0xc6ed65).setStrokeStyle(3, INK);
    this.makeGuard();
    this.texture("escape-bin", 52, 57, art => {
      art.fillStyle(INK).fillRect(5, 9, 42, 44).fillRect(9, 51, 7, 6).fillRect(36, 51, 7, 6);
      art.fillStyle(0x667f75).fillRect(8, 12, 36, 38);
      art.fillStyle(0x9fba99).fillRect(8, 12, 36, 5).fillRect(10, 17, 5, 30);
      for (const x of [20, 28, 36]) art.fillStyle(0x3d574f).fillRect(x, 20, 3, 25);
    });
    this.texture("escape-lid", 56, 16, art => {
      art.fillStyle(INK).fillRect(1, 7, 54, 9).fillRect(20, 0, 16, 7);
      art.fillStyle(0xa2b99b).fillRect(4, 8, 48, 4).fillRect(23, 3, 10, 4);
    });
  }
  private makeGuard() {
    for (const front of [false, true]) this.texture(`escape-guard-${front}`, 120, 148, g => {
      const r = (x: number, y: number, w: number, h: number, c: number) => g.fillStyle(c).fillRect(x, y, w, h);
      r(32, 108, 21, 35, INK); r(66, 108, 21, 35, INK); r(24, 133, 32, 13, INK); r(64, 133, 34, 13, INK);
      r(36, 111, 12, 23, 0x4c6440); r(70, 111, 12, 23, 0x4c6440);
      r(26, 59, 67, 53, INK); r(30, 62, 59, 44, 0x657c47); r(38, 74, 15, 14, 0x82945c); r(68, 74, 15, 14, 0x82945c);
      r(29, 102, 61, 10, INK); r(55, 102, 13, 9, 0xd6bb70);
      r(36, 20, 50, 41, INK); r(40, 27, 43, 28, front ? 0xf3c390 : 0x688049);
      r(28, 10, 62, 25, INK); r(33, 7, 52, 26, 0x687e43); r(25, 27, 71, 9, INK); r(29, 27, 63, 5, 0x98a660);
      r(44, 11, 12, 8, 0x9baa64); r(68, 16, 10, 8, 0x40542f);
      if (front) {
        r(45, 37, 14, 4, INK); r(66, 37, 14, 4, INK); r(49, 41, 5, 5, INK); r(70, 41, 5, 5, INK);
        r(57, 51, 13, 5, INK); r(9, 68, 22, 21, INK); r(13, 69, 17, 15, 0xf3c390); r(89, 65, 22, 22, INK); r(91, 68, 16, 15, 0xf3c390);
      } else {
        r(36, 38, 48, 14, 0x486135); r(52, 55, 17, 5, 0x3c512f); r(9, 64, 21, 38, INK); r(13, 67, 17, 26, 0x687f48);
        r(90, 64, 21, 38, INK); r(91, 67, 16, 26, 0x687f48); r(46, 65, 28, 28, 0x49603b);
      }
    });
    this.texture("escape-gun", 104, 32, g => {
      g.fillStyle(INK).fillRect(0, 11, 28, 15).fillRect(22, 6, 65, 14).fillRect(32, 18, 11, 14).fillRect(84, 9, 20, 6);
      g.fillStyle(0x876342).fillRect(3, 14, 21, 9).fillRect(53, 9, 28, 8);
      g.fillStyle(0x82918a).fillRect(26, 6, 24, 4).fillRect(89, 9, 14, 3);
    });
    this.add.ellipse(560, 532, 143, 21, INK, .25).setDepth(80);
    this.guard = this.add.image(560, 529, "escape-guard-false").setOrigin(.5, 1).setScale(1.15).setDepth(81);
    this.gun = this.add.image(582, 444, "escape-gun").setOrigin(.2, .5).setScale(.95).setDepth(82).setVisible(false);
  }
  private burst(x: number, y: number, colors: readonly number[], count: number) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const particle = this.add.rectangle(x, y, 4 + i % 4, 5 + i % 5, colors[i % colors.length]!).setDepth(95);
      const angle = i * 2.399; const reach = 35 + i % 7 * 12;
      this.tweens.add({ targets: particle, x: x + Math.cos(angle) * reach, y: y - 15 + Math.sin(angle) * reach,
        angle: i * 55, alpha: 0, duration: 450 + i % 4 * 110, ease: "Cubic.Out", onComplete: () => particle.destroy() });
    }
  }
  private pop(x: number, y: number, text: string, color: string) {
    const label = this.add.text(x, y, text, { ...textStyle, fontSize: "32px", color, stroke: "#192a31", strokeThickness: 6 }).setOrigin(.5).setDepth(99);
    this.tweens.add({ targets: label, y: y - 65, alpha: 0, duration: 800, ease: "Cubic.Out", onComplete: () => label.destroy() });
  }
  private shoot(actor: Actor, local: boolean) {
    const x = actor.x; const y = actor.y - 30;
    this.gun.setRotation(Phaser.Math.Angle.Between(582, 444, x, y));
    const trace = this.add.graphics().setDepth(90);
    trace.lineStyle(9, 0xffbb62, .5).lineBetween(582, 444, x, y);
    trace.lineStyle(3, 0xfff7c2).lineBetween(582, 444, x, y);
    trace.fillStyle(0xffe7a1).fillPoints([{ x: x - 26, y }, { x, y: y - 34 }, { x: x + 24, y }, { x, y: y + 27 }], true);
    this.tweens.add({ targets: trace, alpha: 0, duration: 170, onComplete: () => trace.destroy() });
    const ghost = new BlobActor(this, actor.id, false);
    ghost.update({ x, feetY: actor.y, vx: 160, vy: -200 }, this.time.now, 16);
    ghost.tag.setVisible(false);
    ghost.container.setScale(actor.character.container.scaleX).setDepth(96);
    this.tweens.add({ targets: ghost.container, x: x - 80, y: actor.y - 140, angle: -230, alpha: 0, duration: 650, ease: "Cubic.Out", onComplete: () => ghost.destroy() });
    const lid = this.add.image(x, actor.y - 52, "escape-lid").setDepth(97);
    this.tweens.add({ targets: lid, x: x + 60, y: actor.y - 120, angle: 270, alpha: 0, duration: 700, onComplete: () => lid.destroy() });
    this.burst(x, y, [0xffe7a1, 0xf56544, 0xf5efcf], 15);
    this.pop(x, y - 30, "악!", "#ffca8a");
    if (local && !this.reducedMotion) { this.cameras.main.shake(220, .009); this.cameras.main.flash(90, 245, 101, 68); }
  }
  private celebrate(actor: Actor, local: boolean) {
    const runner = new BlobActor(this, actor.id, false);
    runner.update({ x: EXIT_X, feetY: actor.y, vx: 160, vy: -200 }, this.time.now, 16);
    runner.tag.setVisible(false);
    runner.container.setScale(actor.character.container.scaleX).setDepth(96);
    this.tweens.add({ targets: runner.container, x: 1130, y: actor.y - 100, angle: 25, alpha: 0, duration: 650, ease: "Cubic.Out", onComplete: () => runner.destroy() });
    this.burst(EXIT_X, actor.y - 40, [0xc6ed65, 0xffd46b, 0xf56544, 0x72b8cf, 0xfff5d8], 28);
    this.pop(EXIT_X - 20, actor.y - 70, "+100", "#dfff83");
    if (local && !this.reducedMotion) this.cameras.main.flash(100, 218, 248, 161);
  }
  override update(time: number, delta: number) {
    const state = this.read();
    if (!this.guard) return;
    this.guard.setTexture(`escape-guard-${state.watching}`).setAngle(state.watching || !state.active ? 0 : Math.sin(time / 95) * 2);
    this.gun.setVisible(state.watching);
    this.lamp.setFillStyle(state.watching ? 0xf56544 : 0xc6ed65);
    this.spotlight.clear();
    if (state.watching) this.spotlight.fillStyle(0xf56544, .12).fillTriangle(560, 442, 70, 145, 1040, 145);
    if (state.watching && !this.wasWatching && !this.reducedMotion) this.cameras.main.shake(90, .002);
    this.wasWatching = state.watching;
    const ids = new Set(state.runners.map(r => r.id));
    for (const [id, actor] of this.actors) if (!ids.has(id)) {
      actor.character.destroy(); actor.bin.destroy(); actor.lid.destroy(); actor.tag.destroy(); actor.shadow.destroy(); this.actors.delete(id);
    }
    const others = state.runners.filter(r => r.id !== state.selfId);
    const labelsByRow = new Map<number, number[]>();
    state.runners.forEach(runner => {
      const local = runner.id === state.selfId;
      const index = others.findIndex(r => r.id === runner.id);
      const rows = Math.min(state.selfId ? 4 : 5, Math.max(1, others.length));
      const y = local ? 347 : 208 + Math.max(0, index) % rows * (state.selfId ? 31 : 33);
      const packOffset = local ? 0 : Math.floor(Math.max(0, index) / rows) * 48 % 240;
      const targetX = START_X + packOffset + runner.distance / FINISH * (EXIT_X - START_X - packOffset);
      const scale = local ? 1.12 : others.length > 20 ? .68 : .82;
      let actor = this.actors.get(runner.id);
      if (!actor) {
        const character = new BlobActor(this, runner.id, local);
        character.tag.setVisible(false);
        character.container.setScale(scale * 1.35);
        actor = { id: runner.id, character,
          bin: this.add.image(targetX, y, "escape-bin").setOrigin(.5, 1), lid: this.add.image(targetX, y - 47, "escape-lid").setOrigin(.5, 1),
          tag: this.add.text(targetX, y - 74, "", { ...textStyle, fontSize: local ? "17px" : "13px", stroke: "#192a31", strokeThickness: 4 }).setOrigin(.5, 1),
          shadow: this.add.ellipse(targetX, y, 42, 7, INK, .2),
          x: targetX, y, distance: runner.distance, hits: runner.hits, escapes: runner.escapes, stepAt: -1000 };
        this.actors.set(runner.id, actor);
      }
      if (runner.hits > actor.hits) this.shoot(actor, local);
      if (runner.escapes > actor.escapes) this.celebrate(actor, local);
      if (runner.distance > actor.distance && runner.distance < FINISH) {
        actor.stepAt = time;
        if (!this.reducedMotion) this.burst(actor.x - 14, y - 3, [0xd8d1a6, 0xf5efcf], 3);
      }
      const reset = runner.distance < actor.distance;
      actor.x = reset ? targetX : Phaser.Math.Linear(actor.x, targetX, Math.min(1, delta / 65));
      actor.y = y; actor.distance = runner.distance; actor.hits = runner.hits; actor.escapes = runner.escapes;
      const moving = !runner.hidden && !runner.hit && runner.distance < FINISH;
      const visible = !runner.hit && runner.distance < FINISH;
      const step = time - actor.stepAt;
      const hop = moving && step < 150 && !this.reducedMotion ? Math.sin(step / 150 * Math.PI) * 10 : 0;
      actor.character.update({ x: actor.x, feetY: y - hop, vx: moving ? 200 : 0, vy: 0, groundY: y }, time, delta);
      actor.character.container.setScale(scale * 1.35).setDepth(y / 10 + 10).setVisible(visible && moving);
      actor.bin.setPosition(actor.x, y).setScale(scale).setDepth(y / 10 + 11).setVisible(visible && !moving);
      actor.lid.setPosition(actor.x, y - 47 * scale).setScale(scale).setAngle(moving ? -18 : 0).setDepth(y / 10 + 12).setVisible(visible && !moving);
      actor.shadow.setPosition(actor.x, y).setScale(scale).setDepth(6).setVisible(visible && !moving);
      actor.tag.setText(`${local ? "▼ " : ""}${runner.label}${runner.escapes ? ` · ${runner.escapes}` : ""}`)
        .setPosition(actor.x, y - 66 * scale - hop).setDepth(70).setColor(local ? "#e2ff83" : "#fff6d9");
      const labels = labelsByRow.get(y) ?? [];
      const showLabel = local || !labels.some(x => Math.abs(x - actor.x) < 86);
      actor.tag.setVisible(showLabel);
      if (showLabel) labelsByRow.set(y, [...labels, actor.x]);
    });
  }
}

export default function EscapeStage(state: EscapeStageState) {
  const parent = useRef<HTMLDivElement>(null);
  const latest = useRef(state); latest.current = state;
  useEffect(() => {
    if (!parent.current) return;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current, width: 1120, height: 560,
      backgroundColor: "#9dbfb3", pixelArt: true, roundPixels: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: new EscapeScene(() => latest.current), audio: { noAudio: true }, banner: false });
    return () => game.destroy(true);
  }, []);
  return <div className={styles.stage} ref={parent} role="img" aria-label="담벼락 너머를 달리는 참가자들과 아래에서 총을 든 군인" />;
}
