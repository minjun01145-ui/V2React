import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type Unsubscribe, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db } from "../firebase/firebaseClient.ts";
import { functions } from "../firebase/firebaseClient.ts";
import { effectiveTenantId, type TenantId } from "../tenant/scope.ts";
import type { AdminSession } from "./types.ts";

function adminRef(uid: string) {
  return doc(db, "admins", uid);
}

const syncAdminTenantClaim = httpsCallable<undefined, { readonly tenantId: string }>(functions, "syncAdminTenantClaim");

async function ensureAdminTenantClaim(user: User, tenantId: TenantId): Promise<void> {
  const token = await user.getIdTokenResult();
  if (token.claims.tenantId === tenantId) return;
  await syncAdminTenantClaim();
  await user.getIdToken(true);
}

async function resolveAdmin(user: User | null, expectedTenantId: TenantId): Promise<AdminSession | null> {
  if (!user || user.isAnonymous) return null;
  const snapshot = await getDoc(adminRef(user.uid));
  if (!snapshot.exists()) return null;
  const raw: unknown = snapshot.data();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.active === false) return null;
  const tenantId = effectiveTenantId(record.tenantId);
  if (tenantId !== expectedTenantId) return null;
  await ensureAdminTenantClaim(user, tenantId);
  return { uid: user.uid, email: user.email ?? "", tenantId };
}

export async function signInAdmin(email: string, password: string, tenantId: TenantId): Promise<AdminSession> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) throw new Error("관리자 이메일을 입력해 주세요.");
  if (!password) throw new Error("관리자 비밀번호를 입력해 주세요.");

  try {
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    const admin = await resolveAdmin(credential.user, tenantId);
    if (!admin) {
      await signOut(auth);
      throw new Error("관리자 권한이 없습니다.");
    }
    return admin;
  } catch (error: unknown) {
    if (error instanceof Error && (
      error.message === "관리자 권한이 없습니다."
      || error.message === "관리자 이메일을 입력해 주세요."
    )) throw error;
    throw new Error("관리자 비밀번호가 올바르지 않거나 로그인을 완료할 수 없습니다.");
  }
}

export function subscribeAdminAuth(
  tenantId: TenantId,
  onValue: (admin: AdminSession | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    void resolveAdmin(user, tenantId)
      .then(async (admin) => {
        if (!admin && user) await signOut(auth);
        onValue(admin);
      })
      .catch((error: unknown) => onError(error instanceof Error ? error : new Error("관리자 로그인 정보를 확인하지 못했습니다.")));
  });
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}
