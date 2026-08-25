import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "../shared/auth.js";
import { adminAuth, db } from "../shared/firebase.js";
import { isRecord, parseRosterInput, parseStudentCredentials } from "../shared/validation.js";

const callableOptions = { region: "asia-northeast3", enforceAppCheck: false } as const;

async function clearStudentSessions(studentNumber: string): Promise<void> {
  const profiles = await db.collection("studentProfiles").where("studentNumber", "==", studentNumber).get();
  if (profiles.empty) return;
  const batch = db.batch();
  for (const profile of profiles.docs) batch.delete(profile.ref);
  await batch.commit();
  await Promise.all(profiles.docs.map((profile) => adminAuth.deleteUser(profile.id).catch(() => undefined)));
}

export const listStudents = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const [roster, credentials] = await Promise.all([
    db.collection("studentRoster").get(),
    db.collection("studentPinCredentials").get(),
  ]);
  const configuredPins = new Set(credentials.docs.map((doc) => doc.id));
  return {
    students: roster.docs.map((doc) => {
      const raw: unknown = doc.data();
      return {
        studentNumber: doc.id,
        displayName: isRecord(raw) && typeof raw.displayName === "string" ? raw.displayName : "",
        active: !isRecord(raw) || raw.active !== false,
        pinConfigured: configuredPins.has(doc.id),
        updatedAtMs: isRecord(raw) && typeof raw.updatedAtMs === "number" ? raw.updatedAtMs : 0,
      };
    }).sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, "ko", { numeric: true })),
  };
});

export const upsertStudent = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const { studentNumber, name, active } = parseRosterInput(request.data);
  const ref = db.collection("studentRoster").doc(studentNumber);
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
  await requireAdmin(request);
  if (!isRecord(request.data) || !Array.isArray(request.data.students) || request.data.students.length < 1 || request.data.students.length > 200) {
    throw new HttpsError("invalid-argument", "한 번에 1명부터 200명까지 등록할 수 있습니다.");
  }
  const students = request.data.students.map(parseRosterInput);
  const unique = new Map(students.map((student) => [student.studentNumber, student]));
  const batch = db.batch();
  const now = Date.now();
  for (const student of unique.values()) {
    batch.set(db.collection("studentRoster").doc(student.studentNumber), {
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
  await requireAdmin(request);
  const { studentNumber } = parseStudentCredentials(request.data);
  await db.collection("studentPinCredentials").doc(studentNumber).delete();
  await clearStudentSessions(studentNumber);
  return { ok: true };
});

export const deleteStudent = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const { studentNumber } = parseStudentCredentials(request.data);
  await Promise.all([
    db.collection("studentRoster").doc(studentNumber).delete(),
    db.collection("studentPinCredentials").doc(studentNumber).delete(),
    db.recursiveDelete(db.collection("studentGameData").doc(studentNumber)),
  ]);
  await clearStudentSessions(studentNumber);
  return { ok: true };
});
