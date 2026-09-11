import assert from "node:assert/strict";
import { createPinCredential, parseStoredPinCredential, verifyPin } from "../lib/student-auth/pin.js";

const credential = createPinCredential("1234");
assert.equal(credential.pinHashVersion, 1);
assert.notEqual(credential.pinHash, "1234");
assert.equal(Object.hasOwn(credential, "pin"), false);
assert.equal(Object.values(credential).includes("1234"), false);
assert.equal(verifyPin("1234", credential), true);
assert.equal(verifyPin("4321", credential), false);
assert.deepEqual(parseStoredPinCredential(credential), credential);
assert.throws(() => parseStoredPinCredential({ pinHash: "1234" }));

const existingCredential = {
  pinHash: "WN-87vPtGO4o1fwEttloKNIwtqGZqnsfkSCWNJhrpMg",
  pinSalt: "AAECAwQFBgcICQoLDA0ODw",
  pinHashVersion: 1,
};
assert.equal(verifyPin("1234", existingCredential), true);
assert.equal(verifyPin("4321", existingCredential), false);

const second = createPinCredential("1234");
assert.notEqual(second.pinSalt, credential.pinSalt);
assert.notEqual(second.pinHash, credential.pinHash);

console.log("student PIN hashing tests passed");
