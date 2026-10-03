import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { BlobActor } from "../../game-engine/phaser-kit/BlobActor.ts";
import { FONT_FAMILY, playerColor } from "../../game-engine/phaser-kit/art.ts";
import { FINISH } from "./model.ts";
import styles from "./TypingEscape.module.css";

export interface EscapeRunner { id: string; label: string; distance: number; hidden: boolean; hit: boolean }
export interface EscapeStageState { runners: readonly EscapeRunner[]; selfId: string | null; watching: boolean; cycle: number }

class EscapeScene extends Phaser.Scene {
  private readonly read: () => EscapeStageState;
  private actors = new Map<string, { actor: BlobActor; bin: Phaser.GameObjects.Container; y: number; hit: boolean }>();
  private soldier!: Phaser.GameObjects.Container;
  private flash!: Phaser.GameObjects.Text;
  private shot = -1;
  constructor(read: () => EscapeStageState) { super("escape"); this.read = read; }
  create() {
    const g = this.add.graphics();
    g.fillStyle(0x142f35).fillRect(0, 0, 960, 540);
    g.fillStyle(0x254c45).fillRoundedRect(22, 18, 916, 504, 24);
    g.fillStyle(0xd6c3a0).fillRoundedRect(62, 88, 836, 409, 10);
    for (let y = 105; y < 485; y += 28) {
      g.lineStyle(1, 0xb29d79, 0.45).lineBetween(62, y, 898, y);
    }
    for (let x = 62; x < 898; x += 22) {
      g.fillStyle((x / 22) % 2 < 1 ? 0xf8fafc : 0x203b3d).fillRect(x, 482, 22, 15);
      g.fillStyle((x / 22) % 2 < 1 ? 0x203b3d : 0xf8fafc).fillRect(x, 497, 22, 15);
    }
    this.add.text(85, 30, "탈출 작전", { fontFamily: FONT_FAMILY, fontSize: "25px", fontStyle: "bold", color: "#f5e9be" });
    this.add.text(85, 60, "START", { fontFamily: FONT_FAMILY, fontSize: "12px", color: "#afc5b1" });
    this.add.text(480, 520, "EXIT", { fontFamily: FONT_FAMILY, fontSize: "12px", color: "#d4f8ac" }).setOrigin(0.5);
    const guard = this.add.graphics();
    guard.fillStyle(0x182c20).fillRoundedRect(-16, -8, 32, 36, 7);
    guard.fillStyle(0xf4c794).fillCircle(0, -15, 16);
    guard.fillStyle(0x6c8248).fillRoundedRect(-20, -35, 40, 18, 8).fillRect(-23, -21, 46, 6);
    guard.fillStyle(0x111e25).fillRect(11, 0, 36, 9).fillRect(32, 8, 8, 13);
    guard.fillStyle(0x151f25).fillCircle(-5, -13, 2).fillCircle(6, -13, 2);
    guard.fillStyle(0x182c20).fillRect(-13, 24, 10, 12).fillRect(4, 24, 10, 12);
    this.soldier = this.add.container(838, 49, [guard]);
    this.flash = this.add.text(870, 51, "✹", { fontSize: "44px", color: "#ffdb52" }).setOrigin(0.5).setVisible(false);
  }
  override update(time: number, delta: number) {
    const state = this.read();
    this.soldier.setScale(state.watching ? 1 : -1, 1);
    if (state.watching && this.shot !== state.cycle) {
      this.shot = state.cycle;
      this.flash.setVisible(true); this.cameras.main.shake(130, 0.003);
      this.time.delayedCall(180, () => this.flash.setVisible(false));
    }
    const ids = new Set(state.runners.map(r => r.id));
    for (const [id, item] of this.actors) if (!ids.has(id)) { item.actor.destroy(); item.bin.destroy(); this.actors.delete(id); }
    const scale = Math.min(1, 18 / Math.max(1, state.runners.length));
    state.runners.forEach((runner, index) => {
      let item = this.actors.get(runner.id);
      const x = 85 + (index + 0.5) * 790 / Math.max(1, state.runners.length);
      const y = 127 + (runner.distance / FINISH) * 353;
      if (!item) {
        const actor = new BlobActor(this, runner.id, runner.id === state.selfId);
        const binArt = this.add.graphics();
        binArt.fillStyle(0x203f42).fillRoundedRect(-21, -30, 42, 38, 5);
        binArt.fillStyle(0x779b8d).fillRoundedRect(-18, -29, 36, 34, 4);
        binArt.lineStyle(3, 0x466d62);
        for (const bx of [-10, 0, 10]) binArt.lineBetween(bx, -23, bx, 0);
        binArt.fillStyle(0x9bb5a3).fillRoundedRect(-23, -35, 46, 7, 3).fillRoundedRect(-7, -41, 14, 7, 3);
        const bin = this.add.container(x, y, [binArt]).setDepth(30);
        item = { actor, bin, y, hit: false }; this.actors.set(runner.id, item);
      }
      const previousY = item.y;
      item.y += (y - item.y) * Math.min(1, delta / 100);
      const hidden = runner.hidden && !runner.hit && runner.distance < FINISH;
      item.actor.update({ x, feetY: item.y + (hidden ? 4 : 0), vx: Math.abs(y - previousY) > 0.2 ? 160 : 0, vy: 0 }, time, delta);
      item.actor.container.setScale(scale).setDepth(20);
      item.actor.setTag(runner.distance >= FINISH ? `${runner.label} ✓` : runner.label);
      item.actor.tag.setY(hidden ? -78 : -54);
      item.bin.setPosition(x, item.y).setScale(scale).setVisible(hidden);
      if (runner.hit && !item.hit) { item.actor.recoil(time, -1); item.actor.flash(0xff7979); }
      item.hit = runner.hit;
      if (runner.id === state.selfId) item.actor.tag.setColor(`#${playerColor(runner.id).toString(16).padStart(6, "0")}`);
    });
  }
}

export default function EscapeStage(state: EscapeStageState) {
  const parent = useRef<HTMLDivElement>(null);
  const latest = useRef(state); latest.current = state;
  useEffect(() => {
    if (!parent.current) return;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: parent.current, width: 960, height: 540,
      backgroundColor: "#142f35", scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: new EscapeScene(() => latest.current), audio: { noAudio: true }, banner: false });
    return () => game.destroy(true);
  }, []);
  return <div className={styles.stage} ref={parent} role="img" aria-label="점프타워 캐릭터들의 실시간 탈출 경기" />;
}
