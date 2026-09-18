import { buildMultipleChoiceSet } from "../../game-engine/question-engine/multiple-choice/generator.ts";
import { CHOICE_DIRECTION } from "../../game-engine/question-engine/multiple-choice/types.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";

export const MEANING_DASH_CHANNEL_ID = "meaning-dash";
export const MEANING_DASH_LANES = [-1, 0, 1] as const;
export const MEANING_DASH_FIRST_GATE_Y = 7;
export const MEANING_DASH_GATE_SPACING = 6;
export const MEANING_DASH_RUN_SPEED = 2.2;
export const MEANING_DASH_SLOW_SPEED = 0.9;
export const MEANING_DASH_LANE_SPEED = 3.6;
export const MEANING_DASH_WRONG_SLOW_MS = 1_300;

export interface MeaningDashQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly choices: readonly [string, string, string];
  readonly correctLane: 0 | 1 | 2;
}

export interface MeaningDashCourse {
  readonly questions: readonly MeaningDashQuestion[];
}

export function buildMeaningDashCourse(set: RuntimeLearningSet, seed: string): MeaningDashCourse {
  const generated = buildMultipleChoiceSet({
    id: `meaning-dash:${set.id}`,
    title: set.name,
    pairs: set.items.map((item) => ({
      id: item.id,
      left: item.sourceText,
      right: item.meaning,
      source: item,
    })),
    choiceCount: 3,
    direction: CHOICE_DIRECTION.LEFT_TO_RIGHT,
    seed,
    shuffleQuestions: true,
  });

  return {
    questions: generated.questions.map((question) => {
      const choices = question.options.map((option) => option.text);
      if (choices.length !== 3) throw new Error("Meaning Dash requires exactly three choices.");
      const correctLane = question.options.findIndex((option) => option.id === question.correctOptionId);
      if (correctLane < 0 || correctLane > 2) throw new Error("Meaning Dash could not locate the correct lane.");
      return {
        id: question.id,
        prompt: question.prompt,
        choices: choices as [string, string, string],
        correctLane: correctLane as 0 | 1 | 2,
      };
    }),
  };
}

export function meaningDashGateY(gateIndex: number): number {
  return MEANING_DASH_FIRST_GATE_Y + gateIndex * MEANING_DASH_GATE_SPACING;
}

export function meaningDashGateIndexAtY(y: number): number {
  if (y < MEANING_DASH_FIRST_GATE_Y) return -1;
  return Math.floor((y - MEANING_DASH_FIRST_GATE_Y) / MEANING_DASH_GATE_SPACING);
}

export function meaningDashQuestionForGate(course: MeaningDashCourse, gateIndex: number): MeaningDashQuestion {
  const question = course.questions[gateIndex % course.questions.length];
  if (!question) throw new Error("Meaning Dash course has no questions.");
  return question;
}

export function meaningDashLaneX(lane: 0 | 1 | 2): number {
  return MEANING_DASH_LANES[lane];
}

export function nearestMeaningDashLane(x: number): 0 | 1 | 2 {
  if (x < -0.5) return 0;
  if (x > 0.5) return 2;
  return 1;
}
