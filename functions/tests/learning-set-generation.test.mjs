import assert from "node:assert/strict";
import { parseGeneratedLearningSetReply } from "../lib/learning-set-generation/service.js";

const vocabulary = parseGeneratedLearningSetReply('{"suggestedName":"필수 단어","items":[{"sourceText":"apple","meaning":"사과"}]}', "vocabulary");
assert.equal(vocabulary.items[0]?.sourceText, "apple");

const reading = parseGeneratedLearningSetReply('{"suggestedName":"본문","items":[{"sourceText":"He / likes / hiking with his dad.","meaning":"그는 / 좋아한다 / 아빠와 하이킹하는 것을."}]}', "reading-chunks");
assert.equal(reading.items[0]?.meaning, "그는 / 좋아한다 / 아빠와 하이킹하는 것을.");
assert.throws(
  () => parseGeneratedLearningSetReply('{"items":[{"sourceText":"He / likes / hiking.","meaning":"그는 / 하이킹을 좋아한다."}]}', "reading-chunks"),
  /덩어리 수/,
);

const forms = parseGeneratedLearningSetReply('{"suggestedName":"비교급 최상급","items":[{"meaning":"좋은","sourceText":"good","form2":"better","form3":"the best"}]}', "form-changes");
assert.deepEqual(forms.items[0], { meaning: "좋은", sourceText: "good", form2: "better", form3: "the best" });
assert.throws(
  () => parseGeneratedLearningSetReply('{"items":[{"meaning":"좋은","sourceText":"good","form2":"better"}]}', "form-changes"),
  /3단계 형태/,
);

console.log("Learning set AI generation contract tests passed");
