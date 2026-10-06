import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { extractHwpxText } from "../lib/learning-set-generation/hwpx.js";
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

// Teacher-written meanings without / are kept; the AI must not re-chunk or rewrite the English.
const source = "1. He / likes / hiking with his dad.\n그는 아빠와 하이킹하는 것을 좋아한다.";
const kept = parseGeneratedLearningSetReply('{"items":[{"sourceText":"He / likes / hiking with his dad.","meaning":"그는 아빠와 하이킹하는 것을 좋아한다."}]}', "reading-chunks", source);
assert.equal(kept.items[0]?.meaning, "그는 아빠와 하이킹하는 것을 좋아한다.");
assert.throws(
  () => parseGeneratedLearningSetReply('{"items":[{"sourceText":"He / likes hiking / with his father.","meaning":"그는 / 하이킹을 좋아한다 / 아버지와"}]}', "reading-chunks", source),
  /영어 문장을 바꿔/,
);

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const hwpx = zip({
  mimetype: "application/hwp+zip",
  "Contents/section0.xml": '<hs:sec xmlns:hp="x"><hp:p><hp:run><hp:t>I go / to school, / every day.</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>나는 / 학교에 간다 &amp; 매일</hp:t></hp:run></hp:p>'
    + '<hp:p><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>He / likes / it.</hp:t></hp:run></hp:p></hp:subList></hp:tc><hp:tc><hp:subList><hp:p><hp:run><hp:t>그는 / 좋아한다 / 그것을</hp:t></hp:run></hp:p></hp:subList></hp:tc></hp:tr></hp:tbl></hp:run></hp:p></hs:sec>',
});
assert.equal(extractHwpxText(hwpx), "I go / to school, / every day.\n나는 / 학교에 간다 & 매일\nHe / likes / it.\t그는 / 좋아한다 / 그것을");
assert.throws(() => extractHwpxText(Buffer.from("not a zip")), /HWPX/);

console.log("Learning set AI generation contract tests passed");
