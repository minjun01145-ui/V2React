import assert from "node:assert/strict";
import { normalizePersonName, normalizeStudentNumber, validateStudentCredentials } from "../src/auth/validation.ts";

assert.equal(normalizeStudentNumber(" １０１０１ "), "10101");
assert.equal(normalizePersonName(" 홍   길동 "), "홍 길동");
assert.deepEqual(validateStudentCredentials("10101", "홍길동"), { studentNumber: "10101", name: "홍길동" });
assert.throws(() => validateStudentCredentials("10A01", "홍길동"));
assert.throws(() => validateStudentCredentials("10101", ""));
console.log("auth validation smoke tests passed");
