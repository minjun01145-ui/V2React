import { buildMultipleChoiceSet } from "../../game-engine/question-engine/multiple-choice/generator.ts";
import { CHOICE_DIRECTION } from "../../game-engine/question-engine/multiple-choice/types.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";

/**
 * World layout: `x` is the distance skated to the right, `y` the sideways
 * position across the rink. Lane centres sit at y = -1, 0, 1 (top to bottom on
 * screen) and the rink edges at ±1.5.
 */
export type SkatingLane = 0 | 1 | 2;

export const SKATING_CHANNEL_ID = "skating";
export const SKATING_LANE_CENTERS = [-1, 0, 1] as const;
export const SKATING_RINK_HALF_WIDTH = 1.5;
export const SKATING_FIRST_GATE_X = 9;
export const SKATING_GATE_SPACING = 8;

export interface SkatingQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly choices: readonly [string, string, string];
  readonly correctLane: SkatingLane;
}

export interface SkatingCourse {
  readonly questions: readonly SkatingQuestion[];
}

export function buildSkatingCourse(set: RuntimeLearningSet, seed: string): SkatingCourse {
  const generated = buildMultipleChoiceSet({
    id: `skating:${set.id}`,
    title: set.name,
    pairs: set.items.map((item) => ({ id: item.id, left: item.sourceText, right: item.meaning, source: item })),
    choiceCount: 3,
    direction: CHOICE_DIRECTION.LEFT_TO_RIGHT,
    seed,
    shuffleQuestions: true,
  });

  return {
    questions: generated.questions.map((question) => {
      const choices = question.options.map((option) => option.text);
      if (choices.length !== 3) throw new Error("Skating requires exactly three choices.");
      const correctLane = question.options.findIndex((option) => option.id === question.correctOptionId);
      if (correctLane < 0 || correctLane > 2) throw new Error("Skating could not locate the correct lane.");
      return {
        id: question.id,
        prompt: question.prompt,
        choices: choices as [string, string, string],
        correctLane: correctLane as SkatingLane,
      };
    }),
  };
}

export function skatingGateX(gateIndex: number): number {
  return SKATING_FIRST_GATE_X + gateIndex * SKATING_GATE_SPACING;
}

/** The last gate at or behind `x`, or -1 before the first gate. */
export function skatingGateIndexAtX(x: number): number {
  if (x < SKATING_FIRST_GATE_X) return -1;
  return Math.floor((x - SKATING_FIRST_GATE_X) / SKATING_GATE_SPACING);
}

export function skatingQuestionForGate(course: SkatingCourse, gateIndex: number): SkatingQuestion {
  const question = course.questions[gateIndex % course.questions.length];
  if (!question) throw new Error("Skating course has no questions.");
  return question;
}

export function skatingLaneY(lane: SkatingLane): number {
  return SKATING_LANE_CENTERS[lane];
}

export function nearestSkatingLane(y: number): SkatingLane {
  if (y < -0.5) return 0;
  if (y > 0.5) return 2;
  return 1;
}

export function skatingReward(correct: boolean, previousCombo: number) {
  const combo = correct ? previousCombo + 1 : 0;
  return { combo, points: correct ? 100 + Math.min(combo - 1, 10) * 10 : 0 };
}

/** What the local player just did at a gate; drives the HUD, sound and scene effects. */
export interface SkatingImpact {
  readonly gateIndex: number;
  readonly correct: boolean;
  readonly lane: SkatingLane;
  readonly prompt: string;
  readonly answer: string;
  readonly combo: number;
  readonly points: number;
}
