import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebase.js";
import { isRecord } from "./validation.js";

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
  if (!request.auth || isAnonymousProvider(request.auth.token)) {
    throw new HttpsError("unauthenticated", "관리자 로그인이 필요합니다.");
  }
  const snapshot = await db.collection("admins").doc(request.auth.uid).get();
  const raw: unknown = snapshot.exists ? snapshot.data() : null;
  if (!isRecord(raw) || raw.active === false) throw new HttpsError("permission-denied", "관리자 권한이 없습니다.");
  return request.auth.uid;
}
