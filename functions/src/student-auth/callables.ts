import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAnonymous } from "../shared/auth.js";
import { adminAuth, db } from "../shared/firebase.js";
import { isRecord, normalizePersonName, parsePin, parseStudentCredentials } from "../shared/validation.js";
import { effectiveTenantId, parseTenantId, tenantStudentKey, type TenantId } from "../shared/tenant.js";
import { createPinCredential, parseStoredPinCredential, verifyPin } from "./pin.js";
import { clearLoginAttempts, consumeLoginAttempt } from "./rateLimit.js";

const callableOptions = { region: "asia-northeast3", enforceAppCheck: false } as const;

async function verifiedRosterStudent(tenantId: TenantId, studentNumber: string, name: string): Promise<{ readonly displayName: string }> {
  const snapshot = await db.collection("studentRoster").doc(tenantStudentKey(tenantId, studentNumber)).get();
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
  const tenantId = parseTenantId(isRecord(request.data) ? request.data.tenantId : undefined);
  const { displayName } = await verifiedRosterStudent(tenantId, studentNumber, name);
  const credential = await db.collection("studentPinCredentials").doc(tenantStudentKey(tenantId, studentNumber)).get();
  return {
    mode: credential.exists ? "pin_required" : "pin_setup",
    studentNumber,
    displayName,
  } as const;
});

export const completeStudentLogin = onCall(callableOptions, async (request) => {
  const uid = requireAnonymous(request);
  const { studentNumber, name } = parseStudentCredentials(request.data);
  const tenantId = parseTenantId(isRecord(request.data) ? request.data.tenantId : undefined);
  const pin = parsePin(isRecord(request.data) ? request.data.pin : undefined);
  const scopedStudentKey = tenantStudentKey(tenantId, studentNumber);
  await consumeLoginAttempt(`student-${scopedStudentKey}`, 10);
  const { displayName } = await verifiedRosterStudent(tenantId, studentNumber, name);
  const credentialRef = db.collection("studentPinCredentials").doc(scopedStudentKey);
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

  await adminAuth.setCustomUserClaims(uid, { role: "student", tenantId, studentNumber, displayName });
  await db.collection("studentProfiles").doc(uid).set({
    uid,
    tenantId,
    studentNumber,
    displayName,
    verifiedAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await clearLoginAttempts(`prepare-${uid}`, `student-${scopedStudentKey}`);

  return { studentNumber, displayName, pinWasCreated };
});

// Browser preflight must reach onCall; Firebase authentication is checked below.
export const syncStudentTenantClaim = onCall({ ...callableOptions, invoker: "public" }, async (request) => {
  const uid = requireAnonymous(request);
  const token = request.auth?.token;
  const studentNumber = typeof token?.studentNumber === "string" ? token.studentNumber : "";
  const displayName = typeof token?.displayName === "string" ? normalizePersonName(token.displayName) : "";
  if (token?.role !== "student" || !studentNumber || !displayName) {
    throw new HttpsError("permission-denied", "학생 인증 정보를 확인할 수 없습니다.");
  }

  const profile = await db.collection("studentProfiles").doc(uid).get();
  const profileData: unknown = profile.exists ? profile.data() : null;
  if (!isRecord(profileData)
    || profileData.studentNumber !== studentNumber
    || normalizePersonName(profileData.displayName) !== displayName) {
    throw new HttpsError("permission-denied", "학생 계정 정보가 일치하지 않습니다.");
  }

  const tenantId = effectiveTenantId(profileData.tenantId);
  await verifiedRosterStudent(tenantId, studentNumber, displayName);
  await adminAuth.setCustomUserClaims(uid, { role: "student", tenantId, studentNumber, displayName });
  if (profileData.tenantId === undefined || profileData.tenantId === null) {
    await profile.ref.set({ tenantId }, { merge: true });
  }
  return { tenantId } as const;
});

export const releaseStudentIdentity = onCall(callableOptions, async (request) => {
  const uid = requireAnonymous(request);
  await adminAuth.setCustomUserClaims(uid, {});
  await db.collection("studentProfiles").doc(uid).delete();
  return { ok: true };
});
