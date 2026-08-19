import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();
const adminAuth = getAuth();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStudentNumber(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim();
}

function normalizePersonName(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
}

function parseCredentials(value: unknown): { readonly studentNumber: string; readonly name: string } {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "학번과 이름을 확인해주세요.");
  const studentNumber = normalizeStudentNumber(value.studentNumber);
  const name = normalizePersonName(value.name);
  if (!/^[0-9]{1,12}$/.test(studentNumber) || name.length < 1 || name.length > 30) {
    throw new HttpsError("invalid-argument", "학번과 이름을 확인해주세요.");
  }
  return { studentNumber, name };
}

function isAnonymousProvider(token: unknown): boolean {
  if (!isRecord(token)) return false;
  const firebase = token.firebase;
  if (!isRecord(firebase)) return false;
  return firebase.sign_in_provider === "anonymous";
}


const STUDENT_AUTH_WINDOW_MS = 5 * 60 * 1000;
const STUDENT_AUTH_MAX_ATTEMPTS = 10;

async function consumeStudentAuthAttempt(uid: string): Promise<void> {
  const ref = db.collection("authRateLimits").doc(uid);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const raw: unknown = snapshot.exists ? snapshot.data() : null;
    const windowStartedAtMs = isRecord(raw) && typeof raw.windowStartedAtMs === "number" ? raw.windowStartedAtMs : now;
    const count = isRecord(raw) && typeof raw.count === "number" ? raw.count : 0;
    const inWindow = now - windowStartedAtMs < STUDENT_AUTH_WINDOW_MS;
    const nextCount = inWindow ? count + 1 : 1;
    if (inWindow && nextCount > STUDENT_AUTH_MAX_ATTEMPTS) {
      throw new HttpsError("resource-exhausted", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.");
    }
    tx.set(ref, {
      windowStartedAtMs: inWindow ? windowStartedAtMs : now,
      count: nextCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export const claimStudentIdentity = onCall(
  {
    region: "asia-northeast3",
    // After App Check is configured and verified in production metrics, change this to true.
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth || !isAnonymousProvider(request.auth.token)) {
      throw new HttpsError("unauthenticated", "학생 인증이 필요합니다.");
    }

    await consumeStudentAuthAttempt(request.auth.uid);
    const { studentNumber, name } = parseCredentials(request.data);
    const rosterSnapshot = await db.collection("studentRoster").doc(studentNumber).get();
    if (!rosterSnapshot.exists) {
      throw new HttpsError("permission-denied", "학번 또는 이름을 확인해주세요.");
    }

    const rosterRaw: unknown = rosterSnapshot.data();
    if (!isRecord(rosterRaw)) throw new HttpsError("permission-denied", "학번 또는 이름을 확인해주세요.");
    const rosterName = normalizePersonName(rosterRaw.displayName);
    const active = rosterRaw.active !== false;
    if (!active || !rosterName || rosterName !== name) {
      throw new HttpsError("permission-denied", "학번 또는 이름을 확인해주세요.");
    }

    const uid = request.auth.uid;
    await adminAuth.setCustomUserClaims(uid, { role: "student", studentNumber, displayName: rosterName });
    await db.collection("studentProfiles").doc(uid).set({
      uid,
      studentNumber,
      displayName: rosterName,
      verifiedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { studentNumber, displayName: rosterName };
  },
);

export const releaseStudentIdentity = onCall(
  { region: "asia-northeast3", enforceAppCheck: false },
  async (request) => {
    if (!request.auth || !isAnonymousProvider(request.auth.token)) {
      throw new HttpsError("unauthenticated", "학생 인증이 필요합니다.");
    }
    await adminAuth.setCustomUserClaims(request.auth.uid, {});
    await db.collection("studentProfiles").doc(request.auth.uid).delete();
    return { ok: true };
  },
);
