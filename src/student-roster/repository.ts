import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import { currentTenantConfig } from "../tenant/config.ts";
import type { TenantId } from "../tenant/scope.ts";
import type { StudentRosterEntry, StudentRosterInput } from "./types.ts";

export async function listStudentRoster(): Promise<readonly StudentRosterEntry[]> {
  const callable = httpsCallable<{ readonly tenantId: TenantId }, { readonly students: readonly StudentRosterEntry[] }>(functions, "listStudents");
  return (await callable({ tenantId: currentTenantConfig().id })).data.students;
}

export async function saveStudentRosterEntry(input: StudentRosterInput): Promise<void> {
  const callable = httpsCallable<StudentRosterInput & { readonly tenantId: TenantId }, { readonly studentNumber: string }>(functions, "upsertStudent");
  await callable({ ...input, tenantId: currentTenantConfig().id });
}

export async function importStudentRoster(students: readonly StudentRosterInput[]): Promise<number> {
  const callable = httpsCallable<{ readonly students: readonly StudentRosterInput[]; readonly tenantId: TenantId }, { readonly count: number }>(functions, "importStudents");
  return (await callable({ students, tenantId: currentTenantConfig().id })).data.count;
}

export async function resetStudentRosterPin(student: StudentRosterEntry): Promise<void> {
  const callable = httpsCallable<{ readonly studentNumber: string; readonly name: string; readonly tenantId: TenantId }, { readonly ok: boolean }>(functions, "resetStudentPin");
  await callable({ studentNumber: student.studentNumber, name: student.displayName, tenantId: currentTenantConfig().id });
}

export async function removeStudentRosterEntry(student: StudentRosterEntry): Promise<void> {
  const callable = httpsCallable<{ readonly studentNumber: string; readonly name: string; readonly tenantId: TenantId }, { readonly ok: boolean }>(functions, "deleteStudent");
  await callable({ studentNumber: student.studentNumber, name: student.displayName, tenantId: currentTenantConfig().id });
}
