import Phaser from "phaser";
import { clearPlatformerInput, createJumpState, takeJump, type PlatformerInput } from "../platformer/movement.ts";
import { ensureSharedTextures, playerColor } from "../phaser-kit/art.ts";
import { BlobActor, compactLabel } from "../phaser-kit/BlobActor.ts";
import { Effects } from "../phaser-kit/Effects.ts";
import { BUFF_EFFECT, type ActiveBuff, type ItemClaim } from "../platformer-party/buffs.ts";
import { PowerUpLayer } from "../platformer-party/PowerUpLayer.ts";
import { PUNCH_COOLDOWN_MS, PUNCH_EVENT, PUNCH_KNOCKBACK_MAX_SPEED, PUNCH_KNOCKBACK_MS, choosePunchTarget, encodePunch, punchKnockback } from "../platformer-party/punch.ts";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import type { LiveEvent } from "../../live-world/events.ts";
import {
  CLIMB_JUMP_PAD_VELOCITY,
  CLIMB_PLAYER_HEIGHT,
  CLIMB_PLAYER_WIDTH,
  CLIMB_WORLD_WIDTH,
  climbFloorAt,
  climbItemKindOf,
  climbItemsAt,
  type ClimbCourseSource,
  type ClimbPlatform,
} from "./course.ts";
import { ClimbBackdrop } from "./scene/ClimbBackdrop.ts";
import { ClimbCourseView } from "./scene/ClimbCourseView.ts";

const RUN_SPEED = 300;
const GROUND_ACCELERATION = 2_600;
const AIR_ACCELERATION = 1_700;
const GROUND_DRAG = 2_800;
const AIR_DRAG = 700;
const DROP_THROUGH_MS = 240;
const VIEW_HEIGHT = 620;
const SHATTER_EVENT = "tower-shatter";
const RESPAWN_MS = 2_000;

export interface ClimbStanding {
  readonly playerId: string;
  readonly label: string;
  readonly floor: number;
  readonly self: boolean;
}

export interface ClimbSceneOptions {
  readonly mode?: "student" | "teacher";
  readonly courseSource?: ClimbCourseSource | undefined;
  readonly initialBest?: number;
  readonly rules?: {
    readonly canLand: (platform: ClimbPlatform) => boolean;
    readonly onLand: (platform: ClimbPlatform) => boolean;
    readonly respawnState: () => LiveMovementState;
    readonly onDeath: (dead: boolean) => void;
    readonly isActive: () => boolean;
    readonly onReset: () => void;
  } | undefined;
  readonly seed: string;
  readonly input: PlatformerInput;
  readonly localPlayer: { readonly id: string; readonly label: string };
  readonly initialState: LiveMovementState;
  readonly nowMs: () => number;
  readonly publish: (state: LiveMovementState) => void;
  readonly samplePlayers: () => readonly LiveRemoteFrame[];
  readonly playerLabel: (playerId: string) => string | undefined;
  readonly publishEvent: (kind: string, target: string, value: number) => void;
  readonly claimItem: (id: string) => Promise<boolean>;
  readonly onBuffsChange: (buffs: readonly ActiveBuff[]) => void;
  readonly onHeight: (floor: number, best: number) => void;
  readonly onStandings: (standings: readonly ClimbStanding[]) => void;
}

/** The endless lobby climb: local physics plus shared punches and power-ups. */
export default class ClimbScene extends Phaser.Scene {
  private readonly options: ClimbSceneOptions;
  private course!: ClimbCourseView;
  private backdrop!: ClimbBackdrop;
  private effects!: Effects;
  private powerUps: PowerUpLayer | undefined;
  private earlyClaims: ItemClaim[] = [];
  private player!: Phaser.GameObjects.Zone;
  private body!: Phaser.Physics.Arcade.Body;
  private actor!: BlobActor;
  private readonly remotes = new Map<string, BlobActor>();
  private readonly remoteRespawns = new Map<string, number>();
  private lastFrames: readonly LiveRemoteFrame[] = [];
  private jump = createJumpState();
  private wasGrounded = false;
  private dropUntil = 0;
  private knockedUntil = 0;
  private punchReadyAt = 0;
  private floor = 0;
  private best = 0;
  private nextStandingsAt = 0;
  private dead = false;
  private respawnAt = 0;
  private landedIndex: number | null = null;

