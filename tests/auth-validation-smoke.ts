import assert from "node:assert/strict";
import { normalizePersonName, normalizeStudentNumber, validateStudentCredentials, validateStudentPin } from "../src/auth/validation.ts";
import { parseRosterPaste } from "../src/student-roster/validation.ts";

assert.equal(normalizeStudentNumber(" １０１０１ "), "10101");
assert.equal(normalizePersonName(" 홍   길동 "), "홍 길동");
assert.deepEqual(validateStudentCredentials("10101", "홍길동"), { studentNumber: "10101", name: "홍길동" });
assert.throws(() => validateStudentCredentials("10A01", "홍길동"));
assert.throws(() => validateStudentCredentials("10101", ""));
assert.equal(validateStudentPin("１２３４"), "1234");
assert.throws(() => validateStudentPin("12345"));
assert.deepEqual(parseRosterPaste("10101\t홍길동\n10102, 김주례"), [
  { studentNumber: "10101", name: "홍길동", active: true },
  { studentNumber: "10102", name: "김주례", active: true },
]);
console.log("auth validation smoke tests passed");
