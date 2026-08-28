import { LEARNING_SET_TYPE, type LearningSet } from "../../learning-sets/types.ts";

export const simpleQuizDemoSet: LearningSet = {
  id: "simple-quiz-demo",
  name: "심플퀴즈 체험 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 10,
  createdAtMs: 0,
  updatedAtMs: 0,
  items: [
    ["apple", "사과"], ["book", "책"], ["classroom", "교실"], ["dream", "꿈"], ["friend", "친구"],
    ["happy", "행복한"], ["morning", "아침"], ["run", "달리다"], ["water", "물"], ["window", "창문"],
  ].map(([sourceText, meaning], index) => ({ id: `simple-quiz-demo-${index + 1}`, sourceText: sourceText ?? "", meaning: meaning ?? "" })),
};
