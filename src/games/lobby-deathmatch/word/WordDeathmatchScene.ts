import { CLIMB_PLAYER_HEIGHT, type ClimbPlatform } from "../../../game-engine/jump-tower/course.ts";
import DeathmatchScene, { type DeathmatchSceneOptions } from "../DeathmatchScene.ts";
import { isOnPlatform, roundAt, type WordQuiz } from "./model.ts";
import { AnswerBoards } from "./scene/AnswerBoards.ts";

export interface WordDeathmatchSceneOptions extends DeathmatchSceneOptions {
  readonly quiz: WordQuiz;
  readonly answers: readonly [ClimbPlatform, ClimbPlatform];
  readonly startedAtMs: number;
  /** Rounds stop scoring once the teacher's time is up; null means untimed. */
  readonly endsAtMs: number | null;
  /** The local player's result when a question's 15 seconds run out. */
  readonly onRoundScored: (index: number, correct: boolean) => void;
}

/** The deathmatch arena, plus a word question whose answer is the platform you stand on when time runs out. */
export default class WordDeathmatchScene extends DeathmatchScene {
  private readonly word: WordDeathmatchSceneOptions;
  private boards!: AnswerBoards;
  private shown = "";
  /** Rounds already judged here, including the one in progress when the scene opened (no score on reload). */
  private judgedThrough = -1;

  constructor(options: WordDeathmatchSceneOptions) {
    super(options);
    this.word = options;
  }

  override create(): void {
    super.create();
    this.boards = new AnswerBoards(this, this.word.answers);
    const round = roundAt(this.word.startedAtMs, this.word.nowMs());
    if (round?.phase === "reveal") this.judgedThrough = round.index;
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    const now = this.word.nowMs();
    const active = this.word.endsAtMs === null || now < this.word.endsAtMs;
    const round = active ? roundAt(this.word.startedAtMs, now) : null;
    const key = round ? `${round.index}:${round.phase}` : "";
    if (key !== this.shown) {
      this.shown = key;
      this.boards.show(round ? this.word.quiz.questionAt(round.index) : null, round?.phase === "reveal");
    }
    if (round?.phase !== "reveal" || round.index <= this.judgedThrough) return;
    this.judgedThrough = round.index;
    const correct = this.word.answers[this.word.quiz.questionAt(round.index).correctSlot];
    this.celebrateWinners(correct);
    const feet = this.localFeet();
    const scored = feet !== null && isOnPlatform(feet, correct);
    this.word.onRoundScored(round.index, scored);
    if (feet && scored) {
      this.hop();
      this.effects.correct(feet.x, feet.y - 30);
    } else if (feet) {
      // Anyone off the answer platform is knocked out, like a fall.
      this.eliminate();
    }
  }

  /** Everyone sees the answer platform burst with confetti, and a star pop over each player standing on it. */
  private celebrateWinners(correct: ClimbPlatform): void {
    this.effects.celebrate(correct.x + 20, correct.x + correct.width - 20, correct.y - 10, "정답!");
    for (const frame of this.word.samplePlayers()) {
      const feet = { x: frame.x, y: frame.y + CLIMB_PLAYER_HEIGHT / 2 };
      if (isOnPlatform(feet, correct)) this.effects.sparkle(feet.x, feet.y - 40);
    }
  }
}
