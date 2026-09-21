import Phaser from "phaser";
import { hashString } from "../../game-engine/core/random.ts";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";

const PLATFORM_SPACING = 154;
const PLATFORM_START_X = 110;
const PLATFORM_TOP_Y = 304;
const BALL_RADIUS = 14;
const BALL_BASE_Y = PLATFORM_TOP_Y - BALL_RADIUS;
const PLATFORM_WIDTH = 88;
const PLATFORM_HEIGHT = 16;
const JUMP_SQUASH_MS = 34;
const JUMP_FLY_MS = 225;
const WRONG_SQUASH_MS = 35;
const WRONG_FALL_MS = 145;
const WRONG_HIDE_MS = 45;
const WRONG_RESPAWN_MS = 65;
const STUDENT_ZOOM = 1.42;
const TEACHER_ZOOM = 0.76;
const COLORS = [0x4f46e5, 0x0891b2, 0x16a34a, 0xd97706, 0xdc2626, 0x9333ea, 0x0f766e, 0xdb2777] as const;

interface RaceActor {
  readonly container: Phaser.GameObjects.Container;
  readonly ball: Phaser.GameObjects.Arc;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly label: Phaser.GameObjects.Text;
  readonly color: number;
}

type Motion =
  | { readonly kind: "correct"; readonly startedAt: number; readonly fromDistance: number; readonly toDistance: number }
  | { readonly kind: "wrong"; readonly startedAt: number; readonly fromDistance: number; readonly toDistance: number };

interface SceneOptions {
  readonly mode: "student" | "teacher";
  readonly localPlayer?: { readonly id: string; readonly label: string };
  readonly initialDistance?: number;
  readonly publish: (state: LiveMovementState) => void;
  readonly samplePlayers: () => readonly LiveRemoteFrame[];
  readonly playerLabel: (playerId: string) => string | undefined;
  readonly onSettled: (kind: "correct" | "wrong", distance: number) => void;
}

function worldX(distance: number): number {
  return PLATFORM_START_X + Math.max(0, distance) * PLATFORM_SPACING;
}

export function chunkJumpLandedState(distance: number): LiveMovementState {
  return { x: worldX(distance), y: BALL_BASE_Y, vx: 0, vy: 0 };
}

export function chunkJumpDistanceFromX(x: number): number {
  return Math.max(0, Math.round((x - PLATFORM_START_X) / PLATFORM_SPACING));
}

function actorColor(playerId: string): number {
  return COLORS[hashString(playerId) % COLORS.length] ?? COLORS[0];
}

function stackColumns(count: number): number {
  if (count <= 5) return 1;
  if (count <= 10) return 2;
  if (count <= 15) return 3;
  return 4;
}

function createActor(scene: Phaser.Scene, playerId: string, label: string, self: boolean): RaceActor {
  const color = actorColor(playerId);
  const shadow = scene.add.ellipse(0, 11, 32, 8, 0x111827, 0.18);
  const ball = scene.add.circle(0, 0, BALL_RADIUS, color).setStrokeStyle(self ? 4 : 2, self ? 0xffffff : 0x172033, 0.95);
  const name = scene.add.text(0, -29, self ? `${label} · 나` : label, {
    fontFamily: "sans-serif",
    fontSize: self ? "12px" : "11px",
    fontStyle: "bold",
    color: self ? "#102a43" : "#243b53",
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: { x: 5, y: 3 },
  }).setOrigin(0.5);
  return {
    container: scene.add.container(0, 0, [shadow, ball, name]).setDepth(self ? 20 : 10),
    ball,
    shadow,
    label: name,
    color,
  };
}

export default class ChunkJumpRaceScene extends Phaser.Scene {
  private readonly options: SceneOptions;
  private readonly remotes = new Map<string, RaceActor>();
  private localActor: RaceActor | null = null;
  private localDistance: number;
  private localState: LiveMovementState;
  private motion: Motion | null = null;
  private platformGraphics!: Phaser.GameObjects.Graphics;
  private effectGraphics!: Phaser.GameObjects.Graphics;
  private burst: { readonly kind: "correct" | "wrong"; readonly startedAt: number; readonly x: number; readonly y: number } | null = null;

