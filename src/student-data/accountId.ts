import { auth } from "../firebase/firebaseClient.ts";
import { effectiveTenantId, tenantAccountId } from "../tenant/scope.ts";

export async function resolveStudentGameDataAccountId(uid: string, studentNumber: string): Promise<string> {
  const user = auth.currentUser;
  if (!uid || !studentNumber || !user || user.uid !== uid) {
    throw new Error("학생 계정 인증 정보를 확인하지 못했습니다.");
  }

  const token = await user.getIdTokenResult();
  if (token.claims.studentNumber !== studentNumber) {
    throw new Error("학생 계정 인증 정보를 확인하지 못했습니다.");
  }
  if (token.claims.role === "test-student") return `test-${uid}`;
  if (token.claims.role !== "student") {
    throw new Error("학생 계정 인증 정보를 확인하지 못했습니다.");
  }
  return tenantAccountId(effectiveTenantId(token.claims.tenantId), studentNumber);
}
