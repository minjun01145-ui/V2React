import { parseChoiceCount, type ChoiceCount } from "../../game-engine/question-engine/multiple-choice/index.ts";
import type { ActiveGameSession } from "../../multiplayer/types.ts";

export const DEFAULT_SIMPLE_QUIZ_CHOICE_COUNT: ChoiceCount = 4;

export function simpleQuizChoiceCountFromConfig(gameConfig: Readonly<Record<string, unknown>> | null): ChoiceCount {
  const configured = gameConfig?.["choice-count"];
  try {
    return parseChoiceCount(configured ?? DEFAULT_SIMPLE_QUIZ_CHOICE_COUNT);
  } catch {
    return DEFAULT_SIMPLE_QUIZ_CHOICE_COUNT;
  }
}

export function simpleQuizChoiceCount(session: ActiveGameSession): ChoiceCount {
  return simpleQuizChoiceCountFromConfig(session.gameConfig);
}
