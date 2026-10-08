import Phaser from "phaser";
import { CLIMB_JUMP_PAD_VELOCITY, CLIMB_PLAYER_HEIGHT, CLIMB_PLAYER_WIDTH } from "../../game-engine/jump-tower/course.ts";
import { ClimbCourseView } from "../../game-engine/jump-tower/scene/ClimbCourseView.ts";
import { ensureSharedTextures, playerColor } from "../../game-engine/phaser-kit/art.ts";
import { BlobActor, compactLabel } from "../../game-engine/phaser-kit/BlobActor.ts";
import { Effects } from "../../game-engine/phaser-kit/Effects.ts";
import { clearPlatformerInput, createJumpState, takeJump, type PlatformerInput } from "../../game-engine/platformer/movement.ts";
import { PUNCH_COOLDOWN_MS, PUNCH_EVENT, PUNCH_KNOCKBACK_MS, choosePunchTarget, encodePunch } from "../../game-engine/platformer-party/punch.ts";
import { launchFromPunch, PLATFORMER_MAX_FALL_SPEED, PLATFORMER_RUN_SPEED, steerPlatformerBody } from "../../game-engine/platformer/steering.ts";
import type { LiveEvent } from "../../live-world/client.ts";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import { ARENA_COURSE, ARENA_LAVA_Y, ARENA_VIEW_HEIGHT, ARENA_WIDTH, DEATHMATCH_RESPAWN_MS, arenaSpawnPoint, isInLava } from "./arena.ts";
import { createKillCredit } from "./killCredit.ts";
import { LavaView } from "./scene/LavaView.ts";
import { PusherView } from "./scene/PusherView.ts";

/** Broadcast by a player who fell in; `target` names whoever gets the kill ("" for none). */
export const DEATH_EVENT = "dm-death";
const DROP_THROUGH_MS = 240;
const BLINK_MS = 1_200;

export interface DeathmatchSceneOptions {
  readonly localPlayer: { readonly id: string; readonly label: string };
  /** First spawn position (body centre); later respawns pick their own. */
  readonly spawn: { readonly x: number; readonly y: number };
  readonly input: PlatformerInput;
  /** Shared server clock: moving platforms and pushers line up on every screen. */
  readonly nowMs: () => number;
  readonly publish: (state: LiveMovementState) => void;
  readonly samplePlayers: () => readonly LiveRemoteFrame[];
  readonly playerLabel: (playerId: string) => string | undefined;
  readonly publishEvent: (kind: string, target: string, value: number) => void;
  /** Someone fell into the lava; `killerId` is null for a fall nobody caused. */
  readonly onDeath: (victimId: string, killerId: string | null) => void;
}

/** The lobby deathmatch: one screen of platforms over lava, punch others in. */
export default class DeathmatchScene extends Phaser.Scene {
  private readonly options: DeathmatchSceneOptions;
  private course!: ClimbCourseView;
  private pushers!: PusherView;
  private lava!: LavaView;
  private effects!: Effects;
  private player!: Phaser.GameObjects.Zone;
  private body!: Phaser.Physics.Arcade.Body;
  private actor!: BlobActor;
  private readonly remotes = new Map<string, BlobActor>();
  private readonly remoteRespawnAt = new Map<string, number>();
  private readonly killCredit = createKillCredit();
  private lastFrames: readonly LiveRemoteFrame[] = [];
  private jump = createJumpState();
  private wasGrounded = false;
  private dropUntil = 0;
  private knockedUntil = 0;
  private punchReadyAt = 0;
  private respawnAt: number | null = null;
  private blinkUntil = 0;

  constructor(options: DeathmatchSceneOptions) {
    super("lobby-deathmatch");
    this.options = options;
  }

