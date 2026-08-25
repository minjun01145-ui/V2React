import assert from "node:assert/strict";
import { adaptVocabularySet } from "../../src/games/pokemon-catch/adapter.ts";
import { captureChance, didCapture } from "../../src/games/pokemon-catch/captureRules.ts";
import { encounterId, isFireRedWildEncounter } from "../../src/games/pokemon-catch/encounterRules.ts";
import { POKEMON_ITEMS, rewardItem } from "../../src/games/pokemon-catch/itemRules.ts";
import { POKEMON_ITEM } from "../../src/student-data/pokemon-catch/types.ts";
import { LEARNING_SET_TYPE, type LearningSet } from "../../src/learning-sets/types.ts";

const vocabularySet: LearningSet = {
  id: "vocab-1",
  name: "기초 단어",
  type: LEARNING_SET_TYPE.VOCABULARY,
  itemCount: 4,
  createdAtMs: 1,
  updatedAtMs: 1,
  items: [
    { id: "a", sourceText: "apple", meaning: "사과" },
    { id: "b", sourceText: "book", meaning: "책" },
    { id: "c", sourceText: "cat", meaning: "고양이" },
    { id: "d", sourceText: "desk", meaning: "책상" },
  ],
};

const questions = adaptVocabularySet(vocabularySet, "round-1");
assert.equal(questions.questions.length, 4);
assert.equal(questions.choiceCount, 4);
assert.ok(questions.questions.every((question) => question.options.length === 4));
assert.deepEqual(adaptVocabularySet(vocabularySet, "round-1"), questions, "같은 라운드는 같은 문제 순서를 재현해야 합니다.");

assert.throws(() => adaptVocabularySet({ ...vocabularySet, type: LEARNING_SET_TYPE.READING_CHUNKS }, "round-1"), /단어 세트/);
assert.equal(encounterId("same-seed"), encounterId("same-seed"));
assert.equal(isFireRedWildEncounter(encounterId("range")), true);
assert.equal(isFireRedWildEncounter(1), false, "선물 포켓몬인 이상해씨는 야생 조우 목록에서 제외되어야 합니다.");
assert.equal(isFireRedWildEncounter(150), false, "고정 조우 전설 포켓몬은 야생 조우 목록에서 제외되어야 합니다.");
assert.equal(isFireRedWildEncounter(131), true, "낮은 확률의 야생 라프라스는 목록에 남아야 합니다.");
assert.ok(captureChance(255) > captureChance(3));
assert.ok(Math.abs(captureChance(255) - (85 / 255)) < .01);
assert.ok(Math.abs(captureChance(3) - (1 / 255)) < .001);
assert.ok(captureChance(45, { ballMultiplier: 1.5 }) > captureChance(45));
assert.ok(captureChance(45, { statusMultiplier: 2 }) > captureChance(45, { ballMultiplier: 1.5 }));
assert.equal(didCapture(.5, .49), true);
assert.equal(didCapture(.5, .5), false);
assert.equal(rewardItem(0), POKEMON_ITEM.POKE_BALL);
assert.equal(rewardItem(.349), POKEMON_ITEM.POKE_BALL);
assert.equal(rewardItem(.35), POKEMON_ITEM.SLEEP_SPRAY);
assert.equal(rewardItem(.70), POKEMON_ITEM.ANGER);
assert.equal(rewardItem(.90), POKEMON_ITEM.GREAT_BALL);
assert.deepEqual(POKEMON_ITEMS.map((item) => item.rewardWeight), [35, 35, 20, 10]);

console.log("pokemon catch tests passed");
