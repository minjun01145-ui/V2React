import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebase.js";
import { isRecord } from "./validation.js";
import { effectiveTenantId, PRIMARY_TENANT_ID, tenantStudentKey, type TenantId } from "./tenant.js";
import { normalizePersonName } from "./validation.js";

function isAnonymousProvider(token: unknown): boolean {
  if (!isRecord(token) || !isRecord(token.firebase)) return false;
  return token.firebase.sign_in_provider === "anonymous";
}

export function requireAnonymous(request: CallableRequest<unknown>): string {
  if (!request.auth || !isAnonymousProvider(request.auth.token)) {
    throw new HttpsError("unauthenticated", "학생 인증이 필요합니다.");
  }
  return request.auth.uid;
}

export async function requireAdmin(request: CallableRequest<unknown>): Promise<string> {
  return (await requireAdminTenant(request)).uid;
}

export async function requireRegularStudent(request: CallableRequest<unknown>): Promise<{
  readonly uid: string;
  readonly tenantId: TenantId;
  readonly studentNumber: string;
  readonly displayName: string;
}> {
  const uid = requireAnonymous(request);
  const token = request.auth?.token;
  const studentNumber = typeof token?.studentNumber === "string" ? token.studentNumber : "";
  const displayName = typeof token?.displayName === "string" ? normalizePersonName(token.displayName) : "";
  if (token?.role !== "student" || !/^[0-9]{1,12}$/.test(studentNumber) || !displayName) {
    throw new HttpsError("permission-denied", "학생 인증 정보를 확인할 수 없습니다.");
  }
  const tenantId = effectiveTenantId(token.tenantId);
  const [profile, roster] = await Promise.all([
    db.collection("studentProfiles").doc(uid).get(),
    db.collection("studentRoster").doc(tenantStudentKey(tenantId, studentNumber)).get(),
  ]);
  const profileData: unknown = profile.exists ? profile.data() : null;
  const rosterData: unknown = roster.exists ? roster.data() : null;
  if (!isRecord(profileData)
    || profileData.studentNumber !== studentNumber
    || normalizePersonName(profileData.displayName) !== displayName
    || effectiveTenantId(profileData.tenantId) !== tenantId
    || !isRecord(rosterData)
    || rosterData.active === false
    || normalizePersonName(rosterData.displayName) !== displayName) {
    throw new HttpsError("permission-denied", "학생 계정 정보를 확인할 수 없습니다.");
  }
  return { uid, tenantId, studentNumber, displayName };
}

export async function requireAdminTenant(
  request: CallableRequest<unknown>,
  expectedTenantId?: TenantId,
): Promise<{ readonly uid: string; readonly tenantId: TenantId }> {
  if (!request.auth || isAnonymousProvider(request.auth.token)) {
    throw new HttpsError("unauthenticated", "관리자 로그인이 필요합니다.");
  }
  const snapshot = await db.collection("admins").doc(request.auth.uid).get();
  const raw: unknown = snapshot.exists ? snapshot.data() : null;
  if (!isRecord(raw) || raw.active === false) throw new HttpsError("permission-denied", "관리자 권한이 없습니다.");
  const tenantId = effectiveTenantId(raw.tenantId);
  if (expectedTenantId && tenantId !== expectedTenantId) throw new HttpsError("permission-denied", "이 사용자의 데이터를 관리할 권한이 없습니다.");
  return { uid: request.auth.uid, tenantId };
}

export async function requirePrimaryAdmin(request: CallableRequest<unknown>): Promise<string> {
  const admin = await requireAdminTenant(request);
  if (admin.tenantId !== PRIMARY_TENANT_ID) {
    throw new HttpsError("permission-denied", "공용 AI 설정을 관리할 권한이 없습니다.");
  }
  return admin.uid;
}

async function roomTenantId(roomId: string): Promise<TenantId> {
  const session = await db.collection("multiplayerSessions").doc(roomId).get();
  const data: unknown = session.exists ? session.data() : null;
  if (!isRecord(data)) throw new HttpsError("failed-precondition", "대기실을 찾을 수 없습니다.");
  return effectiveTenantId(data.tenantId);
}

export async function requireAdminForRoom(request: CallableRequest<unknown>, roomId: string): Promise<string> {
  const admin = await requireAdminTenant(request);
  if (admin.tenantId !== await roomTenantId(roomId)) throw new HttpsError("permission-denied", "이 대기실을 관리할 권한이 없습니다.");
  return admin.uid;
}

export async function requireRoomStudent(request: CallableRequest<unknown>, roomId: string): Promise<string> {
  const uid = requireAnonymous(request);
  const tenantId = effectiveTenantId(request.auth?.token.tenantId);
  if (tenantId !== await roomTenantId(roomId)) throw new HttpsError("permission-denied", "이 대기실의 참가자가 아닙니다.");
  const player = await db.collection("multiplayerSessions").doc(roomId).collection("players").doc(uid).get();
  if (!player.exists) throw new HttpsError("permission-denied", "이 대기실의 참가자가 아닙니다.");
  return uid;
}

export async function requireRoomCaller(request: CallableRequest<unknown>, roomId: string): Promise<string> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  return isAnonymousProvider(request.auth.token)
    ? requireRoomStudent(request, roomId)
    : requireAdminForRoom(request, roomId);
}
