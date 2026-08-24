import { LEARNING_SET_TYPE, type LearningSet } from "../../learning-sets/types.ts";

export const pokemonCatchDemoSet: LearningSet = {
  id: "pokemon-catch-demo",
  name: "포켓몬 잡기 체험 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 8,
  createdAtMs: 0,
  updatedAtMs: 0,
  items: [
    ["apple", "사과"], ["book", "책"], ["friend", "친구"], ["school", "학교"],
    ["water", "물"], ["dream", "꿈"], ["happy", "행복한"], ["run", "달리다"],
  ].map(([sourceText, meaning], index) => ({ id: `demo-${index + 1}`, sourceText: sourceText ?? "", meaning: meaning ?? "" })),
};

