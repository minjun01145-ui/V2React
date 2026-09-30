import Phaser from "phaser";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import { ensureSharedTextures, playerColor } from "../../game-engine/phaser-kit/art.ts";
import { BLOB_TAG_Y, BlobActor, compactLabel } from "../../game-engine/phaser-kit/BlobActor.ts";
import { Effects } from "../../game-engine/phaser-kit/Effects.ts";
import { crowdSlots, orderCrowd } from "./crowdLayout.ts";
import { RaceBackdrop } from "./scene/RaceBackdrop.ts";
import { PLATFORM_SPACING, PLATFORM_START_X, PLATFORM_TOP_Y, RaceCourse, worldX } from "./scene/RaceCourse.ts";

/** Height of the world band every client frames; zoom derives from it so the course looks the same everywhere. */
export const CHUNK_JUMP_VIEW_HEIGHT = 420;
const FEET_Y = PLATFORM_TOP_Y;
const JUMP_HEIGHT = 92;
const JUMP_SQUASH_MS = 60;
const JUMP_FLY_MS = 260;
const WRONG_SQUASH_MS = 40;
const WRONG_FALL_MS = 260;
const WRONG_HIDE_MS = 260;
const WRONG_RESPAWN_MS = 180;
const STUDENT_ZOOM = 1.2;
const TEACHER_ZOOM = 0.76;
/** Scripted jumps publish this vertical speed so remote clients animate take-off and landing. */
const AIR_SPEED = 320;

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

interface Entry {
  readonly id: string;
  readonly state: LiveMovementState;
  readonly actor: BlobActor;
  readonly self: boolean;
}

export function chunkJumpLandedState(distance: number): LiveMovementState {
  return { x: worldX(distance), y: FEET_Y, vx: 0, vy: 0 };
}

export function chunkJumpDistanceFromX(x: number): number {
  return Math.max(0, Math.round((x - PLATFORM_START_X) / PLATFORM_SPACING));
}

function isLanded(state: LiveMovementState): { readonly landed: boolean; readonly distance: number } {
  const distance = chunkJumpDistanceFromX(state.x);
  return {
    landed: Math.abs(state.y - FEET_Y) < 8 && Math.abs(state.x - worldX(distance)) < 14,
    distance,
  };
}

export default class ChunkJumpRaceScene extends Phaser.Scene {
  private readonly options: SceneOptions;
  private readonly remotes = new Map<string, BlobActor>();
  private localActor: BlobActor | null = null;
  private localDistance: number;
  private localState: LiveMovementState;
  private motion: Motion | null = null;
  private backdrop!: RaceBackdrop;
  private course!: RaceCourse;
  private effects!: Effects;
  private leaderLines!: Phaser.GameObjects.Graphics;
  private landedAt = new Set<string>();

  constructor(options: SceneOptions) {
    super("chunk-jump-race");
    this.options = options;
    this.localDistance = Math.max(0, Math.floor(options.initialDistance ?? 0));
    this.localState = chunkJumpLandedState(this.localDistance);
  }

