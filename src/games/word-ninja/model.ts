import { CHOICE_DIRECTION, evaluateMultipleChoice, type MultipleChoiceEvaluationDetails, type MultipleChoiceQuestion } from "../../game-engine/question-engine/multiple-choice/index.ts";
import { createAnswerResult } from "../../game-engine/core/answerResult.ts";
import { createSeededRandom, hashString } from "../../game-engine/core/random.ts";
import { applyResultToProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { TimedBuffDefinitions } from "../../game-engine/timed-buffs/model.ts";
import { adaptLearningSetToMultipleChoice } from "../../learning-sets/multipleChoiceAdapter.ts";
import type { LearningSetQuestionSource } from "../../learning-sets/multipleChoiceTypes.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";

export type NinjaQuestion = MultipleChoiceQuestion<LearningSetQuestionSource>;
export type NinjaJudgment = "perfect" | "great" | "good";
export interface NinjaDetails extends MultipleChoiceEvaluationDetails {
  readonly judgment?: NinjaJudgment;
  readonly golden?: boolean;
  readonly comboBonus?: number;
  /** Sliced while every option counted as correct. */
  readonly frenzy?: boolean;
}
export type NinjaProgress = GameProgress<NinjaDetails>;

export function buildNinjaQuestions(set: RuntimeLearningSet, config: Readonly<Record<string, unknown>>, seed: string): readonly NinjaQuestion[] {
  if (set.type !== "vocabulary") throw new Error("단어 닌자는 단어 세트로 플레이할 수 있습니다.");
  return adaptLearningSetToMultipleChoice(set, {
    choiceCount: config["choice-count"] === "4" ? 4 : 3,
    direction: config.direction === "meaning-to-source" ? CHOICE_DIRECTION.RIGHT_TO_LEFT : CHOICE_DIRECTION.LEFT_TO_RIGHT,
    seed: `${seed}:word-ninja`,
  }).questions;
}

// A fruit is worth up to 100 for speed (50 when slow) plus a combo bonus of up to +100; golden fruit doubles it.
// Fruit fly for about 2.6 seconds, so the speed window is wider than brick smash's.
export const NINJA_SCORING = { max: 100, min: 50, fastMs: 1_100, slowMs: 4_000, comboStep: 5, comboBonusMax: 100 } as const;

export function ninjaSpeedScore(elapsedMs: number): number {
  const { max, min, fastMs, slowMs } = NINJA_SCORING;
  const late = Math.min(Math.max((elapsedMs - fastMs) / (slowMs - fastMs), 0), 1);
  return Math.round(max - (max - min) * late);
}

export const ninjaComboBonus = (combo: number) => Math.min(Math.max(combo - 1, 0) * NINJA_SCORING.comboStep, NINJA_SCORING.comboBonusMax);
export const ninjaJudgment = (speedScore: number): NinjaJudgment => speedScore >= 95 ? "perfect" : speedScore >= 75 ? "great" : "good";

const GOLDEN_STRETCH = 7;

/** One golden wave in each seven-question stretch; stable through retries and reconnects. */
export function isGoldenWave(seed: string, index: number): boolean {
  return index % GOLDEN_STRETCH === 3 + hashString(`${seed}:golden:${Math.floor(index / GOLDEN_STRETCH)}`) % 4;
}

export type NinjaItemKind = "frenzy" | "curse";

/** Frenzy makes every fruit correct; a curse throws two extra decoys per wave and stacks. */
export const NINJA_ITEMS: TimedBuffDefinitions<NinjaItemKind> = {
  frenzy: { label: "모두 정답", icon: "全", durationMs: 10_000, color: "#c8361d" },
  curse: { label: "보기 +2", icon: "呪", durationMs: 10_000, color: "#2b2440" },
};
export const CURSE_EXTRA_OPTIONS = 2;
export const MAX_WAVE_OPTIONS = 9;
const ITEM_STRETCH = 5;

/** One item talisman in each five-question stretch, never on a golden wave; two in three are frenzy. */
export function itemForWave(seed: string, index: number): NinjaItemKind | null {
  const hash = hashString(`${seed}:item:${Math.floor(index / ITEM_STRETCH)}`);
  if (index % ITEM_STRETCH !== 1 + hash % (ITEM_STRETCH - 1) || isGoldenWave(seed, index)) return null;
  return (hash >>> 8) % 3 === 0 ? "curse" : "frenzy";
}

/** Adds decoys drawn from the other questions' options; the same wave always gets the same decoys. */
export function withDecoys(question: NinjaQuestion, questions: readonly NinjaQuestion[], extra: number, seed: string): NinjaQuestion {
  const wanted = Math.min(extra, MAX_WAVE_OPTIONS - question.options.length);
  if (wanted <= 0) return question;
  const used = new Set(question.options.map((option) => option.text));
  const pool = [...new Set(questions.flatMap((other) => other.options.map((option) => option.text)))].filter((text) => !used.has(text));
  const random = createSeededRandom(`${seed}:${question.id}:decoys`);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const decoys = pool.slice(0, wanted).map((text, index) => ({ id: `${question.id}:decoy:${index}`, text }));
  return { ...question, options: [...question.options, ...decoys] };
}

export function ninjaQuestionAt(questions: readonly NinjaQuestion[], index: number): NinjaQuestion {
  const question = questions[index % questions.length];
  if (!question) throw new Error("사용할 수 있는 문제가 없습니다.");
  return question;
}

/**
 * During a frenzy every option is correct and only the wave's last fruit moves
 * on to the next question (`advance`), so a cleared wave pays out once per fruit.
 */
export function sliceFruit(progress: NinjaProgress, question: NinjaQuestion, optionId: string, context: {
  readonly elapsedMs: number; readonly golden: boolean; readonly frenzy?: boolean; readonly advance?: boolean;
}) {
  const evaluated = evaluateMultipleChoice(question, { optionId }, 1);
  const frenzy = context.frenzy === true && question.options.some((option) => option.id === optionId);
  const correct = evaluated.isCorrect || frenzy;
  const combo = correct ? progress.combo + 1 : 0;
  const speedScore = correct ? ninjaSpeedScore(context.elapsedMs) : 0;
  const comboBonus = correct ? ninjaComboBonus(combo) : 0;
  const result = createAnswerResult<NinjaDetails>({ isCorrect: correct,
    scoreDelta: (speedScore + comboBonus) * (correct && context.golden ? 2 : 1),
    details: { selectedOptionId: optionId, correctOptionId: question.correctOptionId,
      ...(correct ? { judgment: ninjaJudgment(speedScore), golden: context.golden, comboBonus, ...(frenzy ? { frenzy } : {}) } : {}) } });
  const applied = applyResultToProgress(progress, question.id, result);
  // Questions repeat once the deck runs out, so completed IDs must not block later points.
  const next: NinjaProgress = { ...applied, currentIndex: progress.currentIndex + (correct && context.advance !== false ? 1 : 0), combo, completedItemIds: [] };
  return { result, progress: next };
}