  constructor(options: ClimbSceneOptions) {
    super("lobby-climb");
    this.options = options;
  }

  create(): void {
    ensureSharedTextures(this);
    this.backdrop = new ClimbBackdrop(this, !this.options.courseSource);
    this.course = new ClimbCourseView(this, this.options.seed, this.options.courseSource);
    this.effects = new Effects(this);
    this.powerUps = new PowerUpLayer(this, this.effects, {
      source: {
        itemsAt: (nowMs) => this.options.courseSource?.itemsAt(nowMs, this.focusFloor()) ?? climbItemsAt(this.options.seed, nowMs, this.focusFloor()),
        kindOf: (id) => this.options.courseSource ? this.options.courseSource.kindOf(id) : climbItemKindOf(this.options.seed, id),
      },
      localPlayerId: this.options.localPlayer.id,
      nowMs: this.options.nowMs,
      claimItem: this.options.claimItem,
      onBuffsChange: this.options.onBuffsChange,
    });
    this.earlyClaims.forEach((claim) => this.powerUps?.receiveClaim(claim));
    this.earlyClaims = [];

    // Side walls only; the tower is open upwards forever.
    this.physics.world.setBounds(0, -1e7, CLIMB_WORLD_WIDTH, 1e7 + 400, true, true, false, false);
    const ground = this.add.zone(CLIMB_WORLD_WIDTH / 2, 40, CLIMB_WORLD_WIDTH + 400, 80);
    this.physics.add.existing(ground, true);

    const initial = this.options.initialState;
    if (this.options.courseSource) {
      this.floor = climbFloorAt(initial.y + CLIMB_PLAYER_HEIGHT / 2);
      this.best = this.options.initialBest ?? this.floor;
      this.options.onHeight(this.floor, this.best);
    }
    this.player = this.add.zone(initial.x, initial.y, CLIMB_PLAYER_WIDTH, CLIMB_PLAYER_HEIGHT);
    this.physics.add.existing(this.player);
    this.body = this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true).setMaxVelocity(RUN_SPEED, 1_100).setDragX(GROUND_DRAG);
    const landOn = (_player: unknown, platform: unknown): boolean => this.canLandOn(platform);
    this.physics.add.collider(this.player, ground);
    this.physics.add.collider(this.player, this.course.statics, undefined, landOn);
    this.physics.add.collider(this.player, this.course.movers, undefined, landOn);
    this.actor = new BlobActor(this, this.options.localPlayer.id, true);
    this.actor.setTag(`★ ${compactLabel(this.options.localPlayer.label, 10)}`);
    if (this.options.mode === "teacher") {
      this.body.enable = false;
      this.actor.container.setVisible(false);
    }