  create(): void {
    ensureSharedTextures(this);
    this.fitCamera();
    this.backdrop = new RaceBackdrop(this, CHUNK_JUMP_VIEW_HEIGHT);
    this.course = new RaceCourse(this);
    this.effects = new Effects(this);
    this.leaderLines = this.add.graphics().setDepth(16);
    if (this.options.localPlayer) {
      this.localActor = new BlobActor(this, this.options.localPlayer.id, true);
      this.localActor.setTag(`★ ${compactLabel(this.options.localPlayer.label, 10)}`);
    }
    const camera = this.cameras.main;
    const start = this.localActor ? this.cameraTargetX(this.localState.x) : this.cameraTargetX(PLATFORM_START_X);
    camera.centerOn(start, this.cameraTargetY());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.remotes.clear();
      this.motion = null;
    });
  }

  override update(time: number, delta: number): void {
    if (this.options.mode === "student") this.updateLocalMotion(time);
    const frames = this.options.samplePlayers();
    this.renderPlayers(frames, time, delta);
    this.updateCamera(frames);
    const camera = this.cameras.main;
    const visibleWidth = camera.width / camera.zoom;
    this.course.draw(camera.midPoint.x - visibleWidth / 2, visibleWidth, time);
    this.backdrop.update(camera.scrollX);
  }

  jumpForward(): boolean {
    if (!this.localActor || this.motion) return false;
    this.localActor.squash(this.time.now, JUMP_SQUASH_MS);
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
    this.localActor.flash(0xff6b6b);
    this.effects.wrong(worldX(this.localDistance), FEET_Y - 24);
    this.cameras.main.shake(120, 0.008, true);
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

  private onResize(): void {
    this.fitCamera();
    this.backdrop.resize(this);
  }

  private fitCamera(): void {
    const camera = this.cameras.main;
    camera.setSize(this.scale.width, this.scale.height);
    const base = this.options.mode === "student" ? STUDENT_ZOOM : TEACHER_ZOOM;
    camera.setZoom(base * this.scale.height / CHUNK_JUMP_VIEW_HEIGHT);
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
      this.localState = { x: fromX, y: FEET_Y, vx: 0, vy: 0 };
      return;
    }
    const raw = Math.min(1, (elapsed - JUMP_SQUASH_MS) / JUMP_FLY_MS);
    if (raw > 0 && this.localState.vy === 0) this.effects.jumpPuff(fromX, FEET_Y);
    const travel = Phaser.Math.Easing.Sine.InOut(raw);
    this.localState = {
      x: Phaser.Math.Linear(fromX, toX, travel),
      y: FEET_Y - Math.sin(Math.PI * raw) * JUMP_HEIGHT,
      vx: raw < 1 ? PLATFORM_SPACING / (JUMP_FLY_MS / 1_000) : 0,
      vy: raw < 0.5 ? -AIR_SPEED : raw < 1 ? AIR_SPEED : 0,
    };
    if (raw < 1) return;
    this.localDistance = motion.toDistance;
    this.localState = chunkJumpLandedState(this.localDistance);
    this.motion = null;
    this.effects.correct(toX, FEET_Y - 30);
    this.cameras.main.shake(70, 0.004, true);
    this.options.onSettled("correct", this.localDistance);
  }

  private updateWrongMotion(time: number, motion: Extract<Motion, { readonly kind: "wrong" }>): void {
    const actor = this.localActor;
    if (!actor) return;
    const elapsed = Math.max(0, time - motion.startedAt);
    const fromX = worldX(motion.fromDistance);
    const fallStart = WRONG_SQUASH_MS;
    const hideStart = fallStart + WRONG_FALL_MS;
    const respawnStart = hideStart + WRONG_HIDE_MS;
    const finishAt = respawnStart + WRONG_RESPAWN_MS;

    if (elapsed < fallStart) {
      this.localState = { x: fromX, y: FEET_Y, vx: 0, vy: 0 };
      return;
    }
    if (elapsed < hideStart) {
      // Stumble off the front edge and drop into the mist.
      const raw = (elapsed - fallStart) / WRONG_FALL_MS;
      this.localState = { x: fromX + raw * 40, y: FEET_Y - Math.sin(raw * Math.PI) * 24 + raw * raw * 220, vx: 120, vy: 700 * raw };
      return;
    }
    if (elapsed < respawnStart) {
      this.localState = { x: fromX + 40, y: FEET_Y + 260, vx: 0, vy: 0 };
      return;
    }
    // Pop back in from above the respawn island.
    const raw = Math.min(1, (elapsed - respawnStart) / WRONG_RESPAWN_MS);
    const target = worldX(motion.toDistance);
    this.localState = { x: target, y: FEET_Y - (1 - raw) * 60, vx: 0, vy: raw < 1 ? AIR_SPEED : 0 };
    if (elapsed < finishAt) return;
    this.localDistance = motion.toDistance;
    this.localState = chunkJumpLandedState(this.localDistance);
    this.effects.landingDust(target, FEET_Y);
    this.motion = null;
    this.options.onSettled("wrong", this.localDistance);
  }

  private renderPlayers(frames: readonly LiveRemoteFrame[], time: number, delta: number): void {
    const entries: Entry[] = [];
    const selfId = this.options.localPlayer?.id;
    if (this.localActor && selfId) entries.push({ id: selfId, state: this.localState, actor: this.localActor, self: true });
    const visible = new Set<string>();
    for (const frame of frames) {
      if (frame.playerId === selfId) continue;
      const label = this.options.playerLabel(frame.playerId);
      if (!label) continue;
      visible.add(frame.playerId);
      let actor = this.remotes.get(frame.playerId);
      if (!actor) {
        actor = new BlobActor(this, frame.playerId, false);
        this.remotes.set(frame.playerId, actor);
      }
      actor.setTag(compactLabel(label, 7));
      entries.push({ id: frame.playerId, state: frame, actor, self: false });
    }
    for (const [id, actor] of this.remotes) {
      if (visible.has(id)) continue;
      actor.destroy();
      this.remotes.delete(id);
    }

    // Group runners standing on the same island so nobody's nickname is hidden.
    const crowds = new Map<number, Entry[]>();
    for (const entry of entries) {
      const { landed, distance } = isLanded(entry.state);
      if (!landed) continue;
      const crowd = crowds.get(distance) ?? [];
      crowd.push(entry);
      crowds.set(distance, crowd);
    }
    const placements = new Map<string, { readonly bodyX: number; readonly tagX: number; readonly tagY: number }>();
    for (const crowd of crowds.values()) {
      const order = orderCrowd(crowd.map((entry) => entry.id), selfId);
      const slots = crowdSlots(order.length, order[0] === selfId);
      order.forEach((id, index) => {
        const slot = slots[index];
        if (slot) placements.set(id, slot);
      });
    }

    this.leaderLines.clear();
    const nowLanded = new Set<string>();
    for (const entry of entries) {
      const placement = placements.get(entry.id);
      const bodyX = placement?.bodyX ?? 0;
      const alpha = entry.self && this.motion?.kind === "wrong" && entry.state.y > FEET_Y + 200 ? 0 : 1;
      entry.actor.update({
        x: entry.state.x + bodyX,
        feetY: entry.state.y,
        vx: entry.state.vx,
        vy: entry.state.vy,
        alpha,
        ...(entry.state.y <= FEET_Y + 4 ? { groundY: FEET_Y } : {}),
      }, time, delta);
      const tagX = placement ? placement.tagX - bodyX : 0;
      const tagY = placement?.tagY ?? BLOB_TAG_Y;
      entry.actor.tag.setPosition(tagX, tagY);
      if (placement && (tagX !== 0 || tagY !== BLOB_TAG_Y)) {
        // Thin leader line from the tag to its owner's head keeps crowded islands readable.
        const x = entry.state.x + bodyX;
        this.leaderLines.lineStyle(entry.self ? 2 : 1.5, playerColor(entry.id), entry.self ? 0.8 : 0.55);
        this.leaderLines.lineBetween(x + tagX, entry.state.y + tagY + 7, x, entry.state.y - 42);
      }
      if (placement) nowLanded.add(entry.id);
      if (!entry.self && placement && !this.landedAt.has(entry.id)) this.effects.landingDust(entry.state.x + bodyX, FEET_Y);
    }
    this.landedAt = nowLanded;
  }

  private cameraTargetX(focusX: number): number {
    const camera = this.cameras.main;
    const visibleWidth = camera.width / camera.zoom;
    const anchor = this.localActor ? 0.3 : 0.5;
    return Math.max(visibleWidth / 2, focusX - visibleWidth * anchor + visibleWidth / 2);
  }

  /** Islands sit in the lower third; the question panel covers the sky above. */
  private cameraTargetY(): number {
    const camera = this.cameras.main;
    const visibleHeight = camera.height / camera.zoom;
    return FEET_Y - visibleHeight * (this.localActor ? 0.2 : 0.12);
  }

  private updateCamera(frames: readonly LiveRemoteFrame[]): void {
    const camera = this.cameras.main;
    let focusX = PLATFORM_START_X;
    let ease = 0.22;
    if (!this.localActor) {
      const leader = frames
        .filter((frame) => this.options.playerLabel(frame.playerId))
        .reduce<LiveRemoteFrame | null>((best, frame) => !best || frame.x > best.x ? frame : best, null);
      focusX = leader?.x ?? PLATFORM_START_X;
      ease = 0.08;
    } else if (this.motion?.kind === "correct") {
      focusX = worldX(this.motion.toDistance);
      ease = 0.3;
    } else if (this.motion?.kind === "wrong") {
      const elapsed = Math.max(0, this.time.now - this.motion.startedAt);
      const moveAt = WRONG_SQUASH_MS + WRONG_FALL_MS + WRONG_HIDE_MS;
      focusX = worldX(elapsed < moveAt ? this.motion.fromDistance : this.motion.toDistance);
      ease = elapsed < moveAt ? 0.12 : 0.4;
    } else {
      focusX = this.localState.x;
    }
    const x = Phaser.Math.Linear(camera.midPoint.x, this.cameraTargetX(focusX), ease);
    const y = Phaser.Math.Linear(camera.midPoint.y, this.cameraTargetY(), 0.2);
    camera.centerOn(x, y);
  }
}
