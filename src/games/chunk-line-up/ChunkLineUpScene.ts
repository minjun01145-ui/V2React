import Phaser from "phaser";
import type { PlatformerInput } from "../../game-engine/platformer/movement.ts";
import { clearPlatformerInput, createJumpState, takeJump } from "../../game-engine/platformer/movement.ts";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import type {
  ChunkLineUpBoard,
  ChunkLineUpElevatorCarState,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRideInfo,
  ChunkLineUpElevatorState,
} from "../../multiplayer/chunk-line-up/types.ts";
import {
  CHUNK_LINE_UP_ELEVATOR_CAPACITY,
  chunkLineUpElevatorFloorPosition,
  findChunkLineUpPlayerElevator,
  predictChunkLineUpElevatorRide,
  resolveChunkLineUpElevatorState,
} from "./elevatorModel.ts";
import {
  CHUNK_LINE_UP_FLOOR_GAP,
  CHUNK_LINE_UP_JUMP_PAD_VELOCITY,
  CHUNK_LINE_UP_LANDING_WIDTH,
  CHUNK_LINE_UP_PLAYER_HEIGHT,
  CHUNK_LINE_UP_PLAYER_WIDTH,
  CHUNK_LINE_UP_ROW_LEFT,
  CHUNK_LINE_UP_ROW_RIGHT,
  CHUNK_LINE_UP_SHAFT_WIDTH,
  CHUNK_LINE_UP_WALK_LEFT,
  CHUNK_LINE_UP_WALK_RIGHT,
  chunkLineUpFloorAt,
  chunkLineUpFloorY,
  chunkLineUpGroundY,
  chunkLineUpShaftX,
  chunkLineUpWorldHeight,
} from "./layout.ts";
import { CHUNK_LINE_UP_WORLD_WIDTH } from "./model.ts";
import { BlobActor, compactLabel, type BlobPose } from "../../game-engine/phaser-kit/BlobActor.ts";
import { FONT_FAMILY, TEXT_RESOLUTION, ensureSharedTextures } from "../../game-engine/phaser-kit/art.ts";
import { Backdrop } from "./scene/Backdrop.ts";
import { BoardView, type SlotHit } from "./scene/BoardView.ts";
import { Effects } from "../../game-engine/phaser-kit/Effects.ts";
import { ElevatorView } from "./scene/ElevatorView.ts";
import { PropsView } from "./scene/PropsView.ts";
import { PowerUpLayer, type ActiveBuff } from "./scene/PowerUpLayer.ts";
import { BUFF_EFFECT, type ItemClaim } from "./items.ts";
import { PUNCH_COOLDOWN_MS, PUNCH_EVENT, choosePunchTarget, encodePunch, punchKnockback } from "./punch.ts";
import type { LiveEvent } from "../../live-world/events.ts";

const RUN_SPEED = 300;
const GROUND_ACCELERATION = 2_600;
const AIR_ACCELERATION = 1_700;
const GROUND_DRAG = 2_800;
const AIR_DRAG = 700;
const DROP_THROUGH_MS = 240;
const SEAT_OFFSETS = [-22, 0, 22] as const;
const MIN_STUDENT_ZOOM = 0.62;
/** Students see roughly this many floors at once; the camera follows them up the tower. */
const STUDENT_VISIBLE_FLOORS = 2.5;

export interface ChunkLineUpSceneOptions {
  readonly mode: "student" | "teacher";
  readonly input?: PlatformerInput;
  readonly localPlayer?: { readonly id: string; readonly label: string };
  readonly initialState?: LiveMovementState;
  readonly publish: (state: LiveMovementState) => void;
  readonly samplePlayers: () => readonly LiveRemoteFrame[];
  readonly playerLabel: (playerId: string) => string | undefined;
  readonly playerToken: (playerId: string) => string | undefined;
  readonly onConfirm: (groupId: string, slotId: string) => void;
  readonly elevatorState: () => ChunkLineUpElevatorState | null;
  readonly nowMs: () => number;
  readonly onElevatorApproach: (elevatorId: ChunkLineUpElevatorId, floor: number) => void;
  readonly onElevatorRideChange: (ride: ChunkLineUpElevatorRideInfo | null) => void;
  readonly onFloorChange?: (floor: number) => void;
  /** Seeds the shared item spawns. */
  readonly roundId: string;
  readonly publishEvent?: (kind: string, target: string, value: number) => void;
  readonly claimItem?: (id: string) => Promise<boolean>;
  readonly onBuffsChange?: (buffs: readonly ActiveBuff[]) => void;
}