    this.fitCamera();
    this.cameras.main.centerOn(initial.x, initial.y - 80);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    const stop = (): void => {
      clearPlatformerInput(this.options.input);
      this.body.setAccelerationX(0).setVelocityX(0);
    };
    this.game.events.on(Phaser.Core.Events.BLUR, stop);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, stop);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
      clearPlatformerInput(this.options.input);
      this.remotes.clear();
    });
  }

  /** ↓: drop through the platform underfoot. */
  dropDown(): void {
    if (this.dead || this.options.rules && !this.options.rules.isActive()) return;
    if (!this.body.blocked.down || this.body.bottom >= -2) return;
    this.dropUntil = this.time.now + DROP_THROUGH_MS;
    this.body.setVelocityY(60);
  }

  punch(): void {
    if (!this.actor || this.dead || this.options.rules && !this.options.rules.isActive()) return;
    if (this.time.now < this.punchReadyAt) return;
    this.punchReadyAt = this.time.now + PUNCH_COOLDOWN_MS;
    const facing = this.actor.facingDirection;
    this.actor.punch(this.time.now, facing);
    const target = choosePunchTarget(
      { x: this.body.center.x, y: this.body.center.y, facing },
      this.lastFrames.filter((frame) => frame.playerId !== this.options.localPlayer.id),
    );
    const powered = this.powerUps?.has("punch") ?? false;
    this.options.publishEvent(PUNCH_EVENT, target?.playerId ?? "", encodePunch(facing, powered));
    if (target) {
      this.effects.punchHit(target.x, target.y - 6, powered);
      this.remotes.get(target.playerId)?.recoil(this.time.now, facing);
    }
  }

  receiveEvent(event: LiveEvent): void {
    if (event.kind === SHATTER_EVENT && this.options.courseSource) {
      this.remoteRespawns.set(event.playerId, this.options.nowMs() + RESPAWN_MS);
      const frame = this.lastFrames.find((entry) => entry.playerId === event.playerId);
      if (frame) this.shatterPieces(frame.x, frame.y, event.playerId);
      return;
    }
    if (event.kind !== PUNCH_EVENT || !this.body || this.dead || this.options.rules && !this.options.rules.isActive()) return;
    const powered = Math.abs(event.value) >= 2;
    this.remotes.get(event.playerId)?.punch(this.time.now, event.value < 0 ? -1 : 1);
    if (event.target === this.options.localPlayer.id) {
      const knockback = punchKnockback(event.value);
      this.body.setVelocity(knockback.vx, knockback.vy);
      this.knockedUntil = this.time.now + PUNCH_KNOCKBACK_MS;
      // Lift the speed cap now: physics steps before our next update and would clamp the hit.
      this.body.setMaxVelocity(PUNCH_KNOCKBACK_MAX_SPEED, 1_100);
      this.actor.recoil(this.time.now, event.value);
      this.effects.punchHit(this.body.center.x, this.body.center.y - 6, powered);
      this.cameras.main.shake(90, powered ? 0.008 : 0.004);
      return;
    }
    const victim = this.lastFrames.find((frame) => frame.playerId === event.target);
    if (victim) this.effects.punchHit(victim.x, victim.y - 6, powered);
    this.remotes.get(event.target)?.recoil(this.time.now, event.value);
  }

  receiveClaim(claim: ItemClaim): void {
    // Claims can arrive before create(); keep them until the power-up layer exists.
    if (this.powerUps) this.powerUps.receiveClaim(claim);
    else this.earlyClaims.push(claim);
  }

  override update(time: number, delta: number): void {
    const now = this.options.nowMs();
    this.lastFrames = this.options.samplePlayers();
    if (this.options.mode === "teacher") {
      const leader = [...this.lastFrames].filter((frame) => this.options.playerLabel(frame.playerId)).sort((a, b) => a.y - b.y)[0];
      if (leader) this.body.reset(leader.x, leader.y);
      this.body.enable = false;
    }
    // Build the tower around where the player *is*, not the last floor they stood on:
    // otherwise a long fall outruns the window and drops through empty sky to the ground.
    this.course.update(this.focusFloor(), now);
    if (this.options.mode !== "teacher") this.updateLocalPlayer(time, delta);
    this.updateActors(time, delta);
    this.powerUps?.update(time, this.dead || this.options.mode === "teacher" || this.options.rules && !this.options.rules.isActive() ? null : { x: this.body.center.x, y: this.body.center.y });
    this.followPlayer(delta);
    this.backdrop.update();
    if (time >= this.nextStandingsAt) {
      this.nextStandingsAt = time + 500;
      this.reportStandings();
    }
  }

  /** Floor at the player's current height (airborne or not). */
  private focusFloor(): number {
    return this.body ? climbFloorAt(this.body.bottom) : this.floor;
  }

  private fitCamera(): void {
    const camera = this.cameras.main;
    camera.setSize(this.scale.width, this.scale.height);
    const byWidth = this.scale.width / (CLIMB_WORLD_WIDTH + 120);
    const byHeight = this.scale.height / VIEW_HEIGHT;
    camera.setZoom(Phaser.Math.Clamp(Math.min(byWidth, byHeight), 0.55, 1.6));
  }

  private followPlayer(delta: number): void {
    const camera = this.cameras.main;
    const halfWidth = camera.width / camera.zoom / 2;
    const targetX = halfWidth * 2 >= CLIMB_WORLD_WIDTH + 40
      ? CLIMB_WORLD_WIDTH / 2
      : Phaser.Math.Clamp(this.body.center.x, halfWidth - 40, CLIMB_WORLD_WIDTH + 40 - halfWidth);
    // Keep the player a bit below centre: the way up is what matters.
    const targetY = Math.min(this.body.center.y - 70, 60 - camera.height / camera.zoom / 2);
    const blend = Math.min(1, delta / 110);
    camera.centerOn(
      camera.midPoint.x + (targetX - camera.midPoint.x) * blend,
      camera.midPoint.y + (targetY - camera.midPoint.y) * blend,
    );
  }

  private canLandOn(platform: unknown): boolean {
    if (this.time.now < this.dropUntil || this.body.velocity.y < 0) return false;
    const platformBody = (platform as Phaser.GameObjects.Zone).body as { readonly top: number } | null;
    const definition = (platform as Phaser.GameObjects.Zone).getData("climbPlatform") as ClimbPlatform | undefined;
    if (definition && this.options.rules && !this.options.rules.canLand(definition)) return false;
    return platformBody !== null && this.body.bottom - this.body.deltaY() <= platformBody.top + 6;
  }

  private updateLocalPlayer(time: number, delta: number): void {
    const body = this.body;
    const input = this.options.input;
    const rules = this.options.rules;
    if (this.dead && this.options.nowMs() >= this.respawnAt) this.respawn();
    if (this.dead || rules && !rules.isActive()) {
      clearPlatformerInput(input);
      body.setAccelerationX(0).setVelocity(0, 0).setAllowGravity(false);
      return;
    }
    body.setAllowGravity(true);
    const platform = body.blocked.down ? this.course.platformAt(body.left, body.right, body.bottom) : null;
    if (rules && platform && platform.index !== this.landedIndex) {
      this.landedIndex = platform.index;
      if (!rules.onLand(platform)) { this.shatter(); return; }
    }
    if (!body.blocked.down) this.landedIndex = null;
    if (rules && body.center.y > rules.respawnState().y + 150) { this.shatter(); return; }
    if (input.resetQueued) {
      input.resetQueued = false;
      rules?.onReset();
      const resetState = rules?.respawnState() ?? this.options.initialState;
      body.reset(resetState.x, resetState.y);
      this.jump = createJumpState();
      this.landedIndex = null;
    }
    const directions = [...input.held.values()];
    const left = directions.includes("left");
    const right = directions.includes("right");
    const grounded = body.blocked.down;
    const knocked = time < this.knockedUntil;
    const speedBoost = this.powerUps?.has("speed") ? BUFF_EFFECT.speed.runMultiplier : 1;
    body.setMaxVelocity(knocked ? PUNCH_KNOCKBACK_MAX_SPEED : RUN_SPEED * speedBoost, 1_100);
    // A knocked player flies freely for a moment; steering would cancel the hit.
    const steer = knocked ? 0 : Number(right) - Number(left);
    body.setAccelerationX(steer * (grounded ? GROUND_ACCELERATION : AIR_ACCELERATION) * speedBoost);
    if (grounded && !knocked && ((right && body.velocity.x < 0) || (left && body.velocity.x > 0))) body.setVelocityX(body.velocity.x * 0.5);
    body.setDragX(grounded && !knocked && !left && !right ? GROUND_DRAG : AIR_DRAG);
    if (grounded) body.x += this.course.carrySpeedAt(body.center.x, body.bottom) * (delta / 1_000);

    const pad = grounded ? this.course.padAt(body.center.x, body.bottom) : null;
    if (pad !== null) {
      body.setVelocityY(CLIMB_JUMP_PAD_VELOCITY);
      this.jump = createJumpState();
      this.course.bouncePad(pad);
      this.effects.jumpPuff(body.center.x, body.bottom);
    } else {
      const jumpVelocity = takeJump(this.jump, grounded, input.jumpQueued, time);
      if (jumpVelocity !== null) {
        body.setVelocityY(jumpVelocity * (this.powerUps?.has("jump") ? BUFF_EFFECT.jump.jumpMultiplier : 1));
        this.effects.jumpPuff(body.center.x, body.bottom);
      }
    }
    input.jumpQueued = false;
    if (grounded && !this.wasGrounded) this.effects.landingDust(body.center.x, body.bottom);
    this.wasGrounded = grounded;

    if (grounded) {
      const floor = climbFloorAt(body.bottom);
      if (floor !== this.floor || floor > this.best) {
        this.floor = floor;
        this.best = Math.max(this.best, floor);
        this.options.onHeight(this.floor, this.best);
      }
    }
    this.options.publish({ x: body.center.x, y: body.center.y, vx: body.velocity.x, vy: body.velocity.y });
  }

  private shatter(): void {
    this.dead = true;
    this.respawnAt = this.options.nowMs() + RESPAWN_MS;
    const { x, y } = this.body.center;
    this.body.stop().setAllowGravity(false);
    this.body.enable = false;
    this.actor.container.setVisible(false);
    clearPlatformerInput(this.options.input);
    this.options.rules?.onDeath(true);
    this.options.publishEvent(SHATTER_EVENT, "", 0);
    this.shatterPieces(x, y, this.options.localPlayer.id);
  }

  private shatterPieces(x: number, y: number, playerId: string): void {
    // Soft coloured pieces use the same colour as the blob, without blood or gore.
    for (let index = 0; index < 16; index += 1) {
      const piece = this.add.rectangle(x, y - 10, 7, 7, playerColor(playerId)).setDepth(30);
      this.tweens.add({ targets: piece, x: x + Phaser.Math.Between(-100, 100), y: y + Phaser.Math.Between(-65, 90),
        angle: Phaser.Math.Between(-180, 180), alpha: 0, duration: 700, onComplete: () => piece.destroy() });
    }
  }

  private respawn(): void {
    const state = this.options.rules!.respawnState();
    this.body.enable = true;
    this.body.reset(state.x, state.y);
    this.body.setAllowGravity(true);
    this.actor.container.setVisible(true);
    this.jump = createJumpState();
    this.landedIndex = null;
    this.wasGrounded = false;
    this.dead = false;
    this.options.rules?.onDeath(false);
    this.options.publish(state);
  }

  private updateActors(time: number, delta: number): void {
    const localId = this.options.localPlayer.id;
    if (this.options.mode !== "teacher") this.actor.update({
      x: this.body.center.x,
      feetY: this.body.bottom,
      vx: this.body.velocity.x,
      vy: this.body.velocity.y,
    }, time, delta);
    this.powerUps?.trail(localId, this.body.center.x, this.body.bottom, this.body.velocity.x, time);
    const visible = new Set<string>();
    for (const frame of this.lastFrames) {
      if (frame.playerId === localId) continue;
      const label = this.options.playerLabel(frame.playerId);
      if (!label) continue;
      visible.add(frame.playerId);
      let actor = this.remotes.get(frame.playerId);
      if (!actor) {
        actor = new BlobActor(this, frame.playerId, false);
        this.remotes.set(frame.playerId, actor);
      }
      const feetY = frame.y + CLIMB_PLAYER_HEIGHT / 2;
      actor.setTag(`${compactLabel(label, 8)} · ${climbFloorAt(feetY)}층`);
      actor.update({ x: frame.x, feetY, vx: frame.vx, vy: frame.vy }, time, delta);
      const respawnAt = this.remoteRespawns.get(frame.playerId) ?? 0;
      actor.container.setVisible(this.options.nowMs() >= respawnAt);
      if (this.options.nowMs() >= respawnAt) this.remoteRespawns.delete(frame.playerId);
      this.powerUps?.trail(frame.playerId, frame.x, feetY, frame.vx, time);
    }
    for (const [id, actor] of this.remotes) {
      if (visible.has(id)) continue;
      actor.destroy();
      this.remotes.delete(id);
      this.remoteRespawns.delete(id);
    }
  }

  private reportStandings(): void {
    const standings: ClimbStanding[] = this.options.mode === "teacher" ? [] : [{
      playerId: this.options.localPlayer.id,
      label: this.options.localPlayer.label,
      floor: this.floor,
      self: true,
    }];
    for (const frame of this.lastFrames) {
      const label = this.options.playerLabel(frame.playerId);
      if (!label || frame.playerId === this.options.localPlayer.id) continue;
      standings.push({ playerId: frame.playerId, label, floor: climbFloorAt(frame.y + CLIMB_PLAYER_HEIGHT / 2), self: false });
    }
    standings.sort((left, right) => right.floor - left.floor || left.label.localeCompare(right.label, "ko-KR"));
    this.options.onStandings(standings);
  }
}
