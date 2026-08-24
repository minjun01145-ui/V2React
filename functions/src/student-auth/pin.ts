import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { isRecord } from "../shared/validation.js";

const PIN_HASH_BYTES = 32;
const PIN_HASH_VERSION = 1;

export interface StoredPinCredential {
  readonly pinHash: string;
  readonly pinSalt: string;
  readonly pinHashVersion: number;
}

function derivePin(pin: string, salt: Buffer): Buffer {
  return scryptSync(pin, salt, PIN_HASH_BYTES, { N: 16384, r: 8, p: 1 });
}

export function createPinCredential(pin: string): StoredPinCredential {
  const salt = randomBytes(16);
  return {
    pinHash: derivePin(pin, salt).toString("base64url"),
    pinSalt: salt.toString("base64url"),
    pinHashVersion: PIN_HASH_VERSION,
  };
}

export function parseStoredPinCredential(value: unknown): StoredPinCredential {
  if (!isRecord(value)
    || typeof value.pinHash !== "string"
    || typeof value.pinSalt !== "string"
    || value.pinHashVersion !== PIN_HASH_VERSION) {
    throw new HttpsError("internal", "학생 비밀번호 정보를 확인할 수 없습니다.");
  }
  return { pinHash: value.pinHash, pinSalt: value.pinSalt, pinHashVersion: value.pinHashVersion };
}

export function verifyPin(pin: string, credential: StoredPinCredential): boolean {
  const expected = Buffer.from(credential.pinHash, "base64url");
  const actual = derivePin(pin, Buffer.from(credential.pinSalt, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
