import Phaser from "phaser";
import type { PlatformerInput } from "../../game-engine/platformer/movement.ts";
import { clearPlatformerInput, createJumpState, takeJump } from "../../game-engine/platformer/movement.ts";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import type {
  ChunkLineUpBoard,
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
  CHUNK_LINE_UP_GROUND_Y,
  CHUNK_LINE_UP_LANDING_WIDTH,
  CHUNK_LINE_UP_PLAYER_HEIGHT,
  CHUNK_LINE_UP_PLAYER_WIDTH,
  CHUNK_LINE_UP_ROW_LEFT,
  CHUNK_LINE_UP_ROW_RIGHT,
  CHUNK_LINE_UP_SHAFT_WIDTH,
  CHUNK_LINE_UP_WALK_LEFT,
  CHUNK_LINE_UP_WALK_RIGHT,
  chunkLineUpFloorY,
  chunkLineUpShaftX,
} from "./layout.ts";
import { CHUNK_LINE_UP_WORLD_HEIGHT, CHUNK_LINE_UP_WORLD_WIDTH } from "./model.ts";
import { ActorView } from "./scene/ActorView.ts";
import { ensureSharedTextures } from "./scene/art.ts";
import { Backdrop } from "./scene/Backdrop.ts";
import { BoardView, type SlotHit } from "./scene/BoardView.ts";
import { Effects } from "./scene/Effects.ts";
import { ElevatorView } from "./scene/ElevatorView.ts";

const RUN_SPEED = 300;
const GROUND_ACCELERATION = 2_600;
const AIR_ACCELERATION = 1_700;
const GROUND_DRAG = 2_800;
const AIR_DRAG = 700;
const DROP_THROUGH_MS = 240;
const SEAT_OFFSETS = [-22, 0, 22] as const;
const MIN_STUDENT_ZOOM = 0.62;

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
}

/**
 * Orchestrates the tower: local physics and input, remote actors, and the
 * server-driven elevators. Drawing lives in the ./scene modules.
 */
export default class ChunkLineUpScene extends Phaser.Scene {
  private readonly options: ChunkLineUpSceneOptions;
  private board: ChunkLineUpBoard | null = null;
  private ready = false;
  private backdrop!: Backdrop;
  private boardView!: BoardView;
  private elevatorView!: ElevatorView;
  private effects!: Effects;
  private oneWayPlatforms!: Phaser.Physics.Arcade.StaticGroup;
  private player: Phaser.GameObjects.Zone | null = null;
  private body: Phaser.Physics.Arcade.Body | null = null;
  private localActor: ActorView | null = null;
  private readonly remotes = new Map<string, ActorView>();
  private jump = createJumpState();
  private wasGrounded = false;
  private dropUntil = 0;
  private insideRiderIds = new Set<string>();
  private localRide: ChunkLineUpElevatorRideInfo | null = null;
  private localRideKey = "";
  private approachedElevator: { readonly id: ChunkLineUpElevatorId; readonly floor: number } | null = null;
  private approachActive = false;
  private focusedSlot: SlotHit | null = null;

  constructor(options: ChunkLineUpSceneOptions) {
    super("chunk-line-up");
    this.options = options;
  }

