import { validateCanonicalQuestionSet } from "../../game-engine/question-engine/canonicalQuestionSet.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../learning-sets/types.ts";
import { cleanTypingPrompt } from "./typingEngine.ts";
import type { TypingQuestion, TypingQuestionSet } from "./types.ts";

function splitChunks(value: string): string[] {
  return value.split("/").map((part) => cleanTypingPrompt(part)).filter(Boolean);
}

export function adaptLearningSetToTypingPractice(set: LearningSet): TypingQuestionSet {
  const questions: TypingQuestion[] = [];
  set.items.forEach((item, itemIndex) => {
    const targets = set.type === LEARNING_SET_TYPE.READING_CHUNKS
      ? splitChunks(item.sourceText)
      : [cleanTypingPrompt(item.sourceText)].filter(Boolean);
    const helpers = set.type === LEARNING_SET_TYPE.READING_CHUNKS ? splitChunks(item.meaning) : [];
    targets.forEach((targetText, chunkIndex) => questions.push({
      id: `${item.id}:practice:${chunkIndex}`,
      prompt: targetText,
      targetText,
      helperText: helpers[chunkIndex] ?? cleanTypingPrompt(item.meaning),
      source: { setId: set.id, itemIndex },
    }));
  });
  return validateCanonicalQuestionSet({ id: set.id, title: set.name, type: set.type, questions });
}