  create(): void {
    ensureSharedTextures(this);
    this.lava = new LavaView(this);
    this.course = new ClimbCourseView(this, "deathmatch", ARENA_COURSE);
    this.pushers = new PusherView(this);
    this.effects = new Effects(this);
    // Side walls only; the top is open and the lava is handled by `isInLava`.
    this.physics.world.setBounds(0, ARENA_LAVA_Y - 4_000, ARENA_WIDTH, 4_400, true, true, false, false);

    const { spawn } = this.options;
    this.player = this.add.zone(spawn.x, spawn.y, CLIMB_PLAYER_WIDTH, CLIMB_PLAYER_HEIGHT);
    this.physics.add.existing(this.player);
    this.body = this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true).setMaxVelocity(PLATFORMER_RUN_SPEED, PLATFORMER_MAX_FALL_SPEED);
    const landOn = (_player: unknown, platform: unknown): boolean => this.canLandOn(platform);
    this.physics.add.collider(this.player, this.course.statics, undefined, landOn);
    this.physics.add.collider(this.player, this.course.movers, undefined, landOn);
    this.physics.add.collider(this.player, this.pushers.group);
    this.actor = new BlobActor(this, this.options.localPlayer.id, true);
    this.actor.setTag(`★ ${compactLabel(this.options.localPlayer.label, 10)}`);
    this.blinkUntil = this.time.now + BLINK_MS;