  create(): void {
    this.ready = true;
    ensureSharedTextures(this);
    this.backdrop = new Backdrop(this);
    this.elevatorView = new ElevatorView(this);
    this.oneWayPlatforms = this.physics.add.staticGroup();
    this.boardView = new BoardView(this, this.oneWayPlatforms);
    this.effects = new Effects(this);

    // Side walls stop at the elevator shafts; the bottom stays open so a fall respawns.
    this.physics.world.setBounds(
      CHUNK_LINE_UP_WALK_LEFT,
      -CHUNK_LINE_UP_WORLD_HEIGHT,
      CHUNK_LINE_UP_WALK_RIGHT - CHUNK_LINE_UP_WALK_LEFT,
      CHUNK_LINE_UP_WORLD_HEIGHT * 3,
      true,
      true,
      false,
      false,
    );
    const ground = this.add.zone(CHUNK_LINE_UP_WORLD_WIDTH / 2, CHUNK_LINE_UP_GROUND_Y + 40, CHUNK_LINE_UP_WORLD_WIDTH, 80);
    this.physics.add.existing(ground, true);

    if (this.options.mode === "student" && this.options.input && this.options.localPlayer) {
      const initial = this.options.initialState
        ?? { x: CHUNK_LINE_UP_WORLD_WIDTH / 2, y: CHUNK_LINE_UP_GROUND_Y - CHUNK_LINE_UP_PLAYER_HEIGHT / 2, vx: 0, vy: 0 };
      this.player = this.add.zone(initial.x, initial.y, CHUNK_LINE_UP_PLAYER_WIDTH, CHUNK_LINE_UP_PLAYER_HEIGHT);
      this.physics.add.existing(this.player);
      this.body = this.player.body as Phaser.Physics.Arcade.Body;
      this.body.setCollideWorldBounds(true).setMaxVelocity(RUN_SPEED, 900).setDragX(GROUND_DRAG);
      this.physics.add.collider(this.player, ground);
      this.physics.add.collider(this.player, this.oneWayPlatforms, undefined, (_player, platform) => this.canLandOn(platform));
      this.localActor = new ActorView(this, this.options.localPlayer.id, true);
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

    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ready = false;
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
      this.remotes.clear();
    });
    if (this.board) this.renderBoard();
  }

  setBoard(board: ChunkLineUpBoard): void {
    this.board = board;
    if (this.ready) this.renderBoard();
  }

  /**
   * The "down" action: confirm the empty slot underfoot, or drop through the
   * floor when standing anywhere else above the ground.
   */
  confirmNearestSlot(): boolean {
    if (!this.body || !this.board || this.localRide) return false;
    const hit = this.slotUnderfoot();
    if (hit && !hit.slot.fixed && !hit.slot.filledBy) {
      this.options.onConfirm(hit.groupId, hit.slot.id);
      return true;
    }
    if (this.body.blocked.down && this.body.bottom < CHUNK_LINE_UP_GROUND_Y - 4) {
      this.dropUntil = this.time.now + DROP_THROUGH_MS;
      this.body.setVelocityY(60);
    }
    return false;
  }

  showWrong(): void {
    if (!this.body) return;
    this.effects.wrong(this.body.center.x, this.body.center.y);
    this.localActor?.flash(0xff6b6b);
    const direction = this.body.velocity.x === 0 ? (Math.random() < 0.5 ? -1 : 1) : -Math.sign(this.body.velocity.x);
    this.body.setVelocity(direction * 240, -360);
    this.cameras.main.shake(160, 0.006);
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
    const floorCount = this.board?.groups.length ?? 0;
    if (!playerId || floorCount < 1) return null;
    const now = this.options.nowMs();
    return predictChunkLineUpElevatorRide(
      resolveChunkLineUpElevatorState(state, now),
      elevatorId,
      playerId,
      floor,
      destinationFloor,
      floorCount,
      now,
    );
  }

  releaseElevatorApproach(): void {
    this.approachedElevator = null;
    if (!this.approachActive) return;
    this.approachActive = false;
    this.options.onElevatorRideChange(null);
  }

  dismissElevatorApproach(): void {
    this.approachActive = false;
  }

  override update(time: number, delta: number): void {
    const now = this.options.nowMs();
    this.updateElevators(now);
    if (this.body && this.options.input) this.updateLocalPlayer(time);
    this.updateActors(time, delta, this.options.samplePlayers());
    this.focusedSlot = this.body && !this.localRide ? this.slotUnderfoot() : null;
    this.boardView.drawFocus(this.focusedSlot, time);
    this.backdrop.update(delta);
    if (this.body) this.followLocalPlayer(delta);
  }

  /** Zoom the fixed world into the canvas. Only the view changes, never world coordinates. */
  private fitCamera(): void {
    const camera = this.cameras.main;
    const fit = Math.min(this.scale.width / CHUNK_LINE_UP_WORLD_WIDTH, this.scale.height / CHUNK_LINE_UP_WORLD_HEIGHT);
    // On narrow screens a student keeps readable blocks and the camera follows them sideways.
    const zoom = this.body && fit < MIN_STUDENT_ZOOM
      ? Math.min(MIN_STUDENT_ZOOM, this.scale.height / CHUNK_LINE_UP_WORLD_HEIGHT)
      : fit;
    camera.setSize(this.scale.width, this.scale.height);
    camera.setZoom(zoom);
    camera.centerOn(this.cameraTargetX(), CHUNK_LINE_UP_WORLD_HEIGHT / 2);
  }

  private cameraTargetX(): number {
    const halfView = this.scale.width / this.cameras.main.zoom / 2;
    if (!this.body || halfView * 2 >= CHUNK_LINE_UP_WORLD_WIDTH) return CHUNK_LINE_UP_WORLD_WIDTH / 2;
    return Phaser.Math.Clamp(this.body.center.x, halfView, CHUNK_LINE_UP_WORLD_WIDTH - halfView);
  }

  private followLocalPlayer(delta: number): void {
    const camera = this.cameras.main;
    const current = camera.midPoint.x;
    const target = this.cameraTargetX();
    if (Math.abs(target - current) < 0.5) return;
    camera.centerOn(current + (target - current) * Math.min(1, delta / 120), CHUNK_LINE_UP_WORLD_HEIGHT / 2);
  }

  private renderBoard(): void {
    if (!this.board) return;
    const floorCount = this.board.groups.length;
    this.backdrop.drawTower(floorCount);
    this.elevatorView.drawShafts(floorCount);
    const changes = this.boardView.render(this.board);
    changes.filled.forEach((rect) => this.effects.slotFilled(rect));
    changes.completedFloors.forEach((floor) =>
      this.effects.rowCompleted(CHUNK_LINE_UP_ROW_LEFT, CHUNK_LINE_UP_ROW_RIGHT, chunkLineUpFloorY(floor, floorCount)));
  }

  private canLandOn(platform: unknown): boolean {
    const body = this.body;
    if (!body || this.time.now < this.dropUntil || body.velocity.y < 0) return false;
    const platformBody = (platform as Phaser.GameObjects.Zone).body as Phaser.Physics.Arcade.StaticBody | null;
    if (!platformBody) return false;
    // Only land when the feet were above the surface last step; never pop up from inside.
    return body.bottom - body.deltaY() <= platformBody.top + 6;
  }

  private slotUnderfoot(): SlotHit | null {
    if (!this.body || !this.body.blocked.down) return null;
    return this.boardView.slotAt(this.body.center.x, this.body.bottom);
  }

  private updateLocalPlayer(time: number): void {
    const body = this.body;
    const input = this.options.input;
    if (!body || !input) return;
    if (this.localRide) {
      clearPlatformerInput(input);
      body.setAccelerationX(0).setVelocity(0, 0);
      this.options.publish(this.movement());
      return;
    }
    if (input.resetQueued || body.top > CHUNK_LINE_UP_WORLD_HEIGHT + 60) {
      input.resetQueued = false;
      this.respawn();
    }
    const directions = [...input.held.values()];
    const left = directions.includes("left");
    const right = directions.includes("right");
    const grounded = body.blocked.down;
    const fallSpeed = body.velocity.y;
    body.setAccelerationX((Number(right) - Number(left)) * (grounded ? GROUND_ACCELERATION : AIR_ACCELERATION));
    // Turning around should feel immediate rather than skating.
    if (grounded && ((right && body.velocity.x < 0) || (left && body.velocity.x > 0))) body.setVelocityX(body.velocity.x * 0.5);
    body.setDragX(grounded && !left && !right ? GROUND_DRAG : AIR_DRAG);

    const jumpVelocity = takeJump(this.jump, grounded, input.jumpQueued, time);
    input.jumpQueued = false;
    if (jumpVelocity !== null) {
      body.setVelocityY(jumpVelocity);
      this.effects.jumpPuff(body.center.x, body.bottom);
    }
    if (grounded && !this.wasGrounded && fallSpeed >= 0) this.effects.landingDust(body.center.x, body.bottom);
    this.wasGrounded = grounded;
    this.options.publish(this.movement());
  }

  private movement(): LiveMovementState {
    if (!this.body) {
      return this.options.initialState
        ?? { x: CHUNK_LINE_UP_WORLD_WIDTH / 2, y: CHUNK_LINE_UP_GROUND_Y - CHUNK_LINE_UP_PLAYER_HEIGHT / 2, vx: 0, vy: 0 };
    }
    return { x: this.body.center.x, y: this.body.center.y, vx: this.body.velocity.x, vy: this.body.velocity.y };
  }

  private respawn(): void {
    if (!this.body) return;
    const x = Phaser.Math.Between(CHUNK_LINE_UP_ROW_LEFT + 40, CHUNK_LINE_UP_ROW_RIGHT - 40);
    this.body.reset(x, CHUNK_LINE_UP_GROUND_Y - CHUNK_LINE_UP_PLAYER_HEIGHT / 2 - 80);
    this.jump = createJumpState();
    this.options.publish(this.movement());
  }

  private updateActors(time: number, delta: number, frames: readonly LiveRemoteFrame[]): void {
    const localId = this.options.localPlayer?.id;
    if (this.localActor && localId && this.body) {
      this.localActor.setTag(this.options.localPlayer!.label, this.options.playerToken(localId));
      const landed = this.localActor.update(this.movement(), time, delta, this.insideRiderIds.has(localId));
      if (landed) this.effects.landingDust(this.body.center.x, this.body.bottom);
    }
    const visible = new Set<string>();
    for (const frame of frames) {
      if (frame.playerId === localId) continue;
      const label = this.options.playerLabel(frame.playerId);
      if (!label) continue;
      visible.add(frame.playerId);
      let actor = this.remotes.get(frame.playerId);
      if (!actor) {
        actor = new ActorView(this, frame.playerId, false);
        this.remotes.set(frame.playerId, actor);
      }
      actor.setTag(label, this.options.playerToken(frame.playerId));
      actor.update(frame, time, delta, this.insideRiderIds.has(frame.playerId));
    }
    for (const [id, actor] of this.remotes) {
      if (visible.has(id)) continue;
      actor.destroy();
      this.remotes.delete(id);
    }
  }

  private localPlayerAtLanding(id: ChunkLineUpElevatorId, floor: number, floorCount: number): boolean {
    if (!this.body || !this.body.blocked.down) return false;
    const xDistance = Math.abs(this.body.center.x - chunkLineUpShaftX(id));
    const yDistance = Math.abs(this.body.bottom - chunkLineUpFloorY(floor, floorCount));
    return xDistance <= CHUNK_LINE_UP_SHAFT_WIDTH / 2 + CHUNK_LINE_UP_LANDING_WIDTH && yDistance <= 8;
  }

  private updateElevators(now: number): void {
    const floorCount = this.board?.groups.length ?? 0;
    const raw = this.options.elevatorState();
    const state = raw ? resolveChunkLineUpElevatorState(raw, now) : null;
    this.elevatorView.draw(state, floorCount, now);
    if (!state || floorCount < 1) return;

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
      if (this.localRide) this.approachActive = false;
      this.options.onElevatorRideChange(this.localRide);
    }

    // The cabin sits outside the walkable world bounds, so physics (and the
    // bounds clamp that Body.reset applies) is paused while riding.
    this.body.enable = !ride;
    this.body.setCollideWorldBounds(!ride);
    if (ride) {
      clearPlatformerInput(this.options.input!);
      const seatIndex = Math.max(0, ride.car.seats.findIndex((seat) => seat.playerId === localId));
      const floorY = chunkLineUpFloorY(chunkLineUpElevatorFloorPosition(ride.car, now), floorCount);
      this.body.reset(
        chunkLineUpShaftX(ride.elevatorId) + (SEAT_OFFSETS[seatIndex] ?? 0),
        floorY - CHUNK_LINE_UP_PLAYER_HEIGHT / 2 - 5,
      );
      return;
    }
    if (previousRide) {
      // Step out onto the landing on the building side of the shaft.
      const car = state[previousRide.elevatorId];
      const direction = previousRide.elevatorId === "left" ? 1 : -1;
      const exitX = chunkLineUpShaftX(previousRide.elevatorId)
        + direction * (CHUNK_LINE_UP_SHAFT_WIDTH / 2 + CHUNK_LINE_UP_LANDING_WIDTH / 2);
      this.body.reset(exitX, chunkLineUpFloorY(car.floor, floorCount) - CHUNK_LINE_UP_PLAYER_HEIGHT / 2);
      this.body.setVelocityX(direction * 160);
      this.approachedElevator = { id: previousRide.elevatorId, floor: car.floor };
      return;
    }

    if (this.approachedElevator) {
      const { id, floor } = this.approachedElevator;
      if (this.localPlayerAtLanding(id, floor, floorCount)) return;
      this.approachedElevator = null;
      if (this.approachActive) {
        this.approachActive = false;
        this.options.onElevatorRideChange(null);
      }
    }
    for (const id of ["left", "right"] as const) {
      const car = state[id];
      if (car.phase !== "open" || car.seats.length >= CHUNK_LINE_UP_ELEVATOR_CAPACITY) continue;
      if (!this.localPlayerAtLanding(id, car.floor, floorCount)) continue;
      this.approachedElevator = { id, floor: car.floor };
      this.approachActive = true;
      this.options.onElevatorApproach(id, car.floor);
      break;
    }
  }
}
