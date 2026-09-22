import Phaser from "phaser";
import type { PlatformerInput } from "../../game-engine/platformer/movement.ts";
import { clearPlatformerInput, createJumpState, takeJump } from "../../game-engine/platformer/movement.ts";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import type {
  ChunkLineUpBoard,
  ChunkLineUpElevatorId,
  ChunkLineUpElevatorRideInfo,
  ChunkLineUpElevatorState,
  ChunkLineUpSlot,
} from "../../multiplayer/chunk-line-up/types.ts";
import {
  CHUNK_LINE_UP_ELEVATOR_CAPACITY,
  chunkLineUpElevatorDoorOpenRatio,
  chunkLineUpElevatorFloorPosition,
  findChunkLineUpPlayerElevator,
  resolveChunkLineUpElevatorState,
} from "./elevatorModel.ts";

const RUN_SPEED = 270;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 48;
const HUD_SAFE_TOP = 72;
const FLOOR_HEIGHT = 28;
const ELEVATOR_SHAFT_WIDTH = 90;
const ELEVATOR_CABIN_WIDTH = 76;
const ELEVATOR_CABIN_HEIGHT = 56;
const ELEVATOR_EDGE = 10;
const ELEVATOR_LANDING_WIDTH = 82;

interface Actor {
  readonly container: Phaser.GameObjects.Container;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly image: Phaser.GameObjects.Image;
  readonly name: Phaser.GameObjects.Text;
  readonly token: Phaser.GameObjects.Text;
}

interface SlotLayout {
  readonly groupId: string;
  readonly slot: ChunkLineUpSlot;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

interface Burst {
  readonly kind: "correct" | "wrong" | "complete";
  readonly x: number;
  readonly y: number;
  readonly startedAt: number;
}

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
  readonly onReserveElevator: (elevatorId: ChunkLineUpElevatorId, floor: number) => void;
  readonly onElevatorRideChange: (ride: ChunkLineUpElevatorRideInfo | null) => void;
}

