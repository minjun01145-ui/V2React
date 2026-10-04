import { CHOICE_DIRECTION, evaluateMultipleChoice, type MultipleChoiceEvaluationDetails, type MultipleChoiceQuestion } from "../../game-engine/question-engine/multiple-choice/index.ts";
import { createAnswerResult } from "../../game-engine/core/answerResult.ts";
import { shuffled } from "../../game-engine/core/random.ts";
import { applyResultToProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import { adaptLearningSetToMultipleChoice } from "../../learning-sets/multipleChoiceAdapter.ts";
import { adaptReadingChunksToSequence } from "../../learning-sets/sentenceSequenceAdapter.ts";
import type { LearningSetQuestionSource } from "../../learning-sets/multipleChoiceTypes.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import { activateBrickItem, BRICK_ITEM_EFFECTS, EMPTY_BRICK_BUFFS, type BrickBuffs, type BrickItemId } from "./items.ts";

export interface BrickQuestion extends MultipleChoiceQuestion<LearningSetQuestionSource> {
  readonly sentence?: { readonly meaning: string; readonly chunks: readonly string[]; readonly chunkIndex: number };
}
export type BrickJudgment = "perfect" | "great" | "good";
export interface BrickDetails extends MultipleChoiceEvaluationDetails {
  readonly buffs?: BrickBuffs;
  readonly judgment?: BrickJudgment;
  /** Points per brick before the gold multiplier: speed score + combo bonus. */
  readonly brickScore?: number;
  readonly comboBonus?: number;
  readonly removedCount?: number;
  readonly activatedItem?: BrickItemId | null;
  readonly protectedMiss?: boolean;
}
export type BrickProgress = GameProgress<BrickDetails>;

export function buildBrickQuestions(set: RuntimeLearningSet, config: Readonly<Record<string, unknown>>, seed: string): readonly BrickQuestion[] {
  const count = config["choice-count"] === "3" ? 3 : 2;
  if (set.type === "reading-chunks") {
    const canonical = adaptReadingChunksToSequence(set);
    const pool = [...new Set(canonical.questions.flatMap((question) => question.tokens.map((token) => token.text)))];
    return canonical.questions.flatMap((question, itemIndex) => {
      const chunks = question.tokens.map((token) => token.text);
      return chunks.map((answer, chunkIndex): BrickQuestion => {
        const id = `${question.id}:brick:${chunkIndex}`;
        // Prefer chunks in this sentence; fill short sentences from the set.
        const candidates = [...new Set([...shuffled(chunks, `${seed}:${id}:local`), ...shuffled(pool, `${seed}:${id}:pool`)])].filter((text) => text !== answer);
        const options = [{ id: `${id}:correct`, text: answer }, ...candidates.slice(0, count - 1).map((text, i) => ({ id: `${id}:wrong:${i}`, text }))];
        return { id, kind: "multiple-choice", prompt: question.prompt, direction: CHOICE_DIRECTION.RIGHT_TO_LEFT,
          correctOptionId: `${id}:correct`, options: shuffled(options, `${seed}:${id}:choices`),
          source: { setId: set.id, itemId: question.id, itemIndex, scope: "chunk", chunkIndex },
          sentence: { meaning: question.prompt, chunks, chunkIndex } };
      });
    });
  }
  if (set.type !== "vocabulary") throw new Error("벽돌 팡팡은 단어 또는 끊어읽기 세트로 플레이할 수 있습니다.");
  return adaptLearningSetToMultipleChoice(set, {
    choiceCount: count,
    direction: config.direction === "meaning-to-source" ? CHOICE_DIRECTION.RIGHT_TO_LEFT : CHOICE_DIRECTION.LEFT_TO_RIGHT,
    seed: `${seed}:brick-smash`,
  }).questions;
}

// Each brick is worth up to 100 for speed (50 when slow) plus a combo bonus of up to +100.
export const BRICK_SCORING = { max: 100, min: 50, fastMs: 700, slowMs: 3_500, comboStep: 5, comboBonusMax: 100 } as const;

export function brickSpeedScore(elapsedMs: number): number {
  const { max, min, fastMs, slowMs } = BRICK_SCORING;
  const late = Math.min(Math.max((elapsedMs - fastMs) / (slowMs - fastMs), 0), 1);
  return Math.round(max - (max - min) * late);
}

export const brickComboBonus = (combo: number) => Math.min(Math.max(combo - 1, 0) * BRICK_SCORING.comboStep, BRICK_SCORING.comboBonusMax);
export const brickJudgment = (speedScore: number): BrickJudgment => speedScore >= 95 ? "perfect" : speedScore >= 75 ? "great" : "good";

export interface BrickStrikeContext {
  readonly itemAt: (index: number) => BrickItemId | null;
  readonly buffs: BrickBuffs;
  readonly now: number;
  /** How long the current brick has been waiting for the right answer. */
  readonly elapsedMs: number;
}
const NO_ITEMS: BrickStrikeContext = { itemAt: () => null, buffs: EMPTY_BRICK_BUFFS, now: 0, elapsedMs: 0 };

export function strikeBrick(progress: BrickProgress, question: BrickQuestion, optionId: string, context: BrickStrikeContext = NO_ITEMS) {
  const evaluated = evaluateMultipleChoice(question, { optionId }, 1);
  const correct = evaluated.isCorrect;
  const protectedMiss = !correct && context.buffs.shield;
  // Every brick the hammer itself hits pays out its item; blast debris cannot hold one (see brickItemAt).
  const hammered = correct ? context.buffs.hammer > context.now ? 2 : 1 : 0;
  const item = Array.from({ length: hammered }, (_, offset) => context.itemAt(progress.currentIndex + offset)).find(Boolean) ?? null;
  let buffs = activateBrickItem(context.buffs, item, context.now);
  if (protectedMiss) buffs = { ...buffs, shield: false };
  const removedCount = correct ? 1 + (buffs.hammer > context.now ? 1 : 0) + (item === "bomb" ? BRICK_ITEM_EFFECTS.bomb.extra : 0) : 0;
  const combo = correct ? progress.combo + 1 : protectedMiss ? progress.combo : 0;
  const speedScore = correct ? brickSpeedScore(context.elapsedMs) : 0;
  const comboBonus = correct ? brickComboBonus(combo) : 0;
  const brickScore = speedScore + comboBonus;
  const result = createAnswerResult<BrickDetails>({ isCorrect: correct,
    scoreDelta: removedCount * brickScore * (buffs.gold > context.now ? 2 : 1),
    details: { selectedOptionId: optionId, correctOptionId: question.correctOptionId, buffs, removedCount, activatedItem: item, protectedMiss,
      ...(correct ? { judgment: brickJudgment(speedScore), brickScore, comboBonus } : {}) } });
  const applied = applyResultToProgress(progress, question.id, result);
  const next: BrickProgress = {
    ...applied,
    currentIndex: progress.currentIndex + removedCount,
    combo,
    completedItemIds: [],
  };
  return { result, progress: next };
}

export function brickAt(questions: readonly BrickQuestion[], index: number): BrickQuestion {
  const question = questions[index % questions.length];
  if (!question) throw new Error("사용할 수 있는 문제가 없습니다.");
  return question;
}

export function currentBrickQuestion(questions: readonly BrickQuestion[], progress: BrickProgress): BrickQuestion {
  // Sentence learning advances one chunk per correct answer, regardless of bonus bricks.
  return brickAt(questions, questions[0]?.sentence ? progress.correctCount : progress.currentIndex);
}
