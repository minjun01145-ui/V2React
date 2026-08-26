import { LEARNING_SET_TYPE, type LearningSet } from "../../learning-sets/types.ts";

export const matchingDemoSet: LearningSet = {
  id: "matching-demo",
  name: "짝맞추기 체험 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 10,
  createdAtMs: 0,
  updatedAtMs: 0,
  items: [
    ["apple", "사과"], ["book", "책"], ["friend", "친구"], ["school", "학교"], ["water", "물"],
    ["dream", "꿈"], ["happy", "행복한"], ["run", "달리다"], ["window", "창문"], ["morning", "아침"],
  ].map(([sourceText, meaning], index) => ({ id: `matching-demo-${index + 1}`, sourceText: sourceText ?? "", meaning: meaning ?? "" })),
};
