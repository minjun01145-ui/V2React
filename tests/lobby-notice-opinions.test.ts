import assert from "node:assert/strict";
import { MAX_NOTICE_LENGTH, parseNotice, validateNoticeText } from "../src/classroom-notice/model.ts";
import { MAX_OPINION_LENGTH, parseOpinion, validateOpinionText } from "../src/student-opinions/model.ts";

// Notice: an empty notice is allowed (it clears the banner), a too-long one is not.
assert.equal(validateNoticeText("  숙제: 4과 단어  "), "숙제: 4과 단어");
assert.equal(validateNoticeText("   "), "");
assert.throws(() => validateNoticeText("가".repeat(MAX_NOTICE_LENGTH + 1)), /이하/);
assert.deepEqual(parseNotice({ text: "진도: 82쪽", updatedAtMs: 5 }), { text: "진도: 82쪽", updatedAtMs: 5 });
assert.equal(parseNotice({ text: 3, updatedAtMs: 5 }), null);

// Opinions: the teacher-side reader keeps text and time only, never the stored author.
assert.equal(validateOpinionText("  급식이 맛있어요 "), "급식이 맛있어요");
assert.throws(() => validateOpinionText("  "), /1~/);
assert.throws(() => validateOpinionText("가".repeat(MAX_OPINION_LENGTH + 1)), /1~/);
const stored = { text: "숙제가 많아요", createdAtMs: 10, playerId: "uid-1", studentNumber: "10203", displayName: "김학생" };
const shown = parseOpinion("op-1", stored);
assert.deepEqual(shown, { id: "op-1", text: "숙제가 많아요", createdAtMs: 10 });
assert.ok(shown && !("studentNumber" in shown) && !("displayName" in shown) && !("playerId" in shown), "the teacher's screen never receives the author");
assert.equal(parseOpinion("op-2", { text: "", createdAtMs: 1 }), null);

console.log("lobby notice and opinion tests passed");