/**
 * One compact tag per character: floors are only a jump apart, so stacked
 * name + chunk labels would cover the shelf above.
 */
function actorTag(label: string, token: string | undefined, self: boolean): string {
  const chunk = compactLabel(token ?? "", self ? 26 : 14);
  if (self) return `▼ ${chunk || "나"}`;
  const name = compactLabel(label, 8);
  return chunk ? `${name} · ${chunk}` : name;
}

function actorPose(state: LiveMovementState, insideElevator: boolean): BlobPose {
  return {
    x: state.x,
    feetY: state.y + CHUNK_LINE_UP_PLAYER_HEIGHT / 2,
    vx: state.vx,
    vy: state.vy,
    alpha: insideElevator ? 0.35 : 1,
  };
}

type DownAction =
  | { readonly kind: "slot"; readonly hit: SlotHit }
  | { readonly kind: "elevator"; readonly id: ChunkLineUpElevatorId; readonly floor: number }
  | { readonly kind: "drop" }
  | null;

/**
 * Orchestrates the tower: local physics and input, remote actors, and the
 * server-driven elevators. Drawing lives in the ./scene modules.
 */
export default class ChunkLineUpScene extends Phaser.Scene {
  private readonly options: ChunkLineUpSceneOptions;
  private board: ChunkLineUpBoard | null = null;
  private floorCount = 0;
  private ready = false;
  private backdrop!: Backdrop;
  private boardView!: BoardView;
  private elevatorView!: ElevatorView;
  private props!: PropsView;
  private effects!: Effects;
  private ground!: Phaser.GameObjects.Zone;
  private boardPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private actionHint!: Phaser.GameObjects.Text;
  private player: Phaser.GameObjects.Zone | null = null;
  private body: Phaser.Physics.Arcade.Body | null = null;
  private localActor: BlobActor | null = null;
  private readonly remotes = new Map<string, BlobActor>();
  private jump = createJumpState();
  private wasGrounded = false;
  private dropUntil = 0;
  private elevatorState: ChunkLineUpElevatorState | null = null;
  private insideRiderIds = new Set<string>();
  private localRide: ChunkLineUpElevatorRideInfo | null = null;
  private localRideKey = "";
  private requestedElevator: { readonly id: ChunkLineUpElevatorId; readonly floor: number } | null = null;
  private reportedFloor = -1;
  private powerUps!: PowerUpLayer;
  private lastFrames: readonly LiveRemoteFrame[] = [];
  private punchReadyAt = 0;
  /** Briefly loosens drag and the speed cap so a punch knockback actually slides. */
  private knockedUntil = 0;

  constructor(options: ChunkLineUpSceneOptions) {
    super("chunk-line-up");
    this.options = options;
  }

