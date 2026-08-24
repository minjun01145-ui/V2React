import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type { StudentRosterEntry, StudentRosterInput } from "./types.ts";

export async function listStudentRoster(): Promise<readonly StudentRosterEntry[]> {
  const callable = httpsCallable<Record<string, never>, { readonly students: readonly StudentRosterEntry[] }>(functions, "listStudents");
  return (await callable({})).data.students;
}

export async function saveStudentRosterEntry(input: StudentRosterInput): Promise<void> {
  const callable = httpsCallable<StudentRosterInput, { readonly studentNumber: string }>(functions, "upsertStudent");
  await callable(input);
}

export async function importStudentRoster(students: readonly StudentRosterInput[]): Promise<number> {
  const callable = httpsCallable<{ readonly students: readonly StudentRosterInput[] }, { readonly count: number }>(functions, "importStudents");
  return (await callable({ students })).data.count;
}

export async function resetStudentRosterPin(student: StudentRosterEntry): Promise<void> {
  const callable = httpsCallable<{ readonly studentNumber: string; readonly name: string }, { readonly ok: boolean }>(functions, "resetStudentPin");
  await callable({ studentNumber: student.studentNumber, name: student.displayName });
}

export async function removeStudentRosterEntry(student: StudentRosterEntry): Promise<void> {
  const callable = httpsCallable<{ readonly studentNumber: string; readonly name: string }, { readonly ok: boolean }>(functions, "deleteStudent");
  await callable({ studentNumber: student.studentNumber, name: student.displayName });
}