  constructor(options: SceneOptions) {
    super("chunk-jump-race");
    this.options = options;
    this.localDistance = Math.max(0, Math.floor(options.initialDistance ?? 0));
    this.localState = chunkJumpLandedState(this.localDistance);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#dff6ff");
    this.cameras.main.setZoom(this.options.mode === "student" ? STUDENT_ZOOM : TEACHER_ZOOM);
    this.drawBackdrop();
    this.platformGraphics = this.add.graphics().setDepth(2);
    this.effectGraphics = this.add.graphics().setDepth(19);
    if (this.options.localPlayer) {
      this.localActor = createActor(this, this.options.localPlayer.id, this.options.localPlayer.label, true);
      this.positionActor(this.localActor, this.localState, 0, 0);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.remotes.clear();
      this.motion = null;
      this.burst = null;
    });
  }

  override update(time: number): void {
    if (this.options.mode === "student") this.updateLocalMotion(time);
    const frames = this.options.samplePlayers();
    this.renderPlayers(frames);
    this.updateCamera(frames);
    this.drawPlatforms();
    this.drawEffects(time);
  }

  jumpForward(): boolean {
    if (!this.localActor || this.motion) return false;
    this.localActor.ball.setScale(1.24, 0.72);
    this.localActor.shadow.setScale(1.18, 0.8);
    this.burst = null;
    this.motion = {
      kind: "correct",
      startedAt: this.time.now,
      fromDistance: this.localDistance,
      toDistance: this.localDistance + 1,
    };
    return true;
  }

  fallBack(targetDistance: number): boolean {
    if (!this.localActor || this.motion) return false;
    this.localActor.ball.setScale(1.18, 0.78);
    this.burst = { kind: "wrong", startedAt: this.time.now, x: worldX(this.localDistance), y: BALL_BASE_Y };
    this.cameras.main.shake(80, 0.008, true);
    this.motion = {
      kind: "wrong",
      startedAt: this.time.now,
      fromDistance: this.localDistance,
      toDistance: Math.max(0, targetDistance),
    };
    return true;
  }

  getLocalState(): LiveMovementState | null {
    return this.localActor ? this.localState : null;
  }

  private updateLocalMotion(time: number): void {
    if (!this.localActor) return;
    if (!this.motion) {
      this.localState = chunkJumpLandedState(this.localDistance);
      this.options.publish(this.localState);
      return;
    }

    if (this.motion.kind === "correct") this.updateCorrectMotion(time, this.motion);
    else this.updateWrongMotion(time, this.motion);
    this.options.publish(this.localState);
  }

  private updateCorrectMotion(time: number, motion: Extract<Motion, { readonly kind: "correct" }>): void {
    const elapsed = Math.max(0, time - motion.startedAt);
    const fromX = worldX(motion.fromDistance);
    const toX = worldX(motion.toDistance);
    if (elapsed < JUMP_SQUASH_MS) {
      this.localState = { x: fromX, y: BALL_BASE_Y, vx: 0, vy: 0 };
      return;
    }
    const raw = Math.min(1, (elapsed - JUMP_SQUASH_MS) / JUMP_FLY_MS);
    const travel = Phaser.Math.Easing.Quartic.Out(raw);
    const x = Phaser.Math.Linear(fromX, toX, travel);
    const y = BALL_BASE_Y - Math.sin(Math.PI * raw) * 88;
    this.localActor?.ball.setScale(Phaser.Math.Linear(1.2, 0.96, raw), Phaser.Math.Linear(0.78, 1.08, raw));
    this.localActor?.shadow.setScale(Phaser.Math.Linear(1, 0.58, Math.sin(Math.PI * raw)), 1);
    this.localState = {
      x,
      y,
      vx: raw < 1 ? PLATFORM_SPACING / (JUMP_FLY_MS / 1_000) : 0,
      vy: raw < 0.5 ? -260 : raw < 1 ? 260 : 0,
    };
    if (raw < 1) return;
    this.localDistance = motion.toDistance;
    this.localState = chunkJumpLandedState(this.localDistance);
    this.motion = null;
    this.burst = { kind: "correct", startedAt: time, x: toX, y: BALL_BASE_Y };
    this.cameras.main.shake(65, 0.0045, true);
    if (this.localActor) {
      this.localActor.ball.setScale(1.24, 0.76);
      this.localActor.shadow.setScale(1.08, 0.9);
      this.tweens.add({ targets: [this.localActor.ball, this.localActor.shadow], scaleX: 1, scaleY: 1, duration: 70, ease: "Back.Out" });
    }
    this.options.onSettled("correct", this.localDistance);
  }

  private updateWrongMotion(time: number, motion: Extract<Motion, { readonly kind: "wrong" }>): void {
    if (!this.localActor) return;
    const elapsed = Math.max(0, time - motion.startedAt);
    const fromX = worldX(motion.fromDistance);
    const fallStart = WRONG_SQUASH_MS;
    const hideStart = fallStart + WRONG_FALL_MS;
    const respawnStart = hideStart + WRONG_HIDE_MS;
    const finishAt = respawnStart + WRONG_RESPAWN_MS;

    if (elapsed < fallStart) {
      this.localState = { x: fromX, y: BALL_BASE_Y, vx: 0, vy: 0 };
      return;
    }
    if (elapsed < hideStart) {
      const raw = (elapsed - fallStart) / WRONG_FALL_MS;
      this.localActor.container.setAlpha(1);
      this.localActor.ball.setScale(Phaser.Math.Linear(1.05, 0.88, raw), Phaser.Math.Linear(0.9, 1.14, raw));
      this.localState = { x: fromX, y: BALL_BASE_Y + raw * raw * 270, vx: 0, vy: 700 * raw };
      return;
    }
    if (elapsed < respawnStart) {
      this.localActor.container.setAlpha(0);
      this.localState = { x: fromX, y: BALL_BASE_Y + 270, vx: 0, vy: 0 };
      return;
    }
    const raw = Math.min(1, (elapsed - respawnStart) / WRONG_RESPAWN_MS);
    this.localActor.container.setAlpha(1);
    this.localActor.ball.setScale(Phaser.Math.Linear(0.72, 1, raw), Phaser.Math.Linear(0.72, 1, raw));
    this.localState = chunkJumpLandedState(motion.toDistance);
    if (elapsed < finishAt) return;
    this.localDistance = motion.toDistance;
    this.localActor.ball.setScale(1);
    this.localActor.shadow.setScale(1);
    this.motion = null;
    this.options.onSettled("wrong", this.localDistance);
  }

  private renderPlayers(frames: readonly LiveRemoteFrame[]): void {
    const entries: Array<{ readonly id: string; readonly state: LiveMovementState; readonly actor: RaceActor; readonly self: boolean }> = [];
    if (this.localActor && this.options.localPlayer) {
      entries.push({ id: this.options.localPlayer.id, state: this.localState, actor: this.localActor, self: true });
    }
    const visible = new Set<string>();
    for (const frame of frames) {
      const label = this.options.playerLabel(frame.playerId);
      if (!label) continue;
      visible.add(frame.playerId);
      let actor = this.remotes.get(frame.playerId);
      if (!actor) {
        actor = createActor(this, frame.playerId, label, false);
        this.remotes.set(frame.playerId, actor);
      }
      if (actor.label.text !== label) actor.label.setText(label);
      entries.push({ id: frame.playerId, state: frame, actor, self: false });
    }
    for (const [id, actor] of this.remotes) {
      if (visible.has(id)) continue;
      actor.container.destroy();
      this.remotes.delete(id);
    }

    const landedGroups = new Map<number, typeof entries>();
    for (const entry of entries) {
      const distance = chunkJumpDistanceFromX(entry.state.x);
      const landed = Math.abs(entry.state.y - BALL_BASE_Y) < 8 && Math.abs(entry.state.x - worldX(distance)) < 14;
      if (!landed) continue;
      const group = landedGroups.get(distance) ?? [];
      group.push(entry);
      landedGroups.set(distance, group);
    }

    const offsets = new Map<string, { x: number; y: number }>();
    for (const group of landedGroups.values()) {
      group.sort((left, right) => left.id.localeCompare(right.id));
      const columns = stackColumns(group.length);
      group.forEach((entry, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        offsets.set(entry.id, {
          x: (column - (columns - 1) / 2) * 20,
          y: -row * 18,
        });
      });
    }

    for (const entry of entries) {
      const offset = offsets.get(entry.id) ?? { x: 0, y: 0 };
      this.positionActor(entry.actor, entry.state, offset.x, offset.y);
      if (!entry.self) {
        const airborne = Math.abs(entry.state.y - BALL_BASE_Y) > 8;
        entry.actor.ball.setScale(airborne ? 0.96 : 1);
        entry.actor.shadow.setScale(airborne ? 0.62 : 1, 1);
      }
    }
  }

  private positionActor(actor: RaceActor, state: LiveMovementState, offsetX: number, offsetY: number): void {
    actor.container.setPosition(state.x + offsetX, state.y + offsetY);
    actor.shadow.setY(BALL_BASE_Y - state.y - offsetY + 11);
    actor.shadow.setAlpha(Math.abs(state.y - BALL_BASE_Y) > 10 ? 0.1 : 0.18);
  }

  private updateCamera(frames: readonly LiveRemoteFrame[]): void {
    const camera = this.cameras.main;
    const visibleWidth = camera.width / camera.zoom;
    let focusX = this.localActor ? this.localState.x : PLATFORM_START_X;
    const visibleFrames = this.localActor ? [] : frames.filter((frame) => this.options.playerLabel(frame.playerId));
    if (visibleFrames.length > 0) {
      const leaders = [...visibleFrames].sort((left, right) => right.x - left.x).slice(0, 6);
      const leaderX = leaders[0]?.x ?? PLATFORM_START_X;
      const packX = leaders.at(-1)?.x ?? leaderX;
      focusX = (leaderX + packX) / 2;
    }

    const anchor = this.localActor ? 0.27 : 0.52;
    let cameraEase = this.localActor ? 0.22 : 0.09;
    if (this.localActor && this.motion?.kind === "correct") {
      const elapsed = Math.max(0, this.time.now - this.motion.startedAt - JUMP_SQUASH_MS);
      const raw = Math.max(0, Math.min(1, elapsed / JUMP_FLY_MS));
      if (raw < 0.38) focusX = worldX(this.motion.fromDistance);
      else {
        focusX = worldX(this.motion.toDistance);
        cameraEase = 0.48;
      }
    } else if (this.localActor && this.motion?.kind === "wrong") {
      const elapsed = Math.max(0, this.time.now - this.motion.startedAt);
      const moveCameraAt = WRONG_SQUASH_MS + WRONG_FALL_MS + WRONG_HIDE_MS;
      focusX = worldX(elapsed < moveCameraAt ? this.motion.fromDistance : this.motion.toDistance);
      cameraEase = elapsed < moveCameraAt ? 0.16 : 0.42;
    }
    const worldLeft = Math.max(0, focusX - visibleWidth * anchor);
    const desiredScroll = worldLeft - camera.width / 2 + visibleWidth / 2;
    camera.scrollX = Phaser.Math.Linear(camera.scrollX, desiredScroll, cameraEase);
  }

  private drawEffects(time: number): void {
    const graphics = this.effectGraphics;
    graphics.clear();
    if (this.localActor && this.motion?.kind === "correct") {
      const elapsed = Math.max(0, time - this.motion.startedAt - JUMP_SQUASH_MS);
      const raw = Math.max(0, Math.min(1, elapsed / JUMP_FLY_MS));
      if (raw > 0 && raw < 1) {
        const direction = 1 - raw * 0.25;
        for (let index = 0; index < 4; index += 1) {
          const alpha = (0.22 - index * 0.04) * direction;
          const trailX = this.localState.x - 22 - index * 18;
          graphics.fillStyle(this.localActor.color, alpha);
          graphics.fillCircle(trailX, this.localState.y + index * 1.5, Math.max(4, BALL_RADIUS - index * 2.2));
          graphics.lineStyle(3 - index * 0.45, 0xffffff, alpha * 0.75);
          graphics.lineBetween(trailX - 28, this.localState.y + index * 8 - 12, trailX - 5, this.localState.y + index * 8 - 12);
        }
      }
    }
    if (this.localActor && this.motion?.kind === "wrong") {
      const elapsed = Math.max(0, time - this.motion.startedAt - WRONG_SQUASH_MS);
      if (elapsed > 0 && elapsed < WRONG_FALL_MS) {
        const raw = elapsed / WRONG_FALL_MS;
        graphics.lineStyle(4, 0xef4444, 0.34 * (1 - raw));
        for (let index = -2; index <= 2; index += 1) {
          const x = this.localState.x + index * 9;
          graphics.lineBetween(x, this.localState.y - 36 - Math.abs(index) * 5, x, this.localState.y - 8);
        }
      }
    }
    if (!this.burst) return;
    const age = Math.max(0, time - this.burst.startedAt);
    const duration = this.burst.kind === "correct" ? 180 : 150;
    if (age >= duration) {
      this.burst = null;
      return;
    }
    const raw = age / duration;
    const alpha = 1 - raw;
    const color = this.burst.kind === "correct" ? 0xffffff : 0xef4444;
    const radius = Phaser.Math.Linear(18, this.burst.kind === "correct" ? 54 : 42, raw);
    graphics.lineStyle(this.burst.kind === "correct" ? 4 : 5, color, alpha * 0.75);
    graphics.strokeCircle(this.burst.x, this.burst.y, radius);
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      const inner = radius + 4;
      const outer = radius + 18 * alpha;
      graphics.lineBetween(
        this.burst.x + Math.cos(angle) * inner,
        this.burst.y + Math.sin(angle) * inner,
        this.burst.x + Math.cos(angle) * outer,
        this.burst.y + Math.sin(angle) * outer,
      );
    }
  }

  private drawPlatforms(): void {
    const camera = this.cameras.main;
    const visibleWidth = camera.width / camera.zoom;
    const worldLeft = camera.scrollX + camera.width / 2 - visibleWidth / 2;
    const first = Math.max(0, Math.floor((worldLeft - PLATFORM_START_X) / PLATFORM_SPACING) - 2);
    const count = Math.ceil(visibleWidth / PLATFORM_SPACING) + 6;
    this.platformGraphics.clear();
    for (let offset = 0; offset < count; offset += 1) {
      const distance = first + offset;
      const x = worldX(distance) - PLATFORM_WIDTH / 2;
      this.platformGraphics.fillStyle(distance % 2 === 0 ? 0x326b5b : 0x3c7b68, 1);
      this.platformGraphics.fillRoundedRect(x, PLATFORM_TOP_Y, PLATFORM_WIDTH, PLATFORM_HEIGHT, 6);
      this.platformGraphics.fillStyle(0x7dd3a7, 1);
      this.platformGraphics.fillRoundedRect(x + 4, PLATFORM_TOP_Y + 2, PLATFORM_WIDTH - 8, 5, 3);
    }
  }

  private drawBackdrop(): void {
    const background = this.add.graphics().setScrollFactor(0).setDepth(0);
    background.fillStyle(0xffffff, 0.78);
    background.fillCircle(120, 86, 35).fillCircle(160, 78, 48).fillCircle(210, 91, 32);
    background.fillCircle(720, 110, 28).fillCircle(755, 96, 42).fillCircle(800, 112, 31);
    background.fillStyle(0xb9e4d0, 0.68);
    background.fillEllipse(180, 390, 520, 210).fillEllipse(690, 410, 620, 230);
    background.fillStyle(0x91cfba, 0.55);
    background.fillEllipse(500, 430, 760, 230);
  }
}
