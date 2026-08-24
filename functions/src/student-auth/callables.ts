import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAnonymous } from "../shared/auth.js";
import { adminAuth, db } from "../shared/firebase.js";
import { isRecord, normalizePersonName, parsePin, parseStudentCredentials } from "../shared/validation.js";
import { createPinCredential, parseStoredPinCredential, verifyPin } from "./pin.js";
import { clearLoginAttempts, consumeLoginAttempt } from "./rateLimit.js";

const callableOptions = { region: "asia-northeast3", enforceAppCheck: false } as const;

async function verifiedRosterStudent(studentNumber: string, name: string): Promise<{ readonly displayName: string }> {
  const snapshot = await db.collection("studentRoster").doc(studentNumber).get();
  const raw: unknown = snapshot.exists ? snapshot.data() : null;
  const displayName = isRecord(raw) ? normalizePersonName(raw.displayName) : "";
  if (!isRecord(raw) || raw.active === false || !displayName || displayName !== name) {
    throw new HttpsError("permission-denied", "학번 또는 이름을 확인해주세요.");
  }
  return { displayName };
}

export const prepareStudentLogin = onCall(callableOptions, async (request) => {
  const uid = requireAnonymous(request);
  await consumeLoginAttempt(`prepare-${uid}`, 20);
  const { studentNumber, name } = parseStudentCredentials(request.data);
  const { displayName } = await verifiedRosterStudent(studentNumber, name);
  const credential = await db.collection("studentPinCredentials").doc(studentNumber).get();
  return {
    mode: credential.exists ? "pin_required" : "pin_setup",
    studentNumber,
    displayName,
  } as const;
});

export const completeStudentLogin = onCall(callableOptions, async (request) => {
  const uid = requireAnonymous(request);
  const { studentNumber, name } = parseStudentCredentials(request.data);
  const pin = parsePin(isRecord(request.data) ? request.data.pin : undefined);
  await consumeLoginAttempt(`student-${studentNumber}`, 10);
  const { displayName } = await verifiedRosterStudent(studentNumber, name);
  const credentialRef = db.collection("studentPinCredentials").doc(studentNumber);
  const newCredential = createPinCredential(pin);

  const pinWasCreated = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(credentialRef);
    if (snapshot.exists) {
      if (!verifyPin(pin, parseStoredPinCredential(snapshot.data()))) {
        throw new HttpsError("permission-denied", "학번, 이름 또는 비밀번호를 확인해주세요.");
      }
      tx.update(credentialRef, { lastUsedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now() });
      return false;
    }
    tx.create(credentialRef, {
      ...newCredential,
      studentNumber,
      createdAt: FieldValue.serverTimestamp(),
      lastUsedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
    });
    return true;
  });

  await adminAuth.setCustomUserClaims(uid, { role: "student", studentNumber, displayName });
  await db.collection("studentProfiles").doc(uid).set({
    uid,
    studentNumber,
    displayName,
    verifiedAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await clearLoginAttempts(`prepare-${uid}`, `student-${studentNumber}`);

  return { studentNumber, displayName, pinWasCreated };
});

export const releaseStudentIdentity = onCall(callableOptions, async (request) => {
  const uid = requireAnonymous(request);
  await adminAuth.setCustomUserClaims(uid, {});
  await db.collection("studentProfiles").doc(uid).delete();
  return { ok: true };
});
