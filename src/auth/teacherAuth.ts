import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type Unsubscribe, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { appConfig } from "../config/appConfig.ts";
import { auth, db } from "../firebase/firebaseClient.ts";
import type { AdminSession } from "./types.ts";

function adminRef(uid: string) {
  return doc(db, "admins", uid);
}

async function resolveAdmin(user: User | null): Promise<AdminSession | null> {
  if (!user || user.isAnonymous) return null;
  const snapshot = await getDoc(adminRef(user.uid));
  if (!snapshot.exists()) return null;
  const raw: unknown = snapshot.data();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.active === false) return null;
  return { uid: user.uid, email: user.email ?? appConfig.adminAuthEmail };
}

export async function signInAdmin(password: string): Promise<AdminSession> {
  if (!appConfig.adminAuthEmail) throw new Error("관리자 계정 이메일이 설정되지 않았습니다.");
  if (!password) throw new Error("관리자 비밀번호를 입력해 주세요.");

  try {
    const credential = await signInWithEmailAndPassword(auth, appConfig.adminAuthEmail, password);
    const admin = await resolveAdmin(credential.user);
    if (!admin) {
      await signOut(auth);
      throw new Error("관리자 권한이 없습니다.");
    }
    return admin;
  } catch (error: unknown) {
    if (error instanceof Error && (
      error.message === "관리자 권한이 없습니다."
      || error.message === "관리자 계정 이메일이 설정되지 않았습니다."
    )) throw error;
    throw new Error("관리자 비밀번호가 올바르지 않거나 로그인을 완료할 수 없습니다.");
  }
}

export function subscribeAdminAuth(
  onValue: (admin: AdminSession | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    void resolveAdmin(user)
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