    this.fitCamera();
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
    if (this.respawnAt !== null || !this.body.blocked.down) return;
    this.dropUntil = this.time.now + DROP_THROUGH_MS;
    this.body.setVelocityY(60);
  }

  punch(): void {
    if (!this.actor || this.respawnAt !== null || this.time.now < this.punchReadyAt) return;
    this.punchReadyAt = this.time.now + PUNCH_COOLDOWN_MS;
    const facing = this.actor.facingDirection;
    this.actor.punch(this.time.now, facing);
    const target = choosePunchTarget(
      { x: this.body.center.x, y: this.body.center.y, facing },
      this.lastFrames.filter((frame) => this.isRemoteAlive(frame.playerId)),
    );
    this.options.publishEvent(PUNCH_EVENT, target?.playerId ?? "", encodePunch(facing, false));
    if (!target) return;
    this.effects.punchHit(target.x, target.y - 6, false);
    this.remotes.get(target.playerId)?.recoil(this.time.now, facing);
  }

  receiveEvent(event: LiveEvent): void {
    if (event.kind === DEATH_EVENT) {
      this.remoteRespawnAt.set(event.playerId, this.options.nowMs() + DEATHMATCH_RESPAWN_MS);
      const frame = this.lastFrames.find((entry) => entry.playerId === event.playerId);
      if (frame) this.burst(frame.x, frame.y, event.playerId);
      this.options.onDeath(event.playerId, event.target || null);
      return;
    }
    if (event.kind !== PUNCH_EVENT || !this.body) return;
    this.remotes.get(event.playerId)?.punch(this.time.now, event.value < 0 ? -1 : 1);
    if (event.target === this.options.localPlayer.id) {
      if (this.respawnAt !== null) return;
      launchFromPunch(this.body, event.value);
      this.knockedUntil = this.time.now + PUNCH_KNOCKBACK_MS;
      this.killCredit.hitBy(event.playerId, this.options.nowMs());
      this.actor.recoil(this.time.now, event.value);
      this.effects.punchHit(this.body.center.x, this.body.center.y - 6, false);
      this.cameras.main.shake(90, 0.005);
      return;
    }
    const victim = this.lastFrames.find((frame) => frame.playerId === event.target);
    if (victim) this.effects.punchHit(victim.x, victim.y - 6, false);
    this.remotes.get(event.target)?.recoil(this.time.now, event.value);
  }

  override update(time: number, delta: number): void {
    const now = this.options.nowMs();
    this.lastFrames = this.options.samplePlayers();
    this.course.update(0, now);
    this.pushers.update(now);
    this.lava.update(time);
    this.updateLocalPlayer(time, delta, now);
    this.updateActors(time, delta, now);
  }

  private fitCamera(): void {
    const camera = this.cameras.main;
    camera.setSize(this.scale.width, this.scale.height);
    const zoom = Math.min(this.scale.width / (ARENA_WIDTH + 40), this.scale.height / (ARENA_VIEW_HEIGHT + 60));
    camera.setZoom(Phaser.Math.Clamp(zoom, 0.3, 2));
    camera.centerOn(ARENA_WIDTH / 2, ARENA_LAVA_Y - ARENA_VIEW_HEIGHT / 2 + 30);
  }

  private canLandOn(platform: unknown): boolean {
    if (this.time.now < this.dropUntil || this.body.velocity.y < 0) return false;
    const platformBody = (platform as Phaser.GameObjects.Zone).body as { readonly top: number } | null;
    return platformBody !== null && this.body.bottom - this.body.deltaY() <= platformBody.top + 6;
  }

  private updateLocalPlayer(time: number, delta: number, now: number): void {
    const body = this.body;
    const input = this.options.input;
    if (this.respawnAt !== null) {
      clearPlatformerInput(input);
      if (now >= this.respawnAt) this.respawn();
      return;
    }
    input.resetQueued = false;
    const grounded = body.blocked.down;
    steerPlatformerBody(body, input, { grounded, knocked: time < this.knockedUntil });
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
        body.setVelocityY(jumpVelocity);
        this.effects.jumpPuff(body.center.x, body.bottom);
      }
    }
    input.jumpQueued = false;
    if (grounded && !this.wasGrounded) this.effects.landingDust(body.center.x, body.bottom);
    this.wasGrounded = grounded;

    if (isInLava(body.bottom)) {
      this.die(now);
      return;
    }
    this.options.publish({ x: body.center.x, y: body.center.y, vx: body.velocity.x, vy: body.velocity.y });
  }

  private die(now: number): void {
    const { x, y } = this.body.center;
    const killerId = this.killCredit.claim(now);
    this.respawnAt = now + DEATHMATCH_RESPAWN_MS;
    this.body.stop().setAllowGravity(false);
    this.body.enable = false;
    this.actor.container.setVisible(false);
    clearPlatformerInput(this.options.input);
    this.options.publishEvent(DEATH_EVENT, killerId ?? "", 0);
    this.burst(x, y, this.options.localPlayer.id);
    this.cameras.main.shake(220, 0.01);
    this.options.onDeath(this.options.localPlayer.id, killerId);
  }

  private burst(x: number, y: number, playerId: string): void {
    this.lava.splash(x);
    this.effects.shatter(x, Math.min(y, ARENA_LAVA_Y - 10), playerColor(playerId));
  }

  private respawn(): void {
    const spawn = arenaSpawnPoint(Math.random(), CLIMB_PLAYER_HEIGHT);
    this.body.enable = true;
    this.body.reset(spawn.x, spawn.y);
    this.body.setAllowGravity(true);
    this.actor.container.setVisible(true);
    this.jump = createJumpState();
    this.wasGrounded = false;
    this.knockedUntil = 0;
    this.respawnAt = null;
    this.blinkUntil = this.time.now + BLINK_MS;
    this.effects.pickup(spawn.x, spawn.y);
    this.options.publish({ x: spawn.x, y: spawn.y, vx: 0, vy: 0 });
  }

  private isRemoteAlive(playerId: string): boolean {
    return playerId !== this.options.localPlayer.id && this.options.nowMs() >= (this.remoteRespawnAt.get(playerId) ?? 0);
  }

  private updateActors(time: number, delta: number, now: number): void {
    const localId = this.options.localPlayer.id;
    if (this.respawnAt === null) {
      this.actor.update({ x: this.body.center.x, feetY: this.body.bottom, vx: this.body.velocity.x, vy: this.body.velocity.y }, time, delta);
      this.actor.container.setAlpha(time < this.blinkUntil && Math.floor(time / 100) % 2 === 0 ? 0.35 : 1);
    }
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
      actor.setTag(compactLabel(label, 8));
      actor.update({ x: frame.x, feetY: frame.y + CLIMB_PLAYER_HEIGHT / 2, vx: frame.vx, vy: frame.vy }, time, delta);
      const respawnAt = this.remoteRespawnAt.get(frame.playerId) ?? 0;
      actor.container.setVisible(now >= respawnAt && frame.y + CLIMB_PLAYER_HEIGHT / 2 < ARENA_LAVA_Y);
      if (now >= respawnAt) this.remoteRespawnAt.delete(frame.playerId);
    }
    for (const [id, actor] of this.remotes) {
      if (visible.has(id)) continue;
      actor.destroy();
      this.remotes.delete(id);
      this.remoteRespawnAt.delete(id);
    }
  }
}
