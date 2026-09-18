import { validateCanonicalQuestionSet } from "../../game-engine/question-engine/canonicalQuestionSet.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import { cleanTypingPrompt } from "./typingEngine.ts";
import type { TypingQuestion, TypingQuestionSet } from "./types.ts";

export function adaptLearningSetToTypingPractice(set: RuntimeLearningSet): TypingQuestionSet {
  const questions: TypingQuestion[] = [];
  set.items.forEach((item, itemIndex) => {
    const targetText = cleanTypingPrompt(item.sourceText);
    if (!targetText) return;
    questions.push({
      id: `${item.id}:practice`,
      prompt: targetText,
      targetText,
      helperText: cleanTypingPrompt(item.meaning),
      source: { setId: set.id, itemIndex },
    });
  });
  return validateCanonicalQuestionSet({ id: set.id, title: set.name, type: set.type, questions });
}
