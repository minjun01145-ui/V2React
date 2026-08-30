import { LEARNING_SET_TYPE, type LearningSet } from "../../learning-sets/types.ts";

export const typingDemoSet: LearningSet = {
  id: "typing-demo",
  name: "타자게임 체험 문장",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 6,
  createdAtMs: 0,
  updatedAtMs: 0,
  items: [
    ["Hello, world!", "안녕, 세상아!"],
    ["I like reading books.", "나는 책 읽는 것을 좋아해요."],
    ["Practice makes progress.", "연습은 발전을 만들어요."],
    ["오늘도 즐겁게 공부해요.", "Let's enjoy studying today."],
    ["한 걸음씩 천천히 가요.", "Take it one step at a time."],
    ["You can do it!", "할 수 있어요!"],
  ].map(([sourceText, meaning], index) => ({
    id: `typing-demo-${index + 1}`,
    sourceText: sourceText ?? "",
    meaning: meaning ?? "",
  })),
};