function compact(value: string, max = 23): string {
  const normalized = value.trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function structureKey(board: ChunkLineUpBoard): string {
  return board.groups.map((group) => `${group.id}:${group.slots.length}`).join("|");
}

export default class ChunkLineUpScene extends Phaser.Scene {
  private readonly options: ChunkLineUpSceneOptions;
  private board: ChunkLineUpBoard | null = null;
  private structure = "";
  private ready = false;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private terrain!: Phaser.GameObjects.Graphics;
  private elevatorGraphics!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private textNodes: Phaser.GameObjects.Text[] = [];
  private slotLayouts: SlotLayout[] = [];
  private player: Phaser.GameObjects.Zone | null = null;
  private body: Phaser.Physics.Arcade.Body | null = null;
  private localActor: Actor | null = null;
  private jump = createJumpState();
  private readonly remotes = new Map<string, Actor>();
  private readonly elevatorLabels = new Map<ChunkLineUpElevatorId, Phaser.GameObjects.Text>();
  private elevatorFadedRiderIds = new Set<string>();
  private localRide: ChunkLineUpElevatorRideInfo | null = null;
  private localRideKey = "";
  private lastElevatorReserveAt = new Map<ChunkLineUpElevatorId, number>();
  private burst: Burst | null = null;
  private spawnX = 0;

  constructor(options: ChunkLineUpSceneOptions) {
    super("chunk-line-up");
    this.options = options;
  }

  preload(): void {
    const runnerUrl = new URL("../../game-engine/assets/test-runner.svg?no-inline", import.meta.url).href;
    this.load.svg("chunk-line-up-runner", runnerUrl, { width: 80, height: 96 });
  }

  create(): void {
    this.ready = true;
    this.terrain = this.add.graphics().setDepth(2);
    this.elevatorGraphics = this.add.graphics().setDepth(9);
    this.effects = this.add.graphics().setDepth(30);
    this.platforms = this.physics.add.staticGroup();
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height + 140, true, true, true, false);
    this.createElevatorLabels();

    if (this.options.mode === "student" && this.options.input && this.options.localPlayer) {
      const initial = this.options.initialState ?? { x: this.scale.width / 2, y: 38, vx: 0, vy: 0 };
      this.spawnX = Phaser.Math.Clamp(initial.x, 180, Math.max(181, this.scale.width - 60));
      this.player = this.add.zone(this.spawnX, initial.y, PLAYER_WIDTH, PLAYER_HEIGHT);
      this.physics.add.existing(this.player);
      this.body = this.player.body as Phaser.Physics.Arcade.Body;
      this.body.setCollideWorldBounds(true).setMaxVelocity(RUN_SPEED, 900).setDragX(2300);
      this.physics.add.collider(this.player, this.platforms);
      this.localActor = this.createActor(`${this.options.localPlayer.label} · 나`, true);
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ready = false;
      this.remotes.clear();
    });
    if (this.board) this.renderBoard(true);
    else this.drawBackdrop();
  }

  setBoard(board: ChunkLineUpBoard): void {
    const nextStructure = structureKey(board);
    const changed = this.structure !== nextStructure;
    this.board = board;
    this.structure = nextStructure;
    if (this.ready) this.renderBoard(changed);
  }

  confirmNearestSlot(): boolean {
    if (!this.body || !this.board) return false;
    const centerX = this.body.center.x;
    const feetY = this.body.bottom;
    const nearest = this.slotLayouts
      .filter((layout) => Math.abs(feetY - layout.y) <= 20
        && centerX >= layout.x - 8
        && centerX <= layout.x + layout.width + 8)
      .sort((left, right) => Math.abs(centerX - (left.x + left.width / 2)) - Math.abs(centerX - (right.x + right.width / 2)))[0];
    if (!nearest || nearest.slot.fixed || nearest.slot.filledBy) return false;
    this.options.onConfirm(nearest.groupId, nearest.slot.id);
    return true;
  }

  showWrong(): void {
    if (!this.body) return;
    this.burst = { kind: "wrong", x: this.body.center.x, y: this.body.center.y, startedAt: this.time.now };
    this.body.setVelocityY(-390);
    const kick = this.body.velocity.x === 0 ? (Math.random() < 0.5 ? -230 : 230) : -Math.sign(this.body.velocity.x) * 230;
    this.body.setVelocityX(kick);
    this.cameras.main.shake(150, 0.012);
    if (this.localActor) {
      this.localActor.image.setTint(0xff5c5c);
      this.tweens.killTweensOf(this.localActor.image);
      this.tweens.add({
        targets: this.localActor.image,
        x: { from: -5, to: 5 },
        duration: 36,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          this.localActor?.image.setX(0).clearTint();
        },
      });
    }
  }

  showCorrect(completedGroup: boolean): void {
    if (!this.body) return;
    this.burst = {
      kind: completedGroup ? "complete" : "correct",
      x: this.body.center.x,
      y: this.body.center.y,
      startedAt: this.time.now,
    };
    if (completedGroup) this.cameras.main.flash(150, 255, 229, 130, false);
    else this.cameras.main.shake(70, 0.0035);
    this.body.setAccelerationX(0).setVelocity(0, -140);
    this.time.delayedCall(170, () => this.respawnFromTop());
  }

  override update(time: number): void {
    const frames = this.options.samplePlayers();
    this.updateElevators();
    if (this.body && this.options.input) this.updateLocalPlayer(time);
    this.updateActors(time, frames);
    this.drawBurst(time);
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
    if (input.resetQueued || body.center.y > this.scale.height + 55) {
      input.resetQueued = false;
      this.respawnFromTop();
    }
    const directions = [...input.held.values()];
    const left = directions.includes("left");
    const right = directions.includes("right");
    const grounded = body.blocked.down && body.velocity.y >= 0;
    body.setAccelerationX((Number(right) - Number(left)) * (grounded ? 2350 : 1320));
    body.setDragX(grounded ? 2350 : 650);
    const jumpVelocity = takeJump(this.jump, grounded, input.jumpQueued, time);
    input.jumpQueued = false;
    if (jumpVelocity !== null) body.setVelocityY(jumpVelocity);
    this.keepOutsideElevatorShafts();
    this.options.publish(this.movement());
  }

  private keepOutsideElevatorShafts(): void {
    if (!this.body || this.localRide) return;
    const halfPlayer = PLAYER_WIDTH / 2;
    const leftBoundary = ELEVATOR_EDGE + ELEVATOR_SHAFT_WIDTH + halfPlayer;
    const rightBoundary = this.scale.width - ELEVATOR_EDGE - ELEVATOR_SHAFT_WIDTH - halfPlayer;
    if (this.body.center.x < leftBoundary) {
      this.body.x = leftBoundary - halfPlayer;
      if (this.body.velocity.x < 0) this.body.setVelocityX(0);
    } else if (this.body.center.x > rightBoundary) {
      this.body.x = rightBoundary - halfPlayer;
      if (this.body.velocity.x > 0) this.body.setVelocityX(0);
    }
  }

  private movement(): LiveMovementState {
    if (!this.body) return this.options.initialState ?? { x: this.spawnX, y: 38, vx: 0, vy: 0 };
    return { x: this.body.center.x, y: this.body.center.y, vx: this.body.velocity.x, vy: this.body.velocity.y };
  }

  private respawnFromTop(): void {
    if (!this.body) return;
    const width = this.scale.width;
    const targetX = Phaser.Math.Clamp(
      this.spawnX + Phaser.Math.Between(-Math.round(width * 0.18), Math.round(width * 0.18)),
      190,
      Math.max(191, width - 50),
    );
    this.body.reset(targetX, 34);
    this.jump = createJumpState();
    this.options.publish(this.movement());
  }

  private createActor(label: string, self: boolean): Actor {
    const shadow = this.add.ellipse(0, -2, 36, 9, 0x243b53, 0.16);
    const image = this.add.image(0, 0, "chunk-line-up-runner").setOrigin(0.5, 1).setDisplaySize(44, 53);
    if (!self) image.setTint(0xc9e8ff);
    const name = this.add.text(0, -61, compact(label, 14), {
      fontFamily: "sans-serif",
      fontSize: self ? "12px" : "10px",
      color: self ? "#103b31" : "#24445e",
      backgroundColor: "rgba(255,255,255,.82)",
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    const token = this.add.text(0, -78, "", {
      fontFamily: "sans-serif",
      fontSize: self ? "13px" : "10px",
      fontStyle: "bold",
      color: self ? "#5b2500" : "#334155",
      backgroundColor: self ? "rgba(254,243,199,.96)" : "rgba(255,255,255,.76)",
      padding: { x: self ? 6 : 4, y: 2 },
    }).setOrigin(0.5);
    return {
      container: this.add.container(0, 0, [shadow, image, name, token]).setDepth(self ? 22 : 18),
      shadow,
      image,
      name,
      token,
    };
  }

  private updateActor(actor: Actor, state: LiveMovementState, time: number, token: string | undefined, riding: boolean): void {
    actor.container.setPosition(Math.round(state.x), Math.round(state.y + PLAYER_HEIGHT / 2));
    const running = Math.abs(state.vx) > 15 && Math.abs(state.vy) < 8;
    actor.image.setY(running ? -Math.abs(Math.sin(time / 72)) * 3.5 : 0);
    actor.image.setRotation(running ? Math.sin(time / 72) * 0.085 : Phaser.Math.Clamp(state.vx / 3500, -0.085, 0.085));
    actor.shadow.setScale(running ? 0.86 + Math.abs(Math.sin(time / 72)) * 0.12 : 1, 1);
    actor.container.setAlpha(riding ? 0.56 : 1);
    if (Math.abs(state.vx) > 5) actor.image.setFlipX(state.vx < 0);
    const nextToken = compact(token ?? "", actor === this.localActor ? 26 : 17);
    if (actor.token.text !== nextToken) actor.token.setText(nextToken);
  }

  private updateActors(time: number, frames: readonly LiveRemoteFrame[]): void {
    if (this.localActor && this.options.localPlayer && this.body) {
      this.updateActor(
        this.localActor,
        this.movement(),
        time,
        this.options.playerToken(this.options.localPlayer.id),
        this.elevatorFadedRiderIds.has(this.options.localPlayer.id),
      );
    }
    const visible = new Set<string>();
    for (const frame of frames) {
      if (frame.playerId === this.options.localPlayer?.id) continue;
      const label = this.options.playerLabel(frame.playerId);
      if (!label) continue;
      visible.add(frame.playerId);
      let actor = this.remotes.get(frame.playerId);
      if (!actor) {
        actor = this.createActor(label, false);
        this.remotes.set(frame.playerId, actor);
      }
      const compactLabel = compact(label, 14);
      if (actor.name.text !== compactLabel) actor.name.setText(compactLabel);
      this.updateActor(actor, frame, time, this.options.playerToken(frame.playerId), this.elevatorFadedRiderIds.has(frame.playerId));
    }
    for (const [id, actor] of this.remotes) {
      if (visible.has(id)) continue;
      actor.container.destroy();
      this.remotes.delete(id);
    }
  }

  private renderBoard(rebuildPhysics: boolean): void {
    if (!this.board || !this.ready) return;
    const width = this.scale.width;
    const height = this.scale.height;
    this.drawBackdrop();
    this.terrain.clear();
    this.textNodes.forEach((node) => node.destroy());
    this.textNodes = [];
    this.slotLayouts = [];
    if (rebuildPhysics) this.platforms.clear(true, true);

    const groups = this.board.groups;
    const top = Math.max(HUD_SAFE_TOP + 38, 112);
    const bottom = Math.max(top + 80, height - FLOOR_HEIGHT - 44);
    const rowStep = groups.length > 1 ? (bottom - top) / (groups.length - 1) : 0;
    const slotsLeft = Math.max(330, width * 0.27);
    const slotsRight = width - (ELEVATOR_EDGE + ELEVATOR_SHAFT_WIDTH + ELEVATOR_LANDING_WIDTH);
    const promptX = slotsLeft;
    const promptWidth = Math.max(180, slotsRight - slotsLeft);
    const slotGap = Math.max(4, Math.min(8, width * 0.006));

    groups.forEach((group, groupIndex) => {
      const y = groups.length === 1 ? (top + bottom) / 2 : top + rowStep * groupIndex;
      const count = Math.max(1, group.slots.length);
      const slotWidth = Math.max(54, (slotsRight - slotsLeft - slotGap * (count - 1)) / count);
      const promptText = compact(group.prompt.replaceAll("/", " ").replace(/\s+/g, " "), 72);
      const prompt = this.add.text(promptX, y - 28, `뜻 · ${promptText}`, {
        fontFamily: "sans-serif",
        fontSize: `${Math.round(Phaser.Math.Clamp(width / 72, 13, 16))}px`,
        fontStyle: "bold",
        color: "#123247",
        backgroundColor: "rgba(255,255,255,.94)",
        padding: { x: 8, y: 4 },
        wordWrap: { width: promptWidth, useAdvancedWrap: true },
      }).setOrigin(0, 1).setDepth(7);
      this.textNodes.push(prompt);

      group.slots.forEach((slot, slotIndex) => {
        const x = slotsLeft + slotIndex * (slotWidth + slotGap);
        this.slotLayouts.push({ groupId: group.id, slot, x, y, width: slotWidth });
        const fixed = slot.fixed;
        const filled = Boolean(slot.filledBy);
        const baseColor = fixed ? 0xf5c451 : filled ? 0x78c995 : 0x5f7f95;
        this.terrain.fillStyle(baseColor, fixed || filled ? 0.98 : 0.86);
        this.terrain.fillRoundedRect(x, y, slotWidth, 15, 5);
        this.terrain.fillStyle(fixed ? 0xfff4c2 : filled ? 0xdff7e9 : 0xbdd4e2, 1);
        this.terrain.fillRoundedRect(x + 3, y + 2, Math.max(5, slotWidth - 6), 4, 2);
        if (rebuildPhysics) {
          const zone = this.add.zone(x + slotWidth / 2, y + 7, slotWidth, 15);
          this.platforms.add(zone);
        }
        const visibleText = fixed
          ? slot.text
          : filled
            ? `${slot.text} · ${slot.filledLabel ?? "✓"}`
            : `[ ${slotIndex + 1} ]`;
        const label = this.add.text(x + slotWidth / 2, y - 5, compact(visibleText, 28), {
          fontFamily: "sans-serif",
          fontSize: `${Math.round(Phaser.Math.Clamp(slotWidth / 10.5, 9, 13))}px`,
          fontStyle: fixed || filled ? "bold" : "normal",
          color: fixed ? "#6b4500" : filled ? "#14532d" : "#526b7b",
          align: "center",
          wordWrap: { width: Math.max(44, slotWidth - 8), useAdvancedWrap: true },
        }).setOrigin(0.5, 1).setDepth(8);
        this.textNodes.push(label);
      });

      const landingWidth = ELEVATOR_LANDING_WIDTH;
      const leftLandingX = ELEVATOR_EDGE + ELEVATOR_SHAFT_WIDTH + landingWidth / 2 - 2;
      const rightLandingX = width - leftLandingX;
      this.terrain.fillStyle(0x668878, 1)
        .fillRoundedRect(leftLandingX - landingWidth / 2, y, landingWidth, 10, 4)
        .fillRoundedRect(rightLandingX - landingWidth / 2, y, landingWidth, 10, 4);
      if (rebuildPhysics) {
        this.platforms.add(this.add.zone(leftLandingX, y + 5, landingWidth, 10));
        this.platforms.add(this.add.zone(rightLandingX, y + 5, landingWidth, 10));
      }
    });

    const floorY = height - FLOOR_HEIGHT;
    this.terrain.fillStyle(0x5c806f, 1).fillRect(0, floorY, width, FLOOR_HEIGHT);
    this.terrain.fillStyle(0x91c9a9, 1).fillRect(0, floorY, width, 6);
    if (rebuildPhysics) {
      const floor = this.add.zone(width / 2, floorY + FLOOR_HEIGHT / 2, width, FLOOR_HEIGHT);
      this.platforms.add(floor);
      const stairCount = Math.max(5, groups.length + 1);
      const stairTop = top + 28;
      const stairBottom = floorY - 32;
      for (let index = 0; index < stairCount; index += 1) {
        const ratio = stairCount === 1 ? 0 : index / (stairCount - 1);
        const y = Phaser.Math.Linear(stairBottom, stairTop, ratio);
        const x = index % 2 === 0 ? 222 : 276;
        const width = 74;
        const zone = this.add.zone(x, y, width, 12);
        this.platforms.add(zone);
      }
    }
    for (let index = 0; index < Math.max(5, groups.length + 1); index += 1) {
      const stairCount = Math.max(5, groups.length + 1);
      const ratio = stairCount === 1 ? 0 : index / (stairCount - 1);
      const y = Phaser.Math.Linear(floorY - 32, top + 28, ratio);
      const x = index % 2 === 0 ? 185 : 239;
      this.terrain.fillStyle(0x769786, 1).fillRoundedRect(x, y, 74, 10, 4);
    }
    this.platforms.refresh();
  }

  private drawBackdrop(): void {
    this.cameras.main.setBackgroundColor("#dff4f7");
    if (!this.terrain) return;
  }

  private createElevatorLabels(): void {
    for (const id of ["left", "right"] as const) {
      const label = this.add.text(0, 0, "0/3", {
        fontFamily: "sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#f8fafc",
        backgroundColor: "rgba(30,41,59,.9)",
        padding: { x: 5, y: 2 },
      }).setOrigin(0.5).setDepth(13);
      this.elevatorLabels.set(id, label);
    }
  }

  private elevatorX(id: ChunkLineUpElevatorId): number {
    return id === "left"
      ? ELEVATOR_EDGE + ELEVATOR_SHAFT_WIDTH / 2
      : this.scale.width - ELEVATOR_EDGE - ELEVATOR_SHAFT_WIDTH / 2;
  }

  private floorTopY(floor: number): number {
    const groupCount = this.board?.groups.length ?? 0;
    const height = this.scale.height;
    if (groupCount === 0 || floor >= groupCount) return height - FLOOR_HEIGHT;
    const top = Math.max(HUD_SAFE_TOP + 38, 112);
    const bottom = Math.max(top + 80, height - FLOOR_HEIGHT - 44);
    if (groupCount === 1) return (top + bottom) / 2;
    return top + (bottom - top) * floor / (groupCount - 1);
  }

  private elevatorPlatformY(floorPosition: number): number {
    const groupCount = this.board?.groups.length ?? 0;
    const bounded = Phaser.Math.Clamp(floorPosition, 0, groupCount);
    const low = Math.floor(bounded);
    const high = Math.ceil(bounded);
    if (low === high) return this.floorTopY(low);
    return Phaser.Math.Linear(this.floorTopY(low), this.floorTopY(high), bounded - low);
  }

  private localPlayerNearElevator(id: ChunkLineUpElevatorId, floor: number): boolean {
    if (!this.body) return false;
    const shaftX = this.elevatorX(id);
    const xDistance = Math.abs(this.body.center.x - shaftX);
    const yDistance = Math.abs(this.body.bottom - this.floorTopY(floor));
    return xDistance <= ELEVATOR_SHAFT_WIDTH / 2 + PLAYER_WIDTH + 16 && yDistance <= 30;
  }

  private drawElevatorCar(
    id: ChunkLineUpElevatorId,
    car: ChunkLineUpElevatorState[ChunkLineUpElevatorId],
    now: number,
  ): void {
    const x = this.elevatorX(id);
    const groupCount = this.board?.groups.length ?? 0;
    const shaftTop = this.floorTopY(0) - ELEVATOR_CABIN_HEIGHT - 16;
    const shaftBottom = this.floorTopY(groupCount) + 8;
    this.elevatorGraphics.fillStyle(0x27424f, 0.24)
      .fillRoundedRect(x - ELEVATOR_SHAFT_WIDTH / 2, shaftTop, ELEVATOR_SHAFT_WIDTH, shaftBottom - shaftTop, 8);
    this.elevatorGraphics.lineStyle(2, 0x355c6a, 0.75)
      .strokeRoundedRect(x - ELEVATOR_SHAFT_WIDTH / 2, shaftTop, ELEVATOR_SHAFT_WIDTH, shaftBottom - shaftTop, 8);

    const floorPosition = chunkLineUpElevatorFloorPosition(car, now);
    const platformY = this.elevatorPlatformY(floorPosition);
    const cabinTop = platformY - ELEVATOR_CABIN_HEIGHT + 6;
    const cabinLeft = x - ELEVATOR_CABIN_WIDTH / 2;
    this.elevatorGraphics.fillStyle(0xe7eef2, 1)
      .fillRoundedRect(cabinLeft, cabinTop, ELEVATOR_CABIN_WIDTH, ELEVATOR_CABIN_HEIGHT, 5);
    this.elevatorGraphics.lineStyle(2, 0x294d5c, 1)
      .strokeRoundedRect(cabinLeft, cabinTop, ELEVATOR_CABIN_WIDTH, ELEVATOR_CABIN_HEIGHT, 5);

    const openRatio = chunkLineUpElevatorDoorOpenRatio(car, now);
    const half = ELEVATOR_CABIN_WIDTH / 2;
    const panelWidth = half * (1 - openRatio);
    this.elevatorGraphics.fillStyle(0x55727f, 0.96);
    if (panelWidth > 0.5) {
      this.elevatorGraphics.fillRect(cabinLeft, cabinTop + 2, panelWidth, ELEVATOR_CABIN_HEIGHT - 4);
      this.elevatorGraphics.fillRect(x + half - panelWidth, cabinTop + 2, panelWidth, ELEVATOR_CABIN_HEIGHT - 4);
    }
    this.elevatorGraphics.fillStyle(0x355c6a, 1).fillRect(cabinLeft + 4, platformY + 3, ELEVATOR_CABIN_WIDTH - 8, 5);

    const label = this.elevatorLabels.get(id);
    label?.setText(`${id === "left" ? "L" : "R"} ${car.seats.length}/${CHUNK_LINE_UP_ELEVATOR_CAPACITY}`)
      .setPosition(x, cabinTop - 13);
  }

  private updateElevators(): void {
    this.elevatorGraphics.clear();
    if (!this.board) return;
    const raw = this.options.elevatorState();
    if (!raw) {
      for (const label of this.elevatorLabels.values()) label.setVisible(false);
      return;
    }
    const now = this.options.nowMs();
    const state = resolveChunkLineUpElevatorState(raw, now);
    for (const label of this.elevatorLabels.values()) label.setVisible(true);
    this.drawElevatorCar("left", state.left, now);
    this.drawElevatorCar("right", state.right, now);

    this.elevatorFadedRiderIds = new Set([
      ...(state.left.phase === "open" ? [] : state.left.seats.map((seat) => seat.playerId)),
      ...(state.right.phase === "open" ? [] : state.right.seats.map((seat) => seat.playerId)),
    ]);
    const localId = this.options.localPlayer?.id;
    const previousRide = this.localRide;
    const ride = localId ? findChunkLineUpPlayerElevator(state, localId) : null;
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
      this.options.onElevatorRideChange(this.localRide);
    }

    if (this.body && ride) {
      clearPlatformerInput(this.options.input!);
      const seatIndex = Math.max(0, ride.car.seats.findIndex((seat) => seat.playerId === localId));
      const seatOffset = [-18, 0, 18][seatIndex] ?? 0;
      const platformY = this.elevatorPlatformY(chunkLineUpElevatorFloorPosition(ride.car, now));
      this.body.reset(this.elevatorX(ride.elevatorId) + seatOffset, platformY - PLAYER_HEIGHT / 2);
    } else if (this.body && previousRide && !ride) {
      const car = state[previousRide.elevatorId];
      const exitDirection = previousRide.elevatorId === "left" ? 1 : -1;
      const exitX = this.elevatorX(previousRide.elevatorId)
        + exitDirection * (ELEVATOR_SHAFT_WIDTH / 2 + PLAYER_WIDTH + 8);
      this.body.reset(exitX, this.floorTopY(car.floor) - PLAYER_HEIGHT / 2);
      this.body.setVelocityX(exitDirection * 90);
    }

    if (!localId || ride) return;
    for (const id of ["left", "right"] as const) {
      const car = state[id];
      if (car.phase !== "open" || car.seats.length >= CHUNK_LINE_UP_ELEVATOR_CAPACITY) continue;
      if (!this.localPlayerNearElevator(id, car.floor)) continue;
      const lastReserve = this.lastElevatorReserveAt.get(id) ?? Number.NEGATIVE_INFINITY;
      if (now - lastReserve < 500) continue;
      this.lastElevatorReserveAt.set(id, now);
      this.options.onReserveElevator(id, car.floor);
    }
  }

  private drawBurst(time: number): void {
    this.effects.clear();
    if (!this.burst) return;
    const duration = this.burst.kind === "complete" ? 520 : 260;
    const age = time - this.burst.startedAt;
    if (age >= duration) {
      this.burst = null;
      return;
    }
    const ratio = Phaser.Math.Clamp(age / duration, 0, 1);
    const alpha = 1 - ratio;
    const correct = this.burst.kind !== "wrong";
    const color = this.burst.kind === "wrong" ? 0xef4444 : this.burst.kind === "complete" ? 0xf59e0b : 0x22c55e;
    const radius = Phaser.Math.Linear(14, this.burst.kind === "complete" ? 72 : 42, ratio);
    this.effects.lineStyle(this.burst.kind === "complete" ? 5 : 4, color, alpha * 0.85);
    this.effects.strokeCircle(this.burst.x, this.burst.y, radius);
    const rays = this.burst.kind === "complete" ? 14 : 8;
    for (let index = 0; index < rays; index += 1) {
      const angle = index * Math.PI * 2 / rays;
      const inner = radius + 4;
      const outer = radius + (correct ? 22 : 12) * alpha;
      this.effects.lineBetween(
        this.burst.x + Math.cos(angle) * inner,
        this.burst.y + Math.sin(angle) * inner,
        this.burst.x + Math.cos(angle) * outer,
        this.burst.y + Math.sin(angle) * outer,
      );
      if (correct) {
        const starRadius = this.burst.kind === "complete" ? 8 : 6;
        const starX = this.burst.x + Math.cos(angle) * (outer + 7 + ratio * 10);
        const starY = this.burst.y + Math.sin(angle) * (outer + 7 + ratio * 10);
        const points: Phaser.Math.Vector2[] = [];
        for (let point = 0; point < 10; point += 1) {
          const starAngle = -Math.PI / 2 + point * Math.PI / 5;
          const pointRadius = point % 2 === 0 ? starRadius : starRadius * 0.42;
          points.push(new Phaser.Math.Vector2(
            starX + Math.cos(starAngle) * pointRadius,
            starY + Math.sin(starAngle) * pointRadius,
          ));
        }
        this.effects.fillStyle(this.burst.kind === "complete" ? 0xfbbf24 : 0xfde047, alpha);
        this.effects.fillPoints(points, true);
      }
    }
  }
}
