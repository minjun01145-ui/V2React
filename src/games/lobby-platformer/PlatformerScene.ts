import Phaser from "phaser";
import type { LiveMovementState, LiveRemoteFrame } from "../../live-world/core/types.ts";
import { createActor, positionActor, type PlatformerActor } from "./actors.ts";
import { PLATFORMS, PLAYER_HEIGHT, PLAYER_WIDTH, RUN_SPEED, SPAWN, WORLD_HEIGHT, WORLD_WIDTH } from "./level.ts";
import { clearPlatformerInput, createJumpState, takeJump, type PlatformerInput } from "./movement.ts";

export interface PlatformerSceneOptions {
  readonly input: PlatformerInput;
  readonly label: string;
  readonly publish: (state: LiveMovementState) => void;
  readonly samplePlayers: () => readonly LiveRemoteFrame[];
  readonly playerLabel: (id: string) => string | undefined;
}

export default class PlatformerScene extends Phaser.Scene {
  private readonly options: PlatformerSceneOptions;
  private player!: Phaser.GameObjects.Zone;
  private body!: Phaser.Physics.Arcade.Body;
  private actor!: PlatformerActor;
  private jump = createJumpState();
  private readonly remotes = new Map<string, PlatformerActor>();

  constructor(options: PlatformerSceneOptions) {
    super("lobby-platformer");
    this.options = options;
  }

  preload(): void {
    // Phaser's SVG loader expects a URL or base64, not Vite's URL-encoded data URI.
    const runnerUrl = new URL("../../game-engine/assets/test-runner.svg?no-inline", import.meta.url).href;
    this.load.svg("runner", runnerUrl, { width: 80, height: 96 });
  }

  create(): void {
    this.drawLevel();
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT + 200, true, true, true, false);
    this.player = this.add.zone(SPAWN.x, SPAWN.y, PLAYER_WIDTH, PLAYER_HEIGHT);
    this.physics.add.existing(this.player);
    this.body = this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true).setMaxVelocity(RUN_SPEED, 900).setDragX(2000);
    const platforms = this.physics.add.staticGroup();
    for (const platform of PLATFORMS) {
      const zone = this.add.zone(platform.x + platform.width / 2, platform.y + platform.height / 2, platform.width, platform.height);
      platforms.add(zone);
    }
    this.physics.add.collider(this.player, platforms);
    this.actor = createActor(this, `${this.options.label} · 나`, true);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, -120, 70);
    this.cameras.main.setDeadzone(120, 100);

    const stop = (): void => {
      clearPlatformerInput(this.options.input);
      this.body.setAccelerationX(0).setVelocityX(0);
      this.options.publish(this.movement());
    };
    this.game.events.on(Phaser.Core.Events.BLUR, stop);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, stop);
      clearPlatformerInput(this.options.input);
      this.remotes.clear();
    });
  }

  override update(time: number): void {
    const input = this.options.input;
    if (input.resetQueued || this.body.center.y > WORLD_HEIGHT + 50) {
      input.resetQueued = false;
      this.body.reset(SPAWN.x, SPAWN.y);
      this.jump = createJumpState();
      this.cameras.main.centerOn(SPAWN.x, SPAWN.y);
    }
    const directions = [...input.held.values()];
    const left = directions.includes("left");
    const right = directions.includes("right");
    const grounded = this.body.blocked.down && this.body.velocity.y >= 0;
    this.body.setAccelerationX((Number(right) - Number(left)) * (grounded ? 1800 : 1250));
    this.body.setDragX(grounded ? 2000 : 650);
    const jumpVelocity = takeJump(this.jump, grounded, input.jumpQueued, time);
    input.jumpQueued = false;
    if (jumpVelocity !== null) this.body.setVelocityY(jumpVelocity);

    const state = this.movement();
    positionActor(this.actor, state, time);
    this.options.publish(state);
    const visible = new Set<string>();
    for (const frame of this.options.samplePlayers()) {
      const label = this.options.playerLabel(frame.playerId);
      if (!label) continue;
      visible.add(frame.playerId);
      let actor = this.remotes.get(frame.playerId);
      if (!actor) {
        actor = createActor(this, label, false);
        this.remotes.set(frame.playerId, actor);
      }
      if (actor.label.text !== label) actor.label.setText(label);
      positionActor(actor, frame, time);
    }
    for (const [id, actor] of this.remotes) {
      if (visible.has(id)) continue;
      actor.container.destroy();
      this.remotes.delete(id);
    }
  }

  private movement(): LiveMovementState {
    return { x: this.body.center.x, y: this.body.center.y, vx: this.body.velocity.x, vy: this.body.velocity.y };
  }

  private drawLevel(): void {
    this.cameras.main.setBackgroundColor("#dff5fa");
    const scenery = this.add.graphics().setScrollFactor(0.3);
    scenery.fillStyle(0xb9dfd7);
    for (let x = -200; x < WORLD_WIDTH; x += 380) scenery.fillEllipse(x, 560, 650, 430);
    scenery.fillStyle(0xffffff, 0.85);
    for (let x = 120; x < WORLD_WIDTH; x += 460) {
      scenery.fillRoundedRect(x, 95 + (x % 3) * 15, 130, 28, 14);
      scenery.fillCircle(x + 50, 90 + (x % 3) * 15, 25);
    }
    const terrain = this.add.graphics();
    PLATFORMS.forEach((platform, index) => {
      terrain.fillStyle(0x8ba988).fillRoundedRect(platform.x, platform.y, platform.width, platform.height, 6);
      terrain.fillStyle(0x429c78).fillRoundedRect(platform.x, platform.y, platform.width, 9, 4);
      if (platform.height < 100) this.add.text(platform.x + 8, platform.y + 10, String(index - 3).padStart(2, "0"), {
        fontFamily: "monospace", fontSize: "10px", color: "#234d3c",
      });
    });
    this.add.text(40, 190, "작은 점프, 큰 모험", { fontFamily: "sans-serif", fontSize: "24px", color: "#234d3c", fontStyle: "bold" });
    this.add.text(40, 227, "발판을 따라 오른쪽으로!\n공중에서 한 번 더 점프할 수 있어요.", { fontFamily: "sans-serif", fontSize: "14px", color: "#426d62", lineSpacing: 8 });
    terrain.lineStyle(4, 0x234d3c).lineBetween(3010, 500, 3010, 360);
    terrain.fillStyle(0xe9b74c).fillTriangle(3012, 360, 3090, 388, 3012, 418);
    this.add.text(2925, 310, "도착! 다시 탐험해요", { fontFamily: "sans-serif", fontSize: "18px", color: "#234d3c" });
  }
}
