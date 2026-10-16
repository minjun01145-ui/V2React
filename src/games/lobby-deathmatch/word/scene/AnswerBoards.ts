import Phaser from "phaser";
import type { ClimbPlatform } from "../../../../game-engine/jump-tower/course.ts";
import { FONT_FAMILY, TEXT_RESOLUTION } from "../../../../game-engine/phaser-kit/art.ts";
import type { WordQuestion } from "../model.ts";

const CORRECT = "#16a34a";
const WRONG = "#475569";

/** Large answer labels hanging under the two answer platforms. */
export class AnswerBoards {
  private readonly labels: readonly Phaser.GameObjects.Text[];
  private readonly platforms: readonly ClimbPlatform[];

  constructor(scene: Phaser.Scene, platforms: readonly ClimbPlatform[]) {
    this.platforms = platforms;
    this.labels = platforms.map((platform) => scene.add.text(platform.x + platform.width / 2, platform.y + 22, "", {
      fontFamily: FONT_FAMILY, fontSize: "26px", fontStyle: "700", color: "#ffffff", align: "center",
      padding: { x: 14, y: 6 }, wordWrap: { width: platform.width - 20, useAdvancedWrap: true },
    }).setOrigin(0.5, 0).setDepth(6).setResolution(TEXT_RESOLUTION));
  }

  /** `revealed`: the answer is out, so the correct board turns green and the other dims. */
  show(question: WordQuestion | null, revealed: boolean): void {
    this.labels.forEach((label, slot) => {
      label.setVisible(question !== null);
      if (!question) return;
      const background = revealed ? slot === question.correctSlot ? CORRECT : WRONG : this.platforms[slot]!.style!.labelBackground;
      label.setText(question.options[slot]!).setBackgroundColor(background).setAlpha(revealed && slot !== question.correctSlot ? 0.6 : 1);
      if (label.height > 60) label.setScale(60 / label.height);
      else label.setScale(1);
    });
  }
}
