import type { RuntimeLearningSet } from "../learning-sets/types.ts";
import type { SlideEngineRound } from "./types.ts";

/** Session gameConfig that makes the chosen game run this slide's questions for the slide's time limit. */
export function slideEngineGameConfig(round: SlideEngineRound, slideId: string): Readonly<Record<string, unknown>> {
  const duration = { quizRoundDurationMs: round.durationSeconds * 1_000 };
  if (round.source.kind === "free-response") {
    return { freeResponsePrompt: round.source.prompt, ...duration };
  }
  if (round.source.kind === "stored-set") {
    const sourceConfig = round.source.setId ? { setId: round.source.setId } : {};
    return { ...sourceConfig, ...round.gameConfig, ...duration };
  }
  const set = {
    id: `slide-${slideId}`,
    name: "슬라이드 문제",
    type: round.source.setType,
    itemCount: round.source.items.length,
    items: round.source.items,
  } satisfies RuntimeLearningSet;
  return { quizQuestionSequence: "finite", set, ...round.gameConfig, ...duration };
}
