import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdminTenant } from "../shared/auth.js";
import { adminAuth, db } from "../shared/firebase.js";
import { isRecord, parseRosterInput, parseStudentCredentials } from "../shared/validation.js";
import { effectiveTenantId, parseTenantId, tenantAccountId, tenantStudentKey, type TenantId } from "../shared/tenant.js";

const callableOptions = { region: "asia-northeast3", enforceAppCheck: false } as const;

async function clearStudentSessions(tenantId: TenantId, studentNumber: string): Promise<void> {
  const profiles = await db.collection("studentProfiles").where("studentNumber", "==", studentNumber).get();
  if (profiles.empty) return;
  const scopedProfiles = profiles.docs.filter((profile) => effectiveTenantId(profile.data()?.tenantId) === tenantId);
  if (scopedProfiles.length === 0) return;
  const batch = db.batch();
  for (const profile of scopedProfiles) batch.delete(profile.ref);
  await batch.commit();
  await Promise.all(scopedProfiles.map((profile) => adminAuth.deleteUser(profile.id).catch(() => undefined)));
}

async function requestedAdminTenant(request: Parameters<typeof requireAdminTenant>[0]): Promise<TenantId> {
  const tenantId = parseTenantId(isRecord(request.data) ? request.data.tenantId : undefined);
  await requireAdminTenant(request, tenantId);
  return tenantId;
}

export const listStudents = onCall(callableOptions, async (request) => {
  const tenantId = await requestedAdminTenant(request);
  const [roster, credentials] = await Promise.all([
    db.collection("studentRoster").get(),
    db.collection("studentPinCredentials").get(),
  ]);
  const configuredPins = new Set(credentials.docs.map((doc) => doc.id));
  const prefix = `${tenantId}--`;
  return {
    students: roster.docs.filter((doc) => tenantId === "minjun" ? /^[0-9]+$/.test(doc.id) : doc.id.startsWith(prefix)).map((doc) => {
      const raw: unknown = doc.data();
      const studentNumber = tenantId === "minjun" ? doc.id : doc.id.slice(prefix.length);
      return {
        studentNumber,
        displayName: isRecord(raw) && typeof raw.displayName === "string" ? raw.displayName : "",
        active: !isRecord(raw) || raw.active !== false,
        pinConfigured: configuredPins.has(tenantStudentKey(tenantId, studentNumber)),
        updatedAtMs: isRecord(raw) && typeof raw.updatedAtMs === "number" ? raw.updatedAtMs : 0,
      };
    }).sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, "ko", { numeric: true })),
  };
});

export const upsertStudent = onCall(callableOptions, async (request) => {
  const tenantId = await requestedAdminTenant(request);
  const { studentNumber, name, active } = parseRosterInput(request.data);
  const ref = db.collection("studentRoster").doc(tenantStudentKey(tenantId, studentNumber));
  const existing = await ref.get();
  const now = Date.now();
  await ref.set({
    displayName: name,
    active,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp(), createdAtMs: now }),
  }, { merge: true });
  return { studentNumber, displayName: name, active };
});

export const importStudents = onCall(callableOptions, async (request) => {
  const tenantId = await requestedAdminTenant(request);
  if (!isRecord(request.data) || !Array.isArray(request.data.students) || request.data.students.length < 1 || request.data.students.length > 200) {
    throw new HttpsError("invalid-argument", "한 번에 1명부터 200명까지 등록할 수 있습니다.");
  }
  const students = request.data.students.map(parseRosterInput);
  const unique = new Map(students.map((student) => [student.studentNumber, student]));
  const batch = db.batch();
  const now = Date.now();
  for (const student of unique.values()) {
    batch.set(db.collection("studentRoster").doc(tenantStudentKey(tenantId, student.studentNumber)), {
      displayName: student.name,
      active: student.active,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
    }, { merge: true });
  }
  await batch.commit();
  return { count: unique.size };
});

export const resetStudentPin = onCall(callableOptions, async (request) => {
  const tenantId = await requestedAdminTenant(request);
  const { studentNumber } = parseStudentCredentials(request.data);
  await db.collection("studentPinCredentials").doc(tenantStudentKey(tenantId, studentNumber)).delete();
  await clearStudentSessions(tenantId, studentNumber);
  return { ok: true };
});

export const deleteStudent = onCall(callableOptions, async (request) => {
  const tenantId = await requestedAdminTenant(request);
  const { studentNumber } = parseStudentCredentials(request.data);
  await Promise.all([
    db.collection("studentRoster").doc(tenantStudentKey(tenantId, studentNumber)).delete(),
    db.collection("studentPinCredentials").doc(tenantStudentKey(tenantId, studentNumber)).delete(),
    db.recursiveDelete(db.collection("studentGameData").doc(tenantAccountId(tenantId, studentNumber))),
  ]);
  await clearStudentSessions(tenantId, studentNumber);
  return { ok: true };
});
