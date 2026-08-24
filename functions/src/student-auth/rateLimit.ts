import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";

const WINDOW_MS = 5 * 60 * 1000;

export async function consumeLoginAttempt(key: string, maximumAttempts: number): Promise<void> {
  const ref = db.collection("authRateLimits").doc(key);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const raw: unknown = snapshot.exists ? snapshot.data() : null;
    const startedAtMs = isRecord(raw) && typeof raw.startedAtMs === "number" ? raw.startedAtMs : now;
    const count = isRecord(raw) && typeof raw.count === "number" ? raw.count : 0;
    const inWindow = now - startedAtMs < WINDOW_MS;
    const nextCount = inWindow ? count + 1 : 1;
    if (inWindow && nextCount > maximumAttempts) {
      throw new HttpsError("resource-exhausted", "로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요.");
    }
    tx.set(ref, {
      startedAtMs: inWindow ? startedAtMs : now,
      count: nextCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function clearLoginAttempts(...keys: readonly string[]): Promise<void> {
  await Promise.all(keys.map((key) => db.collection("authRateLimits").doc(key).delete().catch(() => undefined)));
}
