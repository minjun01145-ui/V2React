import Phaser from "phaser";
import type { PlatformerInput } from "../../game-engine/platformer/movement.ts";
import { clearPlatformerInput, createJumpState, takeJump } from "../../game-engine/platformer/movement.ts";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import type {
  ChunkLineUpBoard,
  ChunkLineUpElevatorState,
  ChunkLineUpSlot,
} from "../../multiplayer/chunk-line-up/types.ts";
import { chunkLineUpElevatorProgress } from "./model.ts";

const RUN_SPEED = 285;
const PLAYER_WIDTH = 24;
const PLAYER_HEIGHT = 38;
const HUD_SAFE_TOP = 72;
const FLOOR_HEIGHT = 28;
const ELEVATOR_X = 62;
const ELEVATOR_WIDTH = 86;
const ELEVATOR_HEIGHT = 14;
const ELEVATOR_CAPACITY = 3;

interface Actor {
  readonly container: Phaser.GameObjects.Container;
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
  readonly elevatorEpochMs: number;
  readonly elevatorState: () => ChunkLineUpElevatorState | null;
  readonly nowMs: () => number;
  readonly onReserveElevator: () => void;
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
  private elevator!: Phaser.GameObjects.Zone;
  private elevatorBody!: Phaser.Physics.Arcade.Body;
  private elevatorLabel!: Phaser.GameObjects.Text;
  private elevatorAdmittedIds = new Set<string>();
  private elevatorBoarding = false;
  private lastElevatorReserveAt = Number.NEGATIVE_INFINITY;
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
    this.createElevator();

    if (this.options.mode === "student" && this.options.input && this.options.localPlayer) {
      const initial = this.options.initialState ?? { x: this.scale.width / 2, y: 38, vx: 0, vy: 0 };
      this.spawnX = Phaser.Math.Clamp(initial.x, 180, Math.max(181, this.scale.width - 60));
      this.player = this.add.zone(this.spawnX, initial.y, PLAYER_WIDTH, PLAYER_HEIGHT);
      this.physics.add.existing(this.player);
      this.body = this.player.body as Phaser.Physics.Arcade.Body;
      this.body.setCollideWorldBounds(true).setMaxVelocity(RUN_SPEED, 900).setDragX(1900);
      this.physics.add.collider(this.player, this.platforms);
      this.physics.add.collider(this.player, this.elevator);
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
    this.body.setVelocityY(-330);
    this.body.setVelocityX(Phaser.Math.Clamp(-this.body.velocity.x * 0.5, -150, 150));
  }

  showCorrect(completedGroup: boolean): void {
    if (!this.body) return;
    this.burst = {
      kind: completedGroup ? "complete" : "correct",
      x: this.body.center.x,
      y: this.body.center.y,
      startedAt: this.time.now,
    };
    this.body.setAccelerationX(0).setVelocity(0, -140);
    this.time.delayedCall(170, () => this.respawnFromTop());
  }

  override update(time: number): void {
    const frames = this.options.samplePlayers();
    this.updateElevator();
    if (this.body && this.options.input) this.updateLocalPlayer(time);
    this.updateActors(time, frames);
    this.drawBurst(time);
  }