  create(): void {
    this.ready = true;
    ensureSharedTextures(this);
    this.backdrop = new Backdrop(this);
    this.elevatorView = new ElevatorView(this);
    this.boardPlatforms = this.physics.add.staticGroup();
    this.boardView = new BoardView(this, this.boardPlatforms);
    this.props = new PropsView(this);
    this.effects = new Effects(this);
    this.powerUps = new PowerUpLayer(this, this.effects, {
      roundId: this.options.roundId,
      ...(this.options.localPlayer ? { localPlayerId: this.options.localPlayer.id } : {}),
      nowMs: this.options.nowMs,
      ...(this.options.claimItem ? { claimItem: this.options.claimItem } : {}),
      ...(this.options.onBuffsChange ? { onBuffsChange: this.options.onBuffsChange } : {}),
    });
    this.ground = this.add.zone(CHUNK_LINE_UP_WORLD_WIDTH / 2, 0, CHUNK_LINE_UP_WORLD_WIDTH, 80);
    this.physics.add.existing(this.ground, true);
    this.actionHint = this.add.text(0, 0, "", {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffffff",
      backgroundColor: "rgba(15,23,42,.82)",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(35).setResolution(TEXT_RESOLUTION).setVisible(false);

    if (this.options.mode === "student" && this.options.input && this.options.localPlayer) {
      const initial = this.options.initialState ?? { x: CHUNK_LINE_UP_WORLD_WIDTH / 2, y: 0, vx: 0, vy: 0 };
      this.player = this.add.zone(initial.x, initial.y, CHUNK_LINE_UP_PLAYER_WIDTH, CHUNK_LINE_UP_PLAYER_HEIGHT);
      this.physics.add.existing(this.player);
      this.body = this.player.body as Phaser.Physics.Arcade.Body;
      this.body.setCollideWorldBounds(true).setMaxVelocity(RUN_SPEED, 1_000).setDragX(GROUND_DRAG);
      const landOn = (_player: unknown, platform: unknown): boolean => this.canLandOn(platform);
      this.physics.add.collider(this.player, this.ground);
      this.physics.add.collider(this.player, this.boardPlatforms, undefined, landOn);
      this.physics.add.collider(this.player, this.props.steps, undefined, landOn);
      this.physics.add.collider(this.player, this.props.movers, undefined, landOn);
      this.localActor = new BlobActor(this, this.options.localPlayer.id, true);
      const stop = (): void => {
        if (!this.body || !this.options.input) return;
        clearPlatformerInput(this.options.input);
        this.body.setAccelerationX(0).setVelocityX(0);
        this.options.publish(this.movement());
      };
      this.game.events.on(Phaser.Core.Events.BLUR, stop);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.game.events.off(Phaser.Core.Events.BLUR, stop);
        clearPlatformerInput(this.options.input!);
      });
    }

    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ready = false;
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
      this.remotes.clear();
    });
    if (this.board) this.renderBoard();
    this.fitCamera();
  }

  setBoard(board: ChunkLineUpBoard): void {
    this.board = board;
    if (this.ready) this.renderBoard();
  }

  /**
   * The single "down" action, resolved by where the player stands: confirm an
   * empty slot, open the elevator menu at an open door, or drop through a floor.
   */
  performDownAction(): void {
    const action = this.downAction();
    if (!action || !this.body) return;
    if (action.kind === "slot") {
      this.options.onConfirm(action.hit.groupId, action.hit.slot.id);
    } else if (action.kind === "elevator") {
      this.requestedElevator = { id: action.id, floor: action.floor };
      this.options.onElevatorApproach(action.id, action.floor);
    } else {
      this.dropUntil = this.time.now + DROP_THROUGH_MS;
      this.body.setVelocityY(60);
    }
  }

  showWrong(): void {
    if (!this.body) return;
    this.effects.wrong(this.body.center.x, this.body.center.y);
    this.localActor?.flash(0xff6b6b);
    const direction = this.body.velocity.x === 0 ? (Math.random() < 0.5 ? -1 : 1) : -Math.sign(this.body.velocity.x);
    this.body.setVelocity(direction * 240, -360);
    this.knockedUntil = this.time.now + 220;
    this.cameras.main.shake(160, 0.006);
  }

  /** Jab whoever stands right in front of us. Purely for fun: a small knockback, nothing else. */
  punch(): void {
    const body = this.body;
    const actor = this.localActor;
    const localId = this.options.localPlayer?.id;
    if (!body || !actor || !localId || this.localRide || this.time.now < this.punchReadyAt) return;
    this.punchReadyAt = this.time.now + PUNCH_COOLDOWN_MS;
    const facing = actor.facingDirection;
    actor.punch(this.time.now, facing);
    const target = choosePunchTarget(
      { x: body.center.x, y: body.center.y, facing },
      this.lastFrames.filter((frame) => frame.playerId !== localId && !this.insideRiderIds.has(frame.playerId)),
    );
    const powered = this.powerUps.has("punch");
    this.options.publishEvent?.(PUNCH_EVENT, target?.playerId ?? "", encodePunch(facing, powered));
    if (target) this.effects.punchHit(target.x, target.y - 6, powered);
  }

  receiveEvent(event: LiveEvent): void {
    if (event.kind !== PUNCH_EVENT || !this.ready) return;
    const direction = event.value < 0 ? -1 : 1;
    const powered = Math.abs(event.value) >= 2;
    this.remotes.get(event.playerId)?.punch(this.time.now, direction);
    const localId = this.options.localPlayer?.id;
    if (event.target && event.target === localId) {
      this.takePunch(event.value);
      return;
    }
    const victim = this.lastFrames.find((frame) => frame.playerId === event.target);
    if (victim) this.effects.punchHit(victim.x, victim.y - 6, powered);
  }

  receiveClaim(claim: ItemClaim): void {
    this.powerUps.receiveClaim(claim);
  }

  private takePunch(value: number): void {
    const body = this.body;
    if (!body || this.localRide) return;
    const knockback = punchKnockback(value);
    body.setVelocity(knockback.vx, knockback.vy);
    this.knockedUntil = this.time.now + 280;
    this.localActor?.flash(0xffffff);
    this.effects.punchHit(body.center.x, body.center.y - 6, Math.abs(value) >= 2);
    this.cameras.main.shake(90, Math.abs(value) >= 2 ? 0.008 : 0.004);
  }

  showCorrect(completedGroup: boolean): void {
    if (!this.body) return;
    this.effects.correct(this.body.center.x, this.body.top);
    this.localActor?.flash(0x86efac);
    this.body.setVelocityY(-380);
    if (completedGroup) this.cameras.main.flash(180, 255, 236, 150, false);
  }

  predictElevatorRide(
    state: ChunkLineUpElevatorState,
    elevatorId: ChunkLineUpElevatorId,
    floor: number,
    destinationFloor: number,
  ): ChunkLineUpElevatorState | null {
    const playerId = this.options.localPlayer?.id;
    if (!playerId || this.floorCount < 1) return null;
    const now = this.options.nowMs();
    return predictChunkLineUpElevatorRide(
      resolveChunkLineUpElevatorState(state, now),
      elevatorId,
      playerId,
      floor,
      destinationFloor,
      this.floorCount,
      now,
    );
  }

  /** Called by the UI when the menu closes without boarding. */
  releaseElevatorApproach(): void {
    this.requestedElevator = null;
  }

  override update(time: number, delta: number): void {
    const now = this.options.nowMs();
    this.props.update(now, delta);
    this.updateElevators(now);
    if (this.body && this.options.input) this.updateLocalPlayer(time, delta);
    this.lastFrames = this.options.samplePlayers();
    this.updateActors(time, delta, this.lastFrames);
    this.powerUps.update(time, this.body && !this.localRide ? { x: this.body.center.x, y: this.body.center.y } : null);
    const action = this.localRide ? null : this.downAction();
    this.boardView.drawFocus(action?.kind === "slot" ? action.hit : null, time);
    this.updateActionHint(action);
    this.backdrop.update(delta);
    if (this.body) this.followLocalPlayer(delta);
  }

  private worldHeight(): number {
    return chunkLineUpWorldHeight(this.floorCount);
  }

  /** Zoom the world into the canvas. Only the view changes, never world coordinates. */
  private fitCamera(): void {
    const camera = this.cameras.main;
    const width = this.scale.width;
    const height = this.scale.height;
    camera.setSize(width, height);
    if (this.body) {
      // Students get a close, readable view that follows them up the tower.
      const byWidth = width / CHUNK_LINE_UP_WORLD_WIDTH;
      const byFloors = height / (CHUNK_LINE_UP_FLOOR_GAP * STUDENT_VISIBLE_FLOORS);
      camera.setZoom(Math.max(MIN_STUDENT_ZOOM, Math.min(byWidth, byFloors)));
      const target = this.cameraTarget();
      camera.centerOn(target.x, target.y);
    } else {
      camera.setZoom(Math.min(width / CHUNK_LINE_UP_WORLD_WIDTH, height / this.worldHeight()));
      camera.centerOn(CHUNK_LINE_UP_WORLD_WIDTH / 2, this.worldHeight() / 2);
    }
  }

  private cameraTarget(): { readonly x: number; readonly y: number } {
    const camera = this.cameras.main;
    const halfWidth = this.scale.width / camera.zoom / 2;
    const halfHeight = this.scale.height / camera.zoom / 2;
    const worldHeight = this.worldHeight();
    const clamp = (value: number, half: number, size: number): number =>
      half * 2 >= size ? size / 2 : Phaser.Math.Clamp(value, half, size - half);
    const focusX = this.body?.center.x ?? CHUNK_LINE_UP_WORLD_WIDTH / 2;
    // Look slightly above the player: the next floor up is where they are heading.
    const focusY = (this.body?.center.y ?? worldHeight / 2) - 40;
    return {
      x: clamp(focusX, halfWidth, CHUNK_LINE_UP_WORLD_WIDTH),
      y: clamp(focusY, halfHeight, worldHeight),
    };
  }

  private followLocalPlayer(delta: number): void {
    const camera = this.cameras.main;
    const target = this.cameraTarget();
    const blend = Math.min(1, delta / 110);
    const x = camera.midPoint.x + (target.x - camera.midPoint.x) * blend;
    const y = camera.midPoint.y + (target.y - camera.midPoint.y) * blend;
    camera.centerOn(x, y);
  }

  private renderBoard(): void {
    if (!this.board) return;
    const floorCount = this.board.groups.length;
    if (floorCount !== this.floorCount) this.applyFloorCount(floorCount);
    const changes = this.boardView.render(this.board);
    changes.filled.forEach((rect) => this.effects.slotFilled(rect));
    changes.completedFloors.forEach((floor) =>
      this.effects.celebrate(CHUNK_LINE_UP_ROW_LEFT, CHUNK_LINE_UP_ROW_RIGHT, chunkLineUpFloorY(floor, floorCount), "문장 완성!"));
  }

  /** The tower height follows the (per-round constant) number of sentences. */
  private applyFloorCount(floorCount: number): void {
    this.floorCount = floorCount;
    const worldHeight = this.worldHeight();
    // Side walls stop at the elevator shafts; the bottom stays open so a fall respawns.
    this.physics.world.setBounds(
      CHUNK_LINE_UP_WALK_LEFT,
      -worldHeight,
      CHUNK_LINE_UP_WALK_RIGHT - CHUNK_LINE_UP_WALK_LEFT,
      worldHeight * 3,
      true,
      true,
      false,
      false,
    );
    this.ground.setPosition(CHUNK_LINE_UP_WORLD_WIDTH / 2, chunkLineUpGroundY(floorCount) + 40);
    (this.ground.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    this.backdrop.draw(floorCount);
    this.elevatorView.drawShafts(floorCount);
    this.props.build(floorCount, this.options.nowMs());
    this.powerUps.setFloorCount(floorCount);
    if (this.body) {
      const center = this.body.center;
      if (center.y > chunkLineUpGroundY(floorCount) || center.y < 0) {
        this.body.reset(center.x, chunkLineUpGroundY(floorCount) - CHUNK_LINE_UP_PLAYER_HEIGHT / 2);
      }
    }
    this.fitCamera();
  }

  private canLandOn(platform: unknown): boolean {
    const body = this.body;
    if (!body || this.time.now < this.dropUntil || body.velocity.y < 0) return false;
    const platformBody = (platform as Phaser.GameObjects.Zone).body as { readonly top: number } | null;
    if (!platformBody) return false;
    // Only land when the feet were above the surface last step; never pop up from inside.
    return body.bottom - body.deltaY() <= platformBody.top + 6;
  }

  private downAction(): DownAction {
    const body = this.body;
    if (!body || !body.blocked.down || !this.board) return null;
    const hit = this.boardView.slotAt(body.center.x, body.bottom);
    if (hit && !hit.slot.fixed && !hit.slot.filledBy) return { kind: "slot", hit };
    const door = this.openDoorAtFeet();
    if (door) return { kind: "elevator", ...door };
    if (body.bottom < chunkLineUpGroundY(this.floorCount) - 4) return { kind: "drop" };
    return null;
  }

  private updateActionHint(action: DownAction): void {
    if (!this.body || !action || action.kind === "drop") {
      this.actionHint.setVisible(false);
      return;
    }
    const text = action.kind === "slot" ? "↓ 여기에 놓기" : "↓ 엘리베이터 타기";
    if (this.actionHint.text !== text) this.actionHint.setText(text);
    this.actionHint.setPosition(Math.round(this.body.center.x), Math.round(this.body.top - 42)).setVisible(true);
  }

  private updateLocalPlayer(time: number, delta: number): void {
    const body = this.body;
    const input = this.options.input;
    if (!body || !input) return;
    if (this.localRide) {
      clearPlatformerInput(input);
      body.setAccelerationX(0).setVelocity(0, 0);
      this.options.publish(this.movement());
      return;
    }
    if (input.resetQueued || body.top > this.worldHeight() + 60) {
      input.resetQueued = false;
      this.respawn();
    }
    const directions = [...input.held.values()];
    const left = directions.includes("left");
    const right = directions.includes("right");
    const grounded = body.blocked.down;
    const fallSpeed = body.velocity.y;
    const knocked = time < this.knockedUntil;
    const speedBoost = this.powerUps.has("speed") ? BUFF_EFFECT.speed.runMultiplier : 1;
    body.setMaxVelocity(knocked ? RUN_SPEED * 2 : RUN_SPEED * speedBoost, 1_000);
    body.setAccelerationX((Number(right) - Number(left)) * (grounded ? GROUND_ACCELERATION : AIR_ACCELERATION) * speedBoost);
    // Turning around should feel immediate rather than skating.
    if (grounded && !knocked && ((right && body.velocity.x < 0) || (left && body.velocity.x > 0))) body.setVelocityX(body.velocity.x * 0.5);
    body.setDragX(grounded && !knocked && !left && !right ? GROUND_DRAG : AIR_DRAG);

    // Ride along with a moving platform underfoot.
    if (grounded) body.x += this.props.carrySpeedAt(body.center.x, body.bottom) * (delta / 1_000);

    const pad = grounded ? this.props.padAt(body.center.x, body.bottom) : null;
    if (pad) {
      body.setVelocityY(CHUNK_LINE_UP_JUMP_PAD_VELOCITY);
      this.jump = createJumpState();
      this.props.bouncePad(pad.id);
      this.effects.jumpPuff(body.center.x, body.bottom);
    } else {
      const jumpVelocity = takeJump(this.jump, grounded, input.jumpQueued, time);
      if (jumpVelocity !== null) {
        body.setVelocityY(jumpVelocity * (this.powerUps.has("jump") ? BUFF_EFFECT.jump.jumpMultiplier : 1));
        this.effects.jumpPuff(body.center.x, body.bottom);
      }
    }
    input.jumpQueued = false;
    if (grounded && !this.wasGrounded && fallSpeed >= 0) this.effects.landingDust(body.center.x, body.bottom);
    this.wasGrounded = grounded;
    this.reportFloor(chunkLineUpFloorAt(body.bottom, this.floorCount));
    this.options.publish(this.movement());
  }

  private reportFloor(floor: number): void {
    if (floor === this.reportedFloor) return;
    this.reportedFloor = floor;
    this.options.onFloorChange?.(floor);
  }

  private movement(): LiveMovementState {
    if (!this.body) return this.options.initialState ?? { x: CHUNK_LINE_UP_WORLD_WIDTH / 2, y: 0, vx: 0, vy: 0 };
    return { x: this.body.center.x, y: this.body.center.y, vx: this.body.velocity.x, vy: this.body.velocity.y };
  }

  private respawn(): void {
    if (!this.body) return;
    const x = Phaser.Math.Between(CHUNK_LINE_UP_ROW_LEFT + 40, CHUNK_LINE_UP_ROW_RIGHT - 40);
    this.body.reset(x, chunkLineUpGroundY(this.floorCount) - CHUNK_LINE_UP_PLAYER_HEIGHT / 2 - 80);
    this.jump = createJumpState();
    this.options.publish(this.movement());
  }

  private updateActors(time: number, delta: number, frames: readonly LiveRemoteFrame[]): void {
    const localId = this.options.localPlayer?.id;
    if (this.localActor && localId && this.body) {
      this.localActor.setTag(actorTag(this.options.localPlayer!.label, this.options.playerToken(localId), true));
      const movement = this.movement();
      const landed = this.localActor.update(actorPose(movement, this.insideRiderIds.has(localId)), time, delta);
      if (landed) this.effects.landingDust(this.body.center.x, this.body.bottom);
      this.powerUps.trail(localId, movement.x, this.body.bottom, movement.vx, time);
    }
    const visible = new Set<string>();
    for (const frame of frames) {
      if (frame.playerId === localId) continue;
      const label = this.options.playerLabel(frame.playerId);
      if (!label) continue;
      visible.add(frame.playerId);
      let actor = this.remotes.get(frame.playerId);
      if (!actor) {
        actor = new BlobActor(this, frame.playerId, false);
        this.remotes.set(frame.playerId, actor);
      }
      actor.setTag(actorTag(label, this.options.playerToken(frame.playerId), false));
      actor.update(actorPose(frame, this.insideRiderIds.has(frame.playerId)), time, delta);
      this.powerUps.trail(frame.playerId, frame.x, frame.y + CHUNK_LINE_UP_PLAYER_HEIGHT / 2, frame.vx, time);
    }
    for (const [id, actor] of this.remotes) {
      if (visible.has(id)) continue;
      actor.destroy();
      this.remotes.delete(id);
    }
  }

  private atLanding(id: ChunkLineUpElevatorId, floor: number): boolean {
    if (!this.body || !this.body.blocked.down) return false;
    const xDistance = Math.abs(this.body.center.x - chunkLineUpShaftX(id));
    const yDistance = Math.abs(this.body.bottom - chunkLineUpFloorY(floor, this.floorCount));
    return xDistance <= CHUNK_LINE_UP_SHAFT_WIDTH / 2 + CHUNK_LINE_UP_LANDING_WIDTH && yDistance <= 8;
  }

  /** An open car with a free seat whose door the player is standing at. */
  private openDoorAtFeet(): { readonly id: ChunkLineUpElevatorId; readonly floor: number } | null {
    const state = this.elevatorState;
    if (!state || this.floorCount < 1) return null;
    for (const id of ["left", "right"] as const) {
      const car: ChunkLineUpElevatorCarState = state[id];
      if (car.phase !== "open" || car.seats.length >= CHUNK_LINE_UP_ELEVATOR_CAPACITY) continue;
      if (this.atLanding(id, car.floor)) return { id, floor: car.floor };
    }
    return null;
  }

  private updateElevators(now: number): void {
    const raw = this.options.elevatorState();
    const state = raw ? resolveChunkLineUpElevatorState(raw, now) : null;
    this.elevatorState = state;
    this.elevatorView.draw(state, this.floorCount, now);
    if (!state || this.floorCount < 1) return;

    this.insideRiderIds = new Set([
      ...(state.left.phase === "open" ? [] : state.left.seats.map((seat) => seat.playerId)),
      ...(state.right.phase === "open" ? [] : state.right.seats.map((seat) => seat.playerId)),
    ]);
    const localId = this.options.localPlayer?.id;
    if (!localId || !this.body) return;

    const previousRide = this.localRide;
    const ride = findChunkLineUpPlayerElevator(state, localId);
    this.localRide = ride ? {
      elevatorId: ride.elevatorId,
      currentFloor: ride.car.floor,
      destinationFloor: ride.rider.destinationFloor,
    } : null;
    const rideKey = this.localRide
      ? `${this.localRide.elevatorId}:${this.localRide.currentFloor}:${this.localRide.destinationFloor ?? "?"}`
      : "";
    if (rideKey !== this.localRideKey) {
      this.localRideKey = rideKey;
      if (this.localRide) this.requestedElevator = null;
      this.options.onElevatorRideChange(this.localRide);
    }

    // The cabin sits outside the walkable world bounds, so physics (and the
    // bounds clamp that Body.reset applies) is paused while riding.
    this.body.enable = !ride;
    this.body.setCollideWorldBounds(!ride);
    if (ride) {
      clearPlatformerInput(this.options.input!);
      const seatIndex = Math.max(0, ride.car.seats.findIndex((seat) => seat.playerId === localId));
      const floorY = chunkLineUpFloorY(chunkLineUpElevatorFloorPosition(ride.car, now), this.floorCount);
      this.body.reset(
        chunkLineUpShaftX(ride.elevatorId) + (SEAT_OFFSETS[seatIndex] ?? 0),
        floorY - CHUNK_LINE_UP_PLAYER_HEIGHT / 2 - 5,
      );
      this.reportFloor(chunkLineUpFloorAt(floorY, this.floorCount));
      return;
    }
    if (previousRide) {
      // Step out onto the landing on the building side of the shaft.
      const car = state[previousRide.elevatorId];
      const direction = previousRide.elevatorId === "left" ? 1 : -1;
      const exitX = chunkLineUpShaftX(previousRide.elevatorId)
        + direction * (CHUNK_LINE_UP_SHAFT_WIDTH / 2 + CHUNK_LINE_UP_LANDING_WIDTH / 2 + 20);
      this.body.reset(exitX, chunkLineUpFloorY(car.floor, this.floorCount) - CHUNK_LINE_UP_PLAYER_HEIGHT / 2);
      this.body.setVelocityX(direction * 200);
      return;
    }

    // Close the destination menu if the player walks away or the car leaves.
    const requested = this.requestedElevator;
    if (requested) {
      const car = state[requested.id];
      if (!this.atLanding(requested.id, requested.floor) || car.phase !== "open" || car.floor !== requested.floor) {
        this.requestedElevator = null;
        this.options.onElevatorRideChange(null);
      }
    }
  }
}