  private updateLocalPlayer(time: number): void {
    const body = this.body;
    const input = this.options.input;
    if (!body || !input) return;
    if (input.resetQueued || body.center.y > this.scale.height + 55) {
      input.resetQueued = false;
      this.respawnFromTop();
    }
    const directions = [...input.held.values()];
    const left = directions.includes("left");
    const right = directions.includes("right");
    const grounded = body.blocked.down && body.velocity.y >= 0;
    body.setAccelerationX((Number(right) - Number(left)) * (grounded ? 1800 : 1250));
    body.setDragX(grounded ? 1900 : 620);
    const jumpVelocity = takeJump(this.jump, grounded, input.jumpQueued, time);
    input.jumpQueued = false;
    if (jumpVelocity !== null) body.setVelocityY(jumpVelocity);
    this.limitElevatorEntry();
    this.options.publish(this.movement());
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
    const image = this.add.image(0, 0, "chunk-line-up-runner").setOrigin(0.5, 1).setDisplaySize(31, 38);
    if (!self) image.setTint(0xc9e8ff);
    const name = this.add.text(0, -45, compact(label, 14), {
      fontFamily: "sans-serif",
      fontSize: self ? "11px" : "9px",
      color: self ? "#103b31" : "#24445e",
      backgroundColor: "rgba(255,255,255,.82)",
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    const token = this.add.text(0, -61, "", {
      fontFamily: "sans-serif",
      fontSize: self ? "12px" : "9px",
      fontStyle: "bold",
      color: self ? "#5b2500" : "#334155",
      backgroundColor: self ? "rgba(254,243,199,.96)" : "rgba(255,255,255,.76)",
      padding: { x: self ? 6 : 4, y: 2 },
    }).setOrigin(0.5);
    return {
      container: this.add.container(0, 0, [image, name, token]).setDepth(self ? 22 : 18),
      image,
      name,
      token,
    };
  }

  private updateActor(actor: Actor, state: LiveMovementState, time: number, token: string | undefined): void {
    actor.container.setPosition(Math.round(state.x), Math.round(state.y + PLAYER_HEIGHT / 2));
    const running = Math.abs(state.vx) > 15 && Math.abs(state.vy) < 8;
    actor.image.setY(running ? -Math.abs(Math.sin(time / 85)) * 2 : 0);
    actor.image.setRotation(running ? Math.sin(time / 85) * 0.05 : Phaser.Math.Clamp(state.vx / 4200, -0.07, 0.07));
    if (Math.abs(state.vx) > 5) actor.image.setFlipX(state.vx < 0);
    const nextToken = compact(token ?? "", actor === this.localActor ? 26 : 17);
    if (actor.token.text !== nextToken) actor.token.setText(nextToken);
  }

  private updateActors(time: number, frames: readonly LiveRemoteFrame[]): void {
    if (this.localActor && this.options.localPlayer && this.body) {
      this.updateActor(this.localActor, this.movement(), time, this.options.playerToken(this.options.localPlayer.id));
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
      this.updateActor(actor, frame, time, this.options.playerToken(frame.playerId));
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
    const promptX = 126;
    const promptWidth = Math.min(200, Math.max(132, width * 0.16));
    const slotsLeft = Math.max(330, width * 0.27);
    const slotsRight = width - 18;
    const slotGap = Math.max(4, Math.min(8, width * 0.006));

    groups.forEach((group, groupIndex) => {
      const y = groups.length === 1 ? (top + bottom) / 2 : top + rowStep * groupIndex;
      const count = Math.max(1, group.slots.length);
      const slotWidth = Math.max(54, (slotsRight - slotsLeft - slotGap * (count - 1)) / count);
      const prompt = this.add.text(promptX, y - 31, compact(group.prompt, 36), {
        fontFamily: "sans-serif",
        fontSize: `${Math.round(Phaser.Math.Clamp(width / 88, 11, 15))}px`,
        fontStyle: "bold",
        color: "#163b52",
        backgroundColor: "rgba(255,255,255,.76)",
        padding: { x: 6, y: 3 },
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
    this.positionElevator(top + 18, floorY - 16);
    this.platforms.refresh();
  }

  private drawBackdrop(): void {
    this.cameras.main.setBackgroundColor("#dff4f7");
    if (!this.terrain) return;
  }

  private createElevator(): void {
    this.elevator = this.add.zone(ELEVATOR_X, this.scale.height - 70, ELEVATOR_WIDTH, ELEVATOR_HEIGHT);
    this.physics.add.existing(this.elevator);
    this.elevatorBody = this.elevator.body as Phaser.Physics.Arcade.Body;
    this.elevatorBody.setAllowGravity(false).setImmovable(true).setVelocity(0, 0);
    this.elevatorLabel = this.add.text(ELEVATOR_X, this.scale.height - 88, "엘리베이터 0/3", {
      fontFamily: "sans-serif",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#334155",
      backgroundColor: "rgba(255,255,255,.84)",
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(10);
  }

  private elevatorBounds(): { readonly top: number; readonly bottom: number } {
    const top = Math.max(HUD_SAFE_TOP + 54, 130);
    const bottom = Math.max(top + 90, this.scale.height - FLOOR_HEIGHT - 20);
    return { top, bottom };
  }

  private elevatorPosition(nowMs: number, top: number, bottom: number): { readonly y: number; readonly boarding: boolean } {
    const phase = chunkLineUpElevatorProgress(nowMs, this.options.elevatorEpochMs);
    return { y: Phaser.Math.Linear(bottom, top, phase.progress), boarding: phase.boarding };
  }

  private positionElevator(top: number, bottom: number): void {
    if (!this.elevatorBody) return;
    const next = this.elevatorPosition(this.options.nowMs(), top, bottom);
    this.elevator.setX(ELEVATOR_X).setY(next.y);
    this.elevatorBody.reset(ELEVATOR_X, next.y);
    this.elevatorLabel.setX(ELEVATOR_X).setY(this.elevator.y - 18);
  }

  private localPlayerNearElevator(): boolean {
    return Boolean(
      this.body
      && Math.abs(this.body.center.x - this.elevator.x) <= ELEVATOR_WIDTH / 2 - 4
      && Math.abs(this.body.bottom - this.elevator.y) <= 28,
    );
  }

  private updateElevator(): void {
    if (!this.elevatorBody) return;
    const { top, bottom } = this.elevatorBounds();
    const previousY = this.elevator.y;
    const now = this.options.nowMs();
    const phase = chunkLineUpElevatorProgress(now, this.options.elevatorEpochMs);
    const next = { y: Phaser.Math.Linear(bottom, top, phase.progress), boarding: phase.boarding };
    const state = this.options.elevatorState();
    const admitted = state?.cycle === phase.cycle ? state.seats.slice(0, ELEVATOR_CAPACITY) : [];
    this.elevatorAdmittedIds = new Set(admitted);
    this.elevatorBoarding = phase.boarding;
    const localId = this.options.localPlayer?.id;
    if (
      phase.boarding
      && localId
      && !this.elevatorAdmittedIds.has(localId)
      && this.localPlayerNearElevator()
      && now - this.lastElevatorReserveAt >= 350
    ) {
      this.lastElevatorReserveAt = now;
      this.options.onReserveElevator();
    }
    this.elevatorLabel
      .setText(`엘리베이터 ${admitted.length}/${ELEVATOR_CAPACITY}`)
      .setPosition(ELEVATOR_X, next.y - 18);
    this.elevatorGraphics.clear();
    this.elevatorGraphics.fillStyle(0x4d6b76, 1).fillRoundedRect(
      ELEVATOR_X - ELEVATOR_WIDTH / 2,
      next.y - ELEVATOR_HEIGHT / 2,
      ELEVATOR_WIDTH,
      ELEVATOR_HEIGHT,
      5,
    );
    const localRiding = Boolean(
      this.body
      && localId
      && this.elevatorAdmittedIds.has(localId)
      && Math.abs(this.body.bottom - previousY) <= 22
      && Math.abs(this.body.center.x - ELEVATOR_X) <= ELEVATOR_WIDTH / 2,
    );
    this.elevatorBody.reset(ELEVATOR_X, next.y);
    if (localRiding && this.body) {
      this.body.y += next.y - previousY;
    }
  }

  private limitElevatorEntry(): void {
    if (!this.body || !this.options.localPlayer) return;
    const close = Math.abs(this.body.center.x - this.elevator.x) <= ELEVATOR_WIDTH / 2
      && Math.abs(this.body.bottom - this.elevator.y) <= 34;
    if (!close || this.elevatorBoarding || this.elevatorAdmittedIds.has(this.options.localPlayer.id)) return;
    const direction = this.body.center.x < this.elevator.x ? -1 : 1;
    this.body.setVelocityX(direction * 150);
    this.body.x += direction * 3;
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
    }
  }
}
